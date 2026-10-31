// r8b card gate: what a card prints, how tall it is, and what it says when there is no demo.
//
// Four claims, each measured rather than asserted:
//
//   1. a card prints its item's own `one_line` — verbatim when the manifest has one, and NOTHING (no invented
//      sentence) when it does not;
//   2. no card prints a facet/stats line ("27 pattern · 21 files · sidebar") — the numbers moved to the item page;
//   3. the card stays one grid cell tall: the spread of card heights is 0 at 1440 and 0 at 390, as it was before
//      the description block existed (486 cards, all 275.9 px / all 247.9 px);
//   4. the 283 items with `has_demo === false` say so on their own card, in the item page's voice, and the reason
//      printed matches the data (`withheld` items are the ones that talk about the licence).
//
// Plus the truncation rule: text that is taller than its box must sit in a clamping box (`-webkit-line-clamp`),
// because that is the only thing in this stylesheet that ends a cut line with an ellipsis. A box that hides
// overflow without clamping is a word sliced in half in silence — this gate fails on one.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { settle } from "./settle.mjs";

const BASE = (process.argv[2] || "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
/**
 * This gate reads the manifest and the taxonomy of **the tree it lives in** — `fileURLToPath(new URL("..",
 * import.meta.url))` — not a path to some worktree that existed while it was written. r8-cards'
 * `qa/card_check.mjs` and `foundations_check.mjs` were hardcoded to `/…/design-catalog-site-r8-cards`, which was
 * deleted when that unit was reaped: on the merged tree they died in `readFileSync` before asserting anything, so a
 * broken gate looked like a crashed script instead of a measurement. A gate must run anywhere its repo is checked out.
 */
const REPO = fileURLToPath(new URL("..", import.meta.url));
const items = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
const byId = new Map(items.map((i) => [i.id, i]));
const noDemo = items.filter((i) => !i.has_demo);

const fails = [];
const ok = (cond, line) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${line}`);
  if (!cond) fails.push(line);
};

const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });

/* ── 1 + 2 + 3: the live grid ─────────────────────────────────────────────────────────────────────────────── */
for (const vp of [{ n: "1440", w: 1440, h: 900 }, { n: "390", w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(`${BASE}#/g`, { waitUntil: "load" });
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-tile]")];
    const out = { n: cards.length, heights: {}, wrongLine: [], invented: [], stats: [], sliced: [], truncated: [], ellipsised: [], unclamped: [] };
    for (const li of cards) {
      const id = li.getAttribute("data-tile");
      const card = li.firstElementChild;
      const h = Math.round(card.getBoundingClientRect().height * 10) / 10;
      out.heights[h] = (out.heights[h] ?? 0) + 1;
      // the description slot: `data-card-line` carries the id ONLY when the manifest published a sentence
      const line = li.querySelector("[data-card-line]");
      const text = (line?.textContent ?? "").trim();
      if (line) out.pairs = (out.pairs ?? 0) + 1;
      out.lines ??= [];
      out.lines.push([id, text]);
      // the card as a whole must not print the facet vocabulary any more
      const all = (card.textContent ?? "").replace(/\s+/g, " ").trim();
      if (/\b\d+\s+(files?|patterns?|parts?|KB|MB)\b/i.test(all) || /\bpattern · \d+ files\b/.test(all)) out.stats.push([id, all.slice(0, 90)]);
      // truncation discipline: ask each slot how tall its text *would* be, then check the box it is in. Anything
      // that does not fit must be in a clamping box (-webkit-line-clamp is the only thing here that draws an
      // ellipsis); a box that hides the overflow without one is a word cut in half in silence, and this fails.
      //
      // The measurement is a detached clone, not the element itself: these slots are grid items in fixed tracks, so
      // their own `height: auto` is the track's height, not their content's — asking the clone is the only way to
      // learn how many lines the sentence really needs.
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
      document.body.appendChild(probe);
      for (const el of card.querySelectorAll(".dc-card-name, .dc-card-line, .dc-card-prov")) {
        const cs = getComputedStyle(el);
        const clamp = cs.webkitLineClamp || cs.lineClamp;
        if (el.classList.contains("dc-card-prov")) {
          // one line, no wrap: the ellipsis here is `text-overflow`, so the clamp rule does not apply to it
          if (cs.textOverflow !== "ellipsis" || cs.whiteSpace !== "nowrap") out.unclamped.push([id, "prov", cs.textOverflow]);
          if (el.scrollWidth - el.clientWidth > 1) {
            if (cs.textOverflow !== "ellipsis") out.sliced.push([id, "prov", cs.textOverflow]);
            else out.ellipsised.push(id);
          }
          continue;
        }
        if (!clamp || clamp === "none") out.unclamped.push([id, "clamp", clamp]);
        const clone = el.cloneNode(true);
        clone.style.cssText = `width:${el.getBoundingClientRect().width}px;font-size:${cs.fontSize};line-height:${cs.lineHeight};display:block;height:auto;-webkit-line-clamp:none;overflow:visible`;
        probe.appendChild(clone);
        const lines = Math.round(clone.getBoundingClientRect().height / parseFloat(cs.lineHeight));
        probe.removeChild(clone);
        const allowed = Number(clamp) || 0;
        if (lines > allowed) {
          if (allowed > 0) out.truncated.push(id);
          else out.sliced.push([id, "line", clamp]);
        }
      }
      probe.remove();
    }
    return out;
  });

  const spreadVals = Object.keys(r.heights).map(Number);
  const spread = Math.round((Math.max(...spreadVals) - Math.min(...spreadVals)) * 10) / 10;
  ok(r.n === 486, `${vp.n}: 486 cards in the default grid — ${r.n}`);
  ok(spread === 0, `${vp.n}: card heights are one number — ${JSON.stringify(r.heights)} spread ${spread}`);
  ok(r.stats.length === 0, `${vp.n}: no card prints a file/pattern/part count — ${r.stats.length} did ${JSON.stringify(r.stats.slice(0, 3))}`);
  ok(r.sliced.length === 0, `${vp.n}: nothing overflows without an ellipsis — ${r.sliced.length} sliced ${JSON.stringify(r.sliced.slice(0, 3))}`);
  ok(r.unclamped.length === 0, `${vp.n}: every text slot is clamped or ellipsised — ${r.unclamped.length} without ${JSON.stringify(r.unclamped.slice(0, 3))}`);
  console.log(`     ${vp.n}: ${r.truncated.length} slot(s) actually cut, ${r.ellipsised.length} provenance line(s) ellipsised`);

  // 1: the printed sentence is the manifest's sentence, or the slot is empty
  const wrong = [];
  for (const [id, text] of r.lines) {
    const want = byId.get(id)?.one_line ?? "";
    const got = text.replace(/\s+/g, " ").trim();
    // the rendered text of a clamped box is still the full string; a copy-paste of the whole text is what we want
    if (want ? got !== want.trim() : got !== "") wrong.push([id, got.slice(0, 60), (want ?? "").slice(0, 60)]);
  }
  ok(wrong.length === 0, `${vp.n}: every card prints its own one_line, verbatim (or nothing) — ${wrong.length} wrong ${JSON.stringify(wrong.slice(0, 3))}`);
  console.log(`     ${vp.n}: ${r.pairs} of ${r.n} cards print a description; ${r.truncated.length} of them need more room than three lines and end in a …`);

  await ctx.close();
}

