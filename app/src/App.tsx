import React, { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Provenance } from "./provenance";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset,
  SidebarProvider, SidebarRail,
} from "@/registry/new-york-v4/ui/sidebar";
import { items } from "./site/lib";
import { neighbours, useRoute, useScrollReset, useTree } from "./site/route";
import { RailHead, RailReopen, RailTree, usePhone } from "./site/Rail";
import { Home } from "./site/Home";
import { Gallery } from "./site/Gallery";
import { ItemPage } from "./site/ItemPage";
import { ChromePage } from "./site/ChromePage";
import { ThemeSwitch } from "./site/ThemeSwitch";

/**
 * The shell, and nothing else: the frame, the rail's two mounts, the render switch and the provenance layer.
 * Every surface lives in `./site/` — one module per surface — so a later unit can own one without touching
 * this file. What a visitor sees is decided by the switch at the bottom; everything above it is furniture.
 */
export default function App() {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [from, setFrom] = useState<string>("");
  const phone = usePhone();
  // the phone drawer closes on every route change, exactly as the hash listener used to do it
  const { route, hash } = useRoute(() => setMenu(false));
  useScrollReset(hash);

  const tree = useTree(q, from);
  const { prev, next } = useMemo(() => neighbours(route.kind === "item" ? route.item : undefined), [route]);

  const rendered = items.filter((i) => i.variants.length).length;
  const rail = <RailTree tree={tree} activeId={route.kind === "item" ? route.id : undefined} />;
  const head = <RailHead q={q} setQ={setQ} from={from} setFrom={setFrom} total={items.length} rendered={rendered} />;

  return (
    <SidebarProvider className={`cat${menu ? " menu-open" : ""}`}
      style={{ "--sidebar-width": "288px" } as React.CSSProperties}>
      <div className="topbar">
        <a className="brand" href="#/">design catalog</a>
        <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="menu-btn h-11" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="rail">
          {menu ? "Close" : `Browse ${items.length}`}
        </Button>
      </div>
      {phone ? (
        <div className="rail rail-phone" id="rail">
          {head}
          <div className="rail-list">{rail}</div>
        </div>
      ) : (
        <Sidebar collapsible="offcanvas" variant="sidebar" data-catalog-item="shadcn/sidebar">
          {head}
          <SidebarContent className="rail-list">
            <SidebarGroup className="rail-groupwrap">
              <SidebarGroupContent>{rail}</SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      )}
      {phone ? null : <RailReopen />}
      <SidebarInset className="page" data-route={route.kind}>
        {route.kind === "chrome" ? <ChromePage /> : null}
        {route.kind === "chrome" ? null
          // GALLERY SEAM — the gallery unit owns this line: `#/g[?filter]` parses in site/route.ts and renders
          // the grid here. An unknown `#/i/<id>` still falls through to the front page.
          : route.kind === "gallery" ? <Gallery query={route.query} />
          : route.kind === "item" && route.item ? <ItemPage item={route.item} prev={prev} next={next} />
          // an unknown `#/i/<id>` falls through to the front page: that is what it has always done, and it is
          // an accident of the switch, not a feature the gallery should inherit.
          : <Home />}
      </SidebarInset>
      <ThemeSwitch />
      <Provenance />
    </SidebarProvider>
  );
}
