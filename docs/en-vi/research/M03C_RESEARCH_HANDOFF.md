# M03C Research Evidence Handoff

## Status

**RESEARCH COMPLETE FOR THE FROZEN 50-CONCEPT PILOT; NOT A TERMINOLOGY RELEASE.**

- Pilot commit: `5652a98afa81d3f6653804075a07d9800aa490f5`
- Starting repository checkpoint: `20f9ba08b3c7e3216bf3351901b98f8d18aa320b`
- Frozen pilot concepts accounted for: **50 / 50**
- `SOURCE_VERIFIED`: **0**
- `MEDICAL_REVIEWED`: **0**
- `releaseEligible`: **0**
- This package contains research candidates, conflicts, scope gaps, and evidence leads only.

## Research policy

Authority and access are separated. HMU/UMP/NXB/FIPAT/FMA/BodyParts3D/Netter bibliographic or institutional records define source identity; searchable public copies are only access paths for locating passages. A mirror host is never promoted to authority. Exact edition-matched page/plate/term-entry locators must be pinned before claim-level `SOURCE_VERIFIED`. Source agreement never substitutes for qualified human medical review.

## Source set

- **BP3D4** — BodyParts3D 4.0. Class: `atlas-source`. Access: `FULL_ACCESS`. Scope: atlas concept labels, mesh membership, atlas packaging.
- **FIPAT_TA2** — Terminologia Anatomica, 2nd edition (TA2). Class: `international-nomenclature`. Access: `PARTIAL_ACCESS`. Scope: official Latin anatomical nomenclature, official English equivalents, TA2 hierarchy/term relations.
- **FMA_UW** — Foundational Model of Anatomy (University of Washington). Class: `international-ontology`. Access: `PARTIAL_ACCESS`. Scope: FMA ontology identity and relations.
- **HMU2022** — Giải phẫu người: dùng cho sinh viên hệ bác sĩ. Class: `vietnamese-authoritative`. Access: `SEARCHABLE_ACCESS_COPY`. Scope: Vietnamese anatomical terminology, anatomical teaching context.
- **UMP2023_SYS** — Giải phẫu học hệ thống. Class: `vietnamese-authoritative`. Access: `METADATA_CONFIRMED`. Scope: Vietnamese anatomical terminology, systematic anatomy teaching.
- **UMP2023_T2_ACCESS** — Giải phẫu học (Chương trình Y đa khoa đổi mới), Tập 2. Class: `access-copy`. Access: `SEARCHABLE_ACCESS_COPY`. Scope: content inspection only.
- **NQQ_T1_ACCESS** — Bài giảng Giải phẫu học, Tập 1. Class: `vietnamese-authoritative-access-copy`. Access: `SEARCHABLE_ACCESS_COPY`. Scope: Vietnamese anatomical terminology, historical/current teaching lineage.
- **NVH2008** — Thuật ngữ giải phẫu Anh - Việt / English-Vietnamese Anatomical Terminology. Class: `vietnamese-authoritative-terminology`. Access: `SEARCHABLE_ACCESS_COPY`. Scope: English–Vietnamese anatomical terminology, preferred/alternative Vietnamese forms in the edition.
- **NETTER2015** — Atlas Giải phẫu người. Class: `vietnamese-authoritative-atlas`. Access: `METADATA_CONFIRMED`. Scope: Vietnamese labels in the Vietnamese Netter edition, regional visual anatomy.
- **NATIONAL_BODY_TERMS_2025** — Danh mục mã dùng chung thuật ngữ lâm sàng – cấu trúc cơ thể. Class: `secondary-current-standardization`. Access: `FULL_ACCESS`. Scope: current Vietnamese clinical/body-structure terminology corroboration.

## Disposition summary

- `CONSENSUS_CANDIDATE`: **11**
- `CONFLICT_REQUIRES_ADJUDICATION`: **3**
- `VARIANT_WITH_ALIAS_REVIEW`: **4**
- `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW`: **8**
- `IDENTITY_CONTEXT_REVIEW`: **2**
- `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED`: **22**

The eleven `CONSENSUS_CANDIDATE` rows are the fast lane for locator pinning. They are **not** production-approved terms.

## Critical conflicts found

1. **Hip bone (`FMA16586`, `FMA16587`)** — HMU 2022 and Nguyễn Văn Huy terminology use **xương chậu**, while modern UMP material uses **xương hông** for `hip bone / os coxae`. This must be adjudicated; laterality cannot be appended automatically.
2. **Navicular bone of foot (`FMA24499`)** — HMU/NVH use **xương thuyền**, while the Nguyễn Quang Quyền/UMP lineage uses **xương ghe** for `os naviculare` and reserves **xương thuyền** for `os scaphoideum`. This is a substantive nomenclature conflict, not spelling variation.

