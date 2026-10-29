#!/usr/bin/env node
/**
 * app/probe_behaviour.mjs — the facts that separate one sidebar from another, measured in a browser.
 *
 * A manifest can say licence, kind, files, KB, deps and parts. None of that helps someone pick a sidebar,
 * because what separates sidebars is behaviour: does it collapse, does it become a sheet on a phone, does it
 * nest, does it move, does the keyboard reach it, is it a page or a part. Those are not store fields and they
 * cannot be read off a source file with confidence, so this probe measures them the only way they are real:
 * by loading the demo we already ship, in the site's own frame protocol, and looking.
 *
 *   demo.html#<item id>|<variant index>|static=1&theme=light      (the protocol `src/demo-main.tsx` parses)
 *
 * Every fact is `true`, `false`, or `null`, and `null` means exactly one thing: *the probe could not tell*.
 * It is not `false`. A demo that never mounted, an item with no demo, a sidebar the probe could not locate —
 * all of those are `null`, and the page prints "not measured" for them, never a dash that reads as "no".
 * `assertFacts()` below is the gate: a fact that comes out as anything else is a bug in the probe, not data.
 *
 * Two loads per item, and why the brief's `static=1` is only on one of them:
 *
 *   * the **structure** load carries `static=1&theme=light`, as the brief says. Under `static` the frame sets
 *     `dc-static`, whose rule is `animation-play-state: paused` — computed transition and animation *durations*
 *     are still readable, and the DOM is the DOM, so structure, nesting, durations and keyboard all measure fine.
 *   * the **interaction** load drops `static=1` and keeps `theme=light`, because `animation-play-state: paused`
 *     freezes a CSS animation on frame 0: a collapse that is animated by keyframes can never be *observed* to
 *     finish in a paused frame. `static` is a thumbnail device, not the demo's behaviour. The URL is otherwise
 *     the same protocol, so this is the same frame the catalogue opens, just not frozen.
 *
 * The probe is honest about its own blindness: see PROBE_LIMITS, which the build report quotes verbatim.
 *
 * Usage (from the repo root; the probe reads what ships, so build first):
 *
 *   (cd app && npx vite build)
 *   python3 app/gen.py                                    # a manifest with the concept sets in it
 *   node app/probe_behaviour.mjs --concept sidebar        # writes app/behaviour.json
 *   python3 app/gen.py                                    # the manifest now carries the facts
 *
 *   --concept <key>   measure every item in that concept set (repeatable; the page's own definition of a set)
 *   --item <id>       measure one item by id (repeatable, for spot checks)
 *   --all             every item in the manifest that has a demo
 *   --base <url>      probe an already-served build instead of serving app/dist on a scratch port
 *   --limit <n>       stop after n items (development only; the output then says it is partial)
 *   --out <path>      default app/behaviour.json
 */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(APP);
const DIST = path.join(APP, "dist");
const MANIFEST = path.join(APP, "manifest.json");

/** The probe's own version. Bumped when a *measurement* changes, so a stored fact can be read as "taken by 1". */
const VERSION = "behaviour/1";
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || "/root/camofox-browser/node_modules/playwright/index.mjs";
const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };
/** How long a demo chunk gets to mount, and how long after that the frame must hold still before we read it. */
const MOUNT_MS = 15000;
const SETTLE_MS = 900;

/** What this probe cannot see. Quoted in the build report; not decoration — each line is a real blind spot. */
export const PROBE_LIMITS = [
  "a fact is about the demo the catalogue opens (variant 0), not about the other variants an item may ship",
  "an item with no demo has no measurable behaviour: all six facts are null, and null is not false",
  "collapse is measured through the controls present in the frame; a collapse offered only inside a dropdown is missed",
  "sheet is measured at 390x844 with a role=dialog test: a drawer that is not a dialog (a plain fixed panel) reads false",
  "nesting is depth of menu containers in the DOM, so a sub-menu that renders only on hover or into a portal is missed",
  "animation is counted from computed durations on interactive nodes plus one click observed over ~12 frames",
  "keyboard is Tab and one arrow key; it is not a screen-reader or focus-trap audit",
  "shape is a rule of thumb (width >= 90% of the frame, bottom >= 75% of it), and its numbers are published beside it",
];

