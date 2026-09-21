# M04B2F — Staged implementation plan

Status: **PLAN ONLY — DO NOT EXECUTE AS PART OF THIS RESEARCH PASS**. All paths below are repository-relative. New scripts/data are proposals, not files created by this milestone. No commit is requested.

## Execution contract

Implement one stage at a time with the supplied policy JSON and adversarial matrix. Normal Codex/GPT-5.6 is sufficient for the bounded software work in all stages; this is a task-complexity judgment, not a performance guarantee. Do not ask a larger model to replace an ontology reviewer or rights decision. Astra is not required again unless a genuinely new semantic problem invalidates this contract; document such a problem rather than improvising a relaxed rule.

Every stage must preserve raw source wording, code/page/group metadata and source dependencies; forbid AI translation, generated Vietnamese, preferred-term decisions, majority votes, newest-source rules, qualifier stripping, side composition, production promotion, UI changes and medical review. No changes to production entries, sources, reviewers, release metadata or atlas. Do not modify legacy parser behavior or retroactively rewrite MOH aliases; the new bridge reader marks them discovery-only.

Separate public-offline and licensed-local profiles. Do not read restricted data implicitly. Fail closed on unknown facts. Preserve all blockers and evidence paths. Treat zero gain as a valid outcome.

## Baseline and read-only hashes

Inspected HEAD: `7ac5d50666625a3c9327933d7f082525d4cf4d74`. The working tree also contains pre-existing untracked research files; do not delete, reformat or absorb them. Freeze the actual 421 eligible FMA IDs and nine conflict IDs from the existing result before implementing. Preserve the complete 3,432-ID atlas universe.

| File | SHA-256 at planning inspection |
| --- | --- |
| `public/models/atlas.json` | `c359f4bcd2cba90b7411d66d5e9fc04dc81294d46cd5c1e8b212c824f2e5bbee` |
| `data/terminology/entries.json` | `b21a8741b3522644bf021470a27fa843464b10eb99d10bca9b05441b5351d28a` |
| `data/terminology/reviewers.json` | `3015971a9083a4be10471597c79d7cf1f382a0255bccba7d6be679185930dbd2` |
| `data/terminology/release.json` | `ad805ff4153e735d3bd3167a421d8c388f4a0b5b797f2eb04b2f30ead9d6ad21` |
| `data/terminology/sources.json` | `6c4a6195b285cee1a5325d8ac45fb479851f2ad8d933085c97e8bfd4e26cef73` |
| `data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl` | `e33a10b61e59040a84e8eaa5b928b69596120ed697162c176158881e52bff820` |
| `data/terminology/research/m04b2e-bulk-match-results.json` | `b574d51d64a598d13114812cb50e64cf329b937e5fbbf817db251e10d3f690af` |

If these inputs have legitimately changed before implementation, stop using these hashes as the baseline: produce an explicit delta and pin the new baseline. Do not overwrite newer user work. Hash equality is a preservation check, not validation of source semantics.

## M04B2F-0 — Contract, baseline and source acquisition

**Objective:** turn the proposed schemas into validated research contracts; freeze the source cohort and identify legally usable pinned ontology/bridge inputs without creating any mappings.

**Exact inputs:** the six M04B2F planning artifacts; atlas; 1,506-line MOH compact file; M04B2E manifest/result; source catalog read-only; production files for hashes; existing cache manifests; official sources S01–S13 and any operator-supplied authorized artifacts.

**Exact outputs:** schema files; immutable run-input manifest; sorted baseline eligible ID set and digest; source-row ledger retaining all 1,506 original lines/locators; source-key alias registry; license/use/export registry; acquisition report with explicit unavailable inputs. Empty trusted-bridge registry is valid. A source lacking an edition gets a null source edition and a blocker, not a guessed release.

**Likely files changed/created:**

- New `data/terminology/research/m04b2f/schema/*.schema.json`, `source-registry.json`, `input-manifest.json`, `baseline.json`, and `source-rows.jsonl` only where public content is already cleared.
- New `scripts/m04b2f-inputs.mjs`, `scripts/test-m04b2f-contract.mjs`; dedicated script entries in `package.json` if useful.
- Local authorized source files and restricted manifests under `.local/terminology-source-cache/m04b2f/`.
- New `docs/en-vi/M04B2F0_ACQUISITION_REPORT.md`.

