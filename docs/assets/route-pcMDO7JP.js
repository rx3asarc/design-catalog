var e=`import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { byId, items, type Item, type TreeSection } from "./lib";
import type { TypeEntry } from "./taxonomy";
import { typeAt, typeHref } from "./typeIndex";

/**
 * Where the visitor is, and what the rail and the pager derive from it.
 *
 * One place decides what a hash means. Every surface reads a \`Route\`; none of them parses \`location.hash\`
 * itself. \`#/g/…\` parses to \`{kind:'gallery'}\` (the shape this unit inherited, still accepted), and an address
 * nothing resolves — an unknown item id, a path this build does not have — is \`{kind:'notfound'}\`, carrying what
 * was asked for. It used to be the front page with a bad address bar, which is a lie the shell told.
 */

/**
 * A gallery filter, parsed out of the hash. Every field is optional; an empty query is "everything".
 *
 * \`sec\`/\`cat\`/\`fam\`/\`sub\` are the four rail levels, named exactly as the rail renders them, so a row's count
 * and the grid it opens are the same set. \`ref\` is the reference-only toggle. \`ignored\` is what the hash asked
 * for and this build does not know — carried, not swallowed, because a filter that silently renders everything
 * is the defect the gallery exists to fix.
 */
export type GalleryQuery = {
  src?: string; sec?: string; cat?: string; fam?: string; sub?: string; kind?: string; q?: string;
  ref?: boolean; ignored?: string[];
};

/**
 * A real item offered to a visitor whose address missed, and the honest reason it is offered.
 *
 * There is no similarity score here on purpose: a near-miss is one of a small number of mechanical facts — the
 * same slug filed under another source, a slug in the asked-for source that continues the one that was typed, or
 * "the source exists and these are its items". Anything softer is guessing dressed as search.
 */
export type Candidate = { item: Item; why: string };

/**
 * What a visitor asked for and this build does not have, carried whole so the page can say it plainly.
 *
 * \`asked\` is the address bar's own string: a page that says "that page does not exist" without printing what was
 * typed is asking the reader to remember it for us.
 */
export type Miss = {
  asked: string;
  /** \`item\`: a \`source/slug\` id this build does not have; \`path\`: a path it does not know at all */
  what: "item" | "path";
  /** an item miss, the id as it was asked (before case folding), and its two halves */
  id?: string;
  source?: string;
  slug?: string;
  /** whether the source is a real one, and how many items it has — the difference between "wrong slug" and
   *  "wrong library" is the difference between two useful sentences, so both facts are carried */
  sourceKnown?: boolean;
  sourceCount?: number;
  /** nearest real items, each with its reason; empty when nothing honest can be offered */
  candidates: Candidate[];
};

export type Route = {
  kind: "home"
}
  | { kind: "chrome" }
  | { kind: "gallery"; filter: string; query: GalleryQuery }
  | { kind: "about" }
  // one concept's members, compared: \`#/c/<concept-key>\`. An unknown key is a route too — the page names the
  // miss, which is what the gallery does, and a route that silently became the front page could not do that.
  | { kind: "concept"; key: string }
  // one type's members: \`#/t/<section-slug>/<type-slug>\`, the collection the taxonomy already describes. The
  // entry is carried, not re-derived, so the page and the address are the same entry by construction.
  | { kind: "type"; entry: TypeEntry }
  | { kind: "item"; id: string; item?: Item }
  // an address that resolves to nothing. It is a route, not a fallback: the shell used to render the front page
  // for it while the address bar kept the wrong URL, so a visitor could neither see the mistake nor fix it.
  | { kind: "notfound"; miss: Miss };

/** The keys this build understands. Any other key in the hash is reported, never obeyed. */
export const GALLERY_KEYS = ["src", "sec", "cat", "fam", "sub", "kind", "q", "ref"] as const;

/** \`?a=b&c=d\` (or the same string without the \`?\`, or after \`#/g/\`) into a filter. */
export function parseGalleryQuery(raw: string): GalleryQuery {
  const q: GalleryQuery = {};
  const ignored: string[] = [];
  for (const [k, v] of new URLSearchParams(raw)) {
    if (!(GALLERY_KEYS as readonly string[]).includes(k)) { ignored.push(v ? \`\${k}=\${v}\` : k); continue; }
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
  return s ? \`#/g?\${s}\` : "#/g";
}

/**
 * The one spelling of a comparison address, so an item page's link, a hand-typed URL and a page that quotes its
 * own address cannot disagree. The key is the store's, printed verbatim — never slugged again on the way out.
 */
export const conceptHref = (key: string) => \`#/c/\${key}\`;

/** Ids, folded: a shared link can arrive in caps (\`#/i/beui/DYNAMIC-ISLAND\`) and the id it means is lower. */
const byFoldedId = new Map(items.map((i) => [i.id.toLowerCase(), i]));

/** Everything but letters and digits, gone — the shape two spellings of one slug share. */
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Every source in the build, once. */
export const SOURCES = [...new Set(items.map((i) => i.source))].sort();

/**
 * The nearest real items to an id that missed, each with the reason it is here — or nothing.
 *
 * Three mechanical rules, in order, deduplicated and capped:
 *
 *  1. **the same slug, from another source** — "you asked for beui's \`dynamic-island\`; shadcn has one" is a
 *     fact and the reader can act on it. Only an exact fold of the whole slug counts, so \`dynamic\` never
 *     claims to be \`dynamic-island\` here.
 *  2. **a longer slug in the source that was asked for** — \`dynamic\` → \`dynamic-island\` is a prefix the reader
 *     was in the middle of typing, not a similarity score.
 *  3. **the source's own items** — the source exists and the slug does not: rather than pretend to know which
 *     of its 200 items was meant, the page names a few of them and says so. Sorted by id, so the answer is a
 *     function of the manifest and never of a shuffle.
 */
export function missCandidates(source: string, slug: string): Candidate[] {
  const want = fold(slug);
  const src = fold(source);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (item: Item, why: string) => {
    if (out.length >= 6 || seen.has(item.id)) return;
    seen.add(item.id);
    out.push({ item, why });
  };
  if (want) {
    for (const i of items) if (fold(i.slug) === want && fold(i.source) !== src) add(i, \`the same name, filed under \${i.source}\`);
    const same = items.filter((i) => fold(i.source) === src);
    for (const i of same) {
      const s = fold(i.slug);
      if (s.length > want.length && s.startsWith(want)) add(i, \`a longer name in \${i.source}\`);
    }
  }
  const same = items.filter((i) => fold(i.source) === src).sort((a, b) => a.id.localeCompare(b.id));
  for (const i of same) add(i, \`one of \${i.source}'s \${same.length} items\`);
  return out;
}

/** A miss at an item address: the id as asked, plus everything the page needs to be useful about it. */
function missItem(asked: string, source: string, slug: string): Route {
  const same = items.filter((i) => i.source === source).length;
  return {
    kind: "notfound",
    miss: {
      asked, what: "item", id: \`\${source}/\${slug}\`, source, slug,
      sourceKnown: SOURCES.includes(source), sourceCount: same,
      candidates: missCandidates(source, slug),
    },
  };
}

/**
 * A miss at a path this build does not have. \`#/zzz\` and \`#/i/onlyone\` both land here.
 *
 * There are no candidates: an address that names no source and no slug has no near-miss to compute, and the page
 * offers the two ways that always work instead of inventing a third.
 */
function missPath(asked: string): Route {
  return { kind: "notfound", miss: { asked, what: "path", candidates: [] } };
}

/**
 * The hash, read once.
 *
 * \`#/g[?…]\` is the gallery with that filter; \`#/g/…\` is the same query without the \`?\`, which is the shape this
 * parser was split off with and stays readable. Everything else is normalised before it is judged, because a
 * shared link picks up spelling the address bar never showed anyone:
 *
 *  - a **trailing slash** is not part of any address this build writes, so it is dropped (\`#/i/beui/x/\` → the
 *    item). The bar is then corrected by \`canonicalHash\`, not by a second route.
 *  - **case** is folded for an item id: \`#/i/beui/DYNAMIC-ISLAND\` is the manifest's \`beui/dynamic-island\`.
 *  - a **third segment** is dropped: \`#/i/beui/dynamic-island/x\` is still that item, and \`#/about/extra\` is the
 *    about page. A stale link one segment too deep is a link to something real, not a miss.
 *
 * What is left over is a miss, and it says so (\`kind: "notfound"\`) rather than falling through to the front
 * page: an address that renders the home page while the bar keeps the wrong URL teaches the visitor nothing.
 */
export function parseRoute(hash: string): Route {
  const bare = hash.startsWith("#") ? hash.slice(1) : hash;
  // the gallery owns everything after \`#/g\`, \`?\` included: its query is its own syntax
  if (bare === "/g" || bare.startsWith("/g?") || bare.startsWith("/g/")) {
    const raw = bare.slice(2).replace(/^[/?]/, "");
    return { kind: "gallery", filter: raw, query: parseGalleryQuery(raw) };
  }
  const seg = bare.replace(/\\/+$/, "").split("/").filter((s) => s.length > 0);
  // \`#\`, \`#/\` and the empty hash are the front page
  if (!seg.length) return { kind: "home" };
  const [head, ...rest] = seg;
  const page = head.toLowerCase();
  // a page this build has, with any extra segment dropped (see above)
  if (page === "about") return { kind: "about" };
  if (page === "chrome") return { kind: "chrome" };
  if (page === "c") return { kind: "concept", key: rest.join("/") };
  if (page === "t") {
    // half a type address is not a type address: \`#/t/components\` names a section, and no page here is a section
    if (rest.length < 2) return missPath(hash);
    const [section, type] = rest;                            // a third segment is spelling, not identity
    const entry = typeAt(section, type);
    return entry ? { kind: "type", entry } : missPath(hash);  // a pair the taxonomy does not have is a miss
  }
  if (page === "i") {
    if (rest.length < 2) return missPath(hash);            // \`#/i/beui\`: half an id is not an id
    const [source, slug] = rest;                            // a third segment is spelling, not identity
    const item = byId.get(\`\${source}/\${slug}\`) ?? byFoldedId.get(\`\${source}/\${slug}\`.toLowerCase());
    // the manifest's own id is the route's id: a case-folded match renders and prints the real spelling
    return item ? { kind: "item", id: item.id, item } : missItem(hash, source, slug);
  }
  return missPath(hash);
}

/**
 * The one spelling of a route's address, or null where the address a visitor typed is already its own answer.
 *
 * This is the redirect half of normalising: \`parseRoute\` decides what a spelling *means*, and this decides what
 * the address bar should *say*. Only addresses that have exactly one canonical form appear here — a trailing
 * slash folded away, an id's case put back the way the manifest publishes it, an extra segment dropped.
 *
 * The three nulls are deliberate:
 *  - **notfound** — a miss is its own address. Rewriting \`#/i/beui/does-not-exist\` to something canonical would
 *    hide the thing the page is complaining about.
 *  - **home, gallery, concept** — \`""\`, \`#\` and \`#/\` are all the front page and none of them is wrong; a
 *    gallery's query is its spelling (including the keys it reports as ignored); a concept key is the store's
 *    and is printed verbatim.
 */
export function canonicalHash(route: Route): string | null {
  switch (route.kind) {
    case "about": return "#/about";
    case "chrome": return "#/chrome";
    case "item": return \`#/i/\${route.item?.id ?? route.id}\`;
    // the taxonomy's own names are the canonical spelling: \`#/t/Components/Button\` → \`#/t/components/button\`
    case "type": return typeHref(route.entry);
    case "notfound": return null;
    case "home": return null;
    case "gallery": return null;
    case "concept": return null;
  }
}

/**
 * Correct the address bar to the route's canonical spelling — a redirect, never a page.
 *
 * \`replaceState\`, so Back does not walk through a spelling the visitor never typed, and so the redirect costs no
 * history entry and no second render: the page the address now names is the page that is already on screen.
 * \`history.state\` is passed through untouched, because \`useScrollRestore\` keeps its history-entry id there.
 */
export function useCanonical(route: Route, hash: string) {
  useEffect(() => {
    const want = canonicalHash(route);
    if (!want || want === hash || want === location.hash) return;
    history.replaceState(history.state, "", location.pathname + location.search + want);
  }, [route, hash]);
}

/**
 * The route, kept in sync with the hash.
 *
 * \`onNavigate\` runs on every hash change, before the render that follows it — the phone rail closes its
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
 * \`.page\` is the scroller (\`styles.css\`) and it is never remounted, so without this a new page opens wherever
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
 * A section, plus the collapse \`buildTree\` decided for it.
 *
 * The rail renders this tree and the gallery resolves filters through the same object, so a duplicated level
 * is not cosmetic: "Motion and effects → Motion and effects" is a row the reader opens twice and a filter
 * value that exists at two depths. So the collapse happens here, in the tree, and it comes out as data — the
 * render decides nothing, it only follows what this file says.
 *
 *   \`flatten: "cat"\`    the section declares one category, so the section **is** that category: its families
 *                       hang directly off the section (Blocks and pages, Motion and effects).
 *   \`flatten: "family"\` …and that category holds a single family whose key is the section's own name
 *                       (Docs → "docs"), so the family's subs are the section's children instead.
 *
 * The collapse is expressed **beside** \`cats\`, never instead of it: \`cats\`/\`families\`/\`subs\` stay complete, so
 * \`resolve()\` in \`site/Gallery.tsx\` keeps resolving the published spelling.
 *
 *   CANONICAL, what the rail emits today:  \`#/g?sec=Docs\`
 *   still accepted (old links, and the grid's own chips):  \`#/g?sec=Docs&cat=Docs and guides&fam=docs\`
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
  return !needle || \`\${i.name} \${i.slug} \${i.source} \${i.kind} \${i.category ?? ""}\`.toLowerCase().includes(needle);
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
`;export{e as default};