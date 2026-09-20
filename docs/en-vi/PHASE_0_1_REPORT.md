# Phase 0/1 English–Vietnamese Foundation Report

## Result

PASS for the requested audit, governance documentation, and minimum low-risk foundation. The anatomy dataset was not translated or rewritten.

Baseline commit: 1c38bf35c254a891200d3cedecfd57abebe83d8d.

## 1. Repository architecture discovered

This is a static Vite application. web/main.tsx mounts app/page.tsx. page.tsx fetches the atlas manifest and owns viewer state. scene.tsx creates and updates the Three.js viewer. app/anatomy.ts defines runtime atlas, concept, part, system, and scene types. Geometry is packaged in public/models as atlas.json plus 15 raw/gzip binary chunks.

## 2. Relevant files and roles

| File | Role |
| --- | --- |
| web/index.html | Static shell, initial language, metadata, title, favicon. |
| web/main.tsx | React entry point and global CSS import. |
| app/page.tsx | Atlas fetch, UI state, search, selection, detail panel, systems, controls, and language state. |
| app/anatomy.ts | System definitions, Atlas/Part/Concept types, defaults, English explanations. |
| app/scene.tsx | Three.js renderer, chunk loading, GPU state textures, picking, explosion/isolation camera behavior. |
| app/model-download.ts | Response validation and optional gzip decoding. |
| app/explosion-layout.ts | Non-overlapping exploded inventory layout. |
| app/pointer-tap.ts | Tap versus drag, multitouch, and cancellation distinction. |
| app/agent-tools.ts | Optional WebMCP search and inspection tools. |
| public/models/atlas.json | Source manifest with 2,234 parts and 3,432 concepts. |
| scripts/convert-anatomy.py | Official source OBJ and metadata conversion. |
| scripts/optimize-anatomy.mjs | Per-mesh simplification and packed chunk regeneration. |
| scripts/compress-models.mjs | Gzip asset generation and manifest update. |
| scripts/validate-atlas.mjs | Geometry, identifiers, buffers, concept membership, and triangle validation. |
| scripts/validate-interactions.mjs | Layout, search/inspection, and pointer behavior validation. |
| public/ATTRIBUTION.md | BodyParts3D attribution, source links, license, and adaptation history. |
| vite.config.ts / vercel.json | Static Vite and Vercel build configuration. |

## 3. Anatomy-data flow

The manifest is fetched once by page.tsx. scene.tsx fetches binary chunks, validates their expected byte counts, creates views over packed geometry, merges geometry by system, and renders with per-part GPU state. Selection remains keyed by Part.id and Concept.elements. Language state is not part of this flow.

## 4. Concept/mesh identity model

Part.id is the stable BodyParts3D mesh identifier, currently FJ-like. Concept.id is the stable named concept identifier, currently FMA-like. Concept.elements is the many-mesh membership list. One terminology entry is keyed by Concept.id and can resolve all member meshes without duplicating terminology.

## 5. Current search architecture

The UI performs a linear scan over 3,432 concepts, with eight default results and an 80-result cap. The existing WebMCP tool scans the same concepts and returns stable IDs. The foundation adds normalized matching and an optional overlay-derived term surface without persisting a duplicate index.

## 6. Current build/deploy architecture

Vite uses web as root, public as publicDir, and dist as output. Vercel runs npm ci and npm run build. The application is client-side and has no backend or secrets. The existing large post-minification chunk warning remains.

## 7. Files created

- docs/en-vi/MASTER_SPEC.md
- docs/en-vi/ARCHITECTURE.md
- docs/en-vi/TERMINOLOGY_POLICY.md
- docs/en-vi/SOURCE_POLICY.md
- docs/en-vi/DATA_SCHEMA.md
- docs/en-vi/QA_STRATEGY.md
- docs/en-vi/IMPLEMENTATION_ROADMAP.md
- docs/en-vi/BASELINE_AUDIT.md
- docs/en-vi/PHASE_0_1_REPORT.md
- app/localization.ts
- app/search-normalization.ts
- app/terminology.ts
- scripts/validate-localization.mjs

## 8. Files modified

