/**
 * r7-sweep — walk every route the catalogue has and measure what the design system still misses.
 *
 *   node qa/r7_sweep_measure.mjs [baseUrl] [--out path] [--only route-substring]
 *
 * The design system (r6) makes seven promises that are checkable on a rendered page, so this measures those
 * seven and nothing else:
 *
 *   1. type floor      every text node the site owns is >= 12 px (demos live in iframes; iframes are not walked)
 *   2. accent budget   one element painted `--accent` per view, and the report names the elements
 *   3. shadows         non-`none` box-shadow is chrome-vs-demo, and demos keep theirs
 *   4. radii           no control at radius-full (99 px) that is not a dot or an avatar
 *   5. contrast        ink-subtle wherever it is used, and any text on surface-300 under 4.5:1, from painted
 *                      colours resolved in the page, never from the token table
 *   6. overflow        horizontal scroll at 390, and text clipped by a fixed box
 *   7. dead ends       an empty content column, `href="#"`, and links that do not resolve
 *
 * It is measurement, not a gate: it prints and writes JSON, and the report is written by hand from the JSON.
 * Playwright comes from /root/camofox-browser (the same absolute import every other harness here uses); nothing
 * is added to app/package.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const { chromium } = await import("/root/camofox-browser/node_modules/playwright/index.mjs");

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith("--"));
const optOut = args.indexOf("--out");
const BASE = (pos[0] ?? "https://rx3asarc.github.io/design-catalog/").replace(/\/?$/, "/");
const OUT = resolve(optOut >= 0 ? args[optOut + 1] : "qa/r7_sweep.json");
/*
 * Chunked, because one browser cannot hold all 116 views on this box.
 *
 * The first full run died at view 60 — `Target page, context or browser has been closed` — with 2 GB free and the
 * swap already half spent: the gallery mounts 769 tiles and ~9 live iframes, and the context that had just walked
 * 29 routes was still holding every heap it had allocated. So the walk is a matrix of four chunked invocations
 * (theme × viewport) that `--append` merges into one file. Same coverage, bounded memory, resumable.
 */
const flagVal = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const ONLY_THEME = flagVal("theme", null);
const ONLY_VP = flagVal("vp", null);
const APPEND = args.includes("--append");
const MATCH = flagVal("match", null);
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
].filter((v) => !ONLY_VP || v.name === ONLY_VP);

/* Every route class the brief names, plus the ids that make the classes differ from each other. */
const ROUTES = [
  ["#/", "home"],
  ["#/g", "gallery all"],
  ["#/g/sec=Blocks+and+pages", "gallery: Blocks and pages"],
  ["#/g/sec=Components", "gallery: Components"],
  ["#/g/sec=Motion+and+effects", "gallery: Motion and effects"],
  ["#/g/sec=Docs", "gallery: Docs"],
  ["#/g?src=beui", "gallery: one source"],
  ["#/g/Components", "gallery: a bare word where a query goes"],
  ["#/chrome", "chrome"],
  ["#/about", "about"],
  // ten ids: a block, an effect, a text item, a withheld item, a demo and a no-demo row from every source
  ["#/i/shadcn/chart-area-axes", "item: shadcn block, 2+ variants"],
  ["#/i/beui/availability-scheduler", "item: beui block"],
  ["#/i/beui/action-swap", "item: beui component"],
  ["#/i/shadcn/accordion-demo", "item: shadcn pattern"],
  ["#/i/shadcn/button", "item: shadcn component, many variants"],
  ["#/i/shadcn/input", "item: shadcn component, 14 variants"],
  ["#/i/beautifului/agent-screen", "item: withheld (beautifului)"],
  ["#/i/transitions/3d-tilt", "item: effect (transitions, withheld)"],
  ["#/i/rareui/ai-status", "item: withheld (rareui)"],
  ["#/i/shadcn/docs-changelog", "item: text (shadcn, no demo)"],
  // six comparison keys
  ["#/c/sidebar", "concept: sidebar (25 members)"],
  ["#/c/accordion", "concept: accordion"],
  ["#/c/tabs", "concept: tabs"],
  ["#/c/tooltip", "concept: tooltip"],
  ["#/c/combobox", "concept: combobox"],
  ["#/c/table", "concept: table"],
  // the miss
  ["#/i/nope/nope", "miss: unknown source"],
  ["#/i/shadcn/does-not-exist", "miss: known source, unknown slug"],
  ["#/nope", "miss: unknown path"],
];

