import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { asWords, label, useDetail, type Item } from "./lib";
import { DetailWait } from "./DetailWait";
import { BEHAVIOUR_COLS, behaviourOf, hasFacts, measuredOn, NOT_MEASURED, pickLine, type Measured } from "./behaviour";
import { variantsOf, type TypeEntry } from "./taxonomy";
import { sectionGalleryHref, typeHref, typesIn } from "./typeIndex";
import { DemoFrame } from "./demo";
import { hasDemo, Pool, scrollerOf, useSiteTheme } from "./Tile";

/**
 * `#/t/<section-slug>/<type-slug>` — ONE COLLECTION PER TYPE, drawn from the taxonomy.
 *
 * The round-7 review of the collections was blunt, and every rule below is one of its five sentences turned into
 * code:
 *
 *   * **"one collection per level-2 type, using the same membership as the sidebar."** Membership *is*
 *     `entry.members` — the taxonomy's own list, the list `qa/taxonomy_check.mjs` gates and the rail prints. A
 *     variant (`entry.variants`, e.g. `sidebar-01` … `sidebar-16`) is never a row of its own: it is a demo on its
 *     parent's row, chosen in that row's own picker. There is no membership rule in this file. It only renders
 *     what the taxonomy already says.
 *
 *   * **"a sortable table, with unmeasured items moved into a short 'Also in this set' list below it."** A row is
 *     a member somebody measured. A member nobody measured is not a row of six "not measured" cells — it goes
 *     into the list below, with its one-line description and a link. When no member of a type was measured, there
 *     is no table and the page does not explain why (`behaviour.ts`: `null` is never `false`, and an absent thing
 *     says nothing).
 *
 *   * **"a live demo next to each row."** The row's demo runs in the row, in this site's own frame protocol
 *     (`site/demo.tsx`'s `DemoFrame`), mounted lazily by the gallery's own `Pool`: never more than two frames at
 *     once, mounted within 300 px of the viewport, detached beyond 600. At 1440 the demo is the column beside the
 *     name; below 860 px the row stacks and it lands under the name, which is what the brief asks for.
 *
 *   * **"the measurement date shown once, in the header."** One probe run, one date, once per page. The "pick this
 *     if…" line is still `behaviour.ts`'s, still derived from that member's own measured facts, and it is called
 *     with `{ date: false }` so seven rows do not say "28 October 2026" seven times.
 *
 *   * **"the 'compare side by side' strip is per section."** The strip at the foot of the page lists the other
 *     types in **this** section and nothing else: a Components page may offer the other Components types, and no
 *     page ever offers a checkbox on a navigation page.
 *
 * What is deliberately absent: no verdict, no rank, no score, no "best". Sorting is the reader's, by any column,
 * in either direction — an order of merit is still forbidden, and the manifest publishes nothing to rank by.
 */

/* ── names, as words ────────────────────────────────────────────────────────────────────────────────────── */

/** The data's own label (`displayName ?? name`), read as words — `asWords` is in `site/lib.ts`, shared with the
 *  concept page, so one review complaint about names has one reading behind it. */
const rowLabel = (i: Item) => asWords(label(i));

const nameOrder = (a: Item, b: Item) => rowLabel(a).localeCompare(rowLabel(b)) || a.id.localeCompare(b.id);

/* ── sorting ────────────────────────────────────────────────────────────────────────────────────────────── */

type Sort = { key: string; dir: "asc" | "desc" };
const FIRST: Sort = { key: "item", dir: "asc" };

/**
 * The value a behaviour column sorts by, or `null` when this member has no answer for it.
 *
 * The text a cell prints is not the order a reader wants: "to icons", "off-canvas", "narrower" and "no" are not
 * alphabetical facts. Each column gets the order its own answers imply — narrower before off-canvas before icon
 * rail, one level before two before three, a component before a page — and every word still comes from
 * `behaviourOf`, so the order is a reading of the measurement, not a second one.
 */
