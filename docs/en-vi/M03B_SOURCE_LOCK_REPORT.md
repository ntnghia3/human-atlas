# M03B Source Lock Report

## Decision scope

- Starting commit: `5652a98afa81d3f6653804075a07d9800aa490f5` (M03A pilot selection PASS).
- Frozen pilot: `docs/en-vi/pilot/M03A_PILOT_CONCEPTS.json`; unchanged.
- Registry change: six source records added to `data/terminology/sources.json` (schema version 3).
- Production terminology entries: zero added; no Vietnamese preferred terms, aliases, FMA mappings, TA2 mappings, or terminology review audits were created.
- Release manifest: remains `UNRELEASED`.

`VERIFIED` in the source records means that the source identity and bibliographic
metadata were checked for this source-lock milestone. It is not a terminology
claim, medical review, or release decision.

## Locked source records

| Source ID | Bibliographic identity and pinned revision | Authority scope | Tier | Access | Locator | Full text / inspected | Claim use at M03B |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `fipat-ta2-2019` | FIPAT/IFAA, *Terminologia Anatomica, Second Edition*, online 2019 revision | Latin anatomical nomenclature, official English equivalents, TA hierarchy and terminology | authoritative | `METADATA_ONLY` | `INSUFFICIENT` | no / no | Identity record only; not Vietnamese authority |
| `fma-uw-official-2019` | University of Washington Structural Informatics Group, official FMA reference/distribution boundary recorded as 2019 | FMA identifier existence and FMA ontology identity/relationships | authoritative | `PARTIAL_ACCESS` | `INSUFFICIENT` | no / no | Identity record only; no Atlas↔FMA claim |
| `bodyparts3d-4.0` | BodyParts3D 4.0 / Anatomography repository snapshot at `c134f30` | Atlas identity, packaged mesh membership, source labels and model metadata | authoritative (`atlas-dataset`) | `FULL_ACCESS` | `STABLE_ENTRY` | yes / yes | Atlas evidence only; no automatic FMA/TA2 equivalence |
| `vi-hmu-system-anatomy-2023` | Trường Đại học Y Hà Nội, Bộ môn Giải phẫu; Nhà xuất bản Y học catalog identity, 2023 | Candidate Vietnamese anatomy textbook terminology and HMU instructional-source identity | authoritative | `METADATA_ONLY` | `INSUFFICIENT` | no / no | Candidate source identity only; no term claim |
| `vi-ump-bai-giang-anatomy-2019` | Đại học Y Dược TP.HCM, Bộ môn Giải phẫu học; Nhà xuất bản Y học catalog identity, 2019 two-volume record | Candidate Vietnamese anatomy textbook terminology and UMP instructional-source identity | authoritative | `METADATA_ONLY` | `INSUFFICIENT` | no / no | Candidate source identity only; no term claim |
| `nlv-catalog-bai-giang-anatomy-2019` | Vietnam National Library catalog record for the UMP two-volume work, 2019 | Bibliographic corroboration only | corroborative | `FULL_ACCESS` | `PAGE` | yes / yes | Corroboration of metadata; never a preferred-term source by itself |

The registry records edition, year, named or institutional authors, publisher,
language, URL, revision, access date, license/copyright note, verification
evidence, and limitations. Missing ISBN values remain explicit `null`; no
metadata was fabricated. The BodyParts3D record also retains the publication
DOI `10.1093/nar/gkn613`.

## Bibliographic evidence and authority boundaries

