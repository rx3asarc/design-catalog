# G3 — catalog-identity: one typeface, and a theme that is decided before the first frame

Unit: **catalog-identity**, from the brief `briefs/catalog-identity.md` and `PLAN.md` §D-A/§D-B.
Worktree `/mnt/HC_Volume_105573741/design-catalog-site-catalog-identity`, branch `fleet/catalog-identity`.
`master` was merged in first (fast-forward to `4475e37a`, the data-layer commit), as the coordinator asked.

| commit | what |
|---|---|
| `9954d3aa` | `type: two faces, self-hosted — Instrument Sans and JetBrains Mono` |
| `c62628bd` | `theme: system dark mode, decided before the first frame` |

Both pushed (`origin/fleet/catalog-identity`).

---

## 1. The type

Two faces, both of which are **items in this catalogue** — `shadcn/font-instrument-sans` and
`shadcn/font-jetbrains-mono`, ids confirmed in `app/manifest.json` before anything was tagged. That is the whole
argument for the choice: the site is a catalogue, so its own type should be goods it can name, not taste.

| | Instrument Sans | JetBrains Mono |
|---|---|---|
| job | interface, headings, prose | labels, counts, code |
| file | `app/public/fonts/instrument-sans-latin-var.woff2` | `app/public/fonts/jetbrains-mono-latin-var.woff2` |
| **bytes** | **30,092** | **31,432** |
| variable axes | `wght` 400–700, `wdth` 100% | `wght` 400–800 |
| subset | latin (U+0000-00FF + the punctuation the site uses) | latin, same |
| licence | **SIL OFL 1.1**, "Copyright 2022 The Instrument Sans Project Authors" | **SIL OFL 1.1**, "Copyright 2020 The JetBrains Mono Project Authors" |
| retrieved | 2026-10-27, Google Fonts WOFF2 endpoint (`instrumentsans/v4`) | 2026-10-27, Google Fonts WOFF2 endpoint (`jetbrainsmono/v24`) |
| digest (sha256) | `2ee17598…68e3971` | `83c005d4…560a5be` |

**61,524 bytes total**, both as single variable files — nothing needed two static weights per family.
Licence line recorded in full, with upstream URLs, retrieval date and digests, in **`LICENSES-FONTS.md`** at the
repo root, and the OFL text itself ships beside the files at `app/public/fonts/OFL.txt` (also served at
`/design-catalog/fonts/OFL.txt`) because the OFL requires the licence to travel with the font.

**No CDN, no dependency, no npm font package.** The files are committed under `app/public/fonts/`, declared with
`@font-face` in `styles.css` (`font-display: swap`, `unicode-range` for the latin subset), and both are preloaded
in `index.html` with `%BASE_URL%fonts/…` so the preload follows `base` if it ever moves.

One wrinkle worth naming: `manifest.json` records `"licence": "MIT"` for both `shadcn/font-*` entries. That field
describes the **shadcn registry snippet**, not the binary — the typeface is OFL. Stated in `LICENSES-FONTS.md`
rather than quietly reconciled.

### Token diff (`app/src/styles.css`)

The scale is **unchanged** — every `--t-*` and `--lh-*` value, and the 8 px rhythm, are exactly as they were. What
changed is what the new faces needed, and one duplicate removed.

