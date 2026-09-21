# English–Vietnamese Implementation Roadmap

## Completed Phase 0/1

Repository audit and governance:

- recorded baseline commit and worktree state;
- documented Vite, React, Three.js, manifest, geometry, search, detail panel, system, conversion, validation, Vercel, WebMCP, attribution, and performance behavior;
- created the binding master, architecture, terminology, source, schema, QA, roadmap, and baseline documents.

Minimum foundation:

- added Language en | vi and safe localStorage persistence;
- added a small semantic UI dictionary and language switcher;
- localized representative controls without moving anatomy terminology into UI messages;
- added terminology types, source catalog types, an empty overlay, a resolver, a source-backed VERIFIED gate, and a linear multilingual search surface;
- added Vietnamese diacritic/no-diacritic matching normalization;
- added executable localization tests;
- kept the original atlas and geometry untouched.

## Milestone 2A: source registry and terminology validation infrastructure (completed)

- chose static, reviewable JSON storage at `data/terminology/sources.json` and `data/terminology/entries.json`;
- strengthened source records with explicit authority capabilities and verified-source audits;
- added structured provenance locators and separate source-verification, medical-review, and release-eligibility audits;
- added `scripts/validate-terminology.mjs`, optional JSON diagnostics, independent coverage metrics, and TEST_ONLY regression fixtures;
- kept both production registry arrays empty, so no Vietnamese anatomical term is displayable or searchable;
- cross-referenced registry contracts with the current atlas without changing geometry, concept IDs, mesh IDs, or runtime behavior.

Exit gate: PASS when the empty production registry validates, synthetic invalid cases fail for the expected reasons, and the existing atlas, interaction, localization, typecheck, and build checks remain green.

## Bilingual Functional V1 (completed)

- completed ordinary English/Vietnamese UI localization with semantic keys and matching dictionary coverage;
- preserved safe language persistence, storage-failure fallback, and `document.documentElement.lang` updates;
- connected the static registry to the runtime overlay, source-aware resolver, UI search, hover labels, detail panel, and WebMCP search;
- kept system names behind an empty controlled medical-label boundary and kept system descriptions, concept explanations, and source-scope prose in English;
- verified that language state is outside the atlas/geometry effect and that the empty terminology registry is a first-class production state;
- added deployment-readiness documentation without deploying or changing Vercel architecture.

The next execution task after this milestone was governance hardening. M03 terminology research and pilot work remain deferred.

## Milestone 2B: terminology governance and ontology hardening (completed)

- treated `Atlas Concept.id` as an opaque identity and removed the single FMA/TA2 identifier assumption;
- added plural external mappings with relation, disposition, source revision, and claim evidence;
- separated atlas mesh membership from ontology equivalence and validated membership against each concept’s `elements`;
- replaced entry-wide provenance authority with claim-level evidence for identity, mappings, Latin, aliases, Vietnamese preferred wording, and search forms;
- added explicit source-conflict records and human adjudication requirements;
- added a reviewer registry with authorization scope and current revision-bound source/medical/release audits;
- added deterministic entry fingerprints and a reproducible release manifest;
- gated every terminology-derived search form and fixed released-subset normalized collision handling;
- added mapping/source-gap/stale/conflict disposition metrics and synthetic `TEST_ONLY` governance fixtures;
- kept production sources, reviewers, entries, and released terminology empty.

Exit gate: all regression commands and the strengthened terminology suite pass; the production validator reports 3,432 unresolved/unmapped concepts and zero release-eligible entries. Stop after M02B; do not begin the pilot in this milestone.

## Milestone 3: reviewed terminology pilot (deferred; not started)

Select a small, explicitly scoped concept set. Map identity to existing Concept.id and relevant BodyParts3D, FMA, and TA2 identifiers. Gather authoritative Vietnamese sources and medical review. Do not extrapolate pilot terms to the remaining concepts.

Exit gate: pilot entries pass source, semantic, directional, alias, normalization, and fallback checks.

## Milestone 4: search and resolver integration

Load the reviewed catalog without coupling it to geometry. Extend UI and WebMCP search to use the same resolver/search service. Preserve source ID search and the current result limit. Measure scan cost before considering indexing.

Exit gate: English, Vietnamese, no-diacritic Vietnamese, Latin, aliases, and source identifiers resolve to one stable concept without collisions.

## Milestone 5: broader UI localization

Migrate remaining ordinary UI strings by semantic key. Decide separately whether system names, explanations, captions, and detail metadata belong to UI messages, localized system metadata, or terminology. Do not put concept mappings in the UI dictionary.

Exit gate: accessibility labels, mobile layout, focus behavior, and WebMCP text remain correct in both languages.

## Milestone 6: upstream synchronization and release QA

Automate comparison of new atlas manifests. Detect added, removed, renamed, remapped, and unchanged concepts. Run full structural, semantic, interaction, attribution, and performance checks on every terminology or upstream data change.

Exit gate: no orphan or guessed mapping is silently shipped and original English identity is recoverable.

## Milestone 7: deployment

Keep the app static and deploy through the existing Vercel configuration. Confirm npm ci, npm run check, npm run build, attribution, client-side loading, and mobile behavior in the deployment environment.

## Deliberately deferred

- bulk Vietnamese translation;
- textbook scraping or copied passages;
- canonical Latin population without verified mapping;
- a large i18n dependency;
- geometry or atlas identifier changes;
- a backend, database, or server-side translation service;
- production deployment;
- automatic translation or AI-generated release terms.
