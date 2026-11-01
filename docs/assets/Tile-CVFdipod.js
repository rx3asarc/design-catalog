var e=`import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { type Item, isMotionItem, readableName } from "./lib";
import { DemoFrame } from "./demo";

/**
 * The tile, and the pool that decides which tiles hold a frame.
 *
 * Moved here out of \`site/Gallery.tsx\` unchanged, so a second surface can show the same tile instead of a copy
 * of it: the front page's row and the gallery's grid are the same object, seen at two sizes. Nothing in this
 * file knows what a gallery filter is — \`Grid\` takes the rows it is given and mounts them.
 *
 * The three measurements that shaped it are unchanged and are commented at the place each one binds:
 *
 *  1. hiding a demo does not pause it — Chrome runs an offscreen same-origin frame at full rate, and
 *     \`visibility:hidden\` changes nothing, so a frame that leaves the margin is **detached** (pool.release);
 *  2. a live frame costs ~1.81 MB of heap and one long task to mount, and 60 fps only holds to ~9 of them,
 *     so the pool mounts **one per animation frame** and keeps **9** live on a wide grid, 2 on a phone;
 *  3. a demo's height is its own content height (2012 px for a dashboard, 0 for a viewport-sized one), so the
 *     tile is a **fixed-height, scaled viewport onto the demo's top-left**, never the demo's own height.
 */

/* ── the manifest's curated fields (the data unit's, not ours: absent means render nothing) ─────────────── */

export type Faceted = Item & {
  has_demo?: boolean;
  reference_only?: boolean;
  file_count?: number | null;
  bytes?: number | null;
  dep_count?: number | null;
  used_here?: number | null;
  composition?: { count: number; primitives?: string[]; lower_bound?: boolean } | null;
  concepts?: string[] | null;
};

export const faceted = (i: Item) => i as Faceted;

/** The published flag when the data has one; otherwise the fact the build already carries. */
export const hasDemo = (i: Item) => faceted(i).has_demo ?? false;

/* ── the mount pool: one iframe per frame, nine live, the rest detached ─────────────────────────────────── */

const LIVE_CAP = 9;          // measured: 60 fps holds to ~9 running frames, breaks at 16
const PHONE_CAP = 2;         // a phone shows one column; 1–2 live tiles is the whole budget
const MOUNT_MARGIN = "300px"; // mount when a tile is this close to the viewport
const EXIT_MARGIN = "600px";  // and detach only once it is this far away
const REF_WIDTH = 768;       // logical width a tile's demo lays out at, before it reports its own
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.6;
const SETTLE_MS = 140;       // mounts wait for the scroller to be still this long (see Pool.tick)

/* ── the serial gate: a budget derived from the wire, not a constant ────────────────────────────────────────
 *
 * A serial surface waits for the tile it just mounted to paint before it starts the next one. That wait used to be
 * a flat \`HOLD_MS = 6000\`, and at 400 kbit/s the constant was the schedule rather than a failsafe: measured, the
 * front page's six tiles mounted 6 s apart five times, and **only the first tile ever reported inside 6 s** — so
 * five of the six waits were the constant, and the last demo painted 30 s after the fifth mount (\`build/r10-pool.md\`,
 * the same staircase as \`build/r10-perf.md\`).
 *
 * The right wait is not knowable in advance and is not the same twice: it is how long **one tile** takes to cross
 * this pipe and boot on this machine. Two measured quantities say that, and neither is a constant:
 *
 *   · the wire — the browser records every transfer in \`performance.getEntriesByType("resource")\` with its
 *     compressed body and the moments its headers and body arrived, so a tile's bytes at the rate this pipe has
 *     actually been moving is  \`DEMO_TILE_BYTES / rate + rtt\`;
 *   · the tile itself — the pool measures every serial gate from mount to the child's report, so once one tile has
 *     painted on this connection, its own paint time is the better estimate for the next one.
 *
 *     budget = clamp(max(pipeBudget, lastPaintMs), HOLD_FLOOR_MS, HOLD_CEIL_MS)
 *
 * Before the first tile has painted there is nothing measured about this box, so the gate is \`HOLD_CEIL_MS\` — the
 * old constant — and the child's report still ends it early (measured at 400 kbit/s: the first tile reports at 5.3 s,
 * inside the six). Every gate after that is derived from a real measurement and can only be shorter than the old
 * constant, never longer. The three promises the constant carried are kept exactly:
 *
 *   · a demo that never reports cannot stall the row — \`HOLD_CEIL_MS\` is the old flat six seconds, as a ceiling;
 *   · a fast pipe is never slowed — a report always beats the timer, and the floor is one request cycle;
 *   · serial is not switched off — the first tile still gets the pipe to itself, which is the measured win.
 */
const HOLD_FLOOR_MS = 900;      // one request cycle's head start; under it a tile is started before its predecessor asked
const HOLD_CEIL_MS = 6000;      // the old flat wait, now only the ceiling, for a pipe that teaches us nothing
const DEMO_TILE_BYTES = 25_000; // measured: the front page's six demo documents are 149 KB, ≈24.8 KB each (r10-perf.md)
const WIRE_MIN_BYTES = 4096;    // smaller than this is a cache hit or a 304 and says nothing about the pipe

/**
 * What the pipe has said about itself, read from the browser's own transfer records.
 *
 * One observer for the page, not one per pool: the numbers describe the wire, and a grid and a row on the same page
 * are behind the same wire. \`buffered: true\` picks up transfers that happened before this code ran — the shell's
 * own chunks — which is how even the *first* serial mount has an opinion instead of starting blind.
 */
const WIRE = { rate: 0, rtt: 0, samples: 0 };
let wired = false;
function learnWire() {
  if (wired || typeof PerformanceObserver === "undefined") return;
  wired = true;
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        const bytes = e.encodedBodySize || e.transferSize;
        const body = e.responseEnd - e.responseStart;
        if (!bytes || bytes < WIRE_MIN_BYTES || body <= 0) continue;
        // an EWMA, because one transfer is not the wire: the first one on a page is the least typical, and a single
        // stalled request must not be able to double the next gate
        const sample = bytes / body;
        WIRE.rate = WIRE.rate > 0 ? WIRE.rate * 0.55 + sample * 0.45 : sample;
        const wait = e.responseStart - e.requestStart;
        if (wait > 0) WIRE.rtt = WIRE.rtt > 0 ? WIRE.rtt * 0.7 + wait * 0.3 : wait;
        WIRE.samples++;
      }
    });
    po.observe({ type: "resource", buffered: true });
  } catch {
    /* no resource timing in this browser: the ceiling is the gate, exactly the behaviour of the old constant */
  }
}

/** The wire's half of the gate: one demo tile's bytes, at the rate this pipe has actually been moving. */
function pipeBudget(): number {
  // with nothing measured there is no evidence of a slow pipe, so the row moves on one request cycle, not on six seconds
  const ms = WIRE.rate > 0 ? DEMO_TILE_BYTES / WIRE.rate + WIRE.rtt : HOLD_FLOOR_MS;
  return Math.max(HOLD_FLOOR_MS, Math.min(HOLD_CEIL_MS, ms));
}

/**
 * The element that actually scrolls this tile, or null when the document does.
 *
 * Both observers and the eviction order have to be measured against the real scroller: on a wide screen it is
 * \`.page\` (a fixed-height overflow:auto column), on a phone the page is in normal flow and the window scrolls.
 * Getting this wrong is not cosmetic — an observer rooted on a non-scrolling element treats its whole box as
 * the viewport, which makes every one of the 486 tiles "intersecting" at once.
 */
export function scrollerOf(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

type Slot = { key: string; el: HTMLElement; setLive: (v: boolean) => void }; 
export type PoolStats = {
  mounts: number; perFrameMax: number; frames: number; evictions: number; deferred: number; live: number; cap: number;
  /** the gate this pool last armed, and the numbers the wire armed it with (\`wireRate\` is bytes/ms) — published for
   *  the same reason as the counters: a measurement of an adaptive gate that cannot see the gate is not one */
  holdMs: number; wireRate: number; wireRtt: number;
};

/**
 * The mount queue.
 *
 * \`want()\` queues a tile, \`tick()\` mounts **at most one** in an animation frame — the rAF is the budget, so a
 * long mount task delays the next mount instead of stacking two. When the cap is reached the tile that is
 * furthest from the viewport centre is detached first, and a tile that is further out than *all* live ones is
 * deferred (with a slow retry, never a spinning rAF) rather than evicting a nearer demo for it.
 *
 * The counters are exposed on \`window.__gallery\` because §3 says this budget must be measured, not trusted,
 * and a measurement that has to guess what the queue did is not a measurement.
 */
export class Pool {
  readonly stats: PoolStats = { mounts: 0, perFrameMax: 0, frames: 0, evictions: 0, deferred: 0, live: 0, cap: 0, holdMs: 0, wireRate: 0, wireRtt: 0 };
  private slots = new Map<string, Slot>();
  private live = new Map<string, Slot>();
  private queue: string[] = [];
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | 0 = 0;
  private stillUntil = 0;
  private watching = false;
  /* ── the first screen's rule (r9) ────────────────────────────────────────────────────────────────────────────
   * A tile is a whole document: it loads its own React, the demo runtime and the demo's chunk, and on this box one
   * of those costs 1.47–3.02 MB and ~40 requests (measured, \`build/r9-home.md\` §2). Nine of them at once is the
   * measured ceiling for 60 fps, but *six of them at once on one slow link* is also six-way contention for the same
   * pipe: measured at 400 kbit/s, the first of the front page's six demos did not paint until 24.0 s and the last
   * until 56.2 s, because all six wanted the wire at the same instant.
   *
   * A surface that IS the first screen (\`serial\`) therefore mounts **one tile at a time, in view order, and waits
   * for that tile's child to speak before it starts the next**: the first demo gets the pipe to itself, so it is a
   * demo rather than a seventh of one. The hold is released by the child's first \`onSize\` message (\`reportReady\`)
   * or by the gate's own budget — \`holdBudget()\`, the larger of one demo tile's measured paint time at this speed
   * and its bytes at the rate this pipe has been measured to move, floored and ceilinged — because a demo that never
   * reports must not be able to stall the rest of the row, and because a wait that is the same number on every
   * connection is a schedule, not a failsafe (see the constants above for the measurement that made it one here).
   */
  private serially = false;
  private holding: string | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | 0 = 0;
  /** when the current gate was armed, and how long the last tile that reported took from mount to its report: the
   *  measured half of the gate (\`holdBudget\`), 0 until one serial tile has painted. */
  private holdSince = 0;
  private paintedMs = 0;
  /** the scrolling ancestor, resolved once: \`scrollerOf\` walks the tree and reads computed styles, and doing that
   *  per queued tile per mount cost ~10 ms of forced style recalc on a 486-tile grid. */
  private root: HTMLElement | null = null;
  private rootKnown = false;

  constructor(readonly cap: number) {
    this.stats.cap = cap;
    (window as any).__gallery = this.stats;
    learnWire();   // one observer per page (\`learnWire\` is idempotent); a grid never arms the gate but may still read it
  }

  register(slot: Slot) {
    this.slots.set(slot.key, slot);
    this.watch(slot.el);
  }
  /**
   * A mount is a 350–1200 ms long task on this box, so mounting *while* the visitor is scrolling is what makes a
   * scroll stutter — nine of them in a row cost more than the frames they land in. Mounts therefore wait for the
   * scroller to be still for SETTLE_MS; the tile is already inside the mount margin by then, and a placeholder
   * holds its exact box, so nothing jumps. The per-frame rule and the cap are unchanged.
   */
  private watch(el: HTMLElement) {
    if (!this.rootKnown) { this.root = scrollerOf(el); this.rootKnown = true; }
    if (this.watching) return;
    const target: HTMLElement | Window = this.root ?? window;
    target.addEventListener("scroll", () => { this.stillUntil = performance.now() + SETTLE_MS; }, { passive: true });
    this.watching = true;
  }
  unregister(key: string) {
    this.drop(key);
    this.slots.delete(key);
    const at = this.queue.indexOf(key);
    if (at >= 0) this.queue.splice(at, 1);
  }
  want(key: string) {
    if (this.live.has(key) || this.queue.includes(key)) return;
    this.queue.push(key);
    this.schedule();
  }
  /** Serial or parallel mounting: set once per surface, by the surface's own rule. */
  serial(on: boolean) {
    this.serially = on;
    if (!on) this.unhold();
  }
  /** The child has spoken (its first measured size): a serial pool may start the next tile now. */
  reportReady(key: string) {
    if (this.holding !== key) return;
    // how long one tile actually took, here, at this speed: the gate's best evidence for the next one
    this.paintedMs = Math.max(0, performance.now() - this.holdSince);
    this.unhold();
  }
  /**
   * The gate: how long the tile just mounted may hold the row before the next one starts.
   *
   * Never longer than the old flat constant and never shorter than one tile's measured paint at this speed, so a
   * slow connection gets a gate that reflects what a tile really costs and a fast one is never held back by a number
   * chosen for a slow one. The wire's budget is the evidence that always exists; the tile's own paint beats it when known.
   */
  private holdBudget(): number {
    const want = this.paintedMs > 0 ? Math.max(pipeBudget(), this.paintedMs) : HOLD_CEIL_MS;
    return Math.max(HOLD_FLOOR_MS, Math.min(HOLD_CEIL_MS, want));
  }
  private unhold() {
    if (this.holdTimer) { clearTimeout(this.holdTimer); this.holdTimer = 0; }
    if (this.holding === null) return;
    this.holding = null;
    if (this.queue.length) this.schedule();
  }
  /** Out of the exit margin: detach the element, keep the tile (and the page's geometry) exactly where it was. */
  release(key: string) {
    const at = this.queue.indexOf(key);
    if (at >= 0) this.queue.splice(at, 1);
    this.drop(key);
    if (this.queue.length) this.schedule();
  }

  private drop(key: string) {
    const slot = this.live.get(key);
    if (!slot) return;
    this.live.delete(key);
    slot.setLive(false);
    this.stats.live = this.live.size;
  }
  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => this.tick());
  }
  private dist(el: HTMLElement) {
    const box = this.root?.getBoundingClientRect();
    const centre = box ? box.top + box.height / 2 : innerHeight / 2;
    const r = el.getBoundingClientRect();
    return Math.abs(r.top + r.height / 2 - centre);
  }
  private furthest() {
    let out: { key: string; dist: number } | null = null;
    for (const [key, slot] of this.live) {
      const d = this.dist(slot.el);
      if (!out || d > out.dist) out = { key, dist: d };
    }
    return out;
  }
  /**
   * The queued tile nearest the viewport centre, which is the one a visitor is most likely looking at. When the
   * queue is long (a fast descent queues a screenful at once) arrival order would fill the pool with the tiles
   * that scrolled past first; this fills it with the ones on screen. Costs one rect per queued tile, paid once
   * per mount, not per frame.
   */
  private nearest() {
    let out: { key: string; dist: number } | null = null;
    let scanned = 0;
    for (const key of this.queue) {
      if (++scanned > 32) break;   // the queue is roughly in document order; 32 is more than a screenful
      const slot = this.slots.get(key);
      if (!slot) continue;
      const d = this.dist(slot.el);
      if (!out || d < out.dist) out = { key, dist: d };
    }
    return out?.key ?? null;
  }
  private tick() {
    this.raf = 0;
    this.stats.frames++;
    if (this.queue.length && performance.now() < this.stillUntil) { this.schedule(); return; }
    // a serial surface waits for the tile it just started to paint before it starts another (see the fields above)
    if (this.serially && this.holding !== null && this.live.has(this.holding)) return;
    let mounted = 0;
    let deferred = false;
    while (this.queue.length && !mounted) {
      const key = this.nearest();
      const at = key === null ? -1 : this.queue.indexOf(key);
      if (at < 0) { this.queue.shift(); continue; }
      const slot = this.slots.get(key!)!;
      if (this.live.size >= this.cap) {
        const victim = this.furthest();
        // this tile is further out than everything already running: wait, do not evict a nearer demo for it
        if (!victim || this.dist(slot.el) >= victim.dist) { deferred = true; break; }
        this.queue.splice(at, 1);
        this.drop(victim.key);
        this.stats.evictions++;
      } else {
        this.queue.splice(at, 1);
      }
      this.live.set(slot.key, slot);
      slot.setLive(true);
      this.stats.live = this.live.size;
      this.stats.mounts++;
      mounted = 1;
      if (this.serially) {
        // how long this tile may hold the row: what the wire says one demo tile costs, not a constant (see the
        // constants at the top of the file). Republished on the counters so the measurement can read the gate.
        const wait = this.holdBudget();
        this.holding = slot.key;
        this.holdSince = performance.now();
        this.stats.holdMs = Math.round(wait);
        this.stats.wireRate = Math.round(WIRE.rate * 10) / 10;
        this.stats.wireRtt = Math.round(WIRE.rtt);
        this.holdTimer = setTimeout(() => { this.holdTimer = 0; this.unhold(); }, wait);
      }
    }
    if (mounted) this.stats.perFrameMax = Math.max(this.stats.perFrameMax, mounted);
    if (!this.queue.length) return;
    // a deferred tile is retried slowly and off the animation-frame budget: never spin rAF for nothing
    if (deferred) {
      this.stats.deferred++;
      if (!this.timer) this.timer = setTimeout(() => { this.timer = 0; this.schedule(); }, 400);
      return;
    }
    this.schedule();
  }
}

/* ── the tile ───────────────────────────────────────────────────────────────────────────────────────────── */

const NARROW = "(max-width: 639px)";
export function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && matchMedia(NARROW).matches);
  useEffect(() => {
    const m = matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** The site's current theme, as a subscription — not as a read.
 *
 * \`<html>\` carries the theme as a class: the boot script in \`app/index.html\` paints it before the first CSS byte
 * and \`site/ThemeSwitch.tsx\` calls that same rule. Reading the class once per render (what this replaces) is why
 * a theme change left a mixed grid: the switch repaints \`<html>\`, nothing re-renders the gallery, and every frame
 * already mounted keeps the theme it was mounted with — a dark catalogue full of light demos.
 *
 * A \`MutationObserver\` on the class (and on \`data-theme\`, which the boot script sets to the *choice*, not the
 * paint) is the subscription: the class is the answer because it is what the browser has painted, \`data-theme\`
 * says only \`light\`/\`dark\`/\`system\`. \`prefers-color-scheme\` is watched too, because in the "auto" state the boot
 * script's own \`matchMedia\` listener is what repaints \`<html>\` when the OS changes — the observer catches that as
 * well, and this is the belt to that braces. No context provider, no dependency, and \`ThemeSwitch\` is untouched:
 * both read the one rule the boot script already owns.
 */
export function useSiteTheme(): "light" | "dark" {
  const read = (): "light" | "dark" =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const sync = () => setTheme((prev) => { const next = read(); return next === prev ? prev : next; });
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    sync();
    return () => { mo.disconnect(); mq.removeEventListener("change", sync); };
  }, []);
  return theme;
}

/**
 * A card's name is a **name**, not an address: \`form-formisch-complex\` and lowercase \`button\` are slugs, and the
 * round-5 review named them ("The titles are slugs"). \`readableName\` is the one rule in this repo that turns a
 * published slug into a title without inventing anything — the item page's \`<h1>\` already uses it, so a card and
 * the page it opens can no longer disagree about what the thing is called. \`displayLabel\` stays for the facets,
 * where the field is being named rather than the item.
 */
const title = (i: Item) => readableName(i);

/**
 * The facets a card shows, from the fields the data unit publishes. Known keys only; a \`null\` is "not known"
 * and prints nothing (the store shipped 0 bytes for 178 items once, which is what this guards against).
 */
/**
 * The manifest's facts about an item, as words.
 *
 * Two readers, two sets. A card in a grid of 486 prints the two facts that describe what the item *is* — how many
 * files it is and how big it is — plus how many parts it is made of. Printing \`deps\` and \`used here\` on all 486 as
 * well was the tester's noise complaint exactly ("the same four facts on every card, said again and again"): four
 * of the five facts are the same shape of number on almost every item, and a grid where everything says
 * \`3 files · 14 KB · ≥8 parts\` stops being a grid you can scan. The item page is where a reader has decided to look
 * at one thing, so it gets all five, and nothing is lost — \`mode="all"\` is that page.
 */
export function Facets({ item, mode = "card" }: { item: Item; mode?: "card" | "all" }) {
  const f = faceted(item);
  const out: string[] = [];
  if (typeof f.file_count === "number") out.push(\`\${f.file_count} file\${f.file_count === 1 ? "" : "s"}\`);
  if (typeof f.bytes === "number") out.push(f.bytes >= 1024 ? \`\${Math.round(f.bytes / 1024)} KB\` : \`\${f.bytes} B\`);
  if (mode === "all" && typeof f.dep_count === "number") out.push(\`\${f.dep_count} dep\${f.dep_count === 1 ? "" : "s"}\`);
  if (f.composition && typeof f.composition.count === "number" && f.composition.count > 0)
    out.push(\`\${f.composition.lower_bound ? "≥" : ""}\${f.composition.count} part\${f.composition.count === 1 ? "" : "s"}\`);
  if (mode === "all" && typeof f.used_here === "number" && f.used_here > 0) out.push(\`used here ×\${f.used_here}\`);
  if (!out.length) return null;
  return (
    <span data-catalog-facets="" style={{ display: "inline-flex", flexWrap: "wrap", gap: "2px 8px" }}>
      {out.map((t) => <span key={t} style={{ fontVariantNumeric: "tabular-nums" }}>{t}</span>)}
    </span>
  );
}

/**
 * What a card prints under its canvas: **the item's own one-line description**, its provenance, and nothing about
 * file counts.
 *
 * The review was blunt and right: "27 pattern · 21 files · sidebar" is not what a visitor needs; the item's
 * one-line description is. \`item.one_line\` is the data unit's sentence — it is read, never generated, and when the
 * manifest publishes none (355 of the 486 items that have a demo, and 107 of the 283 that do not) the slot stays
 * *empty* rather than being filled with something we wrote. The counts the card used to print are still on the
 * item page's own fact table (\`site/ItemPage.tsx\`), where a reader has decided to look at one thing.
 *
 * Why the geometry is fixed rather than content-sized: a grid is scanned by row, so a row where one card is two
 * lines taller than its neighbours is a row whose titles do not line up, and the measured spread of card heights
 * before this block existed was **0 px** at both 1440 and 390 (486 cards, all 275.9 px / all 247.9 px). Every slot
 * below is therefore a fixed height — a two-line name box (44 px, which is also the tap floor the name sits in), a
 * two-line description box (36 px), one provenance line (16 px) — so the spread stays 0 whatever the copy does.
 * The description is clamped with \`-webkit-line-clamp\`, which ends a cut line **with an ellipsis**, so nothing is
 * ever severed mid-word in silence.
 */
export function CardText({ item, name }: { item: Item; name: React.ReactNode }) {
  return (
    <div className="dc-card-text" data-card-text={item.id} data-card-has-line={item.one_line ? "1" : "0"}>
      {/*
       * The provenance is the **eyebrow**, above the name: which of the five libraries, and the item's licence, in
       * the system's 12/16 mono step. It was under the description, and that was the wrong place for a reason that
       * took a reader to point out: 355 of the 486 cards publish no description, so the reserved description slot
       * became a hole *between* the name and the provenance — the two things a card always has — and a grid of
       * holes reads as a broken grid. Above the name it is a subtitle, the description hangs under the name where a
       * description belongs, and a card with nothing to say simply ends after its name, with the whitespace below
       * it (the block's height is fixed, so the slide-rule does not change).
       */}
      <span className="dc-card-prov">{item.source} · {item.licence}</span>
      <span className="dc-card-name">{name}</span>
      {item.one_line ? <span className="dc-card-line" data-card-line={item.id}>{item.one_line}</span> : null}
    </div>
  );
}

/**
 * The one sentence an item with no demo gets, in the item page's own voice.
 *
 * The page says "No demo for this one — it is a helper or a doc, not a component." and, for the 93 items whose
 * licence forbids republication, "Code not shown here because the licence does not allow us to republish it."
 * A card is smaller than a page, so the two are cut to one clause each and keep the page's own words: **"No demo
 * for this one"** — not "NO DEMO", which is a label shouting at the reader, and not "reference-only", which is
 * our internal word. \`withheld\` decides which reason is printed, because the two absences are not the same fact.
 *
 * 283 items in this manifest have \`has_demo === false\`; all 283 are reference-only, and 93 of them are withheld.
 * Before this, a card that could not show a demo said only "no demo" in a mono kicker, and the *reason* — and the
 * fact that the code is not here at all — was one click away.
 */
export const NO_DEMO = {
  withheld: "No demo for this one — the licence does not allow us to republish the code.",
  absent: "No demo for this one — it is a helper or a doc, not a component.",
};
export const noDemoSentence = (i: Item) => (faceted(i).withheld ? NO_DEMO.withheld : NO_DEMO.absent);

/** The old one-line meta, kept for the surfaces that still want the facets (the item page's own table). */
export function CardMeta({ item }: { item: Item }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", minWidth: 0,
      fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.45, color: "var(--ink-muted)",
    }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.source}</span>
      <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
      <Facets item={item} />
    </div>
  );
}

export const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
  background: "var(--surface-300)", color: "inherit", textDecoration: "none", display: "block", minWidth: 0,
};

/**
 * A tile with a demo in it.
 *
 * The card is one link — the frame is \`inert\` and pointer-transparent, so a click anywhere opens the item page
 * (a demo is not an app here; the item page is where it is interactive) and the whole tile is one tab stop that
 * opens on Enter. Hover and focus both start a motion demo, so the affordance is not hover-only.
 */
export function DemoTile({ item, pool, colW, bodyH, theme, frozen, caption = "block" }: {
  item: Item; pool: Pool; colW: number; bodyH: number; theme: "light" | "dark";
  /**
   * Where the item's name goes. \`block\` is the grid's card: canvas, hairline, title and facets under it — a reader
   * is comparing rows there. \`bar\` is the hero row's: the name is a strip across the canvas's own foot, so the tile
   * is exactly \`bodyH\` tall and the front page's first screen is the same height in the boot shell, in React, and
   * after the frames mount. (Measured before: the shell drew 164×210 text cards and the page replaced them with
   * 164×317 cards — a 107 px shove down the page at the moment React took over.)
   */
  caption?: "block" | "bar";
  /**
   * Load the frame as a **frozen first frame** and let only the hovered/focused tile play. Absent is the grid's
   * own rule: a motion item (\`isMotionItem\`) loads frozen, everything else loads as it is. A surface whose frames
   * are on the critical path — the front page's row — passes this for every tile, because there the row is above
   * the fold and a running demo there is between the visitor and the page. One prop, no second tile.
   */
  frozen?: boolean;
}) {
  const key = item.id;
  const host = useRef<HTMLLIElement>(null);
  const [live, setLive] = useState(false);
  const [natural, setNatural] = useState(0);
  const naturals = useRef(0);
  const [play, setPlay] = useState(false);
  const zooms = useRef(0);
  const [hot, setHot] = useState(false); // hover or focus: the same visual state, so neither is privileged
  /**
   * A frame is late, and a poster that vanishes when the mount happens is a grey box for six to twelve seconds.
   *
   * Measured on the live front page: the hero's frames took 6–12 s to paint, and because the tile was \`live ?
   * frame : poster\`, the poster was swapped out the moment the pool mounted the tile — the visitor watched empty
   * rectangles for the whole of that, in the first thing on the page. The poster now stays *under* the frame and is
   * covered only when the child has spoken (its first \`onSize\` message, which the protocol sends once the demo has
   * booted), so a slow frame is a labelled card that becomes a demo, never a blank.
   *
   * \`ringed\` is \`:focus-visible\`, tracked as state because the ring is a style in this file and the selector is not.
   * The tile had no focus treatment of its own: it fell through to the user agent's outline, which Chromium draws
   * with \`outline-color\` — and the stylesheet's base rule makes that \`var(--focus)\` at 50% opacity. Measured, that
   * is 1.44:1 against the dark tile surface, i.e. a ring a visitor cannot see. The ring is 2 px of \`--foreground\`,
   * offset 2 px: 20.89:1 on the light tile and 18.59:1 on the dark one, both taken from the running page, and both
   * far above the 3:1 floor. \`:focus-visible\` and not \`:focus\`, so a mouse click does not leave a ring behind.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!live) setReady(false); }, [live]);
  const [ringed, setRinged] = useState(false);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    pool.register({ key, el, setLive });
    return () => pool.unregister(key);
  }, [pool, key]);

  // the demo reports the width its own content needs; the tile is a viewport onto it, scaled to fit and clamped.
  // Re-zoom stops after four corrections or when the reported width stops moving by more than 8%: a demo that
  // re-flows at a different frame width must not be able to oscillate the scale frame after frame.
  const onSize = useCallback((m: { height: number; width: number }) => {
    setReady(true);
    // the child has painted: on a serial surface this is what lets the next tile start (see Pool.serial)
    pool.reportReady(key);
    const w = m.width;
    if (!w || w < 32) return;
    if (zooms.current >= 4) return;                       // four corrections is a scale, not an oscillation
    const prev = naturals.current;
    if (prev && Math.abs(w - prev) <= Math.max(24, prev * 0.08)) return;
    naturals.current = w;
    zooms.current += 1;
    setNatural(w);
  }, []);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, colW > 0 ? colW / (natural || REF_WIDTH) : ZOOM_MIN + 0.15));  // The tile is a window of a fixed height, so the frame it looks through must be at least that tall **in the
  // child's own px** (\`bodyH / zoom\`, rounded up so the product can never land 0.3 px short). \`floor\` alone
  // could not do this: it is only what a demo gets *before* it reports, and a demo that honestly reports 60 px
  // then got 60 px inside a 210 px tile — measured, \`beui/marquee\` filled 30.4 px of 210 at 1440. \`stretch\` is
  // the prop that says "a tile is not a stage": it is absent everywhere else in the catalogue.
  const stretch = zoom > 0 ? Math.ceil(bodyH / zoom) : 0;
  // static=1 (a frozen first frame) and a play message are two halves of one rule: a frozen frame plays when, and
  // only when, this tile is hot. \`frozen\` widens it from motion items to every tile in the row.
  const still = frozen ?? isMotionItem(item);
  return (
    <li ref={host} data-tile={key} data-mode={live ? "live" : "parked"} style={{ listStyle: "none", minWidth: 0 }}>
      <a
        href={\`#/i/\${item.id}\`}
        data-catalog-item={item.id}
        style={{
          ...cardStyle,
          /*
           * THE CAPTION'S ANCHOR, and the whole of the review's worst finding (r5 §Home, item 1).
           *
           * The bar under a hero tile is \`position: absolute\` with \`left/right/bottom: 0\`, so it is positioned
           * against its nearest positioned ancestor — and this element, the card, had no \`position\` at all. The
           * browser walked past it to the page, and all six captions stacked in the page's bottom-left corner,
           * where the six demos had no visible names and a phone read the stuck bar as a footer. Measured on the
           * build before this line (1440 and 375): 0 of 6 captions inside their own tile, 1 distinct caption
           * position for all six. After: 6 of 6 inside, 6 distinct positions, both widths.
           *
           * The sibling canvas below is \`position: relative\` for the poster, which is why the poster was always
           * in the right place and only the caption was not: the fix belongs to the parent, not to the caption's
           * coordinates.
           */
          position: "relative",
          borderColor: hot ? "var(--focus)" : "var(--border)",
          outline: ringed ? "2px solid var(--ink)" : undefined,
          outlineOffset: ringed ? 2 : undefined,
        }}
        onMouseEnter={() => { setHot(true); setPlay(true); }}
        onMouseLeave={() => { setHot(false); setPlay(false); }}
        onFocus={(e) => { setHot(true); setPlay(true); setRinged(e.currentTarget.matches(":focus-visible")); }}
        onBlur={() => { setHot(false); setPlay(false); setRinged(false); }}
      >
        <div style={{ position: "relative", height: bodyH, overflow: "hidden", background: "var(--surface-300)" }}>
          {!ready ? <Poster item={item} /> : null}
          {live ? (
            /*
             * The frame is a picture of a demo here: the item page is where it is interactive, and a tile is one
             * tab stop that opens that page. So the subtree is \`inert\` — no focus, no pointer, no assistive
             * technology — and \`aria-hidden\` says the same thing a second time for the readers that consult it.
             *
             * \`inert\` used to be written \`{...{ inert: "" }}\`, which React 19 drops: an empty string is falsy for
             * a boolean attribute, so the attribute never reached the DOM (measured: every live frame carried no
             * \`inert\`, no \`tabindex\`, and Tab walked into all nine of them). It is a boolean prop now. That single
             * attribute is the whole of item 3's tab-order fix: measured, the stops inside a live tile went from
             * 1 + N (the anchor, then the demo's own controls) to exactly 1.
             *
             * \`opacity\` is the other half, from a tester's report: a mounted frame that has not booted yet is a
             * blank box, so the poster above stays visible until the child's first message and this fades in on top.
             */
            <div
              inert
              aria-hidden="true"
              data-demo-frame={item.id}
              style={{
                pointerEvents: "none", position: "relative",
                opacity: ready ? 1 : 0, transition: "opacity 140ms linear",
              }}
            >
              <DemoFrame
                id={item.id}
                index={0}
                zoom={zoom}
                floor={Math.ceil(bodyH / zoom) + 8}
                stretch={stretch || undefined}
                addr={{ static: still, theme }}
                play={still ? play : undefined}
                onSize={onSize}
              />
            </div>
          ) : null}
        </div>
        {caption === "bar" ? (
          <div
            data-tile-bar=""
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0, padding: "6px 10px",
              background: "var(--surface-200)", borderTop: "1px solid var(--border)",
              fontSize: 13, lineHeight: "20px", fontWeight: 500, color: "var(--ink)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {title(item)}
          </div>
        ) : (
          <CardText item={item} name={title(item)} />
        )}
      </a>
    </li>
  );
}

/* ── the poster: what a parked tile says, before its frame exists ─────────────────────────────────────── */

const POSTER_MONO: React.CSSProperties = {
  // 12 px is the floor: a poster's kicker and its \`source · kind\` line are the only words a visitor reads on a
  // phone before a demo loads, and at 11 px they measured as the smallest text on the site.
  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--ink-muted)", whiteSpace: "nowrap",
};

/**
 * Not mounted is not broken: a parked tile **names the item it will become**, in the exact box the demo will
 * occupy — title, \`source · kind\`, and the same facets the card prints below it.
 *
 * Why text and not a picture of the demo: the mount budget is one frame per animation frame and there are 486
 * tiles, so the tail of this grid is 5–10 seconds of tiles that have not been mounted yet. A skeleton and the
 * word "demo" say "wait"; the name says *which* item the wait is for, so a visitor can read the grid as a grid
 * before a single frame exists. Still, deliberately: 954 \`animate-pulse\` skeletons measured p95 66.8 ms against
 * **16.7 ms** for the very same DOM with the animation off (the gallery's own measurement, §5.4), so nothing
 * here pulses, spins or fades. Same reason there is no screenshot still — a still per tile is a payload, a name
 * is a string that is already in the manifest.
 *
 * The label keeps the same slot and casing as \`RefCard\`'s "no demo", so the two kinds of card stay one family
 * seen from two sides: this box is a demo that has not been mounted yet, that one is an item with no demo at all.
 */
export function Poster({ item }: { item: Item }) {
  return (
    <div
      data-poster={item.id}
      style={{
        position: "absolute", inset: 0, padding: "11px 12px 13px", display: "grid",
        alignContent: "space-between", gap: 10, minWidth: 0,
      }}
    >
      <span style={POSTER_MONO}>demo</span>
      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{
          fontSize: 15, lineHeight: 1.3, fontWeight: 500, overflowWrap: "anywhere",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{title(item)}</span>
        <span style={{ ...POSTER_MONO, textTransform: "none", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.source} · {item.kind}
        </span>
        {/*
         * The poster used to print the same facet line the card printed below it ("11 files · 37 KB · ≥2 parts"),
         * which made a parked tile repeat the numbers the card beneath it was already replacing with a sentence.
         * A parked tile names the item it will become; the description is the card's job, one block down.
         */}
      </span>
    </div>
  );
}

/**
 * A reference-only card (§3.3): no frame, no pretence of one. It is visibly a different object — dashed rule,
 * the library's own link out — so a page of them can never be mistaken for a wall of broken demos.
 */
export function RefCard({ item, bodyH }: { item: Item; bodyH: number }) {
  const out = item.page ?? item.url ?? null;
  return (
    <li data-tile={item.id} data-mode="reference" style={{ listStyle: "none", minWidth: 0, display: "block" }}>
      {/* \`display: block\`, not \`flex: 1\`: a card that stretches to a taller neighbour's row is a card whose own
          two halves are no longer its own height, and the block below is measured in fixed slots. */}
      <div style={{ ...cardStyle, borderStyle: "dashed" }}>
        {/*
         * The canvas a demo would have been in is where the absence belongs, and it is a **link to the item page**
         * (44 px, the tap floor) that says why in the page's own words. The kicker is a sentence now, not the mono
         * label "no demo": a reader who lands here should not have to infer whether the demo is missing, broken or
         * merely below the fold.
         */}
        <a
          href={\`#/i/\${item.id}\`}
          data-catalog-item={item.id}
          data-no-demo={item.id}
          data-no-demo-reason={faceted(item).withheld ? "withheld" : "absent"}
          style={{
            height: bodyH, display: "grid", alignContent: "center", justifyItems: "start", gap: 4,
            padding: "12px 14px", minHeight: 44, color: "inherit", textDecoration: "none",
            background: "transparent", borderBottom: "1px dashed var(--border)", boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 13, lineHeight: "19px", color: "var(--ink)" }}>{noDemoSentence(item)}</span>
          {out && <span style={{ fontSize: 12.5, lineHeight: "18px", color: "var(--ink-muted)" }}>Read it on {item.source} ↗</span>}
        </a>
        <CardText item={item} name={title(item)} />
        {/* the outbound link keeps its own 44 px row, under the block, so it never competes with the name */}
        {out && (
          <a href={out} target="_blank" rel="noreferrer" className="dc-card-out"
            style={{
              fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44,
              padding: "0 10px", borderTop: "1px solid var(--border)", color: "var(--ink)",
            }}>
            View on {item.source} ↗
          </a>
        )}
      </div>
    </li>
  );
}

/* ── the grid, and the observers that decide what is mounted ────────────────────────────────────────────── */

export function Grid({ rows, colW, bodyH, narrow, theme, cap, columns, frozen, defer, serial, caption = "block" }: {
  rows: Item[]; colW: number; bodyH: number; narrow: boolean; theme: "light" | "dark";
  /**
   * How many frames may run at once. Absent is the grid's own budget — 9 wide, 2 on a phone, both measured — and
   * a surface that shows fewer tiles than that budget may pass its own, because the budget is a ceiling on long
   * tasks, not a target: a row of six does not need nine. Never above the measured 9.
   */
  cap?: number;
  /**
   * The grid's own column template when absent: \`minmax(300px, 1fr)\`, one column on a phone. A row on a page
   * that is narrower than a grid (the front page's 860 px column) asks for its own, because 300 px minimums
   * would stack six tiles into six rows and put four of them below the fold.
   */
  columns?: string;
  /** Load every tile frozen and let the hovered/focused one play — see \`DemoTile\`'s \`frozen\`. */
  frozen?: boolean;
  /**
   * Mount after the first paint instead of at it: the frames are the page's heaviest work, so a surface that is
   * on the critical path starts its pool once the browser is idle (rAF-idle, with a timeout so it cannot be
   * starved) rather than competing with the first paint. The posters are already in place, in the exact boxes the
   * frames will occupy, so this costs the row no layout shift — it only decides when the frames begin.
   */
  defer?: boolean;
  /**
   * Mount one tile at a time and let each one finish painting before the next starts. For a surface whose tiles ARE
   * the first screen (\`site/Featured.tsx\`): six demo documents asking for one slow link at once is why the first
   * demo took 24 s to paint at 400 kbit/s. See \`Pool.serial\` for the measurement.
   */
  serial?: boolean;
  /** see \`DemoTile\`: a hero row names its tiles across the canvas's foot to keep the row one canvas tall */
  caption?: "block" | "bar";
}) {
  const host = useRef<HTMLUListElement>(null);
  const limit = cap ?? (narrow ? PHONE_CAP : LIVE_CAP);
  const pool = useMemo(() => new Pool(limit), [limit]);
  const [armed, setArmed] = useState(!defer);

  // the mounting rule belongs to the surface, not to the pool: a row of six tidies up after itself, a grid of 486
  // fills the pipe (the cap is what keeps a grid honest)
  useEffect(() => { pool.serial(!!serial); }, [pool, serial]);

  // the first paint happens without us; the mount queue starts on the first idle slot after it
  useEffect(() => {
    if (armed) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (ric) {
      const id = ric(() => setArmed(true), { timeout: 1000 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const id = setTimeout(() => setArmed(true), 250); // Safari, until it ships requestIdleCallback
    return () => clearTimeout(id);
  }, [armed]);

  // one pair of observers over the tiles: mount inside 300 px, detach beyond 600 px. Two, because a single
  // observer has a single rootMargin and the exit margin is deliberately twice the entrance.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || !armed) return;
    const nodes = [...el.querySelectorAll<HTMLElement>("[data-tile]")].filter((n) => n.dataset.mode !== "reference");
    if (!nodes.length) return;
    const root = scrollerOf(nodes[0]);
    const enter = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) pool.want((e.target as HTMLElement).dataset.tile!);
    }, { root, rootMargin: \`\${MOUNT_MARGIN} 0px\` });
    const exit = new IntersectionObserver((es) => {
      for (const e of es) if (!e.isIntersecting) pool.release((e.target as HTMLElement).dataset.tile!);
    }, { root, rootMargin: \`\${EXIT_MARGIN} 0px\` });
    nodes.forEach((n) => { enter.observe(n); exit.observe(n); });
    return () => { enter.disconnect(); exit.disconnect(); };
  }, [pool, rows, armed]);

  return (
    <ul
      ref={host}
      data-gallery-grid=""
      style={{
        listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8,
        // the spec's own grid: 300 px minimum, as many columns as fit, one column on a phone
        gridTemplateColumns: columns ?? (narrow ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))"),
      }}
    >
      {rows.map((item) =>
        hasDemo(item)
          ? <DemoTile key={item.id} item={item} pool={pool} colW={colW} bodyH={bodyH} theme={theme} frozen={frozen} caption={caption} />
          : <RefCard key={item.id} item={item} bodyH={bodyH} />,
      )}
    </ul>
  );
}

/** The column width, measured from the laid-out grid: the tile scale is derived from the real box, not a guess. */
export function useColumnWidth(narrow: boolean, count: number) {
  const [colW, setColW] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const tile = el.querySelector<HTMLElement>("[data-tile]");
      const w = tile ? Math.round(tile.getBoundingClientRect().width) : 0;
      setColW((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [narrow, count]);
  return { colW, host };
}
`;export{e as default};