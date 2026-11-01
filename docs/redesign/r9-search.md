# r9-search — retire `#/c/`, and a search that respects the taxonomy

Commit: `dfcaa13a` on `fleet/r9-search`, based on `master` at `ced26e10` (round 8's six units in).
Build measured: `app/dist` from that commit, served at `http://127.0.0.1:8895/design-catalog/`
(`/tmp/r9-search-serve/design-catalog` → `app/dist`; `index.html` named `assets/main-CS5HoAxn.js`
at the time of the smoke run, `main-COcdenT9.js` before the tier change — both are this worktree's
build, checked with `curl -s http://127.0.0.1:8895/design-catalog/ | grep -o 'main-[A-Za-z0-9_-]*\.js'`).

Port note: 8895 was held by a stale `python3 serve.py` from round 8 (`/proc/485126/cwd → /tmp/r8-cards-serve`,
which served a **404 at `/design-catalog/`**). I stopped it and took the port with this worktree's build
before trusting any measurement.

---

## 1. `#/c/` is retired; every concept key redirects to its type page

**What changed, where.**

| file | change |
| --- | --- |
| `app/src/site/Compare.tsx` | **deleted** (`git rm`) |
| `app/src/site/route.ts` | `Route`'s `concept` kind removed, `search` kind added; `typeForConcept()` + `conceptHref()` + `searchHref()` added; `parseRoute`'s `page === "c"` branch now resolves to `{kind:"type"}`, and `canonicalHash` repairs the address bar to `#/t/…` (that is the redirect — the page is a type page, the address is rewritten with `replaceState`, no history entry, no second render) |
| `app/src/App.tsx` | **route table only**: `Compare` lazy import + arm removed, `SearchPage` lazy import + arm added. App's scrolling container untouched (`r9-scroll` owns it). |
| `app/src/site/SearchPage.tsx` | **new** — `#/s?q=…`, the uncut result list |
| `app/src/site/CommandPalette.tsx` | variants fold, types indexed, marker redefined, "See all N results" |
| `app/src/styles.css` | one appended section at the end: `/* ---- search: one marker, folded variants, type pages, and a way past the cut (r9) ---- */` |
| `qa/smoke.mjs` | `#/s?q=sidebar` added to ROUTES; a redirect block that walks **every** concept key in `app/manifest.json` |

**The mapping is the taxonomy's own, in two rules (both read at load, nothing written down):**

1. the concept key **is** the type's name → `button` → `Components/Button` (via `TYPE_BY_ROUTE`'s type slugs);
2. otherwise, the type **most of the concept's members are filed under** → `drawer` → `Drawer and sheet`,
   `faq` → `Disclosure`, `select` → `Pickers`, `utils` → `Docs/Helpers and hooks`. A variant counts as its
   parent's type, because a variant is a demo, not an entry.

A tie in rule 2 goes to the taxonomy's own section order (Components, Blocks, Charts, Agent UI, Effects,
Foundations, Docs), then the key. That is why `otp-input` → `Components/Input` rather than the
alphabetically-first `Blocks/Auth and onboarding`, and `streaming-text` → `Agent UI/Streaming and thinking`.
Nothing is hardcoded: the taxonomy is being re-cut in this round and this file does not care.

**The redirect table — 29 of 29 concept keys in `app/manifest.json`, measured (not a sample):**

```
#/c/accordion        → #/t/components/accordion
#/c/alert            → #/t/components/alert
#/c/approval-card    → #/t/agent-ui/tool-calls-and-approvals
#/c/aspect-ratio     → #/t/components/aspect-ratio
#/c/bounce-sidebar   → #/t/components/sidebar
#/c/breadcrumb       → #/t/components/breadcrumb
#/c/button           → #/t/components/button
#/c/card             → #/t/components/card
#/c/checkbox         → #/t/components/checkbox
#/c/code-block       → #/t/components/code-block
#/c/collapsible      → #/t/components/accordion
#/c/combobox         → #/t/components/combobox
#/c/context-menu     → #/t/components/context-menu
#/c/drawer           → #/t/components/drawer-and-sheet
#/c/faq              → #/t/components/disclosure
#/c/input            → #/t/components/input
#/c/message          → #/t/agent-ui/chat-and-messages
#/c/message-scroller → #/t/agent-ui/chat-and-messages
#/c/otp-input        → #/t/components/input
#/c/popover          → #/t/components/popover
#/c/select           → #/t/components/pickers
#/c/sidebar          → #/t/components/sidebar
#/c/streaming-text   → #/t/agent-ui/streaming-and-thinking
#/c/switch           → #/t/components/switch
#/c/table            → #/t/components/table
#/c/tabs             → #/t/components/tabs
#/c/toggle           → #/t/components/toggle
#/c/tooltip          → #/t/components/tooltip
#/c/utils            → #/t/docs/helpers-and-hooks
```

