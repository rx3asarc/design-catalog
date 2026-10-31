# r4-compare-behaviour — the columns that tell one sidebar from another

Branch `fleet/r4-compare-behaviour`, base `master` (`fbbe92d1`, "round 3, all five units…").
Worktree `/mnt/HC_Volume_105573741/design-catalog-site-r4-compare-behaviour` (the branch is checked out
there; `/root/design-catalog-site` was left alone on `master`).

The tester was right, and right about the order of the fix: *"the columns are licence, kind, files, KB, deps,
parts, used-here and live demo. None of those helps someone pick a sidebar."* That was a **data** problem
first — behaviour was not in the manifest — so this unit measures behaviour in a browser and only then lets
the page print it.

---

## 1. Measured, in a real browser

`app/probe_behaviour.mjs` (new, Node + Playwright, no new dependencies). It reads `app/manifest.json` for the
set and the demo variant, serves `app/dist` under the vite base `/design-catalog/`, and loads each demo in the
site's own frame protocol:

```
demo.html#<item id>|<variant index>|static=1&theme=light
```

Three loads per item:

| pass | frame | flags | what it is for |
|---|---|---|---|
| structure | 1440×900 | `static=1&theme=light` | region, nesting, declared durations, keyboard, shape |
| interaction | 1440×900 | `theme=light` | press the collapse control, watch ~12 frames |
| narrow | 390×844 | `static=1&theme=light` | does it come back as a sheet |

**Why the interaction pass drops `static=1`** (the one place this unit departs from the brief's literal
protocol, and the reason): `static` sets `dc-static`, whose rule is `animation-play-state: paused`. Computed
* durations* stay readable and the DOM is the DOM, so the structure pass is unaffected — but a keyframe-driven
collapse frozen on frame 0 can never be *observed* to finish. `static` is a thumbnail device, not the demo's
behaviour, so the click pass runs the same protocol unfrozen.

### The raw table — `sidebar`, item × six facts

`T` true, `F` false, `-` null ("the probe could not tell").

| item | collapses | becomes a sheet @390 | nests | animates | keyboard | shape |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `beautifului/sidebar-nav` | - | - | - | - | - | - |
| `beui/ai-sidebar` | T | T | T | T | T | T |
| `beui/animated-sidebar` | T | T | T | T | T | T |
| `beui/bounce-sidebar` | F | F | - | T | - | F |
| `rareui/bounce-sidebar` | - | - | - | - | - | - |
| `rareui/hook-sidebar` | - | - | - | - | - | - |
| `rareui/proximity-sidebar` | - | - | - | - | - | - |
| `shadcn/sidebar-01` | T | T | F | T | T | T |
| `shadcn/sidebar-02` | T | T | F | T | T | T |
| `shadcn/sidebar-03` | T | T | T | T | T | T |
| `shadcn/sidebar-04` | T | T | T | T | T | T |
| `shadcn/sidebar-05` | T | T | T | T | T | T |
| `shadcn/sidebar-06` | T | T | F | T | T | T |
| `shadcn/sidebar-07` | T | T | T | T | T | T |
| `shadcn/sidebar-08` | T | T | T | T | T | T |
| `shadcn/sidebar-09` | T | T | F | T | T | T |
| `shadcn/sidebar-10` | T | F | T | T | F | T |
| `shadcn/sidebar-11` | T | T | T | T | T | T |
| `shadcn/sidebar-12` | T | T | F | T | T | T |
| `shadcn/sidebar-13` | F | T | F | T | T | T |
| `shadcn/sidebar-14` | T | T | T | T | T | T |
| `shadcn/sidebar-15` | T | T | T | T | T | T |
| `shadcn/sidebar-16` | T | T | T | T | T | T |
| `shadcn/sidebar` | T | T | T | T | T | T |
| `shadcn/docs-components-sidebar` | - | - | - | - | - | - |

