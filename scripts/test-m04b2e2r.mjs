import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeMatchingText, validateCorpusRecord} from './m04a-bulk-evidence.mjs';
import {
  MOH_COMPACT_CORPUS_RELATIVE,
  MOH_OFFICIAL_PDF_URL,
  NVH_EXHAUSTIVE_CORPUS_RELATIVE,
  NVH_PUBLIC_ACCESS_URL,
} from './m04b2e2r-acquisition.mjs';
import {
  EXPECTED_CONCEPT_COUNT,
  MANIFEST_PATH,
  OUTPUT_PATH,
  REPORT_PATH,
  buildM04B2E,
} from './m04b2e-bulk-ingestion.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...parts) => join(ROOT, ...parts);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function stableCanonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCanonical(value[key])}`).join(',')}}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function gitOutput(...args) {
  return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
}

function baselineFile(relativePath) {
  return execFileSync('git', ['show', `HEAD:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function jsonlRecords(text) {
  return text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
}

function sourceMetric(output, sourceId) {
  const result = output.sourceMetrics.find(item => item.sourceId === sourceId);
  check(Boolean(result), `missing source metric ${sourceId}`);
  return result ?? {};
}

function sourceAcquisition(manifest, sourceId) {
  const result = manifest.publicWebAcquisition.sources.find(item => item.sourceId === sourceId);
  check(Boolean(result), `missing acquisition source ${sourceId}`);
  return result ?? {};
}

function hasDeepKey(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some(item => hasDeepKey(item, key));
}

const [manifest, output, report, rebuilt] = await Promise.all([
  readJson(MANIFEST_PATH),
  readJson(OUTPUT_PATH),
  readFile(REPORT_PATH, 'utf8'),
  buildM04B2E(),
]);

check(manifest.schemaVersion === 'm04b2e2r-source-manifest-1', 'M04B2E-2R manifest schema is incorrect');
check(manifest.milestone === 'M04B2E-2R', 'M04B2E-2R manifest milestone is incorrect');
check(manifest.status === 'RESEARCH_ONLY_NOT_RELEASE', 'M04B2E-2R manifest must remain research-only');
check(manifest.sourcePolicy.fullSourceCacheAllowedLocally === true, 'full source cache must be allowed locally');
check(manifest.sourcePolicy.fullSourceBodiesInGit === false, 'full source bodies must remain out of Git');
check(!Object.prototype.hasOwnProperty.call(manifest.sourcePolicy, 'noWholeBookCache'), 'obsolete noWholeBookCache policy must not remain');
check(output.schemaVersion === 'm04b2e2r-bulk-match-results-1', 'M04B2E-2R output schema is incorrect');
check(output.milestone === 'M04B2E-2R', 'M04B2E-2R output milestone is incorrect');
check(output.status === 'RESEARCH_ONLY_NOT_RELEASE', 'M04B2E-2R output must remain research-only');
check(stableCanonical(manifest) === stableCanonical(rebuilt.manifest), 'M04B2E-2R manifest is not deterministic');
check(stableCanonical(output) === stableCanonical(rebuilt.output), 'M04B2E-2R output is not deterministic');
check(report === rebuilt.report, 'M04B2E-2R report is not deterministic');

check(output.concepts.length === EXPECTED_CONCEPT_COUNT, 'result must contain exactly 3,432 concepts');
check(output.conceptAccounting.actualConceptCount === EXPECTED_CONCEPT_COUNT, 'actual concept count is incorrect');
check(output.conceptAccounting.uniqueConceptCount === EXPECTED_CONCEPT_COUNT, 'concept IDs are not unique');
check(output.conceptAccounting.duplicateConceptCount === 0, 'duplicate concept IDs were emitted');
check(output.conceptAccounting.missingConceptIds.length === 0, 'atlas concepts are missing');
check(output.concepts.every(result => !('vietnamese' in result) && !('mapping' in result) && !('release' in result)), 'research output wrote production terminology fields');
check(output.summary.duplicateEvidenceRecordCount === 0, 'identical evidence records were double-counted');
check(output.summary.unresolvedSourceIds.length === 0, `unresolved source IDs: ${output.summary.unresolvedSourceIds.join(', ')}`);
check(output.summary.sourceRevisionMismatches.length === 0, `source revision mismatches: ${output.summary.sourceRevisionMismatches.join(', ')}`);

const nvhPath = path(...NVH_EXHAUSTIVE_CORPUS_RELATIVE.split('/'));
const mohPath = path(...MOH_COMPACT_CORPUS_RELATIVE.split('/'));
const nvhRecords = jsonlRecords(await readFile(nvhPath, 'utf8'));
const mohRecords = jsonlRecords(await readFile(mohPath, 'utf8'));
check(nvhRecords.length > 0, `NVH exhaustive compact corpus is empty: ${nvhRecords.length}`);
check(mohRecords.length >= 1000, `MOH compact corpus is unexpectedly small: ${mohRecords.length}`);
check(nvhRecords.every(record => record.sourceId === 'NVH2008' && record.sourceRevision === 'NVH-2008-312P'), 'NVH compact source identity changed');
check(mohRecords.every(record => record.sourceId === 'NATIONAL_BODY_TERMS_2025' && record.sourceRevision === 'VI-BODY-TERMS-2025-SIGNED'), 'MOH compact source identity changed');
check(nvhRecords.every(record => validateCorpusRecord(record).length === 0), 'NVH compact corpus contains an invalid record');
check(mohRecords.every(record => validateCorpusRecord(record).length === 0), 'MOH compact corpus contains an invalid record');
check(nvhRecords.every(record => record.locator?.url === NVH_PUBLIC_ACCESS_URL), 'NVH compact corpus contains an unwhitelisted URL');
check(mohRecords.every(record => record.locator?.url === MOH_OFFICIAL_PDF_URL), 'MOH compact corpus contains an unwhitelisted URL');
check(mohRecords.every(record => /^61\d{5}$/.test(record.locator?.entryId ?? '') && /^\d{6,18}$/.test(record.terminologyIds?.[0] ?? '')), 'MOH rows must retain Ministry and SNOMED identifiers');
check(mohRecords.every(record => /match tier=(?:EXACT_ENGLISH_COMPATIBLE_SCOPE|ALIAS_REMOVE_GENERIC_STRUCTURE_SUFFIX|ALIAS_REMOVE_GENERIC_STRUCTURE_PREFIX|ALIAS_REMOVE_GENERIC_ENTIRE_PREFIX|NORMALIZED_ENGLISH_SAFE)/.test(record.notes ?? '')), 'MOH rows must retain deterministic mapping tier provenance');
check(mohRecords.every(record => record.vietnamese?.preferred && record.english?.preferred && record.sourceTermRaw === record.english.preferred), 'MOH rows must preserve raw Vietnamese/English wording');
check(nvhRecords.every(record => record.vietnamese?.preferred && record.english?.preferred && record.sourceTermRaw === record.english.preferred), 'NVH rows must preserve raw Vietnamese/English wording');
check(nvhRecords.every(record => record.context === 'EXACT_RECONSTRUCTED_SOURCE_ROW'), 'NVH compact rows must carry the exact source reconstruction status');
check(nvhRecords.every(record => !/prefix/i.test(record.notes ?? '')), 'NVH compact rows must not claim atlas-prefix source identity');

const explicitLaterality = text => /\b(?:left|right|bilateral|trai|phai|hai ben)\b/i.test(normalizeMatchingText(text));
check([...nvhRecords, ...mohRecords].filter(record => ['left', 'right', 'bilateral'].includes(record.laterality)).every(record => explicitLaterality(`${record.english.preferred} ${record.vietnamese.preferred}`)), 'laterality was synthesized without source wording');
check(!JSON.stringify(output).toLowerCase().includes('fma-snomed'), 'FMA/SNOMED equivalence was asserted');
check(!output.concepts.some(result => result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION' && ['winner', 'selectedSourceId', 'preferredTerm'].some(key => hasDeepKey(result, key))), 'conflict output contains an adjudication winner');
check(output.concepts.filter(result => result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION').every(result => result.vietnameseCandidateEvidence.length === 0 || result.vietnameseCandidateEvidence.length >= 2), 'conflict queue lost source-separated evidence');

const nvhAcquisition = sourceAcquisition(manifest, 'NVH2008');
const mohAcquisition = sourceAcquisition(manifest, 'MOH2025_BODY_STRUCTURE');
check(nvhAcquisition.fetchStatus === 'FETCHED_EXHAUSTIVE_RENDERED_STREAM_COMPACT_ROWS', 'NVH exhaustive fetch status is incorrect');
check(nvhAcquisition.exhaustiveCoverage?.coverageStatus === 'PARTIAL_PUBLIC_TEXT_ACCESS', 'NVH access must remain explicitly partial');
check(nvhAcquisition.exhaustiveCoverage?.renderedPagesDiscovered === 538 && nvhAcquisition.exhaustiveCoverage?.renderedPagesRetrieved === 538, 'NVH rendered-page traversal is incomplete');
check(nvhAcquisition.exhaustiveCoverage?.blocksParsed === nvhAcquisition.exhaustiveCoverage?.blocksDiscovered && nvhAcquisition.exhaustiveCoverage?.blocksParsed >= 6000, 'NVH rendered blocks were not exhaustively visited');
check(nvhAcquisition.exhaustiveCoverage?.priorCompactRowsAudited === 556, 'NVH prior compact baseline audit count is not 556');
check(nvhAcquisition.exhaustiveCoverage?.exactReconstructedSourceRowCount === nvhRecords.length, 'NVH exact reconstruction count does not match the compact corpus');
check(nvhAcquisition.exhaustiveCoverage?.priorCompactRowsRetainedExactly + nvhAcquisition.exhaustiveCoverage?.priorCompactRowsQuarantined === 556, 'NVH prior compact audit does not partition all 556 rows');
check(Object.values(nvhAcquisition.exhaustiveCoverage?.statusCounts ?? {}).reduce((total, count) => total + count, 0) === nvhAcquisition.exhaustiveCoverage?.blocksParsed, 'NVH parser status counts do not account for every parsed block');
check((nvhAcquisition.exhaustiveCoverage?.statusCounts?.EXACT_RECONSTRUCTED_SOURCE_ROW ?? 0) === nvhRecords.length, 'NVH exact parser status count does not match retained rows');
check(mohAcquisition.fetchStatus === 'FETCHED_OFFICIAL_PDF_TEXT_LAYER_COMPACT_ROWS' && mohAcquisition.blocked === false, 'MOH official PDF was incorrectly marked blocked');
check(mohAcquisition.authorityStatus === 'authority', 'MOH official PDF must remain an authority source');
check(mohAcquisition.exhaustiveCoverage?.renderedPagesDiscovered === 1441 && mohAcquisition.exhaustiveCoverage?.renderedPagesRetrieved === 1441 && mohAcquisition.exhaustiveCoverage?.renderedPagesParsed === 1441, 'MOH PDF page traversal is incomplete');
check(mohAcquisition.exhaustiveCoverage?.structurallyRejectedRows === 4, 'MOH structural reject count is not explicit');
check(mohAcquisition.retainedEvidenceRows === mohRecords.length && mohAcquisition.retainedEvidenceRows > 1000, 'MOH compact retention count is incorrect');
check(sourceMetric(output, 'MOH2025_BODY_STRUCTURE').structuredEvidenceRecordsEmitted === mohRecords.length, 'MOH source metric does not reflect compact rows');
check(sourceMetric(output, 'NVH2008').structuredEvidenceRecordsEmitted > 64, 'NVH source metric did not expand beyond the prior run');
check(sourceMetric(output, 'HMU2022').structuredEvidenceRecordsEmitted === 31, 'HMU source-attested corpus changed');
check(sourceMetric(output, 'UMP2023_T2').structuredEvidenceRecordsEmitted === 12, 'UMP T2 source-attested corpus changed');

check(output.productionSafety.validationErrors === 0, 'production terminology validation is not clean');
check(output.productionSafety.searchableVietnamese === 0, 'searchable Vietnamese production coverage is nonzero');
check(output.productionSafety.sourceVerified === 0, 'SOURCE_VERIFIED production coverage is nonzero');
check(output.productionSafety.medicallyReviewed === 0, 'MEDICAL_REVIEWED production coverage is nonzero');
check(output.productionSafety.releaseEligible === 0, 'release-eligible production coverage is nonzero');
check(output.productionSafety.releaseStatus === 'UNRELEASED', 'release status changed');
check(output.productionSafety.reviewerCount === 0, 'research ingestion created reviewers');
for (const relativePath of ['data/terminology/entries.json', 'data/terminology/reviewers.json', 'data/terminology/release.json']) {
  check(stableCanonical(JSON.parse(await readFile(path(...relativePath.split('/')), 'utf8'))) === stableCanonical(JSON.parse(baselineFile(relativePath))), `${relativePath} must remain unchanged`);
}

check(gitOutput('ls-files', '.local/terminology-source-cache') === '', 'full source cache content must not be tracked');
try {
  execFileSync('git', ['check-ignore', '-q', '.local/terminology-source-cache/README.md'], {cwd: ROOT});
} catch {
  failures.push('full source cache directory is not git-ignored');
}
for (const requiredText of [
  'M04B2E-2R — Exhaustive Public-Source Acquisition Report',
  'PARTIAL_PUBLIC_TEXT_ACCESS',
  '1441',
  '2427/QĐ-BYT',
  'coverage of 3,432 concepts',
  '0 new compact HMU/UMP corroborations',
  'searchable Vietnamese: **0**',
  'STOP after M04B2E-2R',
]) check(report.includes(requiredText), `report is missing required text: ${requiredText}`);

if (failures.length) {
  console.error(`M04B2E-2R tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B2E-2R exhaustive public-source acquisition tests passed');
  console.log(`NVH compact rows: ${nvhRecords.length}; MOH compact rows: ${mohRecords.length}; MOH matched concepts: ${mohAcquisition.matchedConceptCount}`);
  console.log(`Atlas concepts: ${output.conceptAccounting.actualConceptCount}/${output.conceptAccounting.expectedConceptCount}; eligible Vietnamese evidence=${output.globalMetrics.newVietnameseEvidenceConceptCount}; coverage=${((output.globalMetrics.newVietnameseEvidenceConceptCount / EXPECTED_CONCEPT_COUNT) * 100).toFixed(2)}%`);
  console.log(`Production coverage: searchable=${output.productionSafety.searchableVietnamese}; source-verified=${output.productionSafety.sourceVerified}; medically-reviewed=${output.productionSafety.medicallyReviewed}; release-eligible=${output.productionSafety.releaseEligible}; release=${output.productionSafety.releaseStatus}`);
}