| where | was | now | why |
|---|---|---|---|
| `@theme inline` `--font-sans` | `ui-sans-serif, system-ui, …` | `"Instrument Sans", ui-sans-serif, system-ui, …` | the face first, the machine's stack behind it: if the woff2 never arrives the site still reads |
| `:root` `--font-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` | `"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` | same, for mono |
| `pre` (was `:163`), `.cmd` (`:167`), `.cmd code` (`:192`) | the mono stack pasted three times, without `"SF Mono"` | `var(--font-mono)` ×3 | the duplication the brief asked to collapse; a change in one place now changes all three |
| `.page h2.title` / `.page-in h2.title` | `letter-spacing: -0.015em` | `-0.02em` (`-0.6px` at 30px, measured) | Instrument Sans is a grotesque with open sidebearings; at 30px it reads spaced-out without the extra notch. `30/36` untouched — the two-step relationship the scale had is right for this face |
| `.crumb` | `letter-spacing: 0.07em` | `0.05em` | JetBrains Mono's advance is already wide and its caps generous; the tracking the system mono needed to open up reads loose |
| `.cmd-label`, `.tally-l` | `0.06em` | `0.045em` | same reason |
| `.way-n` | `0.08em` | `0.06em` | same reason |
| `.rail-list` | `padding: … 40px` | `padding-bottom: 64px` on `≥861px` | the last rows must be able to scroll clear of the fixed switch (below) |

`<html>` now carries `data-catalog-item="shadcn/font-instrument-sans"`, so hovering any untagged text raises the
provenance tag and names the item its type came from; the switch's own mono label carries
`shadcn/font-jetbrains-mono`. Both are dogfooding, and the provenance counter counts them like any other.

Computed at 1440 (from the built bundle, `document.fonts.check` true for both):

```
body    "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
h2.title same, 30px / 36px, tracking -0.6px
.crumb  "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace
pre     "JetBrains Mono", …
```

Side effect, stated rather than hidden: because `--font-mono` is now JetBrains Mono, the Tailwind `font-mono`
utility inside catalogue **demo previews** also resolves to JetBrains Mono. That is one face for the whole
surface, which is what the brief wants, but it is a visible change to demos that opted into `font-mono`.

---

## 2. The theme

`app/index.html` hardcoded `<html lang="en" class="light">`. It now carries no class in the source at all — the
boot script decides, in `<head>`, **before the stylesheet is even requested** (verified in the built HTML: the
inline script is at head line 12, Vite's `<link rel="stylesheet">` at line 101).

### The boot script, verbatim (`app/index.html`, in `<head>`)

```js
(function () {
  var KEY = "catalog-theme";
  var root = document.documentElement;
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch (e) {
      return "system";
    }
  }
  function paint(mode) {
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#09090b" : "#ffffff");
    return mode;
  }
  var mq = matchMedia("(prefers-color-scheme: dark)");
  var follow = function () { if (read() === "system") paint("system"); };
  if (mq.addEventListener) mq.addEventListener("change", follow); else mq.addListener(follow);
  window.catalogTheme = {
    read: read,
    /* choose: persist the explicit choice (or forget it, for system) and repaint */
    choose: function (mode) {
      try {
        if (mode === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode);
      } catch (e) {}
      return paint(mode);
    }
  };
  paint(read());
})();
```

That is the **only** copy of the rule. `site/ThemeSwitch.tsx` calls `window.catalogTheme` instead of restating it,
which is why a React re-render and the pre-paint decision can never disagree.

### Three states, honestly represented

- **system** — the default, and the only state that is not persisted. Absence of the key *is* system.
- **light**, **dark** — persisted only when chosen explicitly (`localStorage["catalog-theme"]`).
- `data-theme` records the **choice**; `class="dark"` records the **resolution**. A page in system/dark OS has
  `data-theme="system" class="dark"` — the two facts stay distinguishable for CSS and for tests.
- `matchMedia('(prefers-color-scheme: dark)')` keeps `follow`ing the OS while the choice is system, with or
  without React mounted. Measured: switching the emulated OS from light to dark repaints in **< 400 ms, no reload**
  (the change event lands inside ~120 ms; my first test allowed 120 ms and flaked, 400 ms is honest).
- `<meta name="theme-color">` is rewritten on every resolution (`#09090b` dark, `#ffffff` light), so a phone's
  chrome follows an explicit override, not just the OS. Two `media`-scoped meta tags could only ever follow the OS.

### The switch

`app/src/site/ThemeSwitch.tsx` — the registry's `ToggleGroup` (`type="single"`, so Radix renders a real
`role="radiogroup"`: one choice out of three, roving focus, `aria-checked`), group `aria-label="Theme"`, items
`aria-label="Theme: system" / "Theme: light" / "Theme: dark"` with visible words `auto / light / dark`.
Clicking the state that is already selected sends `""` from the toggle group; that is **not a fourth state**, so
the handler ignores it — the theme is always one of the three.