const RANK: Record<string, (b: Measured | null) => number | null> = {
  collapses: (b) => (typeof b?.collapses !== "boolean" ? null
    : !b.collapses ? 0 : b.collapseKind === "narrower" ? 1 : b.collapseKind === "off canvas" ? 2 : 3),
  nests: (b) => (typeof b?.nests !== "boolean" ? null : !b.nests ? 0 : b.nestDepth ?? 2),
  sheet: (b) => (typeof b?.sheet !== "boolean" ? null : b.sheet ? 1 : 0),
  keyboard: (b) => (typeof b?.keyboard !== "boolean" ? null : b.keyboard ? 1 : 0),
  shape: (b) => (typeof b?.shape !== "boolean" ? null : b.shape ? 1 : 0),
  animates: (b) => (typeof b?.animates !== "boolean" ? null : b.animates ? 1 : 0),
};

/**
 * The rows, in the order the reader asked for.
 *
 * Two facts about this order are worth stating because they are the ones a sort can lie about:
 *
 *  1. **"not measured" is last in both directions.** It is not smaller than `false` and it is not larger than
 *     `true`; a direction cannot turn an absent measurement into an extreme, so the null branch is applied before
 *     the direction is.
 *  2. **the order is stable.** Ties fall back to the name and then to the id, so two sorts that agree on every
 *     answered fact still produce the same list twice — on the first render and after any re-render.
 */
function sorted(rows: Item[], sort: Sort): Item[] {
  const rank = RANK[sort.key];
  if (!rank) return [...rows].sort(nameOrder);
  return [...rows].sort((a, b) => {
    const av = rank(behaviourOf(a));
    const bv = rank(behaviourOf(b));
    if (av === null || bv === null) return av === bv ? nameOrder(a, b) : av === null ? 1 : -1;
    return av === bv ? nameOrder(a, b) : sort.dir === "asc" ? av - bv : bv - av;
  });
}

/* ── the row's live demo ────────────────────────────────────────────────────────────────────────────────── */

/** The window a row's demo is seen through, in CSS px. */
const DEMO_H = 170;
/** the same window at list size, for a member that has no measured row to sit in */
const LIST_H = 104;

/*
 * The tile's own scaling rule, repeated here because a row's demo is a tile in a table cell:
 * `site/Tile.tsx` gives a demo a **logical** width — `REF_WIDTH` until the child reports its own — and scales the
 * paint down to whatever column it has. Without it a 290 px cell lays the demo out at 290 px, which is a sidebar
 * squeezed into a phone and 736 px tall in a 170 px window; with it the demo lays out at 768 px and the window
 * shows the top of the real thing. Same numbers, same clamp, same oscillation guard.
 */
const REF_WIDTH = 768;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.6;

/**
 * One row's demo.
 *
 * The frame is `inert` and pointer-transparent, exactly like a gallery tile: the item page is where a demo is
 * interactive, and a table row that trapped a phone's scroll inside a sidebar would be a worse table. What it is
 * for is seeing the thing while reading its columns.
 *
 * The mount is lazy and capped by the pool it is handed (`Pool(2)` in `TypeBody`): a row's frame exists while the
 * row is near the viewport and is detached when it is not — measured, not hoped: `data-demo-mode` says which.
 *
 * The picker above it is the taxonomy's half of the brief: `sidebar-01` … `sidebar-16` are `variants` of
 * `shadcn/sidebar`, so they are demos on its row and never rows of their own. A one-line description goes with
 * the chosen demo, because sixteen demos that differ only by a number is the complaint this answers.
 */
