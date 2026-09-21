import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

import {matchesTerminologyQuery, resolveConceptName, resolveConceptLocalization, LOCALIZATION_CATALOG} from '../app/terminology.ts';
import {getMessage} from '../app/localization.ts';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\');
const path = (...parts) => join(ROOT, ...parts);
const readJson = async file => JSON.parse(await readFile(path(...file), 'utf8'));
const readJsonl = async file => (await readFile(path(...file), 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256File = async file => sha256(await readFile(path(...file)));

const atlas = await readJson(['public', 'models', 'atlas.json']);
const records = await readJsonl(['data', 'terminology', 'research', 'm04b2i', 'localization-records.jsonl']);
const generated = await readJsonl(['data', 'terminology', 'research', 'm04b2i', 'provisional-translations.jsonl']);
const quality = await readJsonl(['data', 'terminology', 'research', 'm04b2i', 'quality-review.jsonl']);
const summary = await readJson(['data', 'terminology', 'research', 'm04b2i', 'coverage-summary.json']);
const manifest = await readJson(['data', 'terminology', 'research', 'm04b2i', 'run-manifest.json']);
const b2hManifest = await readJson(['data', 'terminology', 'research', 'm04b2h', 'run-manifest.json']);

assert.equal(atlas.concepts.length, 3432);
assert.equal(records.length, atlas.concepts.length);
assert.equal(new Set(records.map(record => record.conceptId)).size, records.length, 'each concept appears once');
assert.deepEqual(records.map(record => record.conceptId), atlas.concepts.map(concept => concept.id), 'catalog follows atlas order');
assert.ok(records.every(record => record.english && record.vietnamese.trim()), 'English and Vietnamese labels are never blank');
assert.ok(records.every(record => ['VERIFIED', 'PROVISIONAL_SOURCED', 'PROVISIONAL_TRANSLATED', 'NO_TRANSLATION_AVAILABLE'].includes(record.evidenceStatus)));
assert.ok(records.every(record => ['DIRECT_SOURCE', 'MULTI_AUTHORITY', 'CONTROLLED_DERIVED', 'SOURCE_CANDIDATE', 'GENERATED_TRANSLATION'].includes(record.translationMethod)));
const counts = Object.fromEntries(['VERIFIED', 'PROVISIONAL_SOURCED', 'PROVISIONAL_TRANSLATED', 'NO_TRANSLATION_AVAILABLE'].map(status => [status, records.filter(record => record.evidenceStatus === status).length]));
assert.deepEqual(counts, {VERIFIED: 841, PROVISIONAL_SOURCED: 86, PROVISIONAL_TRANSLATED: 2505, NO_TRANSLATION_AVAILABLE: 0});
assert.deepEqual(summary.primaryUiLocalizationClass, counts);
assert.equal(Object.values(counts).reduce((total, count) => total + count, 0), 3432);

const verified = records.filter(record => record.evidenceStatus === 'VERIFIED');
assert.ok(verified.every(record => record.verified && record.sourceRefs.length > 0 && record.provenance?.length > 0));
assert.equal(verified.filter(record => record.translationMethod === 'DIRECT_SOURCE').length, 395);
assert.equal(verified.filter(record => record.translationMethod === 'MULTI_AUTHORITY').length, 14);
assert.equal(verified.filter(record => record.translationMethod === 'CONTROLLED_DERIVED').length, 432);
assert.ok(verified.filter(record => record.translationMethod === 'CONTROLLED_DERIVED').every(record => record.compositionRuleId));

const sourced = records.filter(record => record.evidenceStatus === 'PROVISIONAL_SOURCED');
assert.ok(sourced.every(record => !record.verified && record.sourceRefs.length > 0));
assert.equal(records.filter(record => record.sourceDisposition === 'SOURCE_CONFLICT').length, 7);
assert.equal(records.filter(record => record.sourceDisposition === 'SOURCE_VARIANT').length, 2);
assert.ok(records.filter(record => ['SOURCE_CONFLICT', 'SOURCE_VARIANT'].includes(record.sourceDisposition)).every(record => record.variants.length > 1 && record.selectionRule));

assert.equal(generated.length, 2505);
assert.ok(generated.every(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED' && record.sourceRefs.length === 0));
assert.ok(records.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED').every(record => !record.verified && record.sourceRefs.length === 0));
assert.equal(summary.quality.generatedRecords, generated.length);
assert.equal(summary.quality.flaggedRecords, quality.filter(item => item.findings.length > 0).length);
assert.deepEqual(summary.quality.checks, [
  'UNTRANSLATED_ENGLISH_RESIDUE',
  'MISSING_LATERALITY',
  'DUPLICATED_ANATOMICAL_HEAD',
  'REVERSED_LEFT_RIGHT',
  'REVERSED_SUPERIOR_INFERIOR',
  'REVERSED_ANTERIOR_POSTERIOR',
  'MALFORMED_VIETNAMESE_WORD_ORDER',
  'ENGLISH_VIETNAMESE_MIXTURE',
  'INCONSISTENT_COMPONENT_TRANSLATION',
  'SUSPICIOUS_LEXICON_INCONSISTENCY',
]);

const byId = Object.fromEntries(records.map(record => [record.conceptId, record]));
for (const concept of atlas.concepts.slice(0, 12).concat(atlas.concepts.slice(-12))) {
  const record = byId[concept.id];
  const customCatalog = {[concept.id]: record};
  assert.equal(resolveConceptName(concept, 'vi', {}, {}, {}, customCatalog), record.vietnamese, `${concept.id} Vietnamese resolver`);
  assert.equal(resolveConceptName(concept, 'en', {}, {}, {}, customCatalog), concept.name, `${concept.id} English resolver`);
  assert.equal(resolveConceptLocalization(concept, customCatalog)?.evidenceStatus, record.evidenceStatus);
  assert.equal(matchesTerminologyQuery(concept, record.vietnamese, {}, {}, {}, customCatalog), true, `${concept.id} Vietnamese search`);
  assert.equal(matchesTerminologyQuery(concept, concept.name, {}, {}, {}, customCatalog), true, `${concept.id} English search`);
}
const fallbackConcept = atlas.concepts.find(concept => byId[concept.id].evidenceStatus === 'NO_TRANSLATION_AVAILABLE');
if (fallbackConcept) assert.equal(resolveConceptName(fallbackConcept, 'vi', {}, {}, {}, {[fallbackConcept.id]: byId[fallbackConcept.id]}), fallbackConcept.name);

assert.equal(getMessage('vi', 'evidence.verified'), 'Đã xác minh');
assert.equal(getMessage('vi', 'evidence.provisionalSourced'), 'Chưa xác minh đầy đủ');
assert.equal(getMessage('vi', 'evidence.provisionalTranslated'), 'Chưa xác định nguồn');
assert.equal(getMessage('vi', 'detail.evidenceVariantNote'), 'Có biến thể nguồn');
const page = await readFile(path('app', 'page.tsx'), 'utf8');
assert.match(page, /evidenceStatus/);
assert.match(page, /evidenceStatusLabelKey/);
assert.match(page, /search-result-english/);

assert.equal(summary.productionSafety.release, 'UNRELEASED');
assert.equal(summary.productionSafety.sourceVerified, 0);
assert.equal(summary.productionSafety.medicallyReviewed, 0);
assert.equal(summary.productionSafety.releaseEligible, 0);
const artifactNames = ['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl', 'quality-review.jsonl', 'coverage-summary.json'];
for (const name of artifactNames) assert.equal(await sha256File(['data', 'terminology', 'research', 'm04b2i', name]), manifest.outputHashes[`data/terminology/research/m04b2i/${name}`], `${name} hash`);
for (const [file, expected] of Object.entries(b2hManifest.outputHashes)) assert.equal(await sha256File(file.split('/')), expected, `historical artifact unchanged: ${file}`);
for (const [file, expected] of Object.entries(b2hManifest.productionHashes)) assert.equal(await sha256File(file.split('/')), expected, `production artifact unchanged: ${file}`);
assert.equal(JSON.stringify(records).includes('reviewer'), false, 'no reviewer invented in localization records');
assert.equal(JSON.stringify(generated).includes('sourceRefs\":['), true, 'generated records retain explicit empty sourceRefs');

console.log('M04B2I full-coverage localization, provenance, precedence, search, UI labels, release gates, determinism, and historical immutability tests passed.');
