# design catalog

769 UI components, blocks, effects and doc pages from five reference libraries, in one browsable page, plus a
CLI and an MCP server so an agent can use the same catalogue.

**Browse:** https://rx3asarc.github.io/design-catalog/

## Use it from an agent

```
npx -y https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz mcp
```

MCP client config (Claude Code, Cursor, any stdio client):

```json
{
  "mcpServers": {
    "design-catalog": {
      "command": "npx",
      "args": ["-y", "https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz", "mcp"]
    }
  }
}
```

Tools: `catalog_search`, `catalog_get`, `catalog_stats`.

## Use it from a shell

```
npx -y https://rx3asarc.github.io/design-catalog/data/design-catalog-latest.tgz search "sidebar"
npx -y …/design-catalog-latest.tgz get thinking-states
npx -y …/design-catalog-latest.tgz list --source beui --kind component
npx -y …/design-catalog-latest.tgz stats
```

Zero dependencies, no install step, no native build. Pin the versioned file
(`data/design-catalog-1.0.0.tgz`) instead of `latest` if you want reproducibility — `CHECKSUMS.txt` has the
hash of both.

## What is in it

| source | items | source published | why |
|---|---|---|---|
| shadcn/ui | 566 | yes | MIT |
| beui.dev | 110 | yes | MIT |
| rareui.com | 29 | no | the repo reports NOASSERTION |
| beautifului.dev | 21 | no | terms unclear |
| transitions.dev | 43 | no | MIT, but the collection may not be republished |

676 items ship their code; 93 appear as entries with facts and our port verdict and no source. See
[LICENCES.md](LICENCES.md).

## Data

- `data/index.json` — every item, metadata only (what the page loads)
- `data/items/<source>-<slug>.json` — one item, with source files and sha256 per file
- `data/catalog.json` — the merged publishable catalogue, shipped inside the package
- `CHECKSUMS.txt` — sha256 of every published file; `sha256sum -c CHECKSUMS.txt`

No telemetry, no cookies, no third-party scripts.
