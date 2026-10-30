import { Fragment, useEffect, useMemo, useState } from "react";
import { conceptKeys, conceptMembers, items, label, useDetail, type Item } from "./lib";
import { DetailWait } from "./DetailWait";
import { Grid, useColumnWidth, useNarrow, useSiteTheme } from "./Tile";
import { BEHAVIOUR_COLS, behaviourOf, hasFacts, measuredOn, NOT_MEASURED, pickLine, separates, type FactCol } from "./behaviour";

/**
 * `#/c/<concept-key>` — the members of one concept, compared on what separates one from another.
 *
 * This page is the one thing a catalogue of four libraries can do that no source site can: each of those sites
 * shows only its own sidebars, so "six sidebars, four libraries, side by side" is not a view any of them has.
 * It is worth a page only if it actually compares, so the rules below are enforced in code, not promised:
 *
 *   * **the columns are behaviour.** A tester read the first version of this table and said the columns were
 *     licence, kind, files, KB, deps, parts, used-here and live demo, and that none of those helps anyone pick a
 *     sidebar: *"the page is an inventory with sorting removed."* That was right, and it was a data problem
 *     before it was a page problem — behaviour was not in the manifest. It is now: a build-time probe loads
 *     every demo in this site's own frame protocol and measures the six things that actually separate these
 *     components (see `site/behaviour.ts`). The inventory fields still exist; they live on the item page, where
 *     a person who wants a licence or a file count is asking about one item, not comparing four.
 *
 *   * **a column that every member answers identically is dropped**, and the bottom of the page names what was
 *     dropped and what it said. "Sorting removed" is exactly the failure this avoids, so the rule is applied to
 *     the *answered* rows: a column that 20 members answer "yes" and 5 cannot answer at all is a badge with a
 *     footnote, not a comparison, and is dropped like any other.
 *
 *   * **`null` is never `false`.** "Not measured" is a cell, not a dash: a dash reads as "no". Where a member
 *     has no demo there is nothing to measure, and the cell says so and says why (in its `title`).
 *
 *   * **no verdict, no ranking, no score.** Rows are filed by source then slug — a shelf order, not an order of
 *     merit. A "pick this if…" line is allowed and wanted, because it is derived from that member's own measured
 *     facts in one template (a fact about behaviour, not a judgement of quality); what is not allowed is a
 *     winner, a rank, or a score. The manifest holds 0 human picks and publishes 0 verdicts, so there is nothing
 *     here to order by merit even if this file wanted to. **Do not "restore" the older purism that refused to
 *     say anything about an individual item** — a measured fact about one member, derived and dated, is the
 *     thing that makes the page useful; an opinion about one member is the thing that is still forbidden.
 *
 *   * **a measurement is dated.** Behaviour changes when a demo changes, so the page says the day the probe ran
 *     instead of implying an eternal truth.
 */

/** The stack breakpoint: a table of these columns stops fitting well before the 640 a one-column grid uses. */
const STACK = "(max-width: 860px)";

