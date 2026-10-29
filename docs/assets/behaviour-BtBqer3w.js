var e=`import type { Item } from "./lib";

/**
 * The behaviour facts, as \`app/probe_behaviour.mjs\` measured them in a browser, and the one sentence a
 * member earns from its own facts.
 *
 * A manifest can say licence, kind, files, KB, deps, parts, where it is used and whether a demo exists. It
 * could not say the thing a person choosing a sidebar actually needs: does it collapse, do I get a sheet on a
 * phone, does it nest, does it move, can I reach it with Tab, is it a page or a part. Those are measurements,
 * not fields, so the probe takes them and \`app/gen.py\` attaches them to each item as \`behaviour\`.
 *
 * ── THE RULES THIS MODULE EXISTS TO KEEP (do not "restore" the older purism) ──────────────────────────────
 *
 * 1. **A fact is \`true\`, \`false\`, or \`null\`, and \`null\` is never \`false\`.** \`null\` means *the probe could not
 *    tell* — no demo, a demo that did not mount, a sidebar the probe could not locate. The cell prints
 *    "not measured" and its \`title\` says why. Printing "no" for a fact nobody measured is the exact lie the
 *    store already shipped once (0 bytes for 178 items), in a new place.
 *
 * 2. **A fact is a measurement of a moment.** Every record carries the probe's version and the date it ran,
 *    and the page says that date out loud. Behaviour changes when a demo changes; an undated fact would read
 *    as an eternal truth.
 *
 * 3. **A "pick this if…" line is derived, never invented, and it is not a verdict.** It is built from that
 *    item's own measured facts in one template, so it cannot quietly become editorial. There is **no
 *    ranking, no winner and no score** anywhere on this page — an order of merit is still forbidden. A fact
 *    about behaviour is not an opinion about quality: "collapses to an icon rail" is a measurement; "better
 *    than the one that does not" is a judgement nobody here is entitled to make. The manifest publishes 0
 *    human picks and 0 verdicts, so there is nothing to rank by even if this module wanted to.
 *
 * 4. **An absent record prints as absent.** An item the probe never reached has no \`behaviour\` key, which is
 *    not the same as six nulls, and neither is a dash.
 */

export type Fact = boolean | null;

export type Measured = {
  collapses: Fact;
  sheet: Fact;
  nests: Fact;
  animates: Fact;
  keyboard: Fact;
  shape: Fact;
  /** Below the six facts: the witnesses. Detail is for \`title\`, never for a verdict. */
  collapseKind?: string | null;
  nestDepth?: number | null;
  arrows?: Fact;
  animatedNodes?: number | null;
  interactiveNodes?: number | null;
  changeFrames?: number | null;
  maxDurationMs?: number | null;
  subMarkers?: number | null;
  focusStops?: number | null;
  firstStopAt?: number | null;
  collapseDetail?: {
    clickedControl?: string | null;
    widthBefore?: number | null;
    widthMin?: number | null;
    stateBefore?: string | null;
    stateAfter?: string | null;
    declared?: string | null;
    shrinkPct?: number | null;
  } | null;
  shapeDetail?: { widthPx: number; heightPx: number; topPx: number; frameWidthPx: number; frameHeightPx: number } | null;
  sheetHow?: string | null;
  nestsHow?: string | null;
  keyboardHow?: string | null;
  regionHow?: string | null;
  variant?: number | null;
  reason?: string | null;
  /** The probe's own version string, and the day it ran: a fact is a measurement of a moment. */
  probe: string;
  at: string;
};

/** What "not measured" says, in every cell that has a \`null\`. Never a dash: a dash reads as "no". */
export const NOT_MEASURED = "not measured";

/** The behaviour record \`gen.py\` attached, or nothing. Absent and unmeasured are not the same thing. */
export function behaviourOf(item: Item): Measured | null {
  const b = (item as Item & { behaviour?: Measured }).behaviour;
  return b && typeof b === "object" ? b : null;
}

/** \`2026-10-28T22:49:03Z\` → \`28 October 2026\`. The visitor's date, not an ISO stamp. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function measuredOn(b: Measured | null): string | null {
  if (!b?.at) return null;
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(b.at);
  if (!m) return null;
  return \`\${Number(m[3])} \${MONTHS[Number(m[2]) - 1]} \${m[1]}\`;
}

const num = (n: number | null | undefined): string => (typeof n === "number" ? String(n) : "?");

/** "why is this cell not measured" — the honest answer, from the record's own words. */
function why(b: Measured | null): string {
  if (!b) return "not measured: this build carries no behaviour record for this item";
  if (b.reason) return \`not measured: \${b.reason}\`;
  return "not measured: the probe could not tell from this frame";
}

export type FactCol = {
  key: string;
  head: string;
  /** What the cell prints. \`null\` prints "not measured" and never the negative word. */
  text: (i: Item) => string;
  /** The witness behind the printed text, for \`title\`: the table rounds, the tooltip does not. */
  exact: (i: Item) => string;
  /** Did the probe get a boolean answer for this item? Columns are judged on answered rows only. */
  answered: (i: Item) => boolean;
};

/**
 * The six behaviour columns, in the order a person deciding would ask them: does it get out of the way, does
 * it hold a hierarchy, what happens on a phone, can I drive it, how big is it, does it move.
 *
 * \`animates\` is here because the brief asks for it, and it earns its place or does not: in the \`sidebar\` set
 * every measured member declares a transition somewhere, so the column is identical across the answered rows
 * and the comparison page drops it and says so. That is the rule working, not a gap.
 */
export const BEHAVIOUR_COLS: FactCol[] = [
  {
    key: "collapses",
    head: "collapses",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.collapses === null) return NOT_MEASURED;
      if (!b.collapses) return "no";
      const kind = b.collapseKind;
      return kind === "icon rail" ? "to icons" : kind === "off canvas" ? "off-canvas" : kind === "narrower" ? "narrower" : "yes";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.collapses === null) return why(b);
      if (!b.collapses) {
        return b.reason
          ? \`no: \${b.reason}\`
          : \`no: pressing \${b.collapseDetail?.clickedControl ? \`“\${b.collapseDetail.clickedControl}”\` : "the frame's collapse control"} changed nothing — the sidebar does not collapse\`;
      }
      const d = b.collapseDetail;
      const bits = [
        d?.declared ? \`the demo declares data-collapsible="\${d.declared}"\` : "no declared collapsible mode, so the width is the witness",
        d?.widthBefore != null && d?.widthMin != null ? \`width \${d.widthBefore} → \${d.widthMin} px\` : null,
        d?.shrinkPct ? \`a \${d.shrinkPct}% change\` : null,
        d?.clickedControl ? \`after pressing “\${d.clickedControl}”\` : null,
      ].filter(Boolean);
      return bits.join(", ");
    },
    answered: (i) => typeof behaviourOf(i)?.collapses === "boolean",
  },
  {
    key: "nests",
    head: "nests",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.nests === null) return NOT_MEASURED;
      if (!b.nests) return "one level";
      const d = b.nestDepth;
      const word = d === 3 ? "three" : d === 2 ? "two" : d ? num(d) : null;
      return word ? \`\${word} deep\` : "yes";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.nests === null) return why(b);
      const how = b.nestsHow ? \`\${b.nestsHow}. \` : "";
      return \`\${how}deepest menu nesting in the DOM: \${num(b.nestDepth)}\`;
    },
    answered: (i) => typeof behaviourOf(i)?.nests === "boolean",
  },
  {
    key: "sheet",
    head: "at 390 px",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.sheet === null) return NOT_MEASURED;
      return b.sheet ? "a sheet" : "stays put";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.sheet === null) return why(b);
      return b.sheetHow ? \`\${b.sheet ? "a sheet" : "no sheet"}: \${b.sheetHow}\` : b.sheet ? "a sheet opened at 390 px" : "nothing became a sheet at 390 px";
    },
    answered: (i) => typeof behaviourOf(i)?.sheet === "boolean",
  },
  {
    key: "keyboard",
    head: "keyboard",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.keyboard === null) return NOT_MEASURED;
      return b.keyboard ? "reaches rows" : "no";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.keyboard === null) return why(b);
      const arrows = b.arrows === null || b.arrows === undefined
        ? "arrow keys were not tested"
        : b.arrows
          ? "the arrow keys move inside the menu"
          : "the arrow keys do not move inside the menu";
      return \`\${b.keyboardHow ?? (b.keyboard ? "Tab reaches the rows" : "Tab does not reach the rows")}; \${arrows}\`;
    },
    answered: (i) => typeof behaviourOf(i)?.keyboard === "boolean",
  },
  {
    key: "shape",
    head: "shape",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.shape === null) return NOT_MEASURED;
      return b.shape ? "a page" : "a component";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.shape === null) return why(b);
      const s = b.shapeDetail;
      const numbers = s ? \`content \${s.widthPx}×\${s.heightPx} px in a \${s.frameWidthPx}×\${s.frameHeightPx} frame, \${s.topPx} px from the top\` : "";
      return \`\${b.shape ? "a page layout: it takes the frame" : "a component: it sits inside the frame"}\${numbers ? \` — \${numbers}\` : ""}\`;
    },
    answered: (i) => typeof behaviourOf(i)?.shape === "boolean",
  },
  {
    key: "animates",
    head: "moves",
    text: (i) => {
      const b = behaviourOf(i);
      if (!b || b.animates === null) return NOT_MEASURED;
      return b.animates ? "yes" : "no";
    },
    exact: (i) => {
      const b = behaviourOf(i);
      if (!b || b.animates === null) return why(b);
      const n = \`transition or animation duration > 0 on \${num(b.animatedNodes)} of \${num(b.interactiveNodes)} interactive nodes\`;
      const f = typeof b.changeFrames === "number" ? \`and a click kept changing the DOM on \${b.changeFrames} of 12 frames\` : "no click was observed";
      return \`\${n}; \${f}\`;
    },
    answered: (i) => typeof behaviourOf(i)?.animates === "boolean",
  },
];

/**
 * Does this column separate the members? The page's existing rule, made precise for columns that can be
 * *unanswered*: a column is worth printing when the **answered** rows disagree. A column that 18 rows answer
 * "yes" and 6 rows do not answer at all is not a comparison — it is a badge with a footnote — so it is
 * dropped and named, like any other column that cannot separate two members.
 */
export function separates(col: FactCol, rows: Item[]): boolean {
  const answers = rows.filter((r) => col.answered(r)).map((r) => col.text(r));
  return new Set(answers).size > 1;
}

const AND = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : \`\${parts.slice(0, -1).join(", ")} and \${parts[parts.length - 1]}\`;

/**
 * One "pick this if…" line, built from that member's own measured facts, in one voice for every member.
 *
 * The clauses are properties, never verdicts: "collapses to an icon rail" and "does not collapse" are both
 * things a person might want, and which of them is wanted is the reader's business, not this module's.
 *
 * \`peers\` (the rest of the set) only decides *which* three clauses to print: rarest first, so a line leads with
 * the thing that separates this member from the ones beside it instead of opening with the fact eighteen of them
 * share. Ranking clauses by how many peers share them is not ranking members — it is how a sentence about one
 * item stays worth reading next to a table of twenty-five.
 *
 * If the record answered nothing, there is no line: an absent sentence is the honest output for an absent
 * measurement.
 */
export function pickLine(item: Item, peers: Item[] = []): string | null {
  const b = behaviourOf(item);
  if (!b) return null;

  type Clause = { text: string; rarity: number };
  const out: Clause[] = [];
  // how many members of the set answered this fact the way this member did; 0 when there is no set to compare to
  const rarity = (key: keyof Measured) => {
    const mine = b[key];
    if (typeof mine !== "boolean") return 0;
    return peers.filter((p) => behaviourOf(p)?.[key] === mine).length;
  };
  const add = (key: keyof Measured, text: string) => out.push({ text, rarity: rarity(key) });

  if (b.collapses === true) {
    add("collapses",
      b.collapseKind === "icon rail" ? "collapses to an icon rail"
        : b.collapseKind === "off canvas" ? "collapses off-canvas rather than to icons"
          : "collapses to something narrower");
  } else if (b.collapses === false) add("collapses", "does not collapse");

  if (b.nests === true) {
    const d = b.nestDepth;
    add("nests", d && d > 2 ? \`nests its menu \${d === 3 ? "three" : num(d)} levels deep\` : "nests its menu two levels deep");
  } else if (b.nests === false) add("nests", "keeps its menu to one level");

  if (b.sheet === true) add("sheet", "comes back as a sheet on a 390 px frame");
  else if (b.sheet === false) add("sheet", "stays put at 390 px instead of becoming a sheet");

  if (b.keyboard === true) add("keyboard", "takes Tab to its own rows");
  else if (b.keyboard === false) add("keyboard", "keeps Tab out of its rows");

  if (b.shape === true) add("shape", "fills the frame as a page");
  else if (b.shape === false) add("shape", "sits in the frame as a component");

  if (!out.length) return null;
  const chosen = out
    .map((c, i) => ({ ...c, i }))
    .sort((x, y) => x.rarity - y.rarity || x.i - y.i)
    .slice(0, 3)
    .map((c) => c.text);
  const day = measuredOn(b);
  return \`Pick this if you want a sidebar that \${AND(chosen)} — measured in this demo\${day ? \` on \${day}\` : ""}.\`;
}
`;export{e as default};