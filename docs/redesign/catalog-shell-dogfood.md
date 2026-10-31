# G5 — catalog-shell-dogfood

Branch `fleet/catalog-shell-dogfood`, cut from `4475e37a` (lead's merged `master`).
Repo: `/mnt/HC_Volume_105573741/design-catalog-site-catalog-shell-dogfood` (`/root/design-catalog-site` is master's worktree).
Three moments, not thirty: a palette, a page change, a page that counts itself.

Commits (each message says what and why):

```
53bac568 the shell searches itself: a cmd+k palette over all 769 items
a1fb6235 a page change arrives on a transition the catalogue publishes, not one we invented
53092cad the chrome page counts from the manifest, and labels a zero instead of excusing it
```

New files: `app/src/site/CommandPalette.tsx`, `app/src/site/PageTurn.tsx`. Rewritten: `app/src/site/ChromePage.tsx`.
No dependency added. `app/node_modules` symlinked to `/root/design-catalog-site/app/node_modules` for the build.

---

## 1. The palette — `site/CommandPalette.tsx`

**Search fields** (client-side, over `manifest.json`, no index, no server): `displayName ?? name`, `slug`,
`source`, `category`, `concepts`. Everything is lowercased once at module load (`DOCS`), so a keystroke is a
walk over 769 prepared rows, not over raw JSON.

**Ranking** (`export function search(q)`), first match wins:

| rank | match | example |
|---|---|---|
| 0 | name starts with the query | `sidebar` → `sidebar` |
| 1 | name or slug contains it (the slug is the machine form of the name) | `sidebar` → `sidebar-07` |
| 2 | a `concepts` entry, then `category`, contains it | `chart` → `chart-area-axes` |
| 3 | the `source` contains it | `transitions` → all 43, none of which name it |

Ties: shorter name first, then case-insensitive alphabetical with the all-lowercase spelling first (ICU puts
`sidebar` before `Sidebar`). Cap 20 rows; the group heading states the real total (`20 of 25 matches`).

**Empty query is not a blank list.** It is the 9 items the manifest says this shell runs on, headed
"the shell you are reading runs on these 9" — the one answer that is both true and useful before you type.

**Result row**: name, source (`font-mono`), kind as the catalogue's `Badge`, a licence dot whose colour is the
licence string (`MIT` green / `MIT with no-redistribution clause` and `NOASSERTION` amber / `unclear` red, the
same oklch tones as `.badge.ok|warn|bad`), `licence …` for screen readers, and `no demo` (registry
`CommandShortcut`) on reference-only items. Selecting navigates to `#/i/<id>`.

**Components**: the registry `command.tsx` (`Command`, `CommandInput`, `CommandList`, `CommandEmpty`,
`CommandGroup`, `CommandItem`, `CommandShortcut`) and the registry `dialog.tsx` (`Dialog`, `DialogContent`,
`DialogHeader`, `DialogTitle`, `DialogDescription`). `CommandDialog` was **not** used: it hardcodes its inner
`Command` and drops every extra prop on `Dialog`, so `shouldFilter={false}` cannot reach it — and without that
the shipped ranking is replaced by cmdk's own. This is the same composition `CommandDialog` performs, with the
one prop that matters.

**Trigger — where and why.** The shell's topbar is `display:none` above 860 px (`styles.css:197`), and the rail
head is `site/Rail.tsx`, which this brief forbids. So: one component, two mounts, media-conditioned rather than
JS-switched — a 44 px `Search 769 ⌘K` control in the phone topbar, and a floating pill bottom-right on desktop
(`max-[860px]:hidden`). Exactly one is ever on screen; the hidden one is `display:none`, so it is out of the
accessibility tree too.

**Keyboard.** `mod+k` opens anywhere and toggles closed; `↑/↓` move (cmdk); `Enter` opens the selected row;
`Esc` closes. Focus is trapped (`[data-radix-focus-guard]` ×2 present) and the dialog announces itself:
`role="dialog"`, `aria-labelledby` → "Search the catalogue", `aria-describedby` → the 769-item sentence.

Two things the brief said to verify rather than assume, and both were wrong in the obvious implementation:

- **Focus return.** With no `DialogTrigger`, the registry dialog has nothing to hand focus back to: measured
  `document.activeElement` was `BODY` after Esc, after an overlay click, and after selecting a row. The palette
  records the element it opened from and restores it itself (`requestAnimationFrame` after close). Measured
  after the fix: `Filter components` — the same element that had focus before opening.
- **Enter on the empty state.** cmdk's root keydown calls `preventDefault()` on `Enter` for the selected row,
  which cancels a `<button>`'s default click, so `Clear the query` was dead to the keyboard. It now stops the
  key before cmdk sees it (`e.stopPropagation()`).

**A data finding, not a code one.** The concept tier cannot fire today: all 95 concept entries are already a
substring of their own item's name, slug, category or source (`95 of 95`), so no query reaches rank 2 without
matching rank 0/1 first. The branch is live and correct; it starts mattering when the data unit publishes a
concept that is not the item's own name. Reported, not hidden.

---

## 2. The page change — `site/PageTurn.tsx`

**Item: `transitions/page-side-by-side`** (Transitions.dev; 43 `transitions` items, 32 with CSS+React, all
`local-only` — licence "MIT with no-redistribution clause"). Read in the store (`/root/design-catalog`, items
763–775) and **re-implemented, not copied**: this file is our code. Taken from the item:

```
duration 250 ms · ease cubic-bezier(0.22, 1, 0.36, 1) · distance 8 px
the page arrives from the side it travels from, fading in on opacity
```

Two deliberate deviations, both from the brief and the taste canon:

1. **Only the incoming page animates.** The item animates two absolutely-positioned page siblings; this shell
   has one scroller (`.page`), and keeping the outgoing page mounted to watch it leave is a cost with no reader.
2. **The item's 3 px `blur()` is dropped.** Opacity and transform only — never layout, and never a filter pass on
   every frame of a route change.

Measured from `document.getAnimations()` on the element carrying the tag, at 1440×900: `duration 250`,
`easing cubic-bezier(0.22, 1, 0.36, 1)`, `delay 0`, `iterations 1`, `fill none`, animated properties
`["opacity","transform"]`, and the animation is present in `document.getAnimations()` at start.
Under `prefers-reduced-motion: reduce`: `animate()` is never called — 0 calls, `document.getAnimations()` 0.
The route change still leaves `.page.scrollTop` at 0 (measured 400 → 0); that is still `useScrollReset`'s job
(`site/route.ts`), untouched.

`.page-in` is **not** removed: it is styling inside `Home.tsx`/`ItemPage.tsx`, which this brief forbids, and the
transition is an element *around* the switch, not a class on each page. Nothing was replaced, so nothing lost.

Tag: `data-catalog-item="transitions/page-side-by-side"` on the wrapper that animates (1 element, always).

---

## 3. `#/chrome` — data, not memory

**Data path, end to end:**

```
app/gen.py:251  used_here()      greps data-catalog-item="…" out of every shell file (src minus the copied dirs)
     ↓
app/manifest.json  [].used_here  build artifact: how many tags name that id in the source
     ↓
site/ChromePage  rows = MANIFEST.filter(used_here > 0)          ← the id list, no array in this file
     ↓
../provenance  useUsage()        MutationObserver over [data-catalog-item] → per-view DOM counts
     ↓
count column = counts[id] ?? 0   same store the hover tag reads, so the two cannot disagree
```

**The mismatch policy.** `used_here` counts tags in the source; the count column counts what *this view* mounted.
They are different measurements, so a `0` is classified by evidence rather than excused in prose (the paragraph
that used to explain the page's own zero is gone):

| state | when | what the row says |
|---|---|---|
| live | DOM count > 0 | the number |
| not this view | 0 here, seen in another view this session | badge `not this view` |
| unseen | 0, nothing this session has run it | badge `unseen` — and the row is the link that settles it |

The session memory is a `Set` fed by the same `useUsage()` snapshots — not a list.

**Real contradictions get their own table** ("Where the DOM and the manifest disagree"), because there are some,
and they are not the same thing as a page-scoped zero:

| tag in the DOM | the manifest | meaning |
|---|---|---|
| `shadcn/command` | `used_here: 0` | this unit's palette; the manifest predates the tag — `python3 app/gen.py` moves it up |
| `transitions/page-side-by-side` | `used_here: 0` | same: this unit's transition |
| `shadcn/table-row` | **not a catalogue item** | pre-existing tag (kept, it is what makes rows hoverable); it names nothing, so no page can open it |

The brief's rule — `used_here > 0` and DOM 0 is a tagging bug — is applied only where it is provable. On a cold
load of `#/chrome`, 4 of the 9 rows are 0 for the honest reason that this view does not mount them (badge, tabs,
scroll-area, popover-tag): `used_here` > 0 and DOM 0 there is not a contradiction, it is the definition of a
per-view count, and badging it "mismatch" would be this page inventing a fault. Visit an item page and come
back and they read `not this view` — measured, see §4. A row that stays `unseen` *after* its page has been
visited is the real bug, and the page says exactly that.

The three moments and the identity unit's fonts are rows like everything else, from the same data: the palette
appears in the drift table the moment it is open (`n=1`), the transition is `n=1` always, and
`shadcn/font-instrument-sans` / `shadcn/font-jetbrains-mono` join the main table as soon as the identity unit's
tags land and `gen.py` reruns — nothing in this file hard-codes them.

At 390 the sentence column drops (`max-[860px]:hidden`) and each row link clears the 44 px tap floor; the table
scrolls sideways no more.

---

## 4. Measurements (borrowed preview on 8815, killed in the same command; `ss -ltn | grep :8815` empty after)

`cd app && python3 check_chrome.py` → **0** — "every interactive element is a catalogue component",
**12 shell files scanned** (the glob picks up `site/CommandPalette.tsx` and `site/PageTurn.tsx` with no edit).
`npx vite build` → **0** (✓ built in 1m 12s / 1m 20s on the last two runs). 0 page errors during the whole
verification.

| # | measurement | 1440×900 | 390×844 |
|---|---|---|---|
| 1 | `document.scrollWidth == clientWidth` (home) | 1440 = 1440 | 390 = 390 |
| 1 | idem on `#/chrome` | 1440 = 1440 | 390 = 390 |
| 2 | palette trigger box | float 139×36 @ right 16, top 848 | topbar 100×**44** |
| 2 | `mod+k` opens; focus inside; focus on | yes; `[data-slot=command-input]` | same |
| 2 | announce | `role=dialog`, `aria-labelledby`→"Search the catalogue", `aria-describedby`, 2 focus guards | same |
| 2 | empty query | 9 rows, heading "…runs on these 9", first auto-selected | same |
| 2 | `sidebar` → results | 20 shown of 25 matched; first = `sidebar` (`shadcn/sidebar`); rank cross-check vs an independent implementation: 4/4 queries identical (`sidebar`, `thinking`, `shadcn`, `chart`) | 20 rows |
| 2 | `Enter` on top hit | `#/i/shadcn/sidebar`, `data-route=item`, dialog closed, `.page.scrollTop` 0 | same |
| 2 | `Esc` | closes, focus → `Filter components` (where it was) | closes |
| 2 | `mod+k` again | toggles closed | — |
| 2 | empty result `zzzqqq` | 0 rows, honest sentence, `Clear the query`; Tab → button, Enter → query cleared, 9 rows | — |
| 2 | palette width | — | dialog 374 px = **96 %** of viewport; `scrollWidth 372 == clientWidth 372` (list too), document 390 = 390 |
| 3 | transition from `getAnimations()` | 250 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, props `[opacity, transform]` | — |
| 3 | `prefers-reduced-motion: reduce` | 0 `animate()` calls, `getAnimations()` 0 | — |
| 3 | route change scroll reset | 400 → 0 | — |
| 4 | `#/chrome` rows | 9 = `manifest.filter(used_here>0).length` 9 | 9 |
| 4 | rows whose printed number ≠ `querySelectorAll` count | 0 (none) | 0 |
| 4 | live counts on that view | button 8, collapsible 23, input 1, sidebar 1, table 2, popover 1 (tag showing) | same |
| 4 | after visiting a multi-file item page | badge `not this view`, tabs `not this view`, scroll-area `not this view` | — |
| 5 | tap targets < 44 px, this unit's surfaces | — | palette rows 0, `#/chrome` 0 |
| 5 | tap targets < 44 px, whole page | — | **4**, all inline prose links in `Home.tsx` (see COULD NOT DO) |

---

## 5. The exact `App.tsx` lines the lead must re-apply (7 added, 0 removed, nothing else touched)

```diff
@@ imports, after `import { ChromePage } from "./site/ChromePage";`
+import { Palette, PaletteTrigger } from "./site/CommandPalette";
+import { PageTurn } from "./site/PageTurn";

@@ inside <div className="topbar">, after the brand link
+        <PaletteTrigger place="bar" />

@@ inside <SidebarInset className="page" …>, before the route switch
+        <PageTurn hash={hash}>
@@ … and after the switch's closing brace, before </SidebarInset>
+        </PageTurn>

@@ before <Provenance />
+      <PaletteTrigger place="float" />
+      <Palette />
```

The switch's own lines were not re-indented, on purpose: the diff is 7 added lines and 0 removed, so a conflict
in `App.tsx` is re-appliable by hand in under a minute.

---

## COULD NOT DO

- **0 tap targets under 44 px at 390 is not met shell-wide: 4 remain**, and all four are inline `<a>` inside
  prose in `app/src/site/Home.tsx`, which this brief forbids me to touch:
  `Start with button` (16 px), `whole dashboard` (40 px), `CHECKSUMS.txt` (16 px),
  `what it is made of, counted` (16 px). WCAG 2.5.8 exempts targets inline in a sentence, so this may be a
  non-issue by the standard while still failing the brief's flat assertion. Everything this unit added measures
  0 at 390.
- **`python3 app/gen.py` was not run** (`app/gen.py` and `app/manifest.json` are prohibited here), so
  `used_here` does not yet know about `shadcn/command` or `transitions/page-side-by-side`. The chrome page shows
  that gap as data instead of hiding it; one gen.py run moves both rows into the main table.

## UNSURE

- The brief's literal mismatch rule (`used_here > 0` ∧ DOM 0 ⇒ "bug in tagging") would badge 4 rows on a cold
  `#/chrome` load that are merely page-scoped. I classify by session evidence instead and reserve contradiction
  for the provable class (DOM runs what the manifest calls unused, or tags an id that is not a catalogue item).
  If the lead wants the blunt version, it is one `classify()` change — but it would make the page cry wolf.
- The desktop trigger is a floating pill rather than something in the shell's own frame: the topbar is
  phone-only and the rail head belongs to another unit. If a later unit puts a control in the rail head, the
  float should go, not stay as a second way in.
- Concepts (95 entries) currently add nothing to the ranking (§1). That is the data's shape, not a bug I can fix
  from `site/`.
