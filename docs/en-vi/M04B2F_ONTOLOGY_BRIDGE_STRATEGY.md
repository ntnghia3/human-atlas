# M04B2F — Safe FMA ↔ SNOMED / MOH anatomy ontology bridge

Status: **PROPOSED_RESEARCH_ARCHITECTURE_ONLY**. Research date: 2026-09-21. Repository inspected at `7ac5d50666625a3c9327933d7f082525d4cf4d74`.

## Decision

Use an immutable source ledger, a versioned pairwise bridge ledger, and a deterministic evidence gate. Automatically replay **explicit, approved equivalence assertions** after checking their endpoints and scope. Do not automatically create equivalence from a shared CUI, English equality, matching parents, or an SEP association. Such evidence generates or prioritizes review candidates. A licensed local UMLS verifier is optional; public reproducibility must not depend on redistributing UMLS content.

The bridge attaches an existing MOH attestation to a specific atlas FMA identity. It does not select a Vietnamese preferred term, validate translation, certify a mesh, perform medical review, or authorize release. A correct FMA-to-Entire bridge cannot transfer the Vietnamese wording of a different MOH Structure row to that Entire concept.

Companion specifications:

- [Relation model and proposed record schemas](research/M04B2F/M04B2F_BRIDGE_RELATION_MODEL.json)
- [Evidence tiers and gates](research/M04B2F/M04B2F_MAPPING_TIERS.json)
- [Adversarial test specification](research/M04B2F/M04B2F_ADVERSARIAL_TEST_MATRIX.json)
- [Staged implementation plan](research/M04B2F/M04B2F_IMPLEMENTATION_PLAN.md)
- [Sources, access findings, and license policy](research/M04B2F/M04B2F_SOURCE_AND_LICENSE_MATRIX.md)

These files specify future work; no classifier, bridge data, source promotion, or production edits are delivered in this milestone.

## 1. Verified local baseline and integration hazards

Read-only inspection confirms BodyParts3D 4.0, 3,432 atlas concepts, 1,506 compact MOH rows, 1,506 distinct Ministry codes and 1,506 distinct retained SNOMED identifiers. The current research result reports 421 eligible concepts, following historical baselines 47 and 80. NVH accounting remains 430 reconstructed rows, 974 integrity-review blocks and 5,556 unmatched blocks out of 6,960. HMU2022 has 31 retained attestations; UMP2023_T2 has 12; UMP2023_T1 has none. The full MOH text layer covers 1,441 pages; the earlier report also records 34,381 unmatched structured rows outside this compact cohort.

Inputs inspected:

| Artifact | Role and constraint |
| --- | --- |
| `public/models/atlas.json` | 3,432 stable concept IDs, names and mesh memberships; not a complete FMA ontology export |
| `data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl` | Immutable MOH compact cohort; `sourceId=NATIONAL_BODY_TERMS_2025` |
| `data/terminology/research/m04b2e-source-manifest.json` | Acquisition metadata uses `MOH2025_BODY_STRUCTURE`; declare this source-key correspondence explicitly |
| `data/terminology/research/m04b2e-bulk-match-results.json` | Freeze the actual 421-concept baseline set, not merely its count |
| `scripts/m04b2e2r-acquisition.mjs` | Source parsing and legacy candidate-alias generation |
| `scripts/m04a-bulk-evidence.mjs` | Source-level authority checks and generic matching; authority status alone does not establish pairwise identity |
| `scripts/m04b2e-bulk-ingestion.mjs` | Research coverage aggregation and reports; currently includes accent-folding in one agreement metric |
| `scripts/test-m04b2e2r1.mjs` | Existing parser-integrity/regression contract; review side effects before running during later implementation |

