import React, { Suspense, useEffect, useMemo, useState } from "react";
import manifest from "../manifest.json";
import { VERSION } from "./version";
import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Input } from "@/registry/new-york-v4/ui/input";
import { ScrollArea } from "@/registry/new-york-v4/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem,
  SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/registry/new-york-v4/ui/sidebar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/registry/new-york-v4/ui/table";

type Variant = { label: string; module: string };
type Item = {
  id: string; source: string; slug: string; kind: string; name: string;
  one_line: string | null; url: string | null; licence: string; page: string | null;
  install: string | null; files: string[]; variants: Variant[]; withheld?: boolean;
  verdict?: { verdict: string; reason: string; ours_path?: string | null };
};

const items = manifest as unknown as Item[];

type TreeFamily = { key: string; rows: Item[]; subs: { key: string; rows: Item[] }[] };
type TreeCat = { key: string; label: string; rows: Item[]; families: TreeFamily[] };
type TreeSection = { label: string; count: number; cats: TreeCat[] };

/**
 * Every level of the rail is the catalogue's own Collapsible, mounted on the catalogue's own SidebarMenuItem —
 * the trigger is a SidebarMenuButton, the row below it is a SidebarMenuSub. Nothing here is a <details>.
 */
function Level({ lvl, label, count, defaultOpen, children }: {
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
function Row({ item, active }: { item: Item; active: boolean }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuButton asChild isActive={active} className="rail-item">
        <a href={`#/i/${item.id}`} aria-current={active ? "page" : undefined}>
          <span className="t">{item.name}</span>
          {!item.variants.length && <span className="nodemo" title="This one has no demo on the page">no demo</span>}
        </a>
      </SidebarMenuButton>
    </SidebarMenuSubItem>
  );
}

/** Four sections, their categories, families inside those, and one more level where a family is big. */
function RailTree({ tree, activeId }: { tree: TreeSection[]; activeId?: string }) {
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

const SOURCES = ["", "shadcn", "beui", "rareui", "beautifului", "transitions"];

/** The head of the rail: name, counts, the filter, the source pills. The same head in either frame. */
function RailHead({ q, setQ, from, setFrom, total, rendered }: {
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
          <Button key={s || "all"} size="sm" variant={from === s ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs" onClick={() => setFrom(s)}>
            {s || "all sources"}
          </Button>
        ))}
      </div>
    </SidebarHeader>
  );
}

/** Offcanvas takes the rail off screen; the way back has to live where the rail was. */
function RailReopen() {
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
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  useEffect(() => {
    const m = window.matchMedia(PHONE);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

const byId = new Map(items.map((i) => [i.id, i]));

/** Demo modules are generated files that import the real component, so what renders is what the code pane shows. */
const DEMOS = import.meta.glob("./demos/**/*.tsx") as Record<string, () => Promise<any>>;
/** The code pane reads the very same file from disk, at build time. */
const RAW = import.meta.glob("./**/*.{tsx,ts,jsx,js,json,css}", { query: "?raw", import: "default" }) as Record<
  string,
  () => Promise<string>
>;

const key = (rel: string) => (rel.startsWith("./") ? rel : "./" + rel);

function useCode(rel: string | null) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setCode(null);
    if (!rel) return;
    const load = RAW[key(rel)];
    if (!load) { setCode("// this file is not in the published set"); return; }
    load().then((t) => live && setCode(t));
    return () => { live = false; };
  }, [rel]);
  return code;
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied */ }
        setDone(true); setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

/** A demo that throws is shown throwing, in place, with its message — never a blank box and never hidden. */
class Boundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message ?? e) }; }
  render() {
    if (this.state.err) {
      return (
        <span style={{ fontSize: 12.5, color: "oklch(0.6 0.16 25)", textAlign: "left" }}>
          This demo throws in our build: <code>{this.state.err.slice(0, 180)}</code>
        </span>
      );
    }
    return this.props.children;
  }
}

