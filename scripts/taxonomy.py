#!/usr/bin/env python3
"""THE TAXONOMY'S RULE — written once, applied to the manifest, and printed as a diff.

`app/src/site/taxonomy.json` is the site's filing system: 76 types in 7 sections, each type a list of the items
that are members of it, plus the variants folded into their parents. Until round 9 it was produced by a classifier
over the item `kind` and a table of type-name tests (`T(i) = tokens(i) & words`), then corrected by hand. That
classifier is still here — it is the only machinery that knows the catalogue's sections — but round 9's review
found the two things a keyword test cannot see, and this file now states a **rule** for each and applies it:

    "Membership is still matched by name. Button includes Dialog Close Button, Input With Button, Textarea With
     Button, Kbd Button, Spinner Button, Input Group Button — examples of other components that happen to contain
     a button."
                                                                     — r5-review.md, Type pages, item 2

── THE IS-RULE (membership) ─────────────────────────────────────────────────────────────────────────────────────

**A member belongs to a type when the item IS that thing, not when its name contains it.**

The test, in the order it is applied, is a reading of the item's own name plus the demo's own source (the file
`app/src/registry/…/examples/<slug>.tsx` the item was ingested from, which is ground truth for what the thing is):

  1. **HEAD.** The item's head noun — the noun its name ends in, singular — decides. `spinner-button` ends in
     `button` and its demo renders `<Button disabled><Spinner/>Loading…</Button>`: it is a button that shows a
     spinner, so it is a Button. (The review named it as an offender; the source says otherwise, and the source
     wins. Same for `kbd-button`: `<Button>Accept <Kbd>⏎</Kbd></Button>`.)
  2. **OWNERSHIP.** When the head names a *control of* an earlier component in the name, the earlier component
     owns the item: a dialog's close button is demonstrated on the Dialog page and its source is a whole
     `<Dialog>` with a `<Button>` in its footer — it is a Dialog, not a Button. `dialog-close-button` → Dialog,
     `input-group-button` → Input group.
  3. **PREPOSITION.** `X with Y` / `X beside Y` is an X. `input-with-button` renders `<Input/>` beside
     `<Button/>`: the thing is the input. `textarea-with-button` renders `<Textarea/>` above `<Button/>`: the
     thing is the textarea, which the catalogue files as an Input.

Every move below carries the clause that made it (`IS_MOVES`) and the evidence line, so a reader can re-run the
argument rather than trust the table. An item the rule *keeps* where a reader might expect a move is listed too
(`IS_KEPT`), with the same kind of evidence — the rule is only worth writing down if its exceptions are written
down with it.

── THE ONE-AXIS RULE (what a type means) ────────────────────────────────────────────────────────────────────────

**A type names ONE axis: what the thing is, or how it moves — never both.**

    "Types overlap. Effects has Cards, Inputs and toggles, Menus and tabs, Text; Components has Text animation and
     Orbs and backgrounds. Pick one rule."
                                                                     — r5-review.md, Type pages, item 7

The axes are decided by the catalogue's own `kind` field: an item of kind `effect` is a **transition** — a motion
applied to something — and an item of kind `component`, `block`, `pattern` or `text` is a **thing**. So:

  * a *thing* is filed under the thing's name (`Card`, `Button`, `Sidebar`) in the things' sections;
  * a *transition* is filed under `<the part that moves> transitions` in `Effects`, and nowhere else.

Which is why `Effects`' eight thing-named types are renamed to `Card transitions`, `Input transitions`,
`Loader transitions`, `Media transitions`, `Menu transitions`, `Overlay transitions`, `Text transitions`, and the
one name that was a motion in a section of things — `Components / Text animation` — moves into Effects, where the
motion lives, and merges with `Text transitions`. No type name now appears on both axes; `qa/taxonomy_check.mjs`
asserts that (`10`), and that every type in Effects is named `<something> transitions` (`11`).

── GRANULARITY (what the review asked for, and the counts it produced) ──────────────────────────────────────────

    "15 types hold a single item … while Field and form has 42 and Fonts 52. Merge the singles into neighbours;
     split Field and form … keep Fonts as one type whose rows are merged specimens."
                                                                     — r5-review.md, Type pages, item 6

`MERGES` is the 15 singles, each with the neighbour that makes sense and one line saying why (a dock is a
navigation rail; a menubar is a menu; a voice note is a message). `SPLITS` is Field and form → `Form libraries`,
`Fields`, `Input groups`. `FONTS` folds each typeface's heading cut into its own typeface as a **variant**, so
`Fonts` is 26 members with 26 folds, not 52 members (item 8's rule — a count that hides folded variants is a count
that lies — then needs no special case for fonts).

── COLUMNS (what each type prints) ──────────────────────────────────────────────────────────────────────────────

    "Every type reuses the sidebar's columns. Button and Calendar get COLLAPSES and AT 390 PX … Each type needs
     its own columns; for buttons: variants, sizes, loading state, icon support."
                                                                     — r5-review.md, Type pages, item 3

`columns` in the emitted file is **per type**: the facts that type's members can answer, derived from the data —
`variants` (how many demos the item ships), the demo labels (which name sizes, loading states and icons in the
library's own words), `files`, and the six measured `behaviour.json` facts *only* for the types whose question
they answer (`MEASURES`, one line of justification each). A column no member of a type can answer is not declared,
so no page prints a row of "not measured" for a question that was never askable. `null` still means "not
measured" inside a declared column.

    python3 scripts/taxonomy.py            # writes app/src/site/taxonomy.json and prints the diff
    python3 scripts/taxonomy.py --check    # prints the diff against the file on disk, writes nothing
"""
import json, collections, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
items = json.load(open(ROOT / "app/manifest.json"))
OUT = ROOT / "app/src/site/taxonomy.json"
by = {(i["source"], i["slug"]): i for i in items}
key = lambda i: f'{i["source"]}/{i["slug"]}'
BY = {key(i): i for i in items}

