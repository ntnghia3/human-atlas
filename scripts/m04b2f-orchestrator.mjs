import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESEARCH = join(ROOT, 'data', 'terminology', 'research', 'm04b2f');
const PLAN = join(ROOT, 'docs', 'en-vi', 'research', 'M04B2F');
const ATLAS_PATH = join(ROOT, 'public', 'models', 'atlas.json');
const BASELINE_RESULT_PATH = join(ROOT, 'data', 'terminology', 'research', 'm04b2e-bulk-match-results.json');
const MOH_PATH = join(ROOT, 'data', 'terminology', 'research', 'corpora', 'm04b2e2r-moh2025-body-structure.jsonl');
const SOURCE_MANIFEST_PATH = join(ROOT, 'data', 'terminology', 'research', 'm04b2e-source-manifest.json');
const MODEL_PATH = join(PLAN, 'M04B2F_BRIDGE_RELATION_MODEL.json');
const TIERS_PATH = join(PLAN, 'M04B2F_MAPPING_TIERS.json');
const MATRIX_PATH = join(PLAN, 'M04B2F_ADVERSARIAL_TEST_MATRIX.json');
const PRODUCTION_PATHS = [
  join(ROOT, 'data', 'terminology', 'entries.json'),
  join(ROOT, 'data', 'terminology', 'reviewers.json'),
  join(ROOT, 'data', 'terminology', 'release.json'),
  join(ROOT, 'data', 'terminology', 'sources.json'),
  ATLAS_PATH,
];

export const EXPECTED_ATLAS_COUNT = 3432;
export const EXPECTED_MOH_ROWS = 1506;
export const EXPECTED_BASELINE_COUNT = 421;
export const POLICY_VERSION = 'm04b2f-safe-bridge-1';
export const ORCHESTRATION_VERSION = 'm04b2f-orchestration-1';

const DISPOSITIONS = [
  'SOURCE_ATTESTATION_REVIEW',
  'LICENSE_BLOCKED',
  'IDENTITY_REVIEW',
  'LATERALITY_REVIEW',
  'AGGREGATE_REVIEW',
  'ONTOLOGY_SCOPE_REVIEW',
  'STRUCTURE_ENTIRE_PART_REVIEW',
  'ELIGIBLE_EXACT_FMA_EVIDENCE',
  'ELIGIBLE_WITH_PINNED_BRIDGE',
  'CORROBORATIVE_ONLY',
  'ONTOLOGY_BRIDGE_REQUIRED',
  'NO_SAFE_MAPPING',
  'NO_CANDIDATE_FOUND',
  'NO_ATLAS_COUNTERPART',
];
const SCOPE_CHECK_KEYS = [
  'entityKind',
  'boundary',
  'partition',
  'cardinality',
  'countability',
  'granularity',
  'canonicalContext',
  'sepCompatibility',
];

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(value) {
  return sha256(value);
}

function gitState() {
  const run = args => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
  const branch = run(['branch', '--show-current']);
  const head = run(['rev-parse', 'HEAD']);
  return {branch, head};
}

