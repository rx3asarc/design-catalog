# Round 7 — the first screen, before the manifest arrives

The boot shell (`app/index.html`) already draws the front page's heading, lede and six real tiles from inline
CSS and build-time data. What it could not do is *answer a click*: `site/lib.ts` did
`import manifest from "../../manifest.json"`, so all 583 KB of the catalogue sat inside the entry's own chunk and
React could not run until it had arrived. This unit splits that file along the line the surfaces already follow,
measures what it bought, and says where the rest of the money is.

Measured on the built site, never modelled. Every number below is out of the browser's own performance timeline
(`app/probe-firstpaint.mjs`, new — see §2).

---

## 1. What was split, and where the line was drawn

`catalogSplit()` in `app/vite.config.ts` reads `manifest.json` (still the only file on disk; `app/gen.py` is
untouched) and projects it into two payloads:

| | fields | size (JSON, gz −9) | where it goes |
| --- | --- | --- | --- |
| **CORE** | everything except the four below | 39.4 KB | bundled into the entry (`virtual:catalog-core`) — the shell, the rail, the palette, the counts, the tiles and the front page read it |
| **DETAIL** | `files`, `variants`, `behaviour`, `renderNote` | 14.6 KB | `dist/manifest/detail-fe2a6e189f.json`, content-hashed, fetched **once** by `site/lib.ts` when an item page or a comparison opens |
| whole file | — | 55.1 KB | `app/manifest.json`, unchanged, and what the QA gates read from disk |

Why that line and not another one: the four detail fields are per-item arrays that only `site/ItemPage.tsx` and
`site/Compare.tsx` print, and both of those are already `lazy` surfaces with their own chunk, so the detail file
travels with the chunk that needs it. Everything else in the manifest *is* read before the first screen can be
interactive — the rail's 769 rows (name, slug, source, kind, category), the palette's ranking (name, slug, source,
category, concepts), every count on the page (`counts.ts`), the six hero tiles' facet lines, and the front page's
terminal card (`one_line`, `install`).

**The two invariants that make the split honest.** `has_demo` and `file_count` are *counts of* arrays that now
live in DETAIL, and four places used to read the arrays to answer the same question (`site/counts.ts` twice,
`site/App.tsx`, `site/Rail.tsx`, `site/Tile.tsx` — the "no demo" marker, the rendered count, the demo count).
They read the published counts now, and `catalogSplit()` **fails the build** if any item's `has_demo` disagrees
with `variants.length`, or its `file_count` with `files.length`. Checked against this manifest: 0 disagreements
in 769 items, both ways. A future ingest that publishes a contradicting count stops the publish rather than
shipping two spellings of one fact.

**The detail payload carries no ids.** Rows are aligned to CORE by manifest order (id would be another 4 KB
gzipped the browser already has); `loadDetail()` refuses a payload whose length is not CORE's, and the filename
carries a sha256 prefix, so a payload from another build cannot be mis-merged. The merge is
`Object.assign(items[i], row)` — one array, one identity per item, no second copy to drift. `Item` types the
four fields as optional on purpose: `useDetailItem()` is the only door, and it hands back `ItemFull` (with
`files`/`variants` required) or `null`, so a surface cannot print "0 files" for files that have not arrived.
Both waiting surfaces render `site/DetailWait.tsx`, which is the shell's existing "Fetching …" sentence while
loading and, if the file never arrives, one honest sentence instead of zeroes.

---

## 2. How it was measured

`app/probe-firstpaint.mjs` (new). The brief named `app/probe-perf2.mjs` and `app/probe-paint.mjs`; neither is in
the repository — a `find` for `probe*` outside `node_modules` returns only `probe_behaviour.mjs` — so the probe
had to be written. It serves a built directory the way GitHub Pages does (base path `/design-catalog/`, gzip on
text, immutable assets), then drives Chromium through playwright.

Per route it reports: **gz bytes** = the sum of `encodedBodySize` over every response the document asked for (the
wire's bytes, not the file sizes); **requests**; **first paint** (`first-contentful-paint`); and **first
interactive** = the first moment a click on the shell's palette door actually opens the palette (polled every
50 ms on the real `show()` path — the trigger is idempotent, so a poll that lands before React mounts costs
nothing). Time-to-interactive is taken on the round 5 profile: **400 kbit/s down, 400 ms RTT**.