function RowDemo({
  item, pool, theme, h = DEMO_H,
}: { item: Item; pool: Pool; theme: "light" | "dark"; h?: number }) {
  // the item itself first (its own first demo), then the variant demos the taxonomy folds into it
  const options = useMemo(() => [item, ...variantsOf(item).filter(hasDemo)], [item]);
  const [pick, setPick] = useState(0);
  const chosen = options[Math.min(pick, options.length - 1)] ?? item;

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
    // a row that is already on screen must not wait for a scroll event that will never come
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
      {options.length > 1 && (
        <select
          className="type-demo-pick"
          value={pick}
          onChange={(e) => setPick(Number(e.target.value))}
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
          <span className="type-demo-parked" title="the demo mounts as this row comes into view">demo</span>
        )}
      </div>
      {pick > 0 && chosen.one_line ? <span className="type-demo-line">{chosen.one_line}</span> : null}
    </div>
  );
}

/* ── the page ───────────────────────────────────────────────────────────────────────────────────────────── */

export function TypePage({ entry }: { entry: TypeEntry }) {
  /*
   * The behaviour record is per-item detail and arrives with the detail payload (`site/lib.ts`), so this page
   * cannot draw a table before it is here — and it must not draw "not measured" for rows whose records are simply
   * late. The gate is a component boundary because the hooks below run in the same order on every render.
   */
  const { ready, failed } = useDetail();
  if (!ready) return <DetailWait what="collection" failed={failed} />;
  return <TypeBody entry={entry} />;
}

