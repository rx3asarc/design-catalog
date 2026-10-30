import raw from "./taxonomy.json";
import { items, type Item } from "./lib";

/**
 * THE TAXONOMY — a written list, not a rule over names.
 *
 * Round 4's review was blunt about what the site had before this file: "groups are made by cutting item names into
 * words and adding an s". That produced `Natives`, `Hovers`, `Sonners`, `Empties`, `Otps`, `Kbds`, `Aspects`,
 * `Loadings`, `Streamings`, `Codes`; sixteen groups named `01` … `16` for shadcn's sidebar demos; 25 fonts filed
 * under "Actions and controls"; and FAQ, Card Folder and Project Folder under "Charts and data". About 990 rows.
 *
 * Three things are true of this file and were not true of the generator:
 *
 * 1. **Two levels.** Seven sections (`SECTIONS` below), and inside each, component types sorted A–Z. Nothing else.
 * 2. **Types, not items.** 89 entries for 769 items. An entry is a *type* — Button, Dialog, Sidebar — and its page
 *    is the collection where the type's members are compared.
 * 3. **Variants fold into their parent.** `button-ghost` is not an entry; it is a demo on Button's page, and
 *    `sidebar-01` … `sidebar-16` are sixteen demos on Sidebar's. 320 of the 769 items are variants — 42% of the
 *    catalogue that used to be listed as if it were 320 separate components.
 *
 * The file is generated once by a rule, then **reviewed and corrected by hand** (see the `OVER` table in
 * `scripts/taxonomy.py`, which is where the review's named cases — fonts, themes, FAQ, the two folders, the code
 * helpers, `ai-sidebar` — are pinned). It is checked in, and `qa/taxonomy_check.mjs` fails if it ever stops
 * covering exactly the catalogue: every item either a member of exactly one type or a variant of exactly one
 * parent, and no type named after a plural somebody invented.
 */

export type SectionName = "Components" | "Blocks" | "Charts" | "Agent UI" | "Effects" | "Foundations" | "Docs";

/** The order the rail prints, which is the order the book's own page lists its parts. */
export const SECTION_ORDER: SectionName[] = [
  "Components", "Blocks", "Charts", "Agent UI", "Effects", "Foundations", "Docs",
];

type Raw = { sections: Record<string, Record<string, string[]>>; variants: Record<string, string[]> };
const data = raw as unknown as Raw;

/** `source/slug`, the key every surface already has: `items[i].id` is this string. */
export const idOf = (i: Item) => `${i.source}/${i.slug}`;

const memberOf = new Map<string, { section: SectionName; type: string }>();
for (const section of SECTION_ORDER) {
  const types = data.sections[section] ?? {};
  for (const type of Object.keys(types)) for (const id of types[type]) memberOf.set(id, { section, type });
}

const parentOfVariant = new Map<string, string>();
for (const parent of Object.keys(data.variants)) for (const v of data.variants[parent]) parentOfVariant.set(v, parent);

export type TypeEntry = {
  section: SectionName;
  /** the type's name, as the collection page prints it */
  type: string;
  /** `type` addressed globally: `Components/Button` — the route and the cross-links use this */
  key: string;
  members: Item[];
  variants: Item[];
};

const byId = new Map(items.map((i) => [idOf(i), i]));

function entry(section: SectionName, type: string): TypeEntry {
  const ids = data.sections[section]?.[type] ?? [];
  const members = ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  const variants = members.flatMap((m) => (data.variants[idOf(m)] ?? []).map((v) => byId.get(v)).filter((i): i is Item => !!i));
  return { section, type, key: `${section}/${type}`, members, variants };
}

/** Every type, section by section, A–Z inside each section. The rail, the front page and the collections read this. */
export const TYPES: TypeEntry[] = SECTION_ORDER.flatMap((section) =>
  Object.keys(data.sections[section] ?? {}).sort((a, b) => a.localeCompare(b)).map((type) => entry(section, type)),
);

export const TYPE_BY_KEY = new Map(TYPES.map((t) => [t.key, t]));

/** Which type an item belongs to, or `null` for a variant and for anything the file does not name. */
export function typeOfItem(i: Item): TypeEntry | null {
  const at = memberOf.get(idOf(i));
  return at ? TYPE_BY_KEY.get(`${at.section}/${at.type}`) ?? null : null;
}

/** The item a variant folds into — `sidebar-01` → Sidebar — or `null` for a member. */
export function parentOf(i: Item): Item | null {
  const p = parentOfVariant.get(idOf(i));
  return p ? byId.get(p) ?? null : null;
}

export const isVariant = (i: Item) => parentOfVariant.has(idOf(i));

/** The variants of a member, as items: what an item page shows as extra demos and what no list shows as entries. */
export function variantsOf(i: Item): Item[] {
  return (data.variants[idOf(i)] ?? []).map((v) => byId.get(v)).filter((x): x is Item => !!x);
}

/** The 449 items that are entries in their own right — everything except the 320 folded variants. */
export const entries = items.filter((i) => memberOf.has(idOf(i)));

/** Counts for the front page and the rail's labels, all derived, never written down twice. */
export const typeCount = (key: string) => TYPE_BY_KEY.get(key)?.members.length ?? 0;
export const sectionOf = (key: string) => TYPE_BY_KEY.get(key)?.section ?? null;
