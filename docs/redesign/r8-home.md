# r8-home — the front page, rebuilt around "Browse by type"

Branch `fleet/r8-home`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r8-home`, base `16d334bd`.
Nothing in the prohibited set was touched: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`,
`publish.sh`, `master`, `app/src/site/taxonomy.json`, `app/src/site/taxonomy.ts`.

## The review, item by item

| the verdict | what shipped | measured |
| --- | --- | --- |
| "three of the six are near-identical shadcn sidebars" | a rule that cannot pick two of one type, gated | 6 tiles, **6 distinct types** (Field and form · Dashboards · Flow and hierarchy · Chat and messages · Auth and onboarding · Card), Components 2 · Blocks 2 · Charts 1 · Agent UI 1 |
| "two look like empty grey frames when shrunk" | a measured legibility floor on every candidate | the two worst tiles in the old row were `sidebar-15` **0.1694** and `sidebar-16` **0.1761** ink; the new row's worst is `login-01` **0.1368** and every one of the six is a card, a chart, a form or an app — see "the floor" below for why the number is not the whole story |
| "`Tap any of them to open its page..`" | rewritten; the sentence is a sentence | `qa/hero_check.mjs` #10 fails on the old string, passes on the new one |
| "there is no H1 (item pages only have H2)" | `<h1>` on the front page, and in the boot shell | old: **0 px tall**, text "design catalog", 14/21 (the rail's link label was the page's only h1). New: **72 px** at 1440 (30/36) and **96 px** at 390 (26/32), text "Interface parts from five reference libraries, with their source." |
| "the only way into the gallery is a link inside a sentence; nothing leads to collections" | a search field as the main action, and 89 type cards in 7 sections | `[data-home-search]`: **919×44** at 1440, **358×44** at 390, opens the ⌘K palette on click *and* Enter; browse grid: **89 cards / 7 sections / 89 links / 0 dead**, every card a 50 px control, every href `#/t/<section-slug>/<type-slug>` |

## Before / after, same harness, same server

`node /root/docs/catalog-redesign/build/r8-home-measure.mjs --tag before|after`
(`build/r8-home-before.json`, `build/r8-home-after.json`, shots in `build/r8-home-shots/`)

```
                                 before                        after
1440  H1                          0 px, 14/21, "design catalog" 72 px, 30/36, a sentence
1440  search control              absent                        919x44 button, ⌘K hint
1440  hero band                   y 274–486, 6/6 whole          y 374–586, 6/6 whole
1440  hero ids                    3 shadcn sidebars + chat-app  six types (below)
1440  "Browse by type"            0 cards / 0 sections          89 cards / 7 sections / 0 dead links
1440  page nodes                  944                           1341
1440  boot shell vs app, H1       123 px apart                  0 px apart
1440  boot shell vs app, search   n/a (no field to compare)     0 px apart
1440  boot shell vs app, band     4–6 px                        0–2 px
390   H1                          0 px                          96 px (3 lines at 26/32)
390   search control              absent                        358x44
390   hero band                   y 311–449                     y 509–647, 6/6 whole, band scrolls sideways
390   boot shell vs app, H1       109 px apart                  2 px apart
```

The row the new rule produces, in pick order (one per section first, then the sections with the most left over):

```
Components   shadcn/form-formisch-complex   Field and form       0.26 sweep / 0.63 tile   7 prims
Blocks       shadcn/dashboard-01            Dashboards           0.32 sweep / 0.49 tile  19 prims
Charts       beui/sankey-chart              Flow and hierarchy   0.70 sweep / 0.32 tile   3 prims
Agent UI     beui/chat-app                  Chat and messages    0.23 sweep / 0.37 tile  27 prims
Blocks       shadcn/login-01                Auth and onboarding  0.37 sweep / 0.14 tile   4 prims
Components   shadcn/card-with-form          Card                 0.47 sweep / 0.23 tile   5 prims
```

Six from four sections, not seven. That is a fact about the catalogue, not a decision: **Effects** has 43 items and
no demo, **Docs** 113 and none, **Foundations** 74 and one (`beui/theme-toggle`, two parts, below the composition
floor). Six tiles from four sections is the most this manifest can honour.

