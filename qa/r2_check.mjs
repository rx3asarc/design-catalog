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
import { settle } from "./settle.mjs";

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
  settle(p);
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => {
    // Chromium logs a bare "Failed to load resource" for the favicon it asks for on its own account;
    // every other console error counts
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t) && !/design-catalog\/assets/.test(t)) return;
    errors.push(t);
  });
  return settle(p);
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

/* ── H. no fixed strip over the content, and the theme control is reachable on a phone ─────────────────────── */
{
  for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 600, height: 900 }]) {
    const p = await page(vp);
    await p.goto(BASE + "#/g", { waitUntil: "load" });
    await p.waitForTimeout(3000);
    const at = await p.evaluate(async () => {
      const fixed = [...document.querySelectorAll("body *")].filter((n) => {
        const cs = getComputedStyle(n);
        if (!/fixed|sticky/.test(cs.position)) return false;
        const r = n.getBoundingClientRect();
        // a sticky header at the top edge is not a cover: content passes under it, which is what a header is.
        // What the testers hit was a floating control over the middle of the content, so that is what is counted.
        return r.width > 40 && r.height > 20 && getComputedStyle(n).visibility !== "hidden" && r.top > 8;
      });
      const scroller = document.querySelector(".page") ?? document.scrollingElement;
      const tiles = () => [...document.querySelectorAll("a[href^='#/i/']")];
      const covers = () => tiles().filter((t) => {
        const b = t.getBoundingClientRect();
        if (b.bottom <= 0 || b.top >= innerHeight) return false;
        return fixed.some((f) => {
          const a = f.getBoundingClientRect();
          return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        });
      }).length;
      const mid = covers();
      scroller.scrollTop = scroller.scrollHeight;
      await new Promise((r) => setTimeout(r, 400));
      const end = covers();
      return { floats: document.querySelectorAll(".theme-switch-float").length, fixed: fixed.length, mid, end };
    });
    ok(`no fixed strip covers the grid (${vp.width})`, at.floats === 0 && at.mid === 0 && at.end === 0,
      `${at.floats} floating theme strips, ${at.fixed} fixed/sticky boxes, ${at.mid} tiles covered mid-scroll, ${at.end} at the end`);

    if (vp.width < 860) {
      // on a phone the theme control lives in the Browse menu now, and the menu must own its own scroll
      const opened = await p.evaluate(() => {
        const el = [...document.querySelectorAll("button")].find((n) => /browse/i.test(n.innerText));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
        return true;
      });
      await p.waitForTimeout(700);
      const m = await p.evaluate(() => {
        const radios = [...document.querySelectorAll(".theme-switch [role='radio'], .theme-switch button")];
        const list = [document.querySelector(".rail.rail-phone"), ...document.querySelectorAll("body *")]
          .filter(Boolean)
          .find((n) => /auto|scroll/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 20) ?? null;
        const cs = list ? getComputedStyle(list) : null;
        return {
          radios: radios.map((n) => { const r = n.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
          scrolls: !!list && list.scrollHeight > list.clientHeight + 20 && /auto|scroll/.test(cs?.overflowY ?? ""),
        };
      });
      ok(`the phone theme control is in the menu and ≥44 px (${vp.width})`,
        opened && m.radios.length === 3 && m.radios.every((r) => r.w >= 44 && r.h >= 44),
        m.radios.map((r) => `${r.w}×${r.h}`).join(" "));
      ok(`the phone menu owns its scroll (${vp.width})`, m.scrolls, m.scrolls ? "scrollable" : "the list does not scroll itself");
    }
    await p.context().close();
  }
}

/* ── I0. the hero is written twice (build-time HTML, and Home.tsx at runtime) — do the two agree? ───────────── */
{
  /*
   * The shell in `index.html` draws the six cards before a byte of JavaScript is fetched, and it draws them from a
   * copy of the rule that lives in `vite.config.ts`; the running app draws them from `site/Home.tsx`. Two copies of
   * one rule is a drift waiting to happen, so this check is the drift alarm: the ids in the raw HTML must be the
   * ids the mounted row carries. If this fails, `vite.config.ts` is out of date with `Home.tsx` — fix that copy,
   * never the other way round.
   */
  const raw = await (await fetch(BASE + "index.html")).text();
  const declared = (raw.match(/data-boot-hero-ids="([^"]*)"/)?.[1] ?? "").split(" ").filter(Boolean);
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/", { waitUntil: "load" });
  // the row is React's, so it appears after the entry chunk runs: wait for the host, never for a fixed delay
  // (a fixed 1200 ms compared 6 declared ids against 0 mounted ones on a cold page and failed two checks in a row)
  await p.waitForFunction(() => !!document.querySelector("[data-hero-tiles]"), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(400);
  const mounted = await p.evaluate(() =>
    (document.querySelector("[data-hero-tiles]")?.getAttribute("data-hero-ids") ?? "").split(" ").filter(Boolean));
  ok("hero: the build-time cards are the row the app draws", declared.length === 6 && declared.join(" ") === mounted.join(" "),
    `static ${declared.length} · mounted ${mounted.length}${declared.join(" ") === mounted.join(" ") ? "" : ` · static=[${declared}] mounted=[${mounted}]`}`);
  const cards = (raw.match(/data-boot-tile="/g) ?? []).length;
  ok("hero: the shell draws six real cards, not six placeholders", cards === 6, `${cards} boot cards`);
}

/* ── I. the hero row: it runs, it is legible, and it is where it claims to be ─────────────────────────────── */
{
  // the first version of this check counted a tile whose *top* was on screen, which is how "all six above the
  // fold at 390" was reported while a phone showed four. A tile is on the first screen when its bottom edge is.
  for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]) {
    const p = await page(vp);
    await p.goto(BASE + "#/", { waitUntil: "load" });
    await p.waitForTimeout(1200);
    const m = await p.evaluate(() => {
      const band = document.querySelector("[data-hero-tiles]");
      const tiles = [...document.querySelectorAll("[data-tile]")];
      const ids = (band?.getAttribute("data-hero-ids") ?? "").split(" ").filter(Boolean);
      const br = band?.getBoundingClientRect();
      const painted = tiles.filter((t) => {
        const poster = t.querySelector("[data-poster]");
        const frame = t.querySelector("iframe");
        return !!poster || !!frame;
      }).length;
      // a tile is on the first screen when its whole card is
      const onScreen = tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > 0 && r.bottom <= innerHeight + 1; }).length;
      return {
        ids, tiles: tiles.length, onScreen, painted,
        band: br ? { top: Math.round(br.top), bottom: Math.round(br.bottom), h: Math.round(br.height), scrollW: band.scrollWidth, clientW: band.clientWidth } : null,
        vh: innerHeight,
      };
    });
    const fresh = MANIFEST.filter((i) => m.ids.includes(i.id));
    const allRun = fresh.every((i) => (i.files?.length ?? 0) > 0 && (i.variants?.length ?? 0) > 0);
    const allLegible = fresh.every((i) => ((i.composition?.count ?? 0) >= 2));
    ok(`hero: six tiles exist and all run (${vp.width})`, m.ids.length === 6 && allRun,
      `${m.ids.length} ids: ${m.ids.join(" ")}`);
    ok(`hero: no lone control, no docs page (${vp.width})`, allLegible,
      fresh.filter((i) => (i.composition?.count ?? 0) < 2).map((i) => i.id).join(" ") || "all have >=2 parts");
    ok(`hero: an item is drawn in every tile, never a blank box (${vp.width})`, m.painted === m.tiles,
      `${m.painted}/${m.tiles} tiles have a poster or a frame`);
    if (vp.width < 860) {
      ok(`hero: the band is one screen tall and scrolls sideways (${vp.width})`, !!m.band && m.band.h <= 300 && m.band.scrollW > m.band.clientW,
        `band ${m.band?.h}px at top ${m.band?.top}, scrollW ${m.band?.scrollW} > clientW ${m.band?.clientW}, ${m.onScreen} whole tiles on screen`);
    } else {
      ok(`hero: all six whole on the first screen (${vp.width})`, m.onScreen === 6, `${m.onScreen}/6 whole tiles`);
    }
    await p.context().close();
  }
}

/* ── J. the comparison page: reachable, and a visitor's words, not ours ───────────────────────────────────── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/g", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const links = await p.evaluate(() => [...document.querySelectorAll("[data-compare-links] a")].map((a) => a.getAttribute("href")));
  ok("the gallery links to the comparisons", links.length >= 1, `${links.length} links: ${links.slice(0, 4).join(" ")}`);
  await p.goto(BASE + "#/c/sidebar", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const body = await p.evaluate(() => document.body.innerText);
  ok("no build note on a public page", !/not published in this build|not exported|this build/i.test(body),
    (body.match(/not published in this build|not exported|this build/gi) ?? []).join(", "));
  ok("no shelf-order apology either", !/a shelf order|not an order of merit\./i.test(body), "found one");
  await p.context().close();
}

ok("no console errors anywhere in this run", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
console.log(out.join("\n"));
console.log(bad === 0 ? "\nR2: ok" : `\nR2: ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
