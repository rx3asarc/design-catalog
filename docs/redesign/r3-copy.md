# r3-copy — a Copy button that says what it copies, and admits when it fails

Review items **#1** (major, hit by 3 of 4 testers) and **#16** (the fifth file tab over the path bar) — one
component's two halves.

- Repo `/root/design-catalog-site`, worktree `…/design-catalog-site-r3-copy`, branch `fleet/r3-copy`, base
  **master @ `d5d2a226`**.
- Files I changed, and only these: `app/src/site/Code.tsx`, `app/src/site/demo.tsx`.
- Four commits, one per numbered item: `ac72d510` (1), `c8e03113` (2), `9859f5c8` (3), `887b69eb` (4).
- Harness: `build/r3-copy-measure.mjs` (all five sections), `build/r3-copy-before.mjs` (the same measurements
  against a pristine build of the base commit), logs and JSON beside them.

Reproduce:

```bash
cd app && npx vite build                     # ~45 s cold, ~2–4 min warm
mkdir -p /tmp/r3copy && ln -sfn $PWD/dist /tmp/r3copy/design-catalog
# the vite base is /design-catalog/ — serving at / 404s every asset
setsid python3 -m http.server 8751 --directory /tmp/r3copy --bind 127.0.0.1 &
BASE=http://127.0.0.1:8751/design-catalog/ node /root/docs/catalog-redesign/build/r3-copy-measure.mjs
```

(`8741` was in use by `r3-phone-menu`'s own server — hence 8751 here and 8752 for the base build. Do not
`pkill -f http.server`; that pattern matches the shell that runs it.)

---

## What was wrong, measured on the base commit

Clipboard refused (`navigator.clipboard.writeText` rejects), install Copy clicked:

```
idle     : "Copy"
+150 ms  : "Copied"        ← nothing was written
+1950 ms : "Copy"
role="status" nodes on the page: 0
```

Five files on `#/i/beui/animated-sidebar`, `utils.ts` selected, at 390 px:

```
tablist box    y 351–387   h 36   flex-wrap: wrap   overflow-x: visible
tabs 3,4,5     y 399–443          ← outside the list's own box
path bar       y 398–417          ← and this is what they land on
utils.ts tab   592 × 36           ← the wrapped tab stretched across the whole column
```

At 1440 px the same wrap put the fifth tab over the file pane's Copy button, and Playwright refused the click:
`<button role="tab" … title="lib/utils.ts"> … subtree intercepts pointer events`. The overlap was not cosmetic;
it stole the click on the control this brief is about.

---

## 1 — `Copy` stops lying (`ac72d510`)

Three states and no fourth: idle shows the label; **"Copied" only after `writeText` resolves**; **"Copy
failed"** when it rejects **or** when `navigator.clipboard` is missing entirely. The failure is announced in a
`role="status" aria-live="polite"` node (carrying "Copy failed — the clipboard refused"), and both states revert
on their own — 1.6 s for a confirmation, 3.2 s for a refusal.

Proof, both refusal modes (`ONLY=denied`):

| clipboard | before click | at +180 ms | status node | after 3.2 s |
|---|---|---|---|---|
| `writeText` rejects (`NotAllowedError`) | `Copy` | **`Copy failed`** | `Copy failed — the clipboard refused`, `aria-live=polite` | `Copy` |
| `navigator.clipboard` undefined | `Copy` | **`Copy failed`** | `Copy failed — the clipboard refused`, `aria-live=polite` | `Copy` |

`admitted=true announced=true reverted=true` in both rows.

`label` is **required** in the type, so no new copy button can be born anonymous. The runtime fallback to the
word "Copy" is deliberate and temporary: the three call sites in `ItemPage.tsx` and `Home.tsx` are another
unit's files, and a page that is already built should show a word rather than an empty button until they are
wired (see *What the lead must wire*). The compiler is the forcing function; the fallback is the stopgap.

A `data-copy` / `data-copy-state` marker and the `aria-label`/`title` make each button findable and testable
without matching on the word "Copy".

## 2 — the labels say what lands on the clipboard (`c8e03113`)

