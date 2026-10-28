import * as React from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/registry/new-york-v4/ui/toggle-group";
import { type Item } from "./lib";

/**
 * The item page's stage: the four things a visitor needs in order to judge a component instead of glancing at
 * it — which theme it is in, how wide the viewport is, whether it moves, and how to watch it again.
 *
 * The stage owns **state and the console**; the frame itself is still `demo.tsx`'s `DemoFrame`, and the sizing
 * path is still its one `zoom` + `floor`. Nothing here forks a second way to size a demo.
 *
 * Every key it sets is §D-C's, and an absent key still means today's behaviour: the console opens on the site's
 * own theme, the full column, and the motion the operating system asked for — which is exactly what the item
 * page rendered before this file existed.
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

export type Stage = {
  /** the theme the *demo* renders in. It is never the site's theme switch — this one repaints nothing but the frame */
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

const mono: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  fontSize: 11,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--muted-foreground)",
  whiteSpace: "nowrap",
};

/** 44 px, on every control, at every width: the phone build's touch minimum, without a stylesheet edit. */
const HIT = 44;

/**
 * One tab stop per group, arrows inside it.
 *
 * The registry `ToggleGroup` renders every item with `tabindex="-1"`, and its roving-focus wrapper does not put
 * a tab stop back: measured, `document.querySelectorAll('[data-stage-bar] [role=radio]')` is 7 controls with
 * `tabindex=-1` and a Tab walk from the top of the page never reaches the console. A stage nobody can reach with
 * a keyboard is not a control, so the checked item of each group carries the stop, and Tab-Enter /
 * arrow-Enter both work (measured in the build report).
 */
const tabStop = (on: boolean) => (on ? 0 : -1);

const itemStyle: React.CSSProperties = { height: HIT, padding: "0 12px", fontSize: 12.5 };
const groupStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8 };

/**
 * One cluster: a visible word, then the control. Below 640 px the word is dropped and the control's own
 * `aria-label` carries it — six labelled rows of console above a 390 px demo is more chrome than demo.
 */
function Cluster({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }} title={hint}>
      {label ? <span style={mono}>{label}</span> : null}
      {children}
    </span>
  );
}

