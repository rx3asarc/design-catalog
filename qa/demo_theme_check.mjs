// r8b demo gate: a demo in the dark grid is drawn on the theme's paper, not on white.
//
// The complaint was "demos render white in the dark grid — Bloom Menu, Command Palette, Expandable Tabs,
// Adaptive Stepper". The fix is not four demos: it is the paper the frame is printed on. Measured three ways,
// because there are three places a white panel can come from, and only one of them is the one the eye reports:
//
//   A. BEFORE THE DEMO'S OWN MODULE ARRIVES. The iframe document is loaded with its module graph aborted, so what
//      is on screen is exactly the state a slow chunk leaves behind: markup + stylesheet, no JavaScript. Its
//      painted average must already be the theme's (dark in dark, light in light) — this is the check that fails
//      with a white flash on a build whose demo document only themes itself once JS runs.
//   B. AFTER IT RUNS. The demo document's own `background-color` (html and body) must be an opaque colour of the
//      right polarity, not `transparent`, so a visitor scrolling past a demo is never looking through it at
//      whatever happens to be behind.
//   C. THE FRAME ELEMENT ON THE PAGE. The `<iframe>` box itself is given the theme's paper (`site/demo.tsx`), so a
//      frame whose document never arrives at all still shows the demo's colour rather than the page's surface.
//
// Then D sweeps every live frame in the gallery in dark theme: no frame element may be white or transparent.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = (process.argv[2] || "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
const NAMED = ["beui/bloom-menu", "beui/command-palette", "beui/expandable-tabs", "beui/adaptive-stepper"];

