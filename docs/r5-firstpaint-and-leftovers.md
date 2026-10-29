# Round 5 — the first paint, and the four items that were left

28–29 October 2026. Everything here is measured on the live site at
`https://rx3asarc.github.io/design-catalog/` with Chromium, 400 kbit/s down / 400 ms RTT, cold cache,
unless a line says "local".

## Why this round exists

The review's blocker list had five rows still open after round 4, and the biggest was #4: an empty
white rectangle for eight to twelve seconds on a slow connection. This round closes all five.

## #4 — the blank first paint

### What it actually was

Measured on the live build **before** any change:

```
first paint            7,776 ms
first line of content 10,761 ms
wire                  1,781 KB decompressed — 1,407 KB of it JavaScript
```

Two mistakes in my own measurement first, both mine and both worth recording:

1. The probe awaited `response.body()` on all 53 responses. That serialises downloads and stalls the
   renderer; it reported first paint at 8.1 s for a paint that had happened at 664 ms. Every number
   below comes from `performance` entries and `transferSize` instead.
2. The first version of the shell set `modulepreload` on 51 chunks and treated that as the cost. It is
   not the cost — *bytes* are.

### Lever 1 — the shell, and the stylesheet that was holding it

`index.html` now carries the shell the page needs before a single script runs: the top bar, the rail's
section names, the real title, the real counts (`%CATALOG_COUNT%` / `%CATALOG_RENDERED%`, substituted
from the manifest at build time) and the six hero cards. It is ~2 KB of inline CSS and needs no network
round trip. `createRoot().render()` replaces those children on mount, so the shell lives exactly as long
as it is needed; if the bundle never arrives it stays and tells the truth rather than leaving white.

The shell alone was not enough: a render-blocking `<link rel=stylesheet>` stops Chrome painting
*anything*, including content already in the document. `vite.config.ts` emits the stylesheet as a
preload that becomes the link on load (`<noscript>` keeps the no-JavaScript case unchanged), so the
shell paints from its own CSS and the real sheet applies long before React mounts.

### Lever 2 — the six cards are the real six cards

The hero row is chosen from the manifest by a rule and every field it shows is in the manifest, so the
same six cards are drawn in the HTML at build time: same ids, same titles, same `source · kind`, same
facet line as `Poster` in `site/Tile.tsx`. A visitor at 637 ms reads the six tiles' names and facts; the
demos themselves still arrive with the bundle.

The rule now exists twice — statically in `vite.config.ts`, and in `site/Home.tsx`, which is the
authority. That is a known cost, so it is gated: `qa/r2_check.mjs` reads `data-boot-hero-ids` out of the
raw `index.html` and `data-hero-ids` off the mounted row and fails the run if they differ.

### Lever 3 — five surfaces fetched when asked for

The gallery, an item page, a comparison, the chrome page and about are `React.lazy` chunks now. The
entry ships the front page; a route fetches its own chunk on the click that asks for it, and shows one
line ("Fetching item…") while it is in flight — not skeleton cards, because a skeleton that turns into
different content is a lie about what is coming.

### Result

```
first paint (shell, with the real six cards)   637 ms   (was 7,776 ms)
first line of content                        10,032 ms   (was 10,761 ms)
wire at 400 kbit/s, cold                       399 KB   = 291 KB JS + 47 KB CSS + 61 KB fonts
```

The content time is now bandwidth, not blocking: 399 KB at 50 KB/s is ~8 s of transfer before React can
render, and what is left of it is the React runtime (the 780 KB-raw shared chunk is react-dom + the
preload polyfill) plus the manifest (184 KB raw / ~26 KB gzipped) plus the demo filename map. Getting
below that means pre-rendering the whole front page rather than its first frame, or splitting the
manifest per section; neither is in this round.

## #13 — phone type and targets

Measured at 390 px across six routes (`#/`, `#/g`, an item page, a comparison, `#/about`, `#/chrome`):

```
text under 12px      21 / 2,566 / 256 / 6 → 0
targets under 44px    3 / 1 / 1          → 0
```

