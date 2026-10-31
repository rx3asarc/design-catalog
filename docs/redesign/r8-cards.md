# Unit r8-cards — the grid's cards and canvases, and the two Foundations surfaces

Branch `fleet/r8-cards`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r8-cards`, base `master` @
`02c0eba7`. Build served on 8895 (`assets/main-4jDNdlNA.js` at the time of the measurements below); the
comparison builds are the published pre-fix build on 8893 (`assets/main-BeV_SNHD.js`, `docs/` of `0b08c144`)
and master's own build on 8830.

Four review complaints, four changes:

| # | Complaint | Where |
|---|---|---|
| 1 | cards print a stats line, not a description | `site/Tile.tsx` (`CardText`), `styles.css` (§ r8b) |
| 2 | 283 items have no demo and the card doesn't say so | `site/Tile.tsx` (`RefCard`, `NO_DEMO`, `noDemoSentence`) |
| 3 | demos render white in the dark grid | `site/demo.tsx` (frame paper) — the document half of the fix landed in r8-itempage and is now gated |
| 4 | fonts and themes aren't shown as what they are | `site/specimens.tsx` (new), `site/foundations.json` (new), `site/TypePage.tsx` |

---

## 1. Card height spread, before and after

Measured on `#/g`, every card in the default grid (`[data-tile] > card`), the same routine as before:

```
            before (main @ 02c0eba7)      after
1440        486 cards · 275.9–275.9 px    486 cards · 339.0–339.0 px     spread 0   → 0
 390        486 cards · 247.9–247.9 px    486 cards · 309.0–309.0 px     spread 0   → 0
```

The spread did not grow: it is **0 px at both widths**, as it was. What changed is the card's fixed lower block,
which went from ~65 px (name + mono facet line) to 127 px (provenance eyebrow 16 + name 35 + description 54, two
4 px gaps, 6/8 px padding):

```
    16  provenance   source · licence, mono 12/16, ellipsised, never wrapped
     4
    35  name         2 lines of 17.5, clamped
     4
    54  description  3 lines of 18, clamped — the clamp draws the "…"
     6 / 8 padding
```

Cost of the description: **+63 px per card**, so the gallery page is 46 345 → 56 569 px tall (+22 %). That is the
honest price of putting a sentence under every title; the alternative was cutting the sentence to one line, which
would have cut 97 of the 131 descriptions in this manifest.

Why three lines and not two (measured, 357 px card, 13/18): of the 131 cards that publish a description, the
sentence needs 1 line for 34, 2 for 36, 3 for 33, 4 for 18, 5 for 5, 6 for 4, 7 for 1. Two lines show 70 of 131 in
full — half the grid cut mid-sentence. Three shows 103, and the other 28 end in an ellipsis. Beyond three, the
empty slot (355 of the 486 cards publish no description at all) costs more than the sentence it buys.

The numbers the card used to print (`kind · files · type`) are not lost: the item page already carries them — the
crumb prints `source · kind`, and its fact table prints Licence, Files, Size, Parts, Dependencies, Used here.

## The description is read, never generated

`item.one_line` verbatim or an empty slot. Nothing is synthesised when the manifest is silent: 131 of 486 demo
items have one (355 have none — 73 %). The card still prints the item's provenance in that case, so the block is
not blank; the description slot is simply empty. `qa/card_check.mjs` asserts, per card, that the rendered sentence
equals the manifest's (or that there is none) — 0 wrong at 1440 and at 390.

Truncation: every text slot is clamped (`-webkit-line-clamp`, which is the only thing here that ends a cut line
with an ellipsis) or ellipsised (`text-overflow` on the one-line provenance). The gate measures each slot's natural
height with a detached clone — a grid item's own `height: auto` is its track, not its content — and fails if
anything overflows without a clamp. 28 descriptions are cut at 1440, 28 at 390, all ending in `…`.

## 2. The no-demo card

```js
NO_DEMO = {
  withheld: "No demo for this one — the licence does not allow us to republish the code.",
  absent:   "No demo for this one — it is a helper or a doc, not a component.",
}
```

Words chosen, and why:

- **"No demo for this one"** — the item page's own sentence, cut to its first clause. It says the fact in a
  sentence, at reading size, in the canvas where the demo would have been. The old card printed a mono kicker
  `no demo` — a label, in the same visual weight as the facet tokens it sat beside, which reads as a status badge
  rather than as the page speaking. A card that cannot show the thing must *say* it, not stamp it.
