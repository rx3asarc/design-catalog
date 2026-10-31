import { Button } from "@/registry/new-york-v4/ui/button";
import { Table } from "@/registry/new-york-v4/ui/table";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { asWords, label, useDetail, type Item } from "./lib";
import { DetailWait } from "./DetailWait";
import { behaviourOf, measuredOn, pickLine, NOT_MEASURED, type Measured } from "./behaviour";
import { columnsOf, earnsTable, fieldColsOf, measuredColsOf, measuredMembers, sortedBy, type Col } from "./columns";
import { itemsLabel, variantsOf, type TypeEntry } from "./taxonomy";
import { sectionGalleryHref, typeHref, typesIn } from "./typeIndex";
import { DemoFrame } from "./demo";
import { hasDemo, Pool, scrollerOf, useSiteTheme } from "./Tile";
import { FontSpecimens, hasPalette, ThemeSwatches } from "./specimens";

/**
 * `#/t/<section-slug>/<type-slug>` — ONE COLLECTION PER TYPE, drawn from the taxonomy.
 *
 * Round 9 rewrote what this page leads with, and both changes are the review's own sentences:
 *
 *   * **"The tables are nearly empty. Button's has 1 row and 20 items under 'Also in this set'; 66 of 67 tables
 *     hold a single row. Until more items are measured, lead with the visual grid and drop the table."**
 *     → A type prints a table only when at least two of its members answered its own measured columns
 *     (`columns.ts`: `TABLE_FLOOR`); everywhere else the page leads with the **grid**, and the table code is
 *     kept exactly for the types that earn it (today one: Sidebar, 4 measured of 7).
 *
 *   * **"Thumbnails under 'Also in this set' stay grey 'DEMO' boxes."** They did, and the cause was a bug, not a
 *     design: the lazy pool was only ever *told* about the windows inside the table (`tableHost`), so every
 *     window in the list below it stayed parked forever and printed the word "demo" in a grey box. The observer
 *     now sweeps every window on the page, and a parked window names the item it will become.
 *
 * WHAT MEMBERSHIP IS: nothing in this file. `entry.members` is the taxonomy's own list — the list
 * `qa/taxonomy_check.mjs` gates and the rail prints — and `entry.variants` are the demos the taxonomy folds into
 * their parent (`sidebar-01` … `sidebar-16`). A variant is never a row and never a card of its own; it is a
 * choice inside its parent's thumbnail, and its count is printed in the page's own facts line, in every rail row
 * and on every browse card (`taxonomy.ts`: `itemsLabel`).
 *
 * WHAT EACH TYPE PRINTS: its own columns. `taxonomy.json` declares them per type and `site/columns.ts` turns a
 * key into a cell — which is why Button prints "14 demos · sizes · loading state · icons" and Calendar prints
 * "11 demos · 1 file", and neither is ever asked whether it collapses.
 *
 * What is deliberately absent: no verdict, no rank, no score, no "best". Sorting is the reader's, by any column,
 * in either direction — an order of merit is still forbidden, and the manifest publishes nothing to rank by.
 * The "pick this if…" line is printed only where the page prints measured facts, because a sentence built out of
 * behaviour is meaningless on a page with no behaviour columns.
 */

/* ── names, as words ────────────────────────────────────────────────────────────────────────────────────── */

/** The data's own label (`displayName ?? name`), read as words — `asWords` is in `site/lib.ts`, shared with the
 *  concept page, so one review complaint about names has one reading behind it. */
const rowLabel = (i: Item) => asWords(label(i));

const nameOrder = (a: Item, b: Item) => rowLabel(a).localeCompare(rowLabel(b)) || a.id.localeCompare(b.id);

/* ── sorting ────────────────────────────────────────────────────────────────────────────────────────────── */

type Sort = { key: string; dir: "asc" | "desc" };
const FIRST: Sort = { key: "item", dir: "asc" };

/* ── the thumbnail ──────────────────────────────────────────────────────────────────────────────────────── */

