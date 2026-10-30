# Round 8 — collections as the backbone

`16d334bd` gave the catalogue a written taxonomy: 89 types across 7 sections, 569 members, 200 variants folded into
their parents. Nothing rendered it. This unit renders it — one address and one page per type — and applies the
round-7 review of the collections to both collection surfaces that existed.

Branch `fleet/r8-collections`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r8-collections`.

```
node qa/type_page_check.mjs [base]   # 30 checks over 89 routes, both viewports, + the gallery's strip
node qa/taxonomy_check.mjs  [base]   # unchanged; the membership this page renders is the list it gates
```

---

## What now exists

### `#/t/<section-slug>/<type-slug>` — 89 routes, one per type

| file | what it owns |
| --- | --- |
| `app/src/site/typeIndex.ts` | the one place a name becomes an address and back: `slug()`, `typeAt()`, `typeHref()`, `TYPE_BY_ROUTE` |
| `app/src/site/TypePage.tsx` | the surface: header, sortable table, "Also in this set", per-row demo, section strip |
| `app/src/site/route.ts` | the route arm — an unknown pair is a miss, never a nearest neighbour; a third segment is spelling, not identity |
| `app/src/App.tsx` | one lazy arm, one surface |
| `app/src/styles.css` | the block, `/* ---- collections (r8) ---- */` |

Membership is not re-derived anywhere. `entry.members` **is** the taxonomy's list — the list `qa/taxonomy_check.mjs`
gates and the rail prints — so the page and the sidebar cannot disagree about who is in a collection.

### The five sentences of the review, as code

1. **"one collection per level-2 type, same membership as the sidebar"** → `TYPE_BY_ROUTE` over `TYPES`; the table's
   rows and the list's entries are `entry.members` split by one test (`hasFacts`).
2. **"a live demo next to each row"** → `RowDemo` in the row, mounted by the gallery's own `Pool` (never more than
   two frames live; in at 300 px, out at 600). It reuses `site/demo.tsx`'s `DemoFrame` and the tile's scaling rule
   verbatim — a 290 px cell lays the demo out at `REF_WIDTH` 768 and paints it at `0.375`, so the window shows the
   top 453 px of the real thing instead of a phone-width column 736 px tall. At 1440 the demo is the column beside
   the name; below 860 px the row stacks and it lands under the name.
