# r3-routes — a bad URL says so, Back keeps your place, and Tab walks the page not the demos

Three review items, one shape: the shell did the wrong thing the moment a visitor left the happy path — a bad
address rendered the front page under a bad address bar, Back threw away the place in the grid, and Tab walked
into nine demo documents.

Branch `fleet/r3-routes`, base **`95ed4720`** (the base the brief names; `master` has since moved on to
`07c122e6` with the r2 home-tiles/compare merge — rebasing is the merge owner's call, this branch touches only
its five files). Four commits, one per numbered item:

```
e58690b4  item 1: an address that resolves to nothing says so, and a spelling that resolves is corrected
374df859  item 2: Back restores the scroll you left, per history entry
0b265062  item 4: every toggle on the stage reports its state, and says what its state means
1f376376  item 3: the tile's demo is not a tab stop, and the tile has a ring you can see
```

Files changed: `app/src/site/route.ts`, `app/src/App.tsx`, `app/src/site/Stage.tsx`, `app/src/site/Tile.tsx`,
and the new `app/src/site/useScrollRestore.ts`. Nothing else — `Home`, `ItemPage`, `Gallery`, `Compare`, `Rail`,
`Code`, `demo.tsx`, `CommandPalette`, `provenance`, `About`, `styles.css`, `index.html`, `gen.py`, `manifest.json`,
`demos/**`, `docs/**`, `publish.sh` are untouched, and no dependency was added.

Harness: `r3-routes-measure.mjs` (same directory). Before/after JSON: `r3-routes-before.json`,
`r3-routes-after.json`. Run it exactly as its header says: `npx vite build` in `app/`, serve `app/dist` under
`/design-catalog/`, `node r3-routes-measure.mjs --json …`. The *before* numbers were taken from the same harness
against a rebuild of `95ed4720`'s sources in this worktree (checked out, built, measured, restored) — not from a
sibling worktree, which this unit was told not to touch.

---

## 1. An address that does not resolve says so (#9)

### Before

All five addresses rendered `<Home />` — the hero row, the six tiles, "design catalog" — while the address bar
kept the string that had failed. `parseRoute` ended in `return { kind: "home" }`, and for `#/i/<anything>` it
returned `{kind:"item"}` with no `item`, which the switch's `route.kind === "item" && route.item` also dropped
through to the front page.

```
asked                        rendered          address bar afterwards   front page?
#/i/beui/does-not-exist      design catalog    #/i/beui/does-not-exist  yes
#/i/nope/nope                design catalog    #/i/nope/nope            yes
#/about/extra                design catalog    #/about/extra            yes
#/i/beui/dynamic-island/     design catalog    #/i/beui/dynamic-island/ yes
#/i/beui/DYNAMIC-ISLAND      design catalog    #/i/beui/DYNAMIC-ISLAND  yes
```

### After

```
asked                        rendered                                                 address bar afterwards             front page?
#/i/beui/does-not-exist      "There is nothing at #/i/beui/does-not-exist"            #/i/beui/does-not-exist            no
#/i/nope/nope                "There is nothing at #/i/nope/nope"                      #/i/nope/nope                      no
#/about/extra                "About"                                                  #/about                            no
#/i/beui/dynamic-island/     "Dynamic Island"                                         #/i/beui/dynamic-island            no
#/i/beui/DYNAMIC-ISLAND      "Dynamic Island"                                         #/i/beui/dynamic-island            no
```

**Which of the two, and why — per example.** The rule is one sentence: *normalise first, and a canonical redirect
wins whenever the thing the visitor asked for actually exists.*

