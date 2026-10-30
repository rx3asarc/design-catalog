import { SECTION_ORDER, TYPES, type SectionName, type TypeEntry } from "./taxonomy";

/**
 * THE TYPE ROUTES — `#/t/<section-slug>/<type-slug>`, one address per entry in the taxonomy.
 *
 * The taxonomy (`site/taxonomy.json` + `site/taxonomy.ts`) is a written list of 89 types: seven sections, A–Z
 * inside each. This module is the one place that turns a name into an address and back, so a link the rail
 * prints, a link the type page prints and a hand-typed URL cannot disagree about which page they mean.
 *
 * Two rules, both of them about not inventing anything:
 *
 * 1. **The slugs are derived from the taxonomy, never written down.** `Components/Button` is
 *    `#/t/components/button` because `slug()` is applied to the section's own name and the type's own name at
 *    lookup time. Add a type to the taxonomy and its route exists; there is no second list to keep in step.
 *    `qa/taxonomy_check.mjs` already gates the taxonomy; `qa/type_page_check.mjs` gates that every entry in it
 *    resolves to a page.
 *
 * 2. **A miss is a miss.** An address whose pair is not in the map resolves to `null` and `site/route.ts` calls
 *    that a not-found page. A route that silently fell back to a nearby type would be a page claiming to be
 *    something it is not.
 *
 * The slugs fold case and every non-alphanumeric run to a single hyphen (`Agent UI` → `agent-ui`,
 * `Chat and messages` → `chat-and-messages`), which is exactly the shape the rail links to.
 */

/** A name as an address token: lowercase, runs of anything that is not a letter or a digit become one hyphen. */
export const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const sectionSlug = (section: SectionName) => slug(section);

/** `components/button` — the pair, without the `#/t/` in front. */
export const typeRoute = (section: SectionName, type: string) => `${slug(section)}/${slug(type)}`;

/** Every type by its route pair. 89 today, each one unique (`type_page_check` fails on a collision). */
export const TYPE_BY_ROUTE = new Map(TYPES.map((e) => [typeRoute(e.section, e.type), e]));

/** The one spelling of a type's address, so a link and a redirect cannot drift apart. */
export const typeHref = (e: TypeEntry) => `#/t/${typeRoute(e.section, e.type)}`;

/** The entry an address pair names, or `null` — never a nearest guess. */
export function typeAt(section: string, type: string): TypeEntry | null {
  return TYPE_BY_ROUTE.get(`${slug(section)}/${slug(type)}`) ?? null;
}

/** The section a slug names, or `null` when nothing in the taxonomy is called that. */
export function sectionAt(s: string): SectionName | null {
  return SECTION_ORDER.find((name) => slug(name) === slug(s)) ?? null;
}

/** Every type in one section, in the taxonomy's own order (A–Z inside the section). */
export const typesIn = (section: SectionName) => TYPES.filter((e) => e.section === section);

/** The gallery's own spelling of a section, for a page that wants to offer the whole set as a grid. */
export const sectionGalleryHref = (section: SectionName) => `#/g?sec=${encodeURIComponent(section)}`;
