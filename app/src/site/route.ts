import { useEffect, useMemo, useRef, useState } from "react";
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
  | { kind: "item"; id: string; item?: Item };

/** The hash, read once. `#/g/<anything>` is the gallery with that filter; anything unknown is the front page. */
export function parseRoute(hash: string): Route {
  if (hash === "#/chrome") return { kind: "chrome" };
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

/**
 * The pager's neighbours, as the shell computed them before this unit: the item's own source, in ingest order.
 * `neighbours()` in a later commit replaces this with a related walk.
 */
export function usePager(active?: Item) {
  const flat = useMemo(() => items.filter((i) => i.source === active?.source), [active?.source]);
  const idx = active ? flat.findIndex((i) => i.id === active.id) : -1;
  return {
    prev: idx > 0 ? flat[idx - 1] : undefined,
    next: idx >= 0 ? flat[idx + 1] : undefined,
  };
}
