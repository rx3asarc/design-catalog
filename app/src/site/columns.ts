import type { Item } from "./lib";
import { BEHAVIOUR_COLS, behaviourOf, NOT_MEASURED, type FactCol, type Measured } from "./behaviour";
import { columnKeysOf, type TypeEntry } from "./taxonomy";

/**
 * THE COLUMN REGISTRY — every fact a type page may print, and the one place a column key becomes a cell.
 *
 * Until round 9 every type page printed the sidebar's six measured facts, so Button and Calendar were asked
 * WHETHER THEY COLLAPSE and WHAT THEY DO AT 390 PX — questions that mean nothing for a button and cannot be
 * answered for a calendar, printed as rows of "not measured":
 *
 *   "Every type reuses the sidebar's columns. Button and Calendar get COLLAPSES and AT 390 PX, plus a 'pick this
 *    if' that says the item 'stays put… instead of becoming a sheet' — meaningless for a button or a calendar.
 *    Each type needs its own columns; for buttons: variants, sizes, loading state, icon support."
 *                                                              — r5-review.md, Type pages, item 3
 *
 * Two families, and the difference is where the answer comes from:
 *
 *  - **field columns** are read off the item's own manifest fields (`variants`, `file_count`) and its **demo
 *    labels** — the library's own words for what its demos show: `Size`, `Icon`, `With Icon`, `Spinner`,
 *    `Disabled`. "Sizes", "loading state" and "icon support" are therefore a reading of the data, not a
 *    vocabulary invented here.
 *  - **measured columns** are `behaviour.ts`'s six probe facts, and a type may declare one only where the
 *    question means something (`scripts/taxonomy.py`'s `MEASURES`, one reason per type). This module does not
 *    decide that; it only knows how to print what a type declared.
 *
 * THE NULL RULE IS `behaviour.ts`'s AND IT IS UNCHANGED: a fact is `true`, `false` or `null`, and `null` prints
 * "not measured" — never "no". A member that ships no demos at all has not been measured for "does a demo show a
 * size"; a member that ships demos and none of them carries a `Size` label has been measured, and the answer is
 * no. Those are different answers and they print differently.
 *
 * What this module deliberately does NOT do: declare columns. `taxonomy.json`'s `columns` is the declaration, one
 * list per type, generated from what the type's members answer — so a column a type cannot answer is never
 * declared, and no page can print a row of "not measured" for a question nobody could ask (`taxonomy.ts`'s
 * `columnKeysOf`).
 */

/** One column: a key, a head, the cell it prints, the witness behind it, and an order for sorting. */
export type Col = {
  key: string;
  /** the label a card or a table header prints, in the reader's words */
  head: string;
  /** `"field"` — read from the manifest; `"measured"` — read from the probe */
  kind: "field" | "measured";
  /** What the cell prints. `NOT_MEASURED` when the fact is genuinely undetermined. */
  text: (i: Item) => string;
  /** The witness behind the printed text, for `title`: the card rounds, the tooltip does not. */
  exact: (i: Item) => string;
  /** Did the data answer this question for this item? Columns are judged on answered rows only. */
  answered: (i: Item) => boolean;
  /**
   * The order a reader wants for this column, or `null` when this item has no answer. Booleans are not
   * alphabetical facts and counts are not strings: each column carries the order its own answers imply.
   */
  rank: (i: Item) => number | null;
};

const demoLabels = (i: Item): string[] => (i.variants ?? []).map((v) => v.label);

/** A demo label matching `re`, asked only of an item that has demos at all. */
const labelSays = (i: Item, re: RegExp): boolean | null => {
  const labels = demoLabels(i);
  if (!labels.length) return null;                       // no demos: nothing was shown, so nothing was measured
  return labels.some((l) => re.test(l));
};

/** `shown` / `no` / `not measured` — the whole vocabulary of a "does a demo do X" column. */
const shown = (v: boolean | null) => (v === null ? NOT_MEASURED : v ? "shown" : "no");

/** The labels a "does a demo show X" column matched, for the tooltip: the library's own words. */
const matchLine = (i: Item, re: RegExp, what: string) => {
  const hits = demoLabels(i).filter((l) => re.test(l));
  if (!demoLabels(i).length) return `not measured: ${i.displayName ?? i.name} ships no demo, so nothing was shown`;
  return hits.length ? `${what}: ${hits.map((h) => `“${h}”`).join(", ")}` : `no demo labelled with a ${what.slice(0, -1)}`;
};

