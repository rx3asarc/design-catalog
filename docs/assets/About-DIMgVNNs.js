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

/** Verbatim: both halves of one verification, run in this repo. The two hashes are the same file. */
const CHECKSUMS = \`$ grep " data/catalog.json$" CHECKSUMS.txt
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  data/catalog.json
$ sha256sum docs/data/catalog.json
6198e713f0fc8d9d335ba209fff405b793c798b673c4d37faecbc228b2f089c9  docs/data/catalog.json\`;

/** One line per source: its licence, how much of it publishes a file, how much is withheld. */
function detail(s: (typeof counts.sources)[number]): string {
  const parts = [
    s.licences.join(" · "),
    \`\${s.published} \${s.published === 1 ? "item publishes" : "items publish"} a source file\`,
  ];
  if (s.withheld) parts.push(\`\${s.withheld} withheld\`);
  const noFile = s.items - s.withFile;
  if (noFile) parts.push(\`\${noFile} have no captured file\`);
  return parts.join(" · ");
}

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

      <div className="section-h">The five sources</div>
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
        <b>full</b> — {c.licenceFull} items. The licence is {FULL_LICENCE}. The source may be copied into your
        own repository, and the item page shows the file. {c.licenceFullNoFile} of these have no captured file
        at all, so they are entries as well.
      </div>
      <div className="verdict">
        <b>local-only</b> — {c.withheld} items. Read the source in the original and re-implement it; it is not
        redistributed here. The item page keeps the name, the install command the library publishes, the facts
        and the licence.
      </div>
      <p>
        &quot;Source included&quot; is a licence label, not a file count. {c.licenceFull} items sit under a
        licence that would allow publication, {c.published} of the {c.total} publish a file, and {c.noFile}{" "}
        have no captured source to publish.
      </p>

      <div className="section-h">The {c.withheld} entries without source</div>
      <p>
        {localOnly.map((s) => s.name).join(", ")} — {c.withheld} items between them, and not one of their
        files is republished. Their licences are the reason, in the manifest&apos;s own words:{" "}
        {localOnly.map((s) => \`\${s.name} — \${s.licences.join(", ")}\`).join("; ")}.
      </p>
      <p>
        The page for one of these still carries what the source declares: the name, the one-line description,
        the original page, the install command the library publishes, the measured facts and the licence. The
        file itself stays out.
      </p>

      <div className="section-h">Check a file you downloaded</div>
      <p>
        <a href={\`\${REPO}/blob/master/CHECKSUMS.txt\`}>CHECKSUMS.txt</a> lists the sha256 of every published
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
        <a href="#/chrome">What this site is built from →</a>
      </div>
    </div>
  );
}
`;export{e as default};