# M04B2E-2R.1 — NVH Parser Integrity Report

Status: **RESEARCH_ONLY_NOT_RELEASE**

Starting repository HEAD: `fca340ea6d7650f589c4a67dad5730e7067514db`; acquisition date: 2026-09-21.

This repair addresses parser integrity only. It reconstructs source rows from the rendered NVH structure before atlas matching, quarantines rows that fail structural or linguistic validation, and does not change targeting classifications, research-source wording, ontology identity, production terminology, reviewers, or release state.

## 1. Source-first parser contract

The retention order is strict: **entry-ID boundary → complete English source term → complete Vietnamese source term → integrity validation → exact atlas match**. The parser never uses an atlas English prefix to declare a source term. Prefix-only, incomplete, adjacent, duplicated, cross-section, unresolved, or otherwise structurally unsafe rows are not eligible evidence.

| Gate | Rule | Failure result |
| --- | --- | --- |
| Entry boundary | Reconstruct the complete printed A-code from the rendered block and continuation lines | `INCOMPLETE_PRINTED_ID` or quarantine |
| English source | Retain the complete printed English fragment from the source columns | `INCOMPLETE_SOURCE_ENGLISH` or unmatched |
| Vietnamese source | Retain the complete printed Vietnamese fragment from the source columns | `INCOMPLETE_SOURCE_VIETNAMESE` or unmatched |
| Integrity | Reject counters, neighboring entries, section/page crossings, duplicate IDs, and unresolved residue | `PARSER_INTEGRITY_REVIEW` or `UNMATCHED_SOURCE_RECORD` |
| Atlas identity | Exact match only after all source fields pass | safe compact row with `EXACT_RECONSTRUCTED_SOURCE_ROW` |

## 2. Audit accounting

| NVH metric | Count |
| --- | ---: |
| Prior compact rows audited | 556 |
| Prior rows retained exactly | 269 |
| Prior rows quarantined | 287 |
| Rendered pages discovered/retrieved | 538 / 538 |
| Candidate blocks discovered/parsed | 6960 / 6960 |
| Source blocks with complete structure | 6886 |
| Exact reconstructed source rows retained | 430 |
| `EXACT_RECONSTRUCTED_SOURCE_ROW` | 430 |
| `PARSER_INTEGRITY_REVIEW` | 974 |
| `UNMATCHED_SOURCE_RECORD` | 5556 |
| Structurally rejected rows | 6530 |
| Duplicate printed-ID rows / values | 271 / 238 |

Status totals account for all 6960 parsed blocks: `{"EXACT_RECONSTRUCTED_SOURCE_ROW":430,"PARSER_INTEGRITY_REVIEW":974,"UNMATCHED_SOURCE_RECORD":5556}`. Exact retained rows are the only NVH rows entering eligible evidence.

### Quarantine patterns

| Integrity reason | Audit occurrences |
| --- | ---: |
| `DUPLICATE_PRINTED_ID` | 509 |
| `EMBEDDED_ENTRY_REFERENCE_OR_NEIGHBOR_CONTENT` | 463 |
| `INCOMPLETE_PRINTED_ID` | 1 |
| `INCOMPLETE_SOURCE_ENGLISH` | 37 |
| `INCOMPLETE_SOURCE_VIETNAMESE` | 62 |
| `MULTIPLE_ENTRY_COUNTERS` | 432 |
| `SOURCE_SPAN_CROSSED_SECTION_OR_PAGE_HEADING` | 488 |
| `UNMATCHED_SOURCE_RECORD` | 5936 |
| `UNRESOLVED_ENGLISH_RESIDUE_IN_VIETNAMESE` | 2 |

These counts describe parser audit findings; a row may carry more than one reason. They are not coverage targets and are not promoted to evidence.

## 3. Sentinel verification

The known truncation cases are checked against reconstructed source rows and eligible output evidence:

- `FMA3951`: exact source row=**yes**, entry=`A12.2.08.001`, Vietnamese=`Động mạch dưới đòn`, truncated-prefix rows eligible=**0**
- `FMA4725`: exact source row=**yes**, entry=`A12.3.08.002`, Vietnamese=`Tĩnh mạch dưới đòn`, truncated-prefix rows eligible=**0**
- `FMA10662`: exact source row=**yes**, entry=`A12.2.08.043`, Vietnamese=`Động mạch giáp dưới`, truncated-prefix rows eligible=**0**
- `FMA9597`: research bucket=`SOURCE_GAP`, M03C state=`INPUT_GAP`; no unsupported NVH evidence was generated.

## 4. MOH preservation and ontology boundary

MOH2025 remains a separate official-PDF source: 1441 pages discovered, 1441 retrieved, 1441 parsed, and 1506 compact rows retained. Ministry identifiers, SNOMED CT identifiers, raw scope, and bridge-required classification remain attached. No FMA↔SNOMED promotion was performed.

## 5. Coverage recompute and regression accounting

| Metric | Count |
| --- | ---: |
| Baseline before M04B2E | 47 |
| M04B2E-2 baseline | 80 |
| Final after M04B2E-2R.1 | 421 |
| Delta from baseline 47 | 374 |
| Delta from baseline 80 | 341 |
| Final coverage of 3,432 concepts | 12.27% |
| Variants before → after | 195 → 225 |
| Conflicts before → after | 54 → 9 |

M03C regression states: **PASS=49**, **INPUT_GAP=1**, **EXPECTED_EVIDENCE_SUPERSESSION=0**, **UNEXPLAINED_REGRESSION=0**. Unexplained regression is required to be zero.

## 6. Production safety

Production validation errors: **0**; searchable Vietnamese: **0**; SOURCE_VERIFIED: **0**; MEDICAL_REVIEWED: **0**; release eligible: **0**; release: **UNRELEASED**; reviewers: **0**.
Only research evidence and deterministic audit metadata changed. No production entries, reviewers, release metadata, UI, or medical-review state was modified.

## 7. Files and stopping point

- `scripts/m04b2e2r-acquisition.mjs` — source-first NVH reconstruction and audit statuses.
- `scripts/m04b2e2r.mjs` — exhaustive acquisition metadata and audit staging.
- `scripts/m04b2e-bulk-ingestion.mjs` — coverage recomputation, report generation, and research-only matching.
- `scripts/test-m04b2e2r1.mjs` — dedicated integrity and regression test entry point.
- `.local/terminology-source-cache/` — ignored full rendered source and parser staging; not committed.

STOP after M04B2E-2R.1 parser integrity repair and coverage recompute.
