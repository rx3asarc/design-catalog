/**
 * Round-2 gate: the review's own items, asserted on the built site.
 *
 * Every check here names the review sentence it answers. If a check cannot be measured without the
 * thing it measures, it fails rather than skipping — a gate that passes because it looked away is worse
 * than no gate.
 *
 *   node r2_check.mjs [base]         base defaults to http://localhost:8830/design-catalog/
 */
import { readFileSync } from "node:fs";
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";

const BASE = (process.argv[2] ?? "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
const MANIFEST = JSON.parse(readFileSync("/root/design-catalog-site/app/manifest.json", "utf8"));

const out = [];
let bad = 0;
const ok = (name, cond, detail) => {
  const line = `${cond ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`;
  out.push(line);
  if (!cond) bad += 1;
};

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];

async function page(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    // Chromium logs a bare "Failed to load resource" for the favicon it asks for on its own account;
    // every other console error counts
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t) && !/design-catalog\/assets/.test(t)) return;
    errors.push(t);
  });
  return p;
}

/* ── A. the hero no longer prints a verdict wall (review: "the home page has a wall of 'rejected'") ── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/", { waitUntil: "load" });
  await p.waitForTimeout(900);
  const body = await p.evaluate(() => document.body.innerText);
  ok("hero prints no 'rejected'", !/rejected/i.test(body), `${(body.match(/rejected/gi) ?? []).length} occurrences`);
  const marker = await p.evaluate(() => {
    const m = /(\d+) of (\d+) items whose name or slug says/.exec(document.body.innerText);
    return m ? { shown: Number(m[1]), total: Number(m[2]) } : null;
  });
  const real = MANIFEST.filter((i) => /sidebar/i.test(`${i.name} ${i.slug}`)).length;
  ok("hero marker counts the manifest", marker?.total === real,
    `printed ${marker ? `${marker.shown} of ${marker.total}` : "nothing"}, manifest ${real}`);
  const rows = await p.evaluate(() => (document.body.innerText.match(/\[(?:shadcn|beui|rareui|beautifului|transitions)\//g) ?? []).length);
  ok("hero shows a real row set", rows >= 4, `${rows} source/kind rows`);
  await p.context().close();
}

/* ── B. a withheld item: no empty code box, no verdict sentence, a real outbound action ── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/i/beautifului/agent-screen", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  const s = await p.evaluate(() => {
    const link = [...document.querySelectorAll("a")].find((a) => /source|their|original|view on/i.test(a.innerText));
    const r = link?.getBoundingClientRect();
    return {
      pre: document.querySelectorAll("pre").length,
      placeholder: /not in the published set/i.test(document.body.innerText),
      verdict: /verdict/i.test(document.body.innerText),
      linkH: r ? Math.round(r.height) : 0,
      linkText: link?.innerText ?? "",
    };
  });
  ok("withheld page has no code viewer", s.pre === 0, `${s.pre} <pre>`);
  ok("withheld page names no placeholder file", !s.placeholder, s.placeholder ? "still says 'not in the published set'" : "");
  ok("withheld page mentions no verdict", !s.verdict, s.verdict ? "says verdict" : "");
  ok("withheld page's outbound action is a control", s.linkH >= 44, `${s.linkH}px — "${s.linkText.replace(/\n/g, " ").slice(0, 40)}"`);
  await p.context().close();
}

/* ── C. a published item still has its code viewer ── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/i/shadcn/button", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const pre = await p.evaluate(() => document.querySelectorAll("pre").length);
  ok("published item still shows code", pre >= 1, `${pre} <pre>`);
  await p.context().close();
}

/* ── D. the stage surface is painted in the frame's theme (review: white island on white) ── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/i/beui/bloom-menu", { waitUntil: "load" });
  await p.waitForTimeout(1800);
  const dark = await p.evaluate(async () => {
    window.catalogTheme?.choose?.("dark");
    await new Promise((r) => setTimeout(r, 700));
    const f = document.querySelector("iframe");
    if (!f) return { bg: "no iframe", lum: NaN };
    // the surface is the nearest ancestor that actually paints: everything in between is transparent
    let n = f.parentElement, bg = "";
    while (n && n !== document.body) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
      n = n.parentElement;
    }
    const [r, g, b] = (bg.match(/[\d.]+/g) ?? []).map(Number);
    return { bg, lum: (r + g + b) / 3 };
  });
  ok("stage surface follows the site into dark", dark.lum < 120, `${dark.bg} (mean ${Math.round(dark.lum)})`);
  await p.context().close();
}

/* ── E. a theme change reaches frames already mounted (review: "patchwork of white and dark canvases") ── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/g", { waitUntil: "load" });
  await p.waitForTimeout(5000);
  const before = await p.evaluate(() => document.querySelectorAll("iframe").length);
  // the visitor's own path: click the Dark control, not the API behind it
  const clicked = await p.evaluate(() => {
    const el = [...document.querySelectorAll("[role='radio'], button")].find((n) => /^dark$/i.test((n.textContent ?? "").trim()));
    if (!el) return false;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    return true;
  });
  const dark = async () => p.evaluate(() => {
    let n = 0;
    for (const f of document.querySelectorAll("iframe")) {
      try { if (/dark/.test(f.contentDocument?.documentElement?.className ?? "")) n += 1; } catch { /* not same-origin yet */ }
    }
    return n;
  });
  let darkOnes = 0, waited = 0;
  while (waited < 8000) { darkOnes = await dark(); if (darkOnes >= before) break; await p.waitForTimeout(400); waited += 400; }
  const siteDark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
  ok("live frames follow a theme change", clicked && siteDark && before >= 2 && darkOnes >= before - 1,
    `${darkOnes}/${before} frames dark after ${waited}ms (site dark=${siteDark})`);
  await p.context().close();
}

