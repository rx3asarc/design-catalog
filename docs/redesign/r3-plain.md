# r3-plain — English a visitor already speaks, and the small lies that are just typos

Branch `fleet/r3-plain` (worktree `/mnt/HC_Volume_105573741/design-catalog-site-r3-plain`), base **master @
`95ed4720`**. Four commits, one per numbered item:

```
f8f9f029  r3 plain 1: the jargon table, in plain English a visitor already speaks       (item 1)
185e781e  r3 plain 2: one plain sentence per licence, defined once, raw value kept        (item 2)
1d5b5b9f  r3 plain 3: four text errors — a plural, a repeated label, one spelling, and arithmetic  (item 3)
f67b27c5  r3 plain 4: nothing invented — numbers from the data, and two claims made true  (item 4)
```

Files: `app/src/site/Home.tsx`, `ItemPage.tsx`, `About.tsx`, `ChromePage.tsx`, `app/src/provenance.tsx`.
`git diff --stat 95ed4720..HEAD`: 5 files, +140 / −38. Nothing else — `Tile.tsx`, `Gallery.tsx`, `route.ts`,
`Compare.tsx`, `Rail.tsx`, `App.tsx`, `Code.tsx`, `demo.tsx`, `Stage.tsx`, `CommandPalette.tsx`, `styles.css`,
`index.html`, `gen.py`, `manifest.json`, `demos/**`, `docs/**`, `publish.sh` untouched; no new dependency, no new
data.