/**
 * The field columns, each answered from the item's own fields.
 *
 * `demos` is the item's own demo list — the thing the review called "variants" for buttons. The other three read
 * the labels of those demos, so an item whose demos say `Size`, `Spinner` and `Icon` answers all three, and an
 * item whose demos are one `Preview` answers none of them (which drops the column from the types where nobody
 * can answer it, and prints "no" where someone can).
 */
const FIELD_COLS: Col[] = [
  {
    key: "demos",
    head: "demos",
    kind: "field",
    text: (i) => {
      const n = demoLabels(i).length;
      return n ? `${n} ${n === 1 ? "demo" : "demos"}` : NOT_MEASURED;
    },
    exact: (i) => {
      const labels = demoLabels(i);
      return labels.length ? `${labels.length} demos: ${labels.join(", ")}` : "not measured: this item ships no demo";
    },
    answered: (i) => demoLabels(i).length > 0,
    rank: (i) => (demoLabels(i).length ? demoLabels(i).length : null),
  },
  {
    key: "sizes",
    head: "sizes",
    kind: "field",
    text: (i) => shown(labelSays(i, /^(size|sizes|small|large|sm|md|lg|xs|xl)$/i)),
    exact: (i) => matchLine(i, /^(size|sizes|small|large|sm|md|lg|xs|xl)$/i, "sizes"),
    answered: (i) => labelSays(i, /^(size|sizes|small|large|sm|md|lg|xs|xl)$/i) !== null,
    rank: (i) => (labelSays(i, /^(size|sizes|small|large|sm|md|lg|xs|xl)$/i) ? 1 : 0),
  },
  {
    key: "loading",
    head: "loading state",
    kind: "field",
    text: (i) => shown(labelSays(i, /spinner|loading|progress|wait/i)),
    exact: (i) => matchLine(i, /spinner|loading|progress|wait/i, "loading states"),
    answered: (i) => labelSays(i, /spinner|loading|progress|wait/i) !== null,
    rank: (i) => (labelSays(i, /spinner|loading|progress|wait/i) ? 1 : 0),
  },
  {
    key: "icons",
    head: "icons",
    kind: "field",
    text: (i) => shown(labelSays(i, /icon/i)),
    exact: (i) => matchLine(i, /icon/i, "icons"),
    answered: (i) => labelSays(i, /icon/i) !== null,
    rank: (i) => (labelSays(i, /icon/i) ? 1 : 0),
  },
  {
    key: "states",
    head: "states",
    kind: "field",
    text: (i) => shown(labelSays(i, /disabled|invalid|error|success|read-?only|required/i)),
    exact: (i) => matchLine(i, /disabled|invalid|error|success|read-?only|required/i, "states"),
    answered: (i) => labelSays(i, /disabled|invalid|error|success|read-?only|required/i) !== null,
    rank: (i) => (labelSays(i, /disabled|invalid|error|success|read-?only|required/i) ? 1 : 0),
  },
  {
    key: "files",
    head: "files",
    kind: "field",
    text: (i) => {
      const n = i.file_count;
      return typeof n === "number" && n > 0 ? `${n} ${n === 1 ? "file" : "files"}` : NOT_MEASURED;
    },
    exact: (i) => {
      const n = i.file_count;
      const files = i.files ?? [];
      if (typeof n !== "number" || !n) return "not measured: no source file was captured for this item";
      return files.length ? `${n}: ${files.join(", ")}` : `${n} source files captured`;
    },
    answered: (i) => typeof i.file_count === "number" && i.file_count > 0,
    rank: (i) => (typeof i.file_count === "number" && i.file_count > 0 ? i.file_count : null),
  },
];

/** The six probe facts, exactly as `behaviour.ts` words them. Re-keyed here so one registry holds every column. */
const MEASURED_COLS: Col[] = BEHAVIOUR_COLS.map((c: FactCol) => ({
  key: c.key,
  head: c.head,
  kind: "measured" as const,
  text: c.text,
  exact: c.exact,
  answered: c.answered,
  rank: (i: Item) => rankOf(c.key, i),
}));