- [FIPAT/IFAA terminologies](https://ifaa.net/committees/anatomical-terminology-fipat/fipat-ifaa-terminologies/) identifies the second edition as the online TA2 work; the [FIPAT report](https://ifaa.net/2022/08/12/report-of-the-federative-international-programme-on-anatomical-terminologies-fipat/) links the [TA2 reference](https://fipat.library.dal.ca/TA2/) and records IFAA General Assembly approval in 2020. The cataloged authority is limited to Latin, official English equivalents, and TA nomenclature structure. Licensing for reuse of the online nomenclature was not established from the inspected metadata pages, so no content was copied.
- [University of Washington FMA project](https://si.washington.edu/projects/fma/) and its [FMA information page](https://sig.biostr.washington.edu/projects/fm/AboutFM.html) identify the official FMA reference. [BioPortal FMA metadata](https://bioportal.bioontology.org/ontologies/FMA/) is corroborative metadata only. The deprecated [OBO FMA translation](https://obofoundry.org/ontology/fma.html) is not registered as FMA authority; an obsolete translation cannot verify an FMA identity. No Atlas↔FMA assertion was made.
- [BodyParts3D download metadata](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) and the [BodyParts3D license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) anchor the repository lineage. The local [attribution record](../../public/ATTRIBUTION.md) pins the 4.0 geometry lineage and CC BY 4.0 attribution. Local atlas metadata was inspected for the repository snapshot; mesh membership and source labels remain atlas evidence and do not imply FMA or TA2 equivalence.
- The HMU candidate is anchored by the [Nhà xuất bản Y học catalog PDF](https://images.xuatbanyhoc.vn/Files/2025-06-30/document-20250630170725501.pdf) and an independent [curriculum catalog record](https://nctu.edu.vn/uploads/page/2025_04/De_an_mo_nganh_Y_hoc_du_phong_-_DNC.pdf). The UMP candidate is anchored by the [National Library catalog](https://nlv.gov.vn/dmdocuments/TMQG_2019_Q2.pdf) and [UMP Department of Anatomy identity page](https://med.ump.edu.vn/bo-mon/bo-mon-giai-phau-hoc/gioi-thieu). These pages establish source identity only; the textbook pages were not inspected.

International nomenclature cannot establish Vietnamese wording. Vietnamese
authority is claim- and context-specific; a university or publisher identity
does not make every possible claim from the work usable without an exact
inspected passage.

## Rejected and discovery-only material

No discovery-only or rejected record is included in the production source
catalog. The deprecated third-party OBO FMA translation is rejected as an FMA
identity authority because the official ontology lineage points to the UW FMA
reference. Retail listings, blogs, scraped or unauthorized PDFs, student
uploads, machine translation, Wikipedia, general-health pages, and AI output
are discovery aids at most and cannot satisfy a supported or verified claim.
They were not used as evidence and no copyrighted textbook content was copied.

## Validation gates added in M03B

The source schema is version 3. Validation now fails closed when a source is
missing identity or authority metadata, has an invalid access or locator state,
or contradicts its inspection/audit flags. A `SUPPORTED` or `VERIFIED` claim
requires all of the following: an identity-verified non-discovery source, a
current source revision, legitimate review access, inspected content, a
non-insufficient locator, and a locator matching the source capability.
Vietnamese claims additionally require an authoritative Vietnamese source;
international nomenclature cannot satisfy that class. Machine-generated,
discovery-only, rejected, metadata-only, unavailable, and uninspected sources
cannot satisfy claim or release evidence. Revision mismatches invalidate
dependent claims and approvals.

Synthetic tests cover metadata-only Vietnamese evidence, insufficient locators,
discovery-only release evidence, and an international source incorrectly cited
for a Vietnamese claim. No production terminology fixture was added.

## M03C access audit

M03C cannot begin claim-level evidence review for the frozen 50. The TA2 and
official FMA records need legitimate distribution/content access with
reproducible term or identifier locators. Both Vietnamese candidates need a
legitimately obtained print copy, library access, licensed digital copy, or a
user-provided copy that permits inspection of exact pages or stable entries.
Paywalls, DRM, and copyright restrictions must not be bypassed; an
unauthorized mirror cannot upgrade a source's authority or access state.

M03C status: **BLOCKED PENDING FULL-TEXT SOURCE ACCESS**.

## Regression results

All required commands passed after the source-lock changes:

```text
npm run check
node scripts/validate-atlas.mjs
node scripts/validate-interactions.mjs
npm run test:localization
npm run test:terminology
npm run test:m03a
node scripts/validate-terminology.mjs
node scripts/validate-terminology.mjs --json
npm run build
git diff --check
```

| Check | Result |
| --- | --- |
| `npm run check` | PASS |
| `node scripts/validate-atlas.mjs` | PASS; 2,234 meshes, 3,432 concepts |
| `node scripts/validate-interactions.mjs` | PASS |
| `npm run test:localization` | PASS |
| `npm run test:terminology` | PASS; synthetic source-evidence misuse cases pass |
| `npm run test:m03a` | PASS; 50 frozen concepts, zero entries, zero reviewers, no mappings |
| `node scripts/validate-terminology.mjs` | PASS; 6 sources, 0 entries, 0 source-verified, 0 medically reviewed, 0 release eligible |
| `node scripts/validate-terminology.mjs --json` | PASS; 3,432 unresolved/unmapped concepts, all terminology coverage counts 0 |
| `npm run build` | PASS; Vite production build completed (size advisory only) |
| `git diff --check` | PASS; no whitespace errors |

The source registry contains six records and the production registry contains
zero terminology entries and zero Vietnamese terms.

## Exact next task

Obtain legitimate full-text or stable-entry access for TA2, official FMA, HMU,
and UMP sources; inspect only the frozen M03A concepts; then begin M03C
claim-level identity and nomenclature evidence with exact locators. Do not
populate Vietnamese terms or aliases until an inspected authoritative Vietnamese
passage exists for each claim.
