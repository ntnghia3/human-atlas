# M03C1 Research Integration + Locator Pinning Report

Status: PASS for the M03C1 research-integration checkpoint. This report does
not certify medical review, source verification, or production release.

## Checkpoint identity

- Starting repository commit: `20f9ba08b3c7e3216bf3351901b98f8d18aa320b`
- Frozen M03A selection commit: `5652a98afa81d3f6653804075a07d9800aa490f5`
- Scope: exactly the 50 concepts frozen by M03A; no concept 51+ was populated.
- Owner artifacts are preserved under `docs/en-vi/research/` without rewriting
  their research conclusions.

## Source registry changes

`data/terminology/sources.json` remains schema version 3 and now contains 13
source records. The M03C reconciliation added or strengthened these identities:

- `HMU2022`: *Giải phẫu người: dùng cho sinh viên hệ bác sĩ*, Nguyễn Văn Huy
  (chủ biên), Nhà xuất bản Y học, 2022, ISBN `9786046658351`.
- `UMP2023_SYS`: *Giải phẫu học hệ thống*, Lê Văn Cường (chủ biên) et al.,
  Nhà xuất bản Y học, sixth edition, 2023, ISBN `978-604-66-6292-1`.
- `UMP2023_T2`: *Giải phẫu học: Chương trình Y đa khoa đổi mới, Tập 2*, with
  the independently identified UMP/NXB record and a separate inspection-copy
  relation.
- `NVH2008`: *Thuật ngữ giải phẫu Anh - Việt*, Nguyễn Văn Huy and Chu Văn Tuệ
  Bình, Nhà xuất bản Y học, 2008, 312 pages.
- `NETTER2015`: Vietnamese Netter 2015, Frank H. Netter, translated by Nguyễn
  Quang Quyền and Phạm Đăng Diệu, Nhà xuất bản Y học, ISBN `9786046613206`,
  based on Elsevier sixth-edition printing.
- `vi-ump-bai-giang-anatomy-2019` and `nlv-catalog-bai-giang-anatomy-2019`
  retain the earlier UMP teaching-source identity and corroborative catalog
  record.
- `FIPAT_TA2`, `FMA_UW`, and `BP3D4` remain present as the international
  nomenclature, UW FMA, and BodyParts3D identity sources.
- `NATIONAL_BODY_TERMS_2025` remains a current secondary corroboration source.

Access copies are represented explicitly. The authority records carry an
`accessCopy` URL when an inspection copy was used; `UMP2023_T2_ACCESS` and
`NQQ_T1_ACCESS` are separate `secondary-reference` records with
`authorityTier: discovery-only` and `accessCopyOf` pointing to the identified
authority record. A mirror host therefore cannot satisfy a Vietnamese
authority claim. The validator and M03C tests reject a Vietnamese claim that
cites either access-copy record as its authority.

## Frozen 50-concept disposition

| Disposition bucket | Count |
| --- | ---: |
| `CONFLICT_REQUIRES_ADJUDICATION` | 3 |
| `CONSENSUS_CANDIDATE` | 11 |
| `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | 22 |
| `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | 8 |
| `IDENTITY_CONTEXT_REVIEW` | 2 |
| `VARIANT_WITH_ALIAS_REVIEW` | 4 |
| Total | 50 |

All entries remain `DRAFT`/`UNMAPPED`/`UNRESOLVED`. Candidate claims remain
`CANDIDATE`/`PENDING`; no reviewer identity, source-verification audit,
medical-review audit, release audit, FMA mapping, or TA2 mapping was created.
The research disposition field is non-production queue metadata and does not
enter the search surface.

## Fast-lane locator pinning

All 11 fast-lane candidates now carry a reproducible page-plus-term-entry
locator against the `NVH2008` authority record, using its documented access
copy for inspection. This is research-level locator pinning only: all 11
claims remain evidence-pending (`CANDIDATE`/`PENDING`) because the registered
source is not yet audited as source-verified and no qualified human review has
occurred.

