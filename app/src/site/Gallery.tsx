import { useMemo } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { items, type Item } from "./lib";
import { buildTree, gridHref, needleHit, type GalleryQuery, type TreeSection } from "./route";
import { Grid, hasDemo, useColumnWidth, useNarrow, useSiteTheme } from "./Tile";

/**
 * The gallery: every item the filter names, as a card, with a live demo in the ones that have one.
 *
 * What is left here is the filter and the header — the tile, the mount pool and the grid moved to `./Tile`
 * unchanged, so the front page can put the same tile on its first screen instead of a second copy of it.
 * `resolve()` still resolves filters through the rail's own tree, and the header still states how many of the
 * filter's rows are shown and how many are reference-only.
 */

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
 * grid of 12 because both numbers come from `buildTree`. A value that resolves to nothing is reported in
 * `unknown` rather than ignored — the whole point of §3.1 is that a filter which matches nothing says so.
 */
export function resolve(query: GalleryQuery): Resolved {
  const unknown: string[] = [];
  const levels: string[] = [];
  const tree: TreeSection[] = buildTree(query.q ?? "", query.src ?? "");
  if (query.src && !SOURCES.has(query.src)) unknown.push(`source “${query.src}”`);

  let sections = tree;
  if (query.sec) {
    const hit = tree.filter((s) => s.label === query.sec);
    if (!hit.length) unknown.push(`section “${query.sec}”`);
    sections = hit;
    levels.push(query.sec);
  }
  let cats = sections.flatMap((s) => s.cats);
  if (query.cat) {
    const hit = cats.filter((c) => c.key === query.cat);
    if (!hit.length) unknown.push(`category “${query.cat}”`);
    cats = hit;
    levels.push(query.cat);
  }
  let fams = cats.flatMap((c) => c.families);
  if (query.fam) {
    const hit = fams.filter((f) => f.key === query.fam);
    if (!hit.length) unknown.push(`family “${query.fam}”`);
    fams = hit;
    levels.push(query.fam);
  }
  let rows: Item[];
  if (query.sub) {
    const hit = fams.flatMap((f) => f.subs).filter((s) => s.key === query.sub);
    if (!hit.length) unknown.push(`sub-family “${query.sub}”`);
    rows = hit.flatMap((s) => s.rows);
    levels.push(query.sub);
  } else if (query.fam) rows = fams.flatMap((f) => f.rows);
  else if (query.cat || query.sec) rows = cats.flatMap((c) => c.rows);
  // no rail level: the whole catalogue, through the rail's own text predicate, so `q=` cannot mean two things
  else rows = items.filter((i) => (!query.src || i.source === query.src) && needleHit(i, query.q));

  if (query.kind) {
    if (!KINDS.has(query.kind)) unknown.push(`kind “${query.kind}”`);
    else rows = rows.filter((i) => i.kind === query.kind);
    levels.push(query.kind);
  }
  if (query.q) levels.push(`“${query.q}”`);

  const uniq = [...new Map(rows.map((i) => [i.id, i])).values()];
  const demo = uniq.filter(hasDemo);
  const refOnly = uniq.filter((i) => !hasDemo(i));
  return { rows: uniq, shown: query.ref ? [...demo, ...refOnly] : demo, demo, refOnly, unknown, levels };
}


/* ── the surface ───────────────────────────────────────────────────────────────────────────────────────── */

/**
 * `#/g[?filter]`: what is here, how much of it is hidden, and the grid itself.
 *
 * The header is the whole contract of §3.3 — how many are shown, how many are reference-only and hidden, one
 * honest toggle that is also in the URL. A filter value that matches nothing is named, because a gallery that
 * silently renders the catalogue for a typo is the defect this route replaces.
 */
/**
 * The concept sets worth a door of their own: four or more members, so the comparison is a comparison and not a pair.
 * Computed from the manifest's per-item `concepts` — the same field `#/c/<key>` reads, so a link here cannot point
 * at a set the page does not know.
 */
const COMPARABLE = (() => {
  const n = new Map<string, number>();
  for (const i of items) for (const k of (i as Item & { concepts?: string[] }).concepts ?? []) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n.entries()].filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, n: count }));
})();

export function Gallery({ query }: { query: GalleryQuery }) {
  const narrow = useNarrow();
  const bodyH = narrow ? 180 : 210;
  const resolved = useMemo(() => resolve(query), [query]);
  const { colW, host } = useColumnWidth(narrow, resolved.shown.length);
  // a subscription, so a theme change reaches the frames that are already mounted below (§ the hook's comment)
  const theme = useSiteTheme();
  const sig = JSON.stringify([query, resolved.shown.length]);

  const title = resolved.levels.length
    ? resolved.levels.join(" · ")
    : query.q ? `“${query.q}”` : "Everything";
  // the first number is the filter's total — the same count the rail row showed — then what of it is on screen
  const counted = `${resolved.rows.length} items · ${resolved.shown.length} shown · ${resolved.refOnly.length} reference-only ${query.ref ? "included" : "hidden"}`;
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
      {/*
       * Comparisons were reachable only from an item page, which a tester reported as "no one can find it".
       * These are the sets big enough to be worth comparing (four or more members), named by the concept's own
       * key — the same key the store uses, so `#/c/sidebar` here and `compare sidebar` on the CLI are one set.
       */}
      {COMPARABLE.length > 0 && (
        <p data-compare-links="" style={{ fontSize: 13, margin: "0 0 10px", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
          <span style={{ color: "var(--ink-muted)" }}>Compare side by side:</span>
          {COMPARABLE.map((c) => (
            <a key={c.key} href={`#/c/${c.key}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44, paddingInline: 6 }}>
              {c.key} <span style={{ color: "var(--ink-muted)", marginLeft: 4 }}>{c.n}</span>
            </a>
          ))}
        </p>
      )}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "0 0 16px",
        paddingBottom: 12, borderBottom: "1px solid var(--border)",
      }}>
        <span
          data-gallery-counts=""
          data-gallery-shown={resolved.shown.length}
          data-gallery-hidden={query.ref ? 0 : resolved.refOnly.length}
          data-gallery-total={resolved.rows.length}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em", color: "var(--ink-muted)" }}
        >{counted}</span>
        <span style={{ flex: 1 }} />
        <Button
          data-catalog-item="shadcn/button"
          variant={query.ref ? "default" : "outline"}
          className="h-11 px-3 text-xs md:h-8"
          aria-pressed={!!query.ref}
          onClick={() => { location.hash = gridHref({ ...query, ref: !query.ref }); }}
        >
          {query.ref ? "Hide reference-only" : `Show reference-only (${resolved.refOnly.length})`}
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
