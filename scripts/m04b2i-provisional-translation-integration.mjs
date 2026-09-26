import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildFinalQa} from './m04b2i-final-qa.mjs';

const ROOT = resolve(join(fileURLToPath(import.meta.url), '..', '..'));
const M04B2I_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i');
const INPUT_DIR = join(ROOT, '.local', 'translation-qa');
const REMAINING_FINAL = process.argv.includes('--remaining-final');
const PATCH_PATH = join(INPUT_DIR, REMAINING_FINAL ? 'provisional_translated_patch_REMAINING_FINAL_193.jsonl' : 'provisional_translated_patch_01_02_313.jsonl');
const CHECKED_PATH = join(INPUT_DIR, REMAINING_FINAL ? 'final_review_616_CHECKED.jsonl' : 'final_review_01_02_CHECKED.jsonl');
const SOURCE_SENSITIVE_PATH = join(INPUT_DIR, 'final_review_01_02_SOURCE_SENSITIVE_11.jsonl');
const SUMMARY_PATH = join(INPUT_DIR, REMAINING_FINAL ? 'final_review_616_QA_SUMMARY.json' : 'final_review_01_02_QA_SUMMARY.json');
const PREVIOUS_PATCH_PATH = join(INPUT_DIR, 'provisional_translated_patch_01_02_313.jsonl');
const AUDIT_OVERRIDES_PATH = join(INPUT_DIR, 'final_review_03_AUDIT_OVERRIDES_33.jsonl');
const REPORT_PATH = join(ROOT, 'docs', 'en-vi', REMAINING_FINAL ? 'PROVISIONAL_TRANSLATION_QA_FINAL_INTEGRATION_REPORT.md' : 'PROVISIONAL_TRANSLATION_QA_INTEGRATION_REPORT.md');
const TOTAL = 3432;
const EXPECTED_COUNTS = {VERIFIED: 841, PROVISIONAL_SOURCED: 86, PROVISIONAL_TRANSLATED: 2505, NO_TRANSLATION_AVAILABLE: 0};
const EXPECTED_PATCH_ROWS = REMAINING_FINAL ? 193 : 313;
const EXPECTED_REVIEW_ROWS = REMAINING_FINAL ? 616 : 400;
const EXPECTED_KEEP_ROWS = REMAINING_FINAL ? 118 : 87;
const PRESERVED_KEYS = [
  'evidenceStatus', 'translationMethod', 'verified', 'sourceRefs', 'provenance', 'componentEvidence',
  'generatedFromVerifiedLexicon', 'generationMethod', 'sourceDisposition', 'variants', 'blockers',
];

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const readJsonl = path => readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const writeReport = content => writeFileSync(REPORT_PATH, `${content.trim()}\n`, 'utf8');
const setOf = values => new Set(values);
const sorted = values => [...values].sort();
const sameSet = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const counts = (records, field) => Object.fromEntries(Object.keys(EXPECTED_COUNTS).map(key => [key, records.filter(record => record[field] === key).length]));
const byId = records => new Map(records.map(record => [record.conceptId, record]));
const duplicateIds = records => {
  const seen = new Set();
  const duplicates = new Set();
  for (const record of records) {
    if (seen.has(record.conceptId)) duplicates.add(record.conceptId);
    seen.add(record.conceptId);
  }
  return [...duplicates];
};
const withoutVietnamese = item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'vietnamese'));
const copyKeys = (item, keys) => Object.fromEntries(keys.map(key => [key, item[key]]));

function readInputs() {
  return {
    patch: readJsonl(PATCH_PATH),
    checked: readJsonl(CHECKED_PATH),
    sourceSensitive: REMAINING_FINAL ? [] : readJsonl(SOURCE_SENSITIVE_PATH),
    inputSummary: readJson(SUMMARY_PATH),
    previousPatch: REMAINING_FINAL ? readJsonl(PREVIOUS_PATCH_PATH) : [],
    auditOverrides: REMAINING_FINAL ? readJsonl(AUDIT_OVERRIDES_PATH) : [],
  };
}

