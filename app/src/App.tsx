import React, { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Provenance } from "./provenance";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset,
  SidebarProvider, SidebarRail,
} from "@/registry/new-york-v4/ui/sidebar";
import { items } from "./site/lib";
import { SOURCES, neighbours, useCanonical, useRoute, useScrollReset, useTree, type Miss } from "./site/route";
import { PhoneRail, RailHead, RailReopen, RailTree, usePhone } from "./site/Rail";
import { Home } from "./site/Home";
import { Gallery } from "./site/Gallery";
import { About } from "./site/About";
import { ItemPage } from "./site/ItemPage";
import { Compare } from "./site/Compare";
import { ChromePage } from "./site/ChromePage";
import { ThemeSwitch } from "./site/ThemeSwitch";
import { Palette, PaletteTrigger } from "./site/CommandPalette";
import { PageTurn } from "./site/PageTurn";
import { useScrollRestore } from "./site/useScrollRestore";

/**
 * A route that does not resolve, said plainly.
 *
 * The shell's switch used to fall through to `<Home />` for an unknown `#/i/<id>` — the front page on screen, the
 * wrong address in the bar. This is the page that replaces that silence: what was asked for, in its own words,
 * whether the *source* exists, the nearest real items when there is an honest reason to name one, and the two
 * ways that always work (the grid, and the palette).
 *
 * It lives in the shell for one reason: this unit's brief allows exactly one new file (`useScrollRestore.ts`), and
 * a surface that is one heading, one list and two links is not worth a module of its own. Everything it renders
 * comes from `site/route.ts`'s `Miss`; it decides nothing about what a hash means.
 */
function NotFound({ miss }: { miss: Miss }) {
  const asked = miss.asked || "#";
  return (
    <div className="page-in" data-notfound={miss.what} data-notfound-asked={asked}>
      <div className="crumb">nothing here</div>
      <h2 className="title">There is nothing at <code style={{ fontSize: "0.72em", wordBreak: "break-all" }}>{asked}</code></h2>
      <p className="lede">
        {miss.what === "item" ? (
          miss.sourceKnown ? (
            <>
              <strong>{miss.source}</strong> is one of the libraries in this catalogue — {miss.sourceCount}{" "}
              item{miss.sourceCount === 1 ? "" : "s"} from it — but it has nothing whose name is{" "}
              <strong>{miss.slug}</strong>.
            </>
          ) : (
            <>
              No library in this catalogue is called <strong>{miss.source}</strong>. The ones that are here:{" "}
              {SOURCES.join(", ")}.
            </>
          )
        ) : (
          <>No page in this catalogue has that address. It is not a filter, an item, or one of the six pages.</>
        )}
      </p>
      {miss.candidates.length > 0 && (
        <>
          <div className="section-h" style={{ margin: "0 0 8px" }}>
            {miss.what === "item" && miss.sourceKnown ? "Closest real items" : "Items that are here"}
          </div>
          <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, display: "grid", gap: 4 }} data-notfound-candidates="">
            {miss.candidates.map((c) => (
              <li key={c.item.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
                <a href={`#/i/${c.item.id}`} style={{ fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
                  {c.item.displayName ?? c.item.name}
                </a>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted-foreground)" }}>{c.why}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, margin: 0 }}>
        <a href="#/g" style={{ fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44 }}>Every item</a>
        {miss.what === "item" && miss.sourceKnown ? (
          <a href={`#/g?src=${encodeURIComponent(miss.source!)}`} style={{ fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
            Just {miss.source}
          </a>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 px-3 text-[13px]"
          onClick={openPalette}
          aria-keyshortcuts="Meta+K Control+K"
        >
          Search the catalogue
        </Button>
      </p>
    </div>
  );
}

/**
 * The palette's own door: it listens for ⌘K/Ctrl+K on the window, and that listener is its public entry point —
 * the open state is module-private in `CommandPalette.tsx`, a file this unit does not own. Dispatching the
 * keystroke uses the documented path instead of reaching into that module's state.
 */
function openPalette() {
  dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

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
  // …and Back puts it back where it was. Order matters and is deliberate: the reset above runs first (a forward
  // navigation starts at the top) and the restore immediately overwrites it for a traversal, in the same frame.
  useScrollRestore(hash);
  // …and the address bar is corrected to the route's one spelling, when it has one (`#/about/extra` → `#/about`)
  useCanonical(route, hash);

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
        <PaletteTrigger place="bar" />
        <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="menu-btn h-11" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="rail">
          {menu ? "Close" : `Browse ${items.length}`}
        </Button>
      </div>
      {phone ? (
        <PhoneRail open={menu} onClose={() => setMenu(false)} head={head} rail={rail} />
      ) : (
        <Sidebar collapsible="offcanvas" variant="sidebar" data-catalog-item="shadcn/sidebar">
          {head}
          <SidebarContent className="rail-list">
            {/* The switch has to be in the DOM before the 769 rows or Tab can never reach it, and it cannot
                live in the head: the brand row's 135px of free width is less than the strip's 144px, and a
                taller head was not ours to spend. So it is the scroll area's first row, pinned. Measured:
                Tab 129 -> 12, head 230.4px and list viewport 670px unchanged. */}
            <div className="rail-theme">
              <ThemeSwitch />
            </div>
            <SidebarGroup className="rail-groupwrap">
              <SidebarGroupContent>{rail}</SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
      )}
      {phone ? null : <RailReopen />}
      <SidebarInset className="page" data-route={route.kind}>
        <PageTurn hash={hash}>
        {route.kind === "chrome" ? <ChromePage /> : null}
        {route.kind === "chrome" ? null
          // GALLERY SEAM — the gallery unit owns this line: `#/g[?filter]` parses in site/route.ts and renders
          // the grid here.
          : route.kind === "gallery" ? <Gallery query={route.query} />
          // COMPARISON SEAM — `#/c/<concept>` parses in site/route.ts; one arm, one surface (site/Compare.tsx).
          : route.kind === "concept" ? <Compare conceptKey={route.key} />
          : route.kind === "item" && route.item ? <ItemPage item={route.item} prev={prev} next={next} />
          : route.kind === "about" ? <About />
          // an address that resolves to nothing is a page that says so. It used to fall through to the front
          // page, which is why a bad link looked like a working site with a bad address bar.
          : route.kind === "notfound" ? <NotFound miss={route.miss} />
          : <Home />}
        </PageTurn>
      </SidebarInset>
      <PaletteTrigger place="float" />
      <Palette />
      <Provenance />
    </SidebarProvider>
  );
}
