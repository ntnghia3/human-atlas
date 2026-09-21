# M04A Bulk Evidence Pipeline Foundation

## Status

**PASS — engine only.** M04A starts from M03C1 PASS commit
`bdea5e184d8c68dfbae6bda66390ea16831a2462`. It does not start M03C2 medical
adjudication, extract a full source corpus, bulk translate atlas concepts, or
change the production terminology release state.

The current atlas remains 3,432 concepts and 2,234 packaged meshes. The
existing 50 M03C1 research entries remain the only registry entries; no
concepts 51+ were populated with production Vietnamese terminology.

## Architecture

```text
optional source JSON/JSONL files
  → build-terminology-index.mjs
  → bulk-source-index.json
  → bulk-match-terminology.mjs
     inputs: atlas.json + index + source catalog + frozen M03C metadata
  → bulk-match-results.json
     output: research evidence and deterministic review buckets only
```

The implementation is in `scripts/m04a-bulk-evidence.mjs`. It reads each
corpus file once, coalesces exact duplicate records while retaining a
deterministic duplicate count, builds lookup maps once, and joins every atlas
concept locally. There are no per-concept web requests and no network step in
either command.

## Corpus schema and provenance

The record contract is documented in
`data/terminology/research/bulk-source-corpus.schema.json`. JSON and JSONL are
accepted. Each record preserves:

- `sourceId`, exact `sourceRevision`, optional `sourceEdition`;
- a structured `locator` (`page`, `plate`, `entryId`, `nomenclatureId`,
  `chapter`, `section`, `table`, and optional URL);
- `sourceTermRaw` exactly as extracted;
- independent English, Latin, and Vietnamese preferred/alias blocks;
- optional context, anatomical category, laterality, directional qualifiers,
  source codes, terminology IDs, and notes.

The index stores the original record plus its deterministic evidence ID. It
indexes exact English, normalized English, Latin preferred/aliases, Vietnamese
terms, source codes, terminology IDs, and anatomical category. Unicode
normalization, case folding, whitespace folding, Vietnamese diacritic folding,
and `đ → d` are matching keys only. They are never written back as canonical
source wording.

The matcher checks corpus revisions against the source catalog. An authority
record with an inspection access copy may contribute research evidence, but a
separate `discovery-only`/`accessCopyOf` record cannot create a high-consensus
candidate. Stale revisions, missing sources, insufficient locators, and
machine-generated records remain explicitly blocked.

## Matching and disposition rules

For each atlas concept the result records `conceptId`, the original atlas
name, mesh count, source matches, exact and normalized English matches, Latin
evidence, Vietnamese candidate evidence, detected qualifiers, semantic flags,
mesh heuristics, candidate consensus, and a research bucket.

`HIGH_CONSENSUS_CANDIDATE` requires an exact or safely normalized English
identity, authoritative Vietnamese evidence with a reproducible locator, no
authoritative preferred-term conflict, and consistent category/qualifier
signals. Independent authoritative sources are counted and their agreement is
recorded. This is still a research candidate and is never a production claim.

Distinct authoritative preferred terms are classified as
`CONFLICT_REQUIRES_ADJUDICATION`; the algorithm never selects a majority,
newest, most frequent, or lexically closest term. Alias-only evidence is
`VARIANT_REVIEW`. Missing source material, unlinked identity, laterality risk,
ontology scope risk, and aggregate/composite risk remain separate review
states.

The implemented buckets are:

```text
HIGH_CONSENSUS_CANDIDATE
VARIANT_REVIEW
CONFLICT_REQUIRES_ADJUDICATION
ONTOLOGY_SCOPE_REVIEW
LATERALITY_REVIEW
SOURCE_GAP
IDENTITY_GAP
AGGREGATE_OR_COMPOSITE_REVIEW
```

## Semantic QA

The detector flags left/right, anterior/posterior, superior/inferior,
medial/lateral, proximal/distal, superficial/deep, artery/vein,
nerve/ligament, muscle/tendon, branch/trunk, and singular/aggregate cues.
Flags are evidence for review only. No Vietnamese term is side-composed,
corrected, or promoted by the detector.

