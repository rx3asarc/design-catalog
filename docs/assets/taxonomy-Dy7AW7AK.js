var e=`{
 "doc": {
  "rule": "A member belongs to a type when the item IS that thing, not when its name contains it. The head noun of the item's own name decides; a name that names a component's own control (a dialog's close button, an input group's button) belongs to that component; \`X with Y\` is an X. Every move the rule made is listed in scripts/taxonomy.py with the demo source that evidences it.",
  "axis": "A type names one axis: what the thing is, or how it moves. Things live in Components, Blocks, Charts, Agent UI, Foundations and Docs. Transitions live in Effects and are named \`<the part that moves> transitions\`. No name appears on both axes.",
  "columns": "Columns are declared per type: the facts that type's members answer, derived from the item's own fields (variants, files, licence) and its demo labels, plus the six measured behaviour facts only on the types whose question they answer. A column no member can answer is not declared.",
  "table": "A type prints a sortable table only when it declares measured columns and at least two of its members answered them; otherwise the page leads with the visual grid. Today one type (Sidebar) qualifies.",
  "counts": "Every count printed on the site is \`N items \\u00b7 M variants\`: the variants the taxonomy folds into their parents are catalogue content and are counted wherever members are.",
  "singles": "No type holds a single member: the review named fifteen and each one is merged into the neighbour that makes sense, with the reason in scripts/taxonomy.py."
 },
 "sections": {
  "Agent UI": {
   "Agent activity": [
    "beautifului/agent-screen",
    "beautifului/task-rows",
    "beui/agent-activity",
    "beui/citations",
    "rareui/ai-status",
    "rareui/github-activity",
    "rareui/task-list"
   ],
   "Artifacts and diffs": [
    "beautifului/diff-table",
    "beautifului/context-cards",
    "beautifului/fine-tune-card",
    "beautifului/insight-cards",
    "beautifului/recommendation-card",
    "beui/file-diff"
   ],
   "Chat and messages": [
    "beautifului/chat-composer",
    "beui/chat-app",
    "beui/message",
    "beui/message-bubble",
    "beui/message-scroller",
    "rareui/emoji-reaction",
    "shadcn/bubble",
    "shadcn/message",
    "shadcn/message-scroller",
    "rareui/voice-note"
   ],
   "Prompting": [
    "beautifului/prompt-bar",
    "beui/prompt-input",
    "rareui/web-search"
   ],
   "Streaming and thinking": [
    "beautifului/loading-state",
    "beautifului/streaming-text",
    "beautifului/thinking-state",
    "beui/loading-states",
    "beui/streaming-response"
   ],
   "Tool calls and approvals": [
    "beautifului/approval-card",
    "beautifului/selection-actions",
    "beautifului/tool-chips",
    "beui/approval-card",
    "beui/tool-approval",
    "beui/tool-result"
   ]
  },
  "Blocks": {
   "App shells and navigation": [
    "beui/bloom-menu",
    "beui/dynamic-island",
    "beui/expandable-action-bar",
    "beui/expandable-tabs",
    "beui/morphing-search",
    "beui/morphing-tabs",
    "shadcn/dashboard-01"
   ],
   "Auth and onboarding": [
    "beui/not-found",
    "beui/otp-input",
    "beui/signup-form",
    "shadcn/login-01",
    "shadcn/login-02",
    "shadcn/login-03",
    "shadcn/login-04",
    "shadcn/login-05",
    "shadcn/signup-01",
    "shadcn/signup-02",
    "shadcn/signup-03",
    "shadcn/signup-04",
    "shadcn/signup-05"
   ],
   "Data tables": [
    "beautifului/filter-table",
    "beautifului/records-table",
    "beui/availability-scheduler",
    "beui/infinite-masonry",
    "beui/knockout-bracket",
    "beui/swipeable-list"
   ],
   "Files and folders": [
    "beui/card-folder",
    "beui/file-upload",
    "beui/project-folder"
   ],
   "Showcase blocks": [
    "beui/card-dealer",
    "beui/command-palette",
    "beui/feedback-widget",
    "beui/notification-stack",
    "beui/overflow-actions",
    "beui/prediction-market",
    "beui/swap",
    "beui/wallet-card"
   ]
  },
  "Components": {
   "Accordion": [
    "beui/bouncy-accordion",
    "beui/collapsible",
    "shadcn/accordion",
    "shadcn/collapsible"
   ],
   "Alert": [
    "beui/alert",
    "shadcn/alert",
    "shadcn/alert-dialog"
   ],
   "Avatar": [
    "shadcn/avatar",
    "shadcn/empty-avatar",
    "shadcn/empty-avatar-group",
    "shadcn/item-avatar"
   ],
   "Badge": [
    "beui/animated-badge",
    "shadcn/badge"
   ],
   "Breadcrumb": [
    "beui/breadcrumb",
    "shadcn/breadcrumb",
    "shadcn/breadcrumb-ellipsis",
    "shadcn/breadcrumb-responsive",
    "shadcn/breadcrumb-separator"
   ],
   "Button": [
    "beui/action-swap",
    "beui/button",
    "beui/expanding-arrow-button",
    "rareui/delete-button",
    "shadcn/button",
    "shadcn/button-as-child",
    "shadcn/kbd-button",
    "shadcn/spinner-button"
   ],
   "Button group": [
    "shadcn/button-group",
    "shadcn/button-group-input",
    "shadcn/button-group-input-group",
    "shadcn/button-group-nested",
    "shadcn/button-group-orientation",
    "shadcn/button-group-select",
    "shadcn/button-group-separator",
    "shadcn/button-group-split"
   ],
   "Calendar": [
    "shadcn/calendar",
    "shadcn/calendar-hijri"
   ],
   "Card": [
    "beui/card",
    "beui/tilt-card",
    "shadcn/card",
    "shadcn/card-with-form",
    "shadcn/field-choice-card"
   ],
   "Carousel": [
    "beui/cylinder-carousel",
    "beui/marquee",
    "shadcn/carousel",
    "shadcn/carousel-api",
    "shadcn/carousel-orientation",
    "shadcn/carousel-plugin",
    "shadcn/carousel-spacing"
   ],
   "Checkbox": [
    "beui/checkbox",
    "shadcn/checkbox",
    "shadcn/field-checkbox",
    "shadcn/form-formisch-checkbox",
    "shadcn/form-rhf-checkbox",
    "shadcn/form-tanstack-checkbox"
   ],
   "Code block": [
    "beautifului/code-block",
    "beui/code-block",
    "rareui/code-block"
   ],
   "Combobox": [
    "beui/combobox",
    "shadcn/combobox",
    "shadcn/combobox-dropdown-menu",
    "shadcn/combobox-responsive"
   ],
   "Command": [
    "shadcn/command",
    "shadcn/command-dialog",
    "beautifului/search"
   ],
   "Context menu": [
    "beui/context-menu",
    "shadcn/context-menu"
   ],
   "Dialog": [
    "beui/center-morph-modal",
    "beui/morphing-modal",
    "shadcn/dialog",
    "shadcn/drawer-dialog",
    "shadcn/dropdown-menu-dialog",
    "shadcn/dialog-close-button"
   ],
   "Disclosure": [
    "beui/expandable-control",
    "rareui/faq"
   ],
   "Drawer and sheet": [
    "beui/bottom-sheet",
    "beui/drawer",
    "rareui/family-drawer",
    "shadcn/drawer",
    "shadcn/sheet",
    "shadcn/sheet-side"
   ],
   "Empty": [
    "shadcn/empty",
    "shadcn/empty-background",
    "shadcn/empty-input-group"
   ],
   "Fields": [
    "shadcn/field",
    "shadcn/label",
    "shadcn/field-fieldset",
    "shadcn/field-group",
    "shadcn/field-input",
    "shadcn/field-radio",
    "shadcn/field-responsive",
    "shadcn/field-select",
    "shadcn/field-slider",
    "shadcn/field-switch",
    "shadcn/field-textarea",
    "shadcn/input-with-label",
    "shadcn/textarea-with-label"
   ],
   "Files and attachments": [
    "beui/file-tree",
    "rareui/folder-component",
    "shadcn/attachment"
   ],
   "Form libraries": [
    "shadcn/form",
    "shadcn/form-formisch-array",
    "shadcn/form-formisch-complex",
    "shadcn/form-formisch-demo",
    "shadcn/form-formisch-input",
    "shadcn/form-formisch-radiogroup",
    "shadcn/form-formisch-select",
    "shadcn/form-formisch-switch",
    "shadcn/form-formisch-textarea",
    "shadcn/form-next-complex",
    "shadcn/form-next-demo",
    "shadcn/form-rhf-array",
    "shadcn/form-rhf-complex",
    "shadcn/form-rhf-demo",
    "shadcn/form-rhf-input",
    "shadcn/form-rhf-password",
    "shadcn/form-rhf-radiogroup",
    "shadcn/form-rhf-select",
    "shadcn/form-rhf-switch",
    "shadcn/form-rhf-textarea",
    "shadcn/form-tanstack-array",
    "shadcn/form-tanstack-complex",
    "shadcn/form-tanstack-demo",
    "shadcn/form-tanstack-input",
    "shadcn/form-tanstack-radiogroup",
    "shadcn/form-tanstack-select",
    "shadcn/form-tanstack-switch",
    "shadcn/form-tanstack-textarea"
   ],
   "Image": [
    "beui/image-generation",
    "beui/image-viewer",
    "shadcn/item-image"
   ],
   "Input": [
    "beui/input",
    "rareui/otp-input",
    "rareui/password-input",
    "shadcn/input",
    "shadcn/input-group",
    "shadcn/input-otp",
    "shadcn/textarea",
    "shadcn/input-group-custom",
    "shadcn/input-group-spinner",
    "shadcn/input-group-textarea",
    "shadcn/input-otp-controlled",
    "shadcn/input-otp-pattern",
    "shadcn/input-otp-separator",
    "shadcn/spinner-input-group",
    "shadcn/input-with-button",
    "shadcn/textarea-with-button",
    "shadcn/input-file"
   ],
   "Input groups": [
    "shadcn/input-group-button",
    "shadcn/input-group-button-group",
    "shadcn/kbd-input-group",
    "shadcn/input-group-label"
   ],
   "Item and list": [
    "beui/sortable-stack",
    "beui/todo-list",
    "shadcn/item",
    "shadcn/item-group",
    "shadcn/item-header",
    "shadcn/item-variant",
    "shadcn/spinner-item",
    "shadcn/marker",
    "beui/timeline"
   ],
   "Kbd": [
    "shadcn/kbd",
    "shadcn/kbd-group"
   ],
   "Layout": [
    "beui/aspect-ratio",
    "shadcn/aspect-ratio",
    "shadcn/separator"
   ],
   "Loader and skeleton": [
    "beui/loader",
    "beui/pull-to-refresh",
    "rareui/scroll-progress",
    "shadcn/progress",
    "shadcn/skeleton",
    "shadcn/spinner",
    "shadcn/spinner-basic",
    "shadcn/spinner-color",
    "shadcn/spinner-custom"
   ],
   "Menus": [
    "shadcn/dropdown-menu",
    "shadcn/navigation-menu",
    "shadcn/dropdown-menu-checkboxes",
    "shadcn/dropdown-menu-radio-group",
    "shadcn/menubar"
   ],
   "Navigation": [
    "beautifului/sidebar-nav",
    "rareui/gooey-nav",
    "rareui/rail-toc",
    "beui/dock",
    "shadcn/pagination",
    "beui/preview-rail"
   ],
   "Orbs and backgrounds": [
    "beui/shader-background",
    "beui/shared-layout-bg",
    "beui/voice-orb",
    "rareui/fluid-orb",
    "rareui/grid-reveal",
    "rareui/matrix-orb"
   ],
   "Pickers": [
    "beui/arc-picker",
    "beui/color-picker",
    "beui/color-selector",
    "beui/date-range-picker",
    "beui/multi-select",
    "beui/select",
    "beui/wheel-picker",
    "rareui/duration-picker",
    "shadcn/native-select",
    "shadcn/select",
    "shadcn/date-picker-demo",
    "shadcn/date-picker-with-presets",
    "shadcn/date-picker-with-range",
    "shadcn/native-select-groups",
    "shadcn/native-select-invalid",
    "shadcn/select-scrollable"
   ],
   "Popover": [
    "beui/popover",
    "shadcn/hover-card",
    "shadcn/popover"
   ],
   "Radio group": [
    "beui/radio",
    "shadcn/radio-group"
   ],
   "Resizable and scroll": [
    "beui/scroll-animation",
    "shadcn/resizable",
    "shadcn/scroll-area",
    "shadcn/resizable-demo-with-handle",
    "shadcn/resizable-handle"
   ],
   "Sidebar": [
    "beui/ai-sidebar",
    "beui/animated-sidebar",
    "beui/bounce-sidebar",
    "rareui/bounce-sidebar",
    "rareui/hook-sidebar",
    "rareui/proximity-sidebar",
    "shadcn/sidebar"
   ],
   "Slider": [
    "beui/range-slider",
    "shadcn/slider"
   ],
   "Stepper": [
    "beui/adaptive-stepper",
    "rareui/step-player"
   ],
   "Switch": [
    "beui/switch",
    "shadcn/switch"
   ],
   "Table": [
    "beui/table",
    "shadcn/table",
    "shadcn/data-table-demo"
   ],
   "Tabs": [
    "beui/tabs",
    "shadcn/tabs"
   ],
   "Toast and notification": [
    "beui/animated-toast-stack",
    "rareui/notification-bell",
    "shadcn/sonner",
    "shadcn/sonner-types"
   ],
   "Toggle": [
    "shadcn/toggle",
    "shadcn/toggle-group",
    "shadcn/mode-toggle",
    "shadcn/toggle-group-spacing"
   ],
   "Tooltip": [
    "beui/tooltip",
    "shadcn/tooltip"
   ]
  },
  "Charts": {
   "Chart demonstrations": [
    "shadcn/chart",
    "beui/status-bar",
    "beui/donut-chart"
   ],
   "Financial": [
    "beui/candlestick-chart",
    "beui/liquidity-heatmap",
    "beui/order-book",
    "beui/price-target-fan",
    "beui/volume-profile"
   ],
   "Flow and hierarchy": [
    "beautifului/flowchart",
    "beui/bump-chart",
    "beui/composition-chart",
    "beui/funnel-chart",
    "beui/sankey-chart",
    "beui/treemap"
   ],
   "Heatmaps and calendars": [
    "beui/heat-calendar",
    "beui/returns-calendar"
   ]
  },
  "Foundations": {
   "Fonts": [
    "shadcn/font-dm-sans",
    "shadcn/font-eb-garamond",
    "shadcn/font-figtree",
    "shadcn/font-geist",
    "shadcn/font-geist-mono",
    "shadcn/font-ibm-plex-sans",
    "shadcn/font-instrument-sans",
    "shadcn/font-instrument-serif",
    "shadcn/font-inter",
    "shadcn/font-jetbrains-mono",
    "shadcn/font-lora",
    "shadcn/font-manrope",
    "shadcn/font-merriweather",
    "shadcn/font-montserrat",
    "shadcn/font-noto-sans",
    "shadcn/font-noto-serif",
    "shadcn/font-nunito-sans",
    "shadcn/font-outfit",
    "shadcn/font-oxanium",
    "shadcn/font-playfair-display",
    "shadcn/font-public-sans",
    "shadcn/font-raleway",
    "shadcn/font-roboto",
    "shadcn/font-roboto-slab",
    "shadcn/font-source-sans-3",
    "shadcn/font-space-grotesk"
   ],
   "Themes": [
    "beui/theme-toggle",
    "rareui/theme-selector",
    "shadcn/theme-gray",
    "shadcn/theme-neutral",
    "shadcn/theme-slate",
    "shadcn/theme-stone",
    "shadcn/theme-zinc"
   ],
   "Typography": [
    "shadcn/typography-blockquote",
    "shadcn/typography-demo",
    "shadcn/typography-h1",
    "shadcn/typography-h2",
    "shadcn/typography-h3",
    "shadcn/typography-h4",
    "shadcn/typography-inline-code",
    "shadcn/typography-large",
    "shadcn/typography-lead",
    "shadcn/typography-list",
    "shadcn/typography-muted",
    "shadcn/typography-p",
    "shadcn/typography-small",
    "shadcn/typography-table",
    "shadcn/docs-components-typography"
   ]
  },
  "Docs": {
   "Component docs": [
    "shadcn/docs-components-accordion",
    "shadcn/docs-components-alert",
    "shadcn/docs-components-alert-dialog",
    "shadcn/docs-components-aspect-ratio",
    "shadcn/docs-components-avatar",
    "shadcn/docs-components-badge",
    "shadcn/docs-components-breadcrumb",
    "shadcn/docs-components-button",
    "shadcn/docs-components-button-group",
    "shadcn/docs-components-calendar",
    "shadcn/docs-components-card",
    "shadcn/docs-components-carousel",
    "shadcn/docs-components-chart",
    "shadcn/docs-components-checkbox",
    "shadcn/docs-components-collapsible",
    "shadcn/docs-components-combobox",
    "shadcn/docs-components-command",
    "shadcn/docs-components-context-menu",
    "shadcn/docs-components-data-table",
    "shadcn/docs-components-date-picker",
    "shadcn/docs-components-dialog",
    "shadcn/docs-components-direction",
    "shadcn/docs-components-drawer",
    "shadcn/docs-components-dropdown-menu",
    "shadcn/docs-components-empty",
    "shadcn/docs-components-field",
    "shadcn/docs-components-hover-card",
    "shadcn/docs-components-input",
    "shadcn/docs-components-input-group",
    "shadcn/docs-components-input-otp",
    "shadcn/docs-components-item",
    "shadcn/docs-components-json",
    "shadcn/docs-components-kbd",
    "shadcn/docs-components-label",
    "shadcn/docs-components-menubar",
    "shadcn/docs-components-native-select",
    "shadcn/docs-components-navigation-menu",
    "shadcn/docs-components-pagination",
    "shadcn/docs-components-popover",
    "shadcn/docs-components-progress",
    "shadcn/docs-components-radio-group",
    "shadcn/docs-components-resizable",
    "shadcn/docs-components-scroll-area",
    "shadcn/docs-components-select",
    "shadcn/docs-components-separator",
    "shadcn/docs-components-sheet",
    "shadcn/docs-components-sidebar",
    "shadcn/docs-components-skeleton",
    "shadcn/docs-components-slider",
    "shadcn/docs-components-sonner",
    "shadcn/docs-components-spinner",
    "shadcn/docs-components-switch",
    "shadcn/docs-components-table",
    "shadcn/docs-components-tabs",
    "shadcn/docs-components-textarea",
    "shadcn/docs-components-toast",
    "shadcn/docs-components-toggle",
    "shadcn/docs-components-toggle-group",
    "shadcn/docs-components-tooltip"
   ],
   "Frameworks and installation": [
    "shadcn/docs-forms-next",
    "shadcn/docs-installation-astro",
    "shadcn/docs-installation-gatsby",
    "shadcn/docs-installation-laravel",
    "shadcn/docs-installation-manual",
    "shadcn/docs-installation-next",
    "shadcn/docs-installation-react-router",
    "shadcn/docs-installation-remix",
    "shadcn/docs-installation-tanstack",
    "shadcn/docs-installation-tanstack-router",
    "shadcn/docs-installation-vite",
    "shadcn/docs-javascript",
    "shadcn/docs-rtl",
    "shadcn/docs-rtl-next",
    "shadcn/docs-rtl-start",
    "shadcn/docs-rtl-vite"
   ],
   "Guides and release notes": [
    "shadcn/docs-figma",
    "shadcn/docs-forms",
    "shadcn/docs-changelog"
   ],
   "Helpers and hooks": [
    "rareui/utils",
    "shadcn/direction",
    "shadcn/use-mobile",
    "shadcn/utils",
    "shadcn/index",
    "shadcn/style",
    "shadcn/docs-forms-formisch",
    "shadcn/docs-forms-react-hook-form",
    "shadcn/docs-forms-tanstack-form",
    "shadcn/docs-index",
    "shadcn/docs-react-19",
    "shadcn/docs-tailwind-v4",
    "shadcn/docs-typeset"
   ],
   "Registry, CLI and MCP": [
    "shadcn/docs-cli",
    "shadcn/docs-directory",
    "shadcn/docs-mcp",
    "shadcn/docs-monorepo",
    "shadcn/docs-registry",
    "shadcn/docs-registry-authentication",
    "shadcn/docs-registry-examples",
    "shadcn/docs-registry-faq",
    "shadcn/docs-registry-getting-started",
    "shadcn/docs-registry-mcp",
    "shadcn/docs-registry-namespace",
    "shadcn/docs-registry-open-in-v0",
    "shadcn/docs-registry-registry-index",
    "shadcn/docs-registry-registry-item-json",
    "shadcn/docs-registry-registry-json",
    "shadcn/docs-skills"
   ],
   "Theming and dark mode": [
    "shadcn/docs-dark-mode",
    "shadcn/docs-dark-mode-astro",
    "shadcn/docs-dark-mode-next",
    "shadcn/docs-dark-mode-remix",
    "shadcn/docs-dark-mode-vite",
    "shadcn/docs-theming"
   ]
  },
  "Effects": {
   "Card transitions": [
    "transitions/card-resize",
    "transitions/card-stack-hover"
   ],
   "Input transitions": [
    "transitions/checkbox-check",
    "transitions/drag-drop-with-physics",
    "transitions/error-state-shake",
    "transitions/get-pro-button",
    "transitions/input-clear-with-dissolve",
    "transitions/like-button",
    "transitions/success-check",
    "transitions/toggle",
    "transitions/icon-swap"
   ],
   "Loader transitions": [
    "transitions/confetti-burst",
    "transitions/image-generation-placeholder",
    "transitions/matrix-dot-loader",
    "transitions/skeleton-loader-and-reveal",
    "transitions/spinner-to-check-morph"
   ],
   "Media transitions": [
    "transitions/3d-tilt",
    "transitions/avatar-group-hover",
    "transitions/image-open-tilt",
    "transitions/delete-with-smoky-dissolve"
   ],
   "Menu transitions": [
    "transitions/accordion",
    "transitions/banner-stacking",
    "transitions/dropdown-menu-morph",
    "transitions/gooey-plus-menu",
    "transitions/menu-dropdown",
    "transitions/page-side-by-side",
    "transitions/panel-reveal",
    "transitions/tabs-sliding"
   ],
   "Overlay transitions": [
    "transitions/modal-open-close",
    "transitions/notification-badge",
    "transitions/toast-open-close",
    "transitions/tooltip-open-close"
   ],
   "Text transitions": [
    "transitions/number-pop-in",
    "transitions/organic-shimmer",
    "transitions/pro-gradient-text",
    "transitions/shimmer-text",
    "transitions/spinning-counter",
    "transitions/streaming-text",
    "transitions/text-states-swap",
    "transitions/texts-reveal",
    "beui/number",
    "beui/text-animation",
    "rareui/animated-counter",
    "rareui/gravity-letters",
    "transitions/learn-more-hover",
    "transitions/reasoning-stream",
    "transitions/thinking-states"
   ]
  }
 },
 "variants": {
  "shadcn/accordion": [
   "shadcn/accordion-demo"
  ],
  "shadcn/alert": [
   "shadcn/alert-demo",
   "shadcn/alert-destructive"
  ],
  "shadcn/alert-dialog": [
   "shadcn/alert-dialog-demo"
  ],
  "shadcn/aspect-ratio": [
   "shadcn/aspect-ratio-demo"
  ],
  "shadcn/avatar": [
   "shadcn/avatar-demo"
  ],
  "shadcn/badge": [
   "shadcn/badge-demo",
   "shadcn/badge-destructive",
   "shadcn/badge-outline",
   "shadcn/badge-secondary"
  ],
  "shadcn/breadcrumb": [
   "shadcn/breadcrumb-demo",
   "shadcn/breadcrumb-dropdown",
   "shadcn/breadcrumb-link"
  ],
  "shadcn/button": [
   "shadcn/button-default",
   "shadcn/button-demo",
   "shadcn/button-destructive",
   "shadcn/button-ghost",
   "shadcn/button-icon",
   "shadcn/button-link",
   "shadcn/button-loading",
   "shadcn/button-outline",
   "shadcn/button-rounded",
   "shadcn/button-secondary",
   "shadcn/button-size",
   "shadcn/button-with-icon"
  ],
  "shadcn/button-group": [
   "shadcn/button-group-demo",
   "shadcn/button-group-dropdown",
   "shadcn/button-group-popover",
   "shadcn/button-group-size"
  ],
  "shadcn/calendar": [
   "shadcn/calendar-demo"
  ],
  "shadcn/card": [
   "shadcn/card-demo"
  ],
  "shadcn/carousel": [
   "shadcn/carousel-demo",
   "shadcn/carousel-size"
  ],
  "shadcn/chart": [
   "shadcn/chart-area-axes",
   "shadcn/chart-area-default",
   "shadcn/chart-area-gradient",
   "shadcn/chart-area-icons",
   "shadcn/chart-area-interactive",
   "shadcn/chart-area-legend",
   "shadcn/chart-area-linear",
   "shadcn/chart-area-stacked",
   "shadcn/chart-area-stacked-expand",
   "shadcn/chart-area-step",
   "shadcn/chart-bar-active",
   "shadcn/chart-bar-default",
   "shadcn/chart-bar-horizontal",
   "shadcn/chart-bar-interactive",
   "shadcn/chart-bar-label",
   "shadcn/chart-bar-label-custom",
   "shadcn/chart-bar-mixed",
   "shadcn/chart-bar-multiple",
   "shadcn/chart-bar-negative",
   "shadcn/chart-bar-stacked",
   "shadcn/chart-line-default",
   "shadcn/chart-line-dots",
   "shadcn/chart-line-dots-colors",
   "shadcn/chart-line-dots-custom",
   "shadcn/chart-line-interactive",
   "shadcn/chart-line-label",
   "shadcn/chart-line-label-custom",
   "shadcn/chart-line-linear",
   "shadcn/chart-line-multiple",
   "shadcn/chart-line-step",
   "shadcn/chart-pie-donut",
   "shadcn/chart-pie-donut-active",
   "shadcn/chart-pie-donut-text",
   "shadcn/chart-pie-interactive",
   "shadcn/chart-pie-label",
   "shadcn/chart-pie-label-custom",
   "shadcn/chart-pie-label-list",
   "shadcn/chart-pie-legend",
   "shadcn/chart-pie-separator-none",
   "shadcn/chart-pie-simple",
   "shadcn/chart-pie-stacked",
   "shadcn/chart-radar-default",
   "shadcn/chart-radar-dots",
   "shadcn/chart-radar-grid-circle",
   "shadcn/chart-radar-grid-circle-fill",
   "shadcn/chart-radar-grid-circle-no-lines",
   "shadcn/chart-radar-grid-custom",
   "shadcn/chart-radar-grid-fill",
   "shadcn/chart-radar-grid-none",
   "shadcn/chart-radar-icons",
   "shadcn/chart-radar-label-custom",
   "shadcn/chart-radar-legend",
   "shadcn/chart-radar-lines-only",
   "shadcn/chart-radar-multiple",
   "shadcn/chart-radar-radius",
   "shadcn/chart-radial-grid",
   "shadcn/chart-radial-label",
   "shadcn/chart-radial-shape",
   "shadcn/chart-radial-simple",
   "shadcn/chart-radial-stacked",
   "shadcn/chart-radial-text",
   "shadcn/chart-tooltip-advanced",
   "shadcn/chart-tooltip-default",
   "shadcn/chart-tooltip-formatter",
   "shadcn/chart-tooltip-icons",
   "shadcn/chart-tooltip-indicator-line",
   "shadcn/chart-tooltip-indicator-none",
   "shadcn/chart-tooltip-label-custom",
   "shadcn/chart-tooltip-label-formatter",
   "shadcn/chart-tooltip-label-none",
   "shadcn/chart-bar-demo",
   "shadcn/chart-bar-demo-axis",
   "shadcn/chart-bar-demo-grid",
   "shadcn/chart-bar-demo-legend",
   "shadcn/chart-bar-demo-tooltip",
   "shadcn/chart-tooltip-demo"
  ],
  "shadcn/checkbox": [
   "shadcn/checkbox-demo",
   "shadcn/checkbox-disabled",
   "shadcn/checkbox-with-text"
  ],
  "shadcn/collapsible": [
   "shadcn/collapsible-demo"
  ],
  "shadcn/combobox": [
   "shadcn/combobox-demo",
   "shadcn/combobox-popover"
  ],
  "shadcn/command": [
   "shadcn/command-demo"
  ],
  "shadcn/context-menu": [
   "shadcn/context-menu-demo"
  ],
  "shadcn/dialog": [
   "shadcn/dialog-demo"
  ],
  "shadcn/drawer": [
   "shadcn/drawer-demo"
  ],
  "shadcn/dropdown-menu": [
   "shadcn/dropdown-menu-demo"
  ],
  "shadcn/empty": [
   "shadcn/empty-demo",
   "shadcn/empty-icon",
   "shadcn/empty-outline"
  ],
  "shadcn/field": [
   "shadcn/field-demo"
  ],
  "shadcn/font-dm-sans": [
   "shadcn/font-heading-dm-sans"
  ],
  "shadcn/font-eb-garamond": [
   "shadcn/font-heading-eb-garamond"
  ],
  "shadcn/font-figtree": [
   "shadcn/font-heading-figtree"
  ],
  "shadcn/font-geist": [
   "shadcn/font-heading-geist"
  ],
  "shadcn/font-geist-mono": [
   "shadcn/font-heading-geist-mono"
  ],
  "shadcn/font-ibm-plex-sans": [
   "shadcn/font-heading-ibm-plex-sans"
  ],
  "shadcn/font-instrument-sans": [
   "shadcn/font-heading-instrument-sans"
  ],
  "shadcn/font-instrument-serif": [
   "shadcn/font-heading-instrument-serif"
  ],
  "shadcn/font-inter": [
   "shadcn/font-heading-inter"
  ],
  "shadcn/font-jetbrains-mono": [
   "shadcn/font-heading-jetbrains-mono"
  ],
  "shadcn/font-lora": [
   "shadcn/font-heading-lora"
  ],
  "shadcn/font-manrope": [
   "shadcn/font-heading-manrope"
  ],
  "shadcn/font-merriweather": [
   "shadcn/font-heading-merriweather"
  ],
  "shadcn/font-montserrat": [
   "shadcn/font-heading-montserrat"
  ],
  "shadcn/font-noto-sans": [
   "shadcn/font-heading-noto-sans"
  ],
  "shadcn/font-noto-serif": [
   "shadcn/font-heading-noto-serif"
  ],
  "shadcn/font-nunito-sans": [
   "shadcn/font-heading-nunito-sans"
  ],
  "shadcn/font-outfit": [
   "shadcn/font-heading-outfit"
  ],
  "shadcn/font-oxanium": [
   "shadcn/font-heading-oxanium"
  ],
  "shadcn/font-playfair-display": [
   "shadcn/font-heading-playfair-display"
  ],
  "shadcn/font-public-sans": [
   "shadcn/font-heading-public-sans"
  ],
  "shadcn/font-raleway": [
   "shadcn/font-heading-raleway"
  ],
  "shadcn/font-roboto": [
   "shadcn/font-heading-roboto"
  ],
  "shadcn/font-roboto-slab": [
   "shadcn/font-heading-roboto-slab"
  ],
  "shadcn/font-source-sans-3": [
   "shadcn/font-heading-source-sans-3"
  ],
  "shadcn/font-space-grotesk": [
   "shadcn/font-heading-space-grotesk"
  ],
  "shadcn/hover-card": [
   "shadcn/hover-card-demo"
  ],
  "shadcn/input": [
   "shadcn/input-demo",
   "shadcn/input-disabled",
   "shadcn/input-with-text"
  ],
  "shadcn/input-group": [
   "shadcn/input-group-demo",
   "shadcn/input-group-dropdown",
   "shadcn/input-group-icon",
   "shadcn/input-group-text",
   "shadcn/input-group-tooltip"
  ],
  "shadcn/input-otp": [
   "shadcn/input-otp-demo"
  ],
  "shadcn/item": [
   "shadcn/item-demo",
   "shadcn/item-dropdown",
   "shadcn/item-icon",
   "shadcn/item-link",
   "shadcn/item-size"
  ],
  "shadcn/kbd": [
   "shadcn/kbd-demo",
   "shadcn/kbd-tooltip"
  ],
  "shadcn/label": [
   "shadcn/label-demo"
  ],
  "shadcn/menubar": [
   "shadcn/menubar-demo"
  ],
  "shadcn/native-select": [
   "shadcn/native-select-demo",
   "shadcn/native-select-disabled"
  ],
  "shadcn/navigation-menu": [
   "shadcn/navigation-menu-demo"
  ],
  "shadcn/pagination": [
   "shadcn/pagination-demo"
  ],
  "shadcn/popover": [
   "shadcn/popover-demo"
  ],
  "shadcn/progress": [
   "shadcn/progress-demo"
  ],
  "shadcn/radio-group": [
   "shadcn/radio-group-demo"
  ],
  "shadcn/resizable": [
   "shadcn/resizable-demo",
   "shadcn/resizable-vertical"
  ],
  "shadcn/scroll-area": [
   "shadcn/scroll-area-demo",
   "shadcn/scroll-area-horizontal-demo"
  ],
  "shadcn/select": [
   "shadcn/select-demo"
  ],
  "shadcn/separator": [
   "shadcn/separator-demo"
  ],
  "shadcn/sheet": [
   "shadcn/sheet-demo"
  ],
  "shadcn/sidebar": [
   "shadcn/sidebar-01",
   "shadcn/sidebar-02",
   "shadcn/sidebar-03",
   "shadcn/sidebar-04",
   "shadcn/sidebar-05",
   "shadcn/sidebar-06",
   "shadcn/sidebar-07",
   "shadcn/sidebar-08",
   "shadcn/sidebar-09",
   "shadcn/sidebar-10",
   "shadcn/sidebar-11",
   "shadcn/sidebar-12",
   "shadcn/sidebar-13",
   "shadcn/sidebar-14",
   "shadcn/sidebar-15",
   "shadcn/sidebar-16"
  ],
  "shadcn/skeleton": [
   "shadcn/skeleton-card",
   "shadcn/skeleton-demo"
  ],
  "shadcn/slider": [
   "shadcn/slider-demo"
  ],
  "shadcn/sonner": [
   "shadcn/sonner-demo"
  ],
  "shadcn/spinner": [
   "shadcn/spinner-badge",
   "shadcn/spinner-demo",
   "shadcn/spinner-empty",
   "shadcn/spinner-size"
  ],
  "shadcn/switch": [
   "shadcn/switch-demo"
  ],
  "shadcn/table": [
   "shadcn/table-demo"
  ],
  "shadcn/tabs": [
   "shadcn/tabs-demo"
  ],
  "shadcn/textarea": [
   "shadcn/textarea-demo",
   "shadcn/textarea-disabled",
   "shadcn/textarea-with-text"
  ],
  "shadcn/toggle": [
   "shadcn/toggle-demo",
   "shadcn/toggle-disabled",
   "shadcn/toggle-lg",
   "shadcn/toggle-outline",
   "shadcn/toggle-sm",
   "shadcn/toggle-with-text"
  ],
  "shadcn/toggle-group": [
   "shadcn/toggle-group-demo",
   "shadcn/toggle-group-disabled",
   "shadcn/toggle-group-lg",
   "shadcn/toggle-group-outline",
   "shadcn/toggle-group-single",
   "shadcn/toggle-group-sm"
  ],
  "shadcn/tooltip": [
   "shadcn/tooltip-demo"
  ]
 },
 "columns": {
  "Agent UI/Agent activity": [
   "demos",
   "files"
  ],
  "Agent UI/Chat and messages": [
   "demos",
   "files"
  ],
  "Agent UI/Artifacts and diffs": [
   "demos",
   "files"
  ],
  "Agent UI/Tool calls and approvals": [
   "demos",
   "files"
  ],
  "Agent UI/Streaming and thinking": [
   "demos",
   "files"
  ],
  "Agent UI/Prompting": [
   "demos",
   "files"
  ],
  "Blocks/Data tables": [
   "demos",
   "files",
   "shape"
  ],
  "Blocks/App shells and navigation": [
   "demos",
   "files",
   "shape",
   "sheet"
  ],
  "Blocks/Showcase blocks": [
   "demos",
   "files",
   "shape"
  ],
  "Blocks/Files and folders": [
   "demos",
   "files",
   "shape"
  ],
  "Blocks/Auth and onboarding": [
   "demos",
   "files",
   "shape"
  ],
  "Components/Navigation": [
   "demos",
   "icons",
   "files",
   "sheet"
  ],
  "Components/Code block": [
   "demos",
   "files"
  ],
  "Components/Button": [
   "demos",
   "sizes",
   "loading",
   "icons",
   "files"
  ],
  "Components/Stepper": [
   "demos",
   "files"
  ],
  "Components/Sidebar": [
   "demos",
   "files",
   "collapses",
   "nests",
   "sheet",
   "keyboard",
   "shape",
   "animates"
  ],
  "Components/Alert": [
   "demos",
   "sizes",
   "files"
  ],
  "Components/Badge": [
   "demos",
   "loading",
   "icons",
   "files"
  ],
  "Components/Toast and notification": [
   "demos",
   "files",
   "animates"
  ],
  "Components/Pickers": [
   "demos",
   "states",
   "files"
  ],
  "Components/Drawer and sheet": [
   "demos",
   "files",
   "sheet"
  ],
  "Components/Accordion": [
   "demos",
   "states",
   "files",
   "collapses",
   "animates"
  ],
  "Components/Breadcrumb": [
   "demos",
   "files"
  ],
  "Components/Card": [
   "demos",
   "sizes",
   "files"
  ],
  "Components/Dialog": [
   "demos",
   "files",
   "sheet"
  ],
  "Components/Checkbox": [
   "demos",
   "states",
   "files"
  ],
  "Components/Combobox": [
   "demos",
   "states",
   "files"
  ],
  "Components/Context menu": [
   "demos",
   "icons",
   "files"
  ],
  "Components/Carousel": [
   "demos",
   "sizes",
   "files"
  ],
  "Components/Disclosure": [
   "demos",
   "files"
  ],
  "Components/Image": [
   "demos",
   "files"
  ],
  "Components/Input": [
   "demos",
   "loading",
   "icons",
   "states",
   "files"
  ],
  "Components/Loader and skeleton": [
   "demos",
   "sizes",
   "files"
  ],
  "Components/Popover": [
   "demos",
   "files",
   "sheet"
  ],
  "Components/Radio group": [
   "demos",
   "states",
   "files"
  ],
  "Components/Slider": [
   "demos",
   "states",
   "files"
  ],
  "Components/Resizable and scroll": [
   "demos",
   "files"
  ],
  "Components/Orbs and backgrounds": [
   "demos",
   "files"
  ],
  "Components/Item and list": [
   "demos",
   "sizes",
   "icons",
   "files"
  ],
  "Components/Switch": [
   "demos",
   "sizes",
   "states",
   "files"
  ],
  "Components/Table": [
   "demos",
   "files"
  ],
  "Components/Tabs": [
   "demos",
   "icons",
   "states",
   "files",
   "keyboard"
  ],
  "Components/Tooltip": [
   "demos",
   "states",
   "files",
   "animates"
  ],
  "Components/Avatar": [
   "demos",
   "sizes",
   "icons",
   "files"
  ],
  "Components/Calendar": [
   "demos",
   "files"
  ],
  "Components/Command": [
   "demos",
   "files",
   "sheet",
   "keyboard"
  ],
  "Components/Empty": [
   "demos",
   "files"
  ],
  "Components/Kbd": [
   "demos",
   "files"
  ],
  "Components/Toggle": [
   "demos",
   "sizes",
   "states",
   "files"
  ],
  "Components/Input groups": [
   "demos",
   "files"
  ],
  "Components/Button group": [
   "demos",
   "sizes",
   "files"
  ],
  "Components/Form libraries": [
   "demos",
   "files"
  ],
  "Components/Fields": [
   "demos",
   "files"
  ],
  "Components/Layout": [
   "demos",
   "files"
  ],
  "Components/Files and attachments": [
   "demos",
   "files"
  ],
  "Components/Menus": [
   "demos",
   "icons",
   "files"
  ],
  "Charts/Flow and hierarchy": [
   "demos",
   "files",
   "shape"
  ],
  "Charts/Financial": [
   "demos",
   "files",
   "shape"
  ],
  "Charts/Heatmaps and calendars": [
   "demos",
   "files"
  ],
  "Charts/Chart demonstrations": [
   "demos",
   "files"
  ],
  "Foundations/Themes": [
   "demos",
   "files"
  ],
  "Foundations/Fonts": [],
  "Foundations/Typography": [
   "demos",
   "files"
  ],
  "Docs/Helpers and hooks": [
   "files"
  ],
  "Docs/Registry, CLI and MCP": [],
  "Docs/Component docs": [],
  "Docs/Theming and dark mode": [],
  "Docs/Frameworks and installation": [],
  "Docs/Guides and release notes": [],
  "Effects/Card transitions": [
   "files"
  ],
  "Effects/Input transitions": [
   "files"
  ],
  "Effects/Loader transitions": [
   "files"
  ],
  "Effects/Media transitions": [
   "files"
  ],
  "Effects/Menu transitions": [
   "files"
  ],
  "Effects/Overlay transitions": [
   "files"
  ],
  "Effects/Text transitions": [
   "demos",
   "files"
  ]
 }
}
`;export{e as default};