**Acceptance tests:** JSON Schema validation; 1,506 rows accounted for exactly once; 3,432 atlas IDs; baseline 421 IDs and unchanged production hashes; exact raw hashes and locators; wrong-ID namespaces, missing versions and unsupported source groups explicitly handled. Negative fixtures reject missing required fields and unapproved export fields. Public mode works without local licensed files. No full source bodies or credentials in Git.

**STOP condition:** deliver manifest and acquisition gaps before ingestion. Unauthorized inputs are not loaded. If neither licensed ontology input nor cleared direct bridge is available, allow public fixtures/reporting to continue while keeping real mapping status unresolved. Input count/hash drift stops dependent real-data stages until explained.

**Must NOT:** acquire credentials/accept contracts for the user, expand the MOH cohort, rewrite source parsing, infer FMA meaning from mesh composition, or approve any bridge.

**Model:** normal Codex/GPT-5.6 sufficient; Astra not needed. A human/operator may need to supply authorized source access; the stage remains useful without it.

## M04B2F-1 — Endpoint facts and trusted bridge ingestion

**Objective:** ingest release-pinned facts and explicit assertions with provenance, without classifying lexical matches as exact.

**Exact inputs:** F0 schema/manifest and source rows; FMA export plus identifier history; authorized RF2 concept/description/relationship/OWL/refset/module dependencies as available; 734138000/734139008 anatomy associations and laterality facts; proposed map artifacts; human map-admission records; optional authorized UMLS release with source versions.

**Exact outputs:** endpoint-fact ledger; active/inactive/history resolution ledger; typed SEP partner ledger; source adapter validation report; admitted explicit bridge ledger or empty registry; separate candidate ledger for CUI, source synonyms and other discovery; license dependency closure. Every inferred fact records rule, evidence refs and stated/inferred/additional characteristic. Human local bridge approvals are separately entered records, never generated by the ingestion tool.

**Likely files:** new `scripts/m04b2f-ingest.mjs`, `scripts/m04b2f-adapters/*.mjs`, `scripts/test-m04b2f-ingestion.mjs`; public cleared manifests/assertions under `data/terminology/research/m04b2f/`; all restricted ledgers local; `docs/en-vi/M04B2F1_BRIDGE_INGESTION_REPORT.md`.

**Acceptance tests:** RF2 effective-time/active selection, module dependency completeness, historical ambiguity, SCTID string preservation/check digit/concept partition, association role direction, field-specific UMLS CODE/SCUI resolution, atom suppression without conflating it with RF2 active status. Multiple CUI endpoints survive as candidates. Unspecified xref predicates are not exact. Trusted assertion endpoint mismatch and conflicting maps are rejected/queued. No licensed crosswalk is exported without clearance.

**STOP condition:** every input assertion/fact is accepted with a typed evidence path or quarantined with reason. Stop real-data promotion if endpoint release or map semantics cannot be established; absence of a trusted map is a valid report. Do not relabel a guessed match to compensate.

**Must NOT:** strip Entire/Structure/Part, synthesize sides or descriptions, automatically follow historical replacements, borrow authority from BioPortal hosting, or treat a shared CUI as T1.

**Model:** normal Codex/GPT-5.6 sufficient. Human map-publisher admission/ontology review is required where specified. Astra not needed.

## M04B2F-2 — SEP-aware deterministic assessment

**Objective:** implement a pure offline assessment engine that consumes normalized pinned facts and approved assertions and emits pair decisions. Discovery and approval remain separate operations.

**Exact inputs:** F1 ledgers, policy version, relation JSON, tier JSON, all 60 gate cases and integration/metamorphic cases, plus source-adapter fixtures. Facts must be evidence-backed, not model-assigned PASS flags.

**Exact outputs:** pair-assessment module, deterministic candidate/row reducer, rule traces, blocker vectors, pure evidence export gate, a test report showing all negative and positive controls. No real-row promotion is necessary for this stage.

