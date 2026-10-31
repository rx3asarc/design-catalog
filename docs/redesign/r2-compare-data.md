# r2-compare-data — the store can now answer "which of these should I use?"

Round-2 review, item 2: *"nothing says what an item is good for"*, and the cheapest first step is a
comparison page — six sidebars across four libraries, put side by side, which no source site can do.
A page needs data in one call, with membership provenance, so this round adds a view, a CLI command, an
MCP tool, and the one concept the slug rule structurally could not name.

Read-only throughout: nothing here writes to `item`, `snapshot`, `artifact`, `fact`, `edge`, `port_note`
or `pick`. The only writes are an additive `CREATE VIEW`, and 1 concept + 25 memberships created under the
lead's authorised scope addition (see §3).

---

## 1. `compare` — one call, and it says who chose the set

```
query.py compare <concept-key> [--manifest PATH]     # JSON on stdout; exit 1 on an unknown key
catalog_compare {"concept": "<key>"}                    # MCP, same payload, same function
```

Payload:

| field | meaning |
|---|---|
| `concept_key`, `concept_label` | which set |
| `rule` | **how the set was chosen** — `slug-normalised`, or the literal `keyword: ...` matcher |
| `members`, `sources`, `by_source`, `methods` | size, breadth, and whether a human added anything |
| `items[]` | one row per (concept, item): `item_id, source, kind, slug, name, licence, file_count, bytes, dep_count, composition_count, has_demo, reference_only, withheld, used_here, url, page` |
| `facets.store` / `facets.build_fields` / `facets.build_source` | which facets came from the store, which from the built manifest, and from which file |
| `facets.null_means` | "not a fact this source can answer — absence, not zero" |

An unknown key is an error (exit 1) that also answers the useful question: `rule_a_group` reports what
slug-normalisation *would* have produced and why I1 rejected it. Before §3 created the keyword concept, `compare sidebar` exited 1 with
exactly that diagnosis — 18 rows from 1 source, dropped as "a listing pretending to be a comparison".

## 2. The view — `v_compare` (additive)

Applied to the live DB with `CREATE VIEW IF NOT EXISTS v_compare` (also appended to `schema.sql`, which is
where it is documented; the applied text is byte-identical to the file):

```sql
CREATE VIEW IF NOT EXISTS v_compare AS
SELECT c.key                        AS concept_key,
       c.label                      AS concept_label,
       s.slug || '/' || i.slug      AS item_id,
       s.slug                       AS source,
       i.kind                       AS kind,
       i.slug                       AS slug,
       i.name                       AS name,
       s.licence                    AS licence,
       nullif((SELECT count(*) FROM artifact a JOIN snapshot sn ON sn.id = a.snapshot_id
                WHERE sn.item_id = i.id AND a.kind = 'code'
                  AND sn.id = (SELECT max(id) FROM snapshot s2 WHERE s2.item_id = i.id)), 0) AS file_count,
       nullif((SELECT sum(coalesce(a.bytes, 0)) FROM artifact a JOIN snapshot sn ON sn.id = a.snapshot_id
                WHERE sn.item_id = i.id AND a.kind = 'code'
                  AND sn.id = (SELECT max(id) FROM snapshot s2 WHERE s2.item_id = i.id)), 0) AS bytes,
       nullif((SELECT count(*) FROM edge e WHERE e.from_item_id = i.id AND e.external = 1), 0) AS dep_count,
       nullif((SELECT count(DISTINCT t.slug) FROM edge e JOIN item t ON t.id = e.to_item_id
                WHERE e.from_item_id = i.id AND e.external = 0), 0) AS composition_count,
       NULL AS has_demo,
       NULL AS reference_only,
       CASE WHEN s.slug IN ('rareui','beautifului','transitions') THEN 1 ELSE 0 END AS withheld,
       NULL AS used_here,
       i.url AS url,
       CASE WHEN s.slug = 'rareui' THEN 'https://www.rareui.com/components/' || replace(i.slug, '-', '')
            WHEN s.slug = 'shadcn'  THEN CASE WHEN i.slug LIKE 'docs-%' THEN NULL
                                              ELSE 'https://ui.shadcn.com/docs/components/' || i.slug END
            ELSE i.url END AS page
FROM concept c
JOIN concept_item ci ON ci.concept_id = c.id
JOIN item i ON i.id = ci.item_id
JOIN source s ON s.id = i.source_id;
```

