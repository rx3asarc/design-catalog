var e=`import { useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { label, mainFile, isMotionItem, type Item } from "./lib";
import { Copy, Files } from "./Code";
import { Demo } from "./demo";
import { StageBar, useStage } from "./Stage";
import type { Neighbour } from "./route";

/**
 * One item's page: what it is, whether its source is ours to publish, its demos, how to install it, its files
 * and a way to walk to the items that are actually related to it.
 */

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export function command(pm: string, install: string) {
  const tail = install.replace(/^npx\\s+/, "");
  if (pm === "pnpm") return \`pnpm dlx \${tail}\`;
  if (pm === "npm") return \`npx \${tail}\`;
  if (pm === "yarn") return \`yarn dlx \${tail}\`;
  return \`bunx --bun \${tail}\`;
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

/** One neighbour of the pager: the item, and the relation that put it there. Both pagers render it the same way. */
function PagerLink({ n, dir }: { n: Neighbour; dir: "prev" | "next" }) {
  const text = label(n.item);
  return (
    <a
      href={\`#/i/\${n.item.id}\`}
      aria-label={\`\${dir === "prev" ? "Previous" : "Next"}: \${text} — \${n.relation}\`}
      title={\`\${dir === "prev" ? "Previous" : "Next"}: \${text} — \${n.relation}\`}
    >
      {dir === "prev" && <span className="dir">←</span>} {text}{" "}
      <span className="dir">{n.relation}</span>
      {dir === "next" && <> <span className="dir">→</span></>}
    </a>
  );
}

export function ItemPage({ item, prev, next }: { item: Item; prev?: Neighbour; next?: Neighbour }) {
  const name = label(item);
  // the stage: one console for every demo on the page, so a 15-variant item does not grow 15 theme switches
  const api = useStage();
  const canReplay = isMotionItem(item);
  return (
    <div className={"page-in" + (item.kind === "block" ? " wide" : "")}>
      <div className="pager">
        {prev ? <PagerLink n={prev} dir="prev" /> : <span className="off" />}
        {next ? <PagerLink n={next} dir="next" /> : <span className="off" />}
      </div>

      <div className="crumb">{item.source} · {item.kind}</div>
      <h2 className="title">{name}</h2>
      {item.one_line && <p className="lede">{item.one_line}</p>}
      <div className="badges">
        <Badge data-catalog-item="shadcn/badge" variant={item.withheld ? "outline" : "secondary"} className={\`badge \${item.withheld ? "warn" : "ok"}\`}>
          {item.withheld ? "source withheld" : "source included"}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
        {item.verdict && (
          <Badge data-catalog-item="shadcn/badge" variant="outline" className={\`badge \${item.verdict.verdict === "rejected" ? "bad" : ""}\`}>
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
        <div className="stage" data-stage={item.id}>
          <StageBar item={item} api={api} canReplay={canReplay} />
          {item.variants.map((v, i) => (
            <Demo key={v.module} id={item.id} index={i} variant={v} isBlock={item.kind === "block"} stage={api.stage} />
          ))}
        </div>
      ) : (
        <div className="withheld">No demo for this one — it is a helper or a doc, not a component.</div>
      )}

      {item.install && <Install install={item.install} />}
      <Files files={item.files} main={mainFile(item)} />

      <nav className="nav2">
        {prev ? <PagerLink n={prev} dir="prev" /> : <span />}
        {next ? <PagerLink n={next} dir="next" /> : <span />}
      </nav>
    </div>
  );
}
`;export{e as default};