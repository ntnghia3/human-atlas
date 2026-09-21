import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {
  computeTerminologyRevision,
  hasVerifiedLatin,
  hasVerifiedVietnamese,
  matchesTerminologyQuery,
} from '../app/terminology.ts';
import {computeCoverage, REPOSITORY_ROOT, validateTerminologyData} from './validate-terminology.mjs';

const atlas = JSON.parse(await readFile(join(REPOSITORY_ROOT, 'public', 'models', 'atlas.json'), 'utf8'));
const conceptA = atlas.concepts[0];
const conceptB = atlas.concepts[1];
const meshA = conceptA.elements[0];
const meshB = conceptB.elements[0];

function source({id, className, capabilities, revision = 'TEST_ONLY_SOURCE_REV_1'}) {
  return {id, class: className, title: `${id} TEST_ONLY fixture`, revision, capabilities, audit: {status: 'VERIFIED', verifiedAt: '2026-01-01', verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER'}};
}
const internationalSource = source({id: 'TEST_ONLY_NOMENCLATURE', className: 'international-nomenclature', capabilities: {anatomicalIdentity: true, canonicalLatin: true, vietnamesePreferred: false, secondaryCorroboration: false, machineCandidateDiscovery: false}});
const vietnameseSource = source({id: 'TEST_ONLY_VI', className: 'vietnamese-authoritative', capabilities: {anatomicalIdentity: false, canonicalLatin: false, vietnamesePreferred: true, secondaryCorroboration: false, machineCandidateDiscovery: false}});
const secondarySource = source({id: 'TEST_ONLY_SECONDARY', className: 'secondary-reference', capabilities: {anatomicalIdentity: false, canonicalLatin: false, vietnamesePreferred: false, secondaryCorroboration: true, machineCandidateDiscovery: false}});
const machineSource = source({id: 'TEST_ONLY_MACHINE', className: 'machine-generated', capabilities: {anatomicalIdentity: false, canonicalLatin: false, vietnamesePreferred: false, secondaryCorroboration: false, machineCandidateDiscovery: true}});
const sources = [internationalSource, vietnameseSource, secondarySource, machineSource];
const reviewers = [
  {id: 'TEST_ONLY_SOURCE_REVIEWER', displayName: 'TEST_ONLY source reviewer', role: 'source verifier', qualifications: ['TEST_ONLY'], authorizationScope: ['*'], status: 'ACTIVE'},
  {id: 'TEST_ONLY_MEDICAL_REVIEWER', displayName: 'TEST_ONLY medical reviewer', role: 'medical reviewer', qualifications: ['TEST_ONLY'], authorizationScope: ['*'], status: 'ACTIVE'},
  {id: 'TEST_ONLY_UNAUTHORIZED', displayName: 'TEST_ONLY unauthorized', role: 'observer', qualifications: ['TEST_ONLY'], authorizationScope: [], status: 'ACTIVE'},
];

function documents(entries, sourceRecords = sources, reviewerRecords = reviewers) {
  return {
    atlas,
    sourcesDocument: {schemaVersion: 2, sources: sourceRecords},
    entriesDocument: {schemaVersion: 2, entries},
    reviewersDocument: {schemaVersion: 1, reviewers: reviewerRecords},
    releaseDocument: {schemaVersion: 1, releaseStatus: 'UNRELEASED', atlasVersion: atlas.version, atlasRevision: 'UNRELEASED', registryRevision: 'UNRELEASED', sourceCatalogRevision: 'UNRELEASED', reviewersRevision: 'UNRELEASED', policyVersion: 'M02B', entryRevisions: {}},
  };
}

function baseEntry(concept = conceptA) {
  return {key: concept.id, conceptId: concept.id, english: {preferred: concept.name, aliases: []}, mapping: {status: 'UNMAPPED', disposition: 'NOT_INVESTIGATED', mappings: []}, claims: [], review: {status: 'UNMAPPED'}};
}

function claim(id, type, target, sourceId = internationalSource.id, sourceRevision = internationalSource.revision, locator = {entryId: `TEST_ONLY_${id}`}) {
  return {id, type, target, sourceId, sourceRevision, locator, evidenceDisposition: 'SUPPORTED', reviewState: 'VERIFIED'};
}

function verifiedEntry(concept = conceptA, preferred = 'TEST_ONLY_VI_PREFERRED') {
  const entry = {
    ...baseEntry(concept),
    atlas: {meshIds: [concept.elements[0]], scope: 'packaged-mesh'},
    english: {preferred: concept.name, aliases: ['TEST_ONLY_ENGLISH_ALIAS']},
    latin: {preferred: 'TEST_ONLY_LATIN_TERM', aliases: ['TEST_ONLY_LATIN_ALIAS']},
    vietnamese: {preferred, aliases: ['TEST_ONLY_VI_ALIAS'], searchAliases: ['TEST_ONLY_VI_SEARCH'], asciiSearchForms: ['test_only_vi_search']},
    mapping: {status: 'MAPPED', mappings: [
      {id: 'TEST_ONLY_FMA_MAP', namespace: 'FMA', identifier: 'TEST_ONLY_FMA_ID', sourceRevision: internationalSource.revision, relation: 'exact', disposition: 'VERIFIED', evidenceClaimIds: ['TEST_ONLY_FMA_CLAIM']},
      {id: 'TEST_ONLY_TA2_MAP', namespace: 'TA2', identifier: 'TEST_ONLY_TA2_ID', sourceRevision: internationalSource.revision, relation: 'equivalent', disposition: 'VERIFIED', evidenceClaimIds: ['TEST_ONLY_TA2_CLAIM']},
    ]},
    claims: [
      claim('TEST_ONLY_MESH_CLAIM', 'atlas-identity', concept.elements[0]),
      claim('TEST_ONLY_FMA_CLAIM', 'atlas-fma-mapping', 'TEST_ONLY_FMA_ID', internationalSource.id, internationalSource.revision, {entryId: 'TEST_ONLY_FMA_ENTRY', nomenclatureId: 'TEST_ONLY_FMA_ID'}),
      claim('TEST_ONLY_TA2_CLAIM', 'atlas-ta2-mapping', 'TEST_ONLY_TA2_ID', internationalSource.id, internationalSource.revision, {entryId: 'TEST_ONLY_TA2_ENTRY', nomenclatureId: 'TEST_ONLY_TA2_ID'}),
      claim('TEST_ONLY_LATIN_CLAIM', 'canonical-latin', 'TEST_ONLY_LATIN_TERM'),
      claim('TEST_ONLY_LATIN_ALIAS_CLAIM', 'latin-alias', 'TEST_ONLY_LATIN_ALIAS'),
      claim('TEST_ONLY_ENGLISH_ALIAS_CLAIM', 'english-alias', 'TEST_ONLY_ENGLISH_ALIAS'),
      claim('TEST_ONLY_VI_CLAIM', 'vietnamese-preferred', preferred, vietnameseSource.id, vietnameseSource.revision, {page: 1, entryId: 'TEST_ONLY_VI_ENTRY'}),
      claim('TEST_ONLY_VI_ALIAS_CLAIM', 'vietnamese-alias', 'TEST_ONLY_VI_ALIAS', vietnameseSource.id, vietnameseSource.revision, {page: 1, entryId: 'TEST_ONLY_VI_ALIAS_ENTRY'}),
      claim('TEST_ONLY_VI_SEARCH_CLAIM', 'vietnamese-search-alias', 'TEST_ONLY_VI_SEARCH', vietnameseSource.id, vietnameseSource.revision, {page: 1, entryId: 'TEST_ONLY_VI_SEARCH_ENTRY'}),
      claim('TEST_ONLY_VI_ASCII_CLAIM', 'vietnamese-search-alias', 'test_only_vi_search', vietnameseSource.id, vietnameseSource.revision, {page: 1, entryId: 'TEST_ONLY_VI_ASCII_ENTRY'}),
    ],
    review: {status: 'VERIFIED', sourceVerification: {type: 'source-verification', status: 'PASSED', reviewerId: 'TEST_ONLY_SOURCE_REVIEWER', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_MESH_CLAIM', 'TEST_ONLY_FMA_CLAIM', 'TEST_ONLY_TA2_CLAIM', 'TEST_ONLY_LATIN_CLAIM', 'TEST_ONLY_LATIN_ALIAS_CLAIM', 'TEST_ONLY_ENGLISH_ALIAS_CLAIM', 'TEST_ONLY_VI_CLAIM']}, medicalReview: {type: 'medical-review', status: 'PASSED', reviewerId: 'TEST_ONLY_MEDICAL_REVIEWER', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_MESH_CLAIM', 'TEST_ONLY_FMA_CLAIM', 'TEST_ONLY_TA2_CLAIM', 'TEST_ONLY_VI_CLAIM']}, releaseEligibility: {type: 'release-eligibility', status: 'PASSED', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_VI_CLAIM'], automated: true}},
  };
  const revision = computeTerminologyRevision(entry);
  entry.review.sourceVerification.entryRevision = revision;
  entry.review.medicalReview.entryRevision = revision;
  entry.review.releaseEligibility.entryRevision = revision;
  return entry;
}

function hasFinding(result, code) { return result.errors.some(item => item.code === code) || result.warnings.some(item => item.code === code); }

const valid = validateTerminologyData(documents([verifiedEntry()]));
assert.deepEqual(valid.errors, [], 'valid TEST_ONLY release fixture should validate');
assert.equal(valid.coverage.releaseEligibleEntries, 1);
assert.equal(hasVerifiedVietnamese(valid.entries[0], valid.sourceCatalog, valid.reviewerCatalog), true);
assert.equal(hasVerifiedLatin(valid.entries[0], valid.sourceCatalog, valid.reviewerCatalog), true);
assert.equal(matchesTerminologyQuery({...conceptA}, 'TEST_ONLY_FMA_ID', {[conceptA.id]: valid.entries[0]}, valid.sourceCatalog, valid.reviewerCatalog), true);

const fmaLikeWithoutMapping = baseEntry(conceptA);
assert.deepEqual(validateTerminologyData(documents([fmaLikeWithoutMapping])).errors, [], 'FMA-like atlas IDs do not assert FMA identity');

const noEquivalent = baseEntry(conceptA);
noEquivalent.mapping = {status: 'UNMAPPED', disposition: 'CONFIRMED_NO_EQUIVALENT', mappings: []};
noEquivalent.claims = [claim('TEST_ONLY_ATLAS_IDENTITY', 'atlas-identity', conceptA.id)];
assert.deepEqual(validateTerminologyData(documents([noEquivalent])).errors, [], 'confirmed no equivalent is representable');

const broader = verifiedEntry();
broader.mapping.mappings[0].relation = 'target-broader';
assert.equal(hasVerifiedVietnamese(broader, validateTerminologyData(documents([broader])).sourceCatalog, reviewers.reduce((map, item) => ({...map, [item.id]: item}), {})), false, 'broader mapping cannot silently release as exact');
const narrower = verifiedEntry();
narrower.mapping.mappings[0].relation = 'target-narrower';
assert.equal(hasVerifiedVietnamese(narrower, validateTerminologyData(documents([narrower])).sourceCatalog, reviewers.reduce((map, item) => ({...map, [item.id]: item}), {})), false, 'narrower mapping cannot silently release as exact');

const wrongMembership = baseEntry(conceptA);
wrongMembership.atlas = {meshIds: [meshB], scope: 'packaged-mesh'};
assert.equal(hasFinding(validateTerminologyData(documents([wrongMembership])), 'mesh-membership-mismatch'), true);

const noEvidence = baseEntry(conceptA);
noEvidence.claims = [{...claim('TEST_ONLY_BAD_CLAIM', 'vietnamese-preferred', 'TEST_ONLY_VI_TERM', vietnameseSource.id, vietnameseSource.revision, {url: 'https://example.invalid/generic'}), evidenceDisposition: 'SUPPORTED', reviewState: 'VERIFIED'}];
assert.equal(hasFinding(validateTerminologyData(documents([noEvidence])), 'unreproducible-claim'), true);

const aliasWithoutApproval = baseEntry(conceptA);
aliasWithoutApproval.english.aliases = ['TEST_ONLY_UNAPPROVED_ALIAS'];
const aliasResult = validateTerminologyData(documents([aliasWithoutApproval]));
assert.equal(matchesTerminologyQuery(conceptA, 'TEST_ONLY_UNAPPROVED_ALIAS', {[conceptA.id]: aliasWithoutApproval}, aliasResult.sourceCatalog, aliasResult.reviewerCatalog), false);

const externalWithoutApproval = baseEntry(conceptA);
externalWithoutApproval.mapping = {status: 'UNMAPPED', disposition: 'UNRESOLVED', mappings: [{id: 'TEST_ONLY_PENDING_MAP', namespace: 'FMA', identifier: 'TEST_ONLY_PENDING_FMA', sourceRevision: internationalSource.revision, relation: 'exact', disposition: 'CANDIDATE', evidenceClaimIds: []}]};
const externalResult = validateTerminologyData(documents([externalWithoutApproval]));
assert.equal(matchesTerminologyQuery(conceptA, 'TEST_ONLY_PENDING_FMA', {[conceptA.id]: externalWithoutApproval}, externalResult.sourceCatalog, externalResult.reviewerCatalog), false);

const machineCandidate = baseEntry(conceptA);
machineCandidate.vietnamese = {preferred: 'TEST_ONLY_MACHINE_TERM'};
machineCandidate.candidateOrigins = [{id: 'TEST_ONLY_MACHINE_ORIGIN', method: 'machine', sourceId: machineSource.id, createdAt: '2026-01-01'}];
machineCandidate.claims = [{...claim('TEST_ONLY_MACHINE_CLAIM', 'vietnamese-preferred', 'TEST_ONLY_MACHINE_TERM', machineSource.id, machineSource.revision, {page: 1}), evidenceDisposition: 'CANDIDATE', reviewState: 'PENDING', candidateOriginId: 'TEST_ONLY_MACHINE_ORIGIN'}];
const machineResult = validateTerminologyData(documents([machineCandidate]));
assert.equal(machineResult.coverage.releaseEligibleEntries, 0);
assert.equal(hasVerifiedVietnamese(machineCandidate, machineResult.sourceCatalog, machineResult.reviewerCatalog), false);

const unregisteredReviewer = verifiedEntry();
unregisteredReviewer.review.medicalReview.reviewerId = 'TEST_ONLY_MISSING_REVIEWER';
const unregisteredResult = validateTerminologyData(documents([unregisteredReviewer]));
assert.equal(hasFinding(unregisteredResult, 'unregistered-reviewer'), true);
assert.equal(hasVerifiedVietnamese(unregisteredReviewer, unregisteredResult.sourceCatalog, unregisteredResult.reviewerCatalog), false);

const unauthorizedReviewer = verifiedEntry();
unauthorizedReviewer.review.medicalReview.reviewerId = 'TEST_ONLY_UNAUTHORIZED';
const unauthorizedResult = validateTerminologyData(documents([unauthorizedReviewer]));
assert.equal(hasVerifiedVietnamese(unauthorizedReviewer, unauthorizedResult.sourceCatalog, unauthorizedResult.reviewerCatalog), false);

const stale = verifiedEntry();
stale.vietnamese.preferred = 'TEST_ONLY_CHANGED_PREFERRED';
const staleResult = validateTerminologyData(documents([stale]));
assert.equal(hasFinding(staleResult, 'stale-approval'), true);
assert.equal(hasVerifiedVietnamese(stale, staleResult.sourceCatalog, staleResult.reviewerCatalog), false);

const aliasChange = verifiedEntry();
aliasChange.vietnamese.aliases = ['TEST_ONLY_CHANGED_ALIAS'];
const aliasChangeResult = validateTerminologyData(documents([aliasChange]));
assert.equal(hasFinding(aliasChangeResult, 'stale-approval'), true);

const sourceRevisionChange = verifiedEntry();
const changedSources = sources.map(item => item.id === internationalSource.id ? {...item, revision: 'TEST_ONLY_SOURCE_REV_2'} : item);
const sourceRevisionResult = validateTerminologyData(documents([sourceRevisionChange], changedSources));
assert.equal(hasFinding(sourceRevisionResult, 'claim-source-revision-mismatch'), true);
assert.equal(sourceRevisionResult.coverage.releaseEligibleEntries, 0);

const conflict = verifiedEntry();
conflict.conflicts = [{id: 'TEST_ONLY_OPEN_CONFLICT', type: 'competing-preferred-terminology', claimIds: ['TEST_ONLY_VI_CLAIM'], status: 'OPEN'}];
let conflictResult = validateTerminologyData(documents([conflict]));
assert.equal(conflictResult.coverage.releaseEligibleEntries, 0);
assert.equal(hasFinding(conflictResult, 'conflict-awaiting-adjudication'), true);
conflict.conflicts[0] = {id: 'TEST_ONLY_ADJUDICATED_CONFLICT', type: 'competing-preferred-terminology', claimIds: ['TEST_ONLY_VI_CLAIM'], status: 'ADJUDICATED', decision: 'TEST_ONLY_ACCEPT', rationale: 'TEST_ONLY rationale', reviewerId: 'TEST_ONLY_MEDICAL_REVIEWER', resolvedAt: '2026-01-01'};
conflict.review.sourceVerification.entryRevision = computeTerminologyRevision(conflict);
conflict.review.medicalReview.entryRevision = computeTerminologyRevision(conflict);
conflict.conflicts[0].entryRevision = computeTerminologyRevision(conflict);
conflictResult = validateTerminologyData(documents([conflict]));
assert.equal(conflictResult.coverage.releaseEligibleEntries, 1, 'adjudicated conflict may release after current medical review');

const collisionA = verifiedEntry(conceptA, 'TEST_ONLY_COLLISION_TERM');
const collisionB = verifiedEntry(conceptB, 'TEST_ONLY_COLLISION_TERM');
const draftCollision = baseEntry(atlas.concepts[2]);
draftCollision.vietnamese = {preferred: 'TEST_ONLY_COLLISION_TERM'};
const collisionResult = validateTerminologyData(documents([collisionA, collisionB, draftCollision]));
assert.equal(hasFinding(collisionResult, 'release-normalized-alias-collision'), true, 'two released entries must block despite a third draft occurrence');

const ambiguityA = verifiedEntry(conceptA, 'TEST_ONLY_HOMONYM');
for (const mapping of ambiguityA.mapping.mappings) { mapping.identifier = `${mapping.identifier}_A`; const evidence = ambiguityA.claims.find(item => item.id === mapping.evidenceClaimIds[0]); if (evidence) evidence.target = mapping.identifier; }
ambiguityA.english.aliases = [];
ambiguityA.latin = undefined;
ambiguityA.vietnamese.aliases = [];
ambiguityA.vietnamese.searchAliases = [];
ambiguityA.vietnamese.asciiSearchForms = [];
ambiguityA.claims = ambiguityA.claims.filter(item => !['english-alias', 'canonical-latin', 'latin-alias', 'vietnamese-alias', 'vietnamese-search-alias'].includes(item.type));
ambiguityA.conflicts = [{id: 'TEST_ONLY_AMBIGUITY_A', type: 'contextual-difference', claimIds: ['TEST_ONLY_VI_CLAIM'], status: 'ADJUDICATED', decision: 'TEST_ONLY_ALLOW_CONTEXT', rationale: 'TEST_ONLY reviewed homonym', acceptedPreferredClaimId: 'TEST_ONLY_VI_CLAIM', permittedAliasClaimIds: ['TEST_ONLY_VI_CLAIM'], ambiguityAllowed: true, reviewerId: 'TEST_ONLY_MEDICAL_REVIEWER', resolvedAt: '2026-01-01'}];
ambiguityA.review.sourceVerification.entryRevision = computeTerminologyRevision(ambiguityA);
ambiguityA.review.medicalReview.entryRevision = computeTerminologyRevision(ambiguityA);
ambiguityA.conflicts[0].entryRevision = computeTerminologyRevision(ambiguityA);
const ambiguityB = verifiedEntry(conceptB, 'TEST_ONLY_HOMONYM');
for (const mapping of ambiguityB.mapping.mappings) { mapping.identifier = `${mapping.identifier}_B`; const evidence = ambiguityB.claims.find(item => item.id === mapping.evidenceClaimIds[0]); if (evidence) evidence.target = mapping.identifier; }
ambiguityB.english.aliases = [];
ambiguityB.latin = undefined;
ambiguityB.vietnamese.aliases = [];
ambiguityB.vietnamese.searchAliases = [];
ambiguityB.vietnamese.asciiSearchForms = [];
ambiguityB.claims = ambiguityB.claims.filter(item => !['english-alias', 'canonical-latin', 'latin-alias', 'vietnamese-alias', 'vietnamese-search-alias'].includes(item.type));
ambiguityB.conflicts = [{...ambiguityA.conflicts[0], id: 'TEST_ONLY_AMBIGUITY_B'}];
ambiguityB.review.sourceVerification.entryRevision = computeTerminologyRevision(ambiguityB);
ambiguityB.review.medicalReview.entryRevision = computeTerminologyRevision(ambiguityB);
ambiguityB.conflicts[0].entryRevision = computeTerminologyRevision(ambiguityB);
const ambiguityResult = validateTerminologyData(documents([ambiguityA, ambiguityB]));
assert.equal(ambiguityResult.errors.some(item => item.code === 'release-normalized-alias-collision'), false, 'reviewed ambiguity is explicit');

const storedVerified = baseEntry(conceptA);
storedVerified.review = {status: 'VERIFIED'};
const storedResult = validateTerminologyData(documents([storedVerified]));
assert.equal(hasFinding(storedResult, 'missing-review-audit'), true);
assert.equal(hasVerifiedVietnamese(storedVerified, storedResult.sourceCatalog, storedResult.reviewerCatalog), false);

const coverage = computeCoverage(atlas, [], {}, {});
assert.equal(coverage.totalAtlasConcepts, atlas.concepts.length);
assert.equal(coverage.unresolvedOrUnmappedConcepts, atlas.concepts.length);
assert.equal(coverage.releaseEligibleEntries, 0);

console.log('M02B synthetic governance tests passed: opaque IDs, plural mappings, claim evidence, mesh membership, reviewer authorization, stale approvals, conflicts, search gates, collisions, and coverage.');