**Likely files:** `scripts/m04b2f-classifier.mjs`, `scripts/test-m04b2f-classifier.mjs`, `data/terminology/research/m04b2f/fixtures/` with synthetic inputs, optional dedicated package test command, `docs/en-vi/M04B2F2_CLASSIFIER_REPORT.md`.

**Acceptance tests:** zero false-positive eligibility on negative fixtures; positive controls retain correctly pinned direct/approved mappings; all precedence and provenance invariants. Prove that P-to-whole never becomes subclass merely from parthood; S-to-E partner traversal never transfers the source term; same CUI never opens exact eligibility. Unknown-to-unknown compatibility fails. Input shuffling preserves canonical results. Changed source/rule/review dependencies invalidate decisions. Public profile excludes restricted dependency closure.

**STOP condition:** any false-positive control, unsupported PASS, ambiguous precedence, circular proof or nondeterminism blocks F3. Resolve policy ambiguity explicitly; do not change expected outputs simply to make tests pass.

**Must NOT:** use an LLM/embedding score for eligibility, assign probabilistic confidence, broaden an approved pair to a family, implement general cross-ontology transitive reasoning, or call online services during classification.

**Model:** normal Codex/GPT-5.6 sufficient. Astra not needed; semantic gaps become written review questions with minimal counterexamples.

## M04B2F-3 — Frozen MOH batch and review packets

**Objective:** classify the 1,506 compact rows with complete accounting and retain a reproducible review surface. Only T0–T2 evidence can become eligible.

**Exact inputs:** frozen source ledger, atlas, baseline set, pinned F1 endpoint/bridge ledgers, F2 engine/policy, explicit run profile and license decisions. Optional human ontology approvals supplied between runs have identities and version dependencies.

**Exact outputs:** one row decision per source row; all pair assessments; accepted evidence links keyed by row and FMA; review queues; counts by row disposition/tier/blocker/ontology family; unique target overlap and new-coverage sets; separate public and local reports. Group review packets by SCTID, source scope and blocker for efficiency, but enumerate every approved pair.

**Likely files:** new `scripts/m04b2f-batch.mjs`, `scripts/test-m04b2f-batch.mjs`; cleared `data/terminology/research/m04b2f/{row-decisions,pair-assessments,eligible-evidence,review-queue}.jsonl`, `run-manifest.json`, `coverage.json`; local equivalents in cache when restricted; `docs/en-vi/M04B2F3_MOH_BATCH_REPORT.md`.

**Acceptance tests:** disposition sum 1,506; exact equality of input/output row ID sets; accepted targets belong to atlas; at most one accepted FMA per row; raw source ledger/MOH corpus byte-identical; actual row SCTID equals selected bridge endpoint. Distinguish NO_CANDIDATE_FOUND from reviewed NO_ATLAS_COUNTERPART. Report duplicate targets separately. Repeated run yields identical decisions. No minimum gain threshold.

**STOP condition:** count/identity/hash mismatch, ambiguous selected target, source-term substitution or public license leak stops serialization/publication. Missing ontologies produce complete review outcomes rather than speculative mappings. Finish with unresolved queues intact; human review is not simulated.

**Must NOT:** modify the 34,381 unmatched MOH rows outside this cohort, count Structure corroboration as eligible, translate or rewrite raw terms, or auto-approve a batch based on a sampled example.

**Model:** normal Codex/GPT-5.6 sufficient; ontology reviewer required only to approve unresolved pairs. Astra not needed.

## M04B2F-4 — Multi-authority recomputation and regression

**Objective:** add validated MOH evidence to a new research result while preserving baseline authority evidence and keeping ontology scope separate from terminology disagreement.

**Exact inputs:** F3 eligible evidence and nonexact links; pinned prior M04B2E result/manifest; reconstructed NVH corpus; HMU2022 and UMP2023_T2 attestations; future sources only if explicitly added to a versioned manifest; bibliographic independence registry; M03C regression matrix; unchanged production files.