Two design notes, both load-bearing:

* **`has_demo`, `reference_only`, `used_here` are NULL in the view on purpose.** They are *build* facts,
  not store facts: a demo exists only if `gen.py` resolved its module, and `used_here` counts the shell's
  `data-catalog-item` attributes. `verify.py` already says as much about the demo split ("cannot be
  derived from the store"). `compare` fills them from the built manifest and records where they came from
  in `facets.build_*`; with no manifest reachable they stay `null` and `build_fields` is empty — never
  `False`, never `0`.
* **`nullif(...,0)` on `file_count`/`bytes`/`dep_count`/`composition_count`** reproduces the manifest's own
  rule: `publish_export.py:121` once summed an empty file list and shipped a measured-looking `0` bytes for
  178 items. `composition_count` counts *distinct internal slugs*, matching `gen.py`, and is a lower bound
  for the reason the manifest says so.

## 3. The set the rule could not name — concept `sidebar` (authorised)

Under the lead's scope addition, created by `concepts_keyword.py` (new, re-runnable, `method='keyword'`;
it never writes `method='human'`, never touches a derived concept, refuses to overwrite a concept that
exists under a different rule, and enforces I1 before writing):

```
key    sidebar
label  Sidebar
rule   keyword: lower(slug) LIKE '%sidebar%' OR lower(name) LIKE '%sidebar%' (any kind)
rows   25   sources 4 (beautifului, beui, rareui, shadcn)   kinds block 17, component 7, text 1
```

Why it had to be a keyword: `derive_concepts.py` normalises slugs, so shadcn's `sidebar`, `sidebar-01…16`
and `docs-components-sidebar` all key to `sidebar` — 18 rows from **one** source, dropped by I1 — while
beui and rareui prefix the same object (`ai-sidebar`, `proximity-sidebar`), keying somewhere else entirely.
No `GROUP BY` over slugs says "these are all sidebars". **Nothing else was created or changed**: `tabs`
already has 4 members (>=3), so it was left exactly as it was; no `pick` rows; no prose about any item.

**Expected count change, stated up front** (the only headline numbers that move):

| | before | after |
|---|---|---|
| concepts | 28 | **29** |
| concept memberships | 95 | **120** |

`verify.py` output before/after (§6) is otherwise identical.

## 4. Concept sweep — all 29 concepts, `compare` exit 0, >=1 member

Generated by calling `query.py compare <key>` once per concept (see §6 for the loop). "Implementations per
source" counts `kind in (component, block, effect)` — the docs/text rows are excluded, because a docs page
is not a rival implementation.

## Concept sweep — 29 concepts, 29/29 exit 0 with >=1 member

