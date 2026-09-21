# Human Atlas English–Vietnamese Master Specification

Status: binding Phase 0/1 and Bilingual Functional V1 specification for this repository.

This specification applies to the fork at commit 1c38bf35c254a891200d3cedecfd57abebe83d8d and to later work unless it is deliberately superseded by a reviewed update. The repository is an interactive Vite/React/Three.js viewer whose packaged source of truth is the BodyParts3D 4.0 atlas in public/models.

The current implementation establishes a complete ordinary bilingual UI while preserving the medical-content gate. It does not translate the anatomy dataset. There are no production Vietnamese anatomical entries in the terminology registry.

## Product boundary

The completed product may provide English and Vietnamese interface text, reviewed Vietnamese anatomical terms, original English terms, canonical Latin terms where mappings are verified, multilingual search, provenance, and deterministic English fallback. It must continue to be a static/client-side Vite application unless repository evidence later proves that a backend is necessary.

The anatomy source remains independently recoverable. Localization is an overlay keyed by stable concept identity, not a rewrite of public/models/atlas.json or of any binary geometry.

## Non-negotiable invariants

| Area | Invariant |
| --- | --- |
| English behavior | Existing English terminology, search, selection, inspection, systems, explosion, camera controls, attribution, and error behavior continue to work. |
| Identity | Existing concept IDs and mesh IDs remain byte-for-byte stable unless an upstream regeneration is explicitly reviewed. |
| Geometry | One geometry dataset serves every language. No language-specific mesh, buffer, picker, or render batch may be created. |
| Model lifecycle | Switching language must not reload the atlas manifest, fetch geometry again, recreate the Three.js renderer, or change the render loop. |
| UI and anatomy data | Normal interface messages use semantic UI keys. Anatomical terminology is stored in a separate concept-keyed terminology layer. |
| Vietnamese fallback | A Vietnamese label is displayable only when its mapping, review state, and source provenance meet the release gate. Otherwise the original English atlas name is displayed. |
| Verification | Translation coverage and verified coverage are separate metrics. A present draft, alias, or machine suggestion is not verified coverage. |
| Unknowns | An unknown mapping remains UNMAPPED or absent. No missing term may be filled by inference, word-for-word translation, or an AI guess. |
| Aliases | Preferred terms are immutable display fields. Aliases and search aliases may resolve to the concept but may not replace the preferred term or create a second concept. |
| Directionality | Left/right, anterior/posterior, superior/inferior, medial/lateral, proximal/distal, and superficial/deep meaning must survive mapping and review. |
| Attribution | BodyParts3D attribution, CC BY 4.0 terms, application MIT terms, third-party notices, and source links remain intact. |
| Deployment | The existing Vercel configuration remains valid: npm ci, npm run build, and the dist output continue to work. |
| Accessibility and mobile | Language controls, labels, focus behavior, touch interaction, responsive panels, and keyboard search behavior must not regress. |

## Two-layer localization boundary

UI localization covers interface copy such as search controls, reset, systems panel headings, loading messages, and language controls. It uses stable semantic keys and supports en and vi. Medically meaningful preset labels such as Skeleton and Organs may intentionally retain their English source labels until reviewed terminology authorizes Vietnamese wording; this is English medical fallback, not a missing UI translation.

Anatomical terminology covers a Concept identity, the source English name, optional Latin, Vietnamese preferred and alias forms, source IDs, provenance, mapping status, and review state. It never lives in the ordinary UI message dictionary.

The current implementation demonstrates both layers with a statically loaded, currently empty terminology registry. The Vietnamese strings present in the UI dictionary are ordinary interface labels; they are not mappings for any FMA concept or mesh.

## Safe display policy

For language en, the name in Atlas.concepts is authoritative and is displayed unchanged.

For language vi, the resolver checks, in order:

1. an entry keyed by the exact Concept.id;
2. mapping status MAPPED;
3. review status VERIFIED;
4. a nonempty Vietnamese preferred term;
5. source-verification, non-automated medical-review, and release-eligibility audits have passed;
6. provenance references resolve to verified, non-machine-generated source records with reproducible locators;
7. at least one provenance source advertises the vietnamese-preferred capability;
8. any FMA or TA2 identifier has a matching anatomical-identity nomenclature locator.

If any condition fails, the English Atlas.concepts name is returned. The resolver does not modify the English source name from the overlay.

SOURCE_VERIFIED and MEDICAL_REVIEWED are useful workflow states, but they are not the Phase 0/1 release threshold. Only VERIFIED is displayable by the production resolver.

## Search policy

Search remains a bounded linear scan over the existing concepts, with a small overlay-derived term surface. It can include the original English name, stable identifiers, verified English aliases, mapped Latin, and verified Vietnamese preferred/alias/search forms. Vietnamese no-diacritic forms are matching forms only.

No persisted duplicate index is introduced in this phase. An indexed search structure requires measurement showing that the current 3,432-concept scan is insufficient.

## Phase gate

This phase is complete only when:

- the repository audit and baseline are recorded;
- the UI language state, dictionary, persistence, and switcher exist;
- terminology types and an empty overlay exist;
- the resolver has deterministic English fallback;
- normalization is unit-testable and cannot create canonical terms;
- no anatomy geometry, source IDs, or English dataset names were rewritten;
- the application type-checks and builds;
- existing atlas and interaction checks still pass;
- the governing documents and Phase 0/1 report accurately describe the result.

No later terminology milestone starts automatically from this phase.