function readProduction() {
  const records = readJsonl(join(M04B2I_DIR, 'localization-records.jsonl'));
  const generated = readJsonl(join(M04B2I_DIR, 'provisional-translations.jsonl'));
  const catalog = readJson(join(M04B2I_DIR, 'localization-catalog.json'));
  const quality = readJsonl(join(M04B2I_DIR, 'quality-review.jsonl'));
  return {records, generated, catalog, quality};
}

function validateInputs(inputs, production) {
  const {patch, checked, sourceSensitive, inputSummary, previousPatch, auditOverrides} = inputs;
  const {records, generated, catalog, quality} = production;
  assert.equal(patch.length, EXPECTED_PATCH_ROWS, 'authoritative patch row count');
  assert.equal(duplicateIds(patch).length, 0, 'duplicate patch IDs');
  assert.equal(checked.length, EXPECTED_REVIEW_ROWS, 'reviewed set row count');
  assert.equal(duplicateIds(checked).length, 0, 'duplicate reviewed IDs');
  if (REMAINING_FINAL) {
    assert.equal(inputSummary.status, 'PASS');
    assert.deepEqual(inputSummary.finalDecisionCounts, {CORRECT: 498, KEEP: 118});
    assert.deepEqual(inputSummary.remainingFinalPatch, {rows: 193, batch03Corrections: 169, batch04Corrections: 16, reAuditCorrectionsOnAlreadyIntegrated01And02: 8, duplicateConceptIds: 0, blankNewVietnamese: 0, unchangedCorrectRows: 0});
    assert.deepEqual(inputSummary.batch03FinalAudit, {geminiInputRecords: 200, manualAuditOverrides: 33, finalCorrect: 169, finalKeep: 31, missingIds: 0, extraIds: 0});
    assert.deepEqual(inputSummary.invariants, {englishMismatch: 0, oldVietnameseMismatchAgainstBatchInputs: 0, missingConceptIds: 0, extraConceptIds: 0});
    assert.equal(auditOverrides.length, 33, 'batch 03 audit override row count');
  } else {
    assert.deepEqual(inputSummary.decisionCounts, {CORRECT: 313, KEEP: 87});
    assert.deepEqual(inputSummary.missingTargets, []);
    assert.deepEqual(inputSummary.duplicateTargetIds, []);
    assert.equal(inputSummary.englishMismatches, 0);
    assert.equal(inputSummary.oldVietnameseMismatches, 0);
    assert.equal(sourceSensitive.length, 11, 'source-sensitive guardrail row count');
  }
  assert.deepEqual(counts(records, 'evidenceStatus'), EXPECTED_COUNTS, 'current evidence class counts');
  assert.equal(records.length, TOTAL);
  assert.equal(generated.length, EXPECTED_COUNTS.PROVISIONAL_TRANSLATED);
  assert.equal(catalog.records.length, TOTAL);
  assert.equal(quality.length, EXPECTED_COUNTS.PROVISIONAL_TRANSLATED);

  const recordById = byId(records);
  const generatedById = byId(generated);
  const catalogById = byId(catalog.records);
  const qualityById = byId(quality);
  const patchIds = patch.map(item => item.conceptId);
  const correctIds = checked.filter(item => item.decision === 'CORRECT').map(item => item.conceptId);
  const keepIds = checked.filter(item => item.decision === 'KEEP').map(item => item.conceptId);
  assert.equal(setOf(patchIds).size, EXPECTED_PATCH_ROWS);
  if (REMAINING_FINAL) {
    const previousIds = previousPatch.map(item => item.conceptId);
    const unionIds = [...new Set([...previousIds, ...patchIds])];
    const overlapIds = patchIds.filter(id => previousIds.includes(id));
    assert.equal(previousIds.length, 313, 'previous integrated patch row count');
    assert.equal(new Set(previousIds).size, 313, 'previous integrated patch unique count');
    assert.equal(overlapIds.length, 8, 're-audit overlap count');
    assert.ok(sameSet(unionIds, correctIds), 'previous plus remaining patch IDs must equal final CORRECT IDs');
    assert.equal(new Set(unionIds).size, 498, 'final unique CORRECT concept count');
  } else assert.ok(sameSet(patchIds, correctIds), 'patch IDs must equal reviewed CORRECT IDs');
  assert.equal(patchIds.some(id => keepIds.includes(id)), false, 'KEEP records must not be patched');

  const states = new Map();
  for (const item of patch) {
    assert.ok(item.conceptId && item.english, `strict patch identity for ${item.conceptId}`);
    assert.equal(item.decision, 'CORRECT', `decision for ${item.conceptId}`);
    assert.ok(item.newVietnamese?.trim(), `nonblank newVietnamese for ${item.conceptId}`);
    assert.notEqual(item.newVietnamese, item.oldVietnamese, `changed Vietnamese value for ${item.conceptId}`);
    for (const [name, map] of [['records', recordById], ['generated', generatedById], ['catalog', catalogById], ['quality', qualityById]]) {
      const current = map.get(item.conceptId);
      assert.ok(current, `known ${name} conceptId ${item.conceptId}`);
      assert.equal(current.english, item.english, `${name} English match for ${item.conceptId}`);
      if (name !== 'quality') assert.ok(current.vietnamese === item.oldVietnamese || current.vietnamese === item.newVietnamese, `${name} DRIFT_CONFLICT for ${item.conceptId}`);
    }
    const current = recordById.get(item.conceptId);
    assert.equal(current.evidenceStatus, 'PROVISIONAL_TRANSLATED', `status for ${item.conceptId}`);
    assert.equal(current.verified, false, `verified flag for ${item.conceptId}`);
    assert.deepEqual(current.sourceRefs, [], `sourceRefs for ${item.conceptId}`);
    states.set(item.conceptId, current.vietnamese === item.newVietnamese ? 'ALREADY_APPLIED' : 'READY_TO_APPLY');
  }

  for (const item of sourceSensitive) {
    const current = recordById.get(item.conceptId);
    assert.ok(current, `source-sensitive conceptId ${item.conceptId}`);
    assert.equal(current.evidenceStatus, 'PROVISIONAL_TRANSLATED', `source-sensitive status for ${item.conceptId}`);
    assert.equal(states.has(item.conceptId), true, `source-sensitive patch coverage for ${item.conceptId}`);
  }

  return {
    patchIds,
    keepIds,
    states,
    previousPatchIds: previousPatch.map(item => item.conceptId),
    reviewCorrectIds: correctIds,
    reviewKeepIds: keepIds,
    beforeCounts: counts(records, 'evidenceStatus'),
    before: production,
  };
}