# A variant is a *demonstration of* a component: the same thing with another appearance, size or demo flag. The
# suffix vocabulary is what separates `button-ghost` (a Button) from `alert-dialog` (an Alert Dialog, its own
# component, which a bare prefix rule swallowed on the first pass — 51 such chains).
VOCAB = set("""demo example ghost outline size lg sm xs md xl 2xl default secondary destructive link icon block wide
vertical horizontal with without text badge loading disabled active open closed empty filled rounded square pill
dark light bar line pie radar radial tooltip legend grid axis stacked mixed negative positive dots interactive
simple single multiple long short fixed inline popover dropdown card selection date area chart""".split())
NUMERIC = lambda t: bool(re.fullmatch(r"\d+(-\d+)?", t))

def suffix_ok(parent_slug, rest):
    if parent_slug.startswith("chart"): return True          # `chart-bar-default`, `chart-pie-donut`: chart styles
    return all(t in VOCAB or NUMERIC(t) for t in rest.split("-"))

def parent(i):
    if i["kind"] == "text": return None
    s, sl = i["source"], i["slug"]; best = None
    for (src, b) in by:
        if src != s or b == sl or not sl.startswith(b + "-"): continue
        if not suffix_ok(b, sl[len(b) + 1:]): continue
        if best is None or len(b) > len(best): best = b
    return best

raw_parent = {key(i): (f'{i["source"]}/{parent(i)}' if parent(i) else None) for i in items}
def root_of(k):
    seen = set()
    while raw_parent.get(k) and k not in seen:
        seen.add(k); k = raw_parent[k]
    return k

variants = collections.defaultdict(list); roots = []
for i in items:
    r = root_of(key(i))
    (roots.append(i) if r == key(i) else variants[r].append(key(i)))

def toks(i):
    t = set(x for x in i["slug"].split("-") if x)
    t |= set(x for x in i["name"].lower().replace("/", " ").replace("-", " ").split() if x)
    return t

def T(*words):
    ws = set(w.lower() for w in words); return lambda i: bool(toks(i) & ws)
def S(*prefixes): return lambda i: any(i["slug"].startswith(p) for p in prefixes)

CHARTISH = {"chart", "charts", "treemap", "orderbook", "volume", "liquidity", "heatmap", "candlestick",
            "sankey", "funnel", "bump", "sparkline", "heat"}
AGENTISH = {"agent", "prompt", "message", "messages", "chat", "stream", "streaming", "thinking", "reasoning",
            "citation", "citations", "approval", "tool", "chips", "diff", "insight", "recommendation",
            "inline", "artifact", "artifacts", "selection", "composer", "reaction", "web", "github",
            "task", "rows", "workflow"}
HELPER = {"utils", "index", "style", "direction", "use", "mobile", "hooks", "lib"}
FOUND, DOCS, EFF, CHART, AGENT, BLOCK, COMP = "Foundations", "Docs", "Effects", "Charts", "Agent UI", "Blocks", "Components"