/** The window a thumbnail is seen through, in CSS px: a table row, a grid card, a reference-only entry. */
const DEMO_H = 170;
const CARD_H = 150;

/*
 * The tile's own scaling rule, repeated here because a thumbnail is a tile in a cell:
 * `site/Tile.tsx` gives a demo a **logical** width — `REF_WIDTH` until the child reports its own — and scales the
 * paint down to whatever column it has. Without it a 290 px cell lays the demo out at 290 px, which is a sidebar
 * squeezed into a phone and 736 px tall in a 170 px window; with it the demo lays out at 768 px and the window
 * shows the top of the real thing. Same numbers, same clamp, same oscillation guard.
 */
const REF_WIDTH = 768;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 1.6;

/**
 * One thumbnail.
 *
 * The frame is `inert` and pointer-transparent, exactly like a gallery tile: the item page is where a demo is
 * interactive, and a card that trapped a phone's scroll inside a calendar would be a worse card. What it is for
 * is seeing the thing while reading its facts.
 *
 * The mount is lazy and capped by the pool it is handed (`Pool(2)` in `TypeBody`): a window exists while it is
 * near the viewport and its frame is detached when it is not — measured, not hoped: `data-demo-mode` says which.
 *
 * The picker above it is the taxonomy's half of the brief: `sidebar-01` … `sidebar-16` are `variants` of
 * `shadcn/sidebar`, so they are demos in its thumbnail and never cards of their own. A one-line description goes
 * with the chosen demo, because sixteen demos that differ only by a number is the complaint this answers.
 *
 * In the table each row gets the picker (`pick`), because a table row is where a reader compares demos. A card in
 * the grid does not: a page of thirty cards each carrying a 44 px select above its picture is a page of selects,
 * and the card already says how many variants it holds (`· 3 variants`) with the demos one click away on the item
 * page. Same data, different amount of chrome — which is the whole of what a table and a grid are for.
 */
function RowDemo({
  item, pool, theme, h = DEMO_H, pick = false,
}: { item: Item; pool: Pool; theme: "light" | "dark"; h?: number; pick?: boolean }) {
  // the item itself first (its own first demo), then the variant demos the taxonomy folds into it
  const options = useMemo(() => [item, ...variantsOf(item).filter(hasDemo)], [item]);
  const [at, setAt] = useState(0);
  const chosen = options[Math.min(at, options.length - 1)] ?? item;

  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [natural, setNatural] = useState(0);
  const corrections = useRef(0);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    pool.register({ key: item.id, el, setLive });
    // a window that is already on screen must not wait for a scroll event that will never come
    const box = el.getBoundingClientRect();
    if (box.bottom > -300 && box.top < innerHeight + 300) pool.want(item.id);
    return () => pool.unregister(item.id);
  }, [pool, item.id]);

  // a detached frame forgets that it had painted: the next mount is a blank box for a moment again
  useEffect(() => { if (!live) setReady(false); }, [live]);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * The child reports the width its own content needs. Re-zoom stops after four corrections or when the report
   * stops moving by more than 8% — a demo that re-flows at a different frame width must not be able to oscillate
   * the scale frame after frame (the tile's rule, verbatim).
   */
  const onSize = useCallback((m: { height: number; width: number }) => {
    setReady(true);
    const w = m.width;
    if (!w || w < 32 || corrections.current >= 4) return;
    setNatural((prev) => {
      if (prev && Math.abs(w - prev) <= Math.max(24, prev * 0.08)) return prev;
      corrections.current += 1;
      return w;
    });
  }, []);

  const want = width || 0;
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, want > 0 ? want / (natural || REF_WIDTH) : ZOOM_MIN + 0.15));
  const stretch = zoom > 0 ? Math.ceil(h / zoom) : 0;

  return (
    <div className="type-demo-cell">
      {pick && options.length > 1 && (
        <select
          className="type-demo-pick"
          value={at}
          onChange={(e) => setAt(Number(e.target.value))}
          aria-label={`Demo to show for ${rowLabel(item)}: ${options.length} in this item`}
        >
          {options.map((o, i) => (
            <option key={o.id} value={i}>{rowLabel(o)}</option>
          ))}
        </select>
      )}
      <div
        ref={host}
        className="type-demo-window"
        style={{ height: h }}
        data-row-demo={item.id}
        data-demo-mode={live ? "live" : "parked"}
      >
        {live ? (
          <div
            inert
            aria-hidden="true"
            style={{ opacity: ready ? 1 : 0, transition: "opacity 140ms linear" }}
          >
            <DemoFrame
              id={chosen.id}
              index={0}
              zoom={zoom}
              floor={Math.ceil(h / zoom) + 8}
              stretch={stretch || undefined}
              addr={{ theme }}
              onSize={onSize}
            />
          </div>
        ) : (
          /* A parked window is not a grey box with the word "demo" in it: it names the item the frame will become,
             in the exact box the frame will occupy, so a grid can be read before a single demo has mounted. */
          <span className="type-demo-parked" title="the demo mounts as this comes into view">
            <span className="type-demo-kicker">demo</span>
            <span className="type-demo-name">{rowLabel(item)}</span>
          </span>
        )}
      </div>
      {at > 0 && chosen.one_line ? <span className="type-demo-line">{chosen.one_line}</span> : null}
    </div>
  );
}

