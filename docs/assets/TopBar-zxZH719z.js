var e=`import React from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { items } from "./lib";
import { MOD, openPalette, PaletteTrigger } from "./CommandPalette";
import type { Route } from "./route";

/**
 * The design system's TopBar, at both widths: the same element is the desktop bar (56 px, sticky, one hairline
 * under it) and the phone's bar (the one that existed before this unit, unchanged). What differs is CSS, not
 * markup, so there is no second header to keep in step.
 *
 * WHY A DESKTOP BAR AT ALL. Until now \`.topbar\` was \`display: none\` above 860 px and the rail carried the brand,
 * the filter and the counts. A visitor arriving on a 1440 px screen therefore had no top bar: no section links
 * anywhere, and the only way to the palette was a floating button in the bottom-right corner. The design system
 * asked for a TopBar with the brand at the left, the sections at 13 px \`ink-muted\`, a 240 px search field with
 * the shortcut hint, and one accent control per view.
 *
 * THE SECTIONS ARE THE REAL ROUTES, named here and nowhere invented. \`site/route.ts\` parses four page kinds a bar
 * can point at — \`home\`, \`gallery\` (\`#/g\`), \`chrome\` (\`#/chrome\`), \`about\` (\`#/about\`) — and an item or a
 * comparison is a *record*, not a section, so it lights none of them. The active one is \`ink\` at weight 500; the
 * rest are \`ink-muted\`, which is the design system's rule for links in the bar.
 *
 * THE SEARCH FIELD IS A BUTTON, AND THAT IS THE HONEST SHAPE. There is one search in this site: the command
 * palette, mounted once in \`App.tsx\`, which ranks 769 items in the browser and closes over its own open state.
 * A real \`<input>\` here would be a second field that cannot accept a query without a second palette or without
 * reaching into that module's private state. So this is the palette's *door*, drawn as the design system's field
 * (surface-200, \`border-strong\`, radius-md, 13 px, the shortcut in mono at the right) and nothing more: it opens
 * the one palette through the same path the ⌘K/Ctrl+K listener already documents.
 *
 * THE ACCENT IS NOT SPENT HERE. The brief allowed the palette trigger to be the bar's accent-filled control only
 * if it is a real primary action for the view. It is not: search is a side door on every surface of this site,
 * and the actual primary action of the one page that has one — an item page's install copy — is already
 * accent-filled (\`site/ItemPage.tsx\`, the \`variant="default"\` control). So the bar carries no accent fill, and
 * the count of accent-filled controls in it is 0 on every route.
 *
 * THE PHONE HALF IS THE OLD BAR, NOT A SHRUNK ONE. Below 861 px the bar keeps exactly what it had: the brand, the
 * palette button, one 44 px Browse/Close control. The section links and the 240 px field are desktop-only, and
 * the palette keeps its own key on a keyboard and its own button on a phone — a phone has no keys to press.
 */
export function TopBar({ route, menu, onToggleMenu }: {
  route: Route; menu: boolean; onToggleMenu: () => void;
}) {
  /**
   * The bar's sections, spelled as \`site/route.ts\` parses them. \`kind\` is the route kind that lights the link;
   * the label is the word the surface itself prints, in sentence case.
   */
  const sections: { label: string; href: string; kind: Route["kind"] }[] = [
    { label: "Gallery", href: "#/g", kind: "gallery" },
    { label: "Chrome", href: "#/chrome", kind: "chrome" },
    { label: "About", href: "#/about", kind: "about" },
  ];

  return (
    <header className="topbar">
      <a className="brand" href="#/">design catalog</a>

      {/* A \`div\` with the navigation role, not a \`<nav>\` element, and that is deliberate: \`qa/r2_check.mjs\` reads
          the rail's labels through \`document.querySelector('[data-rail], aside, nav')\`, so a \`<nav>\` inside this
          bar would be the first match and the gate would quietly measure the bar instead of the rail. The
          semantics are the element's role, not its tag name. */}
      <div className="topbar-links" role="navigation" aria-label="Sections">
        {sections.map((s) => (
          <a key={s.href} href={s.href} aria-current={route.kind === s.kind ? "page" : undefined}>
            {s.label}
          </a>
        ))}
      </div>

      {/* The field is a door: it opens the one palette, and it is not a second place to type.
          \`aria-keyshortcuts\` names the key the listener below actually answers to. */}
      <button
        type="button"
        className="topbar-search"
        onClick={() => openPalette()}
        aria-label="Search the catalogue"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span className="topbar-search-label">Search the catalogue</span>
        <span className="topbar-kbd" aria-hidden="true">{MOD}K</span>
      </button>

      {/* the phone's own door, hidden above 860 px where the field above is the door instead */}
      <span className="topbar-phone">
        <PaletteTrigger place="bar" />
      </span>

      {/* \`aria-controls="rail"\` + \`aria-expanded\` are the phone menu's pair (site/Rail.tsx finds the panel by
          that attribute), and \`data-catalog-item\` is the catalogue's own count of what this shell is made of —
          carried over from the bar this unit replaced, so the manifest's "used here" numbers do not move. */}
      <Button
        data-catalog-item="shadcn/button"
        variant="outline"
        size="sm"
        className="menu-btn topbar-menu h-11"
        onClick={onToggleMenu}
        aria-expanded={menu}
        aria-controls="rail"
      >
        {menu ? "Close" : \`Browse \${items.length}\`}
      </Button>
    </header>
  );
}
`;export{e as default};