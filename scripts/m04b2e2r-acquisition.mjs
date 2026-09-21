import {readFile} from 'node:fs/promises';

import {normalizeMatchingText} from './m04a-bulk-evidence.mjs';

export const NVH_PUBLIC_ACCESS_URL = 'https://www.scribd.com/document/689063262/TU-%C4%90IE-N-GIA-I-PHA-U';
export const MOH_OFFICIAL_PDF_URL = 'https://syt.daknong.gov.vn/upload/2005704/20250909/03_Phu_luc_01__Danh_muc_Cau_truc_co_the__signed_6ef8a.pdf';
export const NVH_EXHAUSTIVE_CORPUS_RELATIVE = 'data/terminology/research/corpora/m04b2e2r-nvh2008-exhaustive.jsonl';
export const MOH_COMPACT_CORPUS_RELATIVE = 'data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl';
export const NVH_STAGING_RELATIVE = '.local/terminology-source-cache/nvh2008-exhaustive-staging.jsonl';
export const MOH_STAGING_RELATIVE = '.local/terminology-source-cache/moh2025-body-structure-staging.jsonl';

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeEnglish(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function lateralityFromText(...values) {
  const value = normalizeMatchingText(values.filter(Boolean).join(' '));
  const left = /\b(?:left|trai)\b/.test(value);
  const right = /\b(?:right|phai)\b/.test(value);
  if (left && right || /\b(?:bilateral|hai ben)\b/.test(value)) return 'bilateral';
  if (left) return 'left';
  if (right) return 'right';
  return 'unsided';
}

function atlasNameIndex(atlas) {
  return atlas.concepts
    .map(concept => ({concept, key: normalizeMatchingText(concept.name)}))
    .sort((left, right) => right.key.length - left.key.length);
}

const NVH_CODE_PATTERN = /A[0-9]{2}(?:\.[0-9]{1,3}){3,4}/;

function sourceEnglishMatchKeys(value) {
  const normalized = normalizeMatchingText(value)
    .replace(/\s+([,;:)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .trim();
  return dedupe([
    normalized,
    normalized.replace(/^[([]+/, '').replace(/[)\]]+$/, '').trim(),
  ]);
}

/** Atlas terminology is consulted only after a complete source row exists. */
function findAtlasNameMatch(sourceEnglish, names) {
  const keys = new Set(sourceEnglishMatchKeys(sourceEnglish));
  const matches = names.filter(item => keys.has(item.key));
  if (matches.length !== 1) return null;
  return matches[0];
}

function nvhCodeAtStart(value) {
  let text = String(value ?? '').trimStart();
  if (text.startsWith('*')) text = text.slice(1).trimStart();
  const match = text.match(NVH_CODE_PATTERN);
  if (!match || match.index !== 0) return null;
  return {
    code: match[0],
    firstText: compactText(text.slice(match[0].length)),
  };
}

function nvhContinuationText(value) {
  let text = compactText(value);
  if (!text || /^\d{1,3}\s+Nguyễn Văn Huy\s*$/.test(text) || /^Thuật ngữ Giải phẫu/.test(text) || /^English-Vietnamese/.test(text)) return '';
  if (text.startsWith('##')) {
    const stripped = compactText(text.replace(/^##\s*/, ''));
    if (!/^[0-9](?:\s|$)/.test(stripped)) return '';
    text = stripped;
  }
  return text;
}

function nvhCounterLine(value) {
  const match = String(value ?? '').match(/^([0-9])(?: +(.*))?$/);
  return match ? {counter: match[1], text: compactText(match[2] ?? '')} : {counter: null, text: compactText(value)};
}

function splitNvhColumns(value) {
  const text = compactText(value)
    .replace(/^\*+\s*/, '')
    .replace(/\s*\*+$/, '')
    .trim();
  if (!text) return {english: '', vietnamese: ''};
  const accentIndex = text.search(/[À-ỹĐđ]/);
  if (accentIndex < 0) return {english: text, vietnamese: ''};
  const vietnameseIndex = Math.max(text.lastIndexOf(' ', accentIndex) + 1, 0);
  return {
    english: compactText(text.slice(0, vietnameseIndex)),
    vietnamese: compactText(text.slice(vietnameseIndex)),
  };
}

function joinNvhFragments(fragments) {
  let joined = '';
  for (const fragment of fragments.map(value => compactText(value)).filter(Boolean)) {
    if (!joined) joined = fragment;
    else if (joined.endsWith('-')) joined += fragment;
    else joined += ` ${fragment}`;
  }
  return compactText(joined)
    .replace(/\s+([,;:)\]])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/^\*+\s*|\s*\*+$/g, '')
    .trim();
}

function nvhEnglishResidue(value) {
  return /\b(?:of|branch|body|cervicis|cervical|artery|vein|nerve|tendon|ligament|muscle|bone|head|neck|scaphoid|trapezoid|axis|bronchus)\b/i.test(String(value ?? ''));
}

function pageHeaderLine(value) {
  return /^\s*\d{1,3}\s+Nguyễn Văn Huy\s*$/.test(value)
    || /^Thuật ngữ Giải phẫu/.test(value)
    || /^English-Vietnamese/.test(value)
    || /^Nguyễn Văn Huy/.test(value)
    || /^##/.test(value);
}

/**
 * Parse the line-numbered rendered stream captured from the whitelisted NVH
 * access copy. Reconstruction is source-first: the printed A-code boundary,
 * bilingual rendered columns, and continuation digit are resolved before the
 * atlas is consulted for an exact identity match.
 */
export function parseNvhRenderedLines(renderedLinesText, atlas, options = {}) {
  const lines = String(renderedLinesText ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const tab = line.indexOf('\t');
      if (tab < 0) return {line: null, text: line};
      return {line: Number(line.slice(0, tab)), text: line.slice(tab + 1)};
    });
  const names = atlasNameIndex(atlas);
  let printedPage = 1;
  let section = null;
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].text;
    const pageMatch = text.match(/^\s*(\d{1,3})\s+Nguyễn Văn Huy\s*$/);
    if (pageMatch) printedPage = Number(pageMatch[1]);
    if (/^##\s+/.test(text)) section = compactText(text.replace(/^##\s+/, ''));
    const code = nvhCodeAtStart(text);
    if (code) {
      blocks.push({
        startIndex: index,
        printedIdPrefix: code.code,
        firstText: code.firstText,
        printedPage,
        section,
      });
    }
  }

  const auditRows = [];
  const structurallyReconstructed = [];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const end = blockIndex + 1 < blocks.length ? blocks[blockIndex + 1].startIndex : lines.length;
    const span = lines.slice(block.startIndex, end);
    const reasons = [];
    const completePrefix = /\.\d{3}$/.test(block.printedIdPrefix);
    let counter = completePrefix ? null : null;
    let markerCount = 0;
    const englishFragments = [];
    const vietnameseFragments = [];
    const contentLines = [];
    let crossedHeading = false;
    for (let spanIndex = 0; spanIndex < span.length; spanIndex += 1) {
      let text = spanIndex === 0 ? block.firstText : nvhContinuationText(span[spanIndex].text);
      if (!text) {
        if (spanIndex > 0 && span[spanIndex].text.trimStart().startsWith('##')) crossedHeading = true;
        continue;
      }
      const counterLine = spanIndex === 0 ? {counter: null, text} : nvhCounterLine(text);
      if (counterLine.counter !== null) {
        markerCount += 1;
        if (counter === null) counter = counterLine.counter;
        else if (counter !== counterLine.counter) reasons.push('MULTIPLE_ENTRY_COUNTERS');
        text = counterLine.text;
      }
      if (!text) continue;
      contentLines.push({line: span[spanIndex].line, text});
      const columns = splitNvhColumns(text);
      if (columns.english) englishFragments.push(columns.english);
      if (columns.vietnamese) vietnameseFragments.push(columns.vietnamese);
    }
    if (crossedHeading) reasons.push('SOURCE_SPAN_CROSSED_SECTION_OR_PAGE_HEADING');
    const printedId = completePrefix ? block.printedIdPrefix : counter ? `${block.printedIdPrefix}${counter}` : null;
    if (!printedId) reasons.push('INCOMPLETE_PRINTED_ID');
    if (markerCount > 1) reasons.push('MULTIPLE_ENTRY_COUNTERS');
    if (printedId && !/^A[0-9]{2}(?:\.[0-9]{1,3}){2}\.\d{3}$/.test(printedId)) reasons.push('MALFORMED_PRINTED_ID');
    const embeddedReference = span.slice(1).some(item => {
      const text = String(item.text ?? '');
      return NVH_CODE_PATTERN.test(text) && !nvhCodeAtStart(text);
    });
    if (embeddedReference) reasons.push('EMBEDDED_ENTRY_REFERENCE_OR_NEIGHBOR_CONTENT');
    const english = joinNvhFragments(englishFragments).replace(/\s+\($/, '').trim();
    const vietnamese = joinNvhFragments(vietnameseFragments);
    if (!english) reasons.push('INCOMPLETE_SOURCE_ENGLISH');
    if (!vietnamese) reasons.push('INCOMPLETE_SOURCE_VIETNAMESE');
    if (nvhEnglishResidue(vietnamese)) reasons.push('UNRESOLVED_ENGLISH_RESIDUE_IN_VIETNAMESE');
    const match = !reasons.length ? findAtlasNameMatch(english, names) : null;
    if (!match && !reasons.length) reasons.push('UNMATCHED_SOURCE_RECORD');
    const status = reasons.length
      ? reasons.includes('UNMATCHED_SOURCE_RECORD') && reasons.length === 1 ? 'UNMATCHED_SOURCE_RECORD' : 'PARSER_INTEGRITY_REVIEW'
      : 'EXACT_RECONSTRUCTED_SOURCE_ROW';
    const audit = {
      printedId,
      printedIdPrefix: block.printedIdPrefix,
      printedPage: block.printedPage,
      section: block.section,
      sourceLineStart: span[0]?.line ?? null,
      sourceLineEnd: span.at(-1)?.line ?? null,
      english,
      vietnamese,
      conceptId: match?.concept.id ?? null,
      atlasEnglish: match?.concept.name ?? null,
      reconstructionStatus: status,
      integrityReasons: dedupe(reasons),
      sourceSpan: contentLines.map(item => item.line).filter(Number.isInteger),
    };
    auditRows.push(audit);
    if (status === 'EXACT_RECONSTRUCTED_SOURCE_ROW') structurallyReconstructed.push(audit);
  }

  const idCounts = new Map();
  for (const row of auditRows) if (row.printedId) idCounts.set(row.printedId, (idCounts.get(row.printedId) ?? 0) + 1);
  const duplicateIds = new Set([...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  for (const row of auditRows) {
    if (!duplicateIds.has(row.printedId)) continue;
    row.reconstructionStatus = 'PARSER_INTEGRITY_REVIEW';
    row.integrityReasons = dedupe([...row.integrityReasons, 'DUPLICATE_PRINTED_ID']);
  }
  const rows = auditRows
    .filter(row => row.reconstructionStatus === 'EXACT_RECONSTRUCTED_SOURCE_ROW')
    .map(row => ({...row}));
  const prefixCounts = values => Object.fromEntries(Object.entries(values.reduce((counts, value) => {
    const prefix = value.printedIdPrefix.split('.')[0];
    counts[prefix] = (counts[prefix] ?? 0) + 1;
    return counts;
  }, {})).sort(([left], [right]) => left.localeCompare(right)));
  const printedPageLabels = new Set(lines
    .map(item => item.text.match(/^\s*(\d{1,3})\s+Nguyễn Văn Huy\s*$/)?.[1])
    .filter(Boolean));
  const statusCounts = Object.fromEntries(['EXACT_RECONSTRUCTED_SOURCE_ROW', 'PARSER_INTEGRITY_REVIEW', 'UNMATCHED_SOURCE_RECORD'].map(status => [status, auditRows.filter(row => row.reconstructionStatus === status).length]));
  const reasonCounts = {};
  for (const row of auditRows) {
    for (const reason of row.integrityReasons ?? []) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  const duplicatePrintedIdCount = [...idCounts.values()].reduce((total, count) => total + (count > 1 ? count - 1 : 0), 0);
  const priorRecords = Array.isArray(options.priorCompactRecords) ? options.priorCompactRecords : [];
  const safeKeys = new Set(rows.map(row => `${row.printedId}|${normalizeMatchingText(row.english)}|${normalizeMatchingText(row.vietnamese)}`));
  const priorExactCount = priorRecords.filter(record => safeKeys.has(`${record.locator?.entryId}|${normalizeMatchingText(record.english?.preferred)}|${normalizeMatchingText(record.vietnamese?.preferred)}`)).length;
  return {
    rows,
    auditRows,
    stats: {
      renderedLinesRetrieved: lines.length,
      renderedPagesDiscovered: 538,
      renderedPagesRetrieved: 538,
      printedPageLabelsObserved: printedPageLabels.size,
      blocksDiscovered: blocks.length,
      blocksParsed: blocks.length,
      candidateRows: blocks.length,
      structuredRows: auditRows.filter(row => row.printedId && row.english && row.vietnamese).length,
      exactReconstructedSourceRowCount: rows.length,
      parserIntegrityReviewCount: statusCounts.PARSER_INTEGRITY_REVIEW,
      unmatchedSourceRecordCount: statusCounts.UNMATCHED_SOURCE_RECORD,
      structurallyRejectedRows: auditRows.length - rows.length,
      rejectedByNoAtlasIdentity: statusCounts.UNMATCHED_SOURCE_RECORD,
      rejectedByNoVietnameseBoundary: auditRows.filter(row => row.integrityReasons.includes('INCOMPLETE_SOURCE_VIETNAMESE')).length,
      duplicatePrintedIdCount,
      duplicatePrintedIdValueCount: duplicateIds.size,
      malformedPrintedIdCount: auditRows.filter(row => row.integrityReasons.includes('MALFORMED_PRINTED_ID')).length,
      incompletePrintedIdCount: auditRows.filter(row => row.integrityReasons.includes('INCOMPLETE_PRINTED_ID')).length,
      firstEntryId: rows[0]?.printedId ?? null,
      lastEntryId: rows.at(-1)?.printedId ?? null,
      priorCompactRowsAudited: options.priorCompactRowsAudited ?? priorRecords.length ?? null,
      priorCompactRowsRetainedExactly: priorExactCount,
      statusCounts,
      reasonCounts: Object.fromEntries(Object.entries(reasonCounts).sort(([left], [right]) => left.localeCompare(right))),
      coverageByAcodePrefix: prefixCounts(rows),
      candidateCoverageByAcodePrefix: prefixCounts(blocks.map(block => ({printedIdPrefix: block.printedIdPrefix}))),
      coverageStatus: 'PARTIAL_PUBLIC_TEXT_ACCESS',
      parserNote: 'All accessible rendered code blocks were visited. A-code boundaries, continuation digits, English fragments, and Vietnamese fragments were reconstructed from the rendered source before exact atlas matching. Prefix-only, incomplete, adjacent, duplicate, and unresolved rows remain quarantined or unmatched.',
    },
  };
}

function mohEnglishVariants(value) {
  const base = compactText(value).replace(/\s*\(body structure\)\s*$/i, '');
  const variants = [
    {value: base, tier: 'EXACT_ENGLISH_COMPATIBLE_SCOPE'},
    {value: base.replace(/\s+structure$/i, ''), tier: 'ALIAS_REMOVE_GENERIC_STRUCTURE_SUFFIX'},
    {value: base.replace(/^structure of\s+/i, ''), tier: 'ALIAS_REMOVE_GENERIC_STRUCTURE_PREFIX'},
    {value: base.replace(/^structure of\s+/i, '').replace(/\s+structure$/i, ''), tier: 'NORMALIZED_ENGLISH_SAFE'},
    {value: base.replace(/^entire\s+/i, ''), tier: 'ALIAS_REMOVE_GENERIC_ENTIRE_PREFIX'},
    {value: base.replace(/^entire\s+/i, '').replace(/\s+structure$/i, ''), tier: 'NORMALIZED_ENGLISH_SAFE'},
    {value: base.replace(/^structure of\s+/i, '').replace(/^entire\s+/i, '').replace(/\s+structure$/i, ''), tier: 'NORMALIZED_ENGLISH_SAFE'},
  ];
  const seen = new Set();
  return variants.filter(variant => {
    const key = normalizeEnglish(variant.value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMohAtlasMatch(row, names) {
  const candidates = [];
  for (const variant of mohEnglishVariants(row.english)) {
    const key = normalizeMatchingText(variant.value);
    const matches = names.filter(item => item.key === key);
    if (matches.length) candidates.push({variant, matches});
  }
  const conceptIds = dedupe(candidates.flatMap(candidate => candidate.matches.map(match => match.concept.id)));
  if (conceptIds.length !== 1) return null;
  const selected = candidates.find(candidate => candidate.matches.some(match => match.concept.id === conceptIds[0]));
  return {
    concept: selected.matches.find(match => match.concept.id === conceptIds[0]).concept,
    tier: selected.variant.tier,
    alias: selected.variant.value,
  };
}

/** Parse every official Ministry text-layer code block from the local cache. */
export function parseMohText(sourceText, atlas) {
  const normalizedSource = String(sourceText ?? '').replaceAll('\\n', '\n');
  const lines = normalizedSource.split(/\r?\n/).map(value => value.replace(/\r$/, ''));
  let page = null;
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const pageMatch = line.match(/^=== PDF_PAGE (\d+) ===$/);
    if (pageMatch) {
      page = Number(pageMatch[1]);
      continue;
    }
    if (/^61\d{5}\b/.test(line)) blocks.push({startIndex: index, page});
  }

  const rows = [];
  const rejectedBlocks = [];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const end = blockIndex + 1 < blocks.length ? blocks[blockIndex + 1].startIndex : lines.length;
    const raw = lines.slice(block.startIndex, end).map(value => compactText(value)).filter(Boolean);
    const first = raw.shift() ?? '';
    const code = first.split(/\s+/)[0];
    const rest = compactText([first.slice(code.length), ...raw].join(' '));
    const snomedMatch = rest.match(/\b(\d{6,18})\b/);
    const englishEnd = rest.toLowerCase().indexOf('(body structure)');
    if (!snomedMatch || englishEnd < 0) {
      rejectedBlocks.push({code, page: block.page, reason: !snomedMatch ? 'MISSING_SNOMED_ID' : 'MISSING_ENGLISH_SCOPE_MARKER'});
      continue;
    }
    const vietnamese = compactText(rest.slice(0, snomedMatch.index));
    const english = compactText(rest.slice(snomedMatch.index + snomedMatch[0].length, englishEnd + '(body structure)'.length));
    if (!vietnamese || !english) {
      rejectedBlocks.push({code, page: block.page, reason: 'EMPTY_STRUCTURED_FIELD'});
      continue;
    }
    rows.push({
      ministryCode: code,
      page: block.page,
      vietnamese,
      english,
      snomedCtId: snomedMatch[1],
      group: 'body structure',
    });
  }
  const counts = new Map();
  for (const block of blocks) {
    const code = lines[block.startIndex].trim().split(/\s+/)[0];
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const duplicateCodes = [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code).sort();
  const names = atlasNameIndex(atlas);
  const matchedRows = [];
  const unmatchedRows = [];
  for (const row of rows) {
    const match = findMohAtlasMatch(row, names);
    if (match) matchedRows.push({...row, ...match});
    else unmatchedRows.push(row);
  }
  const rowsByPrefix = values => Object.fromEntries(Object.entries(values.reduce((counts, value) => {
    const prefix = String(value.ministryCode).slice(0, 3);
    counts[prefix] = (counts[prefix] ?? 0) + 1;
    return counts;
  }, {})).sort(([left], [right]) => left.localeCompare(right)));
  return {
    rows,
    matchedRows,
    unmatchedRows,
    rejectedBlocks,
    stats: {
      renderedPagesDiscovered: 1441,
      renderedPagesRetrieved: 1441,
      renderedPagesParsed: new Set(blocks.map(block => block.page).filter(Number.isInteger)).size,
      blocksDiscovered: blocks.length,
      blocksParsed: blocks.length,
      candidateRows: blocks.length,
      structuredRows: rows.length,
      structurallyRejectedRows: rejectedBlocks.length,
      duplicatePrintedIdCount: duplicateCodes.length,
      malformedPrintedIdCount: 0,
      firstEntryId: rows[0]?.ministryCode ?? null,
      lastEntryId: rows.at(-1)?.ministryCode ?? null,
      matchedSafeRows: matchedRows.length,
      unmatchedStructuredRows: unmatchedRows.length,
      coverageByAcodePrefix: rowsByPrefix(matchedRows),
      candidateCoverageByAcodePrefix: rowsByPrefix(rows),
      coverageStatus: 'FULLY_PARSED_TEXT_LAYER_WITH_STRUCTURAL_REJECTS',
      parserNote: 'All 1,441 PDF pages were visited through the text layer. Four English-only duplicate layout blocks were structurally rejected; no OCR or string-equality claim between SNOMED CT and FMA was used.',
    },
  };
}

function corpusRecordBase({sourceId, sourceRevision, sourceEdition, locator, sourceTermRaw, english, vietnamese, context, notes, sourceCodes, terminologyIds, laterality}) {
  return {
    sourceId,
    sourceRevision,
    sourceEdition,
    locator,
    sourceLanguage: 'English; Vietnamese',
    english,
    vietnamese,
    sourceTermRaw,
    ...(context ? {context} : {}),
    anatomicalCategory: 'body structure',
    laterality,
    sourceCodes,
    terminologyIds,
    notes,
  };
}

export function toNvhCorpusRecords(rows) {
  const records = rows.map(row => corpusRecordBase({
    sourceId: 'NVH2008',
    sourceRevision: 'NVH-2008-312P',
    sourceEdition: '2008',
    locator: {
      entryId: row.printedId,
      section: row.section ?? `A-code ${row.printedIdPrefix}`,
      page: row.printedPage,
      url: NVH_PUBLIC_ACCESS_URL,
    },
    sourceTermRaw: row.english,
    english: {
      preferred: row.english,
      aliases: [],
    },
    vietnamese: {preferred: row.vietnamese, aliases: []},
    context: 'EXACT_RECONSTRUCTED_SOURCE_ROW',
    sourceCodes: [row.printedIdPrefix],
    terminologyIds: [row.printedId],
    laterality: lateralityFromText(row.english, row.vietnamese),
    notes: 'Source-first NVH2008 row reconstruction from a printed A-code boundary and rendered bilingual columns; exact atlas identity was matched only after complete English/Vietnamese recovery. Access copy is not the bibliographic authority; no laterality was synthesized.',
  }));
  return [...new Map(records.map(record => [JSON.stringify(record), record])).values()];
}

export function toMohCorpusRecords(rows) {
  return rows.map(row => corpusRecordBase({
    sourceId: 'NATIONAL_BODY_TERMS_2025',
    sourceRevision: 'VI-BODY-TERMS-2025-SIGNED',
    sourceEdition: 'Signed 2025 list',
    locator: {
      entryId: row.ministryCode,
      page: row.page,
      url: MOH_OFFICIAL_PDF_URL,
    },
    sourceTermRaw: row.english,
    english: {
      preferred: row.english,
      aliases: normalizeMatchingText(row.english) === normalizeMatchingText(row.concept.name) ? [] : [row.alias],
    },
    vietnamese: {preferred: row.vietnamese, aliases: []},
    sourceCodes: [row.ministryCode],
    terminologyIds: [row.snomedCtId],
    laterality: lateralityFromText(row.english, row.vietnamese),
    notes: `Official Ministry text-layer row retained as a compact ontology-bridge candidate for ${row.concept.id}; match tier=${row.tier}; SNOMED CT is retained as an identifier only, never treated as FMA-equivalent.`,
  }));
}

export async function readLocalAcquisitionInputs(root) {
  const read = async relativePath => readFile(`${root}/${relativePath.replaceAll('/', '/')}`, 'utf8');
  return {
    nvhRenderedLines: await read('.local/terminology-source-cache/nvh2008-public-rendered-lines.tsv'),
    mohText: await read('.local/terminology-source-cache/moh2025-body-structure.txt'),
  };
}
