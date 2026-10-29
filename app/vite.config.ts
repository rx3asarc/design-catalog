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

export default defineConfig({
  base: "/design-catalog/",
  plugins: [react(), tailwindcss(), catalogCounts()],
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
