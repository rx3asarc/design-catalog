# catalog-item-stage — the item page gets a stage

Unit **G4**, branch `fleet/catalog-item-stage` off `master` = `28f97e5e` in
`/mnt/HC_Volume_105573741/design-catalog-site-catalog-item-stage`. Review §3.5: the item page's preview was a
small white box with nothing that lets a visitor judge an item. It is now a stage with four controls, a measured
floor per item class, and a surface worth looking at.

Owned and touched: `app/src/site/Stage.tsx` (new), `app/src/site/ItemPage.tsx`, `app/src/site/demo.tsx`,
`app/src/site/lib.ts` (one shared predicate). **No route change was needed.** Nothing else in the prohibitions
list was touched — not `demo-main.tsx`, not `demo.html`, not `styles.css`, not `Gallery/Rail/Home/Command`,
not `gen.py`/`manifest.json`/`publish.sh`.

Harness (outside the repo, as the other units keep theirs): `/root/fleet/catalog-item-stage/`
`scan2.py` (report heights at class width), `scan3.py` (every variant, reports-0 hunt), `scan4.py` (every variant
at 350 px), `measure.py` (the table below + theme/replay/motion/controls), `assert.py` (the pass/fail lines,
computed from `measure.json`), `probe_js.py` (script-driven motion), `hygiene.py` (title + pager).
Borrowed preview: `npx vite preview --port 8813` in this worktree only.

---

## 1. The control set and its states

One console per item page (`data-stage-bar`), above the demo cards — not one per variant: `shadcn/calendar` has
6 demos and `shadcn/button` has 15, and 15 theme switches is not a stage. It opens in the state the item page
already had, so nothing a visitor did not ask for changes:

| control | states | what it does | protocol key |
|---|---|---|---|
| **theme** | `light` / `dark` | the *demo's* document only. Default = the catalogue's own theme, and it keeps following it (a `MutationObserver` on `<html>`) until the visitor picks one. Picking one shows a `follow site` button that hands the decision back. | `theme=` |
| **width** | `390` / `768` / `full` | the child's viewport. `full` = the measured lane. Narrower than the mode, the frame is **scaled**, never clipped. Default `full`. | none (parent-side; the frame is resized) |
| **motion** | `on` / `off` | `off` stops CSS animation and transition in the child. Default = the OS `prefers-reduced-motion`; when that is the reason, the bar says "your system asks for reduced motion". | `motion=` |
| **Replay** | button, motion items only | `replay=<nonce>`, 1, 2, 3… Absent — not disabled, not dead — on a static item (`shadcn/calendar`: 6 demos, 0 Replay buttons). | `replay=` |

Below 640 px the three visible words (`THEME`/`WIDTH`/`MOTION`) are dropped to keep the console out of the
demo's way; every control keeps its `aria-label`, so the accessible names do not change. Console height:
**68 px at 1440×900, 180 px at 390×844** (three wrapped rows).

Honesty, said in the bar rather than in a tooltip nobody opens (only when `motion=off`):
*"CSS motion stopped — your system asks for reduced motion. Script-driven motion keeps running."*
That sentence is measured, not assumed (see §5).

## 2. The width × height table, measured

`rendered frame` = the iframe's box on screen (after zoom). `child viewport` = what the demo actually lays out
in — this is the honest answer to "does phone mode really render at 390": **it does, and then the frame is
scaled to the column**. `stage surface` = the card surface the frame sits on (`SURFACE_MIN`), which is why a
64 px skeleton is not a white strip.

### 1440×900

