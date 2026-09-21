# Terminology Sources and Provenance Policy

## Purpose

The project must explain the evidence for every production assertion without copying copyrighted textbook passages. Source metadata is stored separately from entries, with stable source IDs and explicit revisions. An authoritative source is not blanket evidence for every claim that cites it.

## Source classes and capabilities

| Source class | Intended use | Authority boundary |
| --- | --- | --- |
| `international-nomenclature` | Anatomical identity, FMA/TA2/nomenclature evidence, and canonical Latin. | Identity or Latin only where the cited claim and locator support it. |
| `vietnamese-authoritative` | Vietnamese medical or anatomical wording. | Vietnamese preferred claims only where the cited passage supports them. |
| `secondary-reference` | Corroboration and review context. | Never sufficient alone for a preferred production term. |
| `machine-generated` | Candidate discovery. | Never identity, terminology, medical, or release authority. |

Capabilities are explicit: `anatomical-identity`, `canonical-latin`, `vietnamese-preferred`, `secondary-corroboration`, and `machine-candidate-discovery`. Each source record includes a stable `revision`, an audit status, and verifier metadata. Non-machine sources cannot advertise machine discovery; machine sources can advertise only candidate discovery.

## Claim evidence

Every claim records `sourceId`, the exact `sourceRevision`, and a structured locator. Supported locators are page, chapter, section, table, entry ID, URL, and nomenclature ID. A generic URL alone is not an exact locator for a release claim. The validator requires the cited source revision to match the source catalog and rejects missing or unverifiable sources.

Claim evidence dispositions (`CANDIDATE`, `SUPPORTED`, `REJECTED`, `SUPERSEDED`) and claim review states (`PENDING`, `VERIFIED`, `REJECTED`) are independent. Machine candidate history remains visible as origin metadata but can never satisfy a supported claim.

## Source conflicts

Conflicts are explicit entry records. They support identity disagreement, granularity disagreement, contextual difference, edition/version difference, and competing preferred terminology. A conflict records affected claim IDs, status, decision, rationale, permitted aliases or ambiguity scope, reviewer, resolution date, and entry revision.

No conflict is resolved automatically by majority, recency, source count, or lexical similarity. An unresolved substantive conflict blocks release. An adjudicated conflict must be current and recorded by an active authorized medical reviewer.

## Review and release

Source verification and medical review are separate audits. Medical review requires a reviewer registry record with stable ID, role, qualifications, authorization scope, timestamp, decision, reviewed claim IDs, and the current entry revision. Automation can calculate structural and release checks but cannot issue medical review.

`data/terminology/reviewers.json` is a Git-reviewable registry and is intentionally empty in M02B. The release manifest binds the atlas, registry, source catalog, reviewer catalog, policy version, content hash, and entry revisions. A stale source, medical, conflict, or release record fails closed.

## Candidate workflow

1. Treat the atlas `Concept.id` as an opaque key and establish any external identity with a claim.
2. Record the source revision and exact locator for each claim.
3. Store candidates as `DRAFT`/`UNMAPPED` with candidate origin metadata.
4. Record conflicts instead of silently selecting a preferred source.
5. Obtain qualified human review for the current entry revision.
6. Let the derived release gate decide eligibility; never edit a release flag to bypass dependencies.
7. Keep unresolved, rejected, obsolete, and confirmed-no-equivalent dispositions explicit.

The current production source and entry registries are empty. No real Vietnamese source records or terminology were added in M02B.
