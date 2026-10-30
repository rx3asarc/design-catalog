/**
 * The measured line on an item page: printed only where the probe has facts, and never a verdict.
 *
 * `23d8b824` (r7) put `pickLine()` on the item page — the one place a visitor decides. The rule it wrote is
 * narrow and easy to widen by accident, so it is gated here:
 *
 *   1. **measured ⇒ one line.** An item with a behaviour record prints exactly one `[data-pick]`, and it is one
 *      sentence that ends in a full stop and says where the measurement came from ("measured in this demo").
 *   2. **unmeasured ⇒ no line.** An item the probe never reached prints nothing: not a dash, not "not measured",
 *      not an empty box in the place a recommendation would go (`behaviour.ts`, header rules 1 and 4).
 *   3. **no verdict.** The sentence names no rank, winner, score or "best". A fact about behaviour is not an
 *      opinion about quality, and the manifest publishes 0 picks and 0 verdicts to rank by (`behaviour.ts`,
 *      rule 3). This is the assertion that stops the line quietly becoming editorial.
 *   4. **it did not steal the page's first Copy, and it did not push the install block away.** The install
 *      command is the page's one accent-filled primary and its Copy must still be the first Copy control *after
 *      the preview* (the intent recorded in `site/InstallBlock.tsx`); the measured line prints *after* it, and
 *      the block it prints after is still a box on the page rather than something covered or clipped.
 *
 *      r8 changed what "first" means, and this gate says so out loud rather than being relaxed: the item page
 *      now runs title → **preview** → install → the rest, so the demo card's "Copy demo source" comes first in
 *      document order and the install command's Copy is the first one after `.stage`. That is the order the r8
 *      review asked for, and the property that still matters is the one this assertion keeps: nothing between the
 *      preview and the install command takes that Copy's place, and the measured line never becomes a Copy.
 *
 * The sample is 13 ids: ten measured (the two the r7 brief names plus eight more) and three unmeasured. The
 * three measured ids that render *no* demo (`beautifului/sidebar-nav`, `rareui/hook-sidebar`,
 * `shadcn/docs-components-sidebar`) are checked for the complementary rule instead: the line lives inside the
 * demo branch in `site/ItemPage.tsx`, so a measured item with no demo prints nothing. That carve-out is
 * deliberate and measured, not an exemption — it is printed on its own `ok` line with its own number, so the
 * day the line moves outside that branch this gate says so.
 *
 * Usage: node qa/pick_line_check.mjs [base]      (default http://localhost:8830/design-catalog/)
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";

/** Ten measured ids: the two the brief names, plus eight more that carry a `behaviour` record and a demo. */
const MEASURED = [
  "shadcn/sidebar-09",
  "beui/animated-sidebar",
  "beui/ai-sidebar",
  "beui/bounce-sidebar",
  "shadcn/sidebar",
  "shadcn/sidebar-01",
  "shadcn/sidebar-04",
  "shadcn/sidebar-05",
  "shadcn/sidebar-13",
  "shadcn/sidebar-16",
];
/** Measured, but their page renders no demo — the slot they would print in is inside the demo branch. */
const MEASURED_NO_DEMO = ["beautifului/sidebar-nav", "rareui/hook-sidebar", "shadcn/docs-components-sidebar"];
/**
 * The probe never reached these: no behaviour record, so nothing may be printed in its place. Each one has demos
 * and an install command, so the page renders the very branch the line would print in — the assertion has teeth.
 *
 * The r7 brief named `beui/loading-state` as the second of these; that id does not exist (it resolves to the
 * not-found page), so nothing could be asserted about it here. `beui/loading-states` and
 * `beautifului/loading-state` are the ids it is nearest to, and both are measured-never (no `behaviour` record)
 * but have no demo either — a page with no demo cannot print a line at all, so it cannot test this rule. The
 * sample below is three unmeasured items that *do* reach the demo branch. (Reported in build/r7-gates.md.)
 */
const UNMEASURED = ["shadcn/button", "shadcn/accordion", "beui/bloom-menu"];

/** A verdict, in the words a verdict uses. The line is a measurement; an order of merit is forbidden here. */
const VERDICT = /\b(rank|ranks|ranked|ranking|winner|winners|winning|score|scores|scored|best|better|worst|recommend|recommends|recommended|top pick|number one)\b/i;

