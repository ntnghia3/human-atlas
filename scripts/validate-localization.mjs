import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getMessage, MESSAGE_KEYS, persistLanguage, readStoredLanguage, translate} from '../app/localization.ts';
import {normalizeSearchText} from '../app/search-normalization.ts';
import {SYSTEMS} from '../app/anatomy.ts';
import {
  TERMINOLOGY_OVERLAY,
  TERMINOLOGY_SOURCES,
  hasVerifiedVietnamese,
  hasVerifiedLatin,
  matchesTerminologyQuery,
  resolveSystemName,
  resolveConceptName,
} from '../app/terminology.ts';

// TEST/FIXTURE ONLY: these names exercise the resolver contract and are not
// production terminology data or a translation source for the atlas.

const values = new Map();
const storage = {
  getItem(key) {
    return values.get(key) ?? null;
  },
  setItem(key, value) {
    values.set(key, value);
  },
};

assert.equal(readStoredLanguage(storage), 'en');
persistLanguage('vi', storage);
assert.equal(readStoredLanguage(storage), 'vi');
values.set('human-atlas.language', 'fr');
assert.equal(readStoredLanguage(storage), 'en');
const unavailableStorage = {getItem(){throw new Error('TEST_ONLY storage failure');},setItem(){throw new Error('TEST_ONLY storage failure');}};
assert.equal(readStoredLanguage(unavailableStorage), 'en');
persistLanguage('vi', unavailableStorage);
for (const key of MESSAGE_KEYS) assert.notEqual(translate('vi', key), key);
assert.deepEqual(SYSTEMS.map(system => system.id), ['skeletal','muscular','cardiac','sensory','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','integumentary','connective']);
const sceneSource = await readFile(new URL('../app/scene.tsx', import.meta.url), 'utf8');
assert.match(sceneSource, /\},\[atlas\]\);/);
assert.equal(sceneSource.includes('language'), false);
assert.equal(getMessage('en', 'controls.search'), 'Find a structure');
assert.equal(getMessage('vi', 'controls.search'), 'Tìm cấu trúc');
assert.equal(translate('en', 'loading.progress', {progress: 50, count: 12}), '50% · Loading 12 pieces');
assert.equal(Object.keys(TERMINOLOGY_OVERLAY).length, 0);
assert.equal(Object.keys(TERMINOLOGY_SOURCES).length, 0);

assert.equal(normalizeSearchText('  Đặng   CỘNG  '), 'dang cong');
assert.equal(normalizeSearchText('BẠN\n bè'), 'ban be');
assert.equal(normalizeSearchText('CỘNG'), 'cong');

const concept = {id: 'FMA00000', name: 'Internal carotid artery', elements: ['FJ0000']};
assert.equal(resolveConceptName(concept, 'vi', TERMINOLOGY_OVERLAY), 'Internal carotid artery');
assert.equal(matchesTerminologyQuery(concept, 'internal carotid', TERMINOLOGY_OVERLAY), true);

const draftEntry = {
  conceptId: concept.id,
  sourceIds: {fma: 'TEST_ONLY_FMA_ID'},
  english: {preferred: concept.name, aliases: ['TEST_ONLY_ENGLISH_ALIAS']},
  vietnamese: {preferred: 'TEST_ONLY_VI_TÉRM', aliases: ['TEST_ONLY_VI_ALIAS'], searchAliases: ['TEST_ONLY_VI_SEARCH'], asciiSearchForms: ['test_only_vi_term']},
  provenance: [{sourceId: 'TEST_ONLY_MACHINE'}],
  mapping: {status: 'MAPPED'},
  review: {status: 'DRAFT'},
};
assert.equal(hasVerifiedVietnamese(draftEntry), false);
assert.equal(resolveConceptName(concept, 'vi', {[concept.id]: draftEntry}), concept.name);
assert.equal(matchesTerminologyQuery(concept, 'dong mach canh trong', {[concept.id]: draftEntry}), false);

const verifiedEntry = {
  ...draftEntry,
  provenance: [
    {
      sourceId: 'TEST_ONLY_NOMENCLATURE',
      locator: {entryId: 'TEST_ONLY_FMA_ENTRY', nomenclatureId: 'TEST_ONLY_FMA_ID'},
    },
    {
      sourceId: 'TEST_ONLY_VI',
      locator: {page: 1, entryId: 'TEST_ONLY_VI_ENTRY', url: 'https://example.invalid/test-only/vi'},
    },
  ],
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
  latin: {preferred: 'TEST_ONLY_LATIN_TERM', aliases: ['TEST_ONLY_LATIN_ALIAS']},
  vietnamese: {
    preferred: 'TEST_ONLY_VI_TÉRM',
    aliases: ['TEST_ONLY_VI_ALIAS'],
    searchAliases: ['TEST_ONLY_VI_SEARCH'],
    asciiSearchForms: ['test_only_vi_term'],
  },
};
const verifiedOverlay = {[concept.id]: verifiedEntry};
const verifiedSources = {
  TEST_ONLY_NOMENCLATURE: {
    id: 'TEST_ONLY_NOMENCLATURE',
    class: 'international-nomenclature',
    title: 'TEST_ONLY nomenclature fixture',
    capabilities: {
      anatomicalIdentity: true,
      canonicalLatin: true,
      vietnamesePreferred: false,
      secondaryCorroboration: false,
      machineCandidateDiscovery: false,
    },
    audit: {status: 'VERIFIED', verifiedAt: '2026-01-01', verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER'},
  },
  TEST_ONLY_VI: {
    id: 'TEST_ONLY_VI',
    class: 'vietnamese-authoritative',
    title: 'TEST_ONLY Vietnamese fixture',
    capabilities: {
      anatomicalIdentity: false,
      canonicalLatin: false,
      vietnamesePreferred: true,
      secondaryCorroboration: false,
      machineCandidateDiscovery: false,
    },
    audit: {status: 'VERIFIED', verifiedAt: '2026-01-01', verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER'},
  },
};
assert.equal(hasVerifiedVietnamese(verifiedEntry, TERMINOLOGY_SOURCES), false);
assert.equal(hasVerifiedVietnamese(verifiedEntry, verifiedSources), true);
assert.equal(hasVerifiedLatin(verifiedEntry, verifiedSources), true);
assert.equal(resolveSystemName({id: 'TEST_ONLY_SYSTEM', name: 'TEST_ONLY system'}, 'vi'), 'TEST_ONLY system');
assert.equal(resolveConceptName(concept, 'vi', verifiedOverlay, verifiedSources), 'TEST_ONLY_VI_TÉRM');
assert.equal(resolveConceptName(concept, 'en', verifiedOverlay), concept.name);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_ENGLISH_ALIAS', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'FMA00000', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_FMA_ID', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'test_only_vi_term', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_VI_ALIAS', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_VI_SEARCH', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'test_only_latin_term', verifiedOverlay, verifiedSources), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_LATIN_ALIAS', verifiedOverlay, verifiedSources), true);

console.log('Language persistence, UI fallback, Vietnamese search normalization, and terminology release gates passed.');