Edge cases, also measured: `#/c/Button` (case) → `#/t/components/button`; `#/c/sidebar/extra` (a stale
link one segment deep) → the Sidebar type page, because a third segment is spelling, not identity, exactly
as `#/i/` and `#/t/` already treat it; `#/c/` and `#/c/no-such-concept` → the miss page, which prints the
address it could not resolve (a concept the taxonomy cannot place is not silently pointed at anything).

`qa/smoke.mjs` now fails if any concept key renders anything but a type page, and it waits for the hash to
be a `#/t/…` route — so a future unit cannot put a `#/c/` page back without turning the gate red. Run:

```
node qa/smoke.mjs http://127.0.0.1:8895/design-catalog/
→ … ok #/c/ redirects: 29/29 concept keys land on their type page; #/c/<unknown> is a miss
→ SMOKE: all routes ok
```

## 2. What happened to `Compare.tsx`

Deleted with its copy. Sentences on it worth keeping, and where each one already lives:

- *"`null` is never `false` … 'not measured' is a cell, not a dash"* — kept, unchanged, and still enforced by
  `site/behaviour.ts` + `site/TypePage.tsx` (`NOT_MEASURED`, table cells, "Also in this set"). It was never
  Compare-only.
- *"the members nobody measured are not rows … they go into a list with their one-line description"* — kept:
  that is the type page's "Also in this set", which was already the same rule.
- *"the tiles are the gallery's own — the same `Grid`"* — kept: the tiles are the gallery.
- **Not kept, deliberately:** the concept page's own "provenance" sentence (*"the name is the rule, and every
  one of them carries "sidebar" in its own name or slug"*) and its dropped-column footnote. Both were
  apologetics about how the set was built; the type page states its membership (`21 members · 3 libraries ·
  N measured`) as a fact instead of arguing for it. Nothing was moved to a new home: one surface, one
  statement.

Now dead, and **not mine to remove** (flagging, not fixing): `separates()` in `app/src/site/behaviour.ts`
(exported, was used only by Compare.tsx) — the build does not care; and two comments in `app/src/site/lib.ts`
still name `site/Compare.tsx` (lines ~87 and ~130).

## 3. Search — the review's four complaints

Surface: the palette (⌘K / the bar field) plus **`#/s?q=…`** (`site/SearchPage.tsx`). One ranking
(`searchAll` in `CommandPalette.tsx`) serves both, so the palette and the page cannot disagree.

### 3.1 Before / after for the five named queries

Measured by opening the palette on `#/`, typing the query and reading the rows
(`node /tmp/r9-search-baseline.mjs http://127.0.0.1:8895/design-catalog/ before|after`). "Before" is
`ced26e10`'s palette; "after" is this commit. Before-images are the visible rows — the old heading selector
I used missed, so I have the *rows* before, not the old `N of M` string; I am not going to invent it.