Both worktrees were built and served separately (`npx vite build`, 2.2 min each) and the served `index.html`'s
entry hash was read back before any number was trusted: `main-BltL8WrW.js` (master) vs `main-BaH2M1VA.js` (this
branch).

**A port collision, and it was mine to find.** `ss -ltnp | grep 8872` showed 8872 already served — a foreign
build (`python3 -m http.server --directory /tmp/r7-serve-prev`, serving `/tmp/prev-r7/docs`) that had been up for
two minutes before this session started. This is exactly the trap the brief warns about, so this unit measured on
**8899** (gates) and **8911/8912** (probe), never on 8872.

**Two honest caveats about the timing column.** The box was memory-exhausted for part of this run (7.7 GB total,
0 available at one point; two gate runs died with "Target page, context or browser has been closed"), so FCP
moved 232–2492 ms between runs of the *same* build. The two rows in §3 were therefore taken back-to-back at the
end of the run, after the pressure cleared, and even then the run-to-run spread on `interactive` is ±300 ms.
And the probe's server is HTTP/1.1: with 62 requests at 400 ms RTT, latency is a real part of that 10.4 s, which
GitHub Pages' HTTP/2 would amortise. Treat `interactive` as a relative signal, not a prediction.

---

## 3. Before and after

1440×900, cold context per route, gzip level 9 on the server, `master` = `23d8b824` (worktree
`/mnt/HC_Volume_105573741/dc-r7-firstpaint-base`), this branch = `fleet/r7-firstpaint`.

| route | | gz bytes on the wire | requests | first paint | first paint @50 KB/s | first interactive @50 KB/s |
| --- | --- | --- | --- | --- | --- | --- |
| `#/` | before | 389 493 | 62 | 284 ms | 764 ms | **10 544 ms** |
| `#/` | after | **374 322** | 62 | 232 ms | 636 ms | **10 414 ms** |
| `#/g` | before | 391 514 | 56 | 272 ms | 672 ms | 10 323 ms |
| `#/g` | after | **376 343** | 56 | — | 696 ms | 10 006 ms |
| `#/chrome` | before | 392 487 | 57 | 200 ms | 764 ms | 10 558 ms |
| `#/chrome` | after | **377 319** | 57 | — | 680 ms | 10 022 ms |
| `#/i/shadcn/button` | before | 401 695 | 80 | 156 ms | 676 ms | 10 231 ms |
| `#/i/shadcn/button` | after | 401 385 | 75 | — | 636 ms | 10 277 ms |

**Δ on the three routes the split helps: −15 171 gz bytes (−3.9 %), −15 171, −15 168.** Item page: −310 B
(a wash — it needs both halves, plus one extra request).

Proof the detail file is fetched once and not per navigation: two item pages opened in one session (a click on the
pager, no reload) produced exactly **1** request for `manifest/detail-fe2a6e189f.json`. The rail's
`sessionStorage` filter (`FILTER_KEY`) behaves identically before and after: typing "side" gives 9 rail rows and
still gives 9 after a reload, with `{"q":"side","from":""}` in `sessionStorage` — same as master.

---

## 4. What the numbers say — including the part that is not flattering

1. **The manifest was never the whole bill, and the first screen really does read most of it.** It gzipped to
   55.1 KB, but rolldown had put it in the same chunk as react-dom, so the *entry* paid ~55 KB. Of those 55 KB,
   only 14.6 are per-item detail no first-screen surface reads. The remaining 39.4 are the identity and facts of
   769 items, printed by the rail, ranked by the palette, counted on the page and facetted on the hero tiles. So
   the split's honest ceiling — without changing what the front page says — was ≈14.6 KB, and this branch takes
   ~15.2 (= 14.6 plus the regrouping).
2. **First interactive did not move.** Δ −130 ms on a 10.5 s measurement, inside the run-to-run spread. Cutting
   15 KB off a 389 KB page at 50 KB/s should be ~300 ms, and it is not separable from noise here. Saying
   otherwise would be reading a wish into a number.