/* ── one card of the grid ──────────────────────────────────────────────────────────────────────────────── */

/**
 * A member as a card: its thumbnail, its name, the data's own one-line description, and **the facts this type
 * prints** — not every fact the catalogue holds.
 *
 * A fact the member cannot answer is not printed on the card at all (there is no "not measured" pill on a card:
 * a card is a poster, not a table cell). That is the same rule as the table's dropped columns, one size down.
 */
function MemberCard({ item, cols, pool, theme }: { item: Item; cols: Col[]; pool: Pool; theme: "light" | "dark" }) {
  const facts = cols.map((c) => ({ col: c, text: c.text(item), why: c.exact(item) }))
    .filter((f) => f.text !== NOT_MEASURED)
    .slice(0, 3);
  const variants = variantsOf(item).length;
  return (
    <li className="member-card" data-member-card={item.id}>
      {hasDemo(item)
        ? <RowDemo item={item} pool={pool} theme={theme} h={CARD_H} />
        : (
          <div className="type-demo-window type-demo-none" data-no-demo={item.id} style={{ height: CARD_H }}>
            <span className="type-demo-parked">
              <span className="type-demo-kicker">no demo</span>
              <span className="type-demo-name">{rowLabel(item)}</span>
            </span>
          </div>
        )}
      <div className="member-body">
        <a className="member-link" href={`#/i/${item.id}`}>{rowLabel(item)}</a>
        <span className="member-meta">
          {item.source} · {item.licence}
          {variants ? ` · ${variants} ${variants === 1 ? "variant" : "variants"}` : ""}
        </span>
        {item.one_line ? <span className="member-line">{item.one_line}</span> : null}
        {facts.length ? (
          <span className="member-facts">
            {facts.map((f) => (
              <span className="member-fact" key={f.col.key} data-card-fact={f.col.key} title={f.why}>
                <span className="member-fact-k">{f.col.head}</span>
                {f.text}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/* ── the page ───────────────────────────────────────────────────────────────────────────────────────────── */

export function TypePage({ entry }: { entry: TypeEntry }) {
  /*
   * The behaviour record is per-item detail and arrives with the detail payload (`site/lib.ts`), so this page
   * cannot judge "is this member measured" before it is here — and it must not draw a table from rows whose
   * records are simply late. The gate is a component boundary because the hooks below run in the same order on
   * every render.
   */
  const { ready, failed } = useDetail();
  if (!ready) return <DetailWait what="collection" failed={failed} />;
  return <TypeBody entry={entry} />;
}

function TypeBody({ entry }: { entry: TypeEntry }) {
  const theme = useSiteTheme();
  const pool = useMemo(() => new Pool(2), []);
  const gridHost = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<Sort>(FIRST);

  const members = entry.members;
  /*
   * The columns are the TYPE's, not the sidebar's: declared per type in `taxonomy.json`, resolved through
   * `site/columns.ts`, with every column none of this type's members can answer already dropped.
   */
  const cols = useMemo(() => columnsOf(entry), [entry]);
  const measuredCols = useMemo(() => measuredColsOf(cols), [cols]);
  const cardCols = useMemo(() => fieldColsOf(cols), [cols]);
  const measured = useMemo(() => measuredMembers(entry, cols), [entry, cols]);
  const table = measuredCols.length > 0 && earnsTable(entry, cols);
  const variants = useMemo(() => members.reduce((n, m) => n + variantsOf(m).length, 0), [members]);
  const sources = useMemo(() => [...new Set(members.map((m) => m.source))], [members]);

  const rows = useMemo(() => (table ? sortedBy(measured, sort.key, sort.dir, nameOrder) : []), [table, measured, sort]);
  const rowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  /* what the grid holds: every member when there is no table, and the ones the table did not take when there is */
  const grid = useMemo(() => members.filter((m) => !rowIds.has(m.id)).sort(nameOrder), [members, rowIds]);

  // one probe run, one date, printed once — in the header, never in a card
  const latest = useMemo(() => {
    const runs = measured.map((m) => behaviourOf(m)).filter((b): b is Measured => !!b);
    return runs.sort((a, b) => String(a.at).localeCompare(String(b.at))).pop() ?? null;
  }, [measured]);
  const day = measuredOn(latest);
  const probe = useMemo(() => measured.map((m) => behaviourOf(m)?.probe).find(Boolean) ?? null, [measured]);

  /*
   * ONE observer over every window on the page — the table's and the grid's alike. It used to be scoped to the
   * table wrapper, which is why the thumbnails under "Also in this set" never mounted and stayed grey boxes.
   * In at 300 px, out at 600, and the pool still caps the live frames at two.
   */
  useEffect(() => {
    const host = gridHost.current;
    if (!host) return;
    const nodes = [...host.querySelectorAll<HTMLElement>("[data-row-demo]")];
    if (!nodes.length) return;
    const root = scrollerOf(nodes[0]);
    const enter = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) pool.want((e.target as HTMLElement).dataset.rowDemo!);
    }, { root, rootMargin: "300px 0px" });
    const exit = new IntersectionObserver((es) => {
      for (const e of es) if (!e.isIntersecting) pool.release((e.target as HTMLElement).dataset.rowDemo!);
    }, { root, rootMargin: "600px 0px" });
    nodes.forEach((n) => { enter.observe(n); exit.observe(n); });
    return () => { enter.disconnect(); exit.disconnect(); };
  }, [pool, rows, grid]);

  const siblings = useMemo(() => typesIn(entry.section).filter((t) => t.key !== entry.key), [entry]);
  /*
   * THE TWO FOUNDATIONS ROW KINDS (see `site/specimens.tsx`).
   *
   * `Foundations/Fonts` is 26 members and not one of them has a demo — its rows are type specimens. `Themes` is
   * seven members, five of which are theme *files* with a palette; the other two (`beui/theme-toggle`,
   * `rareui/theme-selector`) are components that switch a theme, and one of them has a live demo, so they stay in
   * the ordinary grid. The taxonomy is unchanged either way: the type is the collection, and this is only the
   * shape of its rows.
   */
  const foundation = entry.section === "Foundations" ? entry.type : null;
  const palette = useMemo(() => [...grid].filter(hasPalette).sort(nameOrder), [grid]);
  const cards = useMemo(() => grid.filter((m) => !hasPalette(m)), [grid]);
  const subject = `the ${entry.type.toLowerCase()}`;
  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="page-in type-page" style={{ maxWidth: 1560, margin: "0 auto" }} ref={gridHost}>
      <div className="crumb">
        <a href={sectionGalleryHref(entry.section)}>{entry.section}</a>
      </div>
      <h2 className="title" data-type-title={entry.key}>{entry.type}</h2>

      {/* The page's one statement of the set, and the one place the probe run is dated. The count admits the
          variants the taxonomy folds into these members — they are catalogue content, not a rounding error. */}
      <p
        className="type-facts"
        data-type-facts=""
        data-type-section={entry.section}
        data-type-members={members.length}
        data-type-variants={variants}
        data-type-measured={measured.length}
        data-type-shown={rows.length}
        data-type-has-table={table ? "yes" : "no"}
        data-type-sort={`${sort.key}:${sort.dir}`}
        data-type-columns={cols.map((c) => c.key).join(",")}
        data-type-measured-columns={measuredCols.map((c) => c.key).join(",")}
      >
        {itemsLabel(members.length, variants)} ·{" "}
        {sources.length} {sources.length === 1 ? "library" : "libraries"}
        {table ? <>{` · ${measured.length} measured`}{day ? <> on {day}</> : null}</> : null}
        {probe ? <span className="type-probe"> {probe}</span> : null}
      </p>

      {table ? (
        <div className="type-table-wrap">
          <Table className="type-table" data-type-table={entry.key}>
            <thead>
              <tr>
                <th scope="col" aria-sort={sort.key === "item" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <Button variant="ghost" className="type-sort" onClick={() => toggle("item")}>
                    item{sort.key === "item" ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
                  </Button>
                </th>
                <th scope="col" className="type-th-demo">demo</th>
                {measuredCols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="type-th-fact"
                    data-col={c.key}
                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <Button variant="ghost" className="type-sort" onClick={() => toggle(c.key)}>
                      {c.head}{sort.key === c.key ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const pickText = pickLine(item, rows, subject, { date: false });
                return (
                  <tr key={item.id} data-type-row={item.id}>
                    <th scope="row" className="type-row-name">
                      <a href={`#/i/${item.id}`}>{rowLabel(item)}</a>
                      <span className="type-row-meta">{item.source} · {item.licence}</span>
                      {item.one_line ? <span className="type-row-line">{item.one_line}</span> : null}
                      {/* derived from this member's own measured facts, in one template for every member; the
                          date is the header's, so it is not repeated seven times down the page */}
                      {pickText ? <span className="type-row-pick" data-type-pick={item.id}>{pickText}</span> : null}
                    </th>
                    <td className="type-demo-cell-td">
                      {hasDemo(item)
                        ? <RowDemo item={item} pool={pool} theme={theme} pick />
                        : <span className="type-no-demo">no demo captured</span>}
                    </td>
                    {measuredCols.map((c) => {
                      const text = c.text(item);
                      const unknown = text === NOT_MEASURED;
                      return (
                        <td
                          key={c.key}
                          className="type-fact"
                          data-col={c.key}
                          data-col-measured={!unknown}
                          data-head={c.head}
                          title={c.exact(item)}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : null}

      {/* THE SURFACE: a real thumbnail per member, on the surface-300 canvas, with a border. A page with a table
          keeps this for the members the table did not take; a page without one leads with it. */}
      {foundation === "Fonts" ? (
        <>
          <div className="section-h" style={{ margin: "18px 0 6px" }}>In this set</div>
          <FontSpecimens items={[...members].sort(nameOrder)} />
        </>
      ) : cards.length || palette.length ? (
        <>
          <div className="section-h" style={{ margin: "18px 0 6px" }}>
            {table ? "Also in this set" : "In this set"}
          </div>
          {palette.length ? <ThemeSwatches items={palette} /> : null}
          {cards.length ? (
            <ul className="type-grid" data-type-grid={entry.key}>
              {cards.map((item) => (
                <MemberCard key={item.id} item={item} cols={cardCols} pool={pool} theme={theme} />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {siblings.length ? (
        <nav className="type-strip" aria-label={`Other ${entry.section} types`} data-type-strip={entry.section}>
          <span className="type-strip-label">Other {entry.section} types</span>
          {siblings.map((t) => (
            <a key={t.key} href={typeHref(t)}>
              {t.type}
              <span>{itemsLabel(t.members.length, t.members.reduce((n, m) => n + variantsOf(m).length, 0))}</span>
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
