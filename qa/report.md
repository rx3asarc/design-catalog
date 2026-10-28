PUBLISH: GO (0 blocking, 6 cosmetic — and all six are the same defect: controls that are 32–43 px at 390)

# Q1 — catalog-qa-measure: the independent pass on the merged tree

Worktree `/mnt/HC_Volume_105573741/design-catalog-site-catalog-qa`, branch `fleet/catalog-qa`, cut from
master `06381807` (`publish slice 4: the item page is a stage…`). The tree was clean at the start and is
clean at the end apart from `qa/`. Nothing in the prohibited set was touched: `app/src/**`, `app/gen.py`,
`app/manifest.json`, `app/check_chrome.py`, `docs/**`, `publish.sh` are byte-identical to `06381807`, the
store at `/root/design-catalog/**` was opened read-only, and `publish.sh` / `publish_export.py` were never
run. The commit is `qa/` only: one harness, its raw JSON, its screenshots, this report's repo-side twin.

**Result: 84 assertions — 75 PASS, 6 FAIL, 3 neither (2 INFO, 1 NONE where the brief assumed a subject that
does not exist).** Every FAIL is the same finding: touch targets under 44 px at 390. No route is broken, no
number printed on a page disagrees with the data, and the review's bug H does not come back.

## How this ran

```
cd /mnt/HC_Volume_105573741/design-catalog-site-catalog-qa
node qa/measure.mjs                 # build once, then sections A–I, 215 s, load 2.6–3.4
node qa/measure.mjs --only C,F      # a section, against the build already on disk
node qa/measure.mjs --no-build      # skip `npx vite build`
```

- Playwright **1.58.1** from `/root/camofox-browser/node_modules/playwright` — the brief says it is in the
  repo's `app/node_modules`; it is not (see "brief inaccuracies"). Chromium is
  `executablePath: /usr/local/bin/google-chrome` → `/root/.cache/ms-playwright/chromium-1228/...`, headless,
  args `--no-sandbox --disable-dev-shm-usage --enable-precise-memory-info --force-color-profile=srgb
  --hide-scrollbars` (recorded in `qa/raw/_checks.json → args`).
- Server: `npx vite preview --port 8820 --strictPort --host 127.0.0.1`, started and killed inside the same
  process (`finally`), base `http://127.0.0.1:8820/design-catalog/`. `--host 127.0.0.1` is required; without
  it preview binds a name the page cannot reach and every section fails at the first navigation.
- Build: one `npx vite build` (exit 0, 7.06 s build / 8.3 s wall, load 2.67, 14 543 modules, `dist/` 3 030
  files, both woff2 files in `dist/fonts/`). The harness never builds again.
- Load average is printed next to every timing number and stored in each `qa/raw/<section>.json → load`.
  Section loads (l1): A 2.36 · B 2.54 · C 2.54 (wheel pass 2.35, jump pass 2.37) · D 1.62 · E 2.84 ·
  F 2.84 · G 2.08 · H 2.23 · I 2.29; the run ended at 2.63 / 2.76 / 2.81 for 1/5/15 min. The box was never quiet; the numbers below are read against those loads, not against an
  idle machine.
- Port hygiene: `ss -ltn | grep :8820` was empty after every run and after the whole pass. **The brief's
  literal check `ss -ltn | grep :88` cannot be empty on this box** — four unrelated listeners live there
  (`:8830` python3 pid 561705, `:8890` pid 4162272, `:8897` pid 4060181, `:8811` the gallery worktree's vite
  pid 529348, all started 26–27 Oct, before this pass). Mine is 8820 and it is free.

## The pass/fail table

84 rows, straight out of `qa/raw/_checks.json` — the file the harness writes as it runs, not retyped here.

