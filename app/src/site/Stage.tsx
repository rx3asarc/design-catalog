import * as React from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/registry/new-york-v4/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/registry/new-york-v4/ui/toggle-group";
import { Copy } from "./Code";
import { DemoFrame, FRAME_SURFACE } from "./demo";
import { isMotionItem, useCode, type Item, type ItemFull, type Variant } from "./lib";

/**
 * The item page's stage: the four things a visitor needs in order to judge a component instead of glancing at
 * it — which theme it is in, how wide the viewport is, whether it moves, and how to watch it again — plus the one
 * header row, the variant strip and the frame those controls act on.
 *
 * The stage owns **state, the console and the frame**; the sizing path is still `demo.tsx`'s one `zoom` + `floor`,
 * reached through `DemoFrame`. Nothing here forks a second way to size a demo.
 *
 * `demo.tsx` imports the sizing constants below and this file imports `DemoFrame` and `FRAME_SURFACE` back: an
 * import cycle with no top-level use on either side (both read the other's bindings inside functions only), so
 * evaluation order cannot bite. It is the alternative to a second copy of `FLOOR` or of the paper table, and a
 * second copy of either is how two elements end up disagreeing about one colour.
 *
 * Every key it sets is §D-C's, and an absent key still means today's behaviour: the console opens on the site's
 * own theme, the full column, and the motion the operating system asked for.
 */

/** Phone, tablet, or the column the frame is actually in. `full` is 0 because its number is measured, not typed. */
export type StageWidth = "phone" | "tablet" | "full";
export type StageTheme = "light" | "dark";
export type Motion = "on" | "off";

/** The two widths that are a device rather than a measurement. 390 and 768 are CSS px, not device px. */
export const STAGE_PX: Record<StageWidth, number> = { phone: 390, tablet: 768, full: 0 };

/**
 * What a frame is tall before the demo has told us, by class (§D-C's `floor`), and what it is tall when the demo
 * says it fills its frame.
 *
 * Both numbers are measured, not typed: `scan2.py` mounts the first variant of every item in the manifest (486)
 * and reads the child's own `designCatalogDemo` height report. What that found, at each class's usual frame
 * width on this box:
 *
 *     class                         p25    p50    p75    p90
 *     block (120 items)             430    536    608   3000
 *     non-block (366: 133 comp, 233 pattern)   64    122    368    648
 *
 * **`floor` is the reservation while a demo has not reported** (still loading, threw, or cannot be measured).
 * Which way to be wrong flips by class, so the two classes are not treated alike:
 *
 *  - **block: 900 wide / 720 phone.** A block is a page. Its own p90 is 3000 and its p75 is 608, so a demo that
 *    lands above the reservation grows by 1.5–3 screens and takes the reader with it; one that lands below
 *    settles once, upward. Over-reserving is the benign direction here, so the reservation stays a page.
 *  - **non-block: 180.** The class's median is 122 and its p75 is 368: 180 sits between them so slightly more
 *    than half of non-block demos grow into place and the rest settle by shrinking a little. 90 — the number
 *    this replaces — was never measured and is below the class's median; it is also only 26 px above the
 *    child's own 64 px clamp, which is why a component demo could look like a strip.
 *
 * **`self` is the frame a demo gets when it reports height 0**, which the child sends when it sizes itself to
 * its frame (a `h-svh` page layout): there is no correct height to wait for, so the floor *is* the answer.
 * A self-sizing block gets a page (900/720); a self-sizing component gets 360, the class's measured p75.
 *
 * No demo in the manifest reports 0 today — 0 of 486 first variants, 0 of 754 variants in `scan3.py` — so this
 * branch is a guard rail rather than a live case. It is still the honest answer if a demo ever lands that does.
 */
export const FLOOR = { block: { wide: 900, phone: 720 }, other: 180 };
export const SELF_FLOOR = { block: { wide: 900, phone: 720 }, other: 360 };

export const SURFACE_MIN = { component: 200, block: 0 };

