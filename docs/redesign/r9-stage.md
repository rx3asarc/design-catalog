# r9-stage — the item page's stage: paper, cap, one row, one stage for the variants

Branch `fleet/r9-stage`, base `master` (`ced26e10`, round 8 in). Commits: `0ff577f6`.
Port **8891** (`python3 -m http.server` over `app/dist`, `/tmp/serve-r9-stage/`); the "before" numbers come from a
second server on **8890** over the *master* worktree's `app/dist` (`assets/main-OZr2Pjcu.js` — the same asset hash my
own pre-change build produced, so both builds are the same commit). Served asset hashes were checked against
`dist/index.html` before every run.

Files changed (all mine):

| file | what |
|---|---|
| `app/src/site/Stage.tsx` | rewritten. `ItemStage` (one stage, variants as a tab strip), `readableName`, `CAP`, `FLOOR`/`SELF_FLOOR` (unchanged numbers, new docblock paragraph on the ceiling), `useStage` (same API), `Settings`, `StageFrame`. `StageBar` is gone; nothing else imported it. |
| `app/src/site/ItemPage.tsx` | renders `<ItemStage item api />` instead of N × `<Demo>`; `readableName` for the `<h1>`; pager + comparison card rewritten. |
| `app/demo.html` | `html, body { background: transparent }` (was `var(--background)`), with the docblock for why. |
| `app/src/demo-main.tsx` | **unchanged** — it never writes a background, so the transparency rule has one place, the document's stylesheet. |
| `app/src/styles.css` | appended `/* ---- the item page's stage (r9) ---- */` — one block at the end, no `!important`, nothing above it edited. Duplicate selectors grepped after each patch: the only ones that repeat are the `[data-stage-bar] [data-slot="toggle-group-item"][data-state="on"]` rules, which deliberately come later in the same file at the same specificity to override r8's `surface-300`-on-`surface-300` selected state. |

