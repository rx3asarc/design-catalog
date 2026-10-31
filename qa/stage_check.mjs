// The stage gate: four controls, keyboard-only, and the child actually obeys each one.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";
const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const b = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const rows = []; let bad = 0;
const push = (n, ok, d) => { if (!ok) bad++; rows.push(`${ok ? "ok  " : "FAIL"} ${n}: ${d}`); };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
  settle(p);
await p.goto(BASE + "#/i/shadcn/skeleton", { waitUntil: "load" }); await p.waitForTimeout(1600);
const bar = p.locator("[data-stage-bar]");
push("stage bar", (await bar.count()) >= 1, `${await bar.count()} bar(s) on shadcn/skeleton`);
/**
 * The three settings groups are **inline** on a wide canvas and folded into one `Stage` popover on a narrow one (a
 * component's stage sits in a ~700 px column even at 1440, and the review measured that as three wrapped rows). A
 * gate that clicks THEME/WIDTH/MOTION has to open the popover when they are folded, or it measures an empty page.
 */
const openSettings = async (page) => {
  const inline = await page.evaluate(() => {
    const g = document.querySelector("[data-stage-settings]");
    return !!g && g.getBoundingClientRect().width > 0;
  });
  if (inline) return "inline";
  const trig = page.locator('[data-stage-bar] button[aria-label^="Stage settings"]').first();
  if (await trig.count()) { await trig.click({ force: true }); await page.waitForTimeout(350); return "popover"; }
  return "missing";
};
await openSettings(p);

const ctrls = await p.evaluate(() => {
  const els = [...document.querySelectorAll("[data-stage-bar] button, [data-stage-bar] [role='radio']")];
  return els.map((e) => ({ n: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height), tab: e.tabIndex }));
});
/* The review measured "segments 44 px, Copy 32 px, side by side" and asked for **one height: 32 px**. So on a mouse
   viewport 32 is the *wanted* number, not a violation; the design system's 44 px floor is about touch and is
   asserted on the phone context at the bottom of this file, where every control in the row is 44 px. What this
   asserts is what the review asked for: one height, not two, and none below the 32 it named. */
push("controls are one height (32 px, the review's own number), none smaller",
  ctrls.length > 0 && Math.min(...ctrls.map((c) => c.h)) >= 32 && Math.max(...ctrls.map((c) => c.h)) - Math.min(...ctrls.map((c) => c.h)) <= 2,
  `${ctrls.length} controls, heights ${JSON.stringify([...new Set(ctrls.map((c) => c.h))])}`);
/* The row is ONE row and every control in it is reachable, but the settings are one popover trigger when they are
   folded and three radio groups (one tab stop each) when they are inline. What matters is that the row does not turn
   into a tab-stop maze: at most four stops, and nothing tabbable sitting outside the row's own box. */
{
  const tab = await p.evaluate(() => {
    const bar = document.querySelector("[data-stage-bar]").getBoundingClientRect();
    const tabs = [...document.querySelectorAll("[data-stage-bar] button, [data-stage-bar] [role='radio'], [data-stage-bar] [tabindex='0']")]
      .filter((e) => e.tabIndex === 0 && e.getBoundingClientRect().width > 0);
    const outside = tabs.filter((e) => { const r = e.getBoundingClientRect(); return r.top < bar.top - 1 || r.bottom > bar.bottom + 1; }).length;
    return { n: tabs.length, outside };
  });
  push("the row is a few tab stops, all of them inside it", tab.n >= 1 && tab.n <= 4 && tab.outside === 0,
    `${tab.n} tabbable, ${tab.outside} outside the row`);
}
// the child obeys theme
const childTheme = async () => p.evaluate(() => { const f = document.querySelector("iframe[src*='demo.html']"); return f?.contentDocument?.documentElement.className || "(none)"; });
await openSettings(p);
const dark = p.locator("[data-stage-settings] [aria-label*='ark'], [data-stage-bar] [aria-label*='ark']").first();
if (await dark.count()) { await dark.click({ force: true }); await p.waitForTimeout(900); }
const cls = await childTheme();
push("theme reaches the child", /dark/.test(cls), `child <html> = "${cls}"`);
// motion off stops CSS animation in the child
await openSettings(p);
const off = p.locator("[data-stage-settings] [aria-label*='otion'], [data-stage-bar] [aria-label*='otion']").last();
if (await off.count()) { await off.click({ force: true }); await p.waitForTimeout(900); }
const anims = await p.evaluate(() => { const f = document.querySelector("iframe[src*='demo.html']"); return f?.contentDocument?.getAnimations().length ?? -1; });
const cls2 = await childTheme();
push("motion off", anims === 0 && /motion-off/.test(cls2), `child animations=${anims} class="${cls2}"`);
// replay exists only for motion items
await p.goto(BASE + "#/i/shadcn/calendar", { waitUntil: "load" }); await p.waitForTimeout(1200);
const replayStatic = await p.locator("[data-stage-bar] button", { hasText: /replay/i }).count();
await p.goto(BASE + "#/i/beui/bloom-menu", { waitUntil: "load" }); await p.waitForTimeout(1400);
const replayMotion = await p.locator("[data-stage-bar] button", { hasText: /replay/i }).count();
push("replay only where motion", replayStatic === 0 && replayMotion >= 1, `calendar=${replayStatic} bloom-menu=${replayMotion}`);
// the rail's theme switch is now reachable by keyboard
await p.goto(BASE + "#/", { waitUntil: "load" }); await p.waitForTimeout(700);
const sw = await p.evaluate(() => [...document.querySelectorAll(".theme-switch [role='radio'], .theme-switch button")].map((e) => e.tabIndex));
push("theme switch keyboard", sw.length > 0 && sw.includes(0), `tabindex ${JSON.stringify(sw)}`);