/**
 * The value a measured column sorts by, or `null` when this member has no answer.
 *
 * The text a cell prints is not the order a reader wants: "to icons", "off-canvas", "narrower" and "no" are not
 * alphabetical facts. Each column gets the order its own answers imply — narrower before off-canvas before icon
 * rail, one level before two before three, a component before a page — and every word still comes from
 * `behaviourOf`, so the order is a reading of the measurement, not a second one.
 */
function rankOf(key: string, i: Item): number | null {
  const b: Measured | null = behaviourOf(i);
  switch (key) {
    case "collapses":
      return typeof b?.collapses !== "boolean" ? null
        : !b.collapses ? 0 : b.collapseKind === "narrower" ? 1 : b.collapseKind === "off canvas" ? 2 : 3;
    case "nests": return typeof b?.nests !== "boolean" ? null : !b.nests ? 0 : b.nestDepth ?? 2;
    case "sheet": return typeof b?.sheet !== "boolean" ? null : b.sheet ? 1 : 0;
    case "keyboard": return typeof b?.keyboard !== "boolean" ? null : b.keyboard ? 1 : 0;
    case "shape": return typeof b?.shape !== "boolean" ? null : b.shape ? 1 : 0;
    case "animates": return typeof b?.animates !== "boolean" ? null : b.animates ? 1 : 0;
    default: return null;
  }
}

/** Every column by key. A key the taxonomy declares and this registry does not know prints nothing at all. */
export const COLUMNS = new Map<string, Col>(
  [...FIELD_COLS, ...MEASURED_COLS].map((c) => [c.key, c]),
);

/**
 * The columns ONE type prints, in the order its declaration lists them, with every column none of its members
 * can answer dropped.
 *
 * The drop is the second half of the review's complaint and it is not decoration: a declared column whose answer
 * nobody in the set has is a header over a row of "not measured", which is the shape of table the review called
 * out. The declaration already avoids it; this is the belt to that brace, and it is what makes a type with no
 * demos at all print no demo column.
 */
export function columnsOf(entry: TypeEntry): Col[] {
  return columnKeysOf(entry.key)
    .map((k) => COLUMNS.get(k))
    .filter((c): c is Col => !!c)
    .filter((c) => entry.members.some((m) => c.answered(m)));
}

/** The same, for the two families, so a page can print measured columns in a table and field columns on a card. */
export const fieldColsOf = (cols: Col[]) => cols.filter((c) => c.kind === "field");
export const measuredColsOf = (cols: Col[]) => cols.filter((c) => c.kind === "measured");

/**
 * HOW MANY MEASURED MEMBERS EARN A TABLE — the threshold, and the argument for it.
 *
 * A table is a comparison. Two rows that answered the same column are a comparison; one row is a paragraph with a
 * header, which is what round 8 shipped on 66 of 67 type pages ("Button's has 1 row and 20 items under 'Also in
 * this set'"). So a type prints a table when **at least two of its members answered its measured columns**, and
 * leads with the visual grid otherwise. Two, not three: two members with the same measured question answered is
 * the smallest thing that can differ, and a higher floor would delete the table from the one type where the
 * catalogue has the evidence for it (Sidebar: 4 measured of 7). When the probe measures another member of any
 * type, that type grows a table by itself — the threshold is a property of the data, not a list of pages.
 */
export const TABLE_FLOOR = 2;

/** The members of a type that answered at least one of its own measured columns. */
export function measuredMembers(entry: TypeEntry, cols: Col[]): Item[] {
  const measured = measuredColsOf(cols);
  if (!measured.length) return [];
  return entry.members.filter((m) => measured.some((c) => c.answered(m)));
}

/** Does this type earn a table? (See `TABLE_FLOOR`.) */
export const earnsTable = (entry: TypeEntry, cols: Col[]) => measuredMembers(entry, cols).length >= TABLE_FLOOR;

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
export function sortedBy(rows: Item[], key: string, dir: "asc" | "desc", nameOrder: (a: Item, b: Item) => number): Item[] {
  const col = COLUMNS.get(key);
  if (!col) return [...rows].sort(nameOrder);
  return [...rows].sort((a, b) => {
    const av = col.rank(a);
    const bv = col.rank(b);
    if (av === null || bv === null) return av === bv ? nameOrder(a, b) : av === null ? 1 : -1;
    return av === bv ? nameOrder(a, b) : dir === "asc" ? av - bv : bv - av;
  });
}