/**
 * THE CEILING, which is new in r9 and is the one thing above that changed: the floor is a *reservation* (what the
 * frame is tall before the demo answers), the cap is a *window* (what the canvas admits once it has). A 1,082 px
 * demo on `shadcn/form-formisch-complex` drew a 1,231 px canvas — more than a screen — so the reader had to walk
 * past a demo to find the next thing on the page. 560 is the number the review asked for and it is the code pane's
 * own ceiling (`.demo-code pre { max-height: 560px }`, r8): the two halves of one card now agree about the tallest
 * box either may draw.
 *
 * The frame is NOT shrunk to the cap. It still reports its own height, the floor above still reserves, and the
 * canvas scrolls what it admits — a squashed demo would be a lying demo, and a *clipped* one (overflow hidden)
 * would hide content with no way to reach it.
 */
export const CAP = 560;

export type Stage = {
  /** the theme the *demo* renders in. It is never the site's theme switch — this one repaints nothing but the stage */
  theme: StageTheme;
  /** true once the visitor picks a theme; until then the preview follows the site's own theme */
  pinned: boolean;
  width: StageWidth;
  motion: Motion;
  /** true when `motion=off` is the operating system's request rather than the visitor's */
  fromSystem: boolean;
  /** §D-C `replay` nonce. 0 means "not yet replayed", which is sent as no key at all */
  replay: number;
};

const systemTheme = (): StageTheme =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light";

const systemReduce = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export type StageApi = {
  stage: Stage;
  chooseTheme: (t: string) => void;
  followSite: () => void;
  chooseWidth: (w: string) => void;
  chooseMotion: (m: string) => void;
  replay: () => void;
};

/**
 * The stage's state, and the rules that make it a stage rather than four switches.
 *
 * Reduced motion defaults to the OS and is *overridden* deliberately, because the parent always sends an
 * explicit `motion=` — a stage that left the key off would be a stage whose "reduce" switch did nothing.
 * The preview theme defaults to the site's own and follows it until the visitor pins one, so a visitor who
 * flips the catalogue to dark does not have to flip every demo as well.
 *
 * It survives a variant switch by construction: the state lives here, above the variant index, so picking
 * "Outline" after "Ghost" does not reset the theme the visitor chose.
 */