let fails = 0;
const bad = (name, detail) => { fails++; console.log(`FAIL ${name} — ${detail}`); };
const ok = (name, detail) => console.log(`ok   ${name} — ${detail}`);

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** Everything one item page can be asked about the measured line, in one round trip. */
async function readPage(p, id) {
  await p.goto(`${BASE}#/i/${id}`, { waitUntil: "load" });
  await p.waitForTimeout(120);
  return p.evaluate((verdictSrc) => {
    const VERDICT = new RegExp(verdictSrc, "i");
    const picks = [...document.querySelectorAll("[data-pick]")];
    const pick = picks[0] ?? null;
    const text = pick ? pick.textContent.replace(/\s+/g, " ").trim() : null;
    const install = document.querySelector(".install-block");
    const box = (e) => (e ? e.getBoundingClientRect() : null);
    // every control that would copy something, in document order: the page's first Copy is the install command
    const copies = [...document.querySelectorAll("button, a[href], [role='button']")]
      .filter((e) => /copy/i.test((e.getAttribute("aria-label") || "") + " " + (e.textContent || "")))
      .filter((e) => e.getClientRects().length);
    // the first Copy control that is not part of the preview: since r8 the install command follows the stage, so
    // "the install Copy is not pre-empted" is a statement about the controls after the canvas, not before it
    const afterStage = copies.filter((e) => !e.closest(".stage"));
    const ir = box(install), pr = box(pick);
    // the page scrolls inside its own column, not the document: measure "off the page" against that container
    const scroller = (() => {
      for (let e = install?.parentElement; e && e !== document.body; e = e.parentElement) {
        const st = getComputedStyle(e);
        if (/auto|scroll/.test(st.overflowY) && e.scrollHeight > e.clientHeight) return e;
      }
      return document.documentElement;
    })();
    const sr = scroller.getBoundingClientRect();
    /*
     * The hit test happens at the block's own centre, so the block has to be on screen first. Since r8 the install
     * command follows the preview, which on a tall item puts it below the fold: the old test clamped the sample
     * point to `innerHeight - 1`, which is where the *next* card is, and reported "covered" for a block nothing
     * was covering. Scrolling it into view first measures what the assertion is about — is a sticky strip lying
     * over the command — rather than where the column happens to be scrolled to. Measured after the scroll, so
     * every number above it is the un-scrolled reading.
     */
    const scrollTopBefore = scroller.scrollTop;
    install?.scrollIntoView({ block: "center", behavior: "instant" });
    const ir2 = install ? install.getBoundingClientRect() : null;
    const covered = (() => {
      if (!install || !ir2 || !ir2.width || !ir2.height) return null;
      const el = document.elementFromPoint(ir2.left + ir2.width / 2, ir2.top + ir2.height / 2);
      return install.contains(el) || el === install;
    })();
    return {
      pickCount: picks.length,
      text,
      periods: text ? (text.match(/\./g) ?? []).length : null,
      endsWithStop: text ? text.endsWith(".") : false,
      saysMeasured: text ? text.includes("measured in this demo") : false,
      verdictWord: text ? (text.match(VERDICT) ?? [null])[0] : null,
      // DOM order: is the pick line after the first Copy control following the preview?
      afterFirstCopy: !!(pick && afterStage.length && (afterStage[0].compareDocumentPosition(pick) & Node.DOCUMENT_POSITION_FOLLOWING)),
      firstCopyLabel: afterStage.length ? (afterStage[0].getAttribute("aria-label") || afterStage[0].textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) : null,
      copyCount: copies.length,
      copiesInPreview: copies.length - afterStage.length,
      pickIsCopy: !!(pick && /copy/i.test((pick.getAttribute("aria-label") || "") + " " + (pick.textContent || ""))),
      // the install block: present, a real box, above the line, inside the document, not covered
      installPresent: !!install,
      installTop: ir ? Math.round(ir.top + scrollY) : null,
      installBottom: ir ? Math.round(ir.bottom + scrollY) : null,
      installHeight: ir ? Math.round(ir.height) : null,
      pickTop: pr ? Math.round(pr.top + scrollY) : null,
      // bottom edge of the install block inside the scrolling column it lives in
      installBottomInColumn: ir ? Math.round(ir.bottom - sr.top + scrollTopBefore) : null,
      columnScrollHeight: Math.round(scroller.scrollHeight),
      column: scroller.tagName.toLowerCase() + (scroller.className ? "." + String(scroller.className).split(" ")[0] : ""),
      covered,
    };
  }, VERDICT.source);
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = settle(await ctx.newPage());

/* ── 1–4: a measured item prints one sentence, and it costs the page nothing ─────────────────────────────── */
for (const id of MEASURED) {
  const m = await readPage(page, id);
  const tag = `measured ${id}`;

  if (m.pickCount === 1) ok(`${tag}: one [data-pick]`, `${m.pickCount} element`);
  else bad(`${tag}: one [data-pick]`, `${m.pickCount} elements`);

  if (m.text && m.periods === 1 && m.endsWithStop) ok(`${tag}: one sentence`, `1 full stop, ends with it`);
  else bad(`${tag}: one sentence`, `${m.periods} full stops, endsWithStop=${m.endsWithStop}, text=${JSON.stringify((m.text ?? "").slice(0, 90))}`);

  if (m.saysMeasured) ok(`${tag}: says where it came from`, `"measured in this demo" present`);
  else bad(`${tag}: says where it came from`, `"measured in this demo" absent`);

  if (m.verdictWord === null) ok(`${tag}: no rank/winner/score/best`, `0 verdict words`);
  else bad(`${tag}: no rank/winner/score/best`, `found "${m.verdictWord}"`);

  if (m.firstCopyLabel && /copy install command/i.test(m.firstCopyLabel) && m.afterFirstCopy && !m.pickIsCopy) {
    ok(`${tag}: not the first Copy`, `first Copy after the preview = "${m.firstCopyLabel}", ${m.copyCount} copy controls (${m.copiesInPreview} in the preview), line after it`);
  } else {
    bad(`${tag}: not the first Copy`, `first Copy after the preview = ${JSON.stringify(m.firstCopyLabel)}, line after it = ${m.afterFirstCopy}, pick line is a copy = ${m.pickIsCopy}`);
  }

  const installFine = m.installPresent && m.installHeight > 0 && m.installTop < m.pickTop &&
    m.installBottomInColumn <= m.columnScrollHeight && m.covered === true;
  if (installFine) {
    ok(`${tag}: install block still on the page`,
      `block ${m.installHeight} px at y=${m.installTop} (bottom ${m.installBottomInColumn} of ${m.columnScrollHeight} in ${m.column}), line at y=${m.pickTop}`);
  } else {
    bad(`${tag}: install block still on the page`,
      `present=${m.installPresent} h=${m.installHeight} blockTop=${m.installTop} lineTop=${m.pickTop} blockBottomInColumn=${m.installBottomInColumn} column=${m.columnScrollHeight} uncovered=${m.covered}`);
  }
}

/* ── 2: an unmeasured item prints nothing at all ─────────────────────────────────────────────────────────── */
for (const id of UNMEASURED) {
  const m = await readPage(page, id);
  if (m.pickCount === 0) ok(`unmeasured ${id}: no [data-pick]`, `0 elements`);
  else bad(`unmeasured ${id}: no [data-pick]`, `${m.pickCount} elements, text=${JSON.stringify((m.text ?? "").slice(0, 90))}`);
}

/* ── the carve-out, measured rather than assumed: the slot lives inside the demo branch ──────────────────── */
for (const id of MEASURED_NO_DEMO) {
  const m = await readPage(page, id);
  if (m.pickCount === 0) ok(`measured-no-demo ${id}: no demo, no line`, `0 elements (the slot is inside the demo branch)`);
  else bad(`measured-no-demo ${id}: no demo, no line`, `${m.pickCount} elements`);
}

/* ── the same sentence on a phone: present, and it does not scroll the page sideways ─────────────────────── */
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = settle(await phone.newPage());
  await p.goto(`${BASE}#/i/shadcn/sidebar-09`, { waitUntil: "load" });
  await p.waitForTimeout(150);
  const m = await p.evaluate(() => {
    const pick = document.querySelector("[data-pick]");
    const r = pick?.getBoundingClientRect();
    return {
      n: document.querySelectorAll("[data-pick]").length,
      right: r ? Math.round(r.right) : null,
      width: r ? Math.round(r.width) : null,
      docWidth: Math.round(document.documentElement.clientWidth),
      scrollWidth: Math.round(document.documentElement.scrollWidth),
    };
  });
  if (m.n === 1 && m.right <= m.docWidth && m.scrollWidth <= m.docWidth) {
    ok("390 measured shadcn/sidebar-09: line fits the column", `${m.n} element, ${m.width} px wide, right edge ${m.right} ≤ ${m.docWidth}, page scrollWidth ${m.scrollWidth}`);
  } else {
    bad("390 measured shadcn/sidebar-09: line fits the column", `n=${m.n} right=${m.right} docWidth=${m.docWidth} scrollWidth=${m.scrollWidth}`);
  }
  await phone.close();
}

await browser.close();
console.log(fails ? `PICK: ${fails} FAIL` : `PICK: ok (${MEASURED.length} measured, ${UNMEASURED.length} unmeasured, ${MEASURED_NO_DEMO.length} measured-no-demo)`);
process.exit(fails ? 1 : 0);