/** True below 640 px, where the console drops its visible words and keeps every accessible name. */
function useNarrow() {
  const [narrow, setNarrow] = React.useState(() => typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches);
  React.useEffect(() => {
    const mq = matchMedia("(max-width: 640px)");
    const read = () => setNarrow(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return narrow;
}

/**
 * The console. Four controls, each one wired to §D-C and to nothing else:
 *
 *  - **theme** `light` / `dark` → `theme=`, the demo's document only. The catalogue is not repainted.
 *  - **width** 390 / 768 / full → the frame's viewport. The child's own viewport is 390 CSS px in phone mode;
 *    if the column is narrower than that, the whole frame is scaled down (declared in the bar, `390 → 90%`).
 *  - **motion** `on` / `off` → `motion=`. Off stops CSS animation; the note says what it cannot stop.
 *  - **Replay** → `replay=<nonce>`. Rendered only where the item is motion, so it is never a dead button.
 */
export function StageBar({
  item, api, canReplay,
}: {
  item: Item;
  api: StageApi;
  canReplay: boolean;
}) {
  const { stage } = api;
  const narrow = useNarrow();
  const word = (w: string) => (narrow ? "" : w);
  const px = STAGE_PX[stage.width];
  const shown = stage.width === "full" ? "the column" : `${px} CSS px`;
  /**
   * The id of the sentence that says what `motion=off` *means* — and, when the OS asked for it, why.
   *
   * Every toggle in this console already reports its state to assistive technology: the three groups are
   * `role="radiogroup"` with `role="radio"` items and `aria-checked`, which is the correct pattern for "one of
   * n" and the reason no `aria-pressed` appears in this file (a pressed button would be the wrong control for a
   * single-choice group — measured before and after each click, in the build report). What a radio cannot say by
   * itself is the *consequence* of its state, so the group is described by the sentence the console prints when
   * motion is off, and that sentence is a live region: turning motion off is announced, not merely painted.
   */
  const noteId = `stage-motion-note-${item.id.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  return (
    <div
      data-stage-bar={item.id}
      role="group"
      aria-label={`Stage for ${item.name}`}
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px",
        padding: "10px 12px", margin: "0 0 14px",
        // Two surfaces, two owners. The console is chrome and follows the SITE's palette; the paper the demo is
        // rendered on is `demo.tsx`'s surface and follows the FRAME's (`FRAME_SURFACE[stage.theme]`) — that split
        // is the fix for the white-on-white island. This one stays the site's on purpose: a control strip that
        // turned dark because the *preview* did would be chrome lying about which theme the catalogue is in.
        // (And it is the only implementable answer anyway: `styles.css` has a `.dark` scope and no `.light` one,
        // so "the console follows the preview" would work in one direction and silently not in the other.)
        border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)",
      }}
    >
      <Cluster label={word("theme")} hint="The demo only. The catalogue keeps its own theme.">
        <ToggleGroup
          type="single" size="sm" variant="outline" style={groupStyle}
          value={stage.theme} onValueChange={api.chooseTheme}
          aria-label="Preview theme — the demo only, not the catalogue"
        >
          <ToggleGroupItem value="light" style={itemStyle} tabIndex={tabStop(stage.theme === "light")} aria-label="Preview the demo in light">light</ToggleGroupItem>
          <ToggleGroupItem value="dark" style={itemStyle} tabIndex={tabStop(stage.theme === "dark")} aria-label="Preview the demo in dark">dark</ToggleGroupItem>
        </ToggleGroup>
        {stage.pinned && (
          <Button variant="ghost" size="sm" style={{ height: HIT, padding: "0 8px", fontSize: 12 }} onClick={api.followSite}
            aria-label="Stop overriding the theme: follow the catalogue's own theme again">
            follow site
          </Button>
        )}
      </Cluster>

      <Cluster label={word("width")} hint={`The demo's viewport: ${shown}. Narrower than the phone width, the frame is scaled to fit rather than clipped.`}>
        <ToggleGroup
          type="single" size="sm" variant="outline" style={groupStyle}
          value={stage.width} onValueChange={api.chooseWidth}
          aria-label="Demo viewport width"
        >
          <ToggleGroupItem value="phone" style={itemStyle} tabIndex={tabStop(stage.width === "phone")} aria-label="Phone viewport, 390 CSS pixels">390</ToggleGroupItem>
          <ToggleGroupItem value="tablet" style={itemStyle} tabIndex={tabStop(stage.width === "tablet")} aria-label="Tablet viewport, 768 CSS pixels">768</ToggleGroupItem>
          <ToggleGroupItem value="full" style={itemStyle} tabIndex={tabStop(stage.width === "full")} aria-label="Full column width">full</ToggleGroupItem>
        </ToggleGroup>
      </Cluster>

      <Cluster label={word("motion")} hint={MOTION_NOTE}>
        <ToggleGroup
          type="single" size="sm" variant="outline" style={groupStyle}
          value={stage.motion} onValueChange={api.chooseMotion}
          aria-label="Demo motion: on, or off (reduced motion)"
          aria-describedby={stage.motion === "off" ? noteId : undefined}
        >
          <ToggleGroupItem value="on" style={itemStyle} tabIndex={tabStop(stage.motion === "on")} aria-label="Motion on: the demo animates">on</ToggleGroupItem>
          <ToggleGroupItem value="off" style={itemStyle} tabIndex={tabStop(stage.motion === "off")} aria-label="Motion off: CSS animation and transition stopped">off</ToggleGroupItem>
        </ToggleGroup>
      </Cluster>

      {canReplay && (
        <Button variant="outline" size="sm" style={{ height: HIT, padding: "0 12px", fontSize: 12.5 }}
          onClick={api.replay} aria-label="Replay this demo from the start">
          ↻ Replay
        </Button>
      )}

      <span style={{ flex: 1, minWidth: 0 }} />
      {stage.motion === "off" && (
        <span id={noteId} role="status" style={{ ...mono, textTransform: "none", letterSpacing: 0, fontSize: 11.5, whiteSpace: "normal", maxWidth: "46ch" }}>
          CSS motion stopped{stage.fromSystem ? " — your system asks for reduced motion" : ""}. Demos that animate with JavaScript keep running.
        </span>
      )}
    </div>
  );
}