- **"for this one"** rather than "no demo": the absence is a property of the item, not of the site. It also
  survives being read next to 283 identical neighbours without turning into an alarm.
- **the licence clause only when it is the reason.** 93 of the 283 are `withheld` (the licence forbids
  republication) and 190 are helpers/docs. Printing one sentence for both would be a lie about 190 items and would
  hide the licence fact for the 93. The card is a link to the item page (44 px), and the outbound library link is a
  second line ("Read it on beui.dev ↗") so the absent code is one click away.
- Nothing is shouted, nothing is a decorative badge, and the dashed reference-card rule stays — it is a different
  object in the grid, not a disabled one.

Gated: `qa/card_check.mjs` opens `#/g?ref=1`, finds 283 `[data-no-demo]` cards, asserts 93 print the licence
sentence and 190 the helper/doc sentence, that each card's reason matches the manifest's `withheld` flag, and that
no card prints the bare label `no demo`.

## 3. Demos in the dark grid

The mechanism already existed for the item page (r8-itempage: `app/demo.html`'s pre-paint boot script resolves the
theme from the frame's own address → parent `<html>` class → `prefers-color-scheme`, and its inline rule is
`var(--background)`; `demo-main.tsx#applyFlags` keeps it in step). Two things were still wrong at the consumption
point, and they are what the eye reports as "white":

1. **The demo document was transparent** (`html,body{background:0 0}`) and carried `class="light"` in its markup,
   so before its module arrived — a late chunk, a demo whose module threw, the first paint — the canvas was the
   UA's white. That half was fixed in the item-page round; this round **measures and gates it**, and the numbers
   below are the before/after.
2. **The frame element itself was `background: transparent`** (`site/demo.tsx`), so the paper under a demo was
   whatever happened to be behind it — the catalogue's own `--surface-300`, not the demo's theme. It is now
   `FRAME_SURFACE[addr.theme].ink` (the one table the stage already paints with; `transparent` is kept only for
   pre-r8 addresses with no theme, so nothing regresses there).

### Computed background of the four demo roots, light and dark, before and after

Four named exhibits; all four are identical in every column, because the mechanism is shared — which is the point:
the review named four, the fix is one. Measured with the demo's own module graph aborted (`**/assets/*.js` →
abort), i.e. the state a slow or failed chunk leaves on screen, and then again with it running.

```
                          BEFORE (8893)                                  AFTER (8895)
                  html / body            painted        html / body                painted
BLOOM MENU
  light           transparent            #ffffff        oklch(1 0 0) → rgb(255,255,255)     #ffffff
  dark            transparent            #ffffff        oklch(0.141 0.005 285.823) → rgb(9,9,11)  #09090b
COMMAND PALETTE
  light           transparent            #ffffff        rgb(255,255,255)           #ffffff
  dark            transparent            #ffffff        rgb(9,9,11)                #09090b
EXPANDABLE TABS
  light           transparent            #ffffff        rgb(255,255,255)           #ffffff
  dark            transparent            #ffffff        rgb(9,9,11)                #09090b
ADAPTIVE STEPPER
  light           transparent            #ffffff        rgb(255,255,255)           #ffffff
  dark            transparent            #ffffff        rgb(9,9,11)                #09090b
```

