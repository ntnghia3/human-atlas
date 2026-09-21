import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeVietnameseForAgreement, safeEnglish} from './m04b2g-closure.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2h');
const G2_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2g');
const ALLOWED_DISPOSITIONS = new Set([
  'DIRECT_SOURCE_TRANSLATION',
  'MULTI_AUTHORITY_TRANSLATION',
  'CONTROLLED_DERIVED_TRANSLATION',
  'SOURCE_VARIANT',
  'SOURCE_CONFLICT',
  'SCOPE_REVIEW',
  'NO_SAFE_TRANSLATION_CANDIDATE',
]);
const ALLOWED_CANDIDATE_TYPES = new Set(['DIRECT_SOURCE', 'MULTI_AUTHORITY', 'CONTROLLED_DERIVED']);
const json = name => JSON.parse(readFileSync(join(DIR, name), 'utf8'));
const jsonl = path => readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const sha256File = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const atlas = JSON.parse(readFileSync(join(ROOT, 'public', 'models', 'atlas.json'), 'utf8'));
const summary = json('coverage-summary.json');
const manifest = json('run-manifest.json');
const rules = json('composition-rules.json');
const lexicon = json('authority-component-lexicon.json');
const concepts = jsonl(join(DIR, 'concept-candidates.jsonl'));
const direct = jsonl(join(DIR, 'direct-candidates.jsonl'));
const derived = jsonl(join(DIR, 'derived-candidates.jsonl'));
const residual = jsonl(join(DIR, 'residual.jsonl'));
const g2Claims = jsonl(join(G2_DIR, 'translation-claims.jsonl'));
const g2Decisions = jsonl(join(G2_DIR, 'concept-decisions.jsonl'));

