# Round 7 — the gates for the three things round 6 closed

`23d8b824` ("the three things the round-6 report left open, closed") shipped three behaviours and a gate for none
of them: a measured line on the item page, a phone menu that opens closed, and the deletion of the floating
palette button. A behaviour without a gate is a behaviour that regresses silently. This unit writes the three
gates in `qa/`, proves each one passes on the current build, and proves each one **fails on the build before the
fix** — the failure output is quoted below, verbatim.

All three scripts are committed on `fleet/r7-gates` and mirrored to `/root/docs/catalog-redesign/qa/`. Nothing in
the prohibited set was touched (`app/gen.py`, `manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`,
`master`); `app/src/**` is byte-identical to `23d8b824` — no behaviour was edited to make a gate pass.

```
node qa/pick_line_check.mjs   [base]      # 13 ids: 10 measured, 3 unmeasured, + 3 measured-no-demo
node qa/rail_density_check.mjs [base]     # 390 with the menu open, then 1440
node qa/float_check.mjs        [base]     # 3 routes × 1440 and 390, plus 390 with the menu open
```

`[base]` defaults to `http://localhost:8830/design-catalog/`, the same default as `qa/tap_check.mjs`.

---

## What was measured, on what

| | |
| --- | --- |
| current build | `23d8b824` (branch `fleet/r7-gates`), served at `http://localhost:8871/design-catalog/` — asset hash `main-BltL8WrW.js` |
| same build, second server | `http://localhost:8830/design-catalog/` (`/tmp/serve` → `/root/design-catalog-site/docs`) — asset hash `main-BltL8WrW.js` |
| pre-fix build | `git worktree add /tmp/prev-r7 3541e345` + `cd app && npx vite build && cp -r dist/* ../docs/`, asset hash `main-Dw1l6Bs_.js` |
| browsers | Playwright from `/root/camofox-browser/node_modules/playwright`, `/usr/local/bin/google-chrome`, `--no-sandbox --disable-dev-shm-usage` |

Two notes about the run, because a silent port collision is what burned two earlier gate runs:

- **The pre-fix build is the real one.** After `npx vite build` and the copy into that worktree's `docs/`,
  `git status` in `/tmp/prev-r7` is **clean**: the rebuild is byte-identical to the `docs/` committed at
  `3541e345`, and its `index.html` names `main-Dw1l6Bs_.js` while the tree in commit `3541e345:docs/index.html`
  names the same file. So the failure outputs below are from the pre-fix build, not from a mis-served directory.
- **Which port serves what.** The brief asks for the pre-fix build on `8871` *and* for `8871` to pass at the end.
  Both were honoured in sequence: `8871` served `/tmp/prev-r7/docs` while the failures were recorded, then was
  repointed at the current build and re-verified (`main-BltL8WrW.js`, HTTP 200) for the green runs and for the
  done criteria. The pre-fix build is left running at **`8872`** so the failures stay reproducible without
  disturbing `8871`. `8830`, `8841`, `8851` were never used — only read from.

---

## 1. `qa/pick_line_check.mjs` — the measured line is a measurement, and it costs the page nothing

Six assertions per measured item, at 1440×900, plus one at 390:

| # | assertion |
| --- | --- |
| 1 | a measured item prints **exactly one** `[data-pick]` |
| 2 | that text is **one sentence**: exactly one full stop, and it ends with it |
| 3 | it **says where it came from**: contains `measured in this demo` |
| 4 | it names **no rank, winner, score or best** (`behaviour.ts` rule 3 — a fact is not a verdict) |
| 5 | it is **not the first Copy**: the page's first Copy control is still `Copy install command`, and the line sits after it in document order |
| 6 | it **does not push the install block off the page**: the block is present, a real box, above the line, inside the scrolling column, and not covered |

| # | assertion (unmeasured / measured-without-a-demo) |
| --- | --- |
| 7 | an **unmeasured** item prints **no** `[data-pick]` at all — not a dash, not "not measured" (`behaviour.ts` rules 1 and 4) |
| 8 | a **measured item with no demo** prints no line either (see the finding below — this is measured, not assumed) |

**Current build — 13 ids, all green.**