| concept | rule | members | sources | kinds | withheld | with demo | implementations per source | facets that differ |
|---|---|---|---|---|---|---|---|---|
| `accordion` | slug-normalised | 4 | 2 (shadcnx3, transitionsx1) | componentx1, effectx1, patternx1, textx1 | 1 | 2 | shadcnx1, transitionsx1 | source, kind, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only |
| `alert` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `approval-card` | slug-normalised | 2 | 2 (beautifuluix1, beuix1) | componentx2 | 1 | 0 | beautifuluix1, beuix1 | source, licence, file_count, bytes, dep_count, composition_count, withheld, url, page |
| `aspect-ratio` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `bounce-sidebar` | slug-normalised | 2 | 2 (beuix1, rareuix1) | componentx2 | 1 | 1 | beuix1, rareuix1 | source, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only |
| `breadcrumb` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `button` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 2 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `card` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `checkbox` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `code-block` | slug-normalised | 3 | 3 (beautifuluix1, beuix1, rareuix1) | componentx3 | 2 | 1 | beautifuluix1, beuix1, rareuix1 | source, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only |
| `collapsible` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `combobox` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `context-menu` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `drawer` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `faq` | slug-normalised | 2 | 2 (rareuix1, shadcnx1) | componentx1, textx1 | 1 | 0 | rareuix1 | source, kind, licence, file_count, bytes, dep_count, composition_count, withheld, url, page |
| `input` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `message` | slug-normalised | 2 | 2 (beuix1, shadcnx1) | componentx2 | 0 | 1 | beuix1, shadcnx1 | source, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `message-scroller` | slug-normalised | 2 | 2 (beuix1, shadcnx1) | componentx2 | 0 | 1 | beuix1, shadcnx1 | source, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `otp-input` | slug-normalised | 2 | 2 (beuix1, rareuix1) | blockx1, componentx1 | 1 | 1 | beuix1, rareuix1 | source, kind, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only |
| `popover` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `select` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `sidebar` | keyword | 25 | 4 (beautifuluix1, beuix3, rareuix3, shadcnx18) | blockx17, componentx7, textx1 | 4 | 20 | beautifuluix1, beuix3, rareuix3, shadcnx17 | source, kind, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only, used_here |
| `streaming-text` | slug-normalised | 2 | 2 (beautifuluix1, transitionsx1) | componentx1, effectx1 | 2 | 0 | beautifuluix1, transitionsx1 | source, kind, licence, bytes, url, page |
| `switch` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `table` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `tabs` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only, used_here |
| `toggle` | slug-normalised | 4 | 2 (shadcnx3, transitionsx1) | componentx1, effectx1, patternx1, textx1 | 1 | 2 | shadcnx1, transitionsx1 | source, kind, licence, file_count, bytes, dep_count, composition_count, withheld, url, page, has_demo, reference_only |
| `tooltip` | slug-normalised | 4 | 2 (beuix1, shadcnx3) | componentx2, patternx1, textx1 | 0 | 3 | beuix1, shadcnx1 | source, kind, file_count, bytes, dep_count, composition_count, url, page, has_demo, reference_only |
| `utils` | slug-normalised | 2 | 2 (rareuix1, shadcnx1) | componentx2 | 1 | 0 | rareuix1, shadcnx1 | source, licence, bytes, dep_count, withheld, url, page |

**Reading it:** 28 of 29 concepts have implementations from 2+ sources; `faq` does not (its second member
is shadcn's docs page — I1 counts sources, not implementations, so `faq` passes the invariant while being
a one-implementation group). In 19 slug-normalised concepts shadcn contributes a `pattern` demo row **and**
a `text` docs row, so a comparison page that renders `items[]` unfiltered will show documentation next to
implementations. Filter on `kind` — that is exactly why `kind` is a column.

## 5. Fixtures a comparison page can ship with

### Tier 1 — ship first (the review's headline)

**`sidebar`** (keyword, 25 rows, 4 sources, 20 with demos) — ids by kind:

* components (7): `beui/ai-sidebar`, `beui/animated-sidebar`, `beui/bounce-sidebar`, `rareui/bounce-sidebar`, `rareui/hook-sidebar`, `rareui/proximity-sidebar`, `shadcn/sidebar`
* blocks (17): `beautifului/sidebar-nav`, `shadcn/sidebar-01`, `shadcn/sidebar-02`, `shadcn/sidebar-03`, `shadcn/sidebar-04`, `shadcn/sidebar-05`, `shadcn/sidebar-06`, `shadcn/sidebar-07`, `shadcn/sidebar-08`, `shadcn/sidebar-09`, `shadcn/sidebar-10`, `shadcn/sidebar-11`, `shadcn/sidebar-12`, `shadcn/sidebar-13`, `shadcn/sidebar-14`, `shadcn/sidebar-15`, `shadcn/sidebar-16`
* docs text (1): `shadcn/docs-components-sidebar`

**`tabs`** (slug-normalised, 4 rows, 2 sources) — components: `beui/tabs`, `shadcn/tabs`;
pattern (demo): `shadcn/tabs-demo`; docs text: `shadcn/docs-components-tabs`.