## Fast-lane source-consensus candidates

- `FMA9613` — parietal bone → **xương đỉnh**
- `FMA9756` — external intercostal muscle → **cơ gian sườn ngoài**
- `FMA13343` — sternothyroid → **cơ ức-giáp**
- `FMA51061` — calcaneal tendon → **gân gót** — aliases for review: gân Achilles, gân Achillis
- `FMA55139` — lateral thyrohyoid ligament → **dây chằng giáp-móng bên**
- `FMA55237` — median cricothyroid ligament → **dây chằng nhẫn-giáp giữa**
- `FMA3951` — subclavian artery → **động mạch dưới đòn**
- `FMA10662` — inferior thyroid artery → **động mạch giáp dưới**
- `FMA4725` — subclavian vein → **tĩnh mạch dưới đòn**
- `FMA7148` — stomach → **dạ dày** — aliases for review: vị
- `FMA7198` — pancreas → **tụy**

## Full 50-concept matrix

| # | Concept.id | Atlas name | Category | Disposition | Vietnamese candidate / review form | Main blocker |
|---:|---|---|---|---|---|---|
| 1 | `FMA16586` | right hip bone | Bone | `CONFLICT_REQUIRES_ADJUDICATION` | — | HMU/NVH and modern UMP use different Vietnamese base terms for hip bone. |
| 2 | `FMA16587` | left hip bone | Bone | `CONFLICT_REQUIRES_ADJUDICATION` | — | HMU/NVH and modern UMP use different Vietnamese base terms for hip bone. |
| 3 | `FMA24499` | navicular bone of foot | Bone | `CONFLICT_REQUIRES_ADJUDICATION` | — | HMU/NVH use xương thuyền for navicular bone of foot; UMP/NQQ use xương ghe and reserve xương thuyền for scaphoid. |
| 4 | `FMA9613` | parietal bone | Bone | `CONSENSUS_CANDIDATE` | xương đỉnh | Pin edition-matched locators before SOURCE_VERIFIED. |
| 5 | `FMA33302` | proximal carpal bone | Bone | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | hàng gần của các xương cổ tay | Atlas concept is a multi-mesh grouping, not a single named bone. |
| 6 | `FMA33303` | distal carpal bone | Bone | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | hàng xa của các xương cổ tay | Atlas concept is a multi-mesh grouping, not a single named bone. |
| 7 | `FMA22439` | muscle of medial compartment of thigh | Muscle | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Atlas concept is a multi-mesh 'muscle of compartment' aggregate; compartment terminology cannot be assumed equivalent to the concept. |
| 8 | `FMA22472` | muscle of anterior compartment of leg | Muscle | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Atlas concept is a multi-mesh 'muscle of compartment' aggregate; compartment terminology cannot be assumed equivalent to the concept. |
| 9 | `FMA19728` | superficial perineal muscle | Muscle | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Atlas has four meshes; sources describe a superficial perineal muscle layer/group, not necessarily one exact generic entity. |
| 10 | `FMA22427` | muscle of posterior compartment of thigh | Muscle | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Atlas concept is a multi-mesh 'muscle of compartment' aggregate; compartment terminology cannot be assumed equivalent to the concept. |
| 11 | `FMA9756` | external intercostal muscle | Muscle | `CONSENSUS_CANDIDATE` | cơ gian sườn ngoài | Confirm whether atlas two-mesh representation is pair/bilateral membership before release. |
| 12 | `FMA13343` | sternothyroid | Muscle | `CONSENSUS_CANDIDATE` | cơ ức-giáp | Confirm atlas multi-mesh scope/pair semantics. |
| 13 | `FMA51061` | calcaneal tendon | Tendon | `CONSENSUS_CANDIDATE` | gân gót | Atlas unsided two-mesh scope must be reconciled with pair/side-specific concepts before release. |
| 14 | `FMA264844` | left calcaneal tendon | Tendon | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | gân gót trái | Exact left-sided external identity/laterality has not been independently verified; do not create the canonical form by string composition alone. |
| 15 | `FMA54159` | tendon of right levator palpebrae superioris | Tendon | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Exact tendon-specific right-sided entity not located in Tier-A Vietnamese sources or pinned TA2/FMA evidence. |
| 16 | `FMA65410` | intermediate tendon | Tendon | `IDENTITY_CONTEXT_REVIEW` | gân trung gian cơ vai-móng | Pair/single-mesh scope remains unresolved. |
| 17 | `FMA44249` | right long plantar ligament | Ligament | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | dây chằng gan chân dài phải | Base term is well supported; exact side-specific external identity is not yet pinned. |
| 18 | `FMA44250` | left long plantar ligament | Ligament | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | dây chằng gan chân dài trái | Base term is well supported; exact side-specific external identity is not yet pinned. |
| 19 | `FMA55139` | lateral thyrohyoid ligament | Ligament | `CONSENSUS_CANDIDATE` | dây chằng giáp-móng bên | FIPAT pair scope and atlas two-mesh membership must be reconciled before release. |
| 20 | `FMA55237` | median cricothyroid ligament | Ligament | `CONSENSUS_CANDIDATE` | dây chằng nhẫn-giáp giữa | Pin exact TA2 entry and edition-matched Vietnamese locators. |
| 21 | `FMA3802` | trunk of right coronary artery | Artery | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Vietnamese sources robustly name the right coronary artery but do not establish 'trunk of right coronary artery' as the same entity. |
| 22 | `FMA3813` | anterior ventricular branch of right coronary artery | Artery | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Atlas concept spans eight meshes and may represent several anterior ventricular branches. |
| 23 | `FMA3951` | subclavian artery | Artery | `CONSENSUS_CANDIDATE` | động mạch dưới đòn | Pin exact UMP/HMU page locators before SOURCE_VERIFIED. |
| 24 | `FMA10662` | inferior thyroid artery | Artery | `CONSENSUS_CANDIDATE` | động mạch giáp dưới | Pin authoritative textbook locator before SOURCE_VERIFIED. |
| 25 | `FMA3994` | second posterior intercostal artery | Artery | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | động mạch gian sườn sau thứ hai | Term is directly attested, but the atlas concept's relation to the supreme intercostal arterial branching pattern should be independently checked. |
| 26 | `FMA4725` | subclavian vein | Vein | `CONSENSUS_CANDIDATE` | tĩnh mạch dưới đòn | Pin exact locators before SOURCE_VERIFIED. |
| 27 | `FMA4751` | right brachiocephalic vein | Vein | `VARIANT_WITH_ALIAS_REVIEW` | — | HMU/NVH lineage uses 'tĩnh mạch cánh tay đầu'; modern clinical/UMP usage also uses 'tĩnh mạch tay đầu'. |
| 28 | `FMA8668` | superior lingular vein | Vein | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | tĩnh mạch phân thùy lưỡi trên | Direct Tier-A Vietnamese locator for the exact lingular-vein part has not been pinned. |
| 29 | `FMA8669` | inferior lingular vein | Vein | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | tĩnh mạch phân thùy lưỡi dưới | Direct Tier-A Vietnamese locator for the exact lingular-vein part has not been pinned. |
| 30 | `FMA5913` | nerve trunk | Nerve | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Generic multi-mesh 'nerve trunk' is an atlas aggregate; no exact Vietnamese canonical entity is established. |
| 31 | `FMA52570` | branch of cranial nerve | Nerve | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | 26-mesh aggregate 'branch of cranial nerve' is broader than a single named branch. |
| 32 | `FMA50875` | right optic nerve | Nerve | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | thần kinh thị giác phải | Base term is authoritative; exact side-specific external identity/laterality must be pinned rather than inferred from string composition. |
| 33 | `FMA50878` | left optic nerve | Nerve | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | thần kinh thị giác trái | Base term is authoritative; exact side-specific external identity/laterality must be pinned rather than inferred from string composition. |
| 34 | `FMA52672` | communicating branch of nasociliary nerve with ciliary ganglion | Nerve | `IDENTITY_CONTEXT_REVIEW` | nhánh nối của thần kinh mũi-mi với hạch mi | Source literal term 'nhánh nối với hạch mi' may lose parent-nerve context when used as a standalone atlas label. |
| 35 | `FMA7196` | spleen | Organ | `VARIANT_WITH_ALIAS_REVIEW` | lách | NVH records both Tỳ and Lách; current teaching often uses Lách, but project preferred form should be adjudicated and checked against HMU/Netter exact organ labels. |
| 36 | `FMA7148` | stomach | Organ | `CONSENSUS_CANDIDATE` | dạ dày | The Sino-Vietnamese 'vị' alias needs scope/search review before production search. |
| 37 | `FMA7198` | pancreas | Organ | `CONSENSUS_CANDIDATE` | tụy | Pin exact locators before SOURCE_VERIFIED. |
| 38 | `FMA7203` | kidney | Organ | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | thận | Atlas unsided concept contains two meshes and may aggregate left/right kidneys; confirm scope before release. |
| 39 | `FMA9597` | salivary gland | Gland | `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` | tuyến nước bọt | Atlas concept is an aggregate across four meshes; verify whether it denotes the salivary-gland family versus a single structure. |
| 40 | `FMA15629` | right adrenal gland | Gland | `VARIANT_WITH_ALIAS_REVIEW` | — | Authoritative/current Vietnamese usage contains both 'tuyến thượng thận' and 'tuyến trên thận'. |
| 41 | `FMA15630` | left adrenal gland | Gland | `VARIANT_WITH_ALIAS_REVIEW` | — | Authoritative/current Vietnamese usage contains both 'tuyến thượng thận' and 'tuyến trên thận'. |
| 42 | `FMA25511` | intervertebral symphysis | Joint | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | khớp sụn-sợi gian đốt sống | Sources describe intervertebral body symphyses/symphysis-type joints in several ways; the composed suggested form is not a directly verified preferred term. |
| 43 | `FMA25571` | intervertebral symphysis of axis | Joint | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | No direct Tier-A Vietnamese per-level preferred term was located. |
| 44 | `FMA26086` | seventh cervical intervertebral symphysis | Joint | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | No direct Tier-A Vietnamese per-level preferred term was located. |
| 45 | `FMA26089` | first thoracic intervertebral symphysis | Joint | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | No direct Tier-A Vietnamese per-level preferred term was located. |
| 46 | `FMA79063` | deep fascial system | Fascia/connective tissue | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Broad 'deep fascial system' is an aggregate/system-level concept; no exact Vietnamese authoritative preferred entity was located. |
| 47 | `FMA58775` | zone of fascia lata | Fascia/connective tissue | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | vùng của mạc đùi | 'Zone of fascia lata' must not be collapsed to 'fascia lata' itself. |
| 48 | `FMA58418` | investing fascia of right lower limb | Fascia/connective tissue | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | No exact Tier-A Vietnamese preferred term for the side-specific 'investing fascia of lower limb' entity was located. |
| 49 | `FMA58419` | investing fascia of left lower limb | Fascia/connective tissue | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | No exact Tier-A Vietnamese preferred term for the side-specific 'investing fascia of lower limb' entity was located. |
| 50 | `FMA57965` | zone of investing fascia | Fascia/connective tissue | `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED` | — | Direct Vietnamese preferred term for 'zone of investing fascia' was not located. |