/* ─────────────────────────── in-page measurement ─────────────────────────── */

/**
 * The element a demo's sidebar actually is, as this probe defines it: a named node if the library names one
 * (`data-slot="sidebar"`, `data-sidebar="sidebar"`), else the tallest left-third box over half the frame. The
 * fallback is what lets a library with no convention be measured at all — and what makes `region: "guess"`
 * visible in the output, so a guessed region is never mistaken for a declared one.
 */
const PAGE_HELPERS = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.width > 1 && r.height > 1;
  };
  const name = (el) =>
    (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
  const NAMED = '[data-slot="sidebar"],[data-sidebar="sidebar"],[data-slot="sidebar-container"]';
  const INTERACTIVE = 'a[href],button,[role="menuitem"],[role="button"],[role="link"],[role="tab"],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const CONTAINER = 'ul,ol,[role="menu"],[role="list"],[role="tree"],[data-sidebar="menu"],[data-slot="sidebar-menu"],[data-sidebar="menu-sub"],[data-slot="sidebar-menu-sub"]';
  const SUB = '[data-sidebar="menu-sub"],[data-slot="sidebar-menu-sub"],[role="menu"] [role="menu"],[role="menuitem"] [role="menu"],[aria-level="2"]';

  const region = () => {
    const named = [...document.querySelectorAll(NAMED)].filter(vis);
    if (named.length) return { el: named[0], how: "declared" };
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const tall = [...document.querySelectorAll("#root *")]
      .filter((el) => {
        if (!vis(el)) return false;
        const r = el.getBoundingClientRect();
        return r.height >= vh * 0.5 && r.width >= 64 && r.width <= vw * 0.6 && r.left <= vw * 0.25;
      })
      .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    return tall.length ? { el: tall[0], how: "guess" } : { el: null, how: "none" };
  };

  /** The controls that could plausibly collapse something, best first. Buttons only: a nav link is not a control. */
  const triggers = () => {
    const out = [];
    const seen = new Set();
    const push = (el, why) => {
      if (!el || !vis(el) || seen.has(el)) return;
      seen.add(el);
      const r = el.getBoundingClientRect();
      out.push({ why, label: name(el).slice(0, 40), x: r.x + r.width / 2, y: r.y + r.height / 2 });
    };
    document.querySelectorAll('[data-sidebar="trigger"],[data-slot="sidebar-trigger"],[data-sidebar="rail"],[data-slot="sidebar-rail"]')
      .forEach((el) => push(el, "named"));
    const RE = /\b(toggle|open|collapse|expand|menu|sidebar|panel)\b/i;
    const ICON = "svg.lucide-panel-left,svg.lucide-panel-left-close,svg.lucide-menu,svg.lucide-menu-icon";
    document.querySelectorAll('button,[role="button"]').forEach((el) => {
      if (el.querySelector(ICON)) push(el, "icon");
      else if (RE.test(name(el))) push(el, "named-button");
    });
    return out;
  };

  const ms = (v) => {
    // computed durations are comma-separated lists ("0.15s, 0.3s"); the largest is what a reader would notice
    const parts = String(v || "").split(",").map((s) => {
      s = s.trim();
      const n = parseFloat(s);
      if (Number.isNaN(n)) return 0;
      return /ms$/.test(s) ? n : n * 1000;
    });
    return Math.max(0, ...parts);
  };

  const signature = () => {
    const r = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
    const b = r ? r.getBoundingClientRect() : null;
    return [b ? Math.round(b.width) : 0, document.body.scrollHeight, document.querySelectorAll("#root *").length].join("|");
  };

  window.__probe = { vis, name, region, triggers, ms, signature, INTERACTIVE, CONTAINER, SUB };
  const r = region();
  window.__probeRegion = r.el;
  window.__probeHow = r.how;
  return r.how;
};

