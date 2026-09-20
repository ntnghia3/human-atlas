# Anatomical Terminology Policy

## Governing rule

Anatomical terminology is data, not ordinary UI copy. A Vietnamese anatomical label may not be considered production-ready because it is plausible, fluent, machine-generated, or present in a draft file.

The overlay is keyed by stable anatomical concept identity. For this repository the runtime concept key is Concept.id from public/models/atlas.json. A concept may reference multiple renderable Part IDs, so terminology is stored once per concept rather than once per mesh.

## Required entry shape

Each future entry must provide:

- conceptId equal to the target Atlas Concept.id;
- sourceIds for relevant BodyParts3D element IDs with packaged-mesh or external scope and, when available, FMA and TA2 identifiers;
- an English preferred snapshot that can be compared with Atlas.concepts;
- optional canonical Latin and aliases;
- optional Vietnamese preferred, aliases, search aliases, and matching-only ASCII forms;
- provenance references to source records;
- a mapping status;
- a review status plus separate source-verification, medical-review, and release-eligibility audit records when needed.

The TypeScript contract is implemented in app/terminology.ts. The runtime imports the static M02A registry; its current production overlay is empty.

## Status model

The stable status vocabulary is:

| Status | Meaning | Displayable as Vietnamese preferred term? |
| --- | --- | --- |
| UNMAPPED | No verified mapping exists. | No |
| MAPPED | Source identity mapping is established. | No by itself |
| DRAFT | Candidate term or mapping awaiting review. | No |
| SOURCE_VERIFIED | A source check has been completed. | No in the current release gate |
| MEDICAL_REVIEWED | A qualified medical review has occurred. | No in the current release gate |
| VERIFIED | Mapping, preferred term, provenance, and release checks are complete. | Yes, if all gate conditions hold |
| REJECTED | Explicitly rejected or unsafe. | No |

MAPPED is used by the mapping object. The review object uses the workflow values appropriate to review. Unknown and unresolved entries must remain UNMAPPED or absent.

## Release resolver

app/terminology.ts requires all of the following before returning Vietnamese:

1. the exact concept key is present;
2. mapping.status is MAPPED;
3. review.status is VERIFIED;
4. vietnamese.preferred is nonempty;
5. source-verification, non-automated medical-review, and release-eligibility audits have passed;
6. every provenance source ID resolves to a verified non-machine source record;
7. every provenance reference has a reproducible structured locator;
8. the provenance includes a source with the vietnamese-preferred capability;
9. FMA and TA2 identifiers, when present, have matching anatomical-identity nomenclature locators.

When the gate fails, the resolver returns the original English Atlas name. It does not return a draft, alias, ASCII form, or guessed fallback.

The source catalog requirement is intentionally strict. An entry can be fully typed and still be non-displayable until its source records are registered and validated.

## Preferred terms and aliases

Preferred is the only canonical display field. Aliases and search aliases are resolution inputs only. They must not overwrite preferred, create duplicate concepts, or be displayed as an authoritative replacement.

ASCII/no-diacritic forms exist solely to support input matching. They must not replace correct Vietnamese orthography in the preferred field or be used to manufacture a preferred field.

## Semantic safety

Review must preserve distinctions such as:

- left and right;
- anterior and posterior;
- superior and inferior;
- medial and lateral;
- proximal and distal;
- superficial and deep;
- artery and vein;
- nerve and ligament;
- branch and trunk.

Heuristic checks may flag suspicious inversions or missing directional words, but they are not a translation engine. Anatomical context and authoritative review decide the result.

## No bulk translation in Phase 0/1/M02A

M02A intentionally contains no production Vietnamese anatomical terminology or bulk candidate list. Its regression fixtures use explicit `TEST_ONLY` labels and are not registry data. Future work must start with a source-backed pilot and a reviewed source registry. A machine-generated candidate may be stored only as a clearly marked draft input and can never be the sole evidence for VERIFIED.
