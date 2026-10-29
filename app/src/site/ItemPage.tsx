import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { label, mainFile, isMotionItem, conceptsOf, conceptMembers, type Item } from "./lib";
import { Files } from "./Code";
import { ApiTable, type Fact } from "./ApiTable";
import { InstallBlock } from "./InstallBlock";
import { RelatedCard } from "./RelatedCard";
import { Demo } from "./demo";
import { faceted } from "./Tile";
import { StageBar, useStage } from "./Stage";
import type { Neighbour } from "./route";
import { conceptHref } from "./route";
// `NOT_MEASURED` is the one word for a fact nobody measured; it is defined where the rule is written down
import { NOT_MEASURED } from "./behaviour";
// the one plain sentence per licence value, defined once in the file that explains licensing
import { licenceName, licenceSentence } from "./About";

/**
 * One item's page: what it is, whether its source is ours to publish, its demos, how to install it, its files
 * and a way to walk to the items that are actually related to it.
 *
 * Every block on this page is the design system's own component (see `tokens.css`'s header): the install command
 * is `InstallBlock`, the facts are `ApiTable`, both "where next" rows are `RelatedCards`, and the demo card's
 * view switch is `SegmentedTabs`' segmented control (`demo.tsx`). The page has no hero slot, so it takes no
 * `Cover` — a cover invented for a 30 px title would be a picture nobody asked for.
 */

/** Where an outbound link goes, in the words of the link: "View on beui.dev →", not "↗". */
function host(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** "14 KB" / "512 B" — the manifest's byte count in the size a reader compares, never a rounded lie. */
function size(bytes: number): string {
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

/**
 * The facts the manifest publishes about one item, as rows for the `ApiTable`.
 *
 * This is the line that used to be a run of numbers ("3 files · 14 KB · 8 parts · 1 dep · used here ×4"): the
 * same values, the same order, each one now under the name of the field it came from. `source` and `kind` are not
 * rows — they are the breadcrumb above the title, and printing them twice would be one fact too many.
 *
 * A field with no measurement is a row that says so. The old line simply dropped it, which read as "this item has
 * no dependencies" when the manifest had published no count at all; `null` is not zero, and a visitor is entitled
 * to see the difference.
 */
function facts(item: Item): Fact[] {
  const f = faceted(item);
  const rows: Fact[] = [{ label: "Licence", value: item.licence, title: item.licence }];

  const files = typeof f.file_count === "number" ? f.file_count : item.files.length;
  rows.push({ label: "Files", value: String(files) });

  rows.push(
    typeof f.bytes === "number"
      ? { label: "Size", value: size(f.bytes) }
      : {
          label: "Size",
          value: NOT_MEASURED,
          title: "not measured: the manifest carries no byte count for this item",
          unmeasured: true,
        },
  );

  const parts = f.composition?.count;
  rows.push(
    typeof parts === "number" && parts > 0
      ? { label: "Parts", value: `${f.composition?.lower_bound ? "≥" : ""}${parts}` }
      : {
          label: "Parts",
          value: NOT_MEASURED,
          title: "not measured: the manifest counts no composed parts for this item",
          unmeasured: true,
        },
  );

  rows.push(
    typeof f.dep_count === "number"
      ? { label: "Dependencies", value: String(f.dep_count) }
      : {
          label: "Dependencies",
          value: NOT_MEASURED,
          title: "not measured: the manifest carries no dependency count for this item",
          unmeasured: true,
        },
  );

  rows.push(
    typeof f.used_here === "number"
      ? { label: "Used here", value: `×${f.used_here}` }
      : {
          label: "Used here",
          value: NOT_MEASURED,
          title: "not measured: the manifest carries no usage count for this item",
          unmeasured: true,
        },
  );

  return rows;
}

/** One neighbour of the pager: the item, and the relation that put it there. Both pagers render it the same way. */
function PagerCard({ n, dir }: { n: Neighbour; dir: "prev" | "next" }) {
  const text = label(n.item);
  const word = dir === "prev" ? "Previous" : "Next";
  return (
    <RelatedCard
      href={`#/i/${n.item.id}`}
      ariaLabel={`${word}: ${text} — ${n.relation}`}
      lead={dir === "prev" ? "←" : undefined}
      title={text}
      context={
        <>
          {n.relation}
          {dir === "next" ? " →" : ""}
        </>
      }
    />
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
  const sentence = licenceSentence(item.licence);
  return (
    <div className={"page-in" + (item.kind === "block" ? " wide" : "")}>
      {/*
       * The pager, as `RelatedCards`. It was a strip of two 36 px pills with the item's name and the relation
       * run together; a card gives the name the `title` step and the relation a line of its own, which is the
       * shape the design system publishes for "a link to a neighbouring component". It is no longer `sticky`:
       * two cards are ~90 px tall, and a 90 px bar pinned over the column is the "a strip covers the content"
       * complaint this page has already answered once.
       */}
      <nav className="related-pager" aria-label="Neighbouring items">
        {prev ? <PagerCard n={prev} dir="prev" /> : <span />}
        {next ? <PagerCard n={next} dir="next" /> : <span />}
      </nav>

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
       * The whole of what the manifest knows about this item in numbers, as the design system's table: one
       * hairline row per field, the field's name in the `label` step on the left and its value in `ink` on the
       * right. `source`/`kind` stay in the breadcrumb; nothing here is a number without a name.
       */}
      <ApiTable rows={facts(item)} data-facts="" />

      {/*
       * The licence in one plain sentence. The manifest's own string is the table's `Licence` row — the badge
       * above says what a reader calls it, the row says what the data says, and this says what it allows. A
       * value with no sentence yet prints no sentence: the raw string is still on the page, and a missing
       * sentence is not a licence to invent one.
       */}
      {sentence ? (
        <p className="hint" data-licence="">
          {sentence}
        </p>
      ) : null}

      {/*
       * The way into a comparison, from the item, where a visitor is already asking "and the others?". One card
       * per set, and only for a set that can actually be compared: a concept of one is not a comparison, and the
       * count is the data's, so a set that grows or shrinks changes the sentence instead of contradicting it. An
       * item can sit in two sets (beui/bounce-sidebar is in `bounce-sidebar` and in `sidebar`), so the row names
       * each.
       */}
      {comparable.length > 0 && (
        <div className="related-row" data-compare-links="">
          {comparable.map((c) => (
            <RelatedCard
              key={c.key}
              href={conceptHref(c.key)}
              title={`Compare with the ${c.others} other${c.others === 1 ? "" : "s"}`}
              context={c.key}
            />
          ))}
        </div>
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
           * the reason and the table above still carries it, so the sentence can stay short and true.
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
           * first Copy in document order is the install command, labelled for what it puts on the clipboard, and
           * it is the one accent-filled control on the page.
           */}
          {item.install && (
            <>
              <div className="section-h">Installation</div>
              <InstallBlock install={item.install} />
            </>
          )}
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

      <nav className="related-pager" aria-label="The items either side of this one">
        {prev ? <PagerCard n={prev} dir="prev" /> : <span />}
        {next ? <PagerCard n={next} dir="next" /> : <span />}
      </nav>
    </div>
  );
}
