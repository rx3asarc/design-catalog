import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

/**
 * The meta description in `index.html` states how many entries there are and how many actually render here.
 * A hand-typed count is a lie waiting for the next ingest, so both numbers are read from `manifest.json` — the
 * authoritative source — and substituted at build time. If the manifest grows, the description keeps up by
 * itself; nothing else in the build changes.
 */
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL("./manifest.json", import.meta.url)), "utf8"),
) as { variants?: unknown[] }[];

function catalogCounts() {
  const counts: Record<string, string> = {
    "%CATALOG_COUNT%": String(manifest.length),
    "%CATALOG_RENDERED%": String(manifest.filter((i) => i.variants?.length).length),
  };
  return {
    name: "catalog-counts",
    transformIndexHtml: (html: string) =>
      Object.entries(counts).reduce((out, [token, n]) => out.split(token).join(n), html),
  };
}

/**
 * THE STYLESHEET, WITHOUT THE FIRST-PAINT TAX.
 *
 * A render-blocking `<link rel=stylesheet>` stops the browser painting *anything*, including the inline shell in
 * `index.html`, until 46 KB (gzipped) of CSS has arrived. Measured at 400 kbit/s with 400 ms RTT on the live
 * build, first paint was 8.3 s — the shell was in the document the whole time and the browser would not draw it.
 *
 * So the link is emitted as a preload that becomes the stylesheet on load. The shell carries its own ~2 KB inline
 * CSS and needs nothing else to be legible; by the time React mounts, the real stylesheet has long since applied.
 * `<noscript>` keeps the no-JavaScript case exactly as it was. This is a build-time transformation of one tag, not
 * a change to the CSS or to any surface.
 */
