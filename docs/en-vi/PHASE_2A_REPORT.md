# Phase 2A Report: Authoritative Source Registry and Terminology Validation Infrastructure

## Status

M02A is implemented as a validation and packaging boundary only. The production source and terminology registries are intentionally empty. No Vietnamese anatomical term is displayable, searchable, or marked medically reviewed by this phase.

Baseline commit at the start of M02A: `1c38bf35c254a891200d3cedecfd57abebe83d8d`.

## Scope and audit findings

The Phase 0/1 contract already had an empty runtime overlay, an empty source catalog, a strict English fallback, and a basic source-backed resolver gate. The missing M02A infrastructure was:

- no authoritative, reviewable registry files;
- no source capability model distinguishing identity, Latin, Vietnamese, secondary, and machine discovery authority;
- provenance locators were unstructured strings;
- review state had only generic reviewer/date fields rather than separate source, medical, and release audits;
- no executable validator cross-referencing registry records with the atlas;
- no independent terminology coverage metrics;
- the existing localization regression fixture used plausible anatomical Vietnamese/Latin strings, which was replaced with explicit `TEST_ONLY` values.

The audit found no need to change atlas geometry, mesh IDs, concept IDs, render-loop behavior, WebMCP tool names, or the static deployment model.

## Storage and loading boundary

M02A uses static JSON because it is diffable, reviewable, deterministic, and compatible with the existing static Vite deployment:

- `data/terminology/sources.json`: `{ "schemaVersion": 1, "sources": [] }`;
- `data/terminology/entries.json`: `{ "schemaVersion": 1, "entries": [] }`.

Each entry record has an explicit `key`, which must equal `conceptId`. The validator reads both documents with `public/models/atlas.json`. The runtime `TERMINOLOGY_OVERLAY` and `TERMINOLOGY_SOURCES` remain empty until the reviewed pilot integration milestone; this prevents a registry edit from becoming user-visible without the next release decision.

## Contract changes

`app/terminology.ts` now defines:

- explicit source capabilities: `anatomical-identity`, `canonical-latin`, `vietnamese-preferred`, `secondary-corroboration`, and `machine-candidate-discovery`;
- required source title, capability flags, and `UNVERIFIED`/`VERIFIED` source audit metadata;
- optional bibliographic metadata with validation for dates, URLs, years, and placeholders;
- `bodyParts3d` identifiers with `packaged-mesh` or `external` scope;
- structured provenance locators: page, chapter, section, table, entry ID, URL, and nomenclature ID;
- separate `sourceVerification`, `medicalReview`, and `releaseEligibility` review audits;
- a release gate requiring mapped identity, a nonempty preferred term, all required audits, verified non-machine provenance, a Vietnamese-preferred source capability, reproducible locators, and matching anatomical-identity locators for FMA/TA2 IDs;
- original English fallback behavior and the empty runtime overlay.

## Validator and fixtures

`scripts/validate-terminology.mjs` validates:

- schema versions, duplicate source IDs, duplicate entry keys, key/concept identity, orphan concepts, English snapshots, mapping/review states, and placeholder metadata;
- source class/capability conflicts and verified-source audit fields;
- packaged mesh IDs, FMA/TA2 locator matches, provenance source resolution, locator structure, dates, URLs, and release-candidate reproducibility;
- review-audit completeness and the non-automated medical-review requirement;
- Vietnamese candidate fields, normalization duplicates, ASCII search-form rules, unreleased candidate warnings, cross-concept normalized collisions, and conservative semantic mismatch warnings;
- independent coverage metrics and unresolved/unmapped concepts.

`npm run test:terminology` uses synthetic records and explicit `TEST_ONLY` labels. It exercises valid authority classes, machine-only rejection from release, invalid capability combinations, unresolved provenance, missing medical audits, English snapshot mismatch, normalized collisions, unknown packaged mesh IDs, release gates, and coverage. These fixtures are not production terminology data.

The validator supports human output and `node scripts/validate-terminology.mjs --json` for machine-readable diagnostics. It never generates, translates, rewrites, deletes, or auto-corrects terminology.

## M02A coverage

The empty production registry was validated against the current atlas:

| Metric | Count | Percent of 3,432 concepts |
| --- | ---: | ---: |
| Terminology registry entries | 0 | — |
| Vietnamese candidate entries | 0 | 0% |
| Searchable terminology entries | 0 | 0% |
| Source-verified entries | 0 | 0% |
| Medically reviewed entries | 0 | 0% |
| Release-eligible entries | 0 | 0% |
| Unresolved or unmapped concepts | 3,432 | — |

The report keeps candidate, searchable, source-verified, medically reviewed, release-eligible, and unresolved/unmapped measures separate. There is no single “translation percentage.”

## Verification commands

The final M02A verification set is:

```text
npm run check
node scripts/validate-atlas.mjs
node scripts/validate-interactions.mjs
npm run test:localization
npm run test:terminology
node scripts/validate-terminology.mjs
node scripts/validate-terminology.mjs --json
npm run build
git diff --check
```

Final result: all commands above passed. The production build completed with the existing advisory that the minified JavaScript chunk is larger than 500 kB; no new failure or geometry/data regression was reported.

Atlas and interaction checks remain the existing Phase 0/1 regression checks. Build output may continue to report the pre-existing large-chunk advisory; that advisory does not change the M02A gate.

## Known limitations

- No production source records or terminology entries were added, so no medical claim is made.
- The registry is validated but not yet loaded into the runtime overlay or search surface.
- Source metadata is structurally checked; it does not substitute for human source verification.
- Semantic heuristics are review prompts and do not prove correctness.
- Coverage is currently intentionally zero for terminology release metrics.
- No database, backend, secret, scraper, bulk translation, or geometry change was introduced.

## Exact next milestone

M03 is a small, source-backed reviewed terminology pilot. It must select an explicitly scoped concept set, register verifiable authoritative sources and exact locators, map only to existing `Concept.id`/mesh identities, obtain qualified medical review, run the validator, and integrate only the reviewed pilot into the runtime. It must not extrapolate terms to the remaining 3,432 concepts.
