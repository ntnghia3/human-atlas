# M04B1 FIPAT TA2 Bulk Corpus

## Status

**PASS — M04B1 complete; STOP.** This task started from commit
`8c6efba14c3f1caec0a6ba12a7419685a9006127` and ingested the official FIPAT
Terminologia Anatomica 2 (TA2) online parts as a research corpus. It does not
translate the atlas, infer FMA/TA2 equivalence, perform medical adjudication,
or change production release state.

The checked-in corpus contains authoritative Latin and English source fields
only. No Vietnamese terms, Atlas IDs, FMA IDs, or ontology mappings were
generated.

## Source and provenance

The requested Dalhousie index URL returned HTTP 404 on retrieval. The five
official direct Dalhousie CDN PDFs named by the task were downloaded and
inspected, together with the official TA2 errata PDF:

| File | Pages | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| [TA2 Part 1](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-1.pdf) | 15 | 448,632 | `eb002f7e92134d3a397c4bcdbbd39daf8538163d7a1a90164a1549a1bea6c4c5` |
| [TA2 Part 2](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf) | 104 | 2,646,771 | `d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b` |
| [TA2 Part 3](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-3.pdf) | 50 | 1,570,264 | `453060564c1fee53a7c392eb1b3d6dbc06b3c150abeb8dfc268f158496a8fecc` |
| [TA2 Part 4](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-4.pdf) | 69 | 2,190,882 | `87a621bf143b93519d733eac86b0c85769fbd2b21ed5b696090386e1ff17c0cc` |
| [TA2 Part 5](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-5.pdf) | 77 | 1,924,974 | `ebda279a51bac4c62221c4539817394c28e3dd99925a06bf57adeeb12abd9e4c` |
| [TA2 Errata](https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Errata.pdf) | 25 | 478,047 | `bdcd0aba0dc3eee636bed08859f0ceed8b86ef8985de85d9a5013fb11be3c776` |

The complete manifest is
`data/terminology/research/source-manifests/fipat-ta2-2019.json`. It records
source ID `FIPAT_TA2`, revision `TA2-2019-online`, edition `Second edition
2.07`, retrieval date, canonical URL, SHA-256, byte size, part number, and PDF
page count. PDFs remain in the gitignored local cache
`.local-sources/fipat-ta2/` and are not committed.

## Extraction and corpus

`scripts/extract-fipat-ta2.py` parses the fixed-column terminology tables from
the five PDFs using exact printed page locators. It preserves raw Latin and
English surface forms and does not normalize source text during extraction.
Where both English spellings are present, UK English is the preferred English
field and a distinct US spelling remains an alias; explicit synonym columns
remain aliases. The `Other` column is not promoted to preferred terminology.

| Measure | Result |
| --- | ---: |
| Corpus records | 7,112 |
| Unique TA2 entry IDs | 7,112 |
| Extraction errors | 0 |
| Terminology table rows parsed | 7,112 |
| Blank/non-terminology rows skipped | 1 (`2259`, Part 2 PDF page 62) |
| Vietnamese fields generated | 0 |
| FMA/Atlas mappings generated | 0 |

The skipped row is a blank printed table row between entries 2258 and 2260;
it has no source term or equivalent and is documented in the manifest. No
other printed entry ID was dropped. Locators contain the exact source PDF URL,
part, PDF page, and unique FIPAT entry ID.

## Errata

The official 25-page errata PDF was inspected through version 2.07. The
manifest records the version counts and affected terminology IDs:

```text
2.01=22  2.02=20  2.03=33  2.04=15  2.05=22  2.06=48  2.07=155
cumulative affected emitted terminology entries=306
```

The downloaded TA2 part PDFs already contain the current 2.07 fields. The
extractor therefore uses those current fields and annotates affected records
with the errata version, errata PDF page, action, and corrected value; it does
not rewrite the source PDFs. The verification fixture checks the 2.07
correction for entry 403 (`Centra ossificationis`) and representative synonym,
UK/US spelling, and parenthesized Latin preservation cases.

## Indexing and 3,432-concept matching

The default terminology index and matcher now use
`fipat-ta2-2019.jsonl`. Matching keys are derived only for lookup; canonical
source strings remain unchanged.

| Match measure | Concepts |
| --- | ---: |
| Atlas concepts processed | 3,432 / 3,432 |
| Exact English match | 557 |
| Normalized-English-only match | 0 |
| Latin match | 557 |
| No source match | 2,875 |
| Source-matched concepts | 557 |
| Normalized candidate collisions | 0 |

Review buckets:

```text
HIGH_CONSENSUS_CANDIDATE=0
VARIANT_REVIEW=2
CONFLICT_REQUIRES_ADJUDICATION=3
ONTOLOGY_SCOPE_REVIEW=9
LATERALITY_REVIEW=6
SOURCE_GAP=2520
IDENTITY_GAP=1
AGGREGATE_OR_COMPOSITE_REVIEW=891
```

These are research evidence and review dispositions only. No source match was
promoted to a Vietnamese or production terminology claim.

## M03C regression

The frozen M03C regression set contains 50 concepts. Results were 33 passing
fixtures, 17 explicit input gaps, and **0 mismatches**. The existing M03C
regression behavior remains intact.

## Production safety

Production coverage remains unchanged and safe:

```text
searchable=0
SOURCE_VERIFIED=0
MEDICAL_REVIEWED=0
releaseEligible=0
reviewers changed=0
release status=UNRELEASED
```

The FIPAT source registry was updated only after download, hashing, and full
parse. It records full inspection access, stable entry locators, edition 2.07,
the official URLs, and the limitation that this source provides authoritative
Latin/English evidence but not Vietnamese terminology.

## Validation

All requested and repository regression checks passed:

```text
npm run terminology:build-index
npm run terminology:bulk-match
npm run test:m04b1
npm run test:m04a
npm run test:m03c
npm run test:terminology
npm run test:localization
npm run check
```

The M04B1-specific validator checks schema conformance, source revision and
edition, exact locators, unique IDs, raw Latin, no generated Vietnamese or
external IDs, errata provenance, aliases, duplicate-text preservation, index
joins, matcher coverage, M03C regression, and production gates.

## Remaining blockers and exact next task

Remaining blockers are intentional: the requested index endpoint was
unavailable at retrieval, the corpus contains no authoritative Vietnamese
fields, and no medical review or ontology mapping is authorized by M04B1.

The exact next task is **M04B2 — Vietnamese authoritative corpus ingestion**,
with priorities:

1. NVH2008
2. HMU2022
3. UMP authoritative editions
4. NETTER2015

M04B2 must use legitimate local review copies supplied by the owner. It must
not bulk-extract copyrighted books from public mirrors into the repository.

**STOP after M04B1.**
