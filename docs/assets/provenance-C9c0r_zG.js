var e=`import * as React from "react";
import { byId } from "./site/lib";
import { Popover, PopoverAnchor, PopoverContent } from "@/registry/new-york-v4/ui/popover";
import { useRoute } from "./site/route";

/**
 * Provenance you can see — **on \`#/chrome\` only**.
 *
 * Every element the shell renders carries \`data-catalog-item\`, naming the catalogue item it came from. This
 * layer reads those attributes back out of the DOM: hovering (or focusing) one of them raises a small tag that
 * says which item it is and how many of that item the mounted shell is running on, and links to the item's page.
 *
 * The number is the DOM's, not ours: \`used 6×\` is a querySelectorAll of the mounted tree, counted through the
 * same store that \`#/chrome\` reads, so the two can never disagree.
 *
 * **The tag is a property of the Chrome page, not of the site.** At catalogue scale a document-wide
 * pointerover/focusin layer that floats "beui/marquee · used 1×" over whatever is pointed at is debug UI: it
 * has covered card titles and an item-page heading. So the gate is the mount, not the handler — off \`#/chrome\`
 * this renders \`null\` and the listeners are **never installed**, rather than installed and told to do nothing.
 * The \`data-catalog-item\` attributes themselves stay exactly where they were: \`#/chrome\` counts them (every
 * printed count is the DOM's own) and \`app/check_chrome.py\` scans for them.
 *
 * Hover-only stays the desktop behaviour, and a touch still raises nothing (\`pointerType === "touch"\`).
 */

const ATTR = "data-catalog-item";

/** Catalogue ids that have a page to link to. A tagged sub-part (a table row, say) has none, and says so. */
const PAGES = new Set(byId.keys());

function read(): Record<string, number> {
  const out: Record<string, number> = {};
  const nodes = document.querySelectorAll(\`[\${ATTR}]\`);
  for (const node of nodes) {
    const id = node.getAttribute(ATTR);
    if (id) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

const same = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

/* ---- one counter for the whole shell: the tag and #/chrome read the same numbers ---- */
let counts: Record<string, number> = {};
const listeners = new Set<() => void>();
let queued = false;
let watching = false;
let observer: MutationObserver | null = null;

function recount() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const next = read();
    if (same(next, counts)) return;
    counts = next;
    for (const l of listeners) l();
  });
}

function watch() {
  if (watching || typeof MutationObserver === "undefined") return;
  watching = true;
  // attributeFilter keeps this off the radar of every data-state radix writes; a portal opening still counts
  observer = new MutationObserver(recount);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributeFilter: [ATTR],
  });
  addEventListener("hashchange", recount);
  recount();
}

/** The counter is only live while something reads it: leave \`#/chrome\` and the observer goes with the page. */
function unwatch() {
  if (!watching) return;
  watching = false;
  observer?.disconnect();
  observer = null;
  removeEventListener("hashchange", recount);
}

function subscribe(l: () => void) {
  watch();
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (!listeners.size) unwatch();
  };
}

const snapshot = () => counts;

/** How many of each catalogue item the mounted shell is running on, kept current. */
export function useUsage(): Record<string, number> {
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}

type Hit = { anchor: HTMLElement; id: string };

/**
 * What the tag is pinned to. A control or a row is its own box. A container — a whole rail section, a table —
 * is not: its box can be 400px tall, and a tag 400px under the pointer is a lie about what you are pointing at.
 * For those, walk up from the innermost element under the pointer and keep the outermost row-sized box.
 */
function anchorFor(tagged: HTMLElement, target: HTMLElement): HTMLElement {
  if (tagged.getBoundingClientRect().height <= 48) return tagged;
  let node: HTMLElement | null = target;
  let pick: HTMLElement = target;
  while (node && node !== tagged) {
    const h = node.getBoundingClientRect().height;
    if (!(h > 0 && h <= 48)) break;
    pick = node;
    node = node.parentElement;
  }
  return pick;
}

/** The innermost tagged element under the pointer, if the pointer is over the shell at all. */
function tagUnder(target: EventTarget | null): Hit | null {
  const node = target as HTMLElement | null;
  if (!node || typeof node.closest !== "function") return null;
  // never tag the tag: the layer's own tag is furniture too, and chasing it would loop
  if (node.closest('[data-slot="popover-content"]')) return null;
  const el = node.closest(\`[\${ATTR}]\`) as HTMLElement | null;
  if (!el) return null;
  const id = el.getAttribute(ATTR);
  if (!id) return null;
  return { anchor: anchorFor(el, node), id };
}

// .prov-tag carries the type and the box (styles.css, on the page's own scale) and the pointer-events rule:
// a tag that swallows clicks meant for the row beneath it is worse than no tag.
const TAG_CLASS = "prov-tag";

/**
 * The gate, and nothing else: the tags exist on the Chrome page and nowhere else.
 *
 * Returning \`null\` here is what makes the rule structural rather than advisory — no mount, no listeners.
 */
export function Provenance() {
  const { route } = useRoute();
  return route.kind === "chrome" ? <ChromeTags /> : null;
}

/** The tag layer itself: today's behaviour, unchanged, armed only while \`#/chrome\` is the route. */
function ChromeTags() {
  const usage = useUsage();
  const [hit, setHit] = React.useState<Hit | null>(null);
  const anchor = React.useRef<Element | null>(null);
  const away = React.useRef<number | null>(null);

  anchor.current = hit?.anchor ?? null;

  const stay = React.useCallback(() => {
    if (away.current !== null) {
      clearTimeout(away.current);
      away.current = null;
    }
  }, []);
  const leave = React.useCallback((ms = 140) => {
    stay();
    away.current = window.setTimeout(() => {
      away.current = null;
      setHit(null);
    }, ms);
  }, [stay]);

  React.useEffect(() => {
    const over = (e: PointerEvent) => {
      // a touch is not a hover: on a phone the tag would flash and then be in the way of the next tap
      if (e.pointerType === "touch") return;
      const t = tagUnder(e.target);
      if (!t) return;
      stay();
      setHit((cur) => (cur && cur.anchor === t.anchor && cur.id === t.id ? cur : t));
    };
    const out = (e: PointerEvent) => {
      if (!tagUnder(e.target)) return;
      const to = e.relatedTarget as HTMLElement | null;
      if (to?.closest?.('[data-slot="popover-content"]')) return; // the pointer is going to the tag
      leave();
    };
    const focus = (e: FocusEvent) => {
      const t = tagUnder(e.target);
      if (!t) return;
      stay();
      setHit(t);
    };
    const blur = () => leave(0);
    // a tag that outlives the row it describes is noise: the page moving takes the tag with it
    const scrolled = () => leave(0);

    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerout", out, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("focusout", blur, true);
    document.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerout", out, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("focusout", blur, true);
      document.removeEventListener("scroll", scrolled, true);
      stay();
    };
  }, [stay, leave]);

  if (!hit) return null;

  const n = usage[hit.id] ?? 1;
  const page = PAGES.has(hit.id);

  return (
    // out of flow, so mounting a tag can never move the shell it is describing
    <div style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, pointerEvents: "none" }}>
      <Popover open onOpenChange={(o) => { if (!o) leave(0); }}>
        <PopoverAnchor virtualRef={anchor} />
        <PopoverContent
          data-catalog-item="shadcn/popover"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={TAG_CLASS}
          // the tag is a label, not a destination: opening it must not pull focus out of the filter box
          onOpenAutoFocus={(e) => e.preventDefault()}
          onFocusCapture={() => stay()}
          onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave(0); }}
        >
          {page ? (
            <a
              href={\`#/i/\${hit.id}\`}
              onClick={() => leave(0)}
              onPointerEnter={() => stay()}
              onPointerLeave={() => leave()}
              className="prov-open"
            >
              {hit.id}
              <span className="prov-uses">
                {" · used "}
                <span className="prov-n">{n}</span>
                {n === 1 ? " time on this page" : " times on this page"}
              </span>
            </a>
          ) : (
            <span className="prov-quiet">
              {hit.id}
              <span className="prov-uses">
                {" · "}
                <span className="prov-n">{n}</span>
                {n === 1 ? " time on this page · it has no page of its own" : " times on this page · it has no page of its own"}
              </span>
            </span>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
`;export{e as default};