3. **"a sortable table, unmeasured items in a short 'Also in this set' list below"** → a row is a member the probe
   answered **something** about (`behaviour.ts`'s `hasFacts`); a member it did not is one line — name, source,
   licence, the data's own `one_line`, and its demo — under the table. When no member answered anything there is no
   table at all. Every header is a 44 px sort button, `aria-sort` follows the state, "not measured" sorts last in
   both directions (it is not smaller than `false`), ties fall back to the name, and the order is stable.
4. **"the measurement date once, in the header"** → `pickLine()` gained an additive `{ date: false }`; the type page
   and the concept page pass it and print the run's date and probe version once, in the counts line. The item page
   keeps the date in its line — one page, one line, no header to put a run in.
5. **"delete the paragraphs explaining what isn't there"** → the concept page lost `[data-compare-measured-note]`,
   `[data-compare-dropped-note]` and the whole `.withheld` block; a set with nothing to compare now says nothing.

### Two more, because the review named them

- **"the 'compare side by side' strip shows all 20 collections in every section"** → `Gallery.tsx`'s `COMPARABLE`
  now carries its members' ids and the strip is filtered to sets that have at least one member **in this grid**.
  `#/g?q=sidebar` offers 1 of 20 sets and not `#/c/checkbox`; the unfiltered gallery still offers all 20.
- **"`sidebar-01`…`-16` are hard to tell apart by name"** → a variant is never a row: it is an option in its
  parent's row picker (`shadcn/sidebar` → 16 demos), labelled `Sidebar 01` by a reader that turns a slug into words,
  and the chosen variant's own `one_line` is printed under the window. The type page's strip lists this section's
  other types only, never another section's.

---

## The numbers, and the one that matters

```
89 type pages · 569 members · 200 variants · 39 pages have at least one variant
20 items in the whole catalogue answer at least one behaviour fact
25 items carry a behaviour record; 5 of those say "no demo: this item is reference-only"
```

| | |
| --- | --- |
| pages with a sortable table | **1 of 89** — `Components/Sidebar`: 7 members, 4 answered, 16 variant demos, 3 in "Also in this set" |
| pages with no table | **88 of 89** — every member listed with its demo, no rows, no explanation, no date |
| pages whose only record answered nothing | 2 (`Components/Navigation`, `Docs/Component docs`) — `hasFacts` is false, so they are lists, not one-row tables |

**This is the honest limit of this unit, and it is not a page-code problem.** All 20 measured items are Sidebar
members (4 members + 16 variants); nothing else in the catalogue has a behaviour fact. The review's "five rows read
'not measured' in every column" is fixed — those rows are gone — but a table on `Components/Button` needs
measurements, and measurements come from the `behaviour/1` probe against `manifest.json`, which this brief puts out
of bounds (`app/gen.py`, `app/manifest.json`). So the surface is finished and honest, and the thing that would make
88 more pages have tables is a probe run, not more UI.

The alternative — counting a *record* as measured — was tried first and rejected: it produced a one-row table on
`Components/Navigation` whose every cell said "not measured", i.e. exactly the shape the review called out. A record
that says "there is nothing to measure" is not a row.

---

## What was measured, on what

| | |
| --- | --- |
| build | `fleet/r8-collections`, `npx vite build` in `app/`, served at `http://127.0.0.1:8882/design-catalog/` (`/tmp/serve-r8-collections` → this worktree's `app/dist`) |
| browsers | Playwright from `/root/camofox-browser/node_modules/playwright`, `/usr/local/bin/google-chrome`, `--no-sandbox --disable-dev-shm-usage` |
| 1440 × 900 and 390 × 844 | `#/t/components/sidebar`, `#/t/components/button`, `#/t/foundations/fonts`, `#/t/docs/component-docs`, `#/c/sidebar`, `#/c/accordion`, `#/g`, `#/g?q=sidebar`, `#/g?sec=Components` |

Every gate in `qa/` on this build, run at the base above:

```
taxonomy_check       TAXONOMY: ok — 89 types across 7 sections … 569 members + 200 variants = 769
type_page_check      TYPE PAGE: ok
smoke                SMOKE: all routes ok
pick_line_check      PICK: ok (10 measured, 3 unmeasured, 3 measured-no-demo)
gallery_check        GALLERY: ok
tap_check            TAP: ok
float_check          FLOAT: ok
stage_check          STAGE: ok
r2_check             R2: ok (42 ok lines)
mobile_state_check   STATE: ok
```

`qa/type_page_check.mjs` is new and is the gate for this surface: 89/89 routes resolve and name their own section; an
unknown pair is a miss; the header counts members and rows and the two numbers agree with the DOM; the "also" list
holds exactly the members that are not rows, with no overlap; no row answers nothing; the date appears once and in no
pick line; the quoted apology sentences appear nowhere; every column sorts both ways with `aria-sort` following and
the row set unchanged; every row's window exists and the pool holds ≤ 2 live frames (also re-checked at the busiest
scroll position on a phone); the strip is this section only and never links itself; a section-filtered gallery offers
no set that is not in its grid; and at 390 there is no horizontal overflow, no lost behaviour column, every cell
still names its column, nothing under 12 px, nothing tappable under 44 px.

One note about the local base: `styles.css` asks for `/fonts/…` at the domain root, so on a `/design-catalog/`
prefix the woff2 files 404 and the site falls back to the system stack. That is pre-existing, not this unit, and the
gate ignores resource 4xx for that reason (console *errors* still fail it).

---

## Files touched

`app/src/site/typeIndex.ts` (new), `app/src/site/TypePage.tsx` (new), `qa/type_page_check.mjs` (new),
`app/src/site/route.ts`, `app/src/site/behaviour.ts`, `app/src/site/Compare.tsx`, `app/src/site/Gallery.tsx`,
`app/src/App.tsx`, `app/src/styles.css`.

Not touched, per the brief: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`,
`master`, `app/src/site/taxonomy.json`, `app/src/site/taxonomy.ts`.

`app/dist` is a build artifact and `app/node_modules` is a symlink to the main worktree's — both untouched by the
commit.

## Open, for whoever merges

- **`#/c/<concept>` still exists**, now with the same rule as the type pages (rows only where facts, the rest in
  "Also in this set", one date, no apology). The brief put redirecting it or keeping it at my discretion: keeping it
  loses nothing and breaks no published link; the type page is the better page and the rail should point there.
- **`typeHref` will exist twice after the merge.** `fleet/r8-rail`'s `Rail.tsx` defines its own
  `#/t/${slug(section)}/${slug(type)}`; the shapes agree exactly, but on merge `site/typeIndex.ts` should own it and
  `Rail.tsx` should import it, so a change to the address is one edit.
- **A probe run is what makes the other 88 pages tables.** Until `manifest.json` carries behaviour for more than 20
  Sidebar items, "a sortable table of measured members" is one page, and the correct output for the other 88 is the
  list they render.
