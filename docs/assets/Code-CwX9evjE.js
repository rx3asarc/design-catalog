var e=`import { useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { ScrollArea } from "@/registry/new-york-v4/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/registry/new-york-v4/ui/tabs";
import { useCode } from "./lib";

/** Copy a string to the clipboard, and say so for a moment. Used by every command block and code pane. */
export function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      data-catalog-item="shadcn/button"
      variant="outline"
      size="sm"
      className="h-8"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied */ }
        setDone(true); setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

/**
 * The source pane: a tab strip of the item's files and the text of the open one.
 *
 * \`main\` is the file to open first (the item's \`mainFile\`, see \`mainFile()\` in \`./lib\`). The open file is
 * derived from the item's own \`files\` on every render, so a route change can never leave another item's file
 * selected: \`chosen\` is only honoured while it is still a member of this item's list.
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
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
            {files.map((f) => (
              <TabsTrigger key={f} value={f} title={f}
                className="h-9 rounded-none border-b-2 border-transparent px-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {f.split("/").pop()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="cmd" style={{ borderRadius: "0 8px 0 0" }}>
        <span className="path">{sel}</span>
        {code && <Copy text={code} />}
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
`;export{e as default};