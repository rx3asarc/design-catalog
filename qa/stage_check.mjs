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
await ctx.close(); await b.close();
for (const r of rows) console.log(r);
console.log(bad ? `STAGE: ${bad} FAIL` : "STAGE: ok");
process.exit(bad ? 1 : 0);
