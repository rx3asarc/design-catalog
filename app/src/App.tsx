import React, { Suspense, useEffect, useMemo, useState } from "react";
import manifest from "../manifest.json";
import { VERSION } from "./version";

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
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied */ }
        setDone(true); setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : label}
    </button>
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

function Demo({ variant }: { variant: Variant }) {
  const [open, setOpen] = useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ needed: number; zoom: number; on: boolean } | null>(null);

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
        // on a desktop the card is wide enough that a slight zoom would be a surprise; auto-fit is a phone behaviour
        const auto = window.matchMedia("(max-width: 860px)").matches;
        setFit({ needed, zoom: Math.max(0.3, Math.min(1, avail / needed)), on: auto });
      } else {
        setFit(null);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [variant.module]);

  const zoom = fit?.on ? fit.zoom : 1;
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
          <button onClick={() => setFit({ ...fit, on: !fit.on })} aria-pressed={fit.on}>
            {fit.on ? `Fit ${Math.round(fit.zoom * 100)}%` : "Fit"}
          </button>
        )}
      </header>
      <div className="demo-body" ref={box}>
        <div ref={canvas} style={{ zoom, width: "100%" }}>
          <Boundary>
            <Suspense fallback={<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>mounting…</span>}>
              <Lazy />
            </Suspense>
          </Boundary>
        </div>
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
        <div className="tabs">
          {files.map((f) => (
            <button key={f} aria-selected={sel === f} onClick={() => setSel(f)} title={f}>
              {f.split("/").pop()}
            </button>
          ))}
        </div>
      )}
      <div className="cmd" style={{ borderRadius: "0 8px 0 0" }}>
        <span className="path">{sel}</span>
        {code && <Copy text={code} />}
      </div>
      <div className="demo" style={{ borderRadius: "0 0 8px 8px", borderTop: 0 }}>
        <div className="demo-code" style={{ borderTop: 0 }}>
          <pre>{code ?? "loading…"}</pre>
        </div>
      </div>
    </>
  );
}

function ItemPage({ item, prev, next }: { item: Item; prev?: Item; next?: Item }) {
  return (
    <div className="page-in">
      <div className="crumb">{item.source} · {item.kind}</div>
      <h2 className="title">{item.name}</h2>
      {item.one_line && <p className="lede">{item.one_line}</p>}
      <div className="badges">
        <span className={`badge ${item.withheld ? "warn" : "ok"}`}>
          {item.withheld ? "source withheld" : "source included"}
        </span>
        <span className="badge">{item.licence}</span>
        {item.verdict && <span className={`badge ${item.verdict.verdict === "rejected" ? "bad" : ""}`}>
          {item.verdict.verdict}
        </span>}
        <span className="badge">{item.files.length} files</span>
        {item.variants.length > 0 && <span className="badge">{item.variants.length} demo{item.variants.length > 1 ? "s" : ""}</span>}
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
        item.variants.map((v) => <Demo key={v.module} variant={v} />)
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

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = items.filter((i) => !needle || `${i.name} ${i.slug} ${i.source} ${i.kind}`.toLowerCase().includes(needle));
    const order = ["shadcn", "beui", "rareui", "beautifului", "transitions"];
    const out: { source: string; rows: Item[] }[] = [];
    for (const s of order) {
      const rows = hit.filter((i) => i.source === s);
      if (rows.length) out.push({ source: s, rows });
    }
    return out;
  }, [q]);

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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter components…" aria-label="Filter components" />
        </div>
        <div className="rail-list">
          {grouped.map((g) => (
            <div key={g.source}>
              <div className="rail-group">{g.source} · {g.rows.length}</div>
              {g.rows.map((i) => (
                <a
                  key={i.id}
                  className="rail-item"
                  href={`#/i/${i.id}`}
                  aria-current={active?.id === i.id ? "page" : undefined}
                  style={{ textDecoration: "none" }}
                >
                  <span className={`dot ${i.variants.length ? "demo" : "none"}`} />
                  <span className="t">{i.name}</span>
                </a>
              ))}
            </div>
          ))}
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