## The rule, and why it is a measurement rather than a taste

`app/src/site/Featured.tsx` (and its build-time twin in `app/vite.config.ts`, compared by `qa/r2_check.mjs`):

1. **a measured floor** — the candidate's demo, mounted in the tile's own frame, must put down at least **0.20** of
   that frame as ink (`app/src/site/hero-ink.json`, floor in the same file);
2. **a composition, not a control** — `composition.count >= 3`;
3. **no two tiles share a type** — read off `taxonomy.json`;
4. **one per section first, at most two per section**, then the section with the most left over;
5. **within a section**: most distinct primitives, most parts, fewest files, id.

The old rule was "most parts, then most used here, then fewest files" over three hand-named sections, twice each —
and "most parts" is what produced three sidebars. The new rule's first clause exists because the old rule's failure
was measurable, and the measurement says why the old rule could not see it:

**72 candidates, 38 of them under 0.20.** `shadcn/sidebar` — six primitives, six parts, 21 KB, and the fifth-best
candidate by every field the old rule read — measures **0.0006**: a third of a percent of its tile is ink. It is
`min-h-svh w-full` with an empty inset, and below 768 px it lays itself out as a phone, where its sidebar becomes a
closed sheet. `shadcn/dropdown-menu-dialog` is 0.0049 at five parts. Three-to-five-part shadcn demos are, almost
without exception, *one control on a page*, and a control at a third of its size is a speck. Full table:
`build/r8-home-candidates.tsv` (72 rows), regenerated by `build/r8-home-candidates.mjs --write`.

**The floor is a floor, not a ranking.** Ranking by ink alone puts four charts and a full-bleed marketplace block in
the row and drops the dashboard (measured, in an earlier iteration of this unit). Past "you can see it", the
densest canvas is not the better tile, so ink decides *who is eligible* and the manifest's own vocabulary decides
*the order*. From the sweep's 72 measurements, 34 clear the floor; the row takes six of them.

