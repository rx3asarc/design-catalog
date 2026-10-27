import { useMemo } from "react";
import { VERSION } from "../version";
import { items } from "./lib";
import { Copy } from "./Code";

/** The front page: what this is, three ways in, what is inside, then the commands. Copy is another unit's. */

const TARBALL = "https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz";
const MCP_CONFIG = `{
  "mcpServers": {
    "design-catalog": {
      "command": "npx",
      "args": ["-y", "${TARBALL}", "mcp"]
    }
  }
}`;

export function Cmd({ text, label }: { text: string; label?: string }) {
  return (
    <div className="cmd-wrap">
      {label && <div className="cmd-label">{label}</div>}
      <div className="cmd">
        <code>{text}</code>
        <Copy text={text} />
      </div>
    </div>
  );
}

/** The front page is a first-run screen: what this is, three ways in, what is inside, then the commands. */
export function Home() {
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.source] = (m[i.source] ?? 0) + 1;
    return m;
  }, []);
  const sources = useMemo(() => Object.keys(counts).sort((a, b) => counts[b] - counts[a]), [counts]);
  const shipped = items.filter((i) => !i.withheld).length;
  const withheld = items.length - shipped;
  const rendered = items.filter((i) => i.variants.length > 0).length;
  return (
    <div className="page-in">
      <h2 className="title">design catalog</h2>
      <p className="lede">
        {items.length} components, blocks, effects and doc pages collected from {sources.length} reference
        libraries. Where the source is ours to republish it ships with the item; where it builds against the
        catalogue's own components it runs here, live — licence named and our verdict attached.
      </p>

      <ol className="ways">
        <li className="way">
          <span className="way-n">01</span>
          <div>
            <div className="way-h">Browse the rail</div>
            <p className="way-p">
              Four sections, down to families. The count on any level is how many items are inside it, and the
              filter box narrows all of them at once.
            </p>
          </div>
        </li>
        <li className="way">
          <span className="way-n">02</span>
          <div>
            <div className="way-h">Open an item</div>
            <p className="way-p">
              Every page names the source and the licence, lists the files, and runs each variant as the component
              itself rather than a picture of it. <a href="#/i/shadcn/button">Start with button</a>, or open a{" "}
              <a href="#/i/shadcn/dashboard-01">whole dashboard</a>.
            </p>
          </div>
        </li>
        <li className="way">
          <span className="way-n">03</span>
          <div>
            <div className="way-h">Use it from an agent</div>
            <p className="way-p">
              The same catalogue is a CLI and an MCP server, so a coding agent can search it and read an item's
              source without a browser. Two commands for that, three for a shell, below.
            </p>
          </div>
        </li>
      </ol>

      <div className="section-h">What is in it</div>
      <div className="tally">
        {sources.map((s) => (
          <span className="tally-item" key={s}>
            <span className="tally-n">{counts[s]}</span>
            <span className="tally-l">{s}</span>
          </span>
        ))}
      </div>
      <p className="tally-note">
        {shipped} of the {items.length} ship their source, and {rendered} of them run here as a live demo. The
        remaining {withheld} are entries with facts, a licence and our verdict and no source, because republishing
        it is not ours to do.
      </p>

      <div className="section-h">From an agent</div>
      <Cmd text={`npx -y ${TARBALL} mcp`} label="MCP server, one command" />
      <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)" />

      <div className="section-h">From a shell</div>
      <Cmd text={`npx -y ${TARBALL} search "sidebar"`} label="search" />
      <Cmd text={`npx -y ${TARBALL} get thinking-states`} label="one item, with its source" />
      <Cmd text={`npx -y ${TARBALL} stats`} label="counts per source" />

      <div className="section-h">Pinning</div>
      <p className="hint">
        <code>latest</code> moves. To pin, use the versioned file and check it against
        <a href="https://rx3asarc.github.io/design-catalog/data/CHECKSUMS.txt"> CHECKSUMS.txt</a> —{" "}
        <code>data/design-catalog-{VERSION}.tgz</code>. Every published file has its sha256 listed there.
      </p>
      <p className="hint">
        This site is built out of the catalogue it describes:{" "}
        <a href="#/chrome">what it is made of, counted from the page</a>.
      </p>
    </div>
  );
}
