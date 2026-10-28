import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { byId, items, type Item, type TreeSection } from "./lib";

/**
 * Where the visitor is, and what the rail and the pager derive from it.
 *
 * One place decides what a hash means. Every surface reads a `Route`; none of them parses `location.hash`
 * itself. `#/g/…` already parses to `{kind:'gallery'}` even though the app still renders the front page for
 * it — the gallery unit replaces exactly one labelled line in `App.tsx` and inherits the route.
 */

/**
 * A gallery filter, parsed out of the hash. Every field is optional; an empty query is "everything".
 *
 * `sec`/`cat`/`fam`/`sub` are the four rail levels, named exactly as the rail renders them, so a row's count
 * and the grid it opens are the same set. `ref` is the reference-only toggle. `ignored` is what the hash asked
 * for and this build does not know — carried, not swallowed, because a filter that silently renders everything
 * is the defect the gallery exists to fix.
 */
export type GalleryQuery = {
  src?: string; sec?: string; cat?: string; fam?: string; sub?: string; kind?: string; q?: string;
  ref?: boolean; ignored?: string[];
};

export type Route = {
  kind: "home"
}
  | { kind: "chrome" }
  | { kind: "gallery"; filter: string; query: GalleryQuery }
  | { kind: "about" }
  // one concept's members, compared: `#/c/<concept-key>`. An unknown key is a route too — the page names the
  // miss, which is what the gallery does, and a route that silently became the front page could not do that.
  | { kind: "concept"; key: string }
  | { kind: "item"; id: string; item?: Item };

/** The keys this build understands. Any other key in the hash is reported, never obeyed. */
export const GALLERY_KEYS = ["src", "sec", "cat", "fam", "sub", "kind", "q", "ref"] as const;

/** `?a=b&c=d` (or the same string without the `?`, or after `#/g/`) into a filter. */
export function parseGalleryQuery(raw: string): GalleryQuery {
  const q: GalleryQuery = {};
  const ignored: string[] = [];
  for (const [k, v] of new URLSearchParams(raw)) {
    if (!(GALLERY_KEYS as readonly string[]).includes(k)) { ignored.push(v ? `${k}=${v}` : k); continue; }
    if (k === "ref") { if (v !== "0" && v !== "false") q.ref = true; continue; }
    if (v) (q as Record<string, string>)[k] = v;
  }
  if (ignored.length) q.ignored = ignored;
  return q;
}

/**
 * A filter back into a hash. The one place that spelling lives, so a rail row, a filter chip and a hand-typed
 * URL cannot drift apart. Order is fixed (rail levels, then source, kind, text, toggle) so the same filter is
 * always the same string and a shared link reloads into the state that was shared.
 */
export function gridHref(q: GalleryQuery): string {
  const p = new URLSearchParams();
  for (const k of ["sec", "cat", "fam", "sub", "src", "kind", "q"] as const) {
    const v = q[k];
    if (typeof v === "string" && v) p.set(k, v);
  }
  if (q.ref) p.set("ref", "1");
  const s = p.toString();
  return s ? `#/g?${s}` : "#/g";
}

/**
 * The one spelling of a comparison address, so an item page's link, a hand-typed URL and a page that quotes its
 * own address cannot disagree. The key is the store's, printed verbatim — never slugged again on the way out.
 */
export const conceptHref = (key: string) => `#/c/${key}`;

/**
 * The hash, read once. `#/g[?…]` is the gallery with that filter; `#/g/…` is the same query without the `?`,
 * which is the shape this parser was split off with and stays readable. Anything unknown is the front page.
 */
export function parseRoute(hash: string): Route {
  if (hash === "#/chrome") return { kind: "chrome" };
  if (hash === "#/about") return { kind: "about" };
  if (hash === "#/g" || hash.startsWith("#/g?") || hash.startsWith("#/g/")) {
    const raw = hash.slice(3).replace(/^[/?]/, "");
    return { kind: "gallery", filter: raw, query: parseGalleryQuery(raw) };
  }
  if (hash.startsWith("#/c/")) return { kind: "concept", key: hash.slice(4) };
  if (hash.startsWith("#/i/")) {
    const id = hash.slice(4);
    return { kind: "item", id, item: byId.get(id) };
  }
  return { kind: "home" };
}

