# Human Atlas English–Vietnamese Bilingual Functional V1 Report

## Outcome

- Status: **PASS**
- Readiness: **READY TO DEPLOY** for static Vercel validation/deployment; deployment was intentionally not executed in this task.
- Branch: `feature/en-vi-source-registry`
- Starting commit: `6ac7f370503581fdb14a40926684ce82168e5867`
- Final implementation commit: `2634197` (`feat: complete bilingual functional v1`).
- Scope boundary: functional bilingual UI only. M03 terminology research, source expansion, bulk translation, and production deployment were not started.

## Implemented

- Added the static runtime boundary in `app/terminology-data.ts`. It imports the existing M02A JSON registry and exposes only validated production entries and sources. The production registry remains intentionally empty.
- Connected the same terminology overlay, source catalog, resolver, and search policy to the page UI and WebMCP tools.
- Centralized concept-name resolution for detail panels, included-member lists, hover labels, system presentation, search results, and tool search results.
- Added semantic English/Vietnamese UI messages for navigation, controls, search, status text, detail actions, source actions, about headings, and generic runtime errors.
- Added a controlled system-name boundary. With no verified system overlay, system names safely remain in English.
- Added the verified Latin gate: Latin is searchable/displayable only when the entry is mapped and has human source verification, a canonical-latin source, and a reproducible locator.
- Kept medical names, explanations, source-scope prose, and attribution prose in English when no verified release entry exists.
- Kept language changes out of the scene geometry effect. Language updates change labels and accessible text without changing model identity, geometry, atlas loading, selection IDs, or scene remount behavior.
- Added localization, terminology, registry, stable-system-ID, resolver/search, storage-failure, and scene-effect regression checks.
- Made `npm run build` run the terminology validator before the Vite build, and added the `build:vercel` alias.
- Added this report and updated the governing English–Vietnamese project documents to describe the V1 runtime boundary and deferred medical-content gate.

No atlas geometry, model binary, concept IDs, source IDs, or public model assets were changed.

## UI smoke status

The live in-app browser smoke check used the available 639 × 546 viewport, which is narrow/mobile-like. It verified:

- English initial render and Vietnamese language switch.
- `document.documentElement.lang` updates and language persistence after reload.
- Vietnamese accessible names for the canvas, navigation, camera controls, search, systems, and source actions.
- Vietnamese search input and English fallback results for `femur`.
- Detail-panel fallback behavior: English medical concept name and explanation, localized generic labels, atlas reference, selected-piece count, and the explicit unavailable-verified-Vietnamese note.
- Systems drawer and about panel rendering without visible overflow in the available viewport.

The interaction validator covers the desktop, mobile, and landscape aspect-ratio cases used by the existing app layout. A separate wide desktop browser surface was not available in the current CUA session; no desktop result is claimed beyond those static/interaction checks.

## Medical-content localization deferred pending terminology verification

The following content remains deliberately English until M03 source-backed terminology verification is complete:

- `SYSTEMS` names and descriptions, and any system labels without a controlled verified overlay.
- `Concept.name`, `Part.name`, included-structure names, hover labels, and search terms that have no verified release entry.
- Anatomical explanations and educational prose.
- Source-scope and attribution prose, including the adult-male reference scope.
- Source publication names, proper names, identifiers, and raw provenance metadata.

This is the intended safe V1 behavior. Vietnamese candidates, Latin aliases, and medical mappings are not invented or exposed from the empty registry. When a future entry passes the full release gate, the same resolver will make it available consistently in display and search without changing the geometry identity.

## Terminology coverage

The validator reports the following production inventory:

| Metric | Count |
| --- | ---: |
| Atlas concepts | 3,432 |
| Terminology entries | 0 |
| Vietnamese candidate entries | 0 |
| Searchable terminology entries | 0 |
| Source-verified entries | 0 |
| Medically reviewed entries | 0 |
| Release-eligible entries | 0 |
| Unresolved or unmapped concepts | 3,432 |

All computed terminology coverage percentages are 0%. This report does not claim a Vietnamese translation percentage; no production translation has been verified yet.

## Safety confirmations

- English remains the fallback for missing or unverified medical data.
- No unverified Vietnamese or Latin terms are searchable or shown as medical names.
- Language persistence failure falls back safely to English without crashing.
- Language is not included in atlas loading or scene geometry dependencies.
- Stable system IDs and ordering remain unchanged.
- Selection and atlas identity are concept-ID based; language is presentation state only.
- The empty terminology registry is a valid first-class production state.
- WebMCP and visible UI use the same source-aware naming/search policy.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | PASS |
| `node scripts/validate-atlas.mjs` | PASS |
| `node scripts/validate-interactions.mjs` | PASS |
| `npm run test:localization` | PASS |
| `npm run test:terminology` | PASS |
| `node scripts/validate-terminology.mjs` | PASS |
| `node scripts/validate-terminology.mjs --human` | PASS |
| `node scripts/validate-terminology.mjs --json` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS; only expected LF-to-CRLF normalization warnings were emitted |
| Live browser/accessibility smoke | PASS for the available narrow viewport; see UI smoke status above |

The Vite build emitted its existing large-chunk warning for the main JavaScript bundle. It did not fail the build and is not a bilingual correctness blocker.

## Blockers and next task

- V1 blockers: none.
- Deployment: not performed by request.
- M03 terminology expansion: intentionally deferred and not started.

Exact next task: **deployment validation/Vercel deployment, not terminology expansion**.
