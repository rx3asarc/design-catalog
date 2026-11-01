# r9-scroll — the page says it is dark, and the window scrolls it

Branch `fleet/r9-scroll`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r9-scroll`, base `master`
`ced26e10` ("round 8 wave 2, written down"), served on **8892**:

```
ss -ltnp | grep 8892        → python3 http.server, pid 1505798, cwd /tmp/r9-scroll-serve
grep assets/main /tmp/r9-scroll-serve/design-catalog/index.html
   before: assets/main-OZr2Pjcu.js      after: assets/main-uRB7ly7Q.js
```

Every number below was read from those two bundles with `/tmp/r9-measure.mjs` (Playwright, 1440×900 and
390×844) and `/tmp/r9-switch.mjs` (the switch's own box), each run against the port after confirming the
`index.html` on it named the asset hash of the build being measured.

**Scope note, up front.** Two commits: `0b2c7bf2` (measured — everything in this report except the last
paragraph of §4) and `3a39a932` (read, **not** built and **not** measured — see §8). The lead froze builds,
browsers and gates at 22:23 to unload the box, so **no `qa/*.mjs` gate was run by me this round.** §7 says
which ones my change can move, from the source, and what each one would do.

---

## 1. `color-scheme` — the page now says what it is painted

The theme is resolved on `<html>` by the boot script in `app/index.html` (`class="dark"` toggled,
`data-theme` = the *mode*, `data-theme-resolved` = `dark|light`), and `site/ThemeSwitch.tsx` does not paint
anything itself — it calls that script's `window.catalogTheme.choose()`. So `<html>` is the root, and the rule
is declared there, twice, with the resolved attribute last so it wins:

```css
html { color-scheme: dark; }                       /* the first frame, before the script has run: dark by default */
html:not(.dark) { color-scheme: light; }
html[data-theme-resolved="dark"] { color-scheme: dark; }
html[data-theme-resolved="light"] { color-scheme: light; }
```

`getComputedStyle(document.documentElement).colorScheme`, and the same read on `.cat` (the palette's scope),
`.page`, `.rail-list` and `pre`:

| theme | before (`html` / `.cat` / `.page` / `pre`) | after (`html` / `.cat` / `.page` / `pre`) |
| --- | --- | --- |
| dark, 1440, `#/` | `normal` / `normal` / `normal` / `normal` | **`dark`** / `dark` / `dark` / `dark` |
| light, 1440, `#/i/shadcn/sidebar-09` | `normal` / `normal` / `normal` / `normal` | **`light`** / `light` / `light` / `light` |

It is inherited, which is what makes one declaration enough: `color-scheme` is an inherited property, and
`normal` was the reason a Windows browser drew a *light* scrollbar on a `#09090b` surface and switched the
code blocks' own bars and the `<select>`s inside demos to the light UA palette. The light theme is measured by
clicking the bar's own control (`.theme-switch [aria-label="Theme: light"]`), not by setting a class.

## 2. The window scrolls the page

`.cat` was `height: 100dvh; overflow: hidden` and `.page` was `overflow: auto` inside it, so the **document was
always exactly one viewport tall** and the scrollbar belonged to a box that starts 56 px down the screen,
under the fixed bar. Measured, `scrollHeight / clientHeight`:

| box | 1440 dark `#/` before | after | 390 dark `#/g` before | after |
| --- | --- | --- | --- | --- |
| `document.scrollingElement` | **900 / 900 — cannot scroll** | **4109 / 900 — scrolls** | 844 / 844 | **154 742 / 844** |
| `.page` (`main`) | 4053 / 844 — **its own scroller** | 4053 / **4053**, `overflow-y: visible` | 779 / 779 | 154 677 / **154 677** |
| `.rail-list` (the sidebar) | 1868 / 664 — its own scroller | 1868 / 664 — **unchanged** | — (menu closed) | — |

Light theme, item page: document 900 / 900 → **3700 / 900**; `.page` 3644 / 844 → 3644 / **3644**; rail
1868 / 664 → 1868 / 664.

So after the change there is exactly one scrolling box on a page — `document.scrollingElement` — and the
sidebar still scrolls itself (1868 px of tree in a 664 px column). What moved is only the two rules:

```css
@media (min-width: 861px) { .cat { height: auto; min-height: 100dvh; overflow: visible; align-items: stretch; }
                            .page { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: visible; } }
@media (max-width: 860px) { .cat { height: auto; min-height: 100dvh; overflow: visible; }
                            .page { flex: 0 0 auto; min-height: 0; overflow: visible; } }
```

The bar needed no change: it has been `position: fixed; top: 0; height: 56px` since r6 (`styles.css`, the
TopBar block), which the brief allows ("sticky or fixed"), and `.cat`'s `padding-top: 56px` already reserves
its row. The rail's container needed no change either: the registry makes it `fixed` at `inset-y-0` and r6
restates it as `top: 56px; height: calc(100dvh - 56px)`, so it is already "the sidebar its own scroller" and
it does not care whether the thing beside it scrolls or not. On a phone the bar is `sticky` and stayed at
`top: 0` with `scrollY = 600` (measured: `barTop 0`, `position sticky`), and the Browse menu is a
`position: fixed` sheet at `top: var(--phone-header)` — measured after the change: panel 390 × 670 at y 65,
`--phone-header: 65px`, `position: fixed`, and **14 of 14** rows inside it that were on screen hit their own
row at their centre.

**Back navigation.** Open `#/g`, scroll 1200 px, open `#/i/beui/availability-scheduler`, press Back, read both
boxes:

| | before | after |
| --- | --- | --- |
| where the 1200 px went | `.page.scrollTop = 1200`, `window.scrollY = 0` | `window.scrollY = 1200`, `.page.scrollTop = 0` |
| after Back | `.page.scrollTop = 1200`, `window.scrollY = 0` | **`window.scrollY = 1200`**, `.page.scrollTop = 0` |
| `window.__scrollRestore` | `captured 1200, restored 1200, error 0, attempts 1` | `captured 1200, restored 1200, error 0, attempts 1` |

Honest reading: in the r8 build the *value* was already restored — `site/useScrollRestore.ts` was written in
r8 and it does its job — but it was restored on the wrong box, which is exactly the defect the review names:
the browser's own restoration works on the window, and while the window is a fixed 900 px box nothing about
Back is native, which is why that whole module exists. Now `window.scrollY` is the thing that comes back, and
`useScrollRestore` needed **no edit**: its `scroller()` decides by measuring (`page.scrollHeight >
page.clientHeight`), which is now `false`, and falls through to `window`.

`site/route.ts`'s `useScrollReset` (`hash` → `.page.scrollTop = 0`) is a no-op now and that file is
`r9-search`'s this round, so the same reset is made on the window in `App.tsx`, declared **between**
`useScrollReset(hash)` and `useScrollRestore(hash)` — layout effects run in declaration order, so the reset
still lands first and a traversal's restore still overwrites it in the same frame, before the paint:

```tsx
React.useLayoutEffect(() => { window.scrollTo(0, 0); }, [hash]);
```

The right eventual home for it is `useScrollReset` in `route.ts`; it is a two-line move for whoever owns that
file, and the reason it is not there today is written into `App.tsx` beside the line.

## 3. The painted scrollbars

| selector | before | after |
| --- | --- | --- |
| `.rail-list` | `scrollbar-width: auto`, `scrollbar-color: auto` | **`none`** (`::-webkit-scrollbar { display: none }` beside it) |
| `pre` / `.demo-code pre` | `auto` / `auto` (only a `::-webkit-scrollbar-thumb` colour from r6) | **`thin`**, `rgb(107,107,117) transparent` in dark, `rgb(138,138,148) transparent` in light |
| `.page` | `auto` — a real inner bar | rule retained, **inert** (`.page` no longer scrolls); the window's bar is the UA's, painted by §1's `color-scheme` |
| `.menu-open .rail-phone` | `auto` | `thin`, `border-strong` thumb |

`rgb(107,107,117)` is `--border-strong` in the dark palette and `rgb(138,138,148)` the light one: the bar is
the hairline colour of the surface it sits on, not a new colour, and not the body-text ink. The sidebar's is
hidden because a 769-row tree is its own length cue; the **page's is not hidden** — the review is explicit that
a page with no length cue is worse than a thin dark bar, and with `color-scheme` declared the viewport bar is
now the browser's own thin dark one instead of a light one on a dark page.

## 4. The top bar's theme switch

Two measured faults, one control — and the review's "17 px" is two numbers: **16 px of bar padding + 1 px of
the track's own hairline**.

