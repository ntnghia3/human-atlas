import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {computeCoverage, validateTerminologyData} from './validate-terminology.mjs';
import {validateCorpusRecord} from './m04a-bulk-evidence.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_COMMIT = '1a00ecf7de9b7dbcb0bcffcdbbf4d20cf2fa6b7c';
const TARGET_IDS = ['FMA55135', 'FMA55138', 'FMA55227', 'FMA55230', 'FMA55233'];
const TARGET_ID_SET = new Set(TARGET_IDS);
const ALLOWED_CONSENSUS_STATUSES = new Set([
  'HIGH_CONSENSUS_CANDIDATE',
  'SINGLE_SOURCE_AUTHORITY_EVIDENCE',
  'VARIANT_REVIEW',
  'CONFLICT_REQUIRES_ADJUDICATION',
  'SOURCE_MATERIAL_REQUIRED',
  'IDENTITY_BLOCKED',
]);
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

async function readJson(relativePath) {
  return JSON.parse(await readFile(path(...relativePath.split('/')), 'utf8'));
}

async function readJsonl(relativePath) {
  const text = await readFile(path(...relativePath.split('/')), 'utf8');
  return text.trim() ? text.split(/\r?\n/).filter(line => line.trim()).map(JSON.parse) : [];
}

function sourceMap(document) {
  return new Map((document.sources ?? []).map(source => [source.id, source]));
}

function hasNoConsensusWinner(row) {
  const status = row.candidateConsensus?.status;
  if (!['VARIANT_REVIEW', 'CONFLICT_REQUIRES_ADJUDICATION', 'SOURCE_MATERIAL_REQUIRED', 'IDENTITY_BLOCKED'].includes(status)) return true;
  return row.candidateConsensus.preferredTerm === null
    && row.candidateConsensus.agreedTerm === null
    && Array.isArray(row.candidateConsensus.variants)
    && Array.isArray(row.candidateConsensus.conflicts);
}

function assertNoConsensusWinner(row, context) {
  check(hasNoConsensusWinner(row), `${context} must not select a consensus winner`);
}

const [matrix, gaps, corpusRecords, sourceDocument, atlas, entriesDocument, reviewersDocument, releaseDocument] = await Promise.all([
  readJson('docs/en-vi/research/M04B2D/M04B2D_BATCH1_EVIDENCE_MATRIX.json'),
  readJson('docs/en-vi/research/M04B2D/M04B2D_BATCH1_SOURCE_GAPS.json'),
  readJsonl('data/terminology/research/corpora/m04b2d-laryngeal-ligaments.jsonl'),
  readJson('data/terminology/sources.json'),
  readJson('public/models/atlas.json'),
  readJson('data/terminology/entries.json'),
  readJson('data/terminology/reviewers.json'),
  readJson('data/terminology/release.json'),
]);

const catalog = sourceMap(sourceDocument);
const rows = matrix.concepts ?? [];
const rowById = new Map(rows.map(row => [row.conceptId, row]));

check(matrix.schemaVersion === 'M04B2D-batch1-evidence-1', 'batch matrix schema version is incorrect');
check(matrix.status === 'RESEARCH_ONLY_NOT_RELEASE', 'batch matrix must remain research-only');
check(matrix.startingCommit === BASELINE_COMMIT, 'batch matrix must bind to the observed starting commit');
check(matrix.conceptCount === 5, `batch matrix conceptCount must be 5; found ${matrix.conceptCount}`);
check(rows.length === 5, `batch matrix must contain exactly 5 concept rows; found ${rows.length}`);
check(JSON.stringify(rows.map(row => row.conceptId)) === JSON.stringify(TARGET_IDS), 'batch matrix target order/IDs are incorrect');
check(new Set(rows.map(row => row.conceptId)).size === 5, 'batch matrix contains a duplicate concept row');
check(gaps.sourceGaps?.length === 5, `source-gaps artifact must contain exactly 5 target rows; found ${gaps.sourceGaps?.length ?? 0}`);
check(gaps.counts?.targetConceptCount === 5, 'source-gaps target count must be 5');
check(gaps.counts?.candidateCount === 0, 'source-gaps artifact must report zero candidates');
check(corpusRecords.length === 0, `target corpus must contain no unsupported Vietnamese record; found ${corpusRecords.length}`);

