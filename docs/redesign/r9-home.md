# r9 · the front page, the specimen page, and the phone's menu

Unit: `r9-home` · branch `fleet/r9-home` · commit `9a79359e` · built and served on `:8893`
(`/tmp/r9-home-serve/design-catalog`, gzip, `no-store`).
Harness: `build/r9-home-measure.mjs` (sections: caption / paint / preview+copy / strip / fonts / phone),
`build/r9-home-paint-throttled.mjs` (CDP 400 kbit/s, 400 ms RTT).
Raw before/after: `r9-home-before.json`, `r9-home-after.json`, `r9-home-after2.json`,
`r9-home-paint-400k-before.json`; screenshots in `r9-home-shots/`.

Every number below was taken on this box, and the box is not quiet: load average 18–25 on 4 cores for
most of the session (five sibling units). That matters for exactly one of the rows — §2 — and it is
marked there. Nothing else in this report is timing-sensitive.

---

## 1. The tile captions escaped their tiles — FIXED

**What the review said.** "All six captions stack at the bottom-left corner of the page (the
'card-with-form' label sits there): the tile link has no `position: relative`, so the
absolutely-positioned caption anchors to the page."

**What was true.** Confirmed, and worse than the review could see from one page: the caption bar
(`[data-tile-bar]`) is `position: absolute; left/right/bottom: 0`, and the card (`<a data-catalog-item>`)
had no `position`, so all six bars walked up to the page and stacked. The *poster* in the same tile was
always in the right place, because the canvas wrapper below the link is `position: relative` — which is
why only the caption was wrong, and why the fix belongs to the parent rather than to the caption's
coordinates.

| | 1440 × 900 | 375 × 812 |
| --- | --- | --- |
| before: captions inside their own tile | 0 / 6 | 0 / 6 |
| before: distinct caption positions | 1 | 1 |
| after: captions inside their own tile | **6 / 6** | **6 / 6** |
| after: distinct caption positions | **6** (164 px apart, x 347→1217) | **6** (2 columns × 3 rows) |

`app/src/site/Tile.tsx`: `position: "relative"` on the tile's `<a>`, with the incident written next to it.

---

## 2. The tiles took ~10 s to appear — cause found, mechanism changed, only partly re-measured

**What the review said.** "Tiles take about 10 seconds to appear, blank boxes until then."

**The measurement first (before any change).** Unthrottled, at the top of the page:

| before | ms |
| --- | --- |
| first paint | 468 |
| first tile frame mounted | 1 087 |
| first demo booted | 2 041 |
| all six booted | 3 374 |
| first poster removed | 3 476 |
| transfer | 1 617 KB |
| long tasks > 50 ms | 28, 4 761 ms total |

and on the project's own published profile (400 kbit/s, 400 ms RTT, server gzip), which is where
"ten seconds" comes from:

| before, 400 kbit/s | ms |
| --- | --- |
| first tile mounted | 13 442 |
| **first demo painted** | **23 966** |
| last demo painted | 56 166 |
| wire | 394 KB in 64 requests |

A separate probe (`/tmp/r9-blank-probe.mjs`) gave the shape of the blank: shell tiles at ~3.5 s, six
React tiles mounted at ~11.8 s with posters and names, iframes from ~16.7 s, posters vanishing between
25.9 s and 38 s. That is the review's ten seconds: the box had a name and a poster, the demo did not.

**The cause.** Not the pool, not React's lazy chunks, not the manifest projection, not the intersection
observer. It is that **each tile is a whole document**: `demo.html` loads React, the demo runtime and the
demo's own chunk, separately, per tile. Measured per iframe (329 requests, 185 distinct URLs):

```
chat-app        3.02 MB       sankey          1.69 MB      login-01   1.48 MB
dashboard-01    2.33 MB       form-formisch   1.63 MB      shared: demo-DH-…js 799 KB,
                                                            styles-…css 343 KB, styles-…js 213 KB
```

Six of those documents mounting at the same instant divide one pipe six ways. That is the defect: the
front page's six demos were *contending*, not slow.

**The change.** `Pool.serial` (`app/src/site/Tile.tsx`) + `serial` on the front page's `Grid`
(`app/src/site/Featured.tsx`): mount **one tile at a time, in view order, and do not start the next
until the current tile's child has reported its first measured size** (`onSize` → `pool.reportReady`),
with a 6 s failsafe so a silent demo cannot stall the row. `defer` (a 1 s idle wait that bought nothing)
is gone. A grid of 486 tiles is unchanged: `serial` is a per-surface rule and only the front page sets it.

