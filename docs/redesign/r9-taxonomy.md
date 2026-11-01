# r9-taxonomy — membership by identity, per-type columns, grid-first type pages, counts that admit variants

Worktree `/mnt/HC_Volume_105573741/design-catalog-site-r9-taxonomy`, branch `fleet/r9-taxonomy`, base `ced26e10`.
Port **8894** (`python3 -m http.server 8894` in `/tmp/serve-r9tax`, serving `app/dist` via symlink; asset hash checked
against the served `index.html` before measuring).

**STATE: working, committed (`d5544ed3`), no visual pass of the card grid at 390 px beyond the gates.**

## The rule (stated in `scripts/taxonomy.py`'s docblock, written into `taxonomy.json`'s `doc`)

**IS-RULE** — a member belongs to a type when the item *is* that thing, not when its name contains it. Applied in
order: (1) head noun of the item's own name; (2) ownership — a name that is a component's own control belongs to that
component; (3) preposition — `X with Y` is an X. Every move carries the demo source line that evidences it, and the
two items the review named that the rule *keeps* are written down with their source too (`spinner-button` is
`<Button disabled><Spinner/>Loading…</Button>`; `kbd-button` is `<Button>Accept <Kbd>⏎</Kbd></Button>`).

**ONE-AXIS** — a type means *what the thing is* or *how it moves*, never both. `kind: effect` items are transitions;
they live in Effects and nowhere else. Effects' eight thing-named types became `Card/Input/Loader/Media/Menu/Overlay/
Text transitions`, `Components/Text animation` moved in, `Effects/Motion` was dissolved into the transitions whose
part each of its five items moves. `qa/taxonomy_check.mjs` invariant 11 enforces it.

Reproduce: `python3 scripts/taxonomy.py` (writes the file and prints the whole diff); `--check` prints only.

## Before → after (`python3 scripts/taxonomy.py`)

| | before | after |
|---|---|---|
| types | 89 | **76** |
| members | 569 | **543** |
| variants folded | 200 | **226** (+26 heading cuts) |
| items | 769 | 769 (543 + 226) |
| single-item types | 15 | **0** |
| types created | — | **15 names** (4 genuinely new: Button group, Fields, Form libraries, Input groups; 4 renames: Layout, Menus, Files and attachments, Guides and release notes; 7 Effects renames) |
| types dissolved | — | 28 (15 singles + Field and form + Text animation + Motion + 10 renamed away) |

Sections after: Components 45 · Effects 7 · Docs 6 · Agent UI 6 · Blocks 5 · Charts 4 · Foundations 3.
Largest five after: Docs/Component docs 59 · Components/Form libraries 28 · Foundations/Fonts 26 · Components/Input 17
· Docs/Registry, CLI and MCP 16.

Members moved by the is-rule (each with its clause and evidence in the script): `dialog-close-button` → Dialog,
`input-with-button` + `textarea-with-button` → Input, `input-file` → Input, `input-group-button`,
`input-group-button-group`, `kbd-input-group`, `input-group-label` → new **Input groups** (4), 8 `button-group*` items
→ new **Button group** (the review said 12; the other four are its folded variants, which the count line now prints:
`8 items · 4 variants`), `navigation-menu` stays in Menus (a navigation control, not a navigation rail).
Singles merged with targets: Attachment → Files and attachments · Dock, Pagination, Preview rail → Navigation ·
Marker, Timeline → Item and list · Menubar → Menus · Search → Command · Separator → Layout · Status bar → Chart
demonstrations · Dashboards → App shells and navigation · Voice → Chat and messages · Changelog → Guides and release
notes · Pie and donut → Chart demonstrations.
Splits: Field and form (42) → Form libraries 28 / Fields 13 / Input groups 4 (45 after three arrivals).
Fonts: 52 → **26 members**, each typeface's `font-heading-*` cut folded as a **variant** (so `Fonts` prints
`26 items · 26 variants`, and nothing special-cases fonts).

## Per-type columns

`taxonomy.json` gains `columns: { "Section/Type": [keys] }`, generated from what that type's members can actually
answer: `demos` (the item's own demo list), `sizes` / `loading` / `icons` / `states` (read off the demo **labels** —
the library's own words, `Size`, `Spinner`, `Icon`, `Disabled`), `files` (manifest `file_count`), plus a measured
behaviour fact **only** where the probe returned a boolean for a member of that type. 6 types declare nothing; no type
declares a column nobody answered (check 12). Examples: `Components/Button` → `demos, sizes, loading, icons, files`;
`Components/Calendar` → `demos, files`; `Foundations/Fonts` → none; `Effects/Text transitions` → `demos, files`
(the transitions are reference-only: the probe ran and answered `null` for all six facts, so nothing is declared).
`null` still prints "not measured" wherever a declared column is genuinely undetermined; the renderer drops a column
none of a type's members answer. Registry: new `app/src/site/columns.ts` (keys → cell, witness, sort rank).

## Grid first, table on merit

`TABLE_FLOOR = 2` in `columns.ts`, argued there: a table is a comparison; one row is a paragraph with a header, which
is what round 8 shipped on 66 of 67 pages. A type prints its table only when ≥2 members answered its measured columns
— today one type (Components/Sidebar, 4 of 7). Everything else leads with `.type-grid`: real thumbnails on
`surface-300` with a border, scaled to the card (REF_WIDTH 768, zoom clamp 0.2–1.6), plus the type's own facts.
The grey "DEMO" boxes were a bug: the lazy pool was only told about windows inside the table (`tableHost`), so the
windows under "Also in this set" never mounted. One observer now sweeps every `[data-row-demo]` on the page; the pool
still caps at 2 frames (gate-verified: `2 live, 2 iframes`).

## Counts

`itemsLabel()` in `taxonomy.ts` is the only spelling: `N items · M variants` (no clause when M = 0). Printed by the
type page header, every rail row (own line — the phrase does not fit beside a name in 240 px), every browse card and
the browse section headers. `Charts/Chart demonstrations` prints `3 items · 76 variants`.

## Gates — every assertion changed, and why

`qa/taxonomy_check.mjs` (was 9 invariants, now 13 groups; the banned-plural list is untouched):
- 4 "every type has a member": message now reports the **smallest** type (was `1`), because 10 asserts >1.
- **new 10** no single-member type (the review's 15 must stay merged).
- **new 11** one axis: every Effects type `… transitions`, no motion-named type outside Effects, no type name used in
  two sections.
- **new 12** every type declares its columns; every declared key is one the site can print; no declared measured
  column is unanswered by every member.
- **new 13** the file carries its `doc` (rule, axis, columns, table, counts, singles).
- unchanged: 1/2/3/5/6/7/8/9.

`qa/type_page_check.mjs`:
- sample types are now derived from `TABLE_FLOOR` instead of "has no measured member": no-table sample is
  **Components/Button** (8 members, 1 measured — the review's own example), table sample is the first type with ≥2
  measured *and* unmeasured members that have demos (Blocks/App shells and navigation, 2 of 7).
- `data-type-unmeasured` / `[data-also-row]` → `[data-member-card]` (the "also" list is a grid now); the header no
  longer prints an unmeasured count.
- "every header is a sort control" now compares against `data-type-measured-columns` (new attribute), because
  `data-type-columns` is the type's whole declaration and only measured columns get a sort header.
- `data-type-table` on the facts line renamed `data-type-has-table` — the `<Table>` element already owned
  `data-type-table`, and the collision made `querySelectorAll("[data-type-table]").length` count the paragraph.
- new: cards get windows and at least one is live (the grey-DEMO regression check); per-type column samples
  (Button must declare sizes/loading/icons and no behaviour column; Calendar no behaviour column; Fonts none;
  Text transitions only reference-free columns); `N items · M variants` asserted on the type page, a rail row
  (`[data-rail-count]`) and a browse card (`[data-type-card-count]`); the mostly-variants type
  (Charts/Chart demonstrations) prints its variants.
- the 390 px block is unchanged and still passes (no overflow, 24/24 fact cells visible and labelled, 12 px floor,
  all taps ≥44 px, ≤2 live frames).

Ran here: `qa/taxonomy_check.mjs` ✓ (76 types, 543 + 226 = 769) and `qa/type_page_check.mjs http://127.0.0.1:8894/
design-catalog/` ✓ 47/47 after the CSS move; `app/check_chrome.py` ✓; `npx vite build` ✓. One transient miss on
`#/t/components/fields` during a loaded run was re-checked by hand (renders `Fields · 13 items · 2 variants · 1
library`); the lead asked for gates to stop so the remaining suite is the lead's to run.

## Other files touched

`app/src/site/TypePage.tsx` (rewritten: grid first, cards, per-type columns, one observer, counts), `Rail.tsx`
(type rows wrap and print the count phrase; section rows print `items · variants`), `BrowseByType.tsx` (cards and
section headers), `app/src/styles.css` (appended block `/* ---- taxonomy, per-type columns and counts (r9) ---- */`
only; the old `.also-list` rules are left in place and are now dead), new `app/src/site/columns.ts`.

## COULD NOT DO

- Visual review of the card grid at 390 px and at 1440 by eye — the gate asserts geometry, not taste. Not run.
- `behaviour.json` re-probing: the transitions could not be measured (reference-only), so Effects types print no
  measured column. Fixing that is an ingest/probe job, not a taxonomy one.
- Split `Form libraries` (28) further by library; the brief named three groups and I shipped three. It is now the
  largest Components type and the honest next split is Formisch / React Hook Form / TanStack Form.

## UNSURE

- "Button Group (12 items)": I ship **8 members + 4 folded variants**. The 12 the review counted includes the
  variants, which the type page now prints as a number rather than as rows. If the lead wants 12 real members, four
  of them would have to be de-folded, which contradicts §5.
- `Components/Button` keeps `spinner-button` and `kbd-button` against the review's list, on the source's evidence.
  If the lead disagrees, the change is one line each in `IS_MOVES` and the argument is in the docblock.
- `Effects` types declare no measured column today. If a future probe measures a transition, the declaration appears
  by itself (the generator filters on real booleans) but no page is guaranteed to look right with it.
