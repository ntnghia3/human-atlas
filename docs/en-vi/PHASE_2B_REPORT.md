# Phase 2B Report: Terminology Governance and Ontology Hardening

## Status

M02B is complete as a governance and validation milestone. It does not populate real Vietnamese terminology, FMA/TA2 mappings, Latin, source bibliography, or pilot concepts.

- Starting checkpoint: `2d9f7411d440812e24165bcdd89a1b816078eb8a` (Bilingual V1 localization hotfix)
- Scope: static schema, validator, runtime release/search gates, synthetic fixtures, and affected governance documents
- Geometry, atlas concept IDs, mesh IDs, and render behavior: unchanged

## Schema changes

`data/terminology/entries.json` and `sources.json` now declare schema version 2. A separate empty `reviewers.json` registry records stable reviewer IDs, role, qualifications, status, and authorization scope. `release.json` is an unreleased manifest boundary.

Entries now represent:

- opaque Atlas concept identity and optional mesh membership checked against that concept’s `Concept.elements`;
- zero, one, or many external mappings with namespace, identifier, source revision, relation, disposition, evidence claim IDs, and notes;
- claim-level evidence for atlas identity, FMA/TA2 mappings, canonical Latin, each alias, Vietnamese preferred wording, search aliases, and corroboration;
- candidate origins, source conflicts, review audits, and medically meaningful scope.

## Evidence and review

Claims require exact targets, source revisions, structured locators, evidence dispositions, and claim review states. A source capability does not verify every claim. Generic URLs are insufficient for supported claims when an exact locator is expected.

Source, medical, and release audits record the current deterministic entry revision and reviewed claim IDs. Effective release eligibility is derived; a stored `VERIFIED` value cannot bypass failed dependencies. Medical approval requires an active registered reviewer with authorization scope. Automated checks cannot issue medical approval.

Conflicts support identity, granularity, context, edition/version, and competing-terminology disagreement. Open conflicts block release; adjudication requires current rationale, decision, and an authorized human reviewer.

## Revision and release

`computeTerminologyRevision` fingerprints medically meaningful content, including mappings, claims, source revisions, aliases, Latin/Vietnamese forms, mesh membership, and scope, while excluding mutable review metadata and the self-referential conflict revision. Any such content change makes previous approvals stale. The release manifest binds atlas, registry, source catalog, reviewer catalog, policy, content hash, and released entry revisions.

## Search and collision behavior

Original `Concept.name` and `Concept.id` remain searchable. English aliases, mesh IDs, external IDs, Latin, and Vietnamese forms enter search only through their approved claim gates. Draft, unresolved, rejected, stale, and machine-derived forms cannot alter production discovery.

Normalized collisions are evaluated on the released subset independently. Two released concepts therefore remain blocking even when a third draft concept shares the form. Explicit current ambiguity adjudication can permit a legitimate homonym with scope.

## Migration and production inventory

There was no real production data to migrate. The old single-ID/entry-wide-provenance assumptions were replaced rather than carried as release-authoritative compatibility fields. Production source, reviewer, and terminology registries remain empty.

The current validator reports:

| Metric | Count |
| --- | ---: |
| Atlas concepts | 3,432 |
| Terminology entries | 0 |
| Vietnamese candidate entries | 0 |
| Searchable terminology entries | 0 |
| Source-verified entries | 0 |
| Medically reviewed entries | 0 |
| Release-eligible entries | 0 |
| Unresolved or unmapped concepts | 3,432 |
| Mapping investigated entries | 0 |
| Mapping unresolved entries | 0 |
| Confirmed no external equivalent entries | 0 |
| Source gaps | 0 |
| Stale approvals | 0 |
| Conflicts awaiting adjudication | 0 |

## Tests and results

The following commands passed after the M02B changes:

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

The synthetic terminology suite uses only `TEST_ONLY` records and covers opaque FMA-like IDs, plural and non-equivalent mappings, mesh membership, missing evidence, unapproved search forms, machine origins, reviewer registration and authorization, stale revisions, source revision changes, source conflicts, released collisions with draft occurrences, explicit ambiguity, derived release eligibility, and disposition metrics.

## Remaining limitations

- No real source, reviewer, or terminology record has been medically or bibliographically verified.
- The static reviewer registry is empty; production release remains impossible by design.
- The release manifest is `UNRELEASED`; upstream atlas revision identity still needs to be supplied by the future synchronization workflow.
- Semantic direction/category checks remain human review prompts.
- The fingerprint is deterministic and Git-compatible but is not a cryptographic hash.

## Exact next task

Begin M03 only after a reviewed decision to start the approximately 40–60 concept adversarial pilot. Select and source the pilot; do not extrapolate terms to the remaining 3,432 concepts.
