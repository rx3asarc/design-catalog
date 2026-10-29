import { useState } from "react";
import { Button } from "@/registry/new-york-v4/ui/button";
import { Copy } from "./Code";

/**
 * The design system's `InstallBlock`, from the vendored component of that name:
 *
 * > "The install command shown as a single line of mono text, with a tab per package manager and a copy button."
 *
 * What the guideline fixes, and this file therefore does: the block is `surface-300` inside a `border` with
 * `radius-md`; the package-manager tabs are small mono labels with the selected one raised onto `surface-200`
 * inside a `border-strong` outline; the command sits on one line and scrolls sideways rather than wrapping; and
 * **only the package name** is highlighted, in `accent-ink`. Everything visual lives in `styles.css`'s
 * `item page (r6)` section as tokens — no value is typed in here.
 *
 * Two deliberate departures from the preview, both from rules this site already holds:
 *
 *  - The preview's tabs and copy are 24 px tall. This shell's floor is 44 px on a phone (§QA-13), so the tabs
 *    and the copy are 44 px at every width rather than shrinking on a pointer device.
 *  - The preview's copy control is icon-only. Here it keeps its visible label ("Copy install command"), because
 *    the honest-copy work in `Code.tsx` shows "Copied" and "Copy failed" as *words* and an icon-only button
 *    would have nowhere to say them. The accessible name is unchanged; the icon-only form is the one thing in
 *    the guideline this page does not take.
 *
 * The copy button is the page's **one accent-filled primary**: the design book allows the accent in two places
 * — the active nav bar and one primary control per view — and on an item page the primary thing a visitor is
 * here for is the command. It stays the first Copy in document order, which is gated: the install block comes
 * before the demos and before the source pane.
 */

const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

/** The flag that runs a package, per manager. Named once so the command and its highlight cannot disagree. */
const RUNNER: Record<string, string> = {
  pnpm: "pnpm dlx",
  npm: "npx",
  yarn: "yarn dlx",
  bun: "bunx --bun",
};

/**
 * One command, in three parts: the runner, the package, the arguments.
 *
 * The manifest's `install` values are written for npm (`npx shadcn@latest add sidebar-09`), so the runner is
 * rewritten per manager and the package name is peeled off the front of the rest. Splitting here rather than
 * parsing the rendered string is what lets `InstallBlock` colour only the package name, and it produces the
 * same string the page has always printed: `command()` joins the parts back with single spaces.
 */
export function commandParts(pm: string, install: string): { runner: string; pkg: string; rest: string } {
  const tail = install.replace(/^npx\s+/, "").trim();
  const [pkg = "", ...args] = tail.split(/\s+/);
  return { runner: RUNNER[pm] ?? RUNNER.pnpm, pkg, rest: args.join(" ") };
}

/** The command as text — what the copy control puts on the clipboard. */
export function command(pm: string, install: string): string {
  const p = commandParts(pm, install);
  return [p.runner, p.pkg, p.rest].filter(Boolean).join(" ");
}

export function InstallBlock({ install, note }: { install: string; note?: string }) {
  const [pm, setPm] = useState<string>("pnpm");
  const { runner, pkg, rest } = commandParts(pm, install);
  return (
    <section className="install-block" data-install-block="">
      <div className="install-head">
        <div className="install-pms" role="tablist" aria-label="Package manager">
          {MANAGERS.map((m) => (
            <Button
              key={m}
              data-catalog-item="shadcn/button"
              role="tab"
              aria-selected={pm === m}
              variant="ghost"
              size="sm"
              className="install-pm"
              onClick={() => setPm(m)}
            >
              {m}
            </Button>
          ))}
        </div>
        {/* the page's one accent fill: the design book's "one primary control per view" */}
        <Copy text={command(pm, install)} label="Copy install command" className="install-copy" />
      </div>
      <div className="install-cmd">
        <code>
          <span className="prompt">$ </span>
          {runner} <span className="pkg">{pkg}</span>
          {rest ? ` ${rest}` : ""}
        </code>
      </div>
      {/* the guideline's "how to install" line is `small` in `ink-muted`; this page has no such sentence, so
          nothing is invented to fill the slot and the block simply has no note */}
      {note ? <p className="install-note dc-small">{note}</p> : null}
    </section>
  );
}
