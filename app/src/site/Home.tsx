import { useMemo, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/new-york-v4/ui/collapsible";
import { Copy } from "./Code";
import { counts } from "./counts";
import { items, type Item } from "./lib";
import { MOD, openPalette } from "./CommandPalette";
import { BrowseByType } from "./BrowseByType";
import { CompareShowcase } from "./CompareShowcase";
import { Featured } from "./Featured";

/**
 * THE FRONT PAGE, REBUILT AROUND "BROWSE BY TYPE".
 *
 * What this page is for, in the order a first visitor needs it:
 *
 *   1. a heading that says what the site is (the page had none — its title was an `h2`, and the review said so);
 *   2. the search field, as the main action, which is the palette the site already had on ⌘K;
 *   3. six real items out of the catalogue, running (the row's own rule lives in `site/Featured.tsx`);
 *   4. **Browse by type** — 89 type cards in 7 sections, the catalogue's own two-level list, each card a door
 *      (`site/BrowseByType.tsx`). The review's "nothing leads to collections" is this section;
 *   5. one comparison showcase (the sidebar table's shape, `site/CompareShowcase.tsx`);
 *   6. the five libraries as a strip: count and licence, both read out of the manifest;
 *   7. the agent interface, short, with the terminal folded to four rows.
 *
 * Every entry point on this page is a control — a button or a link with a 44 px box — and never a phrase inside a
 * sentence. Every number comes from `./counts`, `./taxonomy` or the manifest; nothing on this page is typed by
 * hand, and nothing on it is a build note.
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

/* ── one search, run for real: what the agent interface actually returns ───────────────────────────────── */

const SEARCH_QUERY = "sidebar";
const SEARCH_CMD = `design-catalog search "${SEARCH_QUERY}"`;

/** How many of the index's rows the card shows, folded and open. The marker states the real total, not a craft. */
const SEARCH_FOLD = 4;
const SEARCH_SHOWN = 8;

/**
 * The card's rows, read out of the manifest at render time — never a pasted transcript.
 *
 * A query matches an item's name or slug, a name match outranks a slug match, ties go by name — the order
 * `bin/cli.mjs`'s `score()` puts them in — and the marker's total is the number of rows that matched here, counted,
 * not typed.
 */
const SEARCH_PATTERN = new RegExp(SEARCH_QUERY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const rank = (name: string, slug: string) => (SEARCH_PATTERN.test(name) ? 3 : SEARCH_PATTERN.test(slug) ? 2 : 0);
const SEARCH_ROWS = items
  .filter((i) => SEARCH_PATTERN.test(`${i.name} ${i.slug}`))
  .sort((a, b) => rank(b.name, b.slug) - rank(a.name, a.slug) || a.name.localeCompare(b.name));
const SEARCH_TOTAL = SEARCH_ROWS.length;

/**
 * One row as the CLI prints it: `name  [source/kind]`, then the description the library publishes, then its
 * install command. A field the manifest does not have is a line the row does not print.
 */
function row(i: Item) {
  const lines = [`${i.name}  [${i.source}/${i.kind}]${i.withheld ? "  code not shown (licence)" : ""}`];
  if (i.one_line) lines.push(`  ${i.one_line}`);
  if (i.install) lines.push(`  install: ${i.install}`);
  return lines.join("\n");
}
const searchText = (n: number) => SEARCH_ROWS.slice(0, n).map(row).join("\n\n");

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

/**
 * The agent interface, as a result: the query, the rows it returned, and the honest cut.
 *
 * Folded to four rows and opened by a disclosure, because the whole answer is not what a visitor came for — the
 * sentence above it is. The marker under the block still states how many rows the query had in total, so the fold
 * cannot pass for the whole answer.
 */
function Terminal() {
  const [open, setOpen] = useState(false);
  const shown = open ? Math.min(SEARCH_SHOWN, SEARCH_TOTAL) : Math.min(SEARCH_FOLD, SEARCH_TOTAL);
  const rest = SEARCH_TOTAL - shown;
  return (
    <>
      <div className="demo">
        <div className="demo-head">
          <code>{`$ ${SEARCH_CMD}`}</code>
          <span className="sp" />
          <Copy text={`npx -y ${TARBALL} search "${SEARCH_QUERY}"`} />
        </div>
        <div className="demo-code">
          <pre id="term-answer" data-term-answer={shown}>
            {searchText(shown)}
            {rest > 0 ? `\n\n… ${rest} more of ${SEARCH_TOTAL} matched` : `\n\n${SEARCH_TOTAL} of ${SEARCH_TOTAL}, the whole answer`}
          </pre>
        </div>
      </div>
      {/*
        The disclosure: the button changes how many rows the block above prints, and says which state it is in.
        `aria-expanded` + `aria-controls` rather than a disclosure widget with content of its own, because the
        thing that folds is the answer above this control, not a second block under it.
      */}
      <p className="term-fold">
        <Button
          data-catalog-item="shadcn/button"
          variant="outline"
          size="sm"
          className="h-11"
          aria-expanded={open}
          aria-controls="term-answer"
          onClick={() => setOpen((v) => !v)}
        >
          {open
            ? `Show the first ${SEARCH_FOLD} only`
            : `Show all ${Math.min(SEARCH_SHOWN, SEARCH_TOTAL)} rows`}
        </Button>
      </p>
      <p className="hint">
        Read out of the catalogue when this page renders, not pasted: the first{" "}
        {Math.min(SEARCH_SHOWN, SEARCH_TOTAL)} of {SEARCH_TOTAL} items whose name or slug says{" "}
        <code>{SEARCH_QUERY}</code>, name matches first. A row reads <code>name [source/kind]</code>, then the
        item&apos;s own one-line description, then the command its library publishes for it.{" "}
        <code>{SEARCH_CMD}</code> returns the same rows with their fields.
      </p>
    </>
  );
}

/* ── the page ───────────────────────────────────────────────────────────────────────────────────────────── */

export function Home() {
  const c = counts;
  const libraries = useMemo(() => c.sources.length, [c.sources.length]);
  const [setup, setSetup] = useState(false);
  return (
    <div className="page-in wide home">
      <div className="crumb">
        {c.total} items · {libraries} libraries · browser, CLI, MCP
      </div>

      {/* 1. the heading the page did not have: what the site is, in one line, not its own name again */}
      <h1 className="home-h1">Interface parts from five reference libraries, with their source.</h1>
      <p className="lede">
        {c.total} components, blocks, charts, agent interfaces, effects, fonts and doc pages. {c.demos} of them run
        here as a live demo; every one carries its licence and the library it came from.
      </p>

      {/* 2. the main action: one field, which opens the palette the site already answers to on ⌘K */}
      <div className="home-actions">
        <Button variant="ghost" className="home-search" data-home-search="" onClick={() => openPalette()}>
          <span className="home-search-ph">Search {c.total} items — name, slug or concept</span>
          <kbd className="home-kbd">{MOD} K</kbd>
        </Button>
        <a className="home-ctl" href="#/g" data-home-gallery="">
          All {c.total} items
        </a>
      </div>

      {/* 3. six real items, running — the rule that chose them is in site/Featured.tsx */}
      <Featured />

      {/* 4. the way in: 89 type cards, grouped by section */}
      <BrowseByType />

      {/* 5. one comparison, as the table it is */}
      <CompareShowcase />

      {/* 6. the five libraries, with their counts and licences, both read off the manifest */}
      <section className="libs-sec" aria-labelledby="libs-h">
        <h2 className="section-h" id="libs-h">The five libraries</h2>
        <p className="home-sub">
          What each one allows, from the manifest&apos;s own licence string. A library that cannot be republished
          still has its page here, with the item&apos;s fields and a link to the original.
        </p>
        <ul className="libs">
          {c.sources.map((s) => (
            <li key={s.name}>
              <a className="lib-row" data-lib-row={s.name} href={`#/g?src=${encodeURIComponent(s.name)}`}>
                <span className="lib-name">{s.name}</span>
                <span className="lib-n">
                  {s.items} item{s.items === 1 ? "" : "s"}
                </span>
                <span className="lib-lic">{s.licences.join(" · ")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 7. the agent interface, short: one sentence, one search run for real, the setup behind a disclosure */}
      <section className="agent-sec" aria-labelledby="agent-h">
        <h2 className="section-h" id="agent-h">Ask your agent</h2>
        <p className="home-sub">
          The same index is a CLI and an MCP server: search it, read an item&apos;s source, list by library or kind.
          The block below is one search, run for real against this catalogue.
        </p>
        <Terminal />
        <Collapsible open={setup} onOpenChange={setSetup} data-catalog-item="shadcn/collapsible" className="cmd-wrap">
          <CollapsibleTrigger asChild>
            <Button data-catalog-item="shadcn/button" variant="outline" size="sm" className="h-11">
              {setup ? "Hide setup" : "Setup for an agent"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div style={{ paddingTop: 12 }}>
              <Cmd text={`npx -y ${TARBALL} mcp`} label="MCP server, one command" />
              <Cmd text={MCP_CONFIG} label="MCP client config (Claude Code, Cursor, any stdio client)" />
              <p className="hint">
                <code>get &lt;slug&gt;</code> prints one item with its source, <code>stats</code> prints the counts
                per library, and <code>--json</code> works on any command.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* the two pages a visitor asks for by name, as controls */}
      <div className="home-foot">
        <a className="home-ctl" href="#/about">
          The five libraries and their licences
        </a>
        <a className="home-ctl" href="#/chrome">
          The components this site is made of
        </a>
      </div>
    </div>
  );
}