| item | mode | rendered frame | child viewport | lane | stage surface | scale | lane scroll/clip |
|---|---|---|---|---|---|---|---|
| `shadcn/dashboard-01` (block, reports 2012) | phone | 365×1882 | **390**×2012 | 770 | 365×1882 | 390 → 94% | 770/770 |
| | tablet | 768×2012 | **768**×2012 | 770 | 768×2012 | 100% | 770/770 |
| | full | 770×2012 | 770×2012 | 770 | 770×2012 | 100% | 770/770 |
| `beui/bloom-menu` (block, motion/react) | phone | 390×420 | **390**×420 | 770 | 390×420 | 100% | 770/770 |
| | tablet | 768×420 | **768**×420 | 770 | 768×420 | 100% | 770/770 |
| | full | 770×420 | 770×420 | 770 | 770×420 | 100% | 770/770 |
| `shadcn/calendar` v2 (floor decides its box) | phone | 390×294 | **390**×294 | 510 | 390×294 | 100% | 510/510 |
| | tablet | 510×195 | **768**×294 | 510 | 510×200 | 768 → 66% | 510/510 |
| | full | 510×294 | 510×294 | 510 | 510×294 | 100% | 510/510 |
| `shadcn/skeleton` (component, reports 64) | phone | 390×64 | **390**×64 | 510 | 390×**200** | 100% | 510/510 |
| | tablet | 510×43 | **768**×64 | 510 | 510×**200** | 768 → 66% | 510/510 |
| | full | 510×64 | 510×64 | 510 | 510×**200** | 100% | 510/510 |

### 390×844

| item | mode | rendered frame | child viewport | lane | stage surface | scale | lane scroll/clip |
|---|---|---|---|---|---|---|---|
| `shadcn/dashboard-01` | phone | 322×1645 | **390**×1992 | 322 | 322×1645 | 390 → 83% | 322/322 |
| | tablet | 322×844 | **768**×2012 | 322 | 322×844 | 768 → 42% | 322/322 |
| | full | 250×1561 | 322×2012 | 322 | 250×1561 | column → 78% | 322/322 |
| `beui/bloom-menu` | phone | 322×347 | **390**×420 | 322 | 322×347 | 390 → 83% | 322/322 |
| | tablet | 322×176 | **768**×420 | 322 | 322×176 | 768 → 42% | 322/322 |
| | full | 322×420 | 322×420 | 322 | 322×420 | 100% | 322/322 |
| `shadcn/calendar` v2 | phone | 322×243 | **390**×294 | 322 | 322×243 | 390 → 83% | 322/322 |
| | tablet | 322×123 | **768**×294 | 322 | 322×200 | 768 → 42% | 322/322 |
| | full | 322×294 | 322×294 | 322 | 322×294 | 100% | 322/322 |
| `shadcn/skeleton` | phone | 322×53 | **390**×64 | 322 | 322×**200** | 390 → 83% | 322/322 |
| | tablet | 322×27 | **768**×64 | 322 | 322×**200** | 768 → 42% | 322/322 |
| | full | 322×64 | 322×64 | 322 | 322×**200** | 100% | 322/322 |

Reading it: the child's viewport is **exactly** 390 / 768 / the lane in every row; the frame is scaled only when
the column is narrower than the mode (`390 → 83%` on a phone) or when the demo's own content needs more width
than the mode gives it (dashboard-01 in `full` at 390 needs 413 px, so it renders at 78% and says so in its own
card header: `data-demo-scale`).

Assertions from `assert.py` (all PASS, 0 failures) — for every row, both viewports:

```
PASS  lane scrollWidth <= clientWidth            (770/770, 510/510, 322/322 — no horizontal clip anywhere)
PASS  child document scrollWidth <= clientWidth  (390/390, 768/768, 322/322)
PASS  phone/tablet: child viewport width is exactly 390 / 768
PASS  lane measured width == lane clientWidth    (the number we size with is the number available)
PASS  page scrollWidth == clientWidth            (1440/1440, 390/390)
```

## 3. Theme — the demo repaints, the catalogue does not

```
1440x900  site <html> class  '' -> ''                      (unchanged)
          child <html> class 'light' -> 'dark'              (is dark: true)
          frame src: demo.html#shadcn%2Fdashboard-01|0|theme=dark|motion=on
          'follow site' offered once pinned: true
          after 'follow site': child 'light', site ''
390x844   identical on every line
```

## 4. Replay — three clicks, three nonces, alive each time

```
before  #beui%2Fbloom-menu|0|theme=light|motion=on                (no replay= key at all)
click 1 #…|replay=1   child reports again: 4 -> 8 messages
click 2 #…|replay=2   child reports again: 8 -> 11
click 3 #…|replay=3   child reports again: 11 -> 14
static item (shadcn/calendar, 6 demos): Replay present: false
```
The nonce is only sent once it is non-zero, so an untouched page keeps exactly today's address.

## 5. Reduced motion — CSS stops, script does not

