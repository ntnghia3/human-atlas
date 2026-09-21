# English–Vietnamese QA Strategy

## Regression commands

The release baseline remains:

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

The production registry validator reads the atlas, source catalog, entry registry, reviewer registry, and release manifest together. It never generates, translates, rewrites, deletes, or auto-corrects terminology.

## Blocking terminology checks

The validator blocks:

- orphan entry keys, duplicate keys, and English snapshot identity drift requiring review;
- unknown or wrongly attributed mesh membership;
- FMA-like IDs used without independent claims;
- invalid mapping cardinality, relation, disposition, namespace evidence, or source revision;
- missing claim evidence, generic-only locators, source revision mismatch, machine-only authority, and unsupported claims;
- missing or stale audit revisions, unregistered/inactive/unauthorized reviewers, automated medical review, and incomplete current decisions;
- open source conflicts and invalid adjudication;
- stale release manifests and released entries not bound to current revisions;
- unapproved semantic search forms and released normalized collisions;
- invalid ASCII display/search fields, broken aliases, fallback failures, and changed atlas/mesh IDs.

Semantic direction and category heuristics remain review prompts. They may flag likely inversions or artery/vein, nerve/ligament, and branch/trunk mistakes, but they never auto-correct or declare anatomical correctness.

## Search and resolver gates

`Concept.name` and `Concept.id` are always searchable. English aliases, atlas mesh identifiers, FMA/TA2 identifiers, Latin forms, Vietnamese preferred terms, aliases, search aliases, and ASCII forms enter the production search surface only when their individual claims pass the appropriate evidence gate. Draft, rejected, unresolved, stale, or machine-derived forms must not affect discovery.

Vietnamese display requires the current derived release gate. It checks an acceptable identity disposition, claim-level preferred evidence, current source verification, current qualified human medical review, resolved conflicts, and verified non-machine sources. A stored `VERIFIED` value is insufficient.

## Coverage and dispositions

The validator reports separate counts using the 3,432-concept atlas denominator:

- candidate coverage;
- searchable coverage;
- source-verified coverage;
- medically-reviewed coverage;
- release coverage;
- mapping investigated, mapping unresolved, and confirmed no external equivalent;
- source gaps, stale approvals, and conflicts awaiting adjudication.

Meshes, aliases, English fallback, and machine candidates never count as Vietnamese release coverage. No single translation percentage is emitted.

## Synthetic governance suite

`npm run test:terminology` uses unmistakable `TEST_ONLY` fixtures and covers FMA-like opaque IDs, zero/multiple mappings, broader/narrower relationships, confirmed no TA2 equivalent, wrong `Concept.elements` membership, missing/generic evidence, unapproved aliases and identifiers, machine origins, unregistered and unauthorized reviewers, stale entry/alias/source revisions, current human review, open and adjudicated conflicts, released collision plus draft collision, explicit homonym handling, derived release gating, and coverage dispositions.

## Human review

Before a terminology release, a qualified authorized reviewer inspects every changed identity claim, mapping relation, source locator, preferred form, aliases, scope, directional meaning, conflicts, and neighboring structures. Structural validation and automated release checks are necessary but are not medical review. Every approval is tied to the current entry revision and claim scope.
