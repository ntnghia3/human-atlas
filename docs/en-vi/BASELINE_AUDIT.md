# Phase 0 Repository Baseline Audit

## Baseline identity

- Repository: fork of ashemag/human-atlas.
- Commit: 1c38bf35c254a891200d3cedecfd57abebe83d8d.
- Branch at audit: feature/en-vi-foundation.
- Initial worktree status: clean.
- Current packaged atlas: BodyParts3D 4.0, adult male reference anatomy.

The baseline atlas contains 2,234 parts, 3,432 concepts, 15 chunks, and 2,288,268 triangles. The existing atlas validator confirmed every binary buffer and concept membership.

## Entry points and build

web/index.html is the static document shell. It starts with lang en, the Human Atlas title, a description, viewport metadata, and favicon.

web/main.tsx creates the React root, imports app/page.tsx, and imports app/globals.css.

vite.config.ts sets web as root, public as publicDir, dist as outDir, React and Tailwind PostCSS plugins, the @ alias, polling watch mode, and Vite build behavior.

package.json identifies the private anatomy-studio package, requires Node 22.13 or newer, and defines dev, build, build:vercel, check, and the Phase 0/1 localization test command.

vercel.json uses framework vite, npm ci for installation, npm run build, and dist output. There is no backend or runtime secret.

## Anatomy data flow

1. page.tsx fetches /models/atlas.json.
2. The manifest is typed as Atlas and passed to AnatomyScene.
3. scene.tsx selects gzip chunks when the browser provides DecompressionStream, fetches up to three chunks concurrently, checks expected uncompressed size, and decodes the packed ranges.
4. Each Part creates a geometry view over positions, normals, and indices. A picker mesh is retained for accurate selection.
5. Geometry is merged by system for rendering. A partIndex attribute and GPU state textures control visibility, translation, and selection without separate draw calls per mesh.
6. Three.js rendering, camera fitting, explosion layout, picking, and touch handling remain in scene.tsx, explosion-layout.ts, and pointer-tap.ts.

## Identity model

Part.id is the source mesh identity, with current values such as FJ1252. Part.conceptId points to the named concept. Concept.id is the stable named concept identity, with current values such as FMA3710. Concept.elements is the mesh membership list and may contain multiple Part IDs.

The runtime has no explicit parent/child hierarchy field. The conversion pipeline scripts/convert-anatomy.py takes official OBJ meshes, concept metadata, and system mapping; scripts/optimize-anatomy.mjs simplifies while preserving named meshes; scripts/compress-models.mjs creates gzip assets.

No geometry, ID, or atlas name was modified for localization.

## Search and detail panel

The UI search in page.tsx scans concepts, offers eight default major-organ results, matches up to 80 results, and previously matched lowercased English names and IDs. The foundation keeps the same bounded linear behavior through matchesTerminologyQuery and adds an empty-overlay path for future Latin, verified Vietnamese, aliases, and normalized input.

The selected concept is stored separately from selected mesh IDs. Choosing a concept selects all Concept.elements. Picking a mesh creates a one-element Concept-shaped selection from Part.conceptId. The detail sheet shows the concept name, system, explanation, source ID, selected piece count, member list, source link, isolation action, and clear selection.

## Systems and UI strings

SystemId and SYSTEMS are defined in app/anatomy.ts. The atlas provides 15 system values. DEFAULT_VISIBLE omits integumentary by default. SYSTEMS also contains English names, colors, and general descriptions.

Before this phase, most UI copy was hard-coded in page.tsx, with additional viewer accessibility/error text in scene.tsx and WebMCP descriptions/errors in agent-tools.ts. The static document strings are in web/index.html. The foundation migrates only representative ordinary controls and leaves anatomical system metadata, detail prose, camera prose, and attribution prose as explicit future work.

## WebMCP and external integration

app/agent-tools.ts conditionally uses document.modelContext.registerTool. find_anatomy is read-only and returns stable concept IDs, English names, and piece counts. inspect_anatomical_structure selects an existing concept. Registration is optional and failures are swallowed so the visible UI works without WebMCP.

The foundation preserves tool names, schemas, selection semantics, and IDs. The search implementation accepts an optional terminology overlay for future reviewed search without changing the tool contract.

## Attribution and licenses

Application code is MIT-licensed. BodyParts3D data is attributed in public/ATTRIBUTION.md under CC BY 4.0, including the source links, publication, and adaptation details. The current release represents all 2,234 source meshes and preserves the source identity in the manifest. These files are not rewritten by localization.

## Baseline commands and results

The exact npm ci command was attempted first and failed before source changes because npm could not stat a user-cache entry under C:\Users\HP\AppData\Local\npm-cache, returning EPERM. npm ci --cache .npm-cache --prefer-offline then installed 565 packages successfully, with an npm cleanup warning for a locked nested directory and an audit summary of 11 dependency findings. The local cache is a temporary audit artifact and is not part of the source change.

After dependencies were restored:

| Command | Result |
| --- | --- |
| npm run check | PASS |
| node scripts/validate-atlas.mjs | PASS — 2,234 meshes, 3,432 concepts, 2,288,268 triangles, all buffers |
| node scripts/validate-interactions.mjs | PASS — layout, search/inspection, tap/drag/multitouch/cancel |
| npm run build | PASS — Vite 8.0.13, 2,475 modules transformed, static dist generated; existing large-chunk warning remains |

The first npm run check and npm run build attempts, made immediately after the failed clean install, reported missing tsc/vite binaries. Those failures were dependency-install state failures, not source failures. They pass after the repository-local-cache install.

## Performance-sensitive areas

Do not pass language into the scene effect, remount AnatomyScene on language changes, duplicate geometry, add per-part localized meshes, or put terminology lookup in the animation loop. Keep resolver/search metadata outside WebGL state, picking, chunk loading, explosion packing, and camera fitting.

The existing build emits a large JavaScript chunk warning. It is pre-existing and unrelated to this foundation.
