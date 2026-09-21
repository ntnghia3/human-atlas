import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESEARCH_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2g');
const CORPORA_DIR = join(ROOT, 'data', 'terminology', 'research', 'corpora');
const ATLAS_PATH = join(ROOT, 'public', 'models', 'atlas.json');
const TOTAL_ATLAS_CONCEPTS = 3432;
const CURRENT_BASELINE_ELIGIBLE = 421;
const EXPECTED_MOH_ROWS = 1506;
const APPROVED_TERMINAL_DISPOSITIONS = [
  'MULTI_AUTHORITY_AGREEMENT',
  'DIRECT_AUTHORITY_TRANSLATION',
  'AUTHORITY_VARIANT',
  'SOURCE_CONFLICT',
  'CONTROLLED_DERIVED_TRANSLATION',
  'SCOPE_REVIEW',
  'IDENTITY_REVIEW',
  'NO_DIRECT_AUTHORITY_ATTESTATION',
];

const SOURCE_SPECS = [
  {
    key: 'NVH2008_APPROVED',
    sourceId: 'NVH2008',
    role: 'primary_bilingual',
    path: join(CORPORA_DIR, 'm04b2e2r-nvh2008-exhaustive.jsonl'),
    approved: row => row.context === 'EXACT_RECONSTRUCTED_SOURCE_ROW',
  },
  {
    key: 'MOH2025_BODY_STRUCTURE',
    sourceId: 'NATIONAL_BODY_TERMS_2025',
    role: 'official_bilingual_candidate',
    path: join(CORPORA_DIR, 'm04b2e2r-moh2025-body-structure.jsonl'),
    approved: () => true,
  },
  {
    key: 'HMU2022',
    sourceId: 'HMU2022',
    role: 'qualified_bilingual_corroboration',
    path: join(CORPORA_DIR, 'hmu2022-attestations.jsonl'),
    approved: () => true,
  },
  {
    key: 'UMP2023_T2',
    sourceId: 'UMP2023_T2',
    role: 'qualified_bilingual_corroboration',
    path: join(CORPORA_DIR, 'ump2023-t2-bulk-attestations.jsonl'),
    approved: () => true,
  },
  {
    key: 'FIPAT_TA2',
    sourceId: 'FIPAT_TA2',
    role: 'identity_only',
    path: join(CORPORA_DIR, 'fipat-ta2-2019.jsonl'),
    approved: () => true,
  },
];

const UNAVAILABLE_REGISTERED_SOURCES = [
  {sourceId: 'NQQ', status: 'NOT_LOCAL', reason: 'No registered local corpus or parser output.'},
  {sourceId: 'HUE', status: 'NOT_LOCAL', reason: 'No registered local corpus or parser output.'},
  {sourceId: 'NETTER_VIETNAMESE', status: 'NOT_LOCAL', reason: 'No registered local corpus or parser output.'},
  {sourceId: 'TRINH_VAN_MINH', status: 'NOT_LOCAL', reason: 'No registered local corpus or parser output.'},
  {sourceId: 'UMP2023_T1', status: 'NOT_LOCAL', reason: 'No registered local corpus or parser output.'},
];

const PRODUCTION_FILES = [
  join(ROOT, 'data', 'terminology', 'entries.json'),
  join(ROOT, 'data', 'terminology', 'reviewers.json'),
  join(ROOT, 'data', 'terminology', 'release.json'),
];

/**
 * The normalizer is deliberately narrower than the historical bulk matcher.
 * In particular, it never strips words which carry anatomical scope.
 */
