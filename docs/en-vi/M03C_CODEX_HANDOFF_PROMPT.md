# CODEX TASK — M03C1 Research Integration + Locator Pinning

Repository checkpoint before this task:
`20f9ba08b3c7e3216bf3351901b98f8d18aa320b`

Frozen pilot selection commit:
`5652a98afa81d3f6653804075a07d9800aa490f5`

INPUT ARTIFACTS PROVIDED BY OWNER
- `M03C_RESEARCH_EVIDENCE_MATRIX.json`
- `M03C_RESEARCH_HANDOFF.md`

Read the existing M02B/M03A/M03B governance, schemas, validators, source registry, and reports before editing.

## OBJECTIVE

Integrate the completed 50-concept M03C research into the repository **without pretending that research consensus is medical review or release approval**.

This milestone is:

**M03C1 — Research Integration + Locator Pinning**

It is NOT medical review.
It is NOT a production terminology release.
It is NOT permission to scale beyond the frozen 50.

## NON-NEGOTIABLE SAFETY RULES

1. Atlas `Concept.id` remains an opaque atlas key unless a separate external mapping claim is evidenced.
2. Mesh membership is not anatomical/ontology equivalence.
3. A public mirror/access-copy URL is NOT the authority. Store it only as an access path tied to the real bibliographic source.
4. Do not majority-vote source conflicts.
5. Do not mechanically create Vietnamese canonical names by concatenating base term + left/right/directional qualifiers.
6. Do not create or fake reviewer identities.
7. Do not mark any entry `MEDICAL_REVIEWED`, `VERIFIED`, or release-eligible.
8. Do not make candidate aliases/search forms active merely because they appear in the research JSON.
9. Preserve deterministic English fallback.
10. Production release coverage must remain zero after this task.

## REQUIRED INTEGRATION

### A. Preserve research artifacts

Add the two owner-provided artifacts under a clear non-production location, for example:

`docs/en-vi/research/M03C_RESEARCH_EVIDENCE_MATRIX.json`
`docs/en-vi/research/M03C_RESEARCH_HANDOFF.md`

Do not silently rewrite their research conclusions.

### B. Source registry

Reconcile the M03B source registry with the research source records.

Add/strengthen real bibliographic identities where not already present:

- HMU 2022 — `Giải phẫu người: dùng cho sinh viên hệ bác sĩ`, Nguyễn Văn Huy ch.b., NXB Y học, ISBN 9786046658351.
- UMP — `Giải phẫu học hệ thống`, Lê Văn Cường ch.b. et al., NXB Y học, 6th ed. 2023, ISBN 978-604-66-6292-1.
- UMP 2023 `Giải phẫu học (Chương trình Y đa khoa đổi mới)` where its exact bibliographic identity is independently verified.
- Nguyễn Văn Huy / Chu Văn Tuệ Bình — `Thuật ngữ giải phẫu Anh - Việt`, NXB Y học, 2008, 312 pages.
- Netter Vietnamese 2015 — Frank H. Netter; Nguyễn Quang Quyền, Phạm Đăng Diệu dịch; NXB Y học; ISBN 9786046613206; printing based on Elsevier 6th ed.
- Preserve FIPAT/IFAA TA2, official UW FMA, and BodyParts3D 4.0 from M03B.

If the existing schema supports an `accessCopy`/mirror relation, use it.
Otherwise make the smallest safe schema extension required.

A mirror such as Scribd or another public copy may provide content access, but MUST NOT itself satisfy `vietnamese-authoritative`.

### C. 50-concept disposition import

Account for exactly the same 50 concepts frozen by M03A.

Expected research buckets:
{
  "CONFLICT_REQUIRES_ADJUDICATION": 3,
  "CONSENSUS_CANDIDATE": 11,
  "ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED": 22,
  "BASE_TERM_SCOPE_OR_LATERALITY_REVIEW": 8,
  "IDENTITY_CONTEXT_REVIEW": 2,
  "VARIANT_WITH_ALIAS_REVIEW": 4
}

Import rules:

- `CONSENSUS_CANDIDATE`:
  may enter the production terminology registry only as a non-release candidate (`DRAFT` or equivalent).
  It MUST remain not source-verified until claim-level locators match the exact registered source edition.
- `CONFLICT_REQUIRES_ADJUDICATION`:
  create blocking conflict/review records; no production preferred Vietnamese term.
- `VARIANT_WITH_ALIAS_REVIEW`:
  keep preferred term unresolved; preserve variants as candidate evidence only.
- `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW`:
  preserve base-term evidence, but do not synthesize a side/scope-specific canonical term.
- `IDENTITY_CONTEXT_REVIEW`:
  preserve context evidence, but do not assert exact external mapping without its independent locator.
