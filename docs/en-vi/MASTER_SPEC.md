# Human Atlas English–Vietnamese Master Specification

Status: binding Phase 0/1, Bilingual Functional V1, and M02B terminology-governance specification for this repository.

This specification applies to the fork at commit 1c38bf35c254a891200d3cedecfd57abebe83d8d and to later work unless it is deliberately superseded by a reviewed update. The repository is an interactive Vite/React/Three.js viewer whose packaged source of truth is the BodyParts3D 4.0 atlas in public/models.

The current implementation establishes a complete ordinary bilingual UI while preserving the medical-content gate. It does not translate the anatomy dataset. There are no production Vietnamese anatomical entries in the terminology registry.

## Product boundary

The completed product may provide English and Vietnamese interface text, reviewed Vietnamese anatomical terms, original English terms, canonical Latin terms where mappings are verified, multilingual search, provenance, and deterministic English fallback. It must continue to be a static/client-side Vite application unless repository evidence later proves that a backend is necessary.

The anatomy source remains independently recoverable. Localization is an overlay keyed by stable concept identity, not a rewrite of public/models/atlas.json or of any binary geometry.

## Non-negotiable invariants

| Area | Invariant |
| --- | --- |
| English behavior | Existing English terminology, search, selection, inspection, systems, explosion, camera controls, attribution, and error behavior continue to work. |
| Identity | Atlas concept IDs and mesh IDs remain byte-for-byte stable unless an upstream regeneration is explicitly reviewed; an FMA-like Atlas ID is never treated as an FMA identity without a sourced claim. |
| Geometry | One geometry dataset serves every language. No language-specific mesh, buffer, picker, or render batch may be created. |
| Model lifecycle | Switching language must not reload the atlas manifest, fetch geometry again, recreate the Three.js renderer, or change the render loop. |
| UI and anatomy data | Normal interface messages use semantic UI keys. Anatomical terminology is stored in a separate concept-keyed terminology layer. |
| Vietnamese fallback | A Vietnamese label is displayable only when its identity disposition, claim evidence, current source and qualified human review, conflict state, revision, and derived release gate pass. Otherwise the original English atlas name is displayed. |
| Verification | Translation coverage and verified coverage are separate metrics. A present draft, alias, or machine suggestion is not verified coverage. |
| Unknowns | An unknown mapping remains UNMAPPED or absent. No missing term may be filled by inference, word-for-word translation, or an AI guess. |
| Aliases | Preferred terms are immutable display fields. Aliases and search aliases may resolve to the concept but may not replace the preferred term or create a second concept. |
| Directionality | Left/right, anterior/posterior, superior/inferior, medial/lateral, proximal/distal, and superficial/deep meaning must survive mapping and review. |
| Attribution | BodyParts3D attribution, CC BY 4.0 terms, application MIT terms, third-party notices, and source links remain intact. |
| Deployment | The existing Vercel configuration remains valid: npm ci, npm run build, and the dist output continue to work. |
| Accessibility and mobile | Language controls, labels, focus behavior, touch interaction, responsive panels, and keyboard search behavior must not regress. |

## Two-layer localization boundary

UI localization covers interface copy such as search controls, reset, systems panel headings, loading messages, and language controls. It uses stable semantic keys and supports en and vi. Medically meaningful preset labels such as Skeleton and Organs may intentionally retain their English source labels until reviewed terminology authorizes Vietnamese wording; this is English medical fallback, not a missing UI translation.

Anatomical terminology covers an opaque Atlas Concept identity, optional atlas mesh membership, plural independently evidenced FMA/TA2 relationships, claim-level evidence, optional Latin and Vietnamese forms, conflicts, reviewer audits, and revision-bound release metadata. It never lives in the ordinary UI message dictionary.

The current implementation demonstrates both layers with a statically loaded, currently empty terminology registry. The Vietnamese strings present in the UI dictionary are ordinary interface labels; they are not mappings for any FMA concept or mesh.

## Safe display policy

For language en, the name in Atlas.concepts is authoritative and is displayed unchanged.

For language vi, the resolver checks, in order:

1. an entry keyed by the exact opaque Concept.id;
2. an acceptable current identity disposition and mapping relation;
3. a nonempty Vietnamese preferred term with its own supported claim;
4. exact claim evidence resolves to verified, non-machine source revisions;
5. current source-verification and qualified non-automated medical-review audits cover the current entry revision and claim scope;
6. no unresolved source conflict remains;
7. reviewer authorization and the release manifest dependencies are valid.

If any condition fails, the English Atlas.concepts name is returned. The resolver does not modify the English source name from the overlay.

SOURCE_VERIFIED, MEDICAL_REVIEWED, VERIFIED, and RELEASE_ELIGIBLE are workflow hints or derived outcomes; no stored status bypasses current dependencies. Only the derived gate is displayable by the production resolver.

## Search policy

Search remains a bounded linear scan over the existing concepts, with a small claim-gated term surface. Original English names and Atlas Concept IDs are always searchable. English aliases, mesh identifiers, external identifiers, Latin, and Vietnamese forms enter only after their individual claims pass the appropriate gate. Vietnamese no-diacritic forms are matching forms only.

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

M02B is complete only when plural external mappings, claim-level evidence, source-conflict adjudication, registered human reviewers, revision-bound approvals, derived release eligibility, claim-gated search, released-subset collision blocking, disposition metrics, and the reproducible release manifest validate with an empty production registry. M03 pilot work remains a separate milestone.

No later terminology milestone starts automatically from this phase.