**Exact outputs:** one new research concept result for each of 3,432 atlas IDs, evidence membership and interaction flags, raw variants/conflicts, distinct eligible ID sets, explained metric deltas and regression report. Preserve the historical M04B2E artifact as a baseline rather than overwriting it. Distinguish coverage additions from changes caused by stricter accent-preserving agreement keys.

**Likely files:** new `scripts/m04b2f-recompute.mjs`, `scripts/test-m04b2f-regression.mjs`, `data/terminology/research/m04b2f-multi-authority-results.json`, `docs/en-vi/M04B2F4_MULTI_AUTHORITY_REPORT.md`. If shared code reuse is necessary, minimally extend `scripts/m04a-bulk-evidence.mjs` / `scripts/m04b2e-bulk-ingestion.mjs` with an explicit opt-in research bridge interface and preserve legacy behavior when absent. Do not enable MOH by flipping a source-global authority flag. No production source catalog change.

**Acceptance tests:** 3,432 unique concept results; baseline 421 ID set preserved; NVH 430/974/5,556 source accounting unchanged; M03C unexplained regression zero. Existing 49 PASS and one INPUT_GAP states must remain or have individually documented new evidence; no fabricated NVH proof for FMA9597. Retain the nine unresolved conflict findings. Agreement requires independent authorities and compatible scope; accent-only collision and generic/side-specific evidence do not count. New gain equals accepted-target set difference, not row count. Production hashes and all zero/UNRELEASED invariants hold. Repeat public run without licensed cache and obtain identical public result.

Run the focused new tests, then appropriate existing regression checks after inspecting their file writes. Existing `test-m04b2e2r1.mjs` loads source cache and calls build functions; use scratch outputs or verify its read-only path before invoking it. Do not casually run ingestion/build entry points that overwrite historical research outputs. No UI/build-wide test expansion is needed unless implementation changes justify it.

**STOP condition:** unexplained baseline loss, conflict erasure, changed protected files, false agreement, restricted public output or any release-state change blocks completion. An all-review MOH result with baseline preserved is acceptable. End after the research recomputation report; preferred-term or production work needs a separate milestone.

**Must NOT:** majority vote, prefer newest source, auto-resolve variants/conflicts, treat ontology approval as medical approval, or alter searchable Vietnamese/release flags.

**Model:** normal Codex/GPT-5.6 sufficient; no Astra return expected.

## Low-cost handoff and maintenance

Each later execution prompt should name its stage, pinned input manifest, allowed files, preceding acceptance report and STOP rules. Read only affected ledgers; memoize endpoint facts by `(system, edition, module, release, ID)` and pair reviews by both endpoint versions plus scope hashes. Use sorted hash-indexed JSONL files rather than a new database. Cache failures as typed facts with recheck triggers; do not repeatedly web-search the same missing partner.

Future release changes trigger dependency-based invalidation, not wholesale manual remapping. Public and licensed-local outputs never share an implicit default output path. Public export clearance is checked on all transitive proof dependencies. A source's multiple access copies share the same authority lineage.

There is no mandatory future deep-reasoning pass. If the current policy cannot express a new phenomenon, create a minimal contradictory fixture and stop only that affected queue; ordinary tooling can continue on resolved cases. An ontology expert or rights holder may still be needed. More model compute cannot grant a license or establish an unobserved anatomical equivalence.

## Planning-pass validation boundary

The current task creates only the six planning documents. Validate JSON syntax/schema structure, unique fixture/rule IDs, cross-file enum references, Markdown links and protected-file hashes. Do not run the planned classifier tests as though an implementation exists. Do not claim that the adversarial fixtures passed against a classifier; they are acceptance specifications for F2.

Planning-pass checks completed: all three JSON documents parse; the embedded Draft 2020-12 record schema validates and compiles with the repository's installed Ajv; all 60 gate inputs satisfy the proposed input schema; 30 integration/metamorphic specifications have unique IDs; disposition/rule references and local Markdown links resolve; all seven pinned input/protected-file hashes remain unchanged. These checks validate the plan's structure only. No classifier was implemented or executed, no mapping was approved, and no coverage or production state was changed.
