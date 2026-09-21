# Terminology Sources and Provenance Policy

## Purpose

The project must explain the evidence for every production assertion without copying copyrighted textbook passages. Source metadata is stored separately from entries, with stable source IDs and explicit revisions. An authoritative source is not blanket evidence for every claim that cites it.

## Source classes and capabilities

| Source class | Intended use | Authority boundary |
| --- | --- | --- |
| `international-nomenclature` | Anatomical identity, FMA/TA2/nomenclature evidence, and canonical Latin. | Identity or Latin only where the cited claim and locator support it. |
| `atlas-dataset` | Atlas identity, packaged mesh membership, and source/model metadata. | Does not establish FMA, TA2, Latin, or Vietnamese equivalence by itself. |
| `vietnamese-authoritative` | Vietnamese medical or anatomical wording. | Vietnamese preferred claims only where the cited passage supports them. |
| `secondary-reference` | Corroboration and review context. | Never sufficient alone for a preferred production term. |
| `machine-generated` | Candidate discovery. | Never identity, terminology, medical, or release authority. |

Capabilities are explicit: `anatomical-identity`, `canonical-latin`, `vietnamese-preferred`, `secondary-corroboration`, and `machine-candidate-discovery`. Each source record includes a stable `revision`, an audit status, and verifier metadata. Non-machine sources cannot advertise machine discovery; machine sources can advertise only candidate discovery.

Registration and evidence use are separate. `identityVerified` confirms the
bibliographic or dataset identity and pinned edition/revision; it does not mean
that the contents were inspected. `authorityScope` states which claims the
source may inform. `authorityTier` is `authoritative`, `corroborative`,
`discovery-only`, or `rejected`. `accessStatus` records whether the project has
legitimate review access, and `locatorCapability` records the strongest
reproducible locator available. `METADATA_ONLY` and `UNAVAILABLE` sources, or
sources with `INSUFFICIENT` locators, remain registry evidence only and cannot
support a claim. `fullTextAvailableForReview` and `contentInspected` must both
be true before a supported or verified claim can use a source.

### Authority records and access copies

An authority record identifies the book, edition, publisher, dataset, or
nomenclature source that owns the claim. Its optional `accessCopy` relation
records where the project inspected an available copy; that URL does not
change the authority identity. A separate `accessCopyOf` record is always
`discovery-only` and is not allowed to support a preferred Vietnamese claim,
even when the mirror is searchable. Edition matching and exact locators remain
required before a candidate can become source-verified.

## Claim evidence

Every claim records `sourceId`, the exact `sourceRevision`, and a structured locator. Supported locators are page, plate, chapter, section, table, entry ID, URL, and nomenclature ID. A generic URL alone is not an exact locator for a release claim, and a locator must match the source's declared capability. The validator requires the cited source revision to match the source catalog and rejects missing, metadata-only, uninspected, or otherwise unusable evidence.

Claim evidence dispositions (`CANDIDATE`, `SUPPORTED`, `REJECTED`, `SUPERSEDED`) and claim review states (`PENDING`, `VERIFIED`, `REJECTED`) are independent. Machine candidate history remains visible as origin metadata but can never satisfy a supported claim.

## Source conflicts

Conflicts are explicit entry records. They support identity disagreement, granularity disagreement, contextual difference, edition/version difference, and competing preferred terminology. A conflict records affected claim IDs, status, decision, rationale, permitted aliases or ambiguity scope, reviewer, resolution date, and entry revision.

No conflict is resolved automatically by majority, recency, source count, or lexical similarity. An unresolved substantive conflict blocks release. An adjudicated conflict must be current and recorded by an active authorized medical reviewer.

Vietnamese sources are compared per claim and context. The review records
source scope, concept identity, edition, term context, specialist usage, and
related-family consistency before an authorized medical reviewer adjudicates a
conflict. University anatomy sources and recognized medical-publisher editions
may be authoritative when their identity and exact passage are verifiable;
secondary clinical sources may corroborate but do not automatically override
anatomy nomenclature sources. Retail pages, blogs, scraped or unauthorized
copies, student uploads, machine translation, Wikipedia, general-health sites,
and AI output are discovery aids or rejected evidence, never authoritative
Vietnamese terminology.

## Review and release

Source verification and medical review are separate audits. Medical review requires a reviewer registry record with stable ID, role, qualifications, authorization scope, timestamp, decision, reviewed claim IDs, and the current entry revision. Automation can calculate structural and release checks but cannot issue medical review.

`data/terminology/reviewers.json` is a Git-reviewable registry and remains intentionally empty in M03C1. The release manifest binds the atlas, registry, source catalog, reviewer catalog, policy version, content hash, and entry revisions. A stale source, medical, conflict, or release record fails closed.

## Candidate workflow

1. Treat the atlas `Concept.id` as an opaque key and establish any external identity with a claim.
2. Record the source revision and exact locator for each claim.
3. Store candidates as `DRAFT`/`UNMAPPED` with candidate origin metadata.
4. Record conflicts instead of silently selecting a preferred source.
5. Obtain qualified human review for the current entry revision.
6. Let the derived release gate decide eligibility; never edit a release flag to bypass dependencies.
7. Keep unresolved, rejected, obsolete, and confirmed-no-equivalent dispositions explicit.

The source catalog may be populated during a source-lock milestone. M03C1
records the frozen 50-concept research queue as `DRAFT`/`UNMAPPED` with
`CANDIDATE`/`PENDING` claims, while the release overlay and release manifest
remain empty/unreleased. A source revision change invalidates dependent claims
and approvals through the existing revision checks; it cannot be hidden by
retaining a stale audit status.
