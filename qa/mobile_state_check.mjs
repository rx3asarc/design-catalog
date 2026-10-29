/**
 * Two review items that only a phone and a reload can catch, as a gate.
 *
 *   #13  nothing on a phone smaller than 12 px of type, nothing tappable under 44 px
 *   #6   the stage's width controls actually resize the frame (390 / 768 / full)
 *   #2   the rail's filter survives a reload, and what comes back is what retyping it produces
 *
 * Usage: node mobile_state_check.mjs [base]     (default: the local server; pass the live URL to check a deploy)
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";

const BASE = process.argv[2] ?? "http://localhost:8830/design-catalog/";
const ROUTES = ["#/", "#/g", "#/i/shadcn/sidebar-09", "#/c/sidebar", "#/about", "#/chrome"];
const fails = [];
const ok = (name, pass, detail = "") => { console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!pass) fails.push(name); };

const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

/* ── #13, at 390 ─────────────────────────────────────────────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    // a surface fetched on demand draws a "Fetching …" line first: wait for it to be gone, not for a fixed delay
    await page.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const tiny = [], small = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("iframe")) continue;                       // a demo's own type is the demo's business
        const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ");
        if (!text) continue;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) tiny.push(`${el.tagName.toLowerCase()} "${text.slice(0, 20)}" ${fs}px`);
      }
      const taps = [...document.querySelectorAll("a, button, [role=button], summary, input[type=checkbox], input[type=radio]")]
        .filter((el) => !el.closest("iframe") && el.getClientRects().length)
        .map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), label: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24) }; })
        .filter((x) => x.h < 44 || x.w < 44);
      return { tiny, taps };
    });
    ok(`#13 ${route}: no type under 12px`, m.tiny.length === 0, m.tiny.slice(0, 3).join(" · "));
    ok(`#13 ${route}: no target under 44px`, m.taps.length === 0, m.taps.slice(0, 3).map((t) => `${t.w}×${t.h} ${t.label}`).join(" · "));
  }
  await ctx.close();
}

/* ── #6 and #2, at 1440 ───────────────────────────────────────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // #6 — the width controls move the frame, and each one lands on its own number
  await page.goto(BASE + "#/i/shadcn/sidebar-09", { waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const frameWidth = () => page.evaluate(() => { const f = document.querySelector("[data-stage] iframe"); return f ? Math.round(f.getBoundingClientRect().width) : null; });
  const full = await frameWidth();
  const widths = {};
  for (const [name, sel, want] of [
    ["390", '[aria-label="Phone viewport, 390 CSS pixels"]', 390],
    ["768", '[aria-label="Tablet viewport, 768 CSS pixels"]', 768],
  ]) {
    await page.click(`[data-stage-bar] ${sel}`);
    await page.waitForTimeout(700);
    widths[name] = await frameWidth();
    ok(`#6 stage ${name}`, widths[name] === want, `${widths[name]} px, wanted ${want}`);
  }
  await page.click('[data-stage-bar] [aria-label="Full column width"]');
  await page.waitForTimeout(700);
  const back = await frameWidth();
  ok("#6 stage full restores the column", back === full && !!full, `${back} px, was ${full} px`);

  // #2 — the filter survives a reload, and the restored state equals retyping it
  const rows = () => page.evaluate(() => [...document.querySelectorAll('[data-slot=sidebar] a[href^="#/i/"]')].map((a) => a.getAttribute("href")).sort());
  await page.goto(BASE + "#/", { waitUntil: "load" });
  const box = page.locator('input[placeholder^="Filter"]').first();
  await box.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await box.fill("side");
  await page.waitForTimeout(2500);                    // the tree expands as it filters; measure after it settles
  const typed = await rows();
  await page.reload({ waitUntil: "load" });
  const box2 = page.locator('input[placeholder^="Filter"]').first();
  await box2.waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const restored = await rows();
  const value = await box2.inputValue();
  ok("#2 the filter value comes back", value === "side", `input says "${value}"`);
  ok("#2 the restored filter is the filter that was typed", JSON.stringify(restored) === JSON.stringify(typed),
    `${typed.length} rows typed vs ${restored.length} after reload`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `STATE: ${fails.length} FAIL` : "STATE: ok");
process.exit(fails.length ? 1 : 0);
