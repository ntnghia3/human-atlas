# CODEX TASK — M04B2C Authority-First Vietnamese Evidence Integration

Start from commit:
`a63dcba6c3959aad19126889d57f4c2bdd5b1243`

Owner research files supplied:
- `M04B2C_VI_AUTHORITY_CORPUS.jsonl`
- `M04B2C_EVIDENCE_MATRIX.json`
- `M04B2C_CONFLICT_QUEUE.json`

NO WEB.
NO CRAWLING.
NO INDEPENDENT TERMINOLOGY RESEARCH.
NO MEDICAL REVIEW.
NO AI TRANSLATION.

## PURPOSE

Integrate the supplied authority-first Vietnamese research evidence into the existing
M04A/M04B1/M04B2A pipeline.

The corpus contains 43 research records:
- HMU2022: 31
- UMP2023_T2: 12

These records are research evidence only. They do not create production-approved
terminology, SOURCE_VERIFIED claims, MEDICAL_REVIEWED claims, search forms, aliases,
or release eligibility.

## REQUIRED WORK

1. Validate every supplied JSONL record against:
   `data/terminology/research/bulk-source-corpus.schema.json`

2. Verify every sourceId/sourceRevision against existing `data/terminology/sources.json`.
   Required exact revisions:
   - HMU2022 = `HMU-2022-ISBN-9786046658351`
   - UMP2023_T2 = `UMP-2023-PROGRAM-T2-437P`

3. Preserve the corpus under a research-only location, e.g.
   `data/terminology/research/corpora/m04b2c-vi-authority.jsonl`.

4. Preserve the matrix and conflict queue under `docs/en-vi/research/M04B2C/`
   or the repository's established research location.

5. Combine this corpus with:
   - FIPAT TA2 7,112-record corpus
   - existing NVH2008 M04B2A research corpus
   without losing source provenance and without double-counting identical source evidence.

6. Run the deterministic index and bulk matcher for exactly all 3,432 concepts.

7. Add research annotations/dispositions from the supplied matrix if needed, but never
   convert them to production claims.

## CRITICAL CONFLICTS

The following remain BLOCKING:
- `FMA16585 hip bone`: HMU2022 uses `Xương chậu`; UMP2023_T2 uses `Xương hông`.
- `FMA24499 navicular bone of foot`: HMU2022 uses `Xương thuyền`; UMP2023_T2 uses `Xương ghe`.

Do not choose a winner.
Do not use majority/newest-source/source-count rules.

## HIGH-CONSENSUS RESEARCH CASES

Where HMU2022 and UMP2023_T2 independently use the same Vietnamese term, the record
may become `HIGH_CONSENSUS_CANDIDATE` in research output, but still:
- SOURCE_VERIFIED = false
- MEDICAL_REVIEWED = false
- releaseEligible = false

Do not infer that source agreement equals medical review.

## MATCHING SAFETY

- exact English and safely normalized English may be used for retrieval;
- do not invent ontology mappings;
- do not treat Atlas Concept.id as FMA identity;
- do not synthesize right/left terms from unsided source labels;
- preserve singular/plural differences;
- preserve source wording exactly;
- normalization remains matching-only;
- no Vietnamese aliases/search forms are activated.

## REQUIRED REPORT

Create:
`docs/en-vi/M04B2C_AUTHORITY_FIRST_EVIDENCE_REPORT.md`

Report:
- record count by source;
- concepts gaining Vietnamese authority evidence;
- concepts with one authority source;
- concepts with >=2 institutionally distinct authority sources;
- high-consensus candidates;
- variant reviews;
- conflicts;
- source gaps;
- exact-English/normalized/Latin match deltas vs M04B2A;
- M03C regression;
- production coverage.

## TESTS

Run:
- M03A
- M03C
- M04A
- M04B1
- M04B2A
- terminology
- localization
- typecheck/check
- atlas validation
- interaction validation
- build
- git diff --check

Add `test:m04b2c` proving:
- revision mismatch rejects records;
- conflict concepts remain unresolved;
- two-source agreement stays research-only;
- no side-specific synthesis;
- no alias/search activation;
- no production release-state changes.

## PRODUCTION SAFETY

After integration:
searchable Vietnamese = 0
SOURCE_VERIFIED = 0
MEDICAL_REVIEWED = 0
releaseEligible = 0
reviewers unchanged
release = UNRELEASED

## STOP

STOP after M04B2C integration.

Do not browse for more evidence.
Do not perform medical adjudication.
Do not start M04B2D automatically.

Return:
PASS / PARTIAL / FAIL
final commit SHA
files changed
record count by source
3432-concept coverage and delta
high-consensus count
conflict count
M03C regression
production coverage
remaining research gaps
