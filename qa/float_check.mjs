/**
 * Nothing floats over the catalogue. This is the gate for "the floating palette button is gone", written so the
 * *next* floating control fails it too.
 *
 * `23d8b824` (r7) deleted the last floating control: a 134×36 `position: fixed` "Search 769 ⌘K" button pinned to
 * the bottom-right corner, a second door to the room the top bar's own 240 px field already opens, sitting at
 * 36 px over the content — at the one corner a reader's thumb crosses. ⌘K/Ctrl+K still opens the palette from
 * anywhere, and the phone bar carries its own 44 px Search, so nothing was lost.
 *
 * The rule, as this file enforces it:
 *
 *   **Every element whose computed `position` is `fixed` must be the top bar, the registry sidebar
 *   (`[data-slot="sidebar-container"]`), or inside one of them.**
 *
 * That is deliberately a property of the *set*, not a check for a button labelled "Search": a check for one
 * removed control passes the moment the same control comes back under another name, while "no fixed element
 * outside the two surfaces that own the frame" fails for every future corner pill, floating action button,
 * sticky toast, sticky banner and floating palette trigger that anybody adds. The exemption list is two
 * selectors long, and adding a third is a decision someone has to make on purpose, in this file, under review.
 *
 * The one extra allowance is the phone menu, and only while it is open: `.rail-phone` is a fixed sheet and
 * `.menu-veil` is its fixed backdrop (`site/Rail.tsx`, the `@media (max-width: 860px)` block in `styles.css`).
 * They are allowed here because they are the phone's *only* surface above the page, gate-2
 * (`rail_density_check.mjs`) governs what is inside them, and both vanish when the menu closes — which is why
 * the closed-menu phone pass below is the one that must stay clean.
 *
 * Usage: node qa/float_check.mjs [base]      (default http://localhost:8830/design-catalog/)
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROUTES = ["#/", "#/i/shadcn/sidebar-09", "#/g"];
/** The two surfaces that own the frame, and nothing else. */
const OWNED = ["header.topbar", '[data-slot="sidebar-container"]'];
/** The phone menu's own surface, while it is open. */
const MENU = [".rail-phone", ".menu-veil"];

let fails = 0;
const bad = (name, detail) => { fails++; console.log(`FAIL ${name} — ${detail}`); };
const ok = (name, detail) => console.log(`ok   ${name} — ${detail}`);

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** Every fixed element on the page, with whether it is inside one of the allowed surfaces. */
const fixedOn = (page, allowed) =>
  page.evaluate((allowedSel) => {
    const owners = allowedSel.flatMap((s) => [...document.querySelectorAll(s)]);
    const inside = (e) => owners.some((o) => o === e || o.contains(e));
    const desc = (e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34);
    const fixed = [...document.querySelectorAll("body *")].filter((e) => {
      if (getComputedStyle(e).position !== "fixed") return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return {
      total: fixed.length,
      offenders: fixed.filter((e) => !inside(e)).map((e) => {
        const r = e.getBoundingClientRect();
        return {
          tag: e.tagName.toLowerCase(),
          cls: String(e.className || "").split(" ").filter(Boolean).slice(0, 2).join("."),
          label: desc(e),
          size: `${Math.round(r.width)}×${Math.round(r.height)}`,
          at: `${Math.round(r.left)},${Math.round(r.top)}`,
        };
      }),
      allowed: fixed.filter(inside).map((e) => e.tagName.toLowerCase() + (e.getAttribute("data-slot") ? `[data-slot=${e.getAttribute("data-slot")}]` : "." + String(e.className || "").split(" ")[0])),
    };
  }, allowed);

/* ── 1440 and 390 with the menu shut: the bar and the sidebar, nothing else ─────────────────────────────── */
for (const [w, h, phone] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = settle(await ctx.newPage());
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(200);
    const m = await fixedOn(page, OWNED);
    const tag = `${w} ${route}`;
    if (m.offenders.length === 0) {
      ok(`${tag}: no fixed control outside the bar and the sidebar`, `${m.total} fixed element(s), all inside ${JSON.stringify(m.allowed)}`);
    } else {
      bad(`${tag}: no fixed control outside the bar and the sidebar`,
        `${m.offenders.length} of ${m.total} fixed element(s) unowned — ` + m.offenders.map((o) => `<${o.tag} class="${o.cls}"> "${o.label}" ${o.size} at ${o.at}`).join(" · "));
    }
  }
  await ctx.close();
}

/* ── 390, menu open: the phone's one surface above the page is the menu itself, and nothing else ────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/`, { waitUntil: "load" });
  await page.click('[aria-controls="rail"]');
  await page.waitForFunction(() => document.querySelector(".rail-phone.is-open"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  const m = await fixedOn(page, [...OWNED, ...MENU]);
  if (m.offenders.length === 0) {
    ok("390 menu open: only the menu is fixed", `${m.total} fixed element(s) — ${JSON.stringify(m.allowed)}`);
  } else {
    bad("390 menu open: only the menu is fixed",
      `${m.offenders.length} of ${m.total} unowned — ` + m.offenders.map((o) => `<${o.tag} class="${o.cls}"> "${o.label}" ${o.size} at ${o.at}`).join(" · "));
  }
  await ctx.close();
}

await browser.close();
console.log(fails ? `FLOAT: ${fails} FAIL` : "FLOAT: ok");
process.exit(fails ? 1 : 0);
