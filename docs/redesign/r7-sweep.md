# Round 7 — the sweep: every route, both widths, both palettes

The design system was adopted in round 6 and its numbers held on the pages r6 looked at. This round walked **every
route the site has** and measured the seven things the book makes checkable, on the live build first
(`https://rx3asarc.github.io/design-catalog/`) and then on the local build after the fixes.

29 routes × 2 widths (1440×900, 390×844) × 2 palettes (dark, light) = **116 views**. Five deviations were real and
are fixed; three of the seven checks came back clean on all 116 views; the rest of what the sweep flags is a
decision, and §5 says which and why.

Harness: `qa/r7_sweep_measure.mjs` (committed). Full readings: `r7-sweep.live.json` and `r7-sweep.after.json`, next
to this file; the unique findings and totals are in `qa/r7_sweep.summary.json` (5 KB, committed).

---

## 1. What was walked

| Class | Routes |
| --- | --- |
| the five pages | `#/`, `#/g`, `#/chrome`, `#/about` |
| the gallery, filtered | `#/g/sec=Blocks+and+pages`, `#/g/sec=Components`, `#/g/sec=Motion+and+effects`, `#/g/sec=Docs`, `#/g?src=beui`, and `#/g/Components` (a bare word where a query goes) |
| eleven items, all five sources | `shadcn/chart-area-axes` (block), `beui/availability-scheduler` (block), `beui/action-swap` (component), `shadcn/accordion-demo` (pattern), `shadcn/button` + `shadcn/input` (14 variants each), `shadcn/docs-changelog` (**text**, no demo), `transitions/3d-tilt` (**effect**, withheld), `rareui/ai-status` (withheld), `beautifului/agent-screen` (withheld) |
| six comparisons | `#/c/sidebar` (25 members), `#/c/accordion`, `#/c/tabs`, `#/c/tooltip`, `#/c/combobox`, `#/c/table` |
| three misses | `#/i/nope/nope`, `#/i/shadcn/does-not-exist`, `#/nope` |

The brief says "all four sources"; the catalogue has **five** (`shadcn` 566, `beui` 110, `transitions` 43, `rareui`
29, `beautifului` 21) and the item list covers all five. All 108 `text` items are shadcn's, so the text item is one.

## 2. How it was measured

One probe function, serialised into the page, reading only **painted** values:

- **type floor** — every element that owns a text node, `font-size < 12`, with class and text. Demos live in
  iframes, which `querySelectorAll` does not cross, so "text the site owns" is exactly what gets walked.
- **accent budget** — `backgroundColor` compared to `--accent` *by painted colour*.
- **shadows** — `box-shadow !== none` **and** at least one layer with alpha > 0 (Tailwind v4 emits
  `rgba(0,0,0,0) …` ring slots that paint nothing; counting those would be counting a lie).
- **radii** — controls at ≥ 99 px that are not a dot (≤ 20×20, square) and not an avatar.
- **contrast** — every text-owning element, its colour and the colour composited under it, both resolved by
  **drawing them into a 1×1 canvas** and reading sRGB back. This mattered: the first pass of my own probe parsed
  digits out of the computed string, so `oklch(0.985 0 0)` became `rgb(0.985, 0, 0)` — black — and it reported
  ratios of 1.05:1 for text that is legible on screen. Every number below is from the canvas.
- **overflow** — `scrollWidth > clientWidth + 1` at 390 (outside a scroller), and text boxes whose
  `scrollHeight` exceeds `clientHeight` with `overflow: hidden|clip`, split into *truncated on purpose*
  (`-webkit-line-clamp`, `text-overflow: ellipsis`) and everything else.
- **dead ends** — an empty `.page-in`, `href="#"`/`href=""`, hash links resolved against the manifest's 769 ids and
  29 concept keys, and every external link fetched (15 of them, `curl -L`).

Also measured, because no route reaches them: `document.documentElement.scrollWidth` vs `innerWidth` on 13 routes
× 2 widths, and the two chrome surfaces that only exist on interaction — the command palette (⌘K, `sid` typed, 20
results on screen: type floor, shadows, radii, contrast) and the phone's Browse menu (same four, opened).

## 3. What the live build said