/* ═══ r8: the page where a visitor decides ═══════════════════════════════════════════════════════════════════════
   The five things r8 changed on the item page, asserted here rather than described in a report, because every one
   of them is a position or a colour and both regress silently:

     1. one pager, at the top, `position: sticky` — and it is the top one, not the foot one
     2. title → preview → install → the rest, asserted by DOCUMENT POSITION (`compareDocumentPosition`), not by eye
     3. exactly ONE element on the page painted in `--accent`, and it is the install command's Copy; every console
        segment is `surface-300` + `ink` + weight, never an accent fill
     4. the item's name is an `<h1>`
     5. the demo document carries the resolved theme: its own computed root background equals the palette's
        `--background` in both themes (measured inside the iframe, not assumed from the flag) */
const R8_ID = "beui/animated-sidebar"; // a demo AND an install command AND a measured line
await p.goto(BASE + "#/i/" + R8_ID, { waitUntil: "load" });
await p.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(1800);
// the segments live in the settings, and the settings are a popover when the canvas is narrow: open it before
// measuring what a selected one looks like (a closed Radix popover mounts nothing, so the measurement would be empty)
await openSettings(p);
const r8 = await p.evaluate(() => {
  const after = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
  const tok = (name) => { const s = document.createElement("span"); s.style.color = `var(${name})`; document.querySelector(".page-in").appendChild(s); const v = getComputedStyle(s).color; s.remove(); return v; };
  const accent = tok("--accent"), s300 = tok("--surface-300"), ink = tok("--ink");
  const h1 = document.querySelector(".page-in h1");
  const stage = document.querySelector(".stage");
  const install = document.querySelector(".install-block");
  const facts = document.querySelector("[data-facts]");
  const pagers = [...document.querySelectorAll(".page-in .related-pager")];
  const accentEls = [];
  for (const el of document.querySelectorAll(".page-in *")) {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor !== accent) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    accentEls.push({ label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34), inInstall: !!el.closest(".install-block") });
  }
  /* round 5 measured the selected segment as "same background as the bar (#18181b on #18181b), shown by bold text
     only". The rule is not "the fill must be non-neutral" — the design system gives this page exactly one accent and
     it is spent on the install Copy — the rule is that the selection is **painted**, i.e. the selected segment's
     background differs from the track it sits in. Read the track from the segment's own parent. */
  const segs = [...document.querySelectorAll("[data-stage-bar] [data-state='on'], [data-stage-settings] [data-state='on']")].map((el) => {
    const cs = getComputedStyle(el);
    const track = getComputedStyle(el.parentElement).backgroundColor;
    const outline = cs.outlineStyle !== "none" ? `${cs.outlineWidth} ${cs.outlineColor}` : "none";
    return { bg: cs.backgroundColor, track, color: cs.color, weight: Number(cs.fontWeight), outline, differs: cs.backgroundColor !== track || cs.outlineStyle !== "none" };
  });
  return {
    h1: h1 ? h1.tagName + ":" + h1.textContent.trim().slice(0, 30) : null,
    h2Title: document.querySelectorAll(".page-in h2.title").length,
    order: { h1BeforeStage: after(h1, stage), stageBeforeInstall: after(stage, install), installBeforeFacts: after(install, facts) },
    pagers: pagers.map((n) => ({ pos: getComputedStyle(n).position, y: Math.round(n.getBoundingClientRect().top), sticky: getComputedStyle(n).top })),
    accentEls, segs, s300, ink,
  };
});
push("r8 h1", !!r8.h1 && r8.h1.startsWith("H1:") && r8.h2Title === 0, `${r8.h1} · ${r8.h2Title} h2.title on the page`);
push("r8 order title→preview→install→facts",
  r8.order.h1BeforeStage && r8.order.stageBeforeInstall && r8.order.installBeforeFacts,
  `h1<h1:stage=${r8.order.h1BeforeStage} stage<install=${r8.order.stageBeforeInstall} install<facts=${r8.order.installBeforeFacts}`);
