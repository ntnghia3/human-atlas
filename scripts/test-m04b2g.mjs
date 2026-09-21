import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assessLocalizationRow, normalizeVietnameseForAgreement, safeEnglish} from './m04b2g-closure.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2g');
const CORPORA = join(ROOT, 'data', 'terminology', 'research', 'corpora');
const ALLOWED = new Set([
  'MULTI_AUTHORITY_AGREEMENT',
  'DIRECT_AUTHORITY_TRANSLATION',
  'AUTHORITY_VARIANT',
  'SOURCE_CONFLICT',
  'CONTROLLED_DERIVED_TRANSLATION',
  'SCOPE_REVIEW',
  'IDENTITY_REVIEW',
  'NO_DIRECT_AUTHORITY_ATTESTATION',
]);
const json = name => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
const jsonl = path => readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const sha256File = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const atlas = JSON.parse(readFileSync(join(ROOT, 'public', 'models', 'atlas.json'), 'utf8'));
const byName = new Map();
for (const concept of atlas.concepts) {
  const key = safeEnglish(concept.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(concept);
}
const summary = json('closure-summary.json');
const manifest = json('run-manifest.json');
const decisions = jsonl(join(DIR, 'concept-decisions.jsonl'));
const claims = jsonl(join(DIR, 'translation-claims.jsonl'));
const unresolved = jsonl(join(DIR, 'unresolved-review.jsonl'));
const sourceContribution = json('source-contribution.json');
const registry = json('derivation-rules.json');

const failures = [];
function check(name, condition, detail = '') {
  if (condition) console.log(`PASS ${name}`);
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

check('exactly 3,432 concept decisions', decisions.length === 3432);
const atlasIds = atlas.concepts.map(concept => concept.id);
const decisionIds = decisions.map(decision => decision.conceptId);
check('every atlas ID exactly once', decisionIds.length === new Set(decisionIds).size && new Set(decisionIds).size === new Set(atlasIds).size && atlasIds.every(id => decisionIds.includes(id)));
check('unclassified = 0', summary.unclassifiedConcepts === 0 && decisions.every(decision => ALLOWED.has(decision.terminalDisposition)));

check('direct Vietnamese claims have source provenance', claims.length > 0 && claims.every(claim => claim.claimType === 'DIRECT_AUTHORITY_TRANSLATION' && claim.sourceVietnameseRaw && claim.sourceId && claim.sourceRevision && Array.isArray(claim.provenance) && claim.provenance.length > 0 && claim.provenance.every(ref => ref.rawFingerprint && ref.sourceId && ref.sourceRevision)));
check('derived claims have component provenance and rule ID', decisions.flatMap(decision => decision.derivedClaims).every(claim => claim.claimType === 'CONTROLLED_DERIVED_TRANSLATION' && claim.compositionRuleId && Array.isArray(claim.baseEvidence) && Array.isArray(claim.modifierEvidence)));
check('derived terms are never labeled direct', decisions.flatMap(decision => decision.derivedClaims).every(claim => claim.claimType !== 'DIRECT_AUTHORITY_TRANSLATION') && claims.every(claim => claim.claimType !== 'CONTROLLED_DERIVED_TRANSLATION'));

const approvedNvh = jsonl(join(CORPORA, 'm04b2e2r-nvh2008-exhaustive.jsonl')).filter(row => row.context === 'EXACT_RECONSTRUCTED_SOURCE_ROW');
const approvedNvhFingerprints = new Set(approvedNvh.map(row => createHash('sha256').update(JSON.stringify(row)).digest('hex')));
const nvhBulk = jsonl(join(CORPORA, 'nvh2008-bulk.jsonl'));
const nvhClaims = claims.filter(claim => claim.sourceId === 'NVH2008');
check('quarantined NVH rows cannot re-enter', nvhClaims.every(claim => claim.provenance.every(ref => ref.sourcePath.endsWith('m04b2e2r-nvh2008-exhaustive.jsonl') && approvedNvhFingerprints.has(ref.rawFingerprint))) && nvhBulk.length > approvedNvh.length);

const mohRows = jsonl(join(CORPORA, 'm04b2e2r-moh2025-body-structure.jsonl'));
const mohCounts = {exactLocalizationIdentityMatch: 0, exactSynonymLocalizationMatch: 0, scopeBlocked: 0, lateralityBlocked: 0, multipleAtlasTargets: 0, noAtlasIdentity: 0, acceptedDirectCandidate: 0};
const mohMatchMethods = {exactLocalizationIdentityMatch: 0, exactSynonymLocalizationMatch: 0};
let mohAccepted = 0;
for (const row of mohRows) {
  const assessment = assessLocalizationRow(row, byName, {moh: true});
  if (assessment.status === 'ACCEPTED_DIRECT_CANDIDATE') {
    mohCounts.acceptedDirectCandidate += 1;
    mohAccepted += 1;
  } else {
    assert.ok(Object.hasOwn(mohCounts, assessment.category), `unknown MOH category ${assessment.category}`);
    mohCounts[assessment.category] += 1;
  }
  if (assessment.category === 'exactLocalizationIdentityMatch' || assessment.category === 'exactSynonymLocalizationMatch') mohMatchMethods[assessment.category] += 1;
}
check('all 1,506 MOH rows accounted once', mohRows.length === 1506 && Object.values(mohCounts).reduce((sum, value) => sum + value, 0) === 1506 && JSON.stringify(mohCounts) === JSON.stringify(summary.mohContribution.categories) && JSON.stringify(mohMatchMethods) === JSON.stringify(summary.mohContribution.matchMethods) && mohAccepted === summary.mohContribution.acceptedDirectCandidate && summary.mohContribution.accountingRowCount === 1506 && summary.mohContribution.uniqueAccountingRows === 1506 && summary.mohContribution.accountingRowDigest);

const syntheticExact = {english: {preferred: 'Frontal bone', aliases: []}, vietnamese: {preferred: 'Xương trán'}, laterality: 'unsided'};
const syntheticWrapper = {english: {preferred: 'Frontal bone (body structure)', aliases: []}, vietnamese: {preferred: 'Xương trán'}, laterality: 'unsided'};
const syntheticEntire = {english: {preferred: 'Entire frontal bone (body structure)', aliases: ['frontal bone']}, vietnamese: {preferred: 'Toàn bộ xương trán'}, laterality: 'unsided'};
const syntheticStructure = {english: {preferred: 'Frontal bone structure (body structure)', aliases: ['frontal bone']}, vietnamese: {preferred: 'Cấu trúc xương trán'}, laterality: 'unsided'};
const syntheticAtlasPrefix = {english: {preferred: 'Frontal bone', aliases: []}, vietnamese: {preferred: 'Xương trán'}, context: 'ATLAS_PREFIX_RECONSTRUCTED'};
check('MOH exact English localization does not require UMLS', assessLocalizationRow(syntheticExact, byName, {moh: true}).status === 'ACCEPTED_DIRECT_CANDIDATE' && assessLocalizationRow(syntheticExact, byName, {moh: true}).identityMethod === 'EXACT_ENGLISH');
check('generic body structure wrapper is permitted', assessLocalizationRow(syntheticWrapper, byName, {moh: true}).status === 'ACCEPTED_DIRECT_CANDIDATE');
check('actual SEP/scope qualifiers block unsafe matches', assessLocalizationRow(syntheticEntire, byName, {moh: true}).status === 'SCOPE_BLOCKED' && assessLocalizationRow(syntheticStructure, byName, {moh: true}).status === 'SCOPE_BLOCKED');
check('parser-generated or atlas-prefix rows cannot become direct claims', assessLocalizationRow(syntheticAtlasPrefix, byName, {moh: true}).status === 'PARSER_BLOCKED');

const conflictDecisions = decisions.filter(decision => decision.terminalDisposition === 'SOURCE_CONFLICT');
check('no automatic conflict winner', conflictDecisions.length > 0 && conflictDecisions.every(decision => decision.preferredTerm === null && decision.conflicts.length > 1));
check('no majority vote', summary.policy.noMajorityOrAgeWinner === true && decisions.every(decision => decision.preferredTerm === null));
check('no source-age winner', summary.policy.noMajorityOrAgeWinner === true && claims.every(claim => !Object.hasOwn(claim, 'winner')));
check('no accent folding for Vietnamese agreement', normalizeVietnameseForAgreement('Động mạch') !== normalizeVietnameseForAgreement('Dong mach') && normalizeVietnameseForAgreement('Dây-chằng') === normalizeVietnameseForAgreement('Dây - chằng'));
check('no AI-generated translation', manifest.policy.aiTranslation === false && manifest.determinism.noAiGeneration === true && claims.every(claim => claim.derivationMethod === null));
check('no uncontrolled laterality synthesis', registry.derivedClaimsEmitted === 0 && decisions.every(decision => decision.derivedClaims.length === 0));
check('no production promotion', manifest.productionSafety.searchableVietnamese === 0 && manifest.productionSafety.sourceVerified === 0 && manifest.productionSafety.medicallyReviewed === 0 && manifest.productionSafety.releaseEligible === 0 && manifest.productionSafety.release === 'UNRELEASED' && decisions.every(decision => decision.releaseEligible === false));

const productionFiles = ['data/terminology/entries.json', 'data/terminology/reviewers.json', 'data/terminology/release.json'];
check('production file hashes unchanged', productionFiles.every(relative => manifest.productionHashes[relative] === sha256File(join(ROOT, relative))));
check('research output hashes match manifest', Object.entries(manifest.outputHashes ?? {}).every(([relative, hash]) => hash === sha256File(join(ROOT, relative))));
check('source contribution records NVH and MOH boundaries', sourceContribution.sources.some(source => source.sourceId === 'NVH2008' && source.inputRows === 430 && source.approvedRows === 430) && sourceContribution.sources.some(source => source.sourceId === 'NATIONAL_BODY_TERMS_2025' && source.inputRows === 1506));
check('terminal outputs retain no preferred term', decisions.every(decision => decision.preferredTerm === null));
check('unresolved review is terminal-only', unresolved.every(item => ALLOWED.has(item.terminalDisposition)));

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS M04B2G: ${18} required controls plus structural checks`);
}
