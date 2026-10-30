#!/usr/bin/env node
/**
 * THE FRONT PAGE'S HERO ROW, GATED.
 *
 * The row is chosen by a rule (`app/src/site/Featured.tsx`), and the rule is only worth having if the thing it
 * produces is checked. Two of its clauses are facts about files that can rot, and one is a claim about what a
 * visitor sees:
 *
 *   1. **The measurement is complete.** `app/src/site/hero-ink.json` holds the ink of every demo the rule can
 *      reach. If an ingest adds a candidate and nobody re-runs the sweep, the rule cannot rank it — and worse, the
 *      row's own evidence ("every tile is above the floor") would be silently incomplete. So: every candidate the
 *      rule can reach has a number here.
 *   2. **Nothing in the row is an empty frame.** Every hero id measures at or above the file's floor. This is the
 *      review's complaint, turned into an assertion: three of six near-identical tiles and two that looked like
 *      empty grey frames was the problem, and `shadcn/sidebar` (0.06% ink at tile scale) was one of them.
 *   3. **Six different things, not six boxes.** Six tiles; six distinct types from the taxonomy; at most two from
 *      any one section. "Not three sidebars" is asserted as a property, not as a list of ids.
 *
 * The first two read files off disk (a second, no server needed). The third reads the running page, because "six
 * tiles exist and each one runs" is only true of a build.
 *
 * Run: node qa/hero_check.mjs [base]      # base defaults to http://localhost:8830/design-catalog/
 */
import { readFileSync } from "node:fs";
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";

