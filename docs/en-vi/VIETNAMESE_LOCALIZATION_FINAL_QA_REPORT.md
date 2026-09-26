# Vietnamese Localization Final Bulk QA Report

M04B2I final QA processed the complete target set in one deterministic run. No terminology sources were acquired, no ontology work was performed, and M04B2G/M04B2H evidence remains unchanged.

## Target accounting

| Target | Count |
|---|---:|
| Generated records flagged by M04B2I | 271 |
| Source conflicts | 7 |
| Source variants | 2 |
| **Total QA targets** | **280** |

## QA decisions

| Decision | Count |
|---|---:|
| QA_CLEAR | 3 |
| QA_REPAIRED | 264 |
| QA_RETAIN_PROVISIONAL | 0 |
| QA_CONFLICT_PRESERVED | 9 |
| QA_NEEDS_HUMAN_REVIEW | 4 |
| **Total** | **280** |

Exactly 248 Vietnamese strings changed. Evidence statuses changed: 0; verified statuses changed: 0; generated promotions: 0.

The authoritative provisional translation QA overlay supplied 313 reviewed corrections and applied 313 changes (313 were already present on a deterministic rerun). It changed no evidence or source status and promoted nothing.

## Repairs

Repairs are limited to deterministic structural cleanup: removing machine-composed “của” connectors for English of relations, moving an obvious leading structural head noun, normalizing accidental interior capitalization, and removing exact duplicated head nouns. Every repaired record remains PROVISIONAL_TRANSLATED, verified: false, and sourceRefs: [].

- segment of artery: **đoạn của Động mạch** → **đoạn động mạch** (FMA3711)
- arch of aorta: **cung của động mạch chủ** → **cung động mạch chủ** (FMA3768)
- trunk of right coronary artery: **Thân của động mạch vành phải** → **thân động mạch vành phải** (FMA3802)
- anterior ventricular branch of right coronary artery: **thất nhánh của động mạch vành phải trước** → **nhánh thất trước của động mạch vành phải** (FMA3813)
- first anterior ventricular branch of right coronary artery: **thất nhánh của động mạch vành phải trước thứ nhất** → **nhánh thất trước thứ nhất của động mạch vành phải** (FMA3815)
- marginal branch of right coronary artery: **nhánh bờ phải của động mạch vành phải** → **nhánh bờ phải động mạch vành phải** (FMA3818)
- posterior ventricular branch of right coronary artery: **thất nhánh của động mạch vành phải sau** → **nhánh thất sau của động mạch vành phải** (FMA3835)
- first posterior ventricular branch of right coronary artery: **thất nhánh của động mạch vành phải sau thứ nhất** → **nhánh thất sau thứ nhất của động mạch vành phải** (FMA3837)

## Conflict and variant handling

All 7 source conflicts and 2 source variants are QA_CONFLICT_PRESERVED. Their sourceRefs, variants, blockers, and PROVISIONAL_SOURCED status remain intact. The UI continues to show **Có biến thể nguồn** where variants are present; no source winner was promoted.

## Human-review queue

- FMA52672 — communicating branch of nasociliary nerve with ciliary ganglion: MALFORMED_WITH_RELATION
- FMA52673 — communicating branch of right nasociliary nerve with right ciliary ganglion: MALFORMED_WITH_RELATION
- FMA52674 — communicating branch of left nasociliary nerve with left ciliary ganglion: MALFORMED_WITH_RELATION
- FMA55672 — organ with organ cavity: MALFORMED_WITH_RELATION

## Final invariants

The catalog still contains 3432 concepts with Vietnamese UI coverage 3432/3432. Class counts remain VERIFIED 841, PROVISIONAL_SOURCED 86, PROVISIONAL_TRANSLATED 2505, and English-only 0. English originals remain unchanged. The official release remains UNRELEASED.

## Validation

The final-QA test, terminology tests, localization tests, M04B2G regression, M04B2H regression, TypeScript check, production build, and git diff --check pass. The unrelated historical M04B2E determinism test remains documented as a pre-existing failure.

## Files and diff

The QA overlay is implemented by scripts/m04b2i-final-qa.mjs and scripts/test-m04b2i-final-qa.mjs, with five files under data/terminology/research/m04b2i-qa and this report. Existing M04B2G/M04B2H artifacts were not changed. No commit was created.

## QA artifacts

- data/terminology/research/m04b2i-qa/qa-decisions.jsonl
- data/terminology/research/m04b2i-qa/repaired-translations.jsonl
- data/terminology/research/m04b2i-qa/residual-human-review.jsonl
- data/terminology/research/m04b2i-qa/qa-summary.json
- data/terminology/research/m04b2i-qa/run-manifest.json