Legacy MOH `english.aliases` can remove a generic Structure suffix. Notes name candidate FMA IDs and matching tiers. Preserve these bytes, but mark them `LEGACY_DISCOVERY_ONLY`; neither field supplies semantic proof. Rebuild future candidate keys from untouched source fields without deleting qualifiers. A source `preferred` field means “the source's wording,” never the application's selected term. The compact record's `anatomicalCategory="body structure"` is too coarse to establish organ/tissue/region identity; `laterality="unsided"` may only mean no side was parsed. Recover source group from existing staging if available; otherwise explicitly record it as unknown.

The baseline result reports searchable Vietnamese, SOURCE_VERIFIED, MEDICAL_REVIEWED and releaseEligible all zero, UNRELEASED, with no reviewers. File hashes and audit boundaries are recorded in the implementation plan. Existing untracked research artifacts were present before this task and are outside its change set.

## 2. Research findings and their authority

**Official ontology semantics.** SEP Entire denotes complete entities; Part denotes proper parts; Structure subsumes both. The official guide also warns of historical exceptions, missing Entire partners, non-countable tissue interpretations and immaterial entities outside SEP. Therefore do not assert `S = E union P` for every released concept. Use the exact release's evidence. [SNOMED anatomical concept model](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/anatomical-concept-model), [SEP glossary](https://docs.snomed.org/snomed-international-documents/snomed-ct-glossary/s/sep).

Names are insufficient: Structure synonyms may omit “structure,” while current naming guidance requires Entire descriptions to retain “Entire.” A missing word in a MOH English field does not change its SCTID's meaning. [Official SEP naming guidance](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/index/naming-convention-for-sep-model).

RF2 defines anatomy association reference sets **734138000** (structure/entire) and **734139008** (structure/part). These can establish within-SNOMED partner relationships; they are not FMA equivalence maps. Pin active member records, endpoint concepts, effective times and module dependencies, and verify direction from the acquired release. [Association reference set specification](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-release-file-specification/reference-set-release-file-specification/5.2-reference-set-types/5.2.1-content-reference-sets/5.2.1.4-association-reference-set).

