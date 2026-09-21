import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceIndex,
  loadSourceCatalogDocument,
  matchAtlasConcepts,
  readCorpusFiles,
  readJson,
  validateCorpusRecord,
} from './m04a-bulk-evidence.mjs';
import {computeCoverage, validateTerminologyData} from './validate-terminology.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...parts) => join(ROOT, ...parts);
const START_COMMIT = 'a63dcba6c3959aad19126889d57f4c2bdd5b1243';
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function stableCanonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCanonical(value[key])}`).join(',')}}`;
}

function resultById(results, conceptId) {
  const result = results.concepts.find(item => item.conceptId === conceptId);
  check(Boolean(result), `bulk output is missing ${conceptId}`);
  return result;
}

function baselineJson(relativePath) {
  return JSON.parse(execFileSync('git', ['show', `${START_COMMIT}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }));
}

const suppliedPath = path('docs', 'en-vi', 'research', 'M04B2C', 'M04B2C_VI_AUTHORITY_CORPUS.jsonl');
const preservedPath = path('data', 'terminology', 'research', 'corpora', 'm04b2c-vi-authority.jsonl');
const matrixPath = path('docs', 'en-vi', 'research', 'M04B2C', 'M04B2C_EVIDENCE_MATRIX.json');
const queuePath = path('docs', 'en-vi', 'research', 'M04B2C', 'M04B2C_CONFLICT_QUEUE.json');
const corpusPaths = [
  path('data', 'terminology', 'research', 'corpora', 'fipat-ta2-2019.jsonl'),
  path('data', 'terminology', 'research', 'corpora', 'nvh2008-public-research-seed.jsonl'),
  preservedPath,
];

const [atlas, sourceDocument, entriesDocument, reviewersDocument, releaseDocument, suppliedCorpus, preservedCorpus, matrix, conflictQueue, index, results] = await Promise.all([
  readJson(path('public', 'models', 'atlas.json')),
  readJson(path('data', 'terminology', 'sources.json')),
  readJson(path('data', 'terminology', 'entries.json')),
  readJson(path('data', 'terminology', 'reviewers.json')),
  readJson(path('data', 'terminology', 'release.json')),
  readCorpusFiles([suppliedPath]),
  readCorpusFiles([preservedPath]),
  readJson(matrixPath),
  readJson(queuePath),
  readJson(path('data', 'terminology', 'research', 'bulk-source-index.json')),
  readJson(path('data', 'terminology', 'research', 'bulk-match-results.json')),
]);

const sourceCatalog = loadSourceCatalogDocument(sourceDocument);
const authorityFirstResearch = {
  matrix,
  conflictQueue,
  recordCount: matrix.recordCount,
  sourceCounts: matrix.sourceCounts,
};

const suppliedErrors = suppliedCorpus.records.flatMap((record, index) => validateCorpusRecord(record, `supplied[${index}]`));
const preservedErrors = preservedCorpus.records.flatMap((record, index) => validateCorpusRecord(record, `preserved[${index}]`));
check(suppliedErrors.length === 0, `supplied M04B2C corpus schema errors: ${suppliedErrors.join('; ')}`);
check(preservedErrors.length === 0, `preserved M04B2C corpus schema errors: ${preservedErrors.join('; ')}`);
check(suppliedCorpus.records.length === 43, `supplied M04B2C record count must be 43; found ${suppliedCorpus.records.length}`);
check(preservedCorpus.records.length === 43, `preserved M04B2C record count must be 43; found ${preservedCorpus.records.length}`);
check(stableCanonical(suppliedCorpus.records) === stableCanonical(preservedCorpus.records), 'preserved M04B2C corpus must retain supplied records verbatim');

const sourceCounts = Object.fromEntries([...new Set(preservedCorpus.records.map(record => record.sourceId))].sort().map(sourceId => [sourceId, preservedCorpus.records.filter(record => record.sourceId === sourceId).length]));
check(JSON.stringify(sourceCounts) === JSON.stringify({HMU2022: 31, UMP2023_T2: 12}), `M04B2C source counts are incorrect: ${JSON.stringify(sourceCounts)}`);
for (const record of preservedCorpus.records) {
  check(['HMU2022', 'UMP2023_T2'].includes(record.sourceId), `unexpected M04B2C sourceId: ${record.sourceId}`);
  check(record.sourceRevision === sourceCatalog[record.sourceId]?.revision, `${record.sourceId} record has a source revision mismatch`);
  check(!('conceptId' in record) && !('atlasName' in record), 'M04B2C corpus must not assert Atlas identity fields');
  check(!Object.keys(record).some(key => key.toLowerCase().includes('normalized')), 'M04B2C corpus must not store normalized text');
  check(record.vietnamese?.aliases?.length === 0, 'M04B2C Vietnamese aliases must remain source evidence and must not be activated');
}
check(new Set(preservedCorpus.records.filter(record => record.sourceId === 'HMU2022').map(record => record.sourceRevision)).size === 1, 'HMU2022 records must use one exact revision');
check(new Set(preservedCorpus.records.filter(record => record.sourceId === 'UMP2023_T2').map(record => record.sourceRevision)).size === 1, 'UMP2023_T2 records must use one exact revision');
check(sourceCatalog.HMU2022?.revision === 'HMU-2022-ISBN-9786046658351', 'HMU2022 source catalog revision is not the required exact revision');
check(sourceCatalog.UMP2023_T2?.revision === 'UMP-2023-PROGRAM-T2-437P', 'UMP2023_T2 source catalog revision is not the required exact revision');

check(matrix.schemaVersion === 'M04B2C-research-1', 'M04B2C evidence matrix schema must be preserved');
check(matrix.startingCommit === START_COMMIT, 'M04B2C evidence matrix must bind to the requested starting commit');
check(matrix.status === 'RESEARCH_ONLY_NOT_RELEASE', 'M04B2C evidence matrix must remain research-only');
check(matrix.recordCount === 43 && matrix.conceptCount === 33, 'M04B2C evidence matrix counts must remain 43 records and 33 concepts');
check(JSON.stringify(matrix.sourceCounts) === JSON.stringify({HMU2022: 31, UMP2023_T2: 12}), 'M04B2C evidence matrix source counts must remain exact');
check(matrix.releaseState?.sourceVerified === 0 && matrix.releaseState?.medicalReviewed === 0 && matrix.releaseState?.releaseEligible === 0 && matrix.releaseState?.searchableVietnamese === 0, 'M04B2C matrix release state must remain zero');
check(conflictQueue.schemaVersion === 'M04B2C-conflicts-1', 'M04B2C conflict queue schema must be preserved');
check(conflictQueue.conflicts?.length === 2, `M04B2C conflict queue must contain two conflicts; found ${conflictQueue.conflicts?.length ?? 0}`);

check(index.inputRecordCount === 7183, `combined index input count must be 7183; found ${index.inputRecordCount}`);
check(index.indexedRecordCount === 7183, `combined index indexed count must be 7183; found ${index.indexedRecordCount}`);
check(index.duplicateEvidenceRecordCount === 0, 'combined corpus must not double-count identical evidence records');
check(index.unresolvedSourceIds.length === 0, `combined corpus has unresolved sources: ${index.unresolvedSourceIds.join(', ')}`);
check(index.sourceRevisionMismatches.length === 0, `combined corpus has source revision mismatches: ${index.sourceRevisionMismatches.join(', ')}`);
for (const corpusPath of ['data/terminology/research/corpora/fipat-ta2-2019.jsonl', 'data/terminology/research/corpora/nvh2008-public-research-seed.jsonl', 'data/terminology/research/corpora/m04b2c-vi-authority.jsonl']) {
  check(index.inputFiles.includes(corpusPath), `combined index must retain input provenance for ${corpusPath}`);
}
const indexCountsBySource = Object.fromEntries([...new Set(index.records.map(item => item.record.sourceId))].sort().map(sourceId => [sourceId, index.records.filter(item => item.record.sourceId === sourceId).length]));
check(indexCountsBySource.FIPAT_TA2 === 7112, `FIPAT record count must remain 7112; found ${indexCountsBySource.FIPAT_TA2}`);
check(indexCountsBySource.NVH2008 === 28, `NVH2008 record count must remain 28; found ${indexCountsBySource.NVH2008}`);
check(indexCountsBySource.HMU2022 === 31, `HMU2022 record count must be 31; found ${indexCountsBySource.HMU2022}`);
check(indexCountsBySource.UMP2023_T2 === 12, `UMP2023_T2 record count must be 12; found ${indexCountsBySource.UMP2023_T2}`);

check(results.concepts.length === 3432, `bulk matcher must emit 3432 concepts; found ${results.concepts.length}`);
check(results.summary.conceptCount === 3432 && results.summary.expectedConceptCount === 3432, 'bulk matcher must process exactly 3,432 concepts');
check(results.researchAnnotations?.authorityFirst?.schemaVersion === 'm04b2c-authority-first-annotations-1', 'bulk output must retain M04B2C authority-first annotations');
check(results.researchAnnotations?.authorityFirst?.recordCount === 43, 'bulk output must retain the M04B2C record count');
check(results.researchAnnotations?.authorityFirst?.conceptCount === 33, 'bulk output must retain all 33 M04B2C matrix concepts');
check(results.concepts.filter(item => item.researchAnnotations?.authorityFirst).length === 33, 'all 33 M04B2C matrix concepts must remain research annotations');

const matrixById = new Map(matrix.concepts.map(concept => [concept.conceptId, concept]));
const matrixAtlasNames = new Set(matrix.concepts.map(concept => concept.atlasName));
const sourceIds = new Set(['HMU2022', 'UMP2023_T2']);
const m04b2cConceptIds = new Set(matrix.concepts.map(concept => concept.conceptId));
const eligibleM04B2CConceptIds = new Set(results.concepts
  .filter(result => result.vietnameseCandidateEvidence.some(evidence => sourceIds.has(evidence.sourceId) && evidence.sourceProfile.researchEligibleVietnamese))
  .map(result => result.conceptId));
check(eligibleM04B2CConceptIds.size === 33, `all 33 M04B2C concepts must gain eligible research evidence; found ${eligibleM04B2CConceptIds.size}`);
check([...m04b2cConceptIds].every(conceptId => eligibleM04B2CConceptIds.has(conceptId)), 'every M04B2C matrix concept must gain authority evidence');

const authoritySourceConceptIds = matrix.concepts.filter(concept => new Set((concept.evidence ?? []).map(evidence => evidence.sourceId).filter(sourceIds.has, sourceIds)).size >= 2).map(concept => concept.conceptId);
const institutionCount = concept => new Set((concept.evidence ?? []).filter(evidence => sourceIds.has(evidence.sourceId)).map(evidence => sourceCatalog[evidence.sourceId]?.institution ?? evidence.sourceId)).size;
check(authoritySourceConceptIds.length === 10, `ten M04B2C concepts must have two authority sources; found ${authoritySourceConceptIds.length}`);
check(authoritySourceConceptIds.every(conceptId => institutionCount(matrixById.get(conceptId)) >= 2), 'two-source M04B2C concepts must be institutionally distinct');

const highConsensusIds = matrix.concepts.filter(concept => concept.researchDisposition === 'HIGH_CONSENSUS_CANDIDATE').map(concept => concept.conceptId);
check(highConsensusIds.length === 7, `M04B2C matrix must contain seven high-consensus candidates; found ${highConsensusIds.length}`);
for (const conceptId of highConsensusIds) {
  const result = resultById(results, conceptId);
  check(result.researchBucket === 'HIGH_CONSENSUS_CANDIDATE', `${conceptId} high-consensus candidate must remain research-only high consensus`);
  check(result.candidateConsensus.status === 'AGREED', `${conceptId} high-consensus candidate must expose agreement`);
  check(result.candidateConsensus.independentAuthoritativeSourceCount >= 2, `${conceptId} high-consensus candidate must retain two independent authority sources`);
  check(result.vietnameseCandidateEvidence.filter(evidence => sourceIds.has(evidence.sourceId)).every(evidence => evidence.sourceProfile.sourceVerifiedClaimEligible === false), `${conceptId} must not become SOURCE_VERIFIED`);
}

const conflictIds = ['FMA16585', 'FMA24499'];
const expectedConflictTerms = {
  FMA16585: new Set(['Xương chậu', 'Xương hông']),
  FMA24499: new Set(['Xương thuyền', 'Xương ghe']),
};
for (const conceptId of conflictIds) {
  const result = resultById(results, conceptId);
  const authorityTerms = new Set(result.vietnameseCandidateEvidence.filter(evidence => sourceIds.has(evidence.sourceId)).map(evidence => evidence.vietnamese?.preferred));
  check(result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION', `${conceptId} conflict must remain blocking`);
  check(result.candidateConsensus.status === 'CONFLICT', `${conceptId} must expose conflict without selecting a winner`);
  check(result.candidateConsensus.agreedTerm === null, `${conceptId} must not select a winning term`);
  check(stableCanonical(authorityTerms) === stableCanonical(expectedConflictTerms[conceptId]), `${conceptId} must preserve both supplied authority forms`);
  check(!('vietnamese' in result) && !('mapping' in result) && !('release' in result), `${conceptId} conflict must not become a production field`);
}
check(results.summary.bucketCounts.CONFLICT_REQUIRES_ADJUDICATION === 4, 'integrated output must retain the three prior conflicts plus the new FMA16585 conflict');

const variant = resultById(results, 'FMA9625');
check(variant.researchBucket === 'VARIANT_REVIEW', 'stylohyoid must remain a variant review');
check(new Set(variant.vietnameseCandidateEvidence.filter(evidence => sourceIds.has(evidence.sourceId)).map(evidence => evidence.vietnamese?.preferred)).size === 2, 'stylohyoid source wording variants must remain distinct');

const unsidedAuthorityRecords = preservedCorpus.records.filter(record => matrixAtlasNames.has(record.english?.preferred) && record.laterality === 'unsided');
check(unsidedAuthorityRecords.length === 42, `M04B2C must preserve 42 supplied unsided records; found ${unsidedAuthorityRecords.length}`);
check(!results.concepts.some(result => result.researchAnnotations?.authorityFirst?.evidence?.some(evidence => evidence.laterality === 'unsided' && /\b(?:right|left|phải|trái)\b/i.test(evidence.vietnamese ?? ''))), 'M04B2C annotations must not synthesize side-specific Vietnamese wording');

const badRevision = structuredClone(preservedCorpus.records.find(record => record.english?.preferred === 'parietal bone'));
badRevision.sourceRevision = 'HMU-2022-WRONG-REVISION';
const badIndex = buildSourceIndex({
  records: [badRevision],
  inputFiles: [preservedPath],
  inputFileLabels: ['data/terminology/research/corpora/m04b2c-vi-authority.jsonl'],
  sourceCatalogDocument: sourceDocument,
});
check(badIndex.sourceRevisionMismatches.includes('HMU2022:HMU-2022-WRONG-REVISION'), 'M04B2C revision mismatch must be recorded');
const badResults = matchAtlasConcepts({
  atlas,
  index: badIndex,
  sourceCatalog,
  m03cEntries: entriesDocument.entries,
  authorityFirstResearch,
});
const badParietal = resultById(badResults, 'FMA9613');
check(badParietal.vietnameseCandidateEvidence.some(evidence => evidence.sourceId === 'HMU2022' && evidence.sourceProfile.revisionMatches === false && evidence.sourceProfile.researchEligibleVietnamese === false), 'M04B2C revision mismatch must reject authority eligibility');
check(badParietal.researchBucket !== 'HIGH_CONSENSUS_CANDIDATE', 'M04B2C revision mismatch must block two-source high consensus');

check(results.regression.frozenM03CConceptCount === 50, `M03C regression must cover 50 frozen concepts; found ${results.regression.frozenM03CConceptCount}`);
check(results.regression.mismatchCount === 0, `M03C regression must have zero mismatches; found ${results.regression.mismatchCount}`);

const productionValidation = validateTerminologyData({
  atlas,
  sourcesDocument: sourceDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(productionValidation.errors.length === 0, `production terminology validation must remain clean; found ${productionValidation.errors.length} error(s)`);
const productionCoverage = computeCoverage(atlas, entriesDocument.entries, productionValidation.sourceCatalog, productionValidation.reviewerCatalog);
check(productionCoverage.searchableTerminologyEntries === 0, 'M04B2C must not create searchable Vietnamese production coverage');
check(productionCoverage.sourceVerifiedEntries === 0, 'M04B2C must not create SOURCE_VERIFIED production coverage');
check(productionCoverage.medicallyReviewedEntries === 0, 'M04B2C must not create MEDICAL_REVIEWED production coverage');
check(productionCoverage.releaseEligibleEntries === 0, 'M04B2C must not create release-eligible production coverage');
check(reviewersDocument.reviewers.length === 0, 'M04B2C must not create reviewers');
check(releaseDocument.releaseStatus === 'UNRELEASED', 'M04B2C must keep release UNRELEASED');

for (const relativePath of ['data/terminology/entries.json', 'data/terminology/sources.json', 'data/terminology/reviewers.json', 'data/terminology/release.json']) {
  const current = JSON.parse(await readFile(path(...relativePath.split('/')), 'utf8'));
  check(stableCanonical(current) === stableCanonical(baselineJson(relativePath)), `${relativePath} must remain unchanged by M04B2C research integration`);
}

if (failures.length) {
  console.error(`M04B2C tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B2C authority-first research integration tests passed');
  console.log(`Records by source: FIPAT_TA2=${indexCountsBySource.FIPAT_TA2}; NVH2008=${indexCountsBySource.NVH2008}; HMU2022=${indexCountsBySource.HMU2022}; UMP2023_T2=${indexCountsBySource.UMP2023_T2}`);
  console.log(`M04B2C concepts: authority evidence=${eligibleM04B2CConceptIds.size}; two authority sources=${authoritySourceConceptIds.length}; high-consensus=${highConsensusIds.length}; conflicts=${conflictIds.length}; variant reviews=1`);
  console.log(`Atlas coverage: ${results.summary.conceptCount}/${results.summary.expectedConceptCount}; exact=${results.summary.exactEnglishMatchConceptCount}; normalized=${results.summary.normalizedEnglishMatchConceptCount}; Latin=${results.summary.latinMatchConceptCount}`);
  console.log(`M03C regression: frozen=${results.regression.frozenM03CConceptCount}; pass=${results.regression.passCount}; mismatches=${results.regression.mismatchCount}; input gaps=${results.regression.inputGapCount}`);
  console.log(`Production coverage: searchable=${productionCoverage.searchableTerminologyEntries}; source-verified=${productionCoverage.sourceVerifiedEntries}; medically-reviewed=${productionCoverage.medicallyReviewedEntries}; release-eligible=${productionCoverage.releaseEligibleEntries}; release=${releaseDocument.releaseStatus}`);
}
