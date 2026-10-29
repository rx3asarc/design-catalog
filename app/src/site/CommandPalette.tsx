import React, { useMemo, useState } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Kbd } from "@/registry/new-york-v4/ui/kbd";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from "@/registry/new-york-v4/ui/command";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/registry/new-york-v4/ui/dialog";
import { items, label, type Item } from "./lib";

/**
 * Cmd/Ctrl+K over the catalogue: 769 items, searched in this browser, ranked, keyboard only.
 *
 * The shell already shipped `@/registry/new-york-v4/ui/command`; what was missing was a reason to open it.
 * One open state, two mounts (a control in the phone topbar and a float on desktop), because the shell's
 * topbar is `display:none` above 860px (`styles.css:197`) — a single topbar mount would leave every desktop
 * visitor without a visible way in.
 *
 * Search is over the manifest's own fields and nothing else: `displayName ?? name`, slug, source, category,
 * concepts. There is no index, no server and no second copy of the data.
 *
 * A query is matched twice, in this order: as the whole string it was typed (every ranking that existed before
 * this stayed exactly where it was), then word by word against the same fields, which is what lets
 * `date picker` open `date-picker` and `dyn isl` open `dynamic island`. A word may be one edit out on words of
 * five letters or more (`siderbar`), and a hit that needed that help always sorts below every hit that did not.
 */

/** The three fields the data unit publishes that `site/lib.ts`'s Item predates. Read, never invented. */
type Row = Item & { concepts?: string[]; used_here?: number; reference_only?: boolean };

const rows = items as Row[];

/** The honest licence tone. The catalogue publishes four licence strings; each one gets a dot and a title. */
const LICENCE_TONE: Record<string, string> = {
  "MIT": "oklch(0.65 0.16 150)",
  "MIT with no-redistribution clause": "oklch(0.7 0.14 80)",
  "free-to-use (repo reports NOASSERTION)": "oklch(0.7 0.14 80)",
  "unclear": "oklch(0.65 0.16 25)",
};

/** Every field, whole — and the same fields split into the words a person would type. Both, from one pass. */
type Doc = {
  item: Row; name: string; slug: string; source: string; category: string; concepts: string[];
  nameWord: string[]; slugWord: string[]; sourceWord: string[]; categoryWord: string[]; conceptWord: string[][];
};

const lower = (s: string) => s.toLowerCase();

/** A field into the words it is made of: `sidebar-07`, `components/date picker` and `dynamic_island` all split. */
const words = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/** Lowercased once at module load. 769 × 5 strings is cheaper to build once than to rebuild on every key. */
const DOCS: Doc[] = rows.map((item) => {
  const name = lower(label(item));
  const slug = lower(item.slug);
  const source = lower(item.source);
  const category = lower(item.category ?? "");
  const concepts = (item.concepts ?? []).map(lower);
  return {
    item, name, slug, source, category, concepts,
    nameWord: words(name), slugWord: words(slug), sourceWord: words(source),
    categoryWord: words(category), conceptWord: concepts.map(words),
  };
});

/**
 * How a hit matched. The order here *is* the ranking: prefix, then name, then concept/category, then source —
 * and `fuzzy`, last, for a hit that only landed because of one typo. A typo never outranks a hit.
 */
export type Why = "name prefix" | "name" | "concept" | "category" | "source" | "fuzzy";
const SCORE: Record<Why, number> = { "name prefix": 0, name: 1, concept: 2, category: 2, source: 3, fuzzy: 4 };
/** A query that needed a typo's help sorts after every query that did not, whatever tier the typo landed in. */
const FUZZY = 10;

export type Hit = { item: Row; why: Why };

/** Why this item matches `needle`, or null. The slug is the machine form of the name, so it ranks with it. */
function why(doc: Doc, needle: string): Why | null {
  if (doc.name.startsWith(needle)) return "name prefix";
  if (doc.name.includes(needle) || doc.slug.includes(needle)) return "name";
  if (doc.concepts.some((c) => c.includes(needle))) return "concept";
  if (doc.category.includes(needle)) return "category";
  if (doc.source.includes(needle)) return "source";
  return null;
}

/**
 * Is `b` one edit away from `a` — one insertion, one deletion, one substitution, or one adjacent transposition?
 *
 * The whole of the typo tolerance, in this file, with no index and no dependency: 769 rows × ~15 words is a
 * scan, and the length gate inside throws out almost every pair before it costs anything. A transposition is
 * the case people actually make on a phone keyboard (`siderbar`), so it counts as one edit, not two.
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

/** The word a token is a prefix of, in one field, at the same tiers the whole-string match uses. */
function wordWhy(doc: Doc, tok: string): Why | null {
  if (doc.nameWord.some((w) => w.startsWith(tok))) return doc.nameWord[0].startsWith(tok) ? "name prefix" : "name";
  if (doc.slugWord.some((w) => w.startsWith(tok))) return "name";
  if (doc.conceptWord.some((ws) => ws.some((w) => w.startsWith(tok)))) return "concept";
  if (doc.categoryWord.some((w) => w.startsWith(tok))) return "category";
  if (doc.sourceWord.some((w) => w.startsWith(tok))) return "source";
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
 * This is what makes `date picker` open `date-picker`: the whole string `date picker` is in no field of it, but
 * both of its words are, and the first one starts the name. `dyn isl` lands the same way, by prefix.
 */
function wordsWhy(doc: Doc, toks: string[]): Why | null {
  let worst: Why = "name prefix";
  for (const tok of toks) {
    const w = wordWhy(doc, tok) ?? typoWhy(doc, tok);
    if (!w) return null;
    if (SCORE[w] > SCORE[worst]) worst = w;
  }
  return toks.length ? worst : null;
}

export const LIMIT = 20;

/**
 * The ranked hits, and how many matched before the cut.
 *
 * Ties inside a rank are broken by the shorter name first (so `sidebar` opens `sidebar`, not
 * `sidebar-07`), then alphabetically. An empty query is not a blank list: it is the items the shell itself
 * runs on, which is the one answer that is both true and useful before you have typed anything.
 */
export function search(q: string): { hits: Hit[]; total: number; own: boolean } {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    const own = DOCS.filter((d) => (d.item.used_here ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ item: d.item, why: "name" as Why }));
    return { hits: own, total: own.length, own: true };
  }
  const toks = words(needle);
  const found: { hit: Hit; score: number }[] = [];
  for (const doc of DOCS) {
    // the whole query first, exactly as it always ranked: a query that matched before is not re-ranked by the
    // word pass below, it only gains the rows the whole-string form could never see.
    const w = why(doc, needle);
    if (w) { found.push({ hit: { item: doc.item, why: w }, score: SCORE[w] }); continue; }
    const t = wordsWhy(doc, toks);
    if (t) found.push({ hit: { item: doc.item, why: t }, score: t === "fuzzy" ? FUZZY + SCORE[t] : SCORE[t] });
  }
  found.sort((a, b) =>
    a.score - b.score ||
    label(a.hit.item).length - label(b.hit.item).length ||
    label(a.hit.item).localeCompare(label(b.hit.item)));
  return { hits: found.slice(0, LIMIT).map((f) => f.hit), total: found.length, own: false };
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
 * Measured, not assumed: with no `DialogTrigger` the registry dialog has nothing to return focus to, and on
 * every close path — Escape, overlay click, selecting a row — `document.activeElement` was `BODY` afterwards.
 * So the palette records the element itself and returns focus to it.
 */
let returnTo: HTMLElement | null = null;

/* ---- the open palette is a history entry, so Back is a way out and not a way under it ------------------
 * Measured before this: open the palette on an item page, press Back, and the page turned into the front page
 * *underneath a still-open, still-scroll-locked palette* (`location.hash` "" , `.page` home, `body` locked).
 *
 * So opening pushes an entry with the URL it was opened at. Back then pops that entry — the URL does not move,
 * so no page can change under the palette — and the `popstate` closes it. Escape, the ✕, the overlay and ⌘K
 * all go out through `history.back()` for the same reason: there is one exit, and it unwinds the entry. If the
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
  // the button yet when `pointerdown` fires), otherwise whatever already had focus
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
 * The visible way in. `place="bar"` sits in the phone topbar (44 px tall, the shell's own tap-target floor);
 * `place="float"` is the desktop control and hides itself below 860 px so only one is ever on screen.
 */
export function PaletteTrigger({ place }: { place: "bar" | "float" }) {
  const open = useOpen();
  return (
    <Button
      type="button"
      variant="outline"
      // A thumb is not a mouse. `click` is only synthesised when the whole gesture stays inside the browser's
      // tap slop (~8 px); a real finger that drifts further gets `pointercancel` instead, and the palette never
      // opened — measured, see build/r3-palette.md §1. `pointerdown` fires in every one of those gestures, so a
      // touch or a pen opens on the way *down*; a mouse (and the keyboard's own activation, which synthesises a
      // click with no pointer at all) keeps the click path. `show()` is idempotent, so the trailing click of a
      // healthy tap is a no-op rather than a toggle.
      onPointerDown={(e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return;
        // the default action of a touch's pointerdown is to synthesise the mouse sequence and to move focus to
        // the button; both happen *after* the palette is already mounted and traps focus, so the field loses it
        // to BODY. Cancelling here keeps the gesture off the page's focus handling; `show()` is idempotent, so
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

/** One row: the name, the source, the kind, the licence dot, and the truth about the demo. */
function HitRow({ hit, onSelect }: { hit: Hit; onSelect: (id: string) => void }) {
  const item = hit.item;
  const tone = LICENCE_TONE[item.licence] ?? "oklch(0.65 0.16 25)";
  return (
    <CommandItem
      value={item.id}
      onSelect={() => onSelect(item.id)}
      // 32 px tall from the registry's py-1.5; a row you are meant to hit with a thumb clears 44
      className="min-w-0 gap-2 max-[860px]:min-h-11"
      // the row is a search result, not a control: it wears the command item's slot, and the shell's
      // provenance layer reads the same filter box through the Command wrapper's tag
    >
      <span className="min-w-0 flex-1 truncate">{label(item)}</span>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.source}</span>
      <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">{item.kind}</Badge>
      {item.reference_only ? <CommandShortcut className="shrink-0">no demo</CommandShortcut> : null}
      {/* a dot, not the catalogue's Badge: tagging it `shadcn/badge` would inflate that item's count */}
      <span className="size-2 shrink-0 rounded-full" style={{ background: tone }} aria-hidden="true" />
      <span className="sr-only">{`licence ${item.licence}`}</span>
    </CommandItem>
  );
}

/**
 * The palette. `mod+k` opens it anywhere in the shell and toggles it closed; the registry `Command` is given
 * `shouldFilter={false}` so the ranking above is the ranking you get, and the registry `Dialog` supplies the
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
   * Open an item. The entry the palette pushed becomes the item's own entry, so Back from the item page returns
   * to the page the visitor was reading when they opened the palette — not to a dead copy of it. `replaceState`
   * fires no event of its own, so the router is told in the one way it listens for (`hashchange`).
   */
  const go = (id: string) => {
    const href = `#/i/${id}`;
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

  const heading = own
    ? `the shell you are reading runs on these ${total}`
    : total > hits.length ? `${hits.length} of ${total} matches` : `${total} match${total === 1 ? "" : "es"}`;

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (o) setQ(""); else requestClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 max-sm:top-3 max-sm:right-2 max-sm:left-2 max-sm:w-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{`Search the catalogue`}</DialogTitle>
          <DialogDescription>
            {`${items.length} items by name, slug, source, category and concept. Ranked in this browser; Enter opens the top hit.`}
          </DialogDescription>
        </DialogHeader>
        {/* `shouldFilter={false}`: the ranking in `search()` is the ranking you get. cmdk's own `value`
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
            placeholder={`Search ${items.length} items — name, source, category, concept…`}
          />
          <CommandList className="max-h-[min(60dvh,420px)] min-w-0">
            {/* A query is not bounded by the box it is echoed in. The empty state is a centred line, so a
                500-character paste with no break opportunity in it used to run out of both sides at once —
                measured 3 495 px of overflow at 390 and 3 357 px at 1440. `overflow-wrap: anywhere` gives the
                line a break opportunity inside a “word” that has none, and `min-w-0`/`max-w-full` on the row
                and its children let the flex/grid chain actually shrink to the dialog instead of to the text. */}
            <CommandEmpty className="min-w-0 max-w-full overflow-hidden px-3">
              <span className="block min-w-0 max-w-full [overflow-wrap:anywhere]">
                {`Nothing in ${items.length} items matches “${q.trim()}” — not a name, a slug, a source, a category or a concept.`}
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
                {hits.map((h) => <HitRow key={h.item.id} hit={h} onSelect={go} />)}
              </CommandGroup>
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
            <div className="ml-auto hidden items-center gap-3 pr-1 font-mono text-[10.5px] text-muted-foreground max-[860px]:hidden min-[861px]:flex">
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