/** The demo lives in its own document, so its portals and fixed panels cannot land on our rail. */
function DemoFrame({ id, index, zoom, floor }: { id: string; index: number; zoom: number; floor: number }) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
  const [h, setH] = React.useState(0); // 0 = not measured yet
  const grows = React.useRef(0);
  const locked = React.useRef(false);
  React.useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.designCatalogDemo !== true || d.id !== id || d.index !== index) return;
      // a viewport-filling demo can report its own frame back and grow without bound; clamp it
      if (typeof d.height !== "number" || d.height <= 0 || locked.current) return;
      // first measurement is just the measurement; the growth watch is for later ones
      if (hRef.current === 0) { setH(Math.min(Math.ceil(d.height), 4000)); return; }
      // a demo that sizes itself to the frame will report one growth after another; three is a loop, not a layout
      if (d.height > hRef.current + 4) {
        if (++grows.current > 2) { locked.current = true; setH(0); return; } // falls back to the block-size frame
      }
      setH(Math.min(Math.ceil(d.height), 2400));
      // height 0 means "this one sizes itself to the frame": keep the floor we already set
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [id, index, phone]);
  const hRef = React.useRef(h);
  hRef.current = h;
  // a measurement wins over the fallback: the fallback is only for demos that cannot report
  const shown = h > 0 ? h : floor;
  // no inner scroller: the frame is exactly as tall as the demo, and the page does the scrolling
  const cap = shown * zoom;
  React.useEffect(() => {
    frame.current?.setAttribute("title", `${id} demo`);
  }, [id]);
  return (
    <div ref={wrap} style={{ height: cap, overflow: "hidden", width: "100%" }}>
      <iframe
        ref={frame}
        src={`/design-catalog/demo.html#${encodeURIComponent(id)}|${index}`}
        loading="lazy"
        style={{
          width: `${100 / zoom}%`,
          height: shown,
          border: 0,
          display: "block",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          background: "transparent",
          colorScheme: "light dark",
        }}
      />
    </div>
  );
}

function Demo({ id, index, variant, isBlock }: { id: string; index: number; variant: Variant; isBlock: boolean }) {
  const [open, setOpen] = useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ needed: number; zoom: number } | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null); // the user's Fit toggle wins over the default

  React.useEffect(() => {
    const outer = box.current, inner = canvas.current;
    if (!outer || !inner) return;
    const measure = () => {
      // how wide does this demo really want to be? the widest scroller inside it is the honest answer
      let needed = inner.scrollWidth;
      inner.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.scrollWidth > needed) needed = el.scrollWidth;
      });
      const avail = outer.clientWidth;
      if (needed > avail + 2) {
        setFit({ needed, zoom: Math.max(0.3, Math.min(1, avail / needed)) });
      } else {
        setFit(null);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [variant.module]);

  const autoFit = typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
  const fitted = fit ? (choice ?? autoFit) : false;
  const zoom = fitted && fit ? fit.zoom : 1;
  const Lazy = useMemo(() => React.lazy(DEMOS[key(variant.module)] as any), [variant.module]);
  const code = useCode(variant.module);
  return (
    <section className="demo">
      <header className="demo-head">
        <span>{variant.label}</span>
        <span className="sp" />
        <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="demo-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide code" : "View code"}
      </Button>
        {code && <Copy text={code} />}
        {fit && (
          <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="demo-fit" onClick={() => setChoice(!fitted)} aria-pressed={fitted}>
            {fitted ? `Fit ${Math.round(fit.zoom * 100)}%` : "Fit"}
          </Button>
        )}
      </header>
      <div className="demo-body" ref={box}>
        <DemoFrame id={id} index={index} zoom={zoom} floor={isBlock ? (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches ? 720 : 900) : 90} />
      </div>
      {open && code && <div className="demo-code"><pre>{code}</pre></div>}
    </section>
  );
}

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
function command(pm: string, install: string) {
  const tail = install.replace(/^npx\s+/, "");
  if (pm === "pnpm") return `pnpm dlx ${tail}`;
  if (pm === "npm") return `npx ${tail}`;
  if (pm === "yarn") return `yarn dlx ${tail}`;
  return `bunx --bun ${tail}`;
}

function Install({ install }: { install: string }) {
  const [pm, setPm] = useState<string>("pnpm");
  const text = command(pm, install);
  return (
    <>
      <div className="section-h">Installation</div>
      <div className="tabs" role="tablist">
        {MANAGERS.map((m) => (
          <Button key={m} role="tab" variant={pm === m ? "default" : "outline"} size="sm"
            aria-selected={pm === m} className="h-8" onClick={() => setPm(m)}>{m}</Button>
        ))}
      </div>
      <div className="cmd">
        <code>{text}</code>
        <Copy text={text} />
      </div>
    </>
  );
}

