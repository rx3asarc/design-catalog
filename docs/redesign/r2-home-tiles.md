# r2-home-tiles — the front page shows the thing, not a description of it

Branch `fleet/r2-home-tiles` (worktree `/mnt/HC_Volume_105573741/design-catalog-site-r2-home-tiles`), base
**master @ `d5d2a226`**. Five commits:

```
30f6cbc6  tile: the tile, the pool and the grid move into site/Tile.tsx          (the move, first)
dca4c00c  home: the six tiles are chosen by a rule, not by hand                  (item 2)
8206505b  home: six real tiles above the fold, the gallery's own tile, not a copy of it   (item 1)
9857c146  home: the row costs six frozen frames and nothing on the critical path (item 3)
b3ce30c7  home: where every number on the front page comes from, written next to them     (item 4)
```

Files: `app/src/site/Tile.tsx` (new), `app/src/site/Gallery.tsx` (imports only), `app/src/site/Home.tsx`.
Nothing else: `git diff --stat d5d2a226..HEAD` lists those three files. `styles.css`, `index.html`,
`App.tsx`, `route.ts`, `lib.ts`, `Rail.tsx`, `demo.tsx`, `Stage.tsx`, `ItemPage.tsx`, `Code.tsx`,
`provenance.tsx`, `gen.py`, `manifest.json`, `demos/**`, `publish.sh` untouched; no new dependency.

---

## 1. The move (first commit) — and the proof it is one

`DemoTile`, the `Poster` (what the brief calls `Placeholder`; round 2 renamed it — there is no symbol named
`Placeholder` anywhere in `Gallery.tsx`), `RefCard`, `cardStyle`, the facets block, the mount `Pool`, the two
observers' harness (`Grid`), `useNarrow`, `useSiteTheme`, `useColumnWidth` and `scrollerOf` are now
`site/Tile.tsx`. `Gallery.tsx` keeps the filter, `resolve()` and the header, and imports the rest back.

Proof, not assertion: master and `30f6cbc6` were both built and loaded at 1440×900 on `#/`,
`#/g` and `#/g?sec=Components&ref=1`. Identical tile count (486), identical first twelve `data-tile` ids,
identical `data-gallery-counts` text, identical page text, identical poster markup.
Script: `/tmp/r2/purity.mjs` (same harness as the measurements below).

`Grid` grew three **optional** props, each defaulting to today's behaviour: `cap` (frames allowed at once),
`columns` (the column template) and, in item 3, `frozen` + `defer`. The gallery passes none of them.

---

## 2. The six, and the fields that chose them

The rule, as frozen in the brief: one item per rail section — Blocks and pages; Components ×2; Motion and
effects; Docs — plus one widely used one, ordered by **most `composition.count`, then most `used_here`, then
fewest `file_count`**, id to break a dead heat. Sections and rows are read from `buildTree("", "")` — the
rail's own tree — so a section's candidates and the grid a `?sec=` link opens are the same rows.

The manifest publishes **no `pick` row** (0 of 769) and none was invented: nothing in `Home.tsx` names an
item. A reader can overrule the rule below.

| # | pick | section | `composition.count` | `used_here` | `file_count` | demos |
|---|------|---------|--------------------:|------------:|-------------:|-------|
| 1 | `beui/chat-app` | Blocks and pages | 27 (lower bound) | 0 | 63 | yes |
| 2 | `shadcn/sidebar-09` | Components | 8 (lower bound) | 0 | 3 | yes |
| 3 | `shadcn/sidebar-16` | Components | 8 (lower bound) | 0 | 8 | yes |
| 4 | `beui/shader-background` | Motion and effects | 2 (lower bound) | 0 | 5 | yes |
| 5 | `shadcn/docs-changelog` | Docs | – | 0 | – | **no** |
| 6 | `shadcn/button` | widely used | – | **10** | 1 | yes |

Where the values came from, and the one judgement in the rule:
`/tmp/r2/select.py` (the same comparator, over the manifest, printed to build the table above).

- **The dead heats, named.** Components 2nd/3rd are `sidebar-09` (3 files) → `sidebar-16` (8) → `sidebar-15`
  (11): all three are `composition.count` 8 / `used_here` 0, so `file_count` decides, exactly as the brief
  says. All 108 Docs pages have no `composition`, no `file_count` and `used_here` 0, so **every field is a
  dead heat and the id decides**: `shadcn/docs-changelog` is the first id in the section. That is the rule,
  not a preference.
- **The widely-used pick leads on `used_here`.** "A widely-used one" cannot be led by `composition.count`
  (that would return the largest *block*, which is already pick 1 and is used nowhere). Its comparator is
  `used_here` → `composition.count` → `file_count`, which is the same three fields with the one that means
  "widely used" first. Result: `shadcn/button`, used 10 times on this site (next: `badge` 5,
  `collapsible` 2, `table` 2).
