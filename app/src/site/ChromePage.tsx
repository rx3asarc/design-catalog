import { useEffect, useState } from "react";
import manifest from "../../manifest.json";
import { useUsage } from "../provenance";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/registry/new-york-v4/ui/table";

/**
 * The page that says what the interface is made of — and the counts, which are the DOM's own, not ours.
 *
 * The **ids are not in this file**. They are `manifest.json`'s `used_here`, which `app/gen.py:251` computes by
 * grepping `data-catalog-item="…"` out of the shell source: a surface that tags itself appears on this page
 * without anybody editing an array. The sentence beside each row is authored (`WHERE`, below) because a grep
 * cannot write prose; it is optional, and a row without one still renders.
 *
 * A zero is never explained away. `used_here` counts tags in the source; the count column counts what this
 * view mounted. Those are two different measurements, so a 0 is labelled by evidence: `not this view` when the
 * tag has rendered elsewhere in this session, `unseen` when nothing has run it yet (the row is a link, so the
 * reader can settle it), and a genuine contradiction is shown as one — see the drift table, which is where the
 * DOM and the manifest actually disagree.
 *
 * The copy here claims a build check refuses a hand-written control in the shell. `app/check_chrome.py` is
 * that check, and it scans every module in `src/site/` as well as the root ones, so the claim is true.
 */

type M = { id: string; used_here: number };
const MANIFEST = manifest as unknown as M[];
const IN_CATALOGUE = new Map(MANIFEST.map((i) => [i.id, i]));

/** A row's link clears the 44 px tap floor on a phone (`styles.css` sets that floor for the shell's controls). */
const ROW_LINK = "max-[860px]:inline-flex max-[860px]:min-h-11 max-[860px]:items-center";

/** The authored sentence is the column that makes a three-column table 707 px wide on a 390 px screen. */
const PROSE = "max-[860px]:hidden";

/** Authored prose only. Sparse on purpose: an id the catalogue never heard of gets no sentence. */
const WHERE: Record<string, string> = {
  "shadcn/sidebar": "the menu's frame, and the button that reopens it",
  "shadcn/collapsible": "every level of the menu, and each group inside it",
  "shadcn/button": "the phone browse control, the source tabs, the palette's way in",
  "shadcn/badge": "licence and status badges, on every item page",
  "shadcn/input": "the filter box above the menu",
  "shadcn/tabs": "the source-file tab strip, on item pages",
  "shadcn/scroll-area": "the pane a long source file scrolls in, on item pages",
  "shadcn/table": "this listing — the table of everything above it",
  "shadcn/popover": "the provenance tag, while one is showing",
  "shadcn/command": "the Cmd/Ctrl+K palette, while it is open",
  "transitions/page-side-by-side": "the page-change animation, on this element's parent",
  "shadcn/font-instrument-sans": "the typeface of everything you are reading",
  "shadcn/font-jetbrains-mono": "the typeface of every count and label",
};

/**
 * Every id the DOM has carried at any point in this session.
 *
 * `#/chrome` cannot see an item page's `scroll-area` from here, so "0 on this view" and "0 everywhere" are
 * different facts and the page has to be able to tell them apart. This is the only memory the page keeps, and
 * it comes from the same store the tag counts, not from a list.
 */
const everSeen = new Set<string>();

function useEverSeen(counts: Record<string, number>) {
  const [, bump] = useState(0);
  useEffect(() => {
    let grew = false;
    for (const id of Object.keys(counts)) {
      if (!everSeen.has(id)) { everSeen.add(id); grew = true; }
    }
    if (grew) bump((n) => n + 1);
  }, [counts]);
}

type State = "live" | "elsewhere" | "unseen";

/** One row of the main table: a catalogue item the manifest says the shell uses, plus what the DOM says now. */
type Row = { id: string; where: string | null; count: number; state: State };

function classify(id: string, counts: Record<string, number>): Row {
  const count = counts[id] ?? 0;
  return {
    id,
    where: WHERE[id] ?? null,
    count,
    state: count > 0 ? "live" : everSeen.has(id) ? "elsewhere" : "unseen",
  };
}

function StateTag({ state }: { state: State }) {
  if (state === "live") return null;
  if (state === "elsewhere") {
    return (
      <Badge variant="outline" className="ml-2 text-[10px] font-normal text-muted-foreground"
        title="the tag renders — just not on the page you are looking at">
        not this view
      </Badge>
    );
  }
  // not a verdict, a statement: nobody has looked yet. The row is a link precisely so the reader can settle it.
  return (
    <Badge variant="outline" className="ml-2 text-[10px] font-normal text-muted-foreground"
      title="no view in this session has mounted it yet — open this row's page to find out whether the tag is real">
      unseen
    </Badge>
  );
}

