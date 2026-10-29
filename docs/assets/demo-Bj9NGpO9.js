var e=`import React, { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Copy } from "./Code";
import { key, useCode, type Variant } from "./lib";
import { FLOOR, SELF_FLOOR, STAGE_PX, SURFACE_MIN, type Stage } from "./Stage";

/**
 * The live half of an item page: the frame a demo runs in, the demo card around it, and the hook that decides
 * whether a demo needs narrowing to fit.
 *
 * A demo runs in its own document (\`demo.html\`), so its portals and fixed panels cannot land on our rail. The
 * frame reports its own height back over postMessage; the page is never given an inner scroller.
 */

/** Demo modules are generated files that import the real component, so what renders is what the code pane shows. */
export const DEMOS = import.meta.glob("../demos/**/*.tsx") as Record<string, () => Promise<any>>;

/**
 * How much a demo has to be narrowed to fit the column, or null when it fits.
 *
 * Lifted out of \`Demo\` so a gallery can size a bare frame without the demo header, the Fit toggle or the code
 * pane: give it the outer box and the inner canvas, and it returns \`{needed, zoom}\`. It re-measures when the
 * outer box resizes, and when \`dep\` changes (the demo module, in \`Demo\`'s case).
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
 * What the gallery can ask a frame for, on top of the item and the variant index (§D-C). Every key is optional
 * and an absent key means today's behaviour: \`demo.html#<id>|<i>\` still renders exactly as it always did.
 */
export type FrameAddr = {
  /** thumbnail mode: the child freezes CSS animation until it is told to play */
  static?: boolean;
  /** \`light\` | \`dark\`, from the site's own theme — the child sets it on its \`<html>\` */
  theme?: "light" | "dark";
  /** \`off\` stops every animation and transition in the child */
  motion?: "on" | "off";
  /** remount nonce for a motion demo */
  replay?: number;
};

/** The child's address, built in one place: \`#<encodeURIComponent(id)>|<index>[|k=v]…\`. */
export function frameSrc(id: string, index: number, addr?: FrameAddr): string {
  const seg = [encodeURIComponent(id), String(index)];
  if (addr?.static) seg.push("static=1");
  if (addr?.theme) seg.push(\`theme=\${addr.theme}\`);
  if (addr?.motion) seg.push(\`motion=\${addr.motion}\`);
  if (addr?.replay !== undefined) seg.push(\`replay=\${addr.replay}\`);
  return \`/design-catalog/demo.html#\${seg.join("|")}\`;
}

/**
 * The demo frame. \`{id, index, zoom, floor}\` only — no required props were added, so an item page and any
 * later stage mount the same frame. \`floor\` is the height used until the demo reports its own.
 *
 * \`addr\` is the gallery's half of §D-C and \`onSize\` reports what the child measured (height always, width when
 * the child sends it). Neither changes what an item page renders today.
 */
export function DemoFrame({ id, index, zoom, floor, addr, play, onSize, frameWidth, selfFloor, stretch }: {
  id: string; index: number; zoom: number; floor: number;
  /** the height a demo gets when it reports 0, i.e. when it sizes itself to the frame */
  selfFloor?: number;
  /**
   * The height, **in the child's own CSS px**, that the frame must fill even when the demo is shorter: a tile
   * is a window of a fixed height, so a demo that honestly reports 60 px must still paint the 210 px it was
   * given, not a strip with 150 px of dead canvas under it. A stage is not a poster and never passes this, so
   * an absent \`stretch\` is exactly today's behaviour (\`shown = reported | selfFloor | floor\`). Additive: the
   * item page and every address written before this prop existed are untouched.
   */
  stretch?: number;
  addr?: FrameAddr; play?: boolean; onSize?: (m: { height: number; width: number }) => void;
  /**
   * The child's viewport in CSS px, when a stage has narrowed it. Absent = the frame fills its box, which is
   * every frame on every item page before this prop existed. The frame is then scaled by \`zoom\` like any other,
   * so the demo *lays out* at this width and only the paint is smaller — the child is never given a scaled-down
   * viewport pretending to be a phone.
   */
  frameWidth?: number;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
  const [h, setH] = React.useState(0); // 0 = not measured yet
  // the child said 0: it sizes itself to its frame, so there is no height to wait for and the floor is the answer
  const [self, setSelf] = React.useState(false);
  const grows = React.useRef(0);
  const locked = React.useRef(false);
  const sized = React.useRef(onSize);
  sized.current = onSize;
  React.useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.designCatalogDemo !== true || d.id !== id || d.index !== index) return;
      sized.current?.({ height: typeof d.height === "number" ? d.height : 0, width: typeof d.width === "number" ? d.width : 0 });
      // a viewport-filling demo can report its own frame back and grow without bound; clamp it
      if (typeof d.height !== "number" || locked.current) return;
      setSelf(d.height === 0);
      if (d.height <= 0) return;
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
  // a different item in the same slot is a different demo: forget what the last one measured
  React.useEffect(() => {
    setH(0); setSelf(false); grows.current = 0; locked.current = false;
  }, [id, index]);
  // the growth watch guards against a demo that grows without bound at one size — not against a visitor who
  // asked for a different viewport. A stage that changes the width grows the demo honestly, and if the watch
  // counted that, three mode changes would lock the frame to the floor for the rest of the visit.
  React.useEffect(() => {
    grows.current = 0; locked.current = false;
  }, [frameWidth, addr?.theme, addr?.motion, addr?.replay]);
  // a measurement wins over the fallback: the fallback is only for demos that cannot report, or that fill
  // whatever frame they are given. \`self\` is the child saying the second thing out loud.
  const said = h > 0 ? h : self ? selfFloor ?? floor : floor;
  // …and a tile is a window of a fixed height, so whatever the demo reported, the frame it paints on is at
  // least as tall as the window. \`stretch\` is absent everywhere but the gallery, where it is \`bodyH / zoom\`.
  const shown = stretch ? Math.max(said, stretch) : said;
  // no inner scroller: the frame is exactly as tall as the demo, and the page does the scrolling
  const cap = shown * zoom;
  React.useEffect(() => {
    frame.current?.setAttribute("title", \`\${id} demo\`);
  }, [id]);
  // §D-C's one parent→child message: play/pause for a frame the gallery mounted in thumbnail mode. It is sent
  // on every change and once on load, because the child's listener is not installed when the frame is created.
  const want = React.useRef(play);
  want.current = play;
  const ping = React.useCallback(() => {
    if (want.current === undefined) return;
    frame.current?.contentWindow?.postMessage({ designCatalogPlay: !!want.current }, "*");
  }, []);
  React.useEffect(() => { ping(); }, [play, ping]);
  return (
    <div ref={wrap} style={{ height: cap, overflow: "hidden", width: frameWidth ? frameWidth * zoom : "100%" }}>
      <iframe
        ref={frame}
        src={frameSrc(id, index, addr)}
        loading="lazy"
        onLoad={ping}
        style={{
          width: frameWidth ? frameWidth : \`\${100 / zoom}%\`,
          height: shown,
          border: 0,
          display: "block",
          transform: \`scale(\${zoom})\`,
          transformOrigin: "top left",
          background: "transparent",
          colorScheme: "light dark",
        }}
      />
    </div>
  );
}

/**
 * The ink a frame's own surface is painted with, per theme.
 *
 * The surface under a demo has to follow **the frame's** theme, not the site's: on an item page the stage can
 * preview \`dark\` while the catalogue is \`light\`, and a site token would then paint a white ring around a dark
 * demo (measured: \`--background\` is \`oklch(1 0 0)\` in both columns of that table before this existed).
 *
 * These two pairs are the values \`styles.css\` gives \`--background\` and \`--border\` in \`:root\` and in \`.dark\`
 * (styles.css:36-37 and :71/:79). They are restated because the stylesheet has no \`.light\` scope: \`class="dark"\`
 * on a wrapper would give a dark surface inside a dark site, but nothing in the shell can put the light palette
 * back inside \`html.dark\`. Two values, one table, one place — and the report reads them back off the running
 * child, so a palette change in \`styles.css\` shows up as a disagreement in the measurement instead of hiding.
 */
export const FRAME_SURFACE = {
  light: { ink: "oklch(1 0 0)", rule: "oklch(0.92 0.004 286.32)" },
  dark: { ink: "oklch(0.141 0.005 285.823)", rule: "oklch(1 0 0 / 10%)" },
} as const;

/** The demo card: header with the code toggle, the frame on its stage surface, and the code pane when opened. */
const SCALE_TEXT: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  // 11 px was the last sub-12 px text this unit owns; the readout is a number a visitor has to read
  fontSize: 12,
  letterSpacing: "0.02em",
  color: "var(--ink-muted)",
  whiteSpace: "nowrap",
};

export function Demo({ id, index, variant, isBlock, stage }: {
  id: string; index: number; variant: Variant; isBlock: boolean; stage: Stage;
}) {
  /**
   * Which view of the demo card is showing: the running demo, or its source.
   *
   * This was a button that said "View code" / "Hide code" — a disclosure, which is neither of the two switch
   * styles the design system publishes. \`SegmentedTabs\` is explicit about which one it is: "Use the segmented
   * control for views of the same item", Preview / Usage / Code, and "never use both styles on one row". A
   * running demo and its source are two views of one item, so the switch is the segmented control — track on
   * \`surface-200\` inside a \`border-strong\` outline, the selected segment on \`surface-300\` in \`ink\` with heavier
   * weight, never an accent fill. The two words are the two views' own names.
   */
  const [view, setView] = useState<"preview" | "code">("preview");
  // \`useFit\` is not called here: its measured canvas would have to live inside this card, and the demo renders in
  // its own document, so it always returned null and its Fit toggle never appeared (proved on this build: every
  // demo's \`fit\` is null). The stage's width control is the honest version of what Fit was reaching for, and the
  // measurement it needs — the demo's own content width — is the number the child reports. One sizing path.

  // ── the stage's half of the sizing: one lane, one target, one zoom ───────────────────────────────────────
  const lane = React.useRef<HTMLDivElement>(null);
  const [laneW, setLaneW] = useState(0);
  const [natW, setNatW] = useState(0); // what the child says its own content needs
  React.useEffect(() => {
    const el = lane.current;
    if (!el) return;
    const read = () => setLaneW(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onSize = React.useCallback((m: { height: number; width: number }) => {
    if (m.width > 0) setNatW(m.width);
  }, []);

  // the mode decides the child's viewport; the lane decides how much of that viewport can be shown unscaled
  const target = stage.width === "full" ? laneW : STAGE_PX[stage.width];
  const want = target || laneW; // before the first measure there is no lane: the frame simply fills it
  const room = want > 0 && laneW > 0 ? Math.min(1, laneW / want) : 1;
  const content = natW > want ? want / natW : 1; // a demo that cannot reflow is scaled, never clipped
  const zoom = Math.min(1, room * content);
  const rendered = want > 0 && laneW > 0 ? want * zoom : undefined;
  // no floor at 0.3 here, unlike \`useFit\`: the lane is a hard limit, and a demo too wide to reflow must stay inside it
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
  const floor = isBlock ? (phone ? FLOOR.block.phone : FLOOR.block.wide) : FLOOR.other;
  const selfFloor = isBlock ? (phone ? SELF_FLOOR.block.phone : SELF_FLOOR.block.wide) : SELF_FLOOR.other;
  // the stage surface: air around the demo, so a 44 px toolbar is a component on a stage and not a small white box.
  // It is painted in the frame's theme — the rule — because it is the paper the demo is rendered on. The card
  // around it, the header and the code pane stay the catalogue's own (they are chrome, and chrome follows the
  // site); the surface is the only element that touches the demo.
  const paint = FRAME_SURFACE[stage.theme];
  const screen: React.CSSProperties = {
    width: rendered ?? "100%",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: isBlock ? SURFACE_MIN.block : SURFACE_MIN.component,
    borderRadius: 10,
    overflow: "hidden",
    background: paint.ink,
    // form controls and scrollbars inside the surface follow the same theme the demo is in
    colorScheme: stage.theme,
    boxShadow: \`0 0 0 1px \${paint.rule}, 0 1px 2px rgba(0,0,0,0.05)\`,
  };

  const Lazy = useMemo(() => React.lazy(DEMOS[key(variant.module)] as any), [variant.module]);
  const code = useCode(variant.module);
  return (
    <section className="demo">
      <header className="demo-head">
        <span>{variant.label}</span>
        <span className="sp" />
        {/* what the frame really is, in the card that owns it: a 390 px viewport at 90% is not 390 px of screen */}
        {want > 0 && Math.round(zoom * 100) < 100 && (
          <span data-demo-scale={Math.round(zoom * 100)} style={SCALE_TEXT} aria-live="polite">
            {stage.width === "full" ? "column" : want} → {Math.round(zoom * 100)}%
          </span>
        )}
        {/*
          * The segmented control, from \`SegmentedTabs\`. \`role="tablist"\` with two \`role="tab"\` triggers is the
          * markup the guideline's preview uses; each segment is 44 px in both directions, so a phone thumb hits
          * it and the phone floor holds without a second rule. It is named with the variant, because an item with
          * fourteen demos has fourteen of these and "Preview or code" alone names none of them.
          */}
        <div className="seg" role="tablist" aria-label={\`Preview or code: \${variant.label}\`}>
          {([["preview", "Preview"], ["code", "Code"]] as const).map(([value, word]) => (
            <Button
              key={value}
              data-catalog-item="shadcn/button"
              role="tab"
              aria-selected={view === value}
              variant="ghost"
              size="sm"
              className="seg-item"
              onClick={() => setView(value)}
            >
              {word}
            </Button>
          ))}
        </div>
        {/* the demo module's own text — an import of a preview and three lines of wiring, not an install command.
            It is the first Copy on an item page, so it has to say what it is: "Copy demo source", and the
            variant plus the module file in its accessible name, because fourteen demos share this page and one
            "Copy demo source" would be fourteen indistinguishable buttons copying fourteen different files. */}
        {code && <Copy text={code} label="Copy demo source" detail={\`\${variant.label} · \${variant.module.split("/").pop()}\`} />}
      </header>
      {/* one view at a time, which is what a segmented control means: the frame when Preview is chosen, the
          demo module's own text when Code is. Both are the same card, and the Copy above is still the demo
          source whenever the code is on screen. */}
      {view === "preview" ? (
      <div className="demo-body">
        {/* the site's own phone gutter (\`styles.css\`: \`.demo-body > div { padding: 0 14px }\`) lands on this div;
            the lane below it is padding-free, so the width we measure is the width we can actually use */}
        <div style={{ width: "100%", minWidth: 0 }}>
          <div ref={lane} style={{ width: "100%", minWidth: 0 }}>
            <div style={screen} data-frame-surface={stage.theme}>
              <DemoFrame
                id={id} index={index} zoom={zoom} floor={floor} selfFloor={selfFloor}
                frameWidth={want || undefined} onSize={onSize}
                addr={{ theme: stage.theme, motion: stage.motion, replay: stage.replay > 0 ? stage.replay : undefined }}
              />
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="demo-code"><pre>{code ?? "loading…"}</pre></div>
      )}
    </section>
  );
}
`;export{e as default};