const fails = [];
const ok = (cond, line) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${line}`);
  if (!cond) fails.push(line);
};

/**
 * A CSS colour's relative luminance, measured by *painting it*.
 *
 * `getComputedStyle` reports these values as `oklch(… )` — the colour space the tokens are authored in — so parsing
 * `rgb()` out of the string would be wrong twice: it fails on any modern colour and it would measure a string
 * rather than what is on screen. The probe fills a 1×1 canvas with the computed value and reads the pixel back,
 * which is what the compositor does with it. Alpha 0 comes back as alpha 0, and that is the state this gate is
 * hunting: a frame whose paper is transparent lets whatever is behind it decide the colour.
 */
const PROBE = () => {
  window.__lum = (css) => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#000";
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
    if (a === 0) return { lum: -1, rgba: [r, gr, b, a] };
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return { lum: 0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b), rgba: [r, gr, b, a] };
  };
};

const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

/* ── A: the demo document before its module arrives ──────────────────────────────────────────────────────── */
console.log("A · the demo document with its own module blocked — what is on screen while a chunk is late");
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  await page.route("**/assets/*.js", (r) => r.abort());
  const rows = [];
  for (const id of NAMED) {
    await page.goto(`${BASE}demo.html#${encodeURIComponent(id)}|0|theme=${theme}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const shot = await page.screenshot();
    const avg = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 8; c.height = 8;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data;
      let r = 0, gg = 0, bb = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; }
      return [r / n, gg / n, bb / n].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    }, shot.toString("base64"));
    const info = await page.evaluate(() => ({
      cls: document.documentElement.className,
      root: getComputedStyle(document.documentElement).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    await page.evaluate(PROBE);
    const paper = await page.evaluate((css) => window.__lum(css), info.root);
    const lum = (parseInt(avg.slice(0, 2), 16) / 255) * 0.2126 + (parseInt(avg.slice(2, 4), 16) / 255) * 0.7152 + (parseInt(avg.slice(4, 6), 16) / 255) * 0.0722;
    rows.push({ id, avg, cls: info.cls, root: info.root, scheme: info.scheme, darkPaper: lum < 0.25, paperLum: paper.lum });
  }
  for (const r of rows) {
    ok(
      theme === "dark" ? r.darkPaper : !r.darkPaper,
      `A ${theme}: ${r.id} paints the ${theme} paper before its module loads — painted #${r.avg}, html background ${r.root} (${r.cls ? `class "${r.cls}"` : "no class"}, color-scheme ${r.scheme})`,
    );
  }
  await ctx.close();
}

/* ── B: the demo document once it runs ───────────────────────────────────────────────────────────────────── */
console.log("B · the same document with its module running — html and body must be an opaque colour, never transparent");
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  for (const id of NAMED) {
    await page.goto(`${BASE}demo.html#${encodeURIComponent(id)}|0|theme=${theme}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page.evaluate(PROBE);
    const info = await page.evaluate(() => {
      const g = (el) => getComputedStyle(el);
      const htmlBg = g(document.documentElement).backgroundColor;
      const bodyBg = g(document.body).backgroundColor;
      const body = window.__lum(bodyBg);
      const html = window.__lum(htmlBg);
      // the paper is the body's if it is opaque, otherwise the root's — and if neither is, it is transparent
      const paper = body.lum >= 0 ? body : html;
      return { cls: document.documentElement.className, html: htmlBg, body: bodyBg, lum: paper.lum, paper: paper.rgba };
    });
    const lum = info.lum;
    ok(
      lum !== null && lum >= 0 && (theme === "dark" ? lum < 0.25 : lum > 0.5),
      `B ${theme}: ${id} paints an opaque ${theme} paper — html ${info.html}, body ${info.body} → rgb(${info.paper.join(",")}), luminance ${info.lum.toFixed(3)} (class "${info.cls}")`,
    );
  }
  await ctx.close();
}

/* ── C: the frame element on the page ────────────────────────────────────────────────────────────────────── */
console.log("C · the <iframe> box on the item page, in dark theme — the paper, independent of the child document");
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("catalog-theme", t), theme);
  const page = await ctx.newPage();
  settle(page);
  for (const id of NAMED) {
    await page.goto(`${BASE}#/i/${id}`, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await page.evaluate(PROBE);
    const r = await page.evaluate(() => {
      const f = document.querySelector("iframe");
      if (!f) return null;
      const bg = getComputedStyle(f).backgroundColor;
      const p = window.__lum(bg);
      return { bg, scheme: getComputedStyle(f).colorScheme, lum: p.lum, rgb: p.rgba };
    });
    const lum = r ? r.lum : null;
    ok(
      lum !== null && lum >= 0 && (theme === "dark" ? lum < 0.25 : lum > 0.5),
      `C ${theme}: #/i/${id} frames the demo on the ${theme} paper — ${r ? `${r.bg} → rgb(${r.rgb.join(",")}), luminance ${r.lum.toFixed(3)} (color-scheme ${r.scheme})` : "no frame"}`,
    );
  }
  await ctx.close();
}

/* ── D: the whole gallery, dark ──────────────────────────────────────────────────────────────────────────── */
console.log("D · every live frame in the dark gallery — no white frame element, no transparent one");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.initScripts?.();
  await ctx.addInitScript(() => localStorage.setItem("catalog-theme", "dark"));
  const page = await ctx.newPage();
  settle(page);
  await page.goto(`${BASE}#/g`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.evaluate(PROBE);
  let worst = { bg: null, lum: -1 };
  let seen = 0;
  let bad = [];
  for (let i = 0; i < 12; i++) {
    const r = await page.evaluate(() => {
      const out = [];
      for (const f of document.querySelectorAll("iframe")) {
        const bg = getComputedStyle(f).backgroundColor;
        const p = window.__lum(bg);
        out.push({ bg, lum: p.lum });
      }
      return out;
    });
    for (const { bg, lum } of r) {
      seen++;
      if (lum > worst.lum) worst = { bg, lum };
      if (lum < 0) bad.push(bg);
    }
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(240);
  }
  ok(bad.length === 0, `D: no frame is transparent — ${bad.length} of ${seen} samples were (${JSON.stringify([...new Set(bad)])})`);
  ok(worst.lum < 0.25, `D: the lightest frame in the dark gallery is still dark — ${worst.bg} (luminance ${worst.lum.toFixed(3)}), ${seen} samples`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\nDEMO THEME: FAIL — ${fails.length} check(s)` : "\nDEMO THEME: ok");
process.exit(fails.length ? 1 : 0);
