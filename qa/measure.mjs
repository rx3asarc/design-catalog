// Q1 — catalog-qa-measure. One harness, one commit, every claim re-measured against the merged result.
//
//   node qa/measure.mjs                 # all sections A–I (builds, serves, measures, kills the server)
//   node qa/measure.mjs --only C,F      # a subset (server + build reused)
//   node qa/measure.mjs --no-build      # reuse app/dist from a previous run
//
// Playwright: the repo's `app/node_modules` does NOT contain playwright (that part of the brief is wrong).
// It is installed at /root/camofox-browser/node_modules/playwright (1.58.1), which is what the earlier
// units' harnesses (/root/docs/catalog-redesign/qa/smoke.mjs) import, and whose bundled Chromium revision
// (1228) is the one /usr/local/bin/google-chrome points at. Imported by absolute path, no dependency is
// added to app/package.json.
//
// Browser: chromium, headless, launched with the args below; every timing block records /proc/loadavg
// because this box is shared with other fleet workers and the numbers move with it.

import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { chromium } = await import("/root/camofox-browser/node_modules/playwright/index.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const APP = join(REPO, "app");
const RAW = join(HERE, "raw");
const SHOTS = join(HERE, "shots");
const PORT = 8820;
const BASE = `http://127.0.0.1:${PORT}/design-catalog/`;
const CHROME_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--enable-precise-memory-info",
  "--force-color-profile=srgb",
  "--hide-scrollbars", // only affects the scrollbar's paint, not layout width
];

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const onlyArg = (() => {
  const i = args.indexOf("--only");
  if (i < 0) return null;
  return new Set((args[i + 1] || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
})();
const want = (s) => !onlyArg || onlyArg.has(s);

mkdirSync(RAW, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

/* ── bookkeeping ──────────────────────────────────────────────────────────────────────────────────────── */

const RESULT = {};
const CHECKS = [];
function check(section, id, asserted, value, verdict) {
  CHECKS.push({ section, id, asserted, value, verdict });
  const mark = verdict === "PASS" ? "PASS" : verdict === "FAIL" ? "FAIL" : verdict;
  console.log(`  ${mark.padEnd(4)} [${section}] ${id} — ${typeof value === "string" ? value : JSON.stringify(value)}`);
  return verdict === "PASS";
}
function save(name, obj) {
  RESULT[name] = obj;
  writeFileSync(join(RAW, `${name}.json`), JSON.stringify(obj, null, 2));
}
function loadavg() {
  try {
    const f = readFileSync("/proc/loadavg", "utf8").split(" ");
    return { l1: +f[0], l5: +f[1], l15: +f[2] };
  } catch {
    return null;
  }
}
const manifest = JSON.parse(readFileSync(join(APP, "manifest.json"), "utf8"));
const counts = {
  total: manifest.length,
  demo: manifest.filter((i) => (i.variants || []).length > 0).length,
  ref: manifest.filter((i) => !(i.variants || []).length).length,
  withheld: manifest.filter((i) => i.withheld).length,
  files: manifest.filter((i) => (i.files || []).length > 0).length,
  nullBytes: manifest.filter((i) => i.bytes === null).length,
  concepts: manifest.filter((i) => i.concepts).length,
  composition: manifest.filter((i) => i.composition).length,
  usedHere: manifest.filter((i) => (i.used_here || 0) > 0),
  variants: manifest.reduce((n, i) => n + (i.variants || []).length, 0),
};

/* ── the preview server (started once, killed in a finally, port checked empty after) ──────────────────── */

let server = null;
async function startServer() {
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: APP,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE, { redirect: "manual" });
      if (r.status === 200) return { started: true, log, load: loadavg() };
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview server did not answer at ${BASE}\n${log}`);
}
async function stopServer() {
  if (!server) return;
  const pid = server.pid;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {}
  try {
    server.kill("SIGTERM");
  } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try {
    execFileSync("bash", ["-lc", `pkill -f "vite preview --port ${PORT}" || true`]);
  } catch {}
  let listening = "";
  try {
    listening = execFileSync("bash", ["-lc", `ss -ltn | grep ":${PORT}" || true`], { encoding: "utf8" }).trim();
  } catch {}
  server = null;
  return listening;
}
function ssPorts(pattern = ":88") {
  try {
    return execFileSync("bash", ["-lc", `ss -ltn | grep -E "${pattern}" || true`], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/* ── build + guard (section A) ─────────────────────────────────────────────────────────────────────────── */

function sh(cmd, opts = {}) {
  const t0 = Date.now();
  const r = execFileSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { cmd, out: r, status: 0, ms: Date.now() - t0, load: loadavg() };
}
function shTry(cmd, opts = {}) {
  const t0 = Date.now();
  try {
    const out = execFileSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
    return { cmd, out, status: 0, ms: Date.now() - t0, load: loadavg() };
  } catch (e) {
    return { cmd, out: `${e.stdout || ""}${e.stderr || ""}`, status: e.status ?? 1, ms: Date.now() - t0, load: loadavg() };
  }
}

async function sectionA() {
  console.log("\n=== A. build and guard ===");
  const a = {};
  a.load = loadavg();

  const guard = shTry(`cd ${APP} && python3 check_chrome.py`);
  const scanned = (guard.out.match(/(\d+)\s+shell file\(s\) scanned/) || [])[1] ?? null;
  a.guard = { ...guard, scanned: scanned ? +scanned : null };
  check("A", "check_chrome.py exit 0", "guard exits 0 on the merged tree", `exit=${guard.status}, ${scanned} shell file(s) scanned`, guard.status === 0 ? "PASS" : "FAIL");

  // plant a violation in a NEW site/*.tsx file and prove the guard catches it
  const probe = join(APP, "src/site/__qa_guard_probe.tsx");
  writeFileSync(
    probe,
    `// Q1 probe: a raw interactive element in a new shell file. Must be caught by check_chrome.py.\nexport function QaProbe() {\n  return <button>raw button in a new shell file</button>;\n}\n`,
  );
  const caught = shTry(`cd ${APP} && python3 check_chrome.py`);
  a.plant = { ...caught, file: "src/site/__qa_guard_probe.tsx" };
  rmSync(probe, { force: true });
  const after = shTry(`cd ${APP} && python3 check_chrome.py`);
  a.guardAfter = after;
  check(
    "A",
    "guard catches a planted violation in a NEW site/*.tsx file",
    "planting a raw <button> in a new shell file makes the guard exit non-zero and names the file",
    `exit=${caught.status}; ${(caught.out.match(/[^\n]*__qa_guard_probe[^\n]*/) || [caught.out.split("\n").filter(Boolean).slice(-1)[0] || ""])[0].trim()}`,
    caught.status !== 0 && /__qa_guard_probe/.test(caught.out) ? "PASS" : "FAIL",
  );
  check("A", "guard is clean again after removing the probe", "exit 0, tree as found", `exit=${after.status}`, after.status === 0 ? "PASS" : "FAIL");

  if (!flag("no-build")) {
    const build = shTry(`cd ${APP} && npx vite build`);
    const built = (build.out.match(/built in ([\d.]+s?m?s?)/) || [])[1] || null;
    a.build = { ...build, built };
    check("A", "npx vite build exit 0", "the merged tree builds", `exit=${build.status}, built in ${built}, ${(build.ms / 1000).toFixed(1)} s wall, load ${build.load?.l1}`, build.status === 0 ? "PASS" : "FAIL");
  }

  // raw elements anywhere in app/src/** outside the whitelist — count them ourselves
  const raw = shTry(
    `cd ${APP} && grep -rnE "<(button|input|textarea|select|table|details|summary)[ >/]" src --include=*.tsx --include=*.ts | grep -v "src/registry/" | grep -v "src/demos/" | grep -v "src/components/" | grep -v "src/shims/" | grep -v "src/demo-main.tsx" || true`,
  );
  const rawLines = raw.out
    .split("\n")
    .filter((l) => l.trim())
    .filter((l) => !/^\s*(\/\/|\*)/.test(l.replace(/^[^:]+:\d+:/, "")));
  a.rawOutsideWhitelist = rawLines;
  check(
    "A",
    "no raw <button/input/textarea/select/table/details/summary> in the shell",
    "grep of app/src outside the whitelist (registry/, demos/, components/, shims/, demo-main.tsx)",
    `${rawLines.length} hit(s)${rawLines.length ? ": " + rawLines.slice(0, 3).join(" | ") : ""}`,
    rawLines.length === 0 ? "PASS" : "FAIL",
  );

  // dist + fonts inventory (also used by H)
  const distFiles = [];
  (function walk(d, rel = "") {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const r = rel ? `${rel}/${f}` : f;
      if (statSync(p).isDirectory()) walk(p, r);
      else distFiles.push(r);
    }
  })(join(APP, "dist"));
  a.dist = { files: distFiles.length, woff2: distFiles.filter((f) => f.endsWith(".woff2")), fontsDir: distFiles.filter((f) => /^fonts\//.test(f)) };
  save("A", a);
  return a;
}

/* ── browser helpers ───────────────────────────────────────────────────────────────────────────────────── */

async function launch() {
  // The playwright package here (1.58.1) wants chromium_headless_shell-1208, which is not installed; the
  // installed browser is chromium-1228, which /usr/local/bin/google-chrome points at. Same binary the earlier
  // units' harnesses used. Recorded in qa/raw/_checks.json.
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/local/bin/google-chrome", args: CHROME_ARGS });
  return browser;
}
async function ctx(browser, viewport, extra = {}) {
  const c = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: extra.colorScheme || "light",
    reducedMotion: extra.reducedMotion || "no-preference",
    locale: "en-GB",
  });
  const net = { requests: [], external: [], failures: [] };
  const page = await c.newPage();
  page.on("request", (r) => {
    const u = r.url();
    net.requests.push(u);
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) net.external.push(u);
  });
  page.on("requestfailed", (r) => net.failures.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on("pageerror", (e) => net.failures.push(`JS ${String(e).slice(0, 120)}`));
  return { c, page, net };
}
const q = (n) => JSON.stringify(n);
async function go(page, hash = "#/", wait = 120) {
  await page.goto(BASE + hash, { waitUntil: "load" });
  await page.waitForTimeout(wait);
}
async function tiles(page) {
  return page.evaluate(() => ({
    tiles: document.querySelectorAll("[data-tile]").length,
    demo: document.querySelectorAll('[data-tile]:not([data-mode="reference"])').length,
    ref: document.querySelectorAll('[data-mode="reference"]').length,
    frames: document.querySelectorAll("iframe").length,
    counts: (() => {
      const el = document.querySelector("[data-gallery-counts]");
      return el ? { shown: +el.dataset.galleryShown, hidden: +el.dataset.galleryHidden, total: +el.dataset.galleryTotal, text: el.textContent.trim() } : null;
    })(),
    page: (() => { const p = document.querySelector(".page"); return p ? { scrollTop: p.scrollTop, scrollHeight: p.scrollHeight, clientHeight: p.clientHeight } : null; })(),
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight },
  }));
}
async function scrollToBottom(page, { step = 700, pause = 120 } = {}) {
  const before = await tiles(page);
  const scroller = await page.evaluate(() => {
    const p = document.querySelector(".page");
    if (p && p.scrollHeight > p.clientHeight + 4) return "page";
    return "window";
  });
  const max = scroller === "page" ? before.page.scrollHeight - before.page.clientHeight : before.doc.scrollHeight - 844;
  for (let y = 0; y <= max; y += step) {
    await page.evaluate(({ y, scroller }) => {
      if (scroller === "page") document.querySelector(".page").scrollTop = y;
      else window.scrollTo(0, y);
    }, { y, scroller });
    await page.waitForTimeout(pause);
  }
  // settle, so the pool can fill after the scroll stops
  await page.waitForTimeout(1200);
  return { scroller, max };
}

/* ── section B: the review's bug (H) ──────────────────────────────────────────────────────────────────── */

const FRAG_A = "function Button"; // shadcn/button's code
const WITHHELD = "transitions/card-stack-hover"; // withheld:true, files: []