| asked | exists? | chosen | why |
|---|---|---|---|
| `#/i/beui/does-not-exist` | no | **not-found** | nothing to redirect to. The bar is left exactly as asked, because the page's job is to quote it. |
| `#/i/nope/nope` | no | **not-found** | same, and worse: the *source* is not in the catalogue either, so there is not even a "wrong library" to name. |
| `#/about/extra` | yes, the page | **canonical redirect → `#/about`** | one segment too many on a page that exists is a stale link, not a miss. `parseRoute` drops the extra segment; the bar is corrected so a re-share is clean. |
| `#/i/beui/dynamic-island/` | yes, the item | **canonical redirect → `#/i/beui/dynamic-island`** | a trailing slash is spelling the build never writes. No route writes it, so it is folded away and the bar is corrected. |
| `#/i/beui/DYNAMIC-ISLAND` | yes, the item | **canonical redirect → `#/i/beui/dynamic-island`** | the id is folded for case to *find* it, and the route then carries the manifest's own spelling, so the page and the bar agree on the id that exists. |

### What the code does

`route.ts` gains `kind: "notfound"` with a `Miss`: the address as asked, `item` vs `path`, the source, the slug,
whether the source exists and how many items it has, and ranked `Candidate`s. Normalisation runs *before* the
judgement (trailing slash dropped, item id folded for case, a third segment dropped), and `canonicalHash()` +
`useCanonical()` correct the bar with `history.replaceState(…)` — a redirect that costs no history entry, no new
render, and no back-button trap. `canonicalHash` returns `null` for `notfound` (a miss is its own address),
`home` (`""`, `#` and `#/` are all the front page and none is wrong), `gallery` (a query is its own spelling,
including the keys it reports as ignored) and `concept` (the store's key, printed verbatim).

Candidates are mechanical, never a similarity score, and each one prints the reason it is there:

```
#/i/shadcn/dynamic-island   → Dynamic Island       "the same name, filed under beui"
#/i/beui/dynamic-islan      → Dynamic Island       "a longer name in beui"
#/i/beui/does-not-exist     → 6 items from beui    "one of beui's 110 items"
#/i/nope/nope               → none                 the page names the five sources that are here instead
```

The page (`NotFound`, inside `App.tsx`) prints the address, the sentence that fits the miss, the candidates,
`#/g`, `#/g?src=beui`, and **Search the catalogue** — a button that opens the palette through the palette's own
⌘K/Ctrl+K listener, because its open state is module-private in `CommandPalette.tsx`, which this unit does not
own. Measured: the button opens `[role="dialog"]` (true).

Smoke-tested against every other route shape so the rewrite of `parseRoute` could not quietly break one:

```
""  #  #/  → home      #/about  #/ABOUT → About (canonicalised)   #/chrome → Chrome
#/g  #/g/  #/g?sec=Docs  #/g/src=shadcn → gallery                #/i/shadcn/button → item
#/c/sidebar → concept   #/c/nope-not-a-concept → concept (Compare owns the miss)
#/zzz  #/i/beui → not-found                                       #/g?sec=Nope → gallery, "Nope" unknown
```

---

## 2. Back restores the scroll you left (#11)

### The cause, in one line

`useScrollReset` in `route.ts` sets `.page.scrollTop = 0` on **every** hash change, and Back *is* a hash change.
So the reset won, and the traversal arrived at the top of a page the visitor had walked 4,000 px into.

### The fix: `site/useScrollRestore.ts`, keyed by history entry

Not one saved position — one **per history entry**, because the same grid can be entered three times and the
browser keeps three entries. Each entry gets a small integer id stamped into `history.state`
(`{…state, scrollSid: 7}`, written with `replaceState` against the entry's own URL so it costs no entry); the
offset lives in `sessionStorage` under that id. Going forward saves the outgoing entry and stamps the new one;
`popstate` reads the id the browser restored.

Three rules make it land before anything is painted:

* **a layout effect** — the same frame as the render that builds the page, after `useScrollReset` (which `App`
  calls first) and before paint, so the 250 ms page turn animates a page already at the right offset. The turn
  animates an inner box's opacity and transform, which do not depend on scroll, so restoring during it cannot
  fight it;
* **verify and reapply** across the next few animation frames — an item page can grow after its first frame when
  a demo reports its own height. It stops as soon as the value matches, gives up after five tries, and a delayed
  check at 260 ms (after the turn) catches a page that grew while the turn ran;
* **never yank** — `wheel`, `touchmove` or `keydown` before the delayed check cancels it. The restore is a
  favour, not a position lock.

`window.__scrollRestore` publishes the last result, so the number below is read from outside the code that
produced it.

### Measured — scroll to 4,000 in `#/g?sec=Components`, open the tile at the top of the viewport, press Back

```
                                  before                                      after
cold  (first traversal)   → 0 at 100 ms, 0 settled · error 4000 px    → 4000 at 100 ms, 4000 settled · error 0 px
warm  (the same again)    → 0 at 100 ms, 0 settled · error 4000 px    → 4000 at 100 ms, 4000 settled · error 0 px
third (2,600 px)          → 0               · error 2600 px            → 2600            · error 0 px
390 px (3,000 px)         → 0               · error 3000 px            → 3000            · error 0 px
```

`{captured: 4000, restored: 4000, error: 0, attempts: 1, ms: 0}` — one write, zero tries wasted, and the value
is already back **at 100 ms**, i.e. inside the 250 ms turn rather than after it. The 390 px row is the same hook
on a different scroller: at ≤860 px `.page` is `overflow: visible` and the window scrolls, so `scroller()` measures
which one it is instead of assuming.

---

## 3. Tab walks the page, not the demos (#15)

### Tab order on `#/g` at 1440, from the top of the page column

```
measure                                        before                                   after
stops before the first tile (page column)      button: Show reference-only (283)        button: Show reference-only (283)
the first tile itself                          1 stop (its anchor)                      1 stop (its anchor)
live frames in the grid                        9                                        9
frames whose tabIndex ≥ 0                      9                                        9
frames reachable by Tab                        9                                        0
frames inside `inert`                          0                                        9
frames inside `aria-hidden="true"`             9                                        9
stops inside a demo, first 40 presses          37                                       0
stops that are tiles, first 40 presses         39                                       39
```

The walk after the change, in full: `Show reference-only → tile:beui/availability-scheduler → tile:beui/bloom-menu
→ … → tile:beui/candlestick-chart` — 39 tiles in 40 presses, **no iframe anywhere in it**.

### Why it was wrong, and what was actually broken

`Tile.tsx` wrapped the frame in `<div {...{ inert: "" }} aria-hidden="true">`. React 19 treats `inert` as a
boolean attribute and drops a falsy value — **`""` is falsy** — so the attribute never reached the DOM: measured,
`0` of the 9 live frames had an `inert` ancestor. `aria-hidden` did nothing for the tab order. So Tab went from a
tile's anchor straight into the demo's own document: 37 of the first 40 stops were inside a demo.

One word fixes it (`inert` as a boolean prop). **Reported, not changed:** the brief asks for `tabindex="-1"` on
the *iframe*. That iframe belongs to `DemoFrame` (`site/demo.tsx`, not this unit's file), and the item page
mounts the *same* frame to be interactive — so `tabindex="-1"` and `aria-hidden` on the frame would have to be
conditional on who mounted it, and the attributes belong on the tile's wrapper, which is where they now are.
`inert` is the stronger of the two: it removes the whole subtree from the tab order, from pointer events and
from the accessibility tree, so a demo that later grows its own focusable controls cannot reintroduce the bug.

### The focus ring, measured on a keyboard-focused tile

```
                         before                                                     after
outline                  auto 1px oklab(0.705 0.00415 -0.0144 / 0.5), offset 1px    solid 2px oklch(0.141 0.005 285.823), offset 2px
contrast vs tile (light) 2.62 : 1   ✗ (needs ≥ 3)                                    19.90 : 1   ✓
contrast vs tile (dark)  auto 1px oklab(0.552 0.00439 -0.0154 / 0.5)                 solid 2px oklch(0.985 0 0)
                         3.72 : 1   ✗ (just over, on a ring the UA picks per theme)  16.97 : 1   ✓
:focus-visible           true                                                       true (mouse clicks do not draw it)
```

The ring is 2 px of `var(--foreground)` at `outline-offset: 2px`, on `:focus-visible` only, in the tile's own
style — `styles.css` is not this unit's file, so the ring could not be a stylesheet rule. `--foreground` and not
`--ring`: the base rule paints Chromium's default outline with `var(--ring)` at 50%, which is the 2.62:1 above.
The contrast numbers are computed from the colours the browser actually resolved, painted through a canvas —
`outlineColor` comes back as `oklch(…)`, and a regex over those numbers would read a hue angle as a blue channel.

No `aria-pressed` was added to a tile: it is a link, not a toggle.

---

## 4. Every toggle reports its state (#15, second half)

The brief's premise did not survive contact with this base. Measured on `#/i/shadcn/button`, all ten controls in
the stage bar and both theme-switch mounts:

```
where  role   state attr   before                                   after a click         note
stage  radio  aria-checked true    Preview the demo in light        → false
stage  radio  aria-checked false   Preview the demo in dark         → true
stage  radio  aria-checked false   Phone viewport, 390 CSS pixels   → true
stage  radio  aria-checked false   Tablet viewport, 768 CSS pixels  → false
stage  radio  aria-checked true    Full column width                → false
stage  radio  aria-checked true    Motion on: the demo animates     → false
stage  radio  aria-checked false   Motion off: CSS animation stop…  → true
theme  radio  aria-checked true    Theme: system                    → false
theme  radio  aria-checked false   Theme: light                     → false
theme  radio  aria-checked false   Theme: dark                      → true
```

`role="radiogroup"` on each group, `role="radio"` + `aria-checked` on each item, one tab stop per group (the
checked one) and arrows inside it. Every click moves exactly the states it should: **8 of 10 changed**, and the
two that did not are the ones nobody clicked. Controls whose role implies a state but report none: **0**.

So there was no plain-button toggle on the stage to convert, and adding `aria-pressed` to a single-choice group
would have replaced a correct radio with the wrong control. What a radio *cannot* say by itself is what its state
does, so the motion group now points at the sentence the console prints:
`aria-describedby` → *"CSS motion stopped. Demos that animate with JavaScript keep running."* (before: `null`),
and that sentence is a `role="status"` live region — turning motion off is announced, not merely painted.

**Reported, not fixed:** the one toggle left in the shell that reports no state is the rail's source strip
(`all sources / shadcn / beui / rareui / beautifului / transitions` — a single-select of four-to-six plain
buttons, none of them pressed). It is `site/Rail.tsx`, which the brief puts out of scope.

---

## Guards

```
python3 app/check_chrome.py           exit 0 — "every interactive element is a catalogue component", 18 shell files
page turn (getAnimations)             [{ "duration": 250 }]
console errors (all sections)         0   (the only 404 in the whole run was the scratch server's /favicon.ico)
horizontal overflow                   390 and 1440 × {#/g?sec=…, #/i/shadcn/button, #/i/beui/does-not-exist, #/about}: none
controls under 44 px owned by me      0   (the notfound links/button are ≥44; the tile is a whole card)
controls under 44 px on those pages   pre-existing, other units' files: item page 39 at 1440 (install tabs at
                                      h-8) / 1 at 390, about 3, gallery 1 — listed, untouched
```

## Could not do

* **`tabindex="-1"` on the tile's iframe** as the brief words it — the iframe is `DemoFrame` in
  `site/demo.tsx` (not this unit's file, and the item page needs the same frame interactive). Done instead on the
  tile's own wrapper (`inert`, `aria-hidden`), which is strictly stronger. Reported, not silently substituted.
* **The rail's source strip has no pressed state** — `site/Rail.tsx`, out of scope.
* **A `NotFound` module of its own** — the brief allows exactly one new file, so the surface lives in `App.tsx`.

## Unsure

* Whether `#/i/beui/dynamic-island/x` *should* be the item page. I made "one segment too deep" a stale link
  rather than a miss, for consistency with `#/about/extra`, which the brief names explicitly. If the team would
  rather that be a not-found, it is one line in `parseRoute`.
* Whether `#/zzz` (a path naming no source and no slug) should offer anything. It has no honest candidate, so it
  offers the five sources that exist and the two ways every page has. I did not invent a third list.