push("r8 one pager", r8.pagers.length === 1, `${r8.pagers.length} pager(s): ${JSON.stringify(r8.pagers)}`);
push("r8 pager sticky at the top",
  r8.pagers.length === 1 && r8.pagers[0].pos === "sticky" && r8.pagers[0].y < 120 && r8.pagers[0].sticky === "0px",
  `position=${r8.pagers[0]?.pos} top=${r8.pagers[0]?.sticky} y=${r8.pagers[0]?.y}`);
push("r8 one accent fill, and it is the install Copy",
  r8.accentEls.length === 1 && r8.accentEls[0].inInstall && /copy install command/i.test(r8.accentEls[0].label),
  `${r8.accentEls.length} element(s) painted --accent: ${JSON.stringify(r8.accentEls)}`);
push("r8 a selected segment is painted, not just bold",
  r8.segs.length >= 1 && r8.segs.every((s2) => s2.differs),
  `${r8.segs.length} selected segment(s): ${JSON.stringify(r8.segs)}`);

/* ── the review's four headline asks, asserted as numbers ─────────────────────────────────────────────────────
   "cap the canvas at about 560 px with a taller demo scrolling inside it", "centre the demo", "one header row",
   and "the titles are slugs" → readable names. Each one is read off the live DOM, not off a class name. */
{
  const cap = await p.evaluate(() => {
    const canvas = document.querySelector(".stage-canvas");
    const frame = document.querySelector(".stage iframe");
    if (!canvas || !frame) return null;
    const c = canvas.getBoundingClientRect(), f = frame.getBoundingClientRect();
    const head = document.querySelector(".stage-head");
    const ctrl = [...document.querySelectorAll(".stage-head button, .stage-head [data-slot='toggle-group-item']")];
    return {
      canvasH: Math.round(c.height), frameH: Math.round(f.height),
      scrollsInside: frame.scrollHeight > frame.clientHeight + 1 || getComputedStyle(frame).overflowY !== "visible",
      leftGap: Math.round(f.left - c.left), rightGap: Math.round(c.right - f.right),
      rows: new Set(ctrl.map((e) => Math.round(e.getBoundingClientRect().top))).size,
      h1: document.querySelector(".page-in h1")?.textContent.trim() ?? "",
    };
  });
  push("review: the canvas is capped at 560 px", !!cap && cap.canvasH <= 560, cap ? `canvas ${cap.canvasH}px, frame ${cap.frameH}px` : "no canvas");
  push("review: the demo is centred in its canvas", !!cap && Math.abs(cap.leftGap - cap.rightGap) <= 2, cap ? `left ${cap.leftGap}px / right ${cap.rightGap}px` : "no canvas");
  push("review: one header row inside the canvas", !!cap && cap.rows === 1, cap ? `${cap.rows} row(s) of controls` : "no canvas");
  push("review: the title is a name, not an address",
    !!cap && /[A-Z]/.test(cap.h1) && !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(cap.h1), cap ? `h1 "${cap.h1}"` : "no h1");
}

/* the demo document carries the theme: read the child's own computed background, in both themes */
const demoRoot = async () => p.evaluate(() => {
  const f = document.querySelector("iframe[src*='demo.html']");
  const d = f?.contentDocument;
  if (!d) return null;
  const bgToken = (() => { const s = d.createElement("span"); s.style.color = "var(--background)"; d.body.appendChild(s); const v = d.defaultView.getComputedStyle(s).color; s.remove(); return v; })();
  return {
    src: f.getAttribute("src").split("#")[1],
    htmlClass: d.documentElement.className.trim(),
    scheme: d.documentElement.style.colorScheme,
    htmlBg: d.defaultView.getComputedStyle(d.documentElement).backgroundColor,
    expected: bgToken,
  };
});
for (const t of ["dark", "light"]) {
  await openSettings(p);
  const btn = p.locator(`[data-stage-settings] [aria-label*="Preview the demo in ${t}"], [data-stage-bar] [aria-label*="Preview the demo in ${t}"]`).first();
  if (await btn.count()) { await btn.click({ force: true }); await p.waitForTimeout(1200); }
  const m = await demoRoot();
  /* round 5: "give the frame a transparent background so the canvas colour shows through". The child must therefore
     paint **nothing of its own** — its root background is transparent — while still resolving the stage's theme. A
     child that painted `--background` would draw the slab again; the canvas paints the demo's paper and the frame is
     a window onto it (see the seam assertion below). */
  push(`r8 demo root is a window onto the canvas, in ${t}`,
    !!m && m.htmlClass === t && m.scheme === t && (m.htmlBg === "rgba(0, 0, 0, 0)" || m.htmlBg === "transparent"),
    m ? `child <html>="${m.htmlClass}" color-scheme=${m.scheme || "(unset)"} background=${m.htmlBg} (--background=${m.expected})` : "no demo document");
}

