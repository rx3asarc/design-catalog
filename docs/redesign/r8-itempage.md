# r8-itempage — the page where a visitor decides

Unit **r8-itempage**, branch `fleet/r8-itempage` off `master` = `16d334bd`, own worktree
`/mnt/HC_Volume_105573741/design-catalog-site-r8-itempage`. Six things the review asked for on the item page:
one pager, title → preview → install → the rest, one accent fill, a demo document that owns its theme, badge
colours as tokens, and an `<h1>`.

| | |
| --- | --- |
| after | this branch, `npx vite build`, served at `http://127.0.0.1:8884/design-catalog/` — asset hash **`main-BaY-tCRJ.js`** (`ss -ltnp` confirms `127.0.0.1:8884`, and `curl -s …/index.html` names that hash) |
| before | `master`'s committed `docs/` build, served at `http://127.0.0.1:8830/design-catalog/` — hash **`main-BeV_SNHD.js`** |
| browser | Playwright from `/root/camofox-browser/node_modules/playwright`, `/usr/local/bin/google-chrome`, `--no-sandbox --disable-dev-shm-usage` |
| route measured | `#/i/beui/dynamic-island` (demo + install + all three consoles) at 1440×900, plus 390×844; `#/i/beui/animated-sidebar` for the gates |

Nothing in the prohibited set was touched: no `app/gen.py`, `app/manifest.json`, `app/src/tokens.css`,
`docs/**`, `publish.sh`, `master`, `taxonomy.json`/`.ts`. The new CSS is one appended block at the foot of
`app/src/styles.css`, headed `/* ---- item page, reordered (r8) ---- */`; no existing line of that file changed.

---

## 1. Order: title → preview → install → the rest

Measured as **document position**, not as pixels and not by eye: `stage_check.mjs` compares the three elements
with `Node.compareDocumentPosition` and asserts `h1 < stage < install < facts` (output: `h1<stage=true
stage<install=true install<facts=true`). The `y` column below is the same fact in the other currency, and it is
what the review quoted.

| before (master, `main-BeV_SNHD.js`) | y | after (this branch, `main-BaY-tCRJ.js`) | y |
| --- | ---: | --- | ---: |
| pager (86 px, static) | 88 | **pager (57 px bar, sticky)** | 88 |
| crumb | 190 | crumb | 157 |
| `h2.title` | 226 | **`h1.title`** | 193 |
| lede | 270 | lede | 237 |
| badges | 342 | **stage — canvas + console** | **309** |
| facts table | 390 | `h2` Installation | 723 |
| licence line | 653 | **install block (107 px)** | **767** |
| **install block** | 753 | measured line `[data-pick]` | 890 |
| **stage** | 876 | badges | 890 |
| **pager, second copy** | **2069** | facts table | 938 |
| | | licence line | 1201 |

The preview moved from y=876 to y=309: it is now the first thing under the title instead of the fourth thing
under a licence and a command. The whole page also got shorter — the second pager and the two blocks that moved
up are gone from the bottom.

The console moved **into the canvas**, in its top-right corner: `.stage-canvas` is one hairline box on
`surface-100`; `.stage-console` is a right-aligned row inside it (measured right edge 9 px inside the canvas
edge, 1373 of 1382), the demo card fills the canvas underneath it (card 1034 px inside a 1036 px canvas, flush to
the bottom edge), and the console draws no box of its own — three nested rectangles around one preview is not a
`PreviewCanvas`. On a phone the row wraps to two lines (100 px of controls), stays right-aligned on both lines,
and every target in it is 44 px.

Heading outline on the item page, measured by walking `h1…h4`: `H1 Dynamic Island`, `H2 Installation`,
`H2 Source files (12)`. It was `H2` + nothing before. Getting there needed one small prop: `Files` in
`Code.tsx` now takes `heading?: "div" | "h2"` and defaults to the `div` it always rendered, so the type and
comparison pages keep their own (unchanged) outline and only the item page publishes one.