function assertSynchronized(production, patch) {
  const records = byId(production.records);
  const generated = byId(production.generated);
  const catalog = byId(production.catalog.records);
  for (const item of patch) {
    for (const map of [records, generated, catalog]) {
      const current = map.get(item.conceptId);
      assert.equal(current.english, item.english, `post-integration English for ${item.conceptId}`);
      assert.equal(current.vietnamese, item.newVietnamese, `post-integration Vietnamese for ${item.conceptId}`);
    }
  }
}

function assertNoUnrelatedChanges(before, after, patchIds) {
  const patchSet = setOf(patchIds);
  const compareCollections = (beforeItems, afterItems, label) => {
    const beforeMap = byId(beforeItems);
    const afterMap = byId(afterItems);
    assert.equal(afterMap.size, beforeMap.size, `${label} row count`);
    for (const [conceptId, beforeItem] of beforeMap) {
      const afterItem = afterMap.get(conceptId);
      assert.ok(afterItem, `${label} retained ${conceptId}`);
      if (patchSet.has(conceptId)) assert.deepEqual(withoutVietnamese(afterItem), withoutVietnamese(beforeItem), `${label} non-Vietnamese fields preserved for ${conceptId}`);
      else assert.deepEqual(afterItem, beforeItem, `${label} unrelated record changed for ${conceptId}`);
    }
  };
  compareCollections(before.records, after.records, 'localization-records');
  compareCollections(before.generated, after.generated, 'provisional-translations');
  compareCollections(before.catalog.records, after.catalog.records, 'localization-catalog');
  compareCollections(before.quality, after.quality, 'quality-review');
  for (const item of before.records.filter(record => patchSet.has(record.conceptId))) {
    const afterItem = byId(after.records).get(item.conceptId);
    assert.deepEqual(copyKeys(afterItem, PRESERVED_KEYS), copyKeys(item, PRESERVED_KEYS), `evidence fields preserved for ${item.conceptId}`);
  }
}

