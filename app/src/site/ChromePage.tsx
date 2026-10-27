import { useUsage } from "../provenance";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/registry/new-york-v4/ui/table";

/**
 * The page that says what the interface is made of — and the counts, which are the DOM's own, not ours.
 *
 * The copy here claims a build check refuses a hand-written control in the shell. `app/check_chrome.py` is
 * that check, and since this unit it scans every module in `src/site/` as well as the four root ones, so the
 * claim is true rather than aspirational.
 */

export const CHROME: { id: string; where: string }[] = [
  { id: "shadcn/sidebar", where: "the rail frame and the trigger that reopens it" },
  { id: "shadcn/collapsible", where: "every level of the rail, and each family inside it" },
  { id: "shadcn/button", where: "View code, Fit, the phone browse control, the manager tabs" },
  { id: "shadcn/badge", where: "licence and status badges, on every item page" },
  { id: "shadcn/input", where: "the filter box above the rail" },
  { id: "shadcn/tabs", where: "the source-file tab strip, on item pages" },
  { id: "shadcn/scroll-area", where: "the pane a long source file scrolls in, on item pages" },
  { id: "shadcn/table", where: "this listing — the table of everything above it" },
  { id: "shadcn/popover", where: "the provenance tag, while one is showing" },
];

export function ChromePage() {
  // counted, not narrated: the same live count the provenance tag reads, so the two always agree
  const seen = useUsage();
  return (
    <div className="page-in">
      <div className="crumb">this site · built from the catalogue</div>
      <h2 className="title">Chrome</h2>
      <p className="lede">
        Everything you are looking at, the shop and the shelves, is one of these. Each row is a catalogue item
        and the count is how many of it this page is running on right now, counted from the page itself. Point at
        any of them — a badge, the filter box, a level of the rail — and the page names it.
      </p>
      <Table data-catalog-item="shadcn/table">
        <TableHeader>
          <TableRow>
            <TableHead>component</TableHead>
            <TableHead>where</TableHead>
            <TableHead className="text-right">on this page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CHROME.map((c) => (
            <TableRow key={c.id} data-catalog-item="shadcn/table-row">
              <TableCell><a href={`#/i/${c.id}`}>{c.id}</a></TableCell>
              <TableCell className="text-muted-foreground">{c.where}</TableCell>
              <TableCell className="text-right tabular-nums">{seen[c.id] ?? 0}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="hint">
        A build check refuses to publish if any hand-written button, input, table or disclosure reappears in
        the shell, so this list cannot quietly go stale. A zero means it is not on the page you are looking at
        but on the pages named beside it — the tag is the one honest zero, since it is only mounted while it is
        showing, and pointing at this row will turn it to a one.
      </p>
    </div>
  );
}
