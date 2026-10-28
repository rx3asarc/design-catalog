import { useEffect, useRef, useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { ScrollArea } from "@/registry/new-york-v4/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs";
import { useCode } from "./lib";

/**
 * The three things a Copy button can be saying, and the only three.
 *
 * `copied` is set **after** `navigator.clipboard.writeText` resolves, never before: the old component said
 * "Copied" whether the write worked or not, so a visitor whose browser refused the clipboard was told a lie and
 * carried on trusting a clipboard that was empty. `failed` is what a rejection, or a missing Clipboard API at
 * all, now says — and it is announced, not only recoloured.
 */
type CopyState = "idle" | "copied" | "failed";

/** How long a state shows before the button returns to its label. A refusal is worth reading twice as long. */
const HOLD = { copied: 1600, failed: 3200 } as const;

/** The announcement, kept out of the layout: it is for screen readers, and the button already shows the word. */
const LIVE: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/** What a button says, in one place, so the words on screen and the words announced can never disagree. */
function words(state: CopyState, label: string) {
  return state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;
}

/**
 * Copy a string to the clipboard, and say honestly what happened. Used by every command block and code pane.
 *
 * `label` is **required** and names what lands on the clipboard. A button called "Copy" is the bug this
 * component caused: one item page carried sixteen of them, copying four different kinds of thing, with nothing
 * on screen to tell them apart.
 *
 * `detail` names the one specific thing, when the label cannot: the file in the pane, the demo variant. It is
 * appended to the accessible name ("Copy file: lib/utils.ts") and never shown — the path bar above the button,
 * or the demo card's own header beside it, already names it visibly, and the button has to stay small. The
 * accessible name is therefore *the visible text, then a colon, then the exact payload*: it can be longer than
 * the button, it can never contradict it.
 *
 * The runtime fallback to "Copy" exists for exactly one reason: the call sites in `ItemPage.tsx` and `Home.tsx`
 * are another unit's files and have not been wired yet. `label` is required in the type, so those three are
 * type errors today and cannot be written afresh — but a page that is already built still shows a word instead
 * of an empty button until the lead wires them (see the r3-copy report for the labels to use).
 */
export function Copy({ text, label, detail }: { text: string; label: string; detail?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const hold = useRef<number | null>(null);
  useEffect(() => () => { if (hold.current) window.clearTimeout(hold.current); }, []);

  const flash = (s: CopyState) => {
    setState(s);
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = window.setTimeout(() => setState("idle"), HOLD[s]);
  };

  const shown = words(state, label || "Copy");
  // idle: the label, plus the one thing it copies. Copied/failed: exactly the words on the button.
  const name = state === "idle" && detail ? `${label}: ${detail}` : shown;

  return (
    <>
      <Button
        data-catalog-item="shadcn/button"
        // what a test can find this by, without matching on the word "Copy"
        data-copy
        data-copy-state={state}
        variant="outline"
        size="sm"
        className="h-8"
        aria-label={name}
        title={name}
        onClick={async () => {
          const clip = typeof navigator === "undefined" ? undefined : navigator.clipboard;
          // no Clipboard API at all (an insecure origin, an old browser) is a failure, not a silent success
          if (!clip || typeof clip.writeText !== "function") { flash("failed"); return; }
          try {
            await clip.writeText(text);
            flash("copied");
          } catch {
            flash("failed");
          }
        }}
      >
        {shown}
      </Button>
      <span role="status" aria-live="polite" style={LIVE}>
        {state === "failed" ? "Copy failed — the clipboard refused" : state === "copied" ? "Copied" : ""}
      </span>
    </>
  );
}

/**
 * How the file tab strip behaves when an item has more files than fit on one line.
 *
 * It wrapped. The registry's `TabsList` pins `h-9` in a *variant* selector (`group-data-[orientation=
 * horizontal]/tabs:h-9`), and `cn` is tailwind-merge: `h-auto` and that variant class are different keys, so both
 * survived and the stylesheet's order decided — it decided 36 px. The wrapped second row then painted *outside*
 * the list's own box, straight over the path bar below it: measured on the base build at 390 px, tabs sat at
 * y 399–443 while the path bar sat at 398–417, and at 1440 px the fifth tab covered the file pane's Copy button
 * (Playwright refused the click: "subtree intercepts pointer events"). Not a cosmetic overlap — a stolen click.
 *
 * So the row scrolls sideways instead of wrapping, and the height is inline because that is the only channel
 * that wins against a variant utility (`styles.css` is not this unit's file, and this must not depend on which
 * order the compiler emits two conflicting classes in).
 */
const STRIP: React.CSSProperties = {
  height: "auto",
  overflowY: "hidden",
  scrollbarWidth: "thin",
};

/** One tab: 44 px tall, never shrunk below its own text, so five files scroll rather than clip. */
const TAB: React.CSSProperties = { height: 44, minHeight: 44, flex: "none" };

/**
 * The source pane: a tab strip of the item's files and the text of the open one.
 *
 * `main` is the file to open first (the item's `mainFile`, see `mainFile()` in `./lib`). The open file is
 * derived from the item's own `files` on every render, so a route change can never leave another item's file
 * selected: `chosen` is only honoured while it is still a member of this item's list.
 */
export function Files({ files, main }: { files: string[]; main?: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const first = main && files.includes(main) ? main : files[0] ?? null;
  const sel = chosen && files.includes(chosen) ? chosen : first;
  const code = useCode(sel);
  if (!files.length) return null;
  return (
    <>
      <div className="section-h">Source files ({files.length})</div>
      {files.length > 1 && (
        <Tabs data-catalog-item="shadcn/tabs" value={sel ?? ""} onValueChange={setChosen} className="file-tabs">
          <TabsList
            // named, because it is a control and two tab strips share an item page's vocabulary (managers vs files)
            aria-label="Source files"
            className="file-tab-strip w-full flex-nowrap justify-start gap-1 overflow-x-auto overscroll-x-contain rounded-none border-b border-border bg-transparent p-0"
            style={STRIP}
          >
            {files.map((f) => (
              <TabsTrigger key={f} value={f} title={f} style={TAB}
                className="flex-none rounded-none border-b-2 border-transparent px-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {f.split("/").pop()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="cmd" style={{ borderRadius: "0 8px 0 0" }}>
        {/* one line, ellipsised, full path in the tooltip: the strip above scrolls, this never grows */}
        <span className="path truncate" title={sel ?? undefined}>{sel}</span>
        {code && <Copy text={code} label="Copy file" detail={sel ?? undefined} />}
      </div>
      <div className="demo" style={{ borderRadius: "0 0 8px 8px", borderTop: 0 }}>
        <div className="demo-code" style={{ borderTop: 0 }}>
          <ScrollArea data-catalog-item="shadcn/scroll-area" className="h-[560px] w-full">
            <pre>{code ?? "loading…"}</pre>
          </ScrollArea>
        </div>
      </div>
    </>
  );
}
