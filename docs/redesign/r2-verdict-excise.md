# r2-verdict-excise — the verdicts are out of everything a visitor reads

Branch `fleet/r2-verdict-excise`, base `master` @ `38dada04`. Five commits, one per numbered item,
each message carrying its own measurement. Files touched: exactly `app/src/site/Home.tsx`,
`app/src/site/ItemPage.tsx`, `app/src/site/lib.ts` (nothing else; `Code.tsx` needed no change —
see "what I did not do").

Build: `npx vite build` in `app/`, served at `<base>/design-catalog/` (the vite base path — serving
`dist/` at `/` gives a blank page, every asset 404s). Playwright:
`/root/camofox-browser/node_modules/playwright/index.mjs`, `/usr/local/bin/google-chrome`,
`--no-sandbox --disable-dev-shm-usage`; viewports 1280×900 and 390×844.

## The numbers

| gate | required | measured |
|---|---|---|
| `#/` hero card, word `rejected` | 0 | **0** |
| `#/` marker total | `manifest.filter(i => /sidebar/i.test(name+" "+slug)).length` = 25 | **25** (marker: `… 17 more of 25 matched`) |
| `#/` row set across two reloads | stable | **identical** (8 rows, same order, both loads) |
| `#/i/beautifului/agent-screen` `<pre>` | none | **0** |
| … "not in the published set" in the HTML | absent | **absent** |
| … outbound link control | ≥ 44 px | **44 px** rendered height, `min-height: 44px` computed — at 1280×900 *and* 390×844 (198×44) |
| … file names readable text | yes | `Source files (1)` / `<code>AgentScreen.tsx</code>` |
| `#/i/shadcn/button` code viewer | works, opens on the main file | `registry/new-york-v4/ui/button.tsx`, 2 382 chars |
| … tabs switch | yes | `#/i/beui/bloom-menu`: opens `components/motion/bloom-menu.tsx` (11 896 chars) → click last tab → `lib/utils.ts` (166 chars) |
| item-page verdict surfaces | none | `.page-in .verdict` count **0** on both a withheld and a published item; badges are `source included · MIT · n files · n demos` |
| `grep -rn verdict app/src/site/` | only removal comments | 4 comments of mine (2 `ItemPage.tsx`, 2 `Home.tsx`) + 2 pre-existing `className="verdict"` in `About.tsx` + 1 pre-existing comment in `ChromePage.tsx` (see "caveat") |
| `python3 app/check_chrome.py` | exit 0 | **exit 0**, 16 shell files scanned |
| `#/` tally note | one number | `486 of these run here as a live demo.` |

Hero rows, exactly as rendered (8 of 25, no verdict column):

```
AI Sidebar  [beui/component]
Animated Sidebar  [beui/component]
Bounce Sidebar  [beui/component]
Bounce Sidebar  [rareui/component]  source withheld
Hook Sidebar  [rareui/component]  source withheld
Proximity Sidebar  [rareui/component]  source withheld
sidebar  [shadcn/component]
Sidebar  [shadcn/text]
```

Same eight rows as the old paste, same fields, same order — the verdict column and the typed `20` gone.

## The new copy, verbatim

Hero hint (`Home.tsx`):

> Read out of the catalogue when this page renders, not pasted: the first 8 of 25 items whose name or slug
> says `sidebar`, name matches first. A row reads `name [source/kind]`, then the item's own one-line
> description, then the command its library publishes for it. `design-catalog search "sidebar"` returns the
> same rows with their fields.

Marker (rendered inside the card): `… 17 more of 25 matched`

Withheld notice (`ItemPage.tsx`):

> The code is theirs. It is not republished here; their page has it.

Primary action: `View on beautifului.dev →` (host derived from `item.page`, `www.` stripped)

Home tally note: `486 of these run here as a live demo.`

## How the hero stays honest

`SEARCH_ROWS` is computed at module load from `manifest.json`: filter on `name + " " + slug` against the
query (regex, case-insensitive), rank a name match above a slug match, ties by `name.localeCompare` —
the same ordering `bin/cli.mjs`'s `score()` produces. `SEARCH_TOTAL` is `SEARCH_ROWS.length`; the marker
is `max(0, TOTAL − min(SHOWN, TOTAL))`. A row prints `name  [source/kind]` (+ `source withheld` when the
manifest says so), then `one_line` only if truthy, then `install` only if truthy — so
`shadcn/sidebar` (empty `one_line`) prints no blank description line, and no row can print a field the
manifest does not have. `VERSION` is no longer imported (the card is not a transcript of a version).

## What the lead must wire

1. **The card and the CLI disagree by one row at the tail, and the copy does not claim they don't.**
   `bin/cli.mjs`'s `score()` also matches `one_line`/`source`/`kind`, so the CLI's own matcher finds **26**
   items for `"sidebar"` — the extra one is `shadcn/dashboard-01` ("A dashboard with sidebar, charts and data
   table"). The frozen gate defines the count as name-or-slug matches (**25**), and that is what the marker
   prints. Its CLI default cut is 20 (`--limit`), which is where the old `SEARCH_TOTAL = 20` came from.
   Either the CLI's predicate should narrow to name+slug, or the gate should widen to the CLI's — someone
   with `bin/cli.mjs` has to pick one. Until then the site is self-consistent and strictly truthful about
   *its own* predicate; it just isn't the CLI's set.
2. **`About.tsx` and `ChromePage.tsx` still say "verdict"** — `className="verdict"` twice in `About.tsx:69,74`
   is a CSS callout class (the licence boxes), and `ChromePage.tsx:99` is a comment ("not a verdict, a
   statement: nobody has looked yet"). Neither renders a verdict, so nothing leaks, but the grep gate cannot
   be literally clean until the owning units rename the class to e.g. `callout` (and `styles.css` with it).
   That class rename is a two-file change in someone else's files; I did not make it.
3. **`withFile` / `demos` / `noDemo` are no longer printed in aggregate on the front page.** `#/about` prints
   `licenceFull`, `published`, `noFile` and per-source `withFile`-derived numbers, but the total `withFile`
   (591) and `demos` (486) now appear only as the one home-page number. If those two totals are supposed to
   stay visible, `About.tsx` (not mine) needs one sentence.
4. `#/i/shadcn/button` renders the badge `1 files`; the plural rule exists for demos but not for files —
   `ItemPage.tsx` is mine, but it wasn't in this brief, so the copy bug stands.

## What I did not do, and why

- **`site/lib.ts`'s `useCode` placeholder is untouched.** Item 4's remedy (don't render `<Files>` for a
  withheld item) makes the placeholder unreachable on every withheld page, which is what the gate asks.
  Changing `useCode`'s contract would have touched `site/demo.tsx` (not mine — it calls `useCode` and relies
  on the current return shape for "Hide code"/`Copy`), so I left it as the honest fallback it is.
- **No `styles.css` edit.** The 44 px control is guaranteed by inline `height/minHeight` on the `Button`
  rather than by a new shell class.
- No `site/` file outside my four was modified; `git status` is clean at `0519bd80`.

## Commits

```
0519bd80 site: the front page states one number, not an audit
c4fdac64 site: a withheld item renders no code viewer, only its file names
6510b5e1 site: the withheld notice stops promising a verdict and points at the source
956e638e site: item pages render no verdict
724132b0 site: the hero's search card is generated from the manifest, not pasted
```
