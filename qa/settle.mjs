/**
 * Wait for the surface, not for a stopwatch.
 *
 * The gallery, an item page, a comparison, the chrome page and about are fetched on demand now (App.tsx). Each one
 * draws a "Fetching …" line while its chunk is in flight, so a check that navigates and then sleeps for a fixed
 * number of milliseconds is checking the fallback — which is exactly how two r2 checks failed one run and passed
 * the next ("0 <pre>", "0 links"), and how the hero parity check compared six declared ids against zero mounted
 * ones. This wraps `goto` so every navigation in a gate settles the same way: the fallback is gone, then a short
 * beat for the surface's own effects (scroll restore, layout observers).
 *
 * A surface that never arrives still fails the check it was navigating to — the wait gives up after 15 s and the
 * assertion runs against whatever is there, which is a fallback, and a fallback has none of the things being
 * counted. The gate is not softened; it is given the thing it asks about.
 */
export function settle(p, beat = 350) {
  const goto = p.goto.bind(p);
  p.goto = async (url, opts) => {
    const res = await goto(url, opts);
    await p
      .waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 15000 })
      .catch(() => {});
    if (beat) await p.waitForTimeout(beat);
    return res;
  };
  return p;
}
