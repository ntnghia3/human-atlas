import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceIndex,
  loadSourceCatalogDocument,
  matchAtlasConcepts,
  normalizeMatchingText,
  readCorpusFiles,
  readJson,
  validateCorpusRecord,
} from './m04a-bulk-evidence.mjs';
import {computeCoverage, validateTerminologyData} from './validate-terminology.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...parts) => join(ROOT, ...parts);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function allStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) for (const item of value) allStrings(item, output);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) allStrings(item, output);
  return output;
}

const [atlas, sourceDocument, entriesDocument, reviewersDocument, releaseDocument, manifest, corpus] = await Promise.all([
  readJson(path('public', 'models', 'atlas.json')),
  readJson(path('data', 'terminology', 'sources.json')),
  readJson(path('data', 'terminology', 'entries.json')),
  readJson(path('data', 'terminology', 'reviewers.json')),
  readJson(path('data', 'terminology', 'release.json')),
  readJson(path('data', 'terminology', 'research', 'source-manifests', 'fipat-ta2-2019.json')),
  readCorpusFiles([path('data', 'terminology', 'research', 'corpora', 'fipat-ta2-2019.jsonl')]),
]);

const records = corpus.records;
const recordsByEntryId = new Map(records.map(record => [record.locator.entryId, record]));
const sourceCatalog = loadSourceCatalogDocument(sourceDocument);

check(manifest.sourceId === 'FIPAT_TA2', 'manifest must bind FIPAT_TA2');
check(manifest.sourceRevision === 'TA2-2019-online', 'manifest must bind TA2-2019-online');
check(manifest.extraction.parsedPartCount === 5, 'all five TA2 parts must be parsed');
check(manifest.extraction.corpusRecordCount === 7112, `corpus count must be 7112 real terminology rows; found ${manifest.extraction.corpusRecordCount}`);
check(manifest.extraction.uniqueTA2EntryCount === 7112, 'unique TA2 entry count must equal emitted record count');
check(manifest.extraction.extractionErrorCount === 0, 'extraction errors must be zero');
check(JSON.stringify(manifest.extraction.skippedNonTerminologyRows) === JSON.stringify([{partNumber: 2, page: 62, entryId: '2259', reason: 'blank printed table row; no source term or equivalent'}]), 'only the visually blank TA2 row 2259 may be skipped');
check(manifest.files.length === 5 && new Set(manifest.files.map(file => file.partNumber)).size === 5, 'manifest must contain one hashed file record for each part');
check(JSON.stringify(manifest.files.map(file => file.pdfPageCount)) === JSON.stringify([15, 104, 50, 69, 77]), 'part PDF page counts must match the inspected official files');
check(manifest.errata.inspected === true, 'official errata must be inspected');
check(manifest.errata.pdfPageCount === 25, 'errata PDF page count must be 25');
check(manifest.errata.versionCounts['2.07'] === 155, 'errata version 2.07 correction count must be 155');
check(manifest.errata.affectedTerminologyEntryCount === 306, 'cumulative errata must affect 306 emitted terminology rows');

check(records.length === 7112, `corpus must contain 7112 records; found ${records.length}`);
for (const [index, record] of records.entries()) {
  const errors = validateCorpusRecord(record, `records[${index}]`);
  check(errors.length === 0, errors.join('; '));
  check(record.sourceId === 'FIPAT_TA2', `record ${index} has the wrong sourceId`);
  check(record.sourceRevision === 'TA2-2019-online', `record ${index} has the wrong sourceRevision`);
  check(record.sourceEdition === 'Second edition 2.07', `record ${index} has the wrong sourceEdition`);
  check(record.sourceTermRaw === record.latin?.preferred, `record ${index} must preserve Latin as sourceTermRaw`);
  check(Number.isInteger(record.locator?.page) && record.locator.page > 0, `record ${index} must have an exact PDF page locator`);
  check(typeof record.locator?.entryId === 'string' && record.locator.entryId.length > 0, `record ${index} must have a FIPAT entryId locator`);
  check(typeof record.locator?.url === 'string' && record.locator.url.includes('FIPAT-TA2-Part-'), `record ${index} must have a reproducible part URL locator`);
  check(!('vietnamese' in record), `record ${index} must not generate a Vietnamese field`);
  check(!('terminologyIds' in record) && !('sourceCodes' in record), `record ${index} must not infer FMA/TA2 codes`);
  check(!('conceptId' in record) && !('atlasName' in record), `record ${index} must not interpret an Atlas Concept.id`);
  check(!Object.keys(record).some(key => key.toLowerCase().includes('normalized')), `record ${index} must not store normalized text`);
  for (const blockName of ['latin', 'english']) {
    for (const alias of record[blockName]?.aliases ?? []) check(alias !== record[blockName].preferred, `record ${index} promotes a ${blockName} alias to preferred`);
  }
  check(!allStrings(record).some(value => /^FMA\d+$/i.test(value)), `record ${index} contains an inferred FMA identifier`);
}

const row373 = recordsByEntryId.get('373');
check(row373?.english?.preferred === 'Pneumatised bone', 'UK English must be the deterministic preferred form for entry 373');
check(row373?.english?.aliases?.includes('Pneumatized bone'), 'US English must be preserved as an alias for entry 373');

