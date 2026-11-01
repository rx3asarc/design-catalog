var e=`import { useEffect, useState } from "react";

/**
 * THE FACES A SPECIMEN NEEDS, AND WHERE THEY COME FROM.
 *
 * The Foundations \`Fonts\` type is 52 items: 26 typefaces, each declared twice — once as a body cut (\`font-dm-sans\`)
 * and once as a heading cut (\`font-heading-dm-sans\`). The declarations are all this catalogue ships; the binaries
 * live with the fonts' owner. So a specimen page that does not load them can only print 26 names in the site's own
 * Instrument Sans, which is what the review saw: "\\"DM Sans\\" and \\"EB Garamond\\" look identical" — a specimen of
 * nothing, 26 times.
 *
 * There are three ways a family's letterforms can reach this page, and the design keeps them apart:
 *
 *  1. **This build's own binaries.** Instrument Sans and JetBrains Mono are self-hosted (\`app/public/fonts/\`,
 *     OFL-1.1, \`LICENSES-FONTS.md\`); their \`@font-face\` rules are in \`styles.css\` and arrive with the site. No
 *     request, no third party.
 *  2. **The font service, on this page only.** Every other family in the type is an openly licensed Google Fonts
 *     family. \`useFaces\` appends one \`<link rel=stylesheet>\` to \`fonts.googleapis.com\` while the surface is mounted
 *     and removes it when the surface goes, so the promise the rest of the site makes ("no third-party requests")
 *     is untouched on every other page, and the network cost is opt-in and page-scoped.
 *  3. **Nowhere.** A family the service does not serve, or a request that fails. The row then says so on itself and
 *     is set in the interface face — a name drawn in the wrong typeface is a picture of a typeface that does not
 *     exist, which is the one thing a specimen must never be.
 *
 * WHICH OF THE THREE, DECIDED BY ASKING, NOT BY A LIST. There is no table of "families Google has" in this file:
 * the URL is built from the families the manifest names, and then **each family is asked whether a face arrived**
 * (\`document.fonts.load(...)\` returns the faces it matched, and an empty array means none exist). A name added to
 * the manifest tomorrow is requested tomorrow, and says the truth about itself either way. The row's claim is
 * therefore always a measurement of this page in this browser — never an assumption about a vendor.
 *
 * SUBSET ON PURPOSE. The specimens set two strings — the family's own name at 40 px and one sample line — so the
 * request carries \`text=\` built from those exact characters. Measured (\`build/r9-home.md\` §6): the same 24 families
 * cost 431 KB of latin woff2 unfiltered and 208 KB with the subset, and a glyph the page never draws does not need
 * to cross the wire. The subset is *derived from the strings that are rendered*, so it cannot fall behind them.
 */

/** The line every specimen sets under its own name — the string the subset is cut from. */
export const SAMPLE = "Hamburgefonstiv 0123";

/** The families this build already has a binary for. Anywhere else they are a request, not a promise. */
const SELF_HOSTED = new Set(["Instrument Sans", "JetBrains Mono"]);

export const isSelfHosted = (family: string) => SELF_HOSTED.has(family);

/** \`family=DM+Sans:wght@400\` — the css2 spelling of one family, from the family's own name. */
const familyParam = (name: string) => \`family=\${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400\`;

/** The one stylesheet the surface needs: every family it draws, subset to the characters it draws them with. */
export function facesHref(names: string[]): string {
  const text = [...new Set((names.join("") + SAMPLE).split(""))].join("");
  return \`https://fonts.googleapis.com/css2?\${names.map(familyParam).join("&")}&text=\${encodeURIComponent(text)}&display=swap\`;
}

export type FaceState = "pending" | "ok" | "absent";

/**
 * Ask the page's own font set whether each family is really here.
 *
 * \`document.fonts.load()\` is the only honest test of the three: \`check()\` answers \`true\` for a family nobody serves
 * (there is nothing to load, so nothing is missing), which is exactly the false positive a specimen cannot afford.
 * The load is asked twice — once when the stylesheet fires \`load\`, once when the document's font set settles — and
 * the second answer wins if it is different, because a face that arrived late has still arrived.
 */
async function askFaces(names: string[]): Promise<Record<string, FaceState>> {
  const out: Record<string, FaceState> = {};
  for (const n of names) {
    if (SELF_HOSTED.has(n)) { out[n] = "ok"; continue; }
    let n_faces = 0;
    try { n_faces = (await document.fonts.load(\`40px "\${n}"\`, SAMPLE)).length; } catch { n_faces = 0; }
    out[n] = n_faces > 0 ? "ok" : "absent";
  }
  return out;
}

/**
 * The page-scoped stylesheet, and what actually came back.
 *
 * ONE REQUEST, THEN ONE PER FAMILY IF IT FAILS. A css2 URL with a family the service does not know is answered with
 * an error for the *whole* request, which would silently take 23 good faces down with one bad name. So a failed
 * stylesheet is retried family by family: the unknown one loses its own row, and nothing else moves.
 */
export function useFaces(names: string[]): Record<string, FaceState> {
  const [state, setState] = useState<Record<string, FaceState>>(() =>
    Object.fromEntries(names.map((n) => [n, SELF_HOSTED.has(n) ? "ok" : "pending"])),
  );
  const key = names.join("|");
  useEffect(() => {
    const asked = key ? key.split("|").filter((n) => !SELF_HOSTED.has(n)) : [];
    if (!asked.length) return;
    let live = true;
    const links: HTMLLinkElement[] = [];
    const set = (s: Record<string, FaceState>) => { if (live) setState((prev) => ({ ...prev, ...s })); };
    const add = (href: string) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.dataset.specimenFaces = "google";
      document.head.appendChild(l);
      links.push(l);
      return l;
    };
    const main = add(facesHref(asked));
    const settle = () => {
      document.fonts.ready.then(() => askFaces(asked)).then((s) => {
        if (!live) return;
        set(s);
        // whatever did not arrive may be one bad name in the batch: ask again, one family at a time
        const missing = asked.filter((n) => s[n] !== "ok");
        if (!missing.length) return;
        missing.forEach((n) => add(facesHref([n])));
        document.fonts.ready.then(() => askFaces(missing)).then((s2) => set(s2));
      });
    };
    main.addEventListener("load", settle);
    main.addEventListener("error", () => {
      // the batch was refused outright: go family by family, so one unknown name cannot take the page's faces with it
      asked.forEach((n) => add(facesHref([n])));
      settle();
    });
    settle();
    return () => { live = false; links.forEach((l) => l.remove()); };
  }, [key]);
  return state;
}
`;export{e as default};