export function safeEnglish(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeVietnameseForAgreement(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([-–—])\s*/g, '$1')
    .trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonl(path, values) {
  writeFileSync(path, values.map(value => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), 'utf8');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function stableSourceFingerprint(row) {
  return sha256(JSON.stringify(row));
}

function gitValue(args, fallback = null) {
  try {
    return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
  } catch {
    return fallback;
  }
}

function atlasIdentityMap(atlas) {
  const byName = new Map();
  for (const concept of atlas.concepts) {
    const key = safeEnglish(concept.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(concept);
  }
  return byName;
}

function removeGenericBodyWrapper(value) {
  const original = String(value ?? '').trim();
  const without = original.replace(/\s*(?:\(body structure\)|\[body structure\])\s*$/i, '').trim();
  return {value: without, changed: without !== original};
}

const SCOPE_WORDS = new Set([
  'entire', 'part', 'structure', 'region', 'branch', 'segment', 'group', 'set',
  'tissue', 'organ', 'subdivision', 'tributary', 'lobule', 'layer', 'root', 'ramus',
  'both', 'paired', 'pair', 'multiple',
]);
const SIDE_WORDS = new Set(['left', 'right', 'bilateral']);

function tokens(value) {
  return safeEnglish(value).replace(/[()[\],;:]/g, ' ').split(/\s+/).filter(Boolean);
}

function sourceEnglishForms(row) {
  const preferred = row.english?.preferred ?? row.sourceEnglishRaw ?? row.sourceTermRaw ?? '';
  const aliases = Array.isArray(row.english?.aliases) ? row.english.aliases : [];
  return {preferred: String(preferred), aliases: aliases.map(String)};
}

function sourceLaterality(row, sourceCore) {
  const declared = safeEnglish(row.laterality ?? 'unsided');
  const inEnglish = new Set(tokens(sourceCore).filter(token => SIDE_WORDS.has(token)));
  if (declared === 'left' || declared === 'right' || declared === 'bilateral') return declared;
  if (inEnglish.size === 1) return [...inEnglish][0];
  return 'unsided';
}

function targetLaterality(targetName) {
  const sides = tokens(targetName).filter(token => SIDE_WORDS.has(token));
  return sides.length === 1 ? sides[0] : 'unsided';
}

function extraScopeWords(sourceCore, targetName) {
  const targetCounts = new Map();
  for (const token of tokens(targetName)) targetCounts.set(token, (targetCounts.get(token) ?? 0) + 1);
  const extras = [];
  for (const token of tokens(sourceCore)) {
    const available = targetCounts.get(token) ?? 0;
    if (available > 0) targetCounts.set(token, available - 1);
    else if (SCOPE_WORDS.has(token)) extras.push(token);
  }
  return [...new Set(extras)];
}

/**
 * Apply the M04B2G localization gate to a bilingual source row. The returned
 * object is pure and is also used by the focused tests for synthetic exact and
 * scoped rows.
 */
export function assessLocalizationRow(row, byName, {moh = false} = {}) {
  const forms = sourceEnglishForms(row);
  const preferredOriginal = forms.preferred;
  const preferredWithoutWrapper = removeGenericBodyWrapper(preferredOriginal);
  const provenanceText = `${row.context ?? ''} ${row.notes ?? ''}`.toLowerCase();
  if (/parser[- _]?generated|reconstructed[- _]?from[- _]?atlas|atlas[- _]?prefix/.test(provenanceText)) {
    return {
      status: 'PARSER_BLOCKED',
      category: 'noAtlasIdentity',
      candidates: [],
      identityMethod: null,
      blockers: ['PARSER_GENERATED_OR_ATLAS_PREFIX_RECONSTRUCTION'],
      rawEnglish: preferredOriginal,
      sourceCore: preferredWithoutWrapper.value,
    };
  }
  const candidateMatches = new Map();
  const addMatches = (value, method) => {
    const key = safeEnglish(value);
    for (const target of byName.get(key) ?? []) {
      candidateMatches.set(target.id, {target, method});
    }
  };
  addMatches(forms.preferred, 'EXACT_ENGLISH');
  if (preferredWithoutWrapper.changed) addMatches(preferredWithoutWrapper.value, 'EXACT_ENGLISH_BODY_WRAPPER');
  for (const alias of forms.aliases) addMatches(alias, 'EXACT_PINNED_SYNONYM');

  const candidates = [...candidateMatches.values()];
  if (candidates.length === 0) {
    return {
      status: 'NO_ATLAS_IDENTITY',
      category: 'noAtlasIdentity',
      candidates: [],
      identityMethod: null,
      blockers: ['NO_EXACT_ATLAS_IDENTITY'],
      rawEnglish: preferredOriginal,
      sourceCore: preferredWithoutWrapper.value,
    };
  }
  if (candidates.length > 1) {
    return {
      status: 'MULTIPLE_ATLAS_TARGETS',
      category: 'multipleAtlasTargets',
      candidates: candidates.map(item => item.target),
      identityMethod: null,
      blockers: ['MULTIPLE_CREDIBLE_ATLAS_TARGETS'],
      rawEnglish: preferredOriginal,
      sourceCore: preferredWithoutWrapper.value,
    };
  }

  const {target, method} = candidates[0];
  const sourceCore = preferredWithoutWrapper.value;
  const scopeBlockers = extraScopeWords(sourceCore, target.name);
  const sourceSide = sourceLaterality(row, sourceCore);
  const targetSide = targetLaterality(target.name);
  const lateralityBlocked = sourceSide !== 'unsided' && targetSide !== sourceSide;
  const blockers = [];
  if (scopeBlockers.length > 0) blockers.push(...scopeBlockers.map(word => `SCOPE_QUALIFIER_${word.toUpperCase()}`));
  if (lateralityBlocked) blockers.push(`LATERALITY_MISMATCH_${sourceSide}_TO_${targetSide}`);

  if (lateralityBlocked) {
    return {status: 'LATERALITY_BLOCKED', category: 'lateralityBlocked', candidates: [target], identityMethod: method, blockers, rawEnglish: preferredOriginal, sourceCore};
  }
  if (scopeBlockers.length > 0) {
    return {status: 'SCOPE_BLOCKED', category: 'scopeBlocked', candidates: [target], identityMethod: method, blockers, rawEnglish: preferredOriginal, sourceCore};
  }

  const accepted = method === 'EXACT_ENGLISH' || method === 'EXACT_ENGLISH_BODY_WRAPPER' || method === 'EXACT_PINNED_SYNONYM';
  const category = method === 'EXACT_PINNED_SYNONYM' ? 'exactSynonymLocalizationMatch' : 'exactLocalizationIdentityMatch';
  return {
    status: accepted ? 'ACCEPTED_DIRECT_CANDIDATE' : 'NO_ATLAS_IDENTITY',
    category: accepted ? category : 'noAtlasIdentity',
    candidates: [target],
    identityMethod: method,
    blockers,
    rawEnglish: preferredOriginal,
    sourceCore,
  };
}

function isBilingual(row) {
  return Boolean(row.vietnamese?.preferred ?? row.sourceVietnameseRaw ?? row.vietnameseTerm);
}

function claimFromRow({row, spec, rowIndex, assessment, atlasConcept}) {
  const vietnamese = row.vietnamese?.preferred ?? row.sourceVietnameseRaw ?? row.vietnameseTerm ?? null;
  const rawEnglish = row.english?.preferred ?? row.sourceEnglishRaw ?? row.sourceTermRaw ?? null;
  const fingerprint = stableSourceFingerprint(row);
  const sourceCodes = row.sourceCodes ?? row.sourceCode ?? [];
  const terminologyIds = row.terminologyIds ?? row.terminologyId ?? [];
  return {
    claimId: `${spec.sourceId}:${rowIndex + 1}:${atlasConcept.id}:${fingerprint.slice(0, 16)}`,
    conceptId: atlasConcept.id,
    atlasEnglish: atlasConcept.name,
    sourceId: spec.sourceId,
    sourceRevision: row.sourceRevision ?? row.corpusRevision ?? row.sourceEdition ?? 'UNSPECIFIED',
    sourceEnglishRaw: rawEnglish,
    sourceEnglishAliasesRaw: row.english?.aliases ?? [],
    sourceVietnameseRaw: vietnamese,
    sourceVietnameseAliasesRaw: row.vietnamese?.aliases ?? [],
    sourceLatinRaw: row.latin?.preferred ?? row.sourceLatinRaw ?? null,
    sourceLocator: row.locator ?? null,
    claimType: 'DIRECT_AUTHORITY_TRANSLATION',
    identityMethod: assessment.identityMethod,
    derivationMethod: null,
    confidenceClass: spec.sourceId === 'NVH2008' ? 'A_PRIMARY_BILINGUAL' : spec.sourceId === 'NATIONAL_BODY_TERMS_2025' ? 'A_OFFICIAL_BILINGUAL' : 'A_QUALIFIED_BILINGUAL',
    blockers: [],
    provenance: [{
      sourceId: spec.sourceId,
      sourceRevision: row.sourceRevision ?? row.corpusRevision ?? row.sourceEdition ?? 'UNSPECIFIED',
      sourceEdition: row.sourceEdition ?? null,
      locator: row.locator ?? null,
      sourcePath: spec.path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'),
      rawFingerprint: fingerprint,
      independenceKey: `${spec.sourceId}:${row.sourceRevision ?? row.corpusRevision ?? row.sourceEdition ?? 'UNSPECIFIED'}`,
    }],
    sourceCodes: Array.isArray(sourceCodes) ? sourceCodes : [sourceCodes],
    terminologyIds: Array.isArray(terminologyIds) ? terminologyIds : [terminologyIds],
    snomedId: row.snomedId ?? (spec.sourceId === 'NATIONAL_BODY_TERMS_2025' ? row.terminologyIds?.[0] ?? null : null),
    ministryCode: spec.sourceId === 'NATIONAL_BODY_TERMS_2025' ? row.sourceCodes?.[0] ?? row.mohCode ?? null : null,
  };
}

function claimTermKey(claim) {
  return normalizeVietnameseForAgreement(claim.sourceVietnameseRaw);
}

function makeDerivationRegistry() {
  return {
    schemaVersion: 'M04B2G-DERIVATION-REGISTRY-1',
    milestone: 'M04B2G',
    researchOnly: true,
    rules: [
      {
        ruleId: 'M04B2G-LATERALITY-001',
        version: '1.0.0',
        operation: 'PLACE_ATTESTED_VIETNAMESE_LATERALITY_MODIFIER',
        eligibleConceptPattern: 'exact atlas base plus explicit left/right side',
        requiredEvidence: ['base concept direct authority claim', 'independent Vietnamese side modifier attestation'],
        VietnameseRealization: 'approved source-specific side-placement rule required; no fallback spelling',
        disqualifiers: ['existing source conflict', 'scope qualifier', 'unsided source', 'branch/segment/part-whole relation'],
        testCases: [
          {id: 'LAT-001-UNAPPLIED', input: 'right renal artery', expected: null, status: 'NOT_APPLIED_NO_APPROVED_COMPONENTS'},
        ],
        appliedConceptCount: 0,
      },
      {
        ruleId: 'M04B2G-ORDINAL-001',
        version: '1.0.0',
        operation: 'PLACE_EXPLICIT_ORDINAL_WITH_EXACT_BASE',
        eligibleConceptPattern: 'exact numbered member of an attested family',
        requiredEvidence: ['exact family base authority claim', 'explicit ordinal modifier attestation', 'pinned Vietnamese placement convention'],
        VietnameseRealization: 'no composition emitted until a pinned placement convention is present',
        disqualifiers: ['branch hierarchy', 'segment', 'lobule', 'region boundary', 'aggregate/group/set', 'source conflict'],
        testCases: [
          {id: 'ORD-001-UNAPPLIED', input: 'first lumbar artery', expected: null, status: 'NOT_APPLIED_NO_APPROVED_COMPONENTS'},
        ],
        appliedConceptCount: 0,
      },
    ],
    derivedClaimsEmitted: 0,
    policy: 'No ad hoc derivation rules are executed in M04B2G; registry entries are explicit and conservative.',
  };
}

function summarizeSources(sourceRecords, claims, approvedNvhRows, nvhRejectedRows) {
  const bySource = new Map();
  for (const record of sourceRecords) {
    if (!bySource.has(record.spec.sourceId)) {
      bySource.set(record.spec.sourceId, {
        sourceId: record.spec.sourceId,
        sourceKey: record.spec.key,
        role: record.spec.role,
        sourcePath: record.spec.path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'),
        inputRows: 0,
        bilingualRows: 0,
        approvedRows: 0,
        directClaims: 0,
        contributedConcepts: new Set(),
        excludedRows: 0,
      });
    }
    const item = bySource.get(record.spec.sourceId);
    item.inputRows += 1;
    if (isBilingual(record.row)) item.bilingualRows += 1;
    if (record.approved) item.approvedRows += 1;
    if (record.claim) {
      item.directClaims += 1;
      item.contributedConcepts.add(record.claim.conceptId);
    }
    if (!record.approved) item.excludedRows += 1;
  }
  const sourceEntries = [...bySource.values()].map(item => ({
    ...item,
    contributedConcepts: item.contributedConcepts.size,
  }));
  const quarantinedBulk = readJsonl(join(CORPORA_DIR, 'nvh2008-bulk.jsonl'));
  const quarantinedRows = quarantinedBulk.filter(row => row.context !== 'EXACT_RECONSTRUCTED_SOURCE_ROW');
  sourceEntries.push({
    sourceId: 'NVH2008_UNAPPROVED_BULK',
    sourceKey: 'NVH2008_BULK_QUARANTINED',
    role: 'excluded_parser_integrity',
    sourcePath: 'data/terminology/research/corpora/nvh2008-bulk.jsonl',
    inputRows: quarantinedBulk.length,
    bilingualRows: null,
    approvedRows: 0,
    directClaims: 0,
    contributedConcepts: 0,
    excludedRows: quarantinedRows.length,
    allRowsExcluded: quarantinedBulk.length,
    exclusionReason: 'Parser-integrity gate: only m04b2e2r-nvh2008-exhaustive.jsonl EXACT_RECONSTRUCTED_SOURCE_ROW rows are eligible.',
  });
  for (const unavailable of UNAVAILABLE_REGISTERED_SOURCES) sourceEntries.push({...unavailable, inputRows: 0, directClaims: 0, contributedConcepts: 0});
  return {
    schemaVersion: 'M04B2G-SOURCE-CONTRIBUTION-1',
    sources: sourceEntries,
    totals: {
      directClaims: claims.length,
      conceptsWithDirectClaims: new Set(claims.map(claim => claim.conceptId)).size,
    },
    duplicatePacksExcluded: [
      {path: 'data/terminology/research/corpora/m04b2c-vi-authority.jsonl', reason: 'Exact duplicate of HMU2022/UMP2023_T2 rows; not counted as an independent authority.'},
    ],
  };
}

function createReport(summary, sourceContribution, registry) {
  const d = summary.terminalDispositionCounts;
  const pct = value => Number(((value / summary.totalConcepts) * 100).toFixed(2));
  const moh = summary.mohContribution;
  const nvh = summary.nvhContribution;
  const sourceRows = sourceContribution.sources.map(source => `| ${source.sourceId} | ${source.role ?? ''} | ${source.inputRows ?? 0} | ${source.directClaims ?? 0} | ${source.contributedConcepts ?? 0} |`).join('\n');
  const ruleRows = registry.rules.map(rule => `| ${rule.ruleId} | ${rule.appliedConceptCount} | ${rule.testCases.length} |`).join('\n');
  return `# M04B2G — Vietnamese translation closure\n\nThis research-only run closes deterministic bilingual accounting for the frozen atlas identity set. It does not choose preferred terms, perform medical review, or promote production terminology.\n\n## Closure\n\n| Measure | Count |\n|---|---:|\n| Total atlas concepts | ${summary.totalConcepts} |\n| Terminal concepts | ${summary.terminalConcepts} |\n| Unclassified | ${summary.unclassifiedConcepts} |\n| Starting eligible baseline | ${summary.currentBaselineEligible} |\n| Concepts with a Vietnamese candidate | ${summary.conceptsWithAtLeastOneVietnameseCandidate} (${pct(summary.conceptsWithAtLeastOneVietnameseCandidate)}%) |\n| Concepts with direct source-attested Vietnamese | ${summary.conceptsWithDirectSourceAttestedVietnamese} (${pct(summary.conceptsWithDirectSourceAttestedVietnamese)}%) |\n| Concepts with derived-only Vietnamese | ${summary.conceptsWithDerivedOnlyVietnamese} |\n| Concepts with multiple candidate forms | ${summary.conceptsWithMultipleCandidateForms} |\n| Concepts with zero Vietnamese candidate | ${summary.conceptsWithZeroVietnameseCandidate} (${pct(summary.conceptsWithZeroVietnameseCandidate)}%) |\n\n| Terminal disposition | Count |\n|---|---:|\n| MULTI_AUTHORITY_AGREEMENT | ${d.MULTI_AUTHORITY_AGREEMENT} |\n| DIRECT_AUTHORITY_TRANSLATION | ${d.DIRECT_AUTHORITY_TRANSLATION} |\n| AUTHORITY_VARIANT | ${d.AUTHORITY_VARIANT} |\n| SOURCE_CONFLICT | ${d.SOURCE_CONFLICT} |\n| CONTROLLED_DERIVED_TRANSLATION | ${d.CONTROLLED_DERIVED_TRANSLATION} |\n| SCOPE_REVIEW | ${d.SCOPE_REVIEW} |\n| IDENTITY_REVIEW | ${d.IDENTITY_REVIEW} |\n| NO_DIRECT_AUTHORITY_ATTESTATION | ${d.NO_DIRECT_AUTHORITY_ATTESTATION} |\n\n## MOH2025_BODY_STRUCTURE (1,506 rows)\n\nThe exclusive row ledger categories sum to ${moh.categorySum}. Exact identity/synonym match methods are reported separately; accepted direct candidates are an exclusive ledger category. SNOMED identifiers remain provenance and are never used as FMA identity.\n\n| Category | Count |\n|---|---:|\n| Exact localization identity match | ${moh.matchMethods.exactLocalizationIdentityMatch} |\n| Exact synonym localization match | ${moh.matchMethods.exactSynonymLocalizationMatch} |\n| Scope blocked | ${moh.categories.scopeBlocked} |\n| Laterality blocked | ${moh.categories.lateralityBlocked} |\n| Multiple atlas targets | ${moh.categories.multipleAtlasTargets} |\n| No atlas identity | ${moh.categories.noAtlasIdentity} |\n| Accepted direct candidate (exclusive category) | ${moh.acceptedDirectCandidate} |\n| Exclusive category sum | ${moh.categorySum} |\n\n## NVH2008 parser-integrity contribution\n\nOnly ${nvh.exactRetainedRowsUsed} approved EXACT_RECONSTRUCTED_SOURCE_ROW records were considered. ${nvh.quarantinedRowsExcluded} rows from the unapproved bulk access copy were excluded.\n\n| Measure | Count |\n|---|---:|\n| Exact retained rows used | ${nvh.exactRetainedRowsUsed} |\n| Concepts contributed | ${nvh.conceptsContributed} |\n| Unique contribution | ${nvh.uniqueContribution} |\n| Variants | ${nvh.variants} |\n| Conflicts | ${nvh.conflicts} |\n\n## Controlled derivation\n\nNo derived term was emitted.\n\n| Rule | Applied concepts | Test cases |\n|---|---:|---:|\n${ruleRows}\n\n## Source contribution\n\n| Source | Role | Input rows | Direct claims | Concepts |\n|---|---|---:|---:|---:|\n${sourceRows}\n\nRegistered sources without a local qualified corpus are recorded as unavailable in source-contribution.json. The duplicate M04B2C authority pack is excluded from independent-authority counts.\n\n## Production boundary\n\nsearchableVietnamese = 0, SOURCE_VERIFIED = 0, MEDICAL_REVIEWED = 0, releaseEligible = 0, and release = UNRELEASED. The output is research accounting only; preferredTerm remains null for every concept.\n`;
}

export function buildM04B2G() {
  mkdirSync(RESEARCH_DIR, {recursive: true});
  const atlas = readJson(ATLAS_PATH);
  if (atlas.concepts.length !== TOTAL_ATLAS_CONCEPTS) throw new Error(`Atlas concept count changed: ${atlas.concepts.length}`);
  const byName = atlasIdentityMap(atlas);
  const sourceRecords = [];
  const allClaims = [];
  const blockedByConcept = new Map();
  const mohCategories = {
    exactLocalizationIdentityMatch: 0,
    exactSynonymLocalizationMatch: 0,
    scopeBlocked: 0,
    lateralityBlocked: 0,
    multipleAtlasTargets: 0,
    noAtlasIdentity: 0,
    acceptedDirectCandidate: 0,
  };
  const mohMatchMethods = {
    exactLocalizationIdentityMatch: 0,
    exactSynonymLocalizationMatch: 0,
  };
  const mohAccountingRows = [];
  let approvedNvhRows = 0;
  let rejectedNvhRows = 0;

  for (const spec of SOURCE_SPECS) {
    const rows = readJsonl(spec.path);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const approved = Boolean(spec.approved(row));
      if (spec.sourceId === 'NVH2008' && approved) approvedNvhRows += 1;
      if (spec.sourceId === 'NVH2008' && !approved) rejectedNvhRows += 1;
      const bilingual = isBilingual(row);
      const identityOnly = spec.role === 'identity_only';
      const assessment = identityOnly || !bilingual
        ? {status: 'IDENTITY_ONLY', category: 'identityOnly', candidates: [], blockers: []}
        : assessLocalizationRow(row, byName, {moh: spec.sourceId === 'NATIONAL_BODY_TERMS_2025'});
      const atlasConcept = assessment.candidates?.length === 1 ? assessment.candidates[0] : null;
      let claim = null;
      if (approved && bilingual && !identityOnly && assessment.status === 'ACCEPTED_DIRECT_CANDIDATE' && atlasConcept) {
        claim = claimFromRow({row, spec, rowIndex, assessment, atlasConcept});
        allClaims.push(claim);
      }
      sourceRecords.push({spec, row, rowIndex, approved, assessment, claim});
      if (spec.sourceId === 'NATIONAL_BODY_TERMS_2025') {
        const category = assessment.category;
        if (claim) {
          mohCategories.acceptedDirectCandidate += 1;
          if (category === 'exactLocalizationIdentityMatch' || category === 'exactSynonymLocalizationMatch') mohMatchMethods[category] += 1;
        } else {
          if (!(category in mohCategories)) throw new Error(`Unknown MOH accounting category ${category}`);
          mohCategories[category] += 1;
          if (category === 'exactLocalizationIdentityMatch' || category === 'exactSynonymLocalizationMatch') mohMatchMethods[category] += 1;
        }
        mohAccountingRows.push({
          rowNumber: rowIndex + 1,
          rowFingerprint: stableSourceFingerprint(row),
          category,
          status: assessment.status,
          conceptIds: assessment.candidates.map(candidate => candidate.id),
          identityMethod: assessment.identityMethod,
          blockers: assessment.blockers,
          acceptedDirectCandidate: Boolean(claim),
          rawEnglish: row.english?.preferred ?? null,
          rawVietnamese: row.vietnamese?.preferred ?? null,
          snomedId: row.terminologyIds?.[0] ?? null,
          ministryCode: row.sourceCodes?.[0] ?? null,
        });
      }
      if (assessment.candidates?.length === 1 && assessment.status !== 'ACCEPTED_DIRECT_CANDIDATE') {
        const conceptId = assessment.candidates[0].id;
        if (!blockedByConcept.has(conceptId)) blockedByConcept.set(conceptId, []);
        blockedByConcept.get(conceptId).push({
          sourceId: spec.sourceId,
          sourceRevision: row.sourceRevision ?? row.corpusRevision ?? row.sourceEdition ?? null,
          rowFingerprint: stableSourceFingerprint(row),
          status: assessment.status,
          blockers: assessment.blockers,
          rawEnglish: assessment.rawEnglish,
          rawVietnamese: row.vietnamese?.preferred ?? null,
          sourceLocator: row.locator ?? null,
        });
      }
    }
  }

  const claimsByConcept = new Map();
  for (const claim of allClaims) {
    if (!claimsByConcept.has(claim.conceptId)) claimsByConcept.set(claim.conceptId, []);
    claimsByConcept.get(claim.conceptId).push(claim);
  }

  const decisions = [];
  const unresolved = [];
  const terminalCounts = Object.fromEntries(APPROVED_TERMINAL_DISPOSITIONS.map(disposition => [disposition, 0]));
  let conceptsWithCandidate = 0;
  let conceptsWithDirect = 0;
  let conceptsWithMultiple = 0;
  let conceptsWithZero = 0;
  let derivedOnly = 0;
  let nvhConcepts = new Set();
  let nvhConflictConcepts = new Set();
  let nvhVariantConcepts = new Set();

  for (const atlasConcept of atlas.concepts) {
    const directClaims = claimsByConcept.get(atlasConcept.id) ?? [];
    const directCandidateTerms = [...new Set(directClaims.map(claimTermKey))];
    const sourceKeys = new Set(directClaims.flatMap(claim => claim.provenance.map(ref => ref.independenceKey)));
    const termsBySource = new Map();
    for (const claim of directClaims) {
      const key = claim.sourceId;
      if (!termsBySource.has(key)) termsBySource.set(key, new Set());
      termsBySource.get(key).add(claimTermKey(claim));
      if (claim.sourceId === 'NVH2008') nvhConcepts.add(atlasConcept.id);
    }
    const blockedCandidateTerms = [...new Set((blockedByConcept.get(atlasConcept.id) ?? []).map(item => normalizeVietnameseForAgreement(item.rawVietnamese)).filter(Boolean))];
    const candidateTerms = [...new Set([...directCandidateTerms, ...blockedCandidateTerms])];
    const multipleAuthoritiesSame = directCandidateTerms.length === 1 && sourceKeys.size >= 2;
    const conflict = directCandidateTerms.length > 1;
    const variant = false;
    if (conflict && directClaims.some(claim => claim.sourceId === 'NVH2008')) nvhConflictConcepts.add(atlasConcept.id);
    if (variant && directClaims.some(claim => claim.sourceId === 'NVH2008')) nvhVariantConcepts.add(atlasConcept.id);
    if (directClaims.length > 0) {
      conceptsWithCandidate += 1;
      conceptsWithDirect += 1;
    }
    const blocked = blockedByConcept.get(atlasConcept.id) ?? [];
    if (directClaims.length === 0 && blocked.length === 0) {
      conceptsWithZero += 1;
    } else if (directClaims.length === 0 && blocked.length > 0) {
      conceptsWithCandidate += 1;
    }
    if (candidateTerms.length > 1) conceptsWithMultiple += 1;

    let terminalDisposition = 'NO_DIRECT_AUTHORITY_ATTESTATION';
    if (directClaims.length > 0 && conflict) terminalDisposition = 'SOURCE_CONFLICT';
    else if (directClaims.length > 0 && multipleAuthoritiesSame) terminalDisposition = 'MULTI_AUTHORITY_AGREEMENT';
    else if (directClaims.length > 0 && variant) terminalDisposition = 'AUTHORITY_VARIANT';
    else if (directClaims.length > 0) terminalDisposition = 'DIRECT_AUTHORITY_TRANSLATION';
    else if (blocked.some(item => item.status === 'SCOPE_BLOCKED' || item.status === 'LATERALITY_BLOCKED')) terminalDisposition = 'SCOPE_REVIEW';
    else if (blocked.some(item => item.status === 'MULTIPLE_ATLAS_TARGETS')) terminalDisposition = 'IDENTITY_REVIEW';
    terminalCounts[terminalDisposition] += 1;
    const decision = {
      conceptId: atlasConcept.id,
      atlasEnglish: atlasConcept.name,
      fmaId: atlasConcept.id,
      terminalDisposition,
      preferredTerm: null,
      directClaims,
      derivedClaims: [],
      candidateTerms,
      variants: variant ? directCandidateTerms : [],
      conflicts: conflict ? directCandidateTerms : [],
      blockers: blocked.flatMap(item => item.blockers),
      sources: [...new Set([...directClaims.map(claim => claim.sourceId), ...blocked.map(item => item.sourceId)])].sort(),
      provenance: [
        ...directClaims.flatMap(claim => claim.provenance),
        ...blocked.map(item => ({sourceId: item.sourceId, sourceRevision: item.sourceRevision, locator: item.sourceLocator, rawFingerprint: item.rowFingerprint, blockers: item.blockers})),
      ],
      releaseEligible: false,
    };
    decisions.push(decision);
    if (terminalDisposition !== 'DIRECT_AUTHORITY_TRANSLATION' && terminalDisposition !== 'MULTI_AUTHORITY_AGREEMENT' && terminalDisposition !== 'AUTHORITY_VARIANT' && terminalDisposition !== 'SOURCE_CONFLICT') {
      unresolved.push({
        conceptId: atlasConcept.id,
        atlasEnglish: atlasConcept.name,
        terminalDisposition,
        candidateTerms,
        blockers: decision.blockers,
        sourceIds: decision.sources,
        sourceEvidenceCount: blocked.length,
      });
    }
  }

  const derivationRules = makeDerivationRegistry();
  const nvhContributed = new Set(allClaims.filter(claim => claim.sourceId === 'NVH2008').map(claim => claim.conceptId));
  const sourceContribution = summarizeSources(sourceRecords, allClaims, approvedNvhRows, rejectedNvhRows);
  const mohCategorySum = Object.values(mohCategories).reduce((sum, value) => sum + value, 0);
  const conceptsWithCandidateSet = new Set([...claimsByConcept.keys(), ...blockedByConcept.keys()]);
  const summary = {
    schemaVersion: 'M04B2G-CLOSURE-SUMMARY-1',
    milestone: 'M04B2G',
    totalConcepts: atlas.concepts.length,
    terminalConcepts: decisions.length,
    unclassifiedConcepts: decisions.filter(decision => !APPROVED_TERMINAL_DISPOSITIONS.includes(decision.terminalDisposition)).length,
    currentBaselineEligible: CURRENT_BASELINE_ELIGIBLE,
    terminalDispositionCounts: terminalCounts,
    conceptsWithAtLeastOneVietnameseCandidate: conceptsWithCandidateSet.size,
    conceptsWithDirectSourceAttestedVietnamese: conceptsWithDirect,
    conceptsWithDerivedOnlyVietnamese: derivedOnly,
    conceptsWithMultipleCandidateForms: conceptsWithMultiple,
    conceptsWithZeroVietnameseCandidate: atlas.concepts.length - conceptsWithCandidateSet.size,
    coveragePercentages: {
      candidate: Number(((conceptsWithCandidateSet.size / atlas.concepts.length) * 100).toFixed(2)),
      direct: Number(((conceptsWithDirect / atlas.concepts.length) * 100).toFixed(2)),
      derivedOnly: 0,
    },
    mohContribution: {
      rows: EXPECTED_MOH_ROWS,
      categories: mohCategories,
      categorySum: mohCategorySum,
      matchMethods: mohMatchMethods,
      acceptedDirectCandidate: mohCategories.acceptedDirectCandidate,
      exactLocalizationIdentityMatch: mohMatchMethods.exactLocalizationIdentityMatch,
      exactSynonymLocalizationMatch: mohMatchMethods.exactSynonymLocalizationMatch,
      scopeBlocked: mohCategories.scopeBlocked,
      lateralityBlocked: mohCategories.lateralityBlocked,
      multipleAtlasTargets: mohCategories.multipleAtlasTargets,
      noAtlasIdentity: mohCategories.noAtlasIdentity,
      accountingRowCount: mohAccountingRows.length,
      uniqueAccountingRows: new Set(mohAccountingRows.map(row => row.rowFingerprint)).size,
      accountingRowDigest: sha256(JSON.stringify(mohAccountingRows)),
      accountingRows: mohAccountingRows,
    },
    nvhContribution: {
      exactRetainedRowsUsed: approvedNvhRows,
      conceptsContributed: nvhContributed.size,
      uniqueContribution: nvhContributed.size,
      variants: nvhVariantConcepts.size,
      conflicts: nvhConflictConcepts.size,
      quarantinedRowsExcluded: rejectedNvhRows + readJsonl(join(CORPORA_DIR, 'nvh2008-bulk.jsonl')).filter(row => row.context !== 'EXACT_RECONSTRUCTED_SOURCE_ROW').length,
    },
    derivationRuleContribution: derivationRules.rules.map(rule => ({ruleId: rule.ruleId, conceptCount: rule.appliedConceptCount, examples: rule.testCases.map(test => test.input), sourceDependencies: rule.requiredEvidence, rejectedCases: rule.disqualifiers})),
    productionSafety: {
      searchableVietnamese: 0,
      sourceVerified: 0,
      medicallyReviewed: 0,
      releaseEligible: 0,
      release: 'UNRELEASED',
    },
    policy: {
      aiTranslation: false,
      umlsRequired: false,
      strictFmaSnomedBridgeRequired: false,
      preferredTermAdjudication: false,
      medicalReview: false,
      productionPromotion: false,
      safeEnglishNormalization: 'Unicode NFKC, edge/collapsed whitespace, case, punctuation normalization only; scope words are retained.',
      vietnameseAgreement: 'NFC, whitespace and configured harmless punctuation only; no accent folding.',
      noMajorityOrAgeWinner: true,
    },
  };

  if (summary.totalConcepts !== TOTAL_ATLAS_CONCEPTS || summary.terminalConcepts !== TOTAL_ATLAS_CONCEPTS || summary.unclassifiedConcepts !== 0) {
    throw new Error(`M04B2G closure failed: ${summary.terminalConcepts}/${summary.totalConcepts} terminal, ${summary.unclassifiedConcepts} unclassified`);
  }
  if (mohCategorySum !== EXPECTED_MOH_ROWS || mohAccountingRows.length !== EXPECTED_MOH_ROWS || new Set(mohAccountingRows.map(row => row.rowFingerprint)).size !== EXPECTED_MOH_ROWS) {
    throw new Error(`MOH accounting failed: ${mohAccountingRows.length} rows, category sum ${mohCategorySum}`);
  }
  if (approvedNvhRows !== 430) throw new Error(`NVH parser-integrity approved row count changed: ${approvedNvhRows}`);

  writeJsonl(join(RESEARCH_DIR, 'translation-claims.jsonl'), allClaims);
  writeJsonl(join(RESEARCH_DIR, 'concept-decisions.jsonl'), decisions);
  writeJson(join(RESEARCH_DIR, 'derivation-rules.json'), derivationRules);
  writeJson(join(RESEARCH_DIR, 'closure-summary.json'), {...summary, mohContribution: {...summary.mohContribution, accountingRows: undefined}});
  writeJsonl(join(RESEARCH_DIR, 'unresolved-review.jsonl'), unresolved);
  writeJson(join(RESEARCH_DIR, 'source-contribution.json'), sourceContribution);

  const inputManifest = SOURCE_SPECS.map(spec => {
    const rows = readJsonl(spec.path);
    return {sourceId: spec.sourceId, sourceKey: spec.key, role: spec.role, path: spec.path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'), rows: rows.length, approvedRows: rows.filter(spec.approved).length, sha256: sha256File(spec.path)};
  });
  const productionHashes = Object.fromEntries(PRODUCTION_FILES.filter(existsSync).map(path => [path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'), sha256File(path)]));
  const outputPaths = [
    'data/terminology/research/m04b2g/translation-claims.jsonl',
    'data/terminology/research/m04b2g/concept-decisions.jsonl',
    'data/terminology/research/m04b2g/derivation-rules.json',
    'data/terminology/research/m04b2g/closure-summary.json',
    'data/terminology/research/m04b2g/unresolved-review.jsonl',
    'data/terminology/research/m04b2g/source-contribution.json',
  ];
  const outputHashes = Object.fromEntries(outputPaths.map(relative => [relative, sha256File(join(ROOT, relative))]));
  const runManifest = {
    schemaVersion: 'M04B2G-RUN-MANIFEST-1',
    milestone: 'M04B2G',
    git: {branch: gitValue(['branch', '--show-current'], 'unknown'), head: gitValue(['rev-parse', 'HEAD'], 'unknown')},
    atlas: {path: 'public/models/atlas.json', conceptCount: atlas.concepts.length, sha256: sha256File(ATLAS_PATH)},
    baseline: {eligibleConcepts: CURRENT_BASELINE_ELIGIBLE, source: 'data/terminology/research/m04b2e-bulk-match-results.json', note: 'Starting research baseline only; not a target.'},
    inputs: inputManifest,
    outputs: {
      translationClaims: 'data/terminology/research/m04b2g/translation-claims.jsonl',
      conceptDecisions: 'data/terminology/research/m04b2g/concept-decisions.jsonl',
      derivationRules: 'data/terminology/research/m04b2g/derivation-rules.json',
      closureSummary: 'data/terminology/research/m04b2g/closure-summary.json',
      unresolvedReview: 'data/terminology/research/m04b2g/unresolved-review.jsonl',
      sourceContribution: 'data/terminology/research/m04b2g/source-contribution.json',
    },
    outputHashes,
    productionHashes,
    productionSafety: summary.productionSafety,
    policy: summary.policy,
    determinism: {generatedAtOmitted: true, noRandomness: true, noNetwork: true, noAiGeneration: true},
  };
  writeJson(join(RESEARCH_DIR, 'run-manifest.json'), runManifest);
  writeFileSync(join(ROOT, 'docs', 'en-vi', 'M04B2G_TRANSLATION_CLOSURE_REPORT.md'), createReport(summary, sourceContribution, derivationRules), 'utf8');

  return {summary, claims: allClaims, decisions, unresolved, sourceContribution, derivationRules, runManifest};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = buildM04B2G();
  console.log(JSON.stringify({
    milestone: 'M04B2G',
    totalConcepts: result.summary.totalConcepts,
    terminalConcepts: result.summary.terminalConcepts,
    unclassifiedConcepts: result.summary.unclassifiedConcepts,
    directClaims: result.claims.length,
    candidateConcepts: result.summary.conceptsWithAtLeastOneVietnameseCandidate,
    terminalDispositionCounts: result.summary.terminalDispositionCounts,
    mohContribution: {...result.summary.mohContribution, accountingRows: undefined},
  }, null, 2));
}
