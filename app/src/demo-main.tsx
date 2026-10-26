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
        <p style={{ font: "13px/1.5 ui-sans-serif, system-ui", color: "oklch(0.55 0.17 25)", margin: 16 }}>
          This demo throws in our build: <code>{this.state.err.slice(0, 220)}</code>
        </p>
      );
    return this.props.children;
  }
}

const modules = import.meta.glob("./demos/**/*.tsx");
const [id, index] = decodeURIComponent(location.hash.slice(1)).split("|");
const item = (manifest as any[]).find((i) => i.id === id);
const variant = item?.variants?.[Number(index) || 0];

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
  parent.postMessage({ designCatalogDemo: true, id, index: Number(index) || 0, height: viewportSized ? 0 : h }, "*");
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
  if (why) return <p style={{ font: "13px/1.5 ui-sans-serif", margin: 16, color: "oklch(0.5 0.12 25)" }}>{why}</p>;
  return <Boundary>{Mod ? <Mod /> : null}</Boundary>;
}

createRoot(document.getElementById("root")!).render(<App />);
