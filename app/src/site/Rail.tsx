import React, { useEffect, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Input } from "@/registry/new-york-v4/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import {
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem,
  SidebarTrigger, useSidebar,
} from "@/registry/new-york-v4/ui/sidebar";
import { label as displayLabel, type Item, type TreeSection } from "./lib";

/**
 * The rail: four sections, their categories, the families inside those, and one more level where a family is
 * big. Every level is the catalogue's own Collapsible mounted on its own SidebarMenuItem; a leaf is a real
 * link inside a SidebarMenuButton. Nothing here is a `<details>`, and the guard enforces that.
 */

/**
 * Every level of the rail is the catalogue's own Collapsible, mounted on the catalogue's own SidebarMenuItem —
 * the trigger is a SidebarMenuButton, the row below it is a SidebarMenuSub. Nothing here is a <details>.
 */
export function Level({ lvl, label, count, defaultOpen, children }: {
  lvl: "rail-sec" | "rail-cat" | "rail-sub" | "rail-sub2";
  label: React.ReactNode; count?: number; defaultOpen?: boolean; children: React.ReactNode;
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

/** Four sections, their categories, families inside those, and one more level where a family is big. */
export function RailTree({ tree, activeId }: { tree: TreeSection[]; activeId?: string }) {
  return (
    <SidebarMenu className="rail-menu">
      {tree.map((sec) => (
        <Level key={sec.label} lvl="rail-sec" count={sec.count} defaultOpen
          label={<span className="sec-n">{sec.label}</span>}>
          {sec.cats.map((cat) => (
            <Level key={cat.key} lvl="rail-cat" label={cat.label} count={cat.rows.length}
              defaultOpen={sec.cats.length <= 2}>
              {cat.families.map((f) => {
                const leaf = (i: Item) => <Row key={i.id} item={i} active={activeId === i.id} />;
                if (f.rows.length === 1) return leaf(f.rows[0]);
                return (
                  <Level key={f.key} lvl="rail-sub" count={f.rows.length} defaultOpen={f.rows.length <= 4}
                    label={`${f.key.replace(/-/g, " ")}${f.key.endsWith("s") ? "" : "s"}`}>
                    {f.subs.length > 1
                      ? f.subs.map((g2) => (
                          <Level key={g2.key} lvl="rail-sub2" count={g2.rows.length}
                            label={g2.key.replace(/-/g, " ")}>
                            {g2.rows.map(leaf)}
                          </Level>
                        ))
                      : f.rows.map(leaf)}
                  </Level>
                );
              })}
            </Level>
          ))}
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