Not touched: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`, `master`,
`app/src/site/taxonomy.*`, `app/src/site/typeIndex.ts`, `app/src/components/**`, `app/src/site/demo.tsx`.

---

## The six complaints, and what was measured

Measurement script: `/tmp/r9-stage-measure2.mjs` (Playwright, same script on both builds) —
`node /tmp/r9-stage-measure2.mjs http://127.0.0.1:8890/design-catalog/ before` and
`node /tmp/r9-stage-measure2.mjs http://127.0.0.1:8891/design-catalog/ after`, plus `/tmp/geom.mjs` and
`/tmp/phoneprobe.mjs` for the geometry and the phone popover. Painted values are sampled from a real screenshot
(the page decodes its own PNG in a canvas and reads pixels), never from computed style alone.

Unless marked otherwise, "after" = build `assets/main-CpsL-8tJ.js`. Two later builds are accounted for at the end
(one experiment reverted, one phone-only rule added).

### 1 · The slab — the canvas and the frame now paint one paper

`#/i/shadcn/form-formisch-complex`, 1440×900, the canvas is 696 px wide:

| | dark, before | dark, after | light, before | light, after |
|---|---|---|---|---|
| canvas painted pixel | `rgb(9,9,11)` | `rgb(9,9,11)` **paper** | `rgb(255,255,255)` | `rgb(255,255,255)` **paper** |
| the `.demo` card body | `rgb(24,24,27)` | — (no card) | `rgb(244,244,245)` | — |
| `<iframe>` element | `oklch(0.141 0.005 285.823)` | same | `oklch(1 0 0)` | same |
| the demo document's own root | `oklch(0.141 0.005 285.823)` = #09090b | `rgba(0, 0, 0, 0)` | `oklch(1 0 0)` = #fff | `rgba(0, 0, 0, 0)` |

So before, one box had three paints — canvas #09090b, card #18181b, frame #09090b — and the slab was the card body
it sat in. After, the canvas paints the **demo's** paper (`FRAME_SURFACE[theme].ink`, the same constant the
`<iframe>` element is painted with) and the document paints nothing. The seam cannot come back as a mismatch
between two hand-typed colours, because there is one value.

Mixed themes — site **light**, stage switched to **dark** (`#/i/beui/animated-sidebar`):
`siteDark=false`, canvas `oklch(0.141 0.005 285.823)` with `data-stage-theme="dark"`, `<iframe>` the same,
child `<html>` class `dark`, child root `rgba(0,0,0,0)`, and the header band stays the **site's** light surface
(`rgb(244,244,245)`) with `rgb(9,9,11)` ink. The stage shows the demo's theme; the chrome keeps the site's.

Centring (child rect vs canvas rect, both sides, 1440):

| width preset | before (`left/right` gap, frame px) | after |
|---|---|---|
| 390 | 153 / 153, frame 390 | 153 / 153, frame 390 |
| 768 | 41 / 41, frame 614 | 17 / 17, frame 662 |
| full | 41 / 41, frame 614 | 17 / 17, frame 662 |

The 390 px frame was already centred on a single-demo page; what was *not* was the frame against the canvas' own
padding (41 px of `.demo-body` padding + card padding, i.e. the frame sat inside a second box). Now there is one
lane with 16 px of air and the frame is centred in it on both sides, at every preset — the numbers are symmetric to
the pixel, and no demo is pushed to the left of its own stage.

### 2 · The cap — 560 px, and the demo scrolls inside it

| | before | after |
|---|---|---|
| canvas height, `form-formisch-complex` | **1289** px | **605** px |
| frame height (kept, not squashed) | 1083 | 1083 |
| the box that scrolls | none (`canvas overflow-y: hidden`) | `.stage-win`, 560 px, `scrollHeight` 1115 |
| canvas height, `shadcn/button` (14 demos) | **4956** px | **181** px |
| canvas height, 375×812 | **1499** px | **537** px (win 480 on a phone) |

The height report is untouched: `FLOOR` (block 900/720, other 180), `SELF_FLOOR` (900/720 and 360) and the measured
percentile table in the docblock all stay, and the docblock gains a paragraph distinguishing the floor (a
reservation) from the cap (a window). The frame is never shrunk to the cap and the overflow is never hidden: what
does not fit is reachable by scrolling **inside** the canvas, and `.stage-win` carries `tabindex="0"` +
`aria-label` so the scroll is keyboard-reachable.

### 3 · Two stacked bars → one header row

| | before | after |
|---|---|---|
| rows in the bar | 2 (console: THEME/WIDTH/MOTION; then a card header with Example + Preview/Code + Copy) | **1** (`headH` 43 = 32 px controls + 2 × 4 px padding + 1 px hairline) |
| control heights | `44,44,44,44,44,44,44` (segments) beside a 32 px Copy | `32,32,32,32,32,32,32` — one height |
| title bottom → bar | **9** px | **33** px (space-6 + the 1 px border) |
| label → control | 9 px (and no label visible at all below 375) | **8** px (measured inside the visible cluster) |
| repeated toolbars on `shadcn/button` | `demoHeads` **14** | **0** |

The row is: the demo's name on the left, then the three settings groups, then Preview/Code, then Copy, right-aligned.
`gap` between groups is 16 px (`--space-4`), 8 px inside a cluster. The settings stay inline wherever a mouse
reaches; at 375 px they fold into one `Stage` button (below).

At the 696 px column the three group words are dropped by a container query on the canvas so the row stays one row:
with the words the row needs 703 px in a 694 px band (two rows — measured, `headH` 85), without them 650 px.

### 4 · Selected state — proven by painted pixel

Same screenshot, sampled 6 px inside each segment's left edge and 8 px up from its bottom (clear of the glyphs), so
the number is what the compositor put there:

| | before | after |
|---|---|---|
| dark: unselected vs selected | `rgb(24,24,27)` / `rgb(24,24,27)` — **delta 8** (sampling noise; the state was the bar's own colour) | `rgb(24,24,27)` / `rgb(9,9,11)` — **delta 16** |
| light: unselected vs selected | `rgb(244,244,245)` / `rgb(244,244,245)` — **delta 6** | `rgb(244,244,245)` / `rgb(255,255,255)` — **delta 11** |

The rule: `surface-100` fill on a `surface-300` track, `ink` at 600, plus an inset `border-strong` outline — the
review's own prescription. Delta 11 in light is one surface step; the outline is what carries the state at a
glance, and it is why the fill alone was not trusted.

### 5 · One stage, variants as a tab strip

`shadcn/button`: `demoHeads` 14 → **0**, `.demo` cards 14 → 0, `<iframe>`s on the page **1**, `[data-stage-bar]`
**1**, `.stage-tab` **14**. State survives a switch, measured: pick `light` + `390`, click the 5th tab →
`data-stage-theme="light"`, frame width **390**, active tab "Secondary", one iframe, one bar.

### 6 · Titles are names

| | before | after |
|---|---|---|
| `#/i/shadcn/button` `<h1>` | `button` | **Button** |
| `#/i/shadcn/form-formisch-complex` `<h1>` | `form-formisch-complex` | **Formisch form, complex** |

`readableName` is mechanical and never invents: a name that already carries a capital after its first letter or a
space is printed verbatim ("Animated Sidebar"); a single lowercase word is capitalised; inside a slug a known library
word keeps its capital from a written-down list (`formisch, shadcn, beui, tanstack, radix, framer, recharts, valibot,
vaul, cmdk, base, dnd, primereact, chakra, mantine, daisyui, flowbite`); `<subject>-<library>-<rest>` becomes
`Library subject, rest`. 359 of the 769 manifest names contain a dash, 361 have no capital at all.

The **lede** is the one thing I could not deliver: `ItemPage` already prints `item.one_line` when present, and
`shadcn/button` and `form-formisch-complex` have `one_line: null`. **462 of 769** items have no `one_line` and the
manifest carries no docs prose — only `url`/`page` (an address, not a sentence). I did not invent one; see
COULD NOT DO.

### 7 · Prev / next

| | before | after |
|---|---|---|
| text | `←form-formisch-checkbox` + `same category` | `← Previous: Formisch form, array` / `Next: Formisch form, demo →` |
| `shadcn/button` neighbours | previous = **Emoji Reaction**, next = button-group (`same category`) | previous = **Button**, next = **Button as child** — both inside the item's own type |
| phone clipping (`.related-title` overflow) | **34 px** on the previous card | **0 px** |
| phone card height | 44 px, name cut | 72 px, two lines (word, then name underneath) |

Neighbours come from the taxonomy (`typeOfItem` from `site/taxonomy.ts` read-only, `typeHref` from
`site/typeIndex.ts`), ranked in the type's own A–Z order and wrapping. Variants and withheld items (320 + 93) have
no type and keep the shell's `neighbours()` from `site/route.ts`, so no item page loses its pager.

Desktop truncation: 11 px on the *longest* name in the catalogue at the 696 px column ("Formisch form, array", with
the relation line still on the right of the same 44 px row). Full name is in `title` and in `aria-label`; phone is
0 px. If that 11 px matters, the fix is to drop the relation line on desktop too — a one-line change I did not make
because r8 put it in the row deliberately.

### 8 · "Compare with the N others" → the type page

| | before | after |
|---|---|---|
| `shadcn/button` | "Compare with the 3 others" → `#/c/button` (4 members) | **"Compare with the 20 others in Button"** → `#/t/components/button` (21 members) |
| `form-formisch-complex` | (none) | "Compare with the 41 others in Field and form" → `#/t/components/field-and-form` (42) |

The number is `members.length - 1` from the same `TypeEntry` the type page renders, so the label matches what the
page shows by construction, and `#/c/` is no longer referenced from an item page.

### 9 · Phones (375×812)

| | before | after |
|---|---|---|
| bar height | **106** px (three wrapped rows) | **55** px (one row) |
| words | `lightdark` / `390768full` / `onoff` — labels lost | one `Stage` button opens a 320 px popover: `theme`, `width`, `motion`, each 44×44, all five remaining segments 44×44 with their words back |
| width presets offered | 390, **768, full** (neither usable) | `full` only at 375 (`390` and `768` are wider than the window and are filtered out; `full` is the column, which is the screen) |
| "Preview" written twice | yes (label + segment) | once |
| demo starts at | y 475 | y 344 |
| page horizontal overflow | 0 | 0 |

The demo name is hidden in this row on a phone (`.stage-head .stage-name { display: none }` below 640 px): measured,
the other five controls take 274 of the row's 341 px, which left the name 15 px — "D…". The variant strip under the
row names the same demo in full, so what the phone drops is a duplicate.

---

## What I could not do

- **A lede for items without `one_line`.** 462 of 769 items have `one_line: null` and the manifest has no docs prose.
  The page prints the lede when the field exists and nothing when it does not. Writing a sentence would be invention,
  which the design-system binding forbids.
- **Update the two gates that encode the old rules.** See below — this is the one deliverable left undone.
- **Run the gate suite.** Per the lead's instruction I ran none of the seventeen on this build; the earlier runs in
  this session were `python3 app/check_chrome.py` (green — 28 shell files) and the measurement scripts above.

## Gates that now encode the wrong rule (must be changed **with** this change, not by deleting an assertion)

1. `qa/stage_check.mjs`
   - `controls ≥44px` asserts the r8 number. r9's rule is **one height, 32 px, on a mouse, 44 px on a touch
     viewport** — the brief's own wording. It should assert one height and that height 32 at 1440, and the ≥44
     floor should stay asserted at 390 (where `mobile_state_check` already runs it).
   - `r8 console segments are neutral` asserts `bg === surface-300 && weight >= 600` for the selected segment.
     r9 paints the selected segment `surface-100` + `border-strong` outline. It should assert `surface-100`, `ink`,
     weight ≥ 600, **never accent**, **and that the selected and unselected painted pixels differ** — the brief asks
     for proof by painted pixel, and the pattern for reading pixels is already in `demo_theme_check.mjs`.
   - `r8 390: … one 44 px row` asserts pager card heights `=== 44`; the phone pager is now two lines (measured 72).
     It should assert "heights all equal, ≥ 44, and `.pager-name` not clipped" — the clipping number is the actual
     defect that was reported.
2. `qa/demo_theme_check.mjs` — **B** asserts the demo document's `html`/`body` are an opaque colour of the right
   polarity. That is exactly what r9 reverses on purpose: the document paints nothing and the frame element paints
   the paper. B should assert the document is transparent (the new contract, so a future regression that re-adds a
   page colour fails here) and the "opaque paper of the right polarity" assertion belongs to **C**, which already
   measures the `<iframe>` element on the item page and still passes. A (pre-JS) should keep asserting the theme is
   resolved before first paint via the child's `<html>` class and `color-scheme`; its painted-average leg measures a
   standalone `demo.html`, which is now legitimately paperless.
   D (the gallery sweep) is untouched by this unit and still asserts the r8b failure mode.

## Unsure, verbatim

- Whether dropping all three group words at the 696 px column is right. With them the row is 703 px in a 694 px band
  (two rows, measured); without them the row is one row and `on / off` sits next to the replay chip unlabelled. The
  alternative is a `Stage` popover on desktop too, which the review allowed ("or a single Stage popover").
- 11 px of desktop truncation on the longest pager name (above) — I judged it acceptable because the mobile case was
  the reported one.
- I added `aria-label` to the `ToggleGroup`s and made each group a roving-tabindex radio group, but I did not run
  `smoke`/`tap_check`/`contrast_check` on this build (lead's instruction), so the tab-stop count and contrast of the
  new `surface-100`-on-`surface-300` selected chip are unverified by gate. Measured by hand: 3 tab stops in
  `[data-stage-bar]` (one per group), every control 32 px at 1440 / 44 px at 375, and `ink` on `surface-100` is the
  same pairing the design system already uses for a card title.
- `site/demo.tsx`'s `FRAME_SURFACE` docblock still says the child document paints `var(--background)` on its root.
  It no longer does. That file is not mine; it is a one-sentence doc correction for its owner.
- Two builds after the measured one, both accounted for: (a) `assets/main-C1509Sns.js` raised the container-query
  threshold to 600 px as an experiment — it made the header wrap to 85 px at the 696 column, so the committed CSS
  keeps 760; (b) the committed CSS adds the phone-only `display: none` on `.stage-name` after the last build, a rule
  that removes an element from the row and so cannot grow it, but it was not re-measured.
