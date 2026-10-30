var e=`import type { Item } from "./lib";

/**
 * The line an item page and a comparison show while the per-item detail is on the wire — and the honest line
 * they show if it never arrives.
 *
 * WHY THESE TWO SURFACES WAIT AT ALL. \`site/lib.ts\` splits the catalogue in two: everything the first screen
 * reads arrives with the entry chunk, and the four per-item fields only an item page or a comparison prints
 * (\`files\`, \`variants\`, \`behaviour\`, \`renderNote\`) arrive as one content-hashed JSON file, fetched once. Both of
 * these surfaces are already \`lazy\` modules, so their chunk and that file travel together: the visitor sees the
 * same sentence they saw before this split, one round trip earlier in the page's life.
 *
 * THE FALLBACK IS NOT A SPINNER AND NOT A ZERO. If the detail file cannot be read — offline, or a cache still
 * holding the previous deploy's html — this says so in one sentence and offers the two things that still work.
 * The alternative is a page that prints "0 files" and "no demo" for an item whose demos simply did not arrive,
 * which is a lie about the catalogue rather than a missing fetch.
 *
 * \`data-surface-wait\` is the attribute \`qa/smoke.mjs\` waits on (it is how the gallery and the item page were
 * already handled), so the loading form carries it and the failed form does not: a gate that waits six seconds
 * and then reads the body should read the failure sentence, not a status line that never resolves.
 */
export function DetailWait({ what, item, failed }: { what: string; item?: Item; failed: boolean }) {
  if (!failed) {
    return (
      <div className="page-in" data-surface-wait="">
        <div className="crumb">{what}</div>
        <p role="status" style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>Fetching {what}…</p>
      </div>
    );
  }
  return (
    <div className="page-in" data-detail-missing="">
      <div className="crumb">{what}</div>
      <h2 className="title">{item ? item.name : what}</h2>
      <p className="lede">
        The file that carries this {item ? "item" : "page"}&apos;s own fields — its files, its demos, its measured
        behaviour — did not load. Nothing is printed in their place rather than printing zeroes for facts that have
        not arrived.
      </p>
      <p className="hint">
        Reloading the page fetches it again.{" "}
        <a href="#/g" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>Every item</a>{" "}
        does not need it.
      </p>
    </div>
  );
}
`;export{e as default};