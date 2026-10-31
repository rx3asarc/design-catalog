# r3-palette — the search palette, on a phone and on the way back

Branch `fleet/r3-palette`, cut from **`d5d2a226`** (master). Worktree
`/mnt/HC_Volume_105573741/design-catalog-site-r3-palette`.

```
1e566200  the palette gets a way out a thumb can hit, and a sloppy tap opens it   (§1)
1ef4647a  a 500-character query stays inside the palette                          (§2)
b4f226a9  Back is a way out of the palette, not a way under it                    (§3)
8c48bed0  a typo finds the item, and a two-word query finds the hyphen            (§4)
```

Files: **`app/src/site/CommandPalette.tsx` only** (`git diff d5d2a226 --stat`: 1 file, +231 / −37).
**Zero lines added to `app/src/styles.css`** — every change is a utility on an element this file owns, so
there is nothing here for the next unit to collide with. No dependency added, no index, no other file touched.

Rig: `npx vite build` in `app/`, `app/dist` served under `/design-catalog/` on `:8901` (Python's
`http.server`, so the vite base is honoured), Playwright from `/root/camofox-browser/node_modules/playwright`,
`executablePath: /usr/local/bin/google-chrome`, `--no-sandbox --disable-dev-shm-usage`.
Harness: `build/r3-palette-measure.mjs` (full pass, prints JSON), `r3-palette-gestures.mjs` (the five taps),
`r3-palette-close.mjs` (control census). Evidence: `r3-palette-before.json`, `r3-palette-after.json`,
`r3-palette-gestures-before.json`, `r3-palette-gestures-after.json`, `r3-palette-390.png`.

---

## 1. A close control a thumb can hit — and why the first tap once did nothing

**The first-tap miss is real, and it is `click` on a thumb.** The trigger was `onClick={show}` and nothing
else. A touch becomes a `click` only if the whole gesture stays inside the browser's tap slop; a finger that
drifts further is downgraded to `pointercancel` and **no click is ever synthesised**, so the handler never ran
and the palette never opened. The user taps again, more carefully, and it works — "the first tap did nothing".

Measured with CDP touch dispatch (390 × 844, `pointerdown` → hold → four 4 px `touchMove` steps → `touchend`):

| gesture | before | events before | after |
|---|---|---|---|
| clean tap, 40 ms | opens | pointerdown touchstart pointerup touchend **click** | opens |
| tap, finger drifts 10 px | opens | … click | opens |
| tap, finger drifts **16 px** | **nothing** | pointerdown touchstart **pointercancel** touchend | opens |
| tap, finger drifts **24 px** | **nothing** | pointerdown touchstart **pointercancel** touchend | opens |
| slow press, 800 ms | opens | … click | opens |

A 44 px control that only fires when the thumb lands within ~8 px of where it started is the bug. The trigger
now opens on `pointerdown` for **touch and pen** (an event that fires in every one of those five gestures), and
keeps `onClick` for the mouse and for the keyboard's own activation, which synthesises a click with no pointer
at all. `show()` is idempotent, so the trailing click of a healthy tap is a no-op instead of a toggle.

Two things that had to come with it, both measured rather than assumed:

- **Focus.** Opening on `pointerdown` cost the field its focus: the browser synthesises the mouse sequence
  *after* the dialog has mounted and trapped focus, so `document.activeElement` was `BODY` at 0, 50, 150, 400
  and 900 ms after the tap (`focusin:command-input` then `focusout:command-input`). With the touch
  `pointerdown`'s default action cancelled, focus stays on `command-input` at every one of those times.
- **Focus return.** At `pointerdown` a touch has not focused the button yet, so `returnTo` recorded `BODY` and
  the close returned focus nowhere. `show(from)` now records the control that opened the palette.

**The control.** A 44 px `Close` button in the footer, on every viewport, `aria-label="Close search"`,
rendered through the registry's `DialogClose` so it is the same dismiss path Escape uses. It is full-width at
390 (**356 × 44**) and compact at 1440 (**82 × 44**). The key legend — `↑↓ move · ↵ open · esc close · ⌘K` —
stays, as supplementary keys, from 861 px up (`display: flex` at 1440, `display: none` at 390).

Census inside the palette (`button, a[href], input, select, textarea`), empty query:

| | 390 | 1440 |
|---|---|---|
| search field | 324 × **48** | 462 × **48** |
| `Close search` | 356 × **44** | 82 × **44** |
| `Clear the query` (empty state) | 126 × **44** | 126 × **44** |
| **controls under 44 px** | **0** | **0** |
| result rows | 13 × **44** | 13 × **32** |

The search field was 40 px and `Clear the query` 36 px; both are 44 now (the field's registry row is 36 px, so
the taller row is set from this file's `Command` `className`, not by editing the registry). **The one thing not
at 44 is the desktop result row**: `max-[860px]:min-h-11` keeps 44 px rows on phones, and a 32 px option row on
a 1440 desktop list is the density the shell already had — a 44 px row would put 9 results in the 420 px list
instead of 13. Say the word and it is one class.

---

## 2. A 500-character query stays inside

`scrollWidth − clientWidth`, query = 500 `x` with no break opportunity in it:

| element | 390 before | 390 after | 1440 before | 1440 after |
|---|---|---|---|---|
| empty state (`[data-slot=command-empty]`) | **3 495** | **0** | **3 357** | **0** |
| the query echo inside it | 3 495 | 0 | 3 357 | 0 |
| dialog body (`[role=dialog]`) | 0 | 0 | 0 | 0 |
| command root | 0 | 0 | 0 | 0 |
| result list | **3 495** | **0** | **3 357** | **0** |
| page (document) | 0 | 0 | 0 | 0 |

The dialog and the command root reported 0 before only because they clip — the text was running out of both
sides under the clip, which is what "spills out of the no-results line" is. The fix is `overflow-wrap: anywhere`
on the echo and the empty state, `max-w-full`, and `min-w-0` on the empty state, the group and the row.
Word-shaped queries of the same length (62 × `sidebar`) were already clamped at 0 and stay at 0 — and with §4
they now match rows instead of reaching the empty state at all.

---

## 3. Back closes it

Before: open the palette on an item page, press Back — the page turned into the front page **underneath a
still-open, still-scroll-locked palette** (`location.hash` `""`, `.page` `data-route=home`, `body` overflow
`hidden`, dialog open).

The open palette is now a history entry: opening pushes a state at the URL it was opened at, so Back pops
*that* entry, the URL never moves, and no page can change under the palette. `popstate` closes it. Escape, the
✕, the overlay and Ctrl+K all leave through `history.back()` — one exit that unwinds the entry — and a Back the
visitor pressed arrives at the same handler. Selecting a row turns the palette's entry into the item's entry
(`replaceState` + the `hashchange` the router listens for), so Back from the item page returns to the page they
were reading instead of to a dead copy of it.

The three values, at 390 (**identical at 1440**):

| | `location.hash` | `body` overflow (inline style) | `document.activeElement` |
|---|---|---|---|
| before opening | `""` | `visible` (`""`) | `BODY` |
| palette open | `""` | `hidden` (`pointer-events: none;`) | `INPUT` (the field) |
| after ✕ | `""` | `visible` (`""`) | `BUTTON` (the trigger) |
| after Escape | `""` | `visible` (`""`) | `BUTTON` |
| after Back | **`#/i/shadcn/button`** — the page it was, `data-route=item` | **`visible`** (`""`) | **`BUTTON`** |

Palette open/closed: 1 → 0 on every one of the three paths, both viewports. Full flow at both viewports, no
page errors:

| step | hash | route | body | palette |
|---|---|---|---|---|
| on the item page | `#/i/shadcn/button` | item | visible | closed |
| open → type `badge` → Enter | `#/i/shadcn/badge` | item | visible | closed |
| Back | `#/i/shadcn/button` | item | visible | closed |
| open → Ctrl+K | `#/i/shadcn/button` | item | visible | closed |
| Back | `#/` | home | visible | closed |
| open → tap a row | `#/i/shadcn/kbd` | item | visible | closed |

A reload cannot leave a stale entry: the pushed state is checked at module load and handed back to the page.

---

## 4. Forgiving matching, over the same fields

The whole query is still matched first, against the same fields, at the same tiers — **a query that matched
before is not re-ranked, it can only gain rows**. When the whole string lands nowhere, the query is taken word
by word against the same fields split on non-alphanumerics, every word has to land somewhere in the row, and
the row is ranked by its worst word. A word of five letters or more may also be one edit out, adjacent
transposition counting as one (`siderbar` → `sidebar`); a hit that needed that help always sorts below every
hit that did not. One comparison function in this file, no index, no dependency.

| query | before | after |
|---|---|---|
| `siderbar` | **nothing** | 25 matches — `shadcn/sidebar`, `shadcn/docs-components-sidebar`, `beui/ai-sidebar`, `shadcn/sidebar-01…16`, `beautifului/sidebar-nav`, … |
| `dyn isl` | **nothing** | 1 — `beui/dynamic-island` |
| `dyn islnd` | nothing | 1 — `beui/dynamic-island` |
| `date picker` | 1 — `shadcn/docs-components-date-picker` | 5 — `shadcn/docs-components-date-picker`, `shadcn/date-picker-demo`, `beui/date-range-picker`, `shadcn/date-picker-with-range`, `shadcn/date-picker-with-presets` |
| `dater piker` | nothing | 5 — the same five |
| `date-picker` | 4 — `date-picker-demo`, `-with-range`, `-with-presets`, `docs-components-date-picker` | 5 — **the same four in the same order**, then `beui/date-range-picker` |
| `sidebar` | 25 (20 shown) — `sidebar`, `docs-components-sidebar`, `sidebar-01…16`, … | 25 (20 shown) — **row for row identical** |
| `calendar` | 6 — `calendar`, `docs-components-calendar`, `calendar-demo`, `calendar-hijri`, `heat-calendar`, `returns-calendar` | 6 — **row for row identical** |
| `buton` | nothing | 40 — `shadcn/button`, `beui/button`, … |
| `sbidear` | nothing | nothing — two edits from `sidebar`, and the bound is one |

Cost of the word/typo scan, measured in the page, 9 samples each, four queries that all land on the empty state
so the DOM work is identical. Two runs: control `zzz` (under five letters, never reaches the scan) **11.1** then
**6.4 ms** median; `zzzzz` **4.8 / 6.9**; `zzzzz qqqqq` **5.9 / 10.2**; `zzzzz qqqqq vvvvv` **5.2 / 9.2** (min
1.9–5.4 ms). The scan is not separable from the noise of the render around it — it is a few ms, not a hitch.

---

## What still works (checked, not assumed)

- `shouldFilter={false}` with this file's ranking; the sr-only licence text per row; `min-h-11` rows on phones;
  focus returned on **every** close path (✕, Escape, overlay, Back, row select).
- Ctrl+K opens (dialog present, focus in `command-input`); Escape on desktop closes and returns focus to the
  input that had it (`INPUT:Filter components…` before and after).
- Page turn still 250 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, one `Element.prototype.animate` call per route.
- `python3 app/check_chrome.py` → **exit 0**, 16 shell files scanned (this file included).
- **0 page errors** and 0 failed resource requests of the page's own. The one console entry the pass sees is
  Chromium's own `GET /favicon.ico → 404` on every route: `index.html` declares no icon, the shell never had
  one, and that file is not mine.

## Not done / unsure

- **The desktop result row is 32 px, not 44.** Reason above; it is a deliberate density call, the only element
  inside the palette under 44 at 1440, and a one-class change if the review disagrees.
- **The palette's own keyboard legend is unchanged on desktop** (`↑↓ move ↵ open esc close ⌘K`) — now with a
  real `Close` button beside it rather than instead of it.
- The `.page` scroller (not `body`) is what actually scrolls on a phone; Radix locks `body` and the palette
  never touched `.page`, before or after. Lock state is reported as `body`'s computed `overflow`, which is what
  the registry dialog sets and restores, and it is `hidden` while open / `visible` after at both widths.
- I did not touch `provenance.tsx`, and it can now be seen over the palette: on `#/chrome` the tag layer's
  `focusin` listener fires on the field (the palette's `Command` root carries `data-catalog-item`), so opening
  the palette there raises a tag — measured at 1440: `shadcn/font-instrument-sans · used 1×`, a second
  `role="dialog"` (a Radix Popover), not raised at 390 in the same run. It is visual only (the tag's layer is
  `pointer-events: none`, so it eats no taps), it is one route on desktop, and the fix belongs in that file, not
  this one. Flagged, not patched.