Before: `html.class="light"` in **both** themes before the module runs, `color-scheme: normal`, `html` and `body`
both `rgba(0,0,0,0)` — the dark grid got a white panel for as long as anything was late, and after the module ran
the document was *still* transparent (the theme only ever reached the demo's inner tokens). After: the document
paints its own paper before the first paint in both themes (`color-scheme: light` / `dark`), and with the module
running `html`/`body` are opaque in both.

The frame element (`#/i/<id>`, dark and light): before `rgba(0,0,0,0)` (luminance −1, "transparent" — the page
behind decided), after `rgb(9,9,11)` / `rgb(255,255,255)`. Gallery sweep in dark theme: before **57 of 57** live
frames transparent; after **72 of 72** opaque, lightest luminance 0.003.

Gate: `qa/demo_theme_check.mjs` (A: pre-module paint, B: live `html`/`body`, C: the frame element on all four item
pages, D: every live frame in the dark gallery under a real scroll). 0 failures after; **21 failures** on the
pre-fix build.

## 4. Foundations: specimens and swatches

Both are row kinds of the existing collection surface — `site/TypePage.tsx` still owns the page, the taxonomy still
owns the addresses, no page was forked.

**Fonts** (`FontSpecimens`, 52 rows): the family name set at 40 px as the specimen, with one mono meta line
(`source · licence · self-hosted|not self-hosted`).

- 4 rows can be *the face itself*: `font-instrument-sans`, `font-heading-instrument-sans`,
  `font-jetbrains-mono`, `font-heading-jetbrains-mono` — two families, each with a heading cut. Those are the only
  two binaries this build has (`app/public/fonts/`, OFL-1.1, `LICENSES-FONTS.md`, `@font-face` in `styles.css`).
  Verified by computed `font-family` per row, not by eye.
- The other 48 rows are registry items with **no binary in the catalogue** — the manifest carries their
  declaration, never the font. They are set in the interface face and their meta line says `not self-hosted`. A
  specimen drawn in the wrong face would be a picture of a typeface that does not exist; the page states that once,
  in its lede, instead of 48 times in 48 paragraphs.

**Themes** (`ThemeSwatches`, 5 palettes): every colour variable the theme file declares, light and dark side by
side, each chip painted with the value it claims. The values come from the catalogue's own snapshot store
(`artifact` rows of kind `cssvars` for `ui.shadcn.com/r/styles/new-york-v4/theme-*.json`), extracted once into
`site/foundations.json` — nothing sampled from a screenshot, nothing invented. Non-colour declarations (`radius`)
are printed as values, not painted. Each theme's facts line names the file it was read from.

The two remaining `Themes` members are not palettes — `beui/theme-toggle` and `rareui/theme-selector` are components
that switch a theme. They stay in the ordinary list underneath, where the toggle's live demo still runs.

### Node cost

```
                                    before (8830)   after (8895)
#/t/foundations/fonts                452 nodes       402 nodes     (52 rows → 52 specimens; the "no demo" cells cost more than a specimen row)
#/t/foundations/themes               233 nodes      1207 nodes     (5 palettes × (32 light + 31 dark) = 315 swatches; ≈3.1 elements each)
fonts page height                   3746 px         4170 px
themes page height                   900 px         3818 px
```

Measured swatch labels: 0 of 315 clipped at 1440, 1024 and 390 (they wrap on their own hyphens rather than being
ellipsised — a truncated variable name is misinformation). Both surfaces at 390: no horizontal overflow, nothing
under 12 px, nothing tappable under 44 px, no console errors.

## Gates

All on 8895, this build, after the last patch:

```
smoke  ok      r2_check  ok      tap_check  ok      gallery_check  ok      mobile_state_check  ok
contrast_check  ok 50/50 at 4.5:1      float_check  ok      type_page_check  ok
hero_check  ok      taxonomy_check  ok      python3 app/check_chrome.py  ok (28 shell files)
qa/card_check.mjs  ok          (new — claims 1 and 2, 1440 + 390 + ref=1)
qa/demo_theme_check.mjs  ok    (new — claim 3, 4 sections, 21 failures on the pre-fix build)
qa/foundations_check.mjs  ok   (new — claim 4, both surfaces + 390 rules)
```

Only change to an existing gate: `qa/type_page_check.mjs`'s `REPO` pointed at the sibling worktree
(`…-r8-collections`) and could not run here; it now points at this worktree, which carries the same
`manifest.json` and `taxonomy.json` (this unit edits neither).

## Judgement calls and things worth knowing

- **The eyebrow is above the name, not under the description.** 355 of 486 cards have no description; with the
  provenance last, those 355 cards opened a 54 px hole between the name and the meta line and a row of holes read
  as a grid that had come apart (a fresh-eyes visual pass flagged it as MAJOR). Provenance first, name second,
  description third puts the same two lines in the same place on every card; a card with nothing to describe just
  ends earlier inside a block whose height has not moved. Height, and therefore the spread, is unchanged.
- **The card carries `source · licence`, not file counts.** A licence is a fact a reader choosing between five
  libraries needs; `21 files` is not.
- **The description is a fixed slot even when empty.** That is the price of a uniform grid, paid knowingly: the
  card is 63 px taller than before and 355 of them spend 54 px of it on nothing. The alternative — content-sized
  cards — grows the spread, which the review also forbade.
- **48 font rows cannot be shown in their own face.** Not a styling choice: the catalogue ships two font binaries
  and 26 registry declarations. Faking the remaining 24 families would be the one thing this surface must never do.
- Untouched, per the brief: `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`,
  `master`, `app/src/site/taxonomy.json`, `taxonomy.ts`, `typeIndex.ts`. Nothing outside this worktree was edited
  (the report you are reading lives outside the repo).
- No new dependencies; no `npm install`; `app/node_modules` stayed the shared symlink.
