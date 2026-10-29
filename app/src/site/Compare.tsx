import { Fragment, useEffect, useMemo, useState } from "react";
import { conceptKeys, conceptMembers, items, label, type Item } from "./lib";
import { Grid, useColumnWidth, useNarrow, useSiteTheme } from "./Tile";
import { BEHAVIOUR_COLS, behaviourOf, measuredOn, NOT_MEASURED, pickLine, separates, type FactCol } from "./behaviour";

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

/** What a dropped column said — the value most of the *measured* rows gave, with the denominator beside it. */
function saidBy(col: FactCol, rows: Item[]) {
  const answers = rows.filter((r) => col.answered(r)).map((r) => col.text(r));
  const seen = new Map<string, number>();
  for (const a of answers) seen.set(a, (seen.get(a) ?? 0) + 1);
  const top = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { text: top[0], of: answers.length, all: seen.size > 1 } : { text: NOT_MEASURED, of: 0, all: false };
}

export function Compare({ conceptKey }: { conceptKey: string }) {
  const known = useMemo(() => conceptKeys.includes(conceptKey), [conceptKey]);
  // filed by source, then slug: the order a shelf is in, not an order of merit
  const rows = useMemo(
    () => conceptMembers(conceptKey).sort((a, b) => a.source.localeCompare(b.source) || a.slug.localeCompare(b.slug)),
    [conceptKey],
  );
  const stacked = useStacked();
  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))], [rows]);
  // The tiles are the gallery's own — the same `Grid`, so the same pool, the same mount queue, the same
  // reference card for a member with no demo. A second copy of the tile here would be a second behaviour to
  // keep in step, and the brief's whole point is that a visitor sees one catalogue, not four renderings of it.
  const narrow = useNarrow();
  const bodyH = narrow ? 180 : 210;
  const { colW, host } = useColumnWidth(narrow, rows.length);
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

  if (!rows.length) {
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
  const measured = rows.filter((r) => behaviourOf(r)).length;

  return (
    <div className="page-in" style={{ maxWidth: 1560, margin: "0 auto" }}>
      <div className="crumb">concept</div>
      <h2 className="title" data-compare-concept={conceptKey}>{conceptKey}</h2>
      <p className="lede" style={{ marginBottom: 12 }}>
        {rows.length} members from {sources.length} {sources.length === 1 ? "library" : "libraries"}, compared on how
        they behave. Both numbers are the data's, not a count kept by hand.
      </p>

      <div style={{ margin: "0 0 16px", paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <span
          data-compare-counts=""
          data-compare-members={rows.length}
          data-compare-sources={sources.length}
          data-compare-measured={measured}
          data-compare-dropped={dropped.map((c) => c.key).join(",")}
          data-compare-shown={differing.map((c) => c.key).join(",")}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em", color: "var(--muted-foreground)" }}
        >
          {rows.length} members · {sources.length} {sources.length === 1 ? "source" : "sources"} ·{" "}
          {differing.length} of {COLS.length} columns differ · {measured} measured
        </span>
      </div>

      {/* One line about the set, in a visitor's terms: which items these are, and why. */}
      <p data-compare-method="" style={{ fontSize: 13.5, margin: "0 0 6px", color: "var(--muted-foreground)" }}>
        These are the {rows.length} items this catalogue files under “{conceptKey}” — {provenance(conceptKey, rows)}.
      </p>
      {/* What the columns are, and when they were observed. A fact about a demo is only true of the demo as it
          ran, so the date is the visitor's business: "says it collapses" and "collapsed when we pressed it" are
          different claims, and only the second one is on this page. */}
      <p data-compare-measured-note="" style={{ fontSize: 13, margin: "0 0 18px", color: "var(--muted-foreground)" }}>
        The columns are measured, not claimed: each demo was loaded in this site's own frame at 1440 px and again at
        390 px and driven in a real browser{lastRun ? <>, most recently on {lastRun}</> : null}
        {probeVersion ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}> ({probeVersion})</span> : null}.
        {measured < rows.length ? (
          <> {rows.length - measured} of these {rows.length} carry no measured behaviour, so their cells say
            “{NOT_MEASURED}” — which is not “no”.</>
        ) : null}
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
              const pick = pickLine(item, rows);
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
                              color: unknown ? "var(--muted-foreground)" : "var(--foreground)",
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
                        style={{ padding: stacked ? 0 : "0 10px 10px 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted-foreground)" }}
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
      ) : (
        <div className="withheld" style={{ margin: "0 0 14px" }}>
          {/* Two different reasons for no table, and they must not be conflated: a set whose members agree is a
              comparison with nothing to compare; a set nobody measured is not a comparison at all. Saying the
              first when the second is true would read as "they behave the same", which is a claim nobody made. */}
          {measured === 0 ? (
            <>Nobody has measured how the {rows.length} members of “{conceptKey}” behave, so there is nothing to
              compare here: {rows.length} {rows.length === 1 ? "item" : "items"} and no measurement between them. A
              table would be a list with lines drawn on it, so there is not one.</>
          ) : (
            <>These {rows.length} items answer every measured behaviour the same way — {dropped.length} of {COLS.length}{" "}
              columns are identical or unanswered across the set, and the rest is the name. A table here would be a
              list with lines drawn on it, so there is not one.</>
          )}
        </div>
      )}

      {/*
       * The dropped columns are named, with what they said, because "we only show what differs" is otherwise a
       * claim a reader cannot check. A dropped behaviour column is still a measured fact about the set — it is
       * simply not a fact that separates two members, and a column that cannot separate two members cannot help
       * anyone choose between them.
       */}
      <p data-compare-dropped-note="" style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: "0 0 22px" }}>
        {measured === 0 ? (
          <>Dropped, because none of them could be answered for “{conceptKey}”: no member of this set has a measured
            behaviour, so all {COLS.length} columns read “{NOT_MEASURED}”.</>
        ) : dropped.length ? (
          <>
            Dropped, because they do not separate the members of “{conceptKey}”:{" "}
            {dropped.map((c, i) => {
              const s = saidBy(c as FactCol, rows);
              return (
                <span key={c.key}>
                  {i > 0 && " · "}
                  <code>{c.head}</code> = <span style={{ fontVariantNumeric: "tabular-nums" }}>{s.text}</span>
                  {s.of && s.of < rows.length ? ` (${s.of} of ${rows.length} answered)` : s.of ? ` (all ${s.of})` : " (nobody could answer)"}
                </span>
              );
            })}
            .
          </>
        ) : (
          <>Every column differs inside this set, so every column is on the table.</>
        )}
      </p>

      {/*
       * The tiles, below the table: the same component the gallery and the front page mount, so a member with a
       * demo shows a live window onto it and a member without one shows the reference card rather than an empty
       * box. The tile is not interactive (the item page is), so nothing here competes with the table's links for a
       * tab stop — one tile is one stop, and it opens the item.
       */}
      <div className="section-h" style={{ marginTop: 6 }}>
        The same {rows.length}, as tiles
      </div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
        A frozen first frame each, until you point at one or tab to it. Members with no demo show the reference
        card — the licence, no pretence of a running frame.
      </p>
      <div ref={host} data-compare-tiles="" style={{ margin: "0 0 22px" }}>
        <Grid rows={rows} colW={colW} bodyH={bodyH} narrow={narrow} theme={theme} />
      </div>

      <p style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--muted-foreground)" }}>
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
  color: "var(--muted-foreground)",
};

const HEAD: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--muted-foreground)", fontWeight: 500, padding: "0 10px 6px", textAlign: "left", whiteSpace: "nowrap",
};

const NAME: React.CSSProperties = {
  textAlign: "left", fontSize: 14.5, fontWeight: 500, padding: "8px 10px 8px 0",
  // the name cell carries the "pick this if…" line, so it wraps now — a nowrap row would push the
  // behaviour columns off a 1440 px page the moment one member's sentence ran long
  whiteSpace: "normal", verticalAlign: "top",
};

const CELL: React.CSSProperties = {
  textAlign: "right", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)",
  color: "var(--foreground)", verticalAlign: "top",
};
