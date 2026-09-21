# Vietnamese Full-Coverage Localization Report

M04B2I adds a research-only Vietnamese localization layer over all 3,432 atlas concepts. M04B2G/M04B2H artifacts remain unchanged and the official release gate is unchanged.

## Accounting

| UI class | Concepts |
|---|---:|
| VERIFIED | 841 |
| PROVISIONAL_SOURCED | 86 |
| PROVISIONAL_TRANSLATED | 2505 |
| NO_TRANSLATION_AVAILABLE | 0 |
| **Total** | **3432** |

Vietnamese UI coverage is **3432/3432 (100%)**; English-only fallback is 0.

## Translation methods

| Method | Concepts |
|---|---:|
| DIRECT_SOURCE | 395 |
| MULTI_AUTHORITY | 14 |
| CONTROLLED_DERIVED | 432 |
| SOURCE_CANDIDATE | 86 |
| GENERATED_TRANSLATION | 2505 |

Generated records use component composition for 30 concepts and best-effort fallback composition for 2475 concepts. Source conflicts: 7; source variants: 2.

## Examples

### VERIFIED
- `ascending aorta` → **Động mạch chủ lên** (FMA3736)
- `abdominal aorta` → **Động mạch chủ bụng** (FMA3789)
- `common carotid artery` → **Động mạch cảnh chung** (FMA3939)

### PROVISIONAL_SOURCED
- `right internal thoracic artery` → **Cấu trúc động mạch ngực trong phải (cấu trúc cơ thể)** (FMA3969)
- `left internal thoracic artery` → **Cấu trúc động mạch ngực trong trái (cấu trúc cơ thể)** (FMA4068)
- `right brachiocephalic vein` → **Cấu trúc tĩnh mạch cánh tay đầu bên phải (cấu trúc cơ thể)** (FMA4751)

### PROVISIONAL_TRANSLATED
- `vascular tree` → **mạch máu cây** (FMA3710)
- `segment of artery` → **đoạn của Động mạch** (FMA3711)
- `variant artery` → **biến thể Động mạch** (FMA3714)

## UI and search

Vietnamese mode resolves VERIFIED, then PROVISIONAL_SOURCED, then PROVISIONAL_TRANSLATED, then English. The detail sheet keeps the English atlas label available and shows a small evidence badge. Source candidates show blockers and variants; generated terms say that no source has been identified. Search indexes all three Vietnamese classes while keeping English names and IDs searchable.

## Provenance and release

VERIFIED records retain direct, multi-authority, or controlled-derived provenance and rule IDs. PROVISIONAL_SOURCED records retain source claims, blockers, and every observed variant; their display selection is deterministic and is not an adjudication. Generated records have sourceRefs: [] and verified: false, and never create reviewer, SOURCE_VERIFIED, MEDICAL_REVIEWED, or release eligibility data. Official release remains UNRELEASED.

## Quality and artifacts

Quality review ran 2505 generated records; 271 records have one or more findings. Checks cover UNTRANSLATED_ENGLISH_RESIDUE, MISSING_LATERALITY, DUPLICATED_ANATOMICAL_HEAD, REVERSED_LEFT_RIGHT, REVERSED_SUPERIOR_INFERIOR, REVERSED_ANTERIOR_POSTERIOR, MALFORMED_VIETNAMESE_WORD_ORDER, ENGLISH_VIETNAMESE_MIXTURE, INCONSISTENT_COMPONENT_TRANSLATION, SUSPICIOUS_LEXICON_INCONSISTENCY. Findings are retained in quality-review.jsonl for review without blocking provisional UI display. Artifacts: localization-records.jsonl, localization-catalog.json, provisional-translations.jsonl, quality-review.jsonl, coverage-summary.json, run-manifest.json, scripts/m04b2i-localization.mjs, and scripts/test-m04b2i.mjs.
