# M04B2D Coverage Expansion Targeting Report

## Status and boundary

M04B2D-0.1 is a conservative refinement of the M04B2D-0 planning/data-analysis milestone. This report does not harvest sources, translate terminology, generate Vietnamese terms, perform medical review, adjudicate conflicts, modify production terminology, make terms searchable, or begin UI work.

Baseline: branch main, commit 5e0b1f9855b94c1f41d28b50383e67dcfb420a65.

The plan accounts for exactly **3432 atlas concepts once**. No Vietnamese term is asserted by this targeting artifact.

The original `targetClass` and its M04B2D-0 counts are retained for provenance. The `postQaTargetClass` and `cleanTargetQa` fields add the conservative audit result for the original 317 CLEAN_SIMPLE_TARGET records. Existing non-CLEAN classes are preserved unchanged.

## Deterministic inputs

- public/models/atlas.json
- data/terminology/research/bulk-match-results.json
- data/terminology/research/bulk-source-index.json
- data/terminology/sources.json
- docs/en-vi/research/M03C_RESEARCH_EVIDENCE_MATRIX.json
- docs/en-vi/M04B2C_AUTHORITY_FIRST_EVIDENCE_REPORT.md

The SHA-256 input manifest and the full per-concept plan are in data/terminology/research/m04b2d-targets.json. The plan is research-only and has no generated term fields.

## Original targeting-class accounting

| Targeting class | Count | Meaning |
| --- | ---: | --- |
| CLEAN_SIMPLE_TARGET | 317 | Unresolved but clean unsided source-harvesting candidate |
| LATERALITY_TARGET | 1207 | Base entity may be researchable; side-specific form is not synthesized |
| AGGREGATE_OR_COMPOSITE_TARGET | 1273 | Group, composite, aggregate, or scope-mismatch case |
| ONTOLOGY_SCOPE_TARGET | 573 | Atlas/FMA/TA2 correspondence or generic scope needs review |
| IDENTITY_TARGET | 14 | External identity is insufficiently established |
| EXISTING_EVIDENCE | 16 | Eligible authority evidence exists; remains research-only |
| EXISTING_CONFLICT_OR_VARIANT | 32 | Conflict or variant review state already exists |

Original CLEAN_SIMPLE_TARGET count: **317**. The class precedence preserves existing conflict/variant states before any source-harvesting classification.

## Conservative clean-target QA

For this refinement, CLEAN_SIMPLE_TARGET is not treated as directly harvestable merely because the earlier blocker checks were absent. A record is confirmed for direct harvesting only when its English label and existing atlas signals support a discrete entity with sufficiently pinned scope. Specialized anatomy is not downgraded by specialization alone; the dispositions below record only a generic, repeated, relational, aggregate, ontology-scope, or identity reason.

| Conservative QA disposition | Count | Meaning |
| --- | ---: | --- |
| CONFIRMED_DIRECT_HARVEST_TARGET | 22 | Confirmed discrete and sufficiently scoped for direct authority-source harvesting |
| CLEAN_BUT_SCOPE_QA_REQUIRED | 170 | Potentially discrete, but repeated, relational, or subpart scope requires per-concept QA first |
| RECLASSIFY_AGGREGATE_OR_COMPOSITE | 80 | Reclassified as a generic family, group, class, tissue field, or aggregate entity |
| RECLASSIFY_ONTOLOGY_SCOPE | 36 | Reclassified because exact atlas/FMA/TA2 level or region/part scope is unresolved |
| RECLASSIFY_IDENTITY | 9 | Reclassified because the English identity is too broad or insufficiently pinned |

- Original CLEAN_SIMPLE_TARGET records: **317**.
- Confirmed direct-harvest records after QA: **22**.
- CLEAN_BUT_SCOPE_QA_REQUIRED records: **170**.
- Reclassified as aggregate/composite: **80**.
- Reclassified as ontology/scope: **36**.
- Reclassified as identity: **9**.

The post-QA class accounting remains exact: CONFIRMED_DIRECT_HARVEST_TARGET=22, CLEAN_BUT_SCOPE_QA_REQUIRED=170, LATERALITY_TARGET=1207, AGGREGATE_OR_COMPOSITE_TARGET=1353, ONTOLOGY_SCOPE_TARGET=609, IDENTITY_TARGET=23, EXISTING_EVIDENCE=16, EXISTING_CONFLICT_OR_VARIANT=32.

## Family-by-family QA accounting

