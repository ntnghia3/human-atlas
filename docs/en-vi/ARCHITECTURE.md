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

All ordinary interactive UI copy is routed through semantic keys: search, panel headings, presets, hide/show/reset actions, explosion and camera controls, loading/error states, source-link labels, detail-panel labels, and related accessibility labels. Medically meaningful preset labels such as Skeleton and Organs remain English in Vietnamese mode while the production terminology registry is empty; they are not Vietnamese terminology entries. Anatomical system names and descriptions, structure explanations, source-scope prose, and attribution prose remain English unless controlled terminology or approved medical localization exists; these are explicitly deferred content surfaces.

The dictionary is not a terminology database. It must not acquire entries of the form concept name → Vietnamese anatomical term.

## Layer B: anatomical terminology

app/terminology.ts defines the separate overlay contract:

- TerminologyEntry.conceptId is the stable runtime concept key;
- sourceIds can carry BodyParts3D element IDs, FMA, and TA2 identifiers;
- english stores the source-name snapshot and aliases;
- latin stores mapped canonical Latin and aliases;
- vietnamese stores preferred, aliases, search aliases, and matching-only ASCII forms;
- provenance stores stable source references and structured page/section/entry/URL/nomenclature locators validated by the M02A registry checker;
- mapping and review carry explicit statuses.

TERMINOLOGY_OVERLAY and TERMINOLOGY_SOURCES are loaded from the static M02A JSON registry. The production documents are intentionally empty today, so no Vietnamese anatomical term is displayed or searched. Future validated entries can flow through the same data boundary without renderer changes.

resolveConceptName takes a Concept, language, overlay, and source catalog. English always returns Concept.name. Vietnamese returns a preferred term only after the release gate. The overlay can enrich a concept but cannot rewrite its original English name or its identity.

The source catalog is separate from entries so source details are not repeated in every term. Future data should load a reviewed catalog and entries together, or validate them together before release.

## Current data model

The actual manifest has version, parts, chunks, triangles, concepts, sourceTriangles, optimized, sex, source, and scope fields. The runtime types in app/anatomy.ts model the fields consumed by the viewer:

| Runtime record | Current fields | Meaning |
| --- | --- | --- |
| Part | id, name, conceptId, system, chunk, positions, normals, indices, vertexCount, indexCount, bounds | One selectable BodyParts3D mesh and its packed binary ranges. |
| Concept | id, name, elements | One named FMA concept and the mesh IDs that render it. |
| Atlas | version, sex, source, scope, parts, concepts, chunks, triangles | The manifest and its geometry references. |
| System | id, name, color, description | The application’s curated display grouping and explanatory text. |

There is no parent pointer in the runtime Concept type. Concept-to-mesh membership is represented by Concept.elements. The current concept IDs are FMA-like values such as FMA3710, while mesh IDs are BodyParts3D element values such as FJ1252.

## Search architecture

The existing UI search is a useMemo over all concepts, limited to 80 results. It previously matched lowercased English names and concept IDs. It now calls matchesTerminologyQuery, which keeps the same linear behavior and adds a future-safe term surface without adding a persisted index.

The normalizer in app/search-normalization.ts performs Unicode decomposition, removes combining marks, maps đ/Đ to d, folds case, collapses whitespace, and trims. It is used only for matching. It must never produce a stored or displayed canonical Vietnamese term.

The optional WebMCP find_anatomy tool in app/agent-tools.ts uses the same matcher, runtime overlay, source catalog, release gate, and result limit as the visible application. Its stable tool name, input shape, and concept IDs remain unchanged.

## Model lifecycle and performance

The language state is in page.tsx, while the geometry-loading effect in scene.tsx depends on atlas only. Localized canvas accessibility text and resolver callbacks are held in refs so a language switch re-renders labels without reloading the manifest or binary chunks, disposing/recreating WebGL objects, changing picker meshes, or duplicating geometry.

Terminology data is small metadata bundled from the JSON registry and separate from the 33 MB compressed geometry path. It is not consulted by the render loop, GPU textures, picking, explosion layout, or camera fitting. Search remains a scan until measurement justifies indexing.

## Upstream compatibility

An upstream update is compared by stable concept IDs and mesh IDs:

- added concept or mesh;
- removed concept or mesh;
- changed English name;
- changed source mapping;
- unchanged identity.

The upstream atlas is regenerated independently. The terminology overlay is then validated against the new concept set. Entries for removed IDs become orphan findings; renamed English names become review findings; unchanged IDs retain their reviewed overlay entries. No upstream synchronization step writes Vietnamese data into atlas.json.

## Deployment

The app remains static and client-side. vercel.json continues to use framework vite, installCommand npm ci, buildCommand npm run build, and outputDirectory dist. No server, database, secret, or runtime environment variable is needed for this foundation.
