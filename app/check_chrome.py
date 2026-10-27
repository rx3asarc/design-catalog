#!/usr/bin/env python3
"""The shop must be furnished with its own goods.

Fails when the catalogue shell uses a hand-written interactive primitive instead of a component the catalogue
ships. Raw structural tags (div/span/li/ul/p/pre/code/a/section/main/aside) are furniture, not chrome, and are
allowed; interactive controls are not.

    python3 check_chrome.py            # report, exit 1 if any crate is found
    python3 check_chrome.py --warn     # report, always exit 0 (used while the rail is still being swapped)

Every finding names file, line and what to import instead.

The shell is the root modules plus **every module under `src/site/`**, discovered by glob: a new surface module
is covered the moment it exists. The site's own copy on `#/chrome` promises exactly that, so the file list is
derived, never hand-maintained.
"""
import pathlib
import re
import sys

# resolved from this file, not the caller's cwd: run from the repo root or from app/, it reads the same files
ROOT = pathlib.Path(__file__).resolve().parent
# the shell, at the root of src/ …
ROOT_SHELL = ["src/App.tsx", "src/demo-main.tsx", "src/main.tsx", "src/provenance.tsx"]
# … and every surface module, globbed so nothing new can slip past the guard
SITE_GLOB = "src/site/*.tsx"

# tag -> the registry component that should replace it
BANNED = {
    "button": "Button",
    "input": "Input",
    "textarea": "Textarea",
    "select": "Select",
    "details": "Collapsible",
    "summary": "CollapsibleTrigger",
    "table": "Table",
}


def shell_files():
    """The files the guard reads. Printed under the result, so a green run names what it covered."""
    files = [ROOT / rel for rel in ROOT_SHELL]
    files += sorted(ROOT.glob(SITE_GLOB))
    return [p for p in files if p.exists()]


def scan(path: pathlib.Path):
    out = []
    # comments talk about tags; only code counts. Blank them out but keep line numbers.
    raw = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), path.read_text(), flags=re.S)
    for n, line in enumerate(raw.splitlines(), 1):
        code = re.sub(r"//.*$", "", line)
        code = re.sub(r"\{/\*.*?\*/\}", "", code)
        code = re.sub(r"^\s*\*.*$", "", code)
        for tag, replacement in BANNED.items():
            if re.search(rf"<{tag}[\s>/]", code):
                out.append((path.as_posix(), n, tag, replacement, line.strip()[:96]))
    return out


def main():
    warn = "--warn" in sys.argv
    files = shell_files()
    if len(files) <= len(ROOT_SHELL):
        # the site glob found nothing: the shell is empty or the tree is not what this guard assumes
        print(f"chrome: no surface modules found under {SITE_GLOB} — the guard would cover nothing")
        return 2
    findings = []
    for p in files:
        findings.extend(scan(p))
    covered = ", ".join(p.relative_to(ROOT).as_posix().replace("src/", "") for p in files)
    if not findings:
        print("chrome: every interactive element is a catalogue component")
        print(f"chrome: {len(files)} shell file(s) scanned — {covered}")
        return 0
    print(f"chrome: {len(findings)} hand-written control(s) — the interface is not yet the product\n")
    for f, n, tag, repl, text in findings:
        print(f"  {pathlib.Path(f).relative_to(ROOT).as_posix()}:{n}  <{tag}>  ->  import {{ {repl} }} from \"@/registry/new-york-v4/ui/{repl.lower()}\"")
        print(f"      {text}")
    print(f"\nchrome: {len(files)} shell file(s) scanned — {covered}")
    print("\nwarn mode: publishing anyway" if warn else "\nrefusing: swap the plain tag for the component above")
    return 0 if warn else 1


if __name__ == "__main__":
    sys.exit(main())
