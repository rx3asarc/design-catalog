import { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import { Copy } from "./Code";
import { counts } from "./counts";
import { items, type Item } from "./lib";

/**
 * The front page: what this is, the two ways in, then the counts.
 *
 * The agent interface is part of the hero rather than a footnote — the terminal card is the catalogue answering a
 * real query, generated from the manifest on every render, and the setup line is behind a disclosure underneath
 * it. Every number comes from `./counts` or straight out of the manifest.
 */

const TARBALL = "https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz";
const MCP_CONFIG = `{
  "mcpServers": {
    "design-catalog": {
      "command": "npx",
      "args": ["-y", "${TARBALL}", "mcp"]
    }
  }
}`;

/**
 * The gallery is another unit's surface. `#/g/…` already parses in `site/route.ts`, but the switch in
 * `App.tsx` still renders this page for it, so a link would land back here. Flip this to `true` in the same
 * commit that puts `<Gallery />` in the `route.kind === "gallery"` expression there, and the browse row below
 * grows its link to it — nothing else in this file has to change.
 */
const GALLERY_LIVE = true;

const SEARCH_QUERY = "sidebar";
const SEARCH_CMD = `design-catalog search "${SEARCH_QUERY}"`;

/** How many of the index's rows the card shows before the marker. The marker states the real total. */
const SEARCH_SHOWN = 8;

/**
 * The card's rows, read out of the manifest at render time — never a pasted transcript.
 *
 * The transcript this card used to be had gone stale twice over: it named design-catalog 1.0.1 and it still
 * carried a verdict on six of its eight rows. A query matches an item's name or slug, a name match outranks a
 * slug match, ties go by name — the order `bin/cli.mjs`'s `score()` puts them in — and the marker's total is
 * the number of rows that matched here, counted, not typed.
 */
const SEARCH_PATTERN = new RegExp(SEARCH_QUERY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const rank = (name: string, slug: string) => (SEARCH_PATTERN.test(name) ? 3 : SEARCH_PATTERN.test(slug) ? 2 : 0);
const SEARCH_ROWS = items
  .filter((i) => SEARCH_PATTERN.test(`${i.name} ${i.slug}`))
  .sort((a, b) => rank(b.name, b.slug) - rank(a.name, a.slug) || a.name.localeCompare(b.name));
const SEARCH_TOTAL = SEARCH_ROWS.length;

/**
 * One row as the CLI prints it: `name  [source/kind]`, then the description the library publishes, then its
 * install command. A field the manifest does not have is a line the row does not print. There is no verdict
 * column, here or anywhere a visitor can reach: what this catalogue decided about an item is not shown on the
 * site (`port_note` keeps it; the shell does not read it).
 */
function row(i: Item) {
  const lines = [`${i.name}  [${i.source}/${i.kind}]${i.withheld ? "  source withheld" : ""}`];
  if (i.one_line) lines.push(`  ${i.one_line}`);
  if (i.install) lines.push(`  install: ${i.install}`);
  return lines.join("\n");
}
const SEARCH_TEXT = SEARCH_ROWS.slice(0, SEARCH_SHOWN).map(row).join("\n\n");
/** The rows the card could not fit. Read off the same list, so the marker cannot drift from the query. */
const SEARCH_MORE = Math.max(0, SEARCH_TOTAL - Math.min(SEARCH_SHOWN, SEARCH_TOTAL));

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
          <code>{`$ ${SEARCH_CMD}`}</code>
          <span className="sp" />
          <Copy text={`npx -y ${TARBALL} search "sidebar"`} />
        </div>
        <div className="demo-code">
          <pre>
            {SEARCH_TEXT}
            {SEARCH_MORE > 0
              ? `\n\n… ${SEARCH_MORE} more of ${SEARCH_TOTAL} matched`
              : `\n\n${SEARCH_TOTAL} of ${SEARCH_TOTAL}, the whole answer`}
          </pre>
        </div>
      </div>
      <p className="hint">
        Read out of the catalogue when this page renders, not pasted: the first{" "}
        {Math.min(SEARCH_SHOWN, SEARCH_TOTAL)} of {SEARCH_TOTAL} items whose name or slug says{" "}
        <code>{SEARCH_QUERY}</code>, name matches first. A row reads <code>name [source/kind]</code>, then the
        item&apos;s own one-line description, then the command its library publishes for it. <code>{SEARCH_CMD}</code>{" "}
        returns the same rows with their fields.
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
            <Cmd text={`npx -y ${TARBALL} mcp`} label="MCP server, one command" />
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
      {/*
       * One number for a visitor. The audit arithmetic (how many include a source file, how many of those show
       * it) belongs on `#/about`, where it already is; `./counts` still computes every one of them.
       */}
      <p className="tally-note">{c.demos} of these run here as a live demo.</p>
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
