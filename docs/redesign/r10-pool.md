# r10-pool — the serial gate is a budget now, and at 400 kbit/s it is a wash

`app/src/site/Tile.tsx`: `Pool.serial`'s flat `HOLD_MS = 6000` is now `holdBudget()` — the larger of (a) one demo
tile's bytes at the rate this pipe has been *measured* to move (`DEMO_TILE_BYTES / rate + rtt`, from real resource
timings, EWMA) and (b) the paint time the pool measured for the last tile that reported (mount → `reportReady`),
clamped to `[HOLD_FLOOR_MS 900, HOLD_CEIL_MS 6000]`. No measurement yet ⇒ the old 6000; a report still ends it early.
Nothing else moved: same file, fields beside `holding`/`holdTimer`, serial still on. The chosen gate is published on
`window.__gallery` (`holdMs`, `wireRate`, `wireRtt`) so a measurement can read it instead of guessing.

| run (400 kbit/s, 400 ms RTT, gzip + `no-store`, same tree) | mount times (ms) | `firstReadyMs` | `lastReadyMs` | load pre → post |
| --- | --- | --- | --- | --- |
| control, flat 6 s — run 1 | 9416 14718 20720 26716 32716 38716 | 14 718 | 62 216 | 4.71 → 3.26 |
| control, flat 6 s — run 2 | 9425 14725 20725 26726 32725 38725 | 14 725 | 62 226 | 5.91 → 3.86 |
| **adaptive gate — run 1** | 9527 14888 20288 25696 31088 36398 | **14 888** | **62 688** | 4.74 → 4.27 |
| **adaptive gate — run 2** | 9294 14653 19988 25337 30687 36061 | **14 653** | **62 386** | 3.97 → 4.69 |
| variant A: pipe budget alone (~2.3 s gate) | 9387 11987 14585 17188 19885 22485 | 18 185 | 60 985 | 3.54 → 3.45 |

**No longer a constant**: 6.00 s apart becomes 5.35 s apart, and it is derived — run 2 read `holdMs` 6000 for the
first mount and 5352 for the second (the first tile's own measured paint), wire 9.5 B/ms, rtt 4 ms.

**`lastReadyMs` did not fall — why.** Means of two runs each: first 14 721.5 → 14 770.5 (**+49 ms, +0.3 %**), last
62 221 → 62 537 (**+316 ms, +0.5 %**). Each tile starts 0.65 s sooner, its paint stretches ~1 s against the frames
already booting, the tail pays it back. This profile's ~60 s is *serialized work*, and one tile's paint here is
5.3–5.4 s: the old 6 s constant was already ≈ one tile. Variant A proves the gate is not the lever — a pure byte
budget shortens the staircase 17 s, buys the last demo 1.2 s (61.0 s) and **costs the first 3.5 s (18.2 s, +24 %)**;
the staircase time is not lost, it becomes contention. So the measured-paint variant ships: never longer than the old
constant, never shorter than what a tile actually costs here.

**Comparability.** Same box/tree/fixture; the two control runs are 10 ms apart (reproducible to 0.02 %). The after
runs are +316 ms on the last demo — 15× that spread but 0.5 % of the metric: *no material change*, neither win nor
regression. Every run started below load 5 (two 5.91s waited out with `sleep 60`); loads in each JSON. Gates
`qa/hero_check.mjs` + `qa/smoke.mjs` all ok on this build at :8841. `demo.tsx` untouched — measured,
Chromium gives the parent a same-origin frame entry with `responseStart: 0`, `transferSize: 0` (`responseEnd` = the
paint), so there is no per-frame byte progress to read; the budget uses the shell's transfers plus the tile's report.

**What would move `lastReadyMs`**: not the gate. All six tiles stay live (cap 9) while the tail boots — tile 6's own
mount → paint was 23.5 s with five demo documents already running on four cores at load 18. The lever is parking a
tile after it paints: `Pool`'s cap/eviction and the row's `cap` in `Featured.tsx`, outside this unit. Artifacts in
this directory: `r9-home-paint-400k-r10-pool-control.json`, `…-control2.json`, `…-r10-pool-after.json` (mandated),
`r10-pool-gates-after.json` (second adaptive run + gate/wire numbers). Variant A's JSON was overwritten by the second
variant's build; its row above is quoted from that one run.