| fact | true | false | null | n |
|---|--:|--:|--:|--:|
| collapses | 18 | 2 | 5 | 25 |
| sheet | 18 | 2 | 5 | 25 |
| nests | 13 | 6 | 6 | 25 |
| animates | 20 | 0 | 5 | 25 |
| keyboard | 18 | 1 | 6 | 25 |
| shape | 19 | 1 | 5 | 25 |
| **all** | **106** | **12** | **32** | **150** |

Five of the nulls are the five members with no demo at all (3 × rareui, beautifului, shadcn's docs page):
reference-only items cannot be measured, and the page says "not measured", not "no". The sixth null is
`beui/bounce-sidebar`'s nesting/keyboard, where the probe could not locate a sidebar region in a demo that
is a bare list of five buttons — again null, not `false`.

The probe prints its own warning for that case, so a run that measured nothing is never mistaken for a run
that measured "no":

```
1 demo(s) shipped but were not fully answered (null is not false; each one says why):
  beui/bounce-sidebar — no collapse control in the frame: no named trigger, no rail, no toggle/menu/panel button
```

### The collapse *kind* — a fact the boolean loses

`collapses: true` covers two different things: a rail of icons (48 px) and a panel that slides away (0 px).
The probe publishes `collapseKind`, from the library's own `data-collapsible` when it declares one and from a
measured end-width when it does not:

```
icon rail   4  beui/animated-sidebar, shadcn/sidebar-07, shadcn/sidebar-09, shadcn/sidebar
off canvas 14  beui/ai-sidebar and 13 shadcn blocks (01-06, 08, 10-12, 14-16)
none        2  beui/bounce-sidebar, shadcn/sidebar-13
null        5  the five members with no demo
```

Witness stored per item, e.g. `shadcn/sidebar-07`: `data-collapsible="icon"`, pressed "Toggle Sidebar",
width 256 → 48 px (81%), `data-state` expanded → collapsed.

---

## 2. Stored, and published

One file the build reads: **`app/behaviour.json`** (`probe`, `version` = `behaviour/1`, `probed_at`,
`frames`, `selection`, `manifestSha256`, `build`, `facts`, `counts`, `limits`, `items`). One record per item:
the six facts, their witnesses, the probe's version and the day it ran — because a behaviour fact is a
measurement of a moment, not an eternal truth.

`app/gen.py` gained **one block** (nothing else in it changed). It reads the record and attaches it to each
manifest entry as `behaviour`, and it refuses to publish a fact that is not `true`/`false`/`null`:

```
behaviour behaviour/1 (2026-10-28T22:55:08Z): attached to 25 item(s)
```

An item the probe never reached has **no** `behaviour` key — absent, which is not six nulls. The store was
not touched (`schema.sql` / `query.py` unchanged); `verify.py` still reports *all invariants hold*.

**Stability.** Two independent full runs agree on 25/25 items × 6 facts:

```
items differing across two independent runs: 0 of 25
```

Getting there found a real bug worth recording: `page.goto()` to a URL that differs only in the **hash** is a
*same-document* navigation, so the previous item's demo stays mounted and every fact after it is that demo's
fact. In the first run the numbers were one demo behind the id they were filed under. Every load now goes
`about:blank` first. A second one: a frame that mounts nothing was being measured as an empty document, so a
slow mount produced `nests: null` for `shadcn/sidebar-15`; a load that never mounts now throws, retries once,
and then reports nulls with a reason instead of a partial measurement.

---

## 3. The page prints them

`site/behaviour.ts` (new) holds the fact types, the six column definitions, the null discipline and the
"pick this if…" derivation. `site/Compare.tsx` builds the table from them.

### Columns, before → after

| before (`master`) | after (this branch) |
|---|---|
| source | source — moved out of the table into the row's own label (it is identity, not a measurement) |
| licence | **gone from the table** (still on the item page) |
| kind | **gone** |
| files | **gone** |
| size (KB) | **gone** |
| deps | **gone** |
| parts | **gone** |
| used here | **gone** |
| live demo | **gone** |
| — | `collapses` — to icons / off-canvas / no |
| — | `nests` — one level / two deep / three deep |
| — | `at 390 px` — a sheet / stays put |
| — | `keyboard` — reaches rows / no |
| — | `shape` — a page / a component |
| — | `moves` — yes / no |

### What `#/c/sidebar` actually prints

```
25 members · 4 sources · 5 of 6 columns differ · 25 measured
heads: ["item","collapses","nests","at 390 px","keyboard","shape"]
dropped: animates        →  "Dropped, because they do not separate the members of “sidebar”:
                              moves = yes (20 of 25 answered)."
not-measured cells: 27   →  5 no-demo members × 5 columns, plus beui/bounce-sidebar's nests and keyboard
```

**The dropped column and why.** `animates` is identical for every member that could answer it — every sidebar
that ships a demo declares at least one transition (5–34 of its interactive nodes each, longest 200 ms). The column
is dropped *and named with what it said*, which is the existing rule doing its job: a column that cannot
separate two members cannot help anyone choose between them.

**One refinement to that rule, made deliberately.** "Identical" is now judged on the rows that could *answer*,
not on the printed text. A column that 20 members answer "yes" and 5 cannot answer at all has two printed
values but no comparison in it — a badge with a footnote — so it is dropped and named too. Without this, a set
with one no-demo member would keep every column alive and the page would be back to an inventory.

**`null` never renders as `false`.** A cell whose fact is null prints `not measured`, muted and italic (never
a dash), with a `title` that says why: *"not measured: no demo: this item is reference-only, so there is
nothing to measure"*. `data-col-measured="false"` marks each one.

**A set nobody measured is not a set whose members agree.** The record covers `sidebar`; open any other
concept and every fact is null. The page has two different reasons for showing no table, and says which one:

> Nobody has measured how the 4 members of “accordion” behave, so there is nothing to compare here: 4 items and
> no measurement between them. A table would be a list with lines drawn on it, so there is not one.
>
> Dropped, because none of them could be answered for “accordion”: no member of this set has a measured
> behaviour, so all 6 columns read “not measured”.

The tempting wording — "these 4 items answer every measured behaviour the same way" — is false there, and reads
as a claim that they behave alike. It survives only for the case it is true of, and the count of members with
nothing measured is stated as *"carry no measured behaviour"* rather than "have no demo", because the build
knows the first and only sometimes the second.

### "Pick this if…" — one per member, derived

Built in one template from that member's own facts (`pickLine` in `site/behaviour.ts`), three clauses,
rarest-in-this-set first so the line leads with what separates the member from the ones beside it. No
ranking, no winner, no score — the rule is written into the header comment of both files so the next reader
does not "restore" the older purism that refused to say anything about an individual item.

```
shadcn/sidebar
  Pick this if you want a sidebar that nests its menu two levels deep, collapses to an icon rail
  and comes back as a sheet on a 390 px frame — measured in this demo on 28 October 2026.

shadcn/sidebar-13        (the only member that does not collapse)
  Pick this if you want a sidebar that does not collapse, keeps its menu to one level and comes
  back as a sheet on a 390 px frame — measured in this demo on 28 October 2026.

beui/bounce-sidebar      (the only member that is a component, not a page)
  Pick this if you want a sidebar that sits in the frame as a component, does not collapse and
  stays put at 390 px instead of becoming a sheet — measured in this demo on 28 October 2026.
```

20 of 25 members get a line; the five with no demo get none, because the facts do not support one.

### How the set was chosen, in a visitor's sentence

The store's `concept.rule` is the source of truth (`keyword: lower(slug) LIKE '%sidebar%' OR
lower(name) LIKE '%sidebar%'`) and the build does not publish it (a hand-typed copy of 29 store rows would be
a second copy that silently drifts). So the page **checks** the naming rule against the members it was
handed instead of quoting it:

> These are the 25 items this catalogue files under “sidebar” — the name is the rule, and every one of them
> carries “sidebar” in its own name or slug.

If a member ever fails that test the sentence degrades honestly ("3 of them carry “sidebar” in their name and
2 do not, so the name is not what makes this set"), and no internal build note appears anywhere on the page.
The measurement is dated for the visitor: *"…driven in a real browser, most recently on 28 October 2026
(behaviour/1)."*

---

## 4. Cross-check: one item by a different method

A measurement nothing cross-checks is a guess with a screenshot. So `nests` — the fact with the most room to
be wrong — was re-derived from the **source**, in no browser: count `<SidebarMenuSub` in every `.tsx` under
`src/registry/new-york-v4/blocks/sidebar-*/`.

| block | `<SidebarMenuSub` in source | probe `nests` | agreed |
|---|--:|:--:|:--:|
| sidebar-01 | 0 | false | ✅ |
| sidebar-02 | 0 | false | ✅ |
| sidebar-03 | 1 | true | ✅ |
| sidebar-04 | 1 | true | ✅ |
| sidebar-05 | 1 | true | ✅ |
| sidebar-06 | 0 | false | ✅ |
| sidebar-07 | 1 | true | ✅ |
| sidebar-08 | 1 | true | ✅ |
| sidebar-09 | 0 | false | ✅ |
| sidebar-10 | 1 | true | ✅ |
| sidebar-11 | 1 | true | ✅ |
| sidebar-12 | 0 | false | ✅ |
| sidebar-13 | 0 | false | ✅ |
| sidebar-14 | 1 | true | ✅ |
| sidebar-15 | 1 | true | ✅ |
| sidebar-16 | 1 | true | ✅ |

**16/16.** Worth saying how nearly this was wrong: the first hand-check used `grep -c 'SidebarMenuSub'` on
`components/app-sidebar.tsx` only, and disagreed on four items — because those blocks keep their sub-menu in
`components/nav-main.tsx`. The *source* read was wrong there, not the probe. (A first probe version also read
`nests` true for all sixteen, from a selector bug: `[data-sidebar*="menu"]` matches `menu-item` and
`menu-button`, so a flat menu read as two levels. Container names are now exact.)

A second, cheaper cross-check fell out of `collapses`: shadcn's `data-collapsible` is declared in source, and
the three `collapsible="icon"` blocks (07, 09) are exactly the three the probe measured collapsing to a 48 px
rail. Everything else declares the default `offcanvas` and measured a 256 → 0 px slide.

---

## 5. The probe's limits — what it cannot see

Quoted from `PROBE_LIMITS` in the probe:

- a fact is about the demo the catalogue opens (variant 0), not about the other variants an item may ship —
  `shadcn/sidebar` ships four variants and only "Default" was measured;
- an item with no demo has no measurable behaviour: all six facts are null, and null is not false;
- collapse is measured through the controls present in the frame; a collapse offered only inside a dropdown is
  missed;
- sheet is measured at 390×844 with a role=dialog test: a drawer that is not a dialog (a plain fixed panel)
  reads false;
- nesting is depth of menu containers in the DOM, so a sub-menu that renders only on hover or into a portal is
  missed;
- animation is counted from computed durations on interactive nodes plus one click observed over ~12 frames;
- keyboard is Tab and one arrow key; it is not a screen-reader or focus-trap audit;
- shape is a rule of thumb (width ≥ 90% of the frame, bottom ≥ 75% of it), and its numbers are published
  beside it so the reader can disagree with the verdict.

Two measurements that are *true of the frame* and would mislead if read as facts about the component, and are
recorded because they are what the shipped demo does:

- `shadcn/sidebar-10` `keyboard: false` — that demo opens with a **modal popover** that owns every tab stop, so
  40 tab presses never reach the sidebar rows. The sidebar itself is ordinary shadcn markup. The cell's
  `title` says exactly this ("40 tab presses never landed on a control inside the sidebar").
- `shadcn/sidebar-13` `sheet: true` — its sidebar only ever exists inside a settings dialog, so at 390 px a
  dialog is "open at load". True, and the reason is in the `title`.

Also honest: `sheet` needed two fixes before it was trustworthy — Radix **popovers** carry `role="dialog"`
(so a demo with a floating panel open read "becomes a sheet" at every width), and a **closed** sheet is a
dialog node merely translated off-frame (`x: -216, width: 216`). Panels are now required to be on screen and
not popover surfaces.

---

## 6. Proof

| check | result |
|---|---|
| raw table, counts of true/false/null | above: 106 / 12 / 32 of 150 |
| hand-check by a different method | 16/16 on `nests` against the source |
| `#/c/sidebar` at 1440 | 5 of 6 columns printed (`collapses`, `nests`, `at 390 px`, `keyboard`, `shape`), `animates` dropped and named, 25 rows, 27 `not measured` cells, 20 pick lines, no horizontal overflow, 0 controls under 44 px inside the page |
| `#/c/sidebar` at 390 | same 5 columns stacked as cards (label + value), pick line as its own row per card, no overflow, **0 controls under 44 px** |
| `grep -inE "best\|winner\|rank\|score" app/src/site/Compare.tsx app/src/site/behaviour.ts` | 5 hits, **all** inside the header comments that forbid them (plus `shrinkPct`, renamed from `shrankByPct` so the substring does not trip the grep); no hit in code or page copy |
| `python3 app/check_chrome.py` | exit 0 — *every interactive element is a catalogue component*, 18 shell files scanned (it globbed `site/*.tsx`, so `behaviour.ts`'s consumer is covered) |
| `verify.py` | *all invariants hold* (the store was not touched) |
| page turn | 250 ms, untouched (`PageTurn.tsx` `DURATION = 250`, not modified) |
| controls under 44 px | 0 inside `.page-in` at both widths (the 152 elsewhere on a 1440 page are the site's own rail and chrome, which this unit does not own) |
| another concept, no record | `#/c/accordion`, `#/c/table` → no table, and the copy says *nobody measured*, not *they behave alike*; no console errors |
| every commit builds | `vite build` run at each of the three page commits, clean |

Build: `npx vite build` clean; `python3 app/gen.py` idempotent on `master` and attaches
`behaviour behaviour/1 … attached to 25 item(s)` on this branch.

---

## Commits — `fleet/r4-compare-behaviour`, one per numbered item

```
d9ffd7cd probe: measure the six behaviour facts in a browser            (1 · probe_behaviour.mjs)
b10b4ad9 behaviour: store the probe's record and publish it per item     (2 · behaviour.json, gen.py, manifest.json)
78d2ae0c compare: print behaviour columns, and "not measured" where …    (3 · behaviour.ts, Compare.tsx)
0df270bc compare: one derived "pick this if…" line per member            (4 · pickLine + its row)
cfcd6f49 compare: say how the set was chosen, in a visitor's sentence    (5 · the set's provenance)
```

## Files

- `app/probe_behaviour.mjs` — new: the browser probe (§1)
- `app/behaviour.json` — new: the record it wrote, `behaviour/1`, 2026-10-28T22:55:08Z (§2)
- `app/gen.py` — one additive block: attach the record to items, refuse a non-boolean fact (§2)
- `app/manifest.json` — regenerated, now carrying `behaviour` on 25 items (§2)
- `app/src/site/behaviour.ts` — new: fact types, the six columns, the null discipline, `pickLine` (§3, §4)
- `app/src/site/Compare.tsx` — behaviour columns replace the inventory columns; "not measured"; the derived
  pick line as its own row; the set's provenance said in a visitor's sentence (§3, §5)

Not touched: `home/Tile/Gallery/Rail/ItemPage/route/Code/demo/Stage/CommandPalette`, `styles.css`,
`index.html`, `demos/**`, `docs/**`, `publish.sh`; no new dependencies.
