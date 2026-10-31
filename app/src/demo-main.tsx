/* One demo, rendered in its own document. Portals, fixed panels and z-index stay inside this
   frame, so a rendered sidebar can never sit on top of the catalogue's own rail. */
import "./styles.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import manifest from "../manifest.json";

class Boundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message ?? e) }; }
  render() {
    if (this.state.err)
      return (
        <p style={{ font: "13px/1.5 ui-sans-serif, system-ui", color: "var(--danger)", margin: 16 }}>
          This demo throws in our build: <code>{this.state.err.slice(0, 220)}</code>
        </p>
      );
    return this.props.children;
  }
}

const modules = import.meta.glob("./demos/**/*.tsx");

/**
 * The address, in one place: `#<id>|<index>[|k=v]…` (§D-C), with the same keys also honoured from the query
 * string. Every key is optional and an absent key means today's behaviour, so `demo.html#<id>|<i>` — every link
 * the catalogue has ever published, and all 486 item pages — parses to exactly what it parsed to before. An
 * unknown segment, or a key this build does not know, is ignored rather than thrown on: a demo broken by a
 * typo in a URL is worse than a demo that ignores it.
 */
function address() {
  const seg = decodeURIComponent(location.hash.slice(1)).split("|");
  const flags: Record<string, string> = {};
  for (const s of seg.slice(2)) {
    const eq = s.indexOf("=");
    if (eq > 0) flags[s.slice(0, eq)] = s.slice(eq + 1);
  }
  try {
    new URLSearchParams(location.search).forEach((v, k) => { if (!(k in flags)) flags[k] = v; });
  } catch { /* a malformed query is not the frame's problem */ }
  return { id: seg[0], index: seg[1], flags };
}

let addr = address();
let id = addr.id;
let index = addr.index;
let flags = addr.flags;
let item = (manifest as any[]).find((i) => i.id === id);
let variant = item?.variants?.[Number(index) || 0];

const isStatic = () => flags.static === "1";
/** `motion=off` wins; unset means "follow the OS", which is what the catalogue sets no rule for today. */
const motionOff = () =>
  flags.motion === "off" ||
  (flags.motion === undefined &&
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches);

/**
 * The three rules §D-C needs in the child, and nothing else: motion off stops animation and transition,
 * `static` freezes CSS animations on their first frame (JS-driven motion cannot be frozen from here — the
 * gallery's mount cap is the real control), and play/pause flips the freeze after mount.
 */
function styles() {
  const el = document.createElement("style");
  el.textContent =
    "html.motion-off *,html.motion-off *::before,html.motion-off *::after{animation:none!important;transition:none!important}" +
    "html.dc-static *,html.dc-static *::before,html.dc-static *::after{animation-play-state:paused!important}";
  document.head.appendChild(el);
}

function applyFlags() {
  const doc = document.documentElement;
  /*
   * The theme, in the same three-way order the boot script in `demo.html` uses: this frame's own `theme=` key,
   * else the site's resolved theme (the class its own boot script painted on the parent's `<html>`), else the
   * class already on this root — which the boot script resolved before the first paint. A hash change that
   * carries no theme therefore leaves the theme alone instead of resetting the document to light.
   */
  const flagged = flags.theme === "dark" || flags.theme === "light" ? flags.theme : null;
  const theme = flagged ?? (doc.classList.contains("dark") ? "dark" : "light");
  doc.classList.toggle("dark", theme === "dark");
  doc.classList.toggle("light", theme !== "dark");
  /* the UA's own widgets and scrollbars inside the demo follow the demo's theme, not the OS's */
  doc.style.colorScheme = theme;
  doc.classList.toggle("motion-off", motionOff());
  doc.classList.toggle("dc-static", isStatic());
}

function reread() {
  addr = address();
  id = addr.id;
  index = addr.index;
  flags = addr.flags;
  item = (manifest as any[]).find((i) => i.id === id);
  variant = item?.variants?.[Number(index) || 0];
}

function frameRetry() {
  // one full reload picks up the current html and its current chunk names
  const k = "designCatalogRetried";
  if (!sessionStorage.getItem(k)) {
    sessionStorage.setItem(k, "1");
    location.reload();
  }
}

