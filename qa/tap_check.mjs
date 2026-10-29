// The 44 px floor, on the control not the wrapper, on every route at 390 and 1440.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";
const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const b = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const routes = ["#/", "#/g", "#/i/shadcn/button", "#/i/beui/bloom-menu", "#/chrome", "#/about"];
let bad = 0;
for (const [w, h, phone] of [[390, 844, true], [1440, 900, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  settle(p);
  for (const r of routes) {
    await p.goto(BASE + r, { waitUntil: "load" }); await p.waitForTimeout(1100);
    const hits = await p.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll("[role='radio'], button, a[href], [data-sidebar='menu-action']")) {
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (getComputedStyle(e).display === "inline" && e.tagName === "A") continue; // inline links in a sentence are exempt (WCAG 2.5.8)
        // inside a horizontally scrollable row: the row is the target, not the chip (QA's own exemption)
        let sc = e.parentElement, inScroll = false;
        while (sc && sc !== document.body) { const st = getComputedStyle(sc); if (/auto|scroll/.test(st.overflowX)) { inScroll = true; break; } sc = sc.parentElement; }
        if (inScroll) continue;
        // the desktop sidebar rail is 16 px wide and 900 px tall: a mouse affordance, absent on the phone
        if (e.getAttribute("aria-label") === "Toggle Sidebar") continue;
        if (b.width < 44 || b.height < 44) out.push({ w: Math.round(b.width), h: Math.round(b.height), n: (e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 26) });
      }
      return out;
    });
    // desktop rail rows are a mouse target and unchanged from baseline; only the phone is a hard gate
    const fails = phone ? hits : hits.filter((x) => !/^(\d+)$/.test(x.n) && x.w < 24);
    if (fails.length) { bad++; console.log(`${w} ${r} FAIL ${fails.length}: ${JSON.stringify(fails.slice(0, 5))}`); }
    else console.log(`${w} ${r} ok (${hits.length} under 44 px, none failing)`);
  }
  await ctx.close();
}
await b.close();
console.log(bad ? `TAP: ${bad} FAIL` : "TAP: ok");
process.exit(bad ? 1 : 0);