| Family | Original clean | Confirmed direct | Scope QA | Aggregate reclass | Ontology reclass | Identity reclass |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| arteries | 45 | 1 | 44 | 0 | 0 | 0 |
| bones | 38 | 0 | 31 | 1 | 3 | 3 |
| cartilage | 1 | 0 | 0 | 1 | 0 | 0 |
| ducts_conduits | 2 | 1 | 1 | 0 | 0 | 0 |
| fascia_connective_tissue | 6 | 0 | 3 | 0 | 3 | 0 |
| glands | 2 | 2 | 0 | 0 | 0 | 0 |
| integument | 8 | 0 | 0 | 6 | 2 | 0 |
| joints_symphyses_discs | 44 | 0 | 44 | 0 | 0 | 0 |
| muscles | 35 | 2 | 0 | 33 | 0 | 0 |
| nerves_neuroanatomy | 31 | 1 | 0 | 11 | 18 | 1 |
| organs | 8 | 2 | 0 | 0 | 6 | 0 |
| other | 44 | 7 | 22 | 6 | 4 | 5 |
| teeth | 7 | 0 | 7 | 0 | 0 | 0 |
| tendons_ligaments | 13 | 5 | 0 | 8 | 0 | 0 |
| veins | 33 | 1 | 18 | 14 | 0 | 0 |

The original M04B2D family batches remain available in `familyBatches`; `qaDirectFamilyBatches` contains only confirmed direct records, and `qaScopeFamilyBatches` contains only records requiring scope QA. Counts are deterministic and do not imply a sourced Vietnamese equivalent.

## Current Vietnamese-evidence coverage

The current matcher reports eligible Vietnamese authority evidence for **47 concepts** across **62 evidence records**. This is evidence coverage only; it is not a production terminology claim.

M04B2D-0.1 leaves this coverage unchanged at 47 concepts and 62 evidence records; the QA pass adds no evidence and generates no terminology.

The EXISTING_EVIDENCE class contains 16 concepts. Other concepts with evidence remain in their blocking conflict, variant, laterality, identity, or scope class. No evidence was copied into a Vietnamese term field in the target plan.

Current matcher source surface: 565 concepts with source matches, 557 with Latin matches, and 2867 with no source match.

## Remaining research surface

- Non-existing-evidence concepts: **3416**.
- Original clean simple targets: **317**.
- Confirmed direct clean harvesting candidates after QA: **22**.
- Clean candidates requiring scope QA: **170**.
- Clean candidates reclassified out of direct harvesting: **125**.
- Other non-clean research/review cases: **3394**.
- The current matcher buckets still contain SOURCE_GAP=2473, IDENTITY_GAP=2, AGGREGATE_OR_COMPOSITE_REVIEW=891, ONTOLOGY_SCOPE_REVIEW=10, and LATERALITY_REVIEW=8.

These figures identify work surfaces; they do not claim that an unsourced Vietnamese equivalent exists.

## Exact recommended FIRST harvesting batch

Recommended first batch: **M04B2D-0.1-FIRST-01-LARYNGEAL-LIGAMENTS** (tendons_ligaments, 5 concepts). The batch is intentionally small and same-family:

- `FMA55135` — thyrohyoid ligament (tendons_ligaments)
- `FMA55138` — median thyrohyoid ligament (tendons_ligaments)
- `FMA55227` — hyo-epiglottic ligament (tendons_ligaments)
- `FMA55230` — thyro-epiglottic ligament (tendons_ligaments)
- `FMA55233` — cricothyroid ligament (tendons_ligaments)

A small same-family set of explicit named, unsided laryngeal ligaments with no generic family, laterality, aggregate, or unresolved identity cue. The set is suitable for direct authority-source harvesting after the normal source-specific verification step.

This batch is preferable because all five records are explicit named laryngeal ligaments, unsided, and not generic `ligament of X`, limb-wide, tarsal, tributary, segmental, numbered, or neuroanatomical class labels. It provides a narrow source-family test while preserving per-record source verification. No source has been harvested by this milestone.

### Direct targets excluded from the FIRST batch

- Confirmed direct targets not selected for the first batch (17):

  `FMA13365`, `FMA13889`, `FMA16549`, `FMA18247`, `FMA19617`, `FMA19618`, `FMA20218`, `FMA22838`, `FMA22934`, `FMA32546`, `FMA46582`, `FMA46733`, `FMA55022`, `FMA62033`, `FMA7041`, `FMA78497`, `FMA9607`

