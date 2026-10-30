/**
 * The two modules `vite.config.ts`'s `catalogSplit()` plugin makes at build time. They are not files on disk, so
 * TypeScript has to be told they exist; `manifest.json` stays the one file the build reads and the gates read.
 *
 * `virtual:catalog-core` is `manifest.json` minus the four per-item detail fields (`files`, `variants`,
 * `behaviour`, `renderNote`) — 40 KB gzipped instead of 55, and the fields the first screen needs are all in it.
 * `virtual:catalog-detail-url` is the content-hashed URL of the detail payload `site/lib.ts` fetches once.
 */
declare module "virtual:catalog-core" {
  const core: Record<string, unknown>[];
  export default core;
}

declare module "virtual:catalog-detail-url" {
  const url: string;
  export default url;
}
