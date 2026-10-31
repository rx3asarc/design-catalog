/**
 * The contrast gate: every text pair the chrome publishes, measured from the *painted* colour, in both palettes.
 *
 * Why painted and not parsed: the site has two token tables (the design system's `tokens.css` under `.cat`, and
 * shadcn's registry tokens in `:root` / `.dark` for the demo documents), a light override scoped to
 * `html:not(.dark) .cat`, and `color-mix()` in a couple of places. Reading the declaration is guessing which of
 * those won; painting a 1x1 canvas with the resolved colour and reading the pixel back is not. Every ratio below
 * therefore comes from two `fillStyle` calls on a real canvas in a real page, computed with WCAG 2.1's relative
 * luminance.
 *
 * What it asserts
 * ---------------
 * BASELINE — 32 pairs, the matrix the r7 note in `styles.css` refers to ("the design system's own ink steps clear
 * 4.5:1 on all three surfaces in both themes (qa/contrast_check.mjs gates 32/32)"). The file that note names was
 * not committed to `master` (`git log --all -- qa/contrast_check.mjs` is empty), so r8 writes it:
 *
 *     2 palettes × 4 ink steps × 4 backgrounds = 32
 *     ink steps     --ink, --ink-muted, --ink-subtle, --accent-ink
 *     backgrounds   --surface-100, --surface-200, --surface-300, --card
 *
 * r8 STATUS — 18 more pairs, for the hues r8 added as tokens: `--ok`, `--warn`, `--danger` on the three surfaces
 * in both palettes. They are text at 12 px on a badge, so they are normal-size text and the floor is 4.5:1. The
 * `--*-rule` and `--*-fill` partners are graphics (a hairline and a 6 px dot) and are printed, not gated — WCAG
 * gives a graphic no text floor, and inventing one here would be a rule this site does not have.
 *
 * Usage: node qa/contrast_check.mjs [base]        default http://localhost:8830/design-catalog/
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROUTE = "#/i/beui/dynamic-island"; // an item page: `.cat` plus every surface a badge lands on
const FLOOR = 4.5;

const INKS = ["--ink", "--ink-muted", "--ink-subtle", "--accent-ink"];
const SURFACES = ["--surface-100", "--surface-200", "--surface-300", "--card"];
const STATUS = ["--ok", "--warn", "--danger"];
const STATUS_GRAPHICS = ["--ok-rule", "--ok-fill", "--warn-rule", "--warn-fill", "--danger-rule", "--danger-fill"];

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** One palette, in one round trip: resolve every token by painting it, then measure every pair. */
async function measure(theme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (theme === "light") await ctx.addInitScript(() => localStorage.setItem("catalog-theme", "light"));
  const page = settle(await ctx.newPage());
  await page.goto(BASE + ROUTE, { waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(900);

  const out = await page.evaluate(({ inks, surfaces, status, graphics, floor }) => {
    const host = document.querySelector(".page-in") ?? document.body;
    /** The painted colour of a custom property: paint it on a throwaway span and read what the engine resolved. */
    const resolve = (name) => {
      const s = document.createElement("span");
      s.style.color = `var(${name})`;
      s.style.position = "absolute";
      s.style.opacity = "0";
      host.appendChild(s);
      const v = getComputedStyle(s).color;
      s.remove();
      return v;
    };
    const painted = Object.fromEntries(
      [...inks, ...surfaces, ...status, ...graphics].map((n) => [n, resolve(n)]),
    );

    /* WCAG 2.1 relative luminance, from the sRGB bytes the canvas hands back. */
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 1;
    const cx = canvas.getContext("2d", { willReadFrequently: true });
    /** fg composited over bg, as the browser would paint it — alpha included, not thrown away. */
    const contrast = (fg, bg) => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = bg; cx.fillRect(0, 0, 1, 1);
      cx.fillStyle = fg; cx.fillRect(0, 0, 1, 1);
      const f = [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = bg; cx.fillRect(0, 0, 1, 1);
      const b = [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      const lf = lum(f), lb = lum(b);
      return Math.round(((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)) * 100) / 100;
    };

    const baseline = [];
    for (const ink of inks) for (const surf of surfaces) {
      baseline.push({ pair: `${ink} on ${surf}`, ratio: contrast(painted[ink], painted[surf]) });
    }
    const statusPairs = [];
    for (const s of status) for (const surf of surfaces.slice(0, 3)) {
      statusPairs.push({ pair: `${s} on ${surf}`, ratio: contrast(painted[s], painted[surf]) });
    }
    const graphicsOut = graphics.map((g) => ({ pair: g, colour: painted[g], onSurface200: contrast(painted[g], painted["--surface-200"]) }));
    return {
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      tokens: painted, baseline, statusPairs, graphicsOut, floor,
    };
  }, { inks: INKS, surfaces: SURFACES, status: STATUS, graphics: STATUS_GRAPHICS, floor: FLOOR });

  await ctx.close();
  return out;
}

const dark = await measure("dark");
const light = await measure("light");
await browser.close();

let bad = 0;
const line = (r, name) => {
  const ok = r.ratio >= FLOOR;
  if (!ok) bad++;
  return `${ok ? "ok  " : "FAIL"} ${name.padEnd(34)} ${String(r.ratio).padStart(6)}:1 ${ok ? "" : `< ${FLOOR}`}`;
};

for (const run of [dark, light]) {
  console.log(`\n── ${run.theme} (page reports "${run.theme}")`);
  for (const r of run.baseline) console.log(line(r, r.pair));
  for (const r of run.statusPairs) console.log(line(r, r.pair));
}
console.log("\n── graphics (a hairline and a 6 px dot: no text floor, printed so a change is visible)");
for (const run of [dark, light]) {
  for (const g of run.graphicsOut) console.log(`info ${run.theme.padEnd(5)} ${g.pair.padEnd(24)} ${g.colour} · on surface-200 ${g.onSurface200}:1`);
}

const total = dark.baseline.length + light.baseline.length;
const statusTotal = dark.statusPairs.length + light.statusPairs.length;
console.log(
  bad
    ? `\nCONTRAST: ${bad} FAIL of ${total + statusTotal} (${total} baseline, ${statusTotal} status)`
    : `\nCONTRAST: ok — ${total + statusTotal}/${total + statusTotal} at ${FLOOR}:1 (${total} baseline, ${statusTotal} status)`,
);
process.exit(bad ? 1 : 0);