| after (unthrottled) | before | after |
| --- | --- | --- |
| first tile frame | 1 087 ms | **732 ms** |
| first demo painted | 2 041 ms | **882 ms** |
| first poster removed | 3 476 ms | **929 ms** |
| all six painted | 3 374 ms | 6 873 ms (serial by construction) |
| transfer | 1 617 KB | **402 KB** |
| long tasks | 4 761 ms | 3 657 ms |

**Honest caveats, both of them.**

1. *The 400 kbit/s after-run does not exist.* I set up an A/B (serial on vs off, same build, alternating
   runs) and abandoned it under the instruction to stop heavy runs. So the throttled improvement is
   **argued from the mechanism and measured only at the head of the queue** — first demo 2 041 → 882 ms
   with the same six documents — not measured end-to-end at 400 kbit/s.
2. *The second after-run is noise, and I am not hiding it.* `r9-home-after2.json` reads first frame
   2 813 ms and 4 of 6 booted at 13 008 ms; the box was at load 24.7 with 31 Chromium processes from
   sibling units. `firstPaint` in that run was 660 ms against 248 ms in the clean run. The clean run is
   the one in the table; the quiet-box run is the lead's.

---

## 3. The comparison preview showed the boring columns — REPLACED

**Before**: `item · library · licence · files · parts` — the same four shapes on every row, and none of
them a question anyone asks about a sidebar. (Rows: `AI Sidebar / beui / MIT / 10 / ≥3`.)

**After**: `item · collapses · nests · at 390 px` (489 px tall at 390, fits without sideways scroll):

```
AI Sidebar         off-canvas   two deep    a sheet
Animated Sidebar   to icons     two deep    a sheet
Bounce Sidebar     no           not measured  stays put
sidebar            to icons     two deep    a sheet
caption: Sidebar · 4 of 7 members, the 3 the probe could not measure left out ·
         4 with a live demo · measured 31 October 2026
```

- the columns are `site/behaviour.ts`'s own `BEHAVIOUR_COLS`, read through that module's `text()` /
  `exact()` — so the preview and the full table cannot drift into two vocabularies for one fact, and
  each cell's `title` is the column's own witness (`the demo declares data-collapsible="offcanvas",
  width 256 → 12 px, a 95% change, after pressing "Toggle sidebar"…`), not a restatement.
- rows are only the members the probe answered something about. Three of the seven sidebars have a
  record whose six facts are all `null` — a probe that could not tell, which is not a "no" — and the
  caption names them instead of drawing three columns of "not measured".
- the data is `app/behaviour.json` (113 records, dated on the table), imported as a module rather than
  fetched: the front page needs four records, not 769, and the file is 6.2 KB gzipped against the
  detail payload's ~40 KB.
- the foot link moved off the retired `#/c/sidebar` to the canonical `#/t/components/sidebar`
  (`typeHref`, no redirect hop).

---

## 4. Wordy copy and the confusing counter — rewritten

| | before | after |
| --- | --- | --- |
| terminal hint | "Read out of the catalogue when this page renders, not pasted: the first 8 of 25 items whose name or slug says sidebar…" | "Every row is one item of this catalogue that matches `sidebar` — 25 of them, name matches first…" |
| libraries sub | "What each one allows, from the manifest's own licence string." | "What each one allows. A library whose licence does not let us republish still has its page here…" |
| counter | button "Show all 8 rows" beside marker "… 21 more of 25 matched" | marker "showing 4 of the 25 matched rows" / button "Show 8 of the 25" (open: marker "showing 8 of the 25", button "Show the first 4 of the 25") |

The harness's own grab of the two sentences now returns `null` for both — they are gone, not reworded
into a synonym.

---

## 5. The gallery's comparison strip — gone, replaced by one line

**Before**: 20 links to `#/c/<concept>`, 92 px tall at 1440 (first tile at 355 px) and **284 px** at 375
(first tile at **640** px) — and pointing at the route this round retires.

**After**: no strip at all (`data-compare-links` is gone from the DOM; 0 `#/c/` links on the page). One
line replaces it (`site/Gallery.tsx`, `TypesHere`): the three types with the most members in the filter
you are looking at. Each entry is two links — the **name** opens the type page (which is the
comparison), the **count** narrows this grid to that type (`#/g?type=…`). First tile: 1440 **317** px,
375 **458→498** px (the CSS that gives the links their 44 px targets costs 40 px at 375: the row wraps
to two lines there).

