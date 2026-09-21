# Anatomical Terminology Policy

## Governing rule

Anatomical terminology is evidence-backed data. A plausible, fluent, machine-generated, or merely present label is never production-ready by itself. The production overlay is keyed by the opaque `Atlas Concept.id`. An FMA-like spelling is not an FMA assertion, and names must not be used to infer equivalence.

## Identity and mapping

`Concept.elements` describes packaged rendering membership. It does not prove synonymy, hierarchy, or ontology equivalence. An entry may contain zero, one, or many independently evidenced external mappings. Each mapping records its namespace, identifier, source revision, relation, disposition, evidence claim IDs, and notes.

Supported relations include `exact`, `equivalent`, `target-broader`, `target-narrower`, `overlapping`, `related`, `composite`, `collective`, and `obsolete-replaced`. `UNMAPPED` entries also record `NOT_INVESTIGATED`, `UNRESOLVED`, or `CONFIRMED_NO_EQUIVALENT`; no FMA or TA2 mapping is invented to fill a null.

The relation between an atlas concept and a mesh is validated against that concept’s own `elements` list. A concept containing several meshes has one terminology entry, but a shared mesh or aggregate concept does not establish ontology equivalence. Composite, broader, narrower, obsolete, and source-specific relationships remain explicit and reviewable.

## Claim-level contract

Every evidence-bearing assertion is a claim with a stable ID, type, exact target, source ID, source revision, structured locator, evidence disposition, and claim review state. Claim types distinguish atlas identity, Atlas↔FMA, Atlas/FMA↔TA2, canonical Latin, each Latin alias, English aliases, Vietnamese preferred wording, each Vietnamese alias, search aliases, and secondary corroboration.

Candidate-generation history is stored separately and cannot become authority. A verified source record does not verify every claim that cites it. A generic source URL cannot substitute for an exact page, section, table, entry, or nomenclature locator when one is reasonably expected.

## Independent workflow dimensions

`mapping.status` describes identity resolution (`UNMAPPED`, `MAPPED`, `REJECTED`) and `mapping.disposition` records why an external mapping is absent. `review.status` is a workflow hint (`DRAFT`, `SOURCE_VERIFIED`, `MEDICAL_REVIEWED`, `VERIFIED`, or `RELEASE_ELIGIBLE`) retained for compatibility. Effective release eligibility is derived from current mapping, claims, conflicts, source audits, reviewer audits, and revision fingerprints; a stored `VERIFIED` string is never trusted on its own.

An effective Vietnamese release requires an exact/equivalent or explicitly reviewed composite/collective mapping, or a current sourced atlas identity with a confirmed absence of external equivalent; an approved Vietnamese preferred claim; current source verification; current qualified human medical review; no unresolved conflict; and current non-machine evidence. Broader, narrower, overlapping, related, and obsolete mappings do not silently release as exact terms.

## Revision-bound review

`computeTerminologyRevision` hashes all medically meaningful entry content while excluding mutable review metadata. It changes when mappings, Latin, Vietnamese forms, claims, source revisions, aliases, mesh membership, or scope changes. Every passed source, medical, and release audit records the exact entry revision and reviewed claim IDs. A mismatch is stale and fails closed. Approval and conflict records are retained rather than silently mutated.

Medical review requires a registered active reviewer ID, qualification and role metadata, authorization covering the reviewed claims, timestamp, decision, and current entry revision. `automated: false` or a free-text reviewer name is not proof of human review. Automation may calculate release checks but may never issue medical approval.

## Preferred terms and search

Preferred is the only canonical display field. Alias, Latin, external-identifier, and Vietnamese search forms enter production search only when their individual claims pass the appropriate evidence gate. Original `Concept.name` and `Concept.id` always remain searchable. ASCII/no-diacritic forms are matching-only values and can never become display terms.

Normalized collisions among released forms block release unless an authorized medical reviewer records an explicit, current ambiguity decision and its permitted scope. A draft occurrence cannot downgrade a collision between two released concepts.

## Release and migration

The static registry uses schema version 2 in `data/terminology/entries.json` and `sources.json`, with a separate reviewer registry and `data/terminology/release.json` manifest. A released manifest binds atlas version/revision, registry, source and reviewer revisions, policy version, content hash, and every released entry revision. The current manifest is `UNRELEASED` and the production entries and sources remain empty.

No real Vietnamese terminology, FMA/TA2 mapping, Latin, source bibliography, or pilot entry is part of M02B.