| item_id | kind | licence | files | bytes | dep | comp | demo | withheld | used_here | page |
|---|---|---|---|---|---|---|---|---|---|---|
| `beautifului/sidebar-nav` | block | unclear | 1 | 18307 | 1 | None | False | 1 | 0 | `https://beautifului.dev/#sidebar-nav` |
| `beui/ai-sidebar` | component | MIT | 10 | 102818 | 6 | 3 | True | 0 | 0 | `https://beui.dev/components/agents/ai-sidebar` |
| `beui/animated-sidebar` | component | MIT | 5 | 49868 | 6 | 2 | True | 0 | 0 | `https://beui.dev/components/motion/animated-sidebar` |
| `beui/bounce-sidebar` | component | MIT | 3 | 9009 | 4 | 1 | True | 0 | 0 | `https://beui.dev/components/motion/bounce-sidebar` |
| `rareui/bounce-sidebar` | component | free-to-use (repo reports NOASSERTION) | 1 | 5315 | 1 | None | False | 1 | 0 | `https://www.rareui.com/components/bouncesidebar` |
| `rareui/hook-sidebar` | component | free-to-use (repo reports NOASSERTION) | 1 | 6532 | 1 | None | False | 1 | 0 | `https://www.rareui.com/components/hooksidebar` |
| `rareui/proximity-sidebar` | component | free-to-use (repo reports NOASSERTION) | 1 | 9631 | 2 | None | False | 1 | 0 | `https://www.rareui.com/components/proximitysidebar` |
| `shadcn/sidebar-01` | block | MIT | 4 | 8457 | None | 5 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-01` |
| `shadcn/sidebar-02` | block | MIT | 4 | 9296 | None | 5 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-02` |
| `shadcn/sidebar-03` | block | MIT | 2 | 6449 | None | 2 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-03` |
| `shadcn/sidebar-04` | block | MIT | 2 | 6533 | None | 3 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-04` |
| `shadcn/sidebar-05` | block | MIT | 3 | 8058 | None | 5 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-05` |
| `shadcn/sidebar-06` | block | MIT | 4 | 8333 | None | 5 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-06` |
| `shadcn/sidebar-07` | block | MIT | 6 | 16211 | None | 6 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-07` |
| `shadcn/sidebar-08` | block | MIT | 6 | 14794 | None | 6 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-08` |
| `shadcn/sidebar-09` | block | MIT | 3 | 14051 | None | 8 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-09` |
| `shadcn/sidebar-10` | block | MIT | 8 | 19997 | None | 6 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-10` |
| `shadcn/sidebar-11` | block | MIT | 2 | 5391 | None | 4 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-11` |
| `shadcn/sidebar-12` | block | MIT | 5 | 9455 | None | 7 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-12` |
| `shadcn/sidebar-13` | block | MIT | 2 | 4319 | None | 4 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-13` |
| `shadcn/sidebar-14` | block | MIT | 2 | 5747 | None | 2 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-14` |
| `shadcn/sidebar-15` | block | MIT | 11 | 24923 | None | 8 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-15` |
| `shadcn/sidebar-16` | block | MIT | 8 | 16351 | None | 8 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/sidebar-16` |
| `shadcn/sidebar` | component | MIT | 1 | 21713 | 4 | 6 | True | 0 | 1 | `https://ui.shadcn.com/docs/components/sidebar` |
| `shadcn/docs-components-sidebar` | text | MIT | None | None | None | None | False | 0 | 0 | null |

| item_id | kind | licence | files | bytes | dep | comp | demo | withheld | used_here | page |
|---|---|---|---|---|---|---|---|---|---|---|
| `beui/tabs` | component | MIT | 4 | 30123 | 5 | 1 | True | 0 | 0 | `https://beui.dev/components/motion/tabs` |
| `shadcn/tabs` | component | MIT | 1 | 3772 | 2 | None | True | 0 | 1 | `https://ui.shadcn.com/docs/components/tabs` |
| `shadcn/tabs-demo` | pattern | MIT | 1 | 2659 | None | 1 | True | 0 | 0 | `https://ui.shadcn.com/docs/components/tabs-demo` |
| `shadcn/docs-components-tabs` | text | MIT | None | None | None | None | False | 0 | 0 | null |

Facets that actually differ across `sidebar` members: `source, kind, licence, file_count, bytes,
dep_count, composition_count, withheld, url, page, has_demo, reference_only, used_here` — i.e. every facet
the view carries. Across `tabs`: the same set minus `used_here` (only `shadcn/tabs` is rendered by the
shell: `used_here = 1`).

### Tier 2 — clean two-way comparisons, no docs noise (2 rows each, both implementations)

`message`, `message-scroller`, `otp-input`, `bounce-sidebar`, `approval-card`, `code-block` (3 sources,
2 of them withheld), `utils` (a helper, weak as a page), `streaming-text`, `faq` (only one implementation
— see §4).

### Tier 3 — the 19 four-row primitives (17 `shadcn`+`beui`, 2 `shadcn`+`transitions`), ship behind a `kind` filter