- app/page.tsx
- app/agent-tools.ts
- app/globals.css
- package.json
- README.md
- tsconfig.json

public/models/atlas.json, all binary geometry, concept IDs, mesh IDs, and original English anatomy names were not modified.

## 9. Architectural decisions made

- Keep UI localization and anatomical terminology as separate layers.
- Use semantic UI keys and a small local dictionary instead of adding a large i18n dependency.
- Persist only the selected language and update document lang.
- Keep language outside the AnatomyScene effect and render loop.
- Key terminology by stable Concept.id, not mesh ID or display text.
- Require MAPPED plus VERIFIED plus registered authoritative Vietnamese provenance before Vietnamese display.
- Keep no-diacritic normalization matching-only.
- Keep search linear and overlay-derived until measurement justifies indexing.
- Preserve original English Atlas names as the resolver fallback and source of truth.
- Preserve WebMCP tool names, schemas, identifiers, and behavior.

## 10. Architectural decisions deliberately deferred

- No Vietnamese anatomical dataset or pilot terms.
- No source bibliography records populated.
- No complete UI-string migration.
- No localized system descriptions or clinical/anatomical explanatory prose.
- No production Latin mappings.
- No bulk search index.
- No backend, database, or deployment.
- No upstream synchronization automation.

## 11. Commands run and results

| Command | Result |
| --- | --- |
| npm ci | Initial attempt failed with EPERM while stat-ing a user npm-cache entry before source changes. |
| npm ci --cache .npm-cache --prefer-offline | PASS; 565 packages installed; npm reported cleanup warning and 11 audit findings. |
| npm run check | PASS after dependencies were restored. |
| node scripts/validate-atlas.mjs | PASS; 2,234 meshes, 3,432 concepts, 2,288,268 triangles, all binary buffers. |
| node scripts/validate-interactions.mjs | PASS; layout, search/inspection, tap/drag/multitouch/cancel checks. |
| npm run test:localization | PASS; language, fallback, normalization, source-backed release gate. |
| npm run build | PASS; Vite production build generated dist. |
| git diff --stat | Recorded below after the final source/documentation changes. |

The initial post-failure check/build attempts reported missing tsc/vite binaries because the failed clean install had removed the local tool links. They pass after the repository-local-cache install.

## 12. Tests added

scripts/validate-localization.mjs tests:

- safe language persistence and invalid-value fallback;
- English/Vietnamese UI message lookup and interpolation;
- Vietnamese diacritic/no-diacritic matching;
- English fallback for an empty overlay;
- draft and machine-only provenance rejection;
- source-catalog-backed VERIFIED Vietnamese display;
- Latin and verified Vietnamese search matching;
- English behavior remaining unchanged.

## 13. Known risks

- The current UI still contains deliberately deferred English strings.
- No real Vietnamese anatomical term has yet undergone medical review.
- The resolver defaults to an empty source catalog, so future catalog data must be wired and validated together.
- The build retains the existing large JavaScript chunk warning.
- npm reported 11 dependency audit findings; dependency remediation is outside this task.
- Physical-device performance and real multitouch hardware remain untested, as documented upstream.

## 14. Upstream compatibility considerations

The overlay is additive and keyed by Concept.id. Upstream atlas changes must be classified as added, removed, renamed, remapped, or unchanged before terminology entries are reused. Removed IDs become orphan findings, changed English names require review, and geometry remains independently regenerable. No upstream update should overwrite the terminology layer or require editing geometry for localization.

## 15. Next recommended milestone

Create and validate a source registry, then produce a small medically reviewed terminology pilot for explicitly selected existing concepts. Do not bulk translate the atlas or start the next milestone automatically.

## Final diff stat

The command git diff --stat reports tracked modifications as follows. The files listed under Created files above are still untracked in this shared worktree, so Git's default diff stat does not include them until they are staged.

    README.md          |  1 +
    app/agent-tools.ts |  5 +++--
    app/globals.css    |  2 ++
    app/page.tsx       | 36 ++++++++++++++++++++----------------
    package.json       |  3 ++-
    tsconfig.json      |  1 +
    6 files changed, 29 insertions(+), 19 deletions(-)