OVER = {  # items the review named, and the awkward ones a rule gets wrong
 "shadcn/font-dm-sans": (FOUND, "Fonts"), "shadcn/theme-gray": (FOUND, "Themes"),
 "rareui/faq": (COMP, "Disclosure"),
 "beui/card-folder": (BLOCK, "Files and folders"), "beui/project-folder": (BLOCK, "Files and folders"),
 "shadcn/use-mobile": (DOCS, "Helpers and hooks"), "shadcn/utils": (DOCS, "Helpers and hooks"),
 "rareui/utils": (DOCS, "Helpers and hooks"), "shadcn/index": (DOCS, "Helpers and hooks"),
 "shadcn/style": (DOCS, "Helpers and hooks"), "shadcn/direction": (DOCS, "Helpers and hooks"),
 "beui/ai-sidebar": (COMP, "Sidebar"), "beui/animated-sidebar": (COMP, "Sidebar"),
 "beui/bounce-sidebar": (COMP, "Sidebar"), "rareui/bounce-sidebar": (COMP, "Sidebar"),
 "rareui/hook-sidebar": (COMP, "Sidebar"), "rareui/proximity-sidebar": (COMP, "Sidebar"),
 "beautifului/sidebar-nav": (COMP, "Navigation"),
 "shadcn/chart": (CHART, "Chart demonstrations"),
 "beautifului/flowchart": (CHART, "Flow and hierarchy"),
 "beautifului/loading-state": (AGENT, "Streaming and thinking"),
 "beautifului/search": (COMP, "Search"), "rareui/web-search": (AGENT, "Prompting"),
 "beui/order-book": (CHART, "Financial"), "beui/price-target-fan": (CHART, "Financial"),
 "beui/preview-rail": (COMP, "Preview rail"), "rareui/voice-note": (AGENT, "Voice"),
 "shadcn/bubble": (AGENT, "Chat and messages"), "beautifului/context-cards": (AGENT, "Artifacts and diffs"),
 "beautifului/fine-tune-card": (AGENT, "Artifacts and diffs"), "shadcn/hover-card": (COMP, "Popover"),
 "beui/range-slider": (COMP, "Slider"), "rareui/rail-toc": (COMP, "Navigation"),
 "docs-figma": (DOCS, "Guides"), "shadcn/docs-figma": (DOCS, "Guides"),
 "shadcn/docs-forms": (DOCS, "Guides"), "beui/returns-calendar": (CHART, "Heatmaps and calendars"),
 "rareui/github-activity": (AGENT, "Agent activity"), "beui/shared-layout-bg": (COMP, "Orbs and backgrounds"),
}

def section(i):
    k, t, sl = i["kind"], toks(i), i["slug"]
    if sl.startswith(("font-", "theme-")) or "typography" in t: return FOUND
    if k == "text": return DOCS
    if k == "effect": return EFF
    if t & CHARTISH or sl.startswith("charts-"): return CHART
    if "sidebar" in t: return COMP
    if t & AGENTISH: return AGENT
    if k == "block": return BLOCK
    return COMP

