# CODEX TASK — M04B1 TA2 Bulk Corpus Extraction

Starting checkpoint:
`8c6efba14c3f1caec0a6ba12a7419685a9006127`

Milestone:
**M04B1 — FIPAT TA2 bulk corpus extraction and atlas coverage run**

## PURPOSE

Populate the M04A bulk evidence pipeline with the international nomenclature layer
in one deterministic source-ingestion pass.

This is NOT per-concept web research.

Do not browse/search the web for terminology.
Do not use an AI research agent.
Do not translate anatomical terms.
Do not create Vietnamese preferred terms.
Do not perform medical review.

The only network operation permitted in this task is downloading the explicitly
listed official FIPAT/Dalhousie TA2 files once.

## SOURCE BINDING

Use the existing repository source record exactly:

sourceId: `FIPAT_TA2`
sourceRevision: `TA2-2019-online`

Do not invent a new FIPAT revision unless the official files prove the repository
record is materially wrong.

The current source record is metadata-only. It may be strengthened only after the
official files below are actually downloaded, hashed, parsed and inspected.

## OFFICIAL INPUTS

Index:
https://libraries.dal.ca/Fipat/ta2.html

TA2 2.07:
https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-1.pdf
https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf
https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-3.pdf
https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-4.pdf
https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-5.pdf

Also download and inspect the official 2.07 errata linked from the same index page.

FIPAT states that the publication is CC BY-ND 4.0 and that the individual
terminology terms are in the public domain. Do not redistribute modified PDF files.
The repository corpus should contain extracted individual terms and provenance,
not the source PDFs.

## LOCAL SOURCE CACHE

Create a gitignored local cache, for example:

`.local-sources/fipat-ta2/`

Do NOT commit the downloaded PDFs.

Record:
- canonical URL
- SHA-256
- byte size
- retrieval date
- part number
- PDF page count

in a small committed provenance manifest such as:

`data/terminology/research/source-manifests/fipat-ta2-2019.json`

The manifest must not contain copied prose from the PDFs.

## EXTRACTION

Parse all five TA2 terminology parts.

For every real terminology row, emit one record conforming exactly to:

`data/terminology/research/bulk-source-corpus.schema.json`

Output:

`data/terminology/research/corpora/fipat-ta2-2019.jsonl`

Every record must use:

- `sourceId = "FIPAT_TA2"`
- `sourceRevision = "TA2-2019-online"`
- `sourceEdition = "Second edition 2.07"`
- exact PDF page locator
- chapter/part section where available
- the row's unique FIPAT identification number as `locator.entryId`
- official Latin term in `latin.preferred`
- Latin synonyms only when explicitly present
- official English equivalent in `english.preferred`
- alternate UK/US equivalent or explicit English synonyms in `english.aliases`
- the exact official Latin term as `sourceTermRaw`

Do not infer Vietnamese.
Do not infer FMA IDs.
Do not treat the atlas Concept.id as a TA2 or FMA ID.

Where UK and US English differ:
- preserve both;
- choose one deterministic matching preferred form and document the rule;
- do not claim that this choice changes FIPAT's nomenclature status.

Parenthesized/candidate/related terms must retain their actual FIPAT status when
that status is machine-readable. Do not silently promote a related/candidate term
to official.

## ERRATA

Apply the official TA2 2.07 errata during corpus generation.

The raw source provenance must make it possible to determine:
- original part/page/entry;
- whether an erratum affected the row;
- the corrected value.

Do not modify the downloaded PDFs.

Add tests for at least one errata-affected row if the errata contains a
machine-testable terminology correction.

## DEDUPLICATION

Do not deduplicate by normalized text.

Different FIPAT rows that share an English or Latin string remain separate
evidence records.

Only byte/field-identical accidental extraction duplicates may be coalesced by
the existing M04A duplicate rule.

## SOURCE REGISTRY UPDATE

Only after successful download + hash + full parse:

update `FIPAT_TA2` in `data/terminology/sources.json` conservatively to reflect
that the official 2.07 terminology content was inspected.

Do not change its Vietnamese capability.

A reasonable post-ingestion state should indicate official full/usable access
and a reproducible entry/page locator, but use the existing schema values rather
than inventing new enum members.

Do not mark any atlas terminology entry SOURCE_VERIFIED merely because TA2 was
ingested.

## RUN THE BULK PIPELINE

After extraction:

`npm run terminology:build-index`
`npm run terminology:bulk-match`
`npm run test:m04a`

Process exactly all 3,432 atlas concepts.

Produce statistics for:
- corpus record count
- unique TA2 entry count
- extraction errors
- exact English matches
- normalized English matches
- Latin matches, where relevant
- concepts with no TA2 match
- research bucket counts
- M03C regression status

Do not convert a lexical match into an Atlas↔TA2 mapping.
This milestone measures nomenclature match coverage only.

## QUALITY CHECKS

Tests must prove:

1. all five parts were parsed;
2. every emitted record validates against the existing corpus schema;
3. every record binds to exact source revision `TA2-2019-online`;
4. each record has a reproducible locator;
5. official Latin is preserved;
6. UK/US English differences are preserved;
7. Latin/English synonyms are not promoted to preferred;
8. normalized text is matching-only;
9. no Vietnamese field is generated;
10. no FMA mapping is inferred;
11. no atlas Concept.id is interpreted as an FMA ID;
12. duplicate strings from distinct TA2 rows remain distinct records;
13. 3,432/3,432 atlas concepts are processed;
14. frozen M03C regression has zero silent overwrites.

## PRODUCTION SAFETY

After M04B1:

- production Vietnamese searchable must remain 0;
- SOURCE_VERIFIED atlas entries must remain 0 unless they already existed before
  this task;
- MEDICAL_REVIEWED must remain 0;
- release eligible must remain 0;
- reviewer registry remains unchanged;
- release manifest remains UNRELEASED.

## REPORT

Create:

`docs/en-vi/M04B1_TA2_CORPUS_REPORT.md`

Include:
- exact starting commit;
- official source URLs;
- hashes and page counts;
- extraction method;
- corpus count;
- errata handling;
- atlas match coverage;
- M03C regression results;
- source registry changes;
- all tests;
- production coverage;
- extraction limitations;
- exact next task.

## NEXT TASK

The next task after PASS is NOT medical adjudication.

It is:

**M04B2 — Vietnamese authoritative corpus ingestion**

Priority:
1. NVH2008
2. HMU2022
3. UMP authoritative editions
4. NETTER2015

M04B2 must use legitimate local review copies supplied by the owner.
It must not bulk-extract copyrighted books from public mirrors into the repository.

## STOP

STOP after M04B1.

Return:
PASS / PARTIAL / FAIL
final commit SHA
files changed
TA2 corpus record count
source manifest summary
errata summary
3432-concept match statistics
M03C regression status
production coverage
remaining blockers
exact next task