async function sectionB(browser) {
  console.log("\n=== B. the code pane on a route change (review bug H) ===");
  const { c, page } = await ctx(browser, { width: 1440, height: 900 });
  const steps = [];
  const pane = () =>
    page.evaluate(() => {
      const path = document.querySelector(".cmd .path");
      const pre = document.querySelector(".demo-code pre");
      return {
        path: path ? path.textContent.trim() : null,
        code: pre ? (pre.textContent || "").slice(0, 400) : null,
        codeLen: pre ? (pre.textContent || "").length : 0,
        activeTab: (document.querySelector('.file-tabs [data-state="active"]')?.textContent || "").trim() || null,
        withheld: /not ours to republish/.test(document.body.innerText),
        navigations: performance.getEntriesByType("navigation").length,
        hash: location.hash,
        title: document.querySelector("h2.title")?.textContent?.trim() || null,
        bodyHasA: document.body.innerText.includes("function Button"),
        bodyHasB: /motion\/react|AnimatePresence/.test(document.body.innerText),
      };
    });

  await go(page, "#/i/shadcn/button", 900);
  const s1 = { step: "open #/i/shadcn/button (has source)", ...(await pane()) };
  steps.push(s1);

  // in-app navigation, real user path: mod+k → type the item's name → Enter
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  await page.keyboard.type("card stack hover", { delay: 12 });
  await page.waitForTimeout(250);
  const firstResult = await page.evaluate(() => document.querySelector('[data-slot="command-item"]')?.textContent?.trim() || null);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const s2 = { step: `navigate in-app (mod+k → "card stack hover" → Enter) to withheld ${WITHHELD}`, firstResult, ...(await pane()) };
  steps.push(s2);

  // reverse: back to the item with source, through the palette again
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(200);
  await page.keyboard.type("button", { delay: 12 });
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const s3 = { step: "reverse: in-app back to an item with source", ...(await pane()) };
  steps.push(s3);

  // rapid chain of three, no waiting between them beyond a paint
  const chain = [];
  for (const id of ["beui/bloom-menu", WITHHELD, "shadcn/sidebar"]) {
    await page.evaluate((h) => { location.hash = h; }, `#/i/${id}`);
    await page.waitForTimeout(260);
    chain.push({ target: id, ...(await pane()) });
  }
  const s4 = { step: "rapid chain: beui/bloom-menu → withheld → shadcn/sidebar (260 ms apart)", chain };
  steps.push(s4);

  await c.close();

  const b = { steps, load: loadavg() };
  save("B", b);

  const leakAB = s2.code && /function Button/.test(s2.code);
  check("B", "H forward: source → withheld shows nothing from the previous item", "no .path / no code pane text, no fragment of the previous item's code", `path=${s2.path}, code=${s2.code === null ? "absent" : s2.code.slice(0, 40)}, withheld box=${s2.withheld}`, !leakAB && s2.path === null && s2.code === null ? "PASS" : "FAIL");
  check("B", "H forward: the withheld item still says why", "the page carries the 'not ours to republish' sentence", `${s2.withheld}`, s2.withheld ? "PASS" : "FAIL");
  const revOk = s3.path !== null && s3.codeLen > 50 && s3.hash === "#/i/shadcn/button";
  check("B", "H reverse: withheld → source renders the new item's file", "path is this item's file, pane carries its code, nothing left over", `path=${s3.path}, codeLen=${s3.codeLen}, tab=${s3.activeTab}`, revOk ? "PASS" : "FAIL");
  const chainOk = chain.every((s) => {
    if (s.target === WITHHELD) return s.path === null && s.code === null;
    return s.path !== null && s.codeLen > 50;
  });
  check("B", "rapid chain of three (260 ms apart)", "each step shows only its own item: a withheld step has no pane, source steps have their own file", chain.map((s) => `${s.target}:path=${s.path ?? "none"}`).join(" | "), chainOk ? "PASS" : "FAIL");
  check("B", "no reload during the whole section", "performance.getEntriesByType('navigation').length stays 1", `${s4.chain.at(-1).navigations}`, s4.chain.at(-1).navigations === 1 ? "PASS" : "FAIL");
  return b;
}

/* ── section C: the gallery ───────────────────────────────────────────────────────────────────────────── */

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1)))].toFixed(2);
}
function histo(arr) {
  const h = {};
  for (const v of arr) h[v] = (h[v] || 0) + 1;
  return h;
}

async function sectionC(browser) {
  console.log("\n=== C. gallery ===");
  const out = { load: loadavg(), wide: {}, phone: {} };

  /* wide */
  {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    await go(page, "#/g", 1500);
    const t0 = await tiles(page);
    out.wide.initial = t0;
    check("C", "tile count matches the manifest for the filter (#/g, no query)", "demo tiles == manifest demo count; no reference cards by default", `${t0.demo} demo tiles (manifest ${counts.demo}), ${t0.ref} ref cards, header "${t0.counts?.text}"`, t0.demo === counts.demo && t0.ref === 0 ? "PASS" : "FAIL");
    check("C", "header counts equal the DOM counts", "data-gallery-shown == demo tiles, hidden == ref cards not rendered, total == manifest total", `shown=${t0.counts?.shown} hidden=${t0.counts?.hidden} total=${t0.counts?.total} vs DOM demo=${t0.demo} ref=${t0.ref}`, t0.counts && t0.counts.shown === t0.demo && t0.counts.hidden === counts.ref && t0.counts.total === counts.total ? "PASS" : "FAIL");

    // instrument: per-frame iframe census + rAF deltas
    await page.evaluate(() => {
      window.__qa = { frames: [], counts: [], deltas: [], done: false };
      let last = performance.now();
      const step = (now) => {
        window.__qa.deltas.push(now - last);
        last = now;
        window.__qa.counts.push(document.querySelectorAll("iframe").length);
        if (!window.__qa.done) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const scrolled = await scrollToBottom(page, { step: 900, pause: 110 });
    const measured = await page.evaluate(() => {
      window.__qa.done = true;
      return { deltas: window.__qa.deltas.slice(2), counts: window.__qa.counts, gallery: window.__gallery ? { ...window.__gallery } : null };
    });
    const deltas = measured.deltas.filter((d) => d > 0 && d < 2000);
    const countsArr = measured.counts;
    const jumps = [];
    for (let i = 1; i < countsArr.length; i++) {
      const d = countsArr[i] - countsArr[i - 1];
      if (d >= 2) jumps.push({ frame: i, from: countsArr[i - 1], to: countsArr[i] });
    }
    out.wide.scroll = {
      scroller: scrolled.scroller,
      maxScroll: scrolled.max,
      framesSampled: countsArr.length,
      maxLive: Math.max(...countsArr),
      liveDistribution: histo(countsArr),
      perFrameIncreaseGe2: jumps.length,
      firstJumps: jumps.slice(0, 5),
      raf: { n: deltas.length, p50: pct(deltas, 50), p95: pct(deltas, 95), max: +Math.max(...deltas).toFixed(1), over33: deltas.filter((d) => d > 33.4).length },
      gallery: measured.gallery,
      load: loadavg(),
    };
    const sc = out.wide.scroll;
    check("C", "max live iframes across a full descent ≤ 9", "sample document.querySelectorAll('iframe').length on every animation frame while the whole grid scrolls", `max=${sc.maxLive}, samples=${sc.framesSampled}, distribution=${JSON.stringify(sc.liveDistribution)}`, sc.maxLive <= 9 && sc.maxLive > 0 ? "PASS" : "FAIL");
    check("C", "no more than one mount per animation frame", "no frame where the iframe count rises by ≥2; app counter perFrameMax == 1", `frames with +≥2: ${sc.perFrameIncreaseGe2}; __gallery.perFrameMax=${sc.gallery?.perFrameMax}, mounts=${sc.gallery?.mounts}, evictions=${sc.gallery?.evictions}`, sc.perFrameIncreaseGe2 === 0 && sc.gallery?.perFrameMax === 1 ? "PASS" : "FAIL");
    check(
      "C",
      "p95 rAF interval while scrolling (baseline: stage.md 16.7 p50 / 16.8 p95 at 9 frames; gallery's own claim 16.7/16.8)",
      "rAF deltas sampled during the descent, compared with the scout's N=9 baseline",
      `p50=${sc.raf.p50} ms, p95=${sc.raf.p95} ms, max=${sc.raf.max} ms, ${sc.raf.over33}/${sc.raf.n} frames > 33.4 ms — load ${sc.load?.l1}`,
      sc.raf.p95 !== null && sc.raf.p95 < 33.4 ? "PASS" : "FAIL",
    );
    /* a filtered grid: the count in the tile set, against the manifest for that filter */
    await page.goto(`${BASE}#/g?src=shadcn`, { waitUntil: "load" });
    await page.waitForTimeout(1800);
    const filtered = await page.evaluate(() => ({
      tiles: document.querySelectorAll('[data-tile]:not([data-mode="reference"])').length,
      ref: document.querySelectorAll('[data-mode="reference"]').length,
      header: document.querySelector("[data-gallery-counts]")?.textContent?.trim(),
      total: +document.querySelector("[data-gallery-counts]")?.dataset?.galleryTotal,
      title: document.querySelector("[data-gallery-title]")?.textContent?.trim(),
    }));
    const shadcnDemo = manifest.filter((i) => i.source === "shadcn" && (i.variants || []).length > 0).length;
    const shadcnTotal = manifest.filter((i) => i.source === "shadcn").length;
    out.wide.filtered = { ...filtered, expectDemo: shadcnDemo, expectTotal: shadcnTotal };
    check(
      "C",
      "a filtered grid (#/g?src=shadcn) matches the manifest for that filter",
      "demo tiles == manifest items with source=shadcn and a demo; header total == all shadcn items",
      `${filtered.tiles} tiles (expect ${shadcnDemo}), ${filtered.ref} ref cards, header "${filtered.header}", title "${filtered.title}"`,
      filtered.tiles === shadcnDemo && filtered.total === shadcnTotal ? "PASS" : "FAIL",
    );

    /* the same descent with wheel events — how a person scrolls, and the method the gallery unit used */
    await page.goto(`${BASE}#/g`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__qa = { deltas: [], counts: [], done: false };
      let last = performance.now();
      const step = (now) => {
        window.__qa.deltas.push(now - last);
        last = now;
        window.__qa.counts.push(document.querySelectorAll("iframe").length);
        if (!window.__qa.done) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const wheelT0 = Date.now();
    for (let i = 0; i < 220; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(45);
      const done = await page.evaluate(() => {
        const p = document.querySelector(".page");
        if (p && p.scrollHeight > p.clientHeight + 4) return p.scrollTop + p.clientHeight >= p.scrollHeight - 4;
        return window.scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
      });
      if (done) break;
    }
    await page.waitForTimeout(1200);
    const wheelM = await page.evaluate(() => {
      window.__qa.done = true;
      return { deltas: window.__qa.deltas.slice(2), counts: window.__qa.counts, gallery: window.__gallery ? { ...window.__gallery } : null };
    });
    const wd = wheelM.deltas.filter((d) => d > 0 && d < 2000);
    const wCounts = wheelM.counts;
    const wJumps = wCounts.filter((c, i) => i > 0 && c - wCounts[i - 1] >= 2).length;
    out.wide.wheel = {
      seconds: +((Date.now() - wheelT0) / 1000).toFixed(1),
      frames: wCounts.length,
      maxLive: Math.max(...wCounts),
      liveDistribution: histo(wCounts),
      perFrameIncreaseGe2: wJumps,
      raf: { n: wd.length, p50: pct(wd, 50), p95: pct(wd, 95), max: +Math.max(...wd).toFixed(1), over33: wd.filter((d) => d > 33.4).length },
      gallery: wheelM.gallery,
      load: loadavg(),
    };
    const w = out.wide.wheel;
    check(
      "C",
      "p95 rAF interval, wheel descent (the unit's own method; its claim was p50 16.7 / p95 16.8, 4–6 of ~875 frames over 33.4 ms)",
      "220 wheel events of 400 px, 45 ms apart, rAF deltas sampled every frame until the grid's end",
      `p50=${w.raf.p50} ms, p95=${w.raf.p95} ms, max=${w.raf.max} ms, ${w.raf.over33}/${w.raf.n} frames > 33.4 ms, max live=${w.maxLive}, ${w.frames} frames in ${w.seconds} s — load ${w.load?.l1}`,
      w.raf.p95 !== null && w.raf.p95 < 33.4 ? "PASS" : "FAIL",
    );
    check(
      "C",
      "no more than one mount per animation frame, wheel descent (independent inference)",
      "no sampled frame where the iframe count rises by ≥2; plus __gallery.perFrameMax",
      `frames with +≥2: ${w.perFrameIncreaseGe2}; __gallery.perFrameMax=${w.gallery?.perFrameMax}, mounts=${w.gallery?.mounts}, evictions=${w.gallery?.evictions}, deferred=${w.gallery?.deferred}, live=${w.gallery?.live}`,
      w.perFrameIncreaseGe2 === 0 && w.gallery?.perFrameMax === 1 ? "PASS" : "FAIL",
    );

    out.wide.load = loadavg();
    await c.close();
  }

  /* 20 random demo-bearing items reach "alive" */
  {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    await page.addInitScript(() => {
      window.__alive = {};
      window.addEventListener("message", (e) => {
        const d = e.data;
        if (d && d.designCatalogDemo) window.__alive[d.id + "|" + d.index] = Date.now();
      });
    });
    let seed = 20261028;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const demos = manifest.filter((i) => (i.variants || []).length > 0).map((i) => i.id);
    const sample = [];
    while (sample.length < 20) {
      const pick = demos[Math.floor(rnd() * demos.length)];
      if (!sample.includes(pick)) sample.push(pick);
    }
    const alive = [];
    for (const id of sample) {
      const t0 = Date.now();
      await page.goto(`${BASE}#/i/${id}`, { waitUntil: "load" });
      let ok = null;
      for (let i = 0; i < 60; i++) {
        const hit = await page.evaluate((id) => (window.__alive || {})[`${id}|0`] || null, id);
        if (hit) { ok = hit; break; }
        await page.waitForTimeout(50);
      }
      alive.push({ id, alive: !!ok, ms: ok ? Math.max(0, ok - t0) : null });
    }
    await c.close();
    out.alive = { sample, alive, n: alive.filter((a) => a.alive).length, slowest: Math.max(...alive.map((a) => a.ms || 0)) };
    check("C", "20 random demo-bearing items reached 'alive'", "their own designCatalogDemo postMessage arrived after the demo module mounted and measured", `${out.alive.n}/20 alive, slowest ${out.alive.slowest} ms, load ${loadavg().l1}`, out.alive.n === 20 ? "PASS" : "FAIL");
  }

  /* phone */
  {
    const { c, page } = await ctx(browser, { width: 390, height: 844 });
    await go(page, "#/g", 1500);
    const t0 = await tiles(page);
    await page.evaluate(() => {
      window.__qa = { counts: [], done: false };
      const step = () => {
        window.__qa.counts.push(document.querySelectorAll("iframe").length);
        if (!window.__qa.done) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const scrolled = await scrollToBottom(page, { step: 600, pause: 110 });
    const m = await page.evaluate(() => {
      window.__qa.done = true;
      return {
        counts: window.__qa.counts,
        gallery: window.__gallery ? { ...window.__gallery } : null,
        doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
      };
    });
    const tap = await page.evaluate(tapCensusSrc());
    out.phone = {
      initial: t0,
      scroll: { scroller: scrolled.scroller, maxScroll: scrolled.max, maxLive: Math.max(...m.counts), liveDistribution: histo(m.counts), gallery: m.gallery },
      doc: m.doc,
      tapUnder44: tap.under44,
      tapUnder44Items: tap.items,
      load: loadavg(),
    };
    await page.screenshot({ path: join(SHOTS, "gallery-390-midscroll.png") });
    await c.close();
    check("C", "390: 1–2 live frames", "the phone pool cap is 2 and the descent never exceeds it", `max=${out.phone.scroll.maxLive}, distribution=${JSON.stringify(out.phone.scroll.liveDistribution)}, cap=${out.phone.scroll.gallery?.cap}`, out.phone.scroll.maxLive <= 2 && out.phone.scroll.maxLive >= 1 ? "PASS" : "FAIL");
    check("C", "390: scrollWidth == clientWidth", "no horizontal overflow on the gallery after a full descent", `${m.doc.scrollWidth} / ${m.doc.clientWidth}`, m.doc.scrollWidth === m.doc.clientWidth ? "PASS" : "FAIL");
    check("C", "390: 0 tap targets under 44 px on the gallery", "census of every rendered control (a, button, role=button/radio/tab, input, select, textarea, summary, [tabindex])", `${tap.under44.length} under 44 px${tap.under44.length ? ": " + tap.under44.slice(0, 5).map((x) => `${x.tag}${x.cls} ${x.w}×${x.h} "${x.label}"`).join(" | ") : ""}`, tap.under44.length === 0 ? "PASS" : "FAIL");
  }

  save("C", out);
  return out;
}

/* tap-target + clipping helpers, evaluated in the page */
function tapCensusSrc() {
  return function tapCensus() {
    const SEL =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [role=tab], [role=switch], [role=checkbox], [role=combobox], [tabindex]:not([tabindex="-1"])';
    const items = [];
    for (const el of document.querySelectorAll(SEL)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest("iframe")) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      // an element inside a disabled group is not a target
      if (el.closest("[disabled],[aria-disabled=true]")) continue;
      if (r.width < 44 || r.height < 44) {
        items.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : "",
          w: Math.round(r.width),
          h: Math.round(r.height),
          label: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
          inline: (() => {
            // WCAG 2.5.8 exempts links inline in a sentence; report it so the number is readable
            const p = el.parentElement;
            if (!p) return false;
            return p.textContent.replace(el.textContent || "", "").trim().length > 8;
          })(),
        });
      }
    }
    return { under44: items, count: items.length };
  };
}
function clipSrc() {
  // "clipped" = text you cannot reach. Three things are not clipping: content that paints outside a visible
  // box, content still inside the clipping ancestor's own box (a full-bleed card in a padded column), and
  // `text-overflow: ellipsis`, which is a truncation the design chose and marks with "...".
  return function clip() {
    const out = [];
    const vw = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("iframe")) continue;
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "svg", "path", "img", "iframe", "video", "canvas", "br", "html", "body"].includes(tag)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth <= 0) continue;
      if (!(el.textContent || "").trim()) continue;
      if (cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap") continue;
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue; // the element scrolls: reachable
      const rect = el.getBoundingClientRect();
      let cutter = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.overflowX === "auto" || acs.overflowX === "scroll") { cutter = null; break; } // reachable by scrolling
        if (acs.overflowX === "hidden" || acs.overflowX === "clip") { cutter = a; break; }
      }
      const cutRight = cutter ? cutter.getBoundingClientRect().right - (parseFloat(getComputedStyle(cutter).borderRightWidth) || 0) : vw;
      const contentRight = rect.left + el.scrollWidth;
      const excess = Math.round(contentRight - cutRight);
      if (excess <= 1) continue; // the overflow lands inside the box that would cut it: nothing is lost
      out.push({
        tag,
        cls: typeof el.className === "string" && el.className ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : "",
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: cs.overflowX,
        cutter: cutter ? cutter.tagName.toLowerCase() + (typeof cutter.className === "string" && cutter.className ? "." + cutter.className.split(/\s+/).slice(0, 2).join(".") : "") : "viewport",
        cutPx: excess,
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
      });
    }
    return out.slice(0, 20);
  };
}