for (const id of TARGET_IDS) {
  const row = rowById.get(id);
  check(Boolean(row), `matrix is missing ${id}`);
  if (!row) continue;
  check(TARGET_ID_SET.has(row.conceptId), `${id} is outside the target batch`);
  check(['IDENTITY_PINNED', 'IDENTITY_SUPPORTED_BUT_NOT_PINNED', 'IDENTITY_INSUFFICIENT'].includes(row.identityStatus), `${id} has an invalid identity status`);
  check(['IDENTITY_BLOCKED', 'SOURCE_MATERIAL_REQUIRED'].includes(row.evidenceStatus), `${id} has an invalid evidence status`);
  check(Array.isArray(row.evidence) && row.evidence.length === 0, `${id} must not have a Vietnamese evidence record`);
  check(ALLOWED_CONSENSUS_STATUSES.has(row.candidateConsensus?.status), `${id} has an invalid candidateConsensus status`);
  check(row.candidateConsensus?.status === row.evidenceStatus, `${id} candidateConsensus and evidenceStatus must agree for this source-gap batch`);
  check(!('vietnamese' in row), `${id} must not contain a generated Vietnamese field`);
  assertNoConsensusWinner(row, id);
}

const expectedIdentity = {
  FMA55135: {status: 'IDENTITY_INSUFFICIENT', consensus: 'IDENTITY_BLOCKED', identityEvidenceCount: 0},
  FMA55138: {status: 'IDENTITY_PINNED', consensus: 'SOURCE_MATERIAL_REQUIRED', sourceId: 'FIPAT_TA2', entryId: '1652', latin: 'Ligamentum thyreohyoideum medianum'},
  FMA55227: {status: 'IDENTITY_PINNED', consensus: 'SOURCE_MATERIAL_REQUIRED', sourceId: 'FIPAT_TA2', entryId: '1656', latin: 'Ligamentum hyoepiglotticum'},
  FMA55230: {status: 'IDENTITY_PINNED', consensus: 'SOURCE_MATERIAL_REQUIRED', sourceId: 'FIPAT_TA2', entryId: '1655', latin: 'Ligamentum thyreoepiglotticum'},
  FMA55233: {status: 'IDENTITY_INSUFFICIENT', consensus: 'IDENTITY_BLOCKED', identityEvidenceCount: 0},
};

for (const [conceptId, expectation] of Object.entries(expectedIdentity)) {
  const row = rowById.get(conceptId);
  if (!row) continue;
  check(row.identityStatus === expectation.status, `${conceptId} identity status is incorrect`);
  check(row.candidateConsensus.status === expectation.consensus, `${conceptId} consensus status is incorrect`);
  if (expectation.identityEvidenceCount === 0) {
    check(row.externalIdentityEvidence.length === 0, `${conceptId} must not claim external identity evidence`);
  } else {
    const identity = row.externalIdentityEvidence?.[0];
    check(Boolean(identity), `${conceptId} is missing external identity evidence`);
    if (identity) {
      check(identity.sourceId === expectation.sourceId, `${conceptId} identity source is incorrect`);
      check(identity.sourceRevision === catalog.get(identity.sourceId)?.revision, `${conceptId} identity source revision is not catalog-bound`);
      check(identity.locator?.entryId === expectation.entryId, `${conceptId} TA2 locator entry is not intact`);
      check(identity.latin?.preferred === expectation.latin, `${conceptId} TA2 Latin wording is not intact`);
      check(identity.locatorQuality === 'STABLE_ENTRY', `${conceptId} locator quality is not preserved`);
      check(identity.accessCopy?.isAccessCopy === false, `${conceptId} identity evidence must be marked as authority-source access`);
      check(identity.authorityInstitution === catalog.get(identity.sourceId)?.institution, `${conceptId} authority institution is not catalog-bound`);
    }
  }
}

for (const source of matrix.sourceMaterialInspected ?? []) {
  const registered = catalog.get(source.sourceId);
  check(Boolean(registered), `${source.sourceId} inspected source is missing from source catalog`);
  if (!registered) continue;
  check(source.sourceRevision === registered.revision, `${source.sourceId} inspected source revision is not catalog-bound`);
  check(source.sourceEdition === (registered.id === 'UMP2023_T2' ? 'Tập 2, 2023' : registered.edition), `${source.sourceId} inspected source edition is incorrect`);
  if (registered.accessCopy) {
    check(source.accessCopy?.isAuthority === false, `${source.sourceId} access copy must be explicitly non-authority`);
    check(source.accessCopy?.relation === 'access-copy', `${source.sourceId} access-copy relation is not preserved`);
    check(source.accessCopy?.url === registered.accessCopy.url, `${source.sourceId} access-copy URL is not catalog-bound`);
  } else {
    check(source.accessCopy === null, `${source.sourceId} must preserve the absence of an access copy`);
  }
}

const gapIds = new Set((gaps.sourceGaps ?? []).map(item => item.conceptId));
check(stableCanonical([...gapIds].sort()) === stableCanonical([...TARGET_ID_SET].sort()), 'source-gaps artifact contains a sixth concept or misses a target');
for (const item of gaps.sourceGaps ?? []) {
  check(TARGET_ID_SET.has(item.conceptId), `source-gaps contains non-target ${item.conceptId}`);
  check(item.preferredTerm === null && item.agreedTerm === null, `${item.conceptId} source gap must have no winner`);
}

for (const record of corpusRecords) {
  const errors = validateCorpusRecord(record, `targetCorpus[${corpusRecords.indexOf(record)}]`);
  check(errors.length === 0, `target corpus schema errors: ${errors.join('; ')}`);
  check(!('conceptId' in record), 'target source corpus records must not silently assert Atlas identity');
  const registered = catalog.get(record.sourceId);
  check(Boolean(registered), `target corpus record uses unregistered source ${record.sourceId}`);
  check(record.sourceRevision === registered?.revision, `target corpus record ${record.sourceId} has a source revision mismatch`);
  check(Boolean(record.vietnamese?.preferred), 'every Vietnamese target string must be a directly sourced preferred value');
}

const syntheticInvalidConflict = structuredClone(rows[1]);
syntheticInvalidConflict.candidateConsensus = {
  status: 'CONFLICT_REQUIRES_ADJUDICATION',
  preferredTerm: 'UNSUPPORTED_WINNER',
  agreedTerm: 'UNSUPPORTED_WINNER',
  variants: [],
  conflicts: [],
};
const failureCountBeforeSyntheticConflict = failures.length;
check(!hasNoConsensusWinner(syntheticInvalidConflict), 'conflict guard must reject a winner');
check(failures.length === failureCountBeforeSyntheticConflict, 'synthetic conflict guard must not mutate the failure list');

const productionValidation = validateTerminologyData({
  atlas,
  sourcesDocument: sourceDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(productionValidation.errors.length === 0, `production terminology validation found ${productionValidation.errors.length} error(s)`);
const productionCoverage = computeCoverage(atlas, entriesDocument.entries, productionValidation.sourceCatalog, productionValidation.reviewerCatalog);
check(productionCoverage.searchableTerminologyEntries === 0, 'searchable Vietnamese must remain 0');
check(productionCoverage.sourceVerifiedEntries === 0, 'SOURCE_VERIFIED must remain 0');
check(productionCoverage.medicallyReviewedEntries === 0, 'MEDICAL_REVIEWED must remain 0');
check(productionCoverage.releaseEligibleEntries === 0, 'releaseEligible must remain 0');
check(reviewersDocument.reviewers.length === 0, 'no reviewers may be created by this research batch');
check(releaseDocument.releaseStatus === 'UNRELEASED', 'release must remain UNRELEASED');

function baselineJson(relativePath) {
  return JSON.parse(execFileSync('git', ['show', `${BASELINE_COMMIT}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }));
}

for (const relativePath of [
  'data/terminology/entries.json',
  'data/terminology/sources.json',
  'data/terminology/reviewers.json',
  'data/terminology/release.json',
]) {
  const current = await readJson(relativePath);
  check(stableCanonical(current) === stableCanonical(baselineJson(relativePath)), `${relativePath} must remain unchanged`);
}

if (failures.length) {
  console.error(`M04B2D Batch 1 tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B2D Batch 1 research-only evidence tests passed');
  console.log('Targets: 5; Vietnamese attestations: 0; candidates: 0; identity pinned: 3; identity blocked: 2');
  console.log(`Production coverage: searchable=${productionCoverage.searchableTerminologyEntries}; source-verified=${productionCoverage.sourceVerifiedEntries}; medically-reviewed=${productionCoverage.medicallyReviewedEntries}; release-eligible=${productionCoverage.releaseEligibleEntries}; release=${releaseDocument.releaseStatus}`);
}
