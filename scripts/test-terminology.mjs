import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {computeCoverage, REPOSITORY_ROOT, validateTerminologyData} from './validate-terminology.mjs';

const atlas = JSON.parse(await readFile(join(REPOSITORY_ROOT, 'public', 'models', 'atlas.json'), 'utf8'));
const conceptA = atlas.concepts[0];
const conceptB = atlas.concepts[1];

function source({id, className, capabilities}) {
  return {
    id,
    class: className,
    title: `${id} TEST_ONLY fixture`,
    capabilities,
    audit: {
      status: 'VERIFIED',
      verifiedAt: '2026-01-01',
      verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER',
    },
  };
}

const internationalSource = source({
  id: 'TEST_ONLY_NOMENCLATURE',
  className: 'international-nomenclature',
  capabilities: {
    anatomicalIdentity: true,
    canonicalLatin: true,
    vietnamesePreferred: false,
    secondaryCorroboration: false,
    machineCandidateDiscovery: false,
  },
});
const vietnameseSource = source({
  id: 'TEST_ONLY_VI',
  className: 'vietnamese-authoritative',
  capabilities: {
    anatomicalIdentity: false,
    canonicalLatin: false,
    vietnamesePreferred: true,
    secondaryCorroboration: false,
    machineCandidateDiscovery: false,
  },
});
const secondarySource = source({
  id: 'TEST_ONLY_SECONDARY',
  className: 'secondary-reference',
  capabilities: {
    anatomicalIdentity: false,
    canonicalLatin: false,
    vietnamesePreferred: false,
    secondaryCorroboration: true,
    machineCandidateDiscovery: false,
  },
});
const machineSource = source({
  id: 'TEST_ONLY_MACHINE',
  className: 'machine-generated',
  capabilities: {
    anatomicalIdentity: false,
    canonicalLatin: false,
    vietnamesePreferred: false,
    secondaryCorroboration: false,
    machineCandidateDiscovery: true,
  },
});
const invalidMachineSource = source({
  id: 'TEST_ONLY_INVALID_MACHINE',
  className: 'machine-generated',
  capabilities: {
    anatomicalIdentity: false,
    canonicalLatin: false,
    vietnamesePreferred: true,
    secondaryCorroboration: false,
    machineCandidateDiscovery: true,
  },
});

function documents(entries, sources = [internationalSource, vietnameseSource, secondarySource, machineSource]) {
  return {
    atlas,
    sourcesDocument: {schemaVersion: 1, sources},
    entriesDocument: {schemaVersion: 1, entries},
  };
}

function baseEntry(concept) {
  return {
    key: concept.id,
    conceptId: concept.id,
    sourceIds: {},
    english: {preferred: concept.name, aliases: []},
    provenance: [],
    mapping: {status: 'UNMAPPED'},
    review: {status: 'UNMAPPED'},
  };
}

function verifiedEntry(concept = conceptA) {
  return {
    ...baseEntry(concept),
    sourceIds: {fma: 'TEST_ONLY_FMA_ID'},
    english: {preferred: concept.name, aliases: ['TEST_ONLY_ENGLISH_ALIAS']},
    latin: {preferred: 'TEST_ONLY_LATIN_TERM', aliases: []},
    vietnamese: {
      preferred: 'TEST_ONLY_VI_TÉRM',
      aliases: [],
      searchAliases: [],
      asciiSearchForms: ['test_only_vi_term'],
    },
    provenance: [
      {
        sourceId: internationalSource.id,
        locator: {entryId: 'TEST_ONLY_FMA_ENTRY', nomenclatureId: 'TEST_ONLY_FMA_ID'},
      },
      {
        sourceId: vietnameseSource.id,
        locator: {page: 1, entryId: 'TEST_ONLY_VI_ENTRY', url: 'https://example.invalid/test-only/vi'},
      },
    ],
    mapping: {status: 'MAPPED'},
    review: {
      status: 'VERIFIED',
      sourceVerification: {
        type: 'source-verification',
        status: 'PASSED',
        reviewer: 'TEST_ONLY_SOURCE_REVIEWER',
        reviewedAt: '2026-01-01',
      },
      medicalReview: {
        type: 'medical-review',
        status: 'PASSED',
        reviewer: 'TEST_ONLY_MEDICAL_REVIEWER',
        reviewedAt: '2026-01-01',
        automated: false,
      },
      releaseEligibility: {
        type: 'release-eligibility',
        status: 'PASSED',
        reviewedAt: '2026-01-01',
        automated: true,
      },
    },
  };
}

function finding(result, code) {
  return result.errors.some(item => item.code === code) || result.warnings.some(item => item.code === code);
}

