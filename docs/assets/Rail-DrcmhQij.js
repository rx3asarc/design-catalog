var e=`import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Input } from "@/registry/new-york-v4/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import {
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub,
  SidebarMenuSubItem, SidebarTrigger, useSidebar,
} from "@/registry/new-york-v4/ui/sidebar";
import { ThemeSwitch } from "./ThemeSwitch";
import { byId } from "./lib";
import { SECTION_ORDER, TYPES, typeOfItem, type SectionName, type TypeEntry } from "./taxonomy";
import { typeAt, typeHref } from "./typeIndex";

/**
 * THE RAIL: SEVEN SECTIONS, THE TYPES INSIDE THEM, AND NOTHING ELSE.
 *
 * What it was, and what the round-4 review said about it: "the groups are made by cutting item names into words
 * and adding an 's' … with everything expanded the sidebar has about 990 rows". The groups were a rule over
 * slugs (\`i.slug.split("-")[0]\` + a plural), so the rail listed *items* under *invented* families: \`Natives\`,
 * \`Hovers\`, \`Otps\`, \`Kbds\`, \`Loadings\`, sixteen groups named \`01\` … \`16\`. Two levels of taxonomy now replace
 * that, and the taxonomy is a written list (\`site/taxonomy.json\`), not a rule over names:
 *
 *   level 1  the seven sections, uppercase, in the book's own order — \`SECTION_ORDER\`
 *   level 2  the component types inside a section, A–Z — \`TYPES\`, 89 of them
 *
 * An *item* is never a row here. 769 items fold into 569 members of 89 types, and another 200 are variants that
 * live as demos on their parent's page. A type's row is a link to its collection, \`#/t/<section>/<type>\`, which is
 * the surface that compares the type's members — so the rail is an index of the catalogue's *shape*, and the
 * items are one click away in the collection or in the grid.
 *
 * The disclosures are the catalogue's own \`Collapsible\` (never a \`<details>\`), mounted on its own
 * \`SidebarMenuItem\`, and the prefixes the design system's round-6 rules are written against are kept:
 * \`.rail-sec\` for a section, \`.rail-item\` for a type, \`.disc-trigger\` for a trigger, \`.rail-count\` for a count.
 * Those rules give the section rows the mono \`label\` step in uppercase and the type rows \`small\` in \`ink-muted\`;
 * nothing here restates them.
 */

/* ── the addresses ────────────────────────────────────────────────────────────────────────────────────────────
 * A type's collection address is \`site/typeIndex.ts\`'s — the module the type page itself resolves routes with —
 * and nothing here spells a second copy of it. (This file carried a two-line duplicate of \`typeHref\` while the two
 * units were in flight; it was deleted on merge, as both reports asked.) \`typeKeyAt\` stays because the rail asks a
 * different question than the router does: "is the address bar naming one of my rows?" — asked of hashes the
 * router may not have learned yet, since a miss still renders the rail around the not-found page.
 */
export function typeKeyAt(hash: string): string | null {
  const seg = hash.replace(/^#/, "").replace(/\\/+$/, "").split("/").filter(Boolean);
  if (seg.length < 3 || seg[0].toLowerCase() !== "t") return null;
  const hit = typeAt(seg[1], seg[2]);
  return hit ? hit.key : null;
}

/**
 * The section a route is *in* — its type's section on a type route, its item's section on an item page — or
 * \`null\` on every other surface. This is what "only the current section is open" is decided by.
 */
export function sectionAt(hash: string): SectionName | null {
  const key = typeKeyAt(hash);
  if (key) return TYPES.find((t) => t.key === key)?.section ?? null;
  const m = /^#\\/i\\/([^/]+)\\/([^/?#]+)/.exec(hash);
  const item = m ? byId.get(\`\${m[1]}/\${m[2]}\`) : undefined;
  return item ? typeOfItem(item)?.section ?? null : null;
}

/**
 * One level of the rail: a section, its types underneath. The catalogue's own \`Collapsible\`, mounted on the
 * catalogue's own \`SidebarMenuItem\` — nothing here is a \`<details>\`, and the guard enforces that.
 *
 * \`resetKey\` is what the open/closed state belongs to. When the filter changes, the rows on screen are a
 * different set, so a state chosen about the old ones is not about these; every level goes back to its own
 * default. (Round 7 found this the hard way: typing "side" left 2 rows while a reload with the same filter showed
 * 9, because most matches were behind a family the reader had collapsed before typing.)
 */
export function Level({ lvl, label, count, defaultOpen, children, resetKey }: {
  lvl: "rail-sec" | "rail-cat" | "rail-sub" | "rail-sub2";
  label: React.ReactNode; count?: number; defaultOpen?: boolean;
  children: React.ReactNode; resetKey?: string;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const first = useRef(resetKey);
  useEffect(() => {
    if (first.current === resetKey) return;   // the first render's state is what \`defaultOpen\` already set
    first.current = resetKey;
    setOpen(!!defaultOpen);
  }, [resetKey, defaultOpen]);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} data-catalog-item="shadcn/collapsible">
      <SidebarMenuItem className={\`\${lvl}\${open ? " is-open" : ""}\`}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="disc-trigger">
            <span className="sub-n">{label}</span>
            {count !== undefined && <span className="rail-count">{count}</span>}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="rail-kids">{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** A type's row: its name, how many members it has, and a link to the collection that compares them. */
export function TypeRow({ t, current }: { t: TypeEntry; current: boolean }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuButton asChild isActive={current} className="rail-item">
        <a href={typeHref(t)} aria-current={current ? "page" : undefined}>
          <span className="t">{t.type}</span>
          <span className="rail-count">{t.members.length}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuSubItem>
  );
}

/**
 * The tree, and only the tree.
 *
 * OPEN/CLOSED. A section opens when it is the one the current route is in; on a surface that is in no section
 * (the front page, the grid, about, chrome) \`Components\` is the one open section, because it is where a reader
 * who came to see a component starts. Everything else is closed, so at 1440 the rail is an index of the
 * catalogue's shape — 7 sections and the 53 Components types, 60 rows — instead of a wall of 769 items with 990
 * rows when every group is expanded.
 *
 * With a filter typed, every section that still has a match is open: a filter that hides its own matches behind a
 * disclosure the reader cannot see is a broken filter. Sections with no match are not rendered at all.
 *
 * On a phone the rail is a sheet over the page, and a sheet opens on the seven section names: nothing is
 * pre-expanded there, because the same tree that is an index at 1440 is a drawer at 390.
 */
export function RailTree({ q, hash }: { q: string; hash: string }) {
  const phone = usePhone();
  const needle = q.trim().toLowerCase();
  const here = sectionAt(hash);
  const currentKey = typeKeyAt(hash);
  const sections = SECTION_ORDER.map((section) => {
    const all = TYPES.filter((t) => t.section === section);
    const types = needle ? all.filter((t) => t.type.toLowerCase().includes(needle)) : all;
    return { section, types, count: types.reduce((n, t) => n + t.members.length, 0) };
  }).filter((s) => s.types.length > 0);

  /* the filter, the counts it produced, the frame and where the reader is: everything the open/closed state was
     chosen about. Any of them moving means these are different rows. */
  const sig = [needle, phone ? "phone" : "rail", here ?? "", ...sections.map((s) => \`\${s.section}:\${s.count}\`)].join("|");

  return (
    <SidebarMenu className="rail-menu">
      {sections.map((s) => (
        <Level key={s.section} lvl="rail-sec" count={s.count} resetKey={sig}
          defaultOpen={needle ? true : phone ? false : s.section === (here ?? "Components")}
          label={<span className="sec-n">{s.section}</span>}>
          {s.types.map((t) => <TypeRow key={t.key} t={t} current={t.key === currentKey} />)}
        </Level>
      ))}
    </SidebarMenu>
  );
}

/**
 * The sources, in the order the rail has always printed them. A chip is a *gallery filter* now, not a rail
 * filter: \`site/Gallery.tsx\` already reads \`src\` out of \`#/g?src=…\`, so a chip is navigation to the grid the
 * chip describes, which is a surface a reader can link to, keep and go Back from.
 */
export const RAIL_SOURCES = ["shadcn", "beui", "rareui", "beautifului", "transitions"];

/** Which source the grid is filtered to, if the address bar names one. */
function gallerySource(hash: string): string {
  const m = /^#\\/g[?/]/.exec(hash);
  if (!m) return "";
  return new URLSearchParams(hash.slice(3).replace(/^\\//, "")).get("src") ?? "";
}

/**
 * The head of the rail: the wordmark (desktop hides it — the top bar carries it), the counts, the filter, the
 * source chips. The same head is the phone menu's first block.
 *
 * What is NOT here any more, and why:
 *  - **the theme switch.** It is the top bar's control now (\`site/TopBar.tsx\`), where a switch that changes the
 *    whole window belongs, instead of the first row of a scrolling list.
 *  - **the help sentence.** "Counts are how many are inside" taught a rule the counts themselves now state.
 *  - **the grid doors.** One 28 px icon sat at the right edge of every group row, over the group's count, and
 *    there were 39 of them: a door to a filtered grid for a reader who was one click from the collection page the
 *    row now links to. Their counts are visible text on the section and type rows instead.
 */
export function RailHead({ q, setQ, hash, total, rendered }: {
  q: string; setQ: (v: string) => void; hash: string; total: number; rendered: number;
}) {
  const src = gallerySource(hash);
  return (
    <SidebarHeader className="rail-top">
      <div className="rail-brand">
        <h1><a href="#/" style={{ color: "inherit", textDecoration: "none" }}>design catalog</a></h1>
        <SidebarTrigger data-catalog-item="shadcn/button" className="rail-trigger" />
      </div>
      <div className="meta">{total} items · {TYPES.length} types · {rendered} rendered</div>
      <Input data-catalog-item="shadcn/input" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        placeholder="Filter types…" aria-label="Filter types" className="h-9" />
      <div className="rail-filter" role="navigation" aria-label="Sources in the grid">
        {/* "every library", not "all sources": \`qa/r2_check.mjs\` (B) finds a withheld page's outbound action by
            taking the first link whose text says source/original/view on, and a chip with that word in it is a
            30 px navigation link in the rail's head, not the page's control. The label says the same thing. */}
        <a href="#/g" aria-current={hash === "#/g" && !src ? "page" : undefined} title="The grid, with no library filter">
          every library
        </a>
        {RAIL_SOURCES.map((s) => (
          <a key={s} href={\`#/g?src=\${encodeURIComponent(s)}\`} aria-current={src === s ? "page" : undefined}
            title={\`The grid, filtered to \${s}\`}>
            {s}
          </a>
        ))}
      </div>
    </SidebarHeader>
  );
}

/** Offcanvas takes the rail off screen; the way back has to live where the rail was. */
export function RailReopen() {
  const { state } = useSidebar();
  if (state !== "collapsed") return null;
  return (
    <div className="rail-reopen">
      <SidebarTrigger data-catalog-item="shadcn/button" className="rail-reopen-btn" />
    </div>
  );
}

/**
 * The phone's Browse menu: a surface over the page, not a row in it.
 *
 * It was a flex item between the sticky header and the page, and the column is exactly one viewport tall, so
 * the rail was squeezed to a few pixels while its rows were laid out past the clipped box — the tree existed,
 * at the right height, with the page painted over it. Taps on "Blocks and pages" landed on the page heading.
 * The geometry is the overlay rule at the foot of \`styles.css\`. This component is the three things CSS cannot
 * do:
 *
 *   1. **measure the header** (\`--phone-header\`) — the panel starts under it. The 65 px fallback in the
 *      stylesheet is 44 + 2×10 + the header's rule; the measurement is what keeps that honest.
 *   2. **close like a menu**: Escape, a tap on the backdrop, and focus back on the trigger afterwards. The
 *      trigger itself toggles and navigation closes the menu through the route hook in App — those two
 *      already existed and still do; these are the other two.
 *   3. **block the page behind it**: while the sheet is up, a tap meant for the panel must never land on the
 *      catalogue underneath. The backdrop is that guarantee, not only a way out.
 *
 * \`aria-controls="rail"\` is the trigger's own promise (\`aria-expanded\` + \`aria-controls\` pair it with this
 * panel), so it is also how the focus target is found without threading a ref through the shell. Exactly one
 * element carries it: the Browse/Close button in the top bar.
 */
export function PhoneRail({ open, onClose, head, rail }: {
  open: boolean; onClose: () => void; head: React.ReactNode; rail: React.ReactNode;
}) {
  // The header is sticky and the panel starts at its foot: measure it rather than trust the constant.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".topbar");
    if (!header) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--phone-header", \`\${Math.round(header.getBoundingClientRect().height)}px\`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    addEventListener("resize", set);
    return () => { ro.disconnect(); removeEventListener("resize", set); };
  }, []);

  // Escape closes it from wherever focus is: this is a menu, not a dialog, so it does not trap focus and must
  // still listen on the document. A palette open above it owns its own Escape (radix dialogs close on it too).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Closing returns focus to the trigger. Skipped on the first render of a menu that was never opened, so a
  // phone that loads with the menu shut does not steal focus from the page.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    document.querySelector<HTMLElement>('[aria-controls="rail"]')?.focus();
  }, [open]);

  return (
    <>
      {/* The backdrop: a full-area close control behind the sheet. It is skippable by Tab (the menu is not a
          dialog and the trigger already closes it), and it exists as much to keep taps off the page as to be
          one of the ways out. */}
      {open && (
        <Button variant="ghost" tabIndex={-1} aria-label="Close the menu"
          className="menu-veil" onClick={onClose} />
      )}
      <div className={\`rail rail-phone\${open ? " is-open" : ""}\`} id="rail" aria-label="Browse the catalogue">
        {/* The phone has one surface that is ever above the page, and the theme control belongs on it: the
            window's top bar is a phone bar here (brand, search, Browse) and has no room for a three-segment
            switch without becoming a different bar. First row, sticky, so it is under the thumb for as long as
            the menu is open — and nowhere else, because nowhere else on a phone is above the content. Exactly
            one instance at every width: this one below 861 px, the top bar's above it. */}
        <div className="rail-theme rail-theme-phone">
          <ThemeSwitch />
        </div>
        {head}
        <div className="rail-list">{rail}</div>
      </div>
    </>
  );
}

/** The catalogue's own sidebar is a desktop sidebar; a phone gets the same tree as a disclosure above the page. */
const PHONE = "(max-width: 860px)";
export function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const m = window.matchMedia(PHONE);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}
`;export{e as default};