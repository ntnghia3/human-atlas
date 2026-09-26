import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(join(fileURLToPath(import.meta.url), '..', '..'));
const M04B2I_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i');
const M04B2I_QA_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i-qa');
const TRANSLATION_QA_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i-qa-translation');
const LOCAL_QA_DIR = join(ROOT, '.local', 'translation-qa');
const QUEUE_PATH = join(TRANSLATION_QA_DIR, 'remaining-provisional-translation-qa.jsonl');
const CHUNKS_DIR = join(TRANSLATION_QA_DIR, 'chunks');
const MANIFEST_PATH = join(TRANSLATION_QA_DIR, 'remaining-qa-manifest.json');
const REPORT_PATH = join(ROOT, 'docs', 'en-vi', 'REMAINING_PROVISIONAL_TRANSLATION_QA_AUDIT.md');
const CHECKPOINT = 'fe16a8c';
const CHUNK_SIZE = 200;
const EXPECTED = {total: 3432, VERIFIED: 841, PROVISIONAL_SOURCED: 86, PROVISIONAL_TRANSLATED: 2505, NO_TRANSLATION_AVAILABLE: 0};
const PRODUCTION_FILES = [
  'data/terminology/research/m04b2i/localization-records.jsonl',
  'data/terminology/research/m04b2i/provisional-translations.jsonl',
  'data/terminology/research/m04b2i/localization-catalog.json',
  'data/terminology/research/m04b2i/quality-review.jsonl',
  'data/terminology/research/m04b2i/coverage-summary.json',
  'data/terminology/research/m04b2i/run-manifest.json',
];

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const readJsonl = path => readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeJsonl = (path, values) => writeFileSync(path, `${values.map(value => JSON.stringify(value)).join('\n')}${values.length ? '\n' : ''}`, 'utf8');
const sha256File = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const byId = values => new Map(values.map(value => [value.conceptId, value]));
const idsOf = values => new Set(values.map(value => value.conceptId));
const sorted = values => [...values].sort();
const sameSet = (left, right) => left.size === right.size && [...left].every(value => right.has(value));
const duplicateIds = values => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value.conceptId)) duplicates.add(value.conceptId);
    seen.add(value.conceptId);
  }
  return [...duplicates];
};
const gitValue = args => {
  try { return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim(); } catch { return null; }
};
const productionHashes = () => Object.fromEntries(PRODUCTION_FILES.map(relative => [relative, sha256File(join(ROOT, relative))]));