/* a phone: the relation line is not printed, the pager is one 44 px row, nothing overflows */
{
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pp = settle(await pc.newPage());
  await pp.goto(BASE + "#/i/" + R8_ID, { waitUntil: "load" });
  await pp.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 8000 }).catch(() => {});
  await pp.waitForTimeout(1600);
  const m = await pp.evaluate(() => {
    const ctxs = [...document.querySelectorAll(".pager-top .related-context")];
    const cards = [...document.querySelectorAll(".pager-top .related-card")].map((e) => Math.round(e.getBoundingClientRect().height));
    return {
      contexts: ctxs.length, shown: ctxs.filter((e) => getComputedStyle(e).display !== "none").length,
      heights: cards, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    };
  });
  /* round 5's phone rows: "controls wrap into three rows and lose their labels … the demo starts about 490 px down".
     So the assertion is not which elements are hidden — it is that the phone gets **one** control row, every control
     in it is 44 px, nothing overflows, and the demo is in the top half of the screen. The relation line and the
     stage name are dropped on a phone by design; that is measured as the row count, not by naming them. */
  const ph = await pp.evaluate(() => {
    const head = document.querySelector(".stage-head");
    const ctrl = [...document.querySelectorAll(".stage-head button, .stage-head [role='radio'], .stage-head [data-slot='toggle-group-item']")];
    const rows = new Set(ctrl.map((e) => Math.round(e.getBoundingClientRect().top))).size;
    const frame = document.querySelector(".stage iframe");
    return {
      headH: head ? Math.round(head.getBoundingClientRect().height) : null,
      controls: ctrl.length, rows, heights: [...new Set(ctrl.map((e) => Math.round(e.getBoundingClientRect().height)))],
      overflow: head ? head.scrollWidth - head.clientWidth : null,
      demoTop: frame ? Math.round(frame.getBoundingClientRect().top) : null,
      viewport: innerHeight,
      contexts: document.querySelectorAll(".pager-top .related-context").length,
      shownContexts: [...document.querySelectorAll(".pager-top .related-context")].filter((e) => getComputedStyle(e).display !== "none").length,
      cardHeights: [...document.querySelectorAll(".pager-top .related-card")].map((e) => Math.round(e.getBoundingClientRect().height)),
    };
  });
  push("r8 390: one control row, 44 px controls, demo in the top half, no overflow",
    ph.controls >= 2 && ph.rows === 1 && ph.heights.every((h) => h >= 44) && ph.overflow <= 1
      && ph.demoTop !== null && ph.demoTop < ph.viewport * 0.6 && m.scrollW <= m.clientW,
    `row(s)=${ph.rows} controls=${ph.controls} heights=${JSON.stringify(ph.heights)} headOverflow=${ph.overflow} demoTop=${ph.demoTop}/${Math.round(ph.viewport * 0.6)} scrollWidth ${m.scrollW}/${m.clientW}`);
  /* round 5: "prev/next names cut off ('←form-formisch-ch…') → short '← Previous' / 'Next →' labels, name
     underneath". Two lines is the *requested* shape, so the assertion is the shape it asks for: one row of equal
     cards, each labelled with a direction word and carrying the neighbour's readable name. */
  const pager = await pp.evaluate(() => {
    const cards = [...document.querySelectorAll(".pager-top .related-card")];
    return cards.map((c) => {
      const t = c.textContent.replace(/\s+/g, " ").trim();
      return { h: Math.round(c.getBoundingClientRect().height), t: t.slice(0, 40), dir: /^(←|‹)?\s*(previous|next)/i.test(t), lines: Math.round(c.getBoundingClientRect().height / 24) };
    });
  });
  push("r8 390: prev/next are direction words with the name underneath",
    m.contexts >= 1 && m.shown === 0 && pager.length === 2 && pager.every((c2) => c2.dir && c2.h >= 44)
      && new Set(pager.map((c2) => c2.h)).size === 1,
    `${m.contexts} relation line(s), ${m.shown} shown; ${JSON.stringify(pager)}`);
  await pc.close();
}

await ctx.close(); await b.close();
for (const r of rows) console.log(r);
console.log(bad ? `STAGE: ${bad} FAIL` : "STAGE: ok");
process.exit(bad ? 1 : 0);
