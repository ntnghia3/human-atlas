import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getMessage, MESSAGE_KEYS, persistLanguage, readStoredLanguage, translate} from '../app/localization.ts';
import {normalizeSearchText} from '../app/search-normalization.ts';
import {
  computeTerminologyRevision,
  TERMINOLOGY_OVERLAY,
  TERMINOLOGY_SOURCES,
  hasVerifiedLatin,
  hasVerifiedVietnamese,
  matchesTerminologyQuery,
  resolveSystemName,
  resolveConceptName,
  resolveConceptLocalization,
  LOCALIZATION_CATALOG,
  getEvidencePresentation,
  getSourceDisplay,
} from '../app/terminology.ts';
import {SYSTEMS} from '../app/anatomy.ts';

const values = new Map();
const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
assert.equal(readStoredLanguage(storage), 'en');
persistLanguage('vi', storage);
assert.equal(readStoredLanguage(storage), 'vi');
values.set('human-atlas.language', 'fr');
assert.equal(readStoredLanguage(storage), 'en');
const unavailableStorage = {getItem(){throw new Error('TEST_ONLY storage failure');}, setItem(){throw new Error('TEST_ONLY storage failure');}};
assert.equal(readStoredLanguage(unavailableStorage), 'en');
persistLanguage('vi', unavailableStorage);
for (const key of MESSAGE_KEYS) assert.notEqual(translate('vi', key), key);
assert.deepEqual(SYSTEMS.map(system => system.id), ['skeletal','muscular','cardiac','sensory','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','integumentary','connective']);
const sceneSource = await readFile(new URL('../app/scene.tsx', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const comboboxSource = await readFile(new URL('../components/ui/combobox.tsx', import.meta.url), 'utf8');
const sheetSource = await readFile(new URL('../components/ui/sheet.tsx', import.meta.url), 'utf8');
assert.match(sceneSource, /\},\[atlas\]\);/);
assert.equal(sceneSource.includes('language'), false);
assert.match(pageSource, /dismissLabel=\{t\('search\.dismiss'\)\}/);
assert.equal((pageSource.match(/closeLabel=\{t\('controls\.closePanel'\)\}/g) ?? []).length, 2);
assert.match(comboboxSource, /dismissLabel/);
assert.match(sheetSource, /closeLabel/);
assert.equal(getMessage('en', 'controls.search'), 'Find a structure');
assert.equal(getMessage('vi', 'controls.search'), 'Tìm cấu trúc');
assert.equal(translate('en', 'loading.progress', {progress: 50, count: 12}), '50% · Loading 12 pieces');
assert.equal(Object.keys(TERMINOLOGY_OVERLAY).length, 0);
assert.equal(Object.keys(LOCALIZATION_CATALOG).length, 3432);
const localizedConcept = {id: 'FMA3710', name: 'vascular tree', elements: []};
assert.equal(resolveConceptLocalization(localizedConcept)?.evidenceStatus, 'PROVISIONAL_TRANSLATED');
assert.notEqual(resolveConceptName(localizedConcept, 'vi'), localizedConcept.name);
assert.equal(matchesTerminologyQuery(localizedConcept, resolveConceptName(localizedConcept, 'vi')), true);
assert.equal(resolveConceptName(localizedConcept, 'en'), localizedConcept.name);
assert.ok(Object.values(TERMINOLOGY_SOURCES).every(source => source.identityVerified === true));
const intentionallyBilingualUiKeys = new Set(['language.english', 'language.vietnamese', 'brand.name', 'identity.source']);
for (const key of MESSAGE_KEYS) {
  assert.notEqual(translate('vi', key), key);
  if (!intentionallyBilingualUiKeys.has(key)) assert.notEqual(translate('vi', key), translate('en', key), `${key} must be localized in Vietnamese mode`);
}
assert.equal(getMessage('vi', 'controls.skeleton'), 'Hệ xương');
assert.equal(getMessage('vi', 'controls.organs'), 'Cơ quan');
assert.equal(normalizeSearchText('  Đặng   CỘNG  '), 'dang cong');
assert.equal(normalizeSearchText('BẠN\n bè'), 'ban be');
assert.equal(normalizeSearchText('CỘNG'), 'cong');

const concept = {id: 'FMA00000', name: 'Internal carotid artery', elements: ['FJ0000']};
assert.equal(resolveConceptName(concept, 'vi', TERMINOLOGY_OVERLAY), concept.name);
assert.equal(matchesTerminologyQuery(concept, 'internal carotid', TERMINOLOGY_OVERLAY), true);

