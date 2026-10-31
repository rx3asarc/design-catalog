var e=`import { Badge } from "@/registry/new-york-v4/ui/badge";
import { Button } from "@/registry/new-york-v4/ui/button";
import { label, mainFile, isMotionItem, conceptsOf, conceptMembers, useDetail, type Item, type ItemFull } from "./lib";
import { DetailWait } from "./DetailWait";
import { Files } from "./Code";
import { ApiTable, type Fact } from "./ApiTable";
import { InstallBlock } from "./InstallBlock";
import { pickLine } from "./behaviour";
import { RelatedCard } from "./RelatedCard";
import { Demo } from "./demo";
import { faceted } from "./Tile";
import { StageBar, useStage } from "./Stage";
import type { Neighbour } from "./route";
import { conceptHref } from "./route";
// \`NOT_MEASURED\` is the one word for a fact nobody measured; it is defined where the rule is written down
import { NOT_MEASURED } from "./behaviour";
// the one plain sentence per licence value, defined once in the file that explains licensing
import { licenceName, licenceSentence } from "./About";

/**
 * One item's page: what it is, whether its source is ours to publish, its demos, how to install it, its files
 * and a way to walk to the items that are actually related to it.
 *
 * Every block on this page is the design system's own component (see \`tokens.css\`'s header): the install command
 * is \`InstallBlock\`, the facts are \`ApiTable\`, both "where next" rows are \`RelatedCards\`, and the demo card's
 * view switch is \`SegmentedTabs\`' segmented control (\`demo.tsx\`). The page has no hero slot, so it takes no
 * \`Cover\` — a cover invented for a 30 px title would be a picture nobody asked for.
 */

/** Where an outbound link goes, in the words of the link: "View on beui.dev →", not "↗". */
function host(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\\./, "");
  } catch {
    return null;
  }
}

/** "14 KB" / "512 B" — the manifest's byte count in the size a reader compares, never a rounded lie. */
function size(bytes: number): string {
  return bytes >= 1024 ? \`\${Math.round(bytes / 1024)} KB\` : \`\${bytes} B\`;
}

/**
 * The facts the manifest publishes about one item, as rows for the \`ApiTable\`.
 *
 * This is the line that used to be a run of numbers ("3 files · 14 KB · 8 parts · 1 dep · used here ×4"): the
 * same values, the same order, each one now under the name of the field it came from. \`source\` and \`kind\` are not
 * rows — they are the breadcrumb above the title, and printing them twice would be one fact too many.
 *
 * A field with no measurement is a row that says so. The old line simply dropped it, which read as "this item has
 * no dependencies" when the manifest had published no count at all; \`null\` is not zero, and a visitor is entitled
 * to see the difference.
 */
function facts(item: ItemFull): Fact[] {
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
      ? { label: "Parts", value: \`\${f.composition?.lower_bound ? "≥" : ""}\${parts}\` }
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
      ? { label: "Used here", value: \`×\${f.used_here}\` }
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
      href={\`#/i/\${n.item.id}\`}
      ariaLabel={\`\${word}: \${text} — \${n.relation}\`}
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
  /*
   * The page's own fields arrive separately from the shell's (see \`site/lib.ts\`): \`files\`, \`variants\`,
   * \`behaviour\` and \`renderNote\` are fetched once, the first time an item page or a comparison is opened, and
   * merged into this same item object. The gate is a component boundary rather than an early \`return\` inside the
   * body because every hook below has to run in the same order on every render, and a page that returns before
   * \`useStage()\` would change that order the moment the detail landed.
   */
  const { ready, failed } = useDetail();
  if (!ready) return <DetailWait what="item" item={item} failed={failed} />;
  return <ItemBody item={item as ItemFull} prev={prev} next={next} />;
}

function ItemBody({ item, prev, next }: { item: ItemFull; prev?: Neighbour; next?: Neighbour }) {
  const name = label(item);
  // the stage: one console for every demo on the page, so a 15-variant item does not grow 15 theme switches
  const api = useStage();
  const canReplay = isMotionItem(item);
  // the comparisons this item is a member of, and only those with something to compare against
  const comparable = conceptsOf(item)
    .map((key) => ({ key, others: conceptMembers(key).length - 1 }))
    .filter((c) => c.others >= 1);
  const sentence = licenceSentence(item.licence);
  /* The measured line, subject-stated: "Pick this if you want a component that collapses to an icon rail…".
     \`null\` when the probe has no facts for this item, and \`null\` prints nothing — never a dash, never "not
     measured" in the place a recommendation would go. */
  const pickNote = pickLine(item, [], \`a \${item.kind === "block" ? "block" : "component"}\`);
  return (
    <div className={"page-in" + (item.kind === "block" ? " wide" : "")}>
      {/*
       * ONE pager, and it is the top one.
       *
       * It used to print twice — once above the title and once after the files — which is the same two links
       * offered at both ends of a page that is already scrolled to one of them. The top copy is the one a
       * visitor arriving from the rail or the gallery reads first, so the top copy is the only copy, and it is
       * \`sticky\` (see the r8 block at the foot of \`styles.css\`): walking a catalogue means walking sideways as
       * well as down, and a way out of the page should not scroll away. It is pinned as ONE 44 px row, not the
       * ~90 px two-card block it renders as in flow, because a bar that covers two lines of the page is the
       * "a strip covers the content" complaint this page has already answered once.
       *
       * Below 860 px the relation line ("same category") is not printed at all: the card is then 44 px tall and
       * the relation was the first thing the column clipped ("same categ"). The name and the arrow are the
       * control, and the relation is still in the link's accessible name (\`PagerCard\`'s \`ariaLabel\`), so nothing
       * is lost to a screen reader or to a search engine — only the clipped visible line goes.
       */}
      <nav className="related-pager pager-top" aria-label="Neighbouring items">
        {prev ? <PagerCard n={prev} dir="prev" /> : <span />}
        {next ? <PagerCard n={next} dir="next" /> : <span />}
      </nav>

      <div className="crumb">{item.source} · {item.kind}</div>
      {/*
       * The item's own name is the page's \`<h1>\`.
       *
       * It was an \`<h2>\` on every route, which is a page whose only heading is a subheading: the item page had
       * no first-level heading at all. Only this surface changes — the comparison and type pages keep the levels
       * they publish — and \`<h1 className="title">\` picks up the 30/36 display step \`.page-in h1\` already sets.
       */}
      <h1 className="title">{name}</h1>
      {item.one_line && <p className="lede">{item.one_line}</p>}

      {/*
       * THE PREVIEW, under the title, before anything else — the order the design system's \`PageHeader\` →
       * \`PreviewCanvas\` pair specifies. It used to sit under the facts table and under the install command:
       * a visitor had to read a licence, five measured facts and a command before seeing the thing they came
       * to look at. The console (theme / width / motion / replay) is inside the canvas, at its top-right
       * corner, and it is one console for every demo rather than a switch per card.
       *
       * An item with no demo has no canvas: a withheld item explains why the code is not here (that is the
       * honest thing to put where the preview would be), and an item that is a helper or a doc says so.
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
            {host(item.page) ? \` See it on \${host(item.page)}.\` : ""}
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
          <div className="stage-canvas">
            <div className="stage-console">
              <StageBar item={item} api={api} canReplay={canReplay} />
            </div>
            {item.variants.map((v, i) => (
              <Demo key={v.module} id={item.id} index={i} variant={v} isBlock={item.kind === "block"} stage={api.stage} />
            ))}
          </div>
        </div>
      ) : (
        <div className="withheld">No demo for this one — it is a helper or a doc, not a component.</div>
      )}

      {/*
       * The install command, after the preview — it is what a visitor asks for once they have seen the thing.
       * Its Copy stays the page's ONE accent-filled control (design book: one primary per view), and it is the
       * only element on this page whose painted background is \`--accent\`; that is measured, not asserted (see
       * the build report's accent list). It is not shown for a withheld item: pointing somebody at a command for
       * code we are not allowed to show is a step they cannot take.
       */}
      {!item.withheld && item.install && (
        <>
          <h2 className="section-h">Installation</h2>
          <InstallBlock install={item.install} />
        </>
      )}

      {/*
       * The measured line, on the item's own page too. The comparison pages have printed "pick this if…" since
       * round 4, derived from the six behaviour facts the probe measured (\`behaviour.ts\`); the item page — the
       * one place a visitor decides — did not. It is the same derivation, with this item as the subject, so it
       * cannot say anything the probe did not measure; an item with no measured facts gets no line at all.
       *
       * This is not the \`pick\` table: that is the human curation slot (0 rows, and it stays whoever fills it,
       * by their own name). What ships here is a measurement, printed in a sentence.
       */}
      {pickNote && <p className="pick-line" data-pick>{pickNote}</p>}

      {/*
       * The status and the counts, after the preview and the command: they are facts about the item, so they
       * sit with the facts table rather than between a visitor and the thing they came to look at. The two
       * status badges paint in \`--ok\` / \`--warn\` now, not in a green and an amber literal (r8).
       */}
      <div className="badges">
        <Badge data-catalog-item="shadcn/badge" variant={item.withheld ? "outline" : "secondary"} className={\`badge \${item.withheld ? "warn" : "ok"}\`}>
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
       * hairline row per field, the field's name in the \`label\` step on the left and its value in \`ink\` on the
       * right. \`source\`/\`kind\` stay in the breadcrumb; nothing here is a number without a name.
       */}
      <ApiTable rows={facts(item)} data-facts="" />

      {/*
       * The licence in one plain sentence. The manifest's own string is the table's \`Licence\` row — the badge
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
       * item can sit in two sets (beui/bounce-sidebar is in \`bounce-sidebar\` and in \`sidebar\`), so the row names
       * each.
       */}
      {comparable.length > 0 && (
        <div className="related-row" data-compare-links="">
          {comparable.map((c) => (
            <RelatedCard
              key={c.key}
              href={conceptHref(c.key)}
              title={\`Compare with the \${c.others} other\${c.others === 1 ? "" : "s"}\`}
              context={c.key}
            />
          ))}
        </div>
      )}

      {/*
       * No verdict badge and no reason paragraph. \`port_note\` may carry a verdict in the data; this shell does not
       * read it and a visitor never sees it — the page states what the item is, what it looks like, what it costs
       * in files, and where it came from. Anything that read like a grade is gone from this file on purpose.
       */}

      {/*
       * A withheld item gets no \`<Files>\`. The viewer was handed a placeholder line and rendered it inside a 560 px
       * box — an empty code pane under a page that had already said the code is not here. The file *names* are
       * facts and they are published, so they stay as text; the viewer is only for files we can actually show.
       */}
      {item.withheld ? (
        item.files.length > 0 && (
          <>
            <h2 className="section-h">
              Source {item.files.length === 1 ? "file" : "files"} ({item.files.length})
            </h2>
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
        <Files files={item.files} main={mainFile(item)} heading="h2" />
      )}
    </div>
  );
}
`;export{e as default};