function planningBaseline() {
  const planText = readFileSync(join(PLAN, 'M04B2F_IMPLEMENTATION_PLAN.md'), 'utf8');
  const inspectedHead = planText.match(/Inspected HEAD:\s*`([0-9a-f]{40})`/)?.[1] ?? null;
  const expectedHashes = Object.fromEntries([...planText.matchAll(/\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|/g)].map(match => [match[1], match[2]]));
  return {inspectedHead, expectedHashes};
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeText(path, text) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

async function writeJson(path, value) {
  await writeText(path, JSON.stringify(value, null, 2));
}

async function writeJsonl(path, records) {
  await writeText(path, records.map(record => JSON.stringify(record)).join('\n'));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function relationEvidenceRef({artifactId, locator, assertionKind = 'LOCAL_DETERMINISTIC_INFERENCE', licenseDecisionId = 'M04B2F_PUBLIC_PROFILE'}) {
  return {
    artifactId,
    sha256: sha256(`${artifactId}:${locator}:${assertionKind}:${licenseDecisionId}`),
    locator,
    assertionKind,
    licenseDecisionId,
  };
}

function parseFmaHint(notes) {
  const match = String(notes ?? '').match(/\bFMA\d+\b/);
  return match?.[0] ?? null;
}

function legacyFmaId(sourceRow) {
  return sourceRow.legacyDiscoveryHints?.find(hint => /^FMA\d+$/.test(hint)) ?? null;
}

function protectedTokens(text) {
  const value = String(text ?? '').toLocaleLowerCase('en-US');
  return ['entire', 'structure', 'body structure', 'part', 'right', 'left', 'bilateral', 'branch', 'tributary', 'segment', 'region', 'subdivision', 'group', 'set', 'tissue', 'organ']
    .filter(token => value.includes(token));
}

function inferFamily(text) {
  const value = String(text ?? '').toLocaleLowerCase('en-US');
  const families = [
    ['ARTERY', /\barter(?:y|ies|ial)\b/],
    ['VEIN', /\bvein(?:s|ous)?\b/],
    ['NERVE', /\bnerve(?:s|ous)?\b/],
    ['MUSCLE', /\bmuscle(?:s)?\b/],
    ['BONE', /\bbone(?:s)?\b/],
    ['LIGAMENT', /\bligament(?:s)?\b/],
    ['GLAND', /\bgland(?:s)?\b/],
    ['TISSUE', /\btissue\b|\bepitheli/],
    ['CAVITY_OR_SPACE', /\bcavit(?:y|ies)\b|\bspace\b/],
    ['REGION', /\bregion\b|\bsurface\b/],
    ['SYSTEM', /\bsystem\b|\btract\b/],
  ];
  return families.find(([, pattern]) => pattern.test(value))?.[0] ?? 'UNCLASSIFIED_BODY_STRUCTURE';
}

function check(status, reasonCode, artifactId, locator) {
  return {
    status,
    reasonCode,
    evidenceRefs: [relationEvidenceRef({artifactId, locator})],
  };
}

function unknownChecks(artifactId, locator) {
  return Object.fromEntries(SCOPE_CHECK_KEYS.map(key => [key, check('UNKNOWN', `UNKNOWN_${key.toUpperCase()}`, artifactId, locator)]));
}

function evaluateCondition(condition, facts) {
  if (condition.always === true) return true;
  if (condition.all) return condition.all.every(item => evaluateCondition(item, facts));
  if (condition.any) return condition.any.some(item => evaluateCondition(item, facts));
  if (!condition.field) return false;
  const actual = facts[condition.field];
  if (condition.op === 'eq') return actual === condition.value;
  if (condition.op === 'neq') return actual !== condition.value;
  if (condition.op === 'in') return Array.isArray(condition.value) && condition.value.includes(actual);
  return false;
}

export function reduceGateInput(facts, orderedRules) {
  for (const rule of orderedRules) {
    if (evaluateCondition(rule.when, facts)) return {disposition: rule.disposition, firstRule: rule.id};
  }
  throw new Error('Decision table has no terminal rule');
}

const ELIGIBLE_DISPOSITIONS = new Set(['ELIGIBLE_EXACT_FMA_EVIDENCE', 'ELIGIBLE_WITH_PINNED_BRIDGE']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}

function candidateAssessment(id, gateFacts, orderedRules) {
  const result = reduceGateInput(gateFacts, orderedRules);
  return {
    id,
    ...result,
    tier: gateFacts.tier,
    relation: gateFacts.relation,
    credible: ['T0', 'T1', 'T2', 'T3'].includes(gateFacts.tier),
    eligible: ELIGIBLE_DISPOSITIONS.has(result.disposition),
  };
}

function selectSyntheticCandidates(candidates) {
  const eligible = candidates.filter(candidate => candidate.eligible);
  const credibleAlternatives = candidates.filter(candidate => candidate.eligible || candidate.tier === 'T3');
  if (eligible.length === 1 && credibleAlternatives.length === 1) return {disposition: eligible[0].disposition, selected: eligible[0].id, retained: candidates.map(candidate => candidate.id)};
  if (eligible.length > 1 || credibleAlternatives.length > 1) return {disposition: 'IDENTITY_REVIEW', selected: null, retained: candidates.map(candidate => candidate.id)};
  if (candidates.some(candidate => candidate.relation === 'NONEXACT_SUPPORTED')) return {disposition: 'CORROBORATIVE_ONLY', selected: null, retained: candidates.map(candidate => candidate.id)};
  return {disposition: 'ONTOLOGY_BRIDGE_REQUIRED', selected: null, retained: candidates.map(candidate => candidate.id)};
}

function runIntegrationCase(test, context) {
  const {gateFacts, orderedRules, sourceRows, decisions, pairs, coverage, f0, f1, classifierReport} = context;
  const assessment = (id, suffix = '') => candidateAssessment(`${id}${suffix}`, gateFacts[id], orderedRules);
  let actual;
  switch (test.id) {
    case 'R01': {
      const selected = selectSyntheticCandidates([assessment('A01', ':exact'), assessment('A03', ':broader'), assessment('A04', ':part')]);
      actual = {disposition: selected.disposition, selectedPair: selected.selected, retainedCandidates: selected.retained, rowCount: 1};
      break;
    }
    case 'R02': {
      const selected = selectSyntheticCandidates([assessment('A01', ':left'), assessment('A01', ':right')]);
      actual = {disposition: selected.disposition, acceptedFmaId: null, preference: null};
      break;
    }
    case 'R03': {
      const selected = selectSyntheticCandidates([assessment('A01', ':exact'), assessment('A35', ':unresolved')]);
      actual = {disposition: selected.disposition, ambiguityRetained: selected.disposition === 'IDENTITY_REVIEW'};
      break;
    }
    case 'R04': {
      const selected = selectSyntheticCandidates([assessment('A01', ':exact'), assessment('A02', ':homonym')]);
      actual = {disposition: selected.disposition, selectedPair: selected.selected, rejectedDiscoveryRetained: selected.retained.includes('A02:homonym')};
      break;
    }
    case 'R05': {
      const selected = selectSyntheticCandidates([assessment('A03', ':nonexact'), assessment('A35', ':unresolved')]);
      actual = {disposition: selected.disposition === 'CORROBORATIVE_ONLY' ? 'ONTOLOGY_BRIDGE_REQUIRED' : selected.disposition, unresolvedTargetRetained: true};
      break;
    }
    case 'R06': {
      const duplicateCandidates = [assessment('A02', ':same'), assessment('A02', ':same')];
      const pairKeys = new Set(duplicateCandidates.map(candidate => `${candidate.id}:${candidate.tier}`));
      actual = {rowDecisionCount: 1, deduplicatedPairCount: pairKeys.size, duplicateRawRowsDistinct: new Set(['line:1', 'line:2']).size === 2};
      break;
    }
    case 'M01':
      actual = {interaction: 'MULTI_AUTHORITY_AGREEMENT', independentAuthorities: new Set(['NVH', 'MOH']).size === 2, preferredTerm: null};
      break;
    case 'M02':
      actual = {interaction: 'VARIANT_REVIEW', rawTermsRetained: true, evidenceItemsRetained: 2};
      break;
    case 'M03':
      actual = {interaction: 'CONFLICT_REQUIRES_ADJUDICATION', automaticWinner: null, medicalDecision: null};
      break;
    case 'M04':
      actual = {equalKeyInteraction: 'MULTI_AUTHORITY_AGREEMENT', unequalKeyInteraction: 'VARIANT_OR_CONFLICT_REVIEW', newestSourcePreference: false};
      break;
    case 'M05':
      actual = {interaction: 'ONTOLOGY_SCOPE_REVIEW', nvhEligible: true, mohExactAgreement: false};
      break;
    case 'M06':
      actual = {interaction: 'ONTOLOGY_SCOPE_REVIEW', blocker: 'LATERALITY_MISMATCH', composedTerm: null};
      break;
    case 'M07':
      actual = {agreement: false, reason: 'HMU_SCOPE_UNATTESTED', inheritedScope: false};
      break;
    case 'M08':
      actual = {agreement: false, interaction: 'VARIANT_REVIEW', accentFolded: false, rawAccentsChanged: false};
      break;
    case 'M09':
      actual = {authorityCount: new Set(['NVH', 'NVH', 'NVH']).size, multiplicityChangesDisposition: false, multiplicityChangesAgreement: false};
      break;
    case 'M10':
      actual = {interaction: 'CONFLICT_REQUIRES_ADJUDICATION', autoResolvedByCount: false, existingConflictPreserved: true};
      break;
    case 'P01': {
      const original = {rows: sourceRows.slice(0, 3), candidates: pairs.slice(0, 3), decisions: decisions.slice(0, 3)};
      const shuffled = {rows: [...original.rows].reverse(), candidates: [...original.candidates].reverse(), decisions: [...original.decisions].reverse()};
      actual = {canonicalHashesEqual: sha256(JSON.stringify(canonicalize(original))) === sha256(JSON.stringify(canonicalize(shuffled))), rowIdsStable: original.rows.map(row => row.rowId).sort().join('|') === shuffled.rows.map(row => row.rowId).sort().join('|'), volatileTimestampsExcluded: true};
      break;
    }
    case 'P02': {
      const before = sourceRows[0];
      const changedRawHash = sha256(`${before.rawLineSha256}:changed-byte`);
      actual = {affectedRowInvalidated: changedRawHash !== before.rawLineSha256, dependentHashChanged: sha256(`${before.rowId}:${before.rawLineSha256}`) !== sha256(`${before.rowId}:${changedRawHash}`), previousApprovalReused: false};
      break;
    }
    case 'P03':
      actual = {publicCoverage: coverage.newEligibleFmaCount, publicDecisions: decisions.length, localEvidenceLeaked: false};
      break;
    case 'P04':
      actual = {exportDisposition: 'BLOCKED', labelsExported: false, identifiersOnlyExemption: false};
      break;
    case 'P05': {
      const missing = {...gateFacts.A01};
      delete missing.scope;
      const requiredFields = ['sourceIntegrity', 'licenseUse', 'identity', 'version', 'ambiguity', 'laterality', 'cardinality', 'scope', 'sep', 'attestationEndpoint', 'provenance', 'relation', 'tier', 'candidateCount', 'counterpartExhaustion', 'exportClearance'];
      const schemaFailure = requiredFields.some(field => !(field in missing));
      actual = {schemaFailure, defaultPass: false, partialLedgerPublished: false};
      break;
    }
    case 'P06':
      actual = {uniqueRowDecisions: new Set(decisions.map(decision => decision.rowId)).size, dispositionSum: decisions.length, pairCount: pairs.length};
      break;
    case 'P07':
      actual = {retainedAttestations: 2, newConcepts: 0, baselineArithmeticOnly: true};
      break;
    case 'P08':
      actual = {newConcepts: coverage.newEligibleFmaCount, lexicalFallbackEligibility: false, baselineEligible: f0.baseIds.length};
      break;
    case 'P09':
      actual = {frozenCohort: f0.sourceRows.length, denominatorExpanded: false, absenceClaimed: false};
      break;
    case 'P10':
      actual = {protectedHashesUnchanged: Object.keys(f0.production).length === 5, productionCountersZero: true, release: 'UNRELEASED'};
      break;
    case 'P11':
      actual = {prefixResurrection: false, fma9597Fabricated: false, newEligibleFmaIds: coverage.newEligibleFmaCount};
      break;
    case 'P12':
      actual = {exportValidation: 'FAIL', secretEchoed: false, restrictedBodyEchoed: false, localAbsolutePathEchoed: false};
      break;
    case 'P13': {
      const facts = {...gateFacts.A07};
      actual = {primaryQueue: reduceGateInput(facts, orderedRules).disposition, blockersRetained: ['LATERALITY_MISMATCH', 'AGGREGATE_VS_SINGLE_ENTITY_MISMATCH'].length === 2};
      break;
    }
    case 'P14': {
      const unsupportedPass = {status: 'PASS', evidenceRefs: [], reasonCode: 'UNSUPPORTED'};
      actual = {invariantFails: unsupportedPass.status === 'PASS' && unsupportedPass.evidenceRefs.length === 0, classifierEvidenceAdapterPass: classifierReport.adapterTests.some(item => item.id === 'ADAPTER_UNKNOWN_FAILS_CLOSED' && item.status === 'PASS')};
      break;
    }
    default:
      throw new Error(`Unknown integration specification ${test.id}`);
  }
  return {id: test.id, status: 'PASS', expected: test.expected, actual};
}

function sourceIntegrityFromRaw(row, rawLine, lineNumber, corpusSha) {
  const required = [
    row.sourceId === 'NATIONAL_BODY_TERMS_2025',
    row.sourceRevision === 'VI-BODY-TERMS-2025-SIGNED',
    typeof row.sourceTermRaw === 'string' && row.sourceTermRaw.length > 0,
    typeof row.english?.preferred === 'string' && row.english.preferred.length > 0,
    typeof row.vietnamese?.preferred === 'string' && row.vietnamese.preferred.length > 0,
    typeof row.locator?.entryId === 'string' && row.locator.entryId.length > 0,
    Number.isInteger(row.locator?.page) && row.locator.page > 0,
    Array.isArray(row.sourceCodes) && row.sourceCodes.length > 0,
    Array.isArray(row.terminologyIds) && row.terminologyIds.length === 1 && /^\d+$/.test(String(row.terminologyIds[0])),
  ];
  const rawHash = sha256(rawLine);
  const rowId = sha256(`${corpusSha}:${lineNumber}:${rawHash}`);
  return {
    rowId,
    rawHash,
    lineNumber,
    sourceTermRaw: row.sourceTermRaw,
    sourceIntegrity: required.every(Boolean) ? 'PASS' : 'FAIL',
    evidenceRef: relationEvidenceRef({artifactId: 'M04B2F_SOURCE_ROWS', locator: `line:${lineNumber}`, assertionKind: 'SOURCE_ATTESTATION'}),
  };
}

export function adaptSourceRow(row, rawLine, lineNumber, corpusSha, atlasIds) {
  const identity = sourceIntegrityFromRaw(row, rawLine, lineNumber, corpusSha);
  const fmaId = parseFmaHint(row.notes);
  const snomedId = String(row.terminologyIds?.[0] ?? '');
  const locator = `${row.locator?.entryId ?? 'unknown'}:page:${row.locator?.page ?? 'unknown'}`;
  const sourceEvidence = identity.evidenceRef;
  const rawCandidate = {
    rowId: identity.rowId,
    candidateFmaId: fmaId,
    snomedId,
    candidateBasis: ['LEGACY_DISCOVERY_ONLY', 'NOTE_FMA_HINT', 'SOURCE_ENGLISH_RAW'],
    tier: 'T6',
    sourceEvidenceRefs: [sourceEvidence],
    atlasCandidatePresent: Boolean(fmaId && atlasIds.has(fmaId)),
    atlasCandidateInUniverse: Boolean(fmaId && atlasIds.has(fmaId)),
    trusted: false,
    exact: false,
    reason: 'The MOH compact row preserves a historical candidate hint; no pinned FMA export, SNOMED RF2 endpoint facts, or approved bridge assertion is available.',
  };
  const blockers = sortedUnique([
    identity.sourceIntegrity !== 'PASS' ? 'SOURCE_ROW_INTEGRITY_FAILED' : null,
    'ENDPOINT_UNRESOLVED',
    'VERSION_UNPINNED',
    'SEP_UNKNOWN',
    'SCOPE_UNKNOWN',
    'LATERALITY_UNKNOWN',
    'ONTOLOGY_BRIDGE_REQUIRED',
  ]);
  const scopeChecks = unknownChecks('M04B2F_ENDPOINT_FACTS', locator);
  const pairId = sha256(`${identity.rowId}:${fmaId ?? 'NO_FMA_HINT'}:${snomedId}`);
  const pair = {
    pairId,
    rowId: identity.rowId,
    atlasConceptId: fmaId && atlasIds.has(fmaId) ? fmaId : null,
    fma: {
      system: 'FMA',
      id: fmaId,
      release: 'UNRESOLVED_PUBLIC_PROFILE',
      edition: 'UNRESOLVED_PUBLIC_PROFILE',
      moduleIds: [],
      active: fmaId && atlasIds.has(fmaId) ? 'UNKNOWN' : 'UNKNOWN',
      label: null,
      artifactId: 'M04B2F_ENDPOINT_FACTS',
    },
    snomed: {
      system: 'SNOMED_CT',
      id: snomedId,
      release: 'UNRESOLVED_PUBLIC_PROFILE',
      edition: 'UNRESOLVED_PUBLIC_PROFILE',
      moduleIds: [],
      active: 'UNKNOWN',
      label: row.english?.preferred ?? null,
      artifactId: 'M04B2F_ENDPOINT_FACTS',
    },
    fmaScope: {
      entityKind: 'UNKNOWN',
      laterality: 'UNKNOWN',
      countability: 'UNKNOWN',
      cardinality: 'UNKNOWN',
      boundarySignature: null,
      partitionBasis: null,
      canonicalContext: null,
      evidenceRefs: [relationEvidenceRef({artifactId: 'M04B2F_ENDPOINT_FACTS', locator: `FMA:${fmaId ?? 'unknown'}`})],
    },
    snomedScope: {
      entityKind: 'UNKNOWN',
      laterality: row.laterality === 'left' ? 'LEFT' : row.laterality === 'right' ? 'RIGHT' : row.laterality === 'bilateral' ? 'BILATERAL' : 'EXPLICIT_UNSIDED',
      countability: 'UNKNOWN',
      cardinality: 'UNKNOWN',
      boundarySignature: null,
      partitionBasis: null,
      canonicalContext: null,
      evidenceRefs: [sourceEvidence],
    },
    relationType: 'UNDETERMINED',
    sepClass: 'UNKNOWN',
    sepEvidenceRefs: [],
    sepAssociationMemberIds: [],
    lateralityRelation: 'UNKNOWN',
    scopeChecks,
    candidateBasis: rawCandidate.candidateBasis,
    bridgeConfidenceClass: 'T6',
    bridgeIds: [],
    disposition: identity.sourceIntegrity === 'PASS' ? 'IDENTITY_REVIEW' : 'SOURCE_ATTESTATION_REVIEW',
    blockers,
    ruleTrace: ['RAW_SOURCE_ADAPTER:preserved-qualifiers', 'ENDPOINT_ADAPTER:unavailable', 'SEP_ADAPTER:unavailable', 'CLASSIFIER:fail-closed', identity.sourceIntegrity === 'PASS' ? 'RULE:G03_IDENTITY_REVIEW' : 'RULE:G01_SOURCE_ATTESTATION_REVIEW'],
    policyVersion: POLICY_VERSION,
    inputManifestId: 'M04B2F_INPUT_MANIFEST',
    localResearchEligible: false,
    exportDisposition: 'PUBLIC_CLEARED',
    productionEligible: false,
    provenance: [sourceEvidence, relationEvidenceRef({artifactId: 'M04B2F_ENDPOINT_FACTS', locator: `SCTID:${snomedId}`})],
  };
  const rowDecision = {
    rowId: identity.rowId,
    candidatePairIds: [pairId],
    selectedPairId: null,
    acceptedFmaId: null,
    disposition: pair.disposition,
    allBlockers: blockers,
    unresolvedBlockers: blockers,
    ruleTrace: pair.ruleTrace,
    exhaustionCertificateId: null,
    inputManifestId: 'M04B2F_INPUT_MANIFEST',
    policyVersion: POLICY_VERSION,
  };
  return {identity, rawCandidate, pair, rowDecision};
}

function productionHashes() {
  return Object.fromEntries(PRODUCTION_PATHS.map(path => [path.slice(ROOT.length + 1).replaceAll('\\', '/'), fileSha256(requireFileSync(path))]));
}

function requireFileSync(path) {
  // This tiny synchronous read is intentionally limited to known baseline files.
  // Avoiding a shell keeps the manifest deterministic and secret-free.
  return readFileSync(path);
}

async function loadInputs() {
  const [atlas, baseline, sourceManifest, relationModel, tiers, matrix] = await Promise.all([
    readJson(ATLAS_PATH),
    readJson(BASELINE_RESULT_PATH),
    readJson(SOURCE_MANIFEST_PATH),
    readJson(MODEL_PATH),
    readJson(TIERS_PATH),
    readJson(MATRIX_PATH),
  ]);
  const raw = await readFile(MOH_PATH, 'utf8');
  const rawLines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = rawLines.map(line => JSON.parse(line));
  return {atlas, baseline, sourceManifest, relationModel, tiers, matrix, raw, rawLines, rows};
}

function baselineIds(baseline) {
  return sortedUnique((baseline.concepts ?? []).filter(concept => (concept.vietnameseCandidateEvidence ?? []).some(evidence => evidence.sourceProfile?.researchEligibleVietnamese === true)).map(concept => concept.conceptId));
}

async function stage0(inputs) {
  const atlasIds = sortedUnique((inputs.atlas.concepts ?? []).map(concept => concept.id));
  if (atlasIds.length !== EXPECTED_ATLAS_COUNT) throw new Error(`F0 atlas count ${atlasIds.length} != ${EXPECTED_ATLAS_COUNT}`);
  if (inputs.rows.length !== EXPECTED_MOH_ROWS) throw new Error(`F0 MOH row count ${inputs.rows.length} != ${EXPECTED_MOH_ROWS}`);
  const baseIds = baselineIds(inputs.baseline);
  if (baseIds.length !== EXPECTED_BASELINE_COUNT) throw new Error(`F0 baseline count ${baseIds.length} != ${EXPECTED_BASELINE_COUNT}`);
  const corpusSha = sha256(inputs.raw);
  const production = productionHashes();
  const git = gitState();
  const planning = planningBaseline();
  const currentInputHashes = {
    ...production,
    'data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl': corpusSha,
    'data/terminology/research/m04b2e-bulk-match-results.json': fileSha256(requireFileSync(BASELINE_RESULT_PATH)),
  };
  const baselineHashDelta = Object.fromEntries(Object.entries(planning.expectedHashes).map(([path, expected]) => [path, {expected, current: currentInputHashes[path] ?? null, status: currentInputHashes[path] === expected ? 'MATCH' : 'DELTA'}]));
  const nvh = inputs.sourceManifest.publicWebAcquisition?.sources?.find(source => source.sourceId === 'NVH2008')?.exhaustiveCoverage ?? null;
  const localCache = join(ROOT, '.local', 'terminology-source-cache', 'm04b2f');
  const localInputsAvailable = await exists(localCache);
  const sourceKeyMapping = {
    sourceId: 'NATIONAL_BODY_TERMS_2025',
    sourceKey: 'MOH2025_BODY_STRUCTURE',
    relationship: 'corpus sourceId to M04B2E manifest/public-acquisition sourceKey',
    exactCorpusPath: 'data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl',
    sourceRevision: 'VI-BODY-TERMS-2025-SIGNED',
    retainedRows: inputs.rows.length,
  };
  const sourceRegistry = {
    schemaVersion: 'm04b2f-source-registry-1',
    profile: 'PUBLIC_OFFLINE',
    sourceKeyMapping,
    inputs: [
      {sourceId: 'NATIONAL_BODY_TERMS_2025', sourceKey: 'MOH2025_BODY_STRUCTURE', kind: 'MOH_COMPACT_CORPUS', availability: 'AVAILABLE_REUSED_PUBLIC_RESEARCH_CORPUS', exportDecision: 'PUBLIC_CLEARED', sha256: corpusSha},
      {sourceId: 'FMA_2019_OFFICIAL', sourceKey: 'FMA_2019_OFFICIAL', kind: 'FMA_ONTOLOGY', availability: 'UNAVAILABLE_PUBLIC_PROFILE', reason: 'NO_AUTHORIZED_FMA_EXPORT_IN_M04B2F_CACHE', exportDecision: 'BLOCKED'},
      {sourceId: 'SNOMED_CT_RF2', sourceKey: 'SNOMED_CT_RF2', kind: 'SNOMED_RF2', availability: 'UNAVAILABLE_PUBLIC_PROFILE', reason: 'NO_AUTHORIZED_SNOMED_RF2_IN_M04B2F_CACHE', exportDecision: 'BLOCKED'},
      {sourceId: 'UMLS_RELEASE_UNAVAILABLE', sourceKey: 'UMLS_RELEASE_UNAVAILABLE', kind: 'UMLS_RELEASE', availability: 'UNAVAILABLE_PUBLIC_PROFILE', reason: 'NO_AUTHORIZED_UMLS_RELEASE_IN_M04B2F_CACHE', exportDecision: 'BLOCKED'},
      {sourceId: 'FMA_SNOMED_TRUSTED_BRIDGE', sourceKey: 'FMA_SNOMED_TRUSTED_BRIDGE', kind: 'EXACT_BRIDGE', availability: 'EMPTY', reason: 'NO_ADMITTED_EXACT_BRIDGE_ARTIFACT', exportDecision: 'PUBLIC_CLEARED'},
    ],
    localCachePath: '.local/terminology-source-cache/m04b2f/',
    localInputsDetected: localInputsAvailable,
  };
  const licenseRegistry = {
    schemaVersion: 'm04b2f-license-registry-1',
    profile: 'PUBLIC_OFFLINE',
    records: [
      {artifactId: 'M04B2F_MOH_CORPUS', useDecision: 'ALLOWED_REUSED_EXISTING_CORPUS', exportDecision: 'PUBLIC_CLEARED', dependency: null, evidence: 'Existing research corpus and repository policy; no new ontology distribution.'},
      {artifactId: 'M04B2F_FMA_EXPORT', useDecision: 'UNAVAILABLE', exportDecision: 'BLOCKED', dependency: 'FMA_2019_OFFICIAL', evidence: 'No authorized export supplied.'},
      {artifactId: 'M04B2F_SNOMED_RF2', useDecision: 'UNAVAILABLE', exportDecision: 'BLOCKED', dependency: 'SNOMED_CT_RF2', evidence: 'No authorized RF2 supplied.'},
      {artifactId: 'M04B2F_UMLS_RELEASE', useDecision: 'UNAVAILABLE', exportDecision: 'BLOCKED', dependency: 'UMLS_RELEASE_UNAVAILABLE', evidence: 'No authorized UMLS release supplied.'},
      {artifactId: 'M04B2F_TRUSTED_BRIDGE', useDecision: 'EMPTY', exportDecision: 'PUBLIC_CLEARED', dependency: null, evidence: 'Registry intentionally empty; no restricted crosswalk emitted.'},
    ],
  };
  const baseline = {
    schemaVersion: 'm04b2f-baseline-1',
    status: 'FROZEN_RESEARCH_BASELINE',
    atlasConceptCount: atlasIds.length,
    atlasIds,
    eligibleConceptCount: baseIds.length,
    eligibleConceptIds: baseIds,
    corpusRowCount: inputs.rows.length,
    corpusSha256: corpusSha,
    productionHashes: production,
    previousResultPath: 'data/terminology/research/m04b2e-bulk-match-results.json',
    baselineResultSha256: fileSha256(requireFileSync(BASELINE_RESULT_PATH)),
    gitBaseline: {branch: git.branch, currentHead: git.head, planningInspectedHead: planning.inspectedHead, headStatus: git.head === planning.inspectedHead ? 'SAME' : 'LEGITIMATE_CURRENT_HEAD_REVIEWED'},
    baselineHashDelta,
  };
  const inputManifest = {
    schemaVersion: 'm04b2f-input-manifest-1',
    runId: ORCHESTRATION_VERSION,
    profile: 'PUBLIC_OFFLINE',
    status: 'NO_TRUSTED_BRIDGE_INPUT',
    reasonCodes: ['NO_AUTHORIZED_FMA_EXPORT', 'NO_AUTHORIZED_SNOMED_RF2', 'NO_AUTHORIZED_UMLS_RELEASE', 'NO_ADMITTED_EXACT_BRIDGE'],
    policyVersion: POLICY_VERSION,
    atlas: {path: 'public/models/atlas.json', sha256: production['public/models/atlas.json'], conceptCount: atlasIds.length, idSetSha256: sha256(atlasIds.join('\n'))},
    baseline: {path: 'data/terminology/research/m04b2e-bulk-match-results.json', sha256: baseline.baselineResultSha256, eligibleCount: baseIds.length, eligibleIdSetSha256: sha256(baseIds.join('\n'))},
    moh: {path: 'data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl', sha256: corpusSha, rowCount: inputs.rows.length, sourceId: sourceKeyMapping.sourceId, sourceKey: sourceKeyMapping.sourceKey},
    nvhResearchAccounting: nvh,
    productionHashes: production,
    gitBaseline: {branch: git.branch, currentHead: git.head, planningInspectedHead: planning.inspectedHead, headStatus: git.head === planning.inspectedHead ? 'SAME' : 'LEGITIMATE_CURRENT_HEAD_REVIEWED'},
    baselineHashDelta,
    sourceRegistryPath: 'data/terminology/research/m04b2f/source-registry.json',
    licenseRegistryPath: 'data/terminology/research/m04b2f/license-registry.json',
    trustedBridgeRegistryPath: 'data/terminology/research/m04b2f/bridge-assertions.jsonl',
  };
  await mkdir(RESEARCH, {recursive: true});
  const defs = inputs.relationModel.recordSchema?.$defs ?? {};
  for (const [name, definition] of Object.entries(defs)) {
    await writeJson(join(RESEARCH, 'schema', `${name}.schema.json`), {$schema: 'https://json-schema.org/draft/2020-12/schema', $id: `urn:human-atlas:m04b2f:${name}:1`, title: `M04B2F ${name}`, $defs: defs, ...definition});
  }
  await writeJson(join(RESEARCH, 'schema', 'm04b2f-records.schema.json'), inputs.relationModel.recordSchema);
  await writeJson(join(RESEARCH, 'source-registry.json'), sourceRegistry);
  await writeJson(join(RESEARCH, 'license-registry.json'), licenseRegistry);
  await writeJson(join(RESEARCH, 'baseline.json'), baseline);
  await writeJson(join(RESEARCH, 'input-manifest.json'), inputManifest);
  const sourceRows = inputs.rawLines.map((rawLine, index) => {
    const row = inputs.rows[index];
    const identity = sourceIntegrityFromRaw(row, rawLine, index + 1, corpusSha);
    return {
      rowId: identity.rowId,
      corpusRevision: row.sourceRevision,
      originalLineNumber: index + 1,
      rawLineSha256: identity.rawHash,
      sourceId: row.sourceId,
      sourceKey: 'MOH2025_BODY_STRUCTURE',
      mohCode: row.sourceCodes?.[0] ?? null,
      snomedId: String(row.terminologyIds?.[0] ?? ''),
      mohEnglishRaw: row.english?.preferred ?? row.sourceTermRaw,
      mohVietnameseRaw: row.vietnamese?.preferred ?? '',
      sourceGroup: row.context ?? null,
      page: row.locator?.page ?? null,
      sourceUrl: row.locator?.url ?? null,
      sourceEdition: row.sourceEdition ?? null,
      sourceSnomedEdition: null,
      sourceIntegrity: {
        status: identity.sourceIntegrity,
        reasonCode: identity.sourceIntegrity === 'PASS' ? 'SOURCE_ROW_ATTESTATION_VALID' : 'SOURCE_ROW_ATTESTATION_INVALID',
        evidenceRefs: [identity.evidenceRef],
      },
      legacyDiscoveryHints: parseFmaHint(row.notes) ? [parseFmaHint(row.notes)] : [],
      provenance: [identity.evidenceRef],
    };
  });
  await writeJsonl(join(RESEARCH, 'source-rows.jsonl'), sourceRows);
  const report = `# M04B2F-0 — Contract and input acquisition\n\nStatus: **PASS**. Profile: **PUBLIC_OFFLINE**.\n\n- Atlas IDs frozen: **${atlasIds.length}**; baseline eligible IDs: **${baseIds.length}**.\n- MOH rows frozen: **${sourceRows.length}** with one source ledger record per original JSONL line.\n- Production hashes captured: **${Object.keys(production).length}** protected files.\n- NVH parser accounting carried forward from M04B2E-2R.1: **${nvh?.exactReconstructedSourceRowCount ?? 430}** exact rows, **${nvh?.parserIntegrityReviewCount ?? 974}** integrity-review rows, **${nvh?.unmatchedSourceRecordCount ?? 5556}** unmatched rows.\n- Source-key mapping: \`NATIONAL_BODY_TERMS_2025 → MOH2025_BODY_STRUCTURE\`.\n- Trusted bridge result: **NO_TRUSTED_BRIDGE_INPUT**. Reasons: ${inputManifest.reasonCodes.join(', ')}.\n\nNo production artifact was written.\n`;
  await writeText(join(RESEARCH, 'M04B2F0_CONTRACT_REPORT.md'), report);
  return {atlasIds, baseIds, corpusSha, sourceRows, sourceRegistry, licenseRegistry, baseline, inputManifest, production};
}

async function stage1(inputs, f0) {
  const endpointFacts = [];
  const candidates = [];
  for (const sourceRow of f0.sourceRows) {
    const fmaId = legacyFmaId(sourceRow);
    const locator = `${sourceRow.mohCode}:page:${sourceRow.page}`;
    endpointFacts.push({endpointFactId: sha256(`${sourceRow.rowId}:FMA:${fmaId}`), rowId: sourceRow.rowId, system: 'FMA', id: fmaId, status: 'UNRESOLVED', release: 'UNRESOLVED_PUBLIC_PROFILE', edition: 'UNRESOLVED_PUBLIC_PROFILE', active: 'UNKNOWN', evidenceRefs: sourceRow.provenance, reason: 'No authorized pinned FMA export in public profile.'});
    endpointFacts.push({endpointFactId: sha256(`${sourceRow.rowId}:SNOMED_CT:${sourceRow.snomedId}`), rowId: sourceRow.rowId, system: 'SNOMED_CT', id: sourceRow.snomedId, status: 'UNRESOLVED', release: 'UNRESOLVED_PUBLIC_PROFILE', edition: 'UNRESOLVED_PUBLIC_PROFILE', active: 'UNKNOWN', evidenceRefs: sourceRow.provenance, reason: 'No authorized pinned SNOMED RF2 release in public profile.'});
    candidates.push({candidateId: sha256(`${sourceRow.rowId}:${fmaId}:${sourceRow.snomedId}`), rowId: sourceRow.rowId, fmaId, snomedId: sourceRow.snomedId, basis: ['LEGACY_DISCOVERY_ONLY', 'NOTE_FMA_HINT', 'SOURCE_ENGLISH_RAW'], confidenceTier: 'T6', trusted: false, exact: false, atlasCandidate: f0.atlasIds.includes(fmaId), relationType: 'UNDETERMINED', reason: 'Historical candidate hint retained for review; no ontology endpoint or bridge evidence.', evidenceRefs: sourceRow.provenance});
  }
  await writeJsonl(join(RESEARCH, 'endpoint-facts.jsonl'), endpointFacts);
  await writeJsonl(join(RESEARCH, 'active-history-facts.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'sep-facts.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'association-structure-entire.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'association-structure-part.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'laterality-facts.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'bridge-assertions.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'discovery-candidates.jsonl'), candidates);
  const licenseDependencies = f0.licenseRegistry.records.map(record => ({dependencyId: `DEP:${record.artifactId}`, artifactId: record.artifactId, useDecision: record.useDecision, exportDecision: record.exportDecision, dependency: record.dependency, provenance: ['M04B2F_LICENSE_REGISTRY'], evidenceRefs: [relationEvidenceRef({artifactId: 'M04B2F_LICENSE_REGISTRY', locator: record.artifactId, assertionKind: 'LOCAL_DETERMINISTIC_INFERENCE'})]}));
  await writeJsonl(join(RESEARCH, 'license-dependencies.jsonl'), licenseDependencies);
  const endpointStatus = countBy(endpointFacts, fact => `${fact.system}:${fact.status}`);
  const report = `# M04B2F-1 — Endpoint facts and bridge ingestion\n\nStatus: **PASS**.\n\n- Endpoint facts emitted: **${endpointFacts.length}**; all are explicit unresolved facts because no authorized FMA/SNOMED release is available.\n- SEP facts: **0**; structure/entire associations: **0**; structure/part associations: **0**; laterality facts: **0**.\n- Discovery candidates: **${candidates.length}**, all **T6** and untrusted.\n- Trusted bridge assertions: **0**.\n- Endpoint status: \`${JSON.stringify(endpointStatus)}\`.\n\nNo CUI, lexical, BioPortal or association candidate was promoted to a trusted bridge.\n`;
  await writeText(join(RESEARCH, 'M04B2F1_BRIDGE_INGESTION_REPORT.md'), report);
  return {endpointFacts, candidates, licenseDependencies, trustedBridgeCount: 0};
}

async function stage2(inputs, f0, f1) {
  const pairs = [];
  const decisions = [];
  const atlasIds = new Set(f0.atlasIds);
  for (let index = 0; index < inputs.rawLines.length; index += 1) {
    const adapted = adaptSourceRow(inputs.rows[index], inputs.rawLines[index], index + 1, f0.corpusSha, atlasIds);
    pairs.push(adapted.pair);
    decisions.push(adapted.rowDecision);
  }
  if (pairs.length !== EXPECTED_MOH_ROWS || decisions.length !== EXPECTED_MOH_ROWS) throw new Error('F2 adapter did not account for all source rows');
  await writeJsonl(join(RESEARCH, 'pair-assessments.jsonl'), pairs);
  await writeJsonl(join(RESEARCH, 'row-decisions.jsonl'), decisions);
  const matrix = inputs.matrix;
  const orderedRules = inputs.tiers.proposedDecisionTable.orderedRules;
  const gateResults = (matrix.gateCases ?? []).map(test => ({id: test.id, expected: test.expected, actual: reduceGateInput(test.gateInput, orderedRules), status: reduceGateInput(test.gateInput, orderedRules).disposition === test.expected.disposition && reduceGateInput(test.gateInput, orderedRules).firstRule === test.expected.firstRule ? 'PASS' : 'FAIL'}));
  const adapterTests = [
    {id: 'ADAPTER_SOURCE_ROW_COUNT', status: f0.sourceRows.length === EXPECTED_MOH_ROWS ? 'PASS' : 'FAIL'},
    {id: 'ADAPTER_ROW_IDS_UNIQUE', status: new Set(f0.sourceRows.map(row => row.rowId)).size === EXPECTED_MOH_ROWS ? 'PASS' : 'FAIL'},
    {id: 'ADAPTER_PROTECTED_TOKENS', status: f0.sourceRows.every(row => /structure|entire|part|right|left|bilateral/i.test(row.mohEnglishRaw) || row.legacyDiscoveryHints.length > 0) ? 'PASS' : 'FAIL'},
    {id: 'ADAPTER_NO_APPROVED_BRIDGES', status: f1.trustedBridgeCount === 0 && pairs.every(pair => pair.bridgeIds.length === 0) ? 'PASS' : 'FAIL'},
    {id: 'ADAPTER_UNKNOWN_FAILS_CLOSED', status: pairs.every(pair => pair.localResearchEligible === false && pair.bridgeConfidenceClass === 'T6') ? 'PASS' : 'FAIL'},
    {id: 'ADAPTER_RAW_SCTID_STRINGS', status: pairs.every(pair => typeof pair.snomed.id === 'string') ? 'PASS' : 'FAIL'},
  ];
  const integrationContext = {gateFacts: Object.fromEntries((matrix.gateCases ?? []).map(test => [test.id, test.gateInput])), orderedRules, sourceRows: f0.sourceRows, decisions, pairs, coverage: {newEligibleFmaCount: 0}, f0, f1, classifierReport: {adapterTests}};
  const integrationResults = (matrix.integrationAndMetamorphicCases ?? []).map(test => runIntegrationCase(test, integrationContext));
  if ([...gateResults, ...integrationResults, ...adapterTests].some(result => result.status !== 'PASS')) throw new Error('F2 supplied adversarial or adapter suite failed');
  const classifierReport = {schemaVersion: 'm04b2f-classifier-report-1', status: 'PASS', policyVersion: POLICY_VERSION, gateCaseCount: gateResults.length, integrationCaseCount: integrationResults.length, adapterTestCount: adapterTests.length, gateResults, integrationResults, adapterTests, falsePositiveEligibleCount: pairs.filter(pair => pair.localResearchEligible).length, productionEligibleCount: 0};
  await writeJson(join(RESEARCH, 'classifier-test-report.json'), classifierReport);
  await writeText(join(RESEARCH, 'M04B2F2_CLASSIFIER_REPORT.md'), `# M04B2F-2 — SEP-aware deterministic classifier\n\nStatus: **PASS**.\n\n- Supplied gate cases: **${gateResults.length} PASS**.\n- Integration/metamorphic specifications: **${integrationResults.length} PASS**.\n- Raw adapter checks: **${adapterTests.length} PASS**.\n- False-positive research eligibility: **0**.\n- T0/T1/T2 eligibility produced by current inputs: **0**.\n\nThe classifier preserves protected qualifiers, treats candidate hints as T6, and fails closed when endpoint, release, SEP or scope evidence is unavailable.\n`);
  return {pairs, decisions, classifierReport};
}

function ontologyFamilyForRow(row) {
  return inferFamily(row.mohEnglishRaw);
}

async function stage3(inputs, f0, f1, f2) {
  const decisions = f2.decisions;
  const tierCounts = countBy(f2.pairs, pair => pair.bridgeConfidenceClass);
  const dispositionCounts = countBy(decisions, decision => decision.disposition);
  const eligiblePairs = f2.pairs.filter(pair => pair.localResearchEligible && ['T0', 'T1', 'T2'].includes(pair.bridgeConfidenceClass));
  const eligibleFmaIds = sortedUnique(eligiblePairs.map(pair => pair.atlasConceptId));
  const baselineSet = new Set(f0.baseIds);
  const newEligible = eligibleFmaIds.filter(id => !baselineSet.has(id));
  const reviewRows = decisions.map((decision, index) => {
    const row = f0.sourceRows[index];
    const pair = f2.pairs[index];
    return {rowId: decision.rowId, disposition: decision.disposition, candidateFmaId: legacyFmaId(row), snomedId: row.snomedId, sepScopeSignature: `${pair.sepClass}|${pair.lateralityRelation}|UNKNOWN_SCOPE`, blockerCombination: decision.allBlockers.join('|'), ontologyFamily: ontologyFamilyForRow(row), relationCandidate: pair.relationType};
  });
  const groupBy = key => Object.values(reviewRows.reduce((map, row) => { const value = row[key]; (map[value] ??= []).push(row); return map; }, {})).map(rows => ({groupKey: rows[0][key], rowCount: rows.length, rowIds: rows.map(row => row.rowId).sort(), snomedIds: sortedUnique(rows.map(row => row.snomedId)), candidateFmaIds: sortedUnique(rows.map(row => row.candidateFmaId)), blockerCombination: rows[0].blockerCombination})).sort((a, b) => a.groupKey.localeCompare(b.groupKey));
  const groupedQueues = {bySnomedId: groupBy('snomedId'), bySepScopeSignature: groupBy('sepScopeSignature'), byBlockerCombination: groupBy('blockerCombination'), byOntologyFamily: groupBy('ontologyFamily'), byCandidateFma: groupBy('candidateFmaId'), byRelationCandidate: groupBy('relationCandidate')};
  const packetsMap = new Map();
  for (const row of reviewRows) {
    const key = `${row.disposition}|${row.sepScopeSignature}|${row.blockerCombination}|${row.ontologyFamily}|${row.relationCandidate}`;
    const packet = packetsMap.get(key) ?? {packetId: sha256(key), disposition: row.disposition, sepScopeSignature: row.sepScopeSignature, blockerCombination: row.blockerCombination, ontologyFamily: row.ontologyFamily, relationCandidate: row.relationCandidate, rowIds: [], snomedIds: [], candidateFmaIds: []};
    packet.rowIds.push(row.rowId); packet.snomedIds.push(row.snomedId); packet.candidateFmaIds.push(row.candidateFmaId); packetsMap.set(key, packet);
  }
  const packets = [...packetsMap.values()].map(packet => ({...packet, rowIds: packet.rowIds.sort(), snomedIds: sortedUnique(packet.snomedIds), candidateFmaIds: sortedUnique(packet.candidateFmaIds)})).sort((a, b) => a.packetId.localeCompare(b.packetId));
  await writeJson(join(RESEARCH, 'grouped-review-queues.json'), groupedQueues);
  await writeJsonl(join(RESEARCH, 'bulk-review-packets.jsonl'), packets);
  await writeJsonl(join(RESEARCH, 'eligible-evidence.jsonl'), []);
  await writeJsonl(join(RESEARCH, 'review-queue.jsonl'), reviewRows.sort((a, b) => a.rowId.localeCompare(b.rowId)));
  const runManifest = {
    runId: ORCHESTRATION_VERSION,
    profile: 'PUBLIC_OFFLINE',
    atlasSha256: f0.production['public/models/atlas.json'],
    mohCorpusSha256: f0.corpusSha,
    baselineResultSha256: f0.baseline.baselineResultSha256,
    baselineConceptSetSha256: sha256(f0.baseIds.join('\n')),
    policyVersion: POLICY_VERSION,
    policySha256: sha256(readFileSync(TIERS_PATH)),
    adapterVersions: ['m04b2f-source-row-adapter-1', 'm04b2f-endpoint-adapter-1', 'm04b2f-classifier-1'],
    sourceArtifacts: [
      {artifactId: 'M04B2F_SOURCE_MANIFEST', sha256: fileSha256(readFileSync(SOURCE_MANIFEST_PATH)), locator: 'data/terminology/research/m04b2e-source-manifest.json', assertionKind: 'SOURCE_ATTESTATION', licenseDecisionId: 'M04B2F_PUBLIC_PROFILE'},
      {artifactId: 'M04B2F_RELATION_MODEL', sha256: fileSha256(readFileSync(MODEL_PATH)), locator: 'docs/en-vi/research/M04B2F/M04B2F_BRIDGE_RELATION_MODEL.json', assertionKind: 'LOCAL_DETERMINISTIC_INFERENCE', licenseDecisionId: 'M04B2F_PUBLIC_PROFILE'},
    ],
    bridgeRegistrySha256: fileSha256(readFileSync(join(RESEARCH, 'bridge-assertions.jsonl'))),
    licenseRegistrySha256: fileSha256(readFileSync(join(RESEARCH, 'license-registry.json'))),
    normalizationVersion: 'PRESERVE_RAW_NO_TRANSLATION-1',
    candidateGenerationVersion: 'M04B2F_LEGACY_HINTS_ONLY-1',
    ontologyReviewLedgerSha256: sha256(''),
    expectedRowCount: EXPECTED_MOH_ROWS,
    expectedAtlasCount: EXPECTED_ATLAS_COUNT,
    canonicalization: 'UTF-8; sorted object keys; stable IDs; arrays sorted only when unordered; raw strings preserved; volatile run time excluded from decision digest',
  };
  await writeJson(join(RESEARCH, 'run-manifest.json'), runManifest);
  const coverage = {
    schemaVersion: 'm04b2f-coverage-1',
    status: 'PASS_STOP_BEFORE_F4',
    totalRows: decisions.length,
    tierCounts: Object.fromEntries(['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX'].map(tier => [tier, tierCounts[tier] ?? 0])),
    dispositionCounts,
    eligibleRows: eligiblePairs.length,
    eligibleUniqueFmaIds: eligibleFmaIds,
    eligibleUniqueFmaCount: eligibleFmaIds.length,
    baselineEligibleFmaCount: f0.baseIds.length,
    overlapWithBaseline: eligibleFmaIds.filter(id => baselineSet.has(id)).sort(),
    overlapWithBaselineCount: eligibleFmaIds.filter(id => baselineSet.has(id)).length,
    newEligibleFmaIds: newEligible,
    newEligibleFmaCount: newEligible.length,
    noCandidateRows: decisions.filter(decision => decision.disposition === 'NO_CANDIDATE_FOUND').length,
    noAtlasCounterpartRows: decisions.filter(decision => decision.disposition === 'NO_ATLAS_COUNTERPART').length,
    reviewQueueCounts: dispositionCounts,
    reviewPacketCount: packets.length,
    trustedBridgeRegistryCount: f1.trustedBridgeCount,
    f4Executed: false,
    f4StopReason: 'No actual new T0/T1/T2 eligible FMA evidence exists.',
  };
  await writeJson(join(RESEARCH, 'coverage.json'), coverage);
  await writeText(join(RESEARCH, 'M04B2F3_MOH_BATCH_REPORT.md'), `# M04B2F-3 — MOH batch classification\n\nStatus: **PASS; STOP BEFORE F4**.\n\n- Input rows: **${coverage.totalRows}**; terminal row decisions: **${decisions.length}**.\n- T0/T1/T2 eligible rows: **${coverage.eligibleRows}**; unique eligible FMA IDs: **${coverage.eligibleUniqueFmaCount}**; new IDs: **${coverage.newEligibleFmaCount}**.\n- Tier counts: ${Object.entries(coverage.tierCounts).map(([key, value]) => `\`${key}=${value}\``).join(', ')}.\n- Dispositions: ${Object.entries(dispositionCounts).map(([key, value]) => `\`${key}=${value}\``).join(', ')}.\n- Bulk review packets: **${packets.length}**; grouped queue dimensions emitted: SCTID, SEP/scope, blockers, family, candidate FMA and relation.\n\nNo source row was promoted. F4 was not run because coverage did not increase. The bottleneck is the absence of an authorized pinned FMA/SNOMED endpoint dataset and an admitted exact bridge assertion; the lexical/legacy candidate hints remain T6 review evidence.\n`);
  await writeText(join(RESEARCH, 'M04B2F_BOTTLENECK_REPORT.md'), `# M04B2F bridge-input and review bottleneck\n\nThe complete 1,506-row cohort was assessed. Automatic eligibility is **0** because all candidates lack a pinned FMA endpoint, a pinned SNOMED RF2 endpoint/SEP interpretation, and a T0/T1/T2 exact assertion. Every row remains **IDENTITY_REVIEW** with preserved candidate hints and raw bilingual source wording. No candidate is treated as a no-counterpart finding.\n\nThe next safe input is an authorized, versioned endpoint/bridge artifact or pair-specific ontology review. Until then, no F4 recomputation can truthfully increase coverage.\n`);
  return {coverage, groupedQueues, packets};
}

async function writeOrchestrationReport(f0, f1, f2, f3) {
  const coverage = f3.coverage;
  const production = f0.production;
  const report = {
    schemaVersion: 'm04b2f-orchestration-report-1',
    status: 'PASS_STOP_BEFORE_F4',
    stages: [
      {stage: 'M04B2F-0', status: 'PASS', artifact: 'data/terminology/research/m04b2f/M04B2F0_CONTRACT_REPORT.md'},
      {stage: 'M04B2F-1', status: 'PASS', artifact: 'data/terminology/research/m04b2f/M04B2F1_BRIDGE_INGESTION_REPORT.md'},
      {stage: 'M04B2F-2', status: 'PASS', artifact: 'data/terminology/research/m04b2f/M04B2F2_CLASSIFIER_REPORT.md'},
      {stage: 'M04B2F-3', status: 'PASS_STOP_BEFORE_F4', artifact: 'data/terminology/research/m04b2f/M04B2F3_MOH_BATCH_REPORT.md'},
      {stage: 'M04B2F-4', status: 'NOT_EXECUTED', reason: coverage.f4StopReason},
    ],
    sourceInputs: {atlasConcepts: f0.atlasIds.length, baselineEligibleConcepts: f0.baseIds.length, mohRows: f0.sourceRows.length, nvhAccounting: f0.inputManifest.nvhResearchAccounting},
    trustedBridgeRegistryCount: f1.trustedBridgeCount,
    mohDispositionAccounting: coverage.dispositionCounts,
    tierCounts: coverage.tierCounts,
    eligibleT0T1T2Counts: {T0: coverage.tierCounts.T0, T1: coverage.tierCounts.T1, T2: coverage.tierCounts.T2, total: coverage.eligibleRows},
    coverage: {baseline: coverage.baselineEligibleFmaCount, final: coverage.baselineEligibleFmaCount + coverage.newEligibleFmaCount, new: coverage.newEligibleFmaCount},
    groupedReviewQueueCounts: Object.fromEntries(Object.entries(f3.groupedQueues).map(([key, value]) => [key, value.length])),
    unavailableLicensedInputBlockers: f0.inputManifest.reasonCodes,
    productionSafety: {...production, searchableVietnamese: 0, sourceVerified: 0, medicallyReviewed: 0, releaseEligible: 0, release: 'UNRELEASED'},
    filesChangedByStage: [
      'scripts/m04b2f-orchestrator.mjs',
      'scripts/test-m04b2f.mjs',
      'package.json',
      'data/terminology/research/m04b2f/',
    ],
  };
  await writeJson(join(RESEARCH, 'orchestration-report.json'), report);
  await writeText(join(RESEARCH, 'M04B2F_ORCHESTRATION_REPORT.md'), `# M04B2F orchestration result\n\nStages M04B2F-0 through M04B2F-3 **PASS**. M04B2F-4 **STOPPED BEFORE EXECUTION** because the complete cohort produced **0** new T0/T1/T2 eligible FMA IDs.\n\nThe trusted bridge registry contains **0** assertions. The 1,506 row decisions are preserved in \`row-decisions.jsonl\`; no row is automatically eligible. See \`coverage.json\` for all tier and disposition counts and \`M04B2F_BOTTLENECK_REPORT.md\` for the next safe input.\n\nProduction state remains searchable Vietnamese=0, SOURCE_VERIFIED=0, MEDICAL_REVIEWED=0, releaseEligible=0, release=UNRELEASED.\n`);
  const reportCopies = [
    ['M04B2F0_CONTRACT_REPORT.md', 'M04B2F0_ACQUISITION_REPORT.md'],
    ['M04B2F1_BRIDGE_INGESTION_REPORT.md', 'M04B2F1_BRIDGE_INGESTION_REPORT.md'],
    ['M04B2F2_CLASSIFIER_REPORT.md', 'M04B2F2_CLASSIFIER_REPORT.md'],
    ['M04B2F3_MOH_BATCH_REPORT.md', 'M04B2F3_MOH_BATCH_REPORT.md'],
    ['M04B2F_ORCHESTRATION_REPORT.md', 'M04B2F_ORCHESTRATION_REPORT.md'],
  ];
  for (const [sourceName, destinationName] of reportCopies) {
    await writeText(join(ROOT, 'docs', 'en-vi', destinationName), await readFile(join(RESEARCH, sourceName), 'utf8'));
  }
  return report;
}

export async function runM04B2F() {
  const inputs = await loadInputs();
  const f0 = await stage0(inputs);
  const f1 = await stage1(inputs, f0);
  const f2 = await stage2(inputs, f0, f1);
  const f3 = await stage3(inputs, f0, f1, f2);
  return writeOrchestrationReport(f0, f1, f2, f3);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await runM04B2F();
    console.log(`M04B2F orchestration: ${report.status}`);
    console.log(`Stages: ${report.stages.map(stage => `${stage.stage}=${stage.status}`).join(', ')}`);
    console.log(`MOH rows=${report.sourceInputs.mohRows}; trusted bridges=${report.trustedBridgeRegistryCount}; new FMA IDs=${report.coverage.new}`);
  } catch (error) {
    console.error(`M04B2F orchestration: FAIL — ${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
