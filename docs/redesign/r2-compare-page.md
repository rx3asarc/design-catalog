# r2-compare-page — six sidebars side by side, on a page that compares instead of listing

Round-2 review, "still not done" 2: *"nothing says what an item is good for … putting them side by side is
something no source site can do."* `#/c/<concept-key>` is that page. It states its set's size, drops the columns
that do not separate the members and names what it dropped, shows the catalogue's own tile for each member, and
has no verdict, no order of merit and no sentence about an individual item.

**35 of 35 measured gates pass, both viewports, all 29 concept sets.** Two things could not be delivered as
written and both are named below, not papered over: the concept **rule text** is not published by the build (the
page says so instead of inventing one), and the **tile** the brief assumed already existed arrived late from
`r2-home-tiles` (carried here as the base commit rather than forked).

---

## 1. What exists now

| surface | address | file |
|---|---|---|
| one concept, compared | `#/c/sidebar` … `#/c/utils` (29 keys) | `app/src/site/Compare.tsx` (new) |
| the route | `#/c/<key>` parses to `{kind:"concept"}` | `app/src/site/route.ts` (+ `conceptHref`) |
| the mount | one arm of the render switch | `app/src/App.tsx` |
| membership | `conceptsOf` / `conceptKeys` / `conceptMembers` | `app/src/site/lib.ts` |
| the way in | "Compare with the 24 others in **sidebar**" | `app/src/site/ItemPage.tsx` |
| the measurement | 35 gates, raw JSON, screenshots | `qa/r2_compare_measure.mjs`, `qa/shots/` |

Nothing else was touched: `Gallery.tsx`, `demo.tsx`, `Stage.tsx`, `Home.tsx`, `Code.tsx`, `Rail.tsx`,
`provenance.tsx`, `styles.css`, `index.html`, `app/gen.py`, `manifest.json`, `demos/**`, `docs/**`,
`publish.sh`, and nothing in `/root/design-catalog`. No new dependency.

## 2. The page, item by item

### Item 1 — a comparison table first
One row per member, filed by source then slug. The columns are exactly the fields the brief allows — source,
licence, kind, files, size, deps, parts, used here, live demo — and **a column survives only if the set of
printed answers has more than one member**. The dropped ones are named at the bottom *with what they said*
(`licence = MIT`), because "we only show what differs" is otherwise a claim a reader cannot check.

`null` prints `—`, never `0`: the store once shipped 0 bytes for 178 items, so a 0 in this table is only ever a
real 0. Where the table rounds, the cell's `title` carries the exact number (`18 KB` behind `18307 bytes,
exactly`), which is what makes every printed number verifiable against the manifest — and is what the
measurement checks.

At 390 the table stacks: `thead` hidden, `tbody`/`tr` as blocks, each cell a `field × value` pair. Nothing
scrolls sideways and nothing is clipped (0 px overflow, 0 clipped cells, measured).

### Item 2 — the tiles below it
`<Grid>` from `site/Tile.tsx` — the same component the gallery and the front page mount, so the pool (9 wide /
2 phone), the 300/600 px observers, the `static` first frame and the hover/focus play are one behaviour in one
place. `Grid` already renders `RefCard` for a member with no demo, so the no-demo path is not a branch on this
page at all: 5 of the 25 sidebar members show the dashed reference card that says "NO DEMO" and links the
library, 20 show a frame.

### Item 3 — how the set was chosen (delivered as an admission, see §5)
The one opinion on the page, and it is about method. It sits above the table. When the build carries the rule it
prints it verbatim and attributed, and keeps the three kinds apart — `slug-normalised`, a `keyword:` matcher (said
in those words, not described as a naming rule), or a human. `app/gen.py` publishes `concepts` per item but **not
`concept.rule`**, so today it prints that the method is unpublished, that the membership is still the rule's, and
that 0 of 769 items carry a human pick — so nothing was hand-chosen for this page either. `RULES` is empty on
purpose; one exported field upstream turns it into the quoted sentence.

### Item 4 — no verdict, no merit order
Rows are filed by source then slug — a shelf order. No ranking word, no "best", no per-item prose that the
manifest could not print itself. `grep -inE "best|winner|rank" app/src/site/Compare.tsx` → no match (exit 1), and
no match in four rendered pages either. For the record: `site/route.ts` still contains `RANK`/`ranked`/`best` in
the pager's neighbour logic — pre-existing identifiers for `same category / same kind / same source`, unrelated to
comparison, left alone because the pager is not this unit's file.

### Item 5 — an unresolved key names the miss; an empty set says so
`#/c/nope` → *"Nothing here is called concept “nope”. This catalogue has 769 items in 29 concept sets. Show
everything → `#/g`"*, and no table. A key that exists with no members gets its own sentence ("an empty set, not a
missing page"). Neither falls back to everything.