| Check | Live, 116 views |
| --- | --- |
| type floor (< 12 px) | **0** — the round-6 floor holds on every route, in both palettes |
| accent fills | **24** = exactly 1 on each of the 6 item views that have an install command, 0 everywhere else |
| shadows (painted) | **832** |
| radius-full on a control | **196** |
| text under 4.5:1 | **34** |
| overflow | **374** (0 of them a document that scrolls sideways) |
| dead ends | **0** — 0 empty columns, 0 `href="#"`, 635 unique links, 620 hash links all resolve, 15/15 external links 200 |

The three findings, in full:

**Shadows — 832 painted box-shadows, none of them a demo's.** 704 on controls the chrome renders (`240` in the page
column, `348` in the rail, `116` in the top bar) and 128 the demo card's **frame ring**
(`0 0 0 1px <rule>, 0 1px 2px rgba(0,0,0,.05)`). The controls are shadcn's `Button`/`Input`/`Badge`/
`ToggleGroupItem` carrying Tailwind v4's `shadow-xs`; the ring is `site/demo.tsx`'s inline style. Two more divs the
stylesheet itself had given a shadow: `.prov-tag` (`0 1px 2px`) and the phone menu's panel (`0 -1px 2px`), plus the
phone theme switch (`0 1px 2px oklch(0 0 0/.06)`) — and the command palette, which is **portalled to `<body>`**, so
it is outside `.cat` and still carried shadcn's `0 10px 15px -3px, 0 4px 6px -4px`. The demos keep everything they
have: they are separate documents, and no rule below crosses an iframe.

**Radius-full on things that are not dots — 196.** 174 at `999px`: the rail's theme switch, three segments × 58
views, from `.theme-switch [data-slot="toggle-group-item"] { border-radius: 999px }` (and the track itself). 22 at
Tailwind's `rounded-full` (`3.3554432e7` px): the chrome page's status badges ("unseen"/"seen"), which are `Badge`
with no `.badge` class. The book gives `radius-sm` 6 to chips and segmented tracks, `radius-md` 8 to buttons, and
`radius-full` **only to dots** — and the dot is a real element here (`.rail-item .dot`), so nothing round is lost.

**Text under 4.5:1 — 34.** All one shape: the item page's status badge. `code shown here` (`.badge.ok`, green
`oklch(.55 .14 150)`) measured **3.26:1** in dark and **4.16:1** in light; `code not shown` (`.badge.warn`, amber)
**4.03:1** in dark. At 12 px/500 that is normal-size text and the floor is 4.5:1. Two properties were doing the
work: the hue *as text colour*, and a `secondary` fill under it in dark.

## 4. What changed (five things, all chrome)

| # | Change | Where | Measured |
| --- | --- | --- | --- |
| 1 | no `box-shadow` on any control the site owns: `button`, `input`, `select`, `textarea`, `[data-slot=badge/toggle-group/toggle-group-item/command/dialog-content/popover-content]`; the three shadowed divs (`.prov-tag`, `.rail-phone .rail-list`, the phone theme switch); and the two portalled surfaces (palette dialog, provenance popover) | `app/src/styles.css` (r7 section) | shadows **832 → 0** |
| 2 | the demo card's frame ring is drawn as `outline: 1px solid <rule>; outline-offset: -1` instead of a 1 px box-shadow + a 1 px drop shadow — same hairline, no blur, no layout change (the box is `overflow: hidden`) | `app/src/site/demo.tsx` | (128 of the 832) |
| 3 | `radius-full` is for dots: theme-switch track → `radius-md` 8, its segments → `radius-sm` 6, `[data-slot=badge]` → `radius-sm` 6 | `app/src/styles.css` (r7 section) | radius-full **196 → 0** |
| 4 | status pills: the words are `--ink-muted` (which clears 4.5:1 on all three surfaces in both palettes — `qa/contrast_check.mjs` gates 32/32), the hue moves to a 6 px `::before` dot plus a `color-mix` hairline, and the badge loses its `secondary` fill inside `.page-in` | `app/src/styles.css` (r7 section) | contrast **34 → 0** |
| 5 | the palette's result rows and key hints were 11 px / 10 px / 10.5 px — the one chrome surface with no route, so no route sweep had ever seen them; all three are 12 px | `app/src/site/CommandPalette.tsx` | sub-12 nodes in the open palette, 20 results shown: **44 → 0** |