- **The one precondition, which is what a tile is rather than a taste of ours:** a section's candidates are
  the items that run here (`hasDemo`). A tile exists to show an item running; an item with no demo can only
  ever be a reference card. Five of the six picks run. Docs has **no** item that runs, so for that section
  the rule is applied to the whole section and the row shows the item as the reference card it honestly is
  (dashed rule, "no demo", the library's link out) rather than dropping the section the brief names. Without
  this precondition the same rule picks `shadcn/form-next-complex` for Components — a form with no demo — and
  two of the six tiles would show nothing at all.
- The sentence under the row is the brief's, verbatim: `six from the catalogue, chosen by size and reuse —
  not by hand`. Its only numeral is the length of `HERO_TILES`.

---

## 3. Layout: six on the first screen, at both viewports

The page's column is 592 px at 1440 (`styles.css` `.page-in`, 640 max-width less padding) and 358 px at 390.
A grid with the gallery's own `minmax(300px, 1fr)` would be one 592 px column — six rows, four of them below
the fold. The row therefore passes its own `columns`: **3 across at 1440** (192 px tiles), **2 across at 390**
(175 px tiles), `bodyH` 210 / 132.

| viewport | tiles in the row | tiles intersecting the initial viewport | row band | tile |
|---|---:|---:|---|---|
| 1440×900 | 6 | **6** | 222 → 893 (671 tall) | 192 × 316–347 |
| 390×844 | 6 | **6** | 308 → 1077 (769 tall) | 175 × 241–272 |

At 1440 the six tiles fill the first screen exactly. At 390 all six intersect, but the third row's bottom
(1077) is 233 px below the 844 fold — the row is 2 columns × 3 rows and a phone cannot hold three rows of the
tile in 844 px; only a single row could, and then four of the six would be off-screen.

**The one trade-off, named.** 192 px is not the width the tile was designed at: the gallery never shows it
below 300 px, and the hero tiles therefore sit at the tile's `ZOOM_MIN` (0.25 scale: a 768 px-wide demo drawn
192 px wide). Measured pixel variance inside the demo windows, hero row at 3 columns vs 2 columns (which
would give 292 px tiles, gallery scale):

| tile | 192 px: colours / stddev | 292 px: colours / stddev |
|---|---|---|
| `beui/chat-app` | 1649 / 18.0 | 2250 / 15.4 |
| `shadcn/sidebar-09` | 64 / 3.7 | 85 / 4.4 |
| `shadcn/sidebar-16` | 261 / 4.5 | 415 / 6.2 |
| `beui/shader-background` | 542 / 112.7 | 1764 / 91.2 |
| `shadcn/docs-changelog` | 237 / 9.1 | 237 / 7.4 |
| `shadcn/button` | 71 / 2.7 | 110 / 3.7 |

Two columns is better for two tiles by a visible margin and pushes the row band to 222 → 1178, i.e. the third
row under the 900 fold. I kept three columns: six complete tiles on the first screen is what the brief asked
for, and the whole row is thumbnails at either width (`shadcn/button` is a single small control on a large
canvas — it is near-flat at any scale; `sidebar-09` is a light panel with 1 px rules, which sub-pixel away at
0.25). A vision pass on the two screenshots returned *"demo windows readable as UI: partly"*, one defect
— *"the button tile is completely blank"* — which is the item, not the tile. If a reviewer wants larger
tiles, `columns` in `Home.tsx` is the one line to change.

---

## 4. Measurements

Harness: Playwright at `/root/camofox-browser/node_modules/playwright/index.mjs`,
`executablePath: /usr/local/bin/google-chrome`, `args: ["--no-sandbox","--disable-dev-shm-usage"]`;
`npx vite build` in `app/`, `app/dist` served at `/design-catalog/`; times are `performance.now()` from
navigation start, collected in-page by a MutationObserver on `data-mode` and a capture-phase `load` listener
on the hero row. Scripts: `/tmp/r2/home_measure.mjs`, `gallery_check.mjs`, `motion.mjs`, `turn.mjs`.

**Live frames within 2.5 s** (five runs, budget: ≥3 of 6):

```
1440x900   loaded live frames inside 2.5 s: 5/5   last load 0.92–2.13 s   mounts start 0.49–1.33 s
390x844    loaded live frames inside 2.5 s: 5/5   last load 0.99–1.53 s   mounts start 0.56–0.85 s
```

Six tiles, five of them frames (the sixth is the Docs reference card); every frame in every run loaded well
inside the budget. The mount start moves between runs because `defer` waits for an idle slot after first
paint (see §5) — that is the intended behaviour, and it is why the spread is reported instead of the best run.

**Everything else, at both viewports:**

| check | 1440×900 | 390×844 |
|---|---|---|
| tiles intersecting the initial viewport | 6 | 6 |
| CLS, hero row, first paint → settled | **0.00** | **0.00** |
| CLS, whole page | **0.00** | **0.00** |
| horizontal overflow | 0 | 0 |
| `static=1` on the hero frames | 5 of 5 | 5 of 5 |
| `requestfailed` (network failures) | 0 | 0 |
| failed HTTP responses | **2 — see below** | **2 — see below** |
| console errors | 3, all the same 404 | 2, same |

`#/g` unchanged, both viewports: `data-gallery-counts` = **769 / 486 / 283**, 486 tiles in the grid, 9 live
frames at 1440 and 2 at 390 (the gallery's own caps), 0 overflow, 0 page errors.

`python3 app/check_chrome.py` → **exit 0**, 17 shell files scanned, `site/Tile.tsx` included.

Page turn and reduced motion, measured, unchanged: one animation of `250 ms`,
`cubic-bezier(0.22, 1, 0.36, 1)`, 1 iteration, on each of `#/`→`#/about`, `#/`→`#/g`, `#/g`→`#/i/…`; under
`prefers-reduced-motion: reduce`, `document.getAnimations()` is **0** on the front page, after a route change,
and on the gallery.

### The two failed requests — pre-existing, and not the row's

`http://…/avatars/shadcn.jpg` → **404**, requested from **inside** two demo documents
(`demo.html#shadcn%2Fsidebar-09|0|static=1…` and `…sidebar-16…`), plus the console errors that go with them.
Attribution: `src/demos/shadcn/sidebar/v0.tsx:75` — `avatar: "/avatars/shadcn.jpg"` — and no such file is
shipped (`app/public/` holds `fonts/` only). It is not new: on master's `#/g` the same 404 appears the moment
a sidebar tile mounts (1 of 3 runs), and it 404s on the published site as well
(`https://rx3asarc.github.io/avatars/shadcn.jpg` → 404). It is the *selection* that puts two of them on the
front page, which is why it is reported here as a failed gate rather than buried: **0 console errors** cannot
be met with two sidebar demos in the row until that one line or that one file is fixed, and `demos/**` is in
the brief's do-not-touch set.

---

## 5. Cost (item 3)

- **`frozen`.** `DemoTile` takes an optional `frozen`; when set, every tile loads `static=1` and is sent
  `play` only while hovered or focused. Before, the address was per item (`isMotionItem`), which left four of
  the six running on load. Verified: `static=1` present on 5/5 hero frames, absent nowhere it should be.
  Verified also that freezing does not blank a demo: `demo.html#<id>|0` vs `…|0|static=1` are
  pixel-identical for `sidebar-09`, `sidebar-16`, `button` and `chat-app` (colours and stddev equal).
- **`defer`.** The pool arms on the first idle slot after first paint — `requestIdleCallback` with
  `timeout: 1000` so it cannot be starved, `setTimeout(…, 250)` where idle callbacks do not exist. The poster
  is already in the exact box the frame will occupy, so the deferral costs no layout shift: CLS 0.00 for the
  row and 0.00 for the page, measured both with and without it.
- **`cap`.** Six frames, not the grid's nine — half the measured budget.

---

## 6. Numbers (item 4)

No number was added, restated or trimmed: the audit lives in a comment above `Home()` in `Home.tsx`, next to
the figures it governs. Crumb and lede (`counts.total`, `counts.sources.length`), tally
(`counts.sources[].items`), `486 of these run here` (`counts.demos`), the terminal card's `first 8 of 25`
(counted off the manifest at render, never typed) are all as they were; the digits a tile prints are the
item's own `file_count` / `bytes` / `dep_count` / `composition.count` / `used_here` through the same
`CardMeta`/`Facets` the gallery prints. The row's only numeral is the `six` in the brief's own sentence.

---

## 7. Notes for whoever picks this up

- `Gallery.tsx` still carries the `GALLERY_SEAM`'s counterpart in `Home.tsx` (`GALLERY_LIVE`), untouched.
- `Tile.tsx` is now the one copy of the tile: `site/compare`/`#/c/<concept>` (r2-compare-page) can import
  `Grid`, `DemoTile`, `RefCard`, `Poster`, `Facets`, `CardMeta`, `cardStyle`, `hasDemo`, `Pool`,
  `useNarrow`, `useSiteTheme`, `useColumnWidth`; export surface + props were sent over intercom at `30f6cbc6`.
- `lib.ts`'s `isMotionItem` comment claims "site/Gallery.tsx carries the same rule inline"; after the move the
  duplicate is in `Tile.tsx`. Not corrected here — `lib.ts` is not this unit's file.
- `Pool` writes `window.__gallery` from its constructor, so on `#/` that global now describes the hero pool
  (cap 6), not the gallery's. It is a debug seam; the gallery still reports its own when it is the mounted
  surface.
- Building in this worktree required its own `app/node_modules` (420 MB): `/mnt/HC_Volume_105573741` is on
  `/dev/sdb`, which reports 0 blocks free with the root reserve, as it did before this unit started. Every
  other worktree there carries the same directory.
