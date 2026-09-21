import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {validateCorpusRecord} from './m04a-bulk-evidence.mjs';
import {
  MOH_COMPACT_CORPUS_RELATIVE,
  MOH_OFFICIAL_PDF_URL,
  NVH_EXHAUSTIVE_CORPUS_RELATIVE,
  NVH_PUBLIC_ACCESS_URL,
  NVH_STAGING_RELATIVE,
  parseNvhRenderedLines,
} from './m04b2e2r-acquisition.mjs';
import {
  EXPECTED_CONCEPT_COUNT,
  MANIFEST_PATH,
  OUTPUT_PATH,
  REPORT_PATH,
  R1_REPORT_PATH,
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

async function readJsonl(filePath) {
  return (await readFile(filePath, 'utf8')).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
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

function evidenceKey(record) {
  return `${record.locator?.entryId}|${record.english?.preferred}|${record.vietnamese?.preferred}`;
}

function sourceAcquisition(manifest, sourceId) {
  const result = manifest.publicWebAcquisition.sources.find(item => item.sourceId === sourceId);
  check(Boolean(result), `missing acquisition source ${sourceId}`);
  return result ?? {};
}

const [manifest, output, report, parserIntegrityReport, nvhRecords, mohRecords, nvhAuditRows, atlas, renderedLines, rebuilt] = await Promise.all([
  readJson(MANIFEST_PATH),
  readJson(OUTPUT_PATH),
  readFile(REPORT_PATH, 'utf8'),
  readFile(R1_REPORT_PATH, 'utf8'),
  readJsonl(path(...NVH_EXHAUSTIVE_CORPUS_RELATIVE.split('/'))),
  readJsonl(path(...MOH_COMPACT_CORPUS_RELATIVE.split('/'))),
  readJsonl(path(...NVH_STAGING_RELATIVE.split('/'))),
  readJson(path('public', 'models', 'atlas.json')),
  readFile(path('.local', 'terminology-source-cache', 'nvh2008-public-rendered-lines.tsv'), 'utf8'),
  buildM04B2E(),
]);

const nvhAcquisition = sourceAcquisition(manifest, 'NVH2008');
const mohAcquisition = sourceAcquisition(manifest, 'MOH2025_BODY_STRUCTURE');
const nvhCoverage = nvhAcquisition.exhaustiveCoverage ?? {};
const parserAudit = parseNvhRenderedLines(renderedLines, atlas);
const statusCounts = nvhCoverage.statusCounts ?? {};
const auditStatusCounts = Object.fromEntries(['EXACT_RECONSTRUCTED_SOURCE_ROW', 'PARSER_INTEGRITY_REVIEW', 'UNMATCHED_SOURCE_RECORD'].map(status => [status, nvhAuditRows.filter(row => row.reconstructionStatus === status).length]));

check(manifest.schemaVersion === 'm04b2e2r-source-manifest-1', 'M04B2E-2R.1 manifest schema is incorrect');
check(manifest.milestone === 'M04B2E-2R' && manifest.status === 'RESEARCH_ONLY_NOT_RELEASE', 'M04B2E-2R.1 manifest status is incorrect');
check(output.schemaVersion === 'm04b2e2r-bulk-match-results-1' && output.status === 'RESEARCH_ONLY_NOT_RELEASE', 'M04B2E-2R.1 output status is incorrect');
check(stableCanonical(manifest) === stableCanonical(rebuilt.manifest), 'M04B2E-2R.1 manifest is not deterministic');
check(stableCanonical(output) === stableCanonical(rebuilt.output), 'M04B2E-2R.1 output is not deterministic');
check(report === rebuilt.report, 'M04B2E-2R report is not deterministic');
check(parserIntegrityReport === rebuilt.parserIntegrityReport, 'M04B2E-2R.1 parser-integrity report is not deterministic');
check(manifest.outputArtifacts?.parserIntegrityReport === 'docs/en-vi/M04B2E2R1_NVH_PARSER_INTEGRITY_REPORT.md', 'parser-integrity report is not registered in the manifest');
check(manifest.outputArtifacts?.parserIntegrityTest === 'scripts/test-m04b2e2r1.mjs', 'parser-integrity test is not registered in the manifest');

check(output.concepts.length === EXPECTED_CONCEPT_COUNT, 'result must contain exactly 3,432 concepts');
check(output.conceptAccounting.actualConceptCount === EXPECTED_CONCEPT_COUNT, 'actual concept count is incorrect');
check(output.conceptAccounting.uniqueConceptCount === EXPECTED_CONCEPT_COUNT, 'concept IDs are not unique');
check(output.conceptAccounting.duplicateConceptCount === 0, 'duplicate concept IDs were emitted');
check(output.conceptAccounting.missingConceptIds.length === 0, 'atlas concepts are missing');
check(output.concepts.every(result => !('vietnamese' in result) && !('mapping' in result) && !('release' in result)), 'research output wrote production terminology fields');

check(nvhRecords.length === nvhCoverage.exactReconstructedSourceRowCount, 'retained NVH rows do not equal exact reconstructed rows');
check(nvhRecords.length === statusCounts.EXACT_RECONSTRUCTED_SOURCE_ROW, 'retained NVH rows do not equal the exact parser status count');
check(nvhRecords.length > 0, 'no exact NVH rows were retained');
check(nvhRecords.every(record => record.sourceId === 'NVH2008' && record.sourceRevision === 'NVH-2008-312P'), 'NVH source identity changed');
check(nvhRecords.every(record => record.context === 'EXACT_RECONSTRUCTED_SOURCE_ROW'), 'NVH records do not carry exact reconstruction status');
check(nvhRecords.every(record => validateCorpusRecord(record).length === 0), 'NVH compact corpus contains an invalid record');
check(nvhRecords.every(record => record.locator?.url === NVH_PUBLIC_ACCESS_URL), 'NVH compact corpus contains an unwhitelisted URL');
check(nvhRecords.every(record => record.english?.preferred && record.vietnamese?.preferred && record.sourceTermRaw === record.english.preferred), 'NVH records do not preserve complete raw bilingual wording');
check(nvhRecords.every(record => !/prefix/i.test(record.notes ?? '')), 'NVH records still contain prefix-based identity wording');

check(mohRecords.length === 1506, `MOH compact corpus changed: ${mohRecords.length}`);
check(mohRecords.every(record => record.sourceId === 'NATIONAL_BODY_TERMS_2025' && record.sourceRevision === 'VI-BODY-TERMS-2025-SIGNED'), 'MOH source identity changed');
check(mohRecords.every(record => validateCorpusRecord(record).length === 0), 'MOH compact corpus contains an invalid record');
check(mohRecords.every(record => record.locator?.url === MOH_OFFICIAL_PDF_URL), 'MOH compact corpus contains an unwhitelisted URL');
check(mohRecords.every(record => /^61\d{5}$/.test(record.locator?.entryId ?? '') && /^\d{6,18}$/.test(record.terminologyIds?.[0] ?? '')), 'MOH identifiers were not preserved');
check(mohRecords.every(record => /ontology-bridge candidate/i.test(record.notes ?? '')), 'MOH bridge-required classification was removed');

check(parserAudit.stats.blocksDiscovered === nvhCoverage.blocksDiscovered && parserAudit.stats.blocksParsed === nvhCoverage.blocksParsed, 'direct NVH parser traversal does not match acquisition metadata');
check(parserAudit.stats.exactReconstructedSourceRowCount === nvhRecords.length, 'direct parser exact-row count does not match compact corpus');
check(stableCanonical(parserAudit.stats.statusCounts) === stableCanonical(statusCounts), 'direct parser status counts do not match acquisition metadata');
check(nvhAuditRows.length === nvhCoverage.blocksParsed, 'NVH staging does not contain one audit row per parsed block');
check(stableCanonical(auditStatusCounts) === stableCanonical(statusCounts), 'NVH staging status counts do not match acquisition metadata');
check(Object.values(statusCounts).reduce((total, count) => total + count, 0) === nvhCoverage.blocksParsed, 'NVH parser statuses do not account for all parsed blocks');
check(nvhCoverage.priorCompactRowsAudited === 556, 'the prior 556 compact NVH rows were not all audited');
check(nvhCoverage.priorCompactRowsRetainedExactly + nvhCoverage.priorCompactRowsQuarantined === 556, 'prior NVH rows are not partitioned into exact and quarantined sets');
check(nvhCoverage.priorCompactRowsQuarantined > 0, 'NVH parser did not quarantine any prior compact rows');
check(nvhCoverage.reasonCounts && Object.keys(nvhCoverage.reasonCounts).length > 0, 'NVH parser-integrity reasons were not recorded');
check(nvhAuditRows.filter(row => row.reconstructionStatus === 'EXACT_RECONSTRUCTED_SOURCE_ROW').every(row => (row.integrityReasons ?? []).length === 0), 'an exact NVH row carries integrity-failure reasons');
check(nvhAuditRows.filter(row => row.reconstructionStatus !== 'EXACT_RECONSTRUCTED_SOURCE_ROW').every(row => !nvhRecords.some(record => record.locator?.entryId === row.printedId && record.english?.preferred === row.english && record.vietnamese?.preferred === row.vietnamese)), 'quarantined NVH rows entered the compact corpus');

const truncatedSentinels = new Map([
  ['FMA3951', {entryId: 'A12.2.08.001', english: 'Subclavian artery', vietnamese: 'Động mạch dưới đòn', bad: 'Động mạch dưới'}],
  ['FMA4725', {entryId: 'A12.3.08.002', english: 'Subclavian vein', vietnamese: 'Tĩnh mạch dưới đòn', bad: 'Tĩnh mạch dưới'}],
  ['FMA10662', {entryId: 'A12.2.08.043', english: 'Inferior thyroid artery', vietnamese: 'Động mạch giáp dưới', bad: 'Động mạch giáp'}],
]);
for (const [conceptId, expected] of truncatedSentinels) {
  const corpusRows = nvhRecords.filter(record => record.locator?.entryId === expected.entryId);
  check(corpusRows.some(record => record.english?.preferred === expected.english && record.vietnamese?.preferred === expected.vietnamese), `${conceptId} exact NVH row is missing`);
  check(!corpusRows.some(record => record.vietnamese?.preferred === expected.bad), `${conceptId} truncated Vietnamese row was retained`);
  const evidence = output.concepts.find(result => result.conceptId === conceptId)?.vietnameseCandidateEvidence?.filter(item => item.sourceId === 'NVH2008') ?? [];
  check(evidence.some(item => item.locator?.entryId === expected.entryId && item.vietnamese?.preferred === expected.vietnamese), `${conceptId} exact NVH evidence is missing`);
  check(!evidence.some(item => item.vietnamese?.preferred === expected.bad), `${conceptId} truncated Vietnamese evidence was emitted`);
}
const fma9597 = output.concepts.find(result => result.conceptId === 'FMA9597');
check(fma9597?.vietnameseCandidateEvidence?.every(item => item.sourceId !== 'NVH2008'), 'FMA9597 received unsupported NVH evidence');
check(fma9597?.m03cRegression?.status === 'INPUT_GAP', 'FMA9597 is not classified as an input gap');

check(mohAcquisition.exhaustiveCoverage?.renderedPagesDiscovered === 1441 && mohAcquisition.exhaustiveCoverage?.renderedPagesRetrieved === 1441 && mohAcquisition.exhaustiveCoverage?.renderedPagesParsed === 1441, 'MOH page traversal changed');
check(mohAcquisition.retainedEvidenceRows === 1506, 'MOH retained-row count changed');
check(mohAcquisition.exhaustiveCoverage?.structuredRowsRetained === 1506, 'MOH structured-row count changed');
check(!JSON.stringify(output).toLowerCase().includes('fma-snomed'), 'FMA/SNOMED equivalence was asserted');
check(!output.concepts.some(result => result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION' && ['winner', 'selectedSourceId', 'preferredTerm'].some(key => Object.prototype.hasOwnProperty.call(result, key))), 'conflict output contains an adjudication winner');

const regression = output.regression;
check((regression.unexplainedRegressionCount ?? regression.mismatchCount) === 0, 'unexplained M03C regression is nonzero');
check((regression.mismatchCount ?? 0) === (regression.unexplainedRegressionCount ?? 0), 'M03C mismatch compatibility count is not unexplained-only');
check((regression.statusCounts?.PASS ?? 0) > 0, 'M03C PASS state is missing');
check((regression.statusCounts?.UNEXPLAINED_REGRESSION ?? 0) === 0, 'M03C UNEXPLAINED_REGRESSION state is nonzero');
check(['PASS', 'INPUT_GAP', 'EXPECTED_EVIDENCE_SUPERSESSION', 'UNEXPLAINED_REGRESSION'].every(status => Object.prototype.hasOwnProperty.call(regression.statusCounts ?? {}, status)), 'M03C regression status vocabulary is incomplete');

const global = output.globalMetrics;
check(global.preM04B2EBaseline === 47, 'pre-M04B2E baseline is not 47');
check(global.m04b2e2Baseline === 80, 'M04B2E-2 baseline is not 80');
check(global.finalAfter2R1 === global.newVietnameseEvidenceConceptCount, 'final-after-2R1 metric is inconsistent');
check(global.deltaFrom47 === global.finalAfter2R1 - 47, 'delta from baseline 47 is inconsistent');
check(global.deltaFrom80 === global.finalAfter2R1 - 80, 'delta from baseline 80 is inconsistent');
check(global.variantCount !== undefined && global.conflictCount !== undefined, 'variant/conflict metrics are missing');

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
  'M04B2E-2R.1 — NVH Parser Integrity Report',
  'entry-ID boundary → complete English source term → complete Vietnamese source term → integrity validation → exact atlas match',
  'Prior compact rows audited | 556 |',
  'Prior rows retained exactly | 269 |',
  'Prior rows quarantined | 287 |',
  '6960',
  'FMA3951',
  'Động mạch dưới đòn',
  'FMA9597',
  'Baseline before M04B2E | 47 |',
  'M04B2E-2 baseline | 80 |',
  'Final after M04B2E-2R.1 | 421 |',
  'UNEXPLAINED_REGRESSION=0',
  'STOP after M04B2E-2R.1',
]) check(parserIntegrityReport.includes(requiredText), `parser-integrity report is missing required text: ${requiredText}`);

if (failures.length) {
  console.error(`M04B2E-2R.1 tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B2E-2R.1 NVH parser integrity tests passed');
  console.log(`Prior NVH compact rows audited: ${nvhCoverage.priorCompactRowsAudited}; exact=${nvhCoverage.priorCompactRowsRetainedExactly}; quarantined=${nvhCoverage.priorCompactRowsQuarantined}`);
  console.log(`NVH exact reconstructed rows: ${nvhRecords.length}; parser statuses=${JSON.stringify(statusCounts)}`);
  console.log(`MOH compact rows preserved: ${mohRecords.length}; final eligible concepts=${global.finalAfter2R1}; delta47=${global.deltaFrom47}; delta80=${global.deltaFrom80}`);
  console.log(`M03C regression: PASS=${regression.statusCounts.PASS}; INPUT_GAP=${regression.statusCounts.INPUT_GAP}; EXPECTED_EVIDENCE_SUPERSESSION=${regression.statusCounts.EXPECTED_EVIDENCE_SUPERSESSION}; UNEXPLAINED_REGRESSION=${regression.statusCounts.UNEXPLAINED_REGRESSION}`);
}
