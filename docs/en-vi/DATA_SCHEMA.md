# Anatomy and Terminology Data Schema

## Current atlas identity

`public/models/atlas.json` is the BodyParts3D 4.0 adult-male reference atlas with 2,234 parts and 3,432 concepts. `Concept.id` is an opaque stable atlas identity. Values that resemble FMA identifiers remain atlas keys until an independently evidenced mapping claim verifies an FMA identity.

`Concept.elements` is the packaged rendering membership list. It may contain several mesh IDs and can include aggregate/collective coverage. It does not prove hierarchy, synonymy, or external ontology equivalence. No localization process infers parent/child relationships from names.

## Registry documents

The static registry is Git-reviewable and remains separate from geometry:

```text
data/terminology/sources.json    { schemaVersion: 2, sources: TerminologySourceRecord[] }
data/terminology/entries.json    { schemaVersion: 2, entries: EntryRegistryRecord[] }
data/terminology/reviewers.json  { schemaVersion: 1, reviewers: TerminologyReviewerRecord[] }
data/terminology/release.json    TerminologyReleaseManifest
```

Production documents are intentionally empty in M02B.

## Entry shape

```text
EntryRegistryRecord {
  key: Concept.id
  conceptId: Concept.id
  atlas?: { meshIds: string[], scope: packaged-mesh | external }
  english: { preferred: string, aliases: string[] }
  latin?: { preferred?: string, aliases?: string[] }
  vietnamese?: { preferred?: string, aliases?: string[], searchAliases?: string[], asciiSearchForms?: string[] }
  scope?: { qualifiers?: string[], notes?: string }
  mapping: {
    status: UNMAPPED | MAPPED | REJECTED
    disposition?: NOT_INVESTIGATED | UNRESOLVED | CONFIRMED_NO_EQUIVALENT
    mappings: ExternalMapping[]
  }
  claims: TerminologyClaim[]
  candidateOrigins?: CandidateOrigin[]
  conflicts?: TerminologyConflict[]
  review: ReviewWorkflow
}
```

`ExternalMapping` records `id`, namespace, identifier, source revision, relation (`exact`, `equivalent`, `target-broader`, `target-narrower`, `overlapping`, `related`, `composite`, `collective`, or `obsolete-replaced`), disposition, evidence claim IDs, and notes. Zero, one, or many mappings are valid. A missing TA2 equivalent is represented explicitly rather than fabricated.

`TerminologyClaim` records a stable claim ID, claim type, exact target/value, source ID, source revision, structured locator, evidence disposition, and claim review state. Claim types distinguish atlas identity, Atlas↔FMA and Atlas/FMA↔TA2 mappings, canonical Latin, each alias class, Vietnamese preferred wording, search aliases, and secondary corroboration. A claim is not verified merely because its source is authoritative.

## Review and revision

`ReviewWorkflow.status` retains `DRAFT`, `SOURCE_VERIFIED`, `MEDICAL_REVIEWED`, `VERIFIED`, and `RELEASE_ELIGIBLE` as workflow hints. Effective release is derived. Passed audits record type, decision, reviewer ID where human review is required, timestamp, reviewed claim IDs, and `entryRevision`. The reviewer registry supplies stable identity, role, qualifications, status, and authorization scope.

`computeTerminologyRevision` hashes all medically meaningful entry content, excluding review records and the self-referential conflict revision field. It includes mappings, claims, source revisions, aliases, Latin/Vietnamese fields, atlas membership, and scope. Any content change makes prior approvals stale.

## Overlay invariants

- Entry key equals `conceptId`, and the concept exists in the current atlas.
- Atlas mesh IDs are validated against that concept’s own `elements` list; global mesh existence is insufficient.
- External mappings are independent claims; FMA-like strings never self-verify.
- Mapping status and review status are separate dimensions.
- Claims with missing, machine-only, mismatched, or generic evidence cannot be supported.
- Registered active reviewers and current entry revisions are required for medical review.
- Open conflicts block release; adjudication is current, explicit, and human-authorized.
- Preferred fields are canonical display values; aliases and ASCII forms are search inputs only.
- External IDs and terminology forms enter search only through their individual approved claims.
- Stored `VERIFIED`/`RELEASE_ELIGIBLE` strings cannot bypass the derived gate.
- Rejected, stale, unresolved, or unapproved values do not display or search as production terminology.

## Release manifest

A `RELEASED` manifest binds atlas version/revision, terminology registry revision, source catalog revision, reviewer catalog revision, policy version, content hash, and every released entry revision. The M02B manifest is `UNRELEASED` with no entry revisions.

## Upstream comparison

Compare concept IDs, mesh IDs, concept-to-mesh element sets, English names, source/system fields, chunk references, and geometry counts. Classify additions, removals, renames, remaps, and unchanged identities. Any source mapping, membership, or semantic change invalidates affected approvals even if the atlas ID is unchanged.
