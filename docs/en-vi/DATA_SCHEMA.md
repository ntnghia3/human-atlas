# Anatomy and Terminology Data Schema

## Current atlas manifest

The runtime loads public/models/atlas.json. The baseline manifest reports:

- version: BodyParts3D 4.0;
- sex: male;
- source: BodyParts3D;
- scope: Adult male reference anatomy · 2,234 source meshes;
- parts: 2,234;
- concepts: 3,432;
- chunks: 15;
- triangles: 2,288,268.

The manifest also contains sourceTriangles, optimized, and compressed chunk metadata. These fields are consumed or validated by the existing scripts even where the narrow TypeScript Atlas interface omits them.

## Current identity and relationship model

| Record | Actual fields | Stable meaning |
| --- | --- | --- |
| Part | id, name, conceptId, system, chunk, positions, normals, indices, vertexCount, indexCount, bounds | id is a selectable BodyParts3D mesh ID such as FJ1252. conceptId points to the named concept that includes the mesh. |
| Concept | id, name, elements | id is the named concept identity, currently FMA-like such as FMA3710. elements is a list of Part.id values and may contain more than one mesh. |
| Chunk | url, bytes, optional gzip, optional gzipBytes | Packed binary geometry location and expected uncompressed size. |
| System | id, name, color, description in app/anatomy.ts | Curated display grouping; system membership is on each Part. |

The current runtime has no explicit parent, child, or hierarchy edge. The source conversion pipeline has already joined concept and element relationships into Concept.elements. Do not infer a new hierarchy from names during localization.

## Terminology registry and runtime overlay

M02A separates static registry storage from the runtime overlay. The storage documents are:

    data/terminology/sources.json
    { "schemaVersion": 1, "sources": [TerminologySourceRecord] }

    data/terminology/entries.json
    { "schemaVersion": 1, "entries": [{ "key": Concept.id, ...TerminologyEntry }] }

The implemented TypeScript shape is intentionally metadata-only:

    TerminologyEntry {
      conceptId: string
      sourceIds: {
        bodyParts3d?: {
          ids: readonly string[]
          scope: packaged-mesh | external
        }
        fma?: string
        ta2?: string
      }
      english: {
        preferred: string
        aliases: readonly string[]
      }
      latin?: {
        preferred?: string
        aliases?: readonly string[]
      }
      vietnamese?: {
        preferred?: string
        aliases?: readonly string[]
        searchAliases?: readonly string[]
        asciiSearchForms?: readonly string[]
      }
      provenance: readonly TerminologyProvenance[]
      mapping: { status: UNMAPPED | MAPPED | REJECTED, notes? }
      review: {
        status: UNMAPPED | DRAFT | SOURCE_VERIFIED |
                MEDICAL_REVIEWED | VERIFIED | REJECTED
        sourceVerification?: ReviewAudit
        medicalReview?: ReviewAudit
        releaseEligibility?: ReviewAudit
        notes?
      }
    }

    TerminologySourceRecord {
      id, class, title, capabilities, audit, optional bibliographic metadata
    }

    ReviewAudit {
      type: source-verification | medical-review | release-eligibility
      status: PENDING | PASSED | REJECTED
      reviewer?, reviewedAt?, notes?, automated?
    }

    TerminologyProvenanceLocator {
      page?, chapter?, section?, table?, entryId?, url?, nomenclatureId?
    }

TERMINOLOGY_OVERLAY is a read-only map keyed by conceptId. TERMINOLOGY_SOURCES is a separate read-only map keyed by source ID. Both remain empty in M02A; the JSON registry is validated but is not yet wired into display or search.

The English field is a source snapshot for comparison and search. It is not permission to rename the atlas concept. The resolver always preserves Atlas.concepts.name for English and as the Vietnamese fallback.

## Overlay invariants

- Every entry key equals entry.conceptId.
- Every entry conceptId exists in the current atlas before release.
- Every source mesh ID in sourceIds.bodyParts3d is known or explicitly reviewed as an external source identifier.
- If a concept maps to multiple meshes, it has one terminology entry, not one per mesh.
- Preferred fields are distinct from aliases.
- ASCII search forms are not canonical display values.
- Provenance source IDs resolve in the source catalog.
- A VERIFIED Vietnamese entry has a Vietnamese-authoritative source.
- Machine-generated sources cannot be the only evidence for a VERIFIED entry.
- FMA and TA2 identifiers require a mapped entry and a matching `nomenclatureId` locator from an `anatomical-identity` source.
- A VERIFIED entry requires passed source-verification, human medical-review, and release-eligibility audits.
- A release-eligible Vietnamese entry requires verified source records, a `vietnamese-preferred` capability, and reproducible provenance locators.
- A rejected or unknown entry cannot be returned by the Vietnamese resolver.

## Search fields

The small linear matcher may search:

1. Atlas Concept.name and Concept.id;
2. reviewed English aliases;
3. mapped Latin preferred and aliases;
4. source identifiers;
5. Vietnamese preferred, aliases, search aliases, and ASCII forms only after the Vietnamese release gate.

The matcher normalizes input for comparison but stores and displays canonical terms unchanged.

## Upstream comparison schema

Before accepting a new atlas manifest, compare:

- concept ID set;
- mesh ID set;
- concept-to-mesh element sets;
- English names;
- source and system fields;
- chunk references and geometry counts.

Classify each concept as added, removed, renamed, remapped, or unchanged. Preserve overlay entries for unchanged IDs, review renamed or remapped IDs, and flag removed IDs as orphans. Never edit an overlay by position or array order.
