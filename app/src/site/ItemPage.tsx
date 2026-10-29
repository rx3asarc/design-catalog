import { useState } from "react";
import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { label, mainFile, isMotionItem, conceptsOf, conceptMembers, type Item } from "./lib";
import { Copy, Files } from "./Code";
import { Demo } from "./demo";
import { Facets } from "./Tile";
import { StageBar, useStage } from "./Stage";
import type { Neighbour } from "./route";
import { conceptHref } from "./route";
// the one plain sentence per licence value, defined once in the file that explains licensing
import { licenceName, licenceSentence } from "./About";

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
        <Copy text={text} label="Copy install command" />
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
  // the comparisons this item is a member of, and only those with something to compare against
  const comparable = conceptsOf(item)
    .map((key) => ({ key, others: conceptMembers(key).length - 1 }))
    .filter((c) => c.others >= 1);
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
          {item.withheld ? "code not shown" : "code shown here"}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge" title={item.licence}>
          {licenceName(item.licence)}
        </Badge>
        <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">
          {item.files.length} {item.files.length === 1 ? "file" : "files"}
        </Badge>
        {item.variants.length > 0 && (
          <Badge data-catalog-item="shadcn/badge" variant="outline" className="badge">
            {item.variants.length} demo{item.variants.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/*
       * The licence in one plain sentence, with the manifest's own string beside it in a code span: the badge
       * names it, this says what it allows, and the raw value stays on the page so the sentence can be checked
       * against it. A value with no sentence yet (one this build has not met) prints the raw string alone — a
       * missing sentence is not a licence to invent one.
       */}
      {/*
       * The whole of what the manifest knows about the item in numbers, in one line, on the page where a reader has
       * decided to look at this one item. The cards in a grid print only files/size/parts now (see `Facets`); deps
       * and "used here" live here, so the grid stops repeating four facts 486 times and no fact goes unpublished.
       */}
      <p className="hint" data-facts="" style={{ margin: "0 0 8px" }}>
        <Facets item={item} mode="all" />
      </p>

      <p className="hint" data-licence="" style={{ margin: "0 0 20px" }}>
        Licence: <code title={item.licence}>{item.licence}</code>
        {licenceSentence(item.licence) ? ` — ${licenceSentence(item.licence)}` : null}
      </p>

      {/*
       * The way into a comparison, from the item, where a visitor is already asking "and the others?". One line,
       * and only for a set that can actually be compared: a concept of one is not a comparison, and the count is
       * the data's, so a set that grows or shrinks changes the sentence instead of contradicting it. An item can
       * sit in two sets (beui/bounce-sidebar is in `bounce-sidebar` and in `sidebar`), so the line names each.
       */}
      {comparable.length > 0 && (
        <p data-compare-links="" style={{ fontSize: 14, margin: "0 0 20px" }}>
          {comparable.map((c, i) => (
            <span key={c.key}>
              {i > 0 && " · "}
              <a href={conceptHref(c.key)} style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>
                Compare with the {c.others} other{c.others === 1 ? "" : "s"} in <strong>{c.key}</strong>
              </a>
            </span>
          ))}
        </p>
      )}

      {/*
       * No verdict badge and no reason paragraph. `port_note` may carry a verdict in the data; this shell does not
       * read it and a visitor never sees it — the page states what the item is, what it looks like, what it costs
       * in files, and where it came from. Anything that read like a grade is gone from this file on purpose.
       */}

      {item.withheld ? (
        <div className="withheld">
          {/*
           * Facts only, in the words a visitor already speaks: whether the code is here, why not when it is not,
           * and where to read it. The old sentence ("The code is theirs. It is not republished here") said the
           * same thing in two abstractions — "theirs" and "republished" — and named no reason. The licence is
           * the reason and the badge above still carries its name, so the sentence can stay short and true.
           */}
          <p style={{ margin: host(item.page) ? "0 0 14px" : 0 }}>
            Code not shown here because the licence does not allow us to republish it.
            {host(item.page) ? ` See it on ${host(item.page)}.` : ""}
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
        <>
          {/*
           * The install command comes before the demos, because it is the thing a visitor came for and because the
           * tester's report was exact: "the first visible Copy on an item page copies a preview wrapper". Measured
           * before this change on `#/i/beui/animated-sidebar`, the first Copy was the demo's source; after it, the
           * first Copy in document order is the install command, labelled for what it puts on the clipboard.
           */}
          {item.install && <Install install={item.install} />}
          <div className="stage" data-stage={item.id}>
            <StageBar item={item} api={api} canReplay={canReplay} />
            {item.variants.map((v, i) => (
              <Demo key={v.module} id={item.id} index={i} variant={v} isBlock={item.kind === "block"} stage={api.stage} />
            ))}
          </div>
        </>
      ) : (
        <div className="withheld">No demo for this one — it is a helper or a doc, not a component.</div>
      )}

      {/*
       * The install block moved above the stage, so it is not repeated here: one command, one Copy, in the place a
       * visitor looks first.
       */}
      {/*
       * A withheld item gets no `<Files>`. The viewer was handed a placeholder line and rendered it inside a 560 px
       * box — an empty code pane under a page that had already said the code is not here. The file *names* are
       * facts and they are published, so they stay as text; the viewer is only for files we can actually show.
       */}
      {item.withheld ? (
        item.files.length > 0 && (
          <>
            <div className="section-h">
              Source {item.files.length === 1 ? "file" : "files"} ({item.files.length})
            </div>
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
