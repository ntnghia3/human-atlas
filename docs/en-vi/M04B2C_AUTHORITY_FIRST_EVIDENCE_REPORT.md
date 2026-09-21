# M04B2C Authority-First Vietnamese Evidence Report

Status: `PASS` — research-only integration completed from commit `a63dcba6c3959aad19126889d57f4c2bdd5b1243`.

This report uses only the supplied M04B2C research pack. No web, crawling, independent terminology research, medical review, AI translation, or adjudication was performed.

## Corpus and provenance

The supplied corpus was validated against `data/terminology/research/bulk-source-corpus.schema.json` and preserved verbatim at `data/terminology/research/corpora/m04b2c-vi-authority.jsonl`.

| Source | Records | Exact catalog revision |
| --- | ---: | --- |
| HMU2022 | 31 | `HMU-2022-ISBN-9786046658351` |
| UMP2023_T2 | 12 | `UMP-2023-PROGRAM-T2-437P` |
| Total | 43 | — |

The supplied matrix and conflict queue remain under `docs/en-vi/research/M04B2C/`. The combined index contains FIPAT TA2 7,112 records, NVH2008 28 records, HMU2022 31 records, and UMP2023_T2 12 records: 7,183 input/indexed records, zero duplicate evidence records, zero unresolved sources, and zero revision mismatches.

## M04B2C research dispositions

All 33 matrix concepts gained Vietnamese authority evidence. Twenty-three concepts have one institutionally distinct authority source. Ten concepts have at least two institutionally distinct authority sources:

`FMA16585`, `FMA24499`, `FMA50863`, `FMA6964`, `FMA9600`, `FMA9611`, `FMA9613`, `FMA9625`, `FMA9708`, `FMA9710`.

The seven supplied high-consensus candidates are:

`FMA50863`, `FMA6964`, `FMA9600`, `FMA9611`, `FMA9613`, `FMA9708`, `FMA9710`.

The one supplied variant review is `FMA9625` (`Cơ trâm - móng` / `Cơ trâm móng`). The two blocking conflicts remain unresolved and retain both forms without a winner:

- `FMA16585 hip bone`: HMU2022 `Xương chậu`; UMP2023_T2 `Xương hông`.
- `FMA24499 navicular bone of foot`: HMU2022 `Xương thuyền`; UMP2023_T2 `Xương ghe`.

The conflict queue remains research-only. No majority, source-count, newest-source, side-specific, or synthesized terminology decision was made.

## 3,432-concept coverage and M04B2A delta

The deterministic matcher processed exactly `3,432/3,432` atlas concepts.

| Metric | M04B2A baseline | Integrated M04B2C | Delta |
| --- | ---: | ---: | ---: |
| Source-match concepts | 559 | 565 | +6 |
| Exact-English matches | 559 | 565 | +6 |
| Safely normalized-English matches | 0 | 0 | 0 |
| Latin matches | 557 | 557 | 0 |
| No-source-match concepts | 2,873 | 2,867 | -6 |
| Concepts with eligible Vietnamese authority evidence | 19 | 47 | +28 |

The integrated research buckets are: `HIGH_CONSENSUS_CANDIDATE=16`, `VARIANT_REVIEW=28`, `CONFLICT_REQUIRES_ADJUDICATION=4`, `ONTOLOGY_SCOPE_REVIEW=10`, `LATERALITY_REVIEW=8`, `SOURCE_GAP=2,473`, `IDENTITY_GAP=2`, and `AGGREGATE_OR_COMPOSITE_REVIEW=891`. The integrated high-consensus bucket includes prior research candidates; the seven M04B2C matrix high-consensus cases are identified above.

## M03C regression

M03C regression covers all 50 frozen concepts: `50` pass, `0` mismatches, and `0` input gaps.

## Production safety

Production terminology files, source catalog, reviewers, and release manifest were not changed by the research integration. Production coverage remains:

- searchable Vietnamese: `0`
- `SOURCE_VERIFIED`: `0`
- `MEDICAL_REVIEWED`: `0`
- release eligible: `0`
- reviewers: unchanged (`0`)
- release: `UNRELEASED`

M04B2C annotations remain in research output only. Vietnamese aliases/search forms were not activated, source wording and singular/plural distinctions were preserved, and unsided labels were not used to synthesize right/left terms.

## Remaining research gaps

The two M04B2C conflicts require human terminology/medical adjudication before any preferred-term or release decision. The one variant review requires human review of surface-form variation. The broader integrated corpus still contains 2,473 source-gap and 2 identity-gap concepts; these remain unresolved. No M04B2D work was started.

STOP after M04B2C integration.