const row380 = recordsByEntryId.get('380');
check(row380?.latin?.preferred === 'Substantia spongiosa', 'entry 380 must preserve the official Latin preferred term');
check(row380?.latin?.aliases?.includes('Substantia trabecularis'), 'entry 380 Latin synonym must remain an alias');
check(row380?.english?.preferred === 'Spongy bone' && row380?.english?.aliases?.includes('Trabecular bone'), 'entry 380 English synonym must remain an alias');

const parenthesized = recordsByEntryId.get('375');
check(parenthesized?.latin?.preferred === '(Os accessorium)', 'parenthesized FIPAT status must remain in the Latin source term');
check(parenthesized?.notes?.includes('fipatStatus=parenthesized'), 'parenthesized FIPAT status must be machine-visible in notes');

const errataRow = recordsByEntryId.get('403');
check(errataRow?.latin?.preferred === 'Centra ossificationis', 'errata row 403 must use the corrected 2.07 table value');
check(errataRow?.notes?.includes('errataApplied=TA2-2.07') && errataRow?.notes?.includes('errataPdfPages=13'), 'errata row 403 must retain errata version and PDF page provenance');

const index = buildSourceIndex({records, inputFiles: corpus.files, inputFileLabels: ['data/terminology/research/corpora/fipat-ta2-2019.jsonl'], sourceCatalogDocument: sourceDocument});
check(index.inputRecordCount === 7112 && index.indexedRecordCount === 7112, 'FIPAT index must retain all emitted records');
check(index.duplicateEvidenceRecordCount === 0, 'FIPAT extraction must not contain accidental byte-identical duplicates');
check(index.unresolvedSourceIds.length === 0 && index.sourceRevisionMismatches.length === 0, 'every FIPAT record must resolve to the exact source revision');

const englishGroups = new Map();
for (const record of records) {
  const key = record.english?.preferred;
  if (!englishGroups.has(key)) englishGroups.set(key, []);
  englishGroups.get(key).push(record.locator.entryId);
}
check([...englishGroups.values()].some(ids => ids.length > 1), 'distinct TA2 rows sharing an English string must remain distinct records');

const results = matchAtlasConcepts({
  atlas,
  index,
  sourceCatalog,
  m03cEntries: entriesDocument.entries,
});
check(results.summary.conceptCount === 3432 && results.summary.expectedConceptCount === 3432, 'exactly 3,432 atlas concepts must be processed');
check(results.summary.sourceMatchConceptCount + results.summary.noSourceMatchConceptCount === 3432, 'matched and unmatched concept counts must cover the atlas exactly');
check(results.summary.exactEnglishMatchConceptCount > 0, 'exact English match statistics must be produced');
check(results.summary.normalizedEnglishMatchConceptCount >= 0, 'normalized English match statistics must be produced');
check(results.summary.latinMatchConceptCount >= 0, 'Latin match statistics must be produced');
check(results.regression.frozenM03CConceptCount === 50 && results.regression.mismatchCount === 0, 'frozen M03C regression must have zero mismatches');

const validation = validateTerminologyData({
  atlas,
  sourcesDocument: sourceDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(validation.errors.length === 0, `production terminology validation must remain clean; found ${validation.errors.length} error(s)`);
const coverage = computeCoverage(atlas, entriesDocument.entries, sourceCatalog, Object.fromEntries(reviewersDocument.reviewers.map(reviewer => [reviewer.id, reviewer])));
check(coverage.searchableTerminologyEntries === 0, 'production searchable coverage must remain zero');
check(coverage.sourceVerifiedEntries === 0, 'SOURCE_VERIFIED coverage must remain zero');
check(coverage.medicallyReviewedEntries === 0, 'MEDICAL_REVIEWED coverage must remain zero');
check(coverage.releaseEligibleEntries === 0, 'release-eligible coverage must remain zero');
check(reviewersDocument.reviewers.length === 0, 'reviewer registry must remain unchanged');
check(releaseDocument.releaseStatus === 'UNRELEASED', 'release manifest must remain UNRELEASED');

if (failures.length) {
  console.error(`M04B1 tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B1 FIPAT TA2 corpus tests passed');
  console.log(`Corpus records: ${records.length}; unique TA2 entries: ${new Set(records.map(record => record.locator.entryId)).size}; errata rows: ${manifest.errata.affectedTerminologyEntryCount}`);
  console.log(`Atlas matches: exact-English=${results.summary.exactEnglishMatchConceptCount}; normalized-English=${results.summary.normalizedEnglishMatchConceptCount}; Latin=${results.summary.latinMatchConceptCount}; no-match=${results.summary.noSourceMatchConceptCount}`);
  console.log(`Research buckets: ${Object.entries(results.summary.bucketCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`M03C regression: ${results.regression.frozenM03CConceptCount} frozen concepts; mismatches=${results.regression.mismatchCount}`);
  console.log(`Production coverage: searchable=${coverage.searchableTerminologyEntries}; source-verified=${coverage.sourceVerifiedEntries}; medically-reviewed=${coverage.medicallyReviewedEntries}; release-eligible=${coverage.releaseEligibleEntries}`);
}