| Concept | Candidate | Page | Term entry |
| --- | --- | ---: | --- |
| `FMA9613` | xương đỉnh | 30 | `A02.1.02.00` |
| `FMA9756` | cơ gian sườn ngoài | 129 | `A04.4.01.01` |
| `FMA13343` | cơ ức-giáp | 122 | `A04.2.04.00` |
| `FMA51061` | gân gót | 148 | `A04.7.02.04` |
| `FMA55139` | dây chằng giáp-móng bên | 199 | `A06.2.02.01` |
| `FMA55237` | dây chằng nhẫn-giáp giữa | 199 | `A06.2.03.00` |
| `FMA3951` | động mạch dưới đòn | 289 | `A12.2.08.00` |
| `FMA10662` | động mạch giáp dưới | 292 | `A12.2.08.04` |
| `FMA4725` | tĩnh mạch dưới đòn | 332 | `A12.3.08.00` |
| `FMA7148` | dạ dày | 176 | `A05.5.01.00` |
| `FMA7198` | tụy | 192 | `A05.9.01.00` |

Evidence-pending items for all 11: edition-matched authority review, claim-level
source verification, and qualified medical adjudication. The `FMA9756` source
entry visibly uses the plural group wording “Các cơ gian sườn ngoài”; the
singular atlas candidate remains deliberately pending. The `FMA55237` claim
does not create the bare `dây chằng nhẫn-giáp` alias.

## Explicit unresolved conflicts

- `FMA16586` right hip bone: `xương chậu` (HMU/NVH lineage) versus `xương
  hông` (modern UMP lineage), stored as an open competing-preferred conflict.
- `FMA16587` left hip bone: the same `xương chậu` versus `xương hông` conflict,
  independently attached to the left concept.
- `FMA24499` navicular bone of foot: `xương thuyền` (HMU/NVH) versus `xương
  ghe` (Nguyễn Quang Quyền/UMP lineage), stored as an open conflict. The
  distinction protecting `xương thuyền` for scaphoid is preserved as research
  evidence, not converted into an alias or winner.

The three rows expose no Vietnamese preferred field and cannot pass the
Vietnamese release gate.

## Safety and regression results

The following checks passed:

- `node scripts/validate-terminology.mjs` — PASS; 13 sources, 50 registry
  entries, 0 source-verified, 0 medically reviewed, 0 release-eligible, 0
  searchable, 3 open conflicts; expected candidate/conflict warnings only.
- `npm run test:m03c` — PASS; frozen 50, all six bucket counts, 11 locators,
  access-copy boundary, alias non-searchability, laterality/ontology
  safeguards, conflict blocking, and stale source-revision blocking.
- `npm run test:m03a` — PASS; the frozen M03A selection remains unchanged while
  M03C research records stay non-release.
- `npm run test:terminology` — PASS.
- `npm run test:localization` — PASS.
- `npm run check` — PASS.
- `node scripts/validate-atlas.mjs` — PASS.
- `node scripts/validate-interactions.mjs` — PASS.
- `npm run build` — PASS.
- `git diff --check` — PASS.

The application continues to use deterministic English fallback. Candidate
Vietnamese terms, Achilles/Achillis, `vị`, and other research aliases are not
searchable or displayable. Side-specific strings were not composed from base
terms, aggregate concepts were not collapsed, and no external identity was
inferred from an FMA-like `Concept.id` or mesh membership.

## Production release coverage

Production coverage is intentionally zero:

- source-verified entries: **0**;
- medically reviewed entries: **0**;
- release-eligible entries: **0**;
- searchable Vietnamese terminology entries: **0**;
- registered reviewers: **0**;
- release manifest: `UNRELEASED`.

## Remaining blockers

The next milestone must obtain legitimate edition-matched review access and
complete claim-level source verification for the 50 frozen records, starting
with the 11 pinned candidates. It must separately adjudicate the three explicit
conflicts, resolve atlas/ontology scope for multi-mesh and aggregate concepts,
verify laterality and contextual identity, and decide alias/search behavior.
The current source catalog still has metadata-only or partial-access gaps for
TA2/FMA and several Vietnamese textbooks; no locator from a mirror is sufficient
until the authority edition and evidence are independently verified.

## Exact next task

**M03C2 — Claim-level source verification and qualified medical adjudication of
the frozen 50 only.** Begin with the 11 NVH2008 locator-pinned candidates,
verify each against the exact registered edition, then adjudicate the hip and
foot-navicular conflicts and remaining scope/laterality blockers. Do not scale
beyond the frozen 50, create reviewer identities without evidence, or release
any term without current source and human medical gates.