| query | before | after |
| --- | --- | --- |
| `button` | 20 rows, all variants of one item (`button-demo`, `button-icon`, `button-link`, `button-size` …), every row green-dotted, no type row, no way past 20 | **25 results: 1 type, 24 items.** Row 1 `Button · Components · 21 items · 16 variants`; row 2 `button · 12 variants · demo`; then real members (`Button Group`, `button-as-child`, `button-group-*`, `kbd-button`, `spinner-button`…). `the first 20 of 25 matches` + `See all 25 results` |
| `sidebar` | 20 rows, 16 of them `sidebar-01` … `sidebar-16`, every row green-dotted, no type row | **12 results: 1 type, 7 items** (fits, so no "see all"). Row 1 `Sidebar · Components · 7 items · 16 variants`; row 2 `sidebar · 16 variants · demo`; then the six other sidebars across four libraries |
| `chart` | 20 rows, 17 of them `chart-area-*`/`chart-bar-*`/`chart-pie-*` variants, every row green-dotted | **47 results: 2 types, 45 items.** Row 1 `chart · 76 variants · demo`; row 2 `Chart` (the docs entry); row 3 `Chart demonstrations · Charts · 1 item · 76 variants`; then the real chart blocks (beui's Bump/Donut/Funnel/Sankey/Candlestick/Composition). `the first 20 of 47` + `See all 47` |
| `input` | 20 rows, ~16 of them `input-demo`/`input-file`/`input-group-*` variants, every row green-dotted | **116 results: 2 types, 114 items.** Row 1 `Input · Components · 15 items · 12 variants`; row 2 `input · 3 variants`; row 3 `Input` (beui). `the first 20 of 116` + `See all 116` |
| `theme` | 7 rows (`theme-gray`, `theme-zinc`, `theme-slate`, `theme-stone`, `Theme Toggle`, `theme-neutral`, `Theme Selector`), every row green-dotted, no type row | **8 results: 1 type, 7 items.** Row 1 `Themes · Foundations · 7 items · 0 variants` (a type whose name starts with the query ranks with an item whose name does, and the shorter name wins the tie: `Themes` = 6 chars, `theme-gray` = 10), then the seven members |

Across all five: **the number of green dots fell from "one per row, including demo-less rows" to only the
rows that actually run a demo** (`button`: 20/20 before → 12/20 after; `theme`: 7/7 → 1/7).

### 3.2 How folded variants and type pages are ordered

One ranked list, one tier per kind of match (`TIER` in `CommandPalette.tsx`):

```
0  a type whose name IS the query              Button ← "button", Card ← "card"
1  a name that starts with the query           item names and type names share this tier
3  a name that contains the query
4  a type name that contains the query
5  concept / category
6  source
9  a hit that needed the one-edit typo allowance (never outranks a hit)
```

Ties inside a tier: **shorter name first**, then alphabetical, then id — the order is a function of the
data, never of a shuffle. That is why `theme` leads with the `Themes` collection and `chart` leads with the
`chart` item (5 chars) before `Chart demonstrations` (20); and why `sidebar` opens `sidebar`, not `Sidebar 07`.

Folding: a variant is a demo, so it never gets a row. `button-icon` → the row `button · 12 variants`, and the
row opens `#/i/shadcn/button`, where those 12 variants *are* the demo list. Measured: typing `button-icon`
in the palette yields exactly one row, `button · 12 variants · demo`, and Enter lands on
`#/i/shadcn/button`. On the search page the same row also says `matched "button-icon", a demo on this page`,
so typing a variant's name and being shown its parent does not look like a miss.

Type rows carry `section · N items · M variants` — the counts are the taxonomy entry's own
(`entry.members.length`, `entry.variants.length`), so `Pie and donut` prints its 11 variants rather than
hiding them, and no count is hardcoded ("89" appears nowhere in the code; `TYPES.length` prints 89 today).

### 3.3 "See all" at ~20, ~40, ~200 results

Rule: the palette shows `min(20, total)` rows; when `total > 20` it prints `the first 20 of N matches` and a
44 px `See all N results` link to `#/s?q=<query>` — the same ranking with no cap, each row 44 px, on its own
address. No threshold specific to 20/40/200, so the numbers below are just the sizes I measured:

| query | total (measured) | palette | `#/s?q=…` |
| --- | --- | --- | --- |
| `theme` | 8 | 8 rows, no link | 8 rows |
| `sidebar` | 12 | 12 rows, no link | 12 rows |
| `card` | 22 | 20 rows + `See all 22 results` | 22 rows |
| `button` | 25 | 20 + `See all 25` | 25 rows |
| `chart` | 47 | 20 + `See all 47` | 47 rows |
| `component` | 62 | 20 + `See all 62` | 62 rows |
| `input` | 116 | 20 + `See all 116` | 116 rows |
| `a` | 630 | 20 + `See all 630` | 630 rows |

Clicking `See all 47 results` from the palette, measured: palette closes, address becomes `#/s?q=chart`, the
page renders 47 rows (`rows=47, paletteOpen=false`). No sideways overflow at 390 or 1440 on
`#/s?q=sidebar` (smoke prints `overflow` for it: clean).

### 3.4 The marker means one thing now, and says it

The old row ended with a dot painted from `LICENCE_TONE` — green for MIT — so every row had a green dot,
including rows with nothing to run; that is exactly what the review objected to. Now:

- **a demo that runs** → green 6 px dot **and** the word `demo` (`title="a demo runs in this catalogue"`,
  `sr-only` "runs in this catalogue");
- **reference-only / helper / doc** → the words `no demo`, no dot;
- **a type row** → no marker at all; a collection is not a demo, it carries its two counts instead.

The licence did not lose information: it was never a colour anyone could read, it stays on the item page and
it is still on the row for a screen reader (`sr-only` "licence MIT"). The search page adds the legend line:
`● demo means a demo runs in this catalogue; no demo is a reference-only entry. A folded variant is a demo on
its parent's page, so it is not a row here: it is counted on its parent's.` The palette says the same in its
dialog description (`A green dot marks a result whose demo runs.`).

## 4. What I ran, on this build

`python3 app/check_chrome.py` → green, 28 shell files scanned (SearchPage.tsx included).
`npx vite build` → green (no TypeScript checker is installed in `app/node_modules`, so this is a build, not a
typecheck; `npx tsc` says so).
`node qa/smoke.mjs http://127.0.0.1:8895/design-catalog/` → `SMOKE: all routes ok` + `29/29` redirects.

Baseline (before my changes, same port, `ced26e10`): `smoke`, `r2_check`, `type_page_check`, `taxonomy_check`
all green — so the fails below, if any, would be mine.
**Not run after the change** (the lead took the gate sweep onto a quiet box; the box was at load ~25 with
five units running gates): `r2_check`, `tap_check`, `gallery_check`, `stage_check`, `slice3_check`,
`mobile_state_check`, `contrast_check`, `pick_line_check`, `rail_density_check`, `float_check`,
`type_page_check`, `hero_check`, `card_check`, `demo_theme_check`, `foundations_check`, `taxonomy_check`.
`#/s?q=…` is a new route, so `mobile_state_check` and `contrast_check` are the two I would expect to care;
I did measure, by hand, on both surfaces: no element under 12 px, `Input` 44 px, palette rows ≥44 px on
phones, search rows 44 px, no horizontal overflow at 390 or 1440, one hairline per row, no shadow, no accent
fill.

## 5. Could not do

- **Sixteen gates** — see above; lead's instruction was to stop and hand the sweep over.
- **`site/lib.ts`'s two stale comments** naming the deleted `Compare.tsx` (not my file).
- **`site/Gallery.tsx`'s "Compare side by side" strip** and **`site/CompareShowcase.tsx`** on the front page
  (another unit's files). Both still link `#/c/<key>`, which now redirects to the type page — the links work,
  the strip is still the second comparison system the review asked to remove, and its removal is that unit's.
- **`qa/r2_compare_measure.mjs` and `qa/r7_sweep_measure.mjs`** still navigate `#/c/…` and assert the old
  concept page's table; they are measurement scripts, not gates, and their subject is deleted. Not mine to
  delete; they will report against a redirect now.
- **`ItemPage.tsx`'s "Compare with the 3 others"** (line ~322, `conceptHref`) now opens the type page that
  holds 21 items, so the sentence undercounts what the link shows. The href is right (it goes straight to
  `#/t/…`, no redirect hop); the words are another unit's. Suggested replacement: `See all 21 in Button`.

## 6. Unsure, verbatim

- "I did not re-run the sixteen other gates after the change; the lead is running them. If
  `contrast_check` or `mobile_state_check` fail, `#/s?q=…` (`site/SearchPage.tsx`) is the likeliest place:
  it is the only new surface with type, a control and a list on it."
- "One cosmetic defect I saw and did **not** ship a fix for, because I was told to stop running builds and I
  will not commit a change I cannot measure: on `#/s?q=chart`, row 1 is the `chart` item captioned
  `matched "chart-area-axes", a demo on this page`, because a variant doc and the anchor doc tie on score and
  the variant won the de-dupe. The fix is three lines in `searchAll`'s `keep()`: carry `own` and prefer the
  anchor on a tie. Everything else in the table above was measured on the build before this observation."
- "The `#/c/` → `#/t/` redirect depends on the taxonomy still typing the concept's members. If the re-cut
  leaves a concept with no typed members at all, `#/c/<that key>` becomes the miss page rather than a
  redirect. On today's taxonomy that is 29/29; on tomorrow's it is whatever the taxonomy says, which is the
  point, but I cannot promise 29 after someone else's re-cut lands."
- "`otp-input` and `streaming-text` are genuine ties (their members split evenly across two types). The
  tie-break I chose is the taxonomy's section order, so `otp-input` → `Components/Input`. If the intended answer
  was `Blocks/Auth and onboarding`, that is a one-line change in `route.ts`'s `CONCEPT_TYPE` sort — but the
  taxonomy's own data does not decide it, so I am flagging rather than guessing."