function useStacked() {
  const [stacked, setStacked] = useState(() => typeof window !== "undefined" && matchMedia(STACK).matches);
  useEffect(() => {
    const m = matchMedia(STACK);
    const on = () => setStacked(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return stacked;
}

/**
 * How this set was chosen, said the way a visitor can check it.
 *
 * The store's `concept.rule` is the source of truth (`keyword: lower(slug) LIKE '%sidebar%' OR …` for the sets
 * this page ships), and the build does not publish it yet — `concept.rule` is not in the manifest. A hand-typed
 * copy of it would be a second copy of the store that silently drifts, so the page does the honest thing
 * instead: it *checks* the naming rule against the members it was handed. If every member's own name or slug
 * carries the concept key, the sentence is a fact this page can prove; if one does not, the page will not claim
 * a rule it cannot see, and says only what it knows (these are the members filed under this key). No internal
 * build note either way: a visitor is reading this, not a build log.
 */
const provenance = (key: string, rows: Item[]) => {
  const k = key.toLowerCase();
  const named = rows.filter((r) => r.slug.toLowerCase().includes(k) || (r.name ?? "").toLowerCase().includes(k));
  if (named.length === rows.length) return `the name is the rule, and every one of them carries “${key}” in its own name or slug`;
  if (named.length === 0) return `and none of their names contains “${key}”, so they are filed here by something other than a name`;
  return `and ${named.length} of them carry “${key}” in their name while ${rows.length - named.length} do not, so the name is not what makes this set`;
};

export function Compare({ conceptKey }: { conceptKey: string }) {
  /*
   * The behaviour columns are per-item detail (`site/lib.ts` fetches them once), so the comparison cannot draw
   * until they are here — and it must not draw "not measured" for a set whose records are simply late. The gate
   * is a component boundary because the hooks below have to run in the same order on every render.
   */
  const { ready, failed } = useDetail();
  if (!ready) return <DetailWait what="concept" failed={failed} />;
  return <CompareBody conceptKey={conceptKey} />;
}

function CompareBody({ conceptKey }: { conceptKey: string }) {
  const known = useMemo(() => conceptKeys.includes(conceptKey), [conceptKey]);
  // filed by source, then slug: the order a shelf is in, not an order of merit
  const members = useMemo(
    () => conceptMembers(conceptKey).sort((a, b) => a.source.localeCompare(b.source) || a.slug.localeCompare(b.slug)),
    [conceptKey],
  );
  /*
   * A row is a member somebody measured. A member with no behaviour record is not six cells reading "not
   * measured" — it is one line in the list under the table (`also`, below), with its one-line description and a
   * link. That is the same rule the type pages keep (`site/TypePage.tsx`), on the surface the review read first.
   */
  const rows = useMemo(() => members.filter(hasFacts), [members]);
  const also = useMemo(() => members.filter((m) => !hasFacts(m)), [members]);
  const stacked = useStacked();
  const sources = useMemo(() => [...new Set(members.map((r) => r.source))], [members]);
  // The tiles are the gallery's own — the same `Grid`, so the same pool, the same mount queue, the same
  // reference card for a member with no demo. A second copy of the tile here would be a second behaviour to
  // keep in step, and the brief's whole point is that a visitor sees one catalogue, not four renderings of it.
  const narrow = useNarrow();
  const bodyH = narrow ? 180 : 210;
  const { colW, host } = useColumnWidth(narrow, members.length);
  const theme = useSiteTheme();
  if (!known) {
    return (
      <div className="page-in">
        <div className="crumb">concept</div>
        <p role="status" style={{ fontSize: 15, margin: "0 0 12px" }}>
          Nothing here is called concept “{conceptKey}”. This catalogue has {items.length} items in {conceptKeys.length}{" "}
          concept sets. <a href="#/g">Show everything</a>
        </p>
      </div>
    );
  }

  if (!members.length) {
    // a key can exist with no members only if the data moves under us; the honest answer is not "everything"
    return (
      <div className="page-in">
        <div className="crumb">concept</div>
        <p role="status" style={{ fontSize: 15, margin: "0 0 12px" }}>
          The concept “{conceptKey}” is in this build, and no item carries it. That is an empty set, not a missing
          page. <a href="#/g">Show everything</a>
        </p>
      </div>
    );
  }

  // The comparison is the six behaviour facts and nothing else. `source` is identity, not a measurement: it is
  // printed beside every name (a row must be attributable to a library) but it is not a column, so it can never be
  // "dropped" for not separating anything — it is not trying to separate anything.
  const COLS: FactCol[] = BEHAVIOUR_COLS;
  const differing = COLS.filter((c) => separates(c, rows));
  const dropped = COLS.filter((c) => !differing.includes(c));

  // one date for the set: the records are written by one probe run, and the newest is the honest one to show
  const latest = rows
    .map((r) => behaviourOf(r))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .pop() ?? null;
  const lastRun = measuredOn(latest);
  const probeVersion = rows.map((r) => behaviourOf(r)?.probe).find(Boolean) ?? null;
  const measured = rows.length;
  /* The subject of a "pick this if…" line is this set's own word, not the sidebar's — this page serves 29 sets. */
  const subject = `a ${conceptKey.replace(/-/g, " ")}`;

  return (
    <div className="page-in" style={{ maxWidth: 1560, margin: "0 auto" }}>
      <div className="crumb">concept</div>
      <h2 className="title" data-compare-concept={conceptKey}>{conceptKey}</h2>
      <p className="lede" style={{ marginBottom: 12 }}>
        {members.length} members from {sources.length} {sources.length === 1 ? "library" : "libraries"}, compared on
        how they behave. Both numbers are the data's, not a count kept by hand.
      </p>

      <div style={{ margin: "0 0 16px", paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <span
          data-compare-counts=""
          data-compare-members={members.length}
          data-compare-sources={sources.length}
          data-compare-measured={measured}
          data-compare-dropped={dropped.map((c) => c.key).join(",")}
          data-compare-shown={differing.map((c) => c.key).join(",")}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em", color: "var(--ink-muted)" }}
        >
          {members.length} members · {sources.length} {sources.length === 1 ? "source" : "sources"} ·{" "}
          {measured} measured{lastRun ? ` on ${lastRun}` : ""}
          {probeVersion ? <span style={{ color: "var(--ink-subtle)" }}> {probeVersion}</span> : null}
        </span>
      </div>

      {/* One line about the set, in a visitor's terms: which items these are, and why. */}
      <p data-compare-method="" style={{ fontSize: 13.5, margin: "0 0 6px", color: "var(--ink-muted)" }}>
        These are the {members.length} items this catalogue files under “{conceptKey}” — {provenance(conceptKey, members)}.
      </p>
      {differing.length ? (
        <table
          data-compare-table=""
          style={{
            width: "100%", display: stacked ? "block" : "table",
            borderCollapse: "collapse", margin: "0 0 14px", tableLayout: "auto",
          }}
        >
          <thead style={{ display: stacked ? "none" : "table-header-group" }}>
            <tr>
              <th scope="col" style={HEAD}>item</th>
              {differing.map((c) => (
                <th key={c.key} scope="col" style={{ ...HEAD, textAlign: "right" }}>{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ display: stacked ? "block" : "table-row-group" }}>
            {rows.map((item) => {
              const pick = pickLine(item, rows, subject, { date: false });
              // At 1440 the sentence gets its own full-width row under the member: in the name cell it cost ~5
              // wrapped lines per member (a measured 153 px row), and a comparison table that is mostly sentence
              // stops being scannable. On a 390 px frame it is the same two rows, styled as one card.
              const card = stacked
                ? { display: "block", border: "1px solid var(--border)", borderBottom: pick ? "0" : "1px solid var(--border)",
                    borderRadius: pick ? "10px 10px 0 0" : 10, padding: "10px 12px", margin: pick ? 0 : "0 0 10px" }
                : { borderTop: "1px solid var(--border)" };
              const pickRow = stacked
                ? { display: "block", border: "1px solid var(--border)", borderTop: 0, borderRadius: "0 0 10px 10px",
                    padding: "0 12px 10px", margin: "0 0 10px" }
                : { border: 0 };
              return (
                <Fragment key={item.id}>
                  <tr data-compare-row={item.id} style={card}>
                    <th scope="row" style={stacked ? { ...NAME, display: "block", padding: "0 0 6px" } : NAME}>
                      <span style={{ ...MONO_LABEL, display: "block", marginBottom: 1 }}>{item.source}</span>
                      <a href={`#/i/${item.id}`} style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
                        {label(item)}
                      </a>
                    </th>
                    {differing.map((c) => {
                      const text = c.text(item);
                      const unknown = text === NOT_MEASURED;
                      return (
                        <td
                          key={c.key}
                          data-col={c.key}
                          data-col-measured={!unknown}
                          style={stacked
                            ? { display: "flex", gap: 10, justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", border: 0 }
                            : { ...CELL }}
                        >
                          {stacked && <span style={{ ...MONO_LABEL }}>{c.head}</span>}
                          <span
                            title={c.exact(item)}
                            style={{
                              fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere",
                              // "not measured" must never look like an answer: muted and italic, and never a dash
                              color: unknown ? "var(--ink-muted)" : "var(--ink)",
                              fontStyle: unknown ? "italic" : "normal",
                            }}
                          >
                            {text}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {pick ? (
                    <tr data-compare-pick-row={item.id} style={pickRow}>
                      {/* Derived from this member's own facts, in one template for every member: a fact about
                          behaviour, not a verdict. Absent when the facts do not support a line. */}
                      <td
                        colSpan={differing.length + 1}
                        data-compare-pick={item.id}
                        style={{ padding: stacked ? 0 : "0 10px 10px 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-muted)" }}
                      >
                        {pick}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {/*
       * The members nobody measured are not rows. They are links, with the data's own one-line description, under
       * the table — the table stops being five rows of "not measured", and the sentence that used to explain the
       * gap ("a table would be a list with lines drawn on it") is gone: an empty set says nothing.
       */}
      {also.length ? (
        <Fragment>
          <div className="section-h" style={{ margin: "18px 0 6px" }}>
            {rows.length ? "Also in this set" : "In this set"}
          </div>
          <ul className="also-list" data-compare-also={conceptKey}>
            {also.map((item) => (
              <li key={item.id}>
                <a href={`#/i/${item.id}`}>{label(item)}</a>
                <span className="also-meta">{item.source} · {item.licence}</span>
                {item.one_line ? <span className="also-line">{item.one_line}</span> : null}
              </li>
            ))}
          </ul>
        </Fragment>
      ) : null}

      {/*
       * The tiles, below the table: the same component the gallery and the front page mount, so a member with a
       * demo shows a live window onto it and a member without one shows the reference card rather than an empty
       * box. The tile is not interactive (the item page is), so nothing here competes with the table's links for a
       * tab stop — one tile is one stop, and it opens the item.
       */}
      <div className="section-h" style={{ marginTop: 6 }}>
        The same {members.length}, as tiles
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "0 0 12px" }}>
        A frozen first frame each, until you point at one or tab to it. Members with no demo show the reference
        card — the licence, no pretence of a running frame.
      </p>
      <div ref={host} data-compare-tiles="" style={{ margin: "0 0 22px" }}>
        <Grid rows={rows} colW={colW} bodyH={bodyH} narrow={narrow} theme={theme} />
      </div>

      <p style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--ink-muted)" }}>
        Filed by library, then name. Nothing here is in an order of merit; the columns are the behaviour that separates them.{" "}
        <a href="#/g" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          All {items.length} items
        </a>
      </p>
    </div>
  );
}

const MONO_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase",
  color: "var(--ink-muted)",
};

const HEAD: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--ink-muted)", fontWeight: 500, padding: "0 10px 6px", textAlign: "left", whiteSpace: "nowrap",
};

const NAME: React.CSSProperties = {
  textAlign: "left", fontSize: 14.5, fontWeight: 500, padding: "8px 10px 8px 0",
  // the name cell carries the "pick this if…" line, so it wraps now — a nowrap row would push the
  // behaviour columns off a 1440 px page the moment one member's sentence ran long
  whiteSpace: "normal", verticalAlign: "top",
};

const CELL: React.CSSProperties = {
  textAlign: "right", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)",
  color: "var(--ink)", verticalAlign: "top",
};
