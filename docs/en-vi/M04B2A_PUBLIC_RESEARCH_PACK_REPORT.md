# M04B2A Public Research Pack Integration

## Status

**PASS — integration complete; STOP.** This task started from commit
`d85ae6dd54b661c0023c00b8fd470336f14e8c1e` and used only the supplied
M04B2A research pack. No web access, crawling, independent terminology
research, medical review, or bulk translation was performed.

The pack remains research evidence. It does not create production terminology,
Atlas↔FMA mappings, Atlas↔TA2 mappings, Vietnamese aliases, search forms, or
release approvals.

## Supplied research pack

The supplied NVH2008 JSONL was preserved verbatim at
`data/terminology/research/corpora/nvh2008-public-research-seed.jsonl`. It
contains 28 schema-valid records with source ID `NVH2008` and exact revision
`NVH-2008-312P`.

The supplied pack remains preserved at
`docs/en-vi/research/M04B2A/M04B2_PUBLIC_RESEARCH_PACK.json`. It contains:

- 31 explicit concept bindings;
- HMU2022 corroboration notes;
- status `RESEARCH_ONLY_NOT_RELEASE`;
- release state `sourceVerified=0`, `medicalReviewed=0`,
  `releaseEligible=0`, `searchableVietnamese=0`.

The combined index retains separate input provenance for both
`fipat-ta2-2019.jsonl` and `nvh2008-public-research-seed.jsonl`.

## Record counts

| Source | Records | Result |
| --- | ---: | --- |
| FIPAT TA2 | 7,112 | unchanged from M04B1 |
| NVH2008 | 28 | added research records |
| Combined index | 7,140 | 7,140 indexed; 0 duplicates |

All records pass `bulk-source-corpus.schema.json`. Source IDs, revisions,
locators, raw English/Vietnamese fields, and source provenance are retained.
The NVH Vietnamese alias arrays remain empty; pack notes and English aliases
were not promoted to Vietnamese aliases or search forms.

## Research annotations

Because the existing M04A output had no curated-binding field, explicit pack
bindings are exposed only under `researchAnnotations`:

- top-level output annotation schema: `m04b2a-research-annotations-1`;
- 31 concept bindings and 31 bound concepts preserved;
- per-concept binding annotations retain disposition and candidate values;
- binding dispositions act only as research safety guards for the existing
  review classification;
- no annotation is copied into `data/terminology/entries.json` or production
  terminology fields.

The output preserves the existing M03C decisions: right/left hip bone and
foot navicular remain open conflicts; side-specific terms are not composed;
the plural NVH source `External intercostal muscles` is not silently changed
to the singular atlas wording; fascia-lata zone remains a scope review; and
the generic vertebral-column symphysis does not generate level-specific terms.

## 3,432-concept match statistics

| Measure | M04B1 | M04B2A | Delta |
| --- | ---: | ---: | ---: |
| Concepts processed | 3,432 | 3,432 | 0 |
| Source-matched concepts | 557 | 559 | +2 |
| Exact English match | 557 | 559 | +2 |
| Normalized-English-only match | 0 | 0 | 0 |
| Latin match | 557 | 557 | 0 |
| No source match | 2,875 | 2,873 | -2 |
| Authoritative Vietnamese research evidence | 0 | 19 | +19 |
| Normalized candidate collisions | 0 | 0 | 0 |

Review buckets:

| Bucket | M04B1 | M04B2A | Delta |
| --- | ---: | ---: | ---: |
| `HIGH_CONSENSUS_CANDIDATE` | 0 | 5 | +5 |
| `VARIANT_REVIEW` | 2 | 13 | +11 |
| `CONFLICT_REQUIRES_ADJUDICATION` | 3 | 3 | 0 |
| `ONTOLOGY_SCOPE_REVIEW` | 9 | 10 | +1 |
| `LATERALITY_REVIEW` | 6 | 8 | +2 |
| `SOURCE_GAP` | 2,520 | 2,500 | -20 |
| `IDENTITY_GAP` | 1 | 2 | +1 |
| `AGGREGATE_OR_COMPOSITE_REVIEW` | 891 | 891 | 0 |

The FIPAT TA2 record count and Latin coverage are unchanged. The incremental
NVH evidence adds two new exact-English concept matches and 19 concepts with
research-eligible Vietnamese evidence; it does not make any evidence
production-approved.

## M03C regression

The frozen M03C set contains 50 concepts:

```text
pass=49
input gaps=1
mismatches=0
```

The one input gap is retained as an explicit gap. Conflict and scope
decisions remain blocking or review-gated, and no winner is selected from the
research pack.

## Production safety

Production overlays remain unchanged. Validation reports:

```text
searchable=0
SOURCE_VERIFIED=0
MEDICAL_REVIEWED=0
releaseEligible=0
reviewers=0
release status=UNRELEASED
```

`data/terminology/entries.json`, `data/terminology/reviewers.json`, and
`data/terminology/release.json` are structure-equivalent to the starting
commit. No Vietnamese aliases or search forms were activated.

## Validation

The following checks passed:

```text
npm run test:m03a
npm run test:m03c
npm run test:m04a
npm run test:m04b1
npm run test:m04b2a
npm run test:terminology
npm run test:localization
npm run check
npm run build
node scripts/validate-atlas.mjs
node scripts/validate-interactions.mjs
git diff --check
```

The M04B2A-specific tests cover schema validation, exact revision mismatch
rejection, research-only concept bindings, no synthesized side-specific
names, open conflicts, plural/singular preservation, fascia and vertebral
scope safeguards, unchanged production overlays, and zero production
coverage.

## Remaining research gaps

- NVH2008 remains research evidence pending legitimate source verification;
  the supplied public access path is not treated as production authority.
- HMU2022 material remains corroboration notes only, not a new corpus.
- Vietnamese preferred-term adjudication, alias/search review, ontology
  identity, side/laterality review, and medical review remain undone.
- No bulk translation or M04B2 final release work was started.

**STOP after M04B2A integration.**