**Where it is mounted: `app/src/App.tsx`, one line, next to the existing `<Provenance />` layer** — the brief's
preferred option, since `site/Rail.tsx` belongs to another unit. It is fixed at the foot of the rail column
(`left: 14px; bottom: 14px`), the mirror of what `.rail-reopen` already does at its head. Out of flow is what
makes "no layout shift when clicked" structural rather than careful: there is nothing in the flow to move. The
three items are one fixed 56 px width, so the row cannot reflow as the pick moves across it.

### The meta description

`"769 UI components, blocks and effects…"` was a hand-copied number. It is now derived at build time from
`manifest.json` — a small `transformIndexHtml` plugin in `app/vite.config.ts` substitutes `%CATALOG_COUNT%` and
`%CATALOG_RENDERED%`, because after the data layer landed, "769 … rendered" was also **false for 283 of them**
(reference-only items). The built head reads:

```html
<meta name="description" content="769 entries from five reference libraries — 486 rendered here, with their source." />
```

---

## 3. Verification (measured, not described)

```
cd app && python3 check_chrome.py   → exit 0   "11 shell file(s) scanned — … site/ThemeSwitch.tsx …"
cd app && npx vite build            → exit 0   (2m42s, after: dist/fonts/{instrument-sans,jetbrains-mono}-latin-var.woff2 + OFL.txt)
```

Preview: `dist` symlinked under `/tmp/serve-ci/design-catalog`, `python3 -m http.server 8809`, headless Chromium,
base `/design-catalog/`. Server killed in the same command; `ss -ltn | grep :8809` empty afterwards (`port 8809
after shutdown: free`). Harness committed beside this report as `catalog-identity-check.py`.

**48/48 assertions pass.** The ones that carry numbers:

```
-- no flash (dark OS, cold profile, filmstrip from commit) --
PASS at commit — before CSS, before a frame — <html> already carries dark   ['dark']
PASS no light frame in the filmstrip (commit/20/50/150/300 ms)
     [(0,(9,9,11)), (20,(9,9,11)), (50,(9,9,11)), (150,(9,9,11)), (300,(9,9,11))]
PASS the painted background is the dark token on the first screenshot   [painted=(9,9,11) token=oklch(0.141 0.005 285.823)]
PASS meta theme-color followed the theme   [#09090b]

-- system follows the OS --
PASS os=light => light paint   [cls=(none) painted=(255,255,255)]
PASS os=dark  => dark paint    [cls=dark   painted=(9,9,11)]
PASS os=light|dark => 'system' is the checked state, nothing persisted   [stored=None]

-- the toggle --
PASS three states, each named for screen readers   ['Theme: system','Theme: light','Theme: dark']
PASS it is a labelled radiogroup   [radiogroup aria-label=Theme]
PASS click dark => dark paint (9,9,11) / persisted 'dark' / theme-color #09090b
PASS reload keeps dark, against a light OS   [cls=dark (9,9,11) stored=dark]
PASS choosing system forgets the choice   [stored=None]
PASS choosing system hands the theme back to a light OS   [(255,255,255)]
PASS system keeps tracking the OS afterwards (light -> dark, no reload)   [cls=dark (9,9,11)]
PASS reload: still system, still dark, still nothing stored

-- keyboard only (no pointer events) --
PASS Tab reaches the switch (108 presses from the top of the page)   [Theme: system]
PASS Space on the selected state is not a fourth state   [stored=None mode=system]
PASS ArrowRight moves focus to Theme: light, Space activates it   [stored=light (255,255,255)]
PASS ArrowRight moves focus to Theme: dark,  Enter activates it   [stored=dark  (9,9,11)]

-- 1440: the type, computed --
PASS body / h2.title name Instrument Sans first; .crumb / pre name JetBrains Mono first
PASS both woff2 loaded   {"instrumentSans":true,"jetbrainsMono":true}
PASS title still 30px/36px, tracking -0.6px;  pre still 12.5px in JetBrains Mono
PASS lede still 15px/24px;  .way-p prose still 14px/23.8px  (the --t-* steps untouched)
PASS 1440 item page and front page: scrollWidth == viewport   [1440 vs 1440]

-- no layout shift when the theme is clicked --
PASS rail, page, switch boxes and both scroll extents identical after every click
     [start={'rail':[0,0,288,900],'page':[288,0,1152,900],'sw':[14,850,224.5,36],
             'scrollW':1440,'scrollH':900,'railScrollH':2717} drifted_on=[]]
PASS the three items keep one width   [[56]]

-- 390: the phone --
PASS 390 #/ , #/i/shadcn/button , #/chrome : scrollWidth == viewport [390 vs 390]
PASS 390 all three: switch fully inside the viewport   (x=10, y=792, w=184, h=42)
PASS 390 all three: dark paint   (9,9,11) / (24,24,27 — a full-bleed .demo card reaches the edge, still dark) / (9,9,11)
```