`accordion, alert, aspect-ratio, breadcrumb, button, card, checkbox, collapsible, combobox, context-menu,
drawer, input, popover, select, switch, table, tabs, toggle, tooltip` — 4 rows each, of which 2 are
implementations (`shadcn` + `beui`, or `shadcn` + `transitions` for `accordion`/`toggle`). The other two
rows are shadcn's demo *pattern* and docs *text*.

### Tier 4 — do not ship yet

`faq` (one implementation), `utils` (not a UI thing). `code-block` is shippable only as a licence page:
2 of its 3 sources are withheld, so the page can compare weights/structures but cannot show their code.

**Deviation from the brief's expected measure, stated plainly:** the brief expected `compare sidebar` to
return "six components + four blocks". The store holds **7 component rows (6 distinct component names —
`bounce-sidebar` exists in both beui and rareui), 17 blocks (16 shadcn `sidebar-NN` + beautifului's
`sidebar-nav`) and 1 docs text page**. There is no set of 4 in the data. Likewise the review's "seven tabs"
is not in the store: `tabs` has 2 implementations + 1 demo pattern + 1 docs page. I did not trim the
matcher to hit either number.

## 6. Measurements

**Invariants — before and after, exit 0 both times** (`python3 /root/design-catalog/verify.py`):

```
BEFORE  manifest not named (--manifest PATH), so I5/I6 ran at gen time only | beautifului: 21 items | beui: 110 items |
        rareui: 29 items | shadcn: 566 items | transitions: 43 items | code files 1821 (7,628,525B) | facts 1776 |
        verdicts 159 | concepts 28 (95 memberships) | picks 0 | public verdicts 0/159 | 11 items carry no code by
        declaration (paywalled)
        all invariants hold                                              [exit 0]

AFTER   ... identical ... | concepts 29 (120 memberships) | ...          all invariants hold   [exit 0]

AFTER, with the built manifest (`--manifest /root/design-catalog-site/app/manifest.json`, so I1-I6 all run):
        manifest manifest.json: 769 items | has_demo 486 | reference_only 283 | withheld 93 |
        591 item(s) in the store have code, 178 must publish null      all invariants hold   [exit 0]
```

Headline counts unmoved: 769 items · 486 with a demo · 283 reference-only · 93 withheld · 591 with files ·
178 null bytes · 159 verdicts · 0 published. Only concepts 28->29 and memberships 95->120 moved, as
authorised in §3.

**`PRAGMA integrity_check`** = `ok` before and after.

**Facet parity with the published manifest — all 769 items, not sampled.** The view's expressions were run
against every item and diffed against `app/manifest.json`: `file_count`, `bytes`, `dep_count`,
`composition_count`, `withheld`, `page`, `licence` — 0 mismatches, including the 178 nulls and the null
`dep_count` on 517 items. (`has_demo`/`reference_only`/`used_here` are not in the store by design, §2.)

**`compare sidebar` — ids** are listed in §5. It returns 7 components, 17 blocks, 1 text row, 4 sources,
`rule = keyword: lower(slug) LIKE '%sidebar%' OR lower(name) LIKE '%sidebar%' (any kind)`.

**Every concept**, one call each:

```bash
python3 -c "import sqlite3,json;c=sqlite3.connect('file:design-catalog.db?mode=ro',uri=True);\
print(json.dumps([r[0] for r in c.execute('select key from concept order by key')]))" \
| jq -r '.[]' | while read k; do python3 query.py compare "$k" >/dev/null || echo "FAIL $k"; done
```

29 keys, 0 failures, all >=1 member (§4 table).

**CLI/MCP parity — proven, not intended.** `catalog_compare` and `query.py compare` call the same
function (`query.compare_payload`), and the outputs were diffed byte-for-byte:

```
$ python3 query.py compare sidebar > /tmp/cli-sidebar.json
$ (JSON-RPC) tools/call catalog_compare {"concept":"sidebar"} > /tmp/mcp-sidebar.json
$ diff /tmp/cli-sidebar.json /tmp/mcp-sidebar.json     # (both json.dumps(indent=1))
-> byte-identical (sidebar);  payload keys: concept_key, concept_label, rule, members, sources,
   by_source, methods, items, facets          members 25 / sources 4
-> byte-identical (tabs) as well             members 4  / sources 2
```