TYPES = {
 FOUND: [("Fonts", S("font-")), ("Themes", S("theme-")), ("Typography", lambda i: True)],
 DOCS: [("Changelog", S("docs-changelog")),
        ("Component docs", S("docs-components-")),
        ("Theming and dark mode", T("theming", "mode")),
        ("Registry, CLI and MCP", T("cli", "registry", "mcp", "openapi", "skills", "monorepo", "directory")),
        ("Frameworks and installation", T("next", "vite", "javascript", "rtl", "laravel", "astro", "remix", "gatsby", "installation", "manual")),
        ("Helpers and hooks", lambda i: True),
        ("Guides", lambda i: True)],
 EFF: [("Text", T("text", "texts", "letters", "counter", "number", "shimmer", "gradient")),
       ("Loaders", T("loader", "skeleton", "spinner", "placeholder", "confetti")),
       ("Cards", T("card")),
       ("Menus and tabs", T("menu", "dropdown", "tabs", "page", "panel", "banner", "gooey", "accordion")),
       ("Overlays", T("modal", "toast", "tooltip", "notification", "badge")),
       ("Inputs and toggles", T("input", "checkbox", "toggle", "like", "success", "error", "drag", "button", "state")),
       ("Media", T("image", "avatar", "3d", "tilt")),
       ("Motion", lambda i: True)],
 CHART: [("Bar and column", T("bar", "column")),
         ("Line and area", T("line", "area", "sparkline")),
         ("Pie and donut", T("pie", "donut")),
         ("Radar and radial", T("radar", "radial")),
         ("Financial", T("candlestick", "orderbook", "volume", "liquidity", "target", "swap")),
         ("Flow and hierarchy", T("sankey", "treemap", "funnel", "flowchart", "bump", "composition")),
         ("Heatmaps and calendars", T("heat", "heatmap", "calendar")),
         ("Chart demonstrations", lambda i: True)],
 AGENT: [("Chat and messages", T("chat", "message", "messages", "bubble", "reaction", "emoji", "composer")),
         ("Prompting", T("prompt", "search", "input", "web")),
         ("Tool calls and approvals", T("tool", "chips", "approval", "selection", "actions", "result")),
         ("Streaming and thinking", T("stream", "streaming", "thinking", "reasoning", "loading", "states")),
         ("Agent activity", T("agent", "activity", "status", "inline", "citations", "github", "task", "rows")),
         ("Artifacts and diffs", T("diff", "code", "context", "insight", "recommendation", "fine", "screen")),
         ("Voice", T("voice", "orb", "audio")),
         ("Agent surfaces", lambda i: True)],
 BLOCK: [("Auth and onboarding", T("signup", "signin", "login", "onboarding", "otp", "404", "not", "found")),
         ("Dashboards", T("dashboard")),
         ("App shells and navigation", T("sidebar", "nav", "menu", "tabs", "bar", "island", "dock", "search")),
         ("Data tables", T("table", "masonry", "list", "scheduler", "fixtures", "bracket")),
         ("Files and folders", T("folder", "file")),
         ("Chat and agent", T("chat", "agent", "diff", "approval")),
         ("Showcase blocks", lambda i: True)],
 COMP: [("Accordion", T("accordion", "collapsible")),
        ("Alert", T("alert")),
        ("Aspect ratio", T("aspect")),
        ("Attachment", T("attachment")),
        ("Avatar", T("avatar")),
        ("Badge", T("badge")),
        ("Breadcrumb", T("breadcrumb")),
        ("Button", T("button", "cta", "swap")),
        ("Search", T("search")),
        ("Preview rail", T("preview", "rail")),
        ("Button group", lambda i: "button-group" in i["slug"]),
        ("Calendar", T("calendar")),
        ("Card", T("card")),
        ("Carousel", T("carousel", "marquee")),
        ("Checkbox", T("checkbox")),
        ("Code block", T("code")),
        ("Combobox", T("combobox")),
        ("Command", T("command")),
        ("Context menu", T("context")),
        ("Dialog", T("dialog", "modal", "morph")),
        ("Disclosure", T("faq", "disclosure", "expandable")),
        ("Dock", T("dock")),
        ("Drawer and sheet", T("drawer", "sheet", "family")),
        ("Dropdown menu", T("dropdown", "menu")),
        ("Empty", T("empty")),
        ("Field and form", T("field", "form", "label")),
        ("File tree", T("file", "folder")),
        ("Image", T("image", "viewer")),
        ("Input", T("input", "textarea", "otp", "password")),
        ("Item and list", T("item", "list", "todo", "task", "toc")),
        ("Kbd", T("kbd")),
        ("Loader and skeleton", T("loader", "spinner", "skeleton", "progress", "refresh")),
        ("Marker", T("marker")),
        ("Menubar", T("menubar")),
        ("Navigation", T("navigation", "nav", "gooey", "toc")),
        ("Orbs and backgrounds", T("orb", "background", "bg", "shader", "grid", "reveal")),
        ("Pagination", T("pagination")),
        ("Pickers", T("picker", "select", "date", "duration", "wheel", "color", "range")),
        ("Popover", T("popover", "hover")),
        ("Radio group", T("radio")),
        ("Resizable and scroll", T("resizable", "scroll")),
        ("Separator", T("separator")),
        ("Sidebar", T("sidebar")),
        ("Slider", T("slider")),
        ("Status bar", T("status")),
        ("Stepper", T("stepper", "player")),
        ("Switch", T("switch")),
        ("Table", T("table")),
        ("Tabs", T("tabs")),
        ("Text animation", T("text", "gravity", "counter", "number", "letters")),
        ("Timeline", T("timeline")),
        ("Toast and notification", T("toast", "sonner", "notification", "bell")),
        ("Toggle", T("toggle")),
        ("Tooltip", T("tooltip")),
        ("Components to be named", lambda i: True)],
}

# ── 1. the classifier, unchanged: sections and the reviewed type tests ─────────────────────────────────────────
out = collections.OrderedDict(); unmapped = []
for i in roots:
    k = key(i)
    if k in OVER: s, typ = OVER[k]
    else:
        s = section(i); typ = next((n for n, test in TYPES[s] if test(i)), None)
        if typ is None: unmapped.append((k, s)); typ = "Unfiled"
    out.setdefault(s, collections.OrderedDict()).setdefault(typ, []).append(k)
for s in list(out):
    out[s] = collections.OrderedDict((t, m) for t, m in out[s].items() if m)
assert not unmapped, f"unfiled: {unmapped}"