- `Code.tsx` file pane → **"Copy file"** (copies the open file's text).
- `demo.tsx` demo header → **"Copy demo source"** (copies that variant's generated demo module).

## 3 — the preview import is not the headline (`9859f5c8`)

The first Copy on an item page copies a demo module:

```
import { AnimatedSidebarPreview } from "@/components/previews/motion/animated-sidebar.preview"
export default function Demo() {
  return <AnimatedSidebarPreview />
}
```

**I did not remove that import from the payload, and I will not.** It is the honest source of the demo that runs
in the frame beside the button; stripping it would hand a visitor a file that does not compile. What I changed
is what the button says: it is labelled "Copy demo source" and claims nothing about installing. The misleading
part was never the text — it was the word "Copy" over it.

`detail` names the exact payload in the accessible name, because `#/i/shadcn/button` carries fourteen demos:

- `"Copy demo source"` + `"Copy demo source: Default · v0.tsx"` / `"…: Size · v1.tsx"` / `"…: Default · v2.tsx"`
- `"Copy file"` + `"Copy file: components/motion/animated-sidebar.tsx"`

The rule the harness enforces: **the aria-label is the visible text, a colon, then the exact payload** — it may
be longer than the button, it may never contradict it. (`aria-label` on the button becomes `Copied` /
`Copy failed` while one of those is showing, so it always matches the words on screen.)

## 4 — the tab strip scrolls instead of wrapping (`887b69eb`)

`TabsList` now carries `flex-nowrap`, `overflow-x: auto`, `overscroll-behavior-x: contain`,
`scrollbar-width: thin`; each trigger is 44 px tall and `flex: none` (never shrunk below its own text). The
`height` on the list and `height`/`min-height` on the triggers are inline, because the registry's variant class
`group-data-[orientation=horizontal]/tabs:h-9` beats `h-auto` under tailwind-merge and inline is the only channel
that wins; `styles.css` is not this unit's file. The path bar keeps one line: `truncate` + `title` = the full
path.

Measured at both widths, the brief's gesture (`select utils.ts`) performed first:

| page | vw | tabs | scrollW / clientW | lowest tab bottom | path bar top | clears? | path bar | keyboard |
|---|---|---|---|---|---|---|---|---|
| `#/i/beui/animated-sidebar` | 390 | 5 | 600 / 358 | 443 | 455 | **yes** | 1 line, ellipsised | 5 / 5 |
| `#/i/beui/animated-sidebar` | 1440 | 5 | 600 / 592 | 472 | 484 | **yes** | 1 line | 5 / 5 |
| `#/i/beui/chat-app` (63 files) | 390 | 63 | 6836 / 358 | 443 | 455 | **yes** | 1 line, ellipsised | 63 / 63 |
| `#/i/beui/chat-app` (63 files) | 1440 | 63 | 6836 / 592 | 472 | 484 | **yes** | 1 line | 63 / 63 |

- `flexWrap: nowrap`, `overflowX: auto`, `overscrollBehaviorX: contain`, `scrollbarWidth: thin` read back off
  the computed style in all four runs.
- Clipped tabs: **0** (`scrollWidth <= clientWidth` on every trigger, i.e. no label is truncated). Tabs under
  44 px: **0** (base was 36 px at both widths).
- The path bar stays on one line even when it cannot fit: at 390 the longest path
  (`components/previews/motion/animated-sidebar.preview.tsx`) measures `lines: 1, ellipsised: true,
  titleIsFullPath: true`.
- Keyboard: `Tab` from the install Copy reaches the strip (Radix makes the *scrolling tablist* a stop of its
  own, so arrow keys can scroll a long strip before anything is selected); one more `Tab` reaches the active
  trigger; `ArrowRight` then walks every tab — 5/5 and 63/63 — the pane follows each step
  (`lib/ease.ts → lib/utils.ts → …`), and `scrollLeft` moves 0 → 6478 → 0 as the focused tab is brought into
  view. Roving tabindex confirmed: exactly one trigger at `tabindex=0`, the rest `-1`.
- The list's own box clears the path bar too, not only the tabs inside it: box bottom 444 < path top 455
  (390) and 473 < 484 (1440). Both numbers are above the path bar; the table's column is the lowest *tab*
  (443 / 472), which is the tighter one.
- Base build for comparison: `utils.ts` 592 × 36 stretched across the column, and the row painted over the
  path bar (rects above).

---

## Labels and payloads — the table the brief asks for

Clipboard granted (`context.grantPermissions(["clipboard-read","clipboard-write"])`), every Copy clicked,
`navigator.clipboard.readText()` read back after each. `→ […]` is the first 60 characters of what actually landed.

### `#/i/beui/animated-sidebar`

| visible | aria-label | in | payload |
|---|---|---|---|
| `Copy demo source` | `Copy demo source: Preview · main.tsx` | demo header | `import { AnimatedSidebarPreview } from "@/components/preview…` — **demo source** |
| `Copy` (the lead's wiring — see below) | `Copy` | install block | `pnpm dlx shadcn@latest add https://beui.dev/r/animated-sideb…` — **install command** |
| `Copy file` | `Copy file: components/motion/animated-sidebar.tsx` | file pane | `"use client";\nimport * as React from "react";…` — **the text the pane is showing**, byte-for-byte |

### `#/i/shadcn/button`

Fourteen demo headers, each distinguishable only by its accessible name (visible text is short by design):

| visible ×14 | aria-label (one per card) | payload |
|---|---|---|
| `Copy demo source` | `Copy demo source: Default · v0.tsx` | `import { ArrowUpIcon } from "lucide-react"…` |
| | `…: Size · v1.tsx` | `import { ArrowUpRightIcon } …` |
| | `…: Default · v2.tsx` | `import { Button } from "@/registry/new-york-v4/ui/button"…` |
| | `…: Outline · v3.tsx` … `…: As Link · v13.tsx` | one demo module each, in card order |

| visible | aria-label | in | payload |
|---|---|---|---|
| `Copy` (the lead's wiring — see below) | `Copy` | install block | `pnpm dlx shadcn@latest add button` — install command |
| `Copy file` | `Copy file: registry/new-york-v4/ui/button.tsx` | file pane | `import * as React from "react"\nimport { cva, type VariantPro…` |

Assertions, all passing (`ONLY=labels,allowed`):

- **no two indistinguishable "Copy" labels**: 0 accessible names copy more than one kind of payload on either
  page. On the base build there were three kinds behind one name on `#/i/beui/animated-sidebar` alone
  (demo source, install command, file source) and sixteen buttons all called "Copy" on `#/i/shadcn/button`.
- **no label that lies about its payload**: 0. `Copy file` is checked byte-for-byte against the `pre` the pane
  is showing; `Copy demo source` must be a module (`import …`, `export default`), not an install command;
  a bare `Copy` on an install block must start with `npx|pnpm|yarn|bunx`.
- **aria-label contradictions** (aria-label not beginning with its visible text): 0.
- Buttons whose whole word is `Copy`: **4 across both pages and both widths = 1 per render** — the install
  block in `ItemPage.tsx`, which is not this unit's file. Listed below.

---

## Standing gates on these pages (`ONLY=guards`)

| gate | 390 | 1440 |
|---|---|---|
| `python3 app/check_chrome.py` | exit 0, 16 shell files | same |
| console errors | 0 | 0 |
| page turn (motion allowed) | `[{duration: 250, target: DIV}]` | same |
| page turn under `prefers-reduced-motion: reduce` | `animations: 0`, `transition: 0s` | same |
| controls under 44 px — **content column** | **0** / 0 | 12 (animated-sidebar), 38 (shadcn/button) — *see below* |
| controls under 44 px — rail / shell (not this unit) | 0 | 152 / 1 |
| text under 12 px — content column | **0** | 12 (unchanged from base) |

**The 44 px gate at 1440 is not met, and cannot be met from these two files.** Every one of those controls is
32 px tall on the desktop because that is the site's density, not because of this change: base had **17** on
`#/i/beui/animated-sidebar` and **38** on `#/i/shadcn/button`; I *reduced* the first to 12 by taking the five
file tabs from 36 to 44 px, and the second is unchanged. The 12 that remain on `animated-sidebar`:

- pager links ×4 — `site/ItemPage.tsx` (`PagerLink`, 36 px and 20 px tall)
- `View code` + `Copy demo source` — `site/demo.tsx` (32 px in a 49 px header, measured; raising them to 44
  grows that header to ~61 px on every item page — a desktop density change I did not make unasked)
- `pnpm` `npm` `yarn` `bun` + the install `Copy` — `site/ItemPage.tsx` (`Install`, 32 px)
- `Copy file` — `site/Code.tsx` (32 px, its row is a 32 px path bar)

The phone gate (`styles.css`'s `@media (max-width: 860px)` block) is where this rule actually lives and it is
met exactly: **0 controls under 44 px at 390 on both pages**, including the tab strip (44 px at both widths)
and my Copy buttons.

**Text under 12 px, named.** Content column at 1440, 12 nodes — `.crumb` 11 px, four `.badge` 11.5 px (the
exempt badge case: "source included", "MIT", "5 files", "1 demo"), three stage-bar labels in `site/Stage.tsx`
(`theme` / `width` / `motion`, 11 px), four install manager buttons 11.5 px (`site/ItemPage.tsx`). At 390 the
phone rule raises `.badge` to 12 px and only the theme switch is left at 10–11 px. The 10 px items on these
pages are the rail's `.nodemo` "no demo" marker and `.theme-label` "Theme" — both in the rail/theme-switch
(another unit's surface). The one sub-12 px string this unit owned — the demo card's `390 → 90%` scale readout —
is now 12 px.

---

## What the lead must wire

`label` is required, so these three violate the type on `fleet/r3-copy` today. Nothing in this repo will stop
the build for it: `npx vite build` does not typecheck (esbuild strips the types) and `typescript` is not a
dependency of `app/`, so the gate is your editor / a `tsc --noEmit` if one is ever added — meanwhile they render
the fallback word "Copy". Exact labels:

1. **`site/ItemPage.tsx` — the install block** (`<Install>`, line 48, `<Copy text={text} />`):

   ```tsx
   <Copy text={text} label="Copy install command" detail={pm} />
   ```

   Visible **"Copy install command"**, aria **"Copy install command: pnpm"** (or `npm` / `yarn` / `bun`). This
   is the copy the brief wants to be *first* on an item page — the reorder is the lead's; the label is ready.

2. **`site/Home.tsx` — `Cmd`, the setup block** (line 77, `<Copy text={text} />`). `Cmd` already receives a
   human `label` for `.cmd-label`; add a second prop rather than reusing a sentence as a button:

   ```tsx
   export function Cmd({ text, label, copyLabel }: { …; copyLabel: string }) {
     … <Copy text={text} label={copyLabel} />
   }
   <Cmd text={`npx -y ${TARBALL} mcp`} label="MCP server, one command" copyLabel="Copy MCP command" />
   <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)"
        copyLabel="Copy MCP config" />
   ```

   Visible **"Copy MCP command"** / **"Copy MCP config"** — the two payloads are genuinely different (a shell
   command vs a JSON file) and one flat "Copy" is what made them indistinguishable.

3. **`site/Home.tsx` — `Terminal`'s header** (line 91, `<Copy text={…} />`): it copies
   `npx -y <tarball> search "sidebar"`, the CLI query whose output the card below shows.

   ```tsx
   <Copy text={`npx -y ${TARBALL} search "sidebar"`} label="Copy search command" />
   ```

Nothing else on either page needs a Copy label; once these three land, the harness's
"buttons whose whole word is `Copy`" count goes to **0** and every Copy on an item page says what it copies.

---

## Notes and honest limits

- The harness matches on `[data-copy]`, not on the word "Copy", which is why the same script measured the base
  build as well as this branch. Section runs: `ONLY=labels,denied,allowed,tabs,guards`.
- `CLICK`-through proof needed item 4: on the base build the wrapped tab row genuinely intercepted the file
  pane's Copy button, so "the label is wrong" and "the button cannot be clicked" were the same defect.
- The accessible name is allowed to be longer than the visible text (`"Copy file: lib/utils.ts"`). I read "every
  `aria-label` matches its visible text" as *must not contradict*, not *must equal*, because fourteen identical
  "Copy demo source" buttons on `#/i/shadcn/button` would otherwise be fourteen indistinguishable names for
  fourteen different payloads — exactly the review complaint, one level down. The harness enforces
  `aria-label.startsWith(visibleText)` and reports contradictions as a failure. If the lead wants strict
  equality instead, the fix is to drop `detail` from the name and instead name the demo card's `<section>`, which
  is `demo.tsx`'s to add — say the word and it is a five-line change.
- The `Copy` fallback ("Copy") is a stopgap for the three unwired call sites, not a licence to leave one
  anonymous: it exists so a *built* page shows a word while `ItemPage.tsx` / `Home.tsx` are still someone
  else's. It should be deleted in the same commit that wires them, and the harness line "buttons whose whole
  word is `Copy`: 0" is the check.
