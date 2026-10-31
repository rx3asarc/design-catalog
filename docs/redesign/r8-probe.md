# Round 8 — the probe measures one member of every type, and 67 collections get a table

`site/TypePage.tsx` renders a type's collection as a sortable table of the members **somebody measured**, with
everyone else in "Also in this set". Before this unit, **20 items in the whole catalogue answered any behaviour
fact and all 20 were sidebars**, so exactly **one** of the 89 type pages had a table and 88 were lists. Nothing
about those 88 pages was wrong: nobody had measured their members.

This unit measures **the first member of every type that ships a demo** — one per type, by rule — and leaves the
data where the site already reads it.

Branch `fleet/r8-probe`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r8-probe`, commit `02a61bb9`.

```
python3 scripts/probe-behaviour.py --base http://127.0.0.1:8896/design-catalog/   # the run below
python3 scripts/probe-behaviour.py --set more-members --batch 40                  # the next batch, later
python3 scripts/probe-behaviour.py                                               # "nothing to do"
node qa/type_page_check.mjs <base> · node qa/pick_line_check.mjs <base> · …      # the nine gates
```

---

## The set, and why this set

| | |
| --- | --- |
| the rule | for each of the 89 types, `entry.members.find(hasDemo)` — the **first** member, in the taxonomy's own order, that has a demo |
| targets | **68** types have such a member (47 beui, 21 shadcn); **21** types have none — every member is reference-only |
| plus | the whole `sidebar` concept set (**25** items) re-measured, so the file's dates are one run and not two |
| attempted | **92** items (68 + 25 − 1 overlap: `beui/ai-sidebar`) |
| records now in `app/behaviour.json` | **113** — 86 that answered a fact, 27 that say why nothing was measured |

Why this rule and not "the ones that worked": a table on a collection page is evidence about *that collection*, so
the sample has to be a property of the taxonomy rather than of the probe's luck. "First member with a demo" is one
sentence, it is reproducible, and it is the only sampling that reaches almost every page. It is also honest about
its own thinness: a first member is one row, not a survey (see *What this is not*, below).

## Measured, skipped, and the reason each one gives

| | count | what it means |
| --- | --- | --- |
| answered ≥1 fact | **86** | 67 of the 68 type-first targets + 20 of the 25 sidebar items − the 1 overlap |
| recorded reason, no fact | **27** | `null` in all six columns, and the record's own words for why |
| capped at 75 s | **0** | the slowest item took 14.8 s |
| probe crash / no record | **0** | — |

The 27 unmeasurable records, by their own `reason`:

```
21  no demo in this build: every member of this type is reference-only, so nothing in the set can be measured
 5  no demo: this item is reference-only, so there is nothing to measure        (sidebar concept members)
 1  the demo does not run here: This demo throws in our build: data is not …     (shadcn/chart)
