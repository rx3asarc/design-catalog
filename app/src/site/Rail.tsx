import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Input } from "@/registry/new-york-v4/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import {
  SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub,
  SidebarMenuSubItem, SidebarTrigger, useSidebar,
} from "@/registry/new-york-v4/ui/sidebar";
import { label as displayLabel, type Item, type TreeCat, type TreeFamily } from "./lib";
import { gridHref, type RailSection } from "./route";

/**
 * The rail: four sections, their categories, the families inside those, and one more level where a family is
 * big. Every level is the catalogue's own Collapsible mounted on its own SidebarMenuItem; a leaf is a real
 * link inside a SidebarMenuButton. Nothing here is a `<details>`, and the guard enforces that.
 */

/**
 * Every level of the rail is the catalogue's own Collapsible, mounted on the catalogue's own SidebarMenuItem —
 * the trigger is a SidebarMenuButton, the row below it is a SidebarMenuSub. Nothing here is a <details>.
 */
export function Level({ lvl, label, count, defaultOpen, href, title, children }: {
  lvl: "rail-sec" | "rail-cat" | "rail-sub" | "rail-sub2";
  label: React.ReactNode; count?: number; defaultOpen?: boolean; href?: string; title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} data-catalog-item="shadcn/collapsible">
      <SidebarMenuItem className={`${lvl}${open ? " is-open" : ""}`}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="disc-trigger">
            <span className="sub-n">{label}</span>
            {count !== undefined && <span className="sub-c">{count}</span>}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {/* the count is the door: the same tree that counted these rows spells the grid's address */}
        {href && (
          <SidebarMenuAction asChild>
            <a href={href} title={`Open the grid: ${title ?? ""} (${count ?? 0})`}
              aria-label={`Open the grid for ${title ?? "this level"} — ${count ?? 0} items`}>
              <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
            </a>
          </SidebarMenuAction>
        )}
        <CollapsibleContent>
          <SidebarMenuSub className="rail-kids">{children}</SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** A leaf is a SidebarMenuButton wrapping a real link, so the rail's rows are links and the sidebar's rows are theirs. */
export function Row({ item, active }: { item: Item; active: boolean }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuButton asChild isActive={active} className="rail-item">
        <a href={`#/i/${item.id}`} aria-current={active ? "page" : undefined}>
          <span className="t">{displayLabel(item)}</span>
          {!item.variants.length && <span className="nodemo" title="This one has no demo on the page">no demo</span>}
        </a>
      </SidebarMenuButton>
    </SidebarMenuSubItem>
  );
}

/**
 * A family key, pluralised for the rail.
 *
 * The key is a slug token (`i.slug.split("-")[0]`), not an English noun, so the old `${key}${key.endsWith("s")
 * ? "" : "s"}` produced "Matrixs", "checkboxs", "switchs", "typographys" — measured, 7 wrong labels out of
 * the 101 the rail renders. The mapping is a table plus three suffix rules, in this order:
 *
 *   1. `FAMILY_IRREGULAR` — the keys no rule can derive (matrix → matrices, index → indices) plus box and
 *      switch, which the rules would get right anyway; they are here so the intended outcome is readable in
 *      one place instead of being an argument about suffix rules.
 *   2. `FAMILY_INVARIANT` — keys that are already plural (records, returns, texts, tabs, docs, utils,
 *      citations) or non-count (progress). Never pluralised: "recordses" is worse than "records".
 *   3. the English suffix rules — -s/-x/-z/-ch/-sh take `es`, a consonant + `y` takes `ies`, otherwise `s`.
 *
 * The noun is the **last** token of the key, so a compound pluralises its head, not its qualifier:
 * `ai-status` → "ai statuses", `3d-tilt` → "3d tilts". Capitalisation is the rail's own: every key is
 * lowercase and the label stays lowercase. Unit-checked against every family key in the manifest (191 keys,
 * `build/r2-shell-small-measure.mjs`), and against the labels the rail actually renders.
 */
const FAMILY_IRREGULAR: Record<string, string> = {
  matrix: "matrices",
  index: "indices",
  box: "boxes",
  switch: "switches",
};
const FAMILY_INVARIANT = new Set([
  "records", "returns", "texts", "tabs", "docs", "utils", "citations", // already plural
  "progress", // non-count
]);

/** The rail's label for a family key. `matrix` → "matrices", `switch` → "switches", `icon` → "icons". */
export function familyLabel(key: string): string {
  const plain = key.replace(/-/g, " ");
  const head = key.slice(key.lastIndexOf("-") + 1);
  const irregular = FAMILY_IRREGULAR[head];
  if (irregular) return plain.slice(0, plain.length - head.length) + irregular;
  if (FAMILY_INVARIANT.has(key) || FAMILY_INVARIANT.has(head)) return plain;
  if (/(s|x|z|ch|sh)$/.test(head)) return `${plain}es`;
  if (/[^aeiou]y$/.test(head)) return `${plain.slice(0, -1)}ies`;
  return `${plain}s`;
}