Two honest notes on the numbers:

- **108 Tab presses** at 1440 to reach the switch. That is not the switch's fault, it is the rail's: a 769-row
  navigation is a 108-stop tab sequence, and the switch sits at the end of the DOM beside the provenance layer.
  Keyboard operation itself is clean (arrow to move, Space/Enter to activate). Moving the switch into
  `RailHead` would shorten that path to ~4 presses — it belongs to another unit, so I did not touch it. **Call
  this out to whoever owns the rail.**
- The dark paint sample on the 390 item page is `(24,24,27)` — `--card`, not `--background` — because the phone
  rules give `.demo` a full-bleed `-16px` margin. Asserted as "no light surface where the page paints"
  (luminance 24) rather than as an exact token, because asserting the exact token there would be asserting a
  layout I do not own.

---

## 4. Files touched, and the reason for each

Nominal ownership was: the fonts, `styles.css`, the boot script in `index.html`. Everything else, one line each:

| file | reason |
|---|---|
| `app/src/App.tsx` | **2 lines** — the import, and `<ThemeSwitch />` mounted beside `<Provenance />`. The brief's preferred slot (the alternative, `site/Rail.tsx`, belongs to another unit). |
| `app/vite.config.ts` | one additive plugin (`catalogCounts`) so the meta description's counts come from `manifest.json` instead of a hand-typed number, which the brief asked for and no static HTML can do alone. |
| `app/index.html` | mine per the brief — boot script, `theme-color`, two font preloads, `data-catalog-item` on `<html>`, meta description tokens. |
| `app/src/site/ThemeSwitch.tsx` | new file, mine. |
| `LICENSES-FONTS.md`, `app/public/fonts/OFL.txt` | licence compliance for the two committed binaries. |
| `.rail-list` padding-bottom (`styles.css`) | 40px → 64px on desktop, so the rail's last rows can scroll clear of the fixed switch. |

Nothing under `site/Gallery.tsx`, `site/Home.tsx`, `site/ItemPage.tsx`, `site/Command.tsx`, `demo-main.tsx`,
`demo.html`, `gen.py`, `manifest.json` or `docs/**` was touched. No dependency was added (`next-themes` is
already a dependency of the catalogue and is imported by one *demo*; the shell does not use it).

## 5. Unsure

- **`--font-mono` now reaches demo previews.** Any catalogue demo using the Tailwind `font-mono` utility renders in
  JetBrains Mono rather than the system mono. I judged that consistency worth it and the visual difference small,
  but it is a change to how other people's components look, outside my nominal surface — if the demos must stay
  verbatim, `@theme inline { --font-mono: <the old system stack> }` restores it for demos while the shell keeps
  `var(--font-mono)`.
