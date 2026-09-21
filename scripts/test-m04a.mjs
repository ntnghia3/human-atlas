import assert from 'node:assert/strict';
import {join} from 'node:path';

import {
  buildSourceIndex,
  loadSourceCatalogDocument,
  matchAtlasConcepts,
  readCorpusFiles,
  readJson,
} from './m04a-bulk-evidence.mjs';
import {computeCoverage, validateTerminologyData} from './validate-terminology.mjs';

const ROOT = new URL('..', import.meta.url);
const path = (...parts) => new URL(parts.join('/'), ROOT).pathname.replace(/^\//, '').replace(/\//g, '\\');
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}
function resultById(results, id) {
  const result = results.concepts.find(item => item.conceptId === id);
  assert.ok(result, `fixture result is missing ${id}`);
  return result;
}
const [atlas, sourceDocument, entriesDocument, reviewersDocument, releaseDocument, fixtureSources, fixtureCorpus] = await Promise.all([
  readJson(path('public', 'models', 'atlas.json')),
  readJson(path('data', 'terminology', 'sources.json')),
  readJson(path('data', 'terminology', 'entries.json')),
  readJson(path('data', 'terminology', 'reviewers.json')),
  readJson(path('data', 'terminology', 'release.json')),
  readJson(path('data', 'terminology', 'research', 'fixtures', 'M04A_SYNTHETIC_SOURCES.json')),
  readCorpusFiles([path('data', 'terminology', 'research', 'fixtures', 'M04A_SYNTHETIC_CORPUS.jsonl')]),
]);

const fixtureIndex = buildSourceIndex({
  records: fixtureCorpus.records,
  inputFiles: fixtureCorpus.files,
  sourceCatalogDocument: fixtureSources,
});
const fixtureResults = matchAtlasConcepts({
  atlas,
  index: fixtureIndex,
  sourceCatalog: loadSourceCatalogDocument(fixtureSources),
  m03cEntries: entriesDocument.entries,
});

check(atlas.concepts.length === 3432, `atlas must contain 3,432 concepts; found ${atlas.concepts.length}`);
check(fixtureResults.concepts.length === 3432, `bulk matcher must emit one result per atlas concept; found ${fixtureResults.concepts.length}`);
check(fixtureIndex.inputRecordCount > fixtureIndex.indexedRecordCount, 'duplicate evidence fixture must be detected');
check(fixtureIndex.duplicateEvidenceRecordCount === 1, `duplicate evidence count must be 1; found ${fixtureIndex.duplicateEvidenceRecordCount}`);
check(fixtureIndex.indexes.terminologyIds['fix-ta2-inferior-thyroid']?.length === 1, 'terminology IDs must be indexed');
check(fixtureIndex.records.some(item => item.record.sourceTermRaw === 'xương đỉnh'), 'raw source wording must survive indexing');
check(fixtureIndex.records.some(item => item.record.locator.entryId === 'FIX-PARIETAL-A'), 'exact locator must survive indexing');

const parietal = resultById(fixtureResults, 'FMA9613');
check(parietal.researchBucket === 'HIGH_CONSENSUS_CANDIDATE', `FMA9613 must be HIGH_CONSENSUS_CANDIDATE; found ${parietal.researchBucket}`);
check(parietal.candidateConsensus.status === 'AGREED', 'FMA9613 candidate consensus must be agreement, not a release decision');
check(parietal.candidateConsensus.independentAuthoritativeSourceCount === 2, 'FMA9613 must record agreement from two independent synthetic authoritative sources');
check(parietal.candidateConsensus.agreedTerm === 'xương đỉnh', 'FMA9613 must preserve the source candidate wording');

for (const id of ['FMA16586', 'FMA16587', 'FMA24499']) {
  const item = resultById(fixtureResults, id);
  check(item.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION', `${id} conflict must remain unresolved`);
  check(item.candidateConsensus.status === 'CONFLICT', `${id} must expose conflicting candidate evidence without selecting a winner`);
}

for (const id of ['FMA33302', 'FMA52570', 'FMA58775']) {
  const item = resultById(fixtureResults, id);
  check(item.researchBucket === 'AGGREGATE_OR_COMPOSITE_REVIEW', `${id} must remain an aggregate/composite review case`);
  check(item.meshHeuristics.aggregateOrComposite, `${id} aggregate heuristic must be flagged`);
}

const laterality = resultById(fixtureResults, 'FMA50875');
check(laterality.researchBucket === 'LATERALITY_REVIEW', 'laterality mismatch must not be corrected automatically');
check(laterality.semanticFlags.some(flag => flag.code === 'LATERALITY_MISMATCH'), 'laterality mismatch flag must be emitted');

const arteryVein = resultById(fixtureResults, 'FMA4723');
check(arteryVein.semanticFlags.some(flag => flag.code === 'CATEGORY_MISMATCH' && flag.pair === 'artery/vein'), 'artery/vein mismatch must be flagged');

const nerveLigament = resultById(fixtureResults, 'FMA55135');
check(nerveLigament.semanticFlags.some(flag => flag.code === 'CATEGORY_MISMATCH' && flag.pair === 'ligament/nerve'), 'nerve/ligament mismatch must be flagged');

const alias = resultById(fixtureResults, 'FMA51061');
check(alias.vietnameseCandidateEvidence.some(item => item.vietnamese?.aliases?.includes('gân Achilles')), 'source aliases must be preserved as evidence');
check(!alias.candidateConsensus.aliases.every(item => item.term !== 'gân Achilles'), 'source alias must remain visible to research review');

check(fixtureResults.normalizedCandidateCollisions.some(item => item.conceptIds.includes('FMA4723') && item.conceptIds.includes('FMA4751')), 'normalized Vietnamese collision must be reported across concepts');
check(resultById(fixtureResults, 'FMA4723').semanticFlags.some(flag => flag.code === 'NORMALIZED_CANDIDATE_COLLISION'), 'collision must be attached to each affected concept');

const missingEvidence = resultById(fixtureResults, 'FMA7203');
check(missingEvidence.researchBucket === 'SOURCE_GAP', 'identity with no Vietnamese evidence must remain a source gap');
const staleRevision = resultById(fixtureResults, 'FMA7148');
check(staleRevision.researchBucket === 'SOURCE_GAP', 'source revision mismatch must block candidate classification');
check(staleRevision.sourceGapReasons.includes('SOURCE_REVISION_MISMATCH'), 'source revision mismatch reason must be explicit');
const accessCopy = resultById(fixtureResults, 'FMA13343');
check(accessCopy.researchBucket === 'SOURCE_GAP', 'discovery-only access copy must not create HIGH_CONSENSUS_CANDIDATE');
check(accessCopy.vietnameseCandidateEvidence.every(item => item.sourceProfile.authorityTier === 'discovery-only'), 'access-copy evidence must retain discovery-only provenance');
const machineEvidence = resultById(fixtureResults, 'FMA7198');
check(machineEvidence.researchBucket === 'SOURCE_GAP', 'machine-generated evidence must not create HIGH_CONSENSUS_CANDIDATE');

const requiredRegressionIds = ['FMA16586', 'FMA24499', 'FMA9613', 'FMA33302', 'FMA52570', 'FMA58775'];
for (const id of requiredRegressionIds) check(resultById(fixtureResults, id).m03cRegression?.status === 'PASS', `${id} M03C regression fixture must pass`);
check(fixtureResults.regression.mismatchCount === 0, `M03C regression must have no mismatches; found ${fixtureResults.regression.mismatchCount}`);

const productionValidation = validateTerminologyData({
  atlas,
  sourcesDocument: sourceDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(productionValidation.errors.length === 0, `production terminology validation must remain clean; found ${productionValidation.errors.length} error(s)`);
const productionCoverage = computeCoverage(atlas, entriesDocument.entries, productionValidation.sourceCatalog, productionValidation.reviewerCatalog);
check(productionCoverage.searchableTerminologyEntries === 0, 'M04A must not change production searchable coverage');
check(productionCoverage.sourceVerifiedEntries === 0, 'M04A must not create source-verified coverage');
check(productionCoverage.medicallyReviewedEntries === 0, 'M04A must not create medical-review coverage');
check(productionCoverage.releaseEligibleEntries === 0, 'M04A must not create release-eligible coverage');
check(reviewersDocument.reviewers.length === 0, 'M04A must not create reviewers');
check(releaseDocument.releaseStatus === 'UNRELEASED', 'M04A must keep the release manifest UNRELEASED');

if (failures.length) {
  console.error(`M04A tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M04A bulk evidence pipeline tests passed');
  console.log(`Dry-run concepts: ${fixtureResults.summary.conceptCount}/${fixtureResults.summary.expectedConceptCount}`);
  console.log(`Synthetic records: ${fixtureIndex.inputRecordCount}; indexed: ${fixtureIndex.indexedRecordCount}; duplicates: ${fixtureIndex.duplicateEvidenceRecordCount}`);
  console.log(`Regression fixtures: ${fixtureResults.regression.frozenM03CConceptCount}; mismatches: ${fixtureResults.regression.mismatchCount}; input gaps: ${fixtureResults.regression.inputGapCount}`);
  console.log(`Production coverage: searchable=${productionCoverage.searchableTerminologyEntries}; source-verified=${productionCoverage.sourceVerifiedEntries}; medically-reviewed=${productionCoverage.medicallyReviewedEntries}; release-eligible=${productionCoverage.releaseEligibleEntries}`);
}
