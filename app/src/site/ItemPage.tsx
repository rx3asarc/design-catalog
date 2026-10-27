import { useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { mainFile, type Item } from "./lib";
import { Copy, Files } from "./Code";
import { Demo } from "./demo";

/**
 * One item's page: what it is, whether its source is ours to publish, its demos, how to install it, its files
 * and a way to walk to the items that are actually related to it.
 */

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export function command(pm: string, install: string) {
  const tail = install.replace(/^npx\s+/, "");
  if (pm === "pnpm") return `pnpm dlx ${tail}`;
  if (pm === "npm") return `npx ${tail}`;
  if (pm === "yarn") return `yarn dlx ${tail}`;
  return `bunx --bun ${tail}`;
}

export function Install({ install }: { install: string }) {
  const [pm, setPm] = useState<string>("pnpm");
  const text = command(pm, install);
  return (
    <>
      <div className="section-h">Installation</div>
      <div className="tabs" role="tablist">
        {MANAGERS.map((m) => (
          <Button key={m} role="tab" data-catalog-item="shadcn/button" variant={pm === m ? "default" : "outline"} size="sm"
            aria-selected={pm === m} className="h-8" onClick={() => setPm(m)}>{m}</Button>
        ))}
      </div>
      <div className="cmd">
        <code>{text}</code>
        <Copy text={text} />
      </div>
    </>
  );
}

/** The pager's two ends. One component so the top pager and the bottom one cannot drift apart. */
function PagerLink({ item, dir }: { item: Item; dir: "prev" | "next" }) {
  return (
    <a href={`#/i/${item.id}`}>
      {dir === "prev" && <span className="dir">←</span>} {item.name} {dir === "next" && <span className="dir">→</span>}
    </a>
  );
}

export function ItemPage({ item, prev, next }: { item: Item; prev?: Item; next?: Item }) {
  return (
    <div className={"page-in" + (item.kind === "block" ? " wide" : "")}>
      <div className="pager">
        {prev ? <PagerLink item={prev} dir="prev" /> : <span className="off" />}
        {next ? <PagerLink item={next} dir="next" /> : <span className="off" />}
      </div>

      <div className="crumb">{item.source} · {item.kind}</div>
      <h2 className="title">{item.name}</h2>
      {item.one_line && <p className="lede">{item.one_line}</p>}
      <div className="badges">
        <Badge data-catalog-item="shadcn/badge" variant={item.withheld ? "outline" : "secondary"} className={`badge ${item.withheld ? "warn" : "ok"}`}>
          {item.withheld ? "source withheld" : "source included"}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
        {item.verdict && (
          <Badge data-catalog-item="shadcn/badge" variant="outline" className={`badge ${item.verdict.verdict === "rejected" ? "bad" : ""}`}>
            {item.verdict.verdict}
          </Badge>
        )}
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.files.length} files</Badge>
        {item.variants.length > 0 && (
          <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">
            {item.variants.length} demo{item.variants.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {item.verdict?.reason && (
        <p className="verdict"><b>{item.verdict.verdict}.</b> {item.verdict.reason}
          {item.verdict.ours_path ? <> — ours: <code>{item.verdict.ours_path}</code></> : null}</p>
      )}

      {item.withheld ? (
        <div className="withheld">
          <p style={{ margin: "0 0 10px" }}>
            The code is not ours to republish, so it is not rendered here. The entry, its files list and our verdict are.
          </p>
          {item.page && <p style={{ margin: 0 }}><a href={item.page} target="_blank" rel="noreferrer">Their page ↗</a></p>}
        </div>
      ) : item.variants.length ? (
        item.variants.map((v, i) => <Demo key={v.module} id={item.id} index={i} variant={v} isBlock={item.kind === "block"} />)
      ) : (
        <div className="withheld">No demo for this one — it is a helper or a doc, not a component.</div>
      )}

      {item.install && <Install install={item.install} />}
      <Files files={item.files} main={mainFile(item)} />

      <nav className="nav2">
        {prev ? <PagerLink item={prev} dir="prev" /> : <span />}
        {next ? <PagerLink item={next} dir="next" /> : <span />}
      </nav>
    </div>
  );
}