- CLEAN_BUT_SCOPE_QA_REQUIRED (excluded from first batch) (170):

  `FMA10014`, `FMA10037`, `FMA10059`, `FMA10081`, `FMA10458`, `FMA11338`, `FMA12521`, `FMA12522`, `FMA12523`, `FMA12524`, `FMA12525`, `FMA13072`, `FMA13073`, `FMA13074`, `FMA13075`, `FMA13076`, `FMA13495`, `FMA13500`, `FMA13501`, `FMA13502`, `FMA13503`, `FMA13504`, `FMA13505`, `FMA13506`, `FMA13507`, `FMA13508`, `FMA13894`, `FMA13895`, `FMA13896`, `FMA13897`, `FMA13898`, `FMA13899`, `FMA13900`, `FMA14340`, `FMA14643`, `FMA14645`, `FMA14647`, `FMA14678`, `FMA14735`, `FMA14750`, `FMA14793`, `FMA14809`, `FMA14824`, `FMA14830`, `FMA14831`, `FMA15041`, `FMA15042`, `FMA15043`, `FMA15044`, `FMA15370`, `FMA15391`, `FMA15395`, `FMA15398`, `FMA15405`, `FMA15800`, `FMA15801`, `FMA16033`, `FMA16034`, `FMA16035`, `FMA16036`, `FMA16037`, `FMA21354`, `FMA22535`, `FMA22537`, `FMA22923`, `FMA22954`, `FMA23119`, `FMA25058`, `FMA26078`, `FMA26083`, `FMA26084`, `FMA26085`, `FMA26094`, `FMA26095`, `FMA26096`, `FMA26097`, `FMA26098`, `FMA26099`, `FMA26100`, `FMA26101`, `FMA26102`, `FMA26103`, `FMA26105`, `FMA26106`, `FMA26107`, `FMA26108`, `FMA26109`, `FMA32884`, `FMA32899`, `FMA32900`, `FMA32901`, `FMA32902`, `FMA35477`, `FMA35480`, `FMA35483`, `FMA35486`, `FMA35489`, `FMA4149`, `FMA43956`, `FMA44504`, `FMA44660`, `FMA45881`, `FMA45950`, `FMA45963`, `FMA46012`, `FMA50438`, `FMA50577`, `FMA54839`, `FMA55712`, `FMA55713`, `FMA55716`, `FMA55717`, `FMA55720`, `FMA55721`, `FMA68068`, `FMA68109`, `FMA68192`, `FMA68193`, `FMA68194`, `FMA68843`, `FMA69517`, `FMA69713`, `FMA70437`, `FMA70441`, `FMA70442`, `FMA70443`, `FMA70444`, `FMA70445`, `FMA70446`, `FMA70448`, `FMA70449`, `FMA70450`, `FMA70451`, `FMA70452`, `FMA70453`, `FMA70471`, `FMA70494`, `FMA70499`, `FMA70502`, `FMA70503`, `FMA71904`, `FMA7237`, `FMA7238`, `FMA7239`, `FMA7240`, `FMA7241`, `FMA7242`, `FMA7243`, `FMA7248`, `FMA7250`, `FMA7251`, `FMA7253`, `FMA76767`, `FMA77140`, `FMA77439`, `FMA78121`, `FMA83738`, `FMA84203`, `FMA8639`, `FMA8640`, `FMA8664`, `FMA8665`, `FMA9187`, `FMA9209`, `FMA9248`, `FMA9498`, `FMA9922`, `FMA9945`, `FMA9968`, `FMA9991`
- RECLASSIFY_AGGREGATE_OR_COMPOSITE (excluded from first batch) (80):

  `FMA13354`, `FMA13400`, `FMA14293`, `FMA14294`, `FMA14317`, `FMA15387`, `FMA15392`, `FMA15793`, `FMA19083`, `FMA19086`, `FMA21240`, `FMA21378`, `FMA21383`, `FMA22319`, `FMA22823`, `FMA22841`, `FMA22848`, `FMA22849`, `FMA22850`, `FMA22851`, `FMA22953`, `FMA23081`, `FMA23083`, `FMA241998`, `FMA25625`, `FMA256693`, `FMA265178`, `FMA265180`, `FMA32560`, `FMA37349`, `FMA37370`, `FMA37458`, `FMA44197`, `FMA44245`, `FMA44499`, `FMA45659`, `FMA46620`, `FMA46689`, `FMA46699`, `FMA46726`, `FMA49177`, `FMA53667`, `FMA54241`, `FMA54319`, `FMA54921`, `FMA55131`, `FMA58071`, `FMA5889`, `FMA5895`, `FMA59502`, `FMA61823`, `FMA62504`, `FMA62514`, `FMA64822`, `FMA64829`, `FMA64875`, `FMA64916`, `FMA64917`, `FMA65045`, `FMA67598`, `FMA71012`, `FMA7163`, `FMA72058`, `FMA7232`, `FMA74657`, `FMA7595`, `FMA77177`, `FMA77178`, `FMA77179`, `FMA77180`, `FMA78207`, `FMA81150`, `FMA83912`, `FMA83915`, `FMA83930`, `FMA84081`, `FMA8658`, `FMA9620`, `FMA9623`, `FMA9758`