const valid = validateTerminologyData(documents([verifiedEntry()]));
assert.deepEqual(valid.errors, [], 'the fully populated TEST_ONLY fixture should validate');
assert.equal(valid.coverage.releaseEligibleEntries, 1);
assert.equal(valid.coverage.sourceVerifiedEntries, 1);
assert.equal(valid.coverage.medicallyReviewedEntries, 1);
assert.equal(valid.coverage.searchableTerminologyEntries, 1);

const internationalOnly = baseEntry(conceptA);
internationalOnly.sourceIds = {fma: 'TEST_ONLY_FMA_ID'};
internationalOnly.mapping = {status: 'MAPPED'};
internationalOnly.provenance = [{
  sourceId: internationalSource.id,
  locator: {nomenclatureId: 'TEST_ONLY_FMA_ID'},
}];
const internationalResult = validateTerminologyData(documents([internationalOnly], [internationalSource]));
assert.deepEqual(internationalResult.errors, [], 'international nomenclature source should validate structurally');

const secondaryOnly = baseEntry(conceptA);
secondaryOnly.provenance = [{sourceId: secondarySource.id, locator: {page: 2}}];
const secondaryResult = validateTerminologyData(documents([secondaryOnly], [secondarySource]));
assert.deepEqual(secondaryResult.errors, [], 'secondary reference source should validate structurally');

const machineCandidate = verifiedEntry();
machineCandidate.sourceIds = {};
delete machineCandidate.latin;
machineCandidate.provenance = [{sourceId: machineSource.id, locator: {page: 1}}];
const machineResult = validateTerminologyData(documents([machineCandidate], [machineSource]));
assert.equal(machineResult.errors.length, 0, 'machine candidates may be stored as unreleased candidates');
assert.equal(machineResult.coverage.releaseEligibleEntries, 0);
assert.equal(finding(machineResult, 'unreleased-search-term'), true);

const invalidCapabilityResult = validateTerminologyData(documents([], [invalidMachineSource]));
assert.equal(finding(invalidCapabilityResult, 'source-capability-conflict'), true);

const unresolvedSource = verifiedEntry();
unresolvedSource.provenance[0] = {
  sourceId: 'TEST_ONLY_MISSING_SOURCE',
  locator: {page: 1},
};
const unresolvedResult = validateTerminologyData(documents([unresolvedSource]));
assert.equal(finding(unresolvedResult, 'unresolved-provenance-source'), true);

const missingMedicalAudit = verifiedEntry();
delete missingMedicalAudit.review.medicalReview;
const missingMedicalResult = validateTerminologyData(documents([missingMedicalAudit]));
assert.equal(finding(missingMedicalResult, 'missing-review-audit'), true);
assert.equal(missingMedicalResult.coverage.releaseEligibleEntries, 0);

const mismatchedEnglish = verifiedEntry();
mismatchedEnglish.english.preferred = 'TEST_ONLY_WRONG_ENGLISH_SNAPSHOT';
const mismatchResult = validateTerminologyData(documents([mismatchedEnglish]));
assert.equal(finding(mismatchResult, 'english-snapshot-mismatch'), true);

const collisionA = baseEntry(conceptA);
collisionA.vietnamese = {preferred: 'TEST_ONLY_COLLISION_TÉRM', aliases: [], searchAliases: [], asciiSearchForms: ['test_only_collision_term']};
collisionA.provenance = [{sourceId: vietnameseSource.id, locator: {page: 1}}];
const collisionB = baseEntry(conceptB);
collisionB.vietnamese = {preferred: 'TEST_ONLY_COLLISION_TÉRM', aliases: [], searchAliases: [], asciiSearchForms: ['test_only_collision_term']};
collisionB.provenance = [{sourceId: vietnameseSource.id, locator: {page: 1}}];
const collisionResult = validateTerminologyData(documents([collisionA, collisionB], [vietnameseSource]));
assert.equal(finding(collisionResult, 'normalized-alias-collision'), true);

const unknownMesh = baseEntry(conceptA);
unknownMesh.sourceIds = {bodyParts3d: {ids: ['TEST_ONLY_UNKNOWN_MESH'], scope: 'packaged-mesh'}};
const unknownMeshResult = validateTerminologyData(documents([unknownMesh]));
assert.equal(finding(unknownMeshResult, 'unknown-packaged-mesh-id'), true);

const coverage = computeCoverage(atlas, [], {});
assert.equal(coverage.totalAtlasConcepts, atlas.concepts.length);
assert.equal(coverage.unresolvedOrUnmappedConcepts, atlas.concepts.length);
assert.equal(coverage.releaseEligibleEntries, 0);

console.log('Terminology registry schema, source capabilities, provenance, review audits, release gates, collisions, and coverage passed.');
