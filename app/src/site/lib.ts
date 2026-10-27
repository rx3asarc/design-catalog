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
  /** The rail's category. Present on every ingested item today; the rail treats a missing one as "Actions and controls". */
  category?: string;
  one_line: string | null; url: string | null; licence: string; page: string | null;
  install: string | null; files: string[]; variants: Variant[]; withheld?: boolean;
  verdict?: { verdict: string; reason: string; ours_path?: string | null };
};

export const items = manifest as unknown as Item[];
export const byId = new Map(items.map((i) => [i.id, i]));

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

export type TreeFamily = { key: string; rows: Item[]; subs: { key: string; rows: Item[] }[] };
export type TreeCat = { key: string; label: string; rows: Item[]; families: TreeFamily[] };
export type TreeSection = { label: string; count: number; cats: TreeCat[] };