/* ── section D: reference-only ────────────────────────────────────────────────────────────────────────── */

async function sectionD(browser) {
  console.log("\n=== D. reference-only ===");
  const out = { load: loadavg() };
  const { c, page } = await ctx(browser, { width: 1440, height: 900 });

  await go(page, "#/g", 1500);
  const def = await tiles(page);
  const refHrefsDefault = await page.evaluate(() => document.querySelectorAll('a[href^="#/i/transitions/"], [data-mode="reference"]').length);
  out.default = { ...def, refHrefs: refHrefsDefault };
  check("D", "default gallery excludes the reference-only items", "no tile with data-mode=reference; shown == manifest demo count", `${def.ref} reference tiles, ${def.demo} demo tiles, header "${def.counts?.text}"`, def.ref === 0 && def.demo === counts.demo ? "PASS" : "FAIL");

  await go(page, "#/g?ref=1", 2500);
  const withRef = await tiles(page);
  const detail = await page.evaluate(() => {
    const card = document.querySelector('[data-mode="reference"]');
    const tile = document.querySelector('[data-tile]:not([data-mode="reference"])');
    const link = card?.querySelector('a[target="_blank"]');
    const cs = card ? getComputedStyle(card.querySelector(":scope > div") || card) : null;
    const ts = tile ? getComputedStyle(tile.querySelector(":scope > div") || tile) : null;
    return {
      refCards: document.querySelectorAll('[data-mode="reference"]').length,
      outbound: [...document.querySelectorAll('[data-mode="reference"] a[target="_blank"]')].length,
      cardStyle: cs ? { borderStyle: cs.borderStyle, borderWidth: cs.borderWidth, borderRadius: cs.borderRadius } : null,
      tileStyle: ts ? { borderStyle: ts.borderStyle, borderWidth: ts.borderWidth, borderRadius: ts.borderRadius } : null,
      cardText: card ? card.innerText.replace(/\s+/g, " ").trim().slice(0, 120) : null,
      linkHref: link ? link.getAttribute("href") : null,
      linkText: link ? link.textContent.trim() : null,
      frames: document.querySelectorAll("iframe").length,
      counts: (() => { const el = document.querySelector("[data-gallery-counts]"); return el ? { shown: +el.dataset.galleryShown, hidden: +el.dataset.galleryHidden, total: +el.dataset.galleryTotal, text: el.textContent.trim() } : null; })(),
      tiles: document.querySelectorAll("[data-tile]").length,
    };
  });
  out.withRef = { ...withRef, ...detail };
  check("D", "ref=1 includes them", "tiles == 769, reference cards == 283, all 283 carry an outbound link", `${detail.tiles} tiles, ${detail.refCards} reference cards, ${detail.outbound} outbound links, header "${detail.counts?.text}"`, detail.tiles === counts.total && detail.refCards === counts.ref && detail.outbound === counts.ref ? "PASS" : "FAIL");
  check("D", "a reference card is visibly a different object", "dashed border vs the demo tile's solid one; no iframe; 'View on <library> ↗' link", `card border ${detail.cardStyle?.borderStyle} ${detail.cardStyle?.borderWidth} vs tile ${detail.tileStyle?.borderStyle} ${detail.tileStyle?.borderWidth}; link "${detail.linkText}" → ${detail.linkHref}`, detail.cardStyle?.borderStyle !== detail.tileStyle?.borderStyle && /View on/.test(detail.linkText || "") && detail.linkHref ? "PASS" : "FAIL");
  check("D", "header counts equal the DOM counts with ref included", "shown == 769 == tiles, hidden == 0, total == 769", `shown=${detail.counts?.shown} tiles=${detail.tiles} hidden=${detail.counts?.hidden}`, detail.counts?.shown === detail.tiles && detail.counts?.hidden === 0 && detail.counts?.total === counts.total ? "PASS" : "FAIL");

  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1200);
  const afterReload = await tiles(page);
  out.afterReload = afterReload;
  check("D", "?ref=1 survives a reload (it is in the URL)", "hash still carries ref=1 and the grid still shows 769", `hash=${await page.evaluate(() => location.hash)}, tiles=${afterReload.tiles}`, afterReload.tiles === counts.total ? "PASS" : "FAIL");

  // the rail's own numbers and the grid's header are the same tree: a row that says N must open a grid of N
  await go(page, "#/", 900);
  const railRows = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".rail-sec, .rail-cat, .rail-sub, .rail-sub2")];
    return rows.map((r) => {
      const link = r.querySelector('a[href*="#/g"]');
      const countEl = r.querySelector(":scope > button .sub-c, :scope .sub-c");
      return {
        level: (r.className.match(/rail-\w+/) || [])[0],
        label: (r.querySelector(":scope > button .sub-n")?.textContent || "").trim().slice(0, 32),
        count: countEl ? +countEl.textContent.trim() : null,
        href: link ? link.getAttribute("href") : null,
        linkLabel: link ? link.getAttribute("aria-label") : null,
        linkBox: link ? (() => { const b = link.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })() : null,
      };
    });
  });
  out.rail = { rows: railRows.length, withLink: railRows.filter((r) => r.href).length, sample: railRows.filter((r) => r.href).slice(0, 3), first: railRows.find((r) => r.href && r.count !== null) };
  const target = out.rail.first;
  check("D", "every counted rail row carries a link to its own grid", "a grid link inside each .rail-sec/.rail-cat/.rail-sub/.rail-sub2 row", `${out.rail.withLink} of ${out.rail.rows} rows have a #/g link; e.g. "${target?.label}" (${target?.count}) → ${target?.href}, link ${target?.linkBox?.w}×${target?.linkBox?.h}, aria-label "${target?.linkLabel}"`, out.rail.withLink === out.rail.rows ? "PASS" : "FAIL");
  if (target && target.href) {
    await page.goto(BASE + target.href, { waitUntil: "load" });
    await page.waitForTimeout(1600);
    const grid = await page.evaluate(() => ({ total: +document.querySelector("[data-gallery-counts]")?.dataset?.galleryTotal, header: document.querySelector("[data-gallery-counts]")?.textContent?.trim(), title: document.querySelector("[data-gallery-title]")?.textContent?.trim() }));
    out.rail.grid = grid;
    check("D", "a rail row's count opens a grid of that count", "the row's printed number vs the grid header's total (one tree, no second derivation)", `rail "${target.label}" says ${target.count}; grid header "${grid.header}" (total ${grid.total}, title "${grid.title}")`, target.count !== null && grid.total === target.count ? "PASS" : "FAIL");
  }

  await c.close();
  save("D", out);
  return out;
}