export function useStage(): StageApi {
  const [stage, setStage] = React.useState<Stage>(() => {
    const reduce = systemReduce();
    return { theme: systemTheme(), pinned: false, width: "full", motion: reduce ? "off" : "on", fromSystem: reduce, replay: 0 };
  });

  // the site's theme switch lives in the rail and reskins <html>; an unpinned preview follows it there
  React.useEffect(() => {
    const read = () => setStage((s) => (s.pinned ? s : { ...s, theme: systemTheme() }));
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return {
    stage,
    // a single-value ToggleGroup sends "" when the picked item is clicked again: that is not a state
    chooseTheme: (t) => t && setStage((s) => ({ ...s, theme: t as StageTheme, pinned: true })),
    followSite: () => setStage((s) => ({ ...s, theme: systemTheme(), pinned: false })),
    chooseWidth: (w) => w && setStage((s) => ({ ...s, width: w as StageWidth })),
    chooseMotion: (m) => m && setStage((s) => ({ ...s, motion: m as Motion, fromSystem: false })),
    replay: () => setStage((s) => ({ ...s, replay: s.replay + 1 })),
  };
}

/** The motion sentence, said once, and never stronger than what the child can actually do. */
export const MOTION_NOTE =
  "Reduce motion stops CSS animation and transition in the demo. Motion driven by script — framer-motion, canvas, timers — keeps running: a parent frame cannot stop it.";

/* ── the readable name ───────────────────────────────────────────────────────────────────────────────────────
   A title is a name, not an address. 410 of the 769 items publish a slug as their `name` ("button",
   "form-formisch-complex"), so the page's `<h1>` used to be an address bar with a heading's step. The rule below
   is mechanical — it never invents a product name, it only re-spaces the one the manifest already published:

     · a name that already carries a capital or a space is the publisher's own words and is printed as it is
       ("Animated Sidebar", "Dynamic Island");
     · a single lowercase word is capitalised ("button" → "Button");
     · inside a slug, a known library word keeps its capital ("formisch" → "Formisch", "shadcn" → "Shadcn") and
       every other word is lowercase, because a slug is lowercase by construction;
     · `<subject>-<library>-<rest…>` is read as the library naming its subject, with the rest after a comma:
       `form-formisch-complex` → "Formisch form, complex" — the review's own example, derived, not typed.

   The library list is written down rather than guessed from a source name: a word is a library here only because
   somebody put it in this line. */
const LIBRARY = new Set([
  "formisch", "shadcn", "beui", "tanstack", "radix", "framer", "recharts", "valibot", "vaul", "cmdk",
  "base", "dnd", "primereact", "chakra", "mantine", "daisyui", "flowbite",
]);

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** An item's name as a title: "Button", "Animated Sidebar", "Formisch form, complex". See the table above. */
export function readableName(item: Item): string {
  const name = (item.displayName ?? item.name).trim();
  if (/\s/.test(name) || /[A-Z]/.test(name.slice(1))) return name;
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return name;
  if (words.length === 1) return cap(words[0]);
  if (LIBRARY.has(words[1])) {
    const [subject, library, ...rest] = words;
    return `${cap(library)} ${subject}${rest.length ? `, ${rest.join(" ")}` : ""}`;
  }
  return words.map((w, i) => (LIBRARY.has(w) || i === 0 ? cap(w) : w)).join(" ");
}

/* ── the sizes ────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * 32 px on a mouse, 44 px on a thumb — one number per input, not a compromise.
 *
 * The review measured "44 px segments vs 32 px Copy side by side" and asked for one height: 32 px. It is 32 px,
 * everywhere in the header row, on every viewport a mouse reaches. The design system's 44 px floor is about
 * *touch*, and `qa/tap_check.mjs` + `qa/mobile_state_check.mjs` hold it there, where it applies: below 640 px
 * every control in this row is 44 px and the settings move into one popover, so a 375 px screen gets one compact
 * row rather than three wrapped ones.
 */
const H = { desk: 32, touch: 44 };

/**
 * The **canvas'** width, not the window's.
 *
 * The review measured the header row as three wrapped rows on a component's page: a component's stage sits in a
 * ~700 px column even on a 1440 px screen, so `THEME / WIDTH / MOTION` had nowhere to go and `.stage-settings`
 * wrapped into a stack. A row that fits at 1036 px does not fit at 696, and the window width cannot know that. So the
 * row asks the box it is in — the same question `@container stage` asks in `styles.css` — and folds the three groups
 * into one `Stage` popover when the answer is narrow. One row, every width.
 */
function useCanvasNarrow(ref: React.RefObject<HTMLElement | null>, at = 780): boolean {
  const [n, setN] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setN(el.clientWidth > 0 && el.clientWidth < at);
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [ref, at]);
  return n;
}

/* 12 px is the design system's `label` step and this site's floor: nothing it owns is smaller. */
const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
  whiteSpace: "nowrap",
};

const segItem = (h: number): React.CSSProperties => ({ height: h, minHeight: h, padding: "0 8px", fontSize: 12, fontWeight: 500, lineHeight: `${h}px` });

/**
 * The track of one group: `surface-300` (the grey the canvas used to be) inside a `border-strong` hairline.
 *
 * The selected segment is painted by the r9 block at the foot of `styles.css`: `surface-100` fill, an inset
 * `border-strong` outline, `ink` text, weight 600. That is the review's own prescription ("surface-100 on a
 * surface-300 track") and it is why the track is NOT `surface-200` any more: on a `surface-300` track the
 * selected chip is one whole surface step darker than its neighbours *and* outlined, so the state survives being
 * seen rather than being read (r8 painted `surface-300` on `surface-300` and showed the selection with weight
 * alone — measured, 0 px of painted difference).
 */
