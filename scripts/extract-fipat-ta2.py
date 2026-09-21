#!/usr/bin/env python3
"""Extract the official FIPAT TA2 2.07 tables into the M04A corpus.

The source PDFs are intentionally kept in .local-sources/fipat-ta2/ and are
never copied into the repository.  This script uses the table's fixed column
geometry and preserves source spelling, punctuation, parentheses, and UK/US
English separately.  Unicode normalization belongs to the M04A matcher, not
to extraction.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".local-sources" / "fipat-ta2"
CORPUS_PATH = ROOT / "data" / "terminology" / "research" / "corpora" / "fipat-ta2-2019.jsonl"
MANIFEST_PATH = ROOT / "data" / "terminology" / "research" / "source-manifests" / "fipat-ta2-2019.json"

SOURCE_ID = "FIPAT_TA2"
SOURCE_REVISION = "TA2-2019-online"
SOURCE_EDITION = "Second edition 2.07"
INDEX_URL = "https://libraries.dal.ca/Fipat/ta2.html"
ERRATA_URL = "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Errata.pdf"

PARTS = [
    {
        "number": 1,
        "roman": "I",
        "file": "FIPAT-TA2-Part-1.pdf",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-1.pdf",
        "first_table_page": 2,
        "last_table_page": 11,
    },
    {
        "number": 2,
        "roman": "II",
        "file": "FIPAT-TA2-Part-2.pdf",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf",
        "first_table_page": 2,
        "last_table_page": 80,
    },
    {
        "number": 3,
        "roman": "III",
        "file": "FIPAT-TA2-Part-3.pdf",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-3.pdf",
        "first_table_page": 2,
        "last_table_page": 38,
    },
    {
        "number": 4,
        "roman": "IV",
        "file": "FIPAT-TA2-Part-4.pdf",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-4.pdf",
        "first_table_page": 2,
        "last_table_page": 54,
    },
    {
        "number": 5,
        "roman": "V",
        "file": "FIPAT-TA2-Part-5.pdf",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-5.pdf",
        "first_table_page": 2,
        "last_table_page": 60,
    },
]

# The table columns are stable across the five letter-size landscape PDFs.
# These boundaries are between the printed column origins, not text widths.
COLUMN_BOUNDS = ((90, "number"), (203, "latin"), (317, "latin_synonym"), (430, "uk"), (543, "us"), (654, "english_synonym"), (10_000, "other"))

ACTION_PATTERNS = (
    (r"Latin term (?:corrected|placed in parentheses)", "latin.preferred"),
    (r"Latin synonym (?:corrected|added|deleted)", "latin.aliases"),
    (r"Latin related term (?:corrected|added|deleted)", "related.latin"),
    (r"English equivalents? (?:corrected|put in parentheses)", "english.preferred"),
    (r"UK English equivalent corrected", "english.uk"),
    (r"US English equivalent corrected", "english.us"),
    (r"English synonyms? (?:corrected|added|deleted)", "english.aliases"),
    (r"Related terms? (?:corrected|added|deleted)", "related.english"),
    (r"Hierarchical postition corrected|Hierarchical position corrected|Indented one more step", "hierarchy"),
    (r"Citation in text corrected", "citation"),
)


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def join_words(words: list[dict[str, Any]]) -> str:
    result = ""
    previous_x1 = None
    for word in sorted(words, key=lambda item: item["x0"]):
        text = str(word["text"])
        if not text:
            continue
        if result and previous_x1 is not None:
            # PDF glyph spacing splits words such as "Facie s" and "Ruga e".
            # A real printed word gap is about 1.8 points in these files.
            result += "" if float(word["x0"]) - previous_x1 <= 0.7 else " "
        result += text
        previous_x1 = float(word["x1"])
    return compact(result)


def column_for_x(x0: float) -> str:
    for boundary, name in COLUMN_BOUNDS:
        if x0 < boundary:
            return name
    return "other"


def grouped_lines(words: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        if not lines or abs(float(word["top"]) - float(lines[-1][0]["top"])) > 1.5:
            lines.append([])
        lines[-1].append(word)
    return lines


def is_non_table_line(line: list[dict[str, Any]]) -> bool:
    text = compact(" ".join(str(word["text"]) for word in sorted(line, key=lambda item: float(item["x0"]))))
    if not text:
        return True
    if "FIPAT.library.dal.ca" in text:
        return True
    if re.match(r"^(?:Caput\b|Latin term\s+Latin synonym\b|TERMINOLOGIA ANATOMICA\b|Second Edition\b|International Anatomical Terminology\b|The Federative International Programme\b|A programme of the International Federation\b|Contents:\b|Bibliographic Reference Citation:\b|Creative Commons License:\b)", text):
        return True
    return False


def clean_cell(value: str) -> str:
    value = re.sub(r"\bEndnote\s+\d+\b", "", value)
    return compact(value).strip(" ;")


def split_explicit_synonyms(value: str, preferred: str | None = None) -> list[str]:
    values = []
    for item in re.split(r"\s*;\s*", clean_cell(value)):
        item = compact(item)
        if not item:
            continue
        if preferred and item == preferred:
            continue
        if item not in values:
            values.append(item)
    return values


def parse_table_page(page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    lines = [line for line in grouped_lines(page.extract_words(x_tolerance=0.5, y_tolerance=1.5, keep_blank_chars=False)) if not is_non_table_line(line)]
    starts: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        number_words = [word for word in line if float(word["x0"]) < 90 and re.fullmatch(r"\d+", str(word["text"]))]
        if len(number_words) != 1:
            continue
        entry_id = str(number_words[0]["text"])
        if int(entry_id) <= 0 or int(entry_id) > 9999:
            continue
        starts.append((index, entry_id))

    rows: list[dict[str, Any]] = []
    for start_index, (line_index, entry_id) in enumerate(starts):
        end_line = starts[start_index + 1][0] if start_index + 1 < len(starts) else len(lines)
        cells: dict[str, list[str]] = defaultdict(list)
        for line in lines[line_index:end_line]:
            by_column: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for word in line:
                column = column_for_x(float(word["x0"]))
                if column != "number":
                    by_column[column].append(word)
            for column, column_words in by_column.items():
                text = join_words(column_words)
                if text:
                    cells[column].append(text)
        rows.append({"entry_id": entry_id, "cells": {key: clean_cell(" ".join(value)) for key, value in cells.items()}})
    return rows


def parse_errata() -> tuple[dict[str, list[dict[str, Any]]], dict[str, int], int]:
    """Return entry-id -> correction metadata, version counts, and page count."""
    path = CACHE_DIR / "FIPAT-TA2-Errata.pdf"
    if not path.exists():
        raise FileNotFoundError(f"Missing official errata PDF: {path}")

    corrections: dict[str, list[dict[str, Any]]] = defaultdict(list)
    version_counts: dict[str, int] = defaultdict(int)
    version = None
    part = None
    current: dict[str, Any] | None = None
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            lines = (page.extract_text() or "").splitlines()
            for line in lines:
                version_match = re.search(r"Corrections in version (\d+\.\d+)", line)
                if version_match:
                    version = version_match.group(1)
                    current = None
                    continue
                part_match = re.fullmatch(r"PART\s+([IVX]+)", line.strip())
                if part_match:
                    part = part_match.group(1)
                    current = None
                    continue
                entry_match = re.match(r"^(\d{1,4})\s+", line.strip())
                if entry_match and not line.lstrip().startswith("Endnote") and version and part:
                    entry_id = entry_match.group(1)
                    current = {"version": version, "part": part, "errataPage": page_number, "actions": []}
                    corrections[entry_id].append(current)
                    version_counts[version] += 1
                    continue
                if current:
                    for pattern, field in ACTION_PATTERNS:
                        if re.search(pattern, line, flags=re.IGNORECASE) and field not in current["actions"]:
                            current["actions"].append(field)

    return {key: value for key, value in corrections.items()}, dict(version_counts), len(pdf.pages)


def errata_note(entry_id: str, corrections: dict[str, list[dict[str, Any]]]) -> str | None:
    affected = corrections.get(entry_id)
    if not affected:
        return None
    versions = ",".join(sorted({item["version"] for item in affected}))
    pages = ",".join(str(item["errataPage"]) for item in affected)
    actions = ",".join(sorted({action for item in affected for action in item["actions"]}))
    parts = [f"errataApplied=TA2-{versions}", f"errataPdfPages={pages}", f"errataActions={actions or 'record-level correction'}"]
    parts.append("correctedValue=the extracted 2.07 field values")
    return "; ".join(parts)


def parse_chapter(text: str, previous: str | None) -> str | None:
    first_line = (text.splitlines() or [""])[0].strip()
    if "Chapter" in first_line:
        return first_line
    return previous


def build_record(part: dict[str, Any], page_number: int, chapter: str | None, row: dict[str, Any], corrections: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    cells = row["cells"]
    latin = cells.get("latin", "")
    if not latin:
        raise ValueError(f"entry {row['entry_id']} on part {part['number']} page {page_number} has no Latin term")

    latin_aliases = split_explicit_synonyms(cells.get("latin_synonym", ""), latin)
    uk = cells.get("uk", "")
    us = cells.get("us", "")
    english_preferred = uk or us or ""
    if not english_preferred:
        raise ValueError(f"entry {row['entry_id']} on part {part['number']} page {page_number} has no UK/US English equivalent")
    english_aliases: list[str] = []
    for value in (us if uk and us != uk else "", cells.get("english_synonym", "")):
        for alias in split_explicit_synonyms(value, english_preferred):
            if alias not in english_aliases:
                english_aliases.append(alias)

    status_markers = []
    if any(value.startswith("(") and value.endswith(")") for value in (latin, *latin_aliases, english_preferred, *english_aliases)):
        status_markers.append("fipatStatus=parenthesized; parenthesized source status is preserved")
    status_markers.append("englishPreferredRule=UK English when present; US English retained as an alias when distinct")
    correction = errata_note(row["entry_id"], corrections)
    if correction:
        status_markers.append(correction)

    locator: dict[str, Any] = {
        "page": page_number,
        "entryId": row["entry_id"],
        "section": f"TA2 Part {part['roman']}",
        "url": part["url"],
    }
    if chapter:
        locator["chapter"] = chapter

    record: dict[str, Any] = {
        "sourceId": SOURCE_ID,
        "sourceRevision": SOURCE_REVISION,
        "sourceEdition": SOURCE_EDITION,
        "locator": locator,
        "sourceLanguage": "Latin; English",
        "english": {"preferred": english_preferred},
        "latin": {"preferred": latin},
        "sourceTermRaw": latin,
        "context": f"FIPAT Terminologia Anatomica, TA2 Part {part['roman']}" + (f"; {chapter}" if chapter else ""),
        "notes": "; ".join(status_markers),
    }
    if english_aliases:
        record["english"]["aliases"] = english_aliases
    if latin_aliases:
        record["latin"]["aliases"] = latin_aliases
    return record


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def file_manifest(path: Path, url: str, part: int | None, page_count: int, retrieved_date: str) -> dict[str, Any]:
    result: dict[str, Any] = {
        "canonicalUrl": url,
        "sha256": sha256(path),
        "byteSize": path.stat().st_size,
        "retrievalDate": retrieved_date,
        "pdfPageCount": page_count,
    }
    if part is not None:
        result["partNumber"] = part
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrieval-date", default=date.today().isoformat())
    args = parser.parse_args()

    corrections, version_counts, errata_page_count = parse_errata()
    all_records: list[dict[str, Any]] = []
    part_manifests: list[dict[str, Any]] = []
    extraction_errors: list[str] = []
    skipped_non_terminology_rows: list[dict[str, Any]] = []
    parsed_parts = []

    for part in PARTS:
        pdf_path = CACHE_DIR / part["file"]
        if not pdf_path.exists():
            raise FileNotFoundError(f"Missing official TA2 PDF: {pdf_path}")
        chapter = None
        part_rows: list[dict[str, Any]] = []
        with pdfplumber.open(pdf_path) as pdf:
            part_manifests.append(file_manifest(pdf_path, part["url"], part["number"], len(pdf.pages), args.retrieval_date))
            for page_number in range(part["first_table_page"], part["last_table_page"] + 1):
                page = pdf.pages[page_number - 1]
                page_text = page.extract_text() or ""
                chapter = parse_chapter(page_text, chapter)
                rows = parse_table_page(page)
                for row in rows:
                    if not any(row["cells"].values()):
                        # The printed 2.07 table reserves identifier 2259 as a
                        # completely blank row between 2258 and 2260. It is
                        # not a terminology record and cannot satisfy the
                        # corpus contract without inventing source wording.
                        skipped_non_terminology_rows.append({
                            "partNumber": part["number"],
                            "page": page_number,
                            "entryId": row["entry_id"],
                            "reason": "blank printed table row; no source term or equivalent",
                        })
                        continue
                    try:
                        record = build_record(part, page_number, chapter, row, corrections)
                        all_records.append(record)
                        part_rows.append(row)
                    except ValueError as error:
                        extraction_errors.append(str(error))
        parsed_parts.append({"partNumber": part["number"], "tablePdfPageRange": [part["first_table_page"], part["last_table_page"]], "rowCount": len(part_rows)})

    entry_ids = [record["locator"]["entryId"] for record in all_records]
    if len(set(entry_ids)) != len(entry_ids):
        raise ValueError("Duplicate FIPAT entry IDs were emitted")
    skipped_ids = {item["entryId"] for item in skipped_non_terminology_rows}
    expected_ids = [str(value) for value in range(1, 7114) if str(value) not in skipped_ids]
    if entry_ids != expected_ids:
        missing = sorted(set(expected_ids) - set(entry_ids), key=int)
        extra = sorted(set(entry_ids) - set(expected_ids), key=int)
        raise ValueError(f"Expected contiguous TA2 IDs 1..7113; missing={missing[:20]} extra={extra[:20]}")
    if extraction_errors:
        raise ValueError("Extraction errors:\n" + "\n".join(extraction_errors[:20]))

    errata_affected = {entry_id: items for entry_id, items in corrections.items() if entry_id in set(entry_ids)}
    errata_affected_count = len(errata_affected)
    with (CACHE_DIR / "FIPAT-TA2-Errata.pdf").open("rb"):
        pass
    errata_manifest = file_manifest(CACHE_DIR / "FIPAT-TA2-Errata.pdf", ERRATA_URL, None, errata_page_count, args.retrieval_date)
    errata_manifest.update({
        "inspected": True,
        "versionCounts": version_counts,
        "affectedTerminologyEntryCount": errata_affected_count,
        "affectedTerminologyEntryIds": sorted(errata_affected, key=int),
        "application": "The downloaded part PDFs are already version 2.07; corrected fields were extracted and annotated with errata version/page/action provenance.",
    })

    CORPUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CORPUS_PATH.open("w", encoding="utf-8", newline="\n") as stream:
        for record in all_records:
            stream.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    manifest = {
        "manifestVersion": 1,
        "sourceId": SOURCE_ID,
        "sourceRevision": SOURCE_REVISION,
        "sourceEdition": SOURCE_EDITION,
        "retrievalDate": args.retrieval_date,
        "indexUrl": INDEX_URL,
        "indexRetrieval": "The specified index returned HTTP 404 on retrieval; the canonical direct Dalhousie CDN file URLs below were downloaded and inspected.",
        "files": part_manifests,
        "errata": errata_manifest,
        "extraction": {
            "script": "scripts/extract-fipat-ta2.py",
            "parsedPartCount": len(parsed_parts),
            "parsedParts": parsed_parts,
            "corpusRecordCount": len(all_records),
            "uniqueTA2EntryCount": len(set(entry_ids)),
            "extractionErrorCount": len(extraction_errors),
            "skippedNonTerminologyRows": skipped_non_terminology_rows,
            "pdfTableRowsAreContiguous": True,
            "englishPreferredRule": "UK English when present; US English is retained as an alias when distinct; otherwise use US English.",
            "normalization": "None during extraction; normalization is matching-only in M04A.",
            "vietnameseFieldsGenerated": False,
            "fmaMappingsGenerated": False,
            "atlasConceptIdsInterpreted": False,
        },
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Extracted {len(all_records)} records from {len(parsed_parts)} TA2 parts")
    print(f"Unique TA2 entry IDs: {len(set(entry_ids))}")
    print(f"Errata-affected terminology entries: {errata_affected_count}")
    print(f"Corpus: {CORPUS_PATH}")
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