/* ── F. provenance tags only exist on #/chrome (review: "hover tags everywhere") ── */
{
  const p = await page({ width: 1440, height: 900 });
  const probe = async (hash) => {
    await p.goto(BASE + hash, { waitUntil: "load" });
    await p.waitForTimeout(1200);
    // a whole-page tagged wrapper sits under the chrome it wraps, and some tagged nodes are covered by a
    // sibling: try the reachable candidates and report the best of them, so the gate measures the feature
    const boxes = await p.evaluate(() => [...document.querySelectorAll("[data-catalog-item]")]
      .map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute("data-catalog-item"), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.top }; })
      .filter((b) => b.w > 8 && b.h > 8 && b.top > 4 && b.y < innerHeight - 4)
      .slice(0, 8));
    if (!boxes.length) return -1;
    let best = 0;
    for (const b of boxes) {
      await p.mouse.move(b.x, b.y);
      await p.waitForTimeout(260);
      const n = await p.evaluate(() => document.querySelectorAll(".prov-tag").length);
      best = Math.max(best, n);
      if (n > 0) break;
    }
    return best;
  };
  const home = await probe("#/");
  const chrome = await probe("#/chrome");
  ok("no tag on the home page", home === 0, `${home} tags`);
  ok("still tags on #/chrome", chrome === 1, `${chrome} tags`);
  await p.context().close();
}

/* ── G. the rail names things properly (review: "Matrixs", duplicate nesting) ── */
{
  const p = await page({ width: 1440, height: 1200 });
  await p.goto(BASE + "#/", { waitUntil: "load" });
  await p.waitForTimeout(900);
  const rail = await p.evaluate(() => document.querySelector('[data-rail], aside, nav')?.innerText ?? "");
  ok("no 'Matrixs'", !/Matrixs/.test(rail), /Matri/.test(rail) ? "has Matri…" : "");
  ok("pluralisation reads as English", !/\b(?:Cards|Texts|Matrixs|Switchs|Boxs)\b/.test(rail),
    (rail.match(/\b(?:Cards|Texts|Matrixs|Switchs|Boxs)\b/g) ?? []).join(","));
  const dup = await p.evaluate(() => {
    const rows = [...document.querySelectorAll("*")].filter((n) => n.children.length === 0 && n.innerText?.trim());
    const text = rows.map((n) => n.innerText.trim());
    return text.some((t, i) => t === text[i + 1]);
  });
  ok("no label repeats itself directly under itself", !dup, dup ? "found a repeated row" : "");
  await p.context().close();
}

/* ── H. the theme pill never covers a card (review: "overlaps the cards") ── */
{
  for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    const p = await page(vp);
    await p.goto(BASE + "#/g", { waitUntil: "load" });
    await p.waitForTimeout(3500);
    const hit = await p.evaluate(async () => {
      const pill = document.querySelector(".theme-switch-float") ?? document.querySelector(".theme-switch");
      if (!pill) return { pill: false };
      const scroller = document.querySelector(".page") ?? document.scrollingElement;
      scroller.scrollTop = scroller.scrollHeight;                 // the end of the list is what a fixed bar can hide
      await new Promise((r) => setTimeout(r, 500));
      const a = pill.getBoundingClientRect();
      const tiles = [...document.querySelectorAll("a[href^='#/i/']")];
      const covered = tiles.filter((t) => {
        const b = t.getBoundingClientRect();
        if (b.bottom <= 0 || b.top >= innerHeight) return false;
        return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      }).length;
      const ctl = [...pill.querySelectorAll("[role='radio'], button")];
      const small = ctl.filter((c) => { const r = c.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length;
      return { pill: true, covered, h: Math.round(a.height), w: Math.round(a.width), lane: a.width >= innerWidth - 4, small, ctl: ctl.length };
    });
    ok(`the theme control hides nothing at the end of the list (${vp.width})`, hit.pill && hit.covered === 0 && hit.small === 0,
      `${hit.covered ?? "?"} tiles under it, ${hit.h}×${hit.w} lane=${hit.lane}, ${hit.small}/${hit.ctl} controls under 44px`);
    await p.context().close();
  }
}

ok("no console errors anywhere in this run", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(out.join("\n"));
console.log(bad === 0 ? "\nR2: ok" : `\nR2: ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
