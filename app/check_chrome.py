#!/usr/bin/env python3
"""The shop must be furnished with its own goods.

Fails when the catalogue shell uses a hand-written interactive primitive instead of a component the catalogue
ships. Raw structural tags (div/span/li/ul/p/pre/code/a/section/main/aside) are furniture, not chrome, and are
allowed; interactive controls are not.

    python3 check_chrome.py            # report, exit 1 if any crate is found
    python3 check_chrome.py --warn     # report, always exit 0 (used while the rail is still being swapped)

Every finding names file, line and what to import instead.
"""
import re, sys, pathlib

SHELL = ["src/App.tsx", "src/demo-main.tsx", "src/main.tsx", "src/provenance.tsx"]

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
WHITELIST = {
    # inside generated demo code we must not touch the library's own markup
    "src/demos/",
}

def scan(path: pathlib.Path):
    out = []
    # comments talk about tags; only code counts. Blank them out but keep line numbers.
    raw = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), path.read_text(), flags=re.S)
    for n, line in enumerate(raw.splitlines(), 1):
        if any(path.as_posix().startswith(p) for p in WHITELIST):
            continue
        code = re.sub(r"//.*$", "", line)
        code = re.sub(r"\{/\*.*?\*/\}", "", code)
        code = re.sub(r"^\s*\*.*$", "", code)
        for tag, replacement in BANNED.items():
            if re.search(rf"<{tag}[\s>/]", code):
                out.append((path.as_posix(), n, tag, replacement, line.strip()[:96]))
    return out

def main():
    warn = "--warn" in sys.argv
    root = pathlib.Path(".")
    findings = []
    for rel in SHELL:
        p = root / rel
        if p.exists():
            findings.extend(scan(p))
    if not findings:
        print("chrome: every interactive element is a catalogue component")
        return 0
    print(f"chrome: {len(findings)} hand-written control(s) — the interface is not yet the product\n")
    for f, n, tag, repl, text in findings:
        print(f"  {f}:{n}  <{tag}>  ->  import {{ {repl} }} from \"@/registry/new-york-v4/ui/{repl.lower()}\"")
        print(f"      {text}")
    print("\nwarn mode: publishing anyway" if warn else "\nrefusing: swap the plain tag for the component above")
    return 0 if warn else 1

if __name__ == "__main__":
    sys.exit(main())