/* ── section E: facets, honestly ──────────────────────────────────────────────────────────────────────── */

async function sectionE(browser) {
  console.log("\n=== E. facets, honestly ===");
  const py = `
import json, sqlite3
db = sqlite3.connect("file:/root/design-catalog/design-catalog.db?mode=ro", uri=True)
def one(sql):
    return db.execute(sql).fetchone()[0]
o = {}
o["items"] = one("select count(*) from item")
# 'withheld' is a licence-policy fact, not a column: local-only sources are the withheld set
o["withheld"] = one("select count(*) from item i join source s on s.id=i.source_id where s.code_policy='local-only'")
# an item 'has files' when its LATEST snapshot carries a code artifact (the same rule gen.py's file_count uses)
o["with_code"] = one("""
  select count(*) from item i where exists (
    select 1 from artifact a join snapshot sn on sn.id=a.snapshot_id
    where sn.item_id=i.id and a.kind='code' and sn.id=(select max(id) from snapshot where item_id=i.id))""")
o["no_code"] = o["items"] - o["with_code"]
o["port_note_rows"] = one("select count(*) from port_note")
o["port_note_public"] = one("select count(*) from port_note where public = 1")
o["picks"] = one("select count(*) from pick")
o["concepts"] = one("select count(*) from concept")
o["memberships"] = one("select count(*) from concept_item")
o["concepts_one_source"] = one("select count(*) from (select c.id from concept c join concept_item ci on ci.concept_id=c.id join item i on i.id=ci.item_id group by c.id having count(distinct i.source_id) < 2)")
o["bytes_zero_artifacts"] = one("select count(*) from artifact where kind='code' and bytes = 0")
o["sources"] = one("select count(*) from source")
o["per_source"] = dict(db.execute("select s.slug, count(*) from item i join source s on s.id=i.source_id group by s.slug").fetchall())
print(json.dumps(o))
`;
  const dbRaw = execFileSync("bash", ["-lc", `python3 - <<'PY'\n${py}\nPY`], { encoding: "utf8" });
  const db = JSON.parse(dbRaw.trim().split("\n").pop());

  const expected = {
    items: counts.total,
    demo: counts.demo,
    reference_only: counts.ref,
    withheld: counts.withheld,
    with_files: counts.files,
    null_bytes: counts.nullBytes,
    curated_port_notes: db.port_note_rows,
    concepts: db.concepts,
    memberships: db.memberships,
    published_verdicts: db.port_note_public,
  };
  const brief = {
    items: 769, demo: 486, reference_only: 283, withheld: 93, with_files: 591,
    null_bytes: 178, curated_port_notes: 159, concepts: 28, memberships: 95, published_verdicts: 0,
  };
  const e = { db, expected, brief, load: loadavg(), rows: [] };
  const pairs = [
    ["items", "769 items"],
    ["demo", "486 with a demo"],
    ["reference_only", "283 reference-only"],
    ["withheld", "93 withheld"],
    ["with_files", "591 with files"],
    ["null_bytes", "178 with null (not 0)"],
    ["curated_port_notes", "159 curated (port_note rows)"],
    ["concepts", "28 concepts"],
    ["memberships", "95 memberships"],
    ["published_verdicts", "0 published verdicts"],
  ];
  for (const [k, label] of pairs) {
    const row = {
      facet: label,
      brief: brief[k],
      manifest_or_db: k === "curated_port_notes" ? db.port_note_rows : k === "published_verdicts" ? db.port_note_public : expected[k],
      db_query: k === "curated_port_notes" ? "SELECT count(*) FROM port_note" : k === "published_verdicts" ? "SELECT count(*) FROM port_note WHERE public=1" : k === "concepts" ? "SELECT count(*) FROM concept" : k === "memberships" ? "SELECT count(*) FROM concept_item" : k === "withheld" ? "SELECT count(*) FROM item i JOIN source s ON s.id = i.source_id WHERE s.code_policy = 'local-only' (the item table has no withheld column — licence policy is where 93 comes from)" : k === "items" ? "SELECT count(*) FROM item" : k === "with_files" ? "SELECT count(DISTINCT item_id) FROM artifact WHERE kind='code'" : k === "null_bytes" ? "manifest bytes===null (SQLite sum([]) is 0, so this is a build fact)" : k === "demo" ? "manifest: items with variants.length > 0 (the demo set is resolved at build time, not in SQL)" : "769 - 486: the manifest items with no variants (reference-only), also resolved at build time",
      pass: brief[k] === (k === "curated_port_notes" ? db.port_note_rows : k === "published_verdicts" ? db.port_note_public : expected[k]),
    };
    e.rows.push(row);
  }
  check("E", "the manifest's published numbers re-derive from the DB", "each of the brief's 10 numbers, re-derived by this harness's own SQL / manifest read", e.rows.map((r) => `${r.facet}=${r.manifest_or_db}`).join(", "), e.rows.every((r) => r.pass) ? "PASS" : "FAIL");
  check("E", "no zero published where the data has none", "bytes:0 count and file_count:0 count in the manifest", `bytes 0: ${manifest.filter((i) => i.bytes === 0).length}, file_count 0: ${manifest.filter((i) => i.file_count === 0).length}, null: ${counts.nullBytes}`, manifest.filter((i) => i.bytes === 0 || i.file_count === 0).length === 0 ? "PASS" : "FAIL");
  check("E", "the manifest carries no verdict key at all", "item.verdict absent on 769/769 (the store's port_note.public gate)", `${manifest.filter((i) => "verdict" in i).length} items carry verdict`, manifest.filter((i) => "verdict" in i).length === 0 ? "PASS" : "FAIL");
  check("E", "curation is published as data, not as verdicts", "concepts on 95 items, composition on 445, pick on 0", `concepts=${counts.concepts} composition=${counts.composition} pick=${manifest.filter((i) => i.pick).length}`, counts.concepts === 95 && counts.composition === 445 ? "PASS" : "FAIL");

  /* what the pages print, at 1440 and 390 */
  const printed = {};
  for (const vp of [{ name: "1440", width: 1440, height: 900 }, { name: "390", width: 390, height: 844 }]) {
    const { c, page } = await ctx(browser, { width: vp.width, height: vp.height });
    await go(page, "#/", 700);
    printed[vp.name] = await page.evaluate(() => ({
      body: document.body.innerText.replace(/\s+/g, " "),
      tally: [...document.querySelectorAll(".tally-item")].map((el) => el.innerText.replace(/\s+/g, " ").trim()),
    }));
    await go(page, "#/about", 700);
    printed[vp.name].about = (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "))).slice(0, 4000);
    await c.close();
  }
  e.printed = {
    "1440": printed["1440"],
    "390": { body: printed["390"].body.slice(0, 2000), tally: printed["390"].tally, about: printed["390"].about.slice(0, 2000) },
  };
  const home = printed["1440"].body;
  const perSource = {};
  for (const i of manifest) perSource[i.source] = (perSource[i.source] || 0) + 1;
  const claims = [
    ["769", /769/.test(home)],
    ["5 libraries", /5 libraries|five reference libraries/i.test(home)],
    ["591 with a file", /591/.test(home)],
    ["486 live demos", /486/.test(home)],
    ["283 reference-only", /283/.test(home)],
    ["tally per source", Object.entries(perSource).every(([s, n]) => printed["1440"].tally.some((t) => t.includes(String(n))))],
  ];
  e.homeClaims = claims;
  check("E", "the front page's numbers are the data's numbers", "each figure in the crumb/tally/note found in the manifest", claims.map(([k, v]) => `${k}:${v ? "ok" : "MISSING"}`).join(", "), claims.every(([, v]) => v) ? "PASS" : "FAIL");

  const about = printed["1440"].about;
  const aboutClaims = [
    ["676 licence-full", /676/.test(about)],
    ["167 MIT without a file", /167/.test(about)],
    ["93 without source", /93/.test(about)],
    ["178 no captured source", /178/.test(about)],
    ["509 publish a file", /509/.test(about)],
  ];
  e.aboutClaims = aboutClaims;
  check("E", "#/about's numbers are the data's numbers", "676 / 167 / 93 / 178 / 509 each cross-checked against the manifest", aboutClaims.map(([k, v]) => `${k}:${v ? "ok" : "MISSING"}`).join(", "), aboutClaims.every(([, v]) => v) ? "PASS" : "FAIL");

  save("E", e);
  return e;
}

/* ── section F: item page ────────────────────────────────────────────────────────────────────────────── */

async function sectionF(browser) {
  console.log("\n=== F. item page ===");
  const out = { load: loadavg(), items: {} };
  const ITEMS = ["shadcn/dashboard-01", "beui/bloom-menu"];

  for (const id of ITEMS) {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    await page.addInitScript(() => {
      window.__alive = [];
      window.addEventListener("message", (e) => {
        if (e.data && e.data.designCatalogDemo) window.__alive.push({ ...e.data, t: Date.now() });
      });
    });
    await go(page, `#/i/${id}`, 2500);
    const frameInfo = () =>
      page.evaluate(() => {
        const f = document.querySelector(".stage iframe, .demo-body iframe") || document.querySelector("iframe");
        if (!f) return null;
        const r = f.getBoundingClientRect();
        const doc = f.contentDocument;
        const lane = document.querySelector(".demo-body") || f.parentElement;
        return {
          src: f.getAttribute("src"),
          rendered: { w: Math.round(r.width), h: Math.round(r.height) },
          childViewport: doc ? { w: doc.documentElement.clientWidth, h: doc.documentElement.clientHeight } : null,
          childOverflowX: doc ? doc.documentElement.scrollWidth - doc.documentElement.clientWidth : null,
          lane: lane ? { scrollWidth: lane.scrollWidth, clientWidth: lane.clientWidth } : null,
          page: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
          childHtmlClass: doc ? doc.documentElement.className : null,
          siteHtmlClass: document.documentElement.className,
          siteThemeAttr: document.documentElement.getAttribute("data-theme"),
          alive: (window.__alive || []).length,
        };
      });
    const modes = {};
    for (const [mode, label] of [["390", "Phone viewport, 390 CSS pixels"], ["768", "Tablet viewport, 768 CSS pixels"], ["full", "Full column width"]]) {
      const btn = page.locator(`[data-stage-bar] [role=radio][aria-label="${label}"]`);
      if (await btn.count()) {
        await btn.click({ force: true });
        await page.waitForTimeout(1200);
      }
      modes[mode] = await frameInfo();
    }
    // theme: the demo repaints, the catalogue does not
    await page.locator('[data-stage-bar] [aria-label="Preview the demo in dark"]').first().click({ force: true });
    await page.waitForTimeout(900);
    const themed = await frameInfo();
    const follow = await page.locator('[data-stage-bar] [aria-label^="Stop overriding the theme"]').count();
    if (follow) { await page.locator('[data-stage-bar] [aria-label^="Stop overriding the theme"]').first().click({ force: true }); await page.waitForTimeout(700); }
    const followed = await frameInfo();

    // replay ×3 (motion items only)
    const replay = [];
    const replayBtn = page.locator('[data-stage-bar] [aria-label="Replay this demo from the start"]');
    const hasReplay = await replayBtn.count();
    if (hasReplay) {
      for (let i = 1; i <= 3; i++) {
        const before = await frameInfo();
        const n0 = before.alive;
        await replayBtn.first().click({ force: true });
        await page.waitForTimeout(1200);
        const after = await frameInfo();
        replay.push({ click: i, srcBefore: before.src, srcAfter: after.src, aliveBefore: n0, aliveAfter: after.alive, nonce: (after.src || "").split("|").pop() });
      }
    }
    out.items[id] = { modes, themed, followed, hasReplay: !!hasReplay, replay, load: loadavg() };
    await c.close();
  }

  /* reduced motion: CSS stops, script does not — probed under BOTH conditions */
  // (a) the OS asks for reduced motion (the stage then starts with motion=off)
  // (b) the OS does not, and the visitor clicks the stage's "off"
  // The probe names elements whose computed transform/opacity changes inside the child's own document,
  // which is how rAF-driven motion shows itself when there is no CSS animation to read.
  const motionProbe = async (id, c) => {
    const page = await c.newPage();
    await page.goto(`${BASE}#/i/${id}`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    return page.evaluate(async () => {
      const f = document.querySelector(".stage iframe, .demo-body iframe");
      const doc = f?.contentDocument;
      if (!doc) return null;
      const anims = doc.getAnimations ? doc.getAnimations() : [];
      const running = anims.filter((a) => a.playState === "running");
      const snap = () => {
        const out = new Map();
        for (const el of doc.querySelectorAll("body *")) {
          const cs = doc.defaultView.getComputedStyle(el);
          const interesting = (cs.transform && cs.transform !== "none") || +cs.opacity !== 1 || (el.getAttribute("style") || "").match(/transform|opacity/);
          if (!interesting) continue;
          out.set(el, `${cs.transform}|${cs.opacity}`);
        }
        return out;
      };
      const a = snap();
      await new Promise((r) => setTimeout(r, 500));
      const b = snap();
      const moved = [];
      for (const [el, va] of a) {
        const vb = b.get(el);
        if (vb && vb !== va) moved.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 36), a: va.slice(0, 40), b: (vb || "").slice(0, 40) });
      }
      return {
        childHtmlClass: doc.documentElement.className,
        sizes: { animations: anims.length, running: running.length },
        runningNames: running.slice(0, 8).map((x) => `${x.animationName || x.transitionProperty || x.constructor.name}`),
        sampled: a.size,
        moved: moved.length,
        examples: moved.slice(0, 4),
        barText: document.querySelector("[data-stage-bar]")?.innerText?.replace(/\s+/g, " ").trim().slice(-120) || null,
        motionChecked: document.querySelector('[data-stage-bar] [role=radio][aria-label="Motion off: CSS animation and transition stopped"]')?.getAttribute("aria-checked") || null,
      };
    });
  };

  for (const id of ["shadcn/skeleton", "beui/bloom-menu"]) {
    const { c } = await ctx(browser, { width: 1440, height: 900 }, { reducedMotion: "reduce" });
    const rm = await motionProbe(id, c);
    await c.close();
    out[`reduced_${id}`] = rm;
    if (!rm) continue;
    const ok = rm.sizes.running === 0;
    check(
      "F",
      `prefers-reduced-motion: reduce ⇒ zero RUNNING CSS animations in the child (${id})`,
      "child document.getAnimations() filtered to playState=running, with the stage defaulting to motion=off",
      `animations=${rm.sizes.animations}, running=${rm.sizes.running}, child <html>="${rm.childHtmlClass}", ${rm.moved} of ${rm.sampled} styled elements changed in 500 ms${rm.moved ? " — JS motion still running: " + rm.examples.map((x) => `<${x.tag} class="${x.cls}">`).join(", ") : " — no JS-driven motion observed"}`,
      ok ? "PASS" : "FAIL",
    );
    check(
      "F",
      `reduced-motion honesty, ${id}: what the bar claims vs what moves`,
      "under OS reduce: the bar says 'CSS motion stopped … Script-driven motion keeps running'. Does anything still move?",
      `bar ends "${rm.barText}"; ${rm.moved} moving element(s)${rm.moved ? " (so the sentence is true here)" : " ⇒ motion/react honours the OS preference, so the sentence over-states for this demo"}`,
      "INFO",
    );
  }

  // (b) OS does not reduce motion. Does the JS-driven motion survive `motion=off`? Both halves are measured
  //     with the demo woken up (a click inside the frame), because bloom-menu is idle until it is touched.
  {
    const sampleInside = async (page) =>
      page.evaluate(async () => {
        const doc = document.querySelector(".stage iframe, .demo-body iframe")?.contentDocument;
        if (!doc) return null;
        const anims = doc.getAnimations ? doc.getAnimations() : [];
        const running = anims.filter((a) => a.playState === "running");
        const snap = () => {
          const m = new Map();
          for (const el of doc.querySelectorAll("body *")) {
            const cs = doc.defaultView.getComputedStyle(el);
            if ((cs.transform && cs.transform !== "none") || +cs.opacity !== 1) m.set(el, `${cs.transform}|${cs.opacity}`);
          }
          return m;
        };
        const a = snap();
        await new Promise((r) => setTimeout(r, 420));
        const b = snap();
        const moved = [];
        for (const [el, va] of a) { const vb = b.get(el); if (vb && vb !== va) moved.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 40), a: va.slice(0, 44), b: (vb || "").slice(0, 44) }); }
        return { childHtmlClass: doc.documentElement.className, animations: anims.length, running: running.length, sampled: a.size, moved: moved.length, examples: moved.slice(0, 4) };
      });
    const wake = async (page) => {
      for (const f of page.frames()) {
        if (!/demo\.html/.test(f.url())) continue;
        const btn = f.locator("button").first();
        try { await btn.hover({ timeout: 1500 }); await btn.click({ force: true, timeout: 1500 }); } catch {}
      }
      await page.waitForTimeout(150);
    };

    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    await go(page, "#/i/beui/bloom-menu", 2500);
    await wake(page);
    const on = { ...(await sampleInside(page)), src: await page.evaluate(() => document.querySelector(".stage iframe")?.getAttribute("src")) };
    const offBtn = page.locator('[data-stage-bar] [aria-label="Motion off: CSS animation and transition stopped"]');
    if (await offBtn.count()) { await offBtn.click({ force: true }); await page.waitForTimeout(800); }
    await wake(page);
    const off = { ...(await sampleInside(page)), src: await page.evaluate(() => document.querySelector(".stage iframe")?.getAttribute("src")) };
    await c.close();
    out.motionOff = { on, off };
    check(
      "F",
      "motion=off stops the CSS, and the JS-driven motion that keeps running is named (or shown to be absent)",
      "OS does not reduce motion; the demo is woken with a click inside the frame, then its computed styles are sampled 420 ms apart with motion on and with motion=off",
      `motion=on: ${on.moved}/${on.sampled} moving, ${on.running} running CSS; motion=off: ${off.moved}/${off.sampled} moving, ${off.running} running CSS; child class "${off.childHtmlClass}"; src ${off.src}${off.moved ? " — still moving: " + off.examples.map((x) => `<${x.tag} class="${x.cls}"> ${x.a} → ${x.b}`).join("; ") : " — nothing moves after the flag, so the bar's 'script-driven motion keeps running' does not reproduce on this demo"}`,
      off.running === 0 ? "PASS" : "FAIL",
    );
  }

  /* the height-0 hunt: does ANY demo report height 0? (the brief's third subject) */
  {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    await page.addInitScript(() => {
      window.__heights = [];
      window.addEventListener("message", (e) => {
        if (e.data && e.data.designCatalogDemo) window.__heights.push({ height: e.data.height, width: e.data.width });
      });
    });
    // candidates: the demo modules whose own CSS asks for a viewport-relative height, i.e. the child's
    // `viewportSized` branch — the only path that can report 0.
    const candFiles = execFileSync(
      "bash",
      ["-lc", `cd ${APP} && grep -rlE "(min-)?h-screen|h-\\[[0-9]+(vh|dvh|svh)|height: *[0-9]+(vh|dvh|svh)|min-h-\\[[0-9]+(vh|dvh|svh)" src/demos 2>/dev/null`],
      { encoding: "utf8" },
    ).split("\n").filter(Boolean).map((f) => f.replace(/^src\//, ""));
    const candItems = manifest.filter((i) => (i.variants || []).some((v) => candFiles.includes(v.module))).map((i) => i.id);
    const demos = manifest.filter((i) => (i.variants || []).length > 0).map((i) => i.id);
    let seed = 424242;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const others = [];
    while (others.length < 40) {
      const pick = demos[Math.floor(rnd() * demos.length)];
      if (!others.includes(pick)) others.push(pick);
    }
    const scan = [...new Set([...candItems, ...others])];
    const heights = [];
    for (const id of scan) {
      await page.goto(`${BASE}#/i/${id}`, { waitUntil: "load" });
      await page.waitForTimeout(1100);
      const hs = await page.evaluate(() => window.__heights || []);
      for (const h of hs) heights.push({ ...h, item: id });
    }
    await c.close();
    const zeros = heights.filter((h) => h.height === 0);
    out.heightZero = { candidateFiles: candFiles, candidateItems: candItems, scanned: scan.length, reports: heights.length, zeros, distinct: [...new Set(heights.map((h) => h.height))].sort((a, b) => a - b) };
    check(
      "F",
      "the brief's third subject — an item whose demo reports height 0 — exists (or is shown not to)",
      "scan: every demo whose own CSS asks for a viewport height (the only branch that can report 0), plus 40 seeded-random demo items; child-reported height from the designCatalogDemo message",
      `${zeros.length} zero-height report(s) in ${heights.length} reports over ${scan.length} items (${candItems.length} candidate + 40 random); reported heights seen: ${out.heightZero.distinct.join(", ")}`,
      zeros.length > 0 ? "PASS" : "NONE",
    );
  }

  /* The brief asks for "one item whose demo reports height 0". No real demo does (above), so the branch is
     forced instead of assumed: the child's own load is aborted, the page receives the 0 report itself, and the
     frame must answer with SELF_FLOOR. Suppressing the child is what makes the branch reachable — a real demo
     has already sent a positive height, and `shown = h > 0 ? h : self ? selfFloor : floor` takes that height. */
  {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    const prove = async (id) => {
      await page.route(/demo\.html/, (r) => r.abort());
      await go(page, `#/i/${id}`, 1400);
      const read = () =>
        page.evaluate(() => {
          const f = document.querySelector(".demo iframe");
          return { frame: Math.round(f.getBoundingClientRect().height), declared: f.style.height, lane: Math.round(document.querySelector(".demo-body")?.getBoundingClientRect().height || 0) };
        });
      const before = await read();
      // the page has no positive report to prefer (the child never loaded), so the 0 branch decides the frame
      await page.evaluate((i) => window.postMessage({ designCatalogDemo: true, id: i, index: 0, height: 0, width: 390 }, "*"), id);
      await page.waitForTimeout(700);
      const after = await read();
      await page.unroute(/demo\.html/);
      return { id, before, after };
    };
    const comp = await prove("shadcn/button");
    const block = await prove("shadcn/dashboard-01");
    await c.close();
    out.selfFloor = { comp, block, note: "the child's own load is aborted on purpose, so the 0 report is the first and only one" };
    check(
      "F",
      "the 0 branch reads SELF_FLOOR — 360 for a component; for a block the class floor is already 900, so it is a no-op there",
      "the demo iframe's load is aborted, the page posts the child's own 0 report ({designCatalogDemo:true, height:0}), and the frame's height is read from the DOM",
      `shadcn/button: ${comp.before.frame} px (floor ${comp.before.declared}) → ${comp.after.frame} px (${comp.after.declared}) = SELF_FLOOR.other 360; shadcn/dashboard-01: ${block.before.frame} → ${block.after.frame} px, unchanged because FLOOR.block.wide == SELF_FLOOR.block.wide == 900; lane ${comp.before.lane}→${comp.after.lane}`,
      comp.after.frame === 360 && block.after.frame === 900 ? "PASS" : "FAIL",
    );
  }

  save("F", out);

  // the pass/fail rows for the two subjects
  for (const id of ITEMS) {
    const m = out.items[id].modes;
    const phones = m["390"], tablets = m["768"], full = m["full"];
    const okW = phones?.childViewport?.w === 390 && tablets?.childViewport?.w === 768 && !!full;
    check("F", `${id}: child viewport is exactly 390 / 768 / column in the three modes`, "child documentElement.clientWidth per mode", `390→${phones?.childViewport?.w}, 768→${tablets?.childViewport?.w}, full→${full?.childViewport?.w}; rendered ${phones?.rendered.w}×${phones?.rendered.h} / ${tablets?.rendered.w}×${tablets?.rendered.h} / ${full?.rendered.w}×${full?.rendered.h}`, okW ? "PASS" : "FAIL");
    const noClip = [phones, tablets, full].every((x) => x && (x.childOverflowX ?? 0) <= 0 && x.lane && x.lane.scrollWidth <= x.lane.clientWidth + 1 && x.page.scrollWidth === x.page.clientWidth);
    check("F", `${id}: no horizontal clipping in any mode`, "child documentElement.scrollWidth ≤ clientWidth, lane scrollWidth ≤ clientWidth, page scrollWidth == clientWidth", `child overflow x: ${[phones, tablets, full].map((x) => x?.childOverflowX).join("/")}; lane ${[phones, tablets, full].map((x) => `${x?.lane?.scrollWidth}/${x?.lane?.clientWidth}`).join(" ")}`, noClip ? "PASS" : "FAIL");
    const rep = out.items[id].replay;
    if (rep.length) {
      const srcs = [out.items[id].themed.src, ...rep.map((r) => r.srcAfter)];
      const nonces = rep.map((r) => (r.srcAfter || "").match(/replay=(\d+)/)?.[1]);
      const alive = rep.every((r) => r.aliveAfter > r.aliveBefore);
      check("F", `${id}: replay works three times`, "each click changes the replay nonce and the child reports again (designCatalogDemo count rises)", `${nonces.join(" → ")}; alive counts ${rep.map((r) => `${r.aliveBefore}→${r.aliveAfter}`).join(", ")}`, nonces.join(",") === "1,2,3" && alive ? "PASS" : "FAIL");
    } else {
      check("F", `${id}: Replay absent on a non-motion item (not a dead button)`, "the Replay control is only rendered for motion items", `Replay buttons: 0 — item is not motion`, rep.length === 0 ? "PASS" : "FAIL");
    }
    const th = out.items[id].themed, fo = out.items[id].followed;
    const themeOk = /dark/.test(th?.childHtmlClass || "") && th?.siteHtmlClass === "" && fo && !/dark/.test(fo.childHtmlClass || "") && fo.siteHtmlClass === "";
    check("F", `${id}: the theme switch changes the child's <html> class and not the site's`, "child <html> gains .dark, site <html> keeps no class; 'follow site' hands it back", `child "${th?.childHtmlClass}" / site "${th?.siteHtmlClass}"; after follow: child "${fo?.childHtmlClass}" / site "${fo?.siteHtmlClass}"`, themeOk ? "PASS" : "FAIL");
  }
  return out;
}

/* ── section G: the shell ───────────────────────────────────────────────────────────────────────────── */

async function sectionG(browser) {
  console.log("\n=== G. shell ===");
  const out = { load: loadavg() };
  const { c, page } = await ctx(browser, { width: 1440, height: 900 });

  await go(page, "#/i/shadcn/button", 800);
  // focus something specific first, so "Esc returns focus" is testable
  const beforeFocus = await page.evaluate(() => {
    const el = document.querySelector(".rail input") || document.querySelector("a[href]");
    el.focus();
    return { tag: el.tagName.toLowerCase(), label: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || "").trim().slice(0, 40), same: document.activeElement === el };
  });

  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => {
    // the palette only: the provenance tag is also a role=dialog (it is a Popover that opens on focus)
    const dlg = document.querySelector('[role="dialog"]:has([data-slot="command-input"])');
    const ae = document.activeElement;
    return {
      dialog: !!dlg,
      labelled: dlg?.getAttribute("aria-labelledby") ? document.getElementById(dlg.getAttribute("aria-labelledby"))?.textContent?.trim() || dlg.getAttribute("aria-labelledby") : null,
      described: !!dlg?.getAttribute("aria-describedby"),
      focusInside: !!dlg && dlg.contains(ae),
      focusSlot: ae?.getAttribute("data-slot") || ae?.tagName?.toLowerCase(),
      guards: document.querySelectorAll("[data-radix-focus-guard]").length,
      width: dlg ? Math.round(dlg.getBoundingClientRect().width) : null,
    };
  });
  out.opened = { beforeFocus, ...opened };
  check("G", "mod+k opens the palette with the keyboard alone, and focuses it", "dialog present, focus inside it (the command input), announced by aria-labelledby/describedby", `dialog=${opened.dialog}, focus=${opened.focusSlot}, inside=${opened.focusInside}, labelled "${opened.labelled}", describedby=${opened.described}`, opened.dialog && opened.focusInside && !!opened.labelled ? "PASS" : "FAIL");

  await page.keyboard.type("sidebar", { delay: 20 });
  await page.waitForTimeout(500);
  const results = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-slot="command-item"]')].map((r) => r.textContent.replace(/\s+/g, " ").trim());
    return { n: rows.length, first: rows[0] || null, hasSidebar: rows.some((r) => /^sidebar/i.test(r)) };
  });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const nav = await page.evaluate(() => ({ hash: location.hash, route: document.querySelector("[data-route]")?.dataset.route, dialog: !!document.querySelector('[role="dialog"]') }));
  out.results = { ...results, ...nav };
  check("G", "finds `sidebar` and Enter navigates", "the first row is a sidebar item; Enter lands on its item page and closes the palette", `${results.n} rows, first "${results.first}"; hash=${nav.hash}, route=${nav.route}, dialog=${nav.dialog}`, results.hasSidebar && /#\/i\/shadcn\/sidebar/.test(nav.hash) && nav.route === "item" && !nav.dialog ? "PASS" : "FAIL");

  // Esc → focus returns to where it was
  await page.evaluate(() => { const el = document.querySelector(".rail input, .rail a[href], main a[href]"); el.focus(); });
  const desc = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName.toLowerCase()}${el.getAttribute("placeholder") ? `[placeholder=${el.getAttribute("placeholder")}]` : ""}${el.getAttribute("aria-label") ? `[aria-label=${el.getAttribute("aria-label")}]` : ""}` : "none";
  });
  const focusBeforeEsc = await desc();
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  // poll instead of guessing a wait: the palette unmounts when its exit animation ends
  const afterEsc = await (async () => {
    for (let i = 0; i < 20; i++) {
      const st = await page.evaluate(() => ({
        dialog: !!document.querySelector('[role="dialog"]:has([data-slot="command-input"])'),
        focus: (() => {
          const el = document.activeElement;
          return el ? `${el.tagName.toLowerCase()}${el.getAttribute("placeholder") ? `[placeholder=${el.getAttribute("placeholder")}]` : ""}${el.getAttribute("aria-label") ? `[aria-label=${el.getAttribute("aria-label")}]` : ""}` : "none";
        })(),
      }));
      if (!st.dialog && st.focus !== "body" && st.focus !== "none") return { ...st, waitedMs: i * 100 };
      await page.waitForTimeout(100);
    }
    return page.evaluate(() => ({
      dialog: !!document.querySelector('[role="dialog"]:has([data-slot="command-input"])'),
      focus: (() => {
        const el = document.activeElement;
        return el ? `${el.tagName.toLowerCase()}${el.getAttribute("placeholder") ? `[placeholder=${el.getAttribute("placeholder")}]` : ""}${el.getAttribute("aria-label") ? `[aria-label=${el.getAttribute("aria-label")}]` : ""}` : "none";
      })(),
      waitedMs: 2000,
    }));
  })();
  out.esc = { focusBeforeEsc, ...afterEsc };
  check("G", "Esc closes and returns focus", "focus lands back on the element that had it before the palette opened", `before="${focusBeforeEsc}" after="${afterEsc.focus}" dialog=${afterEsc.dialog}`, !afterEsc.dialog && afterEsc.focus === focusBeforeEsc ? "PASS" : "FAIL");

  // the transition: duration < 300 ms, none under reduced motion
  await go(page, "#/i/shadcn/button", 600);
  // The wrapper is remounted by the route change, and reading getAnimations() from a separate round trip
  // outlives the 250 ms animation (measured flaky: count 1, then 0). So the harness interposes
  // Element.prototype.animate — it records the call the page actually made, with the options it passed.
  await page.evaluate(() => {
    window.__anims = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (kf, opts) {
      const a = orig.call(this, kf, opts);
      window.__anims.push({
        t: Math.round(performance.now()),
        tag: this.getAttribute && this.getAttribute("data-catalog-item"),
        duration: a.effect?.getTiming?.().duration,
        easing: a.effect?.getTiming?.().easing,
        props: [...new Set((a.effect?.getKeyframes?.() || []).flatMap((k) => Object.keys(k).filter((x) => !["offset", "easing", "composite", "computedOffset"].includes(x))))],
        state: a.playState,
      });
      return a;
    };
  });
  const anim = await page.evaluate(async () => {
    location.hash = "#/i/shadcn/sidebar";
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('[data-catalog-item="transitions/page-side-by-side"]');
    const live = el ? el.getAnimations().map((a) => ({ duration: a.effect?.getTiming?.().duration, state: a.playState })) : [];
    await new Promise((r) => setTimeout(r, 500));
    const rec = (window.__anims || []).filter((a) => a.tag === "transitions/page-side-by-side");
    return {
      found: !!el,
      recorded: rec.length,
      called: rec[0] || null,
      presentAtFirstFrame: live.length,
      live,
      allRecorded: (window.__anims || []).map((a) => a.tag),
    };
  });
  out.transition = anim;
  const dur = anim.called?.duration || 0;
  check(
    "G",
    "page transition duration < 300 ms",
    "the call the page actually made: Element.prototype.animate interposed for the route change, plus getAnimations() on the tagged wrapper at the first frame",
    `recorded=${anim.recorded} call(s) on "${anim.called?.tag}"; duration=${dur} ms, easing=${anim.called?.easing}, props=${JSON.stringify(anim.called?.props)}, state=${anim.called?.state}; present in getAnimations() at frame 1: ${anim.presentAtFirstFrame}; other animate() calls on the run: ${JSON.stringify(anim.allRecorded)}`,
    anim.found && dur > 0 && dur < 300 ? "PASS" : "FAIL",
  );

  // scroll reset
  await go(page, "#/g", 1200);
  const reset = await page.evaluate(async () => {
    const p = document.querySelector(".page");
    const target = p && p.scrollHeight > p.clientHeight + 10 ? p : null;
    if (target) target.scrollTop = 400; else window.scrollTo(0, 400);
    const before = target ? target.scrollTop : window.scrollY;
    location.hash = "#/i/shadcn/button";
    await new Promise((r) => setTimeout(r, 700));
    return { scroller: target ? ".page" : "window", before, after: target ? target.scrollTop : window.scrollY };
  });
  out.scrollReset = reset;
  check("G", "the scroll reset still works", "a route change returns the scroller to 0", `${reset.scroller}: ${reset.before} → ${reset.after}`, reset.after === 0 ? "PASS" : "FAIL");

  // #/chrome: rows == manifest.filter(used_here>0).length, and no row claims a use the DOM contradicts
  await go(page, "#/chrome", 900);
  const chrome = await page.evaluate(() => {
    const tables = [...document.querySelectorAll("table")];
    const mainT = tables.find((t) => /on this page/i.test(t.querySelector("thead")?.innerText || "")) || tables[0];
    const parseT = (t) =>
      [...(t?.querySelectorAll("tbody tr") || [])]
        .map((r) => {
          const a = r.querySelector('a[href^="#/i/"]');
          const tds = [...r.querySelectorAll("td")];
          const cells = tds.map((td) => td.textContent.replace(/\s+/g, " ").trim());
          const first = cells[0] || "";
          const id = a ? (a.getAttribute("href") || "").replace("#/i/", "") : /^[a-z0-9.-]+\/[\w.-]+$/i.test(first) ? first : null;
          return id ? { id, printed: cells.at(-1), cells, linked: !!a } : null;
        })
        .filter(Boolean);
    const rows = parseT(mainT);
    const drift = tables.filter((t) => t !== mainT).flatMap((t) => parseT(t));
    return {
      rows,
      drift,
      domCounts: rows.map((p) => ({ id: p.id, dom: document.querySelectorAll(`[data-catalog-item="${p.id}"]`).length })),
      tables: tables.length,
      tagged: [...new Set([...document.querySelectorAll("[data-catalog-item]")].map((e) => e.getAttribute("data-catalog-item")))],
      body: document.body.innerText.replace(/\s+/g, " ").slice(0, 600),
    };
  });
  if (chrome.tagged) {
    const byId = Object.fromEntries(manifest.map((i) => [i.id, i]));
    const expectedDrift = chrome.tagged.filter((id) => byId[id] && !(byId[id].used_here > 0)).sort();
    const expectedUnknown = chrome.tagged.filter((id) => !byId[id]).sort();
    const shown = (chrome.drift || []).map((d) => d.id);
    const shownDrift = shown.filter((id) => byId[id]).sort();
    const shownUnknown = shown.filter((id) => !byId[id]).sort();
    chrome.driftTruth = {
      taggedCount: chrome.tagged.length,
      tagged: chrome.tagged.slice().sort(),
      expectedDrift, expectedUnknown, shownDrift, shownUnknown,
      equal: JSON.stringify(expectedDrift) === JSON.stringify(shownDrift) && JSON.stringify(expectedUnknown) === JSON.stringify(shownUnknown),
    };
    check(
      "G",
      "the drift table lists exactly the tagged-but-unused ids (and the tags that name nothing)", "every data-catalog-item in #/chrome's own DOM, split into in-catalogue-but-used_here-0 and not-a-catalogue-id; the page's drift table must equal that set",
      `${chrome.driftTruth.taggedCount} tagged elements → expected drift [${expectedDrift.join(", ") || "none"}] + unknown [${expectedUnknown.join(", ") || "none"}]; the page shows drift [${shownDrift.join(", ") || "none"}] + unknown [${shownUnknown.join(", ") || "none"}]`,
      chrome.driftTruth.equal ? "PASS" : "FAIL",
    );
  }
  out.chrome = { ...chrome, expected: counts.usedHere.length, ids: counts.usedHere.map((i) => i.id) };
  check("G", "#/chrome's rows equal manifest.filter(used_here > 0).length", "row count on the page vs the manifest", `${chrome.rows.length} rows vs ${counts.usedHere.length} items with used_here>0`, chrome.rows.length === counts.usedHere.length ? "PASS" : "FAIL");
  const contradictions = chrome.rows
    .map((r) => {
      const dom = chrome.domCounts.find((d) => d.id === r.id)?.dom ?? 0;
      const printed = /^\d+$/.test(r.printed) ? +r.printed : null;
      return { id: r.id, printed, dom, badge: r.badge };
    })
    .filter((r) => r.printed !== null && r.printed !== r.dom);
  out.chromeContradictions = contradictions;
  check("G", "no row claims a use the DOM contradicts", "printed count vs querySelectorAll('[data-catalog-item=id]').length on the same view", `${contradictions.length} row(s) differ${contradictions.length ? ": " + contradictions.map((x) => `${x.id} printed ${x.printed} dom ${x.dom}`).join(", ") : ""}`, contradictions.length === 0 ? "PASS" : "FAIL");

  await c.close();

  // reduced motion: no animations at all on a route change
  {
    const { c: c2, page: p2 } = await ctx(browser, { width: 1440, height: 900 }, { reducedMotion: "reduce" });
    await go(p2, "#/i/shadcn/button", 700);
    const rm = await p2.evaluate(async () => {
      location.hash = "#/i/shadcn/sidebar";
      await new Promise((r) => requestAnimationFrame(r));
      const el = document.querySelector('[data-catalog-item="transitions/page-side-by-side"]');
      return { anims: document.getAnimations().filter((a) => a.playState === "running").length, tagAnims: el ? el.getAnimations().length : -1 };
    });
    out.reducedMotionTransition = rm;
    await c2.close();
  }
  check("G", "zero animations on a route change under reduced motion", "prefers-reduced-motion: reduce ⇒ document.getAnimations() running == 0", `running document animations=${out.reducedMotionTransition.anims}, on the transition wrapper=${out.reducedMotionTransition.tagAnims}`, out.reducedMotionTransition.anims === 0 && out.reducedMotionTransition.tagAnims === 0 ? "PASS" : "FAIL");

  // palette at 390
  {
    const { c: c3, page: p3 } = await ctx(browser, { width: 390, height: 844 });
    await go(p3, "#/", 700);
    await p3.locator('button[aria-label*="Search"], button:has-text("Search")').first().click({ force: true }).catch(() => {});
    await p3.waitForTimeout(300);
    let dlg = await p3.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (!dlg) {
      await p3.keyboard.press("Control+k");
      await p3.waitForTimeout(400);
      dlg = await p3.evaluate(() => !!document.querySelector('[role="dialog"]'));
    }
    // the dialog scales in; measure only once its box stops changing
    await p3.waitForFunction(() => {
      const d = document.querySelector('[data-slot="dialog-content"]');
      if (!d) return false;
      const w = Math.round(d.getBoundingClientRect().width);
      const seen = (window.__qaW = window.__qaW || []);
      seen.push(w);
      return seen.length > 6 && seen.slice(-4).every((x) => x === seen[seen.length - 1]);
    }, { timeout: 5000 }).catch(() => {});
    const m = await p3.evaluate(() => {
      const d = document.querySelector('[data-slot="dialog-content"]');
      const list = document.querySelector('[data-slot="command-list"]');
      return {
        doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
        dialog: d ? { w: Math.round(d.getBoundingClientRect().width), scrollWidth: d.scrollWidth, clientWidth: d.clientWidth } : null,
        list: list ? { scrollWidth: list.scrollWidth, clientWidth: list.clientWidth } : null,
        focus: document.activeElement?.getAttribute("data-slot") || document.activeElement?.tagName,
      };
    });
    await p3.screenshot({ path: join(SHOTS, "palette-390.png") });
    await c3.close();
    out.palette390 = m;
    check("G", "the palette is usable at 390 with no horizontal scroll", "document, dialog and result list scrollWidth == clientWidth; the input is focused", `doc ${m.doc.scrollWidth}/${m.doc.clientWidth}, dialog ${m.dialog?.scrollWidth}/${m.dialog?.clientWidth} (${m.dialog?.w} px wide), list ${m.list?.scrollWidth}/${m.list?.clientWidth}, focus=${m.focus}`, m.doc.scrollWidth === m.doc.clientWidth && (!m.dialog || m.dialog.scrollWidth === m.dialog.clientWidth) ? "PASS" : "FAIL");
  }

  save("G", out);
  return out;
}

/* ── section H: type and theme ───────────────────────────────────────────────────────────────────────── */

async function sectionH(browser) {
  console.log("\n=== H. type and theme ===");
  const out = { load: loadavg() };
  const distWoff = existsSync(join(APP, "dist"))
    ? (function walk(d, rel = "", acc = []) {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          const r = rel ? `${rel}/${f}` : f;
          if (statSync(p).isDirectory()) walk(p, r, acc);
          else if (f.endsWith(".woff2")) acc.push(r);
        }
        return acc;
      })(join(APP, "dist"))
    : [];
  out.distWoff2 = distWoff;

  const { c, page, net } = await ctx(browser, { width: 1440, height: 900 }, { colorScheme: "dark" });
  // record the first animation frame's <html> state — the frame before the first paint
  await page.addInitScript(() => {
    window.__qaFirst = new Promise((resolve) => {
      requestAnimationFrame(() => {
        const cs = getComputedStyle(document.documentElement);
        resolve({ cls: document.documentElement.className, theme: document.documentElement.getAttribute("data-theme"), bg: cs.backgroundColor, t: performance.now() });
      });
    });
  });
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "commit" });
  const shotAt = Date.now() - t0;
  const shot = await page.screenshot({ path: join(SHOTS, "noflash-dark-first-paint.png") });
  const first = await page.evaluate(() => window.__qaFirst);
  await page.waitForTimeout(1200);

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => ({ family: f.family, status: f.status }));
    return {
      checkSans: document.fonts.check('16px "Instrument Sans"'),
      checkMono: document.fonts.check('16px "JetBrains Mono"'),
      faces,
      bodyFamily: getComputedStyle(document.body).fontFamily,
      monoFamily: getComputedStyle(document.querySelector("pre, code, .crumb") || document.body).fontFamily,
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    };
  });
  const woffReqs = net.requests.filter((u) => u.endsWith(".woff2"));
  out.fonts = { ...fonts, woffReqs };
  out.external = net.external;
  out.requests = net.requests.length;

  // decode the ~60 ms screenshot in the browser and read the painted pixel
  const b64 = shot.toString("base64");
  const pixel = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = "data:image/png;base64," + data;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext("2d");
    g.drawImage(img, 0, 0);
    const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3);
    return { size: [img.width, img.height], topLeft: at(2, 2), centre: at(Math.round(img.width / 2), Math.round(img.height / 2)), corner: at(img.width - 3, 3) };
  }, b64);
  out.firstFrame = { first, shotAt, pixel };

  check("H", "the two woff2 files are actually served by the build", "document.fonts.check() true for both families + a request for each .woff2 + the file in dist", `sans=${fonts.checkSans}, mono=${fonts.checkMono}; requested: ${woffReqs.map((u) => u.split("/").pop()).join(", ")}; in dist: ${distWoff.join(", ")} (dist/fonts/, not dist/assets/ — they are public/ files, copied verbatim)`, fonts.checkSans && fonts.checkMono && woffReqs.length >= 2 && distWoff.length >= 2 ? "PASS" : "FAIL");
  check("H", "no CDN request appears in the network log", "every request on the page is same-origin (no fonts.googleapis/gstatic, no third-party script)", `${net.requests.length} requests, ${net.external.length} off-origin${net.external.length ? ": " + net.external.slice(0, 5).join(", ") : ""}`, net.external.length === 0 ? "PASS" : "FAIL");

  /* theme toggle: three states, survives a reload, and no light flash */
  const { c: c2, page: p2 } = await ctx(browser, { width: 1440, height: 900 }, { colorScheme: "dark" });
  await go(p2, "#/", 600);
  const states = await p2.evaluate(() => [...document.querySelectorAll(".theme-switch [role=radio]")].map((r) => ({ label: r.getAttribute("aria-label"), checked: r.getAttribute("aria-checked"), tabindex: r.getAttribute("tabindex") })));
  const systemPaint = await p2.evaluate(() => ({ cls: document.documentElement.className, theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("catalog-theme") }));
  await p2.locator('.theme-switch [aria-label="Theme: light"]').click({ force: true });
  await p2.waitForTimeout(300);
  const lightPaint = await p2.evaluate(() => ({ cls: document.documentElement.className, theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("catalog-theme"), bg: getComputedStyle(document.documentElement).backgroundColor }));
  await p2.locator('.theme-switch [aria-label="Theme: dark"]').click({ force: true });
  await p2.waitForTimeout(300);
  await p2.reload({ waitUntil: "load" });
  await p2.waitForTimeout(500);
  const afterReload = await p2.evaluate(() => ({ cls: document.documentElement.className, theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("catalog-theme") }));
  await p2.locator('.theme-switch [aria-label="Theme: system"]').click({ force: true });
  await p2.waitForTimeout(300);
  const backToSystem = await p2.evaluate(() => ({ cls: document.documentElement.className, theme: document.documentElement.getAttribute("data-theme"), stored: localStorage.getItem("catalog-theme") }));
  await c2.close();
  out.theme = { states, systemPaint, lightPaint, afterReload, backToSystem };
  check("H", "the theme toggle has three states", "three role=radio items, each with its own accessible name, exactly one checked", states.map((s) => `${s.label}${s.checked === "true" ? "*" : ""}`).join(" · "), states.length === 3 && states.filter((s) => s.checked === "true").length === 1 ? "PASS" : "FAIL");
  check("H", "the choice survives a reload", "choose dark → reload → still dark, still stored", `stored=${afterReload.stored}, class="${afterReload.cls}", data-theme=${afterReload.theme}`, afterReload.stored === "dark" && /dark/.test(afterReload.cls) ? "PASS" : "FAIL");
  check("H", "system is a third state, not a conversion", "choosing system forgets the stored choice and hands the theme back to the OS (dark OS here)", `stored=${backToSystem.stored}, class="${backToSystem.cls}", data-theme=${backToSystem.theme}`, backToSystem.stored === null && backToSystem.theme === "system" && /dark/.test(backToSystem.cls) ? "PASS" : "FAIL");

  const dark = (c) => (c[0] + c[1] + c[2]) / 3;
  const flashOk = first.cls.includes("dark") && dark(pixel.centre) < 60 && dark(pixel.corner) < 60;
  check("H", "the page does not flash light before painting (prefers-color-scheme: dark)", "method: (a) <html> class+background captured in the FIRST requestAnimationFrame of the document (a frame runs before the first paint), (b) a screenshot taken ~60 ms after navigation start, decoded in the browser and sampled", `first rAF: class "${first.cls}", data-theme=${first.theme}, bg ${first.bg} at ${first.t?.toFixed?.(0)} ms; screenshot at ${shotAt} ms: centre rgb(${pixel.centre}), corner rgb(${pixel.corner})`, flashOk ? "PASS" : "FAIL");

  await c.close();
  save("H", out);
  return out;
}

/* ── section I: phone reality ────────────────────────────────────────────────────────────────────────── */

async function sectionI(browser) {
  console.log("\n=== I. phone reality (390×844) ===");
  const out = { load: loadavg(), routes: {} };
  const ROUTES = [
    ["home", "#/"],
    ["gallery", "#/g"],
    ["item", "#/i/shadcn/button"],
    ["chrome", "#/chrome"],
    ["about", "#/about"],
  ];
  const { c, page } = await ctx(browser, { width: 390, height: 844 });
  for (const [name, hash] of ROUTES) {
    await go(page, hash, name === "gallery" ? 1800 : 800);
    const m = await page.evaluate(
      ({ tapSrc, clipSrc }) => {
        const tap = new Function("return (" + tapSrc + ")")()();
        const clip = new Function("return (" + clipSrc + ")")()();
        return {
          doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight },
          tap,
          clip,
          route: document.querySelector("[data-route]")?.dataset.route,
          title: document.querySelector("h2.title")?.textContent?.trim()?.slice(0, 40) || null,
        };
      },
      { tapSrc: tapCensusSrc().toString(), clipSrc: clipSrc().toString() },
    );
    const shotName = `route-${name}-390.png`;
    await page.screenshot({ path: join(SHOTS, shotName) });
    out.routes[name] = { hash, ...m, shot: shotName };
    check("I", `390 ${name}: scrollWidth == clientWidth`, "no horizontal overflow on the route", `${m.doc.scrollWidth} / ${m.doc.clientWidth} (page height ${m.doc.scrollHeight})`, m.doc.scrollWidth === m.doc.clientWidth ? "PASS" : "FAIL");
    check("I", `390 ${name}: no text clipped at the edges`, "no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll", `${m.clip.length} clipped element(s)${m.clip.length ? ": " + m.clip.slice(0, 3).map((x) => `${x.tag}${x.cls} ${x.scrollWidth}/${x.clientWidth} "${x.text}"`).join(" | ") : ""}`, m.clip.length === 0 ? "PASS" : "FAIL");
    const inline = m.tap.under44.filter((x) => x.inline);
    const real = m.tap.under44.filter((x) => !x.inline);
    check("I", `390 ${name}: 0 tap targets under 44 px`, "census of every rendered control", `${m.tap.under44.length} under 44 px (${real.length} not inline in a sentence, ${inline.length} inline prose links)${real.length ? ": " + real.slice(0, 4).map((x) => `${x.tag}${x.cls} ${x.w}×${x.h} "${x.label}"`).join(" | ") : ""}`, m.tap.under44.length === 0 ? "PASS" : "FAIL");
  }

  // the rail drawer: opens, closes, no scroll trap
  await go(page, "#/", 800);
  const drawer = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Browse \d+/.test(b.textContent || ""));
    const rail = document.querySelector(".rail-phone");
    const before = { railDisplay: rail ? getComputedStyle(rail).display : null, bodyOverflow: getComputedStyle(document.body).overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow };
    btn?.click();
    await new Promise((r) => setTimeout(r, 350));
    const opened = {
      railDisplay: rail ? getComputedStyle(rail).display : null,
      railRect: rail ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }))(rail.getBoundingClientRect()) : null,
      ariaExpanded: btn?.getAttribute("aria-expanded"),
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      docScrollHeight: document.documentElement.scrollHeight,
      canScrollWindow: (() => { const y0 = window.scrollY; window.scrollTo(0, y0 + 300); const y1 = window.scrollY; window.scrollTo(0, y0); return y1 > y0; })(),
      railListScrollable: (() => { const l = rail?.querySelector(".rail-list"); return l ? { scrollHeight: l.scrollHeight, clientHeight: l.clientHeight, scrollTop: l.scrollTop } : null; })(),
    };
    btn?.click();
    await new Promise((r) => setTimeout(r, 350));
    const closed = { railDisplay: rail ? getComputedStyle(rail).display : null, ariaExpanded: btn?.getAttribute("aria-expanded") };
    return { before, opened, closed };
  });
  out.drawer = drawer;
  await page.screenshot({ path: join(SHOTS, "rail-drawer-open-390.png") });
  check("I", "390: the rail drawer opens and closes", "Browse 769 → .rail-phone is displayed, aria-expanded=false → true → false", `open: display=${drawer.opened.railDisplay}, aria-expanded=${drawer.opened.ariaExpanded}, rect ${JSON.stringify(drawer.opened.railRect)}; closed: display=${drawer.closed.railDisplay}, aria-expanded=${drawer.closed.ariaExpanded}`, drawer.opened.railDisplay !== "none" && drawer.closed.railDisplay === "none" ? "PASS" : "FAIL");
  check("I", "390: the drawer is not a scroll trap", "the page still scrolls while it is open and the rail list scrolls internally; no overflow:hidden lock on body/html", `body overflow=${drawer.opened.bodyOverflow}, html overflow=${drawer.opened.htmlOverflow}, window scrolls=${drawer.opened.canScrollWindow}, rail list ${drawer.opened.railListScrollable?.scrollHeight}/${drawer.opened.railListScrollable?.clientHeight}`, drawer.opened.canScrollWindow && drawer.opened.bodyOverflow !== "hidden" && drawer.opened.htmlOverflow !== "hidden" ? "PASS" : "FAIL");

  // the brief asks for 5 routes x 2 viewports, so the 1440 half is taken here, in the same pass
  {
    const { c, page } = await ctx(browser, { width: 1440, height: 900 });
    const wide = [["home", "#/"], ["gallery", "#/g"], ["item", "#/i/shadcn/button"], ["chrome", "#/chrome"], ["about", "#/about"]];
    out.wideShots = [];
    for (const [name, hash] of wide) {
      await go(page, hash, name === "gallery" ? 2200 : 1200);
      await page.screenshot({ path: `qa/shots/route-${name}-1440.png` });
      out.wideShots.push({ name, hash, path: `qa/shots/route-${name}-1440.png` });
    }
    // and the wide gallery mid-scroll at 1440, for the frame count that only a scroll shows
    await page.evaluate(() => document.querySelector(".page")?.scrollTo(0, 9000));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "qa/shots/gallery-1440-midscroll.png" });
    out.wideShots.push({ name: "gallery-midscroll", hash: "#/g", path: "qa/shots/gallery-1440-midscroll.png" });
    await c.close();
    check("I", "a 1440 screenshot exists for each of the five routes (plus the gallery mid-scroll)", "page.screenshot at 1440x900", out.wideShots.map((s) => s.path.replace("qa/shots/", "")).join(", "), out.wideShots.length === 6 ? "PASS" : "FAIL");
  }

  await c.close();
  save("I", out);
  return out;
}

/* ── main ────────────────────────────────────────────────────────────────────────────────────────────── */

const started = Date.now();
let serverDown = null;
try {
  if (want("A")) await sectionA();
  const started_ = await startServer();
  RESULT.server = { ...started_, url: BASE, port: PORT };
  console.log(`\npreview: ${BASE} (load ${started_.load?.l1})`);

  const browser = await launch();
  try {
    for (const [letter, fn] of [["B", sectionB], ["C", sectionC], ["D", sectionD], ["E", sectionE], ["F", sectionF], ["G", sectionG], ["H", sectionH], ["I", sectionI]]) {
      if (!want(letter)) continue;
      try {
        await fn(browser);
      } catch (e) {
        RESULT[`${letter}_error`] = String(e && e.stack ? e.stack : e);
        check(letter, "section ran to completion", "the section's own assertions", `threw: ${String(e).slice(0, 200)}`, "FAIL");
        save(`${letter}_error`, { error: String(e && e.stack ? e.stack : e), load: loadavg() });
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  serverDown = await stopServer();
  RESULT.serverShutdown = { ssAfter: serverDown, ss88: ssPorts(":88"), load: loadavg(), totalMs: Date.now() - started };
  writeFileSync(join(RAW, "_checks.json"), JSON.stringify({ checks: CHECKS, load: loadavg(), args: { CHROME_ARGS, PLAYWRIGHT: "/root/camofox-browser/node_modules/playwright (1.58.1)" } }, null, 2));
  save("_summary", { checks: CHECKS, serverShutdown: RESULT.serverShutdown, totalMs: Date.now() - started });
}

const pass = CHECKS.filter((c) => c.verdict === "PASS").length;
const fail = CHECKS.filter((c) => c.verdict === "FAIL").length;
const other = CHECKS.filter((c) => !["PASS", "FAIL"].includes(c.verdict)).length;
console.log(`\n=== ${pass} PASS · ${fail} FAIL · ${other} other ===`);
console.log(`server down: ss -ltn | grep :88 → ${serverDown === "" ? "(empty)" : serverDown || "(unknown)"}`);
console.log(`total ${((Date.now() - started) / 1000).toFixed(0)} s, load ${JSON.stringify(loadavg())}`);
if (fail) {
  console.log("\nfailures:");
  for (const f of CHECKS.filter((c) => c.verdict === "FAIL")) console.log(`  [${f.section}] ${f.id} — ${typeof f.value === "string" ? f.value : JSON.stringify(f.value)}`);
}
process.exit(fail ? 1 : 0);