function report() {
  (window as any).__reports = ((window as any).__reports || 0) + 1;
  // a demo that fills the viewport (h-svh blocks) reports its own frame; one that is shorter reports itself
  const doc = document.documentElement;
  const root = document.getElementById("root")!;
  const kids = [...root.children] as HTMLElement[];
  // #root is stretched by the base stylesheet, so measure the demo's own box, not its container
  const top = root.getBoundingClientRect().top;
  const content = kids.length
    ? Math.ceil(Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) - top)
    : 64;
  const h = Math.min(Math.ceil(doc.scrollHeight > doc.clientHeight + 2 ? doc.scrollHeight : Math.max(content, 64)), 3000);
  // a demo that sizes itself to the viewport (h-svh page layouts) cannot be measured from inside:
  // growing the frame grows the demo. Report 0 and let the catalogue keep its block-sized floor.
  const viewportSized = [...root.querySelectorAll<HTMLElement>("*")].some((el) => {
    const cs = getComputedStyle(el);
    return /vh|svh|dvh|lvh/.test(cs.minHeight) || /vh|svh|dvh|lvh/.test(cs.height);
  });
  // How wide the demo's own content is, reported alongside the height: a tile cannot measure the inside of its
  // own frame, so the child says it. It is the demo's content box, not the viewport — a 90px button in a 768px
  // frame reports 90, which is what lets a tile zoom *in* on a small component instead of showing a speck.
  // Adding a key is safe: every listener filters on designCatalogDemo/id/index and ignores what it does not know.
  const own = kids.length
    ? Math.ceil(Math.max(...kids.map((k) => Math.max(k.getBoundingClientRect().width, k.scrollWidth))))
    : 0;
  const width = Math.min(own, 6000);
  parent.postMessage({ designCatalogDemo: true, id, index: Number(index) || 0, height: viewportSized ? 0 : h, width }, "*");
}

function App() {
  const [Mod, setMod] = React.useState<React.ComponentType | null>(null);
  const [why, setWhy] = React.useState<string | null>(null);
  const key = variant ? `./${variant.module.replace(/^\.?\//, "")}` : "";
  React.useEffect(() => {
    if (!variant) { setWhy(`no variant at index ${index} for ${id}`); return; }
    const load = modules[key];
    if (!load) { setWhy(`no module at ${key} (manifest has ${Object.keys(modules).length} modules)`); return; }
    // a chunk from a build that has since been replaced is a cache-skew error, not a broken demo:
    // retry once with a cache-busting query before calling it a failure
    const retry = (mod: string, attempt: number): Promise<any> =>
      attempt === 0
        ? (load as () => Promise<any>)()
        : import(/* @vite-ignore */ `/design-catalog/assets/${mod.split("/").pop()}`);
    (load as () => Promise<any>)()
      .then((m) => setMod(() => m.default))
      .catch((e) => {
        if (/dynamically imported module|Importing a module script failed/i.test(String(e))) {
          setWhy("loading, then reloading the frame");
          frameRetry();
        } else setWhy(String(e).slice(0, 200));
      });
  }, []);
  React.useEffect(() => {
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    report();
    return () => ro.disconnect();
  }, [Mod]);
  if (!variant) return <p style={{ font: "13px ui-sans-serif", margin: 16 }}>No demo for this item.</p>;
  if (why) return <p style={{ font: "13px/1.5 ui-sans-serif", margin: 16, color: "var(--danger)" }}>{why}</p>;
  return <Boundary>{Mod ? <Mod /> : null}</Boundary>;
}

/* ---- boot: the frame's own address, then the document ----
   Everything below is additive: with no flags in the address, this is the document the catalogue shipped before. */
styles();
applyFlags();

// §D-C's one child→parent event, and only in thumbnail mode, where the parent has something to do with it.
if (isStatic()) {
  const phase = (p: "enter" | "leave") =>
    parent.postMessage({ designCatalogHover: true, id, index: Number(index) || 0, phase: p }, "*");
  document.documentElement.addEventListener("pointerenter", () => phase("enter"));
  document.documentElement.addEventListener("pointerleave", () => phase("leave"));
}
// The parent's half of hover-to-play: `true` unfreezes CSS animation, `false` freezes it again. Registered in
// every frame, so a non-static one can also be asked to rest — it simply has nothing frozen to show.
addEventListener("message", (e) => {
  const d = e.data;
  if (!d || typeof d.designCatalogPlay !== "boolean") return;
  document.documentElement.classList.toggle("dc-static", !d.designCatalogPlay);
});

const root = createRoot(document.getElementById("root")!);
root.render(<App key={flags.replay ?? "first"} />);

// A replay nonce in the address remounts the demo without reloading the document: the module stays warm, the
// component state does not. Only the nonce triggers it, so a theme or motion flag change does nothing here.
addEventListener("hashchange", () => {
  const before = flags.replay;
  reread();
  applyFlags();
  if (flags.replay !== before) root.render(<App key={flags.replay ?? "first"} />);
});