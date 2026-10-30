import { useEffect, useState } from "react";
import core from "virtual:catalog-core";
import detailUrl from "virtual:catalog-detail-url";

/**
 * The data the whole shell reads, and the one loader both the demo pane and the source pane use.
 *
 * `site/` is the shell's own directory: everything the chrome is made of lives here, one file per surface.
 * This module holds only what two or more of those surfaces need — the item type, the manifest, the label a
 * visitor reads, and the raw-source loader. It imports no other shell module, so nothing here can cycle.
 *
 * WHAT ARRIVES FIRST, AND WHAT DOES NOT.
 *
 * `virtual:catalog-core` is `manifest.json` minus four per-item fields — `files`, `variants`, `behaviour`,
 * `renderNote` — projected at build time by `catalogSplit()` in `vite.config.ts`. Everything the shell, the front
 * page, the rail, the palette and the counts read is in it, so the first screen draws as soon as the entry chunk
 * runs, without waiting for the catalogue's per-item detail. That detail is a content-hashed JSON asset now
 * (`detailUrl`), fetched **once** the first time a surface that prints it is opened — an item page, a comparison —
 * by `loadDetail()`, which merges it into these same `items` objects in place. So there is still one array, one
 * identity per item, and no second copy of the data to drift: `items` simply gets its last four fields a little
 * later than the rest.
 *
 * `Item` therefore types those four fields as optional. That is the point: the compiler names every place that
 * needs detail, and `useDetailItem()` is the one door those places go through. The alternative — typing them as
 * present and hoping — is how a page prints "0 files" for an item whose files simply have not arrived.
 */

export type Variant = { label: string; module: string };
export type Item = {
  id: string; source: string; slug: string; kind: string; name: string;
  /** The library's own title-cased name. shadcn's `name` is a lowercase slug; beui's is a title. Added by the data unit. */
  displayName?: string;
  /** The file the item is named after, named by the ingest. Added by the data unit; `mainFile()` works without it. */
  mainFile?: string | null;
  /** The rail's category. Present on every ingested item today; the rail treats a missing one as "Actions and controls". */
  category?: string;
  one_line: string | null; url: string | null; licence: string; page: string | null;
  install: string | null;
  /*
   * The four fields that arrive with the detail payload, not with the entry chunk. Optional on purpose — see the
   * header — and present on every item once `loadDetail()` has resolved.
   */
  files?: string[]; variants?: Variant[]; behaviour?: unknown; renderNote?: string | null;
  withheld?: boolean;
  /**
   * The concept sets this item belongs to, by the store's own key. Published by the data unit; absent means
   * "in none" and never "not known" — 118 of the 769 items carry one or more, across 29 sets.
   */
  concepts?: string[] | null;
};

export const items = core as unknown as Item[];
export const byId = new Map(items.map((i) => [i.id, i]));

/**
 * The detail payload, once, per page load.
 *
 * `loadDetail()` is the only fetcher: a module-scoped promise, so two item pages opened in one session (or a
 * comparison and an item page) share one request. Returns `true` when the rows landed and were merged, `false`
 * when they did not — an offline visitor, a stale cache asking for a chunk this deploy replaced. A `false` is not
 * an error page: the surfaces that need detail say so in their own words rather than printing zeroes.
 *
 * The merge is a `Object.assign` onto the core row at the same index. Rows are aligned by manifest order, so the
 * payload carries no ids (4 KB gzipped that the browser already has); the length check below is what makes that
 * assumption safe — a payload from a *different* build has a different length or, if it did not, a different
 * hash in its filename, so a mis-merge cannot happen quietly.
 */
let detailPromise: Promise<boolean> | null = null;
export function loadDetail(): Promise<boolean> {
  if (!detailPromise) {
    detailPromise = fetch(detailUrl, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`detail ${r.status}`))))
      .then((d: { n?: number; rows?: Record<string, unknown>[] }) => {
        if (!Array.isArray(d?.rows) || d.rows.length !== items.length) throw new Error("detail shape");
        d.rows.forEach((row, i) => Object.assign(items[i], row));
        return true;
      })
      .catch(() => false);
  }
  return detailPromise;
}

/**
 * An item, with the detail fields the caller is about to print — or `null` while they are still on the wire.
 *
 * This is `Item` with `files` and `variants` narrowed from optional to required, so a surface cannot read them
 * without having asked. Both callers (`site/ItemPage.tsx`, `site/Compare.tsx`) are `lazy` surfaces already, so
 * their chunk and this payload travel together and the visitor sees the shell's own "Fetching …" line, not a
 * spinner this module invented.
 */
