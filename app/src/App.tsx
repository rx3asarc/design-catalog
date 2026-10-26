import React, { Suspense, useEffect, useMemo, useState } from "react";
import manifest from "../manifest.json";
import { VERSION } from "./version";
import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Input } from "@/registry/new-york-v4/ui/input";
import { ScrollArea } from "@/registry/new-york-v4/ui/scroll-area";

type Variant = { label: string; module: string };
type Item = {
  id: string; source: string; slug: string; kind: string; name: string;
  one_line: string | null; url: string | null; licence: string; page: string | null;
  install: string | null; files: string[]; variants: Variant[]; withheld?: boolean;
  verdict?: { verdict: string; reason: string; ours_path?: string | null };
};

const items = manifest as unknown as Item[];
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
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Hide code" : "View code"}</button>
        {code && <Copy text={code} />}
        {fit && (
          <button onClick={() => setChoice(!fitted)} aria-pressed={fitted}>
            {fitted ? `Fit ${Math.round(fit.zoom * 100)}%` : "Fit"}
          </button>
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
          <button key={m} role="tab" aria-selected={pm === m} onClick={() => setPm(m)}>{m}</button>
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
        <Tabs value={sel ?? ""} onValueChange={setSel} className="file-tabs">
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
          <ScrollArea className="h-[560px] w-full">
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
        <Badge variant={item.withheld ? "outline" : "secondary"} className={`badge ${item.withheld ? "warn" : "ok"}`}>
          {item.withheld ? "source withheld" : "source included"}
        </Badge>
        <Badge variant="outline" className="badge">{item.licence}</Badge>
        {item.verdict && (
          <Badge variant="outline" className={`badge ${item.verdict.verdict === "rejected" ? "bad" : ""}`}>
            {item.verdict.verdict}
          </Badge>
        )}
        <Badge variant="outline" className="badge">{item.files.length} files</Badge>
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

function Home() {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.source] = (m[i.source] ?? 0) + 1;
    return m;
  }, []);
  const rendered = items.filter((i) => i.variants.length > 0).length;
  return (
    <div className="page-in">
      <h2 className="title">design catalog</h2>
      <p className="lede">
        {items.length} components, blocks, effects and doc pages from five libraries — {rendered} of them rendered
        here from their real source, the rest listed with their licence and our verdict.
      </p>
      <div className="section-h">Use it from an agent</div>
      <p className="hint">Run the catalogue as an MCP server. It exposes catalog_search, catalog_get and catalog_stats.</p>
      <Cmd text={`npx -y ${TARBALL} mcp`} label="any shell" />
      <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)" />

      <div className="section-h">Or from a shell</div>
      <p className="hint">The same data, no install step, no native build.</p>
      <Cmd text={`npx -y ${TARBALL} search "sidebar"`} label="search" />
      <Cmd text={`npx -y ${TARBALL} get thinking-states`} label="one item, with its source" />
      <Cmd text={`npx -y ${TARBALL} stats`} label="counts per source" />

      <div className="section-h">Pinning</div>
      <p className="hint">
        <code>latest</code> moves. To pin, use the versioned file and check it against
        <a href="https://rx3asarc.github.io/design-catalog/data/CHECKSUMS.txt"> CHECKSUMS.txt</a> —
        <code>data/design-catalog-{VERSION}.tgz</code>. Every published file has its sha256 listed there.
      </p>
      <div className="section-h">Sources</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {Object.entries(counts).map(([s, n]) => (
            <tr key={s} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 0" }}>{s}</td>
              <td style={{ padding: "8px 0", color: "var(--muted-foreground)" }}>
                {items.filter((i) => i.source === s && i.variants.length).length} rendered
              </td>
              <td style={{ padding: "8px 0", textAlign: "right", color: "var(--muted-foreground)" }}>{n} items</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [hash, setHash] = useState(() => location.hash);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => { setHash(location.hash); setMenu(false); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const active = hash.startsWith("#/i/") ? byId.get(hash.slice(4)) : undefined;

  const [from, setFrom] = useState<string>("");

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = items.filter((i) => (!from || i.source === from) &&
      (!needle || `${i.name} ${i.slug} ${i.source} ${i.kind} ${(i as any).category ?? ""}`.toLowerCase().includes(needle)));
    const order = ["Pages and blocks", "Conversation and agent UI", "Actions and controls", "Navigation", "Forms and input", "Overlays and dialogs", "Charts and data",
      "Feedback and status", "Layout and structure", "Content and text", "Motion and effects", "Docs and guides"];
    const subOf = (i: Item) => {
      const t = i.slug.split("-")[0];
      return t.length < 3 ? i.slug : t;
    };
    const out: { source: string; rows: Item[]; subs: { key: string; rows: Item[] }[] }[] = [];
    for (const c of order) {
      const rows = hit.filter((i) => ((i as any).category ?? "Actions and controls") === c);
      if (!rows.length) continue;
      const bySub = new Map<string, Item[]>();
      for (const r of rows) {
        const k = subOf(r);
        if (!bySub.has(k)) bySub.set(k, []);
        bySub.get(k)!.push(r);
      }
      const subs = [...bySub.entries()]
        .map(([key, rs]) => ({ key, rows: rs.sort((a, b) => a.slug.localeCompare(b.slug)) }))
        .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
      out.push({ source: c, rows, subs });
    }
    return out;
  }, [q, from]);

  const flat = useMemo(() => items.filter((i) => i.source === active?.source), [active?.source]);
  const idx = active ? flat.findIndex((i) => i.id === active.id) : -1;

  return (
    <div className={`cat${menu ? " menu-open" : ""}`}>
      <div className="topbar">
        <a className="brand" href="#/">design catalog</a>
        <button className="menu-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="rail">
          {menu ? "Close" : `Browse ${items.length}`}
        </button>
      </div>
      <aside className="rail" id="rail">
        <div className="rail-top">
          <h1><a href="#/" style={{ color: "inherit", textDecoration: "none" }}>design catalog</a></h1>
          <div className="meta">{items.length} items · {items.filter((i) => i.variants.length).length} rendered</div>
          <Input value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Filter components…" aria-label="Filter components" className="h-9" />
        </div>
        <div className="rail-filter">
        {["", "shadcn", "beui", "rareui", "beautifului", "transitions"].map((s) => (
          <Button key={s || "all"} size="sm" variant={from === s ? "default" : "outline"}
            className="h-8 rounded-full px-3 text-xs" onClick={() => setFrom(s)}>
            {s || "all sources"}
          </Button>
        ))}
      </div>
      <div className="rail-list">
          {grouped.map((g) => {
            // a family of one is just an item: only families with siblings earn a submenu
            const families = g.subs.filter((s) => s.rows.length > 1);
            const singles = g.subs.filter((s) => s.rows.length === 1).flatMap((s) => s.rows);
            const row = (i: Item) => (
              <a key={i.id} className="rail-item" href={`#/i/${i.id}`}
                aria-current={active?.id === i.id ? "page" : undefined} style={{ textDecoration: "none" }}>
                <span className={`dot ${i.variants.length ? "demo" : "none"}`} />
                <span className="t">{i.name}</span>
              </a>
            );
            return (
              <div key={g.source} className="rail-cat">
                <div className="rail-group">{g.source} · {g.rows.length}</div>
                {families.map((sub) => (
                  <details key={sub.key} className="rail-sub" open={sub.rows.length <= 4}>
                    <summary>
                      <span className="sub-n">{sub.key.replace(/-/g, " ")}{sub.key.endsWith("s") ? "" : "s"}</span>
                      <span className="sub-c">{sub.rows.length}</span>
                    </summary>
                    {sub.rows.map(row)}
                  </details>
                ))}
                {singles.map(row)}
              </div>
            );
          })}
        </div>
      </aside>
      <main className="page">
        {active
          ? <ItemPage item={active} prev={idx > 0 ? flat[idx - 1] : undefined} next={idx >= 0 ? flat[idx + 1] : undefined} />
          : <Home />}
      </main>
    </div>
  );
}