export function ChromePage() {
  // counted, not narrated: the same live count the provenance tag reads, so the two always agree
  const seen = useUsage();
  useEverSeen(seen);

  const used = MANIFEST.filter((i) => i.used_here > 0)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const rows = used.map((i) => classify(i.id, seen));

  // the other direction of drift: the DOM is running something the manifest still calls unused, or the shell
  // tags an id the catalogue has never heard of. Both are real, and both are the page's business.
  const tagged = Object.keys(seen).sort();
  const drift = tagged.filter((id) => IN_CATALOGUE.has(id) && (IN_CATALOGUE.get(id)!.used_here ?? 0) === 0);
  const unknown = tagged.filter((id) => !IN_CATALOGUE.has(id));
  const unseen = rows.filter((r) => r.state === "unseen");

  return (
    <div className="page-in">
      <div className="crumb">this site · built from the catalogue</div>
      <h2 className="title">Components used to build this site</h2>
      <p className="lede">
        Everything you are looking at, the shop and the shelves, is one of these. Each row is a catalogue item
        and the count is how many of it this page is running on right now, counted from the page itself. Point at
        any of them — a badge, the filter box, a level of the menu — and the page names it.
      </p>

      <p className="hint">
        The rows are not a list somebody keeps: they are the manifest's own <code>used_here</code>, grepped out
        of every <code>data-catalog-item</code> in the shell's source at build time ({used.length} of{" "}
        {MANIFEST.length} items). Tag a surface and it appears here; delete the tag and it leaves.
      </p>

      <Table data-catalog-item="shadcn/table">
        <TableHeader>
          <TableRow>
            <TableHead>component</TableHead>
            <TableHead className={PROSE}>where</TableHead>
            <TableHead className="text-right">on this page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-catalog-item="shadcn/table-row">
              <TableCell><a className={ROW_LINK} href={`#/i/${r.id}`}>{r.id}</a></TableCell>
              <TableCell className={`${PROSE} text-muted-foreground`}>
                {r.where ?? <span className="italic">no sentence yet</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.count}
                <StateTag state={r.state} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="hint">
        A zero in that column is labelled, not excused. <b>not this view</b> means the tag appears somewhere
        else in this session and this page simply does not mount it. <b>unseen</b> means no view this session
        has run it yet — click the row to open its page, come back, and the label settles into one of the other
        two. A row that stays <b>unseen</b> after that is a bug in the tagging, and this page cannot check that
        for you from here: {" "}
        {unseen.length === 0 ? "every row has been seen somewhere this session"
          : `${unseen.length} ${unseen.length === 1 ? "row" : "rows"} above ${
            unseen.length === 1 ? "is" : "are"} still unchecked`}.
      </p>

      <h3 className="section-h">Where the DOM and the manifest disagree</h3>
      <p className="hint">
        The manifest&apos;s <code>used_here</code> is a build artifact: a tag added after the last build counts
        in the DOM before it counts here. That gap is shown rather than smoothed, because a page that rounds it
        away is a page that cannot tell you when its own data is stale.
      </p>
      <Table data-catalog-item="shadcn/table">
        <TableHeader>
          <TableRow>
            <TableHead>tag in the DOM</TableHead>
            <TableHead className={PROSE}>where</TableHead>
            <TableHead className="text-right">mounted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drift.length === 0 && unknown.length === 0 ? (
            <TableRow data-catalog-item="shadcn/table-row">
              <TableCell className="text-muted-foreground">nothing</TableCell>
              <TableCell className="text-muted-foreground">
                every tag in the DOM is already counted by the manifest
              </TableCell>
              <TableCell className="text-right tabular-nums">0</TableCell>
            </TableRow>
          ) : null}
          {drift.map((id) => (
            <TableRow key={id} data-catalog-item="shadcn/table-row">
              <TableCell><a className={ROW_LINK} href={`#/i/${id}`}>{id}</a></TableCell>
              <TableCell className={`${PROSE} text-muted-foreground`}>
                {WHERE[id] ?? <span className="italic">no sentence yet</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{seen[id]}</TableCell>
            </TableRow>
          ))}
          {unknown.map((id) => (
            <TableRow key={id} data-catalog-item="shadcn/table-row">
              <TableCell><code className={ROW_LINK}>{id}</code></TableCell>
              <TableCell className={`${PROSE} text-muted-foreground`}>
                not a catalogue id — the tag names nothing, so no page can open it
              </TableCell>
              <TableCell className="text-right tabular-nums">{seen[id]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="hint">
        <code>python3 app/gen.py</code> rebuilds the manifest and moves these rows into the table above. Until
        then the DOM is the truth and the manifest is one build behind — which is exactly what this section is
        for.
      </p>
    </div>
  );
}