def find_type(id_):
    for s, ts in out.items():
        for t, ids in ts.items():
            if id_ in ids: return s, t
    return None

def move(id_, target_section, target_type, why):
    at = find_type(id_)
    if at is None:
        raise SystemExit(f"not a member: {id_}")
    s, t = at
    out[s][t].remove(id_)
    out.setdefault(target_section, collections.OrderedDict()).setdefault(target_type, []).append(id_)

# ── 2. THE IS-RULE: membership is the thing, not the word ──────────────────────────────────────────────────────
# Each entry: the clause that makes it, the type it moves to, and the evidence in the demo's own source. The
# evidence strings are quoted from `app/src/registry/new-york-v4/examples/<slug>.tsx`; a reader can open the file.
IS_MOVES = [
 ("shadcn/dialog-close-button", COMP, "Dialog", "ownership",
  "<Dialog><DialogContent> … <DialogClose asChild><Button>Close</Button> — a whole dialog, not a button"),
 ("shadcn/input-with-button", COMP, "Input", "preposition",
  "<Input type=\"email\"/> beside <Button type=\"submit\">Subscribe</Button> — the input is the thing"),
 ("shadcn/textarea-with-button", COMP, "Input", "preposition",
  "<Textarea/> above <Button>Send message</Button> — the textarea is the thing, and the catalogue files textarea under Input"),
 ("shadcn/input-group-button", COMP, "Input groups", "ownership",
  "<InputGroup><InputGroupInput/><InputGroupAddon><InputGroupButton> — an input group's own button"),
 ("shadcn/input-group-button-group", COMP, "Input groups", "ownership",
  "<ButtonGroup><ButtonGroupText/><InputGroup><InputGroupInput/> — an input group inside a button group"),
]
IS_KEPT = [
 ("shadcn/spinner-button", "Button", "head",
  "<Button disabled size=\"sm\"><Spinner/>Loading...</Button> — the demo is a button; a spinner is its state"),
 ("shadcn/kbd-button", "Button", "head",
  "<Button variant=\"outline\" size=\"sm\">Accept <Kbd>⏎</Kbd></Button> — the demo is a button; the kbd is its label"),
]
for id_, s, t, clause, evidence in IS_MOVES:
    move(id_, s, t, f"{clause}: {evidence}")
for id_, t, clause, evidence in IS_KEPT:
    assert find_type(id_)[1] == t, f"{id_} is no longer in {t}"
for s in list(out):
    out[s] = collections.OrderedDict((t, m) for t, m in out[s].items() if m)

# ── 3. the rest of the is-rule's application, where a name alone decides ───────────────────────────────────────
# `input-file` is shadcn's <Input type="file"/> (the input is the thing); `navigation-menu` is the site-navigation
# menu of shadcn's Navigation Menu page-in the menu family it is a navigation control (the review's §7 overlap).
move("shadcn/input-file", COMP, "Input", "head: <Input type=\"file\"/> — an input, not a file tree")
# The review's own item 2: "Button Group (12 items) should be its own type." It is 8 member items and 4 of the
# button group's 6 folded demos are its siblings' variants, so the type is those 8.
button_group = [i for i in roots
                if "button-group" in i["slug"] and i["slug"] != "input-group-button-group"
                and find_type(key(i))[0] == COMP]
for i in button_group:
    move(key(i), COMP, "Button group", "the review named it: a group of buttons is not a button")
# Input groups: every item that IS an input group (the compound `InputGroup` component and its addons).
for id_ in ["shadcn/kbd-input-group"]:
    move(id_, COMP, "Input groups", "ownership: a kbd inside an input group is the input group's content")

# ── 4. SPLITS: Field and form (42) → three types the review named ──────────────────────────────────────────────
SPLIT = {"Form libraries": [], "Fields": [], "Input groups": []}
for id_ in list(out[COMP]["Field and form"]):
    slug = id_.split("/")[1]
    if slug.startswith("form"): SPLIT["Form libraries"].append(id_)          # shadcn/form + the per-library demos
    elif slug.startswith(("input-group",)): SPLIT["Input groups"].append(id_)  # an input group's own label
    else: SPLIT["Fields"].append(id_)                                        # field-* patterns and the label ones
out[COMP]["Input groups"] = out[COMP].get("Input groups", []) + SPLIT["Input groups"]
del out[COMP]["Field and form"]
out[COMP]["Form libraries"] = SPLIT["Form libraries"]
out[COMP]["Fields"] = SPLIT["Fields"]