function main() {
  const currentRecords = readJsonl(join(M04B2I_DIR, 'localization-records.jsonl'));
  const coverageSummary = readJson(join(M04B2I_DIR, 'coverage-summary.json'));
  const finalChecked = readJsonl(join(LOCAL_QA_DIR, 'final_review_616_CHECKED.jsonl'));
  const patch313 = readJsonl(join(LOCAL_QA_DIR, 'provisional_translated_patch_01_02_313.jsonl'));
  const patch193 = readJsonl(join(LOCAL_QA_DIR, 'provisional_translated_patch_REMAINING_FINAL_193.jsonl'));
  const finalQaDecisions = readJsonl(join(M04B2I_QA_DIR, 'qa-decisions.jsonl'));
  const beforeProductionHashes = productionHashes();
  const currentHead = gitValue(['rev-parse', '--short', 'HEAD']);

  const statusCounts = Object.fromEntries(Object.keys(EXPECTED).filter(key => key !== 'total').map(status => [status, currentRecords.filter(record => record.evidenceStatus === status).length]));
  const A = new Set(currentRecords.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED').map(record => record.conceptId));
  const B = idsOf(finalChecked);
  const correctIds = idsOf(finalChecked.filter(record => record.decision === 'CORRECT'));
  const keepIds = idsOf(finalChecked.filter(record => record.decision === 'KEEP'));
  const previousPatchIds = idsOf(patch313);
  const remainingPatchIds = idsOf(patch193);
  const patchUnionIds = new Set([...previousPatchIds, ...remainingPatchIds]);
  const reviewedProvisional = new Set([...A].filter(conceptId => B.has(conceptId)));
  const remainingIds = new Set([...A].filter(conceptId => !B.has(conceptId)));
  const reviewedNonProvisional = new Set([...B].filter(conceptId => !A.has(conceptId)));
  const currentById = byId(currentRecords);

  assert.equal(currentRecords.length, EXPECTED.total, 'current localization record count');
  assert.equal(new Set(currentRecords.map(record => record.conceptId)).size, currentRecords.length, 'current localization IDs are unique');
  assert.equal(finalChecked.length, 616, 'completed campaign row count');
  assert.equal(B.size, 616, 'completed campaign IDs are unique');
  assert.deepEqual({CORRECT: finalChecked.filter(record => record.decision === 'CORRECT').length, KEEP: finalChecked.filter(record => record.decision === 'KEEP').length}, {CORRECT: 498, KEEP: 118}, 'completed campaign decision counts');
  assert.equal(previousPatchIds.size, 313, 'previous patch unique count');
  assert.equal(remainingPatchIds.size, 193, 'remaining patch unique count');
  assert.equal([...previousPatchIds].filter(conceptId => remainingPatchIds.has(conceptId)).length, 8, 're-audit overlap count');
  assert.ok(sameSet(patchUnionIds, correctIds), 'patch union equals final CORRECT campaign IDs');
  assert.equal(patchUnionIds.size, 498, 'patch union unique count');
  assert.equal([...patchUnionIds].filter(conceptId => keepIds.has(conceptId)).length, 0, 'KEEP IDs do not overlap patch IDs');
  assert.equal(reviewedProvisional.size + remainingIds.size, A.size, 'reviewed provisional plus remaining covers A');
  assert.equal([...reviewedProvisional].filter(conceptId => remainingIds.has(conceptId)).length, 0, 'reviewed and remaining sets are disjoint');
  assert.equal(remainingIds.size, 1889, 'remaining queue count');

  const remainingRecords = currentRecords.filter(record => remainingIds.has(record.conceptId));
  const queue = remainingRecords.map(record => ({
    conceptId: record.conceptId,
    english: record.english,
    currentVietnamese: record.vietnamese,
    evidenceStatus: record.evidenceStatus,
    translationMethod: record.translationMethod,
    reason: 'NOT_YET_TRANSLATION_QA_REVIEWED',
  }));
  assert.equal(queue.length, remainingIds.size, 'queue has one row per remaining concept');
  assert.equal(new Set(queue.map(record => record.conceptId)).size, queue.length, 'queue IDs are unique');
  assert.ok(queue.every(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED'), 'queue records are provisional translations');
  assert.ok(queue.every(record => currentById.get(record.conceptId)?.vietnamese === record.currentVietnamese), 'queue values match current localization data');

  mkdirSync(TRANSLATION_QA_DIR, {recursive: true});
  mkdirSync(CHUNKS_DIR, {recursive: true});
  writeJsonl(QUEUE_PATH, queue);
  const chunkCount = Math.ceil(queue.length / CHUNK_SIZE);
  const chunks = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = queue.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    const filename = `remaining_qa_${String(index + 1).padStart(3, '0')}_of_${chunkCount}.jsonl`;
    const path = join(CHUNKS_DIR, filename);
    writeJsonl(path, chunk);
    chunks.push({file: `chunks/${filename}`, count: chunk.length, firstConceptId: chunk[0].conceptId, lastConceptId: chunk.at(-1).conceptId, sha256: sha256File(path)});
  }
  const concatenated = chunks.flatMap(chunk => readJsonl(join(TRANSLATION_QA_DIR, chunk.file)));
  assert.deepEqual(concatenated, queue, 'chunk concatenation reproduces master queue');
  assert.ok(chunks.every(chunk => chunk.count <= CHUNK_SIZE), 'every chunk is at most 200 records');

  const afterProductionHashes = productionHashes();
  assert.deepEqual(afterProductionHashes, beforeProductionHashes, 'production artifacts are unchanged');
  const baselineDrift = {
    total: currentRecords.length - EXPECTED.total,
    VERIFIED: statusCounts.VERIFIED - EXPECTED.VERIFIED,
    PROVISIONAL_SOURCED: statusCounts.PROVISIONAL_SOURCED - EXPECTED.PROVISIONAL_SOURCED,
    PROVISIONAL_TRANSLATED: statusCounts.PROVISIONAL_TRANSLATED - EXPECTED.PROVISIONAL_TRANSLATED,
    NO_TRANSLATION_AVAILABLE: statusCounts.NO_TRANSLATION_AVAILABLE - EXPECTED.NO_TRANSLATION_AVAILABLE,
  };
  const missingIds = [...A].filter(conceptId => !B.has(conceptId) && !remainingIds.has(conceptId));
  const unexpectedRemainingIds = [...remainingIds].filter(conceptId => !A.has(conceptId));
  const manifest = {
    schemaVersion: 'M04B2I-REMAINING-PROVISIONAL-TRANSLATION-QA-MANIFEST-1',
    repositoryCheckpoint: CHECKPOINT,
    currentHead,
    totalLocalizationConcepts: currentRecords.length,
    totalProvisionalTranslated: A.size,
    completedCampaignConcepts: B.size,
    completedCampaignCorrect: correctIds.size,
    completedCampaignKeep: keepIds.size,
    reviewedProvisionalCount: reviewedProvisional.size,
    reviewedNonProvisionalCount: reviewedNonProvisional.size,
    remainingUnreviewedProvisionalCount: remainingIds.size,
    chunkSize: CHUNK_SIZE,
    chunkCount,
    duplicateIds: duplicateIds(queue).length,
    missingIds: missingIds.length,
    unexpectedRemainingIds: unexpectedRemainingIds.length,
    reviewedRemainingOverlap: [...reviewedProvisional].filter(conceptId => remainingIds.has(conceptId)).length,
    orderedChunkFiles: chunks.map(chunk => chunk.file),
    chunks,
    masterQueue: {file: 'remaining-provisional-translation-qa.jsonl', count: queue.length, firstConceptId: queue[0].conceptId, lastConceptId: queue.at(-1).conceptId, sha256: sha256File(QUEUE_PATH)},
    currentClassCounts: {total: currentRecords.length, ...statusCounts},
    baselineExpected: EXPECTED,
    baselineDrift,
    release: coverageSummary.productionSafety?.release ?? null,
    productionArtifactHashesBefore: beforeProductionHashes,
    productionArtifactHashesAfter: afterProductionHashes,
    completedCampaignEvidence: {
      checkedFile: '.local/translation-qa/final_review_616_CHECKED.jsonl',
      previousPatchFile: '.local/translation-qa/provisional_translated_patch_01_02_313.jsonl',
      remainingPatchFile: '.local/translation-qa/provisional_translated_patch_REMAINING_FINAL_193.jsonl',
      previousRemainingPatchOverlap: 8,
      patchUnionMatchesCorrect: true,
    },
    structuralFinalQaTargetsExcluded: new Set(finalQaDecisions.map(record => record.conceptId)).size,
    deterministic: true,
  };
  writeJson(MANIFEST_PATH, manifest);

  const report = `# Remaining Provisional Translation QA Audit

## Baseline

Repository HEAD is ${currentHead}; the requested locked checkpoint is ${CHECKPOINT}. The current localization dataset contains ${currentRecords.length} concepts.

| Localization class | Current count | Expected | Drift |
|---|---:|---:|---:|
| VERIFIED | ${statusCounts.VERIFIED} | ${EXPECTED.VERIFIED} | ${baselineDrift.VERIFIED} |
| PROVISIONAL_SOURCED | ${statusCounts.PROVISIONAL_SOURCED} | ${EXPECTED.PROVISIONAL_SOURCED} | ${baselineDrift.PROVISIONAL_SOURCED} |
| PROVISIONAL_TRANSLATED | ${statusCounts.PROVISIONAL_TRANSLATED} | ${EXPECTED.PROVISIONAL_TRANSLATED} | ${baselineDrift.PROVISIONAL_TRANSLATED} |
| English-only | ${statusCounts.NO_TRANSLATION_AVAILABLE} | ${EXPECTED.NO_TRANSLATION_AVAILABLE} | ${baselineDrift.NO_TRANSLATION_AVAILABLE} |
| **Total** | **${currentRecords.length}** | **${EXPECTED.total}** | **${baselineDrift.total}** |

Release status is **${manifest.release}**. Baseline drift is **${Object.values(baselineDrift).some(value => value !== 0) ? 'PRESENT' : 'NONE'}**.

## Completed 616-concept campaign

The authoritative campaign set B was reconstructed from final_review_616_CHECKED.jsonl: ${B.size} unique conceptIds, with ${correctIds.size} CORRECT and ${keepIds.size} KEEP decisions. Its CORRECT IDs were cross-checked against the integration lineage inputs present in the workspace: 313 prior patch IDs plus 193 remaining patch IDs, with the expected 8-ID re-audit overlap, yielding exactly 498 unique CORRECT IDs. The 118 KEEP IDs overlap neither patch set.

The separate deterministic structural final-QA target set contains ${manifest.structuralFinalQaTargetsExcluded} concepts and was excluded from this manual/Gemini translation-QA campaign. Source evidence or VERIFIED status was not used to count a concept as reviewed.

## Set accounting

Let A be all current PROVISIONAL_TRANSLATED conceptIds and B be the completed 616-concept campaign:

| Set | Count |
|---|---:|
| A: current PROVISIONAL_TRANSLATED | ${A.size} |
| B: completed campaign | ${B.size} |
| A ∩ B: reviewed provisional | ${reviewedProvisional.size} |
| B − A: reviewed non-provisional | ${reviewedNonProvisional.size} |
| A − B: remaining unreviewed provisional | **${remainingIds.size}** |

The reviewed-provisional and remaining sets are disjoint, and their union reproduces all ${A.size} current PROVISIONAL_TRANSLATED concepts. The completed 616-concept QA campaign is a reviewed subset and must not be interpreted as manual QA coverage of all 2505 PROVISIONAL_TRANSLATED concepts.

## Generated queue and chunks

The master queue preserves authoritative localization-record ordering and contains exactly ${queue.length} records. It uses only the requested queue fields and reason NOT_YET_TRANSLATION_QA_REVIEWED. It is split into ${chunkCount} deterministic chunks of maximum ${CHUNK_SIZE} records:

${chunks.map(chunk => `- ${chunk.file}: ${chunk.count} records (${chunk.firstConceptId} → ${chunk.lastConceptId})`).join('\n')}

Checks: duplicate queue IDs ${manifest.duplicateIds}; missing IDs ${manifest.missingIds}; unexpected remaining IDs ${manifest.unexpectedRemainingIds}; reviewed/remaining overlap ${manifest.reviewedRemainingOverlap}; chunk maximum ${Math.max(...chunks.map(chunk => chunk.count))}; concatenated chunks equal the master queue: **true**.

## Generated files

- data/terminology/research/m04b2i-qa-translation/remaining-provisional-translation-qa.jsonl
- data/terminology/research/m04b2i-qa-translation/chunks/
- data/terminology/research/m04b2i-qa-translation/remaining-qa-manifest.json
- docs/en-vi/REMAINING_PROVISIONAL_TRANSLATION_QA_AUDIT.md
- scripts/audit-m04b2i-remaining-provisional-translation-qa.mjs

Production artifact hashes before and after queue generation are identical. No localization string, evidence metadata, translation status, source claim, provenance, or generated terminology artifact was modified. No terminology value was translated or improved.

Git safety: changes were left unstaged; no add, commit, push, clean, or reset was performed.

## Validation

The deterministic audit generator passed all set, queue, chunk, and production-hash invariants. Run git diff --check after generation for the final working-tree whitespace check.
`;
  writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(JSON.stringify({currentHead, currentProvisionalTranslated: A.size, completedCampaignConcepts: B.size, reviewedProvisional: reviewedProvisional.size, reviewedNonProvisional: reviewedNonProvisional.size, remainingUnreviewedProvisional: remainingIds.size, chunkCount, chunkSizes: chunks.map(chunk => chunk.count), duplicateIds: manifest.duplicateIds, missingIds: manifest.missingIds, productionArtifactsUnchanged: true, pass: true}, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
