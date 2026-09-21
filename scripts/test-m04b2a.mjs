import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
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
const START_COMMIT = 'd85ae6dd54b661c0023c00b8fd470336f14e8c1e';
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

const sourceSeedPath = path('docs', 'en-vi', 'research', 'M04B2A', 'M04B2_NVH2008_PUBLIC_RESEARCH_SEED.jsonl');
const corpusPath = path('data', 'terminology', 'research', 'corpora', 'nvh2008-public-research-seed.jsonl');
const packPath = path('docs', 'en-vi', 'research', 'M04B2A', 'M04B2_PUBLIC_RESEARCH_PACK.json');
const [atlas, sourceDocument, entriesDocument, reviewersDocument, releaseDocument, pack, suppliedCorpus, preservedCorpus, index, results] = await Promise.all([
  readJson(path('public', 'models', 'atlas.json')),
  readJson(path('data', 'terminology', 'sources.json')),
  readJson(path('data', 'terminology', 'entries.json')),
  readJson(path('data', 'terminology', 'reviewers.json')),
  readJson(path('data', 'terminology', 'release.json')),
  readJson(packPath),
  readCorpusFiles([sourceSeedPath]),
  readCorpusFiles([corpusPath]),
  readJson(path('data', 'terminology', 'research', 'bulk-source-index.json')),
  readJson(path('data', 'terminology', 'research', 'bulk-match-results.json')),
]);

const suppliedValidationErrors = suppliedCorpus.records.flatMap((record, index) => validateCorpusRecord(record, `supplied[${index}]`));
const preservedValidationErrors = preservedCorpus.records.flatMap((record, index) => validateCorpusRecord(record, `preserved[${index}]`));
check(suppliedValidationErrors.length === 0, `supplied NVH corpus schema errors: ${suppliedValidationErrors.join('; ')}`);
check(preservedValidationErrors.length === 0, `preserved NVH corpus schema errors: ${preservedValidationErrors.join('; ')}`);
check(suppliedCorpus.records.length === 28, `supplied NVH record count must be 28; found ${suppliedCorpus.records.length}`);
check(preservedCorpus.records.length === 28, `preserved NVH record count must be 28; found ${preservedCorpus.records.length}`);
check(stableCanonical(suppliedCorpus.records) === stableCanonical(preservedCorpus.records), 'preserved NVH corpus must retain the supplied records verbatim');
check(new Set(preservedCorpus.records.map(record => record.sourceId)).size === 1 && preservedCorpus.records[0].sourceId === 'NVH2008', 'all preserved records must remain NVH2008');
check(new Set(preservedCorpus.records.map(record => record.sourceRevision)).size === 1 && preservedCorpus.records[0].sourceRevision === 'NVH-2008-312P', 'all preserved records must retain NVH-2008-312P');
check(preservedCorpus.records.every(record => record.vietnamese?.aliases?.length === 0), 'Vietnamese aliases from the pack must not be activated automatically');

check(pack.recordCount === 28, `research pack recordCount must be 28; found ${pack.recordCount}`);
check(pack.status === 'RESEARCH_ONLY_NOT_RELEASE', 'research pack must remain research-only');
check(pack.conceptBindings.length === 31, `research pack must contain 31 concept bindings; found ${pack.conceptBindings.length}`);
check(pack.releaseState?.sourceVerified === 0 && pack.releaseState?.medicalReviewed === 0 && pack.releaseState?.releaseEligible === 0 && pack.releaseState?.searchableVietnamese === 0, 'research pack release state must remain zero');

const expectedCombinedCount = index.inputFiles.includes('data/terminology/research/corpora/m04b2c-vi-authority.jsonl') ? 7183 : 7140;
check(index.inputRecordCount === expectedCombinedCount, `combined index input count must be ${expectedCombinedCount}; found ${index.inputRecordCount}`);
check(index.indexedRecordCount === expectedCombinedCount, `combined index count must be ${expectedCombinedCount}; found ${index.indexedRecordCount}`);
check(index.duplicateEvidenceRecordCount === 0, 'combined corpus must not contain duplicate evidence records');
check(index.unresolvedSourceIds.length === 0, `combined corpus has unresolved sources: ${index.unresolvedSourceIds.join(', ')}`);
check(index.sourceRevisionMismatches.length === 0, `combined corpus has source revision mismatches: ${index.sourceRevisionMismatches.join(', ')}`);
check(index.inputFiles.includes('data/terminology/research/corpora/fipat-ta2-2019.jsonl'), 'combined index must retain the FIPAT input provenance');
check(index.inputFiles.includes('data/terminology/research/corpora/nvh2008-public-research-seed.jsonl'), 'combined index must retain the NVH input provenance');

const countsBySource = Object.fromEntries([...new Set(index.records.map(item => item.record.sourceId))].sort().map(sourceId => [sourceId, index.records.filter(item => item.record.sourceId === sourceId).length]));
check(countsBySource.FIPAT_TA2 === 7112, `FIPAT record count must remain 7112; found ${countsBySource.FIPAT_TA2}`);
check(countsBySource.NVH2008 === 28, `NVH2008 record count must be 28; found ${countsBySource.NVH2008}`);

check(results.concepts.length === 3432, `bulk matcher must emit 3432 concepts; found ${results.concepts.length}`);
check(results.researchAnnotations?.schemaVersion === 'm04b2a-research-annotations-1', 'bulk output must identify the research annotation schema');
check(results.researchAnnotations?.conceptBindingCount === 31, 'bulk output must preserve all 31 concept bindings as annotations');
check(results.researchAnnotations?.boundConceptCount === 31, 'bulk output must preserve 31 bound concepts as annotations');
check(results.researchAnnotations?.sourcePack?.status === 'RESEARCH_ONLY_NOT_RELEASE', 'bulk output research annotations must remain non-production');
check(results.concepts.flatMap(item => item.candidateConsensus.aliases).length === 0, 'NVH Vietnamese aliases must not enter candidate alias activation');

const badRevision = structuredClone(preservedCorpus.records[0]);
badRevision.sourceRevision = 'NVH-2008-WRONG-REVISION';
const badIndex = buildSourceIndex({
  records: [badRevision],
  inputFiles: [corpusPath],
  inputFileLabels: ['data/terminology/research/corpora/nvh2008-public-research-seed.jsonl'],
  sourceCatalogDocument: sourceDocument,
});
check(badIndex.sourceRevisionMismatches.includes('NVH2008:NVH-2008-WRONG-REVISION'), 'source revision mismatch must be rejected from authority eligibility');
const badResults = matchAtlasConcepts({
  atlas,
  index: badIndex,
  sourceCatalog: loadSourceCatalogDocument(sourceDocument),
  m03cEntries: entriesDocument.entries,
  researchPack: pack,
});
const badParietal = resultById(badResults, 'FMA9613');
check(badParietal.vietnameseCandidateEvidence.some(item => item.sourceId === 'NVH2008' && item.sourceProfile.revisionMatches === false && item.sourceProfile.researchEligibleVietnamese === false), 'mismatched NVH revision must not produce eligible Vietnamese evidence');
check(badParietal.researchBucket !== 'HIGH_CONSENSUS_CANDIDATE', 'mismatched NVH revision must not produce a high-consensus candidate');

const parietal = resultById(results, 'FMA9613');
check(parietal.researchAnnotations?.conceptBindings?.[0]?.candidate === 'xương đỉnh', 'explicit parietal binding must remain visible as a research annotation');
check(!('vietnamese' in parietal) && !('mapping' in parietal) && !('release' in parietal), 'research binding must not become a production terminology or mapping field');

for (const conceptId of ['FMA16586', 'FMA16587', 'FMA24499']) {
  const item = resultById(results, conceptId);
  check(item.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION', `${conceptId} conflict must remain blocking`);
  check(item.candidateConsensus.status === 'CONFLICT', `${conceptId} must retain conflicting terminology without selecting a winner`);
}

for (const conceptId of ['FMA16586', 'FMA16587']) {
  const item = resultById(results, conceptId);
  check(item.researchAnnotations?.conceptBindings?.[0]?.candidate === null, `${conceptId} must not receive a synthesized side-specific candidate`);
  check(!item.vietnamese, `${conceptId} must not receive a synthesized Vietnamese field`);
}

const pluralRecord = preservedCorpus.records.find(record => record.locator.entryId === 'A04.4.01.012');
check(pluralRecord?.english?.preferred === 'External intercostal muscles', 'NVH plural source wording must remain plural');
check(!preservedCorpus.records.some(record => record.english?.preferred === 'External intercostal muscle'), 'NVH plural source wording must not be silently singularized');
const pluralConcept = resultById(results, 'FMA9756');
check(pluralConcept.sourceMatches.filter(item => item.sourceId === 'NVH2008').length === 0, 'singular atlas wording must not silently match the plural NVH source');
check(pluralConcept.researchAnnotations?.conceptBindings?.[0]?.candidate === 'cơ gian sườn ngoài', 'plural mismatch binding must remain research-only');

check(resultById(results, 'FMA58775').researchBucket === 'AGGREGATE_OR_COMPOSITE_REVIEW', 'fascia-lata zone must remain an aggregate/scope review');
check(resultById(results, 'FMA25511').researchBucket === 'ONTOLOGY_SCOPE_REVIEW', 'generic vertebral-column symphysis must remain ontology/scope review');
check(preservedCorpus.records.find(record => record.locator.entryId === 'A04.7.03.002')?.laterality === 'unsided', 'fascia-lata source must remain unsided and generic');
check(preservedCorpus.records.find(record => record.locator.entryId === 'A03.2.02.001')?.english?.preferred === 'Symphysis of vertebral column', 'vertebral-column source wording must remain generic');

const productionValidation = validateTerminologyData({
  atlas,
  sourcesDocument: sourceDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(productionValidation.errors.length === 0, `production terminology validation must remain clean; found ${productionValidation.errors.length} error(s)`);
const productionCoverage = computeCoverage(atlas, entriesDocument.entries, productionValidation.sourceCatalog, productionValidation.reviewerCatalog);
check(productionCoverage.searchableTerminologyEntries === 0, 'research pack must not change searchable production coverage');
check(productionCoverage.sourceVerifiedEntries === 0, 'research pack must not create source-verified coverage');
check(productionCoverage.medicallyReviewedEntries === 0, 'research pack must not create medical-review coverage');
check(productionCoverage.releaseEligibleEntries === 0, 'research pack must not create release-eligible coverage');
check(reviewersDocument.reviewers.length === 0, 'research pack must not create reviewers');
check(releaseDocument.releaseStatus === 'UNRELEASED', 'research pack must keep the release manifest UNRELEASED');

for (const relativePath of ['data/terminology/entries.json', 'data/terminology/reviewers.json', 'data/terminology/release.json']) {
  const current = JSON.parse(await readFile(path(...relativePath.split('/')), 'utf8'));
  const baseline = baselineJson(relativePath);
  check(stableCanonical(current) === stableCanonical(baseline), `${relativePath} must remain unchanged by research-pack integration`);
}

if (failures.length) {
  console.error(`M04B2A tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04B2A public research pack tests passed');
  console.log(`Records by source: FIPAT_TA2=${countsBySource.FIPAT_TA2}; NVH2008=${countsBySource.NVH2008}`);
  console.log(`Concept bindings: ${results.researchAnnotations.conceptBindingCount}; bound concepts: ${results.researchAnnotations.boundConceptCount}`);
  console.log(`Atlas concepts: ${results.summary.conceptCount}/${results.summary.expectedConceptCount}; exact=${results.summary.exactEnglishMatchConceptCount}; normalized=${results.summary.normalizedEnglishMatchConceptCount}; authoritative Vietnamese evidence=${results.summary.authoritativeVietnameseEvidenceConceptCount}`);
  console.log(`M03C regression: frozen=${results.regression.frozenM03CConceptCount}; mismatches=${results.regression.mismatchCount}; input gaps=${results.regression.inputGapCount}`);
  console.log(`Production coverage: searchable=${productionCoverage.searchableTerminologyEntries}; source-verified=${productionCoverage.sourceVerifiedEntries}; medically-reviewed=${productionCoverage.medicallyReviewedEntries}; release-eligible=${productionCoverage.releaseEligibleEntries}`);
}