const BASE = (process.argv[2] || "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const manifest = JSON.parse(readFileSync(`${root}/app/manifest.json`, "utf8"));
const tax = JSON.parse(readFileSync(`${root}/app/src/site/taxonomy.json`, "utf8"));
const inkFile = JSON.parse(readFileSync(`${root}/app/src/site/hero-ink.json`, "utf8"));

let fail = 0;
const ok = (m) => console.log(`ok   ${m}`);
const bad = (m) => { console.log(`FAIL ${m}`); fail++; };

/* ── what the rule can reach, computed from the two files it reads ─────────────────────────────────────── */

const ORDER = ["Components", "Blocks", "Charts", "Agent UI", "Effects", "Foundations", "Docs"];
const at = new Map();
for (const s of ORDER) for (const [type, ids] of Object.entries(tax.sections[s] ?? {})) for (const id of ids) at.set(id, { section: s, type });

const idOf = (i) => `${i.source}/${i.slug}`;
const candidates = manifest
  .map((i) => {
    const a = at.get(idOf(i));
    const comp = i.composition?.count ?? 0;
    const runs = i.has_demo ?? (i.variants?.length ?? 0) > 0;
    return a && comp >= 3 && runs ? { id: idOf(i), section: a.section, type: a.type } : null;
  })
  .filter(Boolean);

// 1. every candidate the rule can reach has been measured
const unmeasured = candidates.filter((c) => inkFile.ink[c.id] === undefined);
unmeasured.length
  ? bad(`1 every candidate is measured — ${unmeasured.length} with no entry: ${unmeasured.slice(0, 5).map((c) => c.id).join(", ")}`)
  : ok(`1 every candidate is measured — ${candidates.length} of ${candidates.length} in hero-ink.json`);

// 2. the floor is a floor: every measured candidate is a number, and the floor is not a token gesture
const floor = inkFile.floor;
typeof floor === "number" && floor > 0.1 && floor < 0.5
  ? ok(`2 the floor is a number — ${floor}, on a 0–1 scale of the tile's canvas that is not background`)
  : bad(`2 the floor is a number — ${floor}`);
const notNumbers = Object.entries(inkFile.ink).filter(([, v]) => typeof v !== "number" || !(v >= 0 && v <= 1));
notNumbers.length ? bad(`2b every entry is a fraction — ${notNumbers.slice(0, 3).map(([k]) => k).join(", ")}`) : ok(`2b every entry is a fraction — ${Object.keys(inkFile.ink).length} readings`);

/* ── the built row ────────────────────────────────────────────────────────────────────────────────────────── */

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** The row as the page draws it, at one width. */
async function row(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE + "#/", { waitUntil: "load" });
  await page.waitForFunction(() => !!document.querySelector("[data-hero-tiles]"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const m = await page.evaluate(`(() => {
    const band = document.querySelector("[data-hero-tiles]");
    const tiles = [...document.querySelectorAll("[data-tile]")];
    return {
      ids: (band?.getAttribute("data-hero-ids") || "").split(" ").filter(Boolean),
      drawn: tiles.map((t) => t.getAttribute("data-tile")),
      runs: tiles.filter((t) => t.querySelector("iframe") || t.querySelector("[data-poster]")).length,
      note: document.querySelector("[data-hero-note]")?.textContent?.trim() ?? null,
    };
  })()`);
  await ctx.close();
  return m;
}

/**
 * The ink a tile actually puts down, measured on the page rather than in the sweep: the sweep frames each demo at
 * the width the demo reports and reads the top-left of that frame, while a live tile re-zooms once the demo reports
 * and can end up framing a little tighter — measured on this build, `beui/chat-app` reads 0.23 in the sweep and
 * 0.37 in its tile, `shadcn/login-01` 0.37 in the sweep and 0.14 in its tile. The sweep's number is what the rule
 * ranks by; this one is what a visitor sees, so it is what the "no empty frames" assertion is made of.
 */
async function tileInk(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE + "#/", { waitUntil: "load" });
  await page.waitForFunction(() => !!document.querySelector("[data-hero-tiles]"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const ids = await page.evaluate(() => (document.querySelector("[data-hero-tiles]")?.getAttribute("data-hero-ids") || "").split(" ").filter(Boolean));
  const out = {};
  for (const id of ids) {
    const li = page.locator(`[data-tile="${id}"]`);
    await li.scrollIntoViewIfNeeded().catch(() => {});
    await page
      .waitForFunction((id) => {
        const f = document.querySelector(`[data-tile="${id}"] iframe`);
        try {
          const d = f && f.contentDocument;
          if (!d || !d.body) return false;
          return [...d.querySelectorAll("*")].filter((n) => { const b = n.getBoundingClientRect(); return b.width > 2 && b.height > 2; }).length > 6;
        } catch { return false; }
      }, id, { timeout: 12000 })
      .catch(() => {});
    await page.waitForTimeout(500);
    const frame = li.locator("iframe");
    const target = (await frame.count()) ? frame.first() : li;
    let shot;
    try { shot = (await target.screenshot()).toString("base64"); } catch { out[id] = null; continue; }
    out[id] = await page.evaluate(async (src) => {
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + src; });
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const A = g.getImageData(0, 0, img.width, img.height).data;
      const hist = new Map();
      for (let i = 0; i < A.length; i += 4) { const k = `${A[i]},${A[i + 1]},${A[i + 2]}`; hist.set(k, (hist.get(k) || 0) + 1); }
      const bg = [...hist.entries()].sort((x, y) => y[1] - x[1])[0][0].split(",").map(Number);
      let diff = 0, total = 0;
      for (let i = 0; i < A.length; i += 4) { total++; if (Math.abs(A[i] - bg[0]) + Math.abs(A[i + 1] - bg[1]) + Math.abs(A[i + 2] - bg[2]) > 12) diff++; }
      return +(diff / total).toFixed(4);
    }, shot);
  }
  await ctx.close();
  return out;
}

const wide = await row(1440, 900);
const ids = wide.ids;

ids.length === 6 ? ok(`3 six tiles — ${ids.join(" ")}`) : bad(`3 six tiles — ${ids.length}: ${ids.join(" ")}`);
wide.drawn.length === 6 && wide.runs === 6
  ? ok(`3b every tile draws something — ${wide.runs}/6 have a frame or a poster`)
  : bad(`3b every tile draws something — ${wide.runs}/6`);

const missing = ids.filter((id) => !at.has(id));
missing.length ? bad(`4 every hero id is a taxonomy member — not in the file: ${missing.join(", ")}`) : ok(`4 every hero id is a taxonomy member — ${ids.length} of ${ids.length}`);

const types = ids.map((id) => at.get(id)?.type).filter(Boolean);
const dupTypes = types.filter((t, i) => types.indexOf(t) !== i);
dupTypes.length ? bad(`5 six different things — repeated type: ${[...new Set(dupTypes)].join(", ")}`) : ok(`5 six different things — 6 distinct types: ${types.join(", ")}`);

const sections = ids.map((id) => at.get(id)?.section).filter(Boolean);
const perSection = new Map();
for (const s of sections) perSection.set(s, (perSection.get(s) ?? 0) + 1);
const over = [...perSection.entries()].filter(([, n]) => n > 2);
over.length ? bad(`6 no section takes the row — ${over.map(([s, n]) => `${s} ${n}`).join(", ")}`) : ok(`6 no section takes the row — ${[...perSection.entries()].map(([s, n]) => `${s} ${n}`).join(" · ")}`);

const below = ids.map((id) => ({ id, ink: inkFile.ink[id] })).filter((x) => x.ink === undefined || x.ink < floor);
below.length
  ? bad(`7 no tile is an empty frame — under ${floor}: ${below.map((x) => `${x.id} ${x.ink ?? "unmeasured"}`).join(", ")}`)
  : ok(`7 no tile is an empty frame — ${ids.map((id) => `${inkFile.ink[id]}`).join(" ")} (floor ${floor})`);

// 7b. the same question asked of the tiles themselves, and a smoke floor rather than the instrument: measured this
// way the two numbers do not separate "an empty shell" from "a small card" (the pre-fix row's shadcn/sidebar-15 and
// -16 measured 0.17 here, and this row's shadcn/login-01 — a login card on a page — measures 0.14), which is why the
// ranking uses the sweep's framing instead. What this catches is the blank box: a demo that fails to mount, or
// paints its background and nothing else, lands under 0.02.
const TILE_FLOOR = 0.1;
const ink = await tileInk(1440, 900);
const empty = ids.filter((id) => !(ink[id] >= TILE_FLOOR));
Object.keys(ink).length === ids.length && !empty.length
  ? ok(`7b no tile is a blank box, measured on the tiles — ${ids.map((id) => `${id.split("/")[1]} ${ink[id]}`).join(" · ")}`)
  : bad(`7b no tile is a blank box, measured on the tiles — ${empty.map((id) => `${id} ${ink[id]}`).join(", ") || "no tiles measured"}`);

const noDemo = ids.filter((id) => {
  const i = manifest.find((m) => idOf(m) === id);
  return !i || !(i.has_demo ?? (i.variants?.length ?? 0) > 0);
});
noDemo.length ? bad(`8 every tile can run — no demo: ${noDemo.join(", ")}`) : ok(`8 every tile can run — 6 of 6 have a demo`);

// the phone draws the same six: the row is chosen once, not per width
const phone = await row(390, 844);
phone.ids.join(" ") === ids.join(" ")
  ? ok(`9 the phone draws the same six — ${phone.ids.length} ids match`)
  : bad(`9 the phone draws the same six — 390: ${phone.ids.join(" ") || "none"}`);

// one full stop, and no build note where a visitor can read it
const note = wide.note ?? "";
!/\.\.|\.\s*$/.test(note.replace(/\.$/, "")) && !/\b(build|repo|manifest|harness|measured|round \d)\b/i.test(note)
  ? ok(`10 the row's sentence is a sentence — "${note}"`)
  : bad(`10 the row's sentence is a sentence — "${note}"`);

await browser.close();
console.log(`\nHERO: ${fail ? fail + " FAIL" : "ok"} — six tiles, ${types.length} distinct types, ink ${Math.min(...ids.map((id) => inkFile.ink[id] ?? 0)).toFixed(4)}–${Math.max(...ids.map((id) => inkFile.ink[id] ?? 0)).toFixed(4)} against a floor of ${floor}`);
process.exit(fail ? 1 : 0);