**Verdict policy** (`additive; default off`):

```
$ python3 query.py search sidebar | grep -c verdict          -> 0
$ python3 query.py search sidebar --verdicts | grep -c verdict -> 25
$ python3 query.py get sidebar-nav   -> port_notes present (the "ported ... conversation rail" note)
```

`catalog_get` still returns `port_notes`, and its description now says they are our internal research,
never published on the site. `catalog_search`'s description says the same about `verdict`. 0 of 159
verdicts are public, so nothing human-facing changes.

## 7. Backups (all in `/root/design-catalog/`, all `cp -p`, all verified present)

```
design-catalog.db.bak-20261028T191539     13,135,872B   (taken before the view existed)
query.py.bak-20261028T191539
mcp_server.py.bak-20261028T191539
schema.sql.bak-20261028T191539
design-catalog.db.bak-20261027T2200       earlier backup, left as it was
```

Files touched: `schema.sql` (+53 lines, -1 blank), `query.py` (+156, -5 docstring/select lines),
`mcp_server.py` (+48, -5 description lines), new `concepts_keyword.py` (6,014B). Not touched:
`verify.py`, `publish_export.py`, every `ingest_*.py`, `derive_concepts.py`, `migrate_curation.py`.

## 8. What the lead must wire

1. **A comparison surface that reads the payload as-is.** One page per concept key; `items[]` is already
   the table. Group by `kind` before rendering — otherwise 19 concepts show shadcn's docs page and demo
   `pattern` beside two real implementations (§4).
2. **Print the `rule` verbatim, next to the set.** "Sidebar — 25 items matching `lower(slug|name) LIKE
   '%sidebar%'`" is honest; an unlabelled grid is a claim. This is the whole reason the column exists.
3. **Render `null` as an absence, not 0**: `file_count`/`bytes`/`dep_count`/`composition_count`/
   `has_demo`/`used_here` are null where unknown (178 items have no captured code). A `0` printed for
   those is the `publish_export.py:121` defect coming back.
4. **`withheld = 1` is a licence fact** (beautifului 21, rareui 29, transitions 43): the page may name
   those items and their URLs, and must not embed their source. Only `shadcn` and `beui` are publishable.
5. **`has_demo` / `used_here` need the built manifest.** If the site build is not at
   `/root/design-catalog-site/app/manifest.json`, pass `--manifest` (CLI) or `manifest` (MCP) — otherwise
   those three fields stay null. Do not infer them from `variants` on the page.
6. **Decide whether `sidebar`'s 16 shadcn blocks belong on the same page as its 7 components.** The data
   supports both (kind is a column); the layout cannot. That is a product decision, not a data one.
7. **If `derive_concepts.py` is ever re-run and grows a `sidebar` key with 2+ sources**, it will collide
   with the keyword concept (`concept.key` is unique, and the deriver does `ON CONFLICT(key) DO UPDATE SET
   rule`). `concepts_keyword.py` refuses to overwrite an existing rule; the deriver does not. Re-run
   `concepts_keyword.py` afterwards, or teach the deriver to skip keys it did not create.

## 9. COULD NOT DO / UNSURE

* **COULD NOT DO the brief's exact measure** ("six components + four blocks"). The store has 7 component
  rows / 17 blocks / 1 text page / 4 sources. I reported the real sets rather than tune a matcher to a
  number the data does not support.
* **UNSURE whether `sidebar` should include `shadcn/docs-components-sidebar`** (kind `text`, a docs page).
  It is genuinely about sidebars, so the keyword matcher pulls it honestly; it is not an implementation.
  I left it in and said so, per the lead's instruction not to filter silently. Removing it is one line in
  `concepts_keyword.py` (`AND i.kind <> 'text'`) — a human's call.
* **UNSURE about `faq`, `utils`** as comparison pages: `faq` has one implementation, `utils` is not a UI
  object. I flagged them rather than dropping their concepts (dropping would need a human, and `faq`
  satisfies I1 as written).
* **NOT DONE, deliberately:** no `pick` rows, no prose about any item, no change to `v_item_overview`
  (so nothing human-facing gains a verdict), and no edit to `publish_export.py`/`gen.py` — the site can
  adopt `compare` when the lead wires §8.