const failures = [];
function check(name, condition, detail = '') {
  if (condition) console.log(`PASS ${name}`);
  else failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const atlasIds = atlas.concepts.map(concept => concept.id);
const conceptIds = concepts.map(record => record.conceptId);
const g2ClaimIds = new Set(g2Claims.map(claim => claim.claimId));
const g2ConflictIds = new Set(g2Decisions.filter(decision => decision.terminalDisposition === 'SOURCE_CONFLICT').map(decision => decision.conceptId));
const derivedByConcept = new Map(derived.map(candidate => [candidate.conceptId, candidate]));
const directByConcept = new Map();
for (const candidate of direct) {
  if (!directByConcept.has(candidate.conceptId)) directByConcept.set(candidate.conceptId, []);
  directByConcept.get(candidate.conceptId).push(candidate);
}

check('exactly 3,432 concepts processed', concepts.length === 3432 && summary.processedConcepts === 3432);
check('every atlas concept appears exactly once', conceptIds.length === new Set(conceptIds).size && atlasIds.length === new Set(atlasIds).size && atlasIds.every(id => conceptIds.includes(id)));
check('zero unclassified dispositions', summary.unclassifiedConcepts === 0 && concepts.every(record => ALLOWED_DISPOSITIONS.has(record.candidateDisposition)));
check('disposition counts reconcile', Object.values(summary.dispositionCounts).reduce((sum, count) => sum + count, 0) === 3432 && Object.entries(summary.dispositionCounts).every(([disposition, count]) => concepts.filter(record => record.candidateDisposition === disposition).length === count));
check('all candidates have required safety fields', [...direct, ...derived].every(candidate => candidate.conceptId && candidate.atlasEnglish && candidate.vietnamese && ALLOWED_CANDIDATE_TYPES.has(candidate.candidateType) && Array.isArray(candidate.sourceClaims) && Array.isArray(candidate.componentEvidence) && Array.isArray(candidate.blockers) && Array.isArray(candidate.provenance) && candidate.productionEligible === false));
check('direct and derived candidate types stay separate', direct.every(candidate => candidate.candidateType !== 'CONTROLLED_DERIVED' && candidate.compositionRuleId === null) && derived.every(candidate => candidate.candidateType === 'CONTROLLED_DERIVED' && candidate.compositionRuleId));
check('concept candidate buckets remain separate', concepts.every(record => record.directCandidates.every(candidate => candidate.candidateType !== 'CONTROLLED_DERIVED') && record.derivedCandidates.every(candidate => candidate.candidateType === 'CONTROLLED_DERIVED')));
check('direct source claims resolve to approved M04B2G claims or explicit localization evidence', direct.filter(candidate => !candidate.localizationDisposition).every(candidate => candidate.sourceClaims.every(claimId => g2ClaimIds.has(claimId))) && direct.filter(candidate => candidate.localizationDisposition === 'DIRECT_LOCALIZATION_CANDIDATE').every(candidate => candidate.sourceClaims.every(claimId => claimId.startsWith('NATIONAL_BODY_TERMS_2025:'))));
check('derived source claims resolve to direct evidence', derived.every(candidate => candidate.sourceClaims.every(claimId => g2ClaimIds.has(claimId)) && candidate.componentEvidence.every(component => component.sourceEvidenceIds.every(claimId => g2ClaimIds.has(claimId)))));
check('derived candidates have rule provenance', derived.length > 0 && derived.every(candidate => candidate.provenance.some(ref => ref.ruleId === candidate.compositionRuleId && ref.ruleVersion === candidate.compositionRuleVersion && ref.assertion === 'CONTROLLED_SOURCE_DEMONSTRATED_COMPOSITION')));
check('derived candidates have component evidence', derived.every(candidate => candidate.componentEvidence.length >= 2 && candidate.derivedFromConceptIds?.length === 1 && candidate.sourceDependencies?.length > 0));
check('source conflicts never receive derived winners', [...g2ConflictIds].every(conceptId => !derivedByConcept.has(conceptId)) && concepts.filter(record => record.candidateDisposition === 'SOURCE_CONFLICT').every(record => record.derivedCandidates.length === 0));
check('all derived Vietnamese tokens are authority observed', (() => {
  const authorityTokens = new Set();
  const tokenise = value => normalizeVietnameseForAgreement(value).toLocaleLowerCase('vi').replace(/[()[\],;:.]/g, ' ').replace(/[-–—]/g, ' ').split(/\s+/).filter(Boolean);
  for (const component of lexicon.components) for (const value of component.vietnameseRealizations ?? []) for (const token of tokenise(value)) authorityTokens.add(token);
  for (const candidate of derived) for (const token of tokenise(candidate.vietnamese)) if (!/^\d+$/.test(token) && !authorityTokens.has(token)) return false;
  return true;
})());
check('all composition rules report contribution counters', rules.rules.length >= 4 && rules.rules.every(rule => rule.ruleId && rule.ruleVersion && Array.isArray(rule.sourceExamples) && Array.isArray(rule.requiredComponents) && rule.outputTemplate && Array.isArray(rule.disqualifiers) && Number.isInteger(rule.minimumEvidenceCount) && Array.isArray(rule.tests) && Number.isInteger(rule.conceptsEvaluated) && Number.isInteger(rule.conceptsAccepted) && Number.isInteger(rule.conceptsRejected) && rule.conceptsAccepted + rule.conceptsRejected === rule.conceptsEvaluated));
check('scope localization gate is explicit and conservative', summary.after.directLocalizationConcepts === 77 && summary.after.scopeReviewConcepts === 522 && concepts.filter(record => record.localizationReview).length === 77 && concepts.filter(record => record.localizationReview).every(record => record.candidateDisposition === 'DIRECT_SOURCE_TRANSLATION' && record.blockers.length === 0 && record.localizationReview.previousBlockers.length === 1 && record.localizationReview.previousBlockers[0] === 'SCOPE_QUALIFIER_STRUCTURE'));
check('genuine scope and laterality mismatches remain blocked', ['FMA3818', 'FMA7131', 'FMA50330', 'FMA50337'].every(conceptId => concepts.find(record => record.conceptId === conceptId)?.candidateDisposition === 'SCOPE_REVIEW'));
check('production promotion remains disabled', summary.productionSafety.searchableVietnamese === 0 && summary.productionSafety.sourceVerified === 0 && summary.productionSafety.medicallyReviewed === 0 && summary.productionSafety.releaseEligible === 0 && summary.productionSafety.release === 'UNRELEASED' && [...direct, ...derived].every(candidate => candidate.productionEligible === false));
check('policy forbids AI/web/UMLS/ontology/majority/age synthesis', summary.policy.aiTranslation === false && summary.policy.webTerminologySearch === false && summary.policy.umls === false && summary.policy.ontologyMapping === false && summary.policy.noMajorityVoting === true && summary.policy.noNewestSourceWinner === true && summary.policy.noUncontrolledLaterality === true);
check('adversarial rule cases are registered', ['ADV-RIGHT-LEFT', 'ADV-SUPERIOR-INFERIOR', 'ADV-ANTERIOR-POSTERIOR', 'ADV-MEDIAL-LATERAL', 'ADV-INTERNAL-EXTERNAL', 'ADV-NUMBERING', 'ADV-BRANCH', 'ADV-PART-WHOLE', 'ADV-AGGREGATE', 'ADV-WORD-ORDER'].every(id => rules.adversarialTests.some(test => test.id === id)));
check('medial/lateral and internal/external remain disabled', rules.disabledFamilies.some(item => item.family === 'medial/lateral') && rules.disabledFamilies.some(item => item.family === 'internal/external') && !derived.some(candidate => /^(medial|lateral|internal|external)\s/i.test(candidate.atlasEnglish)));
check('hard-blacklisted structures are not derived', !derived.some(candidate => /\b(branch|segment|part|region|group|set|tributary|lobule|fascia|root|ramus|eponym|entire|structure|aggregate|compound)\b/i.test(candidate.atlasEnglish)));
check('numbering remains limited to observed ordinal rule', derived.filter(candidate => /^(third|fourth)\s/i.test(candidate.atlasEnglish)).every(candidate => candidate.compositionRuleId === 'M04B2H-ORDINAL-SUFFIX-001'));
check('research outputs and report exist', ['authority-component-lexicon.json', 'composition-rules.json', 'direct-candidates.jsonl', 'derived-candidates.jsonl', 'concept-candidates.jsonl', 'residual.jsonl', 'coverage-summary.json', 'run-manifest.json'].every(name => existsSync(join(DIR, name))) && existsSync(join(ROOT, 'docs', 'en-vi', 'M04B2H_CONTROLLED_TRANSLATION_EXPANSION_REPORT.md')));
check('production file hashes are unchanged', ['data/terminology/entries.json', 'data/terminology/reviewers.json', 'data/terminology/release.json'].every(relative => manifest.productionHashes?.[relative] === sha256File(join(ROOT, relative))));
check('output hashes match run manifest', Object.entries(manifest.outputHashes ?? {}).every(([relative, hash]) => hash === sha256File(join(ROOT, relative))));
check('summary gains and percentages reconcile', summary.after.candidateGainOverM04B2G === summary.after.conceptsWithAnyVietnameseCandidate - summary.before.m04b2gCandidateConcepts && summary.after.usableGainOverDirect === summary.after.conceptsWithUsableCandidate - summary.before.m04b2gDirectSourceAttestedConcepts && summary.after.coveragePercentage === Number(((summary.after.conceptsWithAnyVietnameseCandidate / 3432) * 100).toFixed(2)) && summary.after.usableCoveragePercentage === Number(((summary.after.conceptsWithUsableCandidate / 3432) * 100).toFixed(2)));
check('residual contains only blocked dispositions', residual.every(record => ['SCOPE_REVIEW', 'SOURCE_CONFLICT', 'NO_SAFE_TRANSLATION_CANDIDATE'].includes(record.residualDisposition)) && residual.every(record => record.productionEligible === false));

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS M04B2H: 25 required controls plus structural and adversarial checks`);
}