| | before | after |
| --- | --- | --- |
| track's padding | `0px 0px 0px 8px` | **`0 8px`** (the same inset on both sides) |
| last segment's right edge, inside the track | **1 px** (the track's border was the only gap) | **9 px** (8 px padding + 1 px border, from the measured padding and border) |
| switch box | x 1235, **189** × 46 | x 1227, **197** × 46 |
| switch's right edge from the window edge | 16 px (= the bar's `padding-right`) | **16 px** (unchanged — it is the bar's own padding) |
| picked segment fill | `rgb(24,24,27)` (`surface-300`) on a **transparent** track over `#09090b` | **`rgb(9,9,11)` (`surface-100`) on `rgb(24,24,27)` (`surface-300`)** + a `border-strong` outline |
| picked segment text | `#fafafa`, weight **500** — same as the other two | `#fafafa`, weight **600**; unpicked are `ink-muted` `rgb(161,161,170)`, weight 500 |

That is the design system's own two parts, `surface-100` on a `surface-300` track plus a `border-strong`
hairline, and no new colour. The hairline is an `outline: 1px solid var(--border-strong); outline-offset: -1px`
rather than a `border`, because an outline does not move a box: the segments are still exactly 44 × 44
(measured, all three), so `tap_check`/`mobile_state_check`'s target floor is untouched. The same rules reach
the phone's switch in the Browse menu (measured there: picked `rgb(9,9,11)` on `rgb(24,24,27)`, 44 × 44).

## 5. The "code shown here" badge

Measured on `#/i/shadcn/sidebar-09`, light theme:
`color: oklch(0.48 0.13 150)`, `border-color: oklch(0.63 0.12 150)`, and the tokens read off `.cat` on the same
frame: `--ok: oklch(48% .13 150)`, `--ok-rule: oklch(63% .12 150)`, `--ok-fill: oklch(55% .15 150)`.

So **the badge is already the system's `--ok`**: r8's appended block (`styles.css`, "the badges, on those
tokens") sets `.badge.ok { --badge-ink: var(--ok) }` and `color: var(--badge-ink)` after the r6 literal, and
the painted value is the token's value to three decimals. The r6 literal the review saw is still *in* the file,
one rule earlier, and loses by order — which is why the colour the review measured (`oklch 0.48 0.13 150`) is
now the token's own light value rather than a second green. Nothing was added: a second `--ok` would have been
the fault, not the fix, and the token lives in `styles.css` (line ~1603) and `tokens.css` is not needed.

**Unsure, said plainly:** I did not get a *dark*-theme reading of the badge. The item page is a lazy chunk and
my dark probe read the page twice before it had rendered (`badge: null` both times, and the same probe read the
page as 844/844 tall, i.e. the wait line). The cascade is the same in both themes and dark's `--ok` is
`oklch(0.78 0.15 150)`, but that is an inference from the light measurement and the rule order, not a reading.

## 6. The design system contradicts itself about headings — what I found, and which side loses

The brief's premise does not match this tree, and the difference matters:

* `app/src/tokens.css:73-86` (**prohibited, read only**) sets `.dc-display` (36/40), `.dc-heading` (24/32) and
  `.dc-title` (18/28) in **`var(--font-sans)`** — Instrument Sans. Only `.dc-label` (12/16) and `.dc-code`
  (13/20) are `var(--font-mono)`. The tokens are **not** the mono side.
* The site renders its headings in Instrument Sans: no `.title` rule in `styles.css` names a `font-family`
  (checked, `grep -n "\.title" | grep -i font` returns only size/weight/tracking), so a 30/36 `h1.title` /
  `h2.title` inherits `--font-sans` from `body`, measured as `"Instrument Sans"`.
* The vendored file's header lists three deliberate differences from the brand book and **none of them is a
  typeface**, so the brand book (which the r6 report quotes as "`display` … `title` … in JetBrains Mono") and
  the tokens disagree — and the *tokens* are the side the site agrees with.
* The only place in the repo that states the mono claim is `docs/redesign/r6-design-system.md:32-33`, a build
  report; `docs/**` is prohibited for this unit (and its source, `/root/docs/catalog-redesign/build/…`, is not
  mine either).

**Settled, and why:** headings are Instrument Sans; JetBrains Mono is labels, counts and code. The reason is
not taste: that is what the site paints at 30 px today, and the brief's rule is "pick the one that matches what
the site actually renders" — a system that says mono while the page sets sans is a system whose next unit
"fixes" the headings and moves every page. `tokens.css` already agrees, so **no change is needed to it**.

**What I could not do:** fix the loser. The wrong side is prose in `docs/redesign/r6-design-system.md` and
`docs/**` is prohibited. The change I would make, for whoever owns that file:

```diff
-- type: `display` 36/40, `heading` 24/32, `title` 18/28, `body` 15/24, `small` 13/20, `label` 12/16 in
-  JetBrains Mono, `code` 13/20. Page titles use `display` at 30/36, …
++ type: `display` 36/40, `heading` 24/32, `title` 18/28, `body` 15/24, `small` 13/20 in Instrument Sans;
++ `label` 12/16 and `code` 13/20 in JetBrains Mono (tokens.css:73-86). Page titles use `display` at 30/36, …
```

I also did not add the one-line comment recording the decision in `styles.css` (the file that maps jobs to
steps, whose header says it is where the "one rule" lives). It was written and then dropped when the lead
froze builds at 22:23 — a comment cannot change a measurement, but the rule was "report only", so the decision
is recorded here instead. Say the word and it is a comment-only diff.

## 7. Gates: not run, and what they would do

No gate was run by me this round (frozen). Reading them, the change can move exactly one assertion, and one
line of it is now superseded:

* **`qa/r2_check.mjs:215`** — `const scroller = document.querySelector(".page") ?? document.scrollingElement;`
  then `scroller.scrollTop = scroller.scrollHeight`. `.page` exists and no longer scrolls, so that write is now
  a no-op and the "no fixed strip covers the grid" check (390 / 600 / 768) never moves the page between its
  `mid` and `end` readings. It will still *pass* — the two readings then describe the same frame — which is the
  quiet kind of gate failure. The fix, if the lead wants it: `const scrollToEnd = () => { const p =
  document.querySelector(".page"); if (p && p.scrollHeight > p.clientHeight + 1) p.scrollTop = p.scrollHeight;
  else window.scrollTo(0, document.scrollingElement.scrollHeight); }`. I did not touch it: it is not one of the
  three files my brief names, and editing a gate blind is worse than reporting it.
* **`float_check.mjs`** — unaffected by design: it allows `header.topbar` and `[data-slot="sidebar-container"]`,
  and I added no `fixed` element (the bar and the rail were already the only two).
* **`mobile_state_check`, `tap_check`, `rail_density_check`** — these encode the *phone* shell: the 44 px
  target floor, the menu panel's own scroll and its `--phone-header` offset. The bar is still `sticky` at
  `top: 0` and the menu is still `position: fixed` below it (measured: 390 × 670 at y 65, 14/14 rows hit their
  own row), and no control changed size (all three switch segments still 44 × 44, outline not border). I expect
  them green, but "expect" is not a measurement and the lead is running them.
* **`contrast_check`** — the badge pair is unchanged (same tokens); the switch's new picked fill is
  `surface-100` behind `ink` text, the strongest pair the system has, but no gate reads it: nothing asserts the
  *selected* segment's contrast. If it should, `contrast_check` is where it belongs.
* The rest (`smoke r2_check gallery_check stage_check slice3_check pick_line_check type_page_check hero_check
  card_check demo_theme_check foundations_check taxonomy_check`) do not read the scroll container, the
  `color-scheme`, or the switch's fill as far as I can read them.

## 8. The second commit, and what it is worth

`3a39a932` is **read, not measured**, and it is not in the bundle the numbers above came from. `.pager`
(`styles.css:315`) and `.page-in > .related-pager.pager-top` (r8) are both `position: sticky; top: 0`, which
used to mean "0 inside the page column" — i.e. 56 px below the viewport's top edge, because `.page` began under
the fixed bar. With `.page` no longer a scroll container the nearest scrollport is the viewport, so `top: 0`
would pin both pagers **under** the bar (bar z 20; pagers z 5 and z 6). The commit restates `top: 56px` at
`min-width: 861px` and nothing else, and it is flagged here rather than described as verified. `stage_check`
asserts the pager's `position` and `top` computed values, not the painted overlap, so a gate will not catch this
either way.

## What I could not do, and what I am unsure about

1. **No gate run**, per the lead's freeze — §7 is reading, not measurement.
2. **The badge's dark-theme colour** — §5, inferred from the light reading and the cascade, not measured.
3. **The mono/sans contradiction's loser is in `docs/**`**, prohibited; the diff is in §6 and needs a decision.
4. **The switch's selected-state contrast is not gated** by anything; the pair is `surface-100`/`ink` with a
   `border-strong` outline, chosen from the system's parts, not measured against a threshold.
5. **`useScrollReset` still resets a box that no longer scrolls.** The window reset lives in `App.tsx` because
   `route.ts` belongs to `r9-search`. It works (proved above) but it is in the wrong file; moving those two
   lines is a follow-up for that unit, not a defect now.
6. **`.page`'s `scrollbar-color` rule is inert.** Kept rather than deleted because deleting it and rebuilding
   was the one thing I was told not to do; the window's bar is painted by `color-scheme` (§1, §3).
