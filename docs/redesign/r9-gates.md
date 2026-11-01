# Round 9 — the gates that encoded the behaviour the round-5 review asked to change

Round 5 asked for a set of changes; the round-8 gates assert the **opposite** of several of them, so they fail on the
merged build not because the site regressed but because the rule they encoded was retired. This unit restates each
of those assertions as a property that holds **now** — never deleted, never weakened to `ok(true)` — and reports the
places where the site, not the gate, is still wrong.

`qa/**` only. `app/src/**`, `styles.css`, the build, `master` and `qa/stage_check.mjs` (the lead's) were not touched.

```
node qa/r2_check.mjs        [base]     the review's items, end to end          was 7 failed → now ok
node qa/slice3_check.mjs    [base]     type/theme/palette/about/chrome          was 1 failed → now ok
node qa/mobile_state_check  [base]     phone type, tap floor, stage widths     was 1 failed → now ok
node qa/rail_density_check  [base]     the rail as an index of types           was 1 failed → now ok
node qa/type_page_check.mjs [base]     the type pages, grid first              was 2 failed → now ok
node qa/demo_theme_check.mjs[base]     the paper a demo is printed on          was 8 failed → now ok
node qa/foundations_check   [base]     Fonts as specimens, Themes as palettes   was 5 failed → now ok
```

## What was measured, on what

| | |
| --- | --- |
| build under test | the lead's merged tree served at `http://127.0.0.1:8830/design-catalog/`, entry `assets/main-DWq5yYYw.js` (the same server the lead keeps current — no rebuild was run by this unit) |
| base commit | `4d0f91fe` (merge r9-search) + the lead's live edits to `app/src` during the run, see "moved under me" below |
| branch | `fleet/r9-gates` (this unit's commits only touch `qa/`) |
| browser | Playwright `/root/camofox-browser/node_modules/playwright`, `/usr/local/bin/google-chrome --no-sandbox --disable-dev-shm-usage`, one context at a time |
| mirror | the ten changed gates are also in `/root/docs/catalog-redesign/qa/` |

Every gate now derives its own tree from `import.meta.url` (`new URL("..", import.meta.url)`). Three of the gates in
this file's failing set were still reading a **hardcoded worktree** — `foundations_check` and `card_check` read
`…-r8-cards/app/manifest.json` (a reaped worktree: `foundations_check` died in `readFileSync` before printing a single
assertion), `r2_check` read `/root/design-catalog-site/app/manifest.json` (a *different* build than the server serves),
`r2_compare_measure` read `…-r2-compare-page/`, `assets_check` defaulted to `/root/design-catalog-site/docs`. All five
now resolve from their own file; nothing regressed.

---

## 1. `qa/r2_check.mjs` — four assertions

### 1a. the hero marker counted the manifest

- **as it was** — `hero marker counts the manifest`, matching `/(\d+) of (\d+) items whose name or slug says/` and
  comparing the total to `MANIFEST.filter(/sidebar/)`. Output: `printed nothing, manifest 25`.
- **why it can no longer be true** — r5 §Home, last bullet: *"Confusing counter: 'Show all 8 rows' next to '21 more of
  25 matched'"*. The marker was deleted; there is nothing left to match that sentence.
- **replaced by** (four assertions): the front page states the catalogue's totals **once, in visitor words**, and every
  number it prints for them is the manifest's own —
  `the hero states the catalogue's total in a sentence` (the lede's `N components, blocks, charts…` = `manifest.length`),
  `…and its rendered count is the manifest's own` (`N of them run here` = items with `has_demo`),
  `the count line in the shell agrees with the lede` (`N items · M types · K rendered` = manifest items, taxonomy types,
  `has_demo` items), `every place the front page prints a total prints the same number` (the search control's
  `Search N items` and the browse control's `All N items`), and `no two counters contradict each other` (neither
  `Show all N rows` nor `N of M matched` may come back — asserted as a shape, not a sentence).
- **measured now** — `lede says 769, manifest 769`; `lede says 486 run here, manifest 486 with has_demo`;
  `769 items · 76 types · 486 rendered — manifest 769 · 76 · 486`; `search control 769, browse control 769`;
  `one total, stated in words`. All computed from `app/manifest.json` + `app/src/site/taxonomy.json` in the same tree
  — the "76 types" is `Object.keys(sections[*]).length`, not a typed number.

### 1b. the phone menu "owned its scroll"

- **as it was** — `the phone menu owns its scroll (390/768/600)`: found *any* element inside the page whose
  `overflow-y` was auto/scroll and whose `scrollHeight > clientHeight + 20`. Output: `the list does not scroll itself`.
- **why it can no longer be true** — r9-scroll moved the scroller from `<main>` to the window (r5 §Scrollbars: *"let the
  window scroll the page"*). A menu that does **not** own a scroll is now correct, and the panel's content fits.
- **replaced by** (two assertions per width): `the phone menu is a full-height sheet` — the sheet is `position: fixed`,
  reaches the viewport's bottom edge (`|bottom − innerHeight| ≤ 1`) and is at least `innerHeight − top` tall — and
  `every row in the phone menu can be reached` — one section is opened, then every `.rail-sec`/`.rail-item` with a box
  is `scrollIntoView`ed and must land inside the viewport. **Reachability, not ownership.** (A section row wraps its
  open children, so the box measured for a section is its disclosure *trigger* — the thing a thumb hits.)
- **measured now** — 390: `panel top 65, 779 px tall, bottom 844 of 844`, `52/52 rows brought into view (45 type rows)`;
  768: `bottom 1024 of 1024`, `52/52`; 600: `bottom 900 of 900`, `52/52`.

### 1c. the hero band "scrolls sideways"

- **as it was** — `hero: the band is one screen tall and scrolls sideways (390/375)`, requiring
  `band.height ≤ 300 && band.scrollWidth > band.clientWidth`. Output: `band 415px, scrollW 358 == clientW 358`.
- **why it can no longer be true** — r5 §Phones Home: *"Featured tiles are a sideways scroller of 293 × 134 px strips,
  so each demo is a thin crop → two per row, taller (about 4:3)"*. The band **is** the grid now; demanding sideways
  overflow would demand the bug back.
- **replaced by** (three assertions per phone width): `the band is a grid, not a sideways scroller` — six tiles and
  `scrollWidth ≤ clientWidth + 1`; `every tile's canvas is about 4:3, not a strip` — each tile's canvas
  `0.7 ≤ h/w ≤ 1.1`; `every caption is inside the band and the viewport` — each caption bar sits within the band's own
  box, is at least 60 % of its tile's width (not clipped away), and its tile is inside the viewport horizontally, i.e.
  readable with no sideways scroll.
- **measured now** — 390: `scrollW 358 of clientW 358`, `canvas h/w 0.76 ×6`, `6/6 captions reachable`;
  375: `scrollW 343 of clientW 343`, `0.76 ×6`, `6/6`. (The 1440 branch — all six whole on the first screen — is
  unchanged and passes.)

### 1d. "the gallery links to the comparisons"

- **as it was** — `the gallery links to the comparisons`: `[data-compare-links] a` ≥ 1 on `#/g`. Output: `0 links`.
- **why it can no longer be true** — r5 §Type pages 1 (*"Delete `#/c/` and redirect it to `#/t/`"*) and §Phones Gallery
  (*"remove the strip"*). The strip is gone.
- **replaced by** (four assertions): `the gallery offers the type pages, and every one exists in the taxonomy`
  (≥ 20 `#/t/` links, every href a real `Section/Type` route); `the old comparison strip is gone, and no page offers
  `#/c/` any more` (0 strip containers, 0 `#/c/` links); `every concept the manifest carries redirects into the type
  pages` — for **every** key in `manifest[*].concepts` the hash is set to `#/c/<key>` and must come back as
  `#/t/<section>/<type>`; and `each one lands on the type page that names that type` — the rendered
  `[data-type-title]` equals the taxonomy's own name for that route.
- **measured now** — `47 type links, 0 unknown`; `0 strip links, 0 #/c/ links`; `29 concept keys → 25 type routes`;
  `29 landings, every title is the taxonomy's own name`.

## 2. `qa/slice3_check.mjs` — the palette landed on a type page (1)

- **as it was** — `palette`: `open && results.length > 0 && route.startsWith("#/i/")`. Output:
  `open=true focus=INPUT:combobox first="SidebarComponents7 items · 16 " -> #/t/components/sidebar` — FAIL.
- **why it can no longer be true** — r5 §Search: *"type pages never appear"*. Round 9 fixed exactly that, so the first
  result for a type's own name is that type page and Enter opens `#/t/…`.
- **replaced by** (three assertions): `palette` — Enter lands on a destination that **exists**: an item in
  `app/manifest.json` **or** a type in `app/src/site/taxonomy.json`; `palette: a type is a result, and Enter lands on
  it` — the "sidebar" query resolves to a `#/t/` route whose taxonomy name matches the query; and, per the lead,
  `palette: a query that names no type leads with an item` — "sankey" must land on `#/i/…`. The two together stop both
  ways of gaming it: a palette of only types fails, a palette of only items fails.
- **measured now** — `"sidebar" → #/t/components/sidebar — the taxonomy's "Sidebar" page`;
  `"sankey" → #/i/beui/sankey-chart (an item in the manifest)`.

## 3. `qa/mobile_state_check.mjs` — the 44 px tap floor (1)

- **as it was** — `#13 #/: no target under 44px`: every `a, button, [role=button], summary, checkbox, radio` had to be
  ≥ 44 px in **both** dimensions. Output: `42×44 sidebar`.
- **what the failing element is** — `<a href="#/i/shadcn/sidebar">sidebar</a>`, a row-header text link in the home
  page's comparison-preview table. Its height is the design system's 44 px; its **width is the width of its own word**,
  and the padding around it belongs to the table cell, not the link. No link can be 44 px wide for a 6-letter word
  without breaking the table.
- **replaced by** — one assertion, three conditions, all printed: no target under 44 px **tall**; no target under 44 px
  **wide** unless it is an inline text link with no element children (i.e. its box is its own word); and such a link
  must still clear **24 px** — the WCAG 2.5.8 AA floor for an inline target. The residue is named in the output, not
  hidden: this is the convention `catalog-shell-dogfood.md:226` ("4 remain, all inline prose links") and
  `catalog-item-stage.md:149` ("narrowest 41×44") already established.
- **measured now** — `#/`: `1 inline text link(s) narrower than 44 px (word-width, ≥24, ≥44 tall): 42×44 sidebar
  #/i/shadcn/sidebar`; `#/g`, `#/i/shadcn/sidebar-09`, `#/c/sidebar` (→ `#/t/components/sidebar`), `#/about`,
  `#/chrome`: `no target under 44px` with nothing to report.

## 4. `qa/rail_density_check.mjs` — the section rows' counts (1)

- **as it was** — `390 menu open: every section row prints its count as text`: `.rail-count` had to match `/^\d+$/`.
  Output: `0/7 — ["245 items · 124 variants","37 items",…]`.
- **why it can no longer be true** — r5 §Fonts/gallery: *"Folded variants vanish from the counts … Show '1 item · 11
  variants'"*. The count is a phrase now.
- **replaced by** (two assertions): the phrase's **grammar** — `^(\d+) items?(?: · (\d+) variants?)?$` on every section
  row — and its **arithmetic** — the item count equals the taxonomy's own distinct members for that section and the
  variant count equals the number of folded variants the taxonomy files under them (`taxonomy.variants`), i.e. the same
  numbers `site/taxonomy.ts#variantCount` sums. Both are computed from the gate's own tree.
- **measured now** — `245 items · 124 variants · 37 items · 16 items · 76 variants · 37 items · 47 items · 48 items ·
  26 variants · 113 items`, and `Components 245·124 Blocks 37 Charts 16·76 Agent UI 37 Effects 47 Foundations 48·26
  Docs 113` — matching the taxonomy exactly.

## 5. `qa/type_page_check.mjs` — the gallery's compare strip (2)

- **as they were** — `the unfiltered gallery still offers every comparable set` (`[data-compare-links] a` ≥ 20) and
  `a narrow filter offers only sets that are in it` (strip ⊆ filtered grid). Both measured `0 links`.
- **why they can no longer be true** — the strip was deleted (r5 §Type pages 1, §Phones Gallery) and `#/c/` redirects
  into `#/t/`.
- **replaced by** (six assertions, all data-driven): `the gallery offers the type pages, and every one is a type the
  taxonomy has`; `the old compare strip is gone and nothing links to a #/c/ page`;
  `a section filter still mounts a grid to check against` (kept — it is the context, not the claim);
  `every concept in a filtered grid redirects into a type page` (the concepts the filtered grid's own members carry);
  `every concept key in the manifest redirects into a #/t/ page` (all 29); `and each redirect lands on the page that
  names that type`; plus reachability — `every type the gallery offers has a row in the rail` (all 76 taxonomy types
  appear after the seven sections are opened) and `and every one of them renders the type page it names` (each of the
  47 offered routes is opened and must print its own title).
- **measured now** — `47 type links, all #/t/<section>/<type> — 502 items in the grid`; `0 strip container(s), 0 #/c/
  link(s)`; `25 concept(s) → 21 type route(s)` in a filtered grid; `29 keys → 25 type routes`, `29 landings, every title
  the taxonomy's own`; `76/76 types in the rail, 0 offered by the gallery without a row`; `47 gallery types opened, 47
  named themselves`.

## 6. `qa/demo_theme_check.mjs` — the frame is transparent on purpose (8)

- **as they were** — eight `B <theme>: <id> paints an opaque <theme> paper` assertions, each requiring the child
  document's `html`/`body` to composite to an **opaque** colour. Output: `html rgba(0,0,0,0), body rgba(0,0,0,0)`,
  luminance −1.000, for all four demos in both themes.
- **why they can no longer be true** — r5 §Item page 1: *"**Fix:** transparent frame so the canvas shows through"*. The
  frames are transparent by design now; the old assertion asked for the bug back.
- **replaced by** (three per demo per theme, 24 assertions, plus a new section E): `B` the child's root is **transparent
  or the theme's own paper** — never a third colour — and, **composited over the canvas it sits on** (the theme's
  `var(--background)`, read off the running document, not typed), the paper a visitor sees is the theme's ink; `B` the
  child's `color-scheme` is the theme's (a transparent frame with the wrong scheme hands the UA's scrollbars and form
  controls the other theme); and the new **E** section, which is r5 item 1's actual complaint: the **canvas, the frame
  element and the frame's surface are one paint** (`|Δ| < 0.002`), the child resolves to that same canvas, the stage's
  theme decides the paper and the scheme, and — the part the review cared about — **a pinned stage leaves the page's
  paper** (`|canvas − page| > 0.4` when the stage disagrees with the site).
- **measured now** — 8 × `html rgba(0, 0, 0, 0), body rgba(0, 0, 0, 0) (transparent = the canvas shows through);
  composited over the canvas oklch(1 0 0)/oklch(0.141 0.005 285.823) the paper is 1.000 / 0.003`; 8 ×
  `color-scheme light|dark on a transparent frame`; E: `canvas, screen and frame oklch(0.141 0.005 285.823) → 0.003` in
  every combination, `child color-scheme dark, frame color-scheme dark`, and the mixed cases
  `site light, stage pinned dark: canvas 0.003 vs page rgb(255,255,255) (1.000), Δ 0.997` /
  `site dark, stage pinned light: Δ 0.997`. Sections C (the `<iframe>` box) and D (68 samples across the dark gallery)
  are unchanged and pass.

## 7. `qa/foundations_check.mjs` — 26 specimens and a re-cut Themes type (5)

Fonts, `as it was` → `replaced by`:

- `fonts: one row per member of the type — 26 rows for 52 items` → **`one row per member of the type`** against the
  taxonomy's current membership (26), **plus** `and every font item in the catalogue is accounted for` — 26 members +
  26 folded heading cuts = the 52 `shadcn/font-*` items, so the merge is proved rather than assumed.
  *measured:* `26 rows for 26 members`; `26 members + 26 folded heading cuts = 52 of 52`.
- `fonts: the self-hosted families and their heading cuts are drawn in their own face — 2 rows, 2 families` →
  **`fonts: no two rows share a typeface`** (26 rows, 26 distinct first families — the review's *"DM Sans and EB
  Garamond look identical"*), **`fonts: the faces are really loaded, not declared`** (`document.fonts.check` on each
  row's own size and family, ≥ 20 required by the brief, all 26 measured), **`fonts: every row says where its face comes
  from`** (`data-specimen-face` must be `hosted` with "self-hosted" in its own meta line, or `google` with "Google
  Fonts"), and **`fonts: every row is a specimen`** (`≥ 36 px` — all four sizes are 40 px).
  *measured:* `26 distinct first families of 26`; `26 of 26 rows pass document.fonts.check`; `2 self-hosted
  (Instrument Sans, JetBrains Mono), the rest Google Fonts`; `[40] px`.
- `fonts: the page still states its own count — "26 items · 26 variants · 1 library"` → **`fonts: the page prints the
  taxonomy's own counts`**, comparing the whole line against one computed from the taxonomy (members, folded variants,
  distinct sources) — `"26 items · 26 variants · 1 library", want "26 items · 26 variants · 1 library"`.
- `fonts: a row is a specimen and one mono line, not a paragraph` and the "no absent row is drawn in a face it does not
  have" pair were assertions about the **unmerged** page (50 rows with no binary, drawn in the interface face); they are
  subsumed by "no two rows share a typeface" + "the faces are really loaded" + "every row says where its face comes
  from", which fail if a row is ever drawn in a face the build does not have.

Themes, `as it was` → `replaced by`:

- `themes: the two members that are components, not palettes, are still on the page — []` → **`themes: every member of
  the type is on the page`** and **`and no member is listed twice`**, both read from the taxonomy and **counted by
  ELEMENT**, not by attribute: one `<section>` carries `data-also-row` *and* `data-theme-swatch` for the same palette
  (`site/specimens.tsx`), which is what made an attribute count look like a duplicate listing. Also
  **`each swatch is a member of this type`** and **`the members that are components, not palettes, are drawn as
  cards`** (the non-palette members are derived from the taxonomy, never named in the gate — the brief's *"stop assuming
  ids"*; the old gate hardcoded `beui/theme-toggle` + `rareui/theme-selector`).
  *measured:* `every member of the type is on the page — 7 of 7`; `no member is listed twice — 7 members, 7 elements
  (5 swatches + 2 cards)`; `["rareui/theme-selector","beui/theme-toggle"] (the type's non-palette members:
  ["beui/theme-toggle","rareui/theme-selector"])`.
- `themes: their demos still run — 0 demo window(s)` → **`themes: their demos still run`**, restated per member: every
  member whose manifest record says `has_demo` must mount a frame once the page is scrolled to it, and a member with no
  demo must **say "no demo" in words** rather than show an empty box. The page has to be scrolled first (`beui/theme-
  toggle` is below the palettes; at the top of the page it is parked).
  *measured:* `1/1 demoed member(s) mounted a frame (beui/theme-toggle), and the member with no demo says "no demo"
  (rareui/theme-selector: says so)`.

Also unchanged and passing: 5 palettes × light/dark panels, 32/31 chips per panel, every chip painting the value it
claims, five distinct palettes, a non-uniform `--border` scale, each palette naming its theme file, and the 390 rules
(no overflow, nothing under 12 px, nothing under 44 px).

---

## Still a real defect in the site, not a stale gate

1. **`#/t/foundations/fonts` prints `the 0 heading cuts`.** The lede reads *"26 typefaces from 26 items — the **0**
   heading cuts are the same typefaces and are named on their family's row rather than drawn twice"*.
   `app/src/site/specimens.tsx:120` computes it as `items.length - families.length`; the cuts are folded **variants**
   now (`taxonomy.variants`, 26 of them), not members, so the difference is 0 while the page folds 26. It should read
   26. The gate prints the measurement (`lede says "26 typefaces from 26 items", "the 0 heading cuts" — this build folds
   26 cuts`) but does not fail on it, because the copy is the lead's to fix; the two numbers the lede *does* assert
   (`26 typefaces from 26 items`) are checked and correct.
2. **The demo canvas and the page are the same ink in a matching theme** — the one half of brief item 5 that does not
   hold as merged. Measured on `#/i/beui/bloom-menu`: canvas `oklch(0.141 0.005 285.823)`, page `rgb(9, 9, 11)`,
   Δ luminance **0.000** (light: `oklch(1 0 0)` vs `rgb(255,255,255)`, Δ 0.000). The demo is separated from the page
   only by the canvas' hairline rule and the stage header's `surface-300` band. That is a *decision*, not drift —
   `site/Stage.tsx` says the canvas paints the demo's own paper on purpose, which removes the review's "black slab" (two
   colours in one box) by making the two agree instead of making the frame transparent over `surface-300`. Both readings
   of r5 item 1 are defensible; **as merged, "the demo sits on a visibly different paper than the page" is false in the
   same-theme case**, and the gate prints that number rather than asserting it. Everything r5 item 1 asked for that
   *is* observable (one paint for canvas/frame/child, the stage's theme owning the paper and the `color-scheme`, a
   visibly different paper whenever the stage and the site disagree, Δ 0.997) is asserted and passes.
3. **Two console errors found during this run, both now fixed by the lead** — kept in the record because the strict rule
   stays in `r2_check` (`no console errors anywhere in this run`): (a) `Error: Tooltip must be used within
   TooltipProvider` on in-page navigation to `#/t/components/tooltip` (reproduced from `#/g`, `#/`, `#/t/components/
   button`; a direct load of the same URL did not throw, so it was SPA-navigation-only); (b) a `favicon.ico` 404 from
   the browser's own guess at the origin root. Both are gone on `main-DWq5yYYw.js`; the assertion was **not** widened
   to accommodate them.
4. **The gallery's type strip covers 47 of the 76 types the taxonomy has.** The five type pages that no gallery link
   offers are the ones behind `approval-card`, `message`, `message-scroller`, `streaming-text` and `utils`
   (`#/t/agent-ui/tool-calls-and-approvals`, `#/t/agent-ui/chat-and-messages`, `#/t/agent-ui/streaming-and-thinking`,
   `#/t/docs/helpers-and-hooks`). They are reachable from the rail and from the concept redirects, so this is a
   coverage gap in the review's *"no way to filter by the new types"*, not a broken link. Reported, not asserted.
5. **The Fonts page loads 73 requests from `fonts.googleapis.com` / `fonts.gstatic.com`** (26 families). r5 §Fonts
   asked for exactly that (*"On this page only, load the fonts from Google Fonts (openly licensed)"*) so it is not a
   defect — but it is the only page in the site that depends on a third party at runtime, and `slice3_check`'s "no CDN
   font" rule now has to stay scoped to the pages it was written for.

## Not changed, on purpose

- `qa/stage_check.mjs` — the lead's this round.
- No assertion was deleted: every removed line was replaced by one or more that fail on a real regression (the mapping
  is itemised above, gate by gate). No assertion was relaxed to `ok(true)`; the two places where the measured thing
  changed shape (`inline text link` in `mobile_state`, `element identity` in `foundations`) still carry a hard floor —
  24 px and "exactly one element per member" — and print their residue in the output.
- Nothing in `app/src/**`, `styles.css`, `docs/**`, `master`, or the build was touched; no rebuild was run.

## Moved under me

Mid-run the lead fixed the Tooltip provider (`app/src/demo-main.tsx`) and the missing icon (`app/index.html`) and
rebuilt the served tree (`dist-ChPFJK-A.js` → `main-DWq5yYYw.js`). The final numbers above are from the **later**
build, measured after those fixes landed; `qa/foundations_check.mjs` fails loudly (rather than silently passing) if it
is ever pointed at a tree whose `app/manifest.json` and `app/src/site/taxonomy.json` disagree with the build being
served — the hardcoded-worktree reads that used to make that possible are gone.