function Files({ files }: { files: string[] }) {
  const [sel, setSel] = useState(files[0] ?? null);
  const code = useCode(sel);
  if (!files.length) return null;
  return (
    <>
      <div className="section-h">Source files ({files.length})</div>
      {files.length > 1 && (
        <Tabs data-catalog-item="shadcn/tabs" value={sel ?? ""} onValueChange={setSel} className="file-tabs">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
            {files.map((f) => (
              <TabsTrigger key={f} value={f} title={f}
                className="h-9 rounded-none border-b-2 border-transparent px-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {f.split("/").pop()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="cmd" style={{ borderRadius: "0 8px 0 0" }}>
        <span className="path">{sel}</span>
        {code && <Copy text={code} />}
      </div>
      <div className="demo" style={{ borderRadius: "0 0 8px 8px", borderTop: 0 }}>
        <div className="demo-code" style={{ borderTop: 0 }}>
          <ScrollArea data-catalog-item="shadcn/scroll-area" className="h-[560px] w-full">
            <pre>{code ?? "loading…"}</pre>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}

function ItemPage({ item, prev, next }: { item: Item; prev?: Item; next?: Item }) {
  return (
    <div className={"page-in" + (item.kind === "block" ? " wide" : "")}>
      <div className="pager">
        {prev ? <a href={`#/i/${prev.id}`}><span className="dir">←</span> {prev.name}</a> : <span className="off" />}
        {next ? <a href={`#/i/${next.id}`}>{next.name} <span className="dir">→</span></a> : <span className="off" />}
      </div>

      <div className="crumb">{item.source} · {item.kind}</div>
      <h2 className="title">{item.name}</h2>
      {item.one_line && <p className="lede">{item.one_line}</p>}
      <div className="badges">
        <Badge data-catalog-item="shadcn/badge" variant={item.withheld ? "outline" : "secondary"} className={`badge ${item.withheld ? "warn" : "ok"}`}>
          {item.withheld ? "source withheld" : "source included"}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
        {item.verdict && (
          <Badge variant="outline" className={`badge ${item.verdict.verdict === "rejected" ? "bad" : ""}`}>
            {item.verdict.verdict}
          </Badge>
        )}
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.files.length} files</Badge>
        {item.variants.length > 0 && (
          <Badge variant="outline" className="badge">
            {item.variants.length} demo{item.variants.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {item.verdict?.reason && (
        <p className="verdict"><b>{item.verdict.verdict}.</b> {item.verdict.reason}
          {item.verdict.ours_path ? <> — ours: <code>{item.verdict.ours_path}</code></> : null}</p>
      )}

      {item.withheld ? (
        <div className="withheld">
          <p style={{ margin: "0 0 10px" }}>
            The code is not ours to republish, so it is not rendered here. The entry, its files list and our verdict are.
          </p>
          {item.page && <p style={{ margin: 0 }}><a href={item.page} target="_blank" rel="noreferrer">Their page ↗</a></p>}
        </div>
      ) : item.variants.length ? (
        item.variants.map((v, i) => <Demo key={v.module} id={item.id} index={i} variant={v} isBlock={item.kind === "block"} />)
      ) : (
        <div className="withheld">No demo for this one — it is a helper or a doc, not a component.</div>
      )}

      {item.install && <Install install={item.install} />}
      <Files files={item.files} />

      <nav className="nav2">
        {prev ? <a href={`#/i/${prev.id}`}>← {prev.name}</a> : <span />}
        {next ? <a href={`#/i/${next.id}`}>{next.name} →</a> : <span />}
      </nav>
    </div>
  );
}

const TARBALL = "https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz";
const MCP_CONFIG = `{
  "mcpServers": {
    "design-catalog": {
      "command": "npx",
      "args": ["-y", "${TARBALL}", "mcp"]
    }
  }
}`;

function Cmd({ text, label }: { text: string; label?: string }) {
  return (
    <div className="cmd-wrap">
      {label && <div className="cmd-label">{label}</div>}
      <div className="cmd">
        <code>{text}</code>
        <Copy text={text} />
      </div>
    </div>
  );
}

const CHROME: { id: string; where: string }[] = [
  { id: "shadcn/sidebar", where: "the rail frame and the trigger that reopens it" },
  { id: "shadcn/collapsible", where: "every level of the rail, and each family inside it" },
  { id: "shadcn/button", where: "View code, Fit, the phone browse control, the manager tabs" },
  { id: "shadcn/badge", where: "licence and status badges, on every item page" },
  { id: "shadcn/input", where: "the filter box above the rail" },
  { id: "shadcn/tabs", where: "the source-file tab strip, on item pages" },
  { id: "shadcn/scroll-area", where: "the pane a long source file scrolls in, on item pages" },
  { id: "shadcn/table", where: "this listing — the table of everything above it" },
];

function ChromePage() {
  // counted, not narrated: ask the DOM how many of each are on the page right now
  const [seen, setSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    const out: Record<string, number> = {};
    for (const c of CHROME) out[c.id] = document.querySelectorAll(`[data-catalog-item="${c.id}"]`).length;
    setSeen(out);
  }, []);
  return (
    <div className="page-in">
      <div className="crumb">this site · built from the catalogue</div>
      <h2 className="title">Chrome</h2>
      <p className="lede">
        Everything you are looking at, the shop and the shelves, is one of these. Each row is a catalogue item
        and the count is how many of it this page is running on right now, counted from the page itself.
      </p>
      <Table data-catalog-item="shadcn/table">
        <TableHeader>
          <TableRow>
            <TableHead>component</TableHead>
            <TableHead>where</TableHead>
            <TableHead className="text-right">on this page</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CHROME.map((c) => (
            <TableRow key={c.id} data-catalog-item="shadcn/table-row">
              <TableCell><a href={`#/i/${c.id}`}>{c.id}</a></TableCell>
              <TableCell className="text-muted-foreground">{c.where}</TableCell>
              <TableCell className="text-right tabular-nums">{seen[c.id] ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="hint">
        A build check refuses to publish if any hand-written button, input, table or disclosure reappears in
        the shell, so this list cannot quietly go stale. A zero means it is not on the page you are looking at
        but on the pages named beside it.
      </p>
    </div>
  );
}

/** The front page is a first-run screen: what this is, three ways in, what is inside, then the commands. */
function Home() {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.source] = (m[i.source] ?? 0) + 1;
    return m;
  }, []);
  const sources = useMemo(() => Object.keys(counts).sort((a, b) => counts[b] - counts[a]), [counts]);
  const shipped = items.filter((i) => !i.withheld).length;
  const withheld = items.length - shipped;
  const rendered = items.filter((i) => i.variants.length > 0).length;
  return (
    <div className="page-in">
      <h2 className="title">design catalog</h2>
      <p className="lede">
        {items.length} components, blocks, effects and doc pages collected from {sources.length} reference
        libraries. Where the source is ours to republish it ships with the item; where it builds against the
        catalogue's own components it runs here, live — licence named and our verdict attached.
      </p>

      <ol className="ways">
        <li className="way">
          <span className="way-n">01</span>
          <div>
            <div className="way-h">Browse the rail</div>
            <p className="way-p">
              Four sections, down to families. The count on any level is how many items are inside it, and the
              filter box narrows all of them at once.
            </p>
          </div>
        </li>
        <li className="way">
          <span className="way-n">02</span>
          <div>
            <div className="way-h">Open an item</div>
            <p className="way-p">
              Every page names the source and the licence, lists the files, and runs each variant as the component
              itself rather than a picture of it. <a href="#/i/shadcn/button">Start with button</a>, or open a{" "}
              <a href="#/i/shadcn/dashboard-01">whole dashboard</a>.
            </p>
          </div>
        </li>
        <li className="way">
          <span className="way-n">03</span>
          <div>
            <div className="way-h">Use it from an agent</div>
            <p className="way-p">
              The same catalogue is a CLI and an MCP server, so a coding agent can search it and read an item's
              source without a browser. Two commands for that, three for a shell, below.
            </p>
          </div>
        </li>
      </ol>

      <div className="section-h">What is in it</div>
      <div className="tally">
        {sources.map((s) => (
          <span className="tally-item" key={s}>
            <span className="tally-n">{counts[s]}</span>
            <span className="tally-l">{s}</span>
          </span>
        ))}
      </div>
      <p className="tally-note">
        {shipped} of the {items.length} ship their source, and {rendered} of them run here as a live demo. The
        remaining {withheld} are entries with facts, a licence and our verdict and no source, because republishing
        it is not ours to do.
      </p>

      <div className="section-h">From an agent</div>
      <Cmd text={`npx -y ${TARBALL} mcp`} label="MCP server, one command" />
      <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)" />

      <div className="section-h">From a shell</div>
      <Cmd text={`npx -y ${TARBALL} search "sidebar"`} label="search" />
      <Cmd text={`npx -y ${TARBALL} get thinking-states`} label="one item, with its source" />
      <Cmd text={`npx -y ${TARBALL} stats`} label="counts per source" />

      <div className="section-h">Pinning</div>
      <p className="hint">
        <code>latest</code> moves. To pin, use the versioned file and check it against
        <a href="https://rx3asarc.github.io/design-catalog/data/CHECKSUMS.txt"> CHECKSUMS.txt</a> —{" "}
        <code>data/design-catalog-{VERSION}.tgz</code>. Every published file has its sha256 listed there.
      </p>
      <p className="hint">
        This site is built out of the catalogue it describes:{" "}
        <a href="#/chrome">what it is made of, counted from the page</a>.
      </p>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(() => location.hash);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const phone = usePhone();
  useEffect(() => {
    const on = () => { setHash(location.hash); setMenu(false); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const active = hash.startsWith("#/i/") ? byId.get(hash.slice(4)) : undefined;

  const [from, setFrom] = useState<string>("");

  const tree = useMemo<TreeSection[]>(() => {
    const needle = q.trim().toLowerCase();
    const hit = items.filter((i) => (!from || i.source === from) &&
      (!needle || `${i.name} ${i.slug} ${i.source} ${i.kind} ${(i as any).category ?? ""}`.toLowerCase().includes(needle)));
    // four sections, submenus under them, and a further level where a family is big
    const SECTIONS: [string, string[]][] = [
      ["Blocks and pages", ["Pages and blocks"]],
      ["Components", ["Navigation", "Forms and input", "Overlays and dialogs", "Actions and controls",
        "Feedback and status", "Layout and structure", "Content and text", "Charts and data", "Conversation and agent UI"]],
      ["Motion and effects", ["Motion and effects"]],
      ["Docs", ["Docs and guides"]],
    ];
    const fam = (rows: Item[], pick: (i: Item) => string) => {
      const m = new Map<string, Item[]>();
      for (const r of rows) {
        const k = pick(r);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(r);
      }
      return [...m.entries()]
        .map(([key, rs]) => ({ key, rows: rs.sort((a, b) => a.slug.localeCompare(b.slug)) }))
        .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
    };
    const subOf = (i: Item) => { const t = i.slug.split("-")[0]; return t.length < 3 ? i.slug : t; };
    const secondOf = (i: Item) => { const t = i.slug.split("-")[1]; return t && t.length > 1 ? t : i.slug; };
    const tree = SECTIONS.map(([label, cats]) => {
      const catNodes = cats.filter((c) => hit.some((i) => ((i as any).category ?? "Actions and controls") === c)).map((c) => {
        const rows = hit.filter((i) => ((i as any).category ?? "Actions and controls") === c);
        const families = fam(rows, subOf).map((f) => ({ ...f, subs: f.rows.length > 12 ? fam(f.rows, secondOf) : [] }));
        return { key: c, label: c, rows, families };
      });
      return { label, count: catNodes.reduce((n, c) => n + c.rows.length, 0), cats: catNodes };
    }).filter((s) => s.count > 0);
    return tree;
  }, [q, from]);

  const flat = useMemo(() => items.filter((i) => i.source === active?.source), [active?.source]);
  const idx = active ? flat.findIndex((i) => i.id === active.id) : -1;

  const rendered = items.filter((i) => i.variants.length).length;
  const rail = <RailTree tree={tree} activeId={active?.id} />;
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
      <SidebarInset className="page">
        {hash === "#/chrome" ? <ChromePage /> : null}
        {hash === "#/chrome" ? null : active
          ? <ItemPage item={active} prev={idx > 0 ? flat[idx - 1] : undefined} next={idx >= 0 ? flat[idx + 1] : undefined} />
          : <Home />}
      </SidebarInset>
    </SidebarProvider>
  );
}
