# M04B2D-1 — Laryngeal Ligament Authority Evidence Batch 1

Status: **RESEARCH_ONLY_NOT_RELEASE**  
Batch: `M04B2D-0.1-FIRST-01-LARYNGEAL-LIGAMENTS`  
Starting commit: `1a00ecf7de9b7dbcb0bcffcdbbf4d20cf2fa6b7c`

This run inspected only source material already supplied or registered in the repository. No independent browsing or crawling was performed. No production terminology, searchable Vietnamese alias, review state, or release value was created.

## 1. Identity result

| Concept | Atlas English name | Identity result | Vietnamese evidence result | Candidate consensus |
| --- | --- | --- | --- | --- |
| FMA55135 | thyrohyoid ligament | `IDENTITY_INSUFFICIENT` | `IDENTITY_BLOCKED` | `IDENTITY_BLOCKED` |
| FMA55138 | median thyrohyoid ligament | `IDENTITY_PINNED` | `SOURCE_MATERIAL_REQUIRED` | `SOURCE_MATERIAL_REQUIRED` |
| FMA55227 | hyo-epiglottic ligament | `IDENTITY_PINNED` | `SOURCE_MATERIAL_REQUIRED` | `SOURCE_MATERIAL_REQUIRED` |
| FMA55230 | thyro-epiglottic ligament | `IDENTITY_PINNED` | `SOURCE_MATERIAL_REQUIRED` | `SOURCE_MATERIAL_REQUIRED` |
| FMA55233 | cricothyroid ligament | `IDENTITY_INSUFFICIENT` | `IDENTITY_BLOCKED` | `IDENTITY_BLOCKED` |

The three pinned identities retain the existing TA2 evidence. FMA55135 and FMA55233 have no exact indexed English/Latin source match. The registered FMA_UW source establishes the FMA ontology as a source identity, but its distribution was not content-inspected and the catalog explicitly does not assert an Atlas-to-FMA mapping. Atlas English-name equality, mesh membership, related ligaments, and Vietnamese component words were not treated as external ontology proof.

## 2. Supplied Vietnamese sources inspected

| Source | Registered revision/edition | Authority identity | Access-copy distinction | Exact target attestations |
| --- | --- | --- | --- | ---: |
| NVH2008 | `NVH-2008-312P` / 2008 | *Thuật ngữ giải phẫu Anh - Việt*, Nhà xuất bản Y học; Nguyễn Văn Huy and Chu Văn Tuệ Bình | Scribd URL is an inspection access copy; the identified 2008 work remains the authority | 0 |
| HMU2022 | `HMU-2022-ISBN-9786046658351` / 2022 | *Giải phẫu người: dùng cho sinh viên hệ bác sĩ*, Trường Đại học Y Hà Nội | Scribd URL is an inspection access copy; the library-identified book remains the authority | 0 |
| UMP2023_T2 | `UMP-2023-PROGRAM-T2-437P` / Tập 2, 2023 | *Giải phẫu học: Chương trình Y đa khoa đổi mới, Tập 2*, Đại học Y Dược Thành phố Hồ Chí Minh | Scribd URL is an inspection access copy; the National Library/UMP-identified work remains the authority | 0 |

The registered inspection material was the NVH2008 seed/public pack and the HMU2022/UMP2023_T2 M04B2C authority corpus/access pack. The source identities and revisions are bound to `data/terminology/sources.json`; access copies are not treated as separate authorities.

## 3. Exact identity attestations retained

These are external English/Latin identity records, not Vietnamese terminology evidence.

| Concept | Source wording | TA2 locator | Locator quality |
| --- | --- | --- | --- |
| FMA55138 | English: `Median thyrohyoid ligament`; Latin: `Ligamentum thyreohyoideum medianum` | TA2 Part II, p. 40, entry `1652` | `STABLE_ENTRY` |
| FMA55227 | English: `Hyo-epiglottic ligament`; Latin: `Ligamentum hyoepiglotticum` | TA2 Part II, p. 40, entry `1656` | `STABLE_ENTRY` |
| FMA55230 | English: `Thyro-epiglottic ligament`; Latin: `Ligamentum thyreoepiglotticum` | TA2 Part II, p. 40, entry `1655` | `STABLE_ENTRY` |

