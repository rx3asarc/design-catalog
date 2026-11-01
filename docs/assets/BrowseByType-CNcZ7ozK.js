var e=`import { SECTION_ORDER, itemsLabel, TYPES, variantCount, type SectionName, type TypeEntry } from "./taxonomy";
import { typeHref } from "./typeIndex";

/**
 * "BROWSE BY TYPE" — the catalogue's own way in.
 *
 * The review's third item was that there was no way in at all: "The only way into the gallery is a link inside a
 * sentence, and nothing leads to collections." This is the answer, and it is not a new taxonomy — \`taxonomy.json\`
 * is 89 types in 7 sections, reviewed and gated (\`qa/taxonomy_check.mjs\`), and this grid is that file drawn: one
 * card per type, grouped by section, A–Z inside each. Nothing is invented, nothing is ranked, and no card carries
 * a number that is not the type's own count — and that count is spelled \`N items · M variants\`, because the
 * variants the taxonomy folds into a type's members are catalogue content: "Pie and donut · 1 item" was a card
 * about twelve things (review, §8).
 *
 * Every card is a control that opens the type's own page — \`#/t/<section-slug>/<type-slug>\` — and that address is
 * not spelled here: \`typeHref\` comes from \`site/typeIndex.ts\`, which the rail and the type page also use, so a card,
 * a rail row and a hand-typed URL cannot come to disagree about which page they mean. (This file carried its own
 * two-line copy while the two units were in flight; it was deleted on merge, as both reports asked.)
 */

/** The types of one section, A–Z — the order \`taxonomy.ts\` builds \`TYPES\` in. */
const bySection = new Map<SectionName, TypeEntry[]>(SECTION_ORDER.map((s) => [s, TYPES.filter((t) => t.section === s)]));

export function BrowseByType() {
  return (
    <section className="browse" data-browse-by-type="" aria-labelledby="browse-h">
      <h2 className="section-h" id="browse-h">Browse by type</h2>
      <p className="home-sub">
        {TYPES.length} types in {SECTION_ORDER.length} sections. Every item in the catalogue is filed under exactly
        one of them, and each opens the page where its members are compared.
      </p>
      {SECTION_ORDER.map((section) => {
        const types = bySection.get(section) ?? [];
        const members = types.reduce((n, t) => n + t.members.length, 0);
        const variants = types.reduce((n, t) => n + variantCount(t), 0);
        return (
          <div className="browse-sec" key={section} data-type-section={section}>
            <div className="browse-sec-h">
              <span className="browse-sec-name">{section}</span>
              <span className="browse-sec-n">
                {types.length} type{types.length === 1 ? "" : "s"} · {itemsLabel(members, variants)}
              </span>
            </div>
            <ul className="browse-grid">
              {types.map((t) => (
                <li key={t.key}>
                  {/* one card, one control: the name and the member count, and nothing that is not in the file */}
                  <a className="type-card" data-type-card="" href={typeHref(t)}>
                    <span className="type-card-name">{t.type}</span>
                    <span className="type-card-n" data-type-card-count={t.key}>
                      {itemsLabel(t.members.length, variantCount(t))}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
`;export{e as default};