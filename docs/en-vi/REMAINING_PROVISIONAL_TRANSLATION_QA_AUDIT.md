# Remaining Provisional Translation QA Audit

## Baseline

Repository HEAD is fe16a8c; the requested locked checkpoint is fe16a8c. The current localization dataset contains 3432 concepts.

| Localization class | Current count | Expected | Drift |
|---|---:|---:|---:|
| VERIFIED | 841 | 841 | 0 |
| PROVISIONAL_SOURCED | 86 | 86 | 0 |
| PROVISIONAL_TRANSLATED | 2505 | 2505 | 0 |
| English-only | 0 | 0 | 0 |
| **Total** | **3432** | **3432** | **0** |

Release status is **UNRELEASED**. Baseline drift is **NONE**.

## Completed 616-concept campaign

The authoritative campaign set B was reconstructed from final_review_616_CHECKED.jsonl: 616 unique conceptIds, with 498 CORRECT and 118 KEEP decisions. Its CORRECT IDs were cross-checked against the integration lineage inputs present in the workspace: 313 prior patch IDs plus 193 remaining patch IDs, with the expected 8-ID re-audit overlap, yielding exactly 498 unique CORRECT IDs. The 118 KEEP IDs overlap neither patch set.

The separate deterministic structural final-QA target set contains 280 concepts and was excluded from this manual/Gemini translation-QA campaign. Source evidence or VERIFIED status was not used to count a concept as reviewed.

## Set accounting

Let A be all current PROVISIONAL_TRANSLATED conceptIds and B be the completed 616-concept campaign:

| Set | Count |
|---|---:|
| A: current PROVISIONAL_TRANSLATED | 2505 |
| B: completed campaign | 616 |
| A ∩ B: reviewed provisional | 616 |
| B − A: reviewed non-provisional | 0 |
| A − B: remaining unreviewed provisional | **1889** |

The reviewed-provisional and remaining sets are disjoint, and their union reproduces all 2505 current PROVISIONAL_TRANSLATED concepts. The completed 616-concept QA campaign is a reviewed subset and must not be interpreted as manual QA coverage of all 2505 PROVISIONAL_TRANSLATED concepts.

## Generated queue and chunks

The master queue preserves authoritative localization-record ordering and contains exactly 1889 records. It uses only the requested queue fields and reason NOT_YET_TRANSLATION_QA_REVIEWED. It is split into 10 deterministic chunks of maximum 200 records:

- chunks/remaining_qa_001_of_10.jsonl: 200 records (FMA8620 → FMA15397)
- chunks/remaining_qa_002_of_10.jsonl: 200 records (FMA15398 → FMA22758)
- chunks/remaining_qa_003_of_10.jsonl: 200 records (FMA22762 → FMA32528)
- chunks/remaining_qa_004_of_10.jsonl: 200 records (FMA32529 → FMA42603)
- chunks/remaining_qa_005_of_10.jsonl: 200 records (FMA43252 → FMA50361)
- chunks/remaining_qa_006_of_10.jsonl: 200 records (FMA50362 → FMA58101)
- chunks/remaining_qa_007_of_10.jsonl: 200 records (FMA58102 → FMA72830)
- chunks/remaining_qa_008_of_10.jsonl: 200 records (FMA72831 → FMA14615)
- chunks/remaining_qa_009_of_10.jsonl: 200 records (FMA14627 → FMA70441)
- chunks/remaining_qa_010_of_10.jsonl: 89 records (FMA70444 → FMA270201)

Checks: duplicate queue IDs 0; missing IDs 0; unexpected remaining IDs 0; reviewed/remaining overlap 0; chunk maximum 200; concatenated chunks equal the master queue: **true**.

## Generated files

- data/terminology/research/m04b2i-qa-translation/remaining-provisional-translation-qa.jsonl
- data/terminology/research/m04b2i-qa-translation/chunks/
- data/terminology/research/m04b2i-qa-translation/remaining-qa-manifest.json
- docs/en-vi/REMAINING_PROVISIONAL_TRANSLATION_QA_AUDIT.md
- scripts/audit-m04b2i-remaining-provisional-translation-qa.mjs

Production artifact hashes before and after queue generation are identical. No localization string, evidence metadata, translation status, source claim, provenance, or generated terminology artifact was modified. No terminology value was translated or improved.

Git safety: changes were left unstaged; no add, commit, push, clean, or reset was performed.

## Validation

The deterministic audit generator passed all set, queue, chunk, and production-hash invariants. git diff --check exited 0 with no whitespace errors.