/**
 * Everything readable from one settled frame without touching it: the render failure if there is one, the
 * sidebar region, the animation budget on interactive nodes, the nesting depth, and the shape numbers.
 */
const READ_FRAME = () => {
  const P = window.__probe;
  const root = document.getElementById("root");
  const kids = root ? [...root.children] : [];
  const only = kids.length === 1 ? kids[0] : null;
  // `src/demo-main.tsx` reports its own failures as a lone paragraph in #root: that is not a sidebar that
  // does not collapse, that is a demo that did not run, and the only honest answer for it is null.
  const failure = only && only.tagName === "P" ? (only.textContent || "").trim().slice(0, 220) : null;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const union = kids.length
    ? kids.reduce(
        (a, k) => {
          const r = k.getBoundingClientRect();
          return { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) };
        },
        { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity },
      )
    : { l: 0, t: 0, r: 0, b: 0 };
  const shapeW = Math.round(union.r - union.l);
  const shapeH = Math.round(union.b - union.t);
  const shapeTop = Math.round(union.t);
  // "does it take the whole frame, or sit inside it as a component" — a rule of thumb, and its numbers ship
  const fillsFrame = kids.length ? shapeW >= vw * 0.9 && shapeTop <= 24 && shapeH >= vh * 0.75 : null;

  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  const scope = rp || document;

  // ---- animation: how many interactive nodes declare a duration at all ----
  let animatedNodes = 0;
  let interactiveNodes = 0;
  let maxDurationMs = 0;
  for (const el of scope.querySelectorAll(P.INTERACTIVE)) {
    if (!P.vis(el)) continue;
    interactiveNodes++;
    const cs = getComputedStyle(el);
    const d = Math.max(P.ms(cs.transitionDuration), P.ms(cs.animationDuration));
    if (d > 0) {
      animatedNodes++;
      maxDurationMs = Math.max(maxDurationMs, d);
    }
  }

  // ---- nesting: menu containers inside menu containers, plus any named sub-menu ----
  let nestDepth = 0;
  for (const c of scope.querySelectorAll(P.CONTAINER)) {
    if (!c.querySelector(P.INTERACTIVE)) continue;
    let d = 0;
    for (let n = c; n && n !== document.body; n = n.parentElement) {
      if (n.matches && n.matches(P.CONTAINER)) d++;
    }
    nestDepth = Math.max(nestDepth, d);
  }
  const subMarkers = scope.querySelectorAll(P.SUB).length;
  if (subMarkers) nestDepth = Math.max(nestDepth, 2);

  // ---- the collapse affordance, before anything is clicked ----
  const declared = document.querySelectorAll('[data-slot="sidebar"][data-state],[data-collapsible],[data-slot="sidebar"][data-collapsible]').length;
  const stateBefore = rp ? rp.getAttribute("data-state") : null;

  return {
    failure,
    rootChildren: kids.length,
    regionHow: rp ? window.__probeHow : "none",
    hasRegion: !!rp,
    fillsFrame,
    shapeDetail: { widthPx: shapeW, heightPx: shapeH, topPx: shapeTop, frameWidthPx: vw, frameHeightPx: vh },
    animatedNodes,
    interactiveNodes,
    maxDurationMs: Math.round(maxDurationMs),
    nestDepth,
    subMarkers,
    declared,
    stateBefore,
    triggers: P.triggers().length,
  };
};

/** Reveal sub-menus that are mounted but closed, so "does it nest" is not answered by a default-open accident. */
const EXPAND_CLOSED = () => {
  const P = window.__probe;
  const scope = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : document;
  const boxes = [...scope.querySelectorAll('[aria-expanded="false"],[data-state="closed"]')]
    .filter((el) => P.vis(el))
    .slice(0, 8);
  const rects = boxes.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + Math.min(r.width / 2, 24), y: r.y + r.height / 2 };
  });
  return rects;
};

