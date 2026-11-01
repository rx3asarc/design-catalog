var e=`import React, { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Kbd } from "@/registry/new-york-v4/ui/kbd";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/registry/new-york-v4/ui/command";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/registry/new-york-v4/ui/dialog";
import { items, label, type Item } from "./lib";
import { parentOf, isVariant, TYPES, variantsOf, type TypeEntry } from "./taxonomy";
import { typeHref } from "./typeIndex";
import { searchHref } from "./route";

/**
 * Cmd/Ctrl+K over the catalogue: 769 items and every type page, searched in this browser, ranked, keyboard only.
 *
 * The shell already shipped \`@/registry/new-york-v4/ui/command\`; what was missing was a reason to open it.
 * One open state, two mounts (a control in the phone topbar and a float on desktop), because the shell's
 * topbar is \`display:none\` above 860px (\`styles.css:197\`) — a single topbar mount would leave every desktop
 * visitor without a visible way in.
 *
 * Search is over the manifest's own fields and nothing else: \`displayName ?? name\`, slug, source, category,
 * concepts, plus the taxonomy's own type names. There is no index, no server and no second copy of the data.
 *
 * Three rules the round-5 review asked for, and where each one lives:
 *
 *  1. **a folded variant is not a row.** A variant is a demo on its parent's page, so a variant that matches is
 *     folded into its parent's result — \`Button · 12 variants\` — and the row opens the parent, where the variants
 *     are the demos (\`DOCS\`, below).
 *  2. **type pages are results too.** All of the taxonomy's types are indexed by name and carry their section and
 *     their two counts, so \`sidebar\` offers the Sidebar collection as well as the items (\`TYPE_DOCS\`).
 *  3. **the cut is visible.** The palette shows 20 rows and says how many there were; when there are more, it
 *     offers \`See all N results\`, which is \`#/s?q=…\` (\`site/SearchPage.tsx\`) — the same ranking, uncut.
 *
 * A query is matched twice, in this order: as the whole string it was typed (every ranking that existed before
 * this stayed exactly where it was), then word by word against the same fields, which is what lets
 * \`date picker\` open \`date-picker\` and \`dyn isl\` open \`dynamic island\`. A word may be one edit out on words of
 * five letters or more (\`siderbar\`), and a hit that needed that help always sorts below every hit that did not.
 */

/** The fields the data unit publishes that \`site/lib.ts\`'s Item predates. Read, never invented. */
type Row = Item & { concepts?: string[]; used_here?: number; reference_only?: boolean; has_demo?: boolean };

const rows = items as Row[];

/** Every field, whole — and the same fields split into the words a person would type. Both, from one pass. */
type Doc = {
  item: Row;
  /** the row this item stands for: itself, or the parent a folded variant is a demo of (\`button-icon\` → \`button\`) */
  anchor: Row;
  /** how many demos the anchor page carries (its own, plus every variant the taxonomy folds into it) */
  variants: number;
  name: string; slug: string; source: string; category: string; concepts: string[];
  nameWord: string[]; slugWord: string[]; sourceWord: string[]; categoryWord: string[]; conceptWord: string[][];
};

const lower = (s: string) => s.toLowerCase();

/** A field into the words it is made of: \`sidebar-07\`, \`components/date picker\` and \`dynamic_island\` all split. */
const words = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Folded variants do not get a row of their own.
 *
 * 320 of the 769 items are variants — \`button-icon\`, \`button-link\`, \`sidebar-01\` … — and the taxonomy already
 * says what they are: a **demo on their parent's page**, not an entry. A result row per variant is what the review
 * read as "folded variants still appear as separate results", and it is the same mistake the collections fixed.
 * So a variant that matches is **folded into its parent's row**, and the row says how many demos that page carries
 * (\`Button · 12 variants\`). The row opens the parent, where the variants are the demos.
 */
const DOCS: Doc[] = rows.map((item) => {
  const anchor = (isVariant(item) ? parentOf(item) : null) ?? item;
  /* the fields are the *item's own* — a variant has to be findable by the name it was typed as (\`button-icon\`)
     even though the row it produces is its parent's — and \`anchor\` is where that row points */
  const name = lower(label(item));
  const slug = lower(item.slug);
  const source = lower(item.source);
  const category = lower(item.category ?? "");
  const concepts = (item.concepts ?? []).map(lower);
  return {
    item, anchor, variants: variantsOf(anchor).length,
    name, slug, source, category, concepts,
    nameWord: words(name), slugWord: words(slug), sourceWord: words(source),
    categoryWord: words(category), conceptWord: concepts.map(words),
  };
});

/**
 * The 89 type pages, searchable by the same box.
 *
 * The review's second search complaint was that "type pages never appear" — a visitor typing \`sidebar\` got 20
 * rows and never the collection that holds them all. A type is the catalogue's own unit and the page a reader
 * usually wants, so it is indexed here with the name a person types, the section it is filed under, and the two
 * counts the type page prints (\`21 members · 12 variants\`). Nothing is written down: \`TYPES\` is the taxonomy.
 */
type TypeDoc = { entry: TypeEntry; name: string; word: string[]; members: number; variants: number };

const TYPE_DOCS: TypeDoc[] = TYPES.map((entry) => ({
  entry, name: lower(entry.type), word: words(lower(entry.type)),
  members: entry.members.length, variants: entry.variants.length,
}));

/**
 * How a hit matched. The order here *is* the ranking: an exact type name first (a collection is what "button"
 * means), then names that start with it, then names that contain it, then the softer fields, and \`fuzzy\` last
 * for a hit that only landed because of one typo. A typo never outranks a hit, whatever tier it landed in.
 */
export type Why = "type name" | "type prefix" | "name prefix" | "name" | "type" | "concept" | "category" | "source" | "fuzzy";

const TIER: Record<Why, number> = {
  "type name": 0,
  /* a type whose name starts with the query ranks with an item whose name starts with it, and the shorter name
     wins the tie — which is why \`theme\` leads with the Themes collection and \`chart\` leads with the chart item */
  "name prefix": 1,
  "type prefix": 1,
  name: 3,
  type: 4,
  concept: 5,
  category: 5,
  source: 6,
  fuzzy: 8,
};

/** A query that needed a typo's help sorts after every query that did not. */
const FUZZY = 9;

/**
 * One search result: a type's collection, or an item (with its folded variants counted on it).
 *
 * \`matched\` names the variant that brought a row in when the row stands for something else — \`button-link\`
 * arrives as \`Button\`, and the row can still say what was typed.
 */
export type Result =
  | { kind: "type"; entry: TypeEntry; why: Why; score: number; name: string; section: string; members: number; variants: number }
  | { kind: "item"; item: Row; why: Why; score: number; name: string; source: string; variants: number; demo: boolean; matched?: string };

/** Why this item matches \`needle\`, or null. The slug is the machine form of the name, so it ranks with it. */
function why(doc: Doc, needle: string): Why | null {
  if (doc.name.startsWith(needle)) return "name prefix";
  if (doc.name.includes(needle) || doc.slug.includes(needle)) return "name";
  if (doc.concepts.some((c) => c.includes(needle))) return "concept";
  if (doc.category.includes(needle)) return "category";
  if (doc.source.includes(needle)) return "source";
  return null;
}

/**
 * Is \`b\` one edit away from \`a\` — one insertion, one deletion, one substitution, or one adjacent transposition?
 *
 * The whole of the typo tolerance, in this file, with no index and no dependency: 769 rows × ~15 words is a
 * scan, and the length gate inside throws out almost every pair before it costs anything. A transposition is
 * the case people actually make on a phone keyboard (\`siderbar\`), so it counts as one edit, not two.
 */
function nearMiss(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  // same length: one substitution at i, or one transposition of i and i+1
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  // one longer: the extra character sits at i
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Two letters are too wide a net for a typo allowance; a long word is where a finger actually slips. */
const TYPO_MIN = 5;

/**
 * Does a word answer a token? A prefix, in either direction — \`chart\` finds \`charts\`, \`charts\` finds \`chart\` —
 * because plurals are how a person types a collection's name and the catalogue's names are singular
 * (\`Typography\`, \`Chart demonstrations\`). The shorter side has to be at least four letters, so \`ch\` never
 * matches everything that begins with it.
 */
const wordHit = (w: string, tok: string) =>
  w.startsWith(tok) || (tok.length >= 4 && w.length >= 4 && tok.startsWith(w));

/** A match, and whether it needed the typo allowance — which is a rank of its own, not a tier. */
type Match = { why: Why; fuzzy?: boolean };

/** One token, against one item's words, at the tiers the whole-string match uses. */
function wordWhy(doc: Doc, tok: string): Why | null {
  if (doc.nameWord.some((w) => wordHit(w, tok))) return wordHit(doc.nameWord[0], tok) ? "name prefix" : "name";
  if (doc.slugWord.some((w) => wordHit(w, tok))) return "name";
  if (doc.conceptWord.some((ws) => ws.some((w) => wordHit(w, tok)))) return "concept";
  if (doc.categoryWord.some((w) => wordHit(w, tok))) return "category";
  if (doc.sourceWord.some((w) => wordHit(w, tok))) return "source";
  return null;
}

/** The same, one edit out. Only for tokens long enough to be worth it. */
function typoWhy(doc: Doc, tok: string): Why | null {
  if (tok.length < TYPO_MIN) return null;
  const near = (w: string) => nearMiss(tok, w);
  if (doc.nameWord.some(near) || doc.slugWord.some(near)) return "fuzzy";
  if (doc.conceptWord.some((ws) => ws.some(near))) return "fuzzy";
  if (doc.categoryWord.some(near) || doc.sourceWord.some(near)) return "fuzzy";
  return null;
}

/**
 * A multi-word query, word by word: every word has to land somewhere in the row, and the row is ranked by its
 * worst landing, so a row whose words are all in its name beats one that found them across four fields.
 *
 * This is what makes \`date picker\` open \`date-picker\`: the whole string \`date picker\` is in no field of it, but
 * both of its words are, and the first one starts the name. \`dyn isl\` lands the same way, by prefix.
 */
function wordsWhy(doc: Doc, toks: string[]): Match | null {
  let worst: Why = "name prefix";
  let fuzzy = false;
  for (const tok of toks) {
    const w = wordWhy(doc, tok);
    const t = w ? null : typoWhy(doc, tok);
    if (t) fuzzy = true;
    const got = w ?? t;
    if (!got) return null;
    if (TIER[got] > TIER[worst] || got === "fuzzy") worst = got;
  }
  return toks.length ? { why: worst, fuzzy } : null;
}

/** A type's own match: its name, whole, then its name, word by word, then one typo out. */
function typeWhy(td: TypeDoc, needle: string, toks: string[]): Match | null {
  if (td.name === needle) return { why: "type name" };
  if (td.name.startsWith(needle)) return { why: "type prefix" };
  if (td.name.includes(needle)) return { why: "type" };
  if (toks.length > 1 && toks.every((tok) => td.word.some((w) => wordHit(w, tok)))) {
    return { why: td.word[0].startsWith(toks[0]) ? "type prefix" : "type" };
  }
  if (toks.length === 1 && toks[0].length >= TYPO_MIN && td.word.some((w) => nearMiss(toks[0], w))) {
    return { why: "fuzzy", fuzzy: true };
  }
  return null;
}

export const LIMIT = 20;

/**
 * Every result for a query, ranked, and how many there are.
 *
 * Ties inside a rank are broken by the shorter name first (so \`sidebar\` opens \`sidebar\`, not \`Sidebar 07\`), then
 * alphabetically: the order is a function of the data, never of a shuffle. An empty query is not a blank list: it
 * is the items the shell itself runs on, which is the one answer that is both true and useful before you have
 * typed anything.
 */
export function searchAll(q: string): { results: Result[]; own: boolean } {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    const own = DOCS.filter((d) => (d.item.used_here ?? 0) > 0 && d.anchor.id === d.item.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d): Result => ({
        kind: "item", item: d.item, why: "name", score: TIER.name, name: label(d.item),
        source: d.item.source, variants: d.variants, demo: d.item.has_demo === true,
      }));
    return { results: own, own: true };
  }
  const toks = words(needle);
  /* one row per anchor: a variant and its parent are the same result, and the better reason wins */
  const best = new Map<string, { r: Result; score: number }>();
  const keep = (key: string, r: Result, score: number) => {
    const had = best.get(key);
    if (had && had.score <= score) return;
    best.set(key, { r, score });
  };

  for (const td of TYPE_DOCS) {
    const m = typeWhy(td, needle, toks);
    if (!m) continue;
    keep(\`type:\${td.entry.key}\`, {
      kind: "type", entry: td.entry, why: m.why, score: m.fuzzy ? FUZZY : TIER[m.why],
      name: td.entry.type, section: td.entry.section, members: td.members, variants: td.variants,
    }, m.fuzzy ? FUZZY : TIER[m.why]);
  }

  for (const doc of DOCS) {
    // the whole query first, exactly as it always ranked: a query that matched before is not re-ranked by the
    // word pass below, it only gains the rows the whole-string form could never see.
    const whole = why(doc, needle);
    const m: Match | null = whole ? { why: whole } : wordsWhy(doc, toks);
    if (!m) continue;
    const score = m.fuzzy ? FUZZY : TIER[m.why];
    keep(\`item:\${doc.anchor.id}\`, {
      kind: "item", item: doc.anchor, why: m.why, score,
      name: label(doc.anchor), source: doc.anchor.source, variants: doc.variants,
      demo: doc.anchor.has_demo === true,
      matched: doc.anchor.id === doc.item.id ? undefined : label(doc.item),
    }, score);
  }

  const results = [...best.values()].map((b) => b.r).sort((a, b) =>
    a.score - b.score ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name) ||
    (a.kind === "type" ? a.entry.key : a.item.id).localeCompare(b.kind === "type" ? b.entry.key : b.item.id));
  return { results, own: false };
}

/** The palette's list: the same ranking, cut. \`total\` is what there was before the cut, so the cut is visible. */
export function search(q: string): { hits: Result[]; total: number; own: boolean } {
  const { results, own } = searchAll(q);
  return { hits: results.slice(0, LIMIT), total: results.length, own };
}

/* ---- one open state for two mounts: a context provider would cost App.tsx a wrapper element ---- */
let isOpen = false;
const watchers = new Set<() => void>();
const subscribe = (l: () => void) => { watchers.add(l); return () => { watchers.delete(l); }; };
const getSnapshot = () => isOpen;
function setOpen(next: boolean) {
  if (next === isOpen) return;
  isOpen = next;
  for (const w of watchers) w();
}
const useOpen = () => React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * Where focus was before the palette opened, and putting it back.
 *
 * Measured, not assumed: with no \`DialogTrigger\` the registry dialog has nothing to return focus to, and on
 * every close path — Escape, overlay click, selecting a row — \`document.activeElement\` was \`BODY\` afterwards.
 * So the palette records the element itself and returns focus to it.
 */
let returnTo: HTMLElement | null = null;

/* ---- the open palette is a history entry, so Back is a way out and not a way under it ------------------
 * Measured before this: open the palette on an item page, press Back, and the page turned into the front page
 * *underneath a still-open, still-scroll-locked palette* (\`location.hash\` "" , \`.page\` home, \`body\` locked).
 *
 * So opening pushes an entry with the URL it was opened at. Back then pops that entry — the URL does not move,
 * so no page can change under the palette — and the \`popstate\` closes it. Escape, the ✕, the overlay and ⌘K
 * all go out through \`history.back()\` for the same reason: there is one exit, and it unwinds the entry. If the
 * visitor's Back is what arrives, the same handler closes it, and the page is already the page it was. */
const ENTRY = "catalogPalette";
let pushed = false;   // the current history entry is the one the palette pushed
let closing = false;  // we asked for a back and have not seen its popstate yet

/** A reload can leave the palette's entry on the stack with nothing open; give it back to the page. */
if (typeof history !== "undefined" && history.state?.[ENTRY]) {
  try { history.replaceState(null, "", location.href); } catch { /* a file:// or sandboxed context: no entry, no harm */ }
}

function show(from?: HTMLElement | null) {
  // the element to hand focus back to: the control that opened us when there is one (a touch has not focused
  // the button yet when \`pointerdown\` fires), otherwise whatever already had focus
  const active = typeof document === "undefined" ? null : document.activeElement;
  returnTo = from instanceof HTMLElement
    ? from
    : active instanceof HTMLElement && active !== document.body ? active : null;
  if (!pushed) {
    try {
      history.pushState({ [ENTRY]: true }, "", location.href);
      pushed = true;
    } catch { /* history can be unavailable; the palette still opens, Back just behaves as it did before */ }
  }
  setOpen(true);
}

/** The palette is closed — the state, the entry bookkeeping and the focus, in one place, for every path. */
function finishClose() {
  pushed = false;
  closing = false;
  setOpen(false);
  const back = returnTo;
  returnTo = null;
  if (back && document.contains(back)) requestAnimationFrame(() => back.focus());
}

/** A close the visitor asked for: unwind the palette's own entry and let its popstate do the closing. */
function requestClose() {
  if (closing) return;
  if (pushed && history.state?.[ENTRY]) {
    closing = true;
    history.back();
    return;
  }
  finishClose();
}

if (typeof window !== "undefined") {
  addEventListener("popstate", () => {
    // a popstate with the palette closed is just the page moving: the entry bookkeeping follows it
    if (!isOpen) { pushed = false; closing = false; return; }
    finishClose();
  });
}

/** ⌘ on a Mac, Ctrl everywhere else — the label has to be the key the visitor actually presses. */
export const MOD = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform ?? "") ? "⌘" : "Ctrl";

/**
 * The palette's own door, for the surfaces that are not its triggers (the TopBar's search field, the miss page).
 *
 * It listens for ⌘K/Ctrl+K on the window and that listener is its public entry point — the open state is
 * module-private here. Dispatching the keystroke uses the documented path instead of reaching into that state,
 * so a button and a key are the same door and there is still exactly one palette.
 */
export function openPalette() {
  dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

/**
 * The visible way in. \`place="bar"\` sits in the phone topbar (44 px tall, the shell's own tap-target floor);
 * \`place="float"\` is the desktop control and hides itself below 860 px so only one is ever on screen.
 */
export function PaletteTrigger({ place }: { place: "bar" | "float" }) {
  const open = useOpen();
  return (
    <Button
      type="button"
      variant="outline"
      // A thumb is not a mouse. \`click\` is only synthesised when the whole gesture stays inside the browser's
      // tap slop (~8 px); a real finger that drifts further gets \`pointercancel\` instead, and the palette never
      // opened — measured, see build/r3-palette.md §1. \`pointerdown\` fires in every one of those gestures, so a
      // touch or a pen opens on the way *down*; a mouse (and the keyboard's own activation, which synthesises a
      // click with no pointer at all) keeps the click path. \`show()\` is idempotent, so the trailing click of a
      // healthy tap is a no-op rather than a toggle.
      onPointerDown={(e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return;
        // the default action of a touch's pointerdown is to synthesise the mouse sequence and to move focus to
        // the button; both happen *after* the palette is already mounted and traps focus, so the field loses it
        // to BODY. Cancelling here keeps the gesture off the page's focus handling; \`show()\` is idempotent, so
        // the click of a healthy tap is a no-op on top of this.
        e.preventDefault();
        show(e.currentTarget as HTMLElement);
      }}
      onClick={(e: React.MouseEvent) => show(e.currentTarget as HTMLElement)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Meta+K Control+K"
      className={place === "bar"
        ? "h-11 shrink-0 gap-2 px-3 text-[13px]"
        : "fixed right-4 bottom-4 z-30 h-9 gap-2 px-3 text-[12px] shadow-sm max-[860px]:hidden"}
    >
      <span className="truncate">Search {items.length}</span>
      <Kbd className="hidden bg-background sm:inline-flex">{MOD}K</Kbd>
    </Button>
  );
}

/**
 * The one marker, and it means one thing: **a demo runs in this catalogue.**
 *
 * The round-5 review read the old row and found a green dot on every result — it was the licence tone, painted on
 * a row whether or not there was anything to run — so "the dot means nothing". One green dot, one fact: a demo.
 * A reference-only entry, or a helper, gets no dot and says so in words instead. A type page is a collection, not
 * a demo, so it carries no marker at all — it carries its own two counts. The licence is still on the row (for a
 * screen reader) and on the item page; it never had a colour of its own to keep.
 */
function DemoMark({ demo }: { demo: boolean }) {
  return demo ? (
    <span className="pal-demo" title="a demo runs in this catalogue">
      <span className="pal-demo-dot" aria-hidden="true" />
      demo<span className="sr-only"> runs in this catalogue</span>
    </span>
  ) : (
    <span className="pal-demo" data-demo="no">no demo</span>
  );
}

/** \`21 items · 12 variants\` — the two numbers a type page prints, on the result row that opens it. */
const typeCounts = (r: Extract<Result, { kind: "type" }>) =>
  \`\${r.members} item\${r.members === 1 ? "" : "s"} · \${r.variants} variant\${r.variants === 1 ? "" : "s"}\`;

/** One row: a type's collection, or an item with its folded variants counted on it. */
function ResultRow({ r, onSelect }: { r: Result; onSelect: (href: string) => void }) {
  const href = r.kind === "type" ? typeHref(r.entry) : \`#/i/\${r.item.id}\`;
  return (
    <CommandItem
      value={r.kind === "type" ? \`type:\${r.entry.key}\` : \`item:\${r.item.id}\`}
      onSelect={() => onSelect(href)}
      // 32 px tall from the registry's py-1.5; a row you are meant to hit with a thumb clears 44
      className="min-w-0 gap-2 max-[860px]:min-h-11"
      data-result={r.kind}
      // the row is a search result, not a control: it wears the command item's slot, and the shell's
      // provenance layer reads the same filter box through the Command wrapper's tag
    >
      <span className="min-w-0 flex-1 truncate">{r.name}</span>
      {r.kind === "type" ? (
        <>
          <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{r.section}</span>
          <span className="shrink-0 truncate font-mono text-[12px] text-muted-foreground">{typeCounts(r)}</span>
        </>
      ) : (
        <>
          {r.variants > 0 ? (
            <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
              · {r.variants} variant{r.variants === 1 ? "" : "s"}
            </span>
          ) : null}
          <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{r.source}</span>
          <DemoMark demo={r.demo} />
          <span className="sr-only">{\`licence \${r.item.licence}\`}</span>
        </>
      )}
    </CommandItem>
  );
}

/**
 * The palette. \`mod+k\` opens it anywhere in the shell and toggles it closed; the registry \`Command\` is given
 * \`shouldFilter={false}\` so the ranking above is the ranking you get, and the registry \`Dialog\` supplies the
 * dialog role, the focus trap and the focus return. Enter on the top hit navigates without a pointer existing.
 */
export function Palette() {
  const open = useOpen();
  const [q, setQ] = useState("");
  const { hits, total, own } = useMemo(() => search(q), [q]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && lower(e.key) === "k") {
        e.preventDefault();
        if (isOpen) requestClose(); else show();
        return;
      }
      // cmdk does not handle Escape at all; the palette closes itself (and puts focus back) so the behaviour
      // does not depend on which of radix's dismiss paths is in play. It also unwinds the history entry, so
      // Escape and the browser's Back are the same exit.
      if (e.key === "Escape" && isOpen) requestClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  /**
   * Go somewhere, from a row or from the "see all" link. The entry the palette pushed becomes the destination's
   * own entry, so Back from there returns to the page the visitor was reading when they opened the palette — not
   * to a dead copy of it. \`replaceState\` fires no event of its own, so the router is told in the one way it
   * listens for (\`hashchange\`).
   */
  const go = (href: string) => {
    if (pushed && history.state?.[ENTRY]) {
      pushed = false;
      closing = false;
      try { history.replaceState(null, "", href); } catch { location.hash = href; }
      finishClose();
      if (location.hash === href) dispatchEvent(new Event("hashchange"));
      return;
    }
    finishClose();
    if (location.hash !== href) location.hash = href;
  };

  /* The cut is said out loud, and it comes with the way past it: \`20 of 40\` used to be the end of the road. */
  const more = !own && total > hits.length;
  const heading = own
    ? \`the shell you are reading runs on these \${total}\`
    : total > hits.length ? \`the first \${hits.length} of \${total} matches\` : \`\${total} match\${total === 1 ? "" : "es"}\`;

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (o) setQ(""); else requestClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 max-sm:top-3 max-sm:right-2 max-sm:left-2 max-sm:w-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{\`Search the catalogue\`}</DialogTitle>
          <DialogDescription>
            {\`\${items.length} items and \${TYPES.length} type pages by name, slug, source, category and concept. Ranked in this browser; Enter opens the top hit. A green dot marks a result whose demo runs.\`}
          </DialogDescription>
        </DialogHeader>
        {/* \`shouldFilter={false}\`: the ranking in \`search()\` is the ranking you get. cmdk's own \`value\`
            prop is the *selected item*, not the search text, so the query is held on the input — which is
            the controlled prop cmdk actually publishes for it. */}
        <Command
          shouldFilter={false}
          label="Search the catalogue"
          data-catalog-item="shadcn/command"
          // the field you type in is a 44 px control like everything else in this palette: the registry's own
          // input row is 36 px, and this is the shell's copy of it, not the registry's to change
          className="[&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input]]:h-12"
        >
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder={\`Search \${items.length} items and \${TYPES.length} types — name, source, concept…\`}
          />
          <CommandList className="max-h-[min(60dvh,420px)] min-w-0">
            {/* A query is not bounded by the box it is echoed in. The empty state is a centred line, so a
                500-character paste with no break opportunity in it used to run out of both sides at once —
                measured 3 495 px of overflow at 390 and 3 357 px at 1440. \`overflow-wrap: anywhere\` gives the
                line a break opportunity inside a “word” that has none, and \`min-w-0\`/\`max-w-full\` on the row
                and its children let the flex/grid chain actually shrink to the dialog instead of to the text. */}
            <CommandEmpty className="min-w-0 max-w-full overflow-hidden px-3">
              <span className="block min-w-0 max-w-full [overflow-wrap:anywhere]">
                {\`Nothing in \${items.length} items or \${TYPES.length} type pages matches “\${q.trim()}” — not a name, a slug, a source, a category, a concept or a type.\`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-11 min-h-11"
                // cmdk's root keydown calls preventDefault() on Enter, which cancels a button's default click.
                // The row still has to work from the keyboard, so the key is stopped here instead.
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
                onClick={() => setQ("")}
              >
                Clear the query
              </Button>
            </CommandEmpty>
            {hits.length ? (
              <CommandGroup heading={heading} className="min-w-0">
                {hits.map((r) => (
                  <ResultRow key={r.kind === "type" ? \`type:\${r.entry.key}\` : \`item:\${r.item.id}\`} r={r} onSelect={go} />
                ))}
              </CommandGroup>
            ) : null}
            {/*
             * \`20 of 40\` was a dead end: the palette said how many there were and gave no way to see one more.
             * This is the way past the cut — the same ranking, uncut, at \`#/s?q=…\` (\`site/SearchPage.tsx\`), a real
             * address a reader can keep. It is an anchor, not a command item, so Enter on the field still opens
             * the top hit rather than "see all".
             */}
            {more ? (
              <div className="px-2 pb-1 pt-1">
                <a
                  className="pal-see-all"
                  data-see-all={total}
                  href={searchHref(q)}
                  onClick={(e: React.MouseEvent) => { e.preventDefault(); go(searchHref(q)); }}
                >
                  See all {total} results
                </a>
              </div>
            ) : null}
          </CommandList>
          <div className="flex items-center gap-2 border-t px-2 py-1.5">
            {/* The way out, on every viewport, 44 px tall so a thumb can hit it: the key legend below is
                supplementary, and on a phone it is also hidden, because a phone has no keys to press. */}
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                aria-label="Close search"
                className="h-11 min-h-11 min-w-11 shrink-0 gap-2 px-3 text-[12px] max-[860px]:flex-1 max-[860px]:justify-start"
              >
                <XIcon className="size-4" aria-hidden="true" />
                <span>Close</span>
              </Button>
            </DialogClose>
            <div className="ml-auto hidden items-center gap-3 pr-1 font-mono text-[12px] text-muted-foreground max-[860px]:hidden min-[861px]:flex">
              <span>↑↓ move</span>
              <span>↵ open</span>
              <span>esc close</span>
              <span>{MOD}K</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
`;export{e as default};