**One honest gap, said plainly.** The sweep frames each demo at the width the demo reports and reads the top-left of
that frame; a live tile re-zooms once the demo reports and can frame differently, so the two numbers differ —
`beui/chat-app` reads 0.23 in the sweep and 0.37 in its tile, `shadcn/login-01` 0.37 and 0.14. Both numbers are in
the table above and both are measured. `qa/hero_check.mjs` asserts the sweep's floor on the sweep's numbers (#7) and
a blank-box floor of 0.10 on the tiles themselves (#7b). Measured this way the tile metric does **not** separate "an
empty app shell" from "a small card on a page" — the pre-fix `sidebar-15`/`-16` measured 0.1694/0.1761 here and
`login-01` measures 0.1368 — which is exactly why the selection uses the sweep, where the separation is 100×
(0.0006 for an empty shell, 0.37 for the login card) rather than 1.3×.

## What was added, file by file

| file | what it is |
| --- | --- |
| `app/src/site/Home.tsx` | rebuilt: crumb, `<h1>`, lede, the search field + "All 769 items" control, the row, Browse by type, the comparison, the five libraries, the agent section (terminal folded to 4 rows behind a disclosure), two closing controls. The three-ways-in `<ol>` of sentences is gone — every entry point is a control |
| `app/src/site/Featured.tsx` | the six, the rule, its reasons, and the measured table they came out of |
| `app/src/site/BrowseByType.tsx` | 89 type cards in 7 sections, each a control to `#/t/<section-slug>/<type-slug>`; counts and names read off `taxonomy.json` |
| `app/src/site/CompareShowcase.tsx` | the sidebar comparison as the table it is: four real rows from `Components/Sidebar`, five manifest columns, one door to `#/c/sidebar` |
| `app/src/site/hero-ink.json` | 72 measured ink readings + the floor. Generated, not typed |
| `app/src/styles.css` | one appended section, ~120 lines, all tokens: `.home-*`, `.browse*`, `.type-card`, `.cmp-preview`, `.lib-row`. Nothing else in the file was touched |
| `app/index.html` | the boot shell now draws what the app draws: an `<h1>` (was `<h2>`), the search field, "All N items", and spacing set to the app's own numbers |
| `app/vite.config.ts` | the build-time copy of the rule reads the same taxonomy and the same ink table; warns at build time when an eligible candidate has no measurement |
| `qa/hero_check.mjs` | **new gate**: 10 assertions — the measurement is complete, the floor is a number, six tiles that each draw, six taxonomy members, six distinct types, no section over two, no tile under the floor (sweep *and* tiles), every tile can run, the phone draws the same six, the row's sentence is a sentence |

## Gates

Run against this build served at `http://127.0.0.1:8883/design-catalog/` (asset `main-D2rW8Q8g.js` → rebuilt),
Chrome `/usr/local/bin/google-chrome`, Playwright from `/root/camofox-browser`.

```
node qa/taxonomy_check.mjs                                  ok    89 types, 7 sections, 569 members + 200 variants
node qa/hero_check.mjs   http://127.0.0.1:8883/…            ok    10/10 — six tiles, 6 distinct types, ink 0.2295–0.7044, floor 0.2
node qa/smoke.mjs        http://127.0.0.1:8883/…            ok    6 routes × 1440 and 390
node qa/tap_check.mjs    http://127.0.0.1:8883/…            ok    0 controls under 44 px on any of 6 routes
node qa/r2_check.mjs     http://127.0.0.1:8883/…            ok    incl. "the build-time cards are the row the app draws — 6 · 6"
node qa/gallery_check.mjs http://127.0.0.1:8883/…           ok    486 shown, 9 live at 1440, 2 at 390
node qa/mobile_state_check.mjs http://127.0.0.1:8883/…      ok    filter, stage and column restore
/root/docs/catalog-redesign/qa/contrast_check.mjs           ok    32/32 — the field's ink-muted on surface-200 7.41:1, focus 6.97:1
```

**The hero gate fails on the build before the change**, which is what makes it a gate. `16d334bd` built into
`/tmp/r8prev` and served at `:8884`:

```
FAIL 4 every hero id is a taxonomy member — not in the file: shadcn/sidebar-09, shadcn/sidebar-16, shadcn/sidebar-15
FAIL 7 no tile is an empty frame — under 0.2: shadcn/sidebar-09 unmeasured, shadcn/sidebar-16 unmeasured, …
FAIL 10 the row's sentence is a sentence — "Six things from the catalogue. Tap any of them to open its page.."
HERO: 3 FAIL — six tiles, 3 distinct types, ink 0.0000–0.3197 against a floor of 0.2
```

**Known pre-existing failure, not this unit's:** `qa/slice3_check.mjs` reports
`FAIL first paint light: at commit="dark|rgb(9, 9, 11)" settled="dark"`. It fails identically on the pre-fix build
(`:8884`), so it is not caused by anything here; this unit did not touch the theme boot. Every other slice-3
assertion passes on both.

## What this unit did not do

- **It did not build the type pages.** `#/t/<section-slug>/<type-slug>` is `r8-collections`' surface, in flight in a
  parallel worktree; this page links to the shape and nothing more. That unit's `app/src/site/typeIndex.ts` has the
  canonical `slug()`/`typeHref()`; this worktree keeps a local two-line copy in `BrowseByType.tsx` (it cannot import a
  file that does not exist here) whose output is asserted to be well-formed on all 89 cards by
  `qa/hero_check.mjs`/the probe below. **On merge, delete the local copy and import `typeHref` from `./typeIndex`.**
- **It did not add a `pick` field to the manifest** (0 of 769 have one, and the manifest is in the prohibited set).
  The row is a function of data that already exists plus one measurement.
- **It did not touch the rail.** `r8-rail` is linking to the same routes in parallel.

## Probes run by hand (not committed)

```
field      BUTTON 44 px, 14 px, cursor:text, ⌘K/Shift+Tab ring 2 px solid rgb(167,139,250) offset 2 px
Enter/keyboard  opens the palette; typing "sankey" returns 1 row ("Sankey Chart beui component licence MIT")
click      opens the palette; Escape closes it (both widths)
cards      89 cards, 89 unique hrefs, 0 malformed, min height 50 px, 7 sections in taxonomy order
pageerrors none at 1440 or 390
```