## Aggregate and mesh handling

The matcher reports high mesh count (threshold: eight packaged meshes), shared
mesh membership, unsided concepts that overlap paired concepts, side-specific
overlap with unsided concepts, aggregate vocabulary (group/family/system/zone/
compartment/tree/segment), and branch/trunk cues. These heuristics produce
review flags and can place a result in aggregate or ontology review; they never
prove FMA/TA2 equivalence, parentage, synonymy, or anatomical identity.

## M03C regression behavior

The current 50 M03C entries are read as prior research metadata only. Every
matching result carries a regression status of `PASS`, `INPUT_GAP`, or
`MISMATCH`. A real incompatibility is emitted as a regression finding rather
than silently overwriting the pilot disposition.

The synthetic regression corpus confirms:

- both hip-bone conflict records remain conflict cases;
- foot navicular remains conflict rather than selecting `xương thuyền` or
  `xương ghe`;
- `FMA9613` reaches `HIGH_CONSENSUS_CANDIDATE` with two agreeing synthetic
  authoritative sources;
- proximal carpal, cranial-nerve branch aggregate, and fascia-zone records
  remain explicit aggregate/composite review cases.

## Scaling and deterministic runs

The normal run is:

```text
npm run terminology:build-index
npm run terminology:bulk-match
```

The corpus is loaded once, indexes are built once, and concept lookups are
index joins rather than scans of the entire corpus. Results are sorted by
stable evidence IDs and atlas order. The engine can run with no corpus file;
the checked-in dry run therefore emits all 3,432 concepts as research results
with explicit source gaps. A corpus can be supplied without changing the
production registry:

```text
node scripts/build-terminology-index.mjs --corpus path/to/source.jsonl
node scripts/bulk-match-terminology.mjs --corpus path/to/source.jsonl
```

## Tests and validation

The synthetic fixture corpus contains 21 input records and 20 indexed records
after one exact duplicate is coalesced. It covers agreement, conflict,
laterality mismatch, artery/vein mismatch, nerve/ligament mismatch, an alias,
normalized collision, an aggregate concept, missing Vietnamese evidence,
source-revision mismatch, a discovery-only access copy, and machine evidence.

`npm run test:m04a` passed with:

- 3,432/3,432 atlas concept results;
- 50 frozen M03C regression rows, 0 mismatches and 9 explicit input gaps;
- 1 duplicate evidence record detected;
- production searchable, source-verified, medically reviewed, and
  release-eligible coverage all zero.

The empty-corpus dry run produced `data/terminology/research/bulk-match-results.json`
with 3,432/3,432 results, 0 source matches, 0 normalized collisions, 0 M03C
regression mismatches, and the following buckets:

```text
HIGH_CONSENSUS_CANDIDATE=0
VARIANT_REVIEW=4
CONFLICT_REQUIRES_ADJUDICATION=3
ONTOLOGY_SCOPE_REVIEW=10
LATERALITY_REVIEW=8
SOURCE_GAP=2514
IDENTITY_GAP=2
AGGREGATE_OR_COMPOSITE_REVIEW=891
```

## Limitations

- The repository does not yet contain the complete authoritative source
  corpus; the default run is deliberately an empty-corpus dry run.
- Matching cannot establish medical identity, ontology equivalence, preferred
  Vietnamese wording, or release eligibility.
- Mesh heuristics are conservative review signals and can over-flag shared
  atlas membership.
- A normalized match does not erase surface variants or justify canonical
  output.
- Human source verification and qualified medical adjudication remain outside
  this milestone.

## Production coverage and next task

Production Vietnamese searchable coverage remains **0**. `SOURCE_VERIFIED=0`,
`MEDICAL_REVIEWED=0`, `releaseEligible=0`, reviewers `0`, and the release
manifest remains `UNRELEASED`. `data/terminology/entries.json`,
`data/terminology/sources.json`, `data/terminology/reviewers.json`, and
`data/terminology/release.json` were not changed by M04A.

The exact next governance task remains **M03C2 — claim-level source
verification and qualified medical adjudication of the frozen 50**, beginning
with the 11 locator-pinned candidates. It is not started by this milestone.
