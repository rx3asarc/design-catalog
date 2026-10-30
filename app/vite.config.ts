import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
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
 *   - in `site/Featured.tsx`, which is what the running app uses and the authority on what the row is.
 * The two are compared on every publish by `qa/r2_check.mjs` (it reads `data-boot-hero-ids` out of the raw
 * `index.html` and `data-hero-ids` off the mounted row and fails if they differ). If they ever diverge, the
 * publish stops; the fix is to bring this copy back into line with `Featured.tsx`, never the other way round.
 *
 * Both copies read the SAME inputs — `src/site/taxonomy.json` for membership and `src/site/hero-ink.json` for how
 * legible each candidate's demo is as a tile — so neither the sections nor the measurements can drift; only the
 * ordering code is written twice, and the outcome is compared.
 *
 * The rule, in one sentence: a candidate is a composition (three or more parts) that runs and measures at or above
 * the ink floor, no two tiles share a type, one tile per section first and at most two per section, and inside a
 * section the order is most distinct primitives, most parts, fewest files, id. `site/Featured.tsx` carries the
 * reasons and the measured table.
 */
const TAXONOMY = JSON.parse(
  readFileSync(fileURLToPath(new URL("./src/site/taxonomy.json", import.meta.url)), "utf8"),
) as { sections: Record<string, Record<string, string[]>> };
const HERO_INK = JSON.parse(
  readFileSync(fileURLToPath(new URL("./src/site/hero-ink.json", import.meta.url)), "utf8"),
) as { floor: number; ink: Record<string, number> };
const SECTION_ORDER = ["Components", "Blocks", "Charts", "Agent UI", "Effects", "Foundations", "Docs"];
const MAX_PER_SECTION = 2;

type MItem = {
  id: string; source: string; slug: string; kind: string; name: string; displayName?: string;
  category?: string; variants?: unknown[]; file_count?: number | null; bytes?: number | null;
  dep_count?: number | null; used_here?: number | null; has_demo?: boolean;
  composition?: { count?: number; lower_bound?: boolean; primitives?: string[] } | null;
};

const text = (v: unknown) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Cand = { item: MItem; section: string; type: string; prims: number; comp: number; files: number; ink: number };

