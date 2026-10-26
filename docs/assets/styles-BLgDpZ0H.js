var e=`@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

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
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground font-sans; }
}

/* ---- the catalogue's own chrome (not part of any demo) ---- */
:root { --frame-line: color-mix(in oklab, var(--border) 100%, transparent); }
html, body, #root { height: 100%; }
body { margin: 0; -webkit-font-smoothing: antialiased; }
.cat { display: grid; grid-template-columns: 288px minmax(0,1fr); height: 100dvh; background: var(--background); }
.rail { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; background: var(--card); }
.rail-top { padding: 14px 14px 10px; border-bottom: 1px solid var(--border); }
.rail-top h1 { font-size: 14px; font-weight: 600; margin: 0 0 8px; letter-spacing: -.01em; }
.rail-top .meta { font-size: 11px; color: var(--muted-foreground); }
.rail input { width: 100%; height: 34px; margin-top: 10px; padding: 0 10px; font-size: 13px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--background); color: var(--foreground); outline: none; }
.rail input:focus { border-color: var(--ring); }
.rail-list { overflow: auto; padding: 8px 8px 40px; min-height: 0; }
.rail-group { margin: 10px 0 2px; padding: 0 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted-foreground); }
.rail-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px;
  border-radius: 6px; font-size: 13px; color: var(--foreground); background: none; border: 0; cursor: pointer; }
.rail-item:hover { background: var(--muted); }
.rail-item[aria-current="page"] { background: var(--accent); color: var(--accent-foreground); font-weight: 500; }
.rail-item .dot { width: 5px; height: 5px; border-radius: 99px; background: var(--muted-foreground); flex: none; }
.rail-item .dot.demo { background: oklch(0.65 0.16 150); }
.rail-item .dot.none { background: transparent; border: 1px solid var(--border); }
.rail-item span.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.page { overflow: auto; min-height: 0; }
.page-in { max-width: 860px; margin: 0 auto; padding: 40px 32px 120px; }
.crumb { font-size: 12px; color: var(--muted-foreground); margin-bottom: 10px; }
.page h2.title { font-size: 30px; letter-spacing: -.02em; margin: 0 0 8px; font-weight: 650; }
.page p.lede { font-size: 15px; color: var(--muted-foreground); margin: 0 0 20px; max-width: 62ch; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 26px; }
.badge { font-size: 11.5px; padding: 3px 8px; border-radius: 99px; border: 1px solid var(--border); color: var(--muted-foreground); }
.badge.ok { color: oklch(0.55 0.14 150); border-color: color-mix(in oklab, oklch(0.65 0.16 150) 40%, var(--border)); }
.badge.warn { color: oklch(0.55 0.14 80); }
.badge.bad { color: oklch(0.55 0.16 25); }
.demo { border: 1px solid var(--border); border-radius: 10px; margin: 0 0 18px; overflow: hidden; background: var(--card); }
.demo-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--border);
  font-size: 12px; color: var(--muted-foreground); }
.demo-head .sp { flex: 1; }
.demo-head button { font-size: 12px; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--background); color: var(--foreground); cursor: pointer; }
.demo-head button:hover { background: var(--muted); }
.demo-body { padding: 26px; display: flex; justify-content: center; }
.demo-body.plain { justify-content: flex-start; display: block; }
.demo-code { border-top: 1px solid var(--border); background: color-mix(in oklab, var(--muted) 55%, var(--card)); }
pre { margin: 0; padding: 14px 16px; overflow: auto; max-height: 460px; font-size: 12.5px; line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: 2; }
.section-h { font-size: 13px; font-weight: 600; margin: 30px 0 10px; }
.cmd { display: flex; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 8px;
  background: color-mix(in oklab, var(--muted) 50%, var(--card)); padding: 10px 12px; font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.tabs { display: flex; gap: 2px; margin: 0 0 0; }
.tabs button { font-size: 11.5px; padding: 4px 8px; border-radius: 6px 6px 0 0; border: 1px solid transparent;
  border-bottom: 0; background: none; color: var(--muted-foreground); cursor: pointer; }
.tabs button[aria-selected="true"] { background: var(--background); border-color: var(--border); color: var(--foreground); }
.verdict { border-left: 3px solid var(--border); padding: 2px 0 2px 12px; font-size: 13px; color: var(--muted-foreground); margin: 0 0 22px; }
.verdict b { color: var(--foreground); }
.withheld { border: 1px dashed var(--border); border-radius: 10px; padding: 18px; font-size: 13.5px; color: var(--muted-foreground); }
.nav2 { display: flex; justify-content: space-between; gap: 12px; margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--border); }
.nav2 a { font-size: 13px; color: var(--foreground); text-decoration: none; }
.nav2 a:hover { text-decoration: underline; }
.copied { font-size: 11.5px; color: oklch(0.55 0.14 150); }
@media (max-width: 860px) {
  .cat { grid-template-columns: 1fr; height: auto; }
  .rail { border-right: 0; border-bottom: 1px solid var(--border); max-height: 42dvh; }
  .page-in { padding: 24px 18px 80px; }
  .page h2.title { font-size: 24px; }
}

/* ---- complete instructions, never truncated ---- */
.hint { font-size: 13px; color: var(--muted-foreground); margin: 0 0 10px; max-width: 70ch; }
.hint a { color: var(--foreground); }
.cmd-wrap { margin: 0 0 12px; }
.cmd-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted-foreground); margin: 0 0 5px; }
.cmd code { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55; }
.cmd { align-items: flex-start; }
.cmd button { flex: none; margin-top: -2px; }

/* ---- phone: one column, the rail is a disclosure above the page ---- */
.topbar { display: none; }
@media (max-width: 860px) {
  .cat { display: block; height: auto; min-height: 100dvh; }
  .topbar { display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 20;
    padding: 10px 14px; background: var(--card); border-bottom: 1px solid var(--border); }
  .topbar .brand { font-size: 14px; font-weight: 600; color: var(--foreground); text-decoration: none; flex: 1; }
  .menu-btn { min-height: 44px; padding: 0 14px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--background); color: var(--foreground); cursor: pointer; }
  .rail { display: none; }
  .menu-open .rail { display: flex; max-height: none; border-bottom: 1px solid var(--border); }
  .menu-open .rail-list { max-height: 70dvh; }
  .rail-item { min-height: 44px; font-size: 14px; }
  .rail input { height: 44px; font-size: 16px; } /* 16px keeps iOS from zooming on focus */
  .page { overflow: visible; }
  .page-in { padding: 20px 16px 90px; }
  .page h2.title { font-size: 23px; }
  .page p.lede { font-size: 14px; }
  .demo-body { padding: 16px 12px; overflow-x: auto; }
  .demo-head { flex-wrap: wrap; }
  .demo-head button { min-height: 36px; }
  pre { font-size: 11.5px; white-space: pre-wrap; word-break: break-word; }
  .tabs { overflow-x: auto; }
  .tabs button { min-height: 36px; white-space: nowrap; }
  .cmd { flex-direction: column; gap: 8px; }
  .cmd button { align-self: flex-start; min-height: 36px; }
  .nav2 { flex-wrap: wrap; }
}
.path { flex: 1; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmd { min-width: 0; max-width: 100%; }
.cmd > * { min-width: 0; }
.withheld a, .page-in a, .verdict code, .badges .badge { overflow-wrap: anywhere; word-break: break-word; }
.page-in { max-width: 100%; }

/* ---- phone: every control we own clears 44px, and nothing we own is under 12px ---- */
@media (max-width: 860px) {
  .brand { display: inline-flex; align-items: center; min-height: 44px; }
  .demo-head button, .demo-head .copied { min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; }
  .demo-head { padding: 6px 10px; }
  .tabs button { min-height: 44px; display: inline-flex; align-items: center; padding: 0 12px; }
  .cmd button { min-height: 44px; }
  .badge, .cmd-label, .rail-group, .crumb { font-size: 12px; }
  .badge { padding: 4px 9px; }
  .hint { font-size: 13.5px; }
  .withheld { font-size: 14px; }
  .nav2 a { display: inline-flex; align-items: center; min-height: 44px; }
}

@media (max-width: 860px) { pre { font-size: 12px; } .tabs button { font-size: 12.5px; } }

/* demos that need more width than the card: a visible, touch-friendly scroller plus a swipe hint */
.demo-body { overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.demo-body::-webkit-scrollbar { height: 8px; }
.demo-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
.demo-body { padding-bottom: 14px; }
@media (max-width: 860px) {
  .demo { border-radius: 0; border-left: 0; border-right: 0; }
  .demo-head, .demo-body { padding-left: 14px; padding-right: 14px; }
  .demo-body { padding-left: 0; padding-right: 0; }
  .demo-body > div { padding: 0 14px; }
}

/* ---- a rendered sidebar must not escape its card: paint containment makes the card the
       containing block for the demo's fixed-position panels, and caps its height ---- */
.demo { contain: layout paint; overflow: hidden; }
.demo-body { overflow: visible; }
.demo-body > div { min-height: 0; }

/* ---- pager at the top, so the current item and the next one are both above the fold ---- */
.pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 14px;
  padding: 0 0 10px; border-bottom: 1px solid var(--border); }
.pager a { display: inline-flex; align-items: center; gap: 6px; max-width: 46%; min-height: 36px; padding: 0 10px;
  border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--foreground); text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pager a:hover { background: var(--muted); }
.pager .dir { color: var(--muted-foreground); }
.pager .off { flex: 1; }
@media (min-width: 861px) { .pager { position: sticky; top: 0; z-index: 5; background: var(--background); } }
@media (max-width: 860px) { .pager a { min-height: 44px; font-size: 13.5px; } }
.rail-filter { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 10px; border-bottom: 1px solid var(--border); }
.rail-filter button { font-size: 12px; padding: 5px 9px; min-height: 30px; border: 1px solid var(--border);
  border-radius: 99px; background: transparent; color: var(--muted-foreground); }
.rail-filter button.on { background: var(--foreground); color: var(--background); border-color: var(--foreground); }
@media (max-width: 860px) { .rail-filter button { min-height: 44px; } }

/* ---- page rhythm, measured off ui.shadcn.com/docs/components/base/accordion:
       640px content column, demo card with 40px inner padding and 16/48 margins, h1 30/36, h2 18.75 ---- */
.page-in { max-width: 640px; padding: 40px 24px 72px; }
.page-in h1 { font-size: 30px; line-height: 36px; letter-spacing: -0.015em; margin: 0 0 6px; }
.page-in .lede { font-size: 15px; line-height: 24px; margin-bottom: 18px; }
.demo { margin: 16px 0 32px; border-radius: 12px; }
.demo-head { padding: 8px 12px; }
.demo-body { padding: 40px; }
.demo-code { padding: 0; }
.demo-code pre { margin: 0; padding: 16px 20px; }
.section-h { font-size: 18.75px; line-height: 1.35; letter-spacing: -0.01em; margin: 34px 0 10px; }
.page-in p, .page-in li { font-size: 14px; line-height: 1.75; }
.pager { margin-bottom: 22px; }
.withheld { margin: 14px 0 26px; padding: 14px 16px; }
@media (max-width: 860px) {
  .page-in { padding: 18px 16px 56px; }
  .demo { margin: 12px -16px 24px; }
  .demo-body { padding: 20px; }
  .page-in h1 { font-size: 26px; line-height: 32px; }
}

/* the demo owns its full height; a scroller here would fight the page */
.demo-body { overflow: visible; }

/* ---- source files: a code pane that scrolls inside its own box instead of running off the card ---- */
.demo-code { border-top: 1px solid var(--border); background: var(--muted); }
.demo-code pre { margin: 0; padding: 16px 20px; max-height: 560px; overflow: auto; white-space: pre;
  font-size: 12.5px; line-height: 1.6; tab-size: 2; }
.demo-code pre::-webkit-scrollbar { height: 8px; width: 8px; }
.demo-code pre::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
.tabs { flex-wrap: wrap; row-gap: 6px; }
.file-name { font-size: 12px; color: var(--muted-foreground); padding: 8px 2px 0; overflow-wrap: anywhere; }
@media (max-width: 860px) { .demo-code pre { max-height: 420px; font-size: 12px; } }

/* a block is a page layout, so its column is wider than a component's */
.page-in.wide { max-width: 900px; }
.file-tabs { margin-bottom: 0; }
`;export{e as default};