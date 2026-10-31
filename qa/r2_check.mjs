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
import { fileURLToPath } from "node:url";
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = (process.argv[2] ?? "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
/**
 * This gate's own tree — `new URL("..", import.meta.url)`, never a worktree path. It read
 * `/root/design-catalog-site/app/manifest.json`: a second tree, so every count it compared the served build against
 * was another build's, and the file is gone the moment that checkout is reaped.
 */
const REPO = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
const TAXONOMY = JSON.parse(readFileSync(`${REPO}/app/src/site/taxonomy.json`, "utf8"));
/** the catalogue's own totals, read from the data the site is built from — never typed into the gate */
const TOTALS = {
  items: MANIFEST.length,
  rendered: MANIFEST.filter((i) => i.has_demo).length,
  types: Object.values(TAXONOMY.sections).reduce((n, s) => n + Object.keys(s).length, 0),
};
const typeRoutes = new Set(Object.entries(TAXONOMY.sections).flatMap(([section, types]) =>
  Object.keys(types).map((t) => `#/t/${section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`)));
const CONCEPTS = [...new Set(MANIFEST.flatMap((i) => i.concepts ?? []))].sort();

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
  /*
   * r5 §Home, last bullet: "Confusing counter: 'Show all 8 rows' next to '21 more of 25 matched'." The hero marker
   * that counted the manifest is gone, and the count it printed was a different question from the one a reader
   * asks. The property that replaced it, and the one that can still fail: the front page states the catalogue's
   * own totals **once, in visitor words**, and every number it prints for them is the manifest's own.
   */
  const t = await p.evaluate(() => {
    const text = (document.querySelector("main") ?? document.body).innerText;
    const one = (re) => { const m = re.exec(text); return m ? Number(m[1]) : null; };
    const line = /(\d+)\s+items\s+·\s+(\d+)\s+types\s+·\s+(\d+)\s+rendered/.exec(document.body.innerText);
    return {
      text,
      lede: one(/(\d+)\s+components, blocks, charts/i),
      rendered: one(/(\d+)\s+of them run here/i),
      line: line ? { items: Number(line[1]), types: Number(line[2]), rendered: Number(line[3]) } : null,
      search: one(/Search\s+(\d+)\s+items/i),
      all: one(/All\s+(\d+)\s+items/i),
    };
  });
  ok("the hero states the catalogue's total in a sentence", t.lede === TOTALS.items,
    `lede says ${t.lede ?? "nothing"}, manifest ${TOTALS.items} items`);
  ok("…and its rendered count is the manifest's own", t.rendered === TOTALS.rendered,
    `lede says ${t.rendered ?? "nothing"} run here, manifest ${TOTALS.rendered} with has_demo`);
  ok("the count line in the shell agrees with the lede",
    !!t.line && t.line.items === TOTALS.items && t.line.types === TOTALS.types && t.line.rendered === TOTALS.rendered,
    t.line ? `${t.line.items} items · ${t.line.types} types · ${t.line.rendered} rendered — manifest ${TOTALS.items} · ${TOTALS.types} · ${TOTALS.rendered}` : "no count line");
  ok("every place the front page prints a total prints the same number",
    t.search === TOTALS.items && t.all === TOTALS.items,
    `search control ${t.search ?? "-"}, browse control ${t.all ?? "-"}, manifest ${TOTALS.items}`);
  // the reviewer's two contradictory counters, as a shape rather than a sentence: neither may come back
  const contradictory = /Show all \d+ rows|\d+ of \d+ (?:items )?matched/i.exec(t.text);
  ok("no two counters contradict each other", !contradictory, contradictory ? `"${contradictory[0]}"` : "one total, stated in words");
  const rows = t.text.match(/\[(?:shadcn|beui|rareui|beautifului|transitions)\//g) ?? [];
  ok("hero shows a real row set", rows.length >= 4, `${rows.length} source/kind rows`);
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
      // on a phone the theme control lives in the Browse menu now
      const opened = await p.evaluate(() => {
        const el = [...document.querySelectorAll("button")].find((n) => /browse/i.test(n.innerText));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
        return true;
      });
      await p.waitForTimeout(700);
      const m = await p.evaluate(() => ({
        radios: [...document.querySelectorAll(".theme-switch [role='radio'], .theme-switch button")]
          .map((n) => { const r = n.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }),
      }));
      ok(`the phone theme control is in the menu and ≥44 px (${vp.width})`,
        opened && m.radios.length === 3 && m.radios.every((r) => r.w >= 44 && r.h >= 44),
        m.radios.map((r) => `${r.w}×${r.h}`).join(" "));
      /*
       * r5 §Phones, Menu: "doesn't reach the bottom; page text shows through → full height". The old check asked
       * the *list* to own the scroll, which r9-scroll made wrong on purpose: the window scrolls the page now, so a
       * list that does not scroll itself is correct, and the menu is a fixed full-height sheet whose content fits.
       * The property is reachability, never ownership: the sheet reaches the bottom edge of the viewport, and every
       * section row — and every type row once a section is opened — can be brought into view.
       */
      const sheet = await p.evaluate(() => {
        const panel = document.querySelector(".rail.rail-phone");
        const r = panel?.getBoundingClientRect();
        return {
          open: !!panel && /is-open/.test(panel.className),
          top: r ? Math.round(r.top) : 0, bottom: r ? Math.round(r.bottom) : 0,
          height: r ? Math.round(r.height) : 0, vh: innerHeight,
        };
      });
      ok(`the phone menu is a full-height sheet (${vp.width})`,
        sheet.open && Math.abs(sheet.bottom - sheet.vh) <= 1 && sheet.height >= sheet.vh - sheet.top - 1,
        `panel top ${sheet.top}, ${sheet.height} px tall, bottom ${sheet.bottom} of ${sheet.vh}`);
      // open one section, so the reachability check covers type rows and not only the seven section rows
      await p.locator(".rail.rail-phone .rail-sec > [data-slot='collapsible-trigger']").first().click().catch(() => {});
      await p.waitForTimeout(450);
      const reach = await p.evaluate(async () => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const rows = [...document.querySelectorAll(".rail.rail-phone .rail-sec, .rail.rail-phone .rail-item")]
          .filter((r) => r.getBoundingClientRect().height > 0);
        const missed = [];
        for (const r of rows) {
          // a section row WRAPS its open children (`li` > trigger + list), so its own box is taller than the viewport
          // the moment the section is open. The row a thumb has to hit is its trigger — that is the box measured.
          const target = r.classList.contains("rail-sec")
            ? (r.querySelector("[data-slot='collapsible-trigger']") ?? r)
            : r;
          target.scrollIntoView({ block: "nearest" });
          await frame();
          const b = target.getBoundingClientRect();
          if (!(b.height > 0 && b.top >= -1 && b.bottom <= innerHeight + 1)) {
            missed.push(`${(target.textContent ?? "").trim().slice(0, 16)}@${Math.round(b.top)}+${Math.round(b.height)}`);
          }
        }
        return {
          n: rows.length, missed,
          types: [...document.querySelectorAll(".rail.rail-phone .rail-item")].filter((r) => r.getBoundingClientRect().height > 0).length,
        };
      });
      ok(`every row in the phone menu can be reached (${vp.width})`,
        reach.n >= 7 && reach.missed.length === 0,
        `${reach.n - reach.missed.length}/${reach.n} rows brought into view (${reach.types} type rows)${reach.missed.length ? ` — missed ${reach.missed.slice(0, 3).join(", ")}` : ""}`);
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
      /*
       * r5 §Phones, Home: "Featured tiles are a sideways scroller of 293 × 134 px strips, so each demo is a thin
       * crop → two per row, taller (about 4:3), or a vertical list." The band is a grid at a phone width now, so
       * the assertion inverts: six tiles, **no** sideways overflow, a canvas near 4:3 on every tile, and every
       * caption inside the band and inside the viewport — reachable without scrolling sideways, which is the thing
       * the strips could not do.
       */
      const band = await p.evaluate(() => {
        const host = document.querySelector("[data-hero-tiles]");
        const bs = host.getBoundingClientRect();
        return {
          scrollW: host.scrollWidth, clientW: host.clientWidth,
          tiles: [...document.querySelectorAll("[data-tile]")].map((t) => {
            const canvas = t.querySelector("a")?.firstElementChild?.getBoundingClientRect();
            const bar = t.querySelector("[data-tile-bar]")?.getBoundingClientRect();
            const tb = t.getBoundingClientRect();
            return {
              id: t.getAttribute("data-tile"),
              ratio: canvas && canvas.width ? +(canvas.height / canvas.width).toFixed(2) : 0,
              captionInsideBand: !!bar && bar.left >= bs.left - 1 && bar.right <= bs.right + 1 && bar.width >= tb.width * 0.6,
              tileInViewport: tb.left >= -1 && tb.right <= innerWidth + 1,
            };
          }),
        };
      });
      ok(`hero: the band is a grid, not a sideways scroller (${vp.width})`,
        band.tiles.length === 6 && band.scrollW <= band.clientW + 1,
        `${band.tiles.length} tiles, scrollW ${band.scrollW} of clientW ${band.clientW} (no sideways overflow)`);
      ok(`hero: every tile's canvas is about 4:3, not a strip (${vp.width})`,
        band.tiles.length === 6 && band.tiles.every((t) => t.ratio >= 0.7 && t.ratio <= 1.1),
        `canvas h/w ${band.tiles.map((t) => t.ratio).join(" ")}`);
      ok(`hero: every caption is inside the band and the viewport (${vp.width})`,
        band.tiles.length === 6 && band.tiles.every((t) => t.captionInsideBand && t.tileInViewport),
        `${band.tiles.filter((t) => t.captionInsideBand && t.tileInViewport).length}/6 captions reachable without sideways scroll`);
    } else {
      ok(`hero: all six whole on the first screen (${vp.width})`, m.onScreen === 6, `${m.onScreen}/6 whole tiles`);
    }
    await p.context().close();
  }
}