## 2. One pager — and it is the top one

* `.related-pager` count on the page: **2 → 1** (`stage_check`: `r8 one pager: 1 pager(s)`).
* `position` of the survivor: **static → sticky**, `top: 0px`, inside the column's own scroller, at y=88.
* It is pinned as **one 44 px row** (bar 57 px including its hairline and 6 px of padding), not the 86 px
  two-card block: the cards keep their surface and hairline and lose only their flow metrics, inside the pager
  only.
* At **≤860 px** the relation line is not printed at all: `2 relation line(s), 0 shown`, card heights `[44,44]`,
  page `scrollWidth 390/390`. The relation survives in the link's accessible name — measured:
  `aria-label="Previous: Availability Scheduler — same category"`.

## 3. One accent fill on the page

Every element on the page whose painted `background-color` equals the resolved `--accent` (walked in the DOM,
sized elements only, printed with its label):

| build | `--accent` | elements painted with it |
| --- | --- | --- |
| before | `rgb(124, 45, 255)` | 1 — `button` "Copy install command" (y=762) |
| after (dark) | `rgb(124, 45, 255)` | 1 — `button` "Copy install command" (y=776) |
| after (light) | `rgb(106, 31, 224)` | 1 — `button` "Copy install command" |

The same walk on `#/i/shadcn/sidebar-16` gives 1 in both builds. So the review's four accent fills were not on
the item page as master builds it: the rail's `AUTO` is a rail control, and a rule from round 7
(`[data-stage-bar] [data-slot="toggle-group-item"][data-state="on"]` → `surface-300` / `ink`) already covered the
stage's *selected* segments. What this unit adds is the rest of the state set and a gate:

* resting and hover segments: `transparent` / `ink-muted` → hover `surface-300` + `ink` (measured: unselected
  `rgba(0,0,0,0)` + `rgb(161,161,170)`; selected `rgb(24,24,27)` + `rgb(250,250,250)` + `font-weight 600`);
* the group track's edge is `border-strong` (`rgb(107,107,117)` dark / `rgb(138,138,148)` light), on `surface-200`;
* `stage_check.mjs` now asserts **exactly one** accent-painted element, that it is inside `.install-block`, and
  that every selected console segment is `surface-300` + `ink` + weight ≥ 600 — three consoles, twelve controls.

The review said `AUTO` too. `AUTO` lives in the rail (`site/Rail.tsx`), which is `r8-rail`'s surface, not this
one; nothing here paints it and nothing here un-paints it.

## 4. The demo document owns its theme now

Read **inside the child**, in its own frame, both themes (`stage_check` r8 assertions + a one-off probe):