- RECLASSIFY_ONTOLOGY_SCOPE (excluded from first batch) (36):

  `FMA14703`, `FMA20570`, `FMA256194`, `FMA52781`, `FMA54237`, `FMA59086`, `FMA59516`, `FMA59517`, `FMA59637`, `FMA59665`, `FMA59763`, `FMA59764`, `FMA59816`, `FMA61842`, `FMA61970`, `FMA62003`, `FMA62394`, `FMA62445`, `FMA62466`, `FMA67687`, `FMA67950`, `FMA67951`, `FMA78454`, `FMA83854`, `FMA83856`, `FMA83857`, `FMA83860`, `FMA83865`, `FMA83902`, `FMA83904`, `FMA83906`, `FMA9579`, `FMA9584`, `FMA9838`, `FMA9840`, `FMA9908`
- RECLASSIFY_IDENTITY (excluded from first batch) (9):

  `FMA20194`, `FMA24517`, `FMA37456`, `FMA54397`, `FMA54398`, `FMA55663`, `FMA5884`, `FMA67601`, `FMA9649`

All concepts in the original non-CLEAN classes are also excluded from this first batch and remain in their original class queues. Their exact IDs are preserved under `firstHarvestingBatch.excludedByOriginalTargetClass` in the JSON plan.

### Family batch overview after QA

| Direct batch | Family | Confirmed direct | Size | English/Latin evidence coverage | Median meshes |
| --- | --- | ---: | --- | ---: | ---: |
| M04B2D-0.1-DIRECT-01 | other | 7 | SMALL | 6/7 | 1 |
| M04B2D-0.1-DIRECT-02 | tendons_ligaments | 5 | SMALL | 3/5 | 1 |
| M04B2D-0.1-DIRECT-03 | glands | 2 | SMALL | 2/2 | 1.5 |
| M04B2D-0.1-DIRECT-04 | muscles | 2 | SMALL | 0/2 | 1.5 |
| M04B2D-0.1-DIRECT-05 | organs | 2 | SMALL | 0/2 | 1 |
| M04B2D-0.1-DIRECT-06 | arteries | 1 | SMALL | 0/1 | 2 |
| M04B2D-0.1-DIRECT-07 | ducts_conduits | 1 | SMALL | 0/1 | 1 |
| M04B2D-0.1-DIRECT-08 | nerves_neuroanatomy | 1 | SMALL | 0/1 | 2 |
| M04B2D-0.1-DIRECT-09 | veins | 1 | SMALL | 0/1 | 2 |

English/Latin evidence coverage above means an existing English and/or Latin match is available in the supplied research data; it does not mean Vietnamese evidence exists.

## Explicit excluded/problem groups

- EXISTING_CONFLICT_OR_VARIANT (32): preserve the current conflict and variant queue; do not harvest as if a preferred form were settled.
- AGGREGATE_OR_COMPOSITE_TARGET (1273): keep multi-structure, aggregate, branch/trunk, scope-mismatch, and aggregate-name cases separate from simple harvesting.
- ONTOLOGY_SCOPE_TARGET (573): resolve atlas/FMA/TA2 granularity or generic scope before treating a source record as an exact identity.
- LATERALITY_TARGET (1207): research the base entity and exact side-specific evidence; never compose right/left forms automatically.
- IDENTITY_TARGET (14): pin an external identity before source harvesting.
- EXISTING_EVIDENCE (16): retain as research-only evidence; this milestone does not promote or release it.

The raw integrated M04B2C conflict/variant states remain represented by the plan: current CONFLICT_REQUIRES_ADJUDICATION and VARIANT_REVIEW results are all classified as EXISTING_CONFLICT_OR_VARIANT, and none of them receives a clean-target QA disposition.

## Safety and STOP condition

The plan contains English atlas names, deterministic family labels, mesh counts, source IDs/revisions, English/Latin evidence metadata where available, and classification signals. It contains no generated Vietnamese terms, no search aliases, no release entries, and no medical decisions. Production terminology, reviewer, and release files remain unchanged.

**STOP after M04B2D-0.1. Do not begin source harvesting, M04C UI work, or medical review.**

Plan digest: 27bc2db9f28221912a25c43453211975fcc1cb14708dc2cf4f538ba2c745687b.
