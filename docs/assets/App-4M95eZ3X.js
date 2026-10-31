var e=`import React, { Suspense, lazy, useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Provenance } from "./provenance";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarInset,
  SidebarProvider, SidebarRail,
} from "@/registry/new-york-v4/ui/sidebar";
import { items } from "./site/lib";
import { SOURCES, neighbours, useCanonical, useRoute, useScrollReset, type Miss } from "./site/route";
import { PhoneRail, RailHead, RailReopen, RailTree, usePhone } from "./site/Rail";
import { Home } from "./site/Home";
import { openPalette, Palette } from "./site/CommandPalette";
import { TopBar } from "./site/TopBar";

/**
 * Everything except the front page is fetched when it is first opened, not before.
 *
 * Measured on the live build at 400 kbit/s: 1,407 KB of JavaScript reached the browser before the page said
 * anything, first paint at 7.8 s and the first line of content at 10.8 s. The front page cannot draw without the
 * shell, the rail and the tiles, so those stay in the entry; the gallery, an item page, a comparison, the chrome
 * page and about were all in there too, whether or not the visitor ever opened one. They are \`lazy\` now: the
 * entry ships one surface, and the other five arrive on the click that asks for them (Vite emits a chunk each).
 */
const Gallery = lazy(() => import("./site/Gallery").then((m) => ({ default: m.Gallery })));
const About = lazy(() => import("./site/About").then((m) => ({ default: m.About })));
const ItemPage = lazy(() => import("./site/ItemPage").then((m) => ({ default: m.ItemPage })));
const Compare = lazy(() => import("./site/Compare").then((m) => ({ default: m.Compare })));
const TypePage = lazy(() => import("./site/TypePage").then((m) => ({ default: m.TypePage })));
const ChromePage = lazy(() => import("./site/ChromePage").then((m) => ({ default: m.ChromePage })));

/**
 * What a route shows for the ~100 ms its own chunk is in flight.
 *
 * Deliberately dull: one line of text, no spinner and no skeleton cards, because a skeleton card that turns into
 * different content is a lie about what is coming. It is the same sentence the crumb would carry.
 */
function SurfaceWait({ what }: { what: string }) {
  return (
    <div className="page-in" data-surface-wait="">
      <div className="crumb">{what}</div>
      <p role="status" style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>Fetching {what}…</p>
    </div>
  );
}
import { PageTurn } from "./site/PageTurn";
import { useScrollRestore } from "./site/useScrollRestore";

/**
 * A route that does not resolve, said plainly.
 *
 * The shell's switch used to fall through to \`<Home />\` for an unknown \`#/i/<id>\` — the front page on screen, the
 * wrong address in the bar. This is the page that replaces that silence: what was asked for, in its own words,
 * whether the *source* exists, the nearest real items when there is an honest reason to name one, and the two
 * ways that always work (the grid, and the palette).
 *
 * It lives in the shell for one reason: this unit's brief allows exactly one new file (\`useScrollRestore.ts\`), and
 * a surface that is one heading, one list and two links is not worth a module of its own. Everything it renders
 * comes from \`site/route.ts\`'s \`Miss\`; it decides nothing about what a hash means.
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
          <>No page in this catalogue has that address. It is not a filter, an item, a type, or one of this
            catalogue's own pages.</>
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
                <a href={\`#/i/\${c.item.id}\`} style={{ fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
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
          <a href={\`#/g?src=\${encodeURIComponent(miss.source!)}\`} style={{ fontSize: 14, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
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
 * The shell, and nothing else: the frame, the bar, the rail's two mounts, the render switch and the provenance
 * layer. Every surface lives in \`./site/\` — one module per surface — so a later unit can own one without
 * touching this file. What a visitor sees is decided by the switch at the bottom; everything above it is
 * furniture. The bar is one of those modules now (\`site/TopBar.tsx\`): it is the design system's TopBar on a
 * desktop and the phone bar it always was below 861 px.
 */
/**
 * The rail's filter, kept for the tab it was typed in.
 *
 * The gallery's filters already survive a reload because they are in the hash (\`#/g?src=beui\`): a filter you can
 * link to is a filter you can come back to. The rail's own search box and source select were the exception — type
 * "side", open an item, press reload, and the rail was showing all 769 again while the page still said the item you
 * came from. So the two are written to \`sessionStorage\` and read back on mount.
 *
 * \`sessionStorage\`, not \`localStorage\`: a filter is a thing you did a moment ago in this tab, not a setting. A
 * stored filter that outlived the tab would open tomorrow's visit showing 12 rows with no memory of why, which is
 * the same bug in the other direction.
 *
 * The *source* half of this key is gone (r8): a source chip is a link to \`#/g?src=…\` now, which is a gallery
 * filter carried in the address — a filter you can link to, keep and go Back from — so the rail stores the one
 * thing it still has, the text. A payload from an older build may still carry \`from\`; it is ignored.
 */
const FILTER_KEY = "catalog-rail-filter";

function readFilter(): string {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (!raw) return "";
    const v = JSON.parse(raw) as { q?: unknown };
    return typeof v.q === "string" ? v.q : "";
  } catch {
    return "";  // private mode, a quota, a corpus from an older build: an empty rail, not a crash
  }
}

export default function App() {
  const [q, setQ] = useState(readFilter);
  const [menu, setMenu] = useState(false);
  const phone = usePhone();
  // the phone drawer closes on every route change, exactly as the hash listener used to do it
  const { route, hash } = useRoute(() => setMenu(false));
  useScrollReset(hash);
  // …and Back puts it back where it was. Order matters and is deliberate: the reset above runs first (a forward
  // navigation starts at the top) and the restore immediately overwrites it for a traversal, in the same frame.
  useScrollRestore(hash);
  // …and the address bar is corrected to the route's one spelling, when it has one (\`#/about/extra\` → \`#/about\`)
  useCanonical(route, hash);

  // …and written back on every change, including the first render (which stores what was just read, harmless)
  React.useEffect(() => {
    try {
      if (!q) sessionStorage.removeItem(FILTER_KEY);
      else sessionStorage.setItem(FILTER_KEY, JSON.stringify({ q }));
    } catch {
      /* a filter that cannot be stored is still a filter that works */
    }
  }, [q]);

  const { prev, next } = useMemo(() => neighbours(route.kind === "item" ? route.item : undefined), [route]);

  const rendered = items.filter((i) => i.has_demo === true).length;
  // the rail reads the address, not the route: it lists the taxonomy's types and marks the one whose collection
  // is on screen, which is a route shape this file does not parse (see \`site/Rail.tsx\`, \`typeKeyAt\`).
  const rail = <RailTree q={q} hash={hash} />;
  const head = <RailHead q={q} setQ={setQ} hash={hash} total={items.length} rendered={rendered} />;

  return (
    <SidebarProvider className={\`cat\${menu ? " menu-open" : ""}\`}
      style={{ "--sidebar-width": "288px" } as React.CSSProperties}>
      <TopBar route={route} menu={menu} onToggleMenu={() => setMenu((v) => !v)} />
      {phone ? (
        <PhoneRail open={menu} onClose={() => setMenu(false)} head={head} rail={rail} />
      ) : (
        <Sidebar collapsible="offcanvas" variant="sidebar" data-catalog-item="shadcn/sidebar">
          {head}
          <SidebarContent className="rail-list">
            {/* the theme switch is the top bar's control now (\`site/TopBar.tsx\`): it changes the whole window,
                and the rail's header is down to a filter and the seven section rows. */}
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
        <Suspense fallback={<SurfaceWait what={route.kind} />}>
        {route.kind === "chrome" ? <ChromePage /> : null}
        {route.kind === "chrome" ? null
          // GALLERY SEAM — the gallery unit owns this line: \`#/g[?filter]\` parses in site/route.ts and renders
          // the grid here.
          : route.kind === "gallery" ? <Gallery query={route.query} />
          // COMPARISON SEAM — \`#/c/<concept>\` parses in site/route.ts; one arm, one surface (site/Compare.tsx).
          : route.kind === "concept" ? <Compare conceptKey={route.key} />
          // TYPE SEAM — \`#/t/<section>/<type>\` is one collection per entry in the taxonomy; the route carries the
          // entry it resolved, so the page renders the taxonomy's own membership rather than re-deriving it.
          : route.kind === "type" ? <TypePage entry={route.entry} />
          : route.kind === "item" && route.item ? <ItemPage item={route.item} prev={prev} next={next} />
          : route.kind === "about" ? <About />
          // an address that resolves to nothing is a page that says so. It used to fall through to the front
          // page, which is why a bad link looked like a working site with a bad address bar.
          : route.kind === "notfound" ? <NotFound miss={route.miss} />
          : <Home />}
        </Suspense>
        </PageTurn>
      </SidebarInset>
      {/* The palette has three doors and had four. The floating bottom-right trigger is gone: the bar's own
          240 px field is on every desktop route (site/TopBar.tsx) and the phone bar carries its own 44 px
          Search control, so the float was a second button for the same room — and it sat at 36 px, over the
          content, at the one corner a reader's thumb crosses. ⌘K/Ctrl+K still opens the palette from anywhere.
          \`place="float"\` stays in CommandPalette.tsx because the stylesheet still knows that shape; nothing
          renders it. */}
      <Palette />
      <Provenance />
    </SidebarProvider>
  );
}
`;export{e as default};