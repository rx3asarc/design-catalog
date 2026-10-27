var e=`import { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import { VERSION } from "../version";
import { Copy } from "./Code";
import { counts } from "./counts";

/**
 * The front page: what this is, the two ways in, then the counts.
 *
 * The agent interface is part of the hero rather than a footnote — the terminal card is a real run of the
 * published CLI, pasted, not a mock-up, and the setup line is behind a disclosure underneath it. Every number
 * comes from \`./counts\`, which reads the manifest.
 */

const TARBALL = "https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz";
const MCP_CONFIG = \`{
  "mcpServers": {
    "design-catalog": {
      "command": "npx",
      "args": ["-y", "\${TARBALL}", "mcp"]
    }
  }
}\`;

/**
 * The gallery is another unit's surface. \`#/g/…\` already parses in \`site/route.ts\`, but the switch in
 * \`App.tsx\` still renders this page for it, so a link would land back here. Flip this to \`true\` in the same
 * commit that puts \`<Gallery />\` in the \`route.kind === "gallery"\` expression there, and the browse row below
 * grows its link to it — nothing else in this file has to change.
 */
const GALLERY_LIVE = true;

const SEARCH_CMD = \`design-catalog search "sidebar"\`;

/** How many of the CLI's rows the card shows before the marker. The marker states the real total. */
const SEARCH_SHOWN = 8;

/**
 * Verbatim: \`npx -y ./design-catalog-1.0.1.tgz search "sidebar"\`, first 8 of 20 results, against
 * design-catalog 1.0.1. Trailing whitespace trimmed; nothing else changed.
 */
const SEARCH_OUTPUT = \`AI Sidebar  [beui/component]  rejected
  A collapsible AI workspace sidebar for folders, projects, files, and bookmarks with keyboard navigation, optimistic moves, inline rename, and overflow-aware labels.
  install: npx shadcn@latest add https://beui.dev/r/ai-sidebar

Animated Sidebar  [beui/component]  rejected
  A composable application sidebar with morphing nested navigation that folds into an animated icon rail on desktop and becomes a focus-managed sheet on mobile.
  install: npx shadcn@latest add https://beui.dev/r/animated-sidebar

Bounce Sidebar  [beui/component]  rejected
  A vertical sidebar whose active dot jumps between destinations on a curved, spring-loaded path.
  install: npx shadcn@latest add https://beui.dev/r/bounce-sidebar

Bounce Sidebar  [rareui/component]  rejected  source withheld
  A vertical navigation list with a bouncy, spring-animated active indicator.
  install: npx shadcn@latest add https://www.rareui.com/r/bounce-sidebar.json

Hook Sidebar  [rareui/component]  rejected  source withheld
  A vertical navigation list with a dashed rail that marks the active item.
  install: npx shadcn@latest add https://www.rareui.com/r/hook-sidebar.json

Proximity Sidebar  [rareui/component]  rejected  source withheld
  A dash-style scroll sidebar whose items expand as the pointer approaches.
  install: npx shadcn@latest add https://www.rareui.com/r/proximity-sidebar.json

sidebar  [shadcn/component]

  install: npx shadcn@latest add sidebar

Sidebar  [shadcn/text]
  A composable, themeable and customizable sidebar component.
  install: npx shadcn@latest add docs-components-sidebar\`;

/** The total the marker names — one \`search "sidebar"\` run, counted, not guessed. */
const SEARCH_TOTAL = 20;

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

/** The agent interface, as a result: the query, the rows it returned, and the honest cut. */
function Terminal() {
  return (
    <>
      <div className="demo">
        <div className="demo-head">
          <code>{\`$ \${SEARCH_CMD}\`}</code>
          <span className="sp" />
          <Copy text={\`npx -y \${TARBALL} search "sidebar"\`} />
        </div>
        <div className="demo-code">
          <pre>{\`\${SEARCH_OUTPUT}\\n\\n… \${SEARCH_TOTAL - SEARCH_SHOWN} more of \${SEARCH_TOTAL} — \${SEARCH_CMD} --json lists them all\`}</pre>
        </div>
      </div>
      <p className="hint">
        Real output of <code>search &quot;sidebar&quot;</code> on design-catalog {VERSION}: the first {SEARCH_SHOWN} of{" "}
        {SEARCH_TOTAL} results. The rows read <code>name [source/kind]</code>, then the item&apos;s own
        one-line description, then the command its library publishes for it.
      </p>
    </>
  );
}

/** The front page is a first-run screen: what this is, the two ways in, then what is in it. */
export function Home() {
  const c = counts;
  const libraries = useMemo(() => c.sources.length, [c.sources.length]);
  const [setup, setSetup] = useState(false);
  return (
    <div className="page-in">
      <div className="crumb">
        {c.total} items · {libraries} libraries · browser, CLI, MCP
      </div>
      <h2 className="title">design catalog</h2>
      <p className="lede">
        Browse it, or ask your agent. {c.total} components, blocks, effects and doc pages from {libraries}{" "}
        reference libraries, collected in one place.
      </p>

      <ol className="ways">
        <li className="way">
          <span className="way-n">01</span>
          <div>
            <div className="way-h">Browse</div>
            <p className="way-p">
              Four sections in the rail, down to families. Every item opens to its source file, its licence and a
              live demo where one runs.
              {GALLERY_LIVE ? (
                <>
                  {" "}
                  <a href="#/g">The gallery</a> shows every one of them at once.
                </>
              ) : null}
            </p>
          </div>
        </li>
        <li className="way">
          <span className="way-n">02</span>
          <div>
            <div className="way-h">Ask your agent</div>
            <p className="way-p">
              The same index is a CLI and an MCP server: search it, read an item&apos;s source, list by source or
              kind. The terminal below is one search, run for real.
            </p>
          </div>
        </li>
      </ol>

      <Terminal />

      <Collapsible open={setup} onOpenChange={setSetup} data-catalog-item="shadcn/collapsible" className="cmd-wrap">
        <CollapsibleTrigger asChild>
          <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="h-9">
            {setup ? "Hide setup" : "Setup for an agent"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div style={{ paddingTop: 12 }}>
            <Cmd text={\`npx -y \${TARBALL} mcp\`} label="MCP server, one command" />
            <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)" />
            <p className="hint">
              <code>get &lt;slug&gt;</code> prints one item with its source, <code>stats</code> prints the counts
              per source, and <code>--json</code> works on any command.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="section-h">What is in it</div>
      <div className="tally">
        {c.sources.map((s) => (
          <span className="tally-item" key={s.name}>
            <span className="tally-n">{s.items}</span>
            <span className="tally-l">{s.name}</span>
          </span>
        ))}
      </div>
      <p className="tally-note">
        {c.withFile} of the {c.total} include at least one source file; {c.published} of those show it on the item
        page. {c.demos} run here as a live demo. The other {c.noDemo} are entries with a name, a licence and a
        description, and nothing to run.
      </p>
      <p className="hint">
        <a href="#/about">The five sources, what their licences allow, and how to check a file you download.</a>
      </p>
      <p className="hint">
        This site is built out of the catalogue it describes:{" "}
        <a href="#/chrome">what it is made of, counted from the page</a>.
      </p>
    </div>
  );
}
`;export{e as default};