/* ── J. the gallery and the type pages are one system, and every old concept address redirects into it ──────── */
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(BASE + "#/g", { waitUntil: "load" });
  await p.waitForTimeout(2500);
  /*
   * r5 §Type pages and sorting, item 1: "Two comparison systems live at once … **Delete `#/c/` and redirect it to
   * `#/t/`**", and §Phones Gallery: "old 'Compare side by side' strip fills the first screen (20 links) → remove the
   * strip". The strip is gone, so a gate that counted its links has nothing to count. What replaced it: the gallery
   * offers the type pages themselves, and every concept key the manifest still carries resolves into one of them.
   */
  const offers = await p.evaluate(() => ({
    types: [...new Set([...document.querySelectorAll("a[href^='#/t/']")].map((a) => a.getAttribute("href")))],
    conceptLinks: document.querySelectorAll("a[href^='#/c/']").length,
    strip: document.querySelectorAll("[data-compare-links] a").length,
  }));
  const unknown = offers.types.filter((h) => !typeRoutes.has(h));
  ok("the gallery offers the type pages, and every one exists in the taxonomy",
    offers.types.length >= 20 && unknown.length === 0,
    `${offers.types.length} type links, ${unknown.length} unknown${unknown.length ? `: ${unknown.slice(0, 3).join(" ")}` : ""}`);
  ok("the old comparison strip is gone, and no page offers #/c/ any more",
    offers.strip === 0 && offers.conceptLinks === 0,
    `${offers.strip} strip links, ${offers.conceptLinks} #/c/ links`);
  const landings = [];
  for (const key of CONCEPTS) {
    await p.evaluate((k) => { location.hash = `#/c/${k}`; }, key);
    // the type page is a chunk of its own: wait for the surface, never for a stopwatch
    await p.waitForFunction(() => !!document.querySelector("[data-type-title]"), null, { timeout: 8000 }).catch(() => {});
    landings.push(await p.evaluate(() => ({ hash: location.hash, title: document.querySelector("[data-type-title]")?.textContent?.trim() ?? "" })));
  }
  const escaped = landings.filter((l) => !typeRoutes.has(l.hash));
  ok("every concept the manifest carries redirects into the type pages",
    CONCEPTS.length >= 20 && escaped.length === 0,
    `${landings.length} concept keys → ${new Set(landings.map((l) => l.hash)).size} type routes${escaped.length ? `; not a type route: ${escaped.slice(0, 3).map((l) => l.hash).join(" ")}` : ""}`);
  // a redirect that lands on a page which does not render the type it names is a redirect to nowhere
  const typeNameByRoute = new Map(Object.entries(TAXONOMY.sections).flatMap(([section, types]) =>
    Object.keys(types).map((t) => [`#/t/${section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${t.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, t])));
  const misnamed = landings.filter((l) => typeRoutes.has(l.hash) && l.title !== typeNameByRoute.get(l.hash));
  ok("and each one lands on the type page that names that type",
    misnamed.length === 0,
    misnamed.length ? misnamed.slice(0, 3).map((l) => `${l.hash} rendered "${l.title}"`).join("; ") : `${landings.length} landings, every title is the taxonomy's own name`);
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