Current laterality guidance does not require every lateralized Structure to have a lateralized Entire/Part partner, and discusses bilateral differences across editions/extensions. Missing partners and bilateral labels must not trigger synthetic codes or automatic side composition. [SNOMED laterality guidance](https://docs.snomed.org/snomed-ct-specifications/snomed-ct-editorial-guide/readme/authoring/domain-specific-modeling/body-structure/anatomical-concept-model/laterality).

**FMA identity.** FMA models classes and relations of canonical human anatomy. Its official project page states that there have been no new releases since 2019. Pin the export actually obtained, including identifier namespace and history; BodyParts3D's FMA assignments and display names are not a substitute for these definitions. [University of Washington FMA project](https://si.washington.edu/projects/fma/).

**Curated integration versus equivalence.** UMLS 2026AA lists FMA4_15 and SNOMEDCT_US_2026_03_01. This establishes joint source availability, not rowwise equivalence or MOH's source edition. CUIs collect synonymous atoms under NLM's integration policy; source and Metathesaurus synonymy can differ. A shared CUI is strong discovery evidence, not a proof of this project's stricter anatomical identity contract. [2026AA source appendix](https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/license_agreement_appendix.html), [NLM Metathesaurus reference manual](https://www.ncbi.nlm.nih.gov/books/NBK9684/?report=printable).

**Research literature.** Bodenreider and Zhang (2006) used lexical anchors and structural validation, preferred Entire counterparts, and generated simplified synonyms. They reported 8,228 lexical mappings, over 97% structurally supported, using 2005 releases. That percentage is neither contemporary accuracy nor a forecast for this atlas. Reuse the separation of discovery and validation, not automatic synonym synthesis or their collapse of different part relations. [Primary paper, NLM-hosted PDF](https://lhncbc.nlm.nih.gov/LHC-publications/PDF/pub2006054.pdf).

Zhang and Bodenreider (2007), working on FMA/GALEN rather than FMA/SNOMED, combined modifier, structural and disjoint-category checks to detect mismatches. These are useful negative controls, not a supplied bridge. [Primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC2655858/). The 2015 NEO paper compares structural discrepancies using UMLS mappings; its abstract supports auditing graph differences, not treating those seed mappings as validated truth. [NEO](https://pmc.ncbi.nlm.nih.gov/articles/PMC4525277/). A 2018 study identifies differences in anatomical boundaries and some BodyParts3D FMA assignments; consequently this milestone certifies evidence for IDs, not rendered geometry. [Primary study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6371295/).

**Supplemental discovery.** BioPortal distinguishes LOOM lexical mappings, CUI mappings and other origins. An entry there inherits its original method and license; hosting does not make it authoritative. [NCBO mapping documentation](https://www.bioontology.org/wiki/BioPortal_Mappings).

No current, downloadable, licensed, authoritative FMA↔SNOMED exact map was verified during this pass. UW's related-project listing is an acquisition lead only. The trusted-map registry therefore starts empty. No licensed RF2/UMLS/FMA release was acquired or exhaustively checked here. Access limitations and retrieval depth are listed in the source matrix.

## 3. What equivalent means

All mappings compare **classes under a fixed version and interpretation**, not labels, individual patients or mesh membership. `EXACT_ENTITY_EQUIVALENT` requires an approved assertion of the same anatomical class extension and compatible entity kind, boundaries, partition basis, laterality, cardinality, countability, canonical context and granularity. Structural compatibility alone is a necessary check, not a sufficient proof. Unknown is not equal, and absence of a contradiction is not proof of equality.

Use orthogonal fields to avoid an unmanageable relation enum:

| Axis | Values and interpretation |
| --- | --- |
| `relationType` | EXACT_ENTITY_EQUIVALENT; FMA_SUBCLASS_OF_SNOMED; SNOMED_SUBCLASS_OF_FMA; FMA_PROPER_PART_OF_SNOMED; SNOMED_PROPER_PART_OF_FMA; OVERLAP_NON_EQUIVALENT; DISJOINT; UNDETERMINED |
| `sepClass` | S, E, P, NOT_APPLICABLE, UNKNOWN, CONFLICTING; belongs to the SNOMED endpoint |
| `lateralityRelation` | EXACT, MISMATCH, UNDERSPECIFIED, UNKNOWN, NOT_APPLICABLE |
| `scopeChecks` | Separate PASS/FAIL/UNKNOWN checks for entity kind, boundary, partition, cardinality, countability, granularity, canonical context and SEP compatibility |
| `candidateBasis` | Direct assertion, approved local review, shared CUI, exact source wording, normalized source synonym, legacy alias or other discovery |
| `disposition` | Operational queue/result, separate from the semantic relation |

User-proposed labels are represented without conflating axes:

- `FMA_EQUIVALENT_TO_SNOMED_ENTIRE`: exact relation plus E; not a universal rule.
- `SNOMED_STRUCTURE_BROADER_THAN_FMA`: FMA_SUBCLASS_OF_SNOMED, only if supported by proof; E-to-S ancestry does not authorize evidence transfer.
- `SNOMED_PART_NARROWER_THAN_FMA`: rejected as a default. A heart part is not a kind of whole heart. Use the proper-part axis when asserted, otherwise UNDETERMINED.
- `FMA_BROADER_THAN_SNOMED`: SNOMED_SUBCLASS_OF_FMA, with an actual subclass proof, not a smaller spatial extent.
- `LATERALITY_EXACT_EQUIVALENT`: laterality EXACT only; it cannot imply whole-concept equivalence.
- Region/material, organ/tissue, aggregate/single, system/subdivision and branch/segment mismatch labels become explicit blockers.
- `LEXICAL_ONLY_CANDIDATE` is an evidence tier; `ONTOLOGY_BRIDGE_REQUIRED` is a blocker/queue state; `NO_SAFE_MAPPING` is a disposition.

No `owl:sameAs` is emitted. No broader, part-of, located-in, member-of or associated-with link can be promoted by transitive closure into an exact bridge. Any approved future multi-hop equivalence path must consist solely of individually approved, version-compatible exact assertions; v1 accepts direct pair assertions only.

## 4. Evidence tiers and automatic behavior

The JSON tier file is normative. Tiers are provenance classes, not numerical probabilities and not an additive scoring system.

| Tier | Evidence required | Automatic eligibility | Human ontology review | Medical terminology review |
| --- | --- | --- | --- | --- |
| T0 DIRECT_SOURCE_FMA_ID | Source explicitly identifies the FMA endpoint and binds this exact attestation; source scope compatible | Yes after all gates; not currently observed in ordinary MOH rows | Source identity policy approved; exceptions queued | Required before any later production use |
| T1 TRUSTED_EXPLICIT_BRIDGE | Registered map publisher, versioned exact predicate, exact endpoints, accepted purpose, traceable evidence, licensed use | Yes after all gates | Prior map admission review; no repeated per-row review unless conflict | Required later |
| T2 REVIEWED_LOCAL_BRIDGE | Named human ontology reviewer approved one pair against pinned primary endpoint evidence and recorded scope decisions | Yes on replay of that exact review | Required once per pair/version; automation cannot author approval | Required later |
| T3 SHARED_CUI_VALIDATED_CONTEXT | Exact source IDs share a CUI in one pinned UMLS release; endpoint and structural checks pass | No; prioritize pair review | Required to reach T2 | Required if ever used in production |
| T4 EXACT_LEXICAL_STRUCTURAL | Exact raw/source synonym equality, active endpoints, compatible scope and independent structural support | No | Required to reach T2 | Required later |
| T5 NORMALIZED_SYNONYM_STRUCTURAL | Source-attested synonym; conservative normalization; same structural checks | No | Required to reach T2 | Required later |
| T6 LEXICAL_ONLY | Label resemblance, old derived alias, incomplete structural information | No | Required if pursued | Required later |
| TX UNRESOLVED_OR_REJECTED | Missing, contradictory, stale or invalid identity evidence | No | Required if repairable | No medical task now |

Global disqualifiers override every tier: wrong endpoint/edition; invalid or unresolved identifier; incompatible or unknown required scope; missing locator/raw attestation; source-code/label conflict; conflicting trusted assertions; unreviewed history replacement; unresolved credible alternative target; unauthorized use of restricted input. T0–T2 do not override them. Nonexact verified links can be CORROBORATIVE_ONLY, never counted as eligible evidence.

Human ontology review concerns identity and scope, not which Vietnamese term is medically preferable. A reviewer may reject a mapping or certify its endpoints; they cannot silently rewrite the MOH row. If the bilingual source wording seems inconsistent, route to SOURCE_ATTESTATION_REVIEW and preserve it. No AI translation is part of any tier.

## 5. Deterministic SEP and scope rules

The following are **local policy derived from the cited semantics**, not claims that SNOMED already supplies complete assertions for every row.

1. Resolve the MOH SCTID as a string to a pinned edition/module/date. Preserve the original code even when inactive. Validate SCTID syntax/check digit and concept partition; a description ID or integer rounded by JavaScript is invalid. An inactive code, unknown historical edition, split replacement or ambiguous association goes to IDENTITY_REVIEW. A separately reviewed version bridge can resolve history; never use today's label to repair yesterday's source silently.
2. Obtain SEP membership from active association members and compatible endpoint metadata. Record FSN pattern as supporting evidence. Parent `(body structure)` semantic tag does not mean SEP S. Pattern-only, absent, contradictory or mixed SEP evidence remains UNKNOWN/CONFLICTING. NOT_APPLICABLE requires positive evidence of the non-SEP class; it is not a fallback for missing data.
3. Resolve FMA definitions and typed relations. Keep regional part, constitutional part, membership, location and subclass links distinct. A named part such as a chamber can be an entire entity in its own right; FMA “is a part somewhere” does not imply mapping to a generic SNOMED P class.
4. Verify side, entity kind, extent, partition basis, countability, cardinality, species/canonical context and granularity independently. Labels and shared top ancestors cannot fill missing facts. Both sides saying UNKNOWN must fail exact eligibility.
5. Replay a T0–T2 assertion only if all required checks pass and it targets the row's actual SCTID. Graph isomorphism, one matching parent, or two mutually supporting unapproved anchors cannot create an assertion.
6. Prefer safe rejection/queueing to inferred completion. A missing E partner never converts S into E. No side combination or invented postcoordinated expression is allowed. Release changes invalidate affected approvals until replayed/reviewed against the new inputs.

**Right kidney example, schematic labels, not verified current codes:**

| FMA endpoint and SNOMED candidate | Classification when stated facts are proved |
| --- | --- |
| Whole right kidney ↔ Entire right kidney | Exact is possible only with compatible boundaries and T1/T2 assertion; words alone remain T6 |
| Whole right kidney ↔ Right kidney structure | FMA_SUBCLASS_OF_SNOMED if the exact E bridge and E→S relation are established; CORROBORATIVE_ONLY; source wording stays attached to S |
| Whole right kidney ↔ Right kidney part | Proper-part relation if explicitly supported; not SNOMED_SUBCLASS_OF_FMA; no exact evidence |
| Whole right kidney ↔ Entire kidney, unspecified side | LATERALITY_REVIEW; no general-to-side transfer |
| Renal substructure ↔ Right kidney part | Not exact merely because it is a part; a generic P class may cover many distinct substructures |

Do not assume all three candidates exist in the selected release. The 2006 study itself described a missing right-kidney P concept in its historical data; this is not evidence about 2026 content.

| Family | Additional required scope facts |
| --- | --- |
| Bones | Named bone organ vs bone tissue; cartilage inclusion; fused bone vs set; side and numbered element |
| Muscles | Individual muscle vs functional group, tissue or muscle portion; heads/bellies and attachment-based boundaries |
| Arteries | Tree vs trunk vs branch vs segment; origin/termination and named partition; no inference from shared downstream territory |
| Veins | Vessel vs venous tree/plexus; tributary relation separate from subclass; named segment limits |
| Nerves | Trunk vs root vs branch vs fascicle vs tissue; cranial/spinal level and side |
| Ligaments | Individual band vs complex vs part; paired/aggregate identity and attachment context |
| Glands | Whole organ vs lobe vs duct vs glandular tissue; group vs individual and side |
| Regions | Material 3D region vs surface/landmark; boundary and partition convention; similarly named surface is not equivalent |
| Systems | System vs subdivision, tract or member set; functional class vs anatomical individual class |
| Cavities | Immaterial space vs contents vs wall/lining; extent and communication do not imply equality |
| Tissues | Portion semantics, site and layer identity; E is not an assumption of a bounded whole organ |

Known boundary disagreement is a veto even if the same English label, parent and CUI recur. Canonical adult atlas context must not absorb fetal, pathological, postoperative or device concepts merely because they sit under Body Structure.

## 6. Optional UMLS verifier

UMLS can materially reduce candidate search, expose source synonyms and provide atom-level audit trails. It cannot by itself close the equivalence gate. In the local licensed profile:

1. Pin UMLS release plus MRSAB versions and files. Do not confuse the September 2026 standalone US SNOMED release with SNOMED content integrated in UMLS 2026AA. MOH 2025's exact edition remains an acquisition question. [NLM standalone release page](https://www.nlm.nih.gov/healthit/snomedct/us_edition.html).
2. Resolve FMA and SNOMED source concepts using a source-specific adapter verified against source documentation and samples. Retain SAB/VSAB, CODE, SCUI, SAUI, AUI, CUI, TTY, SUPPRESS and source revision. Never assume CODE means concept identifier for all sources; NOCODE, source descriptor IDs and MTH-generated identifiers require explicit handling. Do not infer RF2 active status solely from SUPPRESS=N.
3. Join only pinned FMA and allowed SNOMED source atoms on CUI. Enumerate all source-concept pairs; do not pick the first atom or collapse S/E/P endpoints. Filter suppression/obsolete ambiguity but keep exclusion reasons. Inspect source definitions and RF2 relationships independently; semantic types are too broad for exact identity.
4. Classify result as T3 even if scope checks pass. Human review may create a T2 assertion with its original restricted provenance. A map found in MRMAP/MRSMAP is assessed by its actual publisher, purpose and predicate; merely being a UMLS mapping is not T1.
5. Keep licensed files, atom joins, CUI tables, labels and derived pair decisions local by default. A public file containing only FMA IDs, SCTIDs and booleans can still expose a restricted crosswalk. Removing labels or CUIs does not clear rights.

**Public profile:** runs offline from existing corpus snapshots, public policy, synthetic fixtures, and any individually cleared public bridge assertions. Missing licensed verification is reported as unavailable, never as PASS. **Licensed-local profile:** reproduces extra results from separately obtained pinned files; output is isolated and explicitly labelled. Public results must be identical whether or not local licensed files happen to exist. Only an approved export manifest may change public inputs. Thus algorithm/public results are reproducible without UMLS; licensed-only coverage is reproducible only by authorized holders of the same data and is reported separately.

License conclusions are conservative engineering policy, not a blanket legal permission. The NLM agreement restricts redistribution of subsets; SNOMED adds its own terms. See the source/license matrix for field-level handling, clearance and failure behavior. [NLM agreement, clauses 3 and 12](https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/license_agreement.html).

## 7. The 1,506-row promotion gate

Retain three levels: immutable source row; zero or more candidate-pair assessments; exactly one row disposition. Do not duplicate source rows to represent candidates. One attestation may be replayed to at most one distinct FMA class in v1; if atlas aliases ever duplicate that class, handle them as a separately audited identity projection, not extra coverage.

At row level, run these steps in order, retaining **all** blockers even when one selects the primary queue:

1. Source integrity, revision, locator and raw wording → SOURCE_ATTESTATION_REVIEW on failure.
2. Right to use inputs locally → LICENSE_BLOCKED when unresolved/denied. Public export is a separate gate; local eligibility is not public clearance.
3. FMA/atlas/SCTID resolution, edition consistency, credible candidate ambiguity and conflicting approved maps → IDENTITY_REVIEW.
4. Laterality mismatch/unknown → LATERALITY_REVIEW; aggregate/cardinality mismatch/unknown → AGGREGATE_REVIEW; entity-kind/boundary/partition/context/granularity/countability failure → ONTOLOGY_SCOPE_REVIEW; SEP unknown/conflict → STRUCTURE_ENTIRE_PART_REVIEW. Known nonexact relations are not “failed exact” checks: record their proven scope differences and continue to step 6, unless evidence is contradictory or incomplete.
5. A unique exact T0 match with no blockers → ELIGIBLE_EXACT_FMA_EVIDENCE. A unique exact T1/T2 match with no blockers → ELIGIBLE_WITH_PINNED_BRIDGE.
6. A valid, supported nonexact relation with known endpoints and all required relation-specific checks completed → CORROBORATIVE_ONLY. It contributes no eligible Vietnamese concept and cannot agree/conflict with exact evidence as though scope matched.
7. No accepted identity assertion but plausible candidate(s) → ONTOLOGY_BRIDGE_REQUIRED (T3–T6); known incompatible candidate(s), no viable alternatives and completed assessment → NO_SAFE_MAPPING.
8. Zero candidate does **not** prove absence. Use NO_CANDIDATE_FOUND until an explicit reviewed search-exhaustion certificate for this 3,432-ID atlas snapshot proves NO_ATLAS_COUNTERPART. This replaces the misleading global label NO_FMA_COUNTERPART; the full FMA may still contain a counterpart.

Pair assessment determines whether a scope difference is known nonexact, unresolved or contradictory. Do not emit CORROBORATIVE_ONLY for merely similar words. Row reduction discards demonstrably rejected candidates, then considers competing credible identity targets; unresolved T3/T4 targets with compatible scope block selection, while a weaker lexical resemblance alone cannot veto a fully proved exact target. Preserve discarded candidates and explanations. Conflicting T1/T2 assertions always block, regardless of tier ranking. Lexical candidates with unknown checks remain review-only. The JSON policy gives total precedence and named predicates for deterministic implementation.

The row record retains every candidate reason in `allBlockers`, while `unresolvedBlockers` contains only vetoes that still prevent row selection. Eligible rows require the latter to be empty; a rejected lexical candidate's reason must not invalidate a separately proved exact target.

Counts must satisfy `sum(rowDispositionCounts)=1506`. Pair counts need not equal 1,506. Concept coverage counts distinct FMA IDs admitted by the research gate, subtracts the frozen baseline set, and is separate from row counts, bridge counts, variants and public-export clearance. A successful identity bridge is eligible *source evidence*, never a preferred Vietnamese term.

## 8. Interaction with other authorities

Compute compatibility before text comparison. The comparison unit is `(FMA class, scope signature, source attestation)`. Preserve bibliographic work/edition and upstream copying relationships so an access copy or repeated row does not create another independent authority.

For agreement keys use Unicode NFC, trim edges and collapse layout whitespace only. Keep Vietnamese diacritics, punctuation, word order and qualifiers. Case differences and spelling/punctuation changes produce variants unless an explicitly approved nonsemantic display-equivalence policy exists. Never accent-fold to establish agreement. This is stricter than one current aggregation metric and must be reported as an explained metric change, not silently compared as the same measure.

| Evidence combination | Research result |
| --- | --- |
| NVH + exact-bridged MOH, same scope and identical conservative Vietnamese key | MULTI_AUTHORITY_AGREEMENT if independent bibliographic authorities |
| NVH + exact-bridged MOH, same scope but different wording | VARIANT_REVIEW by default; retain both; no winner |
| Different wording with explicit contradictory denotation/context or an existing unresolved conflict finding | CONFLICT_REQUIRES_ADJUDICATION; flag only, no adjudication performed |
| Exact MOH bridge + HMU explicit same-identity attestation | Agreement if wording same, otherwise variant/conflict under the preceding rules |
| NVH exact identity + broader MOH S row | ONTOLOGY_SCOPE_REVIEW for the interaction; preserve NVH eligibility; MOH remains corroborative |
| MOH side-specific + NVH unsided | Scope/laterality interaction review, not agreement and not evidence composed for the side |
| HMU generic + MOH E | Inspect independently attested HMU identity; generic wording alone cannot establish same scope |
| Repeated MOH rows, source copies, or several mappings from the same upstream source | One authority, never a vote |
| UMP2023_T1 without retained attestation | No evidence; no negative vote or generated term |

Store eligibility and interaction flags separately. Concept primary review status precedence: CONFLICT_REQUIRES_ADJUDICATION, ONTOLOGY_SCOPE_REVIEW, VARIANT_REVIEW, MULTI_AUTHORITY_AGREEMENT, SINGLE_AUTHORITY_EVIDENCE, NO_ELIGIBLE_EVIDENCE. All contributing flags remain visible. A noneligible MOH row cannot revoke independent NVH evidence or create an exact-term conflict. Existing nine conflict findings are retained unless a separately authorized documented review changes them. No majority or newest-source rule is permitted.

## 9. Coverage upside and limits

No measured semantic gain exists yet. The rigorous new-coverage bound for this fixed cohort under the v1 one-target rule is **0–1,506**, additionally capped by the **3,011** currently uncovered atlas concepts. The baseline total remains 421. Duplicate target mappings and overlaps make the upper bound loose.

Read-only lexical inventory provides a more useful planning context: 765 rows contain the word Entire; 739 contain structure outside the semantic tag; six contain part. These categories overlap and are **not SEP classifications**. Notes reference 848 distinct candidate FMA IDs, of which 597 are outside the 421 baseline. Notes are untrusted historical discovery, not accepted maps; 597 is a ceiling only if future discovery stays within those hints.

The following are workload scenarios for those 597 hinted uncovered identities, **not statistical confidence intervals or validated predictions**:

| Surface | Conditional planning range | Meaning |
| --- | --- | --- |
| High-evidence first wave | Roughly 60–150 additional concepts, conditional on 10–25% obtaining valid T1/T2 assertions; operational range includes zero | Suitable modest initial target if licensed sources and bridge reviews are available; not a promised gain |
| Medium-confidence review surface | Roughly 150–360 additional candidate concepts, assuming 25–60% remain plausible but need pair review | Review workload, not automatically eligible coverage |
| Unlikely / insufficient / no atlas counterpart | Roughly 90–390 hinted concepts, the residual 15–65% | Mostly zero gain unless new identity evidence appears; do not label missing data as proven absence |

Choose scenario fractions jointly so they sum to one; independent range endpoints must not be added. These fractions are explicit conservative planning assumptions, not observations. If no trusted bridge is available and no human reviews occur, automatic gain is exactly zero. It would be misleading to call any positive numerical forecast high-confidence from the available metrics alone. Additional discovery outside the legacy hints or future work on the remaining MOH corpus needs a new denominator and forecast.

Exact calculation requires the complete baseline ID set, pinned endpoint ontologies/editions, licensed bridge inventory, row-to-SCTID integrity, all pair dispositions, independent review decisions, unique accepted target IDs, and separate public/local export flags. Compute `new = acceptedTargetIds minus baselineIds` and `total = union(baselineIds, acceptedTargetIds)`; provide overlap and rejection reasons, never infer gain from number of E labels.

## 10. Final challenge and simpler design

| Residual risk | Required countermeasure |
| --- | --- |
| Trusted map contains an erroneous exact predicate | Admission review, endpoint checks and negative fixtures; provenance quality is not infallibility |
| E bridge used to relabel an S attestation | Gate requires row SCTID exactly equals bridge SNOMED endpoint; no traversal promotion |
| SEP inferred from suffix or shared ancestor | RF2/primary evidence pinning; missing/contradictory data fails closed |
| P misread as subclass, or named part misread as generic P | Separate proper-part predicates and object-specific extent |
| Same CUI over-trusted | T3 never autoeligible; retain atom multiplicity and source versions |
| Licensed crosswalk leaked as IDs/hashes/review decisions | Public allowlist and artifact-specific export clearance; no deidentification-by-label-removal assumption |
| FMA identity valid but mesh boundary differs | Evidence is identity-level only; atlas assignment conflicts queued; geometry certification out of scope |
| Scope checks all marked PASS by unsupported inference | Every check requires typed evidence refs; evidence cycle detection; no unapproved anchor bootstrapping |
| Coverage target pressures unsafe acceptance | Gain zero is an acceptable result; no minimum promotion count in acceptance tests |

Bulk-safe work includes parsing release metadata, resolving active IDs, grouping repeated SCTIDs/scope signatures, discovering candidates, detecting contradictions and replaying already approved pairs. Human reviewers can inspect packets grouped by proven common scope, but each approved pair and version must be enumerated. Sampling can audit an admitted publisher; it cannot approve an unreviewed lexical batch. Do not propagate one reviewed kidney pair to all organs or one side to its opposite.

The simpler architecture is also the recommendation: an initially empty allowlist of pinned equivalence assertions, conservative pair vetoes, an immutable source ledger, and a total row reducer. Defer generalized ontology reasoning, embeddings, probabilistic scores, transitive bridge networks and a custom graph database. This makes later work suitable for normal Codex/GPT-5.6 execution. Human ontology/license decisions, not another larger model, resolve the remaining blockers.

**STOP:** architecture and research documents only. No implementation, production promotion, UI change, medical review, AI translation, preferred-term choice or commit.
