import { useState } from "react";
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
  const tail = install.replace(/^npx\s+/, "");
  if (pm === "pnpm") return `pnpm dlx ${tail}`;
  if (pm === "npm") return `npx ${tail}`;
  if (pm === "yarn") return `yarn dlx ${tail}`;
  return `bunx --bun ${tail}`;
}

/** Where an outbound link goes, in the words of the link: "View on beui.dev →", not "↗". */
function host(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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
      href={`#/i/${n.item.id}`}
      aria-label={`${dir === "prev" ? "Previous" : "Next"}: ${text} — ${n.relation}`}
      title={`${dir === "prev" ? "Previous" : "Next"}: ${text} — ${n.relation}`}
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
        <Badge data-catalog-item="shadcn/badge" variant={item.withheld ? "outline" : "secondary"} className={`badge ${item.withheld ? "warn" : "ok"}`}>
          {item.withheld ? "source withheld" : "source included"}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.licence}</Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">{item.files.length} files</Badge>
        {item.variants.length > 0 && (
          <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">
            {item.variants.length} demo{item.variants.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/*
       * No verdict badge and no reason paragraph. `port_note` may carry a verdict in the data; this shell does not
       * read it and a visitor never sees it — the page states what the item is, what it looks like, what it costs
       * in files, and where it came from. Anything that read like a grade is gone from this file on purpose.
       */}

      {item.withheld ? (
        <div className="withheld">
          {/*
           * Facts only: whose the code is, that we do not republish it, and where their page is. The old sentence
           * promised "our verdict" alongside the entry — there is no verdict on this site to promise. The way out
           * is the primary action on the page, not a "↗" afterthought.
           */}
          <p style={{ margin: host(item.page) ? "0 0 14px" : 0 }}>
            The code is theirs. It is not republished here; their page has it.
          </p>
          {host(item.page) && (
            <Button
              asChild
              data-catalog-item="shadcn/button"
              variant="default"
              className="h-11 px-4"
              style={{ height: 44, minHeight: 44 }}
            >
              <a href={item.page!} target="_blank" rel="noreferrer">
                View on {host(item.page)} →
              </a>
            </Button>
          )}
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
      {/*
       * A withheld item gets no `<Files>`. The viewer was handed a placeholder line and rendered it inside a 560 px
       * box — an empty code pane under a page that had already said the code is not here. The file *names* are
       * facts and they are published, so they stay as text; the viewer is only for files we can actually show.
       */}
      {item.withheld ? (
        item.files.length > 0 && (
          <>
            <div className="section-h">Source files ({item.files.length})</div>
            <p className="hint">
              {item.files.map((f, i) => (
                <span key={f}>
                  {i > 0 && " · "}
                  <code>{f}</code>
                </span>
              ))}
            </p>
          </>
        )
      ) : (
        <Files files={item.files} main={mainFile(item)} />
      )}

      <nav className="nav2">
        {prev ? <PagerLink n={prev} dir="prev" /> : <span />}
        {next ? <PagerLink n={next} dir="next" /> : <span />}
      </nav>
    </div>
  );
}
