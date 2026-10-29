// Slice smoke test: every publish runs this against docs/ served as a static site.
// usage: node smoke.mjs [baseUrl]
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROUTES = [
  ["home", "#/"], ["gallery", "#/g"], ["item", "#/i/shadcn/button"],
  ["motion", "#/i/beui/bloom-menu"], ["chrome", "#/chrome"], ["about", "#/about"],
];
const VIEWPORTS = [{ name: "1440", width: 1440, height: 900 }, { name: "390", width: 390, height: 844 }];
const out = [];
const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  settle(page);
  const errors = [], failed = [];
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.location()?.url || "")) errors.push((m.text() || "(no text)") + " @ " + (m.location()?.url || "?")); });
  page.on("requestfailed", (r) => { const why = (r.failure()?.errorText || "?"); if (!/ERR_ABORTED/.test(why)) failed.push(`${why} ${r.url().slice(-50)}`); });
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(-50)}`); });
  page.on("pageerror", (e) => failed.push(`JS ${String(e).slice(0, 80)}`));
  for (const [name, hash] of ROUTES) {
    errors.length = 0; failed.length = 0;
    await page.goto(BASE + hash, { waitUntil: "load" });
    // A surface that is fetched on demand (the gallery, an item page, a comparison) renders a "Fetching …" line
    // first, and this check used to sample at 600 ms and call that an empty body. A fallback is a real thing a
    // visitor sees for a moment, so the wait is for the surface, not for a fixed delay: 6 s ceiling, and the
    // fallback's own words are what the failure prints if it never arrives.
    await page.waitForTimeout(600);
    await page
      .waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 6000 })
      .catch(() => {});
    const m = await page.evaluate(() => {
      const el = document.querySelector("main") || document.body;
      return {
        title: (document.querySelector("h1, .brand, h2")?.textContent || "").trim().slice(0, 40),
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
        frames: document.querySelectorAll('iframe').length,
        body: (el.innerText || "").replace(/\s+/g, " ").slice(0, 90),
        culprits: (() => {
          const cw = document.documentElement.clientWidth;
          return [...document.querySelectorAll("*")]
            .map((e) => { const b = e.getBoundingClientRect(); return { t: e.tagName.toLowerCase() + "." + String(e.className || "").slice(0, 30), right: Math.round(b.right) }; })
            .filter((x) => x.right > cw + 1).slice(0, 4);
        })(),
      };
    });
    out.push({ vp: vp.name, route: name, ...m, overflow: m.scrollW > m.clientW, errors: errors.length, errText: errors.slice(0, 2), failed: failed.slice(0, 3) });
  }
  await ctx.close();
}
await browser.close();
let bad = 0;
for (const r of out) {
  const fails = [];
  if (r.overflow) fails.push(`overflow ${r.scrollW}>${r.clientW} [${(r.culprits || []).map((c) => c.t + "@" + c.right).join(", ")}]`);
  if (r.errors) fails.push(`${r.errors} console error(s): ${(r.errText || []).join(" | ").slice(0, 120)}`);
  if (r.failed.length) fails.push(`failed: ${r.failed.join(",")}`);
  if (r.body.length < 20) fails.push("empty body");
  if (fails.length) bad++;
  console.log(`${r.vp} ${r.route.padEnd(8)} frames=${String(r.frames).padEnd(3)} ${fails.length ? "FAIL " + fails.join(" · ") : "ok   "} | ${r.body.slice(0, 60)}`);
}
console.log(bad ? `SMOKE: ${bad} FAIL` : "SMOKE: all routes ok");
process.exit(bad ? 1 : 0);
