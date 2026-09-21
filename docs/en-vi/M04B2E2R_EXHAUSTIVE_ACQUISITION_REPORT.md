# M04B2E-2R — Exhaustive Public-Source Acquisition Report

Status: **RESEARCH_ONLY_NOT_RELEASE**

Starting repository HEAD: `fca340ea6d7650f589c4a67dad5730e7067514db`; acquisition date: 2026-09-21.

This run expands deterministic public-source acquisition only. It does not translate, select a preferred Vietnamese term, adjudicate conflicts, synthesize laterality, equate FMA with SNOMED CT, perform medical review, modify production terminology, or release anything.

## 1. Cache, authority, and retention policy

Local cache: `.local/terminology-source-cache/`; git-ignored: **yes**; full source cache allowed locally: **yes**; full source bodies in Git: **no**.
Complete retrievable PDF/HTML/rendered text, extracted text, and parser staging are local-only. Git retains compact matched evidence, provenance, hashes, locators, traversal metrics, and review metadata. Public rendered hosts are access copies; the official Ministry PDF remains an authority source but only as ontology-bridge candidate evidence.

| Source | Authority metadata | Access URL | Relation | Content | Fetch status | Retained compact rows |
| --- | --- | --- | --- | --- | --- | ---: |
| NVH2008 | [metadata](https://images.xuatbanyhoc.vn/Files/2025-06-30/document-20250630170725501.pdf) | [access](https://www.scribd.com/document/689063262/TU-%C4%90IE-N-GIA-I-PHA-U) | public-access-copy | text/html | `FETCHED_EXHAUSTIVE_RENDERED_STREAM_COMPACT_ROWS` | 430 |
| HMU2022 | [metadata](https://phucvu.thuvientphcm.gov.vn/Item/ItemDetail/798605) | [access](https://it.scribd.com/document/989318314/Gi%E1%BA%A3i-Ph%E1%BA%ABu-Ng%C6%B0%E1%BB%9Di-YHN-2022) | public-access-copy | text/html | `FETCHED_PUBLIC_ACCESS_NO_NEW_COMPACT_ROWS` | 0 |
| UMP2023_T1 | [metadata](https://library.fpt.edu.vn/SearchBook/Detail?detail_id=20733) | [access](https://www.scribd.com/document/843036645/Gi%E1%BA%A3i-Ph%E1%BA%ABu-H%E1%BB%8Dc-Ch%C6%B0%C6%A1ng-Trinh-y-%C4%90a-Khoa-%C4%90%E1%BB%95i-M%E1%BB%9Bi-T%E1%BA%ADp-1-2023) | public-access-copy | text/html | `FETCHED_PUBLIC_ACCESS_IDENTITY_CATALOG_GAP` | 0 |
| UMP2023_T2 | [metadata](https://lib.hpmu.edu.vn/Catalog/BibInfo.aspx?bib_id=20847) | [access](https://www.scribd.com/document/922950729/giaiphauhocchuongtrinhydakhoadoimoi-tap2-ythuquan) | public-access-copy | text/html | `FETCHED_PUBLIC_ACCESS_NO_NEW_COMPACT_ROWS` | 0 |
| MOH2025_BODY_STRUCTURE | [metadata](https://www.ksbtkhanhhoa.vn/VanBan/ChiTiet/8847) | [access](https://syt.daknong.gov.vn/upload/2005704/20250909/03_Phu_luc_01__Danh_muc_Cau_truc_co_the__signed_6ef8a.pdf) | official-authority | application/pdf | `FETCHED_OFFICIAL_PDF_TEXT_LAYER_COMPACT_ROWS` | 1506 |
| UMP_SYSTEM2023 | [metadata](https://opac.nlv.gov.vn/chi-tiet-tai-lieu/giai-phau-hoc-he-thong-202510224690518142931) | — | metadata-only | metadata-only | `METADATA_ONLY_NO_PUBLIC_FULLTEXT` | 0 |
| HMU2004_OFFICIAL_DIGITAL | [metadata](https://opac.huemed-univ.edu.vn/DigitalDocument/Detail?fileId=12506&treeId=-1) | [access](https://opac.huemed-univ.edu.vn/DigitalDocument/Detail?fileId=12506&treeId=-1) | official-authority | text/html | `ACCESS_NOT_RETAINED_NO_COMPACT_ROWS` | 0 |
| NQQ2012 | — | [access](https://tailieuykhoamienphi.com/pdf-gian-yeu-giai-phau-nguoi-gs-nguyen-quang-quyen/) | public-access-copy | text/html | `ACCESS_LEAD_NOT_EDITION_PINNED` | 0 |
| HUE2006 | — | [access](https://www.studocu.vn/vn/document/truong-dai-hoc-y-duoc-dai-hoc-thai-nguyen/giai-phau-hoc/giao-trinh-giai-phau-hoc-he-dieu-duong-hue-2006/143365328) | public-access-copy | text/html | `PREVIEW_NOT_SUITABLE_FOR_BULK_ROWS` | 0 |

NVH2008 access copy: https://www.scribd.com/document/689063262/TU-%C4%90IE-N-GIA-I-PHA-U. MOH2025 official PDF: https://syt.daknong.gov.vn/upload/2005704/20250909/03_Phu_luc_01__Danh_muc_Cau_truc_co_the__signed_6ef8a.pdf.

## 2. Exhaustive traversal and parser accounting

| Source | Pages discovered | Pages retrieved | Pages parsed | Blocks discovered | Blocks parsed | Candidate rows | Structurally rejected | Compact rows retained | Coverage status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| NVH2008 | 538 | 538 | 538 | 6960 | 6960 | 6960 | 6530 | 430 | `PARTIAL_PUBLIC_TEXT_ACCESS` |
| MOH2025_BODY_STRUCTURE | 1441 | 1441 | 1441 | 35891 | 35891 | 35891 | 4 | 1506 | `FULLY_PARSED_TEXT_LAYER_WITH_STRUCTURAL_REJECTS` |

NVH2008 range evidence: first safely parsed entry `A01.1.00.001`, last safely parsed entry `A16.0.03.005`; 430 safely reconstructed rows were reduced to 430 exact compact rows after duplicate collapse. Rendered-page discovery is pinned to the registry’s 538-page access copy. The run is explicitly **PARTIAL_PUBLIC_TEXT_ACCESS**, not an unqualified fully-parsed claim.
MOH2025 range evidence: first structured entry `6100001`, last structured entry `6136356`; the text-layer traversal is **FULLY_PARSED_TEXT_LAYER_WITH_STRUCTURAL_REJECTS** with four rejected English-only duplicate layout blocks.

NVH2008 retained coverage by A-code prefix: `{"A01":8,"A02":55,"A03":4,"A04":105,"A05":22,"A06":27,"A08":1,"A09":3,"A10":1,"A12":135,"A13":2,"A14":46,"A15":19,"A16":2}`.
NVH2008 candidate-block coverage by A-code prefix: `{"A01":251,"A02":953,"A03":275,"A04":653,"A05":439,"A06":238,"A07":26,"A08":101,"A09":258,"A10":84,"A11":5,"A12":1146,"A13":187,"A14":1819,"A15":467,"A16":58}`.
MOH2025 retained coverage by Ministry-code prefix: `{"61":1506}`; candidate coverage: `{"61":35887}`.

The prior compact NVH baseline of **556** rows was audited: **269** exact source rows retained and **287** quarantined for parser-integrity review. Candidate status counts: `{"EXACT_RECONSTRUCTED_SOURCE_ROW":430,"PARSER_INTEGRITY_REVIEW":974,"UNMATCHED_SOURCE_RECORD":5556}`.

## 3. MOH2025 structured parser and mapping policy

Official decision metadata: [Decision 2427/QĐ-BYT](https://www.ksbtkhanhhoa.vn/VanBan/ChiTiet/8847). Official PDF: https://syt.daknong.gov.vn/upload/2005704/20250909/03_Phu_luc_01__Danh_muc_Cau_truc_co_the__signed_6ef8a.pdf. The local parser preserved Ministry code, Vietnamese wording, English wording, SNOMED CT ID, group, printed page, URL, laterality only when explicit, and raw scope.
The parser emitted 1506 compact indexed records from 1506 safely English-compatible rows. FMA/SNOMED string equality was never used; exact English-compatible scope, controlled generic wrapper aliases, and normalized-safe aliases are ontology-bridge candidates only.

| MOH metric | Count |
| --- | ---: |
| Parsed text-layer rows | 1506 |
| Unmatched structured source rows | 34381 |
| Duplicate Ministry-code blocks | 2 |
| Malformed Ministry-code blocks | 0 |

The 34381 parsed-but-not-safely-mapped Ministry rows remain classified as **UNMATCHED_SOURCE_RECORD**; parser rejection or ontology uncertainty is not reported as source absence.

SNOMED CT identifiers remain source identifiers and are not promoted as FMA-equivalent anatomical identity matches.

## 4. NVH2008 rendered-stream reconstruction

The parser visited all 6960 discovered rendered code blocks. It retained 430 rows only where the printed ID, complete English source term, complete Vietnamese source term, and exact atlas identity were recoverable in source order. Of the 6530 rejected blocks, 974 are **PARSER_INTEGRITY_REVIEW** and 5556 are **UNMATCHED_SOURCE_RECORD**; none count as eligible Vietnamese evidence.
NVH2008 compact metrics: 458 indexed rows; 432 Vietnamese forms; 406 concepts with eligible research evidence. No laterality was synthesized.

Known parser-integrity sentinels:
- `FMA3951`: bucket=`VARIANT_REVIEW`, regression=`PASS`, exact NVH entry=`A12.2.08.001` / `Động mạch dưới đòn`, truncated-prefix rows retained=**0**
- `FMA4725`: bucket=`VARIANT_REVIEW`, regression=`PASS`, exact NVH entry=`A12.3.08.002` / `Tĩnh mạch dưới đòn`, truncated-prefix rows retained=**0**
- `FMA10662`: bucket=`VARIANT_REVIEW`, regression=`PASS`, exact NVH entry=`A12.2.08.043` / `Động mạch giáp dưới`, truncated-prefix rows retained=**0**
- `FMA9597`: bucket=`SOURCE_GAP`, regression=`INPUT_GAP`; no unsupported NVH row was generated.

## 5. HMU/UMP candidate corroboration

HMU2022 retained 31 source-attested rows; UMP2023_T2 retained 12; UMP2023_T1 remains an identity-catalog gap with no compact rows. No additional HMU/UMP row was promoted from a public access copy without explicit heading/subheading/figure/table/glossary/definition context. Candidate-driven search therefore adds **0 new compact HMU/UMP corroborations**; existing source-separated rows and conflict/variant evidence remain intact.
Insufficient UMP Tập 1 catalog context is recorded as `CONTEXT_IDENTITY_INSUFFICIENT`, not as source absence or a synthesized match.

## 6. 3,432-concept accounting and review queues

The matcher emitted **3432/3432** concepts exactly once; duplicate IDs: **0**; missing IDs: **none**.
| Metric | Count |
| --- | ---: |
| PRE_M04B2E_BASELINE | 47 |
| M04B2E2_BASELINE | 80 |
| FINAL_AFTER_2R1 | 421 |
| Delta from 47 | 374 |
| Delta from 80 | 341 |
| Final coverage of 3,432 concepts | 12.27% |
| Newly added vs prior deterministic input | 374 |
| Multi-authority agreement | 16 |
| Single-authority evidence | 401 |
| Variants after repair (before: 195) | 225 |
| Conflicts after repair (before: 54) | 9 |
| Source gaps | 2134 |
| Ontology/scope review | 10 |
| Aggregate/composite review | 888 |
| Laterality review | 9 |
| Identity review | 2 |

Conflict concepts: `FMA16585`, `FMA16586`, `FMA16587`, `FMA22534`, `FMA24499`, `FMA50723`, `FMA7154`, `FMA7155`, `FMA9600`.
Variant-review concepts: `FMA10419`, `FMA10645`, `FMA10646`, `FMA10659`, `FMA10662`, `FMA10663`, `FMA10664`, `FMA10665`, `FMA10951`, `FMA11336`, `FMA12520`, `FMA13295`, `FMA13303`, `FMA13321`, `FMA13324`, `FMA13329`, `FMA13394`, `FMA14319`, `FMA14331`, `FMA14338`, `FMA14339`, `FMA14343`, `FMA14349`, `FMA14539`, `FMA14545`, `FMA14546`, `FMA14547`, `FMA14668`, `FMA14669`, `FMA14670`, `FMA14768`, `FMA14773`, `FMA14775`, `FMA14776`, `FMA14782`, `FMA14784`, `FMA14787`, `FMA14790`, `FMA14805`, `FMA14810`, `FMA14811`, `FMA14815`, `FMA14818`, `FMA14826`, `FMA14832`, `FMA15394`, `FMA15399`, `FMA15400`, `FMA15408`, `FMA15629`, `FMA15630`, `FMA18060`, `FMA18902`, `FMA18917`, `FMA20686`, `FMA20798`, `FMA21162`, `FMA21185`, `FMA22299`, `FMA22315`, `FMA22317`, `FMA22441`, `FMA22442`, `FMA22443`, `FMA22506`, `FMA22533`, `FMA22536`, `FMA22585`, `FMA22593`, `FMA22654`, `FMA22674`, `FMA22706`, `FMA22710`, `FMA22714`, `FMA22748`, `FMA22810`, `FMA22908`, `FMA22963`, `FMA23113`, `FMA23179`, `FMA23463`, `FMA23466`, `FMA23709`, `FMA24476`, `FMA24479`, `FMA24485`, `FMA24496`, `FMA32519`, `FMA32672`, `FMA3736`, `FMA37373`, `FMA37378`, `FMA37448`, `FMA37450`, `FMA3789`, `FMA38453`, `FMA38469`, `FMA38478`, `FMA38481`, `FMA38494`, `FMA38497`, `FMA38500`, `FMA38512`, `FMA38515`, `FMA38518`, `FMA38521`, `FMA38524`, `FMA3939`, `FMA3947`, `FMA3951`, `FMA3956`, `FMA3960`, `FMA43888`, `FMA43902`, `FMA44318`, `FMA44327`, `FMA44595`, `FMA45738`, `FMA4613`, `FMA46308`, `FMA46727`, `FMA46730`, `FMA4707`, `FMA4714`, `FMA4720`, `FMA4723`, `FMA4724`, `FMA4725`, `FMA4751`, `FMA4838`, `FMA4877`, `FMA50169`, `FMA50330`, `FMA50337`, `FMA50454`, `FMA50531`, `FMA50544`, `FMA50573`, `FMA51048`, `FMA51061`, `FMA51071`, `FMA51141`, `FMA52628`, `FMA52638`, `FMA52642`, `FMA52655`, `FMA52668`, `FMA52693`, `FMA52734`, `FMA52735`, `FMA52737`, `FMA52741`, `FMA52745`, `FMA52746`, `FMA52747`, `FMA52748`, `FMA52749`, `FMA54375`, `FMA54736`, `FMA55021`, `FMA55077`, `FMA55093`, `FMA55099`, `FMA55109`, `FMA55110`, `FMA55111`, `FMA55618`, `FMA5865`, `FMA5894`, `FMA59503`, `FMA59504`, `FMA59762`, `FMA59791`, `FMA61833`, `FMA61834`, `FMA61857`, `FMA61859`, `FMA61860`, `FMA61894`, `FMA61896`, `FMA61897`, `FMA61898`, `FMA61899`, `FMA61906`, `FMA61918`, `FMA61961`, `FMA61974`, `FMA62009`, `FMA62032`, `FMA62046`, `FMA62209`, `FMA62327`, `FMA62434`, `FMA62493`, `FMA66320`, `FMA67943`, `FMA67977`, `FMA69264`, `FMA69513`, `FMA71213`, `FMA7148`, `FMA7196`, `FMA7198`, `FMA7202`, `FMA7394`, `FMA7395`, `FMA7396`, `FMA7478`, `FMA7485`, `FMA7487`, `FMA74877`, `FMA7488`, `FMA76998`, `FMA77144`, `FMA77155`, `FMA77168`, `FMA77498`, `FMA78469`, `FMA83740`, `FMA86464`, `FMA9615`, `FMA9625`, `FMA9704`, `FMA9711`, `FMA9721`.
M03C regression accounting: PASS=49; INPUT_GAP=1; EXPECTED_EVIDENCE_SUPERSESSION=0; UNEXPLAINED_REGRESSION=0.
All raw source wording remains attached to its source and locator. No majority winner, newest-source winner, preferred-term selection, or automatic conflict resolution was performed.

## 7. Production safety

Validation errors: **0**; searchable Vietnamese: **0**; SOURCE_VERIFIED: **0**; MEDICAL_REVIEWED: **0**; release eligible: **0**; release: **UNRELEASED**; reviewers: **0**.
The production entries, reviewers, and release files were not written. This is research-only evidence and review metadata.

## 8. Files and deterministic method

- `data/terminology/research/m04b2e-source-manifest.json` — source identity, acquisition policy, traversal metrics, cache policy, and contribution metadata.
- `data/terminology/research/m04b2e-bulk-match-results.json` — one research-only result for every atlas concept.
- `data/terminology/research/corpora/m04b2e2r-nvh2008-exhaustive.jsonl` — compact safely reconstructed NVH rows.
- `data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl` — compact safely mapped Ministry rows.
- `.local/terminology-source-cache/` — ignored local PDF, extracted text, rendered stream, and staging only.
- `scripts/test-m04b2e2r.mjs` — exhaustive acquisition and production-safety regression test.

STOP after M04B2E-2R exhaustive public-source acquisition repair.