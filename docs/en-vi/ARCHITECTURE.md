# English–Vietnamese Architecture

## Repository runtime discovered

The application is a Vite client rooted at web. web/main.tsx mounts app/page.tsx and imports app/globals.css. vite.config.ts sets web as the Vite root, public as the public directory, app-relative aliases through @, React as the plugin, and dist as the output directory.

app/page.tsx owns the React state for the atlas, panels, query, selected concept, visibility, explosion, camera view, isolation, and language. It fetches /models/atlas.json once on mount. app/scene.tsx receives the atlas and scene state, creates the Three.js scene, and has an effect keyed by atlas only.

The current model path is:

web/main.tsx → app/page.tsx → fetch /models/atlas.json → Atlas object → app/scene.tsx → fetch compressed or raw chunk → decodeModelResponse → per-part geometry and system-merged render geometry.

The scene uses a per-part state texture for visibility, translation, and selection; a separate picker mesh for accurate selection; three concurrent chunk loaders; and one merged render mesh per anatomical system. Language state must not enter this path.

## Layer A: UI localization

app/localization.ts defines:

- Language as the closed union en | vi;
- the default language en;
- semantic MessageKey values;
- English and Vietnamese UI message dictionaries with identical key coverage;
- safe localStorage read/write helpers;
- interpolation for small numeric UI messages.

app/page.tsx owns the language state, initializes it from storage, persists changes, and updates the document lang attribute. The switcher changes only this state. It does not change the atlas state, pass a language prop to AnatomyScene, change the atlas key, or remount the scene.

All ordinary interactive UI copy is routed through semantic keys: search, panel headings, presets, hide/show/reset actions, explosion and camera controls, loading/error states, source-link labels, detail-panel labels, and related accessibility labels. Medically meaningful preset labels such as Skeleton and Organs remain English in Vietnamese mode while the production terminology overlay is empty; M03C1 research candidates are not Vietnamese UI terminology entries. Anatomical system names and descriptions, structure explanations, source-scope prose, and attribution prose remain English unless controlled terminology or approved medical localization exists; these are explicitly deferred content surfaces.

The dictionary is not a terminology database. It must not acquire entries of the form concept name → Vietnamese anatomical term.

## Layer B: anatomical terminology

app/terminology.ts defines the separate overlay contract:

- TerminologyEntry.conceptId is an opaque stable atlas key;
- atlas membership is separate from ontology equivalence and is checked against the specific Concept.elements list;
- mapping.mappings supports zero, one, or many independently evidenced FMA/TA2 relationships with relation and disposition;
- claims attach exact evidence to identity, mappings, Latin, each alias, Vietnamese preferred wording, search aliases, and corroboration;
- source revisions, conflict adjudication, reviewer registry records, and revision-bound audits are release dependencies;
- English, Latin, and Vietnamese fields retain preferred and alias distinctions; ASCII forms remain matching-only.

TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES, TERMINOLOGY_REVIEWERS, and the release manifest are loaded from the static terminology registry. M03C1 source records describe real bibliographic identities and the registry holds 50 bounded non-release research entries, but the release overlay remains empty, so no Vietnamese anatomical term is displayed or searched. Future validated entries can flow through the same data boundary without renderer changes.

resolveConceptName takes a Concept, language, overlay, and source catalog. English always returns Concept.name. Vietnamese returns a preferred term only after the release gate. The overlay can enrich a concept but cannot rewrite its original English name or its identity.

The source and reviewer catalogs are separate from entries so authority metadata is not repeated in every term. Future data must load and validate the catalogs, entries, and release manifest together before release.

## Current data model

The actual manifest has version, parts, chunks, triangles, concepts, sourceTriangles, optimized, sex, source, and scope fields. The runtime types in app/anatomy.ts model the fields consumed by the viewer:

| Runtime record | Current fields | Meaning |
| --- | --- | --- |
| Part | id, name, conceptId, system, chunk, positions, normals, indices, vertexCount, indexCount, bounds | One selectable BodyParts3D mesh and its packed binary ranges. |
| Concept | id, name, elements | One opaque atlas concept key and the mesh IDs packaged for that concept; this is not an automatic FMA assertion. |
| Atlas | version, sex, source, scope, parts, concepts, chunks, triangles | The manifest and its geometry references. |
| System | id, name, color, description | The application’s curated display grouping and explanatory text. |

