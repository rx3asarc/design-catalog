import json, collections, re

items = json.load(open("/root/design-catalog-site/app/manifest.json"))
by = {(i["source"], i["slug"]): i for i in items}
key = lambda i: f'{i["source"]}/{i["slug"]}'

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
n = sum(len(v) for v in out.values())
print(f"roots {len(roots)}  folded {len(items)-len(roots)}  types {n}")
for s, ts in out.items():
    print(f"\n## {s} — {len(ts)} types, {sum(len(m) for m in ts.values())} members")
    for t, mem in sorted(ts.items()):
        print(f"   {t:30s} {len(mem):3d}  {', '.join(m.split('/')[1] for m in mem[:8])}")
print("\nUNMAPPED", unmapped)
json.dump({"sections": {s: dict(t) for s, t in out.items()}, "variants": dict(variants)},
          open("/tmp/tax/draft.json", "w"), indent=1)
