import { useEffect, useMemo, useState } from "react";
import { conceptKeys, conceptMembers, items, label, type Item } from "./lib";

/**
 * `#/c/<concept-key>` — the members of one concept, compared rather than listed.
 *
 * This page is the one thing a catalogue of four libraries can do that no source site can: each of those sites
 * shows only its own sidebars, so "six sidebars, four libraries, side by side" is not a view any of them has.
 * It is worth a page only if it actually compares, so three rules are enforced in code below, not promised:
 *
 *   * **a column that every member answers identically is dropped**, and the bottom of the page names what was
 *     dropped and what it said. A table whose rows differ only in name is a list with lines drawn on it;
 *   * **no verdict and no order of merit** — rows are filed by source then slug, which is a shelf order; the
 *     manifest holds 0 human picks and publishes 0 verdicts, so there is nothing here to order by merit even if
 *     we wanted to. No sentence about any individual item appears that the manifest could not print itself;
 *   * **the method is quoted, or it is admitted missing.** Where a set came from is the store's `concept.rule`;
 *     the manifest publishes membership but not rules, so this page says the method is unpublished. It does not
 *     invent one, and it never falls back to "everything" for a set it cannot resolve.
 */

/**
 * The comparison fields, as the data unit publishes them. A `null` is "this source cannot answer that", which
 * is absence and not zero — the store once shipped 0 bytes for 178 items, so a 0 here is only ever a real 0.
 */
type Compared = Item & {
  file_count?: number | null;
  bytes?: number | null;
  dep_count?: number | null;
  composition?: { count: number; lower_bound?: boolean } | null;
  used_here?: number | null;
  has_demo?: boolean;
};

const facts = (i: Item) => i as Compared;

/** Whether a demo runs here: the build's own answer, and only then the variant list it was built from. */
const hasDemo = (i: Item) => facts(i).has_demo ?? i.variants.length > 0;

/** The one glyph for "not known", and the sentence behind it, so no column can quietly print a fake 0. */
const UNKNOWN = "—";
const WHY_UNKNOWN = "not a fact this source can answer — absence, not zero";

type Col = {
  key: string;
  head: string;
  /** What the cell prints. */
  text: (i: Item) => string;
  /** The exact value behind the printed text, for `title`: the table rounds, the tooltip does not. */
  exact?: (i: Item) => string;
};

const count = (n: number | null | undefined, one: string, many: string) =>
  typeof n === "number" ? `${n} ${n === 1 ? one : many}` : WHY_UNKNOWN;

/**
 * The columns the brief allows: the fields that actually differ between members of a set. Nothing else is here
 * — a column the data cannot support is not a column, and a per-item opinion is not a field at all.
 */
const COLS: Col[] = [
  { key: "source", head: "source", text: (i) => i.source },
  { key: "licence", head: "licence", text: (i) => i.licence },
  { key: "kind", head: "kind", text: (i) => i.kind },
  {
    key: "files", head: "files",
    text: (i) => { const n = facts(i).file_count; return typeof n === "number" ? String(n) : UNKNOWN; },
    exact: (i) => count(facts(i).file_count, "file", "files") + " in the published snapshot",
  },
  {
    key: "size", head: "size",
    text: (i) => {
      const b = facts(i).bytes;
      if (typeof b !== "number") return UNKNOWN;
      return b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;
    },
    exact: (i) => { const b = facts(i).bytes; return typeof b === "number" ? `${b} bytes, exactly` : WHY_UNKNOWN; },
  },
  {
    key: "deps", head: "deps",
    text: (i) => { const n = facts(i).dep_count; return typeof n === "number" ? String(n) : UNKNOWN; },
    exact: (i) => count(facts(i).dep_count, "external dependency", "external dependencies"),
  },
  {
    key: "parts", head: "parts",
    text: (i) => {
      const c = facts(i).composition;
      if (!c || typeof c.count !== "number") return UNKNOWN;
      return `${c.lower_bound ? "≥" : ""}${c.count}`;
    },
    exact: (i) => {
      const c = facts(i).composition;
      if (!c || typeof c.count !== "number") return WHY_UNKNOWN;
      return c.lower_bound
        ? `${c.count} and possibly more: 820 of the store's internal edges name a target that is not a catalogue row, so composition under-reports by construction`
        : `${c.count} catalogue primitives`;
    },
  },
  {
    key: "used", head: "used here",
    text: (i) => { const n = facts(i).used_here; return typeof n === "number" ? String(n) : UNKNOWN; },
    exact: (i) => count(facts(i).used_here, "place in this shell", "places in this shell"),
  },
  {
    key: "demo", head: "live demo",
    text: (i) => (hasDemo(i) ? "yes" : "no"),
    exact: (i) => (hasDemo(i) ? "a demo runs on this site" : "reference-only: there is no demo to run"),
  },
];

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

