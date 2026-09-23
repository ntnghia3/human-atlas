import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {getMessage} from '../app/localization.ts';
import {matchesTerminologyQuery, resolveConceptLocalization, resolveConceptName} from '../app/terminology.ts';

const ROOT = resolve(join(fileURLToPath(import.meta.url), '..', '..'));
const path = (...parts) => join(ROOT, ...parts);
const readJson = file => JSON.parse(readFileSync(path(...file), 'utf8'));
const readJsonl = file => readFileSync(path(...file), 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const sha256File = file => createHash('sha256').update(readFileSync(path(...file))).digest('hex');

const atlas = readJson(['public', 'models', 'atlas.json']);
const records = readJsonl(['data', 'terminology', 'research', 'm04b2i', 'localization-records.jsonl']);
const generated = readJsonl(['data', 'terminology', 'research', 'm04b2i', 'provisional-translations.jsonl']);
const quality = readJsonl(['data', 'terminology', 'research', 'm04b2i', 'quality-review.jsonl']);
const catalog = readJson(['data', 'terminology', 'research', 'm04b2i', 'localization-catalog.json']);
const summary = readJson(['data', 'terminology', 'research', 'm04b2i-qa', 'qa-summary.json']);
const decisions = readJsonl(['data', 'terminology', 'research', 'm04b2i-qa', 'qa-decisions.jsonl']);
const repaired = readJsonl(['data', 'terminology', 'research', 'm04b2i-qa', 'repaired-translations.jsonl']);
const humanReview = readJsonl(['data', 'terminology', 'research', 'm04b2i-qa', 'residual-human-review.jsonl']);
const manifest = readJson(['data', 'terminology', 'research', 'm04b2i-qa', 'run-manifest.json']);
const m04b2iManifest = readJson(['data', 'terminology', 'research', 'm04b2i', 'run-manifest.json']);
const b2hManifest = readJson(['data', 'terminology', 'research', 'm04b2h', 'run-manifest.json']);

const flagged = quality.filter(item => item.findings?.length > 0).map(item => item.conceptId);
const recordById = new Map(records.map(record => [record.conceptId, record]));
const decisionById = new Map(decisions.map(item => [item.conceptId, item]));
const conflicts = records.filter(record => record.sourceDisposition === 'SOURCE_CONFLICT').map(record => record.conceptId);
const variants = records.filter(record => record.sourceDisposition === 'SOURCE_VARIANT').map(record => record.conceptId);
const targetIds = [...flagged, ...conflicts, ...variants];
const allowedStatuses = new Set(['QA_CLEAR', 'QA_REPAIRED', 'QA_RETAIN_PROVISIONAL', 'QA_CONFLICT_PRESERVED', 'QA_NEEDS_HUMAN_REVIEW']);
const highRisk = new Set(['MISSING_MEANINGFUL_MODIFIER', 'REVERSED_DIRECTIONAL_MODIFIER', 'CATEGORY_CONFUSION', 'BRANCH_TRUNK_CONFUSION', 'SEGMENT_LOBE_CONFUSION', 'MISSING_NUMBERED_IDENTIFIER', 'ENGLISH_RESIDUE', 'DUPLICATED_TRANSLATED_NOUN', 'HALLUCINATED_QUALIFIER', 'MALFORMED_WITH_RELATION']);

assert.equal(atlas.concepts.length, 3432);
assert.equal(records.length, 3432);
assert.equal(catalog.records.length, 3432);
assert.equal(flagged.length, 271);
assert.equal(conflicts.length, 7);
assert.equal(variants.length, 2);
assert.equal(targetIds.length, 280);
assert.equal(new Set(targetIds).size, 280);
assert.equal(decisions.length, 280);
assert.equal(new Set(decisions.map(item => item.conceptId)).size, 280);
assert.ok(decisions.every(item => allowedStatuses.has(item.qaStatus)));
assert.deepEqual(summary.classifications, Object.fromEntries([...allowedStatuses].map(status => [status, decisions.filter(item => item.qaStatus === status).length])));
assert.equal(Object.values(summary.classifications).reduce((sum, count) => sum + count, 0), 280);
assert.equal(summary.targetTotal, 280);
assert.equal(summary.generatedFlagged, 271);
assert.equal(summary.conflicts, 7);
assert.equal(summary.variants, 2);
assert.equal(summary.exactStringsChanged, decisions.filter(item => item.priorVietnamese !== item.postVietnamese).length);
assert.equal(summary.evidenceStatusesChanged, 0);
assert.equal(summary.verifiedStatusesChanged, 0);
assert.equal(summary.verifiedPromotionsFromGenerated, 0);
assert.equal(repaired.length, summary.classifications.QA_REPAIRED);
assert.equal(humanReview.length, summary.remainingHumanReview);
assert.ok(decisions.filter(item => item.priorVietnamese !== item.postVietnamese).every(item => item.qaStatus === 'QA_REPAIRED'));
assert.ok(decisions.filter(item => item.qaStatus === 'QA_CONFLICT_PRESERVED').every(item => item.sourceDisposition === 'SOURCE_CONFLICT' || item.sourceDisposition === 'SOURCE_VARIANT'));
assert.ok(decisions.filter(item => item.sourceDisposition === 'SOURCE_CONFLICT').every(item => item.qaStatus === 'QA_CONFLICT_PRESERVED'));
assert.ok(decisions.filter(item => item.sourceDisposition === 'SOURCE_VARIANT').every(item => item.qaStatus === 'QA_CONFLICT_PRESERVED'));
assert.ok(decisions.filter(item => item.qaStatus === 'QA_REPAIRED').every(item => item.evidenceStatus === 'PROVISIONAL_TRANSLATED' && item.verified === false && item.sourceRefs.length === 0));
assert.ok(decisions.filter(item => item.qaStatus === 'QA_REPAIRED').every(item => item.postSemanticFindings.every(code => !highRisk.has(code))));
assert.ok(records.every(record => record.english && record.vietnamese.trim()));
assert.equal(records.filter(record => record.evidenceStatus === 'VERIFIED').length, 841);
assert.equal(records.filter(record => record.evidenceStatus === 'PROVISIONAL_SOURCED').length, 86);
assert.equal(records.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED').length, 2505);
assert.equal(records.filter(record => record.evidenceStatus === 'NO_TRANSLATION_AVAILABLE').length, 0);
assert.equal(summary.totalConcepts, 3432);
assert.equal(summary.vietnameseUiCoverage, 3432);
assert.ok(records.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED').every(record => record.verified === false && record.sourceRefs.length === 0));
for (const decision of decisions) {
  const record = recordById.get(decision.conceptId);
  assert.ok(record, `record exists for ${decision.conceptId}`);
  assert.equal(record.english, decision.english);
  assert.equal(record.vietnamese, decision.postVietnamese);
}
assert.equal(resolveConceptName({id: 'FMA3711', name: 'segment of artery', elements: []}, 'vi'), 'đoạn động mạch');
assert.equal(matchesTerminologyQuery({id: 'FMA3711', name: 'segment of artery', elements: []}, 'đoạn động mạch'), true);
assert.equal(resolveConceptName({id: 'FMA3711', name: 'segment of artery', elements: []}, 'en'), 'segment of artery');
assert.equal(resolveConceptLocalization({id: 'FMA3711', name: 'segment of artery'})?.evidenceStatus, 'PROVISIONAL_TRANSLATED');
assert.equal(getMessage('vi', 'evidence.verified'), 'Đã xác minh');
assert.equal(getMessage('vi', 'evidence.provisionalSourced'), 'Chưa xác minh đầy đủ');
assert.equal(getMessage('vi', 'evidence.provisionalTranslated'), 'Chưa xác định nguồn');
assert.equal(getMessage('vi', 'detail.evidenceVariantNote'), 'Có biến thể nguồn');
const page = readFileSync(path('app', 'page.tsx'), 'utf8');
assert.match(page, /evidenceStatusLabelKey/);
assert.match(page, /evidenceVariantNote/);
const qaOutputNames = ['qa-decisions.jsonl', 'repaired-translations.jsonl', 'residual-human-review.jsonl', 'qa-summary.json'];
for (const name of qaOutputNames) assert.equal(sha256File(['data', 'terminology', 'research', 'm04b2i-qa', name]), manifest.outputHashes[`data/terminology/research/m04b2i-qa/${name}`], `${name} hash`);
for (const name of ['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl', 'quality-review.jsonl', 'coverage-summary.json']) assert.equal(sha256File(['data', 'terminology', 'research', 'm04b2i', name]), m04b2iManifest.outputHashes[`data/terminology/research/m04b2i/${name}`], `${name} base hash`);
for (const [file, expected] of Object.entries(b2hManifest.outputHashes)) assert.equal(sha256File(file.split('/')), expected, `historical artifact unchanged: ${file}`);
for (const [file, expected] of Object.entries(b2hManifest.productionHashes)) assert.equal(sha256File(file.split('/')), expected, `historical production unchanged: ${file}`);

const beforeHashes = Object.fromEntries([
  ...qaOutputNames.map(name => [`qa/${name}`, sha256File(['data', 'terminology', 'research', 'm04b2i-qa', name])]),
  ...['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl'].map(name => [`m04b2i/${name}`, sha256File(['data', 'terminology', 'research', 'm04b2i', name])]),
]);
execFileSync(process.execPath, [path('scripts', 'm04b2i-final-qa.mjs')], {cwd: ROOT, stdio: 'ignore'});
const afterHashes = Object.fromEntries([
  ...qaOutputNames.map(name => [`qa/${name}`, sha256File(['data', 'terminology', 'research', 'm04b2i-qa', name])]),
  ...['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl'].map(name => [`m04b2i/${name}`, sha256File(['data', 'terminology', 'research', 'm04b2i', name])]),
]);
assert.deepEqual(afterHashes, beforeHashes, 'final QA regeneration is deterministic');

console.log('M04B2I final bulk QA accounting, repair safety, conflict preservation, UI/search integration, historical immutability, and deterministic regeneration tests passed.');
