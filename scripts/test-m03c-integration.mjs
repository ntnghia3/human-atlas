import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {
  hasVerifiedVietnamese,
  matchesTerminologyQuery,
  terminologySearchTerms,
} from '../app/terminology.ts';
import {computeCoverage, REPOSITORY_ROOT, validateTerminologyData} from './validate-terminology.mjs';

const paths = {
  atlas: join(REPOSITORY_ROOT, 'public', 'models', 'atlas.json'),
  pilot: join(REPOSITORY_ROOT, 'docs', 'en-vi', 'pilot', 'M03A_PILOT_CONCEPTS.json'),
  matrix: join(REPOSITORY_ROOT, 'docs', 'en-vi', 'research', 'M03C_RESEARCH_EVIDENCE_MATRIX.json'),
  entries: join(REPOSITORY_ROOT, 'data', 'terminology', 'entries.json'),
  sources: join(REPOSITORY_ROOT, 'data', 'terminology', 'sources.json'),
  reviewers: join(REPOSITORY_ROOT, 'data', 'terminology', 'reviewers.json'),
  release: join(REPOSITORY_ROOT, 'data', 'terminology', 'release.json'),
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const [atlas, pilot, matrix, entriesDocument, sourcesDocument, reviewersDocument, releaseDocument] = await Promise.all(
  Object.values(paths).map(readJson),
);
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}
function sameSet(left, right) {
  return left.size === right.size && [...left].every(value => right.has(value));
}
function clone(value) {
  return structuredClone(value);
}

const pilotIds = new Set(pilot.concepts.map(record => record.conceptId));
const matrixById = new Map(matrix.concepts.map(record => [record.conceptId, record]));
const entries = entriesDocument.entries;
const entriesById = new Map(entries.map(entry => [entry.conceptId, entry]));
const sourceCatalog = Object.fromEntries(sourcesDocument.sources.map(source => [source.id, source]));
const reviewerCatalog = Object.fromEntries(reviewersDocument.reviewers.map(reviewer => [reviewer.id, reviewer]));
const overlay = Object.fromEntries(entries.map(entry => [entry.conceptId, entry]));
const conceptsById = new Map(atlas.concepts.map(concept => [concept.id, concept]));

