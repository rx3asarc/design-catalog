import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Back restores the scroll the visitor left.
 *
 * The defect this replaces is one line of `route.ts`: `useScrollReset` puts `.page` at 0 on **every** hash
 * change, and a hash change is also what Back does. So scrolling 4,000 px into `#/g?sec=Components`, opening a
 * tile and pressing Back returned a visitor to the top of the grid — the page they left, minus the place in it.
 *
 * What is needed is not "remember one scroll position", it is **one position per history entry**, because the
 * same grid can be walked into three times and the browser keeps three entries. `history.state` is the only
 * thing that travels with an entry, so each entry gets a small integer id stamped into it:
 *
 *     history.state = { …whatever was there, scrollSid: 7 }
 *
 * and the position itself lives in `sessionStorage` under `catalogScroll.7`, so a reload keeps both halves.
 * Navigating forward stamps a new id (`#/g` → `#/i/x` is a new entry); traversing back reads the id the
 * browser restored. The stamp is a `replaceState` with the entry's own URL, so it costs no history entry.
 *
 * Three rules make the restore land before anyone can see it move:
 *
 *  - **it happens in a layout effect**, in the same frame as the render that built the new page and before the
 *    paint, so the 250 ms page turn (`PageTurn.tsx`) animates a page that is already at the right offset. The
 *    turn's animation is on an inner box's opacity and transform, which do not depend on scroll, so restoring
 *    during it cannot fight it.
 *  - **it verifies and reapplies** across the next few animation frames. A restored page is not always the size
 *    it was: an item page's frames reserve a floor and then report their own height, so the total can move after
 *    the first frame. The loop stops as soon as the value is what was captured, and gives up after five tries.
 *  - **it never yanks a visitor who has taken over.** A wheel/touch/key scroll before the delayed check cancels
 *    the check: the restore is a favour, not a position lock.
 *
 * `window.__scrollRestore` publishes the last result — what was captured, what the page ended up at, the error
 * in px and how many tries it took — because a restore that is asserted from the outside is a measurement, and
 * one that is asserted by the code that did it is a claim.
 */

/** The keys. One namespace, so the two facts (which entry, where in it) are obviously the same feature. */
const NEXT = "catalogScroll.next";
const slot = (sid: number) => `catalogScroll.${sid}`;

/** A tiny wrapper that degrades to memory when the browser refuses `sessionStorage` (private mode, quotas). */
const memory = new Map<string, string>();
const store = {
  get(k: string): string | null {
    try { return sessionStorage.getItem(k) ?? memory.get(k) ?? null; } catch { return memory.get(k) ?? null; }
  },
  set(k: string, v: string) {
    memory.set(k, v);
    try { sessionStorage.setItem(k, v); } catch { /* memory only */ }
  },
};

/**
 * The element that scrolls the page column, or null when the window does.
 *
 * Same fact `Tile.tsx`'s `scrollerOf` measures, and it has to be measured rather than assumed: at wider widths
 * `.page` is a fixed-height `overflow:auto` column and the window never moves; at ≤860 px `styles.css` makes it
 * `overflow: visible` and the page is in normal flow, so the window is the scroller.
 */
function scroller(): HTMLElement | null {
  const page = document.querySelector<HTMLElement>(".page");
  if (page && page.scrollHeight > page.clientHeight + 1) return page;
  const cs = page ? getComputedStyle(page) : null;
  return cs && /(auto|scroll|overlay)/.test(cs.overflowY) ? page : null;
}

const read = (): number => {
  const el = scroller();
  return Math.round(el ? el.scrollTop : window.scrollY);
};

const write = (top: number) => {
  const el = scroller();
  if (el) el.scrollTop = top;
  else window.scrollTo(0, top);
};

type State = { scrollSid?: number } | null;

const knownSid = (): number | null => {
  const s = history.state as State;
  return typeof s?.scrollSid === "number" ? s.scrollSid : null;
};

/**
 * This entry's id, stamped if it has none. The URL is passed explicitly: an empty third argument would resolve
 * to the document URL *without its fragment*, which is the front page — a stamp that navigated.
 */
function stampSid(): number {
  const had = knownSid();
  if (had !== null) return had;
  const next = Number(store.get(NEXT) ?? "1") || 1;
  store.set(NEXT, String(next + 1));
  history.replaceState({ ...(history.state ?? {}), scrollSid: next }, "", location.href);
  return next;
}

/** What the last restore did, kept for the harness and for anyone reading the page from a console. */
export type ScrollRestoreReport = {
  /** the address the visitor came back to */
  hash: string;
  /** what the scroller said when they left it */
  captured: number;
  /** what it said once the restore was done */
  restored: number;
  /** |restored − captured|, in px — the number the brief bounds at 8 */
  error: number;
  /** tries it took: 1 when the first write landed */
  attempts: number;
  /** ms from the layout effect to the accepted value */
  ms: number;
};

declare global {
  interface Window { __scrollRestore?: ScrollRestoreReport & { count: number } }
}

export function useScrollRestore(hash: string) {
  /** the history entry this document is currently showing */
  const sid = useRef<number>(0);
  /** set by `popstate`: the offset to put back once the route has rendered */
  const pending = useRef<number | null>(null);
  /** set when the visitor scrolls under their own steam, which ends our interest in the offset */
  const takenOver = useRef(false);
  const frame = useRef(0);

  // one listener for the whole shell: a capture-phase `scroll` reaches `.page`'s scrolls and the window's alike
  useEffect(() => {
    sid.current = stampSid();
    const save = () => {
      frame.current = 0;
      store.set(slot(sid.current), String(read()));
    };
    const onScroll = () => { if (!frame.current) frame.current = requestAnimationFrame(save); };
    // a new entry: save where the outgoing one was, then stamp the new one. Chrome gives a fresh entry
    // `state === null`, and `location.hash` is already the new address here — the DOM is still the old page,
    // which is exactly why the save has to name the *old* id explicitly.
    const onHash = () => {
      store.set(slot(sid.current), String(read()));
      sid.current = stampSid();
    };
    const onPop = () => {
      // the browser has restored the entry's own state; the value it was left at is what we put back
      const id = knownSid();
      sid.current = id ?? stampSid();
      const saved = store.get(slot(sid.current));
      pending.current = saved === null ? null : Number(saved);
      takenOver.current = false;
    };
    // the visitor's own scrolling, in every form that is not ours
    const onUser = () => { takenOver.current = true; };
    const onPageHide = () => store.set(slot(sid.current), String(read()));

    addEventListener("scroll", onScroll, { passive: true, capture: true });
    addEventListener("hashchange", onHash);
    addEventListener("popstate", onPop);
    addEventListener("wheel", onUser, { passive: true });
    addEventListener("touchmove", onUser, { passive: true });
    addEventListener("keydown", onUser);
    addEventListener("pagehide", onPageHide);
    return () => {
      removeEventListener("scroll", onScroll, { capture: true });
      removeEventListener("hashchange", onHash);
      removeEventListener("popstate", onPop);
      removeEventListener("wheel", onUser);
      removeEventListener("touchmove", onUser);
      removeEventListener("keydown", onUser);
      removeEventListener("pagehide", onPageHide);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  /**
   * The restore itself. A layout effect, so it runs after the new route has rendered and before the browser
   * paints it — and after `useScrollReset`, which `App.tsx` calls first: the reset puts the page at 0 and this
   * immediately puts it back, in the same frame, so nothing is ever painted at the top.
   */
  useLayoutEffect(() => {
    const want = pending.current;
    if (want === null) return;              // a forward navigation: `useScrollReset` is the whole answer
    pending.current = null;
    const started = performance.now();
    let attempts = 0;
    const apply = () => {
      attempts += 1;
      write(want);
      const got = read();
      // an item page can grow after its first frame (a demo reports its own height); keep the place until the
      // page stops moving, but only for a handful of frames — this is a restore, not a watch
      if (Math.abs(got - want) > 1 && attempts < 5) { requestAnimationFrame(apply); return; }
      window.__scrollRestore = {
        hash, captured: want, restored: got, error: Math.abs(got - want), attempts,
        ms: Math.round(performance.now() - started),
        count: (window.__scrollRestore?.count ?? 0) + 1,
      };
    };
    apply();
    // the page turn is 250 ms; a check after it catches a page that grew while the turn was running, and does
    // nothing at all if the visitor has meanwhile scrolled somewhere themselves
    const id = setTimeout(() => {
      if (takenOver.current) return;
      const now = read();
      if (Math.abs(now - want) > 1) write(want);
      const settled = read();
      if (window.__scrollRestore && window.__scrollRestore.hash === hash) {
        window.__scrollRestore.error = Math.abs(settled - want);
        window.__scrollRestore.restored = settled;
      }
    }, 260);
    return () => clearTimeout(id);
  }, [hash]);
}
