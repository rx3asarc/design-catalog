import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { byId, items, type Item, type TreeSection } from "./lib";

/**
 * Where the visitor is, and what the rail and the pager derive from it.
 *
 * One place decides what a hash means. Every surface reads a `Route`; none of them parses `location.hash`
 * itself. `#/g/…` already parses to `{kind:'gallery'}` even though the app still renders the front page for
 * it — the gallery unit replaces exactly one labelled line in `App.tsx` and inherits the route.
 */

export type Route =
  | { kind: "home" }
  | { kind: "chrome" }
  | { kind: "gallery"; filter: string }
  | { kind: "item"; id: string; item?: Item };

/** The hash, read once. `#/g/<anything>` is the gallery with that filter; anything unknown is the front page. */
export function parseRoute(hash: string): Route {
  if (hash === "#/chrome") return { kind: "chrome" };
  if (hash === "#/g" || hash.startsWith("#/g/")) return { kind: "gallery", filter: hash.slice(3).replace(/^\//, "") };
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

/** Four sections, their categories, families inside those, and one more level where a family is big. */
export function buildTree(q: string, from: string): TreeSection[] {
  const needle = q.trim().toLowerCase();
  const hit = items.filter((i) => (!from || i.source === from) &&
    (!needle || `${i.name} ${i.slug} ${i.source} ${i.kind} ${i.category ?? ""}`.toLowerCase().includes(needle)));
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
  const subOf = (i: Item) => { const t = i.slug.split("-")[0]; return t.length < 3 ? i.slug : t; };
  const secondOf = (i: Item) => { const t = i.slug.split("-")[1]; return t && t.length > 1 ? t : i.slug; };
  return SECTIONS.map(([label, cats]) => {
    const catNodes = cats.filter((c) => hit.some((i) => (i.category ?? "Actions and controls") === c)).map((c) => {
      const rows = hit.filter((i) => (i.category ?? "Actions and controls") === c);
      const families = fam(rows, subOf).map((f) => ({ ...f, subs: f.rows.length > 12 ? fam(f.rows, secondOf) : [] }));
      return { key: c, label: c, rows, families };
    });
    return { label, count: catNodes.reduce((n, c) => n + c.rows.length, 0), cats: catNodes };
  }).filter((s) => s.count > 0);
}

export function useTree(q: string, from: string): TreeSection[] {
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
