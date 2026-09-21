# M03A Pilot Selection Report

## Decision and provenance

The adversarial pilot is frozen at exactly 50 distinct Atlas Concept records. Selection is reproducible from `public/models/atlas.json` at M02B commit `c134f30`. The file freezes the atlas English name and the complete `Concept.elements` array for each record; it does not assert any FMA or TA2 identity. Every edge-case label is a `PILOT HYPOTHESIS` or an investigation flag.

Primary categories are justified by the atlas concept name and, for the unqualified `sternothyroid` name, the selected parts' existing runtime system (`muscular`).

## Category distribution

| Primary category | Count |
| --- | ---: |
| Bone | 6 |
| Muscle | 6 |
| Tendon | 4 |
| Ligament | 4 |
| Artery | 5 |
| Vein | 4 |
| Nerve | 5 |
| Organ | 4 |
| Gland | 3 |
| Joint | 4 |
| Fascia/connective tissue | 5 |
| **Total** | **50** |

## Frozen concepts

| Concept ID | Atlas English name | Primary category |
| --- | --- | --- |
| FMA16586 | right hip bone | Bone |
| FMA16587 | left hip bone | Bone |
| FMA24499 | navicular bone of foot | Bone |
| FMA9613 | parietal bone | Bone |
| FMA33302 | proximal carpal bone | Bone |
| FMA33303 | distal carpal bone | Bone |
| FMA22439 | muscle of medial compartment of thigh | Muscle |
| FMA22472 | muscle of anterior compartment of leg | Muscle |
| FMA19728 | superficial perineal muscle | Muscle |
| FMA22427 | muscle of posterior compartment of thigh | Muscle |
| FMA9756 | external intercostal muscle | Muscle |
| FMA13343 | sternothyroid | Muscle |
| FMA51061 | calcaneal tendon | Tendon |
| FMA264844 | left calcaneal tendon | Tendon |
| FMA54159 | tendon of right levator palpebrae superioris | Tendon |
| FMA65410 | intermediate tendon | Tendon |
| FMA44249 | right long plantar ligament | Ligament |
| FMA44250 | left long plantar ligament | Ligament |
| FMA55139 | lateral thyrohyoid ligament | Ligament |
| FMA55237 | median cricothyroid ligament | Ligament |
| FMA3802 | trunk of right coronary artery | Artery |
| FMA3813 | anterior ventricular branch of right coronary artery | Artery |
| FMA3951 | subclavian artery | Artery |
| FMA10662 | inferior thyroid artery | Artery |
| FMA3994 | second posterior intercostal artery | Artery |
| FMA4725 | subclavian vein | Vein |
| FMA4751 | right brachiocephalic vein | Vein |
| FMA8668 | superior lingular vein | Vein |
| FMA8669 | inferior lingular vein | Vein |
| FMA5913 | nerve trunk | Nerve |
| FMA52570 | branch of cranial nerve | Nerve |
| FMA50875 | right optic nerve | Nerve |
| FMA50878 | left optic nerve | Nerve |
| FMA52672 | communicating branch of nasociliary nerve with ciliary ganglion | Nerve |
| FMA7196 | spleen | Organ |
| FMA7148 | stomach | Organ |
| FMA7198 | pancreas | Organ |
| FMA7203 | kidney | Organ |
| FMA9597 | salivary gland | Gland |
| FMA15629 | right adrenal gland | Gland |
| FMA15630 | left adrenal gland | Gland |
| FMA25511 | intervertebral symphysis | Joint |
| FMA25571 | intervertebral symphysis of axis | Joint |
| FMA26086 | seventh cervical intervertebral symphysis | Joint |
| FMA26089 | first thoracic intervertebral symphysis | Joint |
| FMA79063 | deep fascial system | Fascia/connective tissue |
| FMA58775 | zone of fascia lata | Fascia/connective tissue |
| FMA58418 | investing fascia of right lower limb | Fascia/connective tissue |
| FMA58419 | investing fascia of left lower limb | Fascia/connective tissue |
| FMA57965 | zone of investing fascia | Fascia/connective tissue |

## Edge-case coverage

| Requirement | Frozen candidates |
| --- | --- |
| Left/right | FMA16586/FMA16587; FMA264844/FMA54159; FMA44249/FMA44250; FMA3802; FMA4751; FMA50875/FMA50878; FMA15629/FMA15630; FMA58418/FMA58419 |
| Anterior/posterior | FMA22472/FMA22427; FMA3813; FMA3994 |
| Superior/inferior | FMA10662; FMA8668/FMA8669 |
| Medial/lateral | FMA22439; FMA55139 |
| Proximal/distal | FMA33302/FMA33303 |
| Superficial/deep | FMA19728; FMA79063 |
| Compound directional qualifier | FMA3813 (right plus anterior) |
| Branch/trunk families | Coronary: FMA3802/FMA3813; cranial nerve: FMA5913/FMA52570/FMA52672 |
| Artery versus vein | Direct regional neighbor FMA3951/FMA4725, plus FMA3802/FMA3813/FMA10662 against FMA4751/FMA8668/FMA8669 |
| Muscle versus tendon | FMA19728/FMA9756 against FMA51061/FMA264844/FMA54159 |
| Nerve versus ligament | FMA5913/FMA52570 against FMA44249/FMA44250/FMA55139 |
| Multi-mesh concepts | 31 tagged records; validator checks exact element membership and count |
| Aggregate/composite candidates | FMA7198, FMA7203, FMA79063, FMA57965, FMA9597 |
| Shared-membership candidates | FMA79063 and FMA57965, with overlaps to FMA58775/FMA58418/FMA58419 in the selected snapshot |
| Ontology investigation flags | 24 distinct concepts carry at least one granularity, one-to-many, many-to-one, no-clean-TA2, or source-specific identity risk tag |
| Vietnamese naming variation risk | 23 flagged records; no Vietnamese term is supplied |
| Synonym-risk groups | Intercostal modifiers (FMA9756/FMA3994); tendon names (FMA51061/FMA264844/FMA65410); symphysis level names (FMA25511/FMA25571/FMA26086/FMA26089); fascia zone/investing names (FMA58775/FMA58418/FMA58419/FMA57965) |
| Normalization-collision groups | Proximal/distal carpal pair; superior/inferior lingular pair; numbered cervical/thoracic symphyses; fascia zone/investing family |
| Straightforward controls | FMA16586, FMA16587, FMA9613, FMA13343, FMA3951, FMA4725, FMA7196, FMA7148 |

## Validation and boundaries

`npm run test:m03a` passes. It verifies the 50-record count, uniqueness, atlas name snapshots, exact mesh arrays, global mesh existence, category counts, lexical support for directional tags, all edge-case quotas, actual selected-element overlap for shared-membership candidates, and the absence of production terminology/review fields. It also verifies that production entries, sources, and reviewers are empty and that `release.json` remains `UNRELEASED`.

No Vietnamese term, alias, preferred terminology, source record, reviewer approval, FMA mapping, TA2 mapping, status transition, release record, geometry change, or atlas ID change was created. FMA-looking strings remain opaque atlas identifiers only.

The pilot labels do not establish semantic equivalence. Mesh overlap does not establish identity, and a lexical direction token does not establish an anatomical relation. The current snapshot is tied to the pinned atlas file; an upstream atlas change must invalidate and re-run this selection.

## Exact next task

Run the M03 source-and-review pilot against these 50 frozen concepts only. Populate evidence claims and adjudicate the flagged identity, granularity, source, synonym, normalization, and direction hypotheses before selecting any additional atlas concepts.
