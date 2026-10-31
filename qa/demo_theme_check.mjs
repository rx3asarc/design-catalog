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
console.log("B · the same document with its module running — the frame is transparent on purpose; what it may never do is paint the wrong paper");
/*
 * r5 §Item page, item 1: "**Fix:** transparent frame so the canvas shows through". Round 8 asserted the opposite —
 * that `html` and `body` were an opaque colour — and that assertion is now eight failures measured against a
 * deliberate decision. What replaced it, and what can still fail:
 *
 *   a. the child's root is **either transparent or the theme's own paper** — never a third colour, and never an
 *      opaque paper of the wrong polarity (that is the "demos render white in the dark grid" bug);
 *   b. the paper a visitor actually sees is the composite: the child's backgrounds painted over the canvas the
 *      frame sits on (`var(--background)` for that theme, the value `FRAME_SURFACE` carries). Composited, it has
 *      to be the theme's ink;
 *   c. the child's `color-scheme` is the theme's — a transparent frame with the wrong scheme hands the UA's own
 *      widgets (scrollbars, form controls) the other theme.
 */
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  for (const id of NAMED) {
    await page.goto(`${BASE}demo.html#${encodeURIComponent(id)}|0|theme=${theme}`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page.evaluate(PROBE);
    const info = await page.evaluate(() => {
      const g = (el) => getComputedStyle(el);
      return {
        cls: document.documentElement.className,
        html: g(document.documentElement).backgroundColor,
        body: g(document.body).backgroundColor,
        scheme: g(document.documentElement).colorScheme,
        htmlLum: window.__lum(g(document.documentElement).backgroundColor),
        bodyLum: window.__lum(g(document.body).backgroundColor),
      };
    });
    // the canvas this frame is drawn on: the theme's own `--background`, read off the running page rather than typed
    const canvasCss = await page.evaluate((t) => {
      const probeEl = document.createElement("div");
      probeEl.style.color = `var(--background)`;
      document.body.appendChild(probeEl);
      const v = getComputedStyle(probeEl).color;
      probeEl.remove();
      // `demo.html` carries the same tokens as the site; the boot script has already put the theme's class on the root
      return v || (t === "dark" ? "oklch(0.141 0.005 285.823)" : "oklch(1 0 0)");
    }, theme);
    const canvasLum = await page.evaluate((css) => window.__lum(css), canvasCss);
    const alpha = (lum) => lum < 0;
    const composited = (l) => (alpha(l) ? canvasLum.lum : l);
    const paper = Math.max(composited(info.bodyLum.lum), composited(info.htmlLum.lum));
    const thirdColour = [info.htmlLum, info.bodyLum].some((l) => !alpha(l.lum) && Math.abs(l.lum - canvasLum.lum) > 0.002);
    ok(
      !thirdColour && (theme === "dark" ? paper < 0.25 : paper > 0.5),
      `B ${theme}: ${id} — html ${info.html}, body ${info.body} (transparent = the canvas shows through); composited over the canvas ${canvasCss} the paper is ${paper.toFixed(3)} (${theme === "dark" ? "dark" : "light"})${thirdColour ? " — a THIRD colour, not the canvas and not the theme" : ""} (class "${info.cls}")`,
    );
    ok(
      info.scheme.trim() === theme,
      `B ${theme}: ${id} — color-scheme ${info.scheme} on a transparent frame, so the UA's own parts are the demo's (class "${info.cls}")`,
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

/* ── E: one paper for the canvas, the frame and the child — and, when the stage disagrees with the site, a paper
 *       that is visibly not the page's ─────────────────────────────────────────────────────────────────────── */
console.log("E · the canvas, the frame element and the child document are one paper; a pinned stage leaves the page's paper");
{
  const read = (page) => page.evaluate(() => {
    const canvas = document.querySelector("[data-stage-theme]");
    const screen = document.querySelector("[data-frame-surface]");
    const f = document.querySelector("[data-stage] iframe, .stage-win iframe");
    let child = null;
    try { child = f?.contentDocument ?? null; } catch { child = null; }
    const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    return {
      stageTheme: canvas?.getAttribute("data-stage-theme") ?? null,
      canvas: bg(canvas), screen: bg(screen), frame: bg(f),
      childRoot: child ? bg(child.documentElement) : null,
      childScheme: child ? getComputedStyle(child.documentElement).colorScheme : null,
      frameScheme: f ? getComputedStyle(f).colorScheme : null,
      page: bg(document.body), pageScheme: getComputedStyle(document.documentElement).colorScheme,
    };
  });
  const lum = (page, css) => page.evaluate((c) => (c ? window.__lum(c).lum : null), css);

  for (const [site, pinned] of [["dark", null], ["light", null], ["light", "dark"], ["dark", "light"]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem("catalog-theme", t), site);
    const page = await ctx.newPage();
    settle(page);
    await page.goto(`${BASE}#/i/beui/bloom-menu`, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await page.evaluate(PROBE);
    if (pinned) {
      await page.click(`[aria-label="Preview the demo in ${pinned}"]`);
      await page.waitForTimeout(1200);
    }
    const m = await read(page);
    const L = {
      canvas: await lum(page, m.canvas), screen: await lum(page, m.screen), frame: await lum(page, m.frame),
      child: await lum(page, m.childRoot), page: await lum(page, m.page),
    };
    const tag = pinned ? `site ${site}, stage pinned ${pinned}` : `site ${site} = stage ${site}`;
    const dark = (v) => v !== null && v < 0.25;
    const light = (v) => v !== null && v > 0.5;
    const stageDark = m.stageTheme === "dark";
    /*
     * r5 §Item page, item 1, the whole complaint: "Preview canvas is dark grey (#18181b); inside it the demo frame
     * paints the site's own page colour (#09090b) edge to edge" — two papers in one box, and in mixed themes the
     * inner one was the whole demonstration. r5's own fix was "give the frame a transparent background so the canvas
     * colour shows through", and that is now what the site does, taken literally: **the canvas is the only paint**.
     *
     * So the assertion is no longer "canvas, frame and child are one colour" (which only held while the canvas was
     * painting the demo's paper). It is the stronger, simpler property:
     *   · the frame element paints nothing at all,
     *   · the child's root paints nothing, so the canvas is what shows through,
     *   · the canvas is the station's surface and it is *not* the page, in both themes and both mixed cases,
     *   · the stage's theme still owns the child's `color-scheme` and its set tokens, which is what a demo reacts to.
     * The trade-off is stated instead of hidden: with the canvas on `surface-300` the separation from the page is one
     * surface step (Δ ≈ 0.006 dark / 0.095 light), not a colour jump, so it is the hairline and the header band that
     * make the canvas read as a station. `qa/stage_check.mjs` asserts that hairline and the bands.
     */
    ok(
      /rgba\(0, 0, 0, 0\)|transparent/.test(m.screen ?? ""),
      `E (${tag}): the frame element paints nothing — screen ${m.screen} (the canvas is the paper)`,
    );
    ok(
      m.childRoot === null || /rgba\(0, 0, 0, 0\)/.test(m.childRoot),
      `E (${tag}): the child document paints nothing either — html ${m.childRoot} (the canvas shows through)`,
    );
    /* The canvas belongs to the *site*, not to the stage: it is the station the demo is shown in, and a station that
       repaints itself when you flip the demo's theme would be the second paper again, just moving. This is the case a
       "one paper" assertion cannot tell apart from the bug it replaced, so it is asserted on its own. */
    ok(
      L.canvas !== null && (site === "dark" ? L.canvas < 0.15 : L.canvas > 0.75),
      `E (${tag}): the canvas is the site's surface, not the stage's — site ${site}, stage ${m.stageTheme}, canvas ${m.canvas} (${L.canvas?.toFixed(3)})`,
    );
    ok(
      m.childScheme === m.stageTheme,
      `E (${tag}): the stage's theme owns the child's colour scheme — child ${m.childScheme}, stage ${m.stageTheme}`,
    );
    ok(
      Math.abs(L.canvas - L.page) > 0.004,
      `E (${tag}): the canvas is never the page it sits on — canvas ${L.canvas?.toFixed(3)} (${m.canvas}) vs page ${L.page?.toFixed(3)} (${m.page}), Δ ${Math.abs(L.canvas - L.page).toFixed(3)}${pinned ? " (pinned: the stage disagrees with the site and the demo still stands on the canvas)" : ""}`,
    );
    await ctx.close();
  }
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