FIPAT/TA2 is not a Vietnamese authority source. Its records pin identity only.

## 4. Exact Vietnamese attestations and excluded near-misses

No supplied Vietnamese authority source contains an exact target attestation for any of the five target concepts. Therefore the new target corpus is intentionally empty, and every matrix `evidence[]` is empty.

The supplied NVH2008 material does contain related terms, but they are not evidence for these targets:

- `Lateral thyrohyoid ligament` — `Dây chằng giáp-móng bên`, entry `A06.2.02.017`, p. 199. This is the lateral target, not FMA55135.
- `Median cricothyroid ligament` — `Dây chằng nhẫn-giáp giữa`, entry `A06.2.03.009`, p. 199. This is the median target, not FMA55233.

The FIPAT corpus likewise contains related entries such as `Thyrohyoid membrane`, `Lateral thyrohyoid ligament`, and `Median cricothyroid ligament`, but not an exact external match for FMA55135 or FMA55233. No related term was translated, generalized, mechanically recombined, or promoted.

## 5. Variants and conflicts

There is no target-specific Vietnamese variant or conflict in the supplied material because there is no exact target Vietnamese attestation. No winner was selected. `preferredTerm` and `agreedTerm` remain `null` for all five rows.

## 6. SOURCE_MATERIAL_REQUIRED and identity-blocked cases

`SOURCE_MATERIAL_REQUIRED`: FMA55138, FMA55227, and FMA55230. Their TA2 identities are pinned, but an exact Vietnamese authority attestation with a registered source revision and locator was not supplied.

`IDENTITY_BLOCKED`: FMA55135 and FMA55233. Direct Vietnamese mapping cannot begin until exact external English/Latin identity is pinned.

## 7. Evidence coverage before/after

| Measure | Before | After |
| --- | ---: | ---: |
| Batch concepts | 5 | 5 |
| Concepts with exact Vietnamese evidence | 0 | 0 |
| Exact Vietnamese evidence records | 0 | 0 |
| TA2-pinned identities | 3 | 3 |
| Identity-blocked concepts | 2 | 2 |
| Vietnamese candidates created | 0 | 0 |

## 8. Production safety state

- `data/terminology/entries.json`: unchanged.
- `data/terminology/reviewers.json`: unchanged; no reviewers created.
- `data/terminology/release.json`: unchanged; release remains `UNRELEASED`.
- `SOURCE_VERIFIED`: 0.
- `MEDICAL_REVIEWED`: 0.
- `releaseEligible`: 0.
- Searchable Vietnamese: 0.
- No production terminology integration was performed.

## 9. Tests executed

The batch-specific test passed. These requested checks also passed:

- `npm run test:m03c`
- `npm run test:m04a`
- `npm run test:m04b2a`
- `npm run test:m04b2c`
- `node scripts/test-m04b2d-batch1.mjs`
- `npm run test:terminology`
- `npm run test:localization`
- `npm run check`
- `git diff --check`

`node scripts/test-m04b2d-targeting.mjs` was executed but stopped before artifact validation because that pre-existing M04B2D-0 test hard-codes baseline commit `5e0b1f9855b94c1f41d28b50383e67dcfb420a65`; the required run baseline is the observed current `1a00ecf7de9b7dbcb0bcffcdbbf4d20cf2fa6b7c`. The targeting test and its planning artifact were not rewritten or reset.

## 10. Files changed

- `data/terminology/research/corpora/m04b2d-laryngeal-ligaments.jsonl`
- `docs/en-vi/research/M04B2D/M04B2D_BATCH1_EVIDENCE_MATRIX.json`
- `docs/en-vi/research/M04B2D/M04B2D_BATCH1_SOURCE_GAPS.json`
- `docs/en-vi/M04B2D_BATCH1_LARYNGEAL_LIGAMENTS_REPORT.md`
- `scripts/test-m04b2d-batch1.mjs`
- `package.json` (consistent `test:m04b2d` command)

This run stops at M04B2D-1 Batch 1. No other family, batch, source crawl, UI work, or medical adjudication was started.
