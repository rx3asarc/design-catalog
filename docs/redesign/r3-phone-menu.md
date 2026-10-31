# r3-phone-menu — the Browse menu, and the strip that covered the page

Two review items, one cause: at phone widths the rail was a *flex item in a column that is exactly one
viewport tall*, and a reserved strip sat under everything.

* **#8 (blocker)** tapping "Browse 769" showed "Close" and nothing else: every menu row was laid out past the
  clipped box, with the page painted over it. On the gallery the menu collapsed to a sliver.
* **#14 (minor, break)** the fixed/lane theme control sat over demo fields and gallery tiles at narrow widths.

Branch `fleet/r3-phone-menu`, base `master @ d5d2a226`. Four commits, one per numbered item:

```
9943f97f  item 4: grid icon stays decoration in a 44 px row; no text in the menu under 12 px
7c04e58b  item 3: the theme control is the menu's first row; the fixed strip is gone
d3a92cf6  item 2: it closes like a menu — Escape, backdrop, focus back on the trigger
94eb3237  item 1: the open menu is an overlay that owns its own scroll
```

Files changed: `app/src/styles.css`, `app/src/site/Rail.tsx`, and `app/src/App.tsx` **as a mount only**
(one import added, the phone branch renders `<PhoneRail>` where it used to render two divs, the
`.theme-switch-float` mount deleted — nothing else moved into the shell; no portal was needed).

Harness: `r3-phone-menu-measure.mjs` (same directory). Before/after JSON: `r3-phone-menu-before.json`,
`r3-phone-menu-after.json`. Run it exactly as its header says: `npx vite build` in `app/`, serve `app/dist`
under `/design-catalog/`, `node r3-phone-menu-measure.mjs`.

---

## 1. The rule that was actually responsible (measured, not guessed)

The brief named `.cat { height: 100dvh; overflow: hidden }` as the suspect. It is, together with the rail's own
`flex: 0 1 auto`:

```
cat:   display: flex; flex-direction: column; height: 100dvh; min-height: 100dvh; overflow: hidden   (≤860)
rail:  flex: 0 1 auto  (registry default)        page: flex: 1 1 auto
menu-open .rail-list { max-height: 70dvh }       ← the rule people blame; it never bound
```

Measured on the pre-fix build at 375×812 (`before.json`): the open panel was **375×222 `static`**, its own
scroll box 290/221, and `.rail-list` was a **46 px** viewport holding **4578 px** of tree. `70dvh` at 812 px is
568 px — the list never reached it. So the shrink, not the max-height, decided the height, and every row below
46 px was laid out with the page on top of it.

Isolated on the shipped build (§2b of the harness): put the panel back in the flow with one injected rule
(`position: static` + the old `max-height: 70dvh`) and nothing else changed —

```
shipped        panel fixed flex 0 1 auto → 747 px, scroll box 4897/747, .page 747 px,
               .rail-list 4578 px tall, max-height none          first ten rows hit as the row: 10/10
pre-fix rule   panel static flex 0 1 auto → 258 px, scroll box 888/258, .page 489 px,
               .rail-list 568 px tall (the 70dvh cap — inside a 258 px box)   first ten rows: 0/10
```

0/10 with the panel static, 10/10 with it fixed. That is the rule, demonstrated on one build with one variable.

**Fix:** the menu leaves the flow. `position: fixed`, `top: var(--phone-header)`, `bottom: auto`,
`max-height: calc(100dvh - var(--phone-header))`, `overflow-y: auto`, `overscroll-behavior: contain`,
`display: block` (a flex column shrinks overflowing children before it scrolls — the bug in miniature), one
scroller instead of two (`.rail-list` becomes `overflow: visible`), rows keep their 44 px.
`--phone-header` is the sticky header's real height, measured by `PhoneRail` on mount and resize; the
stylesheet's 65 px fallback is 44 + 2×10 + the header's rule.

z-index ladder now: `.page` auto → header 20 → *(30 free: the deleted lane)* → backdrop 34 → menu 35 →
palette 50. The menu is above everything except the palette, and it starts *below* the header, so the
Browse/Close trigger stays tappable while the menu is open.

## 2. Hit tests — the assertion that failed, at 375 / 600 / 768

`elementFromPoint(row centre)` must be the row or inside it. Panel geometry first:

| viewport | before panel | before `.rail-list` viewport | after panel | after list |
|---|---|---|---|---|
| 375×812 | 375×222 `static`, z auto | 46 px of 4578 | 375×747 `fixed`, z 35 | 4578 / 4578 |
| 600×900 | 600×275 `static`, z auto | 78 px of 4578 | 600×835 `fixed`, z 35 | 4578 / 4578 |
| 768×1024 | 768×346 `static`, z auto | 150 px of 4578 | 768×959 `fixed`, z 35 | 4578 / 4578 |

