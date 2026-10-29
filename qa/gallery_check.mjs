// Gallery gate for every publish: tile count, live-frame cap under a real scroll, ref-only toggle, no overflow.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";
const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const rows = [];
for (const vp of [{ n: "1440", w: 1440, h: 900, cap: 9 }, { n: "390", w: 390, h: 844, cap: 2 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/g", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const tiles = await page.evaluate(() => document.querySelectorAll("a[href^='#/i/']").length);
  const counts = await page.evaluate(() => {
    const g = document.querySelector("[data-gallery-counts]");
    return g ? { shown: g.getAttribute("data-gallery-shown"), hidden: g.getAttribute("data-gallery-hidden"), total: g.getAttribute("data-gallery-total") } : null;
  });
  // a real wheel descent, sampling the live pool the whole way
  const samples = [];
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(vp.w / 2, vp.h / 2);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(260);
    samples.push(await page.evaluate(() => document.querySelectorAll("iframe").length));
  }
  await page.waitForTimeout(1200);
  const settled = await page.evaluate(() => document.querySelectorAll("iframe").length);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // the reference-only toggle, by URL (the state lives in the hash)
  await page.goto(BASE + "#/g?ref=1", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const refTotal = await page.evaluate(() => document.querySelectorAll("a[href^='#/i/']").length);
  const refCards = await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => /NO DEMO/.test(e.textContent || "") && e.children.length === 0).length);
  rows.push({ vp: vp.n, tiles, counts, maxLive: Math.max(...samples), settled, cap: vp.cap, overflow, refTotal, refCards });
  await ctx.close();
}
await browser.close();
let bad = 0;
for (const r of rows) {
  const f = [];
  if (!r.tiles) f.push("no tiles");
  if (r.maxLive > r.cap) f.push(`live ${r.maxLive} > cap ${r.cap}`);
  if (r.overflow !== 0) f.push(`overflow ${r.overflow}`);
  if (r.refTotal <= r.tiles) f.push(`ref toggle did not add (${r.refTotal} vs ${r.tiles})`);
  if (f.length) bad++;
  console.log(`${r.vp} tiles=${r.tiles} counts=${JSON.stringify(r.counts)} maxLive=${r.maxLive}/${r.cap} settled=${r.settled} ref=${r.refTotal} refCards=${r.refCards} ${f.length ? "FAIL " + f.join(" · ") : "ok"}`);
}
console.log(bad ? `GALLERY: ${bad} FAIL` : "GALLERY: ok");
process.exit(bad ? 1 : 0);