export type ItemFull = Item & { files: string[]; variants: Variant[] };

export function useDetail(): { ready: boolean; failed: boolean } {
  const [state, setState] = useState<{ ready: boolean; failed: boolean }>({ ready: false, failed: false });
  useEffect(() => {
    let live = true;
    loadDetail().then((ok) => live && setState({ ready: ok, failed: !ok }));
    return () => { live = false; };
  }, []);
  return state;
}

/** The item with its detail fields, or `null` until they have landed. */
export function useDetailItem(i: Item): ItemFull | null {
  const { ready } = useDetail();
  return ready ? (i as ItemFull) : null;
}

/** What a visitor reads. Never a casing rule invented here: the data says the name, or the slug is the name. */
export const label = (i: Item) => i.displayName ?? i.name;

/**
 * Concept membership, exactly as the manifest publishes it — the only input a comparison page has.
 *
 * What the manifest does **not** publish is the store's `concept.rule`: how each set was chosen
 * (`slug-normalised`, a keyword matcher, or a human). That is a missing field, not a licence to invent one, so
 * the accessor for it does not exist here and `site/Compare.tsx` says the method is unpublished instead of
 * guessing at it. Add the field upstream (the generator, not this module) and the page prints it verbatim.
 */
export const conceptsOf = (i: Item): string[] => i.concepts ?? [];
/** Every concept key in the build, sorted — 29 today, every one of them with at least two members. */
export const conceptKeys: string[] = [...new Set(items.flatMap(conceptsOf))].sort();
/** The members of one concept, in manifest order; empty for a key no item carries. */
export const conceptMembers = (key: string): Item[] => items.filter((i) => conceptsOf(i).includes(key));

const base = (p: string) => p.split("/").pop() ?? p;
const stem = (p: string) => base(p).replace(/\.[^.]+$/, "");

/**
 * Which file opens first for an item: the data's own `mainFile`, else the file the item is named after
 * (basename == slug, with or without its extension), else the first file. Consumes the data unit's
 * `manifest[].mainFile` when it lands, and is right before it lands.
 */
export function mainFile(i: Item): string | undefined {
  const files = i.files ?? [];
  if (i.mainFile && files.includes(i.mainFile)) return i.mainFile;
  return files.find((f) => base(f) === i.slug || stem(f) === i.slug) ?? files[0];
}

/**
 * The source pane reads the very same file from disk, at build time. The glob is `../` because this module
 * sits one directory below `src/`; `key()` puts every manifest path on that same prefix, so a file path from
 * the manifest is looked up exactly as it was when the glob lived in App.tsx.
 */
const RAW = import.meta.glob("../**/*.{tsx,ts,jsx,js,json,css}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export const key = (rel: string) => (rel.startsWith("../") ? rel : "../" + rel.replace(/^\.\//, ""));

/** The text of one file, or the honest line that says we do not publish it. */
export function useCode(rel: string | null) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setCode(null);
    if (!rel) return;
    const load = RAW[key(rel)];
    if (!load) { setCode("// this file is not in the published set"); return; }
    load().then((t) => live && setCode(t));
    return () => { live = false; };
  }, [rel]);
  return code;
}

/**
 * Which items the catalogue treats as motion, so a stage can offer Replay only where replay means something.
 *
 * The manifest has no motion flag, so this is what the data does say: beui's library is motion-driven, the
 * "Motion and effects" category is motion, and `effect` items are motion by kind. It over-matches a little (a
 * beui button is static in practice) — over-matching costs a frozen first frame, under-matching costs a gallery
 * of 486 things animating at once.
 *
 * `site/Gallery.tsx` carries the same rule inline (it landed first). One copy is the goal; the gallery unit's
 * file was not this unit's to edit, so the duplicate is left standing and named in the build report.
 */
export const isMotionItem = (i: Item) =>
  i.source === "beui" || i.category === "Motion and effects" || i.kind === "effect";

export type TreeFamily = { key: string; rows: Item[]; subs: { key: string; rows: Item[] }[] };
export type TreeCat = { key: string; label: string; rows: Item[]; families: TreeFamily[] };
export type TreeSection = { label: string; count: number; cats: TreeCat[] };