const COUNT_SUB = () => {
  const P = window.__probe;
  const scope = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : document;
  let depth = 0;
  for (const c of scope.querySelectorAll(P.CONTAINER)) {
    if (!c.querySelector(P.INTERACTIVE)) continue;
    let d = 0;
    for (let n = c; n && n !== document.body; n = n.parentElement) if (n.matches && n.matches(P.CONTAINER)) d++;
    depth = Math.max(depth, d);
  }
  const sub = scope.querySelectorAll(P.SUB).length;
  return { depth: sub ? Math.max(depth, 2) : depth, sub };
};

/** Is this focus target a row of the sidebar, or just the chrome around it? */
const FOCUS_INFO = () => {
  const active = document.activeElement;
  if (!active || active === document.body) return { tag: null, inside: false, role: null };
  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  const cs = getComputedStyle(active);
  return {
    tag: active.tagName,
    role: active.getAttribute("role"),
    label: (active.getAttribute("aria-label") || active.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    inside: !!(rp && rp.contains(active)),
    interactive: active.matches('a[href],button,[role="menuitem"],[role="button"],[role="link"],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
    focusRing: cs.outlineStyle !== "none" || cs.boxShadow !== "none",
  };
};

const FOCUS_FIRST_ROW = () => {
  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  if (!rp) return null;
  const first = [...rp.querySelectorAll(window.__probe.INTERACTIVE)].find((el) => window.__probe.vis(el));
  if (!first) return null;
  first.focus();
  return (first.getAttribute("aria-label") || first.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
};

const SAMPLE_FRAMES = async (frames) => {
  const out = [window.__probe.signature()];
  for (let i = 0; i < frames; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    out.push(window.__probe.signature());
  }
  return out;
};

const AFTER_CLICK = () => {
  const P = window.__probe;
  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  // what the library itself calls the collapse it just did: `data-collapsible="icon"` is an icon rail,
  // "offcanvas" is a slide-away. Without it the width is the only witness, and width alone cannot tell a
  // 48 px icon rail from a 21 px sliver.
  const declared = (() => {
    for (let n = rp, i = 0; n && i < 4; n = n.parentElement, i++) {
      const v = n.getAttribute && n.getAttribute("data-collapsible");
      if (v) return v;
    }
    const d = rp && rp.querySelector && rp.querySelector("[data-collapsible]");
    return d ? d.getAttribute("data-collapsible") : null;
  })();
  return {
    stateAfter: rp ? rp.getAttribute("data-state") : null,
    widthAfter: rp ? Math.round(rp.getBoundingClientRect().width) : null,
    subAfter: (rp || document).querySelectorAll(P.SUB).length,
    collapsible: declared || null,
  };
};

const WIDTH_NOW = () => {
  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  return rp ? Math.round(rp.getBoundingClientRect().width) : null;
};

/**
 * "Does it become a sheet on a narrow frame" — and the two ways a naive `role="dialog"` count answers wrong.
 *
 * A Radix **popover** carries `role="dialog"` too, so a demo with a floating panel open by default would read
 * "becomes a sheet" at every width. And a **closed** sheet is a dialog node that is merely translated off the
 * frame (`x: -216, width: 216`) — present in the DOM, invisible to a person. So: exclude the popover and menu
 * surfaces by their own `data-slot`, and require the panel to actually be on screen.
 */
const DIALOG_STATE = () => {
  const P = window.__probe;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const POPOVER = "popover-content,dropdown-menu-content,context-menu-content,menubar-content,select-content,combobox-content,tooltip-content";
  const isPopoverish = (el) => {
    for (let n = el, i = 0; n && i < 3; n = n.parentElement, i++) {
      const slot = n.getAttribute && n.getAttribute("data-slot");
      if (slot && /popover|dropdown-menu|context-menu|menubar|select-content|combobox|tooltip/.test(slot)) return true;
    }
    return !!el.closest(POPOVER);
  };
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 &&
      r.width > 40 && r.height > 40 && r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
  };
  const panels = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[data-slot="sheet-content"],[data-slot="drawer-content"]')]
    .filter((el) => onScreen(el) && !isPopoverish(el));
  const navRows = panels.length
    ? panels[0].querySelectorAll('nav a[href],nav button,ul a[href],ul button,[data-sidebar] a[href],[data-sidebar] button,[role="menuitem"]').length
    : 0;
  const rp = window.__probeRegion && window.__probeRegion.isConnected ? window.__probeRegion : null;
  return {
    dialogs: panels.length,
    dialogNavRows: navRows,
    sidebarVisible: !!rp,
    sidebarWidth: rp ? Math.round(rp.getBoundingClientRect().width) : null,
    contentVisible: [...document.querySelectorAll("#root *")].some(P.vis),
  };
};

const TRIGGER_RECTS = () => window.__probe.triggers().slice(0, 4);

/* ─────────────────────────── the run ─────────────────────────── */

const NULL_FACTS = { collapses: null, sheet: null, nests: null, animates: null, keyboard: null, shape: null };

/** A fact that is not true, false, or null is a probe bug — never data. Checked before anything is written. */
function assertFacts(id, f) {
  for (const k of Object.keys(NULL_FACTS)) {
    const v = f[k];
    if (v !== true && v !== false && v !== null) throw new Error(`probe bug: ${id}.${k} = ${JSON.stringify(v)}`);
  }
}

async function measure(page, item, browser) {
  const facts = { ...NULL_FACTS };
  const detail = { reason: null, variant: 0, regionHow: null, animatedNodes: null, interactiveNodes: null,
    maxDurationMs: null, changeFrames: null, nestDepth: null, subMarkers: null, arrows: null,
    firstStopAt: null, focusStops: null, shapeDetail: null, triggers: null,
    collapseKind: null, collapseDetail: null, nestsHow: null, sheetHow: null, narrow: null };
  if (!item.variants || !item.variants.length) {
    detail.reason = "no demo: this item is reference-only, so there is nothing to measure";
    return { facts, detail };
  }
  const load = async (viewport, flags) => {
    await page.setViewportSize(viewport);
    // about:blank first, always. `goto` to the same document with a different hash is a *same-document*
    // navigation: the previous item's demo stays mounted and every fact measured after it is its facts.
    await page.goto("about:blank");
    const url = `${base}demo.html#${encodeURIComponent(item.id)}|0|${flags}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const mounted = await page.waitForFunction(() => {
      const r = document.getElementById("root");
      return !!r && r.children.length > 0;
    }, null, { timeout: MOUNT_MS }).then(() => true).catch(() => false);
    // a chunk that missed its cache window, or a slow frame, mounts late. Throwing here is the point: the
    // caller retries once and then reports null, because a document that rendered nothing is not a sidebar
    // that does nothing, and measuring it as one would be a made-up fact.
    if (!mounted) throw new Error("the demo never mounted in this frame");
    await page.waitForTimeout(SETTLE_MS);
    return page.evaluate(PAGE_HELPERS);
  };

  /** One retry per load: a flake is a flake, and a fact measured twice is worth more than a fact measured once. */
  const loadTwice = async (viewport, flags) => {
    try { return await load(viewport, flags); }
    catch { return await load(viewport, flags); }
  };

  /* ---- load 1: the frozen frame (structure, nesting, durations, keyboard, shape) ---- */
  let read = null;
  try {
    await loadTwice(WIDE, "static=1&theme=light");
    read = await page.evaluate(READ_FRAME).catch(() => null);
  } catch (e) {
    detail.reason = `the frame did not mount: ${String(e).slice(0, 120)}`;
    return { facts, detail };
  }
  if (!read || read.failure || !read.rootChildren) {
    detail.reason = read && read.failure
      ? `the demo does not run here: ${read.failure}`
      : "the frame rendered nothing to measure";
    return { facts, detail };
  }
  detail.regionHow = read.regionHow;
  detail.animatedNodes = read.animatedNodes;
  detail.interactiveNodes = read.interactiveNodes;
  detail.maxDurationMs = read.maxDurationMs;
  detail.shapeDetail = read.shapeDetail;
  detail.triggers = read.triggers;
  facts.shape = read.fillsFrame;

  /* ---- keyboard: does Tab reach the rows, and does an arrow move inside the menu ---- */
  try {
    if (!read.hasRegion) {
      detail.focusStops = null;
      detail.keyboardHow = "no sidebar region could be located in this frame";
    } else {
      await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
      // 40, not 14: one demo opens with a popover that owns the first dozen tab stops, and "the sidebar is
      // 15 tabs away" is still a sidebar the keyboard reaches. The index of the first row is the datum.
      let stops = 0;
      let firstStopAt = null;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const f = await page.evaluate(FOCUS_INFO);
        if (f.inside && f.interactive) {
          stops++;
          if (firstStopAt === null) firstStopAt = i + 1;
        }
      }
      detail.focusStops = stops;
      detail.firstStopAt = firstStopAt;
      detail.keyboardHow = stops
        ? `first row reached at tab ${firstStopAt}; ${stops} of 40 tab presses landed inside the sidebar`
        : "40 tab presses never landed on a control inside the sidebar";
      facts.keyboard = stops > 0;
      const first = await page.evaluate(FOCUS_FIRST_ROW);
      if (first !== null) {
        const read_ = () => document.activeElement
          ? (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 80)
          : "";
        const before = await page.evaluate(read_);
        await page.keyboard.press("ArrowDown");
        const after = await page.evaluate(read_);
        detail.arrows = before !== after;
      }
    }
  } catch { facts.keyboard = null; }

  /* ---- nesting: count, then open what is closed, then count again ---- */
  try {
    let nest = await page.evaluate(COUNT_SUB);
    if (nest.depth < 2) {
      for (const r of await page.evaluate(EXPAND_CLOSED)) {
        await page.mouse.click(r.x, r.y);
        await page.waitForTimeout(260);
      }
      const again = await page.evaluate(COUNT_SUB);
      nest = { depth: Math.max(nest.depth, again.depth), sub: Math.max(nest.sub, again.sub) };
    }
    detail.nestDepth = nest.depth;
    detail.subMarkers = nest.sub;
    detail.nestsHow = !read.hasRegion
      ? "no sidebar region could be located in this frame"
      : nest.sub
        ? `${nest.sub} named sub-menu node(s) in the DOM`
        : nest.depth >= 2
          ? "menu containers inside menu containers, with no library-named sub-menu"
          : "one level of menu containers only";
    facts.nests = !read.hasRegion ? null : nest.depth >= 2;
  } catch { facts.nests = null; }

  /* ---- load 2: the same frame, unfrozen, clicked ---- */
  try {
    await loadTwice(WIDE, "theme=light");
    const pre = await page.evaluate(() => ({
      width: (() => { const r = window.__probeRegion; return r ? Math.round(r.getBoundingClientRect().width) : null; })(),
      state: window.__probeRegion ? window.__probeRegion.getAttribute("data-state") : null,
      triggers: window.__probe.triggers(),
    }));
    const cands = pre.triggers.slice(0, 3);
    if (!cands.length) {
      facts.collapses = false;
      detail.collapseKind = "none";
      detail.reason = "no collapse control in the frame: no named trigger, no rail, no toggle/menu/panel button";
    } else {
      let frames = null;
      let observed = { stateAfter: pre.state, widthAfter: pre.width };
      for (const c of cands) {
        await page.mouse.click(c.x, c.y);
        frames = await page.evaluate(SAMPLE_FRAMES, 12);
        await page.waitForTimeout(400);
        observed = await page.evaluate(AFTER_CLICK);
        const minW = Math.min(...frames.map((s) => Number(s.split("|")[0])));
        const shrank = !!pre.width && (pre.width - minW) / pre.width >= 0.25;
        if ((observed.stateAfter && observed.stateAfter !== pre.state) || shrank) break;
      }
      const minW = frames ? Math.min(...frames.map((s) => Number(s.split("|")[0]))) : null;
      const shrank = !!pre.width && minW !== null && (pre.width - minW) / pre.width >= 0.25;
      const flipped = observed.stateAfter && pre.state && observed.stateAfter !== pre.state;
      facts.collapses = !!(shrank || flipped);
      detail.changeFrames = frames ? frames.reduce((n, s, i) => (i && s !== frames[i - 1] ? n + 1 : n), 0) : null;
      detail.collapseDetail = { clickedControl: cands[0].label || cands[0].why, widthBefore: pre.width, widthMin: minW,
        stateBefore: pre.state, stateAfter: observed.stateAfter, declared: observed.collapsible,
        shrinkPct: shrank ? Math.round((1 - minW / pre.width) * 100) : 0 };
      // the shape of the collapse, when it collapsed: the library's own name first, the width second
      detail.collapseKind = !facts.collapses
        ? "none"
        : observed.collapsible === "icon" || (!observed.collapsible && minW !== null && minW >= 24 && minW <= 96)
          ? "icon rail"
          : observed.collapsible === "offcanvas" || (minW !== null && minW <= 8)
            ? "off canvas"
            : "narrower";
    }
  } catch { facts.collapses = null; detail.collapseKind = null; detail.changeFrames = null; }

  /* ---- load 3: 390 px, where a sidebar either becomes a sheet or does not ---- */
  try {
    await loadTwice(NARROW, "static=1&theme=light");
    let d = await page.evaluate(DIALOG_STATE);
    let departed = false;
    if (!d.dialogs && !d.sidebarVisible) {
      departed = true;
      // nothing on screen: press the likely control, which is the whole definition of "comes back as a sheet"
      for (const c of (await page.evaluate(TRIGGER_RECTS)).slice(0, 2)) {
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(700);
        d = await page.evaluate(DIALOG_STATE);
        if (d.dialogs) break;
      }
    }
    detail.narrow = d;
    detail.sheetHow = d.dialogs
      ? (departed ? "a role=dialog panel opened when the frame's control was pressed" : "a role=dialog panel is open at load")
      : d.sidebarVisible
        ? "the sidebar itself stays on screen at 390 px, so nothing needs to become a sheet"
        : d.contentVisible
          ? "no dialog and no sidebar region at 390 px: nothing in this frame presents as a sheet"
          : "390 px renders nothing at all here";
    if (d.dialogs) facts.sheet = true;
    else if (d.sidebarVisible) facts.sheet = false;
    else if (!d.contentVisible) facts.sheet = null;
    else facts.sheet = false;
  } catch { facts.sheet = null; }

  /* ---- animation: a declared duration, or a click that keeps changing the DOM across frames ---- */
  facts.animates = read.animatedNodes > 0 || (detail.changeFrames ?? 0) >= 2 ? true : read.animatedNodes === 0 && detail.changeFrames !== null ? false : null;

  assertFacts(item.id, facts);
  return { facts, detail };
}

/* ─────────────────────────── wiring ─────────────────────────── */

function arg(name, dflt = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".woff": "font/woff", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

/** Serve `app/dist` under the vite base, so the probe measures the build the site actually publishes. */
async function serve() {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    if (!url.startsWith("/design-catalog/")) { res.writeHead(404); return res.end("outside the base"); }
    let p = path.join(DIST, url.slice("/design-catalog/".length));
    if (p.endsWith(path.sep)) p = path.join(p, "index.html");
    readFile(p).then((buf) => {
      res.writeHead(200, { "content-type": TYPES[path.extname(p)] ?? "application/octet-stream" });
      res.end(buf);
    }).catch(() => { res.writeHead(404); res.end("not found"); });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: `http://127.0.0.1:${server.address().port}/design-catalog/` };
}

let base = arg("base", "");
let server = null;
if (!base) {
  if (!existsSync(DIST)) {
    console.error("probe: app/dist is missing — run `npx vite build` in app/ first, the probe measures what ships");
    process.exit(2);
  }
  const s = await serve();
  server = s.server;
  base = s.origin;
}
if (!base.endsWith("/")) base += "/";

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const concepts = args("concept");
const oneItems = args("item");
const all = process.argv.includes("--all");
const limit = Number(arg("limit", "0")) || 0;

let picks;
if (oneItems.length) {
  picks = manifest.filter((i) => oneItems.includes(i.id));
} else if (all) {
  picks = manifest.filter((i) => i.variants?.length);
} else if (concepts.length) {
  picks = manifest.filter((i) => (i.concepts || []).some((c) => concepts.includes(c)));
} else {
  console.error("probe: say which items — --concept sidebar | --item <id> | --all");
  if (server) server.close();
  process.exit(2);
}
if (limit) picks = picks.slice(0, limit);
if (!picks.length) {
  console.error("probe: that selection is empty");
  if (server) server.close();
  process.exit(2);
}

const { chromium } = await import(PLAYWRIGHT);
const b = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: WIDE });
page.on("pageerror", () => {}); // a demo's own throw is reported by the demo frame, not as a probe failure

const items = {};
const t0 = Date.now();
for (const [n, item] of picks.entries()) {
  const { facts, detail } = await measure(page, item, b);
  items[item.id] = { ...facts, ...detail, variant: 0 };
  const mark = (v) => (v === true ? "yes" : v === false ? "no " : " ? ");
  process.stdout.write(
    `${String(n + 1).padStart(3)}/${picks.length} ${item.id.padEnd(38)} ` +
    `collapse ${mark(facts.collapses)} sheet ${mark(facts.sheet)} nest ${mark(facts.nests)} ` +
    `anim ${mark(facts.animates)} keys ${mark(facts.keyboard)} shape ${mark(facts.shape)}` +
    (detail.reason ? `  (${detail.reason.slice(0, 46)})` : "") + "\n",
  );
}
await b.close();
if (server) server.close();

const counts = { true: 0, false: 0, null: 0 };
const perFact = {};
for (const id of Object.keys(items)) {
  for (const k of Object.keys(NULL_FACTS)) {
    const v = items[id][k];
    const key = v === true ? "true" : v === false ? "false" : "null";
    counts[key]++;
    perFact[k] ??= { true: 0, false: 0, null: 0 };
    perFact[k][key]++;
  }
}

const out = {
  probe: "app/probe_behaviour.mjs",
  version: VERSION,
  probed_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  frames: { wide: WIDE, narrow: NARROW, staticFlagOnStructurePass: true },
  selection: {
    concepts: concepts.sort(),
    items: oneItems,
    all,
    limit: limit || null,
    complete: !limit && !oneItems.length,
  },
  manifestSha256: createHash("sha256").update(await readFile(MANIFEST)).digest("hex").slice(0, 16),
  build: (() => {
    try { return createHash("sha256").update(readFileSync(path.join(DIST, "demo.html"))).digest("hex").slice(0, 16); }
    catch { return null; }
  })(),
  facts: Object.keys(NULL_FACTS),
  counts: { items: Object.keys(items).length, values: counts, perFact },
  limits: PROBE_LIMITS,
  items,
};
const outPath = arg("out", path.join(APP, "behaviour.json"));
await writeFile(outPath, JSON.stringify(out, null, 1) + "\n");

console.log(`\n${Object.keys(items).length} item(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const k of Object.keys(perFact)) {
  const c = perFact[k];
  console.log(`  ${k.padEnd(9)} true ${String(c.true).padStart(3)}  false ${String(c.false).padStart(3)}  null ${String(c.null).padStart(3)}`);
}
const unanswered = picks
  .filter((i) => (i.variants || []).length)
  .filter((i) => Object.keys(NULL_FACTS).some((k) => items[i.id][k] === null));
if (unanswered.length) {
  console.log(`\n${unanswered.length} demo(s) shipped but were not fully answered (null is not false; each one says why):`);
  for (const i of unanswered) console.log(`  ${i.id} — ${items[i.id].reason ?? "no reason recorded"}`);
}
console.log(`wrote ${path.relative(ROOT, outPath)} (probe ${VERSION}, ${out.probed_at})`);