### Discoverability
The item page gains one line under the badges, only when the item's concept has ≥2 members, with the count read
from the data (`members - 1`): 17 of 769 items carry it; the other 752 say nothing. An item in two sets names both
(`beui/bounce-sidebar` → `bounce-sidebar` and `sidebar`).

**Wire item, not mine:** `#/about` mentions comparison pages — `site/About.tsx` was outside this unit's file list.
The rail is deliberately untouched: a concept door in the rail is the next slice.

## 3. Measurements — 35/35

Run: `node qa/r2_compare_measure.mjs` with `app/dist` served at `/design-catalog/` (raw JSON in
`qa/r2_compare_measure.json`). Expected values are recomputed from the manifest **and** from
`query.py compare <key>` (`qa/r2_compare_store.json`), never from the page's own arithmetic.

| gate | 1440×900 | 390×844 |
|---|---|---|
| members == store `compare sidebar` | **25 = 25** | **25 = 25** |
| every printed cell == its manifest field | 0 mismatches | 0 mismatches |
| horizontal overflow (document / `.page`) | 0 px / 0 px | 0 px / 0 px |
| clipped cells | 0 | 0 |
| table shape | `table` + `table-row-group` | `thead` none + `tbody` block (stacked) |
| console errors from the page itself | 0 | 0 |
| tiles for 25 members | 25 (5 reference + 20 demo, 0 empty) | 25 (5 + 20, 0 empty) |
| live frames mounted | 7 | 2 |
| controls under 44 px | 0 / 56 | 0 / 56 |
| errors while scrolling the whole tile column | 2, both reproduce on the item pages that own them, 0 novel | same |

Also green: all 29 concepts render with the store's member count; every kept/dropped column set equals the set
recomputed independently; `#/c/utils` compares with 2 rows; `#/c/nope` and `#/c/sidebars` name the miss;
`#/c/nope` renders no table; the item link is correct for every sampled item and absent for items in no set; the
250 ms page turn with motion allowed and 0 animations under reduced motion; `python3 app/check_chrome.py` exit 0.

The console gate is deliberately a *classification*, not a zero count. A concept page mounts the same demos the
gallery and the item pages mount, so an error that already reproduces on the item page that owns the demo is the
demo's, not this page's — and the gate fails the moment one does not reproduce. Measured today: `#/c/tooltip`
carries `shadcn/tooltip`'s missing `TooltipProvider`, and scrolling all 25 sidebar tiles mounts the two frames that
request `/avatars/shadcn.jpg`, which the build never ships (`src/demos/shadcn/sidebar/v0.tsx:75`). Both were
pre-existing, and both fail the gate if they ever stop being reproducible on their own item pages.

### Columns dropped, per concept (the reason is the value every member shares)

| concept | members | sources | columns kept | dropped, and what every member said |
|---|---|---|---|---|
| accordion | 4 | 2 | source · licence · kind · files · size · deps · parts · demo | `used`=0 |
| alert | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| approval-card | 2 | 2 | source · licence · files · size · deps · parts | `kind`=component · `used`=0 · `demo`=no |
| aspect-ratio | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| bounce-sidebar | 2 | 2 | source · licence · files · size · deps · parts · demo | `kind`=component · `used`=0 |
| breadcrumb | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| button | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| card | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| checkbox | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| code-block | 3 | 3 | source · licence · files · size · deps · parts · demo | `kind`=component · `used`=0 |
| collapsible | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| combobox | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| context-menu | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| drawer | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| faq | 2 | 2 | source · licence · kind · files · size · deps · parts | `used`=0 · `demo`=no |
| input | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| message | 2 | 2 | source · files · size · deps · parts · demo | `licence`=MIT · `kind`=component · `used`=0 |
| message-scroller | 2 | 2 | source · files · size · deps · parts · demo | `licence`=MIT · `kind`=component · `used`=0 |
| otp-input | 2 | 2 | source · licence · kind · files · size · deps · parts · demo | `used`=0 |
| popover | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| select | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| sidebar | 25 | 4 | source · licence · kind · files · size · deps · parts · used · demo | — |
| streaming-text | 2 | 2 | source · licence · kind · size | `files`=1 · `deps`=— · `parts`=— · `used`=0 · `demo`=no |
| switch | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| table | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| tabs | 4 | 2 | source · kind · files · size · deps · parts · used · demo | `licence`=MIT |
| toggle | 4 | 2 | source · licence · kind · files · size · deps · parts · demo | `used`=0 |
| tooltip | 4 | 2 | source · kind · files · size · deps · parts · demo | `licence`=MIT · `used`=0 |
| utils | 2 | 2 | source · licence · size · deps | `kind`=component · `files`=1 · `parts`=— · `used`=0 · `demo`=no |

