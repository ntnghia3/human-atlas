# English–Vietnamese QA Strategy

## Existing baseline checks

The repository has no general test framework. Its validation is executable Node scripts plus the TypeScript and Vite commands:

| Command | Coverage |
| --- | --- |
| npm run check | TypeScript type checking with no emit. |
| node scripts/validate-atlas.mjs | Exact mesh/concept counts, unique mesh IDs, names, concept membership, binary bounds, finite positions, valid indices, and triangle total. |
| node scripts/validate-interactions.mjs | Explosion layout at desktop/mobile aspect ratios, atlas tool search/inspection contracts, pointer tap/drag/multitouch/cancel behavior, and empty layout. |
| npm run test:localization | English/Vietnamese dictionary parity, ordinary UI lookup and interpolation, built-in combobox/sheet accessibility-label wiring, persistence and storage failure fallback, document-safe language behavior contract, intentional English medical-preset fallback, empty production registry, verified release gate, and Latin/Vietnamese search fields. |
| npm run test:terminology | TEST_ONLY fixtures for source capabilities, provenance locators, review audits, release gating, orphan and mesh references, normalized collisions, and coverage. |
| node scripts/validate-terminology.mjs | Validates the static source/entry registry against the current atlas and prints independent coverage metrics. Add `--json` for machine-readable diagnostics. |
| npm run build | Production Vite build and static dist output. |

## M02A terminology validation

`scripts/validate-terminology.mjs` is the dedicated registry validator. It fails on structural or release-safety errors and reports conservative review warnings separately. It checks the two JSON documents without mutating them and does not generate, translate, or auto-correct terms.

Blocking checks include:

A terminology validator must check:

- orphan concept IDs;
- entries whose map key differs from conceptId;
- duplicated concept mappings;
- duplicate preferred terms where a distinct identity is expected;
- missing provenance;
- provenance IDs missing from the source catalog;
- invalid mapping or review states;
- Vietnamese VERIFIED term without an authoritative source;
- machine-generated-only provenance;
- unknown BodyParts3D, FMA, or TA2 identifiers;
- broken aliases and aliases pointing to no concept;
- duplicate aliases that resolve to competing concepts;
- empty preferred fields;
- ASCII search forms accidentally used as display values;
- language fallback failures;
- collisions introduced by normalization;
- unexpected modification of original concept or mesh identifiers.

It also checks source capability/class conflicts, verified source audit metadata, structured locator fields, FMA/TA2 locator matches, required review audits, placeholder bibliographic metadata, ASCII search-form rules, and the full Vietnamese release gate. Semantic direction/category heuristics are warnings only. Normalized alias collisions are warnings for unresolved candidates and blocking errors when both competing entries are release-eligible.

The validator must distinguish coverage from verification:

- Vietnamese candidate coverage = entries with any Vietnamese candidate field;
- searchable coverage = entries with permitted additional aliases, mapped Latin, or release-eligible Vietnamese forms;
- source-verified coverage = entries with a passed source-verification audit;
- medically-reviewed coverage = entries with a passed non-automated medical-review audit;
- release coverage = entries passing the complete `hasVerifiedVietnamese` gate;
- unresolved/unmapped count = atlas concepts without a mapped, existing registry entry.

These numbers must never be collapsed into one translation percentage.

## Semantic safety heuristics

For mapped pairs, flag likely inconsistencies involving:

- left versus right; trái versus phải;
- anterior versus posterior; trước versus sau;
- superior versus inferior; trên versus dưới;
- medial versus lateral; trong versus ngoài;
- proximal versus distal; gần versus xa;
- superficial versus deep; nông versus sâu;
- artery versus vein; động mạch versus tĩnh mạch;
- nerve versus ligament; thần kinh versus dây chằng;
- branch versus trunk; nhánh versus thân.

These are review prompts, not an automated translation engine. They must not auto-correct a term or declare a translation anatomically correct.

## Search and fallback tests

Each release should test:

- English name and existing source ID still resolve to the same concept;
- a verified Vietnamese preferred term resolves to that concept;
- a verified Vietnamese alias and no-diacritic form resolve to the same concept;
- Latin resolves only when mapped and present;
- draft, rejected, unmapped, and missing-source Vietnamese terms do not display or search as production terms;
- an unknown query returns no guessed result;
- language switching changes UI copy without changing selected IDs, visible systems, camera state, or loaded chunks.

## Regression and performance

The 3D regression set must retain:

- exact atlas counts and IDs;
- binary geometry and triangle count;
- selection and detail panel behavior;
- system toggles and presets;
- explosion and isolation layout;
- desktop, mobile, and landscape controls;
- WebMCP tool names and concept IDs;
- BodyParts3D attribution.

Measure before introducing a search index or lazy-loading terminology. Terminology must remain outside the render loop and must not add language-specific geometry, picker meshes, GPU textures, or chunk requests. Language-switch smoke checks must confirm the atlas object, selected IDs, visibility, isolate/explosion state, and scene mount remain stable while UI labels update.

## Manual review

Before a terminology release, a qualified reviewer inspects every changed entry’s identity, source locator, preferred form, aliases, directional meaning, and neighboring structures. A passing structural validator is not a medical review.