**Type filtering** (the gallery half of "no way to filter by the new types"): `#/g?type=components/sidebar`
now filters the grid, resolved through `site/typeIndex.ts`'s own map so a link and a hand-typed filter
cannot mean two types; applied as an intersection with the rest of the filter; an unknown type is
reported in `unknown`, never ignored. **`route.ts` is exactly three lines for this** (the `type` field on
`GalleryQuery`, `GALLERY_KEYS`, the `gridHref` loop) — coordinated with `r9-search`, which owns the rest
of the file this round and has preserved them.

**"Reference-only" → "no demo"**: 0 occurrences of the phrase remain in the gallery (was 3). The lede,
the counter and the toggle now say "no demo" / "without a demo" — the same words the cards themselves use.

**Card description clamp 3 → 2 lines** (the review's ruling against the RelatedCard spec). The card's
text block is 109 px instead of 127; the grid's zero-spread rule is kept at the new height. The cost,
measured on r8's own distribution: **103 of 131 descriptions were shown whole at three lines, 70 are at
two** — 33 more cards now end in an ellipsis. That is the price of the spec; it is stated, not hidden.

---

## 6. Fonts: 52 rows that all looked the same → 26 rows in 26 real faces

**Before**: 52 rows, 52 distinct names, **2 distinct families**. Every row was set in Instrument Sans,
so "DM Sans" and "EB Garamond" were the same picture, and the `(Heading)` entries doubled every
typeface. Network: 0 bytes, because nothing was loaded.

**After** (`app/src/site/fontFamilies.ts`, new; `site/specimens.tsx` rewritten):

```
rows 26 · distinct names 26 · distinct families 26
rows painting a real face 26/26 · loaded-but-not-painted 0 · no face 0
gstatic bytes 17 913 (25 requests: one css2 for all 24, then per-family retries — see below)
```

- the 26 heading cuts are folded into their typeface: one row per family, the name links to the body
  cut's item page, and a `heading cut` link on the mono line reaches the heading cut's item — all 52
  ids still reachable, none drawn twice.
- **the faces are real and verified, not assumed.** The stylesheet is appended by `useFaces` while the
  surface is mounted and removed when it goes, so the "no third-party requests" promise holds on every
  other page. Then each family is asked whether a face arrived — `document.fonts.load(...)` returning an
  empty array means none exists — and the row's own mono line says which of the three states it is in
  (`self-hosted, OFL-1.1` / `loaded from Google Fonts` / `that face did not load — set in the interface
  face`). `document.fonts.check()` was not used as the proof: it answers `true` for a family nobody
  serves, which is exactly the false positive a specimen cannot afford.
- the subset is derived from the strings actually rendered (each family's name + `Hamburgefonstiv 0123`),
  so it cannot fall behind them. Cost measured both ways: **431 KB** of latin woff2 unfiltered, **17.9 KB**
  with the subset.
- **known imperfection**: the batch stylesheet works, but the verification pass fires before the late
  stylesheet's faces are registered, so it concludes "missing" and retries all 24 families one at a time
  (25 requests instead of 1). The bytes are tiny and every row ends correct, but the request count is
  24 more than it should be. Fix: wait for the batch `<link>`'s `load` event *and* a `fonts.ready` tick
  before the first verdict, or trust the batch when its css2 request succeeded.
- `qa/foundations_check.mjs` asserts 52 rows, 4 hosted rows and the "not self-hosted" mark. **It will
  fail against this commit, by design** — see §9.

---

## 7. Phone Home: sideways strips → two per row at 4:3

| 375 × 812 | before | after |
| --- | --- | --- |
| tile box | 293 × 134 (ratio **2.18**) | 168 × 128 (ratio **1.31** ≈ 4:3) |
| band | 343 × 138, `scrollWidth` 1 795 vs 343 → **scrolls sideways** | 343 × 400, 343/343 → **no sideways scroll** |
| per row | 1.05 tiles, swipe for the rest | 2 |
| tiles on the first screen | 1 | 4 fully, 5th at 781, band ends 909 |

Chosen over a vertical list on purpose: the row's own claim is *six from the catalogue, no two the same
type*, and the first screen is where that claim has to be legible. A vertical list shows two of the six
and buries the rest; two per row shows four, and the fifth starts at 781 px, which is the invitation to
scroll a phone wants.

**Search field**: placeholder was `Search 769 items — name, slug or concept` — `scrollWidth` 273 vs
`clientWidth` 250, i.e. the phone read "…name, slug or co…". It is now one text node that is shortened
on a narrow viewport (`Search 769 items`, 317/317, **not truncated**) rather than two spans with one
hidden, so the field and its measurement have one answer.

**⌘K hint**: `Ctrl K` measured 57 × 22 on a thumb-only phone and is now `0 × 0` there — hidden by
`@media (hover: none)`, because "there is a key to press" is not advice on a device with no keyboard.

---

## 8. Phone Menu: doesn't reach the bottom, and said its name twice

| | before | after |
| --- | --- | --- |
| panel | top 65, height 678, **bottom 743** of 812 — **69 px** of dimmed page text under it | top 65, height **747**, bottom **812**, **gap 0** |
| wordmarks on screen | **2** ("design catalog" in the bar and again in the menu head) | **1** |

The panel was content-sized (`bottom: auto; max-height: calc(100dvh - header)`), so a tree shorter than
the viewport left a strip of page under it — dimmed to 40 % by the veil, which is exactly "page text
shows through it". `bottom: 0` makes the panel bound by the header and the foot; the page under it is not
visible at all. The duplicate is `.rail-brand > h1`, the desktop rail's wordmark which the desktop
already hides in favour of the top bar's; on a phone those two are the same bar and the same title, so
the menu's copy goes and the bar's stays.

---

## 9. What is not done, and what will fail

- **No gate suite was run against this commit** — the lead's instruction, and the lead runs them. Read
  the following as predictions, not results:
  - `qa/foundations_check.mjs` **will fail, by design**: it expects 52 specimen rows, 4 `hosted` rows and
    a `not self-hosted` mark. This commit publishes 26 rows, 2 hosted, and
    `data-specimen-face` ∈ {`hosted`,`google`,`absent`,`pending`}. The gate has to be updated to the new
    truth (26 rows; every one of the 52 ids reachable exactly once across `data-specimen` and
    `data-specimen-ids`; a row's face proved by `document.fonts.load`).
  - `qa/gallery_check.mjs`: the strip it may look for is gone by design (`data-compare-links` no longer
    exists), and there is a new `[data-type-links]` row with 6 links. Tile count, live-frame cap and the
    `ref` toggle are unchanged.
  - `qa/card_check.mjs` measures spread, not height; the card block is now 109 px instead of 127 and the
    description clamps at 2 lines. Re-measure rather than trust.
  - `card_check.mjs` and `foundations_check.mjs` hardcode `REPO = …/design-catalog-site-r8-cards`, a
    worktree that no longer exists — both need their `REPO` updated before they can run at all.
- **The 400 kbit/s after-run does not exist** (§2). The serial mechanism is measured only at the head of
  the queue, unthrottled.
- **Paint numbers from the `after2` run are contaminated** by sibling load (load 24.7, 31 Chromium
  processes). Only the clean `after` run belongs in a table.
- The font verification path makes 24 unnecessary requests (§6).
- Deliberate, and worth a second opinion: the 3 → 2 line clamp costs 33 descriptions their last words
  (§5).

## 10. Files

```
app/src/site/Tile.tsx             caption anchor (`position: relative`), Pool.serial / reportReady / HOLD_MS,
                                  `serial` prop on Grid, `data-demo-frame` on the frame wrapper
app/src/site/Featured.tsx         phone geometry (2 × 4:3, no scroller), `serial` instead of `defer`
app/src/site/Home.tsx             terminal hint, libraries sub, counter (one number, one unit), short placeholder
app/src/site/CompareShowcase.tsx  rewritten: measured columns, answered rows only, canonical type-page link
app/src/site/Gallery.tsx          TypesHere row (replaces the 20-link strip), "no demo" wording, `?type=` filter
app/src/site/route.ts             three lines: `GalleryQuery.type`, GALLERY_KEYS, gridHref
app/src/site/fontFamilies.ts      new: the page-scoped stylesheet, the per-family verification, the subset
app/src/site/specimens.tsx        rewritten: one row per typeface, sample line, three face states
app/src/styles.css                appended `r9` block (menu height, ⌘K on touch, type row, preview cells,
                                  specimen sample, 2-line clamp); nothing above it edited
```