const sourceBase = {
  TEST_ONLY_NOMENCLATURE: {id: 'TEST_ONLY_NOMENCLATURE', class: 'international-nomenclature', title: 'TEST_ONLY nomenclature fixture', revision: 'TEST_ONLY_REV_1', identityVerified: true, authorityTier: 'authoritative', authorityScope: ['TEST_ONLY identity'], accessStatus: 'FULL_ACCESS', locatorCapability: 'STABLE_ENTRY', fullTextAvailableForReview: true, contentInspected: true, verificationEvidence: ['TEST_ONLY'], limitations: ['TEST_ONLY'], capabilities: {anatomicalIdentity: true, canonicalLatin: true, vietnamesePreferred: false, secondaryCorroboration: false, machineCandidateDiscovery: false}, audit: {status: 'VERIFIED', verifiedAt: '2026-01-01', verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER'}},
  TEST_ONLY_VI: {id: 'TEST_ONLY_VI', class: 'vietnamese-authoritative', title: 'TEST_ONLY Vietnamese fixture', revision: 'TEST_ONLY_REV_1', identityVerified: true, authorityTier: 'authoritative', authorityScope: ['TEST_ONLY Vietnamese'], accessStatus: 'FULL_ACCESS', locatorCapability: 'PAGE', fullTextAvailableForReview: true, contentInspected: true, verificationEvidence: ['TEST_ONLY'], limitations: ['TEST_ONLY'], capabilities: {anatomicalIdentity: false, canonicalLatin: false, vietnamesePreferred: true, secondaryCorroboration: false, machineCandidateDiscovery: false}, audit: {status: 'VERIFIED', verifiedAt: '2026-01-01', verifiedBy: 'TEST_ONLY_SOURCE_REVIEWER'}},
};
const reviewers = {TEST_ONLY_MEDICAL_REVIEWER: {id: 'TEST_ONLY_MEDICAL_REVIEWER', displayName: 'TEST_ONLY medical reviewer', role: 'medical reviewer', qualifications: ['TEST_ONLY'], authorizationScope: ['*'], status: 'ACTIVE'}, TEST_ONLY_SOURCE_REVIEWER: {id: 'TEST_ONLY_SOURCE_REVIEWER', displayName: 'TEST_ONLY source reviewer', role: 'source verifier', qualifications: ['TEST_ONLY'], authorizationScope: ['*'], status: 'ACTIVE'}};
const claim = (id, type, target, sourceId, locator) => ({id, type, target, sourceId, sourceRevision: 'TEST_ONLY_REV_1', locator, evidenceDisposition: 'SUPPORTED', reviewState: 'VERIFIED'});
const verifiedEntry = {
  conceptId: concept.id,
  english: {preferred: concept.name, aliases: ['TEST_ONLY_ENGLISH_ALIAS']},
  latin: {preferred: 'TEST_ONLY_LATIN_TERM', aliases: ['TEST_ONLY_LATIN_ALIAS']},
  vietnamese: {preferred: 'TEST_ONLY_VI_TÉRM', aliases: ['TEST_ONLY_VI_ALIAS'], searchAliases: ['TEST_ONLY_VI_SEARCH'], asciiSearchForms: ['test_only_vi_search']},
  mapping: {status: 'MAPPED', mappings: [{id: 'TEST_ONLY_FMA_MAP', namespace: 'FMA', identifier: 'TEST_ONLY_FMA_ID', sourceRevision: 'TEST_ONLY_REV_1', relation: 'exact', disposition: 'VERIFIED', evidenceClaimIds: ['TEST_ONLY_FMA_CLAIM']}]},
  claims: [claim('TEST_ONLY_FMA_CLAIM', 'atlas-fma-mapping', 'TEST_ONLY_FMA_ID', 'TEST_ONLY_NOMENCLATURE', {entryId: 'TEST_ONLY_FMA_ENTRY', nomenclatureId: 'TEST_ONLY_FMA_ID'}), claim('TEST_ONLY_LATIN_CLAIM', 'canonical-latin', 'TEST_ONLY_LATIN_TERM', 'TEST_ONLY_NOMENCLATURE', {entryId: 'TEST_ONLY_LATIN_ENTRY'}), claim('TEST_ONLY_ENGLISH_ALIAS_CLAIM', 'english-alias', 'TEST_ONLY_ENGLISH_ALIAS', 'TEST_ONLY_NOMENCLATURE', {entryId: 'TEST_ONLY_ENGLISH_ALIAS_ENTRY'}), claim('TEST_ONLY_VI_CLAIM', 'vietnamese-preferred', 'TEST_ONLY_VI_TÉRM', 'TEST_ONLY_VI', {page: 1, entryId: 'TEST_ONLY_VI_ENTRY'}), claim('TEST_ONLY_VI_ALIAS_CLAIM', 'vietnamese-alias', 'TEST_ONLY_VI_ALIAS', 'TEST_ONLY_VI', {page: 1, entryId: 'TEST_ONLY_VI_ALIAS_ENTRY'}), claim('TEST_ONLY_VI_SEARCH_CLAIM', 'vietnamese-search-alias', 'TEST_ONLY_VI_SEARCH', 'TEST_ONLY_VI', {page: 1, entryId: 'TEST_ONLY_VI_SEARCH_ENTRY'}), claim('TEST_ONLY_VI_ASCII_CLAIM', 'vietnamese-search-alias', 'test_only_vi_search', 'TEST_ONLY_VI', {page: 1, entryId: 'TEST_ONLY_VI_ASCII_ENTRY'})],
  review: {status: 'VERIFIED', sourceVerification: {type: 'source-verification', status: 'PASSED', reviewerId: 'TEST_ONLY_SOURCE_REVIEWER', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_FMA_CLAIM', 'TEST_ONLY_LATIN_CLAIM', 'TEST_ONLY_ENGLISH_ALIAS_CLAIM', 'TEST_ONLY_VI_CLAIM']}, medicalReview: {type: 'medical-review', status: 'PASSED', reviewerId: 'TEST_ONLY_MEDICAL_REVIEWER', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_FMA_CLAIM', 'TEST_ONLY_VI_CLAIM']}, releaseEligibility: {type: 'release-eligibility', status: 'PASSED', reviewedAt: '2026-01-01', decision: 'APPROVE', claimIds: ['TEST_ONLY_VI_CLAIM'], automated: true}},
};
const verifiedRevision = computeTerminologyRevision(verifiedEntry);
verifiedEntry.review.sourceVerification.entryRevision = verifiedRevision;
verifiedEntry.review.medicalReview.entryRevision = verifiedRevision;
verifiedEntry.review.releaseEligibility.entryRevision = verifiedRevision;
assert.equal(hasVerifiedVietnamese(verifiedEntry, TERMINOLOGY_SOURCES), false);
assert.equal(hasVerifiedVietnamese(verifiedEntry, sourceBase, reviewers), true);
assert.equal(hasVerifiedLatin(verifiedEntry, sourceBase, reviewers), true);
assert.equal(resolveSystemName({id: 'TEST_ONLY_SYSTEM', name: 'TEST_ONLY system'}, 'vi'), 'TEST_ONLY system');
assert.equal(resolveConceptName(concept, 'vi', {[concept.id]: verifiedEntry}, sourceBase, reviewers), 'TEST_ONLY_VI_TÉRM');
assert.equal(resolveConceptName(concept, 'en', {[concept.id]: verifiedEntry}), concept.name);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_ENGLISH_ALIAS', {[concept.id]: verifiedEntry}, sourceBase, reviewers), true);
assert.equal(matchesTerminologyQuery(concept, 'FMA00000', {[concept.id]: verifiedEntry}, sourceBase, reviewers), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_FMA_ID', {[concept.id]: verifiedEntry}, sourceBase, reviewers), true);
assert.equal(matchesTerminologyQuery(concept, 'test_only_vi_search', {[concept.id]: verifiedEntry}, sourceBase, reviewers), true);
assert.equal(matchesTerminologyQuery(concept, 'TEST_ONLY_LATIN_ALIAS', {[concept.id]: verifiedEntry}, sourceBase, reviewers), false, 'unclaimed Latin alias must not enter search');

const localizationCounts = Object.values(LOCALIZATION_CATALOG).reduce((counts, record) => {
  counts[record.evidenceStatus] = (counts[record.evidenceStatus] ?? 0) + 1;
  return counts;
}, {});
assert.deepEqual(localizationCounts, {VERIFIED: 841, PROVISIONAL_SOURCED: 86, PROVISIONAL_TRANSLATED: 2505});
assert.ok(Object.values(LOCALIZATION_CATALOG).every(record => record.vietnamese.trim().length > 0));

const presentationFor = predicate => getEvidencePresentation(Object.values(LOCALIZATION_CATALOG).find(predicate), 'vi', TERMINOLOGY_SOURCES);
const directPresentation = presentationFor(record => record.translationMethod === 'DIRECT_SOURCE' && record.evidenceStatus === 'VERIFIED');
const multiAuthorityPresentation = presentationFor(record => record.translationMethod === 'MULTI_AUTHORITY');
const derivedPresentation = presentationFor(record => record.translationMethod === 'CONTROLLED_DERIVED');
const sourcedPresentation = presentationFor(record => record.evidenceStatus === 'PROVISIONAL_SOURCED' && record.sourceDisposition !== 'SOURCE_CONFLICT' && record.sourceDisposition !== 'SOURCE_VARIANT');
const generatedPresentation = presentationFor(record => record.translationMethod === 'GENERATED_TRANSLATION');
const conflictPresentation = presentationFor(record => record.sourceDisposition === 'SOURCE_CONFLICT');
const variantPresentation = presentationFor(record => record.sourceDisposition === 'SOURCE_VARIANT');
const finalQaReviewPresentation = getEvidencePresentation(LOCALIZATION_CATALOG.FMA5022, 'vi', TERMINOLOGY_SOURCES);

assert.ok(directPresentation.sourceSummary?.includes('Đại học Y Hà Nội (2022)'));
assert.equal(directPresentation.label, 'Đã xác minh nguồn');
assert.equal(multiAuthorityPresentation.sourceCount, 2);
assert.ok(multiAuthorityPresentation.description.includes('2 nguồn độc lập'));
assert.ok(derivedPresentation.description.includes('quy tắc'));
assert.equal(derivedPresentation.description.includes('CONTROLLED_DERIVED'), false);
assert.equal(sourcedPresentation.label, 'Có nguồn tham khảo');
assert.equal(sourcedPresentation.qualifier, 'Chưa xác minh đầy đủ');
assert.equal(generatedPresentation.label, 'Bản dịch tạm');
assert.equal(generatedPresentation.qualifier, 'Chưa xác định nguồn');
assert.equal(generatedPresentation.sourceCount, 0);
assert.equal(generatedPresentation.sourceSummary, undefined);
assert.equal(conflictPresentation.label, 'Có biến thể nguồn');
assert.ok(conflictPresentation.variants.length > 0);
assert.equal(variantPresentation.label, 'Có biến thể nguồn');
assert.equal(finalQaReviewPresentation.label, 'Bản dịch tạm');

const defaultPresentationText = [
  directPresentation.label,
  directPresentation.qualifier,
  directPresentation.description,
  directPresentation.sourceSummary,
].filter(Boolean).join(' ');
for (const rawValue of ['VERIFIED', 'PROVISIONAL_SOURCED', 'PROVISIONAL_TRANSLATED', 'CONTROLLED_DERIVED', 'SOURCE_CANDIDATE', 'NVH2008', 'M04B2H']) {
  assert.equal(defaultPresentationText.includes(rawValue), false, `${rawValue} must stay out of compact evidence presentation`);
}
const unknownSourceDisplay = getSourceDisplay('TEST_ONLY_UNKNOWN_SOURCE', [{sourceId: 'TEST_ONLY_UNKNOWN_SOURCE'}], 'vi', {});
assert.equal(unknownSourceDisplay.shortDisplayName.includes('TEST_ONLY_UNKNOWN_SOURCE'), false);
assert.equal(unknownSourceDisplay.fullDisplayName.includes('TEST_ONLY_UNKNOWN_SOURCE'), false);

assert.equal(matchesTerminologyQuery({id: 'FMA3711', name: 'segment of artery', elements: []}, 'đoạn động mạch'), true);
assert.equal(matchesTerminologyQuery({id: 'FMA3711', name: 'segment of artery', elements: []}, 'segment of artery'), true);

assert.match(pageSource, /getEvidencePresentation/);
assert.match(pageSource, /evidence\.technicalDetails/);
assert.doesNotMatch(pageSource, /chosenLocalization\.translationMethod/);
assert.doesNotMatch(pageSource, /chosenLocalization\.blockers/);
assert.doesNotMatch(pageSource, /chosenLocalization\.provenance\.map/);
const registeredKeys = new Set(MESSAGE_KEYS);
for (const match of pageSource.matchAll(/\bt\(['"]([^'"]+)['"]/g)) {
  assert.equal(registeredKeys.has(match[1]), true, `rendered UI key must be registered: ${match[1]}`);
}

console.log('Language persistence, UI fallback, Vietnamese search normalization, claim-level terminology gates, and revision-bound release checks passed.');