/* ── the in-page probe ──────────────────────────────────────────────────────────────────────────────────
   One function, serialised into the page. It reads painted values (`getComputedStyle`), so a token that is
   colour-mixed, glassed or overridden measures as the browser resolves it. */
function probe() {
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const cls = (el) => (typeof el.className === "string" ? el.className : el.getAttribute("class") || "");
  const own = (el) => {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.replace(/\s+/g, " ").trim();
  };
  const where = (el) => {
    if (el.closest("iframe")) return "iframe";
    if (el.closest("[data-catalog-topbar], .topbar")) return "chrome:topbar";
    if (el.closest("[data-catalog-item='shadcn/sidebar'], nav[aria-label], .rail")) return "chrome:rail";
    if (el.closest(".page-in")) return "page";
    return "shell";
  };
  const name = (el) => ({
    tag: el.tagName.toLowerCase(),
    cls: cls(el).slice(0, 90),
    where: where(el),
    text: (own(el) || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    path: (() => {
      const parts = [];
      let e = el;
      for (let i = 0; i < 4 && e && e !== document.body; i += 1, e = e.parentElement) {
        parts.unshift(e.tagName.toLowerCase() + (cls(e) ? "." + cls(e).split(/\s+/).filter(Boolean).slice(0, 2).join(".") : ""));
      }
      return parts.join(">");
    })(),
  });

  /* tokens, resolved through a throwaway element inside the chrome root */
  const root = document.querySelector(".cat") ?? document.body;
  const p = document.createElement("div");
  p.style.cssText = "position:absolute;left:-9999px;top:0";
  root.appendChild(p);
  const tok = {};
  for (const n of ["--surface-100", "--surface-200", "--surface-300", "--ink", "--ink-muted", "--ink-subtle", "--accent", "--accent-ink", "--on-accent", "--border", "--border-strong", "--focus", "--radius-full"]) {
    p.style.color = `var(${n})`;
    tok[n] = getComputedStyle(p).color;
    p.style.color = "";
  }
  p.remove();
  const norm = (s) => (s || "").replace(/\s+/g, "");

  /*
   * Colours, resolved by painting them.
   *
   * The tokens in this build are `oklch()` (Tailwind v4), and the first version of this probe parsed the digits
   * out of the computed string — which read `oklch(0.985 0 0)` as `rgb(0.985, 0, 0)`, i.e. black, and reported
   * ratios of 1.05 and 1.11 for text that is legible on screen. So every colour here is drawn into a 1×1 canvas
   * and read back as the sRGB the screen actually gets, alpha composited over whatever is behind it. Nothing is
   * computed from the token table; this is the painted value.
   */
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const paintOver = (color, under) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = under ? `rgb(${under.join(",")})` : "rgb(255,255,255)";
    cx.fillRect(0, 0, 1, 1);
    cx.fillStyle = color; // an unparseable colour leaves fillStyle untouched and measures as the backdrop
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (c) => {
    const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const alphaOf = (c) => {
    const m = String(c).match(/\/\s*([\d.]+)\s*%?\s*\)$/);
    if (m) return parseFloat(m[1]) > 1 ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    const r = String(c).match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
    if (r) return parseFloat(r[1]);
    return String(c) === "transparent" ? 0 : 1;
  };
  /* the first ancestor that paints something with alpha, as a colour composited down to the document */
  const bgStack = (el) => {
    const stack = [];
    let e = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      const a = alphaOf(c);
      if (a > 0.001) { stack.push([c, a]); if (a >= 0.999) break; }
      e = e.parentElement;
    }
    const page = getComputedStyle(document.documentElement).backgroundColor;
    let rgb = paintOver(alphaOf(page) > 0.001 ? page : "rgb(255,255,255)", null);
    for (let i = stack.length - 1; i >= 0; i -= 1) rgb = paintOver(stack[i][0], rgb);
    return rgb;
  };
  const opaqueBg = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (alphaOf(c) >= 0.999) return c;
      e = e.parentElement;
    }
    return getComputedStyle(document.documentElement).backgroundColor || "rgb(255,255,255)";
  };
  const samePaint = (a, b) => {
    const x = paintOver(a, null), y = paintOver(b, null);
    return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) <= 2;
  };
  const surfaceName = (c) => {
    for (const [k, v] of Object.entries(tok)) if (samePaint(v, c)) return k.replace("--", "");
    const rgb = paintOver(c, null);
    return `rgb(${rgb.join(",")})`;
  };
  /* a box-shadow is only a shadow if some part of it paints: Tailwind v4 emits `rgba(0,0,0,0) …` for a ring
     that is not used, and that is `none` in everything but the computed string */
  const shadowPaints = (s) => {
    const cols = String(s).match(/(rgba?|oklch|color)\([^)]*\)/g) ?? [];
    return cols.some((c) => alphaOf(c) > 0.001);
  };
  const inDemoCard = (el) => !!el.closest(".demo, .demo-body, .demo-head");
  const clamped = (s) => s.webkitLineClamp && s.webkitLineClamp !== "none" || s.textOverflow === "ellipsis";

  const all = [...document.querySelectorAll("*")];
  const typeFloor = [], accent = [], shadows = [], radii = [], contrast = [], overflow = [];
  for (const el of all) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const w = where(el);

    /* 1. type floor — only elements that own text; iframes are not reached by querySelectorAll at all */
    const text = own(el);
    if (text) {
      const fs = parseFloat(s.fontSize);
      if (fs < 12) typeFloor.push({ ...name(el), text, fs: Math.round(fs * 100) / 100 });
    }

    /* 2. accent fills — compared by painted colour, so an oklch token and an rgb literal match */
    const bg = s.backgroundColor;
    if (alphaOf(bg) > 0.5 && samePaint(bg, tok["--accent"])) {
      accent.push({ ...name(el), area: Math.round(box.width) + "x" + Math.round(box.height), bg: `rgb(${paintOver(bg, null).join(",")})`, demoCard: inDemoCard(el) });
    }

    /* 3. shadows — transparent ring slots are not shadows */
    if (s.boxShadow && s.boxShadow !== "none" && shadowPaints(s.boxShadow)) shadows.push({ ...name(el), shadow: s.boxShadow.slice(0, 70), demoCard: inDemoCard(el) });

    /* 4. radius-full on something that is not a dot or an avatar */
    const rr = parseFloat(s.borderTopLeftRadius) || 0;
    const isDot = box.width <= 20 && box.height <= 20 && Math.abs(box.width - box.height) <= 2;
    const avatar = /\bavatar\b/i.test(cls(el)) || /avatar/i.test((el.getAttribute("aria-label") || "") + (el.getAttribute("alt") || "") + (el.getAttribute("src") || ""));
    const control = el.matches("button, a[href], input, select, textarea, summary, [role='button'], [role='radio'], [role='tab'], [role='menuitem'], [role='option'], [role='switch'], [role='checkbox'], [data-slot], [data-sidebar='menu-button']");
    if (control && rr >= 99 && !isDot && !avatar) radii.push({ ...name(el), radius: Math.round(rr), box: Math.round(box.width) + "x" + Math.round(box.height), demoCard: inDemoCard(el) });

    /* 5. contrast — every text-owning element, against the colour composited under it */
    if (text && text.length > 1) {
      const bgPainted = bgStack(el);
      const fgPainted = paintOver(s.color, bgPainted);
      const r = ratio(fgPainted, bgPainted);
      const opaque = opaqueBg(el);
      const isSubtle = samePaint(s.color, tok["--ink-subtle"]);
      const onSurface300 = samePaint(opaque, tok["--surface-300"]);
      if (r < 4.5) contrast.push({
        ...name(el), text,
        fg: `rgb(${fgPainted.join(",")})`, bg: `rgb(${bgPainted.join(",")})`, bgToken: surfaceName(opaque),
        ratio: Math.round(r * 100) / 100, isSubtle, onSurface300, demoCard: inDemoCard(el), fs: Math.round(parseFloat(s.fontSize) * 10) / 10, weight: s.fontWeight,
      });
    }

    /* 6. overflow — the widget that scrolls sideways at 390, and the fixed box that eats text */
    const sw = el.scrollWidth, cw = el.clientWidth, sh = el.scrollHeight, ch = el.clientHeight;
    if (window.innerWidth <= 420) {
      if (sw > cw + 1 && cw > 0 && !/auto|scroll/.test(s.overflowX) && el !== document.documentElement && el !== document.body) {
        overflow.push({ kind: "h-scroll", ...name(el), scrollWidth: sw, clientWidth: cw, demoCard: inDemoCard(el) });
      }
    }
    if (/hidden|clip/.test(s.overflowY) && sh > ch + 1 && ch > 0) {
      overflow.push({ kind: clamped(s) ? "v-truncated" : "v-clipped", ...name(el), scrollHeight: sh, clientHeight: ch, demoCard: inDemoCard(el) });
    }
  }

  /* 7. dead ends */
  const pageIn = document.querySelector(".page-in");
  const pageText = pageIn ? (pageIn.textContent || "").replace(/\s+/g, " ").trim() : "";
  const hrefs = [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim().slice(0, 40), where: where(a) }));
  const dead = hrefs.filter((h) => h.href === "#" || h.href === "" || h.href === "javascript:void(0)" || h.href === "javascript:;");

  return {
    url: location.href,
    title: (document.querySelector(".page-in .title, .page-in h2, .page-in h1")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
    route: document.querySelector("[data-route]")?.getAttribute("data-route") ?? "",
    pageInText: pageText.length,
    pageInKids: pageIn ? pageIn.children.length : 0,
    pageInImages: pageIn ? pageIn.querySelectorAll("img, iframe, canvas, svg").length : 0,
    tokens: Object.fromEntries(Object.entries(tok).map(([k, v]) => [k, `rgb(${paintOver(v, null).join(",")})`])),
    typeFloor, accent, shadows, radii, contrast, overflow, dead,
    hrefs,
  };
}

