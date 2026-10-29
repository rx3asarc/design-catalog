# design-catalog — review → repo → shipped

Source instruction: Maestro's "DESIGN CATALOG: REVIEW AND RECOMMENDATIONS" (2026-10-27), nine numbered
sections: 8 recommendations, 1 bug, 1 unverified area (mobile).

Repo: `/root/design-catalog-site` (branch `master`, live https://rx3asarc.github.io/design-catalog/).
Store: `/root/design-catalog` (SQLite 13 MB, 5 sources, 769 items, `verify.py` green).
Not in scope: the theme guardrail (Nordisk), any Nordisk file, `gen.py`'s taxonomy (guarded, finished).

## The rule that shapes every unit

The site is a **single-file React SPA**: `app/src/App.tsx` is 717 lines and owns the rail, home, item
page, chrome page and routing. Five workers cannot edit one file. So the work is sequenced in four
fleets, and **file ownership** decides what may run in parallel:

```
FLEET 1  scout   4 task workers, read-only, no branch        → evidence files
FLEET 2  base    2 code workers, disjoint files               → modules exist, bug dead, data model real
FLEET 3  build   5 code workers, one file each                → the visible change
FLEET 4  prove   2 code/task workers                          → measured, published, or refused
```

Cap is 5 workers per domain (`--domain catalog`). A lead (teal) does not count.

## FLEET 1 — scout (parallel, read-only)

| unit | name | question it must answer | artifact | done-test |
|---|---|---|---|---|
| S1 | `catalog-repo-map` | how does the site actually render: routes, state, rail, demo pipeline, tokens, guard, publish | `scout/repo-map.md` | `test -s` |
| S2 | `catalog-claims-audit` | is each review claim/number true in this repo, at file:line | `scout/claims.md` | `test -s` |
| S3 | `catalog-curation-model` | what curation data exists vs must be authored; which facets are measurable vs judgment | `scout/curation.md` | `test -s` |
| S4 | `catalog-stage-perf` | can the gallery/iframe stage be built and measured; what are today's live numbers at 1440/390 | `scout/stage.md` + json | `test -s` |

## FLEET 2 — base (2 code workers, disjoint)

| unit | name | owns | why it must be first | done-test |
|---|---|---|---|---|
| F1 | `catalog-shell-split` | `App.tsx` → `Home/ItemPage/Gallery?/Chrome/Rail` modules + **the bug (§4)** + §3.5 page hygiene (file order, casing, prev/next within family) | only one owner may hold `App.tsx`; the bug is a state-reset defect inside it | build + guard + route assertions |
| F2 | `catalog-curate-gen` | `design-catalog.db`/`gen.py`/`manifest.json`: public curation facets, `show reference-only` flag, demo/pick data | FLEET 3 UI needs the fields to read | `verify.py` + manifest schema assertion |

## FLEET 3 — build (5 workers, one file each)

| unit | name | owns | review ref | done-test |
|---|---|---|---|---|
| G1 | `catalog-gallery` | `Gallery.tsx` + `#/g/…` routes + lazy iframe mount/pause + hover-play | §3.1 | build, guard, route + intersect assertions |
| G2 | `catalog-home-copy` | `Home.tsx` + `About.tsx`: first-run screen, agent hero, licensing moved out | §3.7 §3.8 | build, guard, copy assertions |
| G3 | `catalog-identity` | `styles.css`, `index.html`, `ThemeSwitch.tsx`: system dark + toggle, typeface, scale | §3.6 | build, guard, computed-style assertions |
| G4 | `catalog-item-stage` | `ItemStage.tsx`: preview light/dark, viewport widths, replay, reduced-motion | §3.5 | build, guard, staged-DOM assertions |
| G5 | `catalog-shell-dogfood` | `Rail.tsx` + `ChromePage.tsx`: Cmd+K command palette, rail hover/transition, chrome page truth | §3.4 | build, guard, `#/chrome` DOM counts |

## FLEET 4 — prove (2)

| unit | name | does | done-test |
|---|---|---|---|
| Q1 | `catalog-qa-measure` | Playwright at 1440 + 390 (scrollWidth == viewport, rail overlap, tap targets ≥44), before/after numbers, `see` screenshots, mobile verdict | measurement json + `qa.md` |
| Q2 | `catalog-publish` | `./publish.sh` → `git push` → live 200 + checksum, plus a rollback note | live 200 + pushed sha |

## Rules every worker inherits

- **Prohibitions first.** No new dependency unless the repo already has it. No Tailwind rewrite of a
  library's demo. No React islands outside `app/`. Never edit `gen.py`'s taxonomy. Never copy a
  `local-only` item's code (beautifului, rareui, transitions) into this repo — 676 MIT items only.
- **The guard is not the enemy.** `app/check_chrome.py` fails a raw `button/input/textarea/select/
  table/details/summary` in the shell. If a unit needs a new primitive, import it from
  `app/src/registry/new-york-v4/ui/`; if it genuinely needs a raw tag, widen the guard *and say why*.
- **No invented content.** No fabricated "good for" claims, no fake stats, no machine-generated
  verdicts presented as human judgment. Unknown is written as unknown.
- **Evidence, not adjectives.** A unit's report names files, line numbers, commands and their output.
  "Looks better" is not a result; a measured `scrollWidth` and a screenshot URL is.
- Every unit writes its report to `/root/docs/catalog-redesign/<fleet>/<name>.md` and answers in
  `RESULT / ARTIFACTS / COULD NOT DO / UNSURE`.
- Commit per unit, on its own branch, pushed; the lead merges. `master` is only touched by Q2.

---

# Decisions the lead has made (frozen for every build unit)

These are decided once so five workers do not each invent one. Changing one is my call, not a worker's.

## D-A. Identity — dogfood the catalogue's own fonts

- **Typeface:** `shadcn/font-instrument-sans` (UI, headings, body) + `shadcn/font-jetbrains-mono`
  (labels, code, counts). Both are *catalogue items*, so the site's own type is furnished from its own
  goods and carries `data-catalog-item="shadcn/font-instrument-sans"`.
- **Self-hosted, latin subset, variable woff2 only** (~2 files, ~120 KB total), `font-display: swap`,
  preloaded. **No Google Fonts CDN link** — the site promises "no third-party scripts"; a CDN font would
  break that promise and add a request to a third party.
- Licence: both are SIL OFL — record the licence text in `LICENSES-FONTS.md` at the repo root.
- Scale keeps the existing `--t-*`/`--s-*` rhythm (already 12.5/13 · 14/1.7 · 15/24 · 18.75 · 30/36,
  8 px spacing). Do not re-derive it; only the typeface and tracking change.
- No gradient, no emoji, no decorative illustration, no marketing hero. One accent, used sparingly.

## D-B. Theme — system first, toggle second, no flash

- `<html>` carries **no** `class="light"` hardcode (`app/index.html:2`). First paint follows
  `prefers-color-scheme`; a small inline script sets `.dark` before CSS paints (no flash of wrong theme).
- A visible toggle (registry `Switch` or `ToggleGroup`) persists the choice in `localStorage` under one
  key, and "system" stays a reachable third state — not silently converted to a fixed choice.
- Demo iframes follow the same choice: the parent passes `theme=dark|light` (see D-C).

## D-C. Demo protocol — frozen, so two workers can implement opposite halves

The iframe hash today is `#<encodeURIComponent(itemId)>|<variantIndex>`. It becomes:

```
#<encodeURIComponent(itemId)>|<index>[|k=v][|k=v]
```

| key | values | meaning | parent sets it | child obeys it |
|---|---|---|---|---|
| `theme` | `light` \| `dark` | the demo renders in this theme regardless of OS | yes (from the site's theme) | yes — set the class on the child `<html>` |
| `motion` | `on` \| `off` | `off` stops all animation/transition in the child | yes (stage toggle; defaults to OS `prefers-reduced-motion`) | yes — one `html.motion-off *` rule with `animation:none!important;transition:none!important` |
| `static` | `1` | thumbnail mode: no autoplay; the child reports it is ready and waits for `hover`/`play` messages | gallery | yes — do not autoplay looping motion; still render the first frame |
| `replay` | numeric nonce | remount/replay for a motion item | stage Replay, gallery hover | yes — key the rendered demo on the nonce |

Rules: unknown keys are ignored (forward compatible); an absent key means today's behaviour exactly;
`demo.html#<id>|<i>` must keep working for old links. Post-message events the child emits are namespaced
`designCatalogDemo` (existing) plus `designCatalogHover` (`{id,index,phase:'enter'|'leave'}`) only when
`static=1`. **Child side (`app/src/demo-main.tsx` + `site/demo.tsx`) belongs to one worker only.**

## D-D. Gallery card

- Grid, `repeat(auto-fill, minmax(300px, 1fr))`, gap on the 8 px rhythm; 1 column below 640 px.
- Each card: a live frame (aspect-ratio box, demo scaled to fit via the existing `useFit` trick), the
  display name, the source, the licence badge, and — when the data unit lands — the public facets.
- **Mount on intersection** (rootMargin ≈ 200 px), unmount or park well outside it; motion items get
  `static=1` and play on hover/focus.
- **Reference-only items** (no demo) are hidden by default behind one honest toggle ("show
  reference-only"), and when shown use a visibly different card: no frame, a "View on <library> ↗" link.
- Every section, family and category row in the rail links to its own filtered grid — the grid and the
  rail are the same data, so a count that says 12 opens 12.
- A gallery route is `#/g/<source>?<filter>`-ish: keep it human-readable and shareable, and make an
  unknown filter say so instead of rendering the front page silently.

## D-E. Honest numbers (from the claims audit, use these, not the review's)

- 769 items · **591 have any source file** · 676 are marked "source included" by licence policy, of which
  **167 have `files: []`** and must stop claiming they ship source · 486 run a demo · 283 have none
  (93 withheld + 190 source-but-no-demo) · **159 items carry any curation (20.7%)**.
- The home page and rail must compute these from the manifest at runtime — no hand-copied figure in
  `index.html`/`package.json` may disagree with the page (`769 UI components` appears in three places today).

## D-F. What "public curation" is allowed to be

Waiting on `catalog-curation-model`. The rule that binds regardless: nothing invented. A facet is either
computed from data (and names its source), measured on this box (and names the command), or authored by a
human/editor (and is attributed as an editorial pick). "Good for" may not be machine-guessed for 769 items
and presented as fact.

---

## Execution log (lead, 2026-10-27)

| fleet | unit | state | landed |
|---|---|---|---|
| 1 | catalog-repo-map | reported, reaped | `scout/repo-map.md` |
| 1 | catalog-claims-audit | reported, reaped | `scout/claims.md` |
| 1 | catalog-curation-model | reported, reaped | `scout/curation.md` |
| 1 | catalog-stage-perf | reported, reaped | `scout/stage.{md,json}` + 3 shots |
| 2 | catalog-shell-split | merged `f641b330` | 8 commits, guard 4→10 files, H bug proved fixed |
| 2 | catalog-curate-gen | merged `4475e37a` | 4 commits + store migration, 0/159 verdicts published |
| 3 | catalog-gallery | running | — |
| 3 | catalog-home-copy | running | — |
| 3 | catalog-identity | running | — |
| 3 | catalog-shell-dogfood | running | — |
| 3 | catalog-item-stage | queued behind gallery (needs the child protocol) | — |
| 4 | catalog-qa-measure | queued | brief ready |
| 4 | catalog-publish | queued behind QA's GO | brief ready |

Lead-run merges: `db1e4e8`… no — `f641b330` (shell split) and `4475e37a` (data layer) are the two
integration points; every later unit branches from their union, so `master` is the single base the QA pass
measures.

Provider incident 21:54Z: four 503 "upstream Insufficient Balance" errors killed `pane` turns in two
workers; both resumed on a re-wake, no work lost. If it recurs mid-unit, re-wake rather than respawn —
the transcript is intact.

Fleet lesson: `fleet spawn` can create the tmux session and still exit non-zero ("tmux session did not
start") when pi renames the session within the has-session window. Two units were recovered with
`fleet adopt <name> --parent auto --unit …`. Check `tmux ls` before assuming the spawn failed.
Gate lesson: the reaper's merge gate defaults to `origin/main`, but this repo's base is `master` and the
merge is local until publish — run `FLEET_BASE=master fleet reap-children --of teal --apply`.

## Execution log — the six slices, all live

| slice | commit | live | what a visitor gets | proof |
|---|---|---|---|---|
| 1 | `0ce95097` | ✅ | shell split (10 files guarded), code-pane leak dead, honest data layer, 67 MB of unreachable chunks pruned by reachability | `main-Dm1uqq1A.js` live, smoke 12/12 |
| 2 | `95f46d4e` | ✅ | the gallery: 486 tiles, 9 live / 2 on phone, `?ref=1` for the 283 reference-only, every rail count opens its own grid | `gallery_check`: maxLive 9/9 · 2/2, counts 486/283/769, 0 overflow |
| 3 | `28f97e5e` | ✅ | Instrument Sans + JetBrains Mono self-hosted, system dark before first paint, Cmd+K palette, `#/about`, `#/chrome` from data, 250 ms page turn | `slice3_check` 11/11, 0 CDN font requests, 0 animations under reduced motion |
| 4 | `06381807` | ✅ | item page is a stage: theme · viewport · motion · replay; the registry toggle is reachable by Tab | `stage_check` 7/7, child `<html>` obeys each flag |
| 5 | `a8d06d17` | ✅ | the 18 QA findings: 44 px in both dimensions on every control the shell owns, and a reduced-motion sentence that matches | `tap_check` 12/12, smoke/gallery/stage/slice3 all green from the public URL |
| — | `16e5c59b` | — | QA harness in-repo: 84 assertions, raw json, 15 screenshots | `qa/measure.mjs` |

**QA verdict:** `PUBLISH: GO (0 blocking, 6 cosmetic — one defect class)`. All six were closed in slice 5.
Findings the units got wrong and QA corrected: the 44 px floor was measured on the theme switch's *wrapper*
(`184 × 42`) not its three radios (`56 × 32`); the gallery's frame-tail was understated (13/960 over budget,
not 4–6); no demo in the catalogue reports height 0, so `SELF_FLOOR` was exercised by aborting the child's load
rather than asserted.

**Lessons worth keeping**
1. `publish.sh` prunes chunks by age (`-mtime +7`); 86 MB of dead chunks had accumulated. Prune by reachability.
2. A `transform` is scrollable overflow: an 8 px slide widened the phone document to 398 px for 250 ms. Clip the
   wrapper.
3. The registry's `ToggleGroup` renders every item `tabindex="-1"` and puts no stop back — check the control, not
   the wrapper, and read `tabIndex` off the item.
4. `FLEET_BASE=master` for every reap, or the gate judges against `origin/main` and refuses.
5. A worker's "measured" claim is only as wide as what it measured: height ≠ width, wrapper ≠ child.

## Round 2 — the review's 14 items, mapped to units

| unit | review items | files it owns | state |
|---|---|---|---|
| `r2-frame-truth` | stage ignores its own theme · tiles mix white/dark canvases · tiles show a strip + dead space · 5–10 s blank | `site/demo.tsx`, `site/Stage.tsx`, `site/Gallery.tsx` | running |
| `r2-verdict-excise` | hero prints `rejected` ×6 · item-page verdict badge · withheld sentence · empty code box · home reads like an audit | `site/ItemPage.tsx`, `site/Code.tsx`, `site/Home.tsx`, `site/lib.ts` | running |
| `r2-shell-small` | provenance tags sitewide · duplicate rail nesting · "Matrixs" · theme pill overlaps cards | `site/route.ts`, `site/Rail.tsx`, `provenance.tsx`, `styles.css` | running |
| `r2-compare-data` | "no curation replaced them" — the data half | store: `query.py`, `mcp_server.py`, `schema.sql` | running |
| `r2-home-tiles` | home is prose, gallery one click away | `site/Home.tsx`, tile export | queued on frame-truth |
| `r2-compare-page` | comparison pages (six sidebars, seven tabs) | `site/Compare.tsx`, `route.ts`, `App.tsx`, `ItemPage.tsx` | queued on both |

**Frozen decisions for round 2**

- **R2-D1** hero search card is **generated from the manifest**, not a pasted CLI transcript (it drifted once already).
- **R2-D2** posters are **text, not screenshots**: the parked tile names its item (`title · source/kind` + facets),
  drawn immediately, no animation. Real stills only if asked.
- **R2-D3** no verdict string reaches a visitor: not the hero, not an item page, not a withheld notice. The store may
  keep `port_note`; the site may not print it. `catalog_get` may still return `port_notes` (agent tool), `search`
  gains `--verdicts` defaulting **off**.
- **R2-D4** provenance tags become a property of `#/chrome` — the listener does not arm on any other route.
- **R2-D5** home tiles: six, chosen **mechanically** (composition → used_here → fewest files, one per section) and
  the row says so. No invented curation; `pick` stays empty until a human fills it.
- **R2-D6** comparison pages compare only published fields, say how the set was chosen (concept rule verbatim), and
  never rank. Columns identical across every row are dropped and listed.

**Corrections to the review that the code proved**: the manifest carries **0** verdicts today (`port_note.public=0`),
so the defect is latent wiring plus one hardcoded paste; the CLI/MCP do return verdicts (`query.py:32`,
`mcp_server.py:184`) but that is our tool, not the site; and "most tiles are white slabs" is a reactivity bug
(`Gallery.tsx:573` reads the theme once per render), not a palette bug.

## Launch QA, round 3 — 17 items, one blocker

Four testers (impatient, mobile, non-native, breaker). Break-down against the code, not the prose:

| # | item | sev | who | state |
|---|---|---|---|---|
| 8 | phone Browse menu untappable | **blocker** | `r3-phone-menu` (Rail, styles) | running — reproduced: rail 375×6, every row hit-tests to the page header |
| 14 | theme pill covers content | minor | `r3-phone-menu` (same cause: a fixed strip over the page) | running — at 600 the lane is 600×67 with a tile under it |
| 1 | Copy copies the wrong thing / lies | major | `r3-copy` (Code, demo) + lead wires ItemPage/Home | running |
| 16 | 5th file tab overlaps the path bar | minor | `r3-copy` (same component) | running |
| 7 | palette: no ✕, spills, Back, typos | minor | `r3-palette` (CommandPalette) | running |
| 5 | no way into the components | major | `r2-home-tiles` | running |
| 2 | filter / chips / gallery / counts disagree | major | `r3-filter` | queued on home-tiles + phone-menu |
| 9 | unknown URL renders home | major | `r3-routes` (with 11 + 15) | queued on compare-page |
| 11 | gallery forgets scroll on Back | major | `r3-routes` | queued |
| 15 | Tab walks every tile's iframe; no aria-pressed; faint focus | minor | `r3-routes` + Tile | queued |
| 10 | insider jargon (14 rewrites) | major | `r3-plain` (with 17) | queued |
| 17 | "1 files", "Default" twice, catalog/catalogue, licence/license, About numbers | minor | `r3-plain` | queued |
| 4 | blank/white boxes while loading; 380 KB of JS before any paint | major | `r3-paint` (demo, Stage, styles, index.html shell) | queued on phone-menu (styles.css) |
| 13 | targets < 44 px and text < 12 px on phones | minor | `r3-paint` | queued |
| 6 | width controls: "full" is 509 px; phone widths inert | minor | `r3-paint` (demo.tsx) | queued on home-tiles |
| 12 | cards repeat their facts, unclear words | minor | lead, in `Tile.tsx` once it exists | queued on home-tiles |
| 3 | home terminal: rows aren't links, Copy is the CLI command, 1235 px wide on a phone | major | lead, in `Home.tsx` once home-tiles lands | queued |

**What held up (do not regress):** filter/palette/URL injection is inert; bad gallery filters explain themselves;
rapid clicking ends in the right state; prev/next never skips; deep links and the sidebar filter survive reload;
no sideways scroll at 375; the phone gallery keeps 2 live frames.

**Note for the queued ones:** three units cannot start until two of tonight's merges land, because they own the
same files — `Tile.tsx` (home-tiles) is needed by 12 and 15, `route.ts` (compare-page) by 9, `styles.css`
(phone-menu) by 4 and 13. Sequential waves beat colliding branches; the fleet cap is 5.

## Round 5 — closed (28–29 Oct 2026)

The five rows that were left after round 4 are done and gated; full detail in
`build/r5-firstpaint-and-leftovers.md`.

| Review item | What changed | Gate |
|---|---|---|
| #4 blank first paint | shell in `index.html` (~2 KB inline CSS, real counts), the stylesheet as a preload instead of render-blocking, the six hero cards drawn at build time, five surfaces lazy | `r2_check` (hero parity), measured 637 ms |
| #13 phone type/targets | 11–11.5px → 12px everywhere, sub-44px links → 44px | `mobile_state_check` |
| #12 repeated card facts | cards print files/size/parts; deps and used-here on the item page | `r2_check`, `mobile_state_check` |
| #6 stage width controls | already present, now measured (770 → 390 → 768 → 770) | `mobile_state_check` |
| #2 filter survives reload | `q`/`from` in `sessionStorage`; rail expansion follows the filter (`resetKey`) | `mobile_state_check` |
| prune by age | `publish.sh` runs `scripts/prune_docs.py` (reachability) | `assets_check` |

Frozen decisions added this round: the rule for the hero exists twice and the parity gate (not trust) is
what keeps the two copies honest; a gate that navigates must wait for its surface (`qa/settle.mjs`); a
pruner is never trusted to judge its own work (`qa/assets_check.mjs`).