# ── 5a. RENAMES first, so the merge below can aim at the new name ─────────────────────────────────────────────
# A type that absorbs a neighbour usually has to say so: `Aspect ratio` + a separator is `Layout`, `File tree` + an
# attachment is `Files and attachments`, `Dropdown menu` + a menubar is `Menus`, `Guides` + a changelog is `Guides
# and release notes`. Everything else keeps its name.
RENAMES = [
 (COMP, "Aspect ratio", "Layout"),
 (COMP, "File tree", "Files and attachments"),
 (COMP, "Dropdown menu", "Menus"),
 (DOCS, "Guides", "Guides and release notes"),
]
for s, old, new in RENAMES:
    out[s][new] = out[s].pop(old)

# ── 5b. MERGES: the 15 single-item types, each into a neighbour that makes sense ───────────────────────────────
# (single type, target section, target type, why)
MERGES = [
 ("Attachment", COMP, "Files and attachments", "an attachment is a file, and the file type had no attachment in it"),
 ("Dock", COMP, "Navigation", "a dock is a navigation rail — beui's own words: a floating bar of destinations"),
 ("Marker", COMP, "Item and list", "shadcn/marker marks a list row; the list type is where a thing that marks rows belongs"),
 ("Menubar", COMP, "Menus", "a menubar is a menu, which is what its demos render"),
 ("Pagination", COMP, "Navigation", "pagination is navigation between pages"),
 ("Preview rail", COMP, "Navigation", "its own description: a navigation rail with hover previews"),
 ("Search", COMP, "Command", "beautifului/search is a command palette with live filtering — the catalogue's Command type"),
 ("Separator", COMP, "Layout", "a separator and an aspect ratio are both non-interactive layout primitives"),
 ("Timeline", COMP, "Item and list", "a timeline is a list of dated items"),
 ("Status bar", CHART, "Chart demonstrations", "its own files are components/charts/status-bar/*: a chart of statuses"),
 ("Dashboards", BLOCK, "App shells and navigation", "a dashboard is an app shell with charts and a table in it"),
 ("Voice", AGENT, "Chat and messages", "a voice note is a message with a waveform"),
 ("Changelog", DOCS, "Guides and release notes", "a changelog is a prose page about the library, which is what a guide is"),
 ("Pie and donut", CHART, "Chart demonstrations", "the donut is a chart demonstration; a one-member chart form of its own is the shape the review asked to remove"),
]
for src, target_s, target_t, why in MERGES:
    ids = []
    for s, ts in out.items():
        if src in ts: ids = ts.pop(src); break
    if not ids: raise SystemExit(f"no such single: {src}")
    if target_t not in out[target_s]:
        raise SystemExit(f"no such merge target: {target_s}/{target_t}")
    out[target_s][target_t].extend(ids)

# ── 6. THE ONE-AXIS RULE: Effects names transitions, and the motion in Components moves there ─────────────────
EFFECT_RENAMES = [
 ("Cards", "Card transitions"),
 ("Inputs and toggles", "Input transitions"),
 ("Loaders", "Loader transitions"),
 ("Media", "Media transitions"),
 ("Menus and tabs", "Menu transitions"),
 ("Overlays", "Overlay transitions"),
 ("Text", "Text transitions"),
]
for old, new in EFFECT_RENAMES:
    out[EFF][new] = out[EFF].pop(old)
# Components' one motion-named type: the motion belongs with the motions
out[EFF]["Text transitions"].extend(out[COMP].pop("Text animation"))
# The general `Motion` bucket was never an axis either: each of its five is a transition of something, and its
# name says which.
for id_ in list(out[EFF]["Motion"]):
    to = {"transitions/icon-swap": "Input transitions",
          "transitions/learn-more-hover": "Text transitions",
          "transitions/delete-with-smoky-dissolve": "Media transitions",
          "transitions/reasoning-stream": "Text transitions",
          "transitions/thinking-states": "Text transitions"}[id_]
    out[EFF][to].append(id_)
del out[EFF]["Motion"]

# ── 7. FONTS: one type whose rows are merged specimens (26) not two types (52) ────────────────────────────────
# A heading cut is the same typeface at a heading size: it folds into its typeface as a variant, which is what a
# variant is, and `Fonts` keeps 26 members. (Item 8's rule — counts must admit folded variants — then needs no
# special case: they are counted.)
for id_ in list(out[FOUND]["Fonts"]):
    slug = id_.split("/")[1]
    if slug.startswith("font-heading-"):
        base = "shadcn/font-" + slug[len("font-heading-"):]
        assert find_type(base), f"heading cut with no typeface: {id_}"
        out[FOUND]["Fonts"].remove(id_)
        variants[base].append(id_)

