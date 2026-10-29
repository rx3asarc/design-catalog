var e=`@import "tailwindcss";
@import "./tokens.css";
@custom-variant dark (&:is(.dark *));

/* ═══ the two faces ═══════════════════════════════════════════════════════════════════════════════
   Instrument Sans carries the interface, the headings and the prose; JetBrains Mono carries the labels,
   the counts and the code. Both are catalogue goods — \`shadcn/font-instrument-sans\` and
   \`shadcn/font-jetbrains-mono\` are items in this catalogue, so the site's own type is dogfooding, not
   taste by vibes. Both are SIL OFL 1.1, both are self-hosted (the site promises no third-party requests,
   and a CDN font is a third-party request), both are variable woff2 and both are cut to the latin subset:
   30,092 B and 31,432 B, which is the entire cost of the type. \`fonts/OFL.txt\` ships the licence beside
   them; \`LICENSES-FONTS.md\` at the repo root names family, source, licence and retrieval date.
   \`font-display: swap\` — the metrics of the fallbacks are close enough that a swap is a small reflow, and
   a blank paragraph for 200 ms is not.
   Vite rewrites the root-absolute \`url()\` below to the configured base; see app/vite.config.ts. */
@font-face {
  font-family: "Instrument Sans";
  font-style: normal;
  font-weight: 400 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("/fonts/instrument-sans-latin-var.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
    U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url("/fonts/jetbrains-mono-latin-var.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
    U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0.005 285.823);
  --sidebar-primary: oklch(0.21 0.006 285.885);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.967 0.001 286.375);
  --sidebar-accent-foreground: oklch(0.21 0.006 285.885);
  --sidebar-border: oklch(0.92 0.004 286.32);
  --sidebar-ring: oklch(0.705 0.015 286.067);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.21 0.006 285.885);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.92 0.004 286.32);
  --primary-foreground: oklch(0.21 0.006 285.885);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.552 0.016 285.938);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.21 0.006 285.885);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.552 0.016 285.938);
  --radius: 0.625rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  /* the face first, the machine's own UI stack behind it: if the woff2 never arrives the site still reads */
  --font-sans: "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground font-sans; }
}

/* ---- the catalogue's own chrome (not part of any demo) ---- */
:root { --frame-line: color-mix(in oklab, var(--border) 100%, transparent); }
html, body, #root { height: 100%; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
.cat { display: grid; grid-template-columns: 288px minmax(0,1fr); height: 100dvh; background: var(--surface-100); }
.rail { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; background: var(--surface-200); }
.rail-top { padding: 14px 14px 10px; border-bottom: 1px solid var(--border); }
.rail-top h1 { font-size: 14px; font-weight: 600; margin: 0 0 8px; letter-spacing: -.01em; }
.rail-top .meta { font-family: var(--font-mono); font-size: 12px; line-height: 16px; color: var(--ink-subtle); }
.rail input { width: 100%; height: 34px; margin-top: 10px; padding: 0 10px; font-size: 13px; border-radius: var(--radius-md);
  border: 1px solid var(--border); background: var(--surface-100); color: var(--ink); outline: none; }
.rail input { border-color: var(--border-strong); }
.rail input:focus { border-color: var(--focus); }
.rail-list { overflow: auto; padding: 8px 8px 40px; min-height: 0; }
.rail-group { margin: 10px 0 2px; padding: 0 8px; font-family: var(--font-mono); font-size: 12px; line-height: 16px; text-transform: uppercase; letter-spacing: .06em;
  color: var(--ink-muted); }
.rail-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px;
  border-radius: 6px; font-size: 13px; color: var(--ink); background: none; border: 0; cursor: pointer; }
.rail-item:hover { background: var(--surface-300); }
.rail-item[aria-current="page"] { background: var(--accent); color: var(--on-accent); font-weight: 500; }
.rail-item .dot { width: 5px; height: 5px; border-radius: var(--radius-full); background: var(--ink-muted); flex: none; }
.rail-item .dot.demo { background: oklch(0.65 0.16 150); }
.rail-item .dot.none { background: transparent; border: 1px solid var(--border); }
.rail-item span.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.page { overflow: auto; min-height: 0; }
.page-in { max-width: 760px; margin: 0 auto; padding: 32px 32px 96px; }
.page-turn { overflow-x: clip; }

.crumb {
  font-family: var(--font-sans); font-size: 13px; line-height: 20px; color: var(--ink-subtle);
  letter-spacing: 0; margin: 0 0 var(--s2);
}
.crumb b, .crumb a { color: var(--ink); font-weight: 400; }

/* the accent, in its two places: a link's rule, and the way-in numbers (further down) */
.page-in a, .pager a, .nav2 a { text-underline-offset: 2px; }
.page-in a:hover, .pager a:hover, .nav2 a:hover,
.page-in a:focus-visible, .pager a:focus-visible, .nav2 a:focus-visible {
  text-decoration: underline; text-decoration-color: var(--ink-accent); text-decoration-thickness: 1px;
}

/* the page column, on the rhythm */
.page-in { padding: var(--s5) var(--s3) var(--s8); }
.badges { margin: 0 0 var(--s3); gap: var(--s1); }
.pager { margin: 0 0 var(--s3); padding: 0 0 var(--s1); }
.verdict { margin: 0 0 var(--s3); padding: 1px 0 1px 12px; }
.withheld { margin: var(--s2) 0 var(--s3); padding: var(--s2); }
.nav2 { margin-top: var(--s6); padding-top: var(--s2); }
.hint { margin: 0 0 var(--s1); }
.cmd-wrap { margin: 0 0 var(--s2); }
.cmd-label { font-family: var(--font-mono); font-size: var(--t-label); letter-spacing: 0.045em; margin: 0 0 var(--s-half); }
.demo { margin: var(--s2) 0 var(--s4); }
.tabs { margin: 0 0 var(--s1); }
.file-tabs { margin-bottom: 0; }
pre { font-family: var(--font-mono); }
.cmd, .cmd code { font-family: var(--font-mono); }

/* ---- first run: three ways in, stated once, ruled rather than carded ---- */
.ways { list-style: none; margin: 0 0 var(--s5); padding: 0; border-top: 1px solid var(--border); }
.way {
  display: grid; grid-template-columns: var(--s5) minmax(0, 1fr); gap: var(--s2);
  padding: var(--s2) 0; border-bottom: 1px solid var(--border);
}
.way-n {
  font-family: var(--font-mono); font-size: var(--t-label); line-height: 1.7; letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums; color: var(--ink-accent); padding-top: 1px;
}
.way-h { font-size: var(--t-body); line-height: 1.4; font-weight: 600; margin: 0 0 var(--s-half); }
.way-p { margin: 0; font-size: var(--t-body); line-height: var(--lh-body); color: var(--ink-muted); max-width: 54ch; }

/* ---- the counts, as one statement instead of a table of five rows ---- */
.tally {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s3);
  margin: 0 0 var(--s2); padding: var(--s2) 0;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.tally-item { display: inline-flex; align-items: baseline; gap: 6px; }
.tally-n { font-size: var(--t-body); font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.tally-l { font-family: var(--font-mono); font-size: var(--t-label); letter-spacing: 0.045em; text-transform: uppercase; color: var(--ink-muted); }
.tally-note { font-size: var(--t-body); line-height: var(--lh-body); color: var(--ink-muted); margin: 0; max-width: 66ch; }

/* phone: the scale steps down but keeps its ratios, and nothing we own drops under 12px */
@media (max-width: 860px) {
  /* the rail is a thumb target on a phone, so it keeps its own step rather than the desktop 13px,
     and nothing we own drops below 12px here */
  .rail-item { font-size: 14px; }
  .way-n { font-size: 12px; }
  .page-in { padding: var(--s2) var(--s2) var(--s6); }
  .page h2.title, .page-in h2.title { font-size: 26px; line-height: 32px; }
  .page p.lede, .page-in .lede { font-size: var(--t-lede); line-height: var(--lh-lede); }
  .page-in p, .page-in li { font-size: var(--t-body); line-height: var(--lh-body); }
  .section-h { margin: var(--s4) 0 var(--s2); }
  .crumb { font-size: 12px; letter-spacing: 0.05em; }
  .tally-l, .cmd-label, .badge, .rail-legend, .rail-top .meta { font-size: 12px; }
  .tally { gap: var(--s1) var(--s2); }
  .way { grid-template-columns: var(--s4) minmax(0, 1fr); gap: var(--s1); }
  .demo { margin: var(--s2) -16px var(--s3); }
  .nav2 { margin-top: var(--s5); }
}

/* ============================================================================
   THE RAIL IS THE CATALOGUE'S SIDEBAR  (W1)
   The frame is \`Sidebar\` from the registry: SidebarProvider is the .cat wrapper, the rail is
   SidebarHeader + SidebarContent + SidebarGroup, every level is a Collapsible on a SidebarMenuItem
   whose trigger is a SidebarMenuButton, and every leaf is a SidebarMenuButton wrapping a real link.
   What stays ours is the metrics: the registry's utilities live in @layer utilities and the rules
   below are unlayered, so a number stated here wins without !important and without editing the
   component. Phone keeps the old frame: the tree is a disclosure above the page, never over it.
   ========================================================================== */

/* ---- the shell: the rail reserves its own column, the content column owns the scroll ---- */
/* SidebarInset is a flex column; the content column here is a plain scrolling block, as it was, so a wide
   table inside it is contained by .page instead of stretching the document. */
.page { display: block; }
@media (min-width: 861px) {
  .cat { display: flex; height: 100dvh; min-height: 0; overflow: hidden; }
  .cat > [data-slot="sidebar"] { flex: none; }
  .page { flex: 1 1 auto; min-width: 0; min-height: 0; overflow: auto; }
}

/* ---- rail head: name, counts, filter, sources — one column, the trigger beside the name ---- */
.rail-top { gap: 0; padding: 14px 14px 12px; border-bottom: 1px solid var(--border); }
.rail-brand { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rail-brand h1 { margin: 0; }
.rail-trigger { flex: none; width: 26px; height: 26px; min-height: 0; padding: 0; border: 1px solid var(--border);
  border-radius: 6px; color: var(--ink-muted); background: transparent; }
.rail-trigger:hover { background: var(--surface-300); color: var(--ink); }
.rail-phone .rail-trigger { display: none; }
.rail-top .meta { margin: 2px 0 0; }
.rail-legend { padding: 6px 0 8px; }
.rail-filter { padding: 0; border: 0; }

/* ---- the tree: four levels, one indent token each, inherited by the rows underneath ---- */
.rail-list { padding: 6px 8px 40px; gap: 0; }
.rail-groupwrap { padding: 0; }
.rail-menu { --indent: 6px; gap: 0; }
/* the registry's SidebarMenuSub brings a 14px gutter and a guide rule per level; four levels of that would
   eat the rail, so the indent is one token per level instead and the rows inherit the nearest one */
.rail-kids { display: flex; flex-direction: column; gap: 0; margin: 0; padding: 0; border: 0; transform: none; }
.rail-sec { --indent: 8px; }
.rail-cat { --indent: 18px; }
.rail-sub { --indent: 28px; }
.rail-sub2 { --indent: 40px; }

/* The registry's rows are h-8 with p-2; ours are a dense tree, so the metrics are restated here — and only
   the metrics. The size is the look's two-step rail scale (--t-rail-label for a label, --t-rail-item for a
   row), so this swap cannot re-introduce the five sizes the rail had. */
.disc-trigger, .rail-item { height: auto; border-radius: 6px; }
.rail-sec > .disc-trigger { min-height: 30px; padding: 9px 10px 5px var(--indent); font-weight: 600; }
.rail-cat > .disc-trigger { min-height: 30px; padding: 6px 10px 6px var(--indent); font-weight: 500; }
.rail-sub > .disc-trigger { min-height: 30px; padding: 4px 10px 4px var(--indent); font-weight: 500; }
.rail-sub2 > .disc-trigger { min-height: 28px; padding: 3px 10px 3px var(--indent); font-weight: 500; }
.rail-item { min-height: 30px; padding: 3px 10px 3px calc(var(--indent) + 12px); }
.rail-item .t { flex: 1 1 auto; min-width: 0; }
.rail-item .nodemo { margin-left: 0; }
.disc-trigger .sub-c { opacity: .45; }

/* a rail row is a thumb target on a phone, whatever its level */
@media (max-width: 860px) {
  .rail-sec > .disc-trigger, .rail-cat > .disc-trigger, .rail-sub > .disc-trigger,
  .rail-sub2 > .disc-trigger, .rail-item { min-height: 44px; }
  .rail-item { align-items: center; }
}

/* ---- the way back: offcanvas takes the rail off screen, so a trigger waits where it was ---- */
.rail-reopen { position: fixed; top: 10px; left: 10px; z-index: 40; }
.rail-reopen-btn { width: 30px; height: 30px; padding: 0; border: 1px solid var(--border); border-radius: 7px;
  background: var(--surface-200); color: var(--ink); }
.rail-reopen-btn:hover { background: var(--surface-300); }
@media (max-width: 860px) { .rail-reopen { display: none; } }

/* ═══ provenance: the tag that names whatever you are pointing at ════════════════════════════════
   It is a label, not a panel: the mono label step from the scale above, the popover surface, one hair
   of shadow. It carries the pointer through — only its link takes clicks — so it can hang over the row
   beneath without stealing it. */
.prov-tag {
  width: auto; max-width: min(22rem, calc(100vw - 1rem));
  padding: 5px 10px; border: 1px solid var(--border); border-radius: calc(var(--radius) - 4px);
  background: var(--popover); color: var(--popover-foreground);
  box-shadow: 0 1px 2px oklch(0 0 0 / 0.05);
  font-family: var(--font-mono); font-size: var(--t-label); line-height: 1.5;
  pointer-events: none;
}
.prov-tag a.prov-open { pointer-events: auto; color: var(--ink); text-decoration: none; }
.prov-tag a.prov-open:hover, .prov-tag a.prov-open:focus-visible {
  text-decoration: underline; text-decoration-color: var(--ink-accent); text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.prov-tag .prov-uses, .prov-tag .prov-quiet { color: var(--ink-muted); }
.prov-tag .prov-n { font-variant-numeric: tabular-nums; }
@media (max-width: 860px) { .prov-tag { font-size: 12px; } }

/* ═══ the theme switch: three states, and the one place it can live ══════════════════════════════
   The rule itself is the boot script in index.html; this is its one handle, and it says which of the three
   states it is in ("Theme" + auto/light/dark, one choice of three, each item 44x44 so it clears the shell's
   floor in both directions).

   WHERE IT GOES, and why not the head: the rail head's brand row is 259px wide and already holds the wordmark
   (98px) and the collapse trigger (26px), which leaves 135px — three 44px segments need 132px of that before
   the strip's own label and padding are counted, i.e. nothing left to breathe in. Making the head taller was
   not mine to spend either, so the switch is the rail scroll area's first row: above the 769-row tree and in
   the DOM before it, so Tab reaches it in twelve presses instead of a hundred and twenty-nine, and the head
   stays 230.4px with the list's viewport at 670px (measured, before and after).
   On a phone there is one instance too, and it is the first row of the Browse menu itself (\`.rail-theme-phone\`):
   the menu is the only surface on a phone that is ever above the page, so the switch lives there instead of in
   a strip of its own. Exactly one instance at every width, never two — and nothing fixed over the content. */
.theme-switch {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 4px 4px 4px 10px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface-200);
}
.theme-switch .theme-label {
  font-family: var(--font-mono); font-size: 10px; line-height: 1; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--ink-muted);
}
/* the three items are one fixed width, so the row cannot change shape when the picked one moves across it —
   a segmented control whose segments resize as you use it is the cheapest way to make a toolbar feel wrong */
.theme-switch [data-slot="toggle-group-item"] { width: 44px; min-width: 44px; min-height: 44px; height: 44px; padding: 0 4px; border-radius: 999px; }
.theme-switch [data-slot="toggle-group-item"]:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
/* the first row of the rail's scroll area, pinned there: it stays put while the rows scroll under it */
.rail-theme {
  position: sticky; top: 0; z-index: 2;
  padding: 8px 12px 8px;
  background: var(--sidebar); border-bottom: 1px solid var(--border);
}
/* on the phone the switch is the menu's first row, over the tree: it keeps the hairline the float used to have.
   The desktop rail row is unchanged. */
.rail-phone .rail-theme .theme-switch { box-shadow: 0 1px 2px oklch(0 0 0 / 0.06); }

/* QA I: the stage console's three Motion/Width controls were 41-43 px wide — 44 tall was asserted, 44 wide was
   not. A control is only a target if you can hit it in both directions. */
[data-stage-bar] button, [data-stage-bar] [role="radio"] { min-width: 44px; min-height: 44px; }

/* QA I: the hero's Setup button was 36 px tall. */
.cmd-wrap > button, [data-catalog-item="shadcn/button"].h-9 { min-height: 44px; }

/* QA I: the rail's grid doors are 24 px, the WCAG 2.5.8 floor — they were 20 px.
   On the phone the rail is no longer a drawer, it is the Browse menu, so this is the one thing in that menu
   under 44 px and it is worth saying exactly why it stays there: the DOOR is decoration — a 28×28 grid glyph
   at the right edge of a 44 px row — and the ROW is the target. The row's own trigger/link carries the hit
   area across the full width (hit-tested at its centre: 234 of 234 reachable rows at 375, 211/211 at 600,
   203/203 at 768), and a 44×44 door would claim the right 44 px of a 44 px row, turning every "open this
   level" tap near the count into "open a grid". So: row 44 px + \`min-width/min-height: 44px\` for every other
   control in the menu, door 28 px and none of the row's centre. */
[data-sidebar="menu-action"] { min-width: 28px; min-height: 28px; width: 28px; height: 28px; }


/* ═══ the phone column: bounded viewport, and the page is the scroller ═══════════════════════════
   The theme switch used to be docked in a lane at the foot of this column (a 67 px strip reserved outside the
   scroll area, which is why \`.page\` — not the window — became the phone's scroller). The lane is gone: the
   switch is the Browse menu's first row now, and with it went the only reason a strip had to exist at all.

   What stays is the shape, because two things depend on it. 1) The menu overlay is anchored to a bounded
   viewport: \`.cat\` is exactly 100dvh with \`overflow: hidden\`, so \`calc(100dvh - var(--phone-header))\` is the
   menu's real ceiling and the page cannot scroll the document out from under it. 2) \`.page\` is the scroller on
   a phone: \`site/Gallery.tsx\` resolves its scroller by walking up for an overflow-y element with
   scrollHeight > clientHeight, so the mount pool follows it, and \`useScrollReset\` in site/route.ts scrolls it
   on every route change. Measured before and after removing the lane: \`.page\` scrolls on a phone (0 tiles,
   0 demo fields under any fixed box at 375/600/768), the document does not (\`scrollHeight == innerHeight\`),
   and the gallery still mounts 2 live frames at 390. */
@media (max-width: 860px) {
  .cat {
    display: flex; flex-direction: column;
    height: 100dvh; min-height: 100dvh;
    overflow: hidden;
  }
  .page {
    flex: 1 1 auto; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    overscroll-behavior-y: contain; /* the page does not rubber-band the document: there is nothing outside it */
  }
}

/* ═══ the phone's Browse menu is an overlay, not the third row of the column ═════════════════════
   It was a flex item between the sticky header and the page, in a column that is exactly one viewport
   tall (\`@media (max-width: 860px) { .cat { height: 100dvh; overflow: hidden } }\`, further down). Two
   shrinkable items (rail \`0 1 auto\`, page \`1 1 auto\`) in a 100dvh column: the rail lost, the list lost
   inside it, and the rows were laid out past the clipped box — so the tree existed, at the right 44 px,
   invisible, with the page painted over it. Measured on the build before this rule was written (375×812):
   panel 375×222, \`.rail-list\` viewport 46 px against 4578 px of scroll content, rows 8-10 of the menu
   hit-testing as \`H2.title\`/\`P.lede\` (the page heading), and 0 of the rows inside the panel were tappable
   at their centre. At 600×900 the same shape gave a 78 px window and at 768 a 150 px one: the menu worked
   but one and a half rows at a time.

   So the panel leaves the flow. It is \`fixed\` under the header, \`100dvh - header\` tall at most, and it is
   the scroller itself (\`overscroll-behavior: contain\`, so a flick at the end of the tree does not hand the
   gesture to the page). \`display: block\`, not flex: a flex column with overflowing children shrinks them
   before it scrolls, which is the bug in miniature. Rows keep their 44 px (the phone rule above), and the
   list stops being a second scroller — one surface, one scroll.

   Measured after (same harness, same viewports): panel 375×747 fixed @0,65 z 35, its own scroll box
   4822/746 (the whole tree, not 46 px of it), list 4578/4578 with \`overflow: visible\`; the first ten menu
   rows hit-test as the row itself at all three widths, and every row that is reachable while the panel is
   scrolled — 234 at 375, 211 at 600, 203 at 768 — hits as its own row (was 0 / 42 / 121 of the few rows the
   squeezed window showed). The last row of a fully-expanded menu is hittable and navigates.

   z-index 35: above \`.page\` (auto), above the sticky header (20) and above the theme lane (30) it used to
   lose to, below the palette (50). The header is sticky and the panel starts *below* it, so the Browse/Close
   trigger stays tappable while the menu is open — a menu you cannot close with the control that opened it is
   not closed by it either. */
@media (max-width: 860px) {
  /* 44 px control + 2×10 px header padding + the header's 1 px rule. \`PhoneRail\` re-measures it on open and
     on resize and writes the same property on <html>, so a header that grows cannot leave a gap. */
  :root { --phone-header: 65px; }

  .menu-open .rail-phone {
    display: block;
    position: fixed; left: 0; right: 0;
    top: var(--phone-header); bottom: auto;
    /* height from the tree, capped by the viewport under the header: a filtered menu is a short sheet with the
       page visible (and tappable) below it, a full tree is a tall one that scrolls itself */
    max-height: calc(100dvh - var(--phone-header));
    z-index: 35;
    overflow-y: auto; overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    background: var(--surface-200);
    border-top: 1px solid var(--border); border-bottom: 0;
    box-shadow: 0 -1px 2px oklch(0 0 0 / 0.05);
  }
  /* one scroller, not two: the panel scrolls, the list must not clip what the panel is scrolling */
  .menu-open .rail-phone .rail-list { overflow: visible; max-height: none; }

  /* The backdrop: everything the page owns below the header, dimmed, and none of it tappable while the menu
     is up. Behind the panel (z 34 vs 35), so it is only visible — and only tappable — where the panel does not
     reach, which is the top of the menu on a phone tall enough for a filtered tree, and never a hole over the
     page. */
  .menu-veil, .menu-veil:hover {
    position: fixed; left: 0; right: 0; bottom: 0;
    top: var(--phone-header);
    z-index: 34;
    width: auto; height: auto; min-height: 0; padding: 0; border: 0; border-radius: 0;
    background: oklch(0 0 0 / 0.4);
    cursor: default;
    overscroll-behavior: contain;
  }
  /* the theme switch is the surface's first row and stays under the thumb while the tree scrolls: \`.rail-theme\`
     is already \`position: sticky; top: 0\` for the desktop rail, and the panel is the scroll container here */
  .rail-phone .rail-theme { background: var(--surface-200); padding: 10px 12px; }
  /* nothing in the menu is under 12 px once it is the phone's whole way in. Three things were, all borrowed from
     the desktop rail and all left alone on desktop: the 11 px label step (\`--t-label\`: the counts on every level
     row, "769 items · 486 rendered", the legend), the switch's 10 px "Theme" and its 11 px segment words, and
     the 10 px "no demo" on a row. The menu re-declares the step and names the three; desktop keeps its sizes. */
  .rail-phone { --t-label: 12px; }
  .rail-phone .rail-item .nodemo,
  .rail-phone .theme-switch .theme-label,
  .rail-phone .theme-switch [data-slot="toggle-group-item"] { font-size: 12px; }
}

/* ---- the chrome's focus ring, once: 2px solid focus, offset 2px, keyboard only (design system) ---- */
.cat :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
`;export{e as default};