function buildReport({inputs, result, after, appliedIds, alreadyAppliedIds, driftConflicts = [], error = null}) {
  const beforeCounts = result?.beforeCounts ?? EXPECTED_COUNTS;
  const afterCounts = after ? counts(after.records, 'evidenceStatus') : beforeCounts;
  const patchRows = inputs.patch.length;
  const checkedKeep = inputs.checked.filter(item => item.decision === 'KEEP').length;
  const status = error ? 'DRIFT_CONFLICT / FAILED' : 'PASS';
  const title = REMAINING_FINAL ? 'Provisional Translation QA Final Integration Report' : 'Provisional Translation QA Integration Report';
  const source = REMAINING_FINAL ? 'provisional_translated_patch_REMAINING_FINAL_193.jsonl' : 'provisional_translated_patch_01_02_313.jsonl';
  const reviewSet = REMAINING_FINAL ? `The final reviewed set is complete: 616 unique concepts consisting of batch 01+02 (400), batch 03 (200), and batch 04 (16). Final decisions are CORRECT 498 and KEEP 118. The previous integration supplied 313 CORRECT rows; this integration supplies 193 remaining rows, including 169 batch-03 corrections, 16 batch-04 corrections, and 8 re-audit corrections to concepts already changed by the earlier integration. The 8-row overlap means 313 + 193 integration operations produce 498 unique CORRECT concepts.` : 'The reviewed batch contained 400 unique concepts with 313 CORRECT rows and 87 KEEP rows.';
  const scopeNote = REMAINING_FINAL ? 'This 616-concept review set is only a QA subset. It does not mean that all 2505 PROVISIONAL_TRANSLATED concepts have been manually reviewed.' : 'This reviewed batch is only a QA subset of the full PROVISIONAL_TRANSLATED catalog.';
  const evidenceNote = REMAINING_FINAL ? 'No evidence status, verified flag, source reference, provenance, or release status was promoted. All affected generated records remain PROVISIONAL_TRANSLATED and verified:false. Official release remains UNRELEASED.' : 'No evidence status, verified flag, source reference, provenance, or release status was promoted. Official release remains UNRELEASED.';
  const files = `- data/terminology/research/m04b2i/localization-records.jsonl
- data/terminology/research/m04b2i/provisional-translations.jsonl
- data/terminology/research/m04b2i/localization-catalog.json
- data/terminology/research/m04b2i/quality-review.jsonl
- data/terminology/research/m04b2i/run-manifest.json
- data/terminology/research/m04b2i-qa/qa-decisions.jsonl
- data/terminology/research/m04b2i-qa/repaired-translations.jsonl
- data/terminology/research/m04b2i-qa/residual-human-review.jsonl
- data/terminology/research/m04b2i-qa/qa-summary.json
- data/terminology/research/m04b2i-qa/run-manifest.json
- scripts/m04b2i-final-qa.mjs
- scripts/m04b2i-provisional-translation-integration.mjs
- package.json
- docs/en-vi/${REMAINING_FINAL ? 'PROVISIONAL_TRANSLATION_QA_FINAL_INTEGRATION_REPORT.md' : 'PROVISIONAL_TRANSLATION_QA_INTEGRATION_REPORT.md'}`;
  return `# ${title}

## Result

**${status}** — the authoritative .local/translation-qa/${source} input was validated against the current M04B2I dataset.

| Measure | Count |
|---|---:|
| Patch records supplied | ${patchRows} |
| Expected corrections | ${patchRows} |
| Corrections applied this run | ${appliedIds.length} |
| Corrections already present on deterministic rerun | ${alreadyAppliedIds.length} |
| KEEP records requiring no change | ${checkedKeep} |
| Duplicate patch IDs | 0 |
| Unknown concept IDs | 0 |
| Drift conflicts | ${driftConflicts.length} |

The patch contract required exact conceptId, English, and old Vietnamese matches; decision CORRECT; nonblank newVietnamese; and a changed new value. No value was forced or invented. ${error ? `The integration stopped before applying the patch: ${error.message}` : `All ${patchRows} patch rows passed and the deterministic final-QA overlay completed.`}

${reviewSet}

${scopeNote}

## Evidence accounting

| Evidence class | Before | After |
|---|---:|---:|
| VERIFIED | ${beforeCounts.VERIFIED} | ${afterCounts.VERIFIED} |
| PROVISIONAL_SOURCED | ${beforeCounts.PROVISIONAL_SOURCED} | ${afterCounts.PROVISIONAL_SOURCED} |
| PROVISIONAL_TRANSLATED | ${beforeCounts.PROVISIONAL_TRANSLATED} | ${afterCounts.PROVISIONAL_TRANSLATED} |
| English-only fallback | ${beforeCounts.NO_TRANSLATION_AVAILABLE} | ${afterCounts.NO_TRANSLATION_AVAILABLE} |
| **Total concepts** | **${Object.values(beforeCounts).reduce((sum, count) => sum + count, 0)}** | **${Object.values(afterCounts).reduce((sum, count) => sum + count, 0)}** |

${evidenceNote}

The ${checkedKeep} KEEP records were not changed. The authoritative mutation source was only the remaining patch file. The separate audit files were used for accounting/guardrails only, not as mutation sources.

## Synchronized artifacts

${files}

The .local input bundle was treated as read-only. No git add, commit, push, reset, or clean was performed.

## Validation

The integration validator completed with the result above. Repository tests and build results are recorded here after the required validation commands run.
`;
}