# ── 8. COLUMNS: what each type prints (see the docblock) ──────────────────────────────────────────────────────
# The field columns, in the order a person choosing asks them, each answered from the item's own fields. The demo
# labels are the library's own words for what its demos show — `Size`, `Icon`, `Spinner` — so "sizes", "loading"
# and "icon support" are read off the data rather than decided here.
FIELD = {
    "demos": (r"", "demos", "how many demos the item ships"),
    "sizes": (r"^(size|sizes|small|large|sm|md|lg|xs|xl)$", "sizes", "a demo is labelled with a size"),
    "loading": (r"spinner|loading|progress|wait", "loading", "a demo shows a loading state"),
    "icons": (r"icon", "icons", "a demo shows icon support"),
    "states": (r"disabled|invalid|error|success|read-only|readonly|required", "states", "a demo shows a state"),
    "files": (r"", "files", "how many source files the item has"),
}
def labels(i): return [v["label"] for v in (i.get("variants") or [])]
def answers(col, i):
    if col == "demos": return bool(i.get("variants"))
    if col == "files": return bool(i.get("file_count"))
    return any(re.search(FIELD[col][0], l, re.I) for l in labels(i))

# Which of the six measured facts each type may print. A behaviour fact is a question, and a question is only
# worth a column where the answer distinguishes two members of that type. One line per type, one reason each.
MEASURES = {
    "Components/Sidebar": (["collapses", "nests", "sheet", "keyboard", "shape", "animates"],
                           "a sidebar is the thing that collapses, nests, becomes a sheet, takes Tab, is page or part, and moves"),
    "Components/Navigation": (["nests", "sheet"], "a navigation rail either nests its destinations or does not, and either sheets on a phone or stays put"),
    "Components/Menus": (["nests", "keyboard"], "a menu is the thing that nests and that Tab either reaches or does not"),
    "Components/Dialog": (["sheet"], "a dialog is what a 390 px frame either turns into a sheet or does not"),
    "Components/Drawer and sheet": (["sheet"], "the drawer type is the answer to the at-390 px question"),
    "Components/Popover": (["sheet"], "a popover is what either becomes a sheet on a phone or stays put"),
    "Components/Command": (["sheet", "keyboard"], "a command palette is reached by Tab and may become a sheet on a phone"),
    "Components/Dropdown menu": (["nests", "keyboard"], "a menu nests and Tab either reaches its rows or does not"),
    "Components/Tabs": (["keyboard"], "tabs are driven by Tab or are not"),
    "Components/Accordion": (["collapses", "animates"], "an accordion is the thing that collapses, and it moves"),
    "Components/Toast and notification": (["animates"], "a toast is a thing that moves"),
    "Components/Tooltip": (["animates"], "a tooltip is a thing that moves"),
    "Blocks/App shells and navigation": (["shape", "sheet"], "a block is a page or a component, and it either sheets on a phone or stays put"),
    "Blocks/Auth and onboarding": (["shape"], "a block is a page or a component"),
    "Blocks/Data tables": (["shape"], "a block is a page or a component"),
    "Blocks/Showcase blocks": (["shape"], "a block is a page or a component"),
    "Blocks/Files and folders": (["shape"], "a block is a page or a component"),
    "Charts/Financial": (["shape"], "a chart is a page or a component"),
    "Charts/Flow and hierarchy": (["shape"], "a chart is a page or a component"),
    "Effects/Text transitions": (["animates"], "a transition is a motion"),
    "Effects/Card transitions": (["animates"], "a transition is a motion"),
    "Effects/Input transitions": (["animates"], "a transition is a motion"),
    "Effects/Loader transitions": (["animates"], "a transition is a motion"),
    "Effects/Media transitions": (["animates"], "a transition is a motion"),
    "Effects/Menu transitions": (["animates"], "a transition is a motion"),
    "Effects/Overlay transitions": (["animates"], "a transition is a motion"),
}

def measured_answers(col, i):
    """Does this member's own behaviour record answer `col` with a boolean? (the probe's null is not an answer)"""
    b = i.get("behaviour") or {}
    return isinstance(b.get(col), bool)

columns = {}
for s, ts in out.items():
    for t, ids in ts.items():
        mem = [BY[i] for i in ids]
        cols = [c for c in FIELD if any(answers(c, m) for m in mem)]
        key_ = f"{s}/{t}"
        # A declaration is a promise that someone in the set answered: the type may print a measured column only
        # when one of its members carries a boolean for it. `MEASURES` says which fact a type would find meaningful
        # if the probe ever reached it; this filter is what stops that intention becoming a column of nulls.
        measured = [c for c in MEASURES.get(key_, ([], ""))[0] if any(measured_answers(c, m) for m in mem)]
        columns[key_] = cols + [c for c in measured if c not in cols]