Nothing was restyled in a demo, nothing in `app/gen.py`, `manifest.json`, `app/src/tokens.css`, `docs/`,
`publish.sh` or the registry was touched, and no new dependency was added (Playwright is the absolute import
`/root/camofox-browser/node_modules/playwright` every harness here already uses).

After, on the local build (`http://127.0.0.1:8873/design-catalog/`), same 116 views: type floor **0**, accent
**24**, shadows **0**, radius-full **0**, contrast failures **0**, dead ends **0**, overflow **375** (see §5).

## 5. Deviations left in place, and why

1. **One accent fill per item page.** All 24 accent elements in 116 views are the install block's `Copy install
   command` (170×44) on the 6 item views that have one. That is the round-6 decision — the page's one primary
   action — not a slippage. 0 accents on `#/`, `#/g`, `#/chrome`, `#/about`, every comparison and every miss.
2. **The demos keep their shadows, radii and colours.** They are the exhibits; the book says so. Every rule added
   is scoped to the site's own chrome, and no site stylesheet can reach inside an iframe anyway.
3. **The gallery tile is a window.** 253 of the 375 overflow flags are `.page-in` divs with `overflow: hidden`
   whose content is taller than the box — the tile canvas at a fixed height (round 6: "a tile is one canvas tall"),
   with the demo frame inside it laid out at its natural width. Verified two ways: no document scrolls sideways at
   any width (`scrollWidth === innerWidth` on 13 routes × 2 widths), and a vision pass on `#/` and `#/g` at 390
   found **no text cut mid-word or mid-line** and captions fully visible.
4. **The home hero band scrolls sideways at 390** (2 flags): `scrollWidth 1865 > clientWidth 358`. `qa/r2_check.mjs`
   asserts exactly this — "the band is one screen tall and scrolls sideways" — and the vision pass sees a peeking
   tile at the right edge, which is the point.
5. **`div.stage` is 16 px wider than its box at 390** (12 flags): the demo frame is laid out at `100/zoom %` and
   scaled down to fit, so its *layout* box is wider than the painted result. No visible clipping, no document
   scroll. It is the fit-to-width mechanism, not a defect.
6. **The Files tab strip is 3 px taller than its client box** (8 flags): it is a horizontal scroller
   (`overflow-x: auto`); the 3 px is its own scroll track. No text is lost — the file names stay single-line and
   ellipsised (`span.path.truncate`, 6 flags, `text-overflow: ellipsis` by construction).
7. **`sr-only` spans** (58 flags): a 20 px box clipped to 1 px is what `sr-only` is.
8. **`#/g/<sec>` does not filter.** `#/g/Components` renders all 769 items — the gallery owns everything after
   `#/g`, so a bare word is parsed as a query string and reported as an ignored key rather than obeyed. The working
   spelling is `#/g?sec=Components` (or `#/g/sec=Components`), which filters correctly and says so. The bare-word
   form is a `site/route.ts` decision, and `route.ts` is not this unit's to change; the page does tell the reader
   the key was dropped, which is why this is a note and not a fix.
9. **The phone rail's collapsed default.** The Browse menu starts closed and shows four section names when opened;
   round 6 called its density "significantly more complex than the shell" and worth revisiting. Still a decision.

## 6. Gates

Local build, final tree, all green:

```
npx vite build                        ✓ built in 9.60s
node qa/smoke.mjs        <base>       SMOKE: all routes ok
node qa/r2_check.mjs     <base>       R2: ok
node qa/tap_check.mjs    <base>       TAP: ok
node qa/mobile_state_check.mjs <base> STATE: ok
contrast_check.mjs       <base>       CONTRAST: ok (32/32 token pairs, tightest 4.87:1)
node qa/assets_check.mjs docs         ASSETS: ok — 39,457 references, 12,156 files
```

## 7. What this sweep cannot see

- **Hover, focus, active and open states** on most controls (measured: the palette open with a query, the phone menu
  open, and the theme switch's three states; not measured: every tooltip, every disclosure, every code pane).
- **The third palette** — `system` is a stored mode, not a painted one; the two painted palettes were measured.
- **Anything inside a demo iframe**, by construction.
- **The published tree** (`docs/`) was not rebuilt: `assets_check docs` passes on what is published, and the
  published chunks are the ones the live site serves. Publishing is `publish.sh`'s job, not this unit's.
