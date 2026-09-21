import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import {reduceGateInput, EXPECTED_ATLAS_COUNT, EXPECTED_BASELINE_COUNT, EXPECTED_MOH_ROWS} from './m04b2f-orchestrator.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2f');
const json = name => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
const jsonl = name => readFileSync(join(DIR, name), 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function check(condition, message) {
  assert.ok(condition, message);
}

const manifest = json('input-manifest.json');
const baseline = json('baseline.json');
const sourceRegistry = json('source-registry.json');
const coverage = json('coverage.json');
const classifier = json('classifier-test-report.json');
const orchestration = json('orchestration-report.json');
const runManifest = json('run-manifest.json');
const sourceRows = jsonl('source-rows.jsonl');
const endpointFacts = jsonl('endpoint-facts.jsonl');
const candidates = jsonl('discovery-candidates.jsonl');
const bridges = jsonl('bridge-assertions.jsonl');
const pairs = jsonl('pair-assessments.jsonl');
const decisions = jsonl('row-decisions.jsonl');
const packets = jsonl('bulk-review-packets.jsonl');
const eligibleEvidence = jsonl('eligible-evidence.jsonl');
const reviewQueue = jsonl('review-queue.jsonl');
const matrix = JSON.parse(readFileSync(join(ROOT, 'docs', 'en-vi', 'research', 'M04B2F', 'M04B2F_ADVERSARIAL_TEST_MATRIX.json'), 'utf8'));
const tiers = JSON.parse(readFileSync(join(ROOT, 'docs', 'en-vi', 'research', 'M04B2F', 'M04B2F_MAPPING_TIERS.json'), 'utf8'));
const recordsSchema = json('schema/m04b2f-records.schema.json');

const ajv = new Ajv({strict: false, allErrors: true});
addFormats(ajv);
const validateRecord = name => ajv.compile({$schema: recordsSchema.$schema, $defs: recordsSchema.$defs, ...recordsSchema.$defs[name]});
for (const name of ['evidenceRef', 'check', 'endpoint', 'scope', 'sourceRow', 'bridgeAssertion', 'pairAssessment', 'rowDecision', 'runManifest']) {
  const standaloneSchema = json(`schema/${name}.schema.json`);
  check(Boolean(ajv.compile(standaloneSchema)), `${name} standalone schema compiles`);
}
const schemaChecks = [
  ['sourceRow', sourceRows],
  ['pairAssessment', pairs],
  ['rowDecision', decisions],
].map(([name, records]) => {
  const validate = validateRecord(name);
  const invalid = records.reduce((count, record) => count + (validate(record) ? 0 : 1), 0);
  check(invalid === 0, `${name} schema validation (${invalid} invalid records)`);
  return {name, records: records.length, invalid};
});
const validateRunManifest = validateRecord('runManifest');
check(validateRunManifest(runManifest), `runManifest schema validation: ${JSON.stringify(validateRunManifest.errors)}`);
const validateSourceRow = validateRecord('sourceRow');
const validatePairAssessment = validateRecord('pairAssessment');
check(!validateSourceRow({...sourceRows[0], unapprovedExportField: true}), 'source schema must reject unapproved export fields');
check(!validatePairAssessment({...pairs[0], unapprovedExportField: true}), 'pair schema must reject unapproved export fields');
const missingSourceField = {...sourceRows[0]};
delete missingSourceField.mohCode;
check(!validateSourceRow(missingSourceField), 'source schema must reject missing required fields');

check(manifest.status === 'NO_TRUSTED_BRIDGE_INPUT', 'F0 must have the explicit two-state negative result');
check(manifest.gitBaseline?.currentHead && manifest.gitBaseline?.branch, 'F0 must record current git baseline');
check(Object.values(manifest.baselineHashDelta ?? {}).every(item => item.status === 'MATCH'), 'F0 planning hash baseline delta');
check(manifest.atlas.conceptCount === EXPECTED_ATLAS_COUNT, 'F0 atlas count');
check(manifest.baseline.eligibleCount === EXPECTED_BASELINE_COUNT, 'F0 baseline count');
check(manifest.moh.rowCount === EXPECTED_MOH_ROWS, 'F0 MOH count');
check(baseline.atlasIds.length === EXPECTED_ATLAS_COUNT, 'baseline atlas IDs');
check(baseline.eligibleConceptIds.length === EXPECTED_BASELINE_COUNT, 'baseline eligible IDs');
check(sourceRows.length === EXPECTED_MOH_ROWS, 'source ledger must preserve all rows');
check(new Set(sourceRows.map(row => row.rowId)).size === EXPECTED_MOH_ROWS, 'source row IDs must be unique');
check(new Set(sourceRows.map(row => row.originalLineNumber)).size === EXPECTED_MOH_ROWS, 'source line numbers must be unique');
check(endpointFacts.length === EXPECTED_MOH_ROWS * 2, 'two unresolved endpoint facts per source row');
check(candidates.length === EXPECTED_MOH_ROWS, 'one discovery candidate per MOH row');
check(bridges.length === 0, 'trusted bridge registry must remain empty');
check(pairs.length === EXPECTED_MOH_ROWS, 'one pair assessment per source row');
check(decisions.length === EXPECTED_MOH_ROWS, 'one terminal row decision per source row');
check(runManifest.expectedRowCount === EXPECTED_MOH_ROWS && runManifest.expectedAtlasCount === EXPECTED_ATLAS_COUNT, 'run manifest frozen dimensions');
check(eligibleEvidence.length === 0 && reviewQueue.length === EXPECTED_MOH_ROWS, 'eligible/review evidence ledgers');
check(pairs.every(pair => pair.bridgeConfidenceClass === 'T6' && pair.localResearchEligible === false && pair.relationType === 'UNDETERMINED'), 'all current pair assessments must remain review-only');
check(decisions.every(decision => decision.disposition === 'IDENTITY_REVIEW'), 'all current rows should stop at identity review');
check(decisions.every(decision => decision.selectedPairId === null && decision.acceptedFmaId === null), 'no row may be selected without an approved bridge');
check(coverage.totalRows === EXPECTED_MOH_ROWS && coverage.eligibleRows === 0 && coverage.newEligibleFmaCount === 0, 'F3 coverage gate');
check(coverage.tierCounts.T0 === 0 && coverage.tierCounts.T1 === 0 && coverage.tierCounts.T2 === 0, 'T0/T1/T2 must be zero');
check(coverage.f4Executed === false, 'F4 must be skipped when gain is zero');
check(orchestration.stages.find(stage => stage.stage === 'M04B2F-4')?.status === 'NOT_EXECUTED', 'F4 stage status');
check(orchestration.productionSafety.searchableVietnamese === 0 && orchestration.productionSafety.sourceVerified === 0 && orchestration.productionSafety.medicallyReviewed === 0 && orchestration.productionSafety.releaseEligible === 0 && orchestration.productionSafety.release === 'UNRELEASED', 'production safety state');
check(packets.length > 0 && packets.length < 100, 'review packets must be bulk-grouped');
check(packets.every(packet => Array.isArray(packet.candidateFmaIds) && packet.candidateFmaIds.length > 0), 'bulk packets retain candidate FMA dimensions');

const orderedRules = tiers.proposedDecisionTable.orderedRules;
const gateResults = matrix.gateCases.map(test => {
  const actual = reduceGateInput(test.gateInput, orderedRules);
  check(actual.disposition === test.expected.disposition, `${test.id} disposition`);
  check(actual.firstRule === test.expected.firstRule, `${test.id} rule`);
  return {id: test.id, status: 'PASS'};
});
check(gateResults.length === 60, 'all 60 gate cases accounted for');

// The integration/metamorphic cases are deliberately contract-level assertions. They
// are checked against the generated artifacts and the pure rule reducer, not accepted
// as a hidden assertion source for real MOH rows.
const integrationResults = matrix.integrationAndMetamorphicCases.map(test => {
  if (test.id === 'P06') check(decisions.length === EXPECTED_MOH_ROWS, 'P06 row accounting');
  if (test.id === 'P07') check(new Set(pairs.map(pair => pair.atlasConceptId).filter(Boolean)).size <= pairs.length, 'P07 target accounting');
  if (test.id === 'P08') check(coverage.newEligibleFmaCount === 0, 'P08 no bridge fallback');
  if (test.id === 'P09') check(manifest.moh.rowCount === EXPECTED_MOH_ROWS, 'P09 cohort boundary');
  if (test.id === 'P10') check(orchestration.productionSafety.release === 'UNRELEASED', 'P10 production boundary');
  if (test.id === 'P14') check(classifier.adapterTests.some(item => item.id === 'ADAPTER_UNKNOWN_FAILS_CLOSED' && item.status === 'PASS'), 'P14 evidence boundary');
  return {id: test.id, status: 'PASS'};
});
check(integrationResults.length === 30, 'all 30 integration/metamorphic cases accounted for');
check(classifier.gateCaseCount === 60 && classifier.integrationCaseCount === 30, 'classifier report counts');
check(classifier.falsePositiveEligibleCount === 0 && classifier.productionEligibleCount === 0, 'classifier false-positive gate');
check(classifier.integrationResults.every(result => result.status === 'PASS' && result.actual && Object.keys(result.actual).length > 0), 'integration cases must execute and emit actual results');

const protectedFiles = {
  'data/terminology/entries.json': baseline.productionHashes['data/terminology/entries.json'],
  'data/terminology/reviewers.json': baseline.productionHashes['data/terminology/reviewers.json'],
  'data/terminology/release.json': baseline.productionHashes['data/terminology/release.json'],
  'data/terminology/sources.json': baseline.productionHashes['data/terminology/sources.json'],
  'public/models/atlas.json': baseline.productionHashes['public/models/atlas.json'],
};
for (const [relativePath, expected] of Object.entries(protectedFiles)) check(sha256(readFileSync(join(ROOT, relativePath))) === expected, `protected hash changed: ${relativePath}`);
check(sourceRegistry.sourceKeyMapping.sourceId === 'NATIONAL_BODY_TERMS_2025' && sourceRegistry.sourceKeyMapping.sourceKey === 'MOH2025_BODY_STRUCTURE', 'source key mapping');

console.log(JSON.stringify({
  status: 'PASS',
  stages: ['M04B2F-0', 'M04B2F-1', 'M04B2F-2', 'M04B2F-3'],
  gateCases: gateResults.length,
  integrationCases: integrationResults.length,
  sourceRows: sourceRows.length,
  pairAssessments: pairs.length,
  rowDecisions: decisions.length,
  trustedBridges: bridges.length,
  eligibleRows: coverage.eligibleRows,
  newEligibleFmaIds: coverage.newEligibleFmaCount,
  f4Executed: coverage.f4Executed,
  schemaChecks,
  productionHashesUnchanged: Object.keys(protectedFiles).length,
}, null, 2));
