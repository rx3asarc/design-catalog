var e=`import { asWords, label, type Item } from "./lib";
import palettes from "./foundations.json";
import { SAMPLE, isSelfHosted, useFaces } from "./fontFamilies";

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
 * The face a family is drawn in, which is a different question for each of the three kinds of row and is answered
 * in \`site/fontFamilies.ts\`: this build's own binary, the font service on this page, or nowhere (and the row says so).
 *
 * \`HOSTED\` used to be a two-entry table here and the rest of the type was "not self-hosted" — honest about the build
 * and useless as a specimen page: the review's line was that "DM Sans" and "EB Garamond" looked identical, and they
 * did, because both were set in Instrument Sans. The rule it replaces is the same rule, applied to a page that can
 * now actually show the letterforms:
 *
 *   - the two families this build self-hosts are set in their own binary, from \`app/public/fonts/\`;
 *   - every other family is requested from Google Fonts **on this surface only** (\`useFaces\` appends the stylesheet
 *     when the type page mounts and removes it when it goes), and each row states what actually arrived — measured
 *     with \`document.fonts.load\`, not assumed from the family's name;
 *   - a family whose face did not arrive is set in the interface face and says so on the row, in the same position
 *     the loaded rows use for their own provenance. A name drawn in the wrong typeface would be a picture of a
 *     typeface that does not exist.
 */

/** \`shadcn/font-heading-ibm-plex-sans\` → \`ibm-plex-sans\`; the heading cut is the same typeface. */
export const familyToken = (id: string) =>
  (id.split("/")[1] ?? "")
    .replace(/^font-/, "")
    .replace(/^heading-/, "");

const isHeadingCut = (id: string) => /\\/font-heading-/.test(id);

/** A family, its two declarations, and the name a person reads. */
type Family = {
  token: string;
  name: string;
  /** the body cut — the row's own link — or the heading cut when a family declares only that */
  body: Item;
  heading: Item | null;
};

/** 52 items → 26 families. Two rows per typeface was the review's "the '(Heading)' entries double every typeface". */
export function familiesOf(items: Item[]): Family[] {
  const by = new Map<string, { body?: Item; heading?: Item }>();
  for (const item of items) {
    const token = familyToken(item.id);
    const at = by.get(token) ?? {};
    if (isHeadingCut(item.id)) at.heading = item; else at.body = item;
    by.set(token, at);
  }
  return [...by.entries()]
    .map(([token, at]) => {
      const body = at.body ?? at.heading!;
      const name = asWords(label(body)).replace(/\\s*\\(Heading\\)$/, "");
      return { token, name, body, heading: at.heading && at.heading !== body ? at.heading : null };
    })
    .filter((f) => !!f.body)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The face this build can set for an item, or null when nothing on this page can set it. */
export const hostedFamily = (i: Item) => {
  const name = asWords(label(i)).replace(/\\s*\\(Heading\\)$/, "");
  return isSelfHosted(name) ? name : null;
};

/**
 * The mono line's last clause: what is under this row, in the same position on every row so the three kinds are read
 * by contrast rather than by reading twenty-six sentences.
 */
const faceWord = (state: "pending" | "ok" | "absent", selfHosted: boolean) =>
  selfHosted ? "self-hosted, OFL-1.1" : state === "ok" ? "loaded from Google Fonts" : state === "pending" ? "loading the face…" : "that face did not load — set in the interface face";

/**
 * A type specimen: **one row per typeface**, the name and a sample line set in the face itself.
 *
 * 26 rows, not 52. The two cuts of a family are one typeface and one specimen: the row draws it once and names both
 * declarations — the name links to the body cut's item page, and \`heading cut\` links to the heading cut's — so the
 * 52 items of the type are all still reachable and none of them is a second copy of another one's letterforms.
 */
export function FontSpecimens({ items }: { items: Item[] }) {
  const families = familiesOf(items);
  const names = families.map((f) => f.name);
  const faces = useFaces(names);
  const loaded = families.filter((f) => isSelfHosted(f.name) || faces[f.name] === "ok").length;
  const absent = families.length - loaded;
  /* The number of cuts is the number of members this type folded, not "items minus families": since the taxonomy
     folds a variant into its parent, \`items\` and \`families\` are both 26 and the subtraction printed **0** — "the 0
     heading cuts are the same typefaces". The cuts are still there, one per family, sitting on the parent items as
     \`variants\`; that is what gets counted. If a type ever has no cuts, the clause is dropped rather than printed as
     a zero. */
  const cuts = items.reduce((n, i) => n + (i.variants?.length ?? 0), 0);
  return (
    <div data-spec-surface="fonts" data-spec-count={items.length} data-spec-rows={families.length} data-spec-hosted={loaded}>
      <p className="spec-lede" data-spec-lede="">
        {families.length} typefaces from {items.length} items{cuts > 0
          ? \` — the \${cuts} heading cut\${cuts === 1 ? " is" : "s are"} the same typeface\${cuts === 1 ? "" : "s"},
             named on \${cuts === 1 ? "its" : "their"} family&apos;s row rather than drawn twice\`
          : ""}. {loaded === families.length
          ? "Every row below is set in the face it names"
          : \`\${loaded} of \${families.length} rows are set in the face they name\`}: two are this catalogue&apos;s own
        binaries (Instrument Sans and JetBrains Mono, self-hosted, OFL-1.1) and the rest are loaded for this page from
        Google Fonts, which is the only page here that asks a third party for anything.
        {absent > 0 ? \` \${absent === 1 ? "One row's face did not load" : \`\${absent} rows' faces did not load\`} and
          those rows say so and are set in the interface face.\` : ""}
      </p>
      <ul className="spec-list">
        {families.map((f) => {
          const self = isSelfHosted(f.name);
          const state = self ? "ok" : faces[f.name] ?? "pending";
          const family = \`"\${f.name}", var(--font-sans)\`;
          return (
            <li
              key={f.token}
              className="spec-row"
              data-also-row={f.body.id}
              data-specimen={f.body.id}
              data-specimen-ids={[f.body.id, f.heading?.id].filter(Boolean).join(" ")}
              data-specimen-face={self ? "hosted" : state === "ok" ? "google" : state === "absent" ? "absent" : "pending"}
              data-specimen-family={f.name}
            >
              <a className="spec-name" href={\`#/i/\${f.body.id}\`} style={{ fontFamily: family }}>
                {f.name}
              </a>
              <span className="spec-sample" style={{ fontFamily: family }} aria-hidden="true">{SAMPLE}</span>
              <span className="spec-meta">
                {f.body.source} · {f.body.licence} · {faceWord(state, self)}
                {f.heading ? (
                  <>
                    {" · "}
                    <a className="spec-cut" href={\`#/i/\${f.heading.id}\`}>heading cut</a>
                  </>
                ) : null}
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