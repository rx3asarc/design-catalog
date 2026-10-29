var e=`import type { ReactNode } from "react";

/**
 * The design system's \`RelatedCard\`, which the item page uses for both of its "where next" rows:
 *
 * > "Cards sit on \`surface-200\` with a \`border\` and \`radius-lg\` corners. Hover darkens the border only. Title in
 * > \`title\`, description in \`small\`, \`ink-muted\`, clamped to two lines. Three cards in a row on desktop, stacked
 * > on phones. The whole card is the link."
 *
 * The two rows that use it:
 *
 *  - **the pager**, top and foot: one card per neighbour, titled with the neighbour's own name and described by
 *    the relation that put it there ("same category", "same kind", "same source"). The arrow glyph and the order
 *    of the words are the ones the strip carried before it was a card.
 *  - **the comparison entry**: "Compare with the N others" in the title, the set's own key as the description.
 *
 * Two things it does not take from the preview, and why:
 *
 *  - **No thumbnail.** The preview's card carries a 56 px strip on \`surface-300\` as a stand-in; the manifest
 *    publishes no image for an item, so a strip here would be a decorative box that claims a picture exists.
 *  - **The description is one line, not two.** Every description on this page is a relation or a set name, and
 *    both are short by construction; the two-line clamp is still applied so a longer relation cannot grow the
 *    card.
 *
 * The card is a single \`<a>\` — the whole box is the target, so it clears the 44 px floor by a wide margin on a
 * phone without a second control inside it.
 */

export function RelatedCard({ href, title, context, ariaLabel, lead }: {
  href: string;
  /** The card's title, at the \`title\` step: an item's own name, or "Compare with the 5 others". */
  title: ReactNode;
  /** One line of context in \`small\`/\`ink-muted\`: the relation, or the set the comparison belongs to. */
  context: ReactNode;
  /** The accessible name, when the visible title alone would not say where the link goes. */
  ariaLabel?: string;
  /** A leading glyph, as text: the pager's \`←\` / \`→\`. Never an icon-only affordance — the title says the rest. */
  lead?: ReactNode;
}) {
  return (
    <a className="related-card" href={href} aria-label={ariaLabel} title={ariaLabel}>
      <span className="related-title">
        {lead ? <span className="related-lead" aria-hidden="true">{lead}</span> : null}
        {title}
      </span>
      <span className="related-context">{context}</span>
    </a>
  );
}
`;export{e as default};