There is no parent pointer in the runtime Concept type. Concept-to-mesh membership is represented by Concept.elements. Current IDs may resemble FMA values, but external ontology identity is always a separately sourced relationship. Mesh membership does not prove synonymy, hierarchy, or equivalence.

## Search architecture

The existing UI search is a useMemo over all concepts, limited to 80 results. It previously matched lowercased English names and concept IDs. It now calls matchesTerminologyQuery, which keeps the same linear behavior and adds a future-safe term surface without adding a persisted index.

The normalizer in app/search-normalization.ts performs Unicode decomposition, removes combining marks, maps đ/Đ to d, folds case, collapses whitespace, and trims. It is used only for matching. It must never produce a stored or displayed canonical Vietnamese term.

The optional WebMCP find_anatomy tool in app/agent-tools.ts uses the same matcher, runtime overlay, source catalog, reviewer catalog, claim gates, and result limit as the visible application. Its stable tool name, input shape, and concept IDs remain unchanged.

## Model lifecycle and performance

The language state is in page.tsx, while the geometry-loading effect in scene.tsx depends on atlas only. Localized canvas accessibility text and resolver callbacks are held in refs so a language switch re-renders labels without reloading the manifest or binary chunks, disposing/recreating WebGL objects, changing picker meshes, or duplicating geometry.

Terminology data is small metadata bundled from the JSON registry and separate from the 33 MB compressed geometry path. It is not consulted by the render loop, GPU textures, picking, explosion layout, or camera fitting. Search remains a scan until measurement justifies indexing. Every overlay-derived form is claim-gated; released normalized collisions block unless explicit current ambiguity adjudication permits them.

## Upstream compatibility

An upstream update is compared by stable concept IDs and mesh IDs:

- added concept or mesh;
- removed concept or mesh;
- changed English name;
- changed source mapping;
- unchanged identity, with approvals retained only when all relevant content and source revisions remain unchanged.

The upstream atlas is regenerated independently. The terminology overlay is then validated against the new concept set. Entries for removed IDs become orphan findings; renamed English names, changed concept-to-mesh membership, and remapped identifiers invalidate dependent approvals; unchanged IDs retain an overlay only after revision and manifest checks pass. No upstream synchronization step writes Vietnamese data into atlas.json.

## Release governance boundary

`computeTerminologyRevision` deterministically fingerprints medically meaningful entry content while excluding mutable review metadata. Source, medical, and release audits point to the current revision and reviewed claims. Medical approval requires an active registered reviewer with authorization scope; automation never supplies it. `release.json` binds atlas, registry, source, reviewer, policy, content hash, and released entry revisions. M03C1 keeps the release overlay/search surface empty and the manifest `UNRELEASED`; only the bounded research queue is populated.

## M04A bulk evidence pipeline

The bulk research path is local and batch-oriented:

```text
JSON/JSONL source corpus
  → buildSourceIndex (one corpus read, deterministic indexes)
  → atlas concepts + index + source catalog + M03C1 metadata
  → bulk matcher (local exact/normalized identity joins, safety flags, mesh heuristics)
  → data/terminology/research/bulk-match-results.json
```

The corpus is evidence, not a translation table. Source identity, revision,
edition, locator, and raw wording survive indexing. Indexes cover exact and
normalized English, Latin preferred/aliases, Vietnamese terms, source codes,
terminology IDs, and category values. No per-concept web request is performed,
and the matcher never turns an FMA-like `Concept.id` into a mapping claim; an
ID can participate only when it is explicitly present in an indexed
`terminologyIds` field.

Results are research-only and use deterministic buckets for high-consensus
candidates, variants, conflicts, ontology scope, laterality, source/identity
gaps, and aggregate/composite review. Semantic detectors flag side,
directional, tissue-class, branch/trunk, and aggregate inconsistencies without
correcting them. Mesh count and overlap produce review heuristics only. The
frozen M03C records are compared as regression metadata, while
`entries.json`, the release manifest, reviewer registry, and runtime overlay
remain unchanged.

## Deployment

The app remains static and client-side. vercel.json continues to use framework vite, installCommand npm ci, buildCommand npm run build, and outputDirectory dist. No server, database, secret, or runtime environment variable is needed for this foundation.
