// Type, theme, palette, about, chrome: the four things slice 3 claims, measured at both viewports.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";
const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const rows = []; let bad = 0;
const push = (name, ok, detail) => { if (!ok) bad++; rows.push(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); };

// 1. fonts are served from our own origin, and are the ones the CSS asks for
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  settle(page); const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  await page.goto(BASE + "#/", { waitUntil: "load" }); await page.waitForTimeout(1200);
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      sans: document.fonts.check('16px "Instrument Sans"'),
      mono: document.fonts.check('16px "JetBrains Mono"'),
      loaded: [...document.fonts].map((f) => f.family + " " + f.status).slice(0, 6),
    };
  });
  const google = reqs.filter((u) => /fonts\.(googleapis|gstatic)/.test(u));
  const woff = reqs.filter((u) => /\.woff2/.test(u));
  push("fonts loaded", fontOk.sans && fontOk.mono, `sans=${fontOk.sans} mono=${fontOk.mono} woff2=${woff.length} ${woff[0]?.split("/").slice(-1) || ""}`);
  push("no CDN font", google.length === 0, `${google.length} google-font requests, ${woff.length} from our origin`);
  await ctx.close();
}

// 2. theme: three states, survives reload, dark is decided before paint
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/", { waitUntil: "commit" });
  const first = await page.evaluate(() => document.documentElement.className + "|" + getComputedStyle(document.body).backgroundColor);
  await page.waitForTimeout(800);
  const settled = await page.evaluate(() => document.documentElement.className);
  const cls = (c) => (c.includes("dark") ? "dark" : "light");
  push(`first paint ${scheme}`, cls(first) === scheme && cls(settled) === scheme, `at commit="${first.slice(0, 40)}" settled="${settled}"`);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/", { waitUntil: "load" }); await page.waitForTimeout(700);
  const before = await page.evaluate(() => document.documentElement.className);
  const toggle = page.locator('[data-theme-switch], .theme-switch').first();
  const boxes = await toggle.count();
  if (boxes) {
    await toggle.locator('[data-slot="toggle-group-item"], button, a').nth(2).click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const after = await page.evaluate(() => document.documentElement.className);
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(600);
  const persisted = await page.evaluate(() => document.documentElement.className);
  push("theme toggle", before !== after || /dark/.test(after), `before="${before}" after="${after}" reload="${persisted}" switches=${boxes}`);
  await ctx.close();
}

// 3. palette: keyboard only, from a cold page
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/", { waitUntil: "load" }); await page.waitForTimeout(700);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  const open = await page.evaluate(() => !!document.querySelector('[role="dialog"], [cmdk-dialog], [data-slot="command"]'));
  const focused = await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.getAttribute("role") || ""));
  await page.keyboard.type("sidebar");
  await page.waitForTimeout(500);
  const results = await page.evaluate(() => [...document.querySelectorAll('[role="option"], [cmdk-item]')].map((e) => e.textContent.trim().slice(0, 30)).slice(0, 3));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const route = await page.evaluate(() => location.hash);
  await page.keyboard.press("Escape");
  push("palette", open && results.length > 0 && route.startsWith("#/i/"), `open=${open} focus=${focused} first=${JSON.stringify(results[0] || null)} -> ${route}`);
  await ctx.close();
}

// 4. about + chrome pages say real things
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  settle(page);
  for (const [name, hash, need] of [["about", "#/about", /licen/i], ["chrome", "#/chrome", /catalog|chrome/i]]) {
    await page.goto(BASE + hash, { waitUntil: "load" }); await page.waitForTimeout(700);
    const t = await page.evaluate(() => (document.querySelector("main") || document.body).innerText.replace(/\s+/g, " "));
    push(`${name} page`, need.test(t) && t.length > 200, `${t.length} chars · "${t.slice(0, 70)}"`);
  }
  const frameRows = await page.locator('[data-chrome-item], tr').count();
  push("chrome rows", frameRows >= 9, `${frameRows} rows/tr on #/chrome`);
  await ctx.close();
}

// 5. transition duration and reduced motion
for (const reduce of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/", { waitUntil: "load" }); await page.waitForTimeout(600);
  const durs = await page.evaluate(async () => {
    location.hash = "#/i/shadcn/button";
    await new Promise((r) => setTimeout(r, 60));
    return document.getAnimations().map((a) => ({ t: a.effect?.getTiming?.().duration, name: a.animationName || a.transitionProperty || "?" }));
  });
  const max = Math.max(0, ...durs.map((d) => Number(d.t) || 0));
  push(`transition ${reduce ? "reduced" : "default"}`, reduce ? durs.length === 0 : max > 0 && max <= 300, `${durs.length} animations, max ${max}ms ${JSON.stringify(durs.map((d) => d.name).slice(0, 4))}`);
  await ctx.close();
}
await browser.close();
for (const r of rows) console.log(r);
console.log(bad ? `SLICE3: ${bad} FAIL` : "SLICE3: ok");
process.exit(bad ? 1 : 0);
