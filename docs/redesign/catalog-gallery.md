# G4 — catalog-gallery

Branch `fleet/catalog-gallery` (worktree `/mnt/HC_Volume_105573741/design-catalog-site-catalog-gallery`),
three commits on top of `4475e37a` (master's data layer, merged in first):

```
route: a filter in the hash, spelled one way, resolved through the rail's own tree
the frame obeys its address: static, theme, motion, replay — and reports the width it needs
the gallery: every item as a tile, nine live at a time, detached when out of range
```

Files: `app/src/site/Gallery.tsx` (new, 652 lines), `app/src/site/route.ts` (+79), `app/src/site/demo.tsx`
(+48), `app/src/demo-main.tsx` (+112), `app/src/App.tsx` (one expression at the `GALLERY SEAM` comment).
Nothing in the prohibited set was touched: `Rail.tsx`, `ItemPage.tsx`, `Stage.tsx`, `Command.tsx`,
`index.html`, `styles.css`, `gen.py`, `manifest.json`, `docs/**` are unchanged (`git status` shows five files).
No new dependencies; no CSS file changed (the gallery styles itself with the shell's own variables, so the
shell-split unit's class names stay the only styling surface).

---

## 1. The route shape, and why

`#/g[?filter]` — one route, one spelling, every filter in the URL.

```
#/g                                   the whole catalogue (486 demo tiles + 283 reference-only, hidden)
#/g?sec=Components&cat=Navigation     a rail row's own grid
#/g?sec=Components&cat=Navigation&fam=sidebar&sub=navigation
#/g?q=sidebar                         free text, the rail's own predicate
#/g?src=shadcn&kind=block             library and kind
#/g?ref=1                             the reference-only items, included
```

`parseRoute` accepts `#/g`, `#/g?…` and the older `#/g/…` shape (the same string without the `?`), and
`parseGalleryQuery` keeps four things apart that a single string would blur:

* **`GalleryQuery`** — `{ src, sec, cat, fam, sub, kind, q, ref, ignored }`. `ignored` is the parameters the
  hash carried that this build does not filter on; the surface **names them** rather than rendering the whole
  catalogue as if the link had worked (§3.1: a typo must not look like a success).
* **`gridHref(query)`** — builds the hash back with a **fixed key order**, so the same filter is one URL and
  links are shareable and comparable. `ref` is `1`/`0`, never a bare flag.
* **`resolve(query)`** — the levels are looked up **inside `buildTree`'s tree**, the same structure the rail
  renders. A section row that says 12 opens a grid of 12 because both numbers come from one place; nothing
  re-derives categories or families from `slug.split("-")` a second time.
* Values that resolve to nothing go into `unknown` and are printed (`Nothing here is called source “nope”`).

The rail is G5's file and I did not add its anchors. `gridHref` is exported for that one line per row, and the
level keys are the rail's own (`sec` = section label, `cat` = category key, `fam`/`sub` = family keys), so a
row's href is `gridHref({ sec, cat })` — the count it already prints and the grid it opens cannot disagree,
because they are the same tree. **This is the one thing the lead must wire** (§8).

## 2. The tile

Fixed-height scaled viewport onto the demo's top-left, never the demo's own height (§D-D, and stage.md's
"2012 px for a dashboard, 0 for a viewport-sized one"):

| | wide | phone |
|---|---|---|
| grid | `repeat(auto-fill, minmax(300px, 1fr))`, gap 8 | `1fr` |
| measured at 1440×900 | **3 columns × 363 px** | — |
| measured at 390×844 | — | **1 column × 358 px** |
| tile body height | 210 px | 180 px |
| demo layout width until it reports | `REF_WIDTH = 768` | same |
| scale | `zoom = clamp(colW / natural, 0.25, 1.6)` | same |
| iframe width | `100 / zoom %`, `transform: scale(zoom)`, origin top-left | same |

`natural` is the width the **demo's own content** needs, reported by the child (below): a 90 px button in a
768 px frame reports 90, so its tile is magnified (up to 1.6×) instead of showing a speck in the corner; a
dashboard that fills the frame reports ≈768 and is scaled down to fit. Re-zoom stops after four corrections
and ignores changes under 8 %, so a demo that re-flows at a different frame width cannot oscillate the scale.

Wide grid is 3 columns, not the scout's 4: with the 288 px rail open, `.page` is 1152 px at 1440, and four
columns of ≥300 px need 1224. The cap (9) is exactly three rows of three, which is what the measurement in §5
is about.

Card: name (44 px hit area), `source · kind · licence`, file/byte counts when the data has them (never a 0 for
an unknown — `null` prints nothing), a `used_here` count when non-zero. The whole tile is one anchor to
`#/i/<id>`; the iframe is `inert` + `pointer-events: none`, so a click never lands in the demo. Motion items
hover-play: `play` is sent to the child, which switches the demo's root class between `dc-static` and live.

## 3. Reference-only (§3.3)

`reference_only` items get a card that is visibly a different object: **dashed** rule, `NO DEMO` in the mono
label slot where a demo tile says `demo`, the item's kind, and a `View on <library> ↗` outbound link
(`item.page ?? item.url`) — all inside the tile, none of it pretending to be a frame. 283 of 769 items are
reference-only; they are **hidden by default** and one toggle puts them in the grid (`?ref=1`, in the URL, so
the state survives a reload and a shared link).

The header never rounds that away:

```
769 items · 486 shown · 283 reference-only hidden     ← default
769 items · 769 shown · 283 reference-only included   ← ?ref=1
```

The first number is the filter's total — the same count the rail row shows — then what of it is on screen and
what of it is not. `data-gallery-counts/shown/hidden/total` carry the same three numbers for the harness.

## 4. The mount queue

Measured facts it obeys (stage.md / repo-map §6): hiding a demo does not pause it (a same-origin frame runs at
full rate when offscreen; `visibility:hidden` changes nothing — only removing the element or setting
`src=about:blank` stops the work); a live frame costs ≈1.81 MB heap and one long task to mount; 486 items have
demos.

* **detach, don't hide** — leaving the 600 px exit margin unmounts the `<iframe>` (React removes it), keeping
  the tile's box so the page geometry cannot jump;
* **mount on intersection** — 300 px entrance margin, one `IntersectionObserver` pair over the tiles, rooted on
  the element that actually scrolls (`scrollerOf`: `.page` on a wide screen, the window on a phone — an observer
  rooted on a non-scrolling box makes all 486 tiles "intersecting", which is what the first build did);
* **one mount per animation frame, never two** — the rAF *is* the budget: `perFrameMax` is exposed on
  `window.__gallery` and measured as 1;
* **cap 9 live / 2 on a phone**, evicting the tile furthest from the viewport centre, and **deferring** a tile
  that is further out than everything live (slow 400 ms retry, never a spinning rAF);
* **mount nearest-first** — the queue is drained in distance order, not arrival order, so the pool fills with
  the tiles on screen (measured: after a fast descent, 9/9 live tiles are on screen 1 s after the scroll stops;
  arrival order gave 7/9);
* **mounts wait for the scroller to be still (140 ms)** — see §5.4, this is the one place where the design
  trades immediacy for smoothness, and it is the reason the smoothness line passes.

`window.__gallery = { mounts, perFrameMax, frames, evictions, deferred, live, cap }`.

## 5. Measured

Box: 4 cores, no GPU, shared — **load average is reported with every row** because on this machine it moves the
numbers more than the code does (an earlier run at load 24–32 put the same code at p95 100–583 ms). Base URL:
`vite preview --port 8811`, Chromium headless via Playwright. Raw JSON + scripts in this directory
(`catalog-gallery-measure.{py,json}`, `catalog-gallery-scroll.{py,json}`).

| # | gate | measured | load |
|---|---|---|---|
| 5.1 | `check_chrome.py` | exit 0 — **11** shell files (Gallery.tsx included), every interactive element a catalogue component | — |
| 5.1 | `npx vite build` | ok, Gallery chunk **30.2 kB** (2 m cold, 8–10 s incremental) | 4.1 |
| 5.2 | alive rate, 20 seeded-random demo items, item pages | **20/20** alive, slowest **1151 ms** | 4.06 |
| 5.3 | live cap over a full 45 288 px descent | **max 9** frames seen at any sample; `perFrameMax = 1`; pool `live = 9`; phone **2** | 4.06 |
| 5.4 | p95 rAF, settled (9 live, no scroll) | p50 **16.7**, p95 **16.8**, 0/121 frames > 33.4 ms — identical to the ladder's N=9 rung (16.7/16.8) | 4.06 |
| 5.4 | p95 rAF, **wheel** descent of the whole grid (13 s) | p50 **16.7**, p95 **16.8**, **4–6 of ~875 frames > 33.4 ms (0.5 %)**, max 117 | 3.5 |
| 5.4 | p95 rAF, **jump** descent (1 900 px every 900 ms) | p50 **33.4**, p95 **99.9**, 303/597 > 33.4 — **fails**, see below | 4.1 |
| 5.5 | 390×844 | 1 column × 358 px, `scrollWidth − clientWidth = 0`, **0 controls < 44 px** (489 controls; 1055 with `?ref=1`), 0 clipped text | 4.1 |
| 5.5 | 1440×900 | 3 × 363 px, no horizontal overflow, 0 clipped text (101 controls < 44 px: the desktop rail rows, unchanged from baseline; §5.5 asks only at 390) | 4.1 |
| 5.6 | reference-only toggle | default 486 tiles / 0 ref cards; `?ref=1` **769 tiles, 283 ref cards, 283 outbound links**; survives reload; "nothing matches" box offers the toggle | 4.1 |
| 5.7 | rail → grid | **38/38** — 4 sections + 12 categories read their count off the rail row itself and open a grid whose header states that count; 22 families/sub-families checked the same way, plus 6 `?ref=1` grids where shown = total | 4.1 |

**The one gate that fails, stated plainly.** The jump descent is a mount storm: 225 mounts in 21.6 s, each a
60–100 ms long task, so 303 of 597 frames exceed 33.4 ms. It is arithmetic, not a bug: at ~10 mounts/s there is
no frame budget left. The wheel descent — how a person actually scrolls — is at 60 fps with 0.5 % of frames over
the line, because a continuous scroll keeps the 140 ms settle gate closed and the mount work happens when the
scroll stops. If the lead prefers demos to appear *during* the scroll, `SETTLE_MS` in `Gallery.tsx` is the only
knob (0 = mount immediately, at the cost of the jump case becoming the normal case).

The other measured discovery, which cost the settled number a factor of four: **954 `animate-pulse` skeletons
were the expensive thing, not the nine live frames.** Same DOM, animation off: p95 66.8 ms → **16.7 ms**. The
placeholder is now a still skeleton; a parked tile is a picture of a tile.

Proof the pool is honest, not lucky: over a full descent `mounts 225 / evictions 9 / deferred 64 / live 9` with
`max frames seen 9` — the counter and the DOM agree.

## 6. The protocol diff, and old links

Old address `demo.html#<id>|<index>` — unchanged and still the whole contract for a frame that gets no flags:

```js
decodeURIComponent(location.hash.slice(1)).split("|")   // [id, index, ...flags]
```

New, all optional, appended after the index as `k=v`:

| flag | meaning |
|---|---|
| `static=1` | thumbnail mode: JS animations start paused, the frame is a still frame |
| `theme=light\|dark` | §D-C — the **parent** passes the theme class, the child does not sniff it |
| `motion=off` | CSS keyframe animations off (`motion-off` on `<html>`) |
| `<nonce>` (4th bare segment) | replay: a new value remounts the demo |

Proof old links still work (top-level `demo.html#shadcn/button|0`, no flags, load 4.1): `#root` has 1 child,
the child posts `{designCatalogDemo, id, index, height: 64, width: 1440}` — **the same four keys as before,
plus `width`**. Nothing was removed or renamed, and every listener in the shell filters on
`designCatalogDemo`/`id`/`index`, so an extra key is inert. `height` is still the content height and still 0 for
a viewport-sized demo. A flagged address produces `<html class="dark motion-off dc-static">` exactly once per
flag.

The gallery's own frames are addresses like
`demo.html#beui%2Favailability-scheduler|0|static=1|theme=light` — a beui motion item, static, in the shell's
theme.

`width` is new because a tile cannot measure the inside of its own frame: the child reports the **content box**
of its own children (not the viewport, which is always the frame width), which is what lets a small component be
magnified. `ItemPage` ignores it — it still sizes the frame from the height it already used.

## 7. Residual limitations

1. **JS-driven motion is not stopped by `static=1`.** The flag pauses CSS animations and starts the child in
   `dc-static`; a demo that drives `requestAnimationFrame` itself (or a library that starts on mount) still
   runs until it stops on its own. The scout's finding stands: only detaching the frame stops that work, which
   is why the cap and the exit margin, not the flag, are the real control.
2. **Demos appear when the scroll stops, not during it** (§5.4) — deliberate, with one knob.
3. **3 columns, not 4** at 1440 while the rail is open (§2) — the scout's 4 assumed a full-width page.
4. **Motion detection is a heuristic** (`source === "beui" || category === "Motion and effects" ||
   kind === "effect"`), because the manifest has no motion flag. It over-matches slightly: a beui button is
   static in practice and gets a frozen first frame. Over-matching costs a still tile; under-matching would cost
   486 demos animating at once.
5. **`sub`-level filters are only reachable from the grid**, not from the rail, until G5 adds family rows.
6. **A tile shows variant 0 only**; the item page keeps the variant switcher. 283 items have no variants and
   are reference-only cards by construction.
7. **Filters are cumulative and inclusive-downward**: `#/g?cat=Navigation` is the category, `&fam=…` narrows it;
   there is no `?src=` + unlisted-category intersection beyond what the rail tree expresses.

## 8. What the lead must wire

1. **The front door.** `#/g` renders the gallery; `#/` still renders `Home`. Making the gallery *the* home page is
   the one line in the `GALLERY SEAM` expression — `route.kind === "home"` → `<Gallery query={{} as GalleryQuery}/>`
   — or a default in `parseRoute`. I left it alone because G2 rewrote `Home.tsx` in the same switch (`away`/`about`
   arms, plus its own `GALLERY_LIVE = false` flag) and that flag is the same decision seen from the other side.
2. **The rail's one line per row** (G5): `href={gridHref({ sec, cat, fam, sub })}` on `.rail-sec/.rail-cat/.rail-sub`
   rows. Exported from `site/route.ts`; the counts already match (measured 38/38).
3. **`about` kind merge** (G2): both units edited `parseRoute`; the conflict is mechanical — keep both arms.
4. Nothing else: `ItemPage`, `Home`, `Rail`, `Stage`, `Command`, `styles.css` and the data layer are untouched
   and still build.