- `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED`:
  keep Vietnamese preferred term absent and record the blocker/research queue.

### D. Mandatory explicit conflicts

Encode as blocking, unresolved conflicts:

1. `FMA16586` right hip bone
2. `FMA16587` left hip bone

Conflict:
- HMU/NVH lineage: `xương chậu`
- modern UMP: `xương hông`

Do not select a winner in this milestone.

3. `FMA24499` navicular bone of foot

Conflict:
- HMU/NVH: `xương thuyền`
- Nguyễn Quang Quyền/UMP lineage: `xương ghe`
- UMP distinction explicitly protects `xương thuyền` for scaphoid in that nomenclature tradition.

Do not convert one form into an alias of the other until adjudicated.

### E. Fast lane for exact locator pinning

Prioritize these 11 concepts:

- FMA9613 → xương đỉnh
- FMA9756 → cơ gian sườn ngoài
- FMA13343 → cơ ức-giáp
- FMA51061 → gân gót
- FMA55139 → dây chằng giáp-móng bên
- FMA55237 → dây chằng nhẫn-giáp giữa
- FMA3951 → động mạch dưới đòn
- FMA10662 → động mạch giáp dưới
- FMA4725 → tĩnh mạch dưới đòn
- FMA7148 → dạ dày
- FMA7198 → tụy

For each:
- pin exact source edition;
- pin exact page / plate / term entry / stable nomenclature identifier;
- attach evidence to the exact Vietnamese preferred-term claim;
- if exact edition-matched locator cannot be reproduced, leave the claim `DRAFT` / evidence-pending.

Do not weaken validator requirements to make a candidate pass.

### F. Special non-fast-lane safeguards

- `FMA51061`: keep Achilles/Achillis only as alias candidates until alias claims are separately approved.
- `FMA55237`: do not automatically treat bare `dây chằng nhẫn-giáp` as equivalent to `dây chằng nhẫn-giáp giữa`.
- `FMA65410`: research suggests omohyoid context, but pair/scope and exact external locator must be pinned before exact mapping.
- `FMA3802`: do not invent `thân động mạch vành phải`.
- `FMA3813`: do not collapse an eight-mesh branch aggregate into a single branch without ontology evidence.
- `FMA8668` / `FMA8669`: do not choose between `tĩnh mạch lưỡi ...` and `tĩnh mạch phân thùy lưỡi ...` without Tier-A Vietnamese evidence.
- `FMA5913` / `FMA52570`: keep generic nerve aggregates unresolved.
- `FMA25511` / `FMA25571` / `FMA26086` / `FMA26089`: do not auto-compose Vietnamese per-level intervertebral symphysis names.
- fascia records: never collapse `zone of fascia lata` to `fascia lata`; keep zone/system/investing fascia distinctions explicit.

## VALIDATION / TESTS

Add tests proving at minimum:

- research candidate != SOURCE_VERIFIED;
- source consensus != MEDICAL_REVIEWED;
- mirror/access-copy != authoritative source;
- conflict rows cannot expose a production preferred Vietnamese term;
- candidate aliases are not searchable automatically;
- side-specific labels cannot be created merely by appending `trái/phải`;
- hip-bone conflict blocks release;
- navicular conflict blocks release;
- a fast-lane candidate lacking an exact edition-matched locator remains blocked;
- a source revision/edition mismatch stales/blocks evidence;
- all 50 frozen concepts remain accounted for exactly once;
- no concept outside the frozen 50 is populated.

Run the full existing suite, including all M02B/M03A/M03B validators, production terminology validator, build, and `git diff --check`.

## REPORT

Create:

`docs/en-vi/M03C_RESEARCH_INTEGRATION_REPORT.md`

Report:
- starting commit;
- source records added/changed;
- how access copies are separated from authority;
- exact 50-concept bucket counts;
- which of the 11 fast-lane candidates obtained reproducible exact locators;
- which remain evidence-pending;
- explicit conflict records;
- all validation/test results;
- production release coverage;
- remaining source/ontology gaps;
- exact next task.

## PASS CONDITION

PASS only if:
- all 50 are accounted for;
- the research package is integrated without upgrading its evidentiary status;
- conflicts remain blocking;
- no fake review is created;
- no release-eligible Vietnamese term is created;
- exact locators are required rather than guessed;
- all regression checks pass.

## STOP

STOP after M03C1.

Do not perform medical review.
Do not mark VERIFIED.
Do not scale to concept 51+.
Do not start bulk translation.

Return:
PASS / PARTIAL / FAIL
final commit SHA
files changed
source changes
50-concept disposition counts
exact-locator results for the 11 fast-lane candidates
test results
production release coverage
remaining blockers
exact next task