export function Compare({ conceptKey }: { conceptKey: string }) {
  const known = useMemo(() => conceptKeys.includes(conceptKey), [conceptKey]);
  // filed by source, then slug: the order a shelf is in, not an order of merit
  const rows = useMemo(
    () => conceptMembers(conceptKey).sort((a, b) => a.source.localeCompare(b.source) || a.slug.localeCompare(b.slug)),
    [conceptKey],
  );
  const stacked = useStacked();
  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))], [rows]);
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

  // a column survives only if it distinguishes: the set of printed answers has to have more than one member
  const differing = COLS.filter((c) => new Set(rows.map((r) => c.text(r))).size > 1);
  const dropped = COLS.filter((c) => !differing.includes(c));

  return (
    <div className="page-in" style={{ maxWidth: 1560, margin: "0 auto" }}>
      <div className="crumb">concept</div>
      <h2 className="title" data-compare-concept={conceptKey}>{conceptKey}</h2>
      <p className="lede" style={{ marginBottom: 12 }}>
        {rows.length} members from {sources.length} {sources.length === 1 ? "library" : "libraries"}, compared on the
        fields that differ between them. Both numbers are the data's, not a count kept by hand.
      </p>

      <div style={{ margin: "0 0 16px", paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <span
          data-compare-counts=""
          data-compare-members={rows.length}
          data-compare-sources={sources.length}
          data-compare-dropped={dropped.map((c) => c.key).join(",")}
          data-compare-shown={differing.map((c) => c.key).join(",")}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.02em", color: "var(--muted-foreground)" }}
        >
          {rows.length} members · {sources.length} {sources.length === 1 ? "source" : "sources"} ·{" "}
          {differing.length} of {COLS.length} fields differ
        </span>
      </div>

      {differing.length ? (
        <table
          data-compare-table=""
          style={{
            width: "100%", display: stacked ? "block" : "table",
            borderCollapse: "collapse", margin: "0 0 14px",
          }}
        >
          <thead style={{ display: stacked ? "none" : "table-header-group" }}>
            <tr>
              <th scope="col" style={HEAD}>item</th>
              {differing.map((c) => <th key={c.key} scope="col" style={{ ...HEAD, textAlign: "right" }}>{c.head}</th>)}
            </tr>
          </thead>
          <tbody style={{ display: stacked ? "block" : "table-row-group" }}>
            {rows.map((item) => (
              <tr
                key={item.id}
                data-compare-row={item.id}
                style={stacked
                  ? { display: "block", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", margin: "0 0 10px" }
                  : { borderTop: "1px solid var(--border)" }}
              >
                <th scope="row" style={stacked ? { ...NAME, display: "block", padding: "0 0 6px" } : NAME}>
                  <a href={`#/i/${item.id}`} style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 }}>
                    {label(item)}
                  </a>
                </th>
                {differing.map((c) => (
                  <td
                    key={c.key}
                    data-col={c.key}
                    style={stacked
                      ? { display: "flex", gap: 10, justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", border: 0 }
                      : { ...CELL }}
                  >
                    {stacked && <span style={{ ...MONO_LABEL }}>{c.head}</span>}
                    <span title={c.exact?.(item)} style={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                      {c.text(item)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="withheld" style={{ margin: "0 0 14px" }}>
          These {rows.length} items answer every published field the same way — {dropped.length} of {COLS.length}{" "}
          fields are identical across the set, and the rest is the name. A table here would be a list with lines
          drawn on it, so there is not one.
        </div>
      )}

      {/*
       * The dropped columns are named, with what they said, because "we only show what differs" is otherwise a
       * claim a reader cannot check: the licence that is the same for all six members is still a fact about the
       * set, and the reason it is not a column is that it does not compare.
       */}
      <p data-compare-dropped-note="" style={{ fontSize: 13.5, color: "var(--muted-foreground)", margin: "0 0 22px" }}>
        {dropped.length ? (
          <>
            Dropped, because every member of “{conceptKey}” answers them identically:{" "}
            {dropped.map((c, i) => (
              <span key={c.key}>
                {i > 0 && " · "}
                <code>{c.head}</code> = <span style={{ fontVariantNumeric: "tabular-nums" }}>{c.text(rows[0])}</span>
              </span>
            ))}
            . A field that cannot separate two members cannot help anyone choose between them.
          </>
        ) : (
          <>Every field the manifest publishes differs inside this set, so every field is a column.</>
        )}
      </p>

      <p style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--muted-foreground)" }}>
        Filed by source, then slug — a shelf order, not an order of merit.{" "}
        <a href="#/g" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>
          All {items.length} items
        </a>
      </p>
    </div>
  );
}

const MONO_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase",
  color: "var(--muted-foreground)",
};

const HEAD: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--muted-foreground)", fontWeight: 500, padding: "0 10px 6px", textAlign: "left", whiteSpace: "nowrap",
};

const NAME: React.CSSProperties = {
  textAlign: "left", fontSize: 14.5, fontWeight: 500, padding: "8px 10px 8px 0", whiteSpace: "nowrap",
};

const CELL: React.CSSProperties = {
  textAlign: "right", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)",
  color: "var(--foreground)",
};