### A. Build and guard

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| A1 | check_chrome.py exit 0 | guard exits 0 on the merged tree | exit=0, 16 shell file(s) scanned | **PASS** |
| A2 | guard catches a planted violation in a NEW site/*.tsx file | planting a raw <button> in a new shell file makes the guard exit non-zero and names the file | exit=1; src/site/__qa_guard_probe.tsx:3  <button>  ->  import { Button } from "@/registry/new-york-v4/ui/button" | **PASS** |
| A3 | guard is clean again after removing the probe | exit 0, tree as found | exit=0 | **PASS** |
| A4 | npx vite build exit 0 | the merged tree builds | exit=0, built in 7.06s, 8.3 s wall, load 2.67 | **PASS** |
| A5 | no raw <button/input/textarea/select/table/details/summary> in the shell | grep of app/src outside the whitelist (registry/, demos/, components/, shims/, demo-main.tsx) | 0 hit(s) | **PASS** |

### B. The review bug (H): the code pane across route changes

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| B1 | H forward: source → withheld shows nothing from the previous item | no .path / no code pane text, no fragment of the previous item's code | path=null, code=absent, withheld box=true | **PASS** |
| B2 | H forward: the withheld item still says why | the page carries the 'not ours to republish' sentence | true | **PASS** |
| B3 | H reverse: withheld → source renders the new item's file | path is this item's file, pane carries its code, nothing left over | path=registry/new-york-v4/ui/button.tsx, codeLen=2382, tab=null | **PASS** |
| B4 | rapid chain of three (260 ms apart) | each step shows only its own item: a withheld step has no pane, source steps have their own file | beui/bloom-menu:path=components/motion/bloom-menu.tsx \| transitions/card-stack-hover:path=none \| shadcn/sidebar:path=registry/new-york-v4/ui/sidebar.tsx | **PASS** |
| B5 | no reload during the whole section | performance.getEntriesByType('navigation').length stays 1 | 1 | **PASS** |

### C. Gallery

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| C1 | tile count matches the manifest for the filter (#/g, no query) | demo tiles == manifest demo count; no reference cards by default | 486 demo tiles (manifest 486), 0 ref cards, header "769 items · 486 shown · 283 reference-only hidden" | **PASS** |
| C2 | header counts equal the DOM counts | data-gallery-shown == demo tiles, hidden == ref cards not rendered, total == manifest total | shown=486 hidden=283 total=769 vs DOM demo=486 ref=0 | **PASS** |
| C3 | max live iframes across a full descent ≤ 9 | sample document.querySelectorAll('iframe').length on every animation frame while the whole grid scrolls | max=9, samples=388, distribution={"0":333,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":47} | **PASS** |
| C4 | no more than one mount per animation frame | no frame where the iframe count rises by ≥2; app counter perFrameMax == 1 | frames with +≥2: 0; __gallery.perFrameMax=1, mounts=18, evictions=0 | **PASS** |
| C5 | p95 rAF interval while scrolling (baseline: stage.md 16.7 p50 / 16.8 p95 at 9 frames; gallery's own claim 16.7/16.8) | rAF deltas sampled during the descent, compared with the scout's N=9 baseline | p50=16.7 ms, p95=33.3 ms, max=233.3 ms, 19/386 frames > 33.4 ms — load 2.37 | **PASS** |
| C6 | a filtered grid (#/g?src=shadcn) matches the manifest for that filter | demo tiles == manifest items with source=shadcn and a demo; header total == all shadcn items | 383 tiles (expect 383), 0 ref cards, header "566 items · 383 shown · 183 reference-only hidden", title "Everything" | **PASS** |
| C7 | p95 rAF interval, wheel descent (the unit's own method; its claim was p50 16.7 / p95 16.8, 4–6 of ~875 frames over 33.4 ms) | 220 wheel events of 400 px, 45 ms apart, rAF deltas sampled every frame until the grid's end | p50=16.7 ms, p95=16.8 ms, max=233.4 ms, 13/960 frames > 33.4 ms, max live=9, 962 frames in 17.2 s — load 2.35 | **PASS** |
| C8 | no more than one mount per animation frame, wheel descent (independent inference) | no sampled frame where the iframe count rises by ≥2; plus __gallery.perFrameMax | frames with +≥2: 0; __gallery.perFrameMax=1, mounts=9, evictions=0, deferred=42, live=9 | **PASS** |
| C9 | 20 random demo-bearing items reached 'alive' | their own designCatalogDemo postMessage arrived after the demo module mounted and measured | 20/20 alive, slowest 623 ms, load 2.48 | **PASS** |
| C10 | 390: 1–2 live frames | the phone pool cap is 2 and the descent never exceeds it | max=2, distribution={"0":1404,"1":7,"2":83}, cap=2 | **PASS** |
| C11 | 390: scrollWidth == clientWidth | no horizontal overflow on the gallery after a full descent | 390 / 390 | **PASS** |
| C12 | 390: 0 tap targets under 44 px on the gallery | census of every rendered control (a, button, role=button/radio/tab, input, select, textarea, summary, [tabindex]) | 4 under 44 px: div.group/toggle-group.flex 168×32 "Theme" \| button.inline-flex.items-center 56×32 "Theme: system" \| button.inline-flex.items-center 56×32 "Theme: light" \| button.inline-flex.items-center 56×32 "Theme: dark" | **FAIL** |

### D. Reference-only

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| D1 | default gallery excludes the reference-only items | no tile with data-mode=reference; shown == manifest demo count | 0 reference tiles, 486 demo tiles, header "769 items · 486 shown · 283 reference-only hidden" | **PASS** |
| D2 | ref=1 includes them | tiles == 769, reference cards == 283, all 283 carry an outbound link | 769 tiles, 283 reference cards, 283 outbound links, header "769 items · 769 shown · 283 reference-only included" | **PASS** |
| D3 | a reference card is visibly a different object | dashed border vs the demo tile's solid one; no iframe; 'View on <library> ↗' link | card border dashed 1px vs tile solid 0px; link "View on beautifului ↗" → https://beautifului.dev/#agent-screen | **PASS** |
| D4 | header counts equal the DOM counts with ref included | shown == 769 == tiles, hidden == 0, total == 769 | shown=769 tiles=769 hidden=0 | **PASS** |
| D5 | ?ref=1 survives a reload (it is in the URL) | hash still carries ref=1 and the grid still shows 769 | hash=#/g?ref=1, tiles=769 | **PASS** |
| D6 | every counted rail row carries a link to its own grid | a grid link inside each .rail-sec/.rail-cat/.rail-sub/.rail-sub2 row | 23 of 23 rows have a #/g link; e.g. "Blocks and pages" (20) → #/g?sec=Blocks+and+pages, link 20×20, aria-label "Open the grid for Blocks and pages — 20 items" | **PASS** |
| D7 | a rail row's count opens a grid of that count | the row's printed number vs the grid header's total (one tree, no second derivation) | rail "Blocks and pages" says 20; grid header "20 items · 19 shown · 1 reference-only hidden" (total 20, title "Blocks and pages") | **PASS** |

### E. Facets, honestly

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| E1 | the manifest's published numbers re-derive from the DB | each of the brief's 10 numbers, re-derived by this harness's own SQL / manifest read | 769 items=769, 486 with a demo=486, 283 reference-only=283, 93 withheld=93, 591 with files=591, 178 with null (not 0)=178, 159 curated (port_note rows)=159, 28 concepts=28, 95 memberships=95, 0 published verdicts=0 | **PASS** |
| E2 | no zero published where the data has none | bytes:0 count and file_count:0 count in the manifest | bytes 0: 0, file_count 0: 0, null: 178 | **PASS** |
| E3 | the manifest carries no verdict key at all | item.verdict absent on 769/769 (the store's port_note.public gate) | 0 items carry verdict | **PASS** |
| E4 | curation is published as data, not as verdicts | concepts on 95 items, composition on 445, pick on 0 | concepts=95 composition=445 pick=0 | **PASS** |
| E5 | the front page's numbers are the data's numbers | each figure in the crumb/tally/note found in the manifest | 769:ok, 5 libraries:ok, 591 with a file:ok, 486 live demos:ok, 283 reference-only:ok, tally per source:ok | **PASS** |
| E6 | #/about's numbers are the data's numbers | 676 / 167 / 93 / 178 / 509 each cross-checked against the manifest | 676 licence-full:ok, 167 MIT without a file:ok, 93 without source:ok, 178 no captured source:ok, 509 publish a file:ok | **PASS** |

### F. Item page

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| F1 | prefers-reduced-motion: reduce ⇒ zero RUNNING CSS animations in the child (shadcn/skeleton) | child document.getAnimations() filtered to playState=running, with the stage defaulting to motion=off | animations=0, running=0, child <html>="light motion-off", 0 of 0 styled elements changed in 500 ms — no JS-driven motion observed | **PASS** |
| F2 | reduced-motion honesty, shadcn/skeleton: what the bar claims vs what moves | under OS reduce: the bar says 'CSS motion stopped … Script-driven motion keeps running'. Does anything still move? | bar ends "390 768 full MOTION on off CSS motion stopped — your system asks for reduced motion. Script-driven motion keeps running."; 0 moving element(s) ⇒ motion/react honours the OS preference, so the sentence over-states for this demo | **INFO** |
| F3 | prefers-reduced-motion: reduce ⇒ zero RUNNING CSS animations in the child (beui/bloom-menu) | child document.getAnimations() filtered to playState=running, with the stage defaulting to motion=off | animations=0, running=0, child <html>="light motion-off", 0 of 1 styled elements changed in 500 ms — no JS-driven motion observed | **PASS** |
| F4 | reduced-motion honesty, beui/bloom-menu: what the bar claims vs what moves | under OS reduce: the bar says 'CSS motion stopped … Script-driven motion keeps running'. Does anything still move? | bar ends "ull MOTION on off ↻ Replay CSS motion stopped — your system asks for reduced motion. Script-driven motion keeps running."; 0 moving element(s) ⇒ motion/react honours the OS preference, so the sentence over-states for this demo | **INFO** |
| F5 | motion=off stops the CSS, and the JS-driven motion that keeps running is named (or shown to be absent) | OS does not reduce motion; the demo is woken with a click inside the frame, then its computed styles are sampled 420 ms apart with motion on and with motion=off | motion=on: 0/10 moving, 20 running CSS; motion=off: 2/4 moving, 0 running CSS; child class "light motion-off"; src /design-catalog/demo.html#beui%2Fbloom-menu\|0\|theme=light\|motion=off — still moving: <div class="w-[min(86vw,420px)] overflow-hidden bord"> matrix(0.471935, 0, 0, 0.343745, 0, 0)\|0.325 → matrix(0.342857, 0, 0, 0.183333, 0, 0)\|0; <div class=""> matrix(2.11894, 0, 0, 2.90913, 0, 0)\|1 → matrix(2.91... | **PASS** |
| F6 | the brief's third subject — an item whose demo reports height 0 — exists (or is shown not to) | scan: every demo whose own CSS asks for a viewport height (the only branch that can report 0), plus 40 seeded-random demo items; child-reported height from the designCatalogDemo message | 0 zero-height report(s) in 9473 reports over 42 items (2 candidate + 40 random); reported heights seen: 64, 68, 78, 79, 80, 90, 96, 100, 101, 112, 116, 148, 149, 160, 173, 181, 183, 184, 196, 197, 235, 241, 243, 256, 267, 283, 293, 294, 300, 330, 405, 406, 410, 411, 430, 432, 506, 507, 529, 536, 537, 560, 561, 585, 655, 656, 758, 1113, 1674 | **NONE** |
| F7 | the 0 branch reads SELF_FLOOR — 360 for a component; for a block the class floor is already 900, so it is a no-op there | the demo iframe's load is aborted, the page posts the child's own 0 report ({designCatalogDemo:true, height:0}), and the frame's height is read from the DOM | shadcn/button: 180 px (floor 180px) → 360 px (360px) = SELF_FLOOR.other 360; shadcn/dashboard-01: 900 → 900 px, unchanged because FLOOR.block.wide == SELF_FLOOR.block.wide == 900; lane 280→440 | **PASS** |
| F8 | shadcn/dashboard-01: child viewport is exactly 390 / 768 / column in the three modes | child documentElement.clientWidth per mode | 390→390, 768→768, full→770; rendered 365×1882 / 768×2012 / 770×2012 | **PASS** |
| F9 | shadcn/dashboard-01: no horizontal clipping in any mode | child documentElement.scrollWidth ≤ clientWidth, lane scrollWidth ≤ clientWidth, page scrollWidth == clientWidth | child overflow x: 0/0/0; lane 850/850 850/850 850/850 | **PASS** |
| F10 | shadcn/dashboard-01: Replay absent on a non-motion item (not a dead button) | the Replay control is only rendered for motion items | Replay buttons: 0 — item is not motion | **PASS** |
| F11 | shadcn/dashboard-01: the theme switch changes the child's <html> class and not the site's | child <html> gains .dark, site <html> keeps no class; 'follow site' hands it back | child "dark" / site ""; after follow: child "light" / site "" | **PASS** |
| F12 | beui/bloom-menu: child viewport is exactly 390 / 768 / column in the three modes | child documentElement.clientWidth per mode | 390→390, 768→768, full→770; rendered 390×420 / 768×420 / 770×420 | **PASS** |
| F13 | beui/bloom-menu: no horizontal clipping in any mode | child documentElement.scrollWidth ≤ clientWidth, lane scrollWidth ≤ clientWidth, page scrollWidth == clientWidth | child overflow x: 0/0/0; lane 850/850 850/850 850/850 | **PASS** |
| F14 | beui/bloom-menu: replay works three times | each click changes the replay nonce and the child reports again (designCatalogDemo count rises) | 1 → 2 → 3; alive counts 9→13, 13→16, 16→21 | **PASS** |
| F15 | beui/bloom-menu: the theme switch changes the child's <html> class and not the site's | child <html> gains .dark, site <html> keeps no class; 'follow site' hands it back | child "dark" / site ""; after follow: child "light" / site "" | **PASS** |

### G. Shell

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| G1 | mod+k opens the palette with the keyboard alone, and focuses it | dialog present, focus inside it (the command input), announced by aria-labelledby/describedby | dialog=true, focus=command-input, inside=true, labelled "Search the catalogue", describedby=true | **PASS** |
| G2 | finds `sidebar` and Enter navigates | the first row is a sidebar item; Enter lands on its item page and closes the palette | 20 rows, first "sidebarshadcncomponentlicence MIT"; hash=#/i/shadcn/sidebar, route=item, dialog=false | **PASS** |
| G3 | Esc closes and returns focus | focus lands back on the element that had it before the palette opened | before="a[aria-label=Previous: pagination — same category]" after="a[aria-label=Previous: pagination — same category]" dialog=false | **PASS** |
| G4 | page transition duration < 300 ms | the call the page actually made: Element.prototype.animate interposed for the route change, plus getAnimations() on the tagged wrapper at the first frame | recorded=1 call(s) on "transitions/page-side-by-side"; duration=250 ms, easing=cubic-bezier(0.22, 1, 0.36, 1), props=["opacity","transform"], state=running; present in getAnimations() at frame 1: 1; other animate() calls on the run: ["transitions/page-side-by-side"] | **PASS** |
| G5 | the scroll reset still works | a route change returns the scroller to 0 | .page: 400 → 0 | **PASS** |
| G6 | the drift table lists exactly the tagged-but-unused ids (and the tags that name nothing) | every data-catalog-item in #/chrome's own DOM, split into in-catalogue-but-used_here-0 and not-a-catalogue-id; the page's drift table must equal that set | 10 tagged elements → expected drift [transitions/page-side-by-side] + unknown [shadcn/table-row]; the page shows drift [transitions/page-side-by-side] + unknown [shadcn/table-row] | **PASS** |
| G7 | #/chrome's rows equal manifest.filter(used_here > 0).length | row count on the page vs the manifest | 14 rows vs 14 items with used_here>0 | **PASS** |
| G8 | no row claims a use the DOM contradicts | printed count vs querySelectorAll('[data-catalog-item=id]').length on the same view | 0 row(s) differ | **PASS** |
| G9 | zero animations on a route change under reduced motion | prefers-reduced-motion: reduce ⇒ document.getAnimations() running == 0 | running document animations=0, on the transition wrapper=0 | **PASS** |
| G10 | the palette is usable at 390 with no horizontal scroll | document, dialog and result list scrollWidth == clientWidth; the input is focused | doc 390/390, dialog 372/372 (374 px wide), list 372/372, focus=command-input | **PASS** |

### H. Type and theme

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| H1 | the two woff2 files are actually served by the build | document.fonts.check() true for both families + a request for each .woff2 + the file in dist | sans=true, mono=true; requested: instrument-sans-latin-var.woff2, jetbrains-mono-latin-var.woff2; in dist: fonts/instrument-sans-latin-var.woff2, fonts/jetbrains-mono-latin-var.woff2 (dist/fonts/, not dist/assets/ — they are public/ files, copied verbatim) | **PASS** |
| H2 | no CDN request appears in the network log | every request on the page is same-origin (no fonts.googleapis/gstatic, no third-party script) | 56 requests, 0 off-origin | **PASS** |
| H3 | the theme toggle has three states | three role=radio items, each with its own accessible name, exactly one checked | Theme: system* · Theme: light · Theme: dark | **PASS** |
| H4 | the choice survives a reload | choose dark → reload → still dark, still stored | stored=dark, class="dark", data-theme=dark | **PASS** |
| H5 | system is a third state, not a conversion | choosing system forgets the stored choice and hands the theme back to the OS (dark OS here) | stored=null, class="dark", data-theme=system | **PASS** |
| H6 | the page does not flash light before painting (prefers-color-scheme: dark) | method: (a) <html> class+background captured in the FIRST requestAnimationFrame of the document (a frame runs before the first paint), (b) a screenshot taken ~60 ms after navigation start, decoded in the browser and sampled | first rAF: class "dark", data-theme=system, bg rgba(0, 0, 0, 0) at 146 ms; screenshot at 25 ms: centre rgb(9,9,11), corner rgb(9,9,11) | **PASS** |

### I. Phone reality (390x844)

| # | what was asserted | how | the number | verdict |
|---|---|---|---|---|
| I1 | 390 home: scrollWidth == clientWidth | no horizontal overflow on the route | 390 / 390 (page height 1766) | **PASS** |
| I2 | 390 home: no text clipped at the edges | no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll | 0 clipped element(s) | **PASS** |
| I3 | 390 home: 0 tap targets under 44 px | census of every rendered control | 8 under 44 px (4 not inline in a sentence, 4 inline prose links): button.inline-flex.shrink-0 145×36 "Setup for an agent" \| a 342×42 "The five sources, what their licences al" \| div.group/toggle-group.flex 168×32 "Theme" \| button.inline-flex.items-center 56×32 "Theme: light" | **FAIL** |
| I4 | 390 gallery: scrollWidth == clientWidth | no horizontal overflow on the route | 390 / 390 (page height 124813) | **PASS** |
| I5 | 390 gallery: no text clipped at the edges | no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll | 0 clipped element(s) | **PASS** |
| I6 | 390 gallery: 0 tap targets under 44 px | census of every rendered control | 4 under 44 px (2 not inline in a sentence, 2 inline prose links): div.group/toggle-group.flex 168×32 "Theme" \| button.inline-flex.items-center 56×32 "Theme: light" | **FAIL** |
| I7 | 390 item: scrollWidth == clientWidth | no horizontal overflow on the route | 390 / 390 (page height 6166) | **PASS** |
| I8 | 390 item: no text clipped at the edges | no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll | 0 clipped element(s) | **PASS** |
| I9 | 390 item: 0 tap targets under 44 px | census of every rendered control | 7 under 44 px (5 not inline in a sentence, 2 inline prose links): button.inline-flex.items-center 43×44 "Full column width" \| button.inline-flex.items-center 41×44 "Motion on: the demo animates" \| button.inline-flex.items-center 41×44 "Motion off: CSS animation and transition" \| div.group/toggle-group.flex 168×32 "Theme" | **FAIL** |
| I10 | 390 chrome: scrollWidth == clientWidth | no horizontal overflow on the route | 390 / 390 (page height 2096) | **PASS** |
| I11 | 390 chrome: no text clipped at the edges | no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll | 0 clipped element(s) | **PASS** |
| I12 | 390 chrome: 0 tap targets under 44 px | census of every rendered control | 4 under 44 px (2 not inline in a sentence, 2 inline prose links): div.group/toggle-group.flex 168×32 "Theme" \| button.inline-flex.items-center 56×32 "Theme: light" | **FAIL** |
| I13 | 390 about: scrollWidth == clientWidth | no horizontal overflow on the route | 390 / 390 (page height 2490) | **PASS** |
| I14 | 390 about: no text clipped at the edges | no element whose scrollWidth exceeds its clientWidth with overflow-x neither auto nor scroll | 0 clipped element(s) | **PASS** |
| I15 | 390 about: 0 tap targets under 44 px | census of every rendered control | 5 under 44 px (2 not inline in a sentence, 3 inline prose links): div.group/toggle-group.flex 168×32 "Theme" \| button.inline-flex.items-center 56×32 "Theme: light" | **FAIL** |
| I16 | 390: the rail drawer opens and closes | Browse 769 → .rail-phone is displayed, aria-expanded=false → true → false | open: display=flex, aria-expanded=true, rect {"x":0,"y":65,"width":390,"height":836}; closed: display=none, aria-expanded=false | **PASS** |
| I17 | 390: the drawer is not a scroll trap | the page still scrolls while it is open and the rail list scrolls internally; no overflow:hidden lock on body/html | body overflow=visible, html overflow=visible, window scrolls=true, rail list 3918/591 | **PASS** |
| I18 | a 1440 screenshot exists for each of the five routes (plus the gallery mid-scroll) | page.screenshot at 1440x900 | route-home-1440.png, route-gallery-1440.png, route-item-1440.png, route-chrome-1440.png, route-about-1440.png, gallery-1440-midscroll.png | **PASS** |

---

## Finding 1 — the only defect class: touch targets under 44 px at 390 (6 FAILs, one cause)

The brief asks for "0 tap targets under 44 px" on every route (PLAN.md line 55 repeats it for Q1, and the
gallery brief §5 asks for it too). Measured at 390×844 on all five routes, with the box read from
`getBoundingClientRect()` and a target counted when either edge is under 44 px:

```
route     control                                     box        where
#/        Theme: system / light / dark (radios)        56 × 32    every route   <- the whole defect
#/        ToggleGroup wrapper around them             168 × 32    every route
#/        button "Setup for an agent"                 145 × 36    hero
#/        block link, 2 lines of text                 342 × 42    prose
#/i/…     button "Motion on: the demo animates"        41 × 44    stage console
#/i/…     button "Motion off: …"                       41 × 44    stage console
#/i/…     button "Full column width"                   43 × 44    stage console
#/chrome   the same Theme switch                       56 × 32    every route
#/about    the same Theme switch                       56 × 32    every route
```

`qa/shots/route-*-390.png` show each in place; `qa/shots/palette-390.png` and `rail-drawer-open-390.png`
cover the two overlays. The switch is the important one because it is on every route and because the
identity unit measured it as `184 × 42` — that is the `.theme-switch` wrapper; the three radios inside it
are `56 × 32` with `padding: 0 6px` and `min-height: auto`. Identity checked the box, not the control.
The 42 px prose links (`342 × 42`, `354 × 42`) are 2 px short and enormous in area — I count them, I do not
believe they are a problem. Inline links inside a sentence (`The gallery` 71 × 18, `CHECKSUMS.txt`
109 × 18) are exempt by convention (WCAG 2.5.8 exempts inline text links; its own floor is 24 × 24, which
they meet). The stage console's three controls are 44 px *tall*, which is what item-stage asserted — they
are 41–43 px *wide*, which nobody asserted.

Reproduce (any route, 390 wide):

```bash
cd /mnt/HC_Volume_105573741/design-catalog-site-catalog-qa
node qa/measure.mjs --only I --no-build   # prints every control under 44 px, per route
# or by hand, against a preview of app/dist on :8820:
node -e 'const {chromium}=require("/root/camofox-browser/node_modules/playwright");(async()=>{
 const b=await chromium.launch({executablePath:"/usr/local/bin/google-chrome",headless:true,args:["--no-sandbox"]});
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.goto("http://127.0.0.1:8820/design-catalog/#/");
 console.log(await p.evaluate(()=>[...document.querySelectorAll("[role=radio],button,a")].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),e.getAttribute("aria-label")||e.textContent.trim().slice(0,24)]}).filter(([w,h])=>w<44||h<44)));
 await b.close();})()'
```

The suite also refuses to call it a pass on a technicality: `qa/raw/I.json → routes.*.tap.under44` carries
all 28 hits with width, height and whether the target is inline in a sentence, so a reader can overrule me.

## Finding 2 — the stage bar says more than the demos do (INFO, 2 rows)

Under `prefers-reduced-motion: reduce`, the console ends with **"CSS motion stopped — your system asks for
reduced motion. Script-driven motion keeps running."** For `shadcn/skeleton` and `beui/bloom-menu` I sampled
every child element's computed `transform`/`opacity` twice, 420–500 ms apart, with the demo woken by a click
first: **0 moving elements in both**. motion/react reads the media query itself, so the second sentence is
not true of these two demos — the honest version is "…keeps running for demos that animate with JavaScript".

The sentence is right in the *other* state, and that is worth keeping: with the OS at normal and the visitor
clicking **MOTION off**, the CSS animations stop (20 running → 0) while two `beui/bloom-menu` elements keep
moving on inline transforms — `<div class="w-[min(86vw,420px)] …">` scaling `0.49 → 0.34` and fading
`0.40 → 0`, and a second `div` scaling `2.02 → 2.92`. That is the JS-driven motion the bar promises, named
with its matrices in `qa/raw/F.json → motionOff`. So: true of the flag, overstated of the OS preference.

## Finding 3 — the brief's third F subject does not exist (NONE)

The brief asks for "one item whose demo reports height 0". **No item does.** item-stage found this too
(`build/catalog-item-stage.md`: "no demo in this catalogue reports height 0"), and the independent scan
agrees: 0 zero-height reports in 9 473 child messages over 42 items — every demo whose own CSS asks for a
viewport height (the only branch that can produce 0: `grep -rlE "h-screen|h-\[…vh\]|min-h-\[…vh\]"`) plus 40
seeded-random demo items. Heights seen: 64 … 1 674 px, never 0. So instead of skipping the subject I forced
the branch: with the child's own load aborted, the page receives `{designCatalogDemo:true, height:0}`, and
`shown = h > 0 ? h : self ? selfFloor : floor` must answer with `SELF_FLOOR`. It does — the frame goes
**180 px → 360 px** for a component; for a block it is a no-op because `FLOOR.block.wide ==
SELF_FLOOR.block.wide == 900`. That is the branch exercised, not asserted by arithmetic.

## What the units claimed but did not verify

- **identity** measured the theme switch's *wrapper* (`184 × 42`) at 390 and called the switch verified. The
  three radios are `56 × 32`. Its keyboard census (108 Tab presses to reach it) is real and I reproduce the
  reachability; the 44 px floor was never applied to the controls themselves.
- **gallery** claims p95 16.8 ms over a wheel descent with "4–6 of ~875 frames > 33.4 ms (0.5 %)". I read the
  same p95 16.8 ms on 960 wheel frames, but **13 of them over 33.4 ms (1.35 %) at load 2.35** and 16–21 at
  load 4.6 — the order of magnitude is right, the tail is understated, and the tail grows with the box's
  load. Its own jump-descent FAIL is confirmed and is a property of jumping, not of the merge: jumping 1 900
  px every 900 ms gives p50 16.7 / **p95 33.3**, 19 of 386 frames over budget, on this box.
- **gallery** inferred "one mount per frame" from its queue counter; that is reproduced
  (`__gallery.perFrameMax = 1`, 0 frames with +≥2 new iframes). It did not mention evictions, which do
  happen on a jump descent (1 eviction in one run, 0 in others) — harmless, but it is a number the counter
  already had.
- **item-stage** asserted the console's controls are "44 px" — true of height, not of width (41–43 px, above).
  It also never ran the `SELF_FLOOR` branch on a real page; I forced it (Finding 3).
- **home-copy** checked "no unreachable clipped text" with a detector that only looked at `pre` blocks; the
  phone had no clipped text then and has none now (my detector is stricter — it walks the clipping ancestor
  and the viewport edge, and exempts ellipsis, scrollable elements and content that lands inside the box that
  would cut it). What it did not census is that the hero button is 36 px tall and two prose links 42 px.
- **shell-dogfood** verified the palette's keyboard path; I reproduce open/focus/label/described-by,
  `sidebar`+Enter → `#/i/shadcn/sidebar`, Esc → focus back on the pager link, 374 px dialog at 390 with
  `doc 390/390`. What nobody checked is the page's own honesty about drift: `#/chrome` must show the
  **unknown** tags too. It does — 10 tagged elements on the page, expected drift `transitions/page-side-by-side`
  plus unknown `shadcn/table-row`, and the page's table lists exactly those two.
- **nobody** re-counted the merged tree's `used_here`. The manifest has **14** items with `used_here > 0**
  (the identity unit added `shadcn/font-instrument-sans` and `shadcn/font-jetbrains-mono`, the shell added
  `collapsible`/`command`/`sidebar`, the stage added `toggle-group`, the gallery `scroll-area`), and `gen.py`
  logs that total (`gen.py:543`); the "9" quoted in the unit reports is that line from an earlier run, so it
  is stale relative to this manifest rather than wrong. `#/chrome` renders 14 rows and every row's printed
  count equals the DOM's — the page is right.
- **nobody** measured the review's H bound again after the merges. It holds on all three paths (forward into
  a withheld item, reverse out of one, and a three-item chain 260 ms apart) with **no reload**: the code pane
  shows this item's file or nothing, never the previous item's text.

## Brief inaccuracies (the brief, not the build)

1. "Playwright is already installed in the repo's `node_modules`" — it is not; `app/node_modules` after
   `npm ci` (264 packages, 22 s, ~388 MB) has no Playwright. The earlier units' scripts import
   `/root/camofox-browser/node_modules/playwright` (1.58.1), which is what this harness uses, with an
   explicit `executablePath` because 1.58.1 wants headless-shell 1208 and the box has chromium-1228.
2. "one item whose demo reports height 0" — there is none (Finding 3).
3. "`ss -ltn | grep :88` must be empty" — impossible on this box: four unrelated 88xx listeners predate the
   pass. My port is 8820 and it is empty after every run.

## My own detector's mistakes, and the fixes (so the numbers can be trusted)

Independent measurement is still measurement, and three of my first-run "failures" were mine:

- **Esc "does not close the palette".** It does. The provenance tag is also a `role="dialog"` (a Radix
  Popover that opens on focus), so my `[role=dialog]` query was watching the wrong element; scoped to
  `[role="dialog"]:has([data-slot="command-input"])`, and waited by polling instead of a fixed sleep.
- **"#/chrome shows 15 rows, the manifest says 14."** My scrape of `tbody tr` mixed the drift table into the
  main table. Scoped to the table whose header says "on this page": **14 = 14**.
- **Transition "0 animations".** Reading `getAnimations()` from a second round trip outlives a 250 ms
  animation. The harness now interposes `Element.prototype.animate` and records the call the page actually
  made: **250 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, `opacity` + `transform`**, still running at frame 1.
- Clipping: three refinements before it stopped crying wolf — a full-bleed `.demo` inside a padded column is
  not clipped (its content lands inside the ancestor's box), a `pre` with `overflow-x: auto` is reachable,
  and `text-overflow: ellipsis` is a truncation the design chose. With those, all five routes report **0
  clipped elements** at 390 and the page never scrolls sideways (`scrollWidth == clientWidth` on every
  route).

## Must fix before publish (severity order)

1. **The theme switch, at 390: three 56 × 32 radios on every route.** The one real defect. Fix belongs in
   `app/src/site/ThemeSwitch.tsx`, which renders the registry's `ToggleGroup size="sm"`; the shell already
   has the right number to reuse (`const HIT = 44` in `stage/Stage.tsx`, used for the stage console).
   Nothing else in the pass moves when it is fixed.
2. **The stage console at 390: `Motion on` 41 px, `Motion off` 41 px, `Full column width` 43 px wide.**
   Same class of defect, one screen, after the switch.
3. **The hero's "Setup for an agent" is 145 × 36**, and two prose links are 42 px tall. Cosmetic; the two
   links are large-area text and I would leave them.
4. **The stage bar's reduced-motion sentence** ("Script-driven motion keeps running") overstates what these
   demos do under the OS preference. One sentence, `app/src/site/Stage.tsx`, and it is the only place where
   the page says something the DOM does not show.
5. **The rail's grid links are 20 × 20** (desktop only, `.rail-sec`/`.rail-cat` → `#/g?...`). Not a phone
   problem; listed because they are the only sub-24 px targets in the shell.

Not on this list, deliberately: the `gen.py` log line quoting 9 `used_here` against a manifest of 14 (stale
output, the page that reads the manifest is right), and the gallery's jump-descent frame drops (a property of
jumping 1 900 px at a time, unchanged by the merge).

## Verdict (twenty seconds)

The five units merge into one thing that works and does not lie. Every published number re-derives from the
store (769 / 486 / 283 / 93 / 591 / 178 / 159 / 28 over 95 / 0), the front page and `#/about` print exactly
those, the gallery holds nine live frames at p95 16.8 ms while wheel-scrolling 960 frames, the phone never
scrolls sideways and clips no text, the palette is keyboard-complete and 374 px at 390, the review's bug H
is gone on all three paths, and the type is self-hosted with no light flash (dark at the first written frame,
`rgb(9,9,11)` in a 25 ms screenshot). The one thing that does not hold is the 44 px floor: the theme switch
is 32 px tall on every route, and three stage-console controls are 41–43 px wide. That is 6 of 84
assertions, all one defect, none of them a broken route or a false number — **GO for publish, with the
switch fixed in the same breath if you can**.
