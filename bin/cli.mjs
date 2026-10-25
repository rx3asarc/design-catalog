#!/usr/bin/env node
/**
 * design-catalog — one binary, two faces.
 *
 *   design-catalog search "sidebar"        human-readable
 *   design-catalog get thinking-states     one item, with source
 *   design-catalog list --source beui      filter
 *   design-catalog stats
 *   design-catalog mcp                     stdio MCP server (catalog_search / catalog_get / stats)
 *
 * Zero dependencies: the data ships inside this package, so `npx -y <tarball-url> …` needs no install step,
 * no network beyond the tarball itself, and no native build.
 */
import { createInterface } from "node:readline";

const DATA = new URL("../data/catalog.json", import.meta.url);
const pkg = await import("../package.json", { with: { type: "json" } }).catch(() => ({ default: { version: "?" } }));
const VERSION = pkg.default.version;

let catalogue = null;
async function load() {
  if (!catalogue) {
    const fs = await import("node:fs/promises");
    catalogue = JSON.parse(await fs.readFile(DATA, "utf8"));
  }
  return catalogue;
}

const lower = (s) => String(s ?? "").toLowerCase();
function score(item, words) {
  const hay = lower([item.name, item.slug, item.one_line, item.source, item.kind, item.verdict?.reason].join(" "));
  let n = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    n += lower(item.name).includes(w) ? 3 : lower(item.slug).includes(w) ? 2 : 1;
  }
  return n;
}
function search(items, query, { source, kind, limit = 20 } = {}) {
  const words = lower(query).split(/\s+/).filter(Boolean);
  return items
    .filter((i) => (!source || i.source === source) && (!kind || i.kind === kind))
    .map((i) => ({ i, s: words.length ? score(i, words) : 1 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name))
    .slice(0, limit)
    .map((x) => x.i);
}
const brief = (i) =>
  `${i.name}  [${i.source}/${i.kind}]${i.verdict ? "  " + i.verdict.verdict : ""}${i.withheld ? "  source withheld" : ""}\n` +
  `  ${i.one_line ?? ""}${i.install ? `\n  install: ${i.install}` : ""}`;

/* ------------------------------- CLI ------------------------------- */
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out.flags[k] = v;
    } else out._.push(a);
  }
  return out;
}

async function cli(argv) {
  const { _, flags } = parseArgs(argv);
  const cmd = _[0] ?? "help";
  const items = await load();

  if (cmd === "help" || flags.help) {
    console.log(`design-catalog ${VERSION} — ${items.length} components, blocks and effects from five libraries

  search <query> [--source s] [--kind k] [--limit n]
  get <slug> [--json]
  list [--source s] [--kind k] [--limit n]
  stats
  mcp                     run as an MCP server over stdio
  --json                  machine-readable output for any command`);
    return 0;
  }
  if (cmd === "stats") {
    const by = {};
    for (const i of items) by[i.source] = (by[i.source] ?? 0) + 1;
    const out = { items: items.length, by_source: by, with_source: items.filter((i) => !i.withheld).length };
    console.log(flags.json ? JSON.stringify(out, null, 2) : Object.entries(by).map(([k, v]) => `${k.padEnd(14)} ${v}`).join("\n") + `\n${"total".padEnd(14)} ${items.length} (${out.with_source} with source)`);
    return 0;
  }
  if (cmd === "get") {
    const slug = _[1];
    const item = items.find((i) => i.slug === slug) ?? items.find((i) => lower(i.name) === lower(slug));
    if (!item) { console.error(`no item "${slug}"`); return 1; }
    if (flags.json) { console.log(JSON.stringify(item, null, 2)); return 0; }
    console.log(brief(item));
    if (item.page) console.log(`  page: ${item.page}`);
    if (item.verdict) console.log(`  verdict: ${item.verdict.reason}`);
    for (const f of item.files ?? []) {
      console.log(`\n--- ${f.path} (${f.bytes}B, sha256 ${f.sha256.slice(0, 16)}…) ---\n${f.content}`);
    }
    return 0;
  }
  if (cmd === "search" || cmd === "list") {
    const query = cmd === "search" ? _.slice(1).join(" ") : "";
    const hits = search(items, query, { source: flags.source, kind: flags.kind, limit: +(flags.limit ?? 20) });
    if (flags.json) { console.log(JSON.stringify(hits, null, 2)); return 0; }
    if (!hits.length) { console.error("nothing found"); return 1; }
    console.log(hits.map(brief).join("\n\n"));
    return 0;
  }
  if (cmd === "mcp") return mcp();
  console.error(`unknown command "${cmd}" — try: design-catalog help`);
  return 1;
}

