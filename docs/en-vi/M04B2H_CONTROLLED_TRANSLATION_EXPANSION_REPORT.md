# M04B2H — Controlled Vietnamese Translation Expansion

This research-only pass processes the frozen atlas identity set of **3432** concepts. It reads the closed M04B2G evidence and approved local corpora; it does not acquire sources, use web terminology search, use UMLS, perform ontology mapping, adjudicate preferred terms, or promote production data.

## Coverage

| Measure | Count |
|---|---:|
| Total concepts | 3432 |
| Processed concepts | 3432 |
| Unclassified | 0 |
| M04B2G concepts with a Vietnamese candidate | 1017 |
| M04B2G direct source-attested concepts | 418 |
| M04B2H concepts with any carried or generated candidate | 1449 (42.22%) |
| M04B2H concepts with any usable Vietnamese candidate | 927 (27.01%) |
| Direct source-attested usable | 418 |
| Direct localization candidates | 77 |
| Direct usable total | 495 |
| Multi-authority usable | 14 |
| Controlled-derived usable | 432 |
| Candidate gain over M04B2G 1,017 | 432 |
| Usable gain over direct 418 | 509 |
| Remaining scope review | 522 |
| Source conflict | 7 |
| No safe translation candidate | 1983 |

The scope gate was re-evaluated. **77** MOH rows had an exact pinned atlas alias and only the generic `Structure` blocker, so their raw source terms are retained as `DIRECT_LOCALIZATION_CANDIDATE` evidence. Rows with an extra Entire, Part, Region, Branch, Segment, laterality, or other genuine scope qualifier remain in `SCOPE_REVIEW`.

## Final dispositions

| Disposition | Count |
|---|---:|
| DIRECT_SOURCE_TRANSLATION | 472 |
| MULTI_AUTHORITY_TRANSLATION | 14 |
| CONTROLLED_DERIVED_TRANSLATION | 432 |
| SOURCE_VARIANT | 2 |
| SOURCE_CONFLICT | 7 |
| SCOPE_REVIEW | 522 |
| NO_SAFE_TRANSLATION_CANDIDATE | 1983 |

M04B2G's nine conflict terminal entries are preserved as seven substantive `SOURCE_CONFLICT` concepts and two punctuation/case-only `SOURCE_VARIANT` concepts; no form is selected as a winner.

## Composition rule contribution

| Rule | Supporting examples | Evaluated | Accepted | Rejected | Rejection reasons |
|---|---:|---:|---:|---:|---|
| M04B2H-LATERALITY-SUFFIX-001 | 9 | 2415 | 426 | 1989 | UNATTESTED_MODIFIER=1458; NO_UNAMBIGUOUS_BASE_IDENTITY=104; BLACKLISTED_SCOPE_OR_HIERARCHY=80; BASE_CONFLICT_OR_SCOPE_REVIEW=139; AMBIGUOUS_BASE_TERM=208 |
| M04B2H-SUPERIOR-INFERIOR-SUFFIX-001 | 6 | 2415 | 0 | 2415 | UNATTESTED_MODIFIER=2362; NO_UNAMBIGUOUS_BASE_IDENTITY=11; AMBIGUOUS_BASE_TERM=6; BLACKLISTED_SCOPE_OR_HIERARCHY=36 |
| M04B2H-ANTERIOR-POSTERIOR-SUFFIX-001 | 4 | 2415 | 4 | 2411 | UNATTESTED_MODIFIER=2319; BLACKLISTED_SCOPE_OR_HIERARCHY=66; AMBIGUOUS_BASE_TERM=7; BASE_CONFLICT_OR_SCOPE_REVIEW=1; NO_UNAMBIGUOUS_BASE_IDENTITY=18 |
| M04B2H-ORDINAL-SUFFIX-001 | 1 | 2415 | 2 | 2413 | UNATTESTED_MODIFIER=2389; BLACKLISTED_SCOPE_OR_HIERARCHY=1; AMBIGUOUS_BASE_TERM=7; BASE_CONFLICT_OR_SCOPE_REVIEW=2; NO_UNAMBIGUOUS_BASE_IDENTITY=14 |

Enabled rules require source-demonstrated paired realizations and an unambiguous direct base term. The run emits no generic medial/lateral or internal/external rule because their observed realizations do not meet the deterministic evidence threshold. Hard blacklist terms cover unresolved branch/segment/part/whole, region/entity, aggregate, tributary, lobule, fascia, nerve-root/ramus, eponym, and ambiguous word-order cases.

## Evidence and safety

Every controlled-derived candidate records its direct base claim IDs, modifier-example claim IDs, rule ID/version, component evidence, and source dependencies. Source conflicts preserve all observed forms and never receive a derived winner. All candidates have `productionEligible=false`.

The production boundary remains unchanged: searchable Vietnamese = 0, SOURCE_VERIFIED = 0, MEDICAL_REVIEWED = 0, releaseEligible = 0, and release = UNRELEASED. The run manifest records input/output hashes and the production file hashes.

## Research artifacts

* `data/terminology/research/m04b2h/authority-component-lexicon.json`
* `data/terminology/research/m04b2h/composition-rules.json`
* `data/terminology/research/m04b2h/direct-candidates.jsonl`
* `data/terminology/research/m04b2h/derived-candidates.jsonl`
* `data/terminology/research/m04b2h/concept-candidates.jsonl`
* `data/terminology/research/m04b2h/residual.jsonl`
* `data/terminology/research/m04b2h/coverage-summary.json`
* `data/terminology/research/m04b2h/run-manifest.json`
* `scripts/m04b2h-expand.mjs`
* `scripts/test-m04b2h.mjs`

M04B2H stops after this finite controlled expansion pass. The residual is not a new research campaign.
