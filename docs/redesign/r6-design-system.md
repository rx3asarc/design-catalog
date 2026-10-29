# Round 6 — the design system, adopted

Maestro handed over `github.com/rx3asarc/sharedfiles/tree/main/design-catalog-design-system` ("I got a present
for you… it's specifically for design catalog"). This is what it took to make the site *be* that system rather
than approximate it, and what the numbers say now.

Everything below is measured on the built site, local (`http://localhost:8830/design-catalog/`) and live
(`https://rx3asarc.github.io/design-catalog/`), at 1440×900 and 390×844.

---

## 1. What was adopted, and the three deliberate differences

`app/src/tokens.css` is the vendor `tokens.css`, verbatim except for three documented changes in its own header:

| Difference | Why |
| --- | --- |
| Colour blocks scoped to `.cat`, not `:root` | The exhibits are shadcn components painted with shadcn's own `--accent`, `--border`, `--background`. A chrome palette on `:root` repaints every demo and misrepresents the library. |
| Both `@font-face` blocks dropped | Instrument Sans and JetBrains Mono already ship with `unicode-range` latin subsets. Verified byte-identical: sha256 `2ee17598…` and `83c005d4…` match `app/public/fonts/`. A second declaration is a second copy. |
| Type classes renamed `.dc-*` | `.title`, `.body`, `.small`, `.code` are names the chrome and the demo markup already use (`h2.title`). A shared class must not silently win over the thing that names itself the same. |

The bookmark's rules are now binding, and each is a rule in the stylesheet rather than a habit:

- **dark is the default, full stop** — a visitor who has never chosen gets dark whatever their OS says; `system`
  stays in the switch and is remembered once picked. The OS `matchMedia` listener was removed on purpose.
- **no shadows.** Depth is `surface-100/200/300` plus hairlines. `border-strong` on every control's border,
  `border` only for dividers.
- **the accent is spent once per view**: the active nav bar, and one primary control. Everywhere else purple
  text is `accent-ink`, never a fill.
- radii: `radius-sm` 6 on nav items, chips and segmented tracks; `radius-md` 8 on inputs and buttons; `radius-lg`
  10 on canvases and cards; `radius-full` only on the dots.
- type: `display` 36/40, `heading` 24/32, `title` 18/28, `body` 15/24, `small` 13/20, `label` 12/16 in
  JetBrains Mono, `code` 13/20. Page titles use `display` at 30/36, which is what the vendor's own PageHeader
  guideline prescribes.

## 2. The thing that prompted all of it: the card you see is the card you get

> "when i go to reload the page, the formatting and styling i see, for about like half a second, is super
> different (and in my opinion much better) than that which shows when the page actually loads properly"

It was not a font or a colour. It was **geometry**, and it was measurable:

| | shell (first ~600 ms) | page after React | jump |
| --- | --- | --- | --- |
| tile at 1440 | **164 × 210** | **164 × 317** | +107 px down the page |
| row height | 210 | 317 | |
| page column | 1100 | 640 → 900 | tiles squeezed to **92 px wide** |

Two separate faults:

1. **The front page's column was a reading column.** Six tiles inside a 640 px column are 92 px strips. A tile is
   not prose. The front page's container is now the content's width (`1100px`, the same box the shell draws) and
   its prose keeps its own measure (`max-width: 62ch`).
2. **The hero tile carried a caption block under the canvas.** Canvas 210 + caption 107 = 317, where the shell
   drew one 210 card. The hero row now names its tiles *across the canvas's foot* (`caption="bar"`): one canvas
   tall in the shell, in React, and after the frames mount. The grid keeps the caption block, where a reader is
   comparing rows.

Measured after:

| | shell | page | Δ |
| --- | --- | --- | --- |
| 1440 tile | 164 × 210 @270 | 166 × 212 @274 | 2 px |
| 1440 heading top | 123 | 124 | 1 px |
| 390 tile | 304 × 132 @311 | 304 × 134 @311 | 2 px |
| 390 row top | 311 | 311 | 0 px |

`qa/r2_check.mjs` now asserts the **box**, not just the ids: "a tile is one canvas tall, so the swap does not move
the page", at 1440 and at 390. The old check compared six declared ids against six mounted ones and would have
passed while the page shoved itself 107 px.

## 3. The TopBar the site never had

`.topbar` was `display: none` above 860 px: a desktop visitor had **no top bar at all**, no section links
anywhere, and the palette's only door was a floating button in the bottom-right corner. `site/TopBar.tsx` is the
vendor component:

- 56 px, `fixed`, `surface-100`, one `border` hairline under it;
- brand at 13/600; the site's real sections (`#/g`, `#/chrome`, `#/about`) at 13 `ink-muted`, current one `ink`/500;
- the palette's door drawn as the vendor's **240 px field** — `border-strong`, `radius-md`, `⌘K` in mono at its right;
- **0 accent fills in the bar, on every route.** Search is a side door; the one page with a real primary action
  already spends the accent on its install copy.

The field is a button, not an `<input>`, and that is the honest shape: there is one search in this site (the
palette, mounted once, closing over its own open state), so a real input here would be a second field that cannot
accept a query. It opens the one palette through the same `openPalette` path the ⌘K listener documents.

The phone bar is not a shrunk desktop bar: brand, palette button, one 44 px Browse/Close — a phone has no keys.

## 4. The item page on the vendor's own components

| Block | Component | Measured |
| --- | --- | --- |
| install command | `InstallBlock` | 1036 wide at 1440, 358 at 390; copy is the page's **only** accent fill |
| field/value facts | `ApiTable` | 1 table; hairline rows, `label` in `ink-subtle`, no zebra |
| "compare with the N others", pager | `RelatedCard` | 44 px hits |
| demo/code switch | left as the registry's tabs | the vendor's `SegmentedTabs` is a segmented control; this is tabs, and renaming it would be a lie |
| cover | not added | this page has no cover slot; inventing one would be a new claim |

## 5. The chrome, brought onto the book

Each of these was measured before and after, not assumed:

| Element | Before | After |
| --- | --- | --- |
| chips (`all sources`, source pills) | `radius-full` 99 px | `radius-sm` 6 px, `border-strong` |
| rail group labels | Instrument Sans, sentence case, 12 px, ink | JetBrains Mono, uppercase, 12 px, `ink-subtle` |
| rail counts | sans | JetBrains Mono, tabular, `ink-subtle` |
| rail items | — | 13 px `ink-muted`, current page `ink`/600 on `surface-300` + **3 px accent bar on the left edge** |
| search field | `oklch(1 0 0 / .15)` (shadcn default) | `border-strong` `#6b6b75` |
| breadcrumb | mono uppercase 12 px `ink-muted` | sans, 13/20, `ink-subtle` (PageHeader: "Breadcrumb in `small`, `ink-subtle`") |
| page title | 30/650 | 30/600, `-0.02em` |
| reading column | 640 px | 760 px |
| canvas (`.demo`, tile frame) | `surface-200`, radius 10 | `surface-300`, `radius-lg` |
| text under 12 px at 1440 | 51 nodes at 10 px + 52 at 11 px | **0** |
| theme switch's selected segment | accent fill | `surface-300` + `ink` (SegmentedTabs rule) |
| accent fills on `#/` | 1 (theme switch) | **0** |
| accent fills on `#/i/shadcn/sidebar-09` | 0 | **1**, the install copy |

## 6. Gates

`qa/contrast_check.mjs` is new and measures the book's own claims on the built page, resolving tokens through a
throwaway element inside `.cat`:

- `ink`, `ink-muted`, `ink-subtle` on `surface-100/200/300`, both themes, ≥ 4.5:1 — **32/32 pass**;
- tightest: `ink-subtle` on `surface-300` **4.85:1** dark / **4.87:1** light; `on-accent` on `accent` **5.71:1**
  dark; focus **6.51–7.31:1** dark, 6.62–7.28:1 light.

Eight gates green, three consecutive runs, local and live: `smoke`, `r2_check`, `tap_check`, `gallery_check`,
`stage_check`, `slice3_check`, `mobile_state_check`, plus `assets_check` (**33,963 references, 11,537 files,
0 missing**) and `contrast_check`.

## 7. Commits

| Commit | What |
| --- | --- |
| `7c4c9581` | adopt the design system; the front page's column and one-canvas-tall hero tiles |
| `8c41273f` | the rail's labels are the label step; counts are mono and tabular |
| `f7fbab1c` | the TopBar (desktop had none) |
| `0e4bd53b` | the item page on `InstallBlock` / `ApiTable` / `RelatedCard` |
| `0099658c` | the 12 px floor is not a phone rule; the segmented control is not an accent fill |
| `731af786` | the last three 11 px words on a desktop item page |

## 8. What is still open

- **The phone rail's density.** The vision pass called it "significantly more complex than the shell". The shell
  shows four section names; the rail shows the whole tree. That is a decision, not a defect — but the collapsed
  default is worth revisiting.
- **The floating palette button.** With the bar's field in place, the bottom-right trigger is a second door to the
  same room. Removing it is a one-line change once the bar is trusted on a phone.
- **Pre-rendering the front page's whole first screen**, or splitting the 572 KB manifest per section. The
  remaining ~8 s to interactive is 399 KB at 50 KB/s.
- **`pick` is still empty for all 769 items.** It is the one field no agent may invent; 3–5 sentences of "what it
  is good for" per item, written by a human, is the only thing that fills it.