`shadcn/skeleton` is the CSS case (`animate-pulse`); `beui/bloom-menu` is the script case (`motion/react`).

```
skeleton  motion=on   getAnimations(): 3,3,3,3,5,15 CSS animations — all running
          motion=off  getAnimations(): 0 in every frame; child <html> = "light motion-off"
                         -> zero *running* CSS animations, and zero animations at all

bloom-menu motion=on   CSS animations in child: 0   all animations: 0
           motion=off  CSS animations in child: 0   all animations: 0
           -> nothing for the CSS rule to stop: it is all inline style from rAF
```

So the honest limit is measured, not asserted (`probe_js.py`): with `motion=off` the same 10 elements' computed
`transform`/`opacity` still change between two samples 250 ms apart, exactly as with `motion=on`
(`BUTTON…:matrix(2.46,0,0,4.39,…)|0.42` vs `matrix(2.53,0,0,4.55,…)|0.34`). **A parent frame cannot stop
`motion/react`.** The control says so; it does not claim otherwise, and the demo module already knows the OS
preference (`useReducedMotion`) but has no channel to hear the stage's choice — see §8.

OS default, opened with `prefers-reduced-motion: reduce`:
`child <html> = "light motion-off"`, motion item `data-state=on` for "off", and the bar reads
*"CSS motion stopped — your system asks for reduced motion. Script-driven motion keeps running."*

## 6. Controls: size, name, keyboard

Both viewports, `assert.py`:

```
8 controls in the bar, every one 44 px tall (no control under 44 px at either viewport; narrowest 41×44)
every control has an accessible name (aria-label per item + aria-label per group)
one tab stop per group: theme 2 items/1 tabbable, width 3/1, motion 2/1   (roving tabindex)
keyboard: focus "390" + Enter -> child viewport 770 -> 390
          ArrowRight -> focus 'Tablet viewport, 768 CSS pixels' + Enter -> child viewport 768
```

**A defect this unit found and fixed in its own surface:** the registry `ToggleGroup` renders every item with
`tabindex="-1"` and its roving-focus wrapper puts no tab stop back — measured, all 7 items were `-1` and a Tab
walk from the top of the page never reached the console. The checked item of each group now carries the stop
(`tabStop()` in `Stage.tsx`), which is standard segmented-control behaviour and is what the numbers above prove.
The same defect exists on the catalogue's own rail theme switch (`site/ThemeSwitch.tsx`) — §8.

Not fixed, and not this unit's: the stage console sits after the rail in DOM order, so tabbing from the very top
of the page still crosses the whole rail tree first. That is a skip-link question for the shell, not a stage one.

## 7. The floor, per class, measured

`scan2.py` mounted the first variant of every item (486) at its class's usual frame width and read the child's
own `designCatalogDemo` height report. `scan3.py`/`scan4.py` repeated it for all 754 variants, at class width and
at 350 px.

```
class                                     p25   p50   p75   p90
block (120 items, 770 px)                 430   536   608  3000
non-block (366: 133 component, 233 pattern, 510 px)   64   122   368   648
block, 350 px                             349   430   702  3000
non-block, 350 px                          64    80   266   537
```

Two different questions were being answered by one number, so they are now two numbers:

- **`FLOOR` = the reservation before a demo reports** (loading, throwing, unmeasurable).
  - **block: 900 wide / 720 phone — unchanged, and now with a reason.** A block is a page: its p90 is 3000 and
    its p75 608, so a demo landing above the reservation grows by 1.5–3 screens and drags the reader with it,
    while one landing below settles once, upward. For this class the benign direction is over-reserving.
  - **non-block: 180 (was 90).** The class median is 122 and p75 is 368; 180 sits between them so slightly more
    than half of non-block demos grow into place. 90 was never measured, sits below the class median, and is only
    26 px above the child's own 64 px clamp — which is exactly why a component demo looked like a strip.
- **`SELF_FLOOR` = the frame a demo gets when it reports height 0**, i.e. it sizes itself to its frame. There is
  no correct height to wait for, so the floor *is* the answer: block 900/720 (a page), non-block **360** — the
  class's measured p75. This is the branch the brief asked for ("a component whose demo reports 0 should not
  collapse to 90 px"), and it is now 360, not 90.