function main() {
  const inputs = readInputs();
  const before = readProduction();
  let validation;
  try {
    validation = validateInputs(inputs, before);
    const readyIds = inputs.patch.filter(item => validation.states.get(item.conceptId) === 'READY_TO_APPLY').map(item => item.conceptId);
    const alreadyIds = inputs.patch.filter(item => validation.states.get(item.conceptId) === 'ALREADY_APPLIED').map(item => item.conceptId);
    buildFinalQa();
    const after = readProduction();
    assertSynchronized(after, inputs.patch);
    assertNoUnrelatedChanges(before, after, validation.patchIds);
    assert.deepEqual(counts(after.records, 'evidenceStatus'), EXPECTED_COUNTS, 'post-integration evidence class counts');
    assert.equal(after.records.length, TOTAL);
    assert.deepEqual(validation.keepIds.map(id => byId(after.records).get(id).vietnamese), inputs.checked.filter(item => item.decision === 'KEEP').map(item => item.oldVietnamese), 'KEEP values remain unchanged');
    writeReport(buildReport({inputs, result: validation, after, appliedIds: readyIds, alreadyAppliedIds: alreadyIds}));
    console.log(JSON.stringify({patchRecords: inputs.patch.length, patchesApplied: readyIds.length, alreadyApplied: alreadyIds.length, keepRecords: inputs.checked.filter(item => item.decision === 'KEEP').length, driftConflicts: 0, unknownIds: 0, beforeCounts: validation.beforeCounts, afterCounts: counts(after.records, 'evidenceStatus'), sourceSensitiveStillProvisional: inputs.sourceSensitive.length}, null, 2));
  } catch (error) {
    const fallback = validation ?? {beforeCounts: counts(before.records, 'evidenceStatus')};
    writeReport(buildReport({inputs, result: fallback, after: null, appliedIds: [], alreadyAppliedIds: [], driftConflicts: [error.message], error}));
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();

export {validateInputs, assertNoUnrelatedChanges};