3. **Where the rest of the 374 KB actually is** (built `dist/`, gz): react-dom `65.7` · core+shell code `65.0` ·
   entry `main` `50.6` · `styles.css` `47.8` · 45 small dependency chunks `~71`. The manifest's first-screen
   share is now ~10 % of the bill. **The next unit that wants a smaller first interactive should not start at
   `manifest.json`; it should ask whether the rail's 769 rows and the palette's 769 documents are both required
   before the first click** — that is the only remaining lever of this size, and it means rendering the rail from
   a section-count payload and letting the leaves arrive after the first interaction. That is a UX decision, not
   a data decision, and it is not this unit's to make.
4. **The split is not free.** Bytes that used to share a gzip window now live in three files, and the item page
   pays for both halves: −310 B net there. The win is on the routes that do not need per-item detail, which is
   three of the four measured.

---

## 5. Gates

| gate | result |
| --- | --- |
| `node qa/smoke.mjs` (6 routes × 2 viewports) | **SMOKE: all routes ok** |
| `node qa/r2_check.mjs` | **R2: ok** — 42 checks, incl. hero parity (static 6 · mounted 6, ids identical), 6/6 whole tiles at 1440, band 138 px at 390, 0 console errors |
| `node qa/assets_check.mjs <dist>` | **ASSETS: ok — 2 329 references, 3 051 files** |
| `node qa/slice3_check.mjs` | **10 ok, 1 FAIL** — `first paint light: at commit="dark" settled="dark"` |
| `npx vite build` | ok (2.2 min) |

The slice3 failure is **pre-existing and not caused by this branch**: run against a `master` build in a second
worktree, the same check fails with the identical string. The site's own rule (`index.html`'s theme script:
"a visitor who has never chosen gets dark whatever their OS says") makes a light-OS first paint dark on purpose,
and the check asserts the opposite. Fixing it means changing either the check or the brand rule — neither is this
unit's file, so it is reported, not touched.

---

## 6. What I did not do

- **Did not defer CORE behind the first interactive** (a boot payload of counts + the six hero rows, with the
  rail, the palette and the terminal card arriving later). It is the only remaining cut of this size — ≈39 KB gz,
  ≈0.8 s at 50 KB/s — and it needs three surfaces to render honestly from a partial catalogue (the rail is on the
  first screen at 1440; an empty rail is worse than a late one), plus every module-scope derivation in
  `site/route.ts`, `site/counts.ts` and `site/Home.tsx` to become a function of "the catalogue has arrived". That
  is a round of its own, and §4.3 says what it should be asked to justify first.
- **Did not move `one_line` / `install` / `url` to DETAIL** (another ~19 KB gz). Those three print the front
  page's terminal card, whose first row sits at y≈865 on a 900 px viewport, and an item's outbound link. Trading a
  visible card for 19 KB would have been a content change dressed as a performance win.
- **Did not touch** `app/gen.py`, `manifest.json`, `app/src/tokens.css`, `docs/**`, `publish.sh`, `master`, or any
  other worktree. `git status` on this branch lists only the 10 modified and 3 new files named below.
- **Did not publish anything** and did not open the live site; the built directory was served locally only.
- **Did not re-measure on the live site** (rx3asarc.github.io) — the numbers here are a local server with the same
  base path, gzip and cache headers, and §2 says where that differs.

## 7. Files

`app/vite.config.ts` (`catalogSplit()` + the two invariants) · `app/src/site/lib.ts` (CORE import, `loadDetail`,
`useDetail`, `useDetailItem`, `ItemFull`) · `app/src/site/DetailWait.tsx` (new) · `app/src/virtual-catalog.d.ts`
(new) · `app/src/site/ItemPage.tsx` · `app/src/site/Compare.tsx` · `app/src/site/counts.ts` ·
`app/src/site/Rail.tsx` · `app/src/site/Tile.tsx` · `app/src/App.tsx` · `app/src/provenance.tsx` ·
`app/src/site/ChromePage.tsx` · `app/probe-firstpaint.mjs` (new).

`node app/probe-firstpaint.mjs <built-dir> <port>` reproduces §3.
