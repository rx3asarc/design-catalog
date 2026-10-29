var e=`import type { HTMLAttributes } from "react";
import { Table, TableBody, TableRow, TableCell, TableHead } from "@/registry/new-york-v4/ui/table";

/**
 * The design system's \`ApiTable\`, used for the two-column "field: value" block an item page carries.
 *
 * > "Header row on \`surface-200\`, \`ink-subtle\`, 12px. Rows are separated by hairline \`border\` only."
 *
 * The item page's version has no header row and no zebra: it is a description list of what the manifest knows
 * about one item, so a table head would add a second vocabulary ("Prop / Type / Default") that the data does not
 * have. The left cell is a row header (\`<th scope="row">\`) in the \`label\` step (\`ink-subtle\`), the right cell is
 * the value in \`ink\` — the two steps the brief names. Values stay mono because they are numbers, counts and
 * licence strings, and mono is what the design book gives counts and code.
 *
 * \`null\` is a fact of its own and never a zero: a field the manifest did not measure prints "not measured" in
 * \`ink-muted\` with a \`title\` that says why, which is the same rule \`site/behaviour.ts\` holds for the comparison
 * page. The registry's own \`Table\` is the element, because a raw \`<table>\` is exactly what
 * \`app/check_chrome.py\` exists to catch.
 */

export type Fact = {
  /** The field's name, in the data's own words: "Files", "Size", "Dependencies". */
  label: string;
  /** What is printed. Never a dash: a dash reads as "none". */
  value: string;
  /** The witness behind the value, for \`title\` — the full licence string, or why a fact is unmeasured. */
  title?: string;
  /** True when the manifest carries no number: the cell prints "not measured" and reads muted, not absent. */
  unmeasured?: boolean;
};

export function ApiTable({ rows, ...rest }: { rows: Fact[] } & HTMLAttributes<HTMLDivElement>) {
  if (!rows.length) return null;
  return (
    <div className="facts" {...rest}>
      <Table data-catalog-item="shadcn/table">
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableHead scope="row" className="fact-label">{r.label}</TableHead>
              <TableCell
                className="fact-value"
                data-unmeasured={r.unmeasured ? "" : undefined}
                title={r.title}
              >
                {r.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
`;export{e as default};