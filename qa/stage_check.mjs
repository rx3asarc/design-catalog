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
const ctrls = await p.evaluate(() => {
  const els = [...document.querySelectorAll("[data-stage-bar] button, [data-stage-bar] [role='radio']")];
  return els.map((e) => ({ n: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height), tab: e.tabIndex }));
});
push("controls ≥44px", ctrls.length > 0 && ctrls.every((c) => c.h >= 44), `${ctrls.length} controls, min ${Math.min(...ctrls.map((c) => c.h))}px`);
push("one tab stop per group", ctrls.filter((c) => c.tab === 0).length >= 1 && ctrls.filter((c) => c.tab === 0).length <= 3, `${ctrls.filter((c) => c.tab === 0).length} tabbable of ${ctrls.length}`);
// the child obeys theme
const childTheme = async () => p.evaluate(() => { const f = document.querySelector("iframe[src*='demo.html']"); return f?.contentDocument?.documentElement.className || "(none)"; });
const dark = p.locator("[data-stage-bar] [aria-label*='ark']").first();
if (await dark.count()) { await dark.click({ force: true }); await p.waitForTimeout(900); }
const cls = await childTheme();
push("theme reaches the child", /dark/.test(cls), `child <html> = "${cls}"`);
// motion off stops CSS animation in the child
const off = p.locator("[data-stage-bar] [aria-label*='otion']").last();
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
  const segs = [...document.querySelectorAll("[data-stage-bar] [data-state='on']")].map((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, weight: Number(cs.fontWeight) };
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
push("r8 console segments are neutral",
  r8.segs.length >= 1 && r8.segs.every((s2) => s2.bg === r8.s300 && s2.color === r8.ink && s2.weight >= 600),
  `${r8.segs.length} selected segment(s): ${JSON.stringify(r8.segs)}`);

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
  const btn = p.locator(`[data-stage-bar] [aria-label*="Preview the demo in ${t}"]`).first();
  if (await btn.count()) { await btn.click({ force: true }); await p.waitForTimeout(1200); }
  const m = await demoRoot();
  push(`r8 demo root carries ${t}`,
    !!m && m.htmlClass === t && m.scheme === t && m.htmlBg === m.expected,
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
  push("r8 390: relation line dropped, one 44 px row",
    m.contexts >= 1 && m.shown === 0 && m.heights.every((h) => h === 44) && m.scrollW <= m.clientW,
    `${m.contexts} relation line(s), ${m.shown} shown; card heights ${JSON.stringify(m.heights)}; scrollWidth ${m.scrollW}/${m.clientW}`);
  await pc.close();
}

await ctx.close(); await b.close();
for (const r of rows) console.log(r);
console.log(bad ? `STAGE: ${bad} FAIL` : "STAGE: ok");
process.exit(bad ? 1 : 0);