| | before (master) | after |
| --- | --- | --- |
| `<html>` class, site dark | `dark` | `dark` |
| computed background of the child's `html` | `rgba(0, 0, 0, 0)` | `oklch(0.141 0.005 285.823)` = its own `--background` |
| computed background of the child's `body` | `rgba(0, 0, 0, 0)` | `oklch(0.141 0.005 285.823)` |
| computed background of `#root` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` (unchanged — the layout root is not the canvas) |
| `document.documentElement.style.colorScheme` | *(unset → `normal`)* | `dark` |
| site light | class `light`, all three backgrounds transparent, `colorScheme` unset | class `light`, `html`/`body` `oklch(1 0 0)`, `colorScheme: light` |

Four things changed at the consumption point (`app/demo.html` + `app/src/demo-main.tsx` +
`app/src/site/demo.tsx`): the document no longer ships `class="light"`; a head script resolves the theme
**before the first paint** from the address (`theme=`), then the parent's `<html class="dark">`, then the OS;
`html, body` paint `var(--background)` instead of `transparent`; and `color-scheme` is set to the resolved theme,
so the UA's own surfaces (scrollbars, form controls, the base canvas) follow it. `applyFlags()` keeps it in
sync on every flag change, and the frame's iframe style says `color-scheme: <theme>` too.

**What I could not reproduce — and did not claim.** The review's "Dynamic Island is a white panel in dark mode,
so the white pill disappears" does not reproduce as a *canvas* on master's build: cropping the frame's rendered
pixels, the demo paints `#08080a` in both builds, because the transparent child root let the parent's dark paper
show through. What is white, in both builds, is the island's **own panel** — 126×37 px, `bg-foreground
text-background` at `app/src/components/motion/dynamic-island.tsx:171` — i.e. the exhibit inverting with the
theme on purpose. That file is catalogue source and out of bounds for this unit. So: the demo document now
carries and paints the site's resolved theme (measured, per theme, above), and the one white panel on it is the
exhibit's own design, not a theming failure of the shell.

## 5. Badge colours are tokens

`--ok`, `--warn`, `--danger` + `-rule` (hairline) and `-fill` (the 6 px dot) in the appended r8 block, declared
four times for the same reason `tokens.css` declares its palette twice — the chrome lives in `.cat` (dark by
default, light under `html:not(.dark)`) and the demo document lives in `:root`/`.dark`. Measured on the page:
"code shown here" = `oklch(0.78 0.15 150)` = `--ok` with border `oklch(0.45 0.1 150)` = `--ok-rule` in dark, and
`oklch(0.48 0.13 150)` / `oklch(0.72 0.1 150)` in light. "code not shown" = `--warn`. The literals
(`oklch(0.65 0.16 150)` green, `oklch(0.72 0.15 80)` amber, and `oklch(0.55 0.14 150)` at r6's line 190) are no
longer read by anything.

`qa/contrast_check.mjs` **did not exist in the tree** — `git log --all -- qa/contrast_check.mjs` is empty on
every branch, even though the r7 note in `styles.css` cites "32/32". So this unit writes it: 32 baseline pairs
(4 ink steps × 4 backgrounds × 2 palettes) + 18 new pairs for the status hues (3 × 3 surfaces × 2 palettes).
It measures **painted** colours — each token resolved through a throwaway element, then composited in a canvas
and read back as sRGB bytes — not the declarations, because three token tables and a `color-mix()` stand between
the file and the pixel.

```
CONTRAST: ok — 50/50 at 4.5:1 (32 baseline, 18 status)
```

| pair | dark | light |
| --- | ---: | ---: |
| `--ok` on `--surface-100` / `-200` / `-300` | 10.54 / 9.99 / 9.38 | 6.15 / 5.89 / 5.59 |
| `--warn` on `--surface-100` / `-200` / `-300` | 11.23 / 10.65 / 10.00 | 6.13 / 5.87 / 5.58 |
| `--danger` on `--surface-100` / `-200` / `-300` | 7.44 / 7.05 / 6.62 | 7.20 / 6.89 / 6.55 |

The `-rule` and `-fill` partners are graphics (a hairline, a 6 px dot) and are printed rather than gated; the
gate prints all twelve with their ratios so a re-tune is visible without a passing failure.

## 6. The `<h1>`

`<h2 className="title">` → `<h1 className="title">`; `stage_check` asserts exactly one `h1` and `0 h2.title`. It
keeps the 30/36 display step (`.page-in h1`), -0.02em tracking and the same bottom rhythm, and drops to 26/32 on
a phone. Comparison and type pages keep their own levels.

---

## Gates

Run against `http://127.0.0.1:8884/design-catalog/` after the final `npx vite build`:

| gate | result |
| --- | --- |
| `smoke.mjs` | `SMOKE: all routes ok` — 12 cells, 1440 and 390 |
| `r2_check.mjs` | `R2: ok` (hero, gallery links, no build note, **no console errors anywhere in this run**) |
| `tap_check.mjs` | `TAP: ok` — 0 controls under 44 px on a phone, 10 on desktop, none failing |
| `stage_check.mjs` | `STAGE: ok` — 9 original assertions + **8 new r8 ones** |
| `contrast_check.mjs` | `CONTRAST: ok — 50/50 at 4.5:1 (32 baseline, 18 status)` |
| `mobile_state_check.mjs` | `STATE: ok` — no type under 12 px, no target under 44 px, stage widths 390/768/full |
| `pick_line_check.mjs` | `PICK: ok (10 measured, 3 unmeasured, 3 measured-no-demo)` — run 3× after its own fix, green each time |
| `float_check.mjs` | `FLOAT: ok` |

Two of those gates had to change, and both changes are stated where they live rather than hidden here:

* **`pick_line_check.mjs` rule 5** said "it is not the first Copy: the page's first Copy control is still `Copy
  install command`". Under the order this brief mandates — preview *before* install — that is no longer true and
  must not be: the demo card's "Copy demo source" comes first. The rule now asserts the property that still
  matters: the first Copy control **after the preview** is `Copy install command` (measured: `"Copy install
  command", 3 copy controls (1 in the preview)`), the measured line prints after it, and the line is not itself a
  Copy. Its rule 6 hit test also had to move: with the install block now below the fold on a tall item, the old
  sample point (`min(top + h/2, innerHeight - 1)`) landed on the *next* card and reported "covered" for a block
  nothing was covering. It scrolls the block into view first and hit-tests its true centre; the numbers above
  rule 6 in that script are still the un-scrolled readings.
* **`stage_check.mjs`** gained the eight r8 assertions (h1, document order, one pager, sticky-at-top, one accent
  fill, neutral console segments, demo root carries the theme in both themes, and the 390 px relation-line row).

**Duplicate selectors.** Six selectors are declared both before and after the r8 marker; grepped after every
patch, as asked:

| selector | why it is safe |
| --- | --- |
| `.dark`, `.cat` | token blocks: the appended ones declare only `--ok/--warn/--danger` (+ `-rule`, `-fill`); no property is redeclared |
| `.badge.ok`, `.badge.warn`, `.badge.bad` | intentional override of r6's literals; later in an unlayered file, so it wins without `!important` — proved by measurement (the painted colours are the tokens) |
| `.badge.ok, .badge.warn, .badge.bad` | the same override's `color`/`border-color` |
| `.badge.ok::before, .badge.warn::before, .badge.bad::before` | the same override's dot |

No other selector from the appended block shadows an earlier one: `.pager-top`, `.stage-canvas`,
`.stage-console`, `.stage-console-bar`, `.page-in h1.title`, `[data-stage-bar] [data-slot="toggle-group"]` and
the resting/hover segment rules are new.

## One more thing that had to move (found by measuring, not by reading)

`.stage-console-bar` had a `<span style={{ flex: 1 }} />` spacer between the controls and the motion-off note,
left over from when the strip ran left-to-right. In a right-aligned console it defeats `justify-content:
flex-end` on every *wrapped* line: it eats the line's slack, so the line starts at the left edge. Measured at
390 px before removing it: line 1 right-aligned at x=112, line 2 stuck at x=23. It is gone; the note is still
after the controls, and both lines now end at the canvas's own right edge.

---

## COULD NOT DO

The Dynamic Island's white panel. It is the exhibit's `bg-foreground text-background` on its own pill
(`app/src/components/motion/dynamic-island.tsx:171`) — catalogue source, forbidden to this unit. The shell side
of the complaint (the demo document not owning or painting its theme, and shipping `class="light"`) is fixed and
measured above.

## UNSURE

Two review findings I could not reproduce on master's build, so I fixed the mechanism rather than claim the
symptom: (a) "four controls are accent-filled" — the item page paints exactly one accent element on
`main-BeV_SNHD.js` (the install Copy), and `AUTO` is a rail control outside this unit; (b) "white panel in dark
mode" — the demo's rendered pixels are `#08080a` in both builds. If the reviewer saw a build older than master's
`docs/`, both could be real there; what I can prove is the before/after above.