function cssWithoutThePaintTax() {
  return {
    name: "css-without-the-paint-tax",
    enforce: "post" as const,
    transformIndexHtml: (html: string) =>
      html.replace(
        /<link rel="stylesheet"([^>]*)href="([^"]+\.css)"([^>]*)>/g,
        (_m, a: string, href: string, b: string) =>
          `<link rel="preload" as="style"${a}href="${href}"${b} onload="this.rel='stylesheet'">` +
          `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
      ),
  };
}


/**
 * THE FRONT PAGE'S OWN FIRST FRAME, BEFORE REACT.
 *
 * The shell in `index.html` used to say "loading demo…" in six grey boxes, which was honest but thin: the visitor
 * waited out the bundle and then watched six words turn into six demos. The front page's hero is chosen by a rule
 * from the manifest and every field it shows is in the manifest, so the *same* six cards can be drawn in the HTML
 * at build time. Same ids, same titles, same `source · kind`, same facet line as `Poster` in `site/Tile.tsx`.
 *
 * THE RULE IS WRITTEN TWICE, AND THAT IS A KNOWN COST, SO IT IS GATED:
 *   - here, in Node, at build time, before a byte of JavaScript has been requested;
 *   - in `site/Home.tsx`, which is what the running app uses and the authority on what the row is.
 * The two are compared on every publish by `qa/r2_check.mjs` (it reads `data-boot-hero-ids` out of the raw
 * `index.html` and `data-hero-ids` off the mounted row and fails if they differ). If they ever diverge, the
 * publish stops; the fix is to bring this copy back into line with `Home.tsx`, never the other way round.
 *
 * Section membership is copied from `SECTIONS` in `site/route.ts` — the categories are declared there and the
 * rail reads them; the same gate covers a divergence.
 */
const SECTIONS: [string, string[]][] = [
  ["Blocks and pages", ["Pages and blocks"]],
  ["Components", ["Navigation", "Forms and input", "Overlays and dialogs", "Actions and controls",
    "Feedback and status", "Layout and structure", "Content and text", "Charts and data", "Conversation and agent UI"]],
  ["Motion and effects", ["Motion and effects"]],
  ["Docs", ["Docs and guides"]],
];

type MItem = {
  id: string; source: string; slug: string; kind: string; name: string; displayName?: string;
  category?: string; variants?: unknown[]; file_count?: number | null; bytes?: number | null;
  dep_count?: number | null; used_here?: number | null; has_demo?: boolean;
  composition?: { count?: number; lower_bound?: boolean } | null;
};

const text = (v: unknown) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function heroSix(items: MItem[]): MItem[] {
  const runs = (i: MItem) => i.has_demo ?? (i.variants?.length ?? 0) > 0;
  const legible = (i: MItem) => (i.composition?.count ?? 0) >= 2;
  const rank = (i: MItem) => ({
    comp: i.composition?.count ?? 0,
    used: i.used_here ?? 0,
    files: typeof i.file_count === "number" ? i.file_count : null,
  });
  const by = (lead: "comp" | "used") => (a: MItem, b: MItem) => {
    const x = rank(a), y = rank(b);
    for (const k of (lead === "used" ? ["used", "comp", "files"] : ["comp", "used", "files"]) as const) {
      if (k === "files") {
        const ax = x.files ?? Number.POSITIVE_INFINITY, bx = y.files ?? Number.POSITIVE_INFINITY;
        if (ax !== bx) return ax - bx;
      } else if (x[k] !== y[k]) return y[k] - x[k];
    }
    return a.id.localeCompare(b.id);
  };
  const taken = new Set<string>();
  const pick = (label: string, n: number) => {
    const cats = SECTIONS.find((s) => s[0] === label)?.[1] ?? [];
    const rows = items.filter((i) => cats.includes(i.category ?? "Actions and controls")).filter((i) => runs(i) && legible(i));
    const chosen = rows.filter((i) => !taken.has(i.id)).sort(by("comp")).slice(0, n);
    chosen.forEach((i) => taken.add(i.id));
    return chosen;
  };
  const six = [...pick("Blocks and pages", 2), ...pick("Components", 2), ...pick("Motion and effects", 2)];
  const topUp = items.filter((i) => runs(i) && legible(i) && !taken.has(i.id)).sort(by("comp")).slice(0, 6 - taken.size);
  return [...six, ...topUp];
}

/** The facet line `Poster` prints under the title, from the same manifest fields and in the same order. */
function facetLine(i: MItem): string {
  const out: string[] = [];
  if (typeof i.file_count === "number") out.push(`${i.file_count} file${i.file_count === 1 ? "" : "s"}`);
  if (typeof i.bytes === "number") out.push(i.bytes >= 1024 ? `${Math.round(i.bytes / 1024)} KB` : `${i.bytes} B`);
  if (typeof i.dep_count === "number") out.push(`${i.dep_count} dep${i.dep_count === 1 ? "" : "s"}`);
  const c = i.composition?.count;
  if (typeof c === "number" && c > 0) out.push(`${i.composition?.lower_bound ? "≥" : ""}${c} part${c === 1 ? "" : "s"}`);
  if (typeof i.used_here === "number" && i.used_here > 0) out.push(`used here ×${i.used_here}`);
  return out.join(" \u00b7 ");
}

function card(i: MItem): string {
  const title = i.displayName ?? i.name;
  return (
    `<div class="boot-tile" data-boot-tile="${text(i.id)}">` +
    `<span class="boot-tile-kicker">demo</span>` +
    `<span class="boot-tile-body">` +
    `<span class="boot-tile-title">${text(title)}</span>` +
    `<span class="boot-tile-meta">${text(i.source)} \u00b7 ${text(i.kind)}</span>` +
    `<span class="boot-tile-facets">${text(facetLine(i))}</span>` +
    `</span></div>`
  );
}

function staticHero(items: MItem[]) {
  const six = heroSix(items);
  return {
    name: "static-hero",
    enforce: "post" as const,
    transformIndexHtml: (html: string) =>
      html.replace(/<div class="boot-tiles"[^>]*>[\s\S]*?<\/div>/, () =>
        `<div class="boot-tiles" data-boot-hero-ids="${six.map((i) => text(i.id)).join(" ")}">` +
        six.map(card).join("") +
        `</div>`,
      ),
  };
}

export default defineConfig({
  base: "/design-catalog/",
  plugins: [react(), tailwindcss(), catalogCounts(), cssWithoutThePaintTax(), staticHero(manifest as MItem[])],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        demo: fileURLToPath(new URL("./demo.html", import.meta.url)),
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
      { find: /^cn$/, replacement: fileURLToPath(new URL("./src/lib/utils.ts", import.meta.url)) },
      { find: /^next\/image$/, replacement: fileURLToPath(new URL("./src/shims/next.tsx", import.meta.url)) },
      { find: /^next\/link$/, replacement: fileURLToPath(new URL("./src/shims/link.tsx", import.meta.url)) },
      { find: /^next\/form$/, replacement: fileURLToPath(new URL("./src/shims/form.tsx", import.meta.url)) },
      { find: /^next\/font(\/.*)?$/, replacement: fileURLToPath(new URL("./src/shims/font.ts", import.meta.url)) },
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./src/shims/server-only.ts", import.meta.url)) },
      { find: /^react-day-picker\/persian$/, replacement: fileURLToPath(new URL("./src/shims/rdp-persian.ts", import.meta.url)) },
    ],
  },
});
