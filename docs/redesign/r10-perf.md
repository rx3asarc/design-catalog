# r10-perf — the front page's paint at 400 kbit/s, measured

`r9-home-paint-throttled.mjs`, unmodified. 400 kbit/s down, 400 ms RTT, CDP. Build `main-BEhOFEjZ.js`
(confirmed live before each run). Box: 4 cores. Both runs measured the same tree; `/tmp/serve` was rebuilt to
`main-CS-REIiv.js` at 12:02:40, *after* the last run — these numbers describe `main-BEhOFEjZ.js`, which is no
longer what `:8830` serves.

| | before | after :8831 (gzip) | after :8830 (mandated) |
| --- | --- | --- | --- |
| build | `main-OZr2Pjcu.js` | `main-BEhOFEjZ.js` | `main-BEhOFEjZ.js` |
| server | gzip + no-store | gzip + no-store | plain Python `SimpleHTTP` |
| load avg, pre → post | 14.65 (post only, in JSON) | 4.17 → 18.10 | 4.38 → 13.28 |
| `firstMountedMs` | 13 442 | **10 018** | 33 843 |
| `firstReadyMs` | 23 966 | **15 426** | 51 890 |
| `lastReadyMs` | 56 166 | **69 618** | 52 642 |
| `wallMs` | 56 208 | 69 651 | 52 676 |
| tiles ready | 6 / 6 | 6 / 6 | 6 / 6 |
| wire | 394 KB / 64 req (128 KB demo) | 366 KB / 45 req (149 KB demo) | 1 579 KB / 45 req (651 KB demo) |

**The mandated run is not a comparable number.** `127.0.0.1:8830` is `/tmp/serve/serve.py`, stock Python
`SimpleHTTPRequestHandler` — no `Content-Encoding`. `curl -sI -H 'Accept-Encoding: gzip'` on
`assets/main-BEhOFEjZ.js` returns `Content-Length: 170606`; `gzip -c` of the same file is 32 804 (5.2×), and
`index.html` is 16 922 → 5 289 (3.2×). The before-run's server was `/tmp/r9-home-serve/serve.py` — gzip +
`no-store` (r9-home.md:4). The script's `"profile": "…server gzip"` string is a **hardcoded literal**, so the
1 579 KB JSON claims gzip while the server sent none: 4.3× the bytes down the same pipe, which alone explains
`firstMountedMs` 10.0 → 33.8 s. The :8831 column is the same script against the handler the before-run used
(fixture `r10-gzip-serve.py`); that is the column to compare.

**Honest comparability sentence.** Before ran at load 14.65; these from 4.38 and 4.17, each driving itself to
13.28 and 18.10. That is well over 2, the box was carrying five dev servers and six workers for the before-run,
and a quieter box is *expected* to be faster: **15.4 s is a floor, not an improvement claim.** The builds differ
(round 9 shipped between them), so part of every delta is build. The one metric that moved the wrong way —
`lastReadyMs` 56.2 → 69.6 s — moved against a favourable box, which is why it reads as mechanism, not noise.
No tile stalled; both runs finished inside `LIMIT_MS`.
## Where the time goes (after :8831)
45 requests, 366 KB. The six demo documents are **149 KB — ≈ 24.8 KB per tile**; the shell is the other 217 KB.
At 50 KB/s that is ~3.0 s of pipe for every demo on the page, ~4.3 s for the shell. Six documents each booting
their own copy of the demo runtime is real (`demo-DH-…js` 799 KB raw, 343 KB css, 213 KB styles, r9-home.md) but
over the wire Chromium deduplicates it: **the tail is not bytes** once gzip is on — it is the queue. Mount times:
10 018 → 15 426 → 21 518 → 27 517 → 33 517 → 39 517 ms, **six seconds apart, five times.** That is
`Pool.serial`'s 6 s failsafe firing on every tile because at 400 kbit/s no demo reports its first measured size
in under 6 s. Serial spends ~30 s of the 69.6 s on the gate, and the sixth tile has not started when the
before-run's last poster had already cleared. Its own mount→frame is 39 517 → 69 618 ms: one document + React
boot + six live demos contending for four cores. Before, `lastReadyMs` was six documents dividing one pipe (all
mounted by 14.1 s, posters 24.0–56.2 s); after, a 30 s queue plus one document's paint: serial bought the first
demo 8.5 s (24.0 → 15.4) and cost the last 13.5 s (56.2 → 69.6, +24%).

## The one thing I would change next

The 6 s failsafe is tuned for a fast pipe and at 400 kbit/s every tile pays it in full — it is now the largest
term in `lastReadyMs`. Make the serial gate adaptive: advance when the child reports, or when the demo
document's first byte has arrived plus a throughput-derived budget, instead of a flat 6 s — a 5 × 6 s staircase
becomes 5 × (time to first byte). Not implemented — this unit measures.

## Artifacts
`r10-home-paint-400k-after.json` mandated `:8830` run, no gzip, kept whole (script wrote `r9-home-paint-400k-after.json`, copied) ·
`r10-home-paint-400k-after-gzip.json` `:8831` gzip+`no-store` run, the comparable one ·
`r10-gzip-serve.py` the `:8831` fixture (r9 before-run handler, read-only, serves whatever is in `/tmp/serve`) ·
`r9-home-paint-400k-before.json` untouched