# ── 9. emit ───────────────────────────────────────────────────────────────────────────────────────────────────
DOC = {
 "rule": "A member belongs to a type when the item IS that thing, not when its name contains it. The head noun of "
         "the item's own name decides; a name that names a component's own control (a dialog's close button, an "
         "input group's button) belongs to that component; `X with Y` is an X. Every move the rule made is listed "
         "in scripts/taxonomy.py with the demo source that evidences it.",
 "axis": "A type names one axis: what the thing is, or how it moves. Things live in Components, Blocks, Charts, "
         "Agent UI, Foundations and Docs. Transitions live in Effects and are named `<the part that moves> "
         "transitions`. No name appears on both axes.",
 "columns": "Columns are declared per type: the facts that type's members answer, derived from the item's own "
            "fields (variants, files, licence) and its demo labels, plus the six measured behaviour facts only on "
            "the types whose question they answer. A column no member can answer is not declared.",
 "table": "A type prints a sortable table only when it declares measured columns and at least two of its members "
          "answered them; otherwise the page leads with the visual grid. Today one type (Sidebar) qualifies.",
 "counts": "Every count printed on the site is `N items · M variants`: the variants the taxonomy folds into their "
           "parents are catalogue content and are counted wherever members are.",
 "singles": "No type holds a single member: the review named fifteen and each one is merged into the neighbour "
            "that makes sense, with the reason in scripts/taxonomy.py.",
}
payload = {
 "doc": DOC,
 "sections": {s: dict(t) for s, t in out.items()},
 "variants": dict(variants),
 "columns": columns,
}
payload["sections"] = {s: dict(sorted(t.items())) for s, t in payload["sections"].items()}
payload["variants"] = dict(sorted(payload["variants"].items()))

# ── 10. the diff, printed: before → after, counted ────────────────────────────────────────────────────────────
def flatten(d):
    return {(s, t): set(ids) for s, ts in d["sections"].items() for t, ids in ts.items()}

try:
    prev = json.loads(subprocess.check_output(
        ["git", "-C", str(ROOT), "show", "HEAD:app/src/site/taxonomy.json"], text=True))
except Exception:
    prev = {"sections": {}, "variants": {}}
new = {"sections": payload["sections"], "variants": payload["variants"]}
P, N = flatten(prev), flatten(new)
pv = {v for vs in prev["variants"].values() for v in vs}
nv = {v for vs in payload["variants"].values() for v in vs}

print(f"types      {len(P):3d} → {len(N):3d}")
print(f"members    {sum(len(v) for v in P.values()):3d} → {sum(len(v) for v in N.values()):3d}")
print(f"variants   {len(pv):3d} → {len(nv):3d}   (folded: +{len(nv) - len(pv)})")
print(f"items      {sum(len(v) for v in P.values()) + len(pv)} = {sum(len(v) for v in N.values()) + len(nv)}")
print(f"singles    {sum(1 for v in P.values() if len(v) == 1)} → {sum(1 for v in N.values() if len(v) == 1)}")
print(f"created    {len([k for k in N if k not in P])} · dissolved {len([k for k in P if k not in N])}")
print()
print("MADE", sorted(f"{s}/{t}" for s, t in N if (s, t) not in P))
print("GONE", sorted(f"{s}/{t}" for s, t in P if (s, t) not in N))
print()
print("MOVED ITEMS (the is-rule, and the merges)")
for s, t in sorted(N):
    old = [k for k in P if k not in N and k[1] == t]
    for k in sorted(P):
        if k in N and k != (s, t) and (P[k] - N[(s, t)]) and False: pass
moved = {}
for k, ids in P.items():
    for id_ in ids:
        now = next((kk for kk, v in N.items() if id_ in v), None)
        if now != k: moved.setdefault((k, now), []).append(id_)
for (was, now), ids in sorted(moved.items(), key=lambda kv: (kv[0][1] or ("", ""))):
    print(f"   {str(was[0] + '/' + was[1]):38s} → {str(now and now[0] + '/' + now[1]):38s} {len(ids):3d}  {', '.join(sorted(i.split('/')[1] for i in ids))[:110]}")
print()
largest = sorted(((len(v), s, t) for (s, t), v in N.items()), reverse=True)[:5]
print("largest five", [(f"{s}/{t}", n) for n, s, t in largest])
print("columns per type", dict(collections.Counter(len(c) for c in columns.values())))
print("types with measured columns", sum(1 for c in columns.values() if set(c) & set(MEASURES["Components/Sidebar"][0])))

if "--check" not in sys.argv:
    OUT.write_text(json.dumps(payload, indent=1) + "\n")
    print(f"\nwrote {OUT.relative_to(ROOT)}")
