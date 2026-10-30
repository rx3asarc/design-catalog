/**
 * What a visitor waits for, measured on a built site — not modelled.
 *
 * The brief for this unit names `app/probe-perf2.mjs` and `app/probe-paint.mjs`; neither exists in this
 * repository (checked against master: a `find` for `probe*` outside node_modules returns only
 * `probe_behaviour.mjs`). So this file is the probe: one static server, one browser, four routes, two network
 * profiles. Every number printed here comes out of the browser's own performance timeline.
 *
 *   node probe-firstpaint.mjs <dir-to-serve> [port]
 *
 * What it reports, per route:
 *
 *   gz bytes      the sum of `encodedBodySize` over every response the document asked for — the wires bytes,
 *                 not the raw file sizes, so a 583 KB manifest that gzips to 55 KB counts as 55 KB
 *   requests      how many responses that was
 *   first paint   First Contentful Paint (`performance.getEntriesByType('paint')`)
 *   interactive   the first moment a click on the shell's palette door actually opens the palette. Polled every
 *                 50 ms; the click is the same `show()` the shell wires up, and `show()` is idempotent, so a
 *                 poll that lands before React mounts costs nothing and a poll that lands after it stops.
 *   shell         whether the build-time boot shell was still on screen at first paint (`#root .boot`), i.e.
 *                 whether the paint came from the HTML rather than from React
 *
 * Two profiles: `wire` (no throttling — byte accounting, FCP) and `slow` (400 kbit/s down, 400 ms RTT — the
 * profile the round-5 numbers in `docs/catalog-redesign/build/r5-firstpaint-and-leftovers.md` were taken at).
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const DIR = process.argv[2];
const PORT = Number(process.argv[3] ?? 8872);
const BASE = `http://127.0.0.1:${PORT}/design-catalog/`;
const ROUTES = [
  ["home", "#/"],
  ["gallery", "#/g"],
  ["chrome", "#/chrome"],
  ["item", "#/i/shadcn/button"],
];

if (!DIR || !existsSync(join(DIR, "index.html"))) {
  console.error(`usage: node probe-firstpaint.mjs <built-dir> [port]\n  no index.html in ${DIR}`);
  process.exit(2);
}

/* ── the server: GitHub-Pages-shaped (base path, gzip on text, immutable assets) ─────────────────────────── */
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
};
const GZIP = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg"]);

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (!url.startsWith("/design-catalog/")) { res.writeHead(404).end("outside the base path"); return; }
  let file = join(DIR, normalize(url.slice("/design-catalog/".length)).replace(/^(\.\.[/\\])+/, ""));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  const ext = extname(file);
  const type = TYPES[ext] ?? "application/octet-stream";
  const body = readFileSync(file);
  const head = { "content-type": type, "cache-control": /\/assets\//.test(url) ? "public, max-age=31536000, immutable" : "no-cache" };
  if (GZIP.has(ext) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    const z = gzipSync(body, { level: 9 });
    res.writeHead(200, { ...head, "content-encoding": "gzip", "content-length": z.length });
    res.end(z);
  } else {
    res.writeHead(200, { ...head, "content-length": body.length });
    res.end(body);
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const { chromium } = await import("/root/camofox-browser/node_modules/playwright/index.mjs");
const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** A page, optionally on a slow wire. `wire` = no throttling; `slow` = 400 kbit/s down, 400 ms RTT. */
async function session(profile) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (profile === "slow") {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8,
    });
  }
  return { ctx, page };
}

const out = [];
let bad = 0;
const row = (name, v) => { out.push({ route: name, ...v }); };

for (const [name, hash] of ROUTES) {
  /* byte accounting + first paint, on an unthrottled wire */
  {
    const { ctx, page } = await session("wire");
    await page.goto(BASE + hash, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const res = performance.getEntriesByType("resource");
      const nav = performance.getEntriesByType("navigation")[0];
      const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]));
      const entry = [...document.scripts].map((s) => s.src).find((s) => s.includes("/assets/"));
      return {
        gz: Math.round(res.reduce((n, r) => n + (r.encodedBodySize || 0), 0) + (nav?.encodedBodySize || 0)),
        requests: res.length,
        fcp: Math.round(paint["first-contentful-paint"] ?? -1),
        entry: entry ? entry.split("/").pop() : null,
        shellAtPaint: performance.getEntriesByName("first-contentful-paint").length > 0,
        shellMounted: !!document.querySelector(".boot"),
        heroIds: (document.querySelector("[data-hero-ids]")?.getAttribute("data-hero-ids") || "").split(" ").filter(Boolean).length,
        bootHeroIds: (document.querySelector("[data-boot-hero-ids]")?.getAttribute("data-boot-hero-ids") || "").split(" ").filter(Boolean).length,
      };
    });
    row(name, m);
    await ctx.close();
  }

  /* time to interactive, on the slow wire */
  {
    const { ctx, page } = await session("slow");
    const t0 = Date.now();
    await page.goto(BASE + hash, { waitUntil: "commit" });
    let interactive = null;
    let painted = null;
    while (Date.now() - t0 < 60_000) {
      const v = await page.evaluate(() => {
        const p = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
        const btn = document.querySelector('[aria-haspopup="dialog"]');
        if (!btn) return { paint: p?.startTime ?? null, hit: false };
        btn.click();
        const open = !!document.querySelector('[role="dialog"]');
        return { paint: p?.startTime ?? null, hit: open, now: performance.now() };
      }).catch(() => ({ hit: false }));
      if (painted === null && v.paint != null) painted = Math.round(v.paint);
      if (v.hit) { interactive = Math.round(v.now); break; }
      await page.waitForTimeout(50);
    }
    const last = out.findLast((r) => r.route === name);
    last.slowFcp = painted;
    last.interactive = interactive;
    last.dialogOpen = interactive !== null;
    await ctx.close();
  }
}

await browser.close();
server.close();

console.table(out);
console.log(JSON.stringify(out, null, 2));