## Integration rules for Codex

1. Treat `M03C_RESEARCH_EVIDENCE_MATRIX.json` as a **non-release research import**, not as a trusted production registry dump.
2. Register/update real source identities first. Preserve the distinction between authoritative source identity and access-copy URL.
3. Import a Vietnamese preferred term into production terminology only when the row is `CONSENSUS_CANDIDATE`, and even then import it no higher than `DRAFT` / evidence-pending unless the existing M02B validator accepts exact edition-matched claim locators.
4. Do **not** import preferred terms from `CONFLICT_REQUIRES_ADJUDICATION`, `VARIANT_WITH_ALIAS_REVIEW`, `ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED`, or other review buckets. Keep them in non-production review queues.
5. `BASE_TERM_SCOPE_OR_LATERALITY_REVIEW` means the base Vietnamese anatomy term is strong but the exact atlas scope/laterality is not yet safe. Do not construct the final label automatically.
6. `IDENTITY_CONTEXT_REVIEW` means context substantially narrows the identity, but exact external mapping and/or wording still needs pinned evidence.
7. Never make an alias searchable merely because it appears in this research artifact. Alias claims need their own gate.
8. Create explicit blocking conflict records for hip bone and navicular bone of foot.
9. Do not create reviewer records, `MEDICAL_REVIEWED`, `VERIFIED`, or a released manifest.
10. Preserve 0 release-eligible entries after this integration milestone unless a genuine, already-registered qualified human medical review exists—which is not expected here.

## Exact next milestone

**M03C1 — Research Integration + Locator Pinning.** Integrate this research package, pin exact edition-matched page/plate/TA/FMA locators for the 11 fast-lane candidates first, encode conflicts/review queues for the remaining 39, run all M02B/M03A/M03B validators, and stop before medical review or scaling beyond the frozen 50.
