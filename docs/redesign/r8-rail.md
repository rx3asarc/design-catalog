# Round 8 — the rail lists types, not items, and its header stops being a toolbox

`fleet/r8-rail`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r8-rail`, base `master` (`16d334bd`).
Served on **8881** (`/tmp/r8-rail-serve` → this worktree's `app/dist`); the served `index.html` names
`main-DGk1E6TW.js`, which is this build's entry — checked before every measurement below.

Nothing in the prohibited set was touched: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`,
`publish.sh`, `master`, `app/src/site/taxonomy.json`, `app/src/site/taxonomy.ts`, `site/route.ts` (read, not
edited — the gallery and `Home.tsx` still read `buildTree` from it).

---

## 1. The review's sentence, and what answers it

> The categories at the top are fine. Below them, groups are made by cutting item names into words and adding an
> "s". With everything expanded the sidebar has about 990 rows. […] **Two levels only.** … **The rail lists types,
> not items. About 60 entries instead of 769. Clicking a type opens its collection page.** **Clear out the rail's
> header area:** move the theme switch to the top bar; turn the source chips into gallery filters; drop the help
> sentence and the 39 grid icons; their counts still sit half-hidden under the icons.

`site/Rail.tsx` is rewritten around `site/taxonomy.ts`, which the taxonomy unit had already written and gated
(`qa/taxonomy_check.mjs`, green): `SECTION_ORDER` (7) and `TYPES` (89, section by section, A–Z). The old
`buildTree` → categories → families → items render is gone from the rail; the rail's third and fourth levels,
`familyLabel()` (the pluralising table) and `Row` (the item leaf) are deleted.

| the rail level | where it comes from | what a row is |
| --- | --- | --- |
| level 1 — 7 uppercase sections | `SECTION_ORDER` | label + member count + disclosure |
| level 2 — 89 types, A–Z | `TYPES` | name + member count + a link to `#/t/<section-slug>/<type-slug>` |

An item is never a row. Nothing in the rail points at `#/i/…` any more (asserted, `rail_density_check`).
`.rail-sec`, `.rail-item`, `.disc-trigger`, `.rail-count` and `data-slot="sidebar-container"` are kept, so the
round-6 rules (mono `label` step, uppercase group names, tabular counts, 30 px/44 px row metrics) still win on the
elements they name; the appended CSS block only adds what is new. `.rail-cat` / `.rail-sub` / `.rail-sub2` rules
stay in the stylesheet and now match nothing — no element carries those classes.

## 2. The numbers, measured (not intended)

