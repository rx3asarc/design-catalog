# r2-shell-small — the five small things

Branch `fleet/r2-shell-small`, base `master` @ 38dada04. Four commits, one per item (item 5, the home page's
numbers, is another unit's and was not touched).

```
f56f6f92 provenance: the tag is a property of the Chrome page, not of the site
310b4108 rail: a section with one category is that category — collapse it in the tree
577d42fc rail: pluralise a family key by table and suffix rule, not by appending s
cb0432a1 theme switch: a lane, not a corner — the pill cannot cover a card on a phone
```

Files changed, all of them mine: `app/src/provenance.tsx`, `app/src/site/route.ts`, `app/src/site/Rail.tsx`,
`app/src/styles.css`. Nothing else in the tree, no new dependency, no `App.tsx`/`Gallery.tsx`/`lib.ts` edit.

**Harness:** `build/r2-shell-small-measure.mjs` (Playwright, `/usr/local/bin/google-chrome`), raw numbers in
`build/r2-shell-small-measure.json`. Build + serve first:

```bash
cd app && npx vite build
mkdir -p /tmp/r2shell && ln -sfn "$PWD/dist" /tmp/r2shell/design-catalog
python3 -m http.server 8731 --directory /tmp/r2shell --bind 127.0.0.1 &
ONLY=pill node /root/docs/catalog-redesign/build/r2-shell-small-measure.mjs   # or omit ONLY for all six sections
```

---

## 1. Provenance tags are a property of the Chrome page

`provenance.tsx:144` is the gate: `Provenance()` reads the route and returns `null` on everything but
`#/chrome`, so `ChromeTags` (`:150`) — and with it the five document-wide capture listeners — is never
mounted. The instruction was "not armed at all", so that is what was measured, by instrumenting
`document.addEventListener` before the app boots:

| route | listeners armed | 5 tagged elements hovered → tags raised |
|---|---|---|
| `#/` | **none** | 0 / 5 |
| `#/g` | **none** | 0 / 5 |
| `#/i/shadcn/button` | **none** | 0 / 5 |
| `#/chrome` | pointerover, pointerout, focusin, focusout, scroll | 5 / 5 |

`#/chrome` is behaviour-identical: 5 of 5 raise a tag, the drift table still has its 16 rows, and `used N×` is
still the DOM's own count for the same id (`used==DOM true`: collapsible 23, button 8, input 1, mono 1 — the
same five numbers as before the change, checked against the pre-change build's snapshot). Hover-only stays
(`pointerType === "touch"` still returns early), and not one `data-catalog-item` attribute was removed.

The counter's `MutationObserver` also now disarms when the last subscriber leaves (`provenance.tsx:78`), so
nothing of this layer runs off the Chrome page. `useSyncExternalStore` keeps its snapshot, so returning to
`#/chrome` shows the same numbers immediately and recounts on mount.

## 2. Duplicate rail nesting — collapsed in `buildTree`, not in the render

`route.ts:145` adds `RailSection = TreeSection & { flatten?: "cat" | "family" }`; `route.ts:181-188` decides it
from the declared structure (one declared category ⇒ the section **is** that category; a single family whose
key slugs to the section's own label ⇒ that family too). The marker sits *beside* a still-complete
`cats`/`families`/`subs` tree, which is the whole point: `resolve()` in `site/Gallery.tsx` keeps resolving
through the same object, and the render only follows the tree it is given (`Rail.tsx:153,162`).

Rendered on `#/`, every level opened (539 rows):

| section | before | after |
|---|---|---|
| Motion and effects [56] | sec → cat "Motion and effects" → 50 families | sec → 50 families |
| Docs [108] | sec → cat "Docs and guides" → family "docs" → 17 sub-families | sec → 19 sub-families (components 60, registry 11, installation 10, …) |
| Blocks and pages [20] | sec → cat "Pages and blocks" → 11 families | sec → 11 families |
| Components [585] | sec → 9 categories → families | **unchanged** |

* sections whose only child repeats their own label: **0** (was 1: Motion and effects).
* every `#/g` link the rail emits: **113**, of which **0** open a grid whose `data-gallery-counts` total is 0.
  (117 → 113: the three category doors and Docs' family door are the levels that stopped existing. All of them
  still resolve if pasted by hand, because the tree still carries them.)

**Links:** no spelling changed, so nothing needed a second spelling. Canonical is what the rail emits today —
`#/g?sec=<section label>`; `#/g?sec=…&cat=…&fam=…&sub=…` remains accepted because `buildTree` still returns
that structure. This is stated in the comment at `route.ts:128-142`.

## 3. "Matrixs"

`Rail.tsx:104 familyLabel()`: one function, an irregular table (`:92` — matrix→matrices, index→indices, box and
switch written out so the intended outcome is one readable place), an invariant set (`:98` — already plural:
records, returns, texts, tabs, docs, utils, citations; non-count: progress), then the suffix rules
(-s/-x/-z/-ch/-sh → `es`, consonant + y → `ies`, otherwise `s`). It pluralises the head of a compound:
`ai-status → "ai statuses"`, `3d-tilt → "3d tilts"`. Capitalisation is the rail's own (all lowercase, label
stays lowercase).

Unit-checked in the harness by lifting the shipped function out of `Rail.tsx` (it imports nothing) and running
**all 191 family keys in the manifest**, then cross-checking the 100 labels the rail actually rendered:

* bare-`+s` mistakes: **14 before → 0 after** — availability, bouncy, checkbox, combobox, empty, family,
  gravity, index, liquidity, matrix, proximity, search, switch, typography.
* keys whose label changes: **17**.

The 17 before/after pairs:

| `ai-status` | ai status | ai statuses |
| `availability` | availabilitys | availabilities |
| `bouncy` | bouncys | bouncies |
| `checkbox` | checkboxs | checkboxes |
| `combobox` | comboboxs | comboboxes |
| `empty` | emptys | empties |
| `family` | familys | families |
| `gravity` | gravitys | gravities |
| `index` | indexs | indices |
| `liquidity` | liquiditys | liquidities |
| `matrix` | matrixs | matrices |
| `proximity` | proximitys | proximities |
| `search` | searchs | searches |
| `status` | status | statuses |
| `success` | success | successes |
| `switch` | switchs | switches |
| `typography` | typographys | typographies |

(174 of the 191 keys are unchanged by the fix and are listed in the JSON at `build/r2-shell-small-measure.json` under `sections.plural.after`.)

Keys the rules now pluralise that a human might still wince at — listed rather than papered over, because the
table is the place to fix them, not a new rule: `bouncies` (bouncy), `confettis`, `datas`, `githubs`,
`morphings`, `shareds`, `resizables`, `expanding`/`spinning`/`streaming`/`thinking`/`loading` → `…gs`. They are
slug tokens used as group names ("everything whose slug starts with `shared`"), which is why they read as
adjectives; pluralising them is the rule the brief asked for, and the alternative (an adjective list) is taste,
not grammar. Say the word and each one is a one-line table entry.

## 4. The floating theme pill

It could not be padded away. At 390×844 and 768×1024 the gallery is a full-width column, so a *fixed* pill in
the corner has a card under it at **every** scroll offset — measured before the fix, counting only what is
actually on screen (tile boxes clipped by every clipping ancestor, so a scrolled-away tile cannot fake a pass):

| | before | after |
|---|---|---|
| 390×844 top / middle / end | 1 tile under the pill each | **0 / 0 / 0** |
| 768×1024 top / middle / end | 1 tile under the pill each | **0 / 0 / 0** |
| controls | 44×44 ×3 | 44×44 ×3 |
| scroller | window | `.page` |

So the pill moves into a lane (`styles.css:713-745`, appended after the original float rule, which stays at
`:696` for any future floating mount). Below 861 px `.cat` is the viewport and nothing longer, `.page` is the
scroller inside it (the desktop arrangement extended), and the switch is the last row of that column — outside
the scroll area, so no card can be under it at any offset. The lane reserves its own height plus
`safe-area-inset-bottom`, and covers nothing.

That is a shell-wide change, so the whole phone shell was measured, not just the pill:

```
390x844  #/                page scrolls inside .page  document scrolls false  lane present
390x844  #/g               page scrolls inside .page  document scrolls false  demos mount (mounts 4, live 2 = PHONE_CAP)
390x844  #/i/shadcn/…      page scrolls inside .page  document scrolls false
390x844  #/chrome          page scrolls inside .page  document scrolls false
390x844  Browse drawer     rail visible, 65 leaf rows, page keeps 706 px, lane still visible
390x844  theme switch      dark → <html class="dark" data-theme="dark">
768x1024 all four routes   same shape (page 892 px tall, document never scrolls)
1440x900 all four routes   unchanged: no lane (phone-only), .page scrolls exactly as before
```

`site/Gallery.tsx` resolves its scroller by walking up for an `overflow-y` element with
`scrollHeight > clientHeight`, so the mount pool followed the change by itself — the caps are untouched and
still hold (2 live on a phone). `useScrollReset` in `route.ts` sets `.page.scrollTop`, which on a phone was a
no-op until now and now resets the page the visitor actually scrolls.

## Guards

```
python3 app/check_chrome.py            exit 0  — 13 shell files, every interactive element is a catalogue component
page turn, motion allowed              250 ms, 1 animation, target DIV (transitions/page-side-by-side)
page turn, prefers-reduced-motion      0 animations, transition 0s
```

`styles.css` selectors the guard knows about are untouched: `.page-in`, `.theme-switch`, `[data-stage-bar]`,
`[role="tab"]`, `[data-sidebar="menu-action"]` keep their values; everything new is appended.

---

## What the lead must wire

Nothing in `App.tsx`, `Gallery.tsx` or `lib.ts` is required for any of the four items to work — the commits are
self-contained. Two things do need a decision from you:

1. **`site/Gallery.tsx:7` (`./route` import)** — `buildTree` now returns `RailSection[]`, not
   `TreeSection[]`. It is assignable, so `Gallery.tsx` compiles unchanged; if it is ever typed strictly, change
   `const tree: TreeSection[] = buildTree(...)` at `Gallery.tsx:67` to `RailSection[]` and import the type from
   `./route`. No behaviour change either way.
2. **`styles.css:729-745` — the phone scrollport.** If any other unit has measured *window* scrolling on a
   phone (scroll position, `window.scrollY`, a sticky element), it is now `.page`. The gallery's own pool
   already follows it (measured above); the palette and rail drawer were measured open over it; but a phone
   performance run that assumed the document scrolls needs re-taking. Revert = delete that media block; the
   pill returns to the corner and item 4's defect returns with it.
3. **`styles.css:696`** — the original `.theme-switch-float` fixed rule is dead code below 861 px. Kept
   deliberately (the append-never-rewrite rule); delete it whenever you like.

## Notes, honestly

* **A stash collision with `r2-frame-truth`.** These worktrees share one `.git`, so they share one stash stack.
  My `git stash push app/src/styles.css` (taken to measure the pill's *before* state) and their stash crossed:
  my pop put their `Gallery.tsx`/`demo.tsx` edits into my tree and their pop put my `styles.css` into theirs.
  Both files were recovered; I verified their `/tmp/r2-new/` copies byte-for-byte (sha256 `446967d1…`,
  `39026543…`) before `git checkout --` reverting them out of my tree, and confirmed my committed
  `styles.css` is byte-identical to their backup (`404eb088…`). Their work is untouched and uncommitted in
  their own worktree; the final measurement run above was taken on a tree holding only my four commits.
  No `git stash` was used after that.
* The before/after pill numbers were taken by building the *stashed* (pre-fix) `styles.css` on the same tree
  and running the identical probe — not by reasoning about the CSS.
* Item 2's `Blocks and pages` collapse is one step beyond the two sections the brief named. It is the same
  rule (one declared category ⇒ the section is that category) and leaving it out would have made the rail
  inconsistent; its before/after is in the table above so it is easy to veto.
* Item 5 (the home page's numbers) was not touched: `site/Home.tsx` belongs to `r2-verdict-excise`.
