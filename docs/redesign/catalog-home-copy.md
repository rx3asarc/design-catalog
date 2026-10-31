# G2 — catalog-home-copy

Branch `fleet/catalog-home-copy` (worktree `/mnt/HC_Volume_105573741/design-catalog-site-catalog-home-copy`),
two commits on top of `4475e37a` (master's data layer, merged in first, per the intercom note):

```
051fdc3e  the front page shows the agent interface as a result, and states only counts it can prove
927d4ec6  the licensing explanation moves to #/about, where a reader can check it
```

Files: `app/src/site/Home.tsx` (rewritten), `app/src/site/About.tsx` (new), `app/src/site/counts.ts` (new),
`app/src/site/route.ts` (+2 lines: the `about` kind), `app/src/App.tsx` (+2 lines: the import and one
expression in the switch). Nothing in the prohibited set was touched — `Gallery/Rail/ItemPage/Stage/Command/
demo.tsx/demo-main.tsx/index.html/styles.css/gen.py/manifest.json/docs/**` all unchanged (`git status` shows
five files).

---

## 1. The new front page, block by block

Register requested: plain, specific, unexcited; no "we", no apology, no defensive framing, short sentences.
Each block below states what it is and why it moved or survived.

### crumb — `769 items · 5 libraries · browser, CLI, MCP`

Was absent. A one-line orientation that answers "how much is this" before the title. All three numbers/words
computed (`counts.total`, `counts.sources.length`).

### title + lede — **"Browse it, or ask your agent."**

> Browse it, or ask your agent. 769 components, blocks, effects and doc pages from 5 reference libraries,
> collected in one place.

The positioning line the brief asked to land, as the first clause a visitor reads. The old lede opened on
licence mechanics ("Where the source is ours to republish it ships with the item; where it builds against the
catalogue's own components it runs here, live — licence named and our verdict attached"), which is §3.8's
defect: the second sentence of the site explained what it may not do. Reason for the shape: what it is → how
many → the two ways in. "collected in one place" replaces "our verdict attached" (the data layer no longer
publishes verdicts, see §5).

### the two ways in — `.ways`, reduced from three to two

| before | after | why |
|---|---|---|
| 01 Browse the rail / 02 Open an item / 03 Use it from an agent | 01 **Browse** / 02 **Ask your agent** | 02 and 01 were the same act at two zoom levels; the agent was third and last. Two rows, both true entries: the rail is the browse interface, the terminal card is the agent interface. |

Row 01 carries the gallery link **only when `GALLERY_LIVE` is true** (see §6). Row 02 ends "The terminal
below is one search, run for real." — it points at the card rather than describing a command.

### the hero terminal card — a rendered result, not instructions

The card is `.demo` + `.demo-head` + `.demo-code > pre`, all existing classes, so no CSS change was needed.
Head: `$ design-catalog search "sidebar"` and a Copy button (registry `Button` via `site/Code.tsx`). Body: the
first **8 of 20** rows verbatim, then an honest marker:

```
… 12 more of 20 — design-catalog search "sidebar" --json lists them all
```

Under it, one caption line says what the rows mean (`name [source/kind]`, the item's own one-line
description, the install command its library publishes) and names version 1.0.1. Above it in the page order,
the card starts at **544px** of a 900px viewport and **666px** of 844px — the agent path is above the fold at
both sizes (asserted, §4).

Note on the content: rows 1–6 of `search "sidebar"` are `rejected` — that is the CLI's real output, printed
from the published `catalog.json`, which still carries port verdicts that the new data layer no longer
publishes. I left it verbatim rather than pick a flattering slice. It also means the hero's first impression
still contains the word "rejected"; flag for the lead in §6.

### setup — one click, secondary

`Collapsible` (catalogue item) closed by default, trigger is a registry `Button` reading "Setup for an
agent". Inside: `npx -y <tarball> mcp`, the full MCP client JSON, and one line naming `get`, `stats`,
`--json`. The commands survive as the brief requires, but they no longer lead the page.

### "What is in it" — the tally and its note

Per-source tally (5 numbers, computed) and:

> 591 of the 769 include at least one source file; 509 of those show it on the item page. 486 run here as a
> live demo. The other 283 are entries with a name, a licence and a description, and nothing to run.

The old note said "676 of the 769 ship their source … because republishing it is not ours to do". 676 is a
licence label; 591 is the file count; 509 is what a visitor can actually open. All three are now said
correctly, and the reason clause is gone from the front page — it lives on About.

### two closing pointers

`→ #/about` ("The five sources, what their licences allow, and how to check a file you download") and the
existing `→ #/chrome`. The About link replaces the former "Pinning" paragraph, which was verifying-and-pinning
instructions sitting on a front page.

Removed from `#/`: the "What is in it" tally-note's licence essay, the five `Cmd` blocks in the page body, the
whole "Pinning" section, and the third "way". All of that content is either on About now (licences, pinning)
or in the setup disclosure (commands).

---

## 2. `#/about`, block by block

Route: `#/about` (one new kind in `site/route.ts`, rendered by one expression in the `App.tsx` switch).

| block | content | why it lives here |
|---|---|---|
| lede | "An index of 769 …, with the licence each source declares. One index, read three ways: this site, a CLI, an MCP server." | states the licences are a property of the index, not a disclaimer |
| **The five sources** | a ruled row per source: count, name, `licence · N items publish a source file [· M withheld] [· K have no captured file]` | the brief's "what the five sources are", with each row's own numbers |
| **What the licences allow** | two ruled definitions: **full** — 676 items, licence MIT, source may be copied into your repo, item page shows the file, 167 of these have no captured file; **local-only** — 93 items, read the original and re-implement, not redistributed here. Then: "&quot;Source included&quot; is a licence label, not a file count. 676 … 509 of the 769 publish a file, and 178 have no captured source to publish." | the `code_policy` explanation, and the sentence that stops the 676/591/509 conflation at its root |
| **The 93 entries without source** | names the three local-only sources with their licence strings in the manifest's own words, then says what their pages still carry | answers "why 93 items are entries without source" directly |
| **Check a file you downloaded** | `CHECKSUMS.txt` (linked to the repo) + the two-command transcript below + one line explaining `data/` vs `docs/data/` | the verification path, run for real |
| **Where the numbers come from** | "Every count … is computed from manifest.json when the page renders — no figure is typed in by hand." | makes the claim the copy rests on checkable |
| nav2 | ← The catalogue / What this site is built from → | both directions out |

The item page still shows its licence badge, unchanged; About explains it.

### Real checksum transcript (verbatim, run in this worktree)

```
$ grep " data/catalog.json$" CHECKSUMS.txt
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  data/catalog.json
$ sha256sum docs/data/catalog.json
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  docs/data/catalog.json
```

Same digest. `sha256sum -c` on a filtered copy of one line also returns `catalog.json: OK`.

---

## 3. The real CLI transcript, and a finding

The brief's command (`cd docs/data && npx -y ./design-catalog-latest.tgz …`) could not run: **there is no
tarball anywhere in the repo, in git history, or on the live site, and the package is not on npm.**

```
$ curl -o /dev/null -w "%{http_code}" https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz
404
$ npx -y https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz search "sidebar"
npm error code E404
npm error 404 Not Found - GET https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz
npm error 404 'https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz' is not in this registry.
$ npm view design-catalog version
npm error 404 Not Found - GET https://registry.npmjs.org/design-catalog - Not found
$ git log --all --oneline --name-only -- 'docs/data/*.tgz'
(no output)
```

`docs/data/` holds `catalog.json`, `index.json`, `items/` only; `CHECKSUMS.txt` is served from nowhere on the
site either (`/design-catalog/CHECKSUMS.txt` → 404, `/design-catalog/data/CHECKSUMS.txt` → 404). Both are
written by `/root/design-catalog/publish_export.py` (`npm pack --pack-destination data`, then
`shutil.copy` to `design-catalog-latest.tgz`), so **the export has not been run, or its `data/` output is not
on the deployed branch** — the deploy is stale relative to master's `docs/`.

So I produced the package the way `publish_export.py` does and ran the real thing against it (nothing
hand-written in the card; the transcript below is what the contact printed):

```
$ npm pack --silent --pack-destination .        # from a copy of package.json + bin/ + docs/data/catalog.json
design-catalog-1.0.1.tgz
$ tar tzf design-catalog-1.0.1.tgz
package/docs/data/catalog.json
package/package.json
package/LICENCES.md
package/README.md
package/bin/cli.mjs

$ npx -y ./design-catalog-1.0.1.tgz search "sidebar"        # 78 lines, 20 results
AI Sidebar  [beui/component]  rejected
  A collapsible AI workspace sidebar for folders, projects, files, and bookmarks with keyboard navigation, optimistic moves, inline rename, and overflow-aware labels.
  install: npx shadcn@latest add https://beui.dev/r/ai-sidebar
…
Sidebar  [shadcn/text]
  A composable, themeable and customizable sidebar component.
  install: npx shadcn@latest add docs-components-sidebar
```

`search "sidebar" --json` → 20 objects, which is where the marker's "12 more of 20" comes from. The card
holds the first 8 entries verbatim (trailing whitespace trimmed, nothing else changed). `--help` and `stats`
were run too; `stats` prints `total 769 (676 with source)`, which agrees with §5.

**This is the one thing the card cannot make honest on its own:** the install lines in the setup disclosure
(`npx -y <tarball> mcp`) address a URL that answers 404 today. The card's output is real (it is this repo's
package at 1.0.1), but until the tarball is published the setup commands will fail for a visitor. The fix is
outside this unit — run `publish_export.py` and deploy `docs/data/design-catalog-1.0.1.tgz` +
`docs/data/design-catalog-latest.tgz` + `CHECKSUMS.txt`. Nothing in the page needs changing afterwards.

---

## 4. Playwright — assertions and their numbers

Served with `npx vite preview --port 8807` from `app/dist` (base `/design-catalog/`), killed in the same
command (`ss -ltn | grep :8807` empty afterwards). Script: `/tmp/verify-home.mjs`, 18 assertions:

```
manifest: {"total":769,"sources":{"beautifului":21,"beui":110,"rareui":29,"shadcn":566,"transitions":43},
"withFile":591,"published":509,"demos":486,"noDemo":283,"withheld":93,"licenceFull":676,
"licenceFullNoFile":167,"noFile":178}
PASS  1440x900 hero terminal card carries the real CLI row   head="$ design-catalog search "sidebar" Copy" fragment=true
PASS  1440x900 tally matches manifest per source              [["566","SHADCN"],["110","BEUI"],["43","TRANSITIONS"],["29","RAREUI"],["21","BEAUTIFULUI"]]
PASS  1440x900 prose counts match manifest                    withFile=591 published=509 demos=486 noDemo=283
PASS  1440x900 agent entry above the fold                     terminal card top=544px of 900px
PASS  1440x900 no horizontal overflow on #/                   scrollWidth=1440 viewport=1440 outside=[]
PASS  1440x900 no unreachable clipped text on #/              [] scrollable: pre 1289/590 overflowX=auto
PASS  1440x900 #/about renders with the code_policy explanation  data-route=about h2="About" pageIns=1
PASS  1440x900 no horizontal overflow on #/about              scrollWidth=1440 viewport=1440 outside=[]
PASS  1440x900 no unreachable clipped text on #/about         [] scrollable: pre 702/590 overflowX=auto
PASS  390x844 hero terminal card carries the real CLI row     fragment=true
PASS  390x844 tally matches manifest per source               same five rows
PASS  390x844 prose counts match manifest                     same four counts
PASS  390x844 agent entry above the fold                      terminal card top=666px of 844px
PASS  390x844 no horizontal overflow on #/                    scrollWidth=390 viewport=390 outside=[]
PASS  390x844 no unreachable clipped text on #/               [] scrollable: pre 1239/390 overflowX=auto
PASS  390x844 #/about renders with the code_policy explanation   data-route=about h2="About" pageIns=1
PASS  390x844 no horizontal overflow on #/about               scrollWidth=390 viewport=390 outside=[]
PASS  390x844 no unreachable clipped text on #/about          [] scrollable: pre 676/390 overflowX=auto

18/18 checks passed
```

- **the hero string asserted** is a fragment of the real output: `npx shadcn@latest add docs-components-sidebar`
  (the last row of the card). Present at both sizes.
- **numbers**: every figure in `.tally-item` and in the note is compared against `manifest.json` read by the
  same script, not against the brief. `document.body.innerText` also had to contain
  `591 of the 769 include at least one source file`, `509 of those show it`, `486 run here as a live demo`,
  `The other 283 are entries`, `769 components, blocks, effects and doc pages`.
- **clipping**: "clipped" is defined as *unreachable* — `scrollWidth > clientWidth` with `overflow-x` neither
  `auto` nor `scroll`. Zero such elements on both pages at 390. The terminal and checksum `<pre>` blocks do
  scroll horizontally (`overflow-x: auto`), which is the site's existing code-pane behaviour: at 390 the card's
  longest line is 1239px of text in a 390px pane. Nothing is cut off; it is reachable by scrolling. If the lead
  wants no horizontal scroll on the hero at all, that is a `styles.css` change and outside this unit.
- **above the fold**: the agent path (the terminal card) — 544/900 and 666/844. The gallery link is not
  rendered (see §6), so the agent path is the named entry.
- interaction checks, same server: setup collapses by default and opens to show both install lines; the
  `#/about` link from the front page works; and `#/chrome`, `#/i/shadcn/button`, `#/g/forms`, `#/i/nope/nope`,
  `#/junk` all still render what they did (`data-route` = chrome/item/gallery/item/home, one `.page-in` each).

`python3 check_chrome.py` → exit 0, 11 shell files scanned (About.tsx and Home.tsx included).
`npx vite build` → exit 0.

---

## 5. Honest numbers — the command for each

One command produced this table (`cd app && python3 …` over `manifest.json`):

```
total 769
with-file 591 | published 509 | held-files 82 | no-file 178
demos 486 | no-demo 283
withheld 93 | licence MIT 676 | MIT with no file 167
per source {'beautifului': 21, 'beui': 110, 'rareui': 29, 'shadcn': 566, 'transitions': 43}
```

| number | meaning | on the page as |
|---|---|---|
| 769 | items | crumb, lede, tally note |
| 5 | sources | crumb, lede |
| 591 | at least one captured source file | "591 of the 769 include at least one source file" |
| 509 | file actually shown on the item page (591 − 82 withheld) | "509 of those show it on the item page" |
| 82 | captured but not republished | not on Home; About's per-source rows |
| 486 | run as a live demo (`variants.length > 0`) | "486 run here as a live demo" |
| 283 | no demo | "The other 283 are entries …" |
| 93 | source withheld (`withheld: true`) | About: "local-only — 93 items", "The 93 entries without source" |
| 676 | licence permits publication (`licence === "MIT"`) | About: "full — 676 items", "676 items sit under a licence that would allow publication" |
| 167 | MIT items with `files: []` | About: "167 of these have no captured file at all" |
| 178 | no captured file at all (167 MIT + 11 withheld) | About: "178 have no captured source to publish" |

Cross-checks against the claims audit (`scout/claims.md`, D1–D3) and the CLI's `stats`: `769`, `676 with
source`, `591` code artifacts, `486/283`, `93` — all agree. Two of the audit's derivations I did **not**
render, deliberately:

- **159 items with editorial curation (20.7%)** — this is `port_note` in the store, and the merged data layer
  no longer publishes verdicts, so nothing in `manifest.json` yields 159. There is no honest runtime figure
  for it, so the page says nothing about curation. If the lead wants it back it needs a manifest field.
- **`code_policy` itself** is not in `manifest.json` (it is in `docs/data/index.json`); About names the term
  and derives the two groups from `licence` + `withheld`, which agree with `index.json`
  (`shadcn`/`beui` = full, `transitions`/`rareui`/`beautifului` = local-only) exactly.

---

## 6. What the lead must flip or decide

1. **Gallery link** — `GALLERY_LIVE` in `app/src/site/Home.tsx` is `false`, and the link is gated on it. The
   switch still renders `<Home />` for `route.kind === "gallery"`, so a link would land back on the front page.
   Flip it to `true` in the same commit that puts `<Gallery />` in that expression. One line, nothing else in
   the file changes. (Because it is off, the above-the-fold entry asserted in §4 is the agent card.)
2. **The published tarball does not exist** (404, not on npm). Until `publish_export.py`'s output
   (`docs/data/design-catalog-1.0.1.tgz`, `…-latest.tgz`, `CHECKSUMS.txt`) is deployed, the two install lines
   in the setup disclosure and the CHECKSUMS link are dead for a visitor. The card's transcript is real and
   stays; only the deployment is missing. Same gap makes `/design-catalog/data/` stale relative to master.
3. **`app/index.html`'s meta description still hardcodes "769 UI components"** and the theme unit has not
   replaced it (`git log --all -- app/index.html` → only `99c808b4`). I did **not** edit it: the file is in
   the brief's prohibition list and belongs to the theme unit. It is one line for whoever owns it —
   `<meta name="description">` with no number is the version that cannot go stale.
4. **The hero's first six rows say `rejected`.** That is the CLI reading the published `catalog.json`, which
   still carries `verdict` values the data layer has since stopped publishing (`docs/data/catalog.json` is the
   old export; `manifest.json` is current). Re-exporting the data fixes both this and item 2. If it is not
   re-exported, consider dropping `verdict` from the CLI's print line rather than from the page — the page is
   showing the truth about the package.
5. **Merge note** — `site/route.ts` gained two lines (`about` in the union, one line in `parseRoute`), nothing
   else; the gallery unit's query parsing should merge without a decision. `App.tsx` gained the `About` import
   and one expression in the switch chain (`: route.kind === "about" ? <About />`), placed before the `<Home />`
   fallthrough — it must stay inside that chain: as a sibling `{…}` it would leave `about` falling through to
   `Home` and render both pages (found and fixed during verification).
