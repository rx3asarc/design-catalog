var e=`import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { label as displayLabel, type Item, isMotionItem } from "./lib";
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
export const hasDemo = (i: Item) => faceted(i).has_demo ?? i.variants.length > 0;

/* ── the mount pool: one iframe per frame, nine live, the rest detached ─────────────────────────────────── */

const LIVE_CAP = 9;          // measured: 60 fps holds to ~9 running frames, breaks at 16
const PHONE_CAP = 2;         // a phone shows one column; 1–2 live tiles is the whole budget
const MOUNT_MARGIN = "300px"; // mount when a tile is this close to the viewport
const EXIT_MARGIN = "600px";  // and detach only once it is this far away
const REF_WIDTH = 768;       // logical width a tile's demo lays out at, before it reports its own
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.6;
const SETTLE_MS = 140;       // mounts wait for the scroller to be still this long (see Pool.tick)

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
  readonly stats: PoolStats = { mounts: 0, perFrameMax: 0, frames: 0, evictions: 0, deferred: 0, live: 0, cap: 0 };
  private slots = new Map<string, Slot>();
  private live = new Map<string, Slot>();
  private queue: string[] = [];
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | 0 = 0;
  private stillUntil = 0;
  private watching = false;
  /** the scrolling ancestor, resolved once: \`scrollerOf\` walks the tree and reads computed styles, and doing that
   *  per queued tile per mount cost ~10 ms of forced style recalc on a 486-tile grid. */
  private root: HTMLElement | null = null;
  private rootKnown = false;

  constructor(readonly cap: number) {
    this.stats.cap = cap;
    (window as any).__gallery = this.stats;
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

const title = (i: Item) => displayLabel(i);

/**
 * The facets a card shows, from the fields the data unit publishes. Known keys only; a \`null\` is "not known"
 * and prints nothing (the store shipped 0 bytes for 178 items once, which is what this guards against).
 */
export function Facets({ item }: { item: Item }) {
  const f = faceted(item);
  const out: string[] = [];
  if (typeof f.file_count === "number") out.push(\`\${f.file_count} file\${f.file_count === 1 ? "" : "s"}\`);
  if (typeof f.bytes === "number") out.push(f.bytes >= 1024 ? \`\${Math.round(f.bytes / 1024)} KB\` : \`\${f.bytes} B\`);
  if (typeof f.dep_count === "number") out.push(\`\${f.dep_count} dep\${f.dep_count === 1 ? "" : "s"}\`);
  if (f.composition && typeof f.composition.count === "number" && f.composition.count > 0)
    out.push(\`\${f.composition.lower_bound ? "≥" : ""}\${f.composition.count} part\${f.composition.count === 1 ? "" : "s"}\`);
  if (typeof f.used_here === "number" && f.used_here > 0) out.push(\`used here ×\${f.used_here}\`);
  if (!out.length) return null;
  return (
    <span data-catalog-facets="" style={{ display: "inline-flex", flexWrap: "wrap", gap: "2px 8px" }}>
      {out.map((t) => <span key={t} style={{ fontVariantNumeric: "tabular-nums" }}>{t}</span>)}
    </span>
  );
}

/** The one-line meta every card shares: source, licence, facets. Never wider than the card. */
export function CardMeta({ item }: { item: Item }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", minWidth: 0,
      fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.45, color: "var(--muted-foreground)",
    }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.source}</span>
      <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
      <Facets item={item} />
    </div>
  );
}

export const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
  background: "var(--card)", color: "inherit", textDecoration: "none", display: "block", minWidth: 0,
};

/**
 * A tile with a demo in it.
 *
 * The card is one link — the frame is \`inert\` and pointer-transparent, so a click anywhere opens the item page
 * (a demo is not an app here; the item page is where it is interactive) and the whole tile is one tab stop that
 * opens on Enter. Hover and focus both start a motion demo, so the affordance is not hover-only.
 */
export function DemoTile({ item, pool, colW, bodyH, theme, frozen }: {
  item: Item; pool: Pool; colW: number; bodyH: number; theme: "light" | "dark";
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
   * with \`outline-color\` — and the stylesheet's base rule makes that \`var(--ring)\` at 50% opacity. Measured, that
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
    const w = m.width;
    if (!w || w < 32) return;
    if (zooms.current >= 4) return;                       // four corrections is a scale, not an oscillation
    const prev = naturals.current;
    if (prev && Math.abs(w - prev) <= Math.max(24, prev * 0.08)) return;
    naturals.current = w;
    zooms.current += 1;
    setNatural(w);
  }, []);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, colW > 0 ? colW / (natural || REF_WIDTH) : ZOOM_MIN + 0.15));
  // The tile is a window of a fixed height, so the frame it looks through must be at least that tall **in the
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
          borderColor: hot ? "var(--ring)" : "var(--border)",
          outline: ringed ? "2px solid var(--foreground)" : undefined,
          outlineOffset: ringed ? 2 : undefined,
        }}
        onMouseEnter={() => { setHot(true); setPlay(true); }}
        onMouseLeave={() => { setHot(false); setPlay(false); }}
        onFocus={(e) => { setHot(true); setPlay(true); setRinged(e.currentTarget.matches(":focus-visible")); }}
        onBlur={() => { setHot(false); setPlay(false); setRinged(false); }}
      >
        <div style={{ position: "relative", height: bodyH, overflow: "hidden", background: "var(--muted)" }}>
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
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, overflowWrap: "anywhere" }}>{title(item)}</span>
          <CardMeta item={item} />
        </div>
      </a>
    </li>
  );
}

/* ── the poster: what a parked tile says, before its frame exists ─────────────────────────────────────── */

const POSTER_MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--muted-foreground)", whiteSpace: "nowrap",
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
        <span style={{ ...POSTER_MONO, textTransform: "none", letterSpacing: "0.02em", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.source} · {item.kind}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.45, color: "var(--muted-foreground)" }}>
          <Facets item={item} />
        </span>
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
    <li data-tile={item.id} data-mode="reference" style={{ listStyle: "none", minWidth: 0, display: "flex" }}>
      <div style={{ ...cardStyle, borderStyle: "dashed", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          height: bodyH, display: "grid", alignContent: "center", justifyItems: "start", gap: 6,
          padding: 12, background: "transparent", borderBottom: "1px dashed var(--border)",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--muted-foreground)",
          }}>no demo</span>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{item.kind}</span>
        </div>
        <div style={{ padding: "8px 10px", display: "grid", gap: 4 }}>
          <a href={\`#/i/\${item.id}\`} data-catalog-item={item.id}
            style={{
              fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: "inherit", textDecoration: "none",
              overflowWrap: "anywhere", display: "inline-flex", alignItems: "center", minHeight: 44,
            }}>
            {title(item)}
          </a>
          <CardMeta item={item} />
          {out && (
            <a href={out} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
              View on {item.source} ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── the grid, and the observers that decide what is mounted ────────────────────────────────────────────── */

export function Grid({ rows, colW, bodyH, narrow, theme, cap, columns, frozen, defer }: {
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
}) {
  const host = useRef<HTMLUListElement>(null);
  const limit = cap ?? (narrow ? PHONE_CAP : LIVE_CAP);
  const pool = useMemo(() => new Pool(limit), [limit]);
  const [armed, setArmed] = useState(!defer);

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
          ? <DemoTile key={item.id} item={item} pool={pool} colW={colW} bodyH={bodyH} theme={theme} frozen={frozen} />
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