function heroSix(items: MItem[]): MItem[] {
  const idOf = (i: MItem) => `${i.source}/${i.slug}`;
  const sectionOf = new Map<string, { section: string; type: string }>();
  for (const section of SECTION_ORDER)
    for (const [type, ids] of Object.entries(TAXONOMY.sections[section] ?? {}))
      for (const id of ids) sectionOf.set(id, { section, type });

  const candidates: Cand[] = items
    .map((item): Cand | null => {
      const at = sectionOf.get(idOf(item));
      if (!at) return null;
      const comp = item.composition?.count ?? 0;
      const ink = HERO_INK.ink[idOf(item)] ?? -1;
      const runs = item.has_demo ?? (item.variants?.length ?? 0) > 0;
      if (comp < 3 || !runs || ink < HERO_INK.floor) return null;
      return {
        item, section: at.section, type: at.type,
        prims: item.composition?.primitives?.length ?? 0,
        comp,
        files: typeof item.file_count === "number" ? item.file_count : Number.POSITIVE_INFINITY,
        ink,
      };
    })
    .filter((c): c is Cand => !!c)
    .sort((a, b) => b.prims - a.prims || b.comp - a.comp || a.files - b.files || a.item.id.localeCompare(b.item.id));

  // staleness, said out loud at build time instead of guessed at run time: a candidate the rule could reach but
  // which has no measurement is not ranked (and cannot win), so a manifest update cannot quietly promote a demo
  // nobody has looked at. `node …/r8-home-candidates.mjs --write` refreshes the table.
  const unmeasured = items.filter((i) => {
    const at = sectionOf.get(idOf(i));
    return !!at && (i.composition?.count ?? 0) >= 3 && (i.has_demo ?? (i.variants?.length ?? 0) > 0) && HERO_INK.ink[idOf(i)] === undefined;
  });
  if (unmeasured.length) console.warn(`[hero] ${unmeasured.length} candidate(s) have no entry in src/site/hero-ink.json: ${unmeasured.slice(0, 6).map(idOf).join(", ")}${unmeasured.length > 6 ? ", …" : ""}`);

  const sections = SECTION_ORDER.filter((s) => candidates.some((c) => c.section === s));
  const usedTypes = new Set<string>();
  const perSection = new Map<string, number>(sections.map((s) => [s, 0]));
  const chosen: Cand[] = [];
  const next = (s: string) =>
    (perSection.get(s) ?? 0) >= MAX_PER_SECTION
      ? null
      : candidates.find((c) => c.section === s && !usedTypes.has(c.type)) ?? null;
  const take = (s: string) => {
    const c = next(s);
    if (!c || chosen.length >= 6) return false;
    chosen.push(c);
    usedTypes.add(c.type);
    perSection.set(s, (perSection.get(s) ?? 0) + 1);
    return true;
  };
  for (const s of sections) take(s);
  while (chosen.length < 6) {
    const pick = sections
      .map((s) => ({
        s,
        left: (perSection.get(s) ?? 0) >= MAX_PER_SECTION
          ? 0
          : candidates.filter((c) => c.section === s && !usedTypes.has(c.type)).length,
      }))
      .sort((a, b) => b.left - a.left || sections.indexOf(a.s) - sections.indexOf(b.s))[0];
    if (!pick || pick.left === 0) break;
    if (!take(pick.s)) break;
  }
  return chosen.map((c) => c.item);
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

/* ── THE MANIFEST, SPLIT BY WHAT A SURFACE ACTUALLY READS ──────────────────────────────────────────────────
 *
 * `site/lib.ts` used to `import manifest from "../../manifest.json"`, which put all 583 KB of it inside the
 * entry's own chunk — and the entry cannot run until that chunk has arrived, so *no* surface could draw until
 * the whole catalogue had crossed the wire. Measured at 400 kbit/s (50 KB/s), `#/` was 13.2 s to the first
 * click that did anything, and ~390 KB gzipped of that was the page.
 *
 * The front page does not read `files`, `variants`, `behaviour` or `renderNote` for anything. Neither does the
 * rail, the palette, the counts, the tiles or the boot shell. Those four fields are 14 KB gzipped of per-item
 * detail that only an item page (`site/ItemPage.tsx`) and a comparison (`site/Compare.tsx`) ever print, and both
 * of those are already `lazy` surfaces with their own chunk. So the split is drawn exactly there:
 *
 *   CORE    every field the shell, the front page, the rail, the palette and the counts read. Bundled into the
 *           entry (it arrives with the JavaScript that needs it; no extra round trip), built here from
 *           `manifest.json` so there is still one file on disk and one ingest.
 *   DETAIL  `files`, `variants`, `behaviour`, `renderNote`, one row per item in manifest order, emitted as a
 *           content-hashed JSON asset and fetched once by `site/lib.ts` when an item page or a comparison opens.
 *
 * Two fields in CORE are *counts of* arrays that now live in DETAIL — `has_demo` (is `variants` non-empty) and
 * `file_count` (length of `files`). Four places in the source used the arrays to answer those two questions:
 * `site/counts.ts` (twice), `site/App.tsx`, `site/Rail.tsx`, `site/Tile.tsx`. They read the published counts now,
 * and the two invariants that makes them the *same* answer are asserted below: if a future ingest ever publishes
 * a `has_demo` or a `file_count` that disagrees with its array, this build stops rather than shipping two
 * spellings of one fact.
 *
 * `manifest.json` itself is untouched and stays the source the build reads and the QA gates read from disk.
 */
const DETAIL_FIELDS = ["files", "variants", "behaviour", "renderNote"] as const;

function coreAndDetail(items: MItem[]) {
  const core: Record<string, unknown>[] = [];
  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    const it = item as MItem & { has_demo?: boolean; files?: unknown[]; variants?: unknown[]; withheld?: boolean; reference_only?: boolean };
    const variants = (it.variants ?? []).length;
    const files = (it.files ?? []).length;
    if (Boolean(it.has_demo) !== (variants > 0)) {
      throw new Error(`catalog-split: ${it.id} publishes has_demo=${String(it.has_demo)} with ${variants} variants; the shell reads has_demo off CORE, so the two must agree`);
    }
    if ((it.file_count ?? 0) !== files) {
      throw new Error(`catalog-split: ${it.id} publishes file_count=${String(it.file_count)} with ${files} files in the manifest; counts read file_count off CORE, so the two must agree`);
    }
    const flat = it as unknown as Record<string, unknown>;
    const c: Record<string, unknown> = {};
    for (const k of Object.keys(flat)) if (!(DETAIL_FIELDS as readonly string[]).includes(k)) c[k] = flat[k];
    core.push(c);
    const d: Record<string, unknown> = {};
    for (const k of DETAIL_FIELDS) if (k in flat) d[k] = flat[k];
    rows.push(d);
  }
  /* rows are aligned to core by manifest order, not by id: `id` is 4 KB gzipped and the order is the manifest's.
     `site/lib.ts` refuses a payload whose length is not the core's, so a drift cannot be silently mis-merged. */
  return { core, detail: JSON.stringify({ v: 1, n: items.length, rows }) };
}

function catalogSplit(items: MItem[]) {
  const { core, detail } = coreAndDetail(items);
  const hash = createHash("sha256").update(detail).digest("hex").slice(0, 10);
  const fileName = `manifest/detail-${hash}.json`;
  const CORE = "\0virtual:catalog-core";
  const URL_ID = "\0virtual:catalog-detail-url";
  return {
    name: "catalog-split",
    resolveId(id: string) {
      if (id === "virtual:catalog-core") return CORE;
      if (id === "virtual:catalog-detail-url") return URL_ID;
    },
    load(id: string) {
      if (id === CORE) return `export default ${JSON.stringify(core)};`;
      if (id === URL_ID) return `export default import.meta.env.BASE_URL + ${JSON.stringify(fileName)};`;
    },
    generateBundle(this: { emitFile: (f: { type: "asset"; fileName: string; source: string }) => string }) {
      this.emitFile({ type: "asset", fileName, source: detail });
    },
  };
}

export default defineConfig({
  base: "/design-catalog/",
  plugins: [react(), tailwindcss(), catalogCounts(), cssWithoutThePaintTax(), staticHero(manifest as MItem[]), catalogSplit(manifest as MItem[])],
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