/** Four sections, their categories, families inside those, and one more level where a family is big. */
export function RailTree({ tree, activeId }: { tree: RailSection[]; activeId?: string }) {
  const leaf = (i: Item) => <Row key={i.id} item={i} active={activeId === i.id} />;

  /** The sub-family level: a family too big for one list, rendered inside its family row. */
  const subLevels = (f: TreeFamily, sec: RailSection, cat: TreeCat, lvl: "rail-sub" | "rail-sub2") =>
    f.subs.map((g2) => (
      <Level key={g2.key} lvl={lvl} count={g2.rows.length}
        href={gridHref({ sec: sec.label, cat: cat.key, fam: f.key, sub: g2.key })}
        title={g2.key.replace(/-/g, " ")}
        label={g2.key.replace(/-/g, " ")}>
        {g2.rows.map(leaf)}
      </Level>
    ));

  /** The family level: one row per family, or the item itself when the family is a single item. */
  const family = (f: TreeFamily, sec: RailSection, cat: TreeCat) => {
    if (f.rows.length === 1) return leaf(f.rows[0]);
    return (
      <Level key={f.key} lvl="rail-sub" count={f.rows.length} defaultOpen={f.rows.length <= 4}
        href={gridHref({ sec: sec.label, cat: cat.key, fam: f.key })} title={f.key.replace(/-/g, " ")}
        label={familyLabel(f.key)}>
        {f.subs.length > 1 ? subLevels(f, sec, cat, "rail-sub2") : f.rows.map(leaf)}
      </Level>
    );
  };

  return (
    <SidebarMenu className="rail-menu">
      {tree.map((sec) => (
        <Level key={sec.label} lvl="rail-sec" count={sec.count} defaultOpen
          href={gridHref({ sec: sec.label })} title={sec.label}
          label={<span className="sec-n">{sec.label}</span>}>
          {sec.cats.map((cat) => {
            // `buildTree` collapsed this section onto its own category (and, for Docs, onto that category's
            // single same-named family): the rows hang one level shallower and nothing here re-derives that.
            // The hrefs keep the full sec/cat/fam spelling, so every #/g link the rail emits resolves through
            // the same tree the grid resolves through.
            if (sec.flatten === "family" && cat.families.length === 1) {
              const only = cat.families[0];
              if (only.rows.length === 1) return <React.Fragment key={cat.key}>{leaf(only.rows[0])}</React.Fragment>;
              return (
                <React.Fragment key={cat.key}>
                  {only.subs.length > 1 ? subLevels(only, sec, cat, "rail-sub") : only.rows.map(leaf)}
                </React.Fragment>
              );
            }
            if (sec.flatten === "cat") {
              return <React.Fragment key={cat.key}>{cat.families.map((f) => family(f, sec, cat))}</React.Fragment>;
            }
            return (
              <Level key={cat.key} lvl="rail-cat" label={cat.label} count={cat.rows.length}
                href={gridHref({ sec: sec.label, cat: cat.key })} title={`${sec.label} · ${cat.label}`}
                defaultOpen={sec.cats.length <= 2}>
                {cat.families.map((f) => family(f, sec, cat))}
              </Level>
            );
          })}
        </Level>
      ))}
    </SidebarMenu>
  );
}

export const SOURCES = ["", "shadcn", "beui", "rareui", "beautifului", "transitions"];

/** The head of the rail: name, counts, the filter, the source pills. The same head in either frame. */
export function RailHead({ q, setQ, from, setFrom, total, rendered }: {
  q: string; setQ: (v: string) => void; from: string; setFrom: (v: string) => void;
  total: number; rendered: number;
}) {
  return (
    <SidebarHeader className="rail-top">
      <div className="rail-brand">
        <h1><a href="#/" style={{ color: "inherit", textDecoration: "none" }}>design catalog</a></h1>
        <SidebarTrigger data-catalog-item="shadcn/button" className="rail-trigger" />
      </div>
      <div className="meta">{total} items · {rendered} rendered</div>
      <Input data-catalog-item="shadcn/input" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        placeholder="Filter components…" aria-label="Filter components" className="h-9" />
      <div className="rail-legend">
        Counts are how many are inside. <a href="#/chrome">What this site is made of</a>
      </div>
      <div className="rail-filter">
        {SOURCES.map((s) => (
          <Button key={s || "all"} data-catalog-item="shadcn/button" size="sm" variant={from === s ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs" onClick={() => setFrom(s)}>
            {s || "all sources"}
          </Button>
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
 * The geometry is the overlay rule at the foot of `styles.css`. This component is the three things CSS cannot
 * do:
 *
 *   1. **measure the header** (`--phone-header`) — the panel starts under it. The 65 px fallback in the
 *      stylesheet is 44 + 2×10 + the header's rule; the measurement is what keeps that honest.
 *   2. **close like a menu**: Escape, a tap on the backdrop, and focus back on the trigger afterwards. The
 *      trigger itself toggles and navigation closes the menu through the route hook in App — those two
 *      already existed and still do; these are the other two.
 *   3. **block the page behind it**: while the sheet is up, a tap meant for the panel must never land on the
 *      catalogue underneath. The backdrop is that guarantee, not only a way out.
 *
 * `aria-controls="rail"` is the trigger's own promise (`aria-expanded` + `aria-controls` pair it with this
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
    const set = () => root.style.setProperty("--phone-header", `${Math.round(header.getBoundingClientRect().height)}px`);
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
        <Button type="button" variant="ghost" tabIndex={-1} aria-label="Close the menu"
          className="menu-veil" onClick={onClose} />
      )}
      <div className={`rail rail-phone${open ? " is-open" : ""}`} id="rail" aria-label="Browse the catalogue">
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