function TypeBody({ entry }: { entry: TypeEntry }) {
  const theme = useSiteTheme();
  const pool = useMemo(() => new Pool(2), []);
  const tableHost = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<Sort>(FIRST);

  const members = entry.members;
  /*
   * "Measured" is one fact and it is `behaviour.ts`'s: did the probe answer anything about this member? A record
   * that says "there is nothing to measure" is not a row (§ hasFacts). This is the number the review was reading
   * as "0 measured", and it is counted here from the columns the table prints.
   */
  const measured = useMemo(() => members.filter(hasFacts), [members]);
  const unmeasured = useMemo(() => members.filter((m) => !hasFacts(m)), [members]);
  const sources = useMemo(() => [...new Set(members.map((m) => m.source))], [members]);
  const variants = useMemo(() => members.reduce((n, m) => n + variantsOf(m).length, 0), [members]);

  /*
   * A column nobody in this set answered is not printed: six "not measured" cells per row is the shape of table
   * the review called "not measured in every column". A column somebody answered stays — even when every answered
   * row agrees — because sorting it is how a reader checks that for themselves.
   */
  const cols = useMemo(() => BEHAVIOUR_COLS.filter((c) => measured.some((m) => c.answered(m))), [measured]);
  const rows = useMemo(() => sorted(measured, sort), [measured, sort]);

  // one probe run, one date, printed once — in the header, never in a row
  const latest = useMemo(() => {
    const runs = measured.map((m) => behaviourOf(m)).filter((b): b is Measured => !!b);
    return runs.sort((a, b) => String(a.at).localeCompare(String(b.at))).pop() ?? null;
  }, [measured]);
  const day = measuredOn(latest);
  const probe = useMemo(() => measured.map((m) => behaviourOf(m)?.probe).find(Boolean) ?? null, [measured]);

  /* the same two observers the gallery uses, over this table's rows: in at 300 px, out at 600 */
  useEffect(() => {
    const host = tableHost.current;
    if (!host) return;
    const nodes = [...host.querySelectorAll<HTMLElement>("[data-row-demo]")];
    if (!nodes.length) return;
    const root = scrollerOf(nodes[0]);
    const want = (e: IntersectionObserverEntry) =>
      pool.want((e.target as HTMLElement).dataset.rowDemo!);
    const enter = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) want(e); },
      { root, rootMargin: "300px 0px" });
    const exit = new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting) pool.release((e.target as HTMLElement).dataset.rowDemo!); },
      { root, rootMargin: "600px 0px" });
    nodes.forEach((n) => { enter.observe(n); exit.observe(n); });
    return () => { enter.disconnect(); exit.disconnect(); };
  }, [pool, rows]);

  const siblings = useMemo(() => typesIn(entry.section).filter((t) => t.key !== entry.key), [entry]);
  const subject = `the ${entry.type.toLowerCase()}`;
  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="page-in type-page" style={{ maxWidth: 1560, margin: "0 auto" }}>
      <div className="crumb">
        <a href={sectionGalleryHref(entry.section)}>{entry.section}</a>
      </div>
      <h2 className="title" data-type-title={entry.key}>{entry.type}</h2>

      {/* The page's one statement of the set, and the one place the probe run is dated. */}
      <p
        className="type-facts"
        data-type-facts=""
        data-type-section={entry.section}
        data-type-members={members.length}
        data-type-measured={measured.length}
        data-type-unmeasured={unmeasured.length}
        data-type-variants={variants}
        data-type-shown={rows.length}
        data-type-sort={`${sort.key}:${sort.dir}`}
        data-type-columns={cols.map((c) => c.key).join(",")}
      >
        {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
        {sources.length} {sources.length === 1 ? "library" : "libraries"} ·{" "}
        {measured.length} measured
        {day ? <> on {day}</> : null}
        {probe ? <span className="type-probe"> {probe}</span> : null}
      </p>

        {rows.length ? (
        <div ref={tableHost} className="type-table-wrap">
          <table className="type-table" data-type-table={entry.key}>
            <thead>
              <tr>
                <th scope="col" aria-sort={sort.key === "item" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="type-sort" onClick={() => toggle("item")}>
                    item{sort.key === "item" ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
                  </button>
                </th>
                <th scope="col" className="type-th-demo">demo</th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="type-th-fact"
                    data-col={c.key}
                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" className="type-sort" onClick={() => toggle(c.key)}>
                      {c.head}{sort.key === c.key ? <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const pick = pickLine(item, rows, subject, { date: false });
                return (
                  <tr key={item.id} data-type-row={item.id}>
                    <th scope="row" className="type-row-name">
                      <a href={`#/i/${item.id}`}>{rowLabel(item)}</a>
                      <span className="type-row-meta">{item.source} · {item.licence}</span>
                      {item.one_line ? <span className="type-row-line">{item.one_line}</span> : null}
                      {/* derived from this member's own measured facts, in one template for every member; the
                          date is the header's, so it is not repeated seven times down the page */}
                      {pick ? <span className="type-row-pick" data-type-pick={item.id}>{pick}</span> : null}
                    </th>
                    <td className="type-demo-cell-td">
                      {hasDemo(item)
                        ? <RowDemo item={item} pool={pool} theme={theme} />
                        : <span className="type-no-demo">no demo in this build</span>}
                    </td>
                    {cols.map((c) => {
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
          </table>
        </div>
      ) : null}

      {unmeasured.length ? (
        <Fragment>
          <div className="section-h" style={{ margin: "18px 0 6px" }}>
            {rows.length ? "Also in this set" : "In this set"}
          </div>
          <ul className="also-list" data-type-also={entry.key}>
            {[...unmeasured].sort(nameOrder).map((item) => (
              <li key={item.id} data-also-row={item.id}>
                {/*
                  * The same demo as a table row's, at the size a list entry leaves for it. A member nobody measured
                  * is not a member with nothing to show: the columns are missing, the thing is not, and a page
                  * that turned 52 fonts into 52 lines of text would be a list of links, not a collection.
                  */}
                {hasDemo(item)
                  ? <RowDemo item={item} pool={pool} theme={theme} h={LIST_H} />
                  : <span className="also-no-demo">no demo</span>}
                <div className="also-text">
                  <a href={`#/i/${item.id}`}>{rowLabel(item)}</a>
                  <span className="also-meta">{item.source} · {item.licence}</span>
                  {item.one_line ? <span className="also-line">{item.one_line}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </Fragment>
      ) : null}

      {siblings.length ? (
        <nav className="type-strip" aria-label={`Other ${entry.section} types`} data-type-strip={entry.section}>
          <span className="type-strip-label">Other {entry.section} types</span>
          {siblings.map((t) => (
            <a key={t.key} href={typeHref(t)}>
              {t.type}
              <span>{t.members.length}</span>
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