const track: React.CSSProperties = {
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-300)",
  padding: 0,
};

/** True below `px`, where the header row is one compact row and the settings live behind one button. */
function useNarrow(px = 640) {
  const [narrow, setNarrow] = React.useState(() => typeof matchMedia === "function" && matchMedia(`(max-width: ${px - 1}px)`).matches);
  React.useEffect(() => {
    const mq = matchMedia(`(max-width: ${px - 1}px)`);
    const read = () => setNarrow(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, [px]);
  return narrow;
}

/** The window's width, read once and on change: a width preset wider than the screen is not a preset. */
function useViewport() {
  const [w, setW] = React.useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  React.useEffect(() => {
    const read = () => setW(window.innerWidth);
    read();
    addEventListener("resize", read);
    return () => removeEventListener("resize", read);
  }, []);
  return w;
}

/**
 * One cluster: a visible word, then the control. The gap is 8 px, which is the review's measured rule
 * ("label→control 9 px → 8 px"). `word` is empty where the segment's own text already says what the group is
 * ("light / dark", "390 / 768 / full"): a label that repeats its control is the label the phone review found
 * standing alone with nothing to label.
 */
function Cluster({ word, hint, children }: { word: string; hint: string; children: React.ReactNode }) {
  return (
    <span className="stage-cluster" title={hint} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {word ? <span className="stage-label" style={mono}>{word}</span> : null}
      {children}
    </span>
  );
}

/**
 * The three settings, in one group, at one height.
 *
 * The theme, width and motion groups are one `role="group"` named for the item, and each group inside it is a
 * `role="radiogroup"` with `role="radio"` items and `aria-checked` — the correct pattern for "one of n", and the
 * reason no `aria-pressed` appears anywhere in this file. One tab stop per group (the checked item), arrows to
 * move: the registry's `ToggleGroup` renders every item `tabindex="-1"` and its roving-focus wrapper does not put
 * a stop back, so a Tab walk from the top of the page would otherwise never reach the console.
 *
 * A width preset wider than the window is not offered (a 375 px screen was shown "768" and "full" and could use
 * neither). The rule is the window's own width, so it is read at render and on resize, and it can never hide the
 * preset a visitor is standing on.
 */
function Settings({ item, api, canReplay, h, words, noteId }: { item: Item; api: StageApi; canReplay: boolean; h: number; words: boolean; noteId: string }) {
  const { stage } = api;
  const vw = useViewport();
  const widths: StageWidth[] = (["phone", "tablet", "full"] as StageWidth[]).filter(
    (w) => w === "full" || STAGE_PX[w] <= vw || stage.width === w,
  );
  const stop = (on: boolean) => (on ? 0 : -1);
  return (
    <div data-stage-settings={item.id} role="group" aria-label={`Stage for ${readableName(item)}`} className="stage-settings">
      <Cluster word={words ? "theme" : ""} hint="The demo only. The catalogue keeps its own theme.">
        <ToggleGroup
          type="single" variant="outline" style={track} value={stage.theme} onValueChange={api.chooseTheme}
          aria-label="Preview theme — the demo only, not the catalogue"
        >
          <ToggleGroupItem value="light" style={segItem(h)} tabIndex={stop(stage.theme === "light")} aria-label="Preview the demo in light">light</ToggleGroupItem>
          <ToggleGroupItem value="dark" style={segItem(h)} tabIndex={stop(stage.theme === "dark")} aria-label="Preview the demo in dark">dark</ToggleGroupItem>
        </ToggleGroup>
        {stage.pinned && (
          <Button variant="ghost" style={{ height: h, minHeight: h, padding: "0 8px", fontSize: 12 }} onClick={api.followSite}
            aria-label="Stop overriding the theme: follow the catalogue's own theme again">
            follow site
          </Button>
        )}
      </Cluster>

      <Cluster word={words ? "width" : ""} hint="The demo's viewport. Narrower than the phone width, the frame is scaled to fit rather than clipped.">
        <ToggleGroup
          type="single" variant="outline" style={track} value={stage.width} onValueChange={api.chooseWidth}
          aria-label="Demo viewport width"
        >
          {widths.map((w) => (
            <ToggleGroupItem key={w} value={w} style={segItem(h)} tabIndex={stop(stage.width === w)}
              aria-label={w === "full" ? "Full column width" : `${w === "phone" ? "Phone" : "Tablet"} viewport, ${STAGE_PX[w]} CSS pixels`}>
              {w === "full" ? "full" : STAGE_PX[w]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Cluster>

      <Cluster word="motion" hint={MOTION_NOTE}>
        <ToggleGroup
          type="single" variant="outline" style={track} value={stage.motion} onValueChange={api.chooseMotion}
          aria-label="Demo motion: on, or off (reduced motion)"
          aria-describedby={stage.motion === "off" ? noteId : undefined}
        >
          <ToggleGroupItem value="on" style={segItem(h)} tabIndex={stop(stage.motion === "on")} aria-label="Motion on: the demo animates">on</ToggleGroupItem>
          <ToggleGroupItem value="off" style={segItem(h)} tabIndex={stop(stage.motion === "off")} aria-label="Motion off: CSS animation and transition stopped">off</ToggleGroupItem>
        </ToggleGroup>
      </Cluster>

      {canReplay && (
        <Button variant="outline" style={{ height: h, minHeight: h, padding: "0 9px", fontSize: 12 }}
          onClick={api.replay} aria-label="Replay this demo from the start">
          ↻<span className="stage-replay-word"> Replay</span>
        </Button>
      )}
    </div>
  );
}

/* ── the stage ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ONE stage for the item, and the variants as a strip beside it.
 *
 * The page used to mount one `Demo` card per variant, and every card carried its own header — theme switch,
 * width, motion, Preview/Code, Copy. On `shadcn/button` that was the same toolbar **14 times**, "Default"
 * printed twice, and 4,956 px of canvas. Now there is one header row (the demo's own name on the left, the views
 * and Copy on the right, the settings in one group beside them), one frame, and a strip of the variants that
 * swaps what the frame shows. The stage's state is above that strip, so a theme chosen on "Default" is still
 * chosen on "Outline" — the switch changes the demo, not the stage.
 *
 * The canvas paints **the demo's own paper** (`FRAME_SURFACE[stage.theme].ink`): the surface is the theme the
 * demo is in, so a light demo on a dark site gets a light stage, exactly as the demo itself would paint it. That
 * is what removes the "slab": before this, the canvas was the site's `surface-300` (#18181b dark / #f4f4f5 light)
 * and the frame inside it painted the demo's own `--background` (#09090b / #fff) edge to edge — two colours in one
 * box, in both themes, and in mixed themes the second one was the whole demonstration.
 *
 * The paper is a constant shared with the frame element (`FRAME_SURFACE`, `site/demo.tsx`), not a second reading
 * of the palette: the canvas, the frame's own box and the demo document's root measure the same painted value,
 * which `qa/demo_theme_check.mjs` reads back.
 */
export function ItemStage({ item, api }: { item: ItemFull; api: StageApi }) {
  const variants = item.variants;
  const [vi, setVi] = React.useState(0);
  const [view, setView] = React.useState<"preview" | "code">("preview");
  // a different item in the same route is a different stage: back to the first demo, in preview
  React.useEffect(() => { setVi(0); setView("preview"); }, [item.id]);
  const at = Math.min(vi, Math.max(0, variants.length - 1));
  const variant: Variant = variants[at];
  const narrow = useNarrow();
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const canvasNarrow = useCanvasNarrow(canvasRef);
  const fold = narrow || canvasNarrow;
  const h = narrow ? H.touch : H.desk;
  const paper = FRAME_SURFACE[api.stage.theme];
  const code = useCode(variant?.module ?? null);
  const canReplay = isMotionItem(item);
  const noteId = `stage-motion-note-${item.id.replace(/[^a-zA-Z0-9]+/g, "-")}`;

  if (!variant) return null;
  return (
    <div className="stage" data-stage={item.id}>
      <div
        ref={canvasRef}
        className="stage-canvas"
        data-stage-theme={api.stage.theme}
        style={{ background: paper.ink, colorScheme: api.stage.theme }}
      >
        {/* ── the one header row ─────────────────────────────────────────────────────────────────────────────
            Left: the name of the demo in the frame ("Default"). Right: the settings, the two views and Copy,
            all at 32 px on a mouse and 44 px on a thumb. On a phone the settings fold into one `Stage` button so
            the row stays ONE row instead of the three wrapped rows the review measured at 375 px.

            The row keeps the site's own surface (`surface-300`, `styles.css`) rather than the demo's paper: it is
            chrome, and chrome follows the catalogue. That matters when the stage previews the other theme — a
            light demo inside a dark site has the site's ink on the site's band, and the demo's paper starts
            below it. */}
        {/* The bar is the **row**, not the settings inside it: the row is what always exists, and it is the thing a
            reader measures. `data-stage-bar` used to sit on the settings group, so folding those three groups into
            the `Stage` popover (below 780 px of canvas) made the bar itself disappear — and with it every assertion
            that reads it. */}
        <div className="stage-head" data-stage-head={item.id} data-stage-bar={item.id} role="group" aria-label={`Stage for ${readableName(item)}`}>
          <span className="stage-name" title={`${readableName(item)} — ${variant.label}`}>{variant.label}</span>
          <span className="stage-sp" />
          {fold ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" style={{ height: h, minHeight: h, padding: "0 12px", fontSize: 12 }} aria-label="Stage settings: theme, width and motion">
                  Stage
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="stage-pop" aria-label="Stage settings">
                <Settings item={item} api={api} canReplay={canReplay} h={H.touch} words noteId={noteId} />
              </PopoverContent>
            </Popover>
          ) : (
            <Settings item={item} api={api} canReplay={canReplay} h={h} words={false} noteId={noteId} />
          )}
          <div className="stage-views" role="tablist" aria-label={`Preview or code: ${variant.label}`}>
            {([["preview", "Preview"], ["code", "Code"]] as const).map(([value, word]) => (
              <Button
                key={value}
                data-catalog-item="shadcn/button"
                role="tab"
                aria-selected={view === value}
                variant="ghost"
                className="stage-view"
                style={{ height: h, minHeight: h, padding: "0 12px", fontSize: 12 }}
                onClick={() => setView(value)}
              >
                {word}
              </Button>
            ))}
          </div>
          {code && (
            <Copy
              text={code}
              label="Copy demo"
              detail={`${variant.label} · ${variant.module.split("/").pop()}`}
            />
          )}
        </div>

        {/* what `motion=off` actually did, as a live region under the row it describes — never inside it: a
            sentence of this length in a 32 px band is a row that is three rows tall */}
        {api.stage.motion === "off" && (
          <p id={noteId} role="status" className="stage-note">
            CSS motion stopped{api.stage.fromSystem ? " — your system asks for reduced motion" : ""}. Demos that animate with JavaScript keep running.
          </p>
        )}

        {/* the variants, as one strip: a horizontal scroller rather than 14 headers, so 14 demos cost one row */}
        {variants.length > 1 && (
          <Tabs value={String(at)} onValueChange={(v) => setVi(Number(v))} className="stage-tabs-wrap">
            <TabsList aria-label={`Demos of ${readableName(item)}`} className="stage-tabs">
              {variants.map((v, i) => (
                <TabsTrigger key={v.module} value={String(i)} className="stage-tab" title={v.label}>
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {view === "preview" ? (
          <StageFrame item={item} api={api} variant={variant} index={at} isBlock={item.kind === "block"} paper={paper} />
        ) : (
          <div className="stage-win stage-code">
            <pre>{code ?? "loading…"}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The window the frame is drawn in: centred, and capped at `CAP` px with the demo scrolling inside.
 *
 * The frame is measured once here (the lane's width) and sized once (`zoom`), which is the same arithmetic
 * `site/demo.tsx`'s `Demo` does for a gallery card — one lane, one target, one zoom:
 *
 *  - **target** is the mode: 390 or 768 CSS px, or the lane itself for `full`;
 *  - **room** is how much of that target the lane can show unscaled;
 *  - **content** is what the child says its own content needs (`natW`), so a demo that cannot reflow is scaled
 *    rather than clipped;
 *  - **zoom** is the smaller of the two, never above 1. The child *lays out* at the target width and only the
 *    paint is smaller: the frame is never given a scaled-down viewport pretending to be a phone.
 *
 * `width/height` are the frame's box in CSS px; the box is centred with `margin: 0 auto`, which is the review's
 * "centre the demo" — a phone-width frame in a 1,036 px canvas used to sit against the left edge of its slab.
 */
function StageFrame({ item, api, variant, index, isBlock, paper }: {
  item: ItemFull; api: StageApi; variant: Variant; index: number; isBlock: boolean;
  paper: { ink: string; rule: string };
}) {
  const { stage } = api;
  const lane = React.useRef<HTMLDivElement>(null);
  const [laneW, setLaneW] = React.useState(0);
  const [natW, setNatW] = React.useState(0);
  React.useEffect(() => {
    const el = lane.current;
    if (!el) return;
    /* the lane's *content* width, not its box: `clientWidth` counts the padding, and the 16 px of air on each side
       is air the frame may not use. Measured at 1440 before this line existed: a 694 px frame in a 662 px lane,
       i.e. a horizontal overflow of 32 px inside a scroller that cannot scroll sideways. */
    const read = () => {
      const cs = getComputedStyle(el);
      setLaneW(Math.max(0, el.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0")));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onSize = React.useCallback((m: { height: number; width: number }) => { if (m.width > 0) setNatW(m.width); }, []);
  // a variant switch is a different demo: forget what the last one said its content needed
  React.useEffect(() => { setNatW(0); }, [variant.module]);

  const target = stage.width === "full" ? laneW : STAGE_PX[stage.width];
  const want = target || laneW;
  const room = want > 0 && laneW > 0 ? Math.min(1, laneW / want) : 1;
  const content = natW > want && want > 0 ? want / natW : 1;
  const zoom = Math.min(1, room * content);
  const rendered = want > 0 && laneW > 0 ? want * zoom : undefined;
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches;
  const floor = isBlock ? (phone ? FLOOR.block.phone : FLOOR.block.wide) : FLOOR.other;
  const selfFloor = isBlock ? (phone ? SELF_FLOOR.block.phone : SELF_FLOOR.block.wide) : SELF_FLOOR.other;
  return (
    <div className="stage-win" tabIndex={0} role="region" aria-label={`Demo frame: ${variant.label}. Scroll inside it if the demo is taller than the window.`}>
      <div className="stage-lane" ref={lane}>
        <div className="stage-screen"
          data-frame-surface={stage.theme}
          style={{
            width: rendered ?? "100%",
            background: paper.ink,
            // a narrowed frame gets a hairline so the 390 px viewport is visible *as* a viewport; at full width
            // the frame IS the canvas and a rectangle inside it would be a box drawn around nothing
            outline: stage.width === "full" ? undefined : `1px solid ${paper.rule}`,
            outlineOffset: -1,
          }}
        >
          <DemoFrame
            id={item.id} index={index} zoom={zoom} floor={floor} selfFloor={selfFloor}
            frameWidth={want || undefined} onSize={onSize}
            addr={{ theme: stage.theme, motion: stage.motion, replay: stage.replay > 0 ? stage.replay : undefined }}
          />
        </div>
      </div>
    </div>
  );
}