| | measured |
| --- | --- |
| **1440, `#/`** | **60 rows** = 7 sections + the 53 types of the one open section (`Components`), **1/7 sections open**, 0 type rows anywhere else. Before this unit: 990 rows with everything expanded, 103 with the r7 closure. |
| **1440, `#/t/foundations/fonts`** | **10 rows** = 7 + Foundations' 3 types; the `Fonts` row is `aria-current="page"` |
| **1440, `#/i/shadcn/button`** | 60 rows; the section of the item's own type (`Components`) is the open one |
| **390, menu open, `#/`** | **7 rows**, all seven section names, **0 type rows** (nothing pre-expanded); panel 678 px, scroll 677 |
| **390, one section opened** | 7 → **60 rows** (53 types), address unchanged `#/ → #/`, menu still open |
| section counts, as visible text | 250 · 37 · 15 · 37 · 43 · 74 · 113 (= 569 members) |
| type rows link to | `#/t/components/accordion` … 53/53 rows, all `#/t/<section>/<type>`, 0 rows `#/i/` |
| **the source chips now link to** | `every library → #/g`, then `shadcn → #/g?src=shadcn`, `beui → #/g?src=beui`, `rareui → #/g?src=rareui`, `beautifului → #/g?src=beautifului`, `transitions → #/g?src=transitions` — the grid's own `src` filter, and the chip the grid is filtered to carries `aria-current="page"` (verified on `#/g?src=shadcn`: chip current, grid filtered) |
| **where the theme switch sits** | `.topbar-theme`, right end of the 56 px top bar, 189×46 px at x=1235–1424 (1440×900), vertically centred, next to the 240 px search field; 0 elements below 861 px; the phone's single instance is the Browse menu's first row (366×54 at 390) |
| **type floor, after** | **0** text nodes under 12 px — 1440 whole page, and 390 with the menu open |
| **tap floor, after** | 390 menu open: **0** controls under 44×44 (was 2: the rail wordmark's 94×18 link, and a 43.98 px-wide chip — both fixed). 1440: 10 controls under 44 px, all mouse-precision and none failing `tap_check` (top bar links, the 32 px search field, the 26 px collapse trigger, the filter input, the 30 px chips) |
| rail head height | **180 px** (was 230.4) — the theme row and the help sentence are gone |
| entry bundle | **56,336 B gz** (base build 50,872 B gz): **+5.3 KB**, which is `taxonomy.json` (5,212 B gz) reaching the entry because the rail is an entry-chunk surface. Not moved to a lazy fetch on purpose: an empty rail on first paint is worse than 5 KB, and the gates wait for rows, not for a spinner. |

## 3. The header area, all three items

1. **theme switch → the top bar** (`site/TopBar.tsx`): rendered there for a desktop, and *not rendered* below
   861 px rather than hidden — a `display: none` copy is still three radios in the DOM and the site's own gates
   count `.theme-switch` items wherever they find them. Flip verified from the bar: `dark → "" (light) → dark`,
   repaint immediate, `slice3_check`'s toggle/persist passes.
2. **source chips → gallery filters**: `<button>` + rail state → `<a href="#/g?src=…">`; the rail's `from` state is
   deleted from `App.tsx` (`FILTER_KEY` now stores `{q}`; an older payload's `from` is ignored). Same chip look,
   `radius-sm` per the book (r7 §2), 44 px tall at 390, 44 px min width.
3. **help sentence + 39 grid icons dropped**: `.rail-legend` and every `SidebarMenuAction` door are gone (measured:
   0 `[data-sidebar="menu-action"]` in the rail). Their counts are visible text — the group count at the right edge
   of every section row, the type's member count on every type row (centre-aligned with its label to 0.6 px,
   measured).

The filter is unchanged in behaviour and survives reload (`sessionStorage`, round 5): typing `side` at 1440 gives
1 section and 1 type row (`Sidebar`, 7), the same before and after a reload; a section with no surviving type is
not rendered. With a filter typed, every section that still has a match opens — a filter that hides its matches
behind a disclosure is the round-7 bug.

## 4. Gates

All green on the 8881 build, after the final build:

```
node qa/rail_density_check.mjs  RAIL: ok        (16 assertions, rewritten — see below)
node qa/smoke.mjs               SMOKE: all routes ok (12 routes)
node qa/r2_check.mjs            R2: ok          (42 ok, 0 failed)
node qa/tap_check.mjs           TAP: ok         (12 route/viewport pairs)
node qa/contrast_check.mjs      CONTRAST: ok    (32 token pairs × 2 themes)
node qa/mobile_state_check.mjs  STATE: ok       (17)
node qa/float_check.mjs         FLOAT: ok       (7)
node qa/slice3_check.mjs        SLICE3: ok      (14, the pool's copy — see below)
node qa/taxonomy_check.mjs      TAXONOMY: ok    — 89 types / 7 sections / 569 + 200 = 769
```

`qa/rail_density_check.mjs` **rewritten and kept meaningful** rather than retuned: at 390 the menu must open on the
**seven section names** (≤ 8 rows, 0 type rows, every row ≥ 44 px tall, every section row printing a count as text,
0 grid doors); opening one section must reveal its rows without navigating and without closing the menu; at 1440
the rail must show **sections + types** (`> 40` and `≤ 100` rows — 89 types, not 769 items); **only the current
section** may be open (`Components` on `#/`); a collection route must open its own section and mark its own row;
every type row must be `#/t/…` and no row `#/i/…`; and the filter must narrow the rail to matching types with the
non-matching sections gone.

Two gate files were edited and one was adopted, and all three are named here because they are not mine by right:

- `qa/mobile_state_check.mjs` (1 selector): its reload assertion compared `[data-slot=sidebar] a[href^="#/i/"]` —
  rows the rail no longer has — so it was passing on **0 vs 0**, measuring nothing. It now compares the rail's type
  rows (`.rail-item`), and reports **1 row typed vs 1 after reload**.
- `qa/slice3_check.mjs` **adopted, not edited**: the pool at `/root/docs/catalog-redesign/qa/slice3_check.mjs`
  already carries the fixed first-paint assertion (4 cases: nothing stored → dark by the brand book on either OS;
  a stored `light` → light on either OS; and a real light→reload→dark toggle). The repo's copy predated it and was
  failing `first paint light` on the **round-6 master build too** (`http://localhost:8830` → same FAIL,
  `at commit="dark|rgb(9, 9, 11)" settled="dark"`), because `app/index.html` resolves `system` to dark on purpose.
  This branch now carries the pool's version: 14/14 ok, including `theme toggle light: dark → (light) → reload light`.
- `qa/rail_density_check.mjs` (rewritten above) also took the pool's round-7 hardening — wait for the tree, not a
  stopwatch — because a tree that has not rendered measures 0 rows and passes a maximum for the wrong reason.

Both edited files are mirrored to `/root/docs/catalog-redesign/qa/` (the pool the round-7 report established).

One stale assertion is left as it is, deliberately: `qa/measure.mjs` §D "every counted rail row carries a link to
its own grid" is the round-2 audit harness and it asserts **the grid doors the review asked to delete**. It is not
one of this round's gates and its committed output (`qa/raw`) is a historical record, so it is reported, not
rewritten.

## 5. One reading of the brief that should be visible

"The rail's copy is gone" is implemented for the **desktop rail**: the `.rail-theme` row is deleted and the top bar
carries the switch. The **phone menu keeps its own single row** (`.rail-theme-phone`), because that menu is the only
surface above the page on a phone and `qa/r2_check.mjs` (H) asserts a theme control is reachable there at 390/600/768
— and 3 × 44 px is 132 px of a 390 px bar that already holds a brand, a search door and Browse. If Maestro wants no
theme control at 390 either, r2_check H has to be rewritten first; that is a decision, not a cleanup.

## 6. What this branch does not do

The 89 type rows link to `#/t/<section>/<type>`, which `site/route.ts` does not parse yet: on this branch alone
every one of them renders the not-found surface **with the rail still around it and its own row marked current**.
`r8-collections` is building those pages in parallel against the same spelling — that is the contract in both
briefs, so the page is theirs and the link shape is mine.
