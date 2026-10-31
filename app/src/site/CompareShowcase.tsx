import { Table } from "@/registry/new-york-v4/ui/table";
import { label, type Item } from "./lib";
import { TYPE_BY_KEY } from "./taxonomy";
import { typeHref } from "./typeIndex";
import { BEHAVIOUR_COLS, behaviourOf, hasFacts, measuredOn, type Measured } from "./behaviour";
import probe from "../../behaviour.json";

/**
 * ONE COMPARISON, AS THE TABLE IT IS — the columns a person choosing a sidebar actually needs.
 *
 * The review of the round-4 front page asked for a showcase instead of the twenty-name strip. What it got was a
 * table of library, licence, files and parts — four facts that are the same shape on every item and answer none of
 * the questions a sidebar raises: does it get out of the way, does it nest, what happens on a phone. The review's
 * second pass said exactly that: "The comparison preview shows the boring columns."
 *
 * So the three columns here are the *measured* ones — `collapses`, `nests`, `at 390 px` — and they are the compare
 * page's own columns, read from the compare page's own module (`site/behaviour.ts`), so the front page and the full
 * table cannot drift into two vocabularies for one fact. Each cell's `title` is the column's own witness
 * (`collapses === true` → "the demo declares data-collapsible=…, width 256 → 64 px, after pressing …"), so the
 * sentence behind a word is the measurement, not a restatement of it.
 *
 * WHERE THE NUMBERS COME FROM, AND WHAT IT COSTS. They are `app/behaviour.json` — the probe's own output, 113
 * records, measured in a browser on 31 October 2026 and dated on the table. It is imported as a module rather than
 * fetched like the item page's detail payload, because the front page needs four records and not 769, and the file
 * is 6.2 KB gzipped; the detail payload is 40 KB. (The build's chunk sizes are in `build/r9-home.md` §3.)
 *
 * ROWS. Only members the probe could answer something about are rows: of the seven sidebars, three have a record
 * whose six facts are all `null` — a probe that could not tell, which is not a "no" — and a row of three
 * "not measured" cells beside three measured ones is not a comparison. The caption states both numbers, and the
 * clause after it says what happened to the others.
 */

type Probe = { items: Record<string, Measured>; probed_at?: string };
const RECORDS: Record<string, Measured> = (probe as unknown as Probe).items;

const SIDEBAR = TYPE_BY_KEY.get("Components/Sidebar") ?? null;

/** An item with the probe's record attached, in the shape `site/behaviour.ts` reads. */
const withFacts = (i: Item): Item => ({ ...i, behaviour: RECORDS[i.id] } as Item);

/** The three columns worth a front-page row, by the compare page's own keys. */
const COLUMNS = ["collapses", "nests", "sheet"] as const;
const COLS = COLUMNS
  .map((k) => BEHAVIOUR_COLS.find((c) => c.key === k))
  .filter((c): c is (typeof BEHAVIOUR_COLS)[number] => !!c);

/** The members the probe answered something about, in the taxonomy's own order. */
const ANSWERED = (SIDEBAR?.members ?? []).filter((i) => hasFacts(withFacts(i)));

export function CompareShowcase() {
  if (!SIDEBAR || ANSWERED.length < 2) return null;
  const total = SIDEBAR.members.length;
  const rows = ANSWERED.slice(0, 4);
  const unmeasured = total - ANSWERED.length;
  const runs = rows.filter((i) => i.has_demo).length;
  // one date for the table: it is a fact about the probe run, not about each member (the compare page's rule)
  const day = measuredOn(behaviourOf(withFacts(rows[0])));
  return (
    <section className="showcase" data-compare-showcase={SIDEBAR.key} aria-labelledby="showcase-h">
      <h2 className="section-h" id="showcase-h">Side by side</h2>
      <p className="home-sub">
        {total} sidebars from {new Set(SIDEBAR.members.map((i) => i.source)).size} libraries. Three things are
        measured in a browser rather than claimed here: whether it collapses, how deep its menu nests, and what it
        does at 390 px.
      </p>
      <div className="showcase-scroll">
        <Table className="cmp-preview">
          <caption className="cmp-caption">
            {SIDEBAR.type} · {rows.length} of {total} members
            {unmeasured ? `, the ${unmeasured} the probe could not measure left out` : ""}
            {` · ${runs} with a live demo${day ? ` · measured ${day}` : ""}`}
          </caption>
          <thead>
            <tr>
              <th scope="col">item</th>
              {COLS.map((c) => (
                <th scope="col" key={c.key}>{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const full = withFacts(item);
              return (
                <tr key={item.id} data-cmp-row={item.id}>
                  <th scope="row">
                    <a href={`#/i/${item.id}`}>{label(item)}</a>
                  </th>
                  {COLS.map((c) => (
                    <td key={c.key} data-cmp-col={c.key} title={c.exact(full)} className="cmp-fact">
                      {c.text(full)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      <p className="showcase-foot">
        <a className="home-ctl" href={typeHref(SIDEBAR)} data-compare-open="">
          All {total} sidebars side by side
        </a>
      </p>
    </section>
  );
}
