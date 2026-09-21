# M04B2G — Vietnamese translation closure

This research-only run closes deterministic bilingual accounting for the frozen atlas identity set. It does not choose preferred terms, perform medical review, or promote production terminology.

## Closure

| Measure | Count |
|---|---:|
| Total atlas concepts | 3432 |
| Terminal concepts | 3432 |
| Unclassified | 0 |
| Starting eligible baseline | 421 |
| Concepts with a Vietnamese candidate | 1017 (29.63%) |
| Concepts with direct source-attested Vietnamese | 418 (12.18%) |
| Concepts with derived-only Vietnamese | 0 |
| Concepts with multiple candidate forms | 716 |
| Concepts with zero Vietnamese candidate | 2415 (70.37%) |

| Terminal disposition | Count |
|---|---:|
| MULTI_AUTHORITY_AGREEMENT | 14 |
| DIRECT_AUTHORITY_TRANSLATION | 395 |
| AUTHORITY_VARIANT | 0 |
| SOURCE_CONFLICT | 9 |
| CONTROLLED_DERIVED_TRANSLATION | 0 |
| SCOPE_REVIEW | 599 |
| IDENTITY_REVIEW | 0 |
| NO_DIRECT_AUTHORITY_ATTESTATION | 2415 |

## MOH2025_BODY_STRUCTURE (1,506 rows)

The exclusive row ledger categories sum to 1506. Exact identity/synonym match methods are reported separately; accepted direct candidates are an exclusive ledger category. SNOMED identifiers remain provenance and are never used as FMA identity.

| Category | Count |
|---|---:|
| Exact localization identity match | 0 |
| Exact synonym localization match | 3 |
| Scope blocked | 1501 |
| Laterality blocked | 2 |
| Multiple atlas targets | 0 |
| No atlas identity | 0 |
| Accepted direct candidate (exclusive category) | 3 |
| Exclusive category sum | 1506 |

## NVH2008 parser-integrity contribution

Only 430 approved EXACT_RECONSTRUCTED_SOURCE_ROW records were considered. 28 rows from the unapproved bulk access copy were excluded.

| Measure | Count |
|---|---:|
| Exact retained rows used | 430 |
| Concepts contributed | 397 |
| Unique contribution | 397 |
| Variants | 0 |
| Conflicts | 7 |

## Controlled derivation

No derived term was emitted.

| Rule | Applied concepts | Test cases |
|---|---:|---:|
| M04B2G-LATERALITY-001 | 0 | 1 |
| M04B2G-ORDINAL-001 | 0 | 1 |

## Source contribution

| Source | Role | Input rows | Direct claims | Concepts |
|---|---|---:|---:|---:|
| NVH2008 | primary_bilingual | 430 | 426 | 397 |
| NATIONAL_BODY_TERMS_2025 | official_bilingual_candidate | 1506 | 3 | 3 |
| HMU2022 | qualified_bilingual_corroboration | 31 | 31 | 31 |
| UMP2023_T2 | qualified_bilingual_corroboration | 12 | 12 | 12 |
| FIPAT_TA2 | identity_only | 7112 | 0 | 0 |
| NVH2008_UNAPPROVED_BULK | excluded_parser_integrity | 458 | 0 | 0 |
| NQQ |  | 0 | 0 | 0 |
| HUE |  | 0 | 0 | 0 |
| NETTER_VIETNAMESE |  | 0 | 0 | 0 |
| TRINH_VAN_MINH |  | 0 | 0 | 0 |
| UMP2023_T1 |  | 0 | 0 | 0 |

Registered sources without a local qualified corpus are recorded as unavailable in source-contribution.json. The duplicate M04B2C authority pack is excluded from independent-authority counts.

## Production boundary

searchableVietnamese = 0, SOURCE_VERIFIED = 0, MEDICAL_REVIEWED = 0, releaseEligible = 0, and release = UNRELEASED. The output is research accounting only; preferredTerm remains null for every concept.
