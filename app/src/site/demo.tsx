import React, { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Copy } from "./Code";
import { key, useCode, type Variant } from "./lib";

/**
 * The live half of an item page: the frame a demo runs in, the demo card around it, and the hook that decides
 * whether a demo needs narrowing to fit.
 *
 * A demo runs in its own document (`demo.html`), so its portals and fixed panels cannot land on our rail. The
 * frame reports its own height back over postMessage; the page is never given an inner scroller.
 */

/** Demo modules are generated files that import the real component, so what renders is what the code pane shows. */
export const DEMOS = import.meta.glob("../demos/**/*.tsx") as Record<string, () => Promise<any>>;

/**
 * How much a demo has to be narrowed to fit the column, or null when it fits.
 *
 * Lifted out of `Demo` so a gallery can size a bare frame without the demo header, the Fit toggle or the code
 * pane: give it the outer box and the inner canvas, and it returns `{needed, zoom}`. It re-measures when the
 * outer box resizes, and when `dep` changes (the demo module, in `Demo`'s case).
 */
export function useFit(
  outer: React.RefObject<HTMLElement | null>,
  inner: React.RefObject<HTMLElement | null>,
  dep?: unknown,
) {
  const [fit, setFit] = useState<{ needed: number; zoom: number } | null>(null);
  React.useEffect(() => {
    const box = outer.current, canvas = inner.current;
    if (!box || !canvas) return;
    const measure = () => {
      // how wide does this demo really want to be? the widest scroller inside it is the honest answer
      let needed = canvas.scrollWidth;
      canvas.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.scrollWidth > needed) needed = el.scrollWidth;
      });
      const avail = box.clientWidth;
      if (needed > avail + 2) {
        setFit({ needed, zoom: Math.max(0.3, Math.min(1, avail / needed)) });
      } else {
        setFit(null);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [outer, inner, dep]);
  return fit;
}

/** A demo that throws is shown throwing, in place, with its message — never a blank box and never hidden. */
export class Boundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
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

/**
 * The demo frame. `{id, index, zoom, floor}` only — no required props were added, so an item page and any
 * later stage mount the same frame. `floor` is the height used until the demo reports its own.
 */
export function DemoFrame({ id, index, zoom, floor }: { id: string; index: number; zoom: number; floor: number }) {
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

/** The demo card: header with the code toggle and the Fit toggle, the frame, and the code pane when opened. */
export function Demo({ id, index, variant, isBlock }: { id: string; index: number; variant: Variant; isBlock: boolean }) {
  const [open, setOpen] = useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  // The measured canvas is a separate element and it is not attached anywhere in this card today, so `useFit`
  // short-circuits and the Fit toggle never appears. Kept exactly as it was: attaching it would start zooming
  // demos out on phones (Fit defaults on below 860px), which is a stage change, not a split.
  const canvas = React.useRef<HTMLDivElement>(null);
  const fit = useFit(box, canvas, variant.module);
  const [choice, setChoice] = useState<boolean | null>(null); // the user's Fit toggle wins over the default

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