`sidebar` is the one set where **nothing** is dropped: 25 members, 4 libraries, and all 9 fields differ — the
review's "six sidebars from four libraries" is the rare case where every column earns its place.

### Screenshots
`qa/shots/compare-sidebar-1440.png`, `compare-table-1440.png`, `compare-sidebar-1440-tiles.png`,
`compare-sidebar-390.png`, `compare-table-390.png`, `compare-sidebar-390-tiles.png`.

Reviewed by a vision model (the driving model has none): the wide view is a table with a readable header row and
aligned numeric columns, nothing overlapping or clipped; the 390 view is stacked `field × value` blocks with no
cut-off text and no sideways band; the tile grid is regular, previews render real UI, one visible "NO DEMO"
reference card, no blank tile, no card out of line. Verdict: SHIP.

## 4. Commits (branch `fleet/r2-compare-page`, base `master` @ `d5d2a226`)

```
e25d89c9  tile: the tile, the pool and the grid move into site/Tile.tsx   ← r2-home-tiles' commit 30f6cbc6, carried as base
16f40494  compare: one concept's members, compared on the fields that actually differ   (items 1, 4, 5)
600744a4  compare: how the set was chosen is quoted, or admitted missing — never invented   (item 3)
9b8ad059  compare: the tiles below the table are the catalogue's own tile, not a second one   (item 2)
bb8cce5e  item: the way into a comparison, from the item where the question is asked   (discoverability)
81f16a3a  qa: the comparison page measured against the store, not against itself
```

`site/Tile.tsx` has moved on since that base commit: r2-home-tiles' tip is `b3ce30c7` and Tile.tsx was last
touched at `9857c146`, adding optional `cap` / `columns` / `frozen` / `defer` to `Grid`. This page passes none of
them and needs none of them — the export surface it uses is unchanged — so a merge that lands their tip first
changes nothing here.

Items 1, 4 and 5 are one commit because they are one render: the table, the drop rule, and the two honest failure
states cannot be separated into commits that each build and each make sense. Every intermediate commit was built
before it was committed.

## 5. COULD NOT DO

1. **The rule text is not in the site's data.** `concept.rule` exists in the store (29 rows: 28 `slug-normalised`,
   `sidebar` a keyword matcher) and `query.py compare` prints it, but `app/gen.py` exports `concepts` per item and
   not rules, so no page can quote it. The brief's own instruction for a missing manifest field is stop-and-report,
   so the page admits the method is unpublished rather than inventing one or shipping a hand-typed copy of 29 store
   rows that would drift. **Wire:** export the rule with the concept membership in `app/gen.py`; `RULES` in
   `Compare.tsx` is the only line that then needs changing. `qa/r2_compare_store.json` already holds the verbatim
   values, which is how the measurement knows what the truth is.
2. **`#/about`'s one sentence** — `site/About.tsx` was not this unit's file (reported, not done).

## 6. UNSURE

- **Is `—` the right glyph for "not known" in this table?** It is the shell's existing convention for an absent
  facet, and the `title` explains it, but a table of 25 rows where 5 columns say `—` for a whole library is a fact
  about that library (rareui/beautifului publish no code) that a reader has to infer. `withheld` is published in the
  manifest and is *not* one of the columns the brief allows, so it is not a column here. If the lead wants
  "source withheld" as a column, that is a brief change, not a bug fix.
- **Pre-existing demo defects are visible on this page, and that is the honest outcome.** `shadcn/tooltip` throws
  `Tooltip must be used within TooltipProvider`, and two sidebar demos request `/avatars/shadcn.jpg`, which the build
  never ships (`src/demos/shadcn/sidebar/v0.tsx:75`). Each reproduces on the item page that owns the demo
  (`#/i/shadcn/tooltip`, `sidebar-09`, `sidebar-16`) and on `master`'s `#/g` once those frames mount, so they are the
  demo modules' (`demos/**` and `gen.py` are not this unit's files). The page does not hide them; the measurement
  distinguishes them by reproduction rather than by a stack URL.
- **The one 404 in the harness is `/favicon.ico`** at the *server root* — a browser default request that
  `index.html` never declares, so it is present on every page of the catalogue and predates this unit. The harness
  stubs it; the page makes no such request itself.