```

Each of the 21 no-demo types is represented in the file by its **first member**, so the file accounts for all 89
types and a later reader can see the set was considered rather than forgotten. `shadcn/chart` is the only target
with a demo that could not be measured: its demo throws in this build, which is a fact about the demo, not about
the probe. It is retried with `--retry-unknown`.

## Facts per column (113 records, 678 cells)

| fact | true | false | null | what the null means |
| --- | --- | --- | --- | --- |
| `collapses` | 20 | 66 | 27 | no unmeasurable record can answer it; for a demo with no control the answer is `false` with a witness |
| `sheet` | 23 | 63 | 27 | nothing on screen at 390 px, or nothing to measure |
| `nests` | 14 | 17 | 82 | 82 nulls: a button demo has no menu to nest, and the probe does not invent one |
| `animates` | 62 | 4 | 47 | no interactive node and no click to observe |
| `keyboard` | 27 | 4 | 82 | the probe's `keyboard` is "Tab reaches the rows **of the region it located**"; with no region there is no answer |
| `shape` | 24 | 62 | 27 | a demo that rendered nothing |

`nests` and `keyboard` are the two columns the instrument is narrowest on, and the numbers say so rather than
hiding it: both are near-universally `null` outside sidebars and menus. That is the honest shape of the tool, and
the page prints "not measured" — never "no" (`site/behaviour.ts`, rule 1).

Across the 67 pages that now render a table, the columns printed are `collapses`, `sheet` and `shape` on all 67;
`animates` on 47; `nests` and `keyboard` on 13 (sidebars, app shells, dashboards). A column nobody in the set
answered is dropped rather than printed as a row of "not measured".

## The effect, measured — not counted from the data, counted in the browser

89 type routes walked in Chromium against the served build, reading `[data-type-facts]`, `[data-type-table]`,
`[data-type-row]`:

| | before | after |
| --- | --- | --- |
| type pages with a table | **1** of 89 | **67** of 89 (66 gained one; Sidebar already had it) |
| rows, total | 4 | **70** |
| rows per table page | — | min 1 · **p50 1** · p90 1 · max 4 |
| pages with exactly one row | — | 66 |
| the one multi-row page | Sidebar, 4 rows | Sidebar, 4 rows |
| pages whose "Also in this set" list is non-empty | — | 58 |
| console errors while walking all 89 | 0 | 0 |

The 22 pages still without a table: the 21 types whose every member is reference-only (Attachment, Marker,
Navigation, Search, Voice, all eight `Effects/*` types, Fonts, all seven `Docs/*` types) and `Charts/Chart
demonstrations`, whose demo throws.

## Probe cost, and the machine it ran on

One browser at a time, one `node` process per item (so a hung demo costs one item), 75 s cap per item.

| | |
| --- | --- |
| per item | **p50 6.01 s · p95 10.71 s · max 14.79 s** (probe + node startup + browser launch) |
| the run | 92 items in **584 s** (9.7 min) |
| load average while it ran | **9.4 → 8.2 → 7.0** (1/5/15 min at the end), on **4 cores**; the 5-min average sat between 5.0 and 8.2 for the whole run |
| known slow case | a demo that never mounts costs 2 × 15 s mount timeouts on the structure pass before it is reported, ~35 s, still inside the cap |

The cost of the next batch is therefore predictable: `--set more-members` proposes the *next* demoed member of each
type (round-robin, so a batch of 40 spreads over 40 types), and 40 items ≈ 4 minutes at these numbers.

## What changed in the code

| file | change |
| --- | --- |
| `scripts/probe-behaviour.py` | **new.** The selection and the bookkeeping around `app/probe_behaviour.mjs` — not a second instrument. Sets: `type-first` (default), `more-members`, `all-members`, `--concept`, `--item`. `--batch`, `--cap`, `--refresh`, `--retry-unknown`, `--timings`, `--dry-run`. Prints every item with its facts, its seconds and an ETA; rewrites the file after **every** item, so an interrupted run is a committed run; refuses to measure a served build whose asset hash is not `app/dist`'s. |
| `app/behaviour.json` | the 25 sidebar records plus 88 new ones. Each carries `at` (when that item was measured), the probe's `version`, the six facts, the witness details and — where nothing was measured — `reason`. A new top-level `runs` list records each batch (set, measured/unmeasured, cap, p50/p95/max/total). |
| `app/src/site/behaviour.ts` | `why()` now prefers a fact's **own** witness (`nestsHow`, `keyboardHow`, `sheetHow`) over the record's `reason`. A record measured on a button carries "no collapse control in the frame…", which was being printed as the explanation beside an unmeasured `nests` cell — the right words attached to the wrong column. |
| `qa/pick_line_check.mjs` | the sample is preferred-then-**derived** from the manifest. r7's own note says a new measurement "must not fail a gate"; r8-probe measured two of the three hardcoded unmeasured ids (`shadcn/accordion`, `beui/bloom-menu`), so the gate now keeps whatever of its preferred ids still qualifies and tops up from the build. The three no-demo ids are still asserted, under an honest label: after this run `answered` and `has a demo` are the same fact, so that branch is unreachable *with* facts and the gate says so. |
| `qa/type_page_check.mjs` | (1) it reads **its own repo's** manifest — it was hardcoded to `/…/design-catalog-site-r8-collections`, so a gate could serve one build and read another worktree's facts; (2) "a set nobody measured" is derived (`Attachment` by rule), because `components/button` is now a one-row table — the new normal, not a regression; (3) the `also`-list-with-demos property moved to a derived type that actually has unmeasured members *with* demos (`Accordion`), where it still has teeth. |

Not touched: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`, `master`,
`taxonomy.json`/`taxonomy.ts`, and every other worktree. No CSS was appended. No dependency was installed;
`app/node_modules` is the shared symlink and Playwright came from `/root/camofox-browser`.

## Verification

| | |
| --- | --- |
| port | **8896**, `127.0.0.1`, serving `app/dist` under `/design-catalog/` |
| asset hash | served `index.html` names **`assets/main-Dz5x87mb.js`**, and `app/dist/index.html` names the same file — confirmed by `curl` on both |
| build provenance in the data | `manifestSha256 9626b1b6fec30eee` (the manifest the set was selected from), `build b3b63c75a7eae81e` (`demo.html` as measured) |
| gates, all on that build | `smoke` **all routes ok** · `r2_check` **ok** · `type_page_check` **ok** (34 assertions, both derived samples named in the output) · `pick_line_check` **ok** (10 measured, 3 unmeasured, 3 no-demo) · `stage_check` **ok** · `tap_check` **ok** · `mobile_state_check` **ok** · `contrast_check` **ok — 50/50 at 4.5:1** · `taxonomy_check` **ok — 89 types, 569 members + 200 variants = 769** |
| `python3 app/check_chrome.py` | green — 27 shell files, every interactive element a catalogue component |
| `app/manifest.json` | **unmodified in the commit.** `publish.sh` runs `gen.py` (line 6) then `vite build` (line 9), and `gen.py`'s behaviour block attaches these records at publish time — that is how the 67 tables reach `docs/`. The verification build used a locally generated manifest; it was reverted before the commit, and `git status` on the branch is clean. |

## What this is not, said plainly

1. **One row is not a comparison.** 66 of the 67 tables have exactly one row, so the sort control sorts one row
   and the columns answer 2–4 facts about a single member. What the page gained is *evidence plus a derived
   "pick this if…" line where there was nothing*; what it did not gain is a field to choose within. The next batch
   (`--set more-members`) is one command and roughly 4 minutes per 40 items — that is the honest way to make those
   pages comparisons, and it is deliberately not this unit.
2. **The date is the run's date.** `gen.py` stamps every record with the file's top-level `probed_at` (the newest
   measurement), which is exactly right for a file measured in one run — this one was — and would be one day stale
   for older rows in a file that spans several days. Each record keeps its own `at` beside it and `runs` keeps the
   batches, so a future mixed file can be spotted; nothing in this commit misdates a row.
3. **`null` is still not `false`.** 27 records answer nothing and print "not measured", and 82 of 113 records
   cannot answer `nests` or `keyboard` because the probe finds no menu region to test in a button. The instrument's
   blind spots are still its own (`PROBE_LIMITS`, quoted verbatim in the data file).
4. **Four of the 68 targets are "first member" by taxonomy order, not by quality.** `beui/action-swap` stands for
   all 21 Button members. Nothing about that choice claims it is the best button; the page says how many members
   it is not showing.
