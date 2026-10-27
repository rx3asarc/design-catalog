import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/registry/new-york-v4/ui/toggle-group";

/**
 * The theme switch: three states, honestly represented.
 *
 * The rule that decides the theme is not here — it is the boot script in `app/index.html`, which has to run
 * before the first CSS byte is parsed or the first frame is the wrong colour. That script publishes
 * `window.catalogTheme`, and this calls it: one copy of the rule, two callers. Choosing persists the explicit
 * choice and repaints; choosing "system" *forgets* the choice, so the OS owns the theme again — and the boot
 * script's `matchMedia` listener keeps it following the OS from then on, with or without this component mounted.
 *
 * It is mounted outside the flow (`.theme-switch` is `position: fixed`, at the foot of the rail column exactly
 * as `.rail-reopen` sits at its head), so picking a theme can never move the page under the pointer.
 */

type Mode = "system" | "light" | "dark";

/** The object the boot script publishes. Optional: the shell still renders if it is missing. */
interface ThemeRule {
  read: () => Mode;
  choose: (mode: Mode) => Mode;
}

declare global {
  interface Window {
    catalogTheme?: ThemeRule;
  }
}

/** Visible word, and the state it stands for. "auto" is the system state, named as such for screen readers. */
const MODES: { mode: Mode; word: string }[] = [
  { mode: "system", word: "auto" },
  { mode: "light", word: "light" },
  { mode: "dark", word: "dark" },
];

const isMode = (v: unknown): v is Mode => v === "system" || v === "light" || v === "dark";

/** The choice, read from the rule; a missing rule falls back to what the boot script painted on <html>. */
function current(): Mode {
  const rule = window.catalogTheme;
  if (rule) return rule.read();
  const painted = document.documentElement.getAttribute("data-theme");
  return isMode(painted) ? painted : "system";
}

export function ThemeSwitch() {
  const [mode, setMode] = React.useState<Mode>(current);

  const choose = (next: string) => {
    // a single ToggleGroup sends "" when the picked item is clicked again: that is not a fourth state, and
    // the theme is always one of the three, so the click is simply not a change
    if (!isMode(next) || next === mode) return;
    setMode(next);
    window.catalogTheme?.choose(next);
  };

  return (
    <div className="theme-switch">
      <span className="theme-label" data-catalog-item="shadcn/font-jetbrains-mono">
        Theme
      </span>
      <ToggleGroup
        type="single"
        size="sm"
        value={mode}
        onValueChange={choose}
        aria-label="Theme"
        data-catalog-item="shadcn/toggle-group"
      >
        {MODES.map((m) => (
          <ToggleGroupItem
            key={m.mode}
            value={m.mode}
            aria-label={`Theme: ${m.mode}`}
            className="font-mono text-[11px] uppercase tracking-[0.04em]"
          >
            {m.word}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
