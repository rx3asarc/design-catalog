import { label } from "./lib";
import { faceted, type Faceted } from "./Tile";
import { TYPE_BY_KEY } from "./taxonomy";

/**
 * ONE COMPARISON, AS THE TABLE IT IS.
 *
 * The review found the old front page's comparison strip and asked for the opposite: not a wall of twenty set
 * names, but one showcase — "a preview of the sidebar comparison: the table's shape, a few real rows from `TYPES`
 * (Components/Sidebar), a link to it".
 *
 * So this is the sidebar table, at four rows. The members are `TYPE_BY_KEY.get("Components/Sidebar").members`,
 * which is the taxonomy's own membership — the same seven the collection page reads. The four shown are the ones
 * that run here, in the order the file has them; the other three are reference-only, and the header says so in one
 * clause rather than inventing a row with blanks in it.
 *
 * The columns are the manifest's, not the behaviour probe's: the full comparison's columns are measured behaviour
 * (`site/behaviour.ts`), and that payload is fetched once by the comparison page itself (`useDetail`). The front
 * page does not fetch it — it draws the *shape* of the table, with facts every visitor can check on the row, and
 * the link goes to the page where the measured columns are.
 */

const SIDEBAR = TYPE_BY_KEY.get("Components/Sidebar") ?? null;

/** The rows: the members that run, in the file's order, then reference-only ones if the set is short. */
const ROWS = (SIDEBAR?.members ?? [])
  .slice()
  .sort((a, b) => Number(!!b.has_demo) - Number(!!a.has_demo))
  .slice(0, 4);

const files = (i: Faceted) => (typeof i.file_count === "number" ? `${i.file_count}` : "—");
const parts = (i: Faceted) => {
  const c = i.composition?.count;
  return typeof c === "number" && c > 0 ? `${i.composition?.lower_bound ? "≥" : ""}${c}` : "—";
};

export function CompareShowcase() {
  if (!SIDEBAR || ROWS.length < 2) return null;
  const total = SIDEBAR.members.length;
  const libraries = new Set(SIDEBAR.members.map((i) => i.source)).size;
  const runs = SIDEBAR.members.filter((i) => i.has_demo).length;
  return (
    <section className="showcase" data-compare-showcase={SIDEBAR.key} aria-labelledby="showcase-h">
      <h2 className="section-h" id="showcase-h">Side by side</h2>
      <p className="home-sub">
        {total} sidebars from {libraries} libraries, in one table. The full page adds what each demo does when it is
        driven — pressed, opened, resized — measured in a browser rather than claimed here.
      </p>
      <div className="showcase-scroll">
        <table className="cmp-preview">
          <caption className="cmp-caption">
            {SIDEBAR.type} · {ROWS.length} of {total} members shown, {runs} of them with a live demo
          </caption>
          <thead>
            <tr>
              <th scope="col">item</th>
              <th scope="col" className="opt">library</th>
              <th scope="col" className="opt">licence</th>
              <th scope="col" className="num opt">files</th>
              <th scope="col" className="num">parts</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((item) => {
              const f = faceted(item);
              return (
                <tr key={item.id} data-cmp-row={item.id}>
                  <th scope="row">
                    <a href={`#/i/${item.id}`}>{label(item)}</a>
                  </th>
                  <td className="mono opt">{item.source}</td>
                  <td className="mono opt">{item.licence}</td>
                  <td className="num opt">{files(f)}</td>
                  <td className="num">{parts(f)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="showcase-foot">
        <a className="home-ctl" href="#/c/sidebar" data-compare-open="">
          Open the comparison
        </a>
      </p>
    </section>
  );
}