/* ── run ─────────────────────────────────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"],
});

const out = { base: BASE, at: new Date().toISOString(), loadavg: "", views: [] };
try { out.loadavg = (await import("node:fs")).readFileSync("/proc/loadavg", "utf8").trim(); } catch { /* not linux */ }
if (APPEND && (await import("node:fs")).existsSync(OUT)) {
  const prev = JSON.parse((await import("node:fs")).readFileSync(OUT, "utf8"));
  out.views = prev.views;
  out.at = prev.at;
}
const seen = new Set(out.views.map((v) => `${v.theme}|${v.viewport}|${v.route}`));

for (const theme of ["dark", "light"].filter((t) => !ONLY_THEME || t === ONLY_THEME)) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: theme });
    // the theme is read from localStorage by the app at boot, so it is set once, in this context, before a route
    const seed = await ctx.newPage();
    await seed.goto(BASE, { waitUntil: "domcontentloaded" });
    await seed.evaluate((t) => localStorage.setItem("catalog-theme", t), theme);
    await seed.close();
    for (const [route, label] of ROUTES) {
      if (MATCH && !route.includes(MATCH)) continue;
      if (seen.has(`${theme}|${vp.name}|${route}`)) continue;
      // one page per route: a closed page hands its heap back, and the gallery's 769 tiles are the reason this
      // run is chunked at all (see the header)
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "load" });
      await page
        .waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 20000 })
        .catch(() => {});
      await page.waitForTimeout(700); // one beat for the surface's own effects (scroll restore, fonts)
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(probe);
      await page.close();
      out.views.push({ theme, viewport: vp.name, route, label, ...m });
      const n = (a) => a.length;
      console.log(
        `${theme} ${vp.name} ${route.padEnd(36)} floor=${String(n(m.typeFloor)).padStart(3)} accent=${n(m.accent)} ` +
        `shadow=${String(n(m.shadows)).padStart(2)} radius=${n(m.radii)} contrast=${String(n(m.contrast)).padStart(2)} ` +
        `overflow=${String(n(m.overflow)).padStart(2)} dead=${n(m.dead)} text=${m.pageInText}`,
      );
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(out, null, 1)); // a crash keeps the views it already has
    }
    await ctx.close();
  }
}

await browser.close();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\nwrote ${OUT} — ${out.views.length} views`);

/* the totals, so a run is readable without opening the JSON */
const sum = (k) => out.views.reduce((n, v) => n + v[k].length, 0);
console.log(
  `totals: typeFloor=${sum("typeFloor")} accent=${sum("accent")} shadows=${sum("shadows")} radii=${sum("radii")} ` +
  `contrast=${sum("contrast")} overflow=${sum("overflow")} dead=${sum("dead")}`,
);