/* ── 4: the no-demo cards, in the reference-only view where they are drawn ───────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  settle(page);
  await page.goto(`${BASE}#/g?ref=1`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const out = { n: 0, missing: [], wrongReason: [], bySentence: {}, reasons: {} };
    for (const el of document.querySelectorAll("[data-no-demo]")) {
      const id = el.getAttribute("data-no-demo");
      out.n++;
      const reason = el.getAttribute("data-no-demo-reason");
      out.reasons[reason] = (out.reasons[reason] ?? 0) + 1;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      // the sentence, minus the outbound line that shares the box ("Read it on beui.dev ↗")
      const sentence = text.split("Read it on")[0].trim();
      out.bySentence[sentence] = (out.bySentence[sentence] ?? 0) + 1;
      out.sample ??= [];
      if (out.sample.length < 3) out.sample.push([id, reason, sentence]);
      (out.pairs ??= []).push([id, reason, sentence]);
    }
    return out;
  });
  ok(r.n === noDemo.length, `no-demo cards: ${noDemo.length} items with has_demo:false say so on their card — ${r.n}`);
  const withheldIds = new Set(noDemo.filter((i) => i.withheld).map((i) => i.id));
  const wrong = (r.pairs ?? []).filter(([id, reason]) => (withheldIds.has(id) ? reason !== "withheld" : reason !== "absent"));
  ok(wrong.length === 0, `no-demo cards: the reason printed is the reason in the data (93 withheld, 190 helper/doc) — ${wrong.length} wrong`);
  const licenceSentence = "No demo for this one — the licence does not allow us to republish the code.";
  const absentSentence = "No demo for this one — it is a helper or a doc, not a component.";
  ok(r.bySentence[licenceSentence] === withheldIds.size, `no-demo cards: withheld items print the licence sentence — ${r.bySentence[licenceSentence] ?? 0} of ${withheldIds.size}`);
  ok(r.bySentence[absentSentence] === noDemo.length - withheldIds.size, `no-demo cards: the rest print the helper/doc sentence — ${r.bySentence[absentSentence] ?? 0} of ${noDemo.length - withheldIds.size}`);
  const shouty = Object.keys(r.bySentence).filter((s) => /^(no demo|NO DEMO)$/.test(s) || /^reference-only/i.test(s));
  ok(shouty.length === 0, `no-demo cards: the sentence is the page's voice, not the mono label "no demo" — ${shouty.length} shouted`);
  console.log(`     reasons ${JSON.stringify(r.reasons)} · sample ${JSON.stringify(r.sample)}`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\nCARD: FAIL — ${fails.length} check(s)` : "\nCARD: ok");
process.exit(fails.length ? 1 : 0);