```
ok   measured shadcn/sidebar-09: one [data-pick] — 1 element
ok   measured shadcn/sidebar-09: one sentence — 1 full stop, ends with it
ok   measured shadcn/sidebar-09: says where it came from — "measured in this demo" present
ok   measured shadcn/sidebar-09: no rank/winner/score/best — 0 verdict words
ok   measured shadcn/sidebar-09: not the first Copy — first Copy = "Copy install command", 3 copy controls, line after it
ok   measured shadcn/sidebar-09: install block still on the page — block 107 px at y=831 (bottom 882 of 3095 in main.relative), line at y=954
...
ok   unmeasured shadcn/button: no [data-pick] — 0 elements
ok   unmeasured shadcn/accordion: no [data-pick] — 0 elements
ok   unmeasured beui/bloom-menu: no [data-pick] — 0 elements
ok   measured-no-demo beautifului/sidebar-nav: no demo, no line — 0 elements (the slot is inside the demo branch)
ok   measured-no-demo rareui/hook-sidebar: no demo, no line — 0 elements (the slot is inside the demo branch)
ok   measured-no-demo shadcn/docs-components-sidebar: no demo, no line — 0 elements (the slot is inside the demo branch)
ok   390 measured shadcn/sidebar-09: line fits the column — 1 element, 358 px wide, right edge 374 ≤ 390, page scrollWidth 390
PICK: ok (10 measured, 3 unmeasured, 3 measured-no-demo)
```

Measured sample: `shadcn/sidebar-09`, `beui/animated-sidebar`, `beui/ai-sidebar`, `beui/bounce-sidebar`,
`shadcn/sidebar`, `shadcn/sidebar-01`, `shadcn/sidebar-04`, `shadcn/sidebar-05`, `shadcn/sidebar-13`,
`shadcn/sidebar-16` — 6 assertions each, 60 green. Unmeasured: `shadcn/button`, `shadcn/accordion`,
`beui/bloom-menu` (all three reach the demo branch, so the assertion has teeth).

**Pre-fix build (`8871` while it served `3541e345`) — 51 FAIL, exit 1.** The first two items, in full:

```
FAIL measured shadcn/sidebar-09: one [data-pick] — 0 elements
FAIL measured shadcn/sidebar-09: one sentence — null full stops, endsWithStop=false, text=""
FAIL measured shadcn/sidebar-09: says where it came from — "measured in this demo" absent
ok   measured shadcn/sidebar-09: no rank/winner/score/best — 0 verdict words
FAIL measured shadcn/sidebar-09: not the first Copy — first Copy = "Copy install command", line after first Copy = false
FAIL measured shadcn/sidebar-09: install block still on the page — present=true h=107 blockTop=831 lineTop=null blockBottomInColumn=882 column=2981 uncovered=true
FAIL measured beui/animated-sidebar: one [data-pick] — 0 elements
...
FAIL 390 measured shadcn/sidebar-09: line fits the column — n=0 right=null docWidth=390 scrollWidth=390
PICK: 51 FAIL
```

51 = 10 measured ids × 5 (assertions 1–3, 5, 6) + 1 phone assertion. Assertion 4 passes vacuously on an absent
line, which is correct: there is no verdict in a sentence nobody printed.

---

## 2. `qa/rail_density_check.mjs` — a phone sheet at 390, the index at 1440

| # | assertion |
| --- | --- |
| 1 | at **390×844 with the menu open**, visible rows in `.rail-phone` are **≤ 6** |
| 2 | those rows are the **four section names** (Blocks and pages · Components · Motion and effects · Docs) |
| 3 | **no leaf is pre-expanded** — 0 of the rows are `.rail-item` |
| 4 | opening **one section** reveals its rows (row count goes **up** from the closed baseline) |
| 5 | opening it **does not navigate away** (address unchanged — the trigger is a disclosure, the count badge beside it is the door to the grid) |
| 6 | opening it **does not close the menu** |
| 7 | at **1440** the rail shows the **full tree**: rows **> 40** |
| 8 | at **1440** every section is open — the phone's default-closed must not reach the desktop |

