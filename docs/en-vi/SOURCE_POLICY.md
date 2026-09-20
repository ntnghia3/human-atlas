# Terminology Sources and Provenance Policy

## Purpose

The project must be able to explain where every production Vietnamese anatomical term came from without copying copyrighted textbook content into the repository. Entries reference stable source IDs; source metadata is maintained separately.

No unverifiable bibliographic fact is to be invented. If a source record cannot be verified, it must not be used for a VERIFIED entry.

## Source classes

| Source class | Intended use | Authority |
| --- | --- | --- |
| international-nomenclature | TA2, Terminologia Anatomica, FMA, BodyParts3D identity, and other recognized nomenclature or identity standards. | Identity and canonical naming where the mapping is verified. |
| vietnamese-authoritative | Vietnamese medical or anatomical textbooks, university or institutional terminology, and other authoritative Vietnamese references. | Vietnamese preferred terminology, with a precise citation or locator. |
| secondary-reference | Review articles, specialist references, or other useful corroboration. | Supporting evidence; not automatically sufficient for a preferred production term. |
| machine-generated | AI, machine translation, language-model suggestion, or automated candidate generation. | Candidate discovery only; never equivalent to reviewed medical authority. |

## M02A registry boundary

The authoritative registry is now stored as two static, Git-reviewable JSON documents:

- `data/terminology/sources.json` contains `{ "schemaVersion": 1, "sources": [] }` records keyed by stable `id`.
- `data/terminology/entries.json` contains `{ "schemaVersion": 1, "entries": [] }` records with an explicit `key` that must equal `conceptId`.

The validator loads these files together with the current `public/models/atlas.json`. The runtime overlay and source catalog in `app/terminology.ts` remain empty in M02A; this deliberate validation/runtime boundary prevents an unreviewed registry edit from becoming displayable before the reviewed pilot integration milestone. The registry is not a UI dictionary, geometry manifest, backend database, or translation cache.

Every source record requires a title, source class, explicit capability flags, and an audit object. Optional bibliographic metadata includes authors, institution, edition, publication year, publisher, ISBN, URL, access date, language, version, and license note. Placeholder metadata such as `TODO`, `TBD`, `UNKNOWN`, `PLACEHOLDER`, or `N/A` is invalid.

## Authority capabilities

Capabilities are explicit and are not inferred from a source class:

| Capability | Meaning | Release use |
| --- | --- | --- |
| anatomical-identity | Can substantiate identity against an anatomical source or nomenclature identifier. | Required for FMA/TA2 provenance locators. |
| canonical-latin | Can substantiate canonical Latin wording. | Permits mapped Latin evidence, not Vietnamese display. |
| vietnamese-preferred | Can substantiate a Vietnamese preferred term. | At least one such source is required for release. |
| secondary-corroboration | Can provide supporting evidence only. | Never sufficient alone for a preferred production term. |
| machine-candidate-discovery | May produce candidates for review. | Never medical or release authority. |

`machine-generated` records may advertise only `machine-candidate-discovery`. Non-machine records may not advertise machine discovery. `international-nomenclature` records provide identity and/or canonical Latin, `vietnamese-authoritative` records provide Vietnamese preferred wording, and `secondary-reference` records provide corroboration without canonical authority.

Source audit status is `UNVERIFIED` or `VERIFIED`. A verified source must include a verification date and named verifier. An entry cannot use an unverified or machine-only source in the release gate.

An entry’s provenance contains `sourceId` plus a structured locator. Supported locator fields are `page`, `chapter`, `section`, `table`, `entryId`, `url`, and `nomenclatureId`, with optional checked date and note. A release-candidate reference must contain at least one reproducible locator. A source ID that is missing from the catalog is invalid.

For a Vietnamese VERIFIED entry, the release validator requires source-verification, non-automated medical-review, and release-eligibility audit records; verified non-machine provenance; a Vietnamese-preferred source capability; and matching `nomenclatureId` locators for any FMA or TA2 identifiers. International nomenclature sources can establish identity or Latin but do not, by themselves, establish Vietnamese preferred wording.

## Copyright and citation boundaries

The repository may store source metadata, short citations, stable URLs, page or section locators, and review notes needed to identify evidence. It must not scrape textbooks or copy large copyrighted passages.

BodyParts3D attribution remains in public/ATTRIBUTION.md. The current BodyParts3D CC BY 4.0 terms and adaptation description must remain visible. The application code remains MIT-licensed. Future terminology source records must preserve any source-specific license or access restrictions.

## Candidate workflow

1. Establish the target concept identity from the current atlas and relevant nomenclature IDs.
2. Record authoritative source IDs and exact locators.
3. Enter a candidate as DRAFT or UNMAPPED, never as a production label.
4. Compare directional, structural, and category semantics.
5. Obtain appropriate medical review.
6. Set VERIFIED only after provenance, source registry, mapping, and QA checks pass.
7. Keep rejected and unresolved states explicit; do not silently delete uncertainty.

## Upstream sources

The packaged atlas is BodyParts3D 4.0 with FMA-like concept IDs and BodyParts3D element IDs. Upstream refreshes must be audited before terminology is reused. The source concept identity, source mesh identity, and terminology source identity are separate namespaces even when their values resemble one another.