Fixed: the poster kicker, `source · kind` and facet lines (11–11.5 → 12), the comparison table (11 → 12),
the "unseen" badge on `#/chrome` (10 → 12), and links at 18 px height on the home page, `#/about`
(`CHECKSUMS.txt`) and the item page ("Compare with the N others") → `minHeight: 44`.

## #12 — the same four facts on every card

A card prints files, size and parts — the three facts that describe what the item *is*. `deps` and
`used here` moved to the item page, which now carries the whole numeric record in one line. Nothing
went unpublished; the grid stopped saying four facts 486 times.

## #6 — width controls on the stage

They already existed (`StageBar`: 390 / 768 / full). This round measured them instead of assuming:
frame 770 → 390 → 768 → 770 on `#/i/shadcn/sidebar-09`.

## #2 — the filter survives a reload

`q` and `from` are written to `sessionStorage` and read back on mount — session, not local: a filter is
something you did a moment ago in this tab, not a setting that should outlive it.

The gate then found something the item did not ask for: typing `side` showed **2** rail rows, while a
reload with the same filter showed **9**. Both filtered correctly; the per-family open/closed state was
stale, so most matches sat behind a family the reader had collapsed before typing. `Level` now takes a
`resetKey` (a signature of the tree's shape, already in hand because it is what the rows print) and
returns to its own default when the tree changes. A filter that hides its own matches is a broken filter.

## Prune: reachability, not age

`publish.sh` no longer runs `find docs/assets -mtime +7 -delete`. It runs `scripts/prune_docs.py`, which
crawls from `index.html` and `demo.html` through every asset name a reachable script or stylesheet
mentions and deletes only what that crawl never reaches. The age rule could not tell a dead chunk from
one a *cached* html still asks for — which is the one case keeping old chunks exists for.

Two things learned about this pruner the hard way, both now guarded:

- It deleted `avatars/shadcn.jpg`, because that path is named by a data string inside a demo module and
  no `href`/`src` crawl can see it. `fonts/` and `avatars/` are kept unconditionally.
- A pruner cannot be trusted to judge its own work, so `qa/assets_check.mjs` walks the published tree,
  collects every `assets/NAME.js|css` mentioned anywhere in it and asserts each one exists:
  **2,328 references, 0 missing**, and the prune that just ran (8 files) is verified rather than assumed.

## Gates

Seven gates, all green **three runs in a row**, local and live:

```
smoke · r2_check · tap_check · gallery_check · stage_check · slice3_check · mobile_state_check
assets_check (tree integrity)
```

`qa/settle.mjs` was the last fix: the lazy split put five surfaces behind a fetch, and every gate that
navigated then slept a fixed number of milliseconds was checking the "Fetching …" line. Two r2 checks
failed one run and passed the next with `0 <pre>` and `0 links`; the hero parity check compared six
declared ids against zero mounted ones. `goto` is wrapped so a navigation settles the same way
everywhere, and nothing is softened — a surface that never arrives still fails the check it was
navigating to, because a fallback has none of the things being counted.

## Commits

```
the front page's first frame is now the front page, not a placeholder   (shell + six real cards + parity gate)
first paint without the stylesheet, and the pruner stops deleting demo assets
the four review items that were left, and a prune that stops guessing
seven gates, and a settle that makes them stop sampling the fallback
the rail's expansion follows the filter, and the gate that found it
a gate that does not trust the pruner
```

## What is still open (with reasons)

- **The front page's content at 9.9 s on slow 3G.** Bandwidth-bound now, not blocked. Options: pre-render
  the whole first screen (tiles' posters are text, so this is possible), or split `manifest.json` per
  section so the entry stops carrying the whole catalogue. Both are real pieces of work.
- **`pick` is still 0 of 769.** The one field no agent may invent.
- **4 of 25 sidebars have no drivable demo**, so their comparison row reads "not measured" across the
  board and they get no "pick this if…" line. Honest, and thinner than the other 21.
