var e=`import { asWords, label, type Item } from "./lib";
import palettes from "./foundations.json";

/**
 * THE TWO FOUNDATIONS SURFACES: a type specimen, and a theme's palette.
 *
 * The review of the Foundations section was one sentence long and it was about *identity*: "There are 5 fonts
 * listed as 'Fonts' with five different names and no sample; same for the seven themes." A font is not a tile with
 * a demo — the letterforms **are** the content — and a theme is not a tile either: it is a palette, and the palette
 * is in the theme file. So this module renders two row kinds, and \`site/TypePage.tsx\` — which owns the collection
 * surface — calls them where one of its rows would otherwise be a demo window or a "no demo" label. No second page
 * is forked, and \`site/typeIndex.ts\` is still the only address authority (both surfaces link out with \`#/i/<id>\`).
 *
 * WHAT IS READ, AND WHAT IS NOT.
 *
 *  - A **font**'s name is set in its own family, at 40 px, when this build actually has the face — and the build
 *    has exactly two: Instrument Sans and JetBrains Mono, the two binaries \`LICENSES-FONTS.md\` records as
 *    self-hosted, both OFL-1.1 (\`app/public/fonts/\`). The other 24 families in the type are registry items
 *    (\`npx shadcn@latest add font-inter\`); the catalogue ships their *declaration*, never their binary, and it
 *    makes no third-party requests at run time, so there is no way to draw them. Those rows say so, on the row,
 *    in one line: a name set in the wrong face and presented as a specimen would be a picture of a typeface that
 *    does not exist, which is the one thing this surface must never be.
 *  - A **theme**'s palette is \`foundations.json\`, which was read out of the catalogue's own snapshot store (the
 *    \`cssvars\` artifact of \`https://ui.shadcn.com/r/styles/new-york-v4/theme-*.json\` — the exact URL each item's
 *    \`url\` field names). Every variable the file declares is drawn, in the order it declares them, light and dark
 *    side by side. Nothing is sampled from a screenshot, nothing is invented, and a declaration that is not a
 *    colour (\`radius\`) is printed as a value rather than painted as a swatch.
 *
 * Two of the seven \`Themes\` members are not palettes at all — \`beui/theme-toggle\` and \`rareui/theme-selector\` are
 * components that *switch* a theme, and one of them has a live demo. They are not forced into this row kind; the
 * caller keeps them in the ordinary list, where their demo still runs.
 */

/* ── fonts ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The two families this build self-hosts, by the family token in the item's slug (\`font-jetbrains-mono\`,
 * \`font-heading-jetbrains-mono\` → \`jetbrains-mono\`).
 *
 * The binaries and their provenance are \`app/public/fonts/\` and \`LICENSES-FONTS.md\`; the \`font-family\` strings are
 * the ones \`app/src/styles.css\` declares in its two \`@font-face\` rules, so a row here and the site's own text are
 * the same face. Adding a third family means adding its binary and its row here — not a wider fallback stack.
 */
const HOSTED: Record<string, string> = {
  "instrument-sans": "Instrument Sans",
  "jetbrains-mono": "JetBrains Mono",
};

/** \`shadcn/font-heading-ibm-plex-sans\` → \`ibm-plex-sans\`; the heading variants are the same typeface. */
export const familyToken = (id: string) =>
  (id.split("/")[1] ?? "")
    .replace(/^font-/, "")
    .replace(/^heading-/, "");

/** The face this build can actually set, or null when it only has the registry declaration. */
export const hostedFamily = (i: Item) => HOSTED[familyToken(i.id)] ?? null;

/**
 * The one thing a row must never do: draw a name in a face the row is not claiming.
 *
 * It is a fragment in the mono meta line, not a sentence under every row. The first pass printed "shown in
 * Instrument Sans — this face is not self-hosted here" 48 times down the page, and 48 copies of the same sentence
 * is not honesty, it is noise: the reader stops seeing it after the third. The lede states it once, the meta line
 * carries the mark on the row it applies to, and the two rows that *can* show their face say \`self-hosted, OFL-1.1\`
 * in the same position — so the contrast between the two kinds of row is what carries the fact.
 */
const NOT_SHIPPED = "not self-hosted";

/**
 * A type specimen, one row per member of the \`Fonts\` type — 52 of them, which is 26 families and their \`heading\`
 * declarations. The name is the specimen; the mono line is the provenance the brief asked for (source and licence,
 * plus which binary is underneath when there is one).
 */
export function FontSpecimens({ items }: { items: Item[] }) {
  const hosted = items.filter(hostedFamily).length;
  // NB: \`map(familyToken)\` would pass the *item* where the token is wanted — hence the explicit lambdas
  const families = new Set(items.map((i) => familyToken(i.id))).size;
  const hostedFamilies = new Set(items.filter(hostedFamily).map((i) => familyToken(i.id))).size;
  return (
    <div data-spec-surface="fonts" data-spec-count={items.length} data-spec-hosted={hosted}>
      {/*
       * One statement about the surface, printed once — not 48 copies of the same apology under 48 names. It says
       * what is true of this build and lets every row below be a row rather than a paragraph.
       */}
      <p className="spec-lede" data-spec-lede="">
        {items.length} rows: {families} typefaces and their heading cuts. {hosted === 0
          ? "None"
          : hostedFamilies === 1
            ? "One of those families is"
            : \`Two of those families are\`}{" "}
        self-hosted in this catalogue — Instrument Sans and JetBrains Mono, OFL-1.1, with the binaries beside their
        licence text — so {hosted === 2 ? "both rows" : \`the \${hosted} rows\`} below are the face itself. Every other
        row prints the name in Instrument Sans and says so on the row, because a specimen set in the wrong face is a
        picture of a typeface that does not exist.
      </p>
      <ul className="spec-list">
        {items.map((item) => {
          const family = hostedFamily(item);
          return (
            <li
              key={item.id}
              className="spec-row"
              data-also-row={item.id}
              data-specimen={item.id}
              data-specimen-face={family ? "hosted" : "absent"}
            >
              <a
                href={\`#/i/\${item.id}\`}
                className="spec-name"
                style={family ? { fontFamily: \`"\${family}", var(--font-sans)\` } : undefined}
              >
                {asWords(label(item))}
              </a>
              <span className="spec-meta">
                {item.source} · {item.licence}
                {family ? (
                  <span className="spec-hosted-mark"> · self-hosted, OFL-1.1</span>
                ) : (
                  <span className="spec-absent-mark" data-specimen-note={item.id}> · {NOT_SHIPPED}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── themes ─────────────────────────────────────────────────────────────────────────────────────────────── */

type Palette = { url: string; light: Record<string, string>; dark: Record<string, string> };
const PALETTES = (palettes as { themes: Record<string, Palette> }).themes;

/** True when this member is a theme file with a palette — not a component that switches one. */
export const hasPalette = (i: Item) => Object.prototype.hasOwnProperty.call(PALETTES, i.id);

/** A declaration that is a colour, and can therefore be painted. \`radius: 0.625rem\` is not one. */
const isColour = (v: string) => /^(oklch|rgba?|hsla?|lab|lch|color)\\(|^#[0-9a-f]{3,8}$/i.test(v.trim()) || v.trim() === "transparent";

/** The file the values came from, without the scheme — printed, so a reader can go and check the numbers. */
const fileOf = (url: string) => url.replace(/^https?:\\/\\//, "");

function Panel({ side, vars }: { side: "light" | "dark"; vars: [string, string][] }) {
  return (
    <div className="swatch-panel" data-swatch-panel={side}>
      <span className="swatch-panel-label">{side}</span>
      <div className="swatch-grid">
        {vars.map(([name, value]) =>
          isColour(value) ? (
            // the chip is the value; the name is the text a reader (and a screen reader) gets
            <span className="swatch" key={name} data-swatch={name} data-value={value} title={\`\${name}: \${value}\`}>
              <span className="swatch-chip" aria-hidden="true" style={{ background: value }} />
              <span className="swatch-name">{name}</span>
            </span>
          ) : (
            <span className="swatch swatch-notacolour" key={name} data-swatch={name} data-value={value} title={\`\${name}: \${value}\`}>
              <span className="swatch-value">{name}: {value}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * One theme, drawn as the file declares it: every colour variable of both palettes, side by side, each chip painted
 * with the value the file gives. The facts line underneath states how many variables were drawn, the file they came
 * from, and any declaration the file makes that is not a colour (so nothing is quietly dropped).
 */
export function ThemeSwatches({ items }: { items: Item[] }) {
  return (
    <div data-spec-surface="themes" data-spec-count={items.length}>
      {items.map((item) => {
        const p = PALETTES[item.id];
        const light = Object.entries(p.light);
        const dark = Object.entries(p.dark);
        const colours = light.filter(([, v]) => isColour(v)).length;
        const others = [...new Set([...light, ...dark].filter(([, v]) => !isColour(v)).map(([k]) => k))];
        return (
          <section
            key={item.id}
            className="swatch-theme"
            data-also-row={item.id}
            data-theme-swatch={item.id}
            data-swatch-colours={colours}
          >
            <div className="swatch-head">
              <a className="swatch-title" href={\`#/i/\${item.id}\`}>{asWords(label(item))}</a>
              <span className="spec-meta">{item.source} · {item.licence}</span>
            </div>
            <div className="swatch-side-by-side">
              <Panel side="light" vars={light} />
              <Panel side="dark" vars={dark} />
            </div>
            <p className="swatch-facts" data-swatch-facts={item.id}>
              {colours} colour variables declared in each palette · {light.length} in light, {dark.length} in dark ·
              read from {fileOf(p.url)}
              {others.length
                ? \` · also declares \${others.map((k) => \`\${k}: \${(p.light[k] ?? p.dark[k] ?? "").trim()}\`).join(", ")}\`
                : ""}
            </p>
          </section>
        );
      })}
    </div>
  );
}
`;export{e as default};