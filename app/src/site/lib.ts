import { useEffect, useState } from "react";
import manifest from "../../manifest.json";

/**
 * The data the whole shell reads, and the one loader both the demo pane and the source pane use.
 *
 * `site/` is the shell's own directory: everything the chrome is made of lives here, one file per surface.
 * This module holds only what two or more of those surfaces need — the item type, the manifest, the label a
 * visitor reads, and the raw-source loader. It imports no other shell module, so nothing here can cycle.
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
  install: string | null; files: string[]; variants: Variant[]; withheld?: boolean;
  /**
   * The concept sets this item belongs to, by the store's own key. Published by the data unit; absent means
   * "in none" and never "not known" — 118 of the 769 items carry one or more, across 29 sets.
   */
  concepts?: string[] | null;
};

export const items = manifest as unknown as Item[];
export const byId = new Map(items.map((i) => [i.id, i]));

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