- **The switch's position is a judgement, not a measurement.** Bottom-left of the rail column is out of flow and
  cannot shift anything, and it is the mirror of `.rail-reopen` — but it is also a floating control, and a lead
  may prefer it in the rail header. Mount point is one line in `App.tsx` to move.
- **`Space` on an already-selected state does nothing.** Deliberate (no fourth state, no "no theme"), and I did
  not test it in a real screen reader — only via `aria-checked`/`aria-label` and focus behaviour in Chromium.

---

## 6. The follow-up unit: the switch was unreachable, and now it is not

The coordinator's finding was mine first: §3 above records that the switch took 108 Tab presses at 1440. This
section is the fix, measured the same way.

**Before the move** (master `16e5c59b`, built and measured, not assumed):

```
1440 Tab presses to the switch: 129     (it was mounted after the rail and after the page)
390  Tab presses to the switch:  11
1440 .theme-switch instances: 1         390: 1
rail head height: 230.4px                rail list viewport: 670px   (2717px of content)
```

**Where it went, and where it could not go.** The brief said the rail head. It cannot hold this control: the
head's brand row is 259px wide and already carries the wordmark (98px) and the collapse trigger (26px), leaving
**135px**; three segments at the shell's 44px floor need **132px** of that before the strip's own label and
padding are counted. Making the head taller was explicitly off-limits, and putting the 44px control in that 26px
row would have grown the head by 18px. So the switch is the rail scroll area's **first row** — above the tree
and, crucially, before it in the DOM — pinned with `position: sticky` so it stays put while rows scroll under it.

**After the move** (`00bc9d26`):

```
1440 Tab presses to the switch:  12     (harness loop counts it as 11 — same page, where the count starts)
390  Tab presses to the switch:  11     (unchanged: on a phone the rail is display:none and its first row is
                                         behind the Browse disclosure, so the phone keeps its own corner)
1440 .theme-switch instances: 1         390: 1
rail head height: 230.4px → 230.4px     rail list viewport: 670px → 670px   (both untouched)
item boxes: 56x44 → 44x44               (the 44px floor, in both directions)
```

One route per width, never two: at 1440 the rail head's row; at 390 the phone's own corner (`.theme-switch-float`).
The other width's host is not rendered at all, so the DOM holds exactly one instance — asserted, not assumed.

Segments went 56px → 44px wide so the strip fits the rail's 259px content width; the pill spans the row with its
label left and the segments right. That is the only visual change beyond position.

**Evidence set**

```
python3 check_chrome.py   → exit 0, 16 shell file(s) scanned (site/ThemeSwitch.tsx included)
npx vite build            → exit 0
python3 /tmp/ci_check.py  → 54/54   (was 48; +6: instances, placement, 44px floor, head/list budgets)
node qa/measure.mjs       → 78 PASS · 2 FAIL · 3 other
```

The QA harness's five non-PASS are **the same five it shipped with** (`qa/raw/_summary.json` on master: 2x section
F reduced-motion wording, 1x third-subject, 2x section-I prose links at 390 measuring 42px) — this unit introduced
none, and its check H ("the theme toggle has three states", which clicks `.theme-switch [aria-label="Theme: …"]`
directly) still passes against the new home. The harness rewrites `qa/raw/**` and `qa/shots/**` when it runs, so
those were reverted after each run: that is another unit's artifact directory.

Two things worth saying plainly:

- **I did not put it in `Rail.tsx`.** My first attempt did — the head, as asked — and the arithmetic above is why
  it came back out. The mount is two blocks in `App.tsx` (rail row at >860, corner at ≤860) and the component
  itself is untouched.
- **The 12 is the rail's shape, not the switch's.** Tab passes the wordmark, the collapse trigger, the filter and
  the six source pills before it reaches the switch. Below ~4 would mean putting it above those, i.e. changing the
  head's row order, which is the copy/rail unit's surface.
