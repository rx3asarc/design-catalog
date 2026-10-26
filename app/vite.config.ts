import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/design-catalog/",
  plugins: [react(), tailwindcss()],
  build: {
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
