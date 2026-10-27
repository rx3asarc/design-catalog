# Font licences — the two faces the catalogue is set in

Both fonts are SIL Open Font License 1.1 (OFL-1.1). Both are self-hosted, committed as variable woff2 cut to
the latin subset, and both ship with the licence text beside them (`app/public/fonts/OFL.txt`, which is also
served at `/design-catalog/fonts/OFL.txt`). Nothing here came from a CDN at run time: the site promises "no
third-party scripts", and a CDN font is a third-party request.

| File | Family | Style / axes | Bytes | SHA-256 |
|---|---|---|---|---|
| `app/public/fonts/instrument-sans-latin-var.woff2` | Instrument Sans | variable, `wght` 400–700, `wdth` 100% | 30,092 | `2ee17598a98d8a59e4df8152d015bec9ab8e4d5672cc0ab42bef806b568e3971` |
| `app/public/fonts/jetbrains-mono-latin-var.woff2` | JetBrains Mono | variable, `wght` 400–800 | 31,432 | `83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be` |

Both files are real WOFF2 (`wOF2` signature), 1000 units/em, latin subset only (unicodes U+0000-00FF plus the
punctuation the site uses — quotes, dashes, ellipsis, middot, chevron, euro, arrows).

## Provenance

**Instrument Sans** — SIL OFL 1.1
- Web build retrieved 2026-10-27 from Google Fonts' WOFF2 endpoint (`instrumentsans/v4`), latin subset face.
  Source CSS: `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700`, which resolves the
  binary to `https://fonts.gstatic.com/s/instrumentsans/v4/pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1Q.woff2`.
- Upstream source and licence: `https://github.com/Instrument/instrument-sans` (`OFL.txt`) —
  "Copyright 2022 The Instrument Sans Project Authors".
- Catalogue item: `shadcn/font-instrument-sans`.

**JetBrains Mono** — SIL OFL 1.1
- Web build retrieved 2026-10-27 from Google Fonts' WOFF2 endpoint (`jetbrainsmono/v24`), latin subset face.
  Source CSS: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700`, which resolves the
  binary to `https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2`.
- Upstream source and licence: `https://github.com/JetBrains/JetBrainsMono` (`OFL.txt`) —
  "Copyright 2020 The JetBrains Mono Project Authors".
- Catalogue item: `shadcn/font-jetbrains-mono`.

## One discrepancy, stated rather than hidden

`app/manifest.json` records `"licence": "MIT"` for both `shadcn/font-*` entries. That field describes the
**shadcn registry item** (the snippet that wires a `next/font` import), not the font binary: the shadcn
registry JSON is MIT, the typeface underneath it is OFL. The binaries committed here are the OFL ones, and
the OFL text is what ships beside them. If the manifest is ever used as a licence inventory, this is the one
place it would mislead.

## What the OFL asks of us, and what we do

- Keep the copyright notice and licence with the font → `app/public/fonts/OFL.txt` (shipped).
- Do not sell the fonts on their own → the catalogue serves them from this site, never as a download link.
- Renamed copies are allowed; we did not rename the families, so `Instrument Sans` and `JetBrains Mono` stay
  the `font-family` names in `app/src/styles.css`.
- Embedded subsets are permitted, and the latin subset is one.