A row is an element with a box (`.rail-sec`, `.rail-cat`, `.rail-sub`, `.rail-sub2`, `.rail-item`); a
`display:none` row inside a closed section has none, which is exactly the difference the fix made.

**Current build — green.**

```
ok   390 menu open: rows ≤ 6 — 4 rows, panel 539 px, scroll 538 (was 103 / 779 / 4894)
ok   390 menu open: the rows are the four section names — 4/4 — Blocks and pages · Components · Motion and effects · Docs
ok   390 menu open: no leaf pre-expanded — 0 of 4 rows are leaves
ok   390 open one section: it reveals its rows — 4 → 15 rows, scroll 538 → 1022
ok   390 open one section: it does not navigate away — address #/ → #/
ok   390 open one section: the menu stays open — panel still .is-open
ok   1440: the rail shows the full tree — 103 rows > 40
ok   1440: every section is open — 4/4 sections open
RAIL: ok
```

**Pre-fix build — 4 FAIL, exit 1** (and the numbers are the ones the r6 report quoted):

```
FAIL 390 menu open: rows ≤ 6 — 103 rows, panel 779 px, scroll 4894
FAIL 390 menu open: the rows are the four section names — 4 section rows, missing ["Blocks and pages","Components","Motion and effects","Docs"], labels ["Blocks and pages20signups6logins5Availability Sc","Components585Navigation66Forms and input126Overl","Motion and effects56images4Image GenerationImage","Docs108components60registry11installation10dark5"]
FAIL 390 menu open: no leaf pre-expanded — 65 leaf rows of 103
FAIL 390 open one section: it reveals its rows — 103 → 92 rows (no increase)
ok   390 open one section: it does not navigate away — address #/ → #/
ok   390 open one section: the menu stays open — panel still .is-open
ok   1440: the rail shows the full tree — 103 rows > 40
ok   1440: every section is open — 4/4 sections open
RAIL: 4 FAIL
```

---

## 3. `qa/float_check.mjs` — nothing floats over the catalogue, and the next one fails too

The rule is a property of the *set*, not a search for a button labelled "Search":

> every element whose computed `position` is `fixed` must be **the top bar** (`header.topbar`), **the registry
> sidebar** (`[data-slot="sidebar-container"]`), or **inside one of them**.

That is the point of the gate: a check for one removed control passes the day the same control returns under
another name, while "no fixed element outside the two surfaces that own the frame" fails for every future corner
pill, floating action button, sticky toast or sticky banner. The exemption list is two selectors long, in this
file, under review.

One extra allowance, and only while it is open: the phone menu — `.rail-phone` (the fixed sheet) and
`.menu-veil` (its fixed backdrop). They are the phone's only surface above the page, gate 2 governs what is
inside them, and both vanish when the menu closes — which is why the *closed*-menu phone pass must stay clean.

| # | state |
| --- | --- |
| 1–3 | 1440×900 on `#/`, `#/i/shadcn/sidebar-09`, `#/g`: no fixed element outside the two surfaces |
| 4–6 | 390×844, menu shut, same three routes: same rule |
| 7 | 390×844, menu open: only the menu's sheet and backdrop may be fixed |

**Current build — green.**

```
ok   1440 #/: no fixed control outside the bar and the sidebar — 2 fixed element(s), all inside ["header.topbar","div[data-slot=sidebar-container]"]
ok   1440 #/i/shadcn/sidebar-09: no fixed control outside the bar and the sidebar — 2 fixed element(s), all inside ["header.topbar","div[data-slot=sidebar-container]"]
ok   1440 #/g: no fixed control outside the bar and the sidebar — 2 fixed element(s), all inside ["header.topbar","div[data-slot=sidebar-container]"]
ok   390 #/: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 #/i/shadcn/sidebar-09: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 #/g: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 menu open: only the menu is fixed — 2 fixed element(s) — ["button[data-slot=button]","div.rail"]
FLOAT: ok
```

**Pre-fix build — 3 FAIL, exit 1**, and it names the size and corner the r6 report named:

```
FAIL 1440 #/: no fixed control outside the bar and the sidebar — 1 of 3 fixed element(s) unowned — <button class="inline-flex.shrink-0"> "Search 769CtrlK" 134×36 at 1290,848
FAIL 1440 #/i/shadcn/sidebar-09: no fixed control outside the bar and the sidebar — 1 of 3 fixed element(s) unowned — <button class="inline-flex.shrink-0"> "Search 769CtrlK" 134×36 at 1290,848
FAIL 1440 #/g: no fixed control outside the bar and the sidebar — 1 of 3 fixed element(s) unowned — <button class="inline-flex.shrink-0"> "Search 769CtrlK" 134×36 at 1290,848
ok   390 #/: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 #/i/shadcn/sidebar-09: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 #/g: no fixed control outside the bar and the sidebar — 0 fixed element(s), all inside []
ok   390 menu open: only the menu is fixed — 2 fixed element(s) — ["button[data-slot=button]","div.rail"]
FLOAT: 3 FAIL
```

---

## Findings (things this unit measured that the brief did not predict)

**F1 — five of the 25 measured items print nothing, and one of them is a genuine inconsistency.** The manifest
carries a `behaviour` record for 25 ids; 20 print the line. The other five:

```
beautifului/sidebar-nav        withheld (code not shown)    no line
rareui/bounce-sidebar          withheld (code not shown)    no line
rareui/hook-sidebar            withheld (code not shown)    no line
rareui/proximity-sidebar       withheld (code not shown)    no line
shadcn/docs-components-sidebar text, no demo, not withheld  no line
```

Four are withheld and take the `withheld` branch in `site/ItemPage.tsx`. The fifth is the interesting one: the
line is rendered **inside the demo branch** (`{pickNote && …}` sits between `InstallBlock` and the stage), so any
measured item without a demo silently loses it — and `shadcn/docs-components-sidebar` is exactly that. It is a
`text` item with no variants, so its page ends in "No demo for this one". The claim "the item page prints the
measured line when the probe has facts" is therefore true for 20 of 25 ids, not 25. Assertion 8 pins the
carve-out rather than hiding it, so the day the line moves above the branch the gate says so; the honest fix
(moving the line out of the demo branch) is a behaviour change and was **not** made here, per the brief.

**F2 — `beui/loading-state` does not exist.** The brief names it as one of the two unmeasured ids; the id resolves
to the not-found page (`There is nothing at #/i/beui/loading-state`), where "no `[data-pick]`" is vacuously true
and would have made a green assertion out of nothing. The nearest live ids are `beui/loading-states` and
`beautifului/loading-state`, both measured-never but both **demo-less**, so neither can test the rule either. The
unmeasured sample is therefore `shadcn/button` (14 demos), `shadcn/accordion` (6), `beui/bloom-menu` — three
unmeasured items that actually reach the demo branch.

**F3 — at 390 the float was already gone before the fix; 1440 is the width that catches it.** Pre-fix, the fixed
"Search 769 ⌘K" button is present at 1440 (134×36 at 1290,848 — bottom-right) and **absent at 390**: the phone
never rendered it. So the 390 half of gate 3 is not evidence for the fix — it is the guard that keeps the
closed-menu phone clean of *future* floating controls, and it is written that way in the file. Gate 3's pre-fix
failure comes from the three 1440 assertions.

**F4 — the 390 pre-fix panel numbers are exactly the r6 report's.** 103 rows / 779 px / 4,894 px of scroll came
back unchanged on the rebuilt `3541e345`, which is the strongest available evidence that the baseline is the
build the report describes and that gate 2 measures the thing that changed.

---

## What is not gated here

- The line's **wording** beyond the four properties above (it must stay one sentence, sourced, verdict-free).
  `pickLine()` could reorder clauses freely and every gate stays green — that is intentional, the clause order is
  not a rule.
- **Which** ids the probe measures. Gate 1 samples 13 of the 25 measured + 3 unmeasured; a new measurement
  arriving in `behaviour.json` is not a regression and must not fail a gate.
- The **palette open** state in `float_check.mjs`: an open dialog is legitimately fixed and would read as an
  offender. If the palette ever gains a fixed surface outside the bar, it needs its own allowance decided in that
  file, not a loosened rule.