First ten menu targets, before → after (375×812; the theme row is in the menu after item 3, which is why the
first three rows are the switch's segments):

| # | target | before | after |
|---|---|---|---|
| 1 | Theme: auto | — (not in the menu yet) | **ROW** 44×44 |
| 2 | Theme: light | — | **ROW** 44×44 |
| 3 | Theme: dark | — | **ROW** 44×44 |
| 4 | filter input | ROW 347×44 @14,128 | **ROW** 347×44 @14,204 |
| 5 | all sources | ROW 79×44 @14,203 | **ROW** 79×44 @14,279 |
| 6 | shadcn | ROW 61×44 @98,203 | **ROW** 61×44 |
| 7 | beui | ROW 44×44 @163,203 | **ROW** 44×44 |
| 8 | Blocks and pages (20) | **MISS** 359×44 → hit `H2.title` | **ROW** 359×44 @8,316 |
| 9 | its grid door | **MISS** 28×28 → hit `H2.title` | **ROW** 28×28 |
| 10 | signups (6) | **MISS** 359×44 → hit `P.lede` | **ROW** 359×44 @9,360 |

Ten of ten pass at 375, 600 and 768 after the change (`firstTen pass 10/10` in all three). Before: 7/10 at 375
(the header, the filter and the source pills were the only reachable rows), 10/10 at 600 and 768 — but only
because those rows happen to sit inside a 78 px / 150 px window; on those widths the brief's "one and a half
rows at a time" is the bug, and rows below the window were covered the same way.

The stronger check is the sweep: scroll the whole tree and hit-test *every* row that is fully inside the
reachable window (panel ∩ list, minus the sticky first row).

| viewport | before: rows reachable / passing | after: rows reachable / passing |
|---|---|---|
| 375×812 | window −22 px → **0 / 0** | 250 / **250** |
| 600×900 | window 78 px → 42 / 42 | 208 / **208** |
| 768×1024 | window 150 px → 121 / 121 | 206 / **206** |

## 3. It closes like a menu (375×812 and 768×1024)

| action | before | after |
|---|---|---|
| trigger | "Browse 769" ↔ "Close", `aria-expanded` toggles, panel flex/none | same, and "Close" is now true: the panel is really closable |
| Escape (focus on a tree row) | `aria-expanded` **true**, panel still shown, focus `button[Close]` | `aria-expanded` **false**, panel none, focus **`button[Browse 769]`** |
| backdrop tap | **no backdrop element existed** (`veil absent`) | `Button.menu-veil` z 34, inset below the header; with a filtered tree the sheet ends at y 431 and **381 px** of backdrop are exposed (642 px at 768); the tap lands on `backdrop` → closes, focus back on the trigger |
| navigation inside it | closes (already worked, via `useRoute`) | closes: `#/i/beui/availability-scheduler` → panel none, `aria-expanded` false |
| taps around an open menu | reached page content | four probe taps (bottom, left edge, just under the header, right edge) all land on `panel` — none on the page |

Escape is ignored while the palette dialog is open (it owns its own Escape). The backdrop is `tabIndex={-1}`
so it does not join the tab order, and closing always returns focus to the trigger — found through the
trigger's own `aria-controls="rail"`, so no ref is threaded through the shell.

## 4. The panel's own scroll, and the last row

Expanding every level gives **539 rows**. Scrolled to the end at 375 and 600: `.rail-phone` is the scroller
(23335/23335 and 23198/23198), the last row ("Typeset", `#/i/shadcn/docs-typeset`) sits at y 728 inside the
window, hit-tests as itself, and tapping it navigates — panel closes, `#/i/shadcn/docs-typeset`. Before: the
panel was not a scroller at all (setting its own `scrollTop` moved nothing, 0/0 at 600); the list inside it was
78 px tall holding 4578 px, so the "last row" the test could reach was at y 23938 — outside the panel, not hit
at its centre — and the tap left the hash at `#/`.

## 5. Fixed boxes over content — 375 / 600 / 768 / 1280, top / middle / end

Counting only what is actually on screen (tile and demo-field boxes clipped by every clipping ancestor and by
the viewport, so a scrolled-away tile can neither fake a pass nor a fail). Routes `#/g`, `#/i/shadcn/button`,
`#/`; three scroll positions each.

| viewport | before overlaps (tiles / demo fields) | after |
|---|---|---|
| 375×812 | 0 / 0 (the lane was `static`, so nothing was *fixed* — see below) | **0 / 0** |
| 600×900 | 0 / 0 | **0 / 0** |
| 768×1024 | 0 / 0 | **0 / 0** |
| 1280×900 | 2 (desktop Search float) | 2 (unchanged — see *what the lead must wire*) |

The **#14** strip was not `fixed` in the end: it was the last flex item of the phone column, 67 px of a
100dvh column, i.e. 375×67 at y 745 on a 375×812 screen (measured on the pre-fix build) and 600×67 at y 833 on
600×900 (the brief's own reproduction, "1 tile under it mid-scroll"). It was also `z-index: 30`, above the menu
panel (z 27 at that moment): with the menu open, **8** of the rows the panel showed hit-tested as
`DIV.theme-switch-float`. Both are gone with the strip — 0 fixed boxes over content at every phone width, and
0 occurrences of `.theme-switch-float` left in `src/`.

## 6. Targets and type in the menu (375 / 600 / 768)

* **113 primary targets** (3 theme segments, the filter, 6 source pills, every level trigger, every leaf row):
  **0 under 44 px**, smallest **44×44**. Before: the heights were already right (44 px on the phone), but of
  the rows whose box was inside the viewport, **0/11 at 375, 2/14 at 600, 3/17 at 768** were the element at
  their own centre — the rest were clipped or covered.
* **Which element carries the hit area:** the **row** — `SidebarMenuButton` (a level's `.disc-trigger`) or the
  leaf's `<a class="rail-item">`, full width, 44 px tall, hit-tested at its centre across the whole tree.
* The **grid door stays 28×28** (38 of them): it is decoration at the right edge of a 44 px row, and it keeps
  the WCAG 2.5.8 floor rather than claiming 44 px of a 44 px row. A 44×44 door would turn "open this level"
  taps near the count into "open a grid". Its own hit area is real; the row's is the one the brief asked about.
* **Text ≥ 12 px:** before, the menu's smallest was **10 px** ("Theme", "no demo") over an **11 px** step
  (`--t-label`: the count on every level row, "769 items · 486 rendered", the legend) and 11 px theme segment
  words. After: `.rail-phone` re-declares `--t-label: 12px` and names the three, smallest text **12 px** at all
  three widths. Desktop keeps 10/11 px — nothing outside `.rail-phone` changed.

## 7. Everything else the brief asks to see stay green

```
#/g at 390×844      live frames 2      tiles 551      horizontal overflow 0      .page scrolls true
console errors      0 (all sections, all widths)
check_chrome.py     exit 0 — "chrome: every interactive element is a catalogue component"
page turn           250 ms with motion · 0 animations under prefers-reduced-motion
desktop 1280×900    theme switch still the rail's first row (sticky, 247×54, 3 × 44×44 at 11 px),
                    no .rail-phone in the DOM, header still display:none
```

---

## What the lead must wire

1. **One pre-existing overlap is left, and it is not mine.** At 1280×900 on `#/g`, the desktop Search float
   (`CommandPalette.tsx`, `place="float"`: `fixed right-4 bottom-4 z-30 h-9`) covers the corner of one gallery
   tile at the top of the scroll and one at the middle — **2 intersections before, 2 after**, unchanged by
   this round. `CommandPalette.tsx` is outside my files, so I measured it and left it. If the rule "no fixed
   element over a tile" is to hold on desktop too, that control needs the theme switch's treatment (dock it in
   the rail column, or give the page column a bottom reserve it cannot scroll under) — a decision for whoever
   owns the palette.
2. **App.tsx took exactly one mount.** The phone branch now renders `<PhoneRail open={menu} onClose={() =>
   setMenu(false)} head={head} rail={rail} />` instead of the two divs it already rendered, and the
   `.theme-switch-float` block is deleted. If a fifth surface is ever added to the shell, mount it the same way
   instead of growing App.
3. **The z-index ladder is now a contract:** page auto · header 20 · backdrop 34 · menu 35 · palette 50
   (30 is free again). Anything that floats over the page must sit under 50 and above 35, or the menu will
   swallow it — that is how the old lane ended up over 8 menu rows.
4. **`--phone-header` is measured at runtime** (`PhoneRail`, ResizeObserver on `.topbar`, plus `resize`), with a
   65 px CSS fallback. If the header gains a row, it must stay inside `.topbar` or the panel's top edge will be
   wrong by exactly that row.
5. **On a phone the theme control now lives only inside Browse** — that is the brief's instruction (no fixed
   strip over content at any width). If product wants it always reachable, the brief's own rule applies: a
   full-width bar with a solid background *and* the scroller padded by its height, so nothing is only reachable
   through it. A float will not do.
6. **Nothing else was touched:** `Home/Tile/Gallery/ItemPage/Compare/route/Code/demo/CommandPalette/provenance/
   Stage.tsx`, `index.html`, `gen.py`, `manifest.json`, `demos/**`, `docs/**`, `publish.sh` — no diff, no new
   dependency, `app/node_modules` is a symlink to the shared install so no second 420 MB copy.
