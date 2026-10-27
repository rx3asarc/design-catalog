import React, { useLayoutEffect, useRef } from "react";

/**
 * The page-change moment, re-implemented from the catalogue's own transition.
 *
 * Source: `transitions/page-side-by-side` (Transitions.dev). Read in the store, **not copied** — that
 * collection is `local-only` (licence: "MIT with no-redistribution clause"), so the pattern was re-derived and
 * this file is our own code. What is taken is the item's own numbers, which is what makes it "the item's":
 *
 *   duration 250 ms · ease cubic-bezier(0.22, 1, 0.36, 1) · distance 8 px · page arriving from the side it
 *   travels from, fading in on opacity.
 *
 * Two deliberate deviations, both from this brief and the taste canon rather than from taste:
 *   1. Only the incoming page animates. The item animates two absolutely-positioned siblings side by side;
 *      this shell has one scroller (`.page`, `styles.css`), and stacking a second copy of a 769-item page to
 *      watch it leave is a cost with no reader.
 *   2. The item's 3 px `blur()` is dropped: opacity and transform only, never layout, never a filter pass on
 *      every frame of a route change.
 *
 * Under `prefers-reduced-motion: reduce` nothing runs at all — the pattern is decoration, the route change is
 * the information. `document.getAnimations()` therefore reports zero animations, not a zero-length one.
 *
 * The scroller reset is not this file's: `useScrollReset` in `site/route.ts` already puts `.page` at 0 on
 * every hash change, and it stays exactly as it was.
 */
const ITEM = "transitions/page-side-by-side";
const DURATION = 250;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DISTANCE = 8;

export function PageTurn({ hash, children }: { hash: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef(hash);

  useLayoutEffect(() => {
    const el = box.current;
    const moved = shown.current !== hash;
    shown.current = hash;
    if (!el || !moved) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // forward into an item or a filtered grid arrives from the right; back to the front page from the left
    const from = hash.startsWith("#/i/") || hash.startsWith("#/g") ? DISTANCE : -DISTANCE;
    el.animate(
      [{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: "translateX(0px)" }],
      { duration: DURATION, easing: EASE },
    );
  }, [hash]);

  // the outer box clips, the inner box moves: a transform is scrollable overflow, so without the clip the first
  // 250 ms of every route change widened the document by exactly the 8 px the page slides in from.
  return (
    <div className="page-turn">
      <div ref={box} data-catalog-item={ITEM}>{children}</div>
    </div>
  );
}
