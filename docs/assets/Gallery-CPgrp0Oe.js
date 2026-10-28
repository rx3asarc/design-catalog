var e=`import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Skeleton } from "@/registry/new-york-v4/ui/skeleton";
import { label as displayLabel, items, type Item, isMotionItem } from "./lib";
import { DemoFrame } from "./demo";
import { buildTree, gridHref, needleHit, type GalleryQuery, type TreeSection } from "./route";

/**
 * The gallery: every item the filter names, as a card, with a live demo in the ones that have one.
 *
 * Three measurements decide this file, and each one is a comment below at the place it binds:
 *
 *  1. hiding a demo does not pause it — Chrome runs an offscreen same-origin frame at full rate, and
 *     \`visibility:hidden\` changes nothing, so a frame that leaves the margin is **detached** (pool.release);
 *  2. a live frame costs ~1.81 MB of heap and one long task to mount, and 60 fps only holds to ~9 of them,
 *     so the pool mounts **one per animation frame** and keeps **9** live on a wide grid, 2 on a phone;
 *  3. a demo's height is its own content height (2012 px for a dashboard, 0 for a viewport-sized one), so the
 *     tile is a **fixed-height, scaled viewport onto the demo's top-left**, never the demo's own height.
 */

/* ── the manifest's curated fields (the data unit's, not ours: absent means render nothing) ─────────────── */

type Faceted = Item & {
  has_demo?: boolean;
  reference_only?: boolean;
  file_count?: number | null;
  bytes?: number | null;
  dep_count?: number | null;
  used_here?: number | null;
  composition?: { count: number; primitives?: string[]; lower_bound?: boolean } | null;
  concepts?: string[] | null;
};

const faceted = (i: Item) => i as Faceted;

/** The published flag when the data has one; otherwise the fact the build already carries. */
const hasDemo = (i: Item) => faceted(i).has_demo ?? i.variants.length > 0;

/* ── the filter, resolved through the same tree the rail renders ───────────────────────────────────────── */

type Resolved = {
  /** every row the filter matched, before the reference-only toggle */
  rows: Item[];
  shown: Item[];
  demo: Item[];
  refOnly: Item[];
  /** one line per value the hash asked for that this build cannot resolve */
  unknown: string[];
  /** the levels that were applied, so the header can say what the grid is */
  levels: string[];
};

const SOURCES = new Set(items.map((i) => i.source));
const KINDS = new Set(items.map((i) => i.kind));

/**
 * Resolve a query to rows.
 *
 * The rail levels are looked up **inside the rail's own tree**, not re-derived: a section that says 12 opens a
 * grid of 12 because both numbers come from \`buildTree\`. A value that resolves to nothing is reported in
 * \`unknown\` rather than ignored — the whole point of §3.1 is that a filter which matches nothing says so.
 */
export function resolve(query: GalleryQuery): Resolved {
  const unknown: string[] = [];
  const levels: string[] = [];
  const tree: TreeSection[] = buildTree(query.q ?? "", query.src ?? "");
  if (query.src && !SOURCES.has(query.src)) unknown.push(\`source “\${query.src}”\`);

  let sections = tree;
  if (query.sec) {
    const hit = tree.filter((s) => s.label === query.sec);
    if (!hit.length) unknown.push(\`section “\${query.sec}”\`);
    sections = hit;
    levels.push(query.sec);
  }
  let cats = sections.flatMap((s) => s.cats);
  if (query.cat) {
    const hit = cats.filter((c) => c.key === query.cat);
    if (!hit.length) unknown.push(\`category “\${query.cat}”\`);
    cats = hit;
    levels.push(query.cat);
  }
  let fams = cats.flatMap((c) => c.families);
  if (query.fam) {
    const hit = fams.filter((f) => f.key === query.fam);
    if (!hit.length) unknown.push(\`family “\${query.fam}”\`);
    fams = hit;
    levels.push(query.fam);
  }
  let rows: Item[];
  if (query.sub) {
    const hit = fams.flatMap((f) => f.subs).filter((s) => s.key === query.sub);
    if (!hit.length) unknown.push(\`sub-family “\${query.sub}”\`);
    rows = hit.flatMap((s) => s.rows);
    levels.push(query.sub);
  } else if (query.fam) rows = fams.flatMap((f) => f.rows);
  else if (query.cat || query.sec) rows = cats.flatMap((c) => c.rows);
  // no rail level: the whole catalogue, through the rail's own text predicate, so \`q=\` cannot mean two things
  else rows = items.filter((i) => (!query.src || i.source === query.src) && needleHit(i, query.q));

  if (query.kind) {
    if (!KINDS.has(query.kind)) unknown.push(\`kind “\${query.kind}”\`);
    else rows = rows.filter((i) => i.kind === query.kind);
    levels.push(query.kind);
  }
  if (query.q) levels.push(\`“\${query.q}”\`);

  const uniq = [...new Map(rows.map((i) => [i.id, i])).values()];
  const demo = uniq.filter(hasDemo);
  const refOnly = uniq.filter((i) => !hasDemo(i));
  return { rows: uniq, shown: query.ref ? [...demo, ...refOnly] : demo, demo, refOnly, unknown, levels };
}

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
function scrollerOf(el: HTMLElement | null): HTMLElement | null {
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
class Pool {
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
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && matchMedia(NARROW).matches);
  useEffect(() => {
    const m = matchMedia(NARROW);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** The site's current theme, read from the document rather than tracked here: the theme is another unit's. */
const themeOf = (): "light" | "dark" =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";

const title = (i: Item) => displayLabel(i);

/**
 * The facets a card shows, from the fields the data unit publishes. Known keys only; a \`null\` is "not known"
 * and prints nothing (the store shipped 0 bytes for 178 items once, which is what this guards against).
 */
function Facets({ item }: { item: Item }) {
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
function CardMeta({ item }: { item: Item }) {
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

const cardStyle: React.CSSProperties = {
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
function DemoTile({ item, pool, colW, bodyH, theme }: {
  item: Item; pool: Pool; colW: number; bodyH: number; theme: "light" | "dark";
}) {
  const key = item.id;
  const host = useRef<HTMLLIElement>(null);
  const [live, setLive] = useState(false);
  const [natural, setNatural] = useState(0);
  const naturals = useRef(0);
  const [play, setPlay] = useState(false);
  const zooms = useRef(0);
  const [hot, setHot] = useState(false); // hover or focus: the same visual state, so neither is privileged
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
  return (
    <li ref={host} data-tile={key} data-mode={live ? "live" : "parked"} style={{ listStyle: "none", minWidth: 0 }}>
      <a
        href={\`#/i/\${item.id}\`}
        data-catalog-item={item.id}
        style={{ ...cardStyle, borderColor: hot ? "var(--ring)" : "var(--border)" }}
        onMouseEnter={() => { setHot(true); setPlay(true); }}
        onMouseLeave={() => { setHot(false); setPlay(false); }}
        onFocus={() => { setHot(true); setPlay(true); }}
        onBlur={() => { setHot(false); setPlay(false); }}
      >
        <div style={{ position: "relative", height: bodyH, overflow: "hidden", background: "var(--muted)" }}>
          {live ? (
            <div {...{ inert: "" }} aria-hidden="true" style={{ pointerEvents: "none" }}>
              <DemoFrame
                id={item.id}
                index={0}
                zoom={zoom}
                floor={Math.ceil(bodyH / zoom) + 8}
                addr={{ static: isMotionItem(item), theme }}
                play={isMotionItem(item) ? play : undefined}
                onSize={onSize}
              />
            </div>
          ) : (
            <Placeholder />
          )}
        </div>
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "grid", gap: 4 }}>
          <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, overflowWrap: "anywhere" }}>{title(item)}</span>
          <CardMeta item={item} />
        </div>
      </a>
    </li>
  );
}

/**
 * Not mounted is not broken: the tile says a demo exists here, in the box the demo will occupy.
 *
 * The skeleton is deliberately **not** \`animate-pulse\`. Measured on the 486-tile grid: 954 pulsing skeletons
 * cost the main thread more than the nine live demo frames do — p95 rAF 66.8 ms animated vs **16.7 ms** with the
 * same 954 skeletons in the DOM and the animation off. A parked tile is a still picture of a tile.
 */
function Placeholder() {
  return (
    <div style={{ position: "absolute", inset: 0, padding: 12, display: "grid", alignContent: "space-between" }}>
      <Skeleton data-catalog-item="shadcn/skeleton" className="animate-none" style={{ width: "62%", height: 12 }} />
      <Skeleton data-catalog-item="shadcn/skeleton" className="animate-none" style={{ width: "86%", height: 42 }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "var(--muted-foreground)",
      }}>demo</span>
    </div>
  );
}

/**
 * A reference-only card (§3.3): no frame, no pretence of one. It is visibly a different object — dashed rule,
 * the library's own link out — so a page of them can never be mistaken for a wall of broken demos.
 */
function RefCard({ item, bodyH }: { item: Item; bodyH: number }) {
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

function Grid({ rows, colW, bodyH, narrow, theme }: {
  rows: Item[]; colW: number; bodyH: number; narrow: boolean; theme: "light" | "dark";
}) {
  const host = useRef<HTMLUListElement>(null);
  const cap = narrow ? PHONE_CAP : LIVE_CAP;
  const pool = useMemo(() => new Pool(cap), [cap]);

  // one pair of observers over the tiles: mount inside 300 px, detach beyond 600 px. Two, because a single
  // observer has a single rootMargin and the exit margin is deliberately twice the entrance.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
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
  }, [pool, rows]);

  return (
    <ul
      ref={host}
      data-gallery-grid=""
      style={{
        listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8,
        // the spec's own grid: 300 px minimum, as many columns as fit, one column on a phone
        gridTemplateColumns: narrow ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
      }}
    >
      {rows.map((item) =>
        hasDemo(item)
          ? <DemoTile key={item.id} item={item} pool={pool} colW={colW} bodyH={bodyH} theme={theme} />
          : <RefCard key={item.id} item={item} bodyH={bodyH} />,
      )}
    </ul>
  );
}

/** The column width, measured from the laid-out grid: the tile scale is derived from the real box, not a guess. */
function useColumnWidth(narrow: boolean, count: number) {
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

/* ── the surface ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * \`#/g[?filter]\`: what is here, how much of it is hidden, and the grid itself.
 *
 * The header is the whole contract of §3.3 — how many are shown, how many are reference-only and hidden, one
 * honest toggle that is also in the URL. A filter value that matches nothing is named, because a gallery that
 * silently renders the catalogue for a typo is the defect this route replaces.
 */
export function Gallery({ query }: { query: GalleryQuery }) {
  const narrow = useNarrow();
  const bodyH = narrow ? 180 : 210;
  const resolved = useMemo(() => resolve(query), [query]);
  const { colW, host } = useColumnWidth(narrow, resolved.shown.length);
  const theme = themeOf();
  const sig = JSON.stringify([query, resolved.shown.length]);

  const title = resolved.levels.length
    ? resolved.levels.join(" · ")
    : query.q ? \`“\${query.q}”\` : "Everything";
  // the first number is the filter's total — the same count the rail row showed — then what of it is on screen
  const counted = \`\${resolved.rows.length} items · \${resolved.shown.length} shown · \${resolved.refOnly.length} reference-only \${query.ref ? "included" : "hidden"}\`;
  const chips = ([
    ["src", query.src], ["q", query.q], ["kind", query.kind],
  ] as const).filter(([, v]) => v);

  return (
    <div className="page-in" style={{ maxWidth: 1560, margin: "0 auto" }}>
      <h2 className="title" data-gallery-title="">{title}</h2>
      <p className="lede" style={{ marginBottom: 12 }}>
        {resolved.demo.length} of the items in this filter run live here — a scaled viewport onto the demo, with the
        item page behind the tile. {resolved.refOnly.length} are reference-only: a licence entry with no demo.
      </p>
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "0 0 16px",
        paddingBottom: 12, borderBottom: "1px solid var(--border)",
      }}>
        <span
          data-gallery-counts=""
          data-gallery-shown={resolved.shown.length}
          data-gallery-hidden={query.ref ? 0 : resolved.refOnly.length}
          data-gallery-total={resolved.rows.length}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em", color: "var(--muted-foreground)" }}
        >{counted}</span>
        <span style={{ flex: 1 }} />
        <Button
          data-catalog-item="shadcn/button"
          variant={query.ref ? "default" : "outline"}
          className="h-11 px-3 text-xs md:h-8"
          aria-pressed={!!query.ref}
          onClick={() => { location.hash = gridHref({ ...query, ref: !query.ref }); }}
        >
          {query.ref ? "Hide reference-only" : \`Show reference-only (\${resolved.refOnly.length})\`}
        </Button>
        {(chips.length > 0 || query.sec || query.cat || query.fam || query.sub) && (
          <a href="#/g" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", minHeight: 44 }}>All items</a>
        )}
      </div>
      {query.ignored?.length ? (
        <p role="status" style={{ fontSize: 14, margin: "0 0 12px" }}>
          This link asks for {query.ignored.map((k) => <code key={k} style={{ marginRight: 6 }}>{k}</code>)}which this
          build does not filter on. <a href="#/g">Show everything</a>
        </p>
      ) : null}
      {resolved.unknown.length ? (
        <p role="status" style={{ fontSize: 14, margin: "0 0 12px" }}>
          Nothing here is called {resolved.unknown.join(", ")}. <a href="#/g">Show everything</a>
        </p>
      ) : null}
      <div ref={host}>
        {resolved.shown.length ? (
          <Grid key={sig} rows={resolved.shown} colW={colW} bodyH={bodyH} narrow={narrow} theme={theme} />
        ) : (
          <div className="withheld" style={{ margin: "0 0 24px" }}>
            No item matches this filter.{" "}
            {resolved.refOnly.length ? (
              <><a href={gridHref({ ...query, ref: true })}>Include {resolved.refOnly.length} reference-only items</a>, or{" "}</>
            ) : null}
            <a href="#/g">show everything</a>.
          </div>
        )}
      </div>
    </div>
  );
}
`;export{e as default};