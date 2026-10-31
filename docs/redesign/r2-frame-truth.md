# R2 — r2-frame-truth

Branch `fleet/r2-frame-truth`, worktree `/mnt/HC_Volume_105573741/design-catalog-site-r2-frame-truth`,
four commits on top of **`38dada04`** (master, read first: `git log --oneline -1`). Files touched: exactly the three
this unit owns — `app/src/site/demo.tsx` (+47/−10), `app/src/site/Gallery.tsx` (+97/−24), `app/src/site/Stage.tsx`
(+6, a comment at the line the review named); 126 insertions, 24 deletions. `Home.tsx`, `ItemPage.tsx`, `Code.tsx`, `lib.ts`, `route.ts`,
`Rail.tsx`, `provenance.tsx`, `App.tsx`, `styles.css`, `index.html`, `gen.py`, `manifest.json`, `demos/**`,
`docs/**`, `publish.sh` untouched. No new dependency. Nothing under `demos/**` changed; the child protocol
(`#<id>|<i>|theme=…&motion=…&static=…&replay=…`) is untouched.

```
9bd43b9e frame: the surface under a demo is painted in the frame's theme, not the site's
e2a84db3 gallery: the theme is a subscription, so a theme change reaches the frames already mounted
1b5480d9 frame: `stretch` — a tile is a window of a fixed height, so the frame fills it
16d86b1e gallery: a parked tile names the item it will become, in the box it will occupy
```

Each commit message carries the measurement that justifies it; this file carries the whole table.

---

## 1. The surface follows the frame's theme (defect 1)

`demo.tsx:287` painted the stage surface with `var(--background)`, the **site's** token, while the child was handed
`theme=…` and repainted itself. In the two mixed combinations the paper and the demo disagreed, which is the
reported white-on-white island: a light catalogue previewing `dark` put a **white** surface under a demo whose own
text and pill are light.

`FRAME_SURFACE` (`demo.tsx:222`) is now the one table of ink + rule per theme, and the surface takes both from
`stage.theme` (`demo.tsx:277`, `:287`), plus `colorScheme` so form controls inside the surface follow it. The two
pairs are the values `styles.css` gives `--background`/`--border` in `:root` (`styles.css:35`) and `.dark` (`:70`).
They are restated rather than referenced because the stylesheet has **no `.light` scope** — `class="dark"` on a
wrapper themes a dark surface inside a dark site, and nothing can put the light palette back inside `html.dark`.
The child cannot supply the colour either: `app/demo.html:7` is deliberately `body{background:transparent}`, so the
frame's own computed background is `rgba(0, 0, 0, 0)` in both themes (measured, both `html` and `body`) — the surface
*is* the paint. The measurement reads the surface's computed colour back against the theme the child actually
painted, so a palette change in `styles.css` shows up as a disagreement instead of hiding.

**`Stage.tsx:207` — the console.** I did not invert the console to the frame's palette, and I spent the decision
rather than assuming it. It is `chrome`: it holds the site's controls, and turning it dark because the *preview* is
dark makes a control strip lie about which theme the catalogue is in. It is also the only *implementable* answer:
the light direction cannot be scoped at all (no `.light` rule), so "the console follows the preview" would work
when the preview is dark and silently not when it is light — a rule that works half the time is worse than a rule
that is stated once. The rule is now written at that exact line (`Stage.tsx:207-212`): *two surfaces, two owners —
chrome follows the site, paper follows the frame*. If the lead wants the console in the demo's palette, it is a
stylesheet change (`what the lead must wire`, item 1), not a unit-local one.

| surface ink vs the theme the child painted | before | after |
|---|---|---|
| 1440×900, light site × light/dark preview | light ✓, **white under a dark demo ✗** | ✓ ✓ |
| 1440×900, dark site × light/dark preview | **dark under a light demo ✗**, dark ✓ | ✓ ✓ |
| 390×844, the same four combinations | identical four results | ✓ ✓ |
| **agreeing combinations (8)** | **4/8** | **8/8** |

Computed values, the two mixed cases: before — light site + dark preview: surface `oklch(1 0 0)`, child `dark`;
dark site + light preview: surface `oklch(0.141 0.005 285.823)`, child `light`. After — `oklch(0.141 0.005
285.823)` / `dark` and `oklch(1 0 0)` / `light`, and `colorScheme` follows (`dark` / `light`). The console's own
background is unchanged in all eight (site `--card`), which is the decision above, measured.

## 2. The theme is a subscription (defect 2)

`themeOf()` read `<html>` once per render. The switch repaints `<html>` and re-renders nothing, so the grid was
frozen at the theme it first rendered under — **including tiles mounted afterwards**, which is not "stale frames",
it is a stale gallery.

`useSiteTheme()` (`Gallery.tsx:324`, consumed at `:634`) subscribes: a `MutationObserver` on `<html>`'s class (the
painted truth) and `data-theme` (the *choice*: `light`/`dark`/`system`), plus `prefers-color-scheme` for the "auto"
state the boot script itself follows. No context provider, no dependency, `ThemeSwitch` untouched. The new theme
flows into each tile's `addr.theme`, so a mounted frame is **re-addressed in place** (`demo.html` applies the flag
on `hashchange`) instead of the grid being remounted — the pool's own counter proves it: `mounts` does not move.

