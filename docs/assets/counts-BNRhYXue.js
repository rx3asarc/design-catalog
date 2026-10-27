var e=`import { items, type Item } from "./lib";

/**
 * Every number the copy is allowed to say, computed from the manifest and nowhere typed by hand.
 *
 * Two surfaces read this module — the front page and the About page — so the same count cannot drift between
 * them, and a manifest built from a newer catalogue moves both at once. It is a plain module, not a hook: the
 * manifest is imported once and never reloaded.
 *
 * The two counts that are easy to conflate are kept apart here, because the copy has to keep them apart too:
 * \`licenceFull\` is a **licence label** (this item's licence would permit publishing its source) while
 * \`published\` and \`withFile\` are **file counts** (the file was captured; the item page shows it).
 */

const hasFile = (i: Item) => (i.files ?? []).length > 0;
const runs = (i: Item) => i.variants.length > 0;
const held = (i: Item) => i.withheld === true;

/**
 * The one licence string that permits republication. Every item under a \`full\` code policy says exactly this;
 * the other three strings belong to the local-only sources — a no-redistribution clause, an unasserted
 * licence, and no published terms at all.
 */
export const FULL_LICENCE = "MIT";

export type SourceRow = {
  name: string;
  /** Items ingested from this source. */
  items: number;
  /** Items whose source file was captured at ingest, published or not. */
  withFile: number;
  /** Items whose file this site actually shows — captured and not withheld. */
  published: number;
  /** Items whose source is captured locally but not republished. */
  withheld: number;
  /** The licence strings the manifest carries for this source, as it spells them. */
  licences: string[];
};

function bySource(): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  for (const i of items) {
    const row = rows.get(i.source) ??
      { name: i.source, items: 0, withFile: 0, published: 0, withheld: 0, licences: [] };
    row.items += 1;
    if (hasFile(i)) row.withFile += 1;
    if (held(i)) row.withheld += 1;
    else if (hasFile(i)) row.published += 1;
    if (!row.licences.includes(i.licence)) row.licences.push(i.licence);
    rows.set(i.source, row);
  }
  return [...rows.values()].sort((a, b) => b.items - a.items);
}

export const counts = {
  total: items.length,
  sources: bySource(),
  /** Items with at least one captured source file. */
  withFile: items.filter(hasFile).length,
  /** Items whose source file the item page shows. */
  published: items.filter((i) => hasFile(i) && !held(i)).length,
  /** Captured but not republished — the licence does not allow it. */
  heldFiles: items.filter((i) => hasFile(i) && held(i)).length,
  /** Items with no captured source file at all. */
  noFile: items.filter((i) => !hasFile(i)).length,
  /** Items that run here as a live demo. */
  demos: items.filter(runs).length,
  noDemo: items.filter((i) => !runs(i)).length,
  /** Items whose source is not republished. */
  withheld: items.filter(held).length,
  /** Items covered by a licence that would allow publication. */
  licenceFull: items.filter((i) => i.licence === FULL_LICENCE).length,
  /** … of those, the ones with no captured file: a licence label is not a file. */
  licenceFullNoFile: items.filter((i) => i.licence === FULL_LICENCE && !hasFile(i)).length,
};
`;export{e as default};