const validation = validateTerminologyData({
  atlas,
  sourcesDocument,
  entriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(validation.errors.length === 0, `production terminology validation has ${validation.errors.length} error(s)`);

const expectedBucketCounts = {
  CONFLICT_REQUIRES_ADJUDICATION: 3,
  CONSENSUS_CANDIDATE: 11,
  ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED: 22,
  BASE_TERM_SCOPE_OR_LATERALITY_REVIEW: 8,
  IDENTITY_CONTEXT_REVIEW: 2,
  VARIANT_WITH_ALIAS_REVIEW: 4,
};
check(matrix.concepts.length === 50, `research matrix must contain 50 rows; found ${matrix.concepts.length}`);
check(entries.length === 50, `terminology registry must contain 50 entries; found ${entries.length}`);
check(sameSet(new Set(matrixById.keys()), pilotIds), 'research matrix concept ids must exactly equal the frozen M03A set');
check(sameSet(new Set(entriesById.keys()), pilotIds), 'terminology registry concept ids must exactly equal the frozen M03A set');
check(JSON.stringify(matrix.summary.dispositionCounts) === JSON.stringify(expectedBucketCounts), 'research matrix disposition counts must remain the six frozen M03C counts');

const actualBucketCounts = {};
for (const entry of entries) {
  const disposition = entry.researchDisposition;
  actualBucketCounts[disposition.dispositionBucket] = (actualBucketCounts[disposition.dispositionBucket] ?? 0) + 1;
  const matrixRow = matrixById.get(entry.conceptId);
  const matrixIndex = matrix.concepts.findIndex(record => record.conceptId === entry.conceptId);
  check(matrixRow?.dispositionBucket === disposition.dispositionBucket, `${entry.conceptId} disposition bucket differs from the research matrix`);
  check(matrixIndex + 1 === disposition.row, `${entry.conceptId} research row differs from the research matrix`);
  check(disposition.milestone === 'M03C1', `${entry.conceptId} is not marked M03C1`);
  check(entry.mapping.status === 'UNMAPPED' && entry.mapping.disposition === 'UNRESOLVED', `${entry.conceptId} mapping escaped the unresolved research state`);
  check(entry.review.status === 'DRAFT', `${entry.conceptId} review status escaped DRAFT`);
  check(!entry.review.sourceVerification && !entry.review.medicalReview && !entry.review.releaseEligibility, `${entry.conceptId} contains a review audit during M03C1`);
  check(!entry.releaseEligibility, `${entry.conceptId} contains a release decision during M03C1`);
  check(entry.claims.every(claim => claim.evidenceDisposition === 'CANDIDATE' && claim.reviewState === 'PENDING'), `${entry.conceptId} contains a non-candidate or non-pending claim`);
  check(entry.mapping.mappings.length === 0, `${entry.conceptId} contains an external mapping before identity review`);
}
check(JSON.stringify(actualBucketCounts) === JSON.stringify(expectedBucketCounts), 'registry disposition counts must match the research matrix counts');

const coverage = validation.coverage;
check(coverage.sourceVerifiedEntries === 0, `source-verified coverage must remain zero; found ${coverage.sourceVerifiedEntries}`);
check(coverage.medicallyReviewedEntries === 0, `medical-review coverage must remain zero; found ${coverage.medicallyReviewedEntries}`);
check(coverage.releaseEligibleEntries === 0, `release-eligible coverage must remain zero; found ${coverage.releaseEligibleEntries}`);
check(coverage.searchableTerminologyEntries === 0, `production searchable coverage must remain zero; found ${coverage.searchableTerminologyEntries}`);
check(releaseDocument.releaseStatus === 'UNRELEASED', 'release manifest must remain UNRELEASED');
check(reviewersDocument.reviewers.length === 0, 'reviewer registry must remain empty');
check(matrix.summary.sourceVerified === 0 && matrix.summary.medicalReviewed === 0 && matrix.summary.releaseEligible === 0, 'research matrix release coverage must remain zero');

for (const [bucket, expected] of Object.entries(expectedBucketCounts)) check(actualBucketCounts[bucket] === expected, `${bucket} must contain ${expected} rows; found ${actualBucketCounts[bucket] ?? 0}`);

const accessCopySourceIds = ['UMP2023_T2_ACCESS', 'NQQ_T1_ACCESS'];
for (const sourceId of accessCopySourceIds) {
  const source = sourceCatalog[sourceId];
  check(source?.authorityTier === 'discovery-only', `${sourceId} must remain discovery-only`);
  check(typeof source?.accessCopyOf === 'string' && sourceCatalog[source.accessCopyOf], `${sourceId} must point to an identified authority source`);
}
for (const sourceId of ['HMU2022', 'UMP2023_T2', 'vi-ump-bai-giang-anatomy-2019', 'NVH2008']) {
  const source = sourceCatalog[sourceId];
  check(source?.authorityTier === 'authoritative', `${sourceId} must remain the authority record`);
  check(source?.accessCopy?.relation === 'access-copy', `${sourceId} must record a separate access-copy relation`);
  check(source?.accessCopy?.url && source.accessCopy.url !== source.url, `${sourceId} access-copy URL must not replace the authority URL`);
}

const accessCopyEntry = clone(entriesById.get('FMA9613'));
accessCopyEntry.claims = [{
  ...clone(accessCopyEntry.claims[0]),
  sourceId: 'UMP2023_T2_ACCESS',
  sourceRevision: sourceCatalog.UMP2023_T2_ACCESS.revision,
}];
const accessCopyValidation = validateTerminologyData({
  atlas,
  sourcesDocument,
  entriesDocument: {...entriesDocument, entries: [accessCopyEntry]},
  reviewersDocument,
  releaseDocument,
});
check(accessCopyValidation.errors.some(error => error.code === 'vietnamese-claim-source-authority'), 'a mirror/access-copy record must not satisfy Vietnamese claim authority');

const fastLane = {
  FMA9613: {term: 'xương đỉnh', page: 30, entryId: 'A02.1.02.00'},
  FMA9756: {term: 'cơ gian sườn ngoài', page: 129, entryId: 'A04.4.01.01'},
  FMA13343: {term: 'cơ ức-giáp', page: 122, entryId: 'A04.2.04.00'},
  FMA51061: {term: 'gân gót', page: 148, entryId: 'A04.7.02.04'},
  FMA55139: {term: 'dây chằng giáp-móng bên', page: 199, entryId: 'A06.2.02.01'},
  FMA55237: {term: 'dây chằng nhẫn-giáp giữa', page: 199, entryId: 'A06.2.03.00'},
  FMA3951: {term: 'động mạch dưới đòn', page: 289, entryId: 'A12.2.08.00'},
  FMA10662: {term: 'động mạch giáp dưới', page: 292, entryId: 'A12.2.08.04'},
  FMA4725: {term: 'tĩnh mạch dưới đòn', page: 332, entryId: 'A12.3.08.00'},
  FMA7148: {term: 'dạ dày', page: 176, entryId: 'A05.5.01.00'},
  FMA7198: {term: 'tụy', page: 192, entryId: 'A05.9.01.00'},
};
check(Object.keys(fastLane).length === 11, 'fast-lane locator pinning must cover exactly 11 concepts');
for (const [conceptId, expected] of Object.entries(fastLane)) {
  const entry = entriesById.get(conceptId);
  const claim = entry?.claims.find(item => item.type === 'vietnamese-preferred' && item.target === expected.term);
  check(Boolean(claim), `${conceptId} is missing its fast-lane Vietnamese candidate claim`);
  if (claim) {
    check(claim.sourceId === 'NVH2008', `${conceptId} fast-lane claim must use NVH2008`);
    check(claim.sourceRevision === sourceCatalog.NVH2008.revision, `${conceptId} fast-lane claim has a stale NVH2008 revision`);
    check(claim.locator.page === expected.page && claim.locator.entryId === expected.entryId, `${conceptId} fast-lane locator is not the pinned page/entry`);
    check(claim.evidenceDisposition === 'CANDIDATE' && claim.reviewState === 'PENDING', `${conceptId} fast-lane claim escaped CANDIDATE/PENDING`);
  }
}

const candidateSearchChecks = [
  ['FMA9613', 'xương đỉnh'],
  ['FMA51061', 'gân Achilles'],
  ['FMA51061', 'gân Achillis'],
  ['FMA7148', 'vị'],
  ['FMA7196', 'tỳ'],
];
for (const [conceptId, candidate] of candidateSearchChecks) {
  const concept = conceptsById.get(conceptId);
  const entry = entriesById.get(conceptId);
  check(!matchesTerminologyQuery(concept, candidate, overlay, sourceCatalog, reviewerCatalog), `${conceptId} candidate term '${candidate}' entered production search`);
  check(!terminologySearchTerms(concept, entry, sourceCatalog, reviewerCatalog).includes(candidate), `${conceptId} candidate term '${candidate}' is present in the production search terms`);
}
check(!entriesById.get('FMA51061').vietnamese.aliases.includes('gân Achilles'), 'Achilles candidate must not be stored as a Vietnamese alias');
check(!entriesById.get('FMA7148').vietnamese.aliases.includes('vị'), 'Vị candidate must not be stored as a Vietnamese alias');

const conflictExpectations = {
  FMA16586: ['xương chậu', 'xương hông'],
  FMA16587: ['xương chậu', 'xương hông'],
  FMA24499: ['xương thuyền', 'xương ghe'],
};
for (const [conceptId, terms] of Object.entries(conflictExpectations)) {
  const entry = entriesById.get(conceptId);
  check(entry.conflicts?.length === 1 && entry.conflicts[0].status === 'OPEN', `${conceptId} must retain one open conflict`);
  check(sameSet(new Set(entry.claims.map(claim => claim.target)), new Set(terms)), `${conceptId} must preserve both explicit conflict terms`);
  check(!entry.vietnamese?.preferred, `${conceptId} must not expose a preferred term while its conflict is open`);
  check(!hasVerifiedVietnamese(entry, sourceCatalog, reviewerCatalog), `${conceptId} open conflict passed the Vietnamese release gate`);
}
check(validation.coverage.conflictsAwaitingAdjudication === 3, 'exactly three conflicts must await adjudication');
check(!entriesById.get('FMA55237').claims.some(claim => claim.target === 'dây chằng nhẫn-giáp'), 'bare median cricothyroid ligament wording must not become an alias');

const sideSpecificSafeguards = [
  'FMA264844', 'FMA44249', 'FMA44250', 'FMA50875', 'FMA50878', 'FMA15629', 'FMA15630',
  'FMA58418', 'FMA58419',
];
for (const conceptId of sideSpecificSafeguards) check(!entriesById.get(conceptId).vietnamese?.preferred, `${conceptId} must not receive a composed side-specific canonical term`);
for (const conceptId of ['FMA3802', 'FMA3813', 'FMA8668', 'FMA8669', 'FMA5913', 'FMA52570', 'FMA25511', 'FMA25571', 'FMA26086', 'FMA26089', 'FMA79063', 'FMA58775', 'FMA57965']) {
  check(!entriesById.get(conceptId).vietnamese?.preferred, `${conceptId} must remain without a Vietnamese canonical term`);
}
check(entriesById.get('FMA3802').researchDisposition.candidateTermForReview === null, 'FMA3802 must not invent the coronary trunk/right-coronary term');
check(entriesById.get('FMA58775').researchDisposition.suggestedFormForReview !== 'mạc đùi', 'zone of fascia lata must not collapse to fascia lata');

const staleEntriesDocument = clone(entriesDocument);
staleEntriesDocument.entries.find(entry => entry.conceptId === 'FMA9613').claims[0].sourceRevision = 'NVH-2008-STALE';
const staleValidation = validateTerminologyData({
  atlas,
  sourcesDocument,
  entriesDocument: staleEntriesDocument,
  reviewersDocument,
  releaseDocument,
});
check(staleValidation.errors.some(error => error.code === 'claim-source-revision-mismatch'), 'stale source revision must be rejected');
check(staleValidation.coverage.releaseEligibleEntries === 0, 'stale source evidence must not produce release coverage');

const openConflictWithPreferred = clone(entriesById.get('FMA16586'));
openConflictWithPreferred.vietnamese = {preferred: 'xương chậu', aliases: [], searchAliases: [], asciiSearchForms: []};
const openConflictValidation = validateTerminologyData({
  atlas,
  sourcesDocument,
  entriesDocument: {...entriesDocument, entries: [openConflictWithPreferred]},
  reviewersDocument,
  releaseDocument,
});
check(openConflictValidation.errors.some(error => error.code === 'open-conflict-preferred-term'), 'open conflict preferred-term guard must reject a canonical field');

if (failures.length) {
  console.error(`M03C integration tests failed with ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('M03C integration tests passed');
  console.log(`Frozen concepts: ${pilotIds.size}; buckets: ${Object.entries(actualBucketCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`Fast-lane locators: ${Object.keys(fastLane).length}; source-verified: ${coverage.sourceVerifiedEntries}; medically reviewed: ${coverage.medicallyReviewedEntries}; release eligible: ${coverage.releaseEligibleEntries}; searchable: ${coverage.searchableTerminologyEntries}`);
  console.log(`Conflicts awaiting adjudication: ${coverage.conflictsAwaitingAdjudication}; access-copy records: ${accessCopySourceIds.length}; stale-revision guard: active`);
}