/* ------------------------------- MCP ------------------------------- */
const TOOLS = [
  {
    name: "catalog_search",
    description: "Search 769 UI components, blocks and effects from shadcn/ui, beui.dev, rareui.com, beautifului.dev and transitions.dev. Returns name, source, kind, install command and our port verdict.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "words to match, e.g. 'sidebar' or 'thinking states'" },
        source: { type: "string", description: "shadcn | beui | rareui | beautifului | transitions" },
        kind: { type: "string", description: "component | block | pattern | effect | text" },
        limit: { type: "number", description: "default 20" },
      },
      required: ["query"],
    },
  },
  {
    name: "catalog_get",
    description: "One item in full: source files with bytes and sha256, install command, licence, measured facts, and our port verdict (ported/candidate/parked/rejected with the reason).",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" }, include_code: { type: "boolean", description: "default true" } },
      required: ["slug"],
    },
  },
  {
    name: "catalog_stats",
    description: "Counts per source and kind, and how many items carry publishable source.",
    inputSchema: { type: "object", properties: {} },
  },
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }

async function mcp() {
  const items = await load();
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let req;
    try { req = JSON.parse(line); } catch { continue; }
    const { id, method, params } = req;
    const reply = (result) => send({ jsonrpc: "2.0", id, result });
    const fail = (code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

    if (method === "initialize") {
      reply({
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "design-catalog", version: VERSION },
      });
    } else if (method === "notifications/initialized" || method === "initialized") {
      /* no reply for notifications */
    } else if (method === "ping") {
      reply({});
    } else if (method === "tools/list") {
      reply({ tools: TOOLS });
    } else if (method === "tools/call") {
      const name = params?.name;
      const a = params?.arguments ?? {};
      try {
        if (name === "catalog_search") {
          const hits = search(items, a.query ?? "", { source: a.source, kind: a.kind, limit: a.limit ?? 20 });
          reply({ content: [{ type: "text", text: JSON.stringify(hits.map(({ files, ...rest }) => ({ ...rest, file_count: files?.length ?? 0 })), null, 1) }] });
        } else if (name === "catalog_get") {
          const item = items.find((i) => i.slug === a.slug);
          if (!item) throw new Error(`no item "${a.slug}"`);
          const out = a.include_code === false ? { ...item, files: (item.files ?? []).map(({ content, ...m }) => m) } : item;
          reply({ content: [{ type: "text", text: JSON.stringify(out, null, 1) }] });
        } else if (name === "catalog_stats") {
          const by = {};
          for (const i of items) by[`${i.source}/${i.kind}`] = (by[`${i.source}/${i.kind}`] ?? 0) + 1;
          reply({ content: [{ type: "text", text: JSON.stringify({ items: items.length, by, with_source: items.filter((i) => !i.withheld).length }, null, 1) }] });
        } else fail(-32601, `unknown tool "${name}"`);
      } catch (err) {
        reply({ content: [{ type: "text", text: `error: ${err.message}` }], isError: true });
      }
    } else if (id !== undefined) {
      fail(-32601, `unknown method "${method}"`);
    }
  }
  return 0;
}

process.exitCode = await cli(process.argv.slice(2));