| switch with the grid open | before | after |
|---|---|---|
| 1440×900, light → dark: live frames on the new theme | **0/9** (9/9 stale) | **9/9**, 0 stale |
| 1440×900, dark → light | — (already dark at mount) | **9/9**, 0 stale |
| 390×844 (the phone cap is 2), both directions | **0/2** each way | **2/2** each way |
| tiles mounted **after** the switch | 9/9 and 2/2 on the old theme | 0 stale |
| `window.__gallery.mounts` across the two switches | +0 | **+0** (re-addressed, not remounted) |

## 3. `stretch` — a tile is a window, a stage is not a poster (defect 3)

`floor` is only what a demo gets *before* it reports, so `shown = h > 0 ? h : …` gave a truthful 60 px demo 60 px
inside a 210 px tile. `DemoFrame` takes one additive prop, `stretch` (`demo.tsx:114`, used at `:172`): the height in
the child's own CSS px that the frame must fill, `shown = max(reported, stretch)`. The tile passes `bodyH / zoom`
(`Gallery.tsx:426`, `:446`); the item page passes nothing, and an absent `stretch` is exactly today's
`shown = reported | selfFloor | floor`. The `self` branch now falls back to `floor` when no `selfFloor` was given
(it used to yield `undefined`); no demo in the manifest reports 0, so nothing observed changes.

| tile | viewport | before | after |
|---|---|---|---|
| `beui/marquee` | 1440×900 | **30.4 / 210** (dead canvas 179.6) | **210.3 / 210** (dead 0) |
| `beui/marquee` | 390×844 | **30.0 / 180** (dead 150) | **180.4 / 180** (dead 0) |
| `beui/pull-to-refresh` | 1440×900 | 258.8 / 210 (taller than the tile, clipped) | 258.8 / 210 unchanged |
| `beui/pull-to-refresh` | 390×844 | 254.9 / 180 | 254.9 / 180 unchanged |
| **item page**, `#/i/beui/marquee` | 1440×900 | 64 px of frame in a 200 px surface | **64 px, identical** — a stage is not a poster |

## 4. The poster names the item (defect 4)

The mount budget is one frame per rAF and this grid has 486 tiles, so the tail is 5–10 s of tiles whose demo is not
mounted. They said `demo` over two skeletons: a placeholder that tells you to wait, not what for. Frozen decision:
no screenshot stills, so the poster is **text** — title, `source · kind`, and the same facets the card prints
below it — drawn with the tile on its first paint, and completely still (`Gallery.tsx:487`, `:453`).

| parked tile | before | after |
|---|---|---|
| names its item (1440×900) | **0 / 477** | **477 / 477** |
| names its item (390×844) | **0 / 484** | **484 / 484** |
| skeletons in the box | 2 × 477 | **0** |
| animated nodes in the box | 0 (the skeletons' class is `animate-none`) | **0** (no motion added) |
| iframes inside a named tile | 0 | **0** — naming never waits for a frame |

Sampled from the first frame the grid exists, 1440×900: at **1679 ms** the grid has 486 tiles, 479 parked,
**479 named**, 7 live, **0 parked without a poster**; at 2237/3307/6317 ms 477/477 named. So the name is not drawn
*later* than the tile — it is drawn with it. Box text, e.g.:
`DEMO | File Upload | beui · block | 15 files | 110 KB | 7 deps | ≥2 parts`.

## 5. No regression

| gate | measured | load |
|---|---|---|
| `python3 app/check_chrome.py` | **exit 0** — 16 shell files scanned, every interactive element a catalogue component | — |
| `npx vite build` | ok, ~10 s incremental / 24–29 s cold | 7–9 |
| page change, no reduced motion | **1** animation, **250 ms**, `cubic-bezier(0.22, 1, 0.36, 1)`, running | 8.6 |
| page change, `prefers-reduced-motion: reduce` | **0** animations total (`document.getAnimations()` empty) | 8.6 |
| item-page frame (the `stretch` regression risk) | `#/i/beui/marquee` frame `64px`, surface 200 px — same before and after | 8.6 |
| gallery pool | `perFrameMax` 1, cap 9 / 2, `mounts` +0 across two theme switches | 8.6 |

How it was measured: `app/` built with `npx vite build`, served by `npx vite preview --port 8843` (base
`/design-catalog/`), Chromium headless via Playwright (`/root/camofox-browser/node_modules/playwright/index.mjs`,
`executablePath: /usr/local/bin/google-chrome`, `--no-sandbox --disable-dev-shm-usage`), viewports 1440×900 and
390×844. **Merge note:** this branch is master + these four commits, so at 390 the window is still the scroller,
and the phone numbers here (cap 2, 2 live tiles) were taken in that arrangement. `fleet/r2-shell-small` moves the
phone's scroller to `.page` (`styles.css:729-745`, their theme-switch lane); `Gallery.tsx`'s `scrollerOf()` resolves
the scroller by walking up for an `overflow-y` element that scrolls, so it follows that change without an edit here,
but the 390 rows in this report have not been re-taken under it. Script and raw JSON in this directory:

- `r2-frame-truth-measure.mjs` — every gate, both viewports; `node r2-frame-truth-measure.mjs after|baseline`
- `r2-frame-truth-measure.json` — after, on the committed tree (`loadavg 8.57 8.13 7.76`)
- `r2-frame-truth-measure.baseline.json` — **the same script against master**, built from the three files at `HEAD`
  with this unit's changes out (`loadavg 9.81 8.16 7.67`). Every "before" number in this report is from that file,
  not from memory. Selectors that only exist after the fix fall back to `iframe.parentElement.parentElement`, so the
  same code measures both builds.

---

## 6. What I did not do, and why

1. **I did not invert the stage console to the demo's palette** (`Stage.tsx:207`). Reason and evidence in §1: it is
   chrome, and the light direction cannot be scoped at all because `styles.css` has a `.dark` scope and no `.light`
   one — the rule would work in one direction and silently not in the other. The rule is written at that line
   instead, and the one-line follow-up is item 1 of §7.
2. **I did not change the mount budget.** The 5–10 s tail is *by design* (one mount per rAF, 9 live, measured in the
   gallery's own report), and the brief freezes the placeholder, not the budget. Naming the tile is the fix for the
   blank; making the tail shorter would be a performance change nobody measured.
3. **I did not add screenshot stills** to the poster (frozen), and I removed the two skeletons rather than keeping
   them beside the text: they cost 954 nodes' worth of DOM across the grid and say "wait", which the name now says
   better. Reference-only cards (`RefCard`, dashed, `no demo`) are untouched — a different object, still visibly
   different.
4. **I did not touch `Home.tsx`'s tiles.** They are another unit's file this round. If they mount `DemoFrame`, they
   have the same strip problem and the same one-line fix (§7, item 2).
5. **I did not re-read the theme in `ItemPage.tsx`.** Its `useStage()` already subscribes to `<html>` with a
   `MutationObserver`, so the item page's preview followed the site before this unit; only the *surface ink* was
   wrong, and that is `demo.tsx`.
6. **No new dependency, no `styles.css` edit, no `demos/**` edit** — including for the two colour literals, which I
   judged cheaper than a fourth unit's stylesheet change (and which the measurement keeps honest).

## 7. What the lead must wire

1. `app/src/styles.css:70` — add a `.light` scope (or a `--surface` / `--surface-rule` pair under `:root` and
   `.dark`); then `demo.tsx:222`'s two literal pairs become `var(--surface)`-style tokens and, if the console should
   read as the demo's theme, `Stage.tsx:207` gets the same scope instead of a comment.
2. `app/src/site/Home.tsx` (the other unit) — the front page's tiles, if they mount `DemoFrame`, need
   `stretch={Math.ceil(bodyH / zoom)}` and a `Poster`-style name, or they will keep the strip and the "demo" box.
3. `app/src/demo-main.tsx` — optional, one line: on `hashchange`, if only `theme` changed, re-apply and keep
   `dc-static` from the parent's last `designCatalogPlay`. Today a *hovered/focused* motion tile whose theme is
   switched from the keyboard can come back frozen. The realistic path (click the theme switch) fires
   `pointerleave` first, which sends `play:false`, so this is an edge, not a defect I could measure.
4. **After merging `fleet/r2-shell-small`** — their lane makes `.page` the phone scroller (`styles.css:729-745`).
   `Gallery.tsx` follows it by itself (`scrollerOf()`), and they measured mounts 4 / live 2 at 390 with
   `PHONE_CAP` intact, but the 390 rows in this report predate that change and should be re-taken on the merged
   tree rather than trusted from here. Their other seam is a type only: `buildTree` there returns
   `RailSection[]`, which is `TreeSection & { flatten?: "cat" | "family" }`, so this file's annotation
   (`Gallery.tsx:6`, `:66`) still compiles and `resolve()` still receives the same object — checked with them, not
   assumed.
5. Nothing else. `#/g` is already wired in `App.tsx`, the item page renders unchanged, and the pool, the mount
   budget and the child protocol are exactly as they were.

---

*Method note, in the open:* mid-run I used `git stash` to build the pre-change baseline, and all these worktrees
share one `.git` and therefore one stash stack. A neighbouring unit's `stash pop` took my stash into their tree and
my `pop` took theirs into mine. Nothing was lost — their work was already committed (`cb0432a1`) and my two files
were byte-copied in `/tmp` — but the state was briefly wrong in two trees, and their build could have measured my
code. `r2-shell-small` was told immediately with the hashes. The baseline build used here (19:32:58) and the
after build (19:30:43) both predate the collision, and the final `after` run in `r2-frame-truth-measure.json` was
built from the committed tree after it. No `git stash` was used again: the four states were reconstructed from
`git show HEAD:…` copies in `/tmp/r2-base` by `/tmp/r2-states.py`, which asserts the final state is byte-identical
to what was measured.