**Scope note (mid-unit, from the lead):** the front-page hero row (`HeroRow`, `HERO_TILES`, `HERO_NOTE` and its
caption) was handed back to the lead while this unit ran. No commit here touches it. The one item-4 change that
would have lived there (`HERO_NOTE`'s typed "six") was dropped from this unit and the typed-numeral fix was taken
from `About.tsx` instead; nothing needed reverting.

---

## 1. The jargon table, applied — and where honesty overruled the suggestion

| # | file:line | before | after |
|---|---|---|---|
| 1 | `Home.tsx:294` | "Four sections in the rail, down to families." | "Use the menu: {RAIL.length} sections, and inside each one the items are grouped by what they are." |
| 2 | `Home.tsx:164` | `source withheld` (terminal row suffix) | `code not shown (licence)` |
| 3 | `Home.tsx:356` | link: "what it is made of, counted from the page" | link: "the components it is made of, counted from the page" |
| 4 | `ItemPage.tsx:94` | badge: `source withheld` / `source included` | badge: `code not shown` / `code shown here` |
| 5 | `ItemPage.tsx:154` | "The code is theirs. It is not republished here; their page has it." | "Code not shown here because the licence does not allow us to republish it. See it on rareui.com." (host read from `item.page`; dropped when the item has none, so the sentence never names a page that does not exist) |
| 6 | `About.tsx:136` | "**local-only** — 93 items. Read the source in the original and re-implement it; it is not redistributed here." | "**Not copied here** (`local-only`) — 93 items. The code is not copied here; read it on the original site and re-implement it instead." (the manifest's policy value is kept, in a code span, so the plain words sit beside the data word) |
| 7 | `About.tsx:141` | `"Source included" is a licence label…` | `"Code shown here" is a licence label…` (the badge it quotes was renamed in row 4) |
| 8 | `About.tsx:74` | `{s.withheld} withheld` (per-source line) | `{s.withheld} not copied here` |
| 9 | `About.tsx:163` | "The 93 entries without source" | "The {c.withheld} entries whose code is not copied here" |
| 10 | `ChromePage.tsx:128` | page title: **Chrome** | page title: **Components used to build this site** |
| 11 | `About.tsx:202` | "What this site is built from →" | "Components used to build this site →" |
| 12 | `ChromePage.tsx:39` | "the rail frame and the trigger that reopens it" | "the menu's frame, and the button that reopens it" |
| 13 | `ChromePage.tsx:40` | "every level of the rail, and each family inside it" | "every level of the menu, and each group inside it" |
| 14 | `ChromePage.tsx:43` | "the filter box above the rail" | "the filter box above the menu" |
| 15 | `ChromePage.tsx:132` | "a level of the rail" | "a level of the menu" |
| 16 | `ChromePage.tsx:166` | "the tag rendered somewhere else in this session" | "the tag appears somewhere else in this session" |
| 17 | `provenance.tsx:246` | `· used {n}×` | `· used {n} time(s) on this page` |
| 18 | `provenance.tsx:255` | `· {n} on this page · no page` | `· {n} time(s) on this page · it has no page of its own` |

**Where the tester's wording was not used, and why.**

- *"Use the menu on the left."* → "Use the menu". At ≤860 px the rail is `display:none` (`styles.css:239`)
  until the topbar's "Browse 769" opens it (`App.tsx:47-51`), so "on the left" is false on the phone the
  tester's own review was read on. The menu keeps its name and loses the false position.
- *"each section has groups"* → "the items are grouped by what they are". `route.ts:196-199` collapses a section
  whose single declared category repeats it (`Blocks and pages`, `Motion and effects`, `Docs` render their
  families one level shallower; only `Components` draws a named group level). "Each section has groups" would have
  been a small lie about three of the four sections. The count is `RAIL.length` — the rail's own tree, not a typed
  four.
- `"source withheld"` keeps **the licence** as the reason (rows 4-6): the badge names the licence in the plain
  list, the item page prints the raw licence string with its one sentence, and the sentence says the licence is
  why. The licence name is never dropped to shorten a sentence.
- `#/chrome`'s new title is in the page. **The rail does not read a shared constant** — `Rail.tsx:196` hardcodes
  `<a href="#/chrome">What this site is made of</a>` and `rail-legend` text. Reported below for the lead; there is
  no constant to change.

---

## 2. Licence wording — one sentence per value, defined once in `About.tsx`

The map is `LICENCES` in `app/src/site/About.tsx:30`, with `licenceName()` (`:57`) and `licenceSentence()`
(`:60`). **`About.tsx` owns it**, because that file is the licensing explanation ("This is where the licensing
explanation lives", its own header), and `ItemPage.tsx` imports it (`ItemPage.tsx:11`) — the item page is a
reader, not a second author. Both pages therefore print the same words, and a fifth licence value is one line in
one file.

| raw value (manifest) | plain name (badge / list) | one sentence |
|---|---|---|
| `MIT` | MIT | Free to use, and it allows the code to be copied and published. |
| `MIT with no-redistribution clause` | MIT, no redistribution | Free to use, but it forbids passing the code on, so it is not copied here. |
| `free-to-use (repo reports NOASSERTION)` | free to use, no published licence | The source calls it free to use, but no official licence is published: the repository has no licence file. |
| `unclear` | licence unclear | No licence terms were found at the source, so the code is not treated as ours to copy. |

**The raw value stays on the page** (the brief's requirement, and the reason the sentence cannot drift):

- item page: `ItemPage.tsx:96` badge carries `title={item.licence}` (the badge text is `{licenceName(item.licence)}`, `:97`); `ItemPage.tsx:115-117` prints the raw string
  in a `<code>` span followed by the sentence — `Licence: unclear — No licence terms were found at the source, so
  the code is not treated as ours to copy.`
- `#/about`: `About.tsx:156` prints `<code title={raw}>{raw}</code> — {sentence}` per licence, with the item count
  read from `./counts` (676 / 43 / 29 / 21).

**NOASSERTION is not shown as a licence name anywhere.** It appears only inside the raw string, in a code span,
and the sentence beside it says what it means: the repository publishes no licence file — which is not the same as
"MIT", and not the same as "no licence exists". A value the map has never met gets **no sentence** (`null`, not a
shrug in English) and the raw string alone.

---

## 3. The four text errors (#17)

### 3a. "1 files" → pluralised from the count

| file:line | before | at 1 file | at 12 files (`beui/dynamic-island`) |
|---|---|---|---|
| `ItemPage.tsx:100` | `{item.files.length} files` | `1 file` | `12 files` |
| `ItemPage.tsx:192` (withheld items) | `Source files ({n})` | `Source file (1)` | `Source files (12)` |

Measured, not asserted (`r3-plain-verify.json`): `#/i/shadcn/button` badges `["code shown here","MIT","1 file","14
demos"]`; `#/i/beui/dynamic-island` badges `["code shown here","MIT","12 files","1 demo"]` and headers
`["Installation","Source files (12)"]`; the withheld `#/i/beautifului/agent-screen` reads `code not shown`,
`licence unclear`, `1 file`, then the heading `Source file (1)` (`r3-plain-after.json`, page text).

**One "Source files (1)" survives, and it is not mine:** `Code.tsx:41` prints `Source files ({files.length})` for
every **published** item, so `#/i/shadcn/button` still shows "Source files (1)". Reported below.

### 3b. The demo list shows "Default" twice — two different demos, one of them mislabelled

Both entries exist in `app/manifest.json` → `shadcn/button.variants`, and the label is **data**, rendered by
`demo.tsx:298` (`<span>{variant.label}</span>`), not by anything this unit owns.

| index | label | module | what it actually renders |
|---|---|---|---|
| `variants[0]` | `Default` | `demos/shadcn/button/v0.tsx`, export `ButtonDemo` | `<Button variant="outline">Button</Button>` + an icon-sized outline button with an arrow — **not** a default-variant button |
| `variants[2]` | `Default` | `demos/shadcn/button/v2.tsx`, export `ButtonDefault` | `<Button>Button</Button>` — the real default example |

So: **not** a duplicate index and not the same thing twice. Two genuinely different demos share a label, and the
first one's label is wrong.

Cause, from the generator: `app/gen.py:381-395` `fences_by_section()` names the fence that appears **before the
first markdown heading** `"Default"` (`gen.py:385`), and then walks the headings and adds a row per real section —
and shadcn's button docs have a heading literally titled *Default* (`gen.py:386-395`). The usage snippet and the
Default section therefore land on the same label.

Fix (not this unit's file, and it needs a manifest rebuild):
`app/gen.py:385 → out.append(("Default", first.group(1))) → out.append(("Usage example", first.group(1)))`
— the pre-heading fence is the docs' usage snippet, not a variant named Default. What they say **now**, verbatim
and unchanged: `["Default","Size","Default","Outline","Secondary","Ghost","Destructive","Link","Icon","With
Icon","Rounded","Spinner","Button Group","As Link"]`.

**Do not fix this with a string swap.** The label is regenerated from the docs markdown on every `gen.py` run, so
renaming `Default` in `manifest.json` by hand is undone by the next ingest. This is a naming collision inside
`fences_by_section()`, and it belongs there — with a guard, so a rebuild cannot reintroduce it:

```python
# gen.py, in fences_by_section(): the pre-heading fence is the usage snippet, not a section
out.append(("Usage example", first.group(1)))
...
# and after the loop, make the invariant explicit — a manifest with two variants of one item
# under one label is a bug this function can catch at build time instead of a reviewer catching it
# on the item page:
labels = [label for label, _ in out]
assert len(labels) == len(set(labels)), f"duplicate demo label(s): {labels}"
```

Measured: **exactly two of the 769 items repeat a demo label** — `shadcn/button` (`Default` twice, diagnosed
above) and `shadcn/combobox` (`Custom Items` twice, two markdown sections with the same title). So the assertion
above fires on both today and is the right shape for the fix: it turns "a reviewer notices a repeated label on an
item page" into "the manifest build refuses to write one". Two items to de-duplicate in the generator (or, for
combobox, in the docs' own section titles), not four label edits in the data.

### 3c. Spelling: "catalogue" and "licence"

`grep -rn "catalog\b\|license" app/src/site/` → **15 hits for `catalog\b`, 0 for `license`**, `licence` appears
104 times. Every one of the 15 is a path, URL, command or the product's name — none is the English noun, so none
was changed:

| file:line | hit | why it stays |
|---|---|---|
| `demo.tsx:93` | `/design-catalog/demo.html#…` | the Vite base path (`vite.config.ts` `base: "/design-catalog/"`) — changing it breaks every demo |
| `Home.tsx:118,121` | `…/design-catalog/data/design-catalog-latest.tgz`, `"design-catalog": {…}` | the published tarball URL and the MCP server's config key |
| `Home.tsx:137` | `design-catalog search "sidebar"` | the CLI binary's real name |
| `Home.tsx:145` | comment: "it named design-catalog 1.0.1" | the package's name in a comment |
| `Home.tsx:277` | `<h2 className="title">design catalog</h2>` | **the product's name**, spelled as `App.tsx:46` (topbar brand), `Rail.tsx:189` (`<h1>`) and the package name do. Not the English noun; see "what the lead must wire" |
| `Home.tsx:38` | comment: `docs/catalog-redesign/build/r2-home-tiles.md` | a repository path |
| `Compare.tsx:127` | comment: `/root/design-catalog/query.py` | a store path |
| `About.tsx:12` | `https://github.com/rx3asarc/design-catalog` | the repository URL |
| `About.tsx:63-66` | `CHECKSUMS` block: `data/catalog.json`, `docs/data/catalog.json` | **verbatim terminal transcript** shown to the reader; the file on disk is really called `catalog.json` |
| `About.tsx:196` | `<code>design-catalog stats</code>` | the CLI command |
| `Rail.tsx:189` | `<h1>…design catalog</h1>` | the product's name (not my file) |

`license` (American) appears nowhere in `app/src/site/`, so there was nothing to convert; this unit's copy was
already British. Files changed **for spelling**: none — the brief's rule was already met in prose; the only
divergence is the product name, which is consistent across the four places it is spelled and is listed for the
lead in case the team wants one spelling for the name too.

### 3d. About's 167 / 178 / 509 reconcile

One paragraph, `About.tsx:141-146`, every number from `./counts`:

> "Code shown here" is a licence label, not a file count. **676** items sit under the MIT licence, the only one
> that allows publication. **167** of those 676 have no captured file, and **509** of the **769** items publish
> one. **178** items have no captured file at all — those 167, plus **11** under the three licences that do not
> allow publication.

Printed verbatim by the page (measured): the three numbers the brief names are all there, and each pair is
checkable in the reader's head — 167 + 11 = 178, 676 − 167 = 509, 509 of 769 publish. The numbers are unchanged
data; only the sentence around them was rewritten. The `11` is `{c.noFile - c.licenceFullNoFile}`, computed, not
typed.

---

## 4. Nothing invented

- The section count in row 1 is `RAIL.length` (`Home.tsx:294`) — the rail's own `buildTree("", "")`, which is the
  tree the rail draws and the gallery resolves.
- The per-licence counts on `#/about` are folded from `counts.sources` (`About.tsx:87` `itemsUnder`) and print
  `null` — no number — if a source ever declares two licences, because the manifest does not say which of its
  items carries which. A share nobody published is not printed.
- "The five sources" heading → `The {c.sources.length} sources` (`About.tsx:108`); a sixth source moves the
  heading, the crumb and the list together.
- "the item page shows the file" under the MIT box was true for 509 of 676 → "shows the file **when one was
  captured**" (`About.tsx:132`), which is exactly what the 167 that follow are.
- `{unseen.length} row(s) above are still unchecked` → `{n} row/rows … is/are still unchecked`
  (`ChromePage.tsx:171-173`).
- No number and no licence value was added, retyped or rounded anywhere in this unit; every one is read from
  `./counts`, `manifest.json` via `./lib`, or the rail's tree.

---

## 5. Proof

Build: `cd app && npx vite build` (rolldown/vite 8), served as `app/dist` under `/design-catalog/` on
`127.0.0.1:8137` (serving at `/` 404s every asset — the base is `/design-catalog/`). Harnesses, kept in this
directory: `r3-plain-measure.mjs` (census + page facts), `r3-plain-verify.mjs` (census split by prose / `code` /
`title=`, hover tag, type sizes). Raw runs: `r3-plain-before.json`, `r3-plain-after.json`,
`r3-plain-verify.json`.

### 5a. Word census — `document.body.innerText`, before → after

| page | rail | family/families | rendered | reference-only | withheld | NOASSERTION | local-only | ≥ |
|---|---|---|---|---|---|---|---|---|
| `#/` | 3 → **2** | 1 → **0** | 1 → 1 | 0 → 0 | 3 → **0** | 0 → 0 | 0 → 0 | 4 → 4 |
| `#/about` | 0 → 0 | 0 → 0 | 1 → 1 | 0 → 0 | 3 → **0** | 2 → **1** | 1 → **1** | 0 → 0 |
| `#/chrome` | 4 → **0** | 1 → **0** | 2 → **1** | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| `#/i/shadcn/button` | 0 → 0 | 0 → 0 | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| `#/i/beautifului/agent-screen` | 0 → 0 | 0 → 0 | 1 → 1 | 0 → 0 | 1 → **0** | 0 → 0 | 0 → 0 | 0 → 0 |

**What still counts, and where it lives** (the split that matters is prose vs a `title=`/code span; the third
harness counts text nodes, so "prose" excludes anything inside `<code>`/`<pre>`):

| remaining | where | inside a `title=`/code span? | verdict |
|---|---|---|---|
| `rendered` ×1 on all five pages | **`Rail.tsx:192`** `{total} items · {rendered} rendered` | neither — it is plain rail furniture | **not mine.** Reported below. It is the single reason the target "0" is not met on every page. |
| `≥` ×4 on `#/` (`≥27 parts`, `≥8 parts`, `≥2 parts`) | **`Tile.tsx:280`** facets line | no | **not mine.** The tester's "≥1 part" is this, and it is the card's own text. Reported below. |
| `rail` ×2 on `#/` | both inside the terminal card's `<pre>`: two items' `one_line` from the manifest ("…folds into an animated icon rail on desktop", "a dashed rail that marks the active item") | yes — `<pre>` | **kept.** This is the catalogue describing catalogue items, not the site describing itself; rewording it would be editing data to change a demonstration of data. |
| `NOASSERTION` ×1 on `#/about` | `About.tsx:156` `<code title="free-to-use (repo reports NOASSERTION)">` | yes — `<code>`, plus the same value in `title=` | **kept on purpose.** The brief's own item 2 requires the raw value visible; it is not presented as a licence name, and the sentence beside it says what it means. |
| `local-only` ×1 on `#/about` | `About.tsx:136` `<code>local-only</code>` | yes — `<code>` | **kept on purpose.** It is the manifest's `code_policy` value, shown beside the plain words so the reader can match page to data. |

So: **0 in prose** for `rail`, `family/families`, `reference-only`, `withheld`, `NOASSERTION`, `local-only` on
every page this unit touched; `rendered` and `≥` survive only in files this unit does not own.

`reference-only` is already 0 on all five pages because the gallery is where it lives (`Gallery.tsx:114,124,145,169`)
and this unit never renders the gallery — it is reported, not fixed.

### 5b. "1 files" gone

`#/i/shadcn/button` (1 file): badge `1 file`; `#/i/beui/dynamic-island` (12 files): badge `12 files`; withheld
`#/i/beautifului/agent-screen`: heading `Source file (1)`. Before: `1 files` on both single-file pages. One
non-owned header still pluralises (`Code.tsx:41`) — see 3a.

### 5c. The two "Default" entries

Printed above (3b), from the manifest and the two demo modules, with the generator line that causes it. Nothing
in this unit can change it: the label is `manifest.json` data produced by `gen.py`.

### 5d. Spelling

`grep -rn "catalog\b\|license"` over `app/src/site/`: **15 `catalog\b`, 0 `license`**, every hit explained in the
table in 3c. Nothing changed.

### 5e. About arithmetic

Printed verbatim in 3d: `676 … 167 … 509 … 769 … 178 … 11`.

### 5f. Console, guard, motion, type

- **Console: 1 error, not 0. COULD NOT DO in this unit.** `Failed to load resource: 404` for
  `/avatars/shadcn.jpg`, on `#/` only (before: 2 errors, same URL twice). Cause: `app/src/demos/shadcn/sidebar/v0.tsx:75`
  uses the root-absolute `/avatars/shadcn.jpg`, and the registry sidebar blocks do the same; under the
  `/design-catalog/` base it resolves outside the app. `demos/**` and `registry/**` are outside this unit's files.
  It is a base-path bug, not a missing asset: the fix is `import.meta.env.BASE_URL` in the demo source. The lead
  has been told (it is also two of the six hero tiles).
- **`python3 app/check_chrome.py` → exit 0**, 18 shell files scanned, "every interactive element is a catalogue
  component". No hand-written control was added: the new licence line is a `<p>` + `<code>`, both allowed
  furniture.
- **Page turn: 250 ms**, easing `cubic-bezier(0.22, 1, 0.36, 1)` — measured from `document.getAnimations()`
  straight after a route change. `PageTurn.tsx` is untouched by this unit (`git diff` lists no change).
- **Type: no text this unit authored is under 12 px.** What is under 12 px on the pages touched is all furniture
  from files this unit does not own, and is named here rather than silently accepted:
  - `10px` — `.nodemo` "no demo" (`Rail.tsx`), `.theme-label` "Theme" (`ThemeSwitch.tsx`), and the `unseen` /
    `not this view` status badges on `#/chrome` (`ChromePage.tsx:93` and `:101`, `text-[10px]`) — **the brief's named
    10 px badge exception.**
  - `11px` (`--t-label`, `styles.css:461`) — the rail's counts `.sub-c`, the `rail-legend`, the `.meta` counts,
    the `.crumb` on every page ("769 items · 5 libraries · browser, CLI, MCP"), the theme switch's three labels,
    and the pagers' `01/02` numerals (`.way-n`). Set in `styles.css` / `Rail.tsx` / `ThemeSwitch.tsx`, not here.
  - `11.5px` — the badge text (`.badge`, `styles.css:182`) on the item page: `code shown here`, `MIT`, `1 file`,
    and the install manager tabs (`.tabs button`, `styles.css:203`). Badges, sized in `styles.css` — **the
    brief's named badge exception.**
  - `11px` — the provenance tag (`styles.css:650`, `12px` at ≤860 px). It is the `#/chrome` pointer label, not
    page text: hovering `shadcn/table-row` shows `shadcn/table-row · 15 times on this page · it has no page of
    its own`. **Named exception**, and its size is `styles.css`, not this unit.

---

## What the lead must wire (files this unit does not own)

Every line below is `file:line → current → suggested`. The jargon table's remaining rows are exactly the ones
that could not be reached from `Home.tsx` / `ItemPage.tsx` / `About.tsx` / `ChromePage.tsx` / `provenance.tsx`.

### The tester's rows that live in other units' files

| # | file:line | current | suggested |
|---|---|---|---|
| 1 | `app/src/site/Rail.tsx:192` | `{total} items · {rendered} rendered` | `{total} items · {rendered} with live demo` |
| 2 | `app/src/site/Rail.tsx:196` | `<a href="#/chrome">What this site is made of</a>` | `<a href="#/chrome">Components used to build this site</a>` (matches the page's new title; there is **no shared constant** — the rail hardcodes this string) |
| 3 | `app/src/site/Gallery.tsx:114` | `` `${…} shown · ${resolved.refOnly.length} reference-only …` `` | `… ${n} without a demo …` |
| 4 | `app/src/site/Gallery.tsx:123-124` | "a scaled viewport onto the demo, with the item page behind the tile. N are reference-only: a licence entry with no demo." | "Click a card to open the item page. N have no demo: they are licence entries." |
| 5 | `app/src/site/Gallery.tsx:145` | `{query.ref ? "Hide reference-only" : \`Show reference-only (${n})\`}` | `Show items without a demo (N)` / `Hide items without a demo` |
| 6 | `app/src/site/Gallery.tsx:169` | `Include {n} reference-only items` | `Include {n} items without a demo` |
| 7 | `app/src/site/Tile.tsx:280` | `` `${lower_bound ? "≥" : ""}${count} part(s)` `` | `uses at least {count} other component(s)` when `lower_bound`, else `{count} parts` |
| 8 | `app/src/site/Tile.tsx:281` | `` `used here ×${f.used_here}` `` | `used {n} time(s) on this site` |
| 9 | `app/src/site/Tile.tsx:298` | badge `{item.licence}` (raw string as a badge) | `{licenceName(item.licence)}` with `title={item.licence}`, importing from `site/About.tsx` — otherwise a gallery card still shows `free-to-use (repo reports NOASSERTION)` while the item page shows the plain name |
| 10 | `app/src/site/Compare.tsx:88` | `` `${c.lower_bound ? "≥" : ""}${c.count}` `` | `at least {count}` in prose, or keep `≥` only inside a numeric column with a header that says so |
| 11 | `app/src/site/Compare.tsx:106` | `"reference-only: there is no demo to run"` | `"no demo on this site"` |
| 12 | `app/src/site/Code.tsx:41` | `Source files ({files.length})` | `Source {files.length === 1 ? "file" : "files"} ({files.length})` — the last "1 files"-class hit, on every published single-file item |
| 13 | `app/src/App.tsx:38` | `const rendered = items.filter((i) => i.variants.length).length;` | rename to `withDemo` once row 1 renames its label (the count is right; only its name and label say "rendered") |
| 14 | `app/src/App.tsx:46`, `app/src/site/Rail.tsx:189` | brand / `<h1>` `design catalog` | if the team wants one spelling for the *name* too: `design-catalogue` in both, plus `index.html <title>` and `app/package.json` — this unit left the name alone and kept `Home.tsx:277` consistent with it rather than inventing a fourth spelling |
| 15 | `app/index.html:8` | `content="%CATALOG_COUNT% entries … — %CATALOG_RENDERED% rendered here, with their source."` | `… %CATALOG_RENDERED% with a live demo, with their source.` (`vite.config.ts` substitutes both tokens, so only the words change) |

### The "Default" duplicate and the licence tone maps

| # | file:line | current | suggested |
|---|---|---|---|
| 16 | `app/gen.py:385` | `out.append(("Default", first.group(1)))` | `out.append(("Usage example", first.group(1)))`, **plus a uniqueness assert on the labels the function returns** — the fence before the first heading is the docs' usage snippet and the real *Default* section already supplies a "Default" row. Renaming the label in `manifest.json` alone is undone by the next `gen.py` run; the fix is in `fences_by_section()` and the manifest rebuild follows it (see 3b). |
| 17 | `app/src/site/CommandPalette.tsx:33-37` | `LICENCE_TONE` keyed by the four **raw** licence strings | leave the keys raw (they are data), but if a display name is ever introduced, key the tone map on the raw value and render `licenceName()` — otherwise the palette and the item page can disagree |
| 18 | `app/src/site/Compare.tsx:34` | `"free-to-use (repo reports NOASSERTION)"` tone key | same note as 17; the string appears in a comparison table's licence column too, so it needs the same plain-name treatment as item 9 |

### The console error (blocks any "0 console errors" claim)

| # | file:line | current | suggested |
|---|---|---|---|
| 19 | `app/src/demos/shadcn/sidebar/v0.tsx:75` | `avatar: "/avatars/shadcn.jpg"` | `${import.meta.env.BASE_URL}avatars/shadcn.jpg` — root-absolute paths 404 under the `/design-catalog/` base (same pattern in `registry/new-york-v4/blocks/sidebar-07/08/09/12/15/16`) |

### Type floor (if the 12 px floor is meant to hold for furniture too)

| # | file:line | current | suggested |
|---|---|---|---|
| 20 | `app/src/styles.css:461` | `--t-label: 11px` (used by `.crumb`, `.meta`, `.rail-legend`, `.sub-c`, `.way-n`, `.cmd-label`, `.prov-tag`) | 12 px, or exempt labels explicitly in the taste canon. Reported, not changed: `styles.css` is not this unit's file and every page in the shell shares it. |

---

## COULD NOT DO

1. **A demo label change** (the duplicate "Default") — the label is `manifest.json` data from `gen.py`; fixing it
   from the shell would mean lying about which demo a reader is looking at. Diagnosed and wired for the lead
   (row 16).
2. **0 console errors** — the one remaining 404 is a root-absolute avatar path inside `demos/**` +
   `registry/**`, both outside this unit. Detail and fix in row 19.
3. **The rail's `rendered` label and link text** — `Rail.tsx` is another unit's file. Rows 1-2 with the exact
   string to paste.

## UNSURE

1. Whether "on the left" in the tester's first row was meant to hold on a phone. I removed the position rather
   than claim it (see item 1's "where the tester's wording was not used"). If the phone unit lands a rail that
   really is a left drawer at 390 px, "the menu on the left" becomes true and should be put back — one phrase, in
   `Home.tsx:294`.
2. Whether the product's name should follow the same rule as its nouns. I treated `design catalog` as the
   product's name (it is also `design-catalog` in the package, the tarball URL and the CLI) and left
   `Home.tsx:277` matching the three spellings in files I do not own. If the lead wants `design-catalogue`
   everywhere, it is four places, listed in row 14.
3. The provenance tag says "on this page" because the number is the mounted tree's own count, not the
   catalogue's `used_here` (the two differ: `shadcn/table-row` is 15 here, and `used_here` counts a source grep).
   The tester's "used 10 times on this site" would be a different number from a different source; if the site-wide
   count is what is wanted, it must read the manifest's `used_here` and say "on this site" — and then the tag
   would no longer agree with `#/chrome`, which is why the tag exists.