/**
 * The route, kept in sync with the hash.
 *
 * `onNavigate` runs on every hash change, before the render that follows it — the phone rail closes its
 * drawer with it. It is held in a ref so a new closure does not re-subscribe the listener.
 */
export function useRoute(onNavigate?: () => void) {
  const [hash, setHash] = useState(() => location.hash);
  const cb = useRef(onNavigate);
  cb.current = onNavigate;
  useEffect(() => {
    const on = () => { setHash(location.hash); cb.current?.(); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const route = useMemo(() => parseRoute(hash), [hash]);
  return { route, hash };
}

/**
 * The page scroller goes to the top on every route change.
 *
 * `.page` is the scroller (`styles.css`) and it is never remounted, so without this a new page opens wherever
 * the last one was left. A layout effect, so the reset happens before the new page is painted.
 */
export function useScrollReset(key: string) {
  useLayoutEffect(() => {
    const page = document.querySelector<HTMLElement>(".page");
    if (page) page.scrollTop = 0;
  }, [key]);
}

/** The four rail sections, in the order the rail shows them. */
const SECTIONS: [string, string[]][] = [
  ["Blocks and pages", ["Pages and blocks"]],
  ["Components", ["Navigation", "Forms and input", "Overlays and dialogs", "Actions and controls",
    "Feedback and status", "Layout and structure", "Content and text", "Charts and data", "Conversation and agent UI"]],
  ["Motion and effects", ["Motion and effects"]],
  ["Docs", ["Docs and guides"]],
];

/**
 * A section, plus the collapse `buildTree` decided for it.
 *
 * The rail renders this tree and the gallery resolves filters through the same object, so a duplicated level
 * is not cosmetic: "Motion and effects → Motion and effects" is a row the reader opens twice and a filter
 * value that exists at two depths. So the collapse happens here, in the tree, and it comes out as data — the
 * render decides nothing, it only follows what this file says.
 *
 *   `flatten: "cat"`    the section declares one category, so the section **is** that category: its families
 *                       hang directly off the section (Blocks and pages, Motion and effects).
 *   `flatten: "family"` …and that category holds a single family whose key is the section's own name
 *                       (Docs → "docs"), so the family's subs are the section's children instead.
 *
 * The collapse is expressed **beside** `cats`, never instead of it: `cats`/`families`/`subs` stay complete, so
 * `resolve()` in `site/Gallery.tsx` keeps resolving the published spelling.
 *
 *   CANONICAL, what the rail emits today:  `#/g?sec=Docs`
 *   still accepted (old links, and the grid's own chips):  `#/g?sec=Docs&cat=Docs and guides&fam=docs`
 *
 * Both resolve because the tree still carries the category and the family; only the rendering is shallower. No
 * spelling changed, so no published link needed a second spelling or a redirect.
 */
export type RailSection = TreeSection & { flatten?: "cat" | "family" };

/** A name as a slug token, for comparing a family key against a section label ("Docs" ↔ "docs"). */
const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The rail's text filter: one predicate, so the grid and the rail cannot disagree about what a search found.
 * A grid that opens 12 rows must count the same 12 the rail counted.
 */
export function needleHit(i: Item, q?: string): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  return !needle || `${i.name} ${i.slug} ${i.source} ${i.kind} ${i.category ?? ""}`.toLowerCase().includes(needle);
}

/** Four sections, their categories, families inside those, and one more level where a family is big. */
export function buildTree(q: string, from: string): RailSection[] {
  const hit = items.filter((i) => (!from || i.source === from) && needleHit(i, q));
  const fam = (rows: Item[], pick: (i: Item) => string) => {
    const m = new Map<string, Item[]>();
    for (const r of rows) {
      const k = pick(r);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()]
      .map(([key, rs]) => ({ key, rows: rs.sort((a, b) => a.slug.localeCompare(b.slug)) }))
      .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
  };
  const subOf = subKey;
  const secondOf = secondKey;
  return SECTIONS.map(([label, cats]) => {
    const catNodes = cats.filter((c) => hit.some((i) => (i.category ?? "Actions and controls") === c)).map((c) => {
      const rows = hit.filter((i) => (i.category ?? "Actions and controls") === c);
      const families = fam(rows, subOf).map((f) => ({ ...f, subs: f.rows.length > 12 ? fam(f.rows, secondOf) : [] }));
      return { key: c, label: c, rows, families };
    });
    const sec: RailSection = { label, count: catNodes.reduce((n, c) => n + c.rows.length, 0), cats: catNodes };
    // one declared category = the section and that category are the same level; a single family that repeats
    // the section's own name is that level too. Both tests read the declared/derived structure, never the
    // filtered count, so the rail does not re-nest itself while the reader types in the filter box.
    if (cats.length === 1 && catNodes.length === 1) {
      const only = catNodes[0];
      sec.flatten = only.families.length === 1 && slugOf(only.families[0].key) === slugOf(label) ? "family" : "cat";
    }
    return sec;
  }).filter((s) => s.count > 0);
}

/** The family a slug belongs to: its first token, or the whole slug when that token is too short to mean one. */
export const subKey = (i: Item) => { const t = i.slug.split("-")[0]; return t.length < 3 ? i.slug : t; };
/** The sub-family: the slug's second token, or the slug itself when there is no usable second token. */
export const secondKey = (i: Item) => { const t = i.slug.split("-")[1]; return t && t.length > 1 ? t : i.slug; };

export function useTree(q: string, from: string): RailSection[] {
  return useMemo(() => buildTree(q, from), [q, from]);
}

export type Relation = "same category" | "same kind" | "same source";
export type Neighbour = { item: Item; relation: Relation };

const RANK: Record<Relation, number> = { "same category": 0, "same kind": 1, "same source": 2 };

/** How two items are related, closest first, or null when they share nothing at all. */
function relation(a: Item, b: Item): Relation | null {
  if (a.category && a.category === b.category) return "same category";
  if (a.kind === b.kind) return "same kind";
  if (a.source === b.source) return "same source";
  return null;
}

/**
 * The pager's two neighbours: related, not alphabetical.
 *
 * Candidates are ranked by what they share with the item — category, then kind, then source — and inside a
 * rank they keep ingest order, so the walk is stable and the relation it found is nameable. Each side takes
 * the nearest candidate of the best rank that has one on that side, wrapping to the other end of that rank
 * when the item sits at its edge. Neighbours can cross sources: that is what "same category" is for.
 */
export function neighbours(active?: Item): { prev?: Neighbour; next?: Neighbour } {
  if (!active) return {};
  const at = items.findIndex((i) => i.id === active.id);
  const tiers: (Neighbour & { i: number })[][] = [[], [], []];
  items.forEach((item, i) => {
    if (item.id === active.id) return;
    const rel = relation(active, item);
    if (rel) tiers[RANK[rel]].push({ item, relation: rel, i });
  });
  let prev: (Neighbour & { i: number }) | undefined;
  let next: (Neighbour & { i: number }) | undefined;
  for (const tier of tiers) {
    next ??= tier.find((c) => c.i > at);
    prev ??= [...tier].reverse().find((c) => c.i < at);
    if (prev && next) break;
  }
  const best = tiers.find((t) => t.length) ?? [];
  next ??= best[0];
  prev ??= best[best.length - 1];
  if (prev && next && prev.item.id === next.item.id) prev = undefined;
  return {
    prev: prev && { item: prev.item, relation: prev.relation },
    next: next && { item: next.item, relation: next.relation },
  };
}
