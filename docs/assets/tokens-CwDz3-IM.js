var e=`/* ── the design catalogue's own tokens ────────────────────────────────────────────────────────────────
   Source: rx3asarc/sharedfiles/design-catalog-design-system (tokens.css + README.md, the brand book).
   Vendored rather than fetched: the site promises no third-party requests, and a token file that changes
   under a build is a build that cannot be reproduced.

   Three deliberate differences from the vendored file, each with its reason:

   1. The colour blocks are scoped to \`.cat\` (the chrome's root element) instead of \`:root\`. The catalogue's
      exhibits are shadcn components and they are painted with shadcn's own tokens — \`--accent\`, \`--border\`,
      \`--background\` and friends — so a chrome palette on \`:root\` would repaint every demo in the catalogue and
      misrepresent the library it is showing. Demos live in iframes (\`demo.html\`) with their own tokens, and the
      chrome carries the design system's. Dark is the default, as the brand book says; light is \`.cat\` without
      \`.dark\` on <html>, which the boot script in index.html paints before the first byte of CSS is parsed.
   2. The two \`@font-face\` blocks are dropped. The site already ships both faces, with a \`unicode-range\` subset
      on each, and they are the same bytes: sha256 2ee17598… (Instrument Sans) and 83c005d4… (JetBrains Mono)
      match the design system's \`fonts/\` exactly.
   3. The type classes are renamed \`.dc-*\`. \`.title\`, \`.body\`, \`.small\` and \`.code\` are names the catalogue's own
      chrome and demo markup already use (\`h2.title\` on every page), and a shared design-system class must not
      silently win over the thing that names itself the same.

   Everything else — every value, every name — is the design system's. Do not hard-code a value anywhere in the
   chrome; if something is missing, add the token here and note it.
   ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/* ── colour: dark is the default theme, light is the same names with different values ─────────────── */
.cat {
  --surface-100: #09090b;
  --surface-200: #111113;
  --surface-300: #18181b;
  --border: #27272a;
  --border-strong: #6b6b75;
  --ink: #fafafa;
  --ink-muted: #a1a1aa;
  --ink-subtle: #85858f;
  --accent: #7c2dff;
  --accent-ink: #b197fc;
  --on-accent: #ffffff;
  --focus: #a78bfa;
}

html:not(.dark) .cat {
  --surface-100: #ffffff;
  --surface-200: #fafafa;
  --surface-300: #f4f4f5;
  --border: #e4e4e7;
  --border-strong: #8a8a94;
  --ink: #09090b;
  --ink-muted: #52525b;
  --ink-subtle: #6a6a73;
  --accent: #6a1fe0;
  --accent-ink: #6a1fe0;
  --on-accent: #ffffff;
  --focus: #6a1fe0;
}

:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-full: 999px;
  --font-sans: "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

.dc-display { font-family: var(--font-sans); font-size: 36px; line-height: 40px; font-weight: 600; }

.dc-heading { font-family: var(--font-sans); font-size: 24px; line-height: 32px; font-weight: 600; }

.dc-title { font-family: var(--font-sans); font-size: 18px; line-height: 28px; font-weight: 600; }

.dc-body { font-family: var(--font-sans); font-size: 15px; line-height: 24px; font-weight: 400; }

.dc-small { font-family: var(--font-sans); font-size: 13px; line-height: 20px; font-weight: 400; }

.dc-label { font-family: var(--font-mono); font-size: 12px; line-height: 16px; font-weight: 400; }

.dc-code { font-family: var(--font-mono); font-size: 13px; line-height: 20px; font-weight: 400; }

`;export{e as default};