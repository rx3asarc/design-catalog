var e=`import { useEffect, useMemo, useState } from "react";
import { Input } from "@/registry/new-york-v4/ui/input";
import { items } from "./lib";
import { TYPES } from "./taxonomy";
import { typeHref } from "./typeIndex";
import { searchAll, type Result } from "./CommandPalette";

/**
 * \`#/s?q=<query>\` — the whole ranked result list, at an address.
 *
 * The round-5 review's third search complaint was that results stopped at "20 of 40" with no way to see more.
 * The palette is a glance: twenty rows, capped, because it is drawn over the page you were reading. This is the
 * rest of that ranking with no cap and its own address — the palette's "See all N results" lands here, and a
 * reader can keep the link, share it, and press Back from it.
 *
 * Three rules, and they are the same three the palette keeps, because it is the same ranking (\`searchAll\`):
 *
 *  * **a folded variant is not a row.** \`button-icon\` arrives as \`Button\`, with the count of the demos that page
 *    carries; the row opens the parent, where those variants are the demos. The row also says which variant
 *    brought it in (\`matched button-icon\`), because otherwise typing a variant and being shown its parent looks
 *    like a miss.
 *  * **a type page is a result.** Type rows carry their section and their two counts, and open \`#/t/…\`.
 *  * **the marker means one thing.** A green dot and the word "demo" mark a result whose demo runs in this
 *    catalogue; everything else prints "no demo". A type row carries no marker — a collection is not a demo.
 *
 * The query is held in the field *and* in the address. Typing rewrites the address with \`replaceState\`: no new
 * history entry per keystroke, no \`hashchange\` (which would scroll the page back to the top under the reader's
 * hands — \`useScrollReset\` in the shell resets on every route change, and a keystroke is not a route change), and
 * a reload or a copied address still carries what was typed.
 */
export function SearchPage({ q }: { q: string }) {
  const [text, setText] = useState(q);
  // a link from the palette (or an address typed by hand) replaces the query in the field
  useEffect(() => setText(q), [q]);
  const { results } = useMemo(() => searchAll(text), [text]);
  const typed = text.trim().length > 0;
  const typeRows = results.filter((r) => r.kind === "type").length;
  const itemRows = results.length - typeRows;

  useEffect(() => {
    const want = text.trim() ? \`#/s?q=\${encodeURIComponent(text.trim())}\` : "#/s";
    if (location.hash === want) return;
    try { history.replaceState(history.state, "", location.pathname + location.search + want); } catch { /* a sandboxed context: the field still works */ }
  }, [text]);

  return (
    <div className="page-in search-page">
      <div className="crumb">search</div>
      <h1 className="title">Search</h1>
      <p className="lede">
        {items.length} items and {TYPES.length} type pages in this catalogue. One box, ranked in this browser:
        an exact type name first, then names that start with it, then names that contain it, then sources,
        categories and concepts.
      </p>

      <div className="search-form">
        <label className="search-label" htmlFor="catalog-search-field">Search the catalogue</label>
        <Input
          id="catalog-search-field"
          type="search"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
          placeholder="name, type, source, category…"
          autoComplete="off"
          spellCheck={false}
          className="search-input"
        />
      </div>

      {typed ? (
        <p className="search-counts" data-search-counts="" data-search-total={results.length} data-search-types={typeRows} data-search-items={itemRows}>
          <strong>{results.length}</strong> {results.length === 1 ? "result" : "results"} for “{text.trim()}” —{" "}
          {typeRows} type{typeRows === 1 ? "" : "s"}, {itemRows} item{itemRows === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="search-counts" data-search-blank="">
          Nothing typed yet. The address carries the query — <code>#/s?q=sidebar</code> — so a search can be
          kept, shared and gone Back from.
        </p>
      )}

      <p className="search-legend">
        <span className="search-demo" data-demo="yes">
          <span className="search-demo-dot" aria-hidden="true" />
          demo
        </span>{" "}
        means a demo runs in this catalogue; <strong>no demo</strong> is a reference-only entry. A folded variant
        is a demo on its parent's page, so it is not a row here: it is counted on its parent's.
      </p>

      {typed && results.length ? (
        <ul className="search-results" data-search-results="">
          {results.map((r) => <Row key={r.kind === "type" ? \`type:\${r.entry.key}\` : \`item:\${r.item.id}\`} r={r} />)}
        </ul>
      ) : null}

      {typed && !results.length ? (
        <p className="search-empty" role="status">
          Nothing in {items.length} items or {TYPES.length} type pages matches “{text.trim()}” — not a name, a
          slug, a source, a category, a concept or a type.
        </p>
      ) : null}
    </div>
  );
}

/** One result. A link row: the palette selects, this page points, and every row clears 44 px. */
function Row({ r }: { r: Result }) {
  if (r.kind === "type") {
    return (
      <li className="search-row" data-search-row="type" data-search-key={r.entry.key}>
        <a className="search-row-link" href={typeHref(r.entry)}>
          <span className="search-row-name">{r.name}</span>
          <span className="search-row-meta">
            {r.section} · {r.members} {r.members === 1 ? "item" : "items"} · {r.variants}{" "}
            {r.variants === 1 ? "variant" : "variants"}
          </span>
        </a>
      </li>
    );
  }
  return (
    <li className="search-row" data-search-row="item" data-search-key={r.item.id} data-search-demo={r.demo ? "yes" : "no"}>
      <a className="search-row-link" href={\`#/i/\${r.item.id}\`}>
        <span className="search-row-name">{r.name}</span>
        <span className="search-row-meta">
          {r.item.source} · {r.item.kind}
          {r.variants > 0 ? \` · \${r.variants} \${r.variants === 1 ? "variant" : "variants"}\` : ""}
        </span>
        {r.matched ? (
          <span className="search-row-matched">matched “{r.matched}”, a demo on this page</span>
        ) : null}
        <span className="search-demo" data-demo={r.demo ? "yes" : "no"}>
          {r.demo ? <span className="search-demo-dot" aria-hidden="true" /> : null}
          {r.demo ? "demo" : "no demo"}
        </span>
      </a>
    </li>
  );
}
`;export{e as default};