var e=`import { VERSION } from "../version";
import { counts, FULL_LICENCE } from "./counts";

/**
 * About: what this is, what the five sources are, what the licences allow, and how to check a file.
 *
 * This is where the licensing explanation lives, so the front page can lead with what a visitor gets instead
 * of what the site may not do. Every number is read from \`./counts\`, which reads the manifest; the licence
 * strings are the manifest's own words, not paraphrases.
 */

const REPO = "https://github.com/rx3asarc/design-catalog";

/**
 * The four licence strings the manifest publishes, each with **one** plain sentence — defined here, once, and
 * imported by \`site/ItemPage.tsx\`, so an item page and this page cannot say different things about the same
 * licence. (It lives in this file because this file is the licensing explanation; the item page is a reader.)
 *
 * The raw string is data, and it is never paraphrased away: every surface that prints a sentence also prints the
 * value itself — \`title=\` on the item page's badge, a \`<code>\` span here — because a gloss can lose the part that
 * matters. "free-to-use (repo reports NOASSERTION)" does **not** mean the repo granted a licence: NOASSERTION is
 * what GitHub reports when the repository publishes no licence file at all, so nothing was asserted about copying.
 * That is a different fact from "MIT", and the sentence has to keep them apart.
 *
 * A value this map does not know gets **no sentence**: the raw string is shown alone, in the manifest's own words,
 * rather than guessed at. \`licenceSentence\` therefore returns \`null\` instead of a shrug in English.
 */
export type LicenceRow = { raw: string; name: string; sentence: string };

export const LICENCES: LicenceRow[] = [
  {
    raw: "MIT",
    name: "MIT",
    sentence: "Free to use, and it allows the code to be copied and published.",
  },
  {
    raw: "MIT with no-redistribution clause",
    name: "MIT, no redistribution",
    sentence: "Free to use, but it forbids passing the code on, so it is not copied here.",
  },
  {
    raw: "free-to-use (repo reports NOASSERTION)",
    name: "free to use, no published licence",
    sentence:
      "The source calls it free to use, but no official licence is published: the repository has no licence file.",
  },
  {
    raw: "unclear",
    name: "licence unclear",
    sentence: "No licence terms were found at the source, so the code is not treated as ours to copy.",
  },
];

const licenceRow = (raw: string): LicenceRow | null => LICENCES.find((l) => l.raw === raw) ?? null;

/** The words a visitor reads for a licence. Unknown values are shown as the manifest spells them. */
export const licenceName = (raw: string): string => licenceRow(raw)?.name ?? raw;

/** One plain sentence, or \`null\` when nobody has written one for this value — never an invented one. */
export const licenceSentence = (raw: string): string | null => licenceRow(raw)?.sentence ?? null;

/** Verbatim: both halves of one verification, run in this repo. The two hashes are the same file. */
const CHECKSUMS = \`$ grep " data/catalog.json$" CHECKSUMS.txt
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  data/catalog.json
$ sha256sum docs/data/catalog.json
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  docs/data/catalog.json\`;

/** One line per source: its licence, how much of it publishes a file, how much is not copied here. */
function detail(s: (typeof counts.sources)[number]): string {
  const parts = [
    s.licences.map(licenceName).join(" · "),
    \`\${s.published} \${s.published === 1 ? "item publishes" : "items publish"} a source file\`,
  ];
  if (s.withheld) parts.push(\`\${s.withheld} not copied here\`);
  const noFile = s.items - s.withFile;
  if (noFile) parts.push(\`\${noFile} have no captured file\`);
  return parts.join(" · ");
}

/**
 * How many items sit under one licence, counted from \`./counts\` and nowhere else.
 *
 * A source contributes its count only when it declares that licence. A source that declared **two** could not be
 * split by count — the manifest does not say which of its items carries which — so this returns \`null\` and the
 * row prints no number, rather than a share nobody published. (Today every source declares one licence.)
 */
const itemsUnder = (raw: string): number | null => {
  const mine = counts.sources.filter((s) => s.licences.includes(raw));
  if (mine.some((s) => s.licences.length > 1)) return null;
  return mine.reduce((n, s) => n + s.items, 0);
};

export function About() {
  const c = counts;
  const localOnly = c.sources.filter((s) => s.withheld > 0);
  return (
    <div className="page-in">
      <div className="crumb">
        about · {c.sources.length} sources · the licences
      </div>
      <h2 className="title">About</h2>
      <p className="lede">
        An index of {c.total} components, blocks, effects and doc pages from {c.sources.length} reference
        libraries, with the licence each source declares. One index, read three ways: this site, a CLI, an MCP
        server.
      </p>

      <div className="section-h">The {c.sources.length} sources</div>
      <ul className="ways">
        {c.sources.map((s) => (
          <li className="way" key={s.name}>
            <span className="way-n">{s.items}</span>
            <div>
              <div className="way-h">{s.name}</div>
              <p className="way-p">{detail(s)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="hint">
        The number on the left is how many items came from that source. Counts are from the manifest, per
        source.
      </p>

      <div className="section-h">What the licences allow</div>
      <p>
        Each source carries a <code>code_policy</code> and each item carries the licence string its source
        declares. There are two policies:
      </p>
      <div className="verdict">
        <b>Copied here</b> (<code>full</code>) — {c.licenceFull} items. The licence is {FULL_LICENCE}. The source
        may be copied into your own repository, and the item page shows the file when one was captured.{" "}
        {c.licenceFullNoFile} of these have no captured file at all, so they are entries as well.
      </div>
      <div className="verdict">
        <b>Not copied here</b> (<code>local-only</code>) — {c.withheld} items. The code is not copied here; read
        it on the original site and re-implement it instead. The item page keeps the name, the install command
        the library publishes, the facts and the licence.
      </div>
      <p>
        &quot;Code shown here&quot; is a licence label, not a file count. {c.licenceFull} items sit under the MIT
        licence, the only one that allows publication. {c.licenceFullNoFile} of those {c.licenceFull} have no
        captured file, and {c.published} of the {c.total} items publish one. {c.noFile} items have no captured
        file at all — those {c.licenceFullNoFile}, plus {c.noFile - c.licenceFullNoFile} under the three licences
        that do not allow publication.
      </p>

      <div className="section-h">Each licence, in one sentence</div>
      <ul className="ways">
        {LICENCES.map((l) => (
          <li className="way" key={l.raw}>
            <span className="way-n">{itemsUnder(l.raw) ?? ""}</span>
            <div>
              <div className="way-h">{l.name}</div>
              <p className="way-p">
                <code title={l.raw}>{l.raw}</code> — {l.sentence}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="section-h">The {c.withheld} entries whose code is not copied here</div>
      <p>
        {localOnly.map((s) => s.name).join(", ")} — {c.withheld} items between them, and not one of their
        files is republished. The licence is the reason, one per source:{" "}
        {localOnly.map((s) => \`\${s.name} — \${s.licences.map(licenceName).join(", ")}\`).join("; ")}. Each of those
        is a row in the list above, with the manifest&apos;s own string beside it.
      </p>
      <p>
        The page for one of these still carries what the source declares: the name, the one-line description,
        the original page, the install command the library publishes, the measured facts and the licence. The
        file itself stays out.
      </p>

      <div className="section-h">Check a file you downloaded</div>
      <p>
        <a href={\`\${REPO}/blob/master/CHECKSUMS.txt\`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>CHECKSUMS.txt</a> lists the sha256 of every published
        file, one per line, paths relative to the repository root. Compare a file you downloaded against the
        line for it:
      </p>
      <div className="demo">
        <div className="demo-code">
          <pre>{CHECKSUMS}</pre>
        </div>
      </div>
      <p className="hint">
        Same digest, so the file is the one that was published. The site serves that file from{" "}
        <code>docs/data/</code> and the checksum names it as <code>data/</code>; that is the same path under
        two roots.
      </p>

      <div className="section-h">Where the numbers come from</div>
      <p>
        Every count on this site is computed from <code>manifest.json</code> when the page renders — no figure
        is typed in by hand. The CLI prints the same totals: <code>design-catalog stats</code>, on version{" "}
        {VERSION}.
      </p>

      <div className="nav2">
        <a href="#/">← The catalogue</a>
        <a href="#/chrome">Components used to build this site →</a>
      </div>
    </div>
  );
}
`;export{e as default};