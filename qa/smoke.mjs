// Slice smoke test: every publish runs this against docs/ served as a static site.
// usage: node smoke.mjs [baseUrl]
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROUTES = [
  ["home", "#/"], ["gallery", "#/g"], ["item", "#/i/shadcn/button"],
  ["motion", "#/i/beui/bloom-menu"], ["chrome", "#/chrome"], ["about", "#/about"],
  // the uncut search results (`site/SearchPage.tsx`) is a surface with its own address
  ["search", "#/s?q=sidebar"],
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
console.log("");

/* ── `#/c/<concept>` is retired: it must REDIRECT to the type page, not render one ────────────────────────────
 * Round 5's review found two comparison systems live at once and said to delete one. The old address is kept as a
 * redirect rather than a 404, because it is out in published links (the gallery's strip, item pages, the front
 * page), so this gate walks EVERY concept key in the manifest — not a sample — and fails if any of them renders
 * anything other than the type page for that set, or if a future unit quietly puts a `#/c/` page back.
 *
 * A redirect here is the address bar's own spelling being repaired (`canonicalHash` + `replaceState`), so the
 * proof is: the hash is a `#/t/…` route, the page carries `data-type-title`, and nothing says "not found".
 */
{
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../app/manifest.json", import.meta.url)), "utf8"));
  const concepts = [...new Set(manifest.flatMap((i) => i.concepts ?? []))].sort();
  const b = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(BASE + "#/", { waitUntil: "load" });
  await page.waitForTimeout(500);
  let wrong = 0;
  const table = [];
  for (const key of concepts) {
    await page.evaluate((k) => { location.hash = `#/c/${k}`; }, key);
    await page.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => ({
      hash: location.hash,
      type: document.querySelector("[data-type-title]")?.getAttribute("data-type-title") ?? null,
      notfound: !!document.querySelector("[data-notfound]"),
    }));
    const pass = m.hash.startsWith("#/t/") && !!m.type && !m.notfound;
    if (!pass) { wrong++; console.log(`       FAIL #/c/${key} → ${m.hash} (type=${m.type}, notfound=${m.notfound})`); }
    table.push(`#/c/${key} → ${m.hash}`);
  }
  // two of them are the review's own examples, spelled out here so the table is not just self-consistent
  for (const [key, want] of [["button", "#/t/components/button"], ["sidebar", "#/t/components/sidebar"]]) {
    const got = table.find((t) => t.startsWith(`#/c/${key} → `))?.split(" → ")[1];
    if (got !== want) { wrong++; console.log(`       FAIL #/c/${key} → ${got ?? "nothing"}, expected ${want}`); }
  }
  // …and a key the taxonomy does not have is a miss that says so, not a page and not the front page
  await page.evaluate(() => { location.hash = "#/c/no-such-concept"; });
  await page.waitForTimeout(500);
  const miss = await page.evaluate(() => ({ hash: location.hash, notfound: !!document.querySelector("[data-notfound]") }));
  if (!miss.notfound || miss.hash !== "#/c/no-such-concept") { wrong++; console.log(`       FAIL #/c/no-such-concept → ${miss.hash} (notfound=${miss.notfound})`); }
  await b.close();
  console.log(`\n#/c/ redirect table (${concepts.length} concept keys in app/manifest.json):`);
  for (const line of table) console.log(`  ${line}`);
  console.log(`${wrong ? "FAIL" : "ok  "} #/c/ redirects: ${concepts.length - wrong}/${concepts.length} concept keys land on their type page; #/c/<unknown> is a miss`);
  bad += wrong;
}

console.log(bad ? `SMOKE: ${bad} FAIL` : "SMOKE: all routes ok");
process.exit(bad ? 1 : 0);