- **`SURFACE_MIN`** (the card surface under the frame): 200 for components, 0 for blocks. This is what actually
  kills the "small white box": a 64 px skeleton sits centred on a 200 px stage instead of in a 64 px strip. It is
  air, not a measurement — the frame keeps reporting its own honest height.

**Finding: no demo in this catalogue reports height 0.** 0 of 486 first variants, 0 of 754 variants at class
width, 0 of 754 at 350 px, and none of the four subjects in situ at either viewport. The child's 0 branch
(`viewportSized` in `demo-main.tsx`) exists; nothing in the data reaches it. `SELF_FLOOR` is therefore a guard
rail, verified by reading the branch and not by an item — said plainly rather than dressed as a measurement.

**Second finding, and a bug this stage exposed:** mode changes legitimately grow a demo, and the frame's
anti-oscillation watch counted those growths — three viewport switches locked dashboard-01 to the 720 floor for
the rest of the visit (its full-mode frame read 559 px instead of 1561). The watch now resets when the *address*
changes (`frameWidth`, `theme`, `motion`, `replay`) and only counts growth at a fixed request. Verified: six
consecutive mode switches stay correct (`390→1645`, `768→844`, `column→1561`, and again).

## 8. What the lead must wire

1. **`displayName` is absent on 769 of 769 manifest items.** The shell renders `displayName ?? name` exactly as
   specified and nothing is re-derived, so shadcn titles render lowercase (`button`, `dashboard-01`) while beui's
   render title-cased (`Bloom Menu`) — correct per the contract, and odd to a visitor. That is the data unit's
   field to fill; the shell is ready for it (`label()` in `site/lib.ts`, verified against the manifest by
   `hygiene.py` for 4 items, plus the pager relation `same category` on all of them — the split unit had already
   done both, so they were verified and left alone).
2. **Duplicate motion predicate.** `site/Gallery.tsx:46` carries its own `isMotion`; the stage uses
   `isMotionItem` in `site/lib.ts` (same rule, documented). One line in `Gallery.tsx` removes the duplicate — the
   gallery unit's file, so not edited here.
3. **The rail's theme switch is keyboard-unreachable** for the same registry reason described in §6
   (`site/ThemeSwitch.tsx`, three items, all `tabindex="-1"`). One line: `tabIndex={mode === m.mode ? 0 : -1}`.
4. **JS-driven demos cannot be told about `motion=off`.** `motion=off` is a CSS rule; `beui/*` demos run
   `motion/react`, whose `useReducedMotion` reads the *OS*, not the parent. If the fleet wants the stage's setting
   to reach script-driven demos, the child must expose it (e.g. `data-motion="off"` on the child `<html>`, which
   a demo can read) — a child-side change, deliberately not made here. Until then the bar's sentence is the
   honest limit.
5. **`floor` semantics changed shape**: `DemoFrame` takes a new optional `selfFloor` and `frameWidth`. Both are
   additive and default to today's behaviour, so the gallery's `DemoFrame` calls are unaffected — but the gallery
   gets the growth-watch reset for free, which is a fix it wants.

## 9. Protocol keys the child honoured at this base commit

All four, already: `theme` (sets `.dark`/`.light` on the child `<html>`; verified), `motion` (`html.motion-off *`
rule; verified), `replay` (keys the mounted demo on the nonce; verified, three times), `static` (`dc-static`
freeze + `designCatalogHover`; the gallery's half, not exercised by this unit). An absent `motion` follows the OS
in the child, an absent key of any kind means today's behaviour, and the parent sends `theme`, `motion` and
`replay` only — never `static`. So no degradation path was needed: nothing this stage sends is ignored.

## 10. Guard, build, and the preview

```
cd app && python3 check_chrome.py   ->  chrome: every interactive element is a catalogue component
                                        16 shell file(s) scanned — … site/Stage.tsx, site/demo.tsx
                                        exit 0
cd app && npx vite build            ->  ✓ built in 6.50s, exit 0
preview                             ->  npx vite preview --port 8813 (this worktree only), killed after
                                        the run; `ss -ltn | grep :8813` empty
```

Commits: `stage: an item page's preview gets a console — theme, viewport, motion, replay` and
`floor: a reservation per class and a real frame for a self-sizing demo` (message bodies carry the numbers and
the reasons above).
