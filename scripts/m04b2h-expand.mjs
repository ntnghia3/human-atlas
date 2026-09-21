import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {normalizeVietnameseForAgreement, safeEnglish} from './m04b2g-closure.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const G2_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2g');
const OUT_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2h');
const CORPORA_DIR = join(ROOT, 'data', 'terminology', 'research', 'corpora');
const ATLAS_PATH = join(ROOT, 'public', 'models', 'atlas.json');
const TOTAL = 3432;
const APPROVED_NVH_ROWS = 430;
const MOH_ROWS = 1506;

const B2H_DISPOSITIONS = [
  'DIRECT_SOURCE_TRANSLATION',
  'MULTI_AUTHORITY_TRANSLATION',
  'CONTROLLED_DERIVED_TRANSLATION',
  'SOURCE_VARIANT',
  'SOURCE_CONFLICT',
  'SCOPE_REVIEW',
  'NO_SAFE_TRANSLATION_CANDIDATE',
];

const CORPUS_SPECS = [
  {sourceId: 'NVH2008', path: join(CORPORA_DIR, 'm04b2e2r-nvh2008-exhaustive.jsonl'), approved: row => row.context === 'EXACT_RECONSTRUCTED_SOURCE_ROW'},
  {sourceId: 'NATIONAL_BODY_TERMS_2025', path: join(CORPORA_DIR, 'm04b2e2r-moh2025-body-structure.jsonl'), approved: () => true},
  {sourceId: 'HMU2022', path: join(CORPORA_DIR, 'hmu2022-attestations.jsonl'), approved: () => true},
  {sourceId: 'UMP2023_T2', path: join(CORPORA_DIR, 'ump2023-t2-bulk-attestations.jsonl'), approved: () => true},
  {sourceId: 'FIPAT_TA2', path: join(CORPORA_DIR, 'fipat-ta2-2019.jsonl'), approved: () => true},
];

const G2_INPUTS = [
  'translation-claims.jsonl',
  'concept-decisions.jsonl',
  'closure-summary.json',
  'derivation-rules.json',
  'unresolved-review.jsonl',
  'source-contribution.json',
  'run-manifest.json',
];

const PRODUCTION_FILES = [
  join(ROOT, 'data', 'terminology', 'entries.json'),
  join(ROOT, 'data', 'terminology', 'reviewers.json'),
  join(ROOT, 'data', 'terminology', 'release.json'),
];

const BLACKLIST_TERMS = [
  'branch', 'segment', 'part', 'region', 'group', 'set', 'tissue', 'organ',
  'subdivision', 'tributary', 'lobule', 'fascia', 'root', 'ramus', 'eponym',
  'entire', 'structure', 'aggregate', 'compound',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
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

function gitValue(args, fallback = null) {
  try {
    return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
  } catch {
    return fallback;
  }
}

function englishTokens(value) {
  return safeEnglish(value).replace(/[()[\],;:]/g, ' ').split(/\s+/).filter(Boolean);
}

function vietnameseTokens(value) {
  return normalizeVietnameseForAgreement(value)
    .toLocaleLowerCase('vi')
    .replace(/[()[\],;:.]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function surfaceVietnamese(value) {
  return normalizeVietnameseForAgreement(value)
    .toLocaleLowerCase('vi')
    .replace(/[-–—]/g, ' ')
    .replace(/[()[\],;:.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function multisetDifference(a, b) {
  const remaining = new Map();
  for (const token of b) remaining.set(token, (remaining.get(token) ?? 0) + 1);
  const out = [];
  for (const token of a) {
    const count = remaining.get(token) ?? 0;
    if (count > 0) remaining.set(token, count - 1);
    else out.push(token);
  }
  return out;
}

function claimGroupsByEnglish(claims) {
  const map = new Map();
  for (const claim of claims) {
    const key = safeEnglish(claim.sourceEnglishRaw);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(claim);
  }
  return map;
}

function mohEnglishVariants(row) {
  const preferred = String(row.english?.preferred ?? row.sourceTermRaw ?? '');
  const base = preferred.replace(/\s*\(body structure\)\s*$/i, '');
  const variants = [
    ...(row.english?.aliases ?? []).map(value => ({value, method: 'EXACT_PINNED_SYNONYM'})),
    {value: base, method: 'EXACT_ENGLISH_BODY_WRAPPER'},
    {value: base.replace(/\s+structure$/i, ''), method: 'ALIAS_REMOVE_GENERIC_STRUCTURE_SUFFIX'},
    {value: base.replace(/^structure of\s+/i, ''), method: 'ALIAS_REMOVE_GENERIC_STRUCTURE_PREFIX'},
    {value: base.replace(/^entire\s+/i, ''), method: 'ALIAS_REMOVE_GENERIC_ENTIRE_PREFIX'},
  ].filter(item => safeEnglish(item.value)).map(item => ({...item, key: safeEnglish(item.value)}));
  const seen = new Set();
  return variants.filter(item => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function buildMohLocalizationClaims(rows, atlasByName, decisionsById) {
  const byConcept = new Map();
  const claims = [];
  rows.forEach((row, rowIndex) => {
    const matches = new Map();
    for (const variant of mohEnglishVariants(row)) {
      for (const concept of atlasByName.get(variant.key) ?? []) {
        matches.set(concept.id, {concept, method: variant.method});
      }
    }
    if (matches.size !== 1) return;
    const {concept, method} = [...matches.values()][0];
    const decision = decisionsById.get(concept.id);
    if (!decision || decision.terminalDisposition !== 'SCOPE_REVIEW') return;
    const blockers = decision.blockers ?? [];
    if (blockers.length !== 1 || blockers[0] !== 'SCOPE_QUALIFIER_STRUCTURE') return;
    if (method !== 'EXACT_PINNED_SYNONYM') return;
    const sourceVietnamese = row.vietnamese?.preferred ?? row.sourceVietnameseRaw ?? row.vietnameseTerm ?? null;
    const sourceEnglish = row.english?.preferred ?? row.sourceEnglishRaw ?? row.sourceTermRaw ?? null;
    if (!sourceVietnamese || !sourceEnglish) return;
    const fingerprint = sha256(JSON.stringify(row));
    const claim = {
      claimId: `NATIONAL_BODY_TERMS_2025:${row.locator?.entryId ?? rowIndex + 1}:${concept.id}:${fingerprint.slice(0, 16)}`,
      conceptId: concept.id,
      atlasEnglish: concept.name,
      sourceId: 'NATIONAL_BODY_TERMS_2025',
      sourceRevision: row.sourceRevision ?? row.sourceEdition ?? 'UNSPECIFIED',
      sourceEnglishRaw: sourceEnglish,
      sourceEnglishAliasesRaw: row.english?.aliases ?? [],
      sourceVietnameseRaw: sourceVietnamese,
      sourceVietnameseAliasesRaw: row.vietnamese?.aliases ?? [],
      sourceLocator: row.locator ?? null,
      claimType: 'DIRECT_LOCALIZATION_CANDIDATE',
      identityMethod: method,
      blockers,
      provenance: [{
        sourceId: 'NATIONAL_BODY_TERMS_2025',
        sourceRevision: row.sourceRevision ?? row.sourceEdition ?? 'UNSPECIFIED',
        sourceEdition: row.sourceEdition ?? null,
        locator: row.locator ?? null,
        sourcePath: 'data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl',
        rawFingerprint: fingerprint,
        identityMethod: method,
        previousGate: 'SCOPE_QUALIFIER_STRUCTURE_ONLY',
        independenceKey: `NATIONAL_BODY_TERMS_2025:${row.sourceRevision ?? row.sourceEdition ?? 'UNSPECIFIED'}`,
      }],
      sourceCodes: row.sourceCodes ?? [],
      terminologyIds: row.terminologyIds ?? [],
      snomedId: row.terminologyIds?.[0] ?? null,
      ministryCode: row.sourceCodes?.[0] ?? null,
    };
    claims.push(claim);
    if (!byConcept.has(concept.id)) byConcept.set(concept.id, []);
    byConcept.get(concept.id).push(claim);
  });
  return {byConcept, claims};
}

function buildConceptIndexes(atlas, claims, decisions) {
  const atlasById = new Map(atlas.concepts.map(concept => [concept.id, concept]));
  const atlasByName = new Map();
  for (const concept of atlas.concepts) {
    const key = safeEnglish(concept.name);
    if (!atlasByName.has(key)) atlasByName.set(key, []);
    atlasByName.get(key).push(concept);
  }
  const claimsByConcept = new Map();
  for (const claim of claims) {
    if (!claimsByConcept.has(claim.conceptId)) claimsByConcept.set(claim.conceptId, []);
    claimsByConcept.get(claim.conceptId).push(claim);
  }
  return {atlasById, atlasByName, claimsByConcept, decisionsById: new Map(decisions.map(decision => [decision.conceptId, decision]))};
}

function directInfo(conceptId, claimsByConcept) {
  const claims = claimsByConcept.get(conceptId) ?? [];
  const terms = unique(claims.map(claim => claim.sourceVietnameseRaw));
  const agreementTerms = unique(claims.map(claim => normalizeVietnameseForAgreement(claim.sourceVietnameseRaw)));
  const surfaceTerms = unique(claims.map(claim => surfaceVietnamese(claim.sourceVietnameseRaw)));
  const sources = unique(claims.map(claim => claim.sourceId));
  let kind = null;
  if (claims.length === 0) kind = 'NONE';
  else if (agreementTerms.length > 1 && surfaceTerms.length === 1) kind = 'SOURCE_VARIANT';
  else if (agreementTerms.length > 1) kind = 'SOURCE_CONFLICT';
  else if (sources.length >= 2) kind = 'MULTI_AUTHORITY_TRANSLATION';
  else kind = 'DIRECT_SOURCE_TRANSLATION';
  return {claims, terms, agreementTerms, surfaceTerms, sources, kind};
}

function pairExamples(claimsByEnglish, first, second) {
  const examples = [];
  for (const [english, firstClaims] of claimsByEnglish) {
    if (!english.startsWith(`${first} `)) continue;
    const secondEnglish = `${second} ${english.slice(first.length + 1)}`;
    const secondClaims = claimsByEnglish.get(secondEnglish);
    if (!secondClaims) continue;
    const firstTerms = unique(firstClaims.map(claim => claim.sourceVietnameseRaw));
    const secondTerms = unique(secondClaims.map(claim => claim.sourceVietnameseRaw));
    if (firstTerms.length !== 1 || secondTerms.length !== 1) continue;
    const firstTokens = vietnameseTokens(firstTerms[0]);
    const secondTokens = vietnameseTokens(secondTerms[0]);
    const firstExtra = multisetDifference(firstTokens, secondTokens);
    const secondExtra = multisetDifference(secondTokens, firstTokens);
    if (firstExtra.length !== 1 || secondExtra.length !== 1) continue;
    const commonA = multisetDifference(firstTokens, firstExtra);
    const commonB = multisetDifference(secondTokens, secondExtra);
      if (commonA.join('|') !== commonB.join('|')) continue;
      examples.push({
        english,
      firstEnglish: first,
      secondEnglish: second,
      firstVietnamese: firstTerms[0],
      secondVietnamese: secondTerms[0],
      firstRealization: firstExtra[0],
      secondRealization: secondExtra[0],
      claimIds: [...firstClaims, ...secondClaims].map(claim => claim.claimId),
    });
  }
  return examples;
}

function ordinalExamples(claimsByEnglish, ordinals) {
  const examples = [];
  for (const first of ordinals) {
    for (const second of ordinals) {
      if (first >= second) continue;
      for (const [english, firstClaims] of claimsByEnglish) {
        if (!english.startsWith(`${first} `)) continue;
        const secondEnglish = `${second} ${english.slice(first.length + 1)}`;
        const secondClaims = claimsByEnglish.get(secondEnglish);
        if (!secondClaims) continue;
        const firstTerms = unique(firstClaims.map(claim => claim.sourceVietnameseRaw));
        const secondTerms = unique(secondClaims.map(claim => claim.sourceVietnameseRaw));
        if (firstTerms.length !== 1 || secondTerms.length !== 1) continue;
        const firstTokens = vietnameseTokens(firstTerms[0]);
        const secondTokens = vietnameseTokens(secondTerms[0]);
        const firstExtra = multisetDifference(firstTokens, secondTokens);
        const secondExtra = multisetDifference(secondTokens, firstTokens);
        if (firstExtra.length !== 1 || secondExtra.length !== 1) continue;
        if (multisetDifference(firstTokens, firstExtra).join('|') !== multisetDifference(secondTokens, secondExtra).join('|')) continue;
        examples.push({
          english: `${first} ${english.slice(first.length + 1)}`,
          firstEnglish: first,
          secondEnglish: second,
          firstVietnamese: firstTerms[0],
          secondVietnamese: secondTerms[0],
          firstRealization: firstExtra[0],
          secondRealization: secondExtra[0],
          claimIds: [...firstClaims, ...secondClaims].map(claim => claim.claimId),
        });
      }
    }
  }
  return examples;
}

function buildRules(claims, claimsByConcept) {
  const claimsByEnglish = claimGroupsByEnglish(claims);
  const paired = [
    {ruleId: 'M04B2H-LATERALITY-SUFFIX-001', version: '1.0.0', family: 'laterality realization', first: 'right', second: 'left', minimum: 3, outputTemplate: '[BASE_VI] [right:phải|left:trái]', disqualifiers: ['source conflict', 'scope review', 'branch/segment hierarchy', 'unsided target', 'ambiguous base term']},
    {ruleId: 'M04B2H-SUPERIOR-INFERIOR-SUFFIX-001', version: '1.0.0', family: 'superior/inferior realization', first: 'superior', second: 'inferior', minimum: 3, outputTemplate: '[BASE_VI] [superior:trên|inferior:dưới]', disqualifiers: ['source conflict', 'scope review', 'compound modifier', 'ambiguous base term']},
    {ruleId: 'M04B2H-ANTERIOR-POSTERIOR-SUFFIX-001', version: '1.0.0', family: 'anterior/posterior realization', first: 'anterior', second: 'posterior', minimum: 3, outputTemplate: '[BASE_VI] [anterior:trước|posterior:sau]', disqualifiers: ['source conflict', 'scope review', 'compound modifier', 'ambiguous base term']},
  ];
  const rules = [];
  for (const spec of paired) {
    const examples = pairExamples(claimsByEnglish, spec.first, spec.second);
    const realizationSets = {
      [spec.first]: unique(examples.map(example => example.firstRealization)),
      [spec.second]: unique(examples.map(example => example.secondRealization)),
    };
    const enabled = examples.length >= spec.minimum && realizationSets[spec.first].length === 1 && realizationSets[spec.second].length === 1;
    rules.push({
      ruleId: spec.ruleId,
      ruleVersion: spec.version,
      family: spec.family,
      enabled,
      sourceExamples: examples,
      requiredComponents: [
        {englishComponent: spec.first, vietnameseRealization: realizationSets[spec.first]?.[0] ?? null, sourceEvidenceIds: examples.flatMap(example => example.claimIds)},
        {englishComponent: spec.second, vietnameseRealization: realizationSets[spec.second]?.[0] ?? null, sourceEvidenceIds: examples.flatMap(example => example.claimIds)},
      ],
      outputTemplate: spec.outputTemplate,
      disqualifiers: spec.disqualifiers,
      minimumEvidenceCount: spec.minimum,
      tests: examples.slice(0, 4).map(example => ({input: example.english, expectedPair: [example.firstVietnamese, example.secondVietnamese], status: 'SOURCE_DEMONSTRATED'})),
      realizations: realizationSets,
      conceptsEvaluated: 0,
      conceptsAccepted: 0,
      conceptsRejected: 0,
      rejectionReasons: {},
    });
  }
  const ordinalPairs = ordinalExamples(claimsByEnglish, ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']);
  const ordinalRealizations = {};
  for (const example of ordinalPairs) {
    ordinalRealizations[example.firstEnglish] ??= new Set();
    ordinalRealizations[example.secondEnglish] ??= new Set();
    ordinalRealizations[example.firstEnglish].add(example.firstRealization);
    ordinalRealizations[example.secondEnglish].add(example.secondRealization);
  }
  const ordinalMap = {};
  for (const example of ordinalPairs) {
    ordinalMap[example.firstEnglish] = [...(ordinalRealizations[example.firstEnglish] ?? [])];
    ordinalMap[example.secondEnglish] = [...(ordinalRealizations[example.secondEnglish] ?? [])];
  }
  const ordinalRule = {
    ruleId: 'M04B2H-ORDINAL-SUFFIX-001',
    ruleVersion: '1.0.0',
    family: 'numbered structure realization',
    enabled: ordinalPairs.length >= 1 && Object.values(ordinalMap).every(values => values.length === 1),
    sourceExamples: ordinalPairs,
    requiredComponents: Object.entries(ordinalMap).map(([englishComponent, values]) => ({englishComponent, vietnameseRealization: values[0], sourceEvidenceIds: ordinalPairs.flatMap(example => example.claimIds)})),
    outputTemplate: '[BASE_VI] [ordinal realization]',
    disqualifiers: ['source conflict', 'scope review', 'branch/segment/lobule hierarchy', 'ambiguous word order', 'unattested ordinal'],
    minimumEvidenceCount: 2,
    tests: ordinalPairs.slice(0, 4).map(example => ({input: example.english, expected: example.firstVietnamese, status: 'SOURCE_DEMONSTRATED'})),
    realizations: Object.fromEntries(Object.entries(ordinalMap).map(([key, values]) => [key, values[0]])),
    conceptsEvaluated: 0,
    conceptsAccepted: 0,
    conceptsRejected: 0,
    rejectionReasons: {},
  };
  rules.push(ordinalRule);
  return {rules, claimsByEnglish};
}

function addRejection(rule, reason) {
  rule.conceptsRejected += 1;
  rule.rejectionReasons[reason] = (rule.rejectionReasons[reason] ?? 0) + 1;
}

function isBlacklisted(name) {
  const lower = safeEnglish(name);
  return BLACKLIST_TERMS.some(term => lower.includes(term));
}

function buildAuthorityLexicon(claims, rules, claimsByConcept, localizationClaims = []) {
  const entries = new Map();
  const add = (key, value) => {
    if (!entries.has(key)) entries.set(key, {...value, sourceEvidenceIds: [], exampleCompleteTerms: [], ambiguities: []});
    const entry = entries.get(key);
    for (const id of value.sourceEvidenceIds ?? []) if (!entry.sourceEvidenceIds.includes(id)) entry.sourceEvidenceIds.push(id);
    for (const example of value.exampleCompleteTerms ?? []) if (!entry.exampleCompleteTerms.some(item => item.english === example.english && item.vietnamese === example.vietnamese)) entry.exampleCompleteTerms.push(example);
    for (const item of value.vietnameseRealizations ?? []) if (!entry.vietnameseRealizations.includes(item)) entry.vietnameseRealizations.push(item);
    entry.ambiguities = entry.vietnameseRealizations.length > 1 ? entry.vietnameseRealizations : [];
  };
  for (const claim of claims) {
    const key = `TERM:${safeEnglish(claim.sourceEnglishRaw)}`;
    add(key, {
      englishComponent: claim.sourceEnglishRaw,
      vietnameseRealizations: [claim.sourceVietnameseRaw],
      semanticRole: 'complete_anatomical_term',
      allowedPosition: 'whole_term',
      confidence: 'DIRECT_SOURCE_ATTESTED',
      sourceEvidenceIds: [claim.claimId],
      exampleCompleteTerms: [{english: claim.sourceEnglishRaw, vietnamese: claim.sourceVietnameseRaw}],
    });
  }
  for (const claim of localizationClaims) {
    const key = `TERM:${safeEnglish(claim.sourceEnglishRaw)}`;
    add(key, {
      englishComponent: claim.sourceEnglishRaw,
      vietnameseRealizations: [claim.sourceVietnameseRaw],
      semanticRole: 'direct_localization_source_term',
      allowedPosition: 'whole_term',
      confidence: 'DIRECT_LOCALIZATION_SOURCE_SCOPE_GATE',
      sourceEvidenceIds: [claim.claimId],
      exampleCompleteTerms: [{english: claim.sourceEnglishRaw, vietnamese: claim.sourceVietnameseRaw}],
    });
  }
  for (const rule of rules) {
    for (const component of rule.requiredComponents) {
      if (!component.vietnameseRealization) continue;
      const key = `COMPONENT:${safeEnglish(component.englishComponent)}`;
      add(key, {
        englishComponent: component.englishComponent,
        vietnameseRealizations: [component.vietnameseRealization],
        semanticRole: rule.family,
        allowedPosition: 'suffix_after_base',
        confidence: rule.enabled ? 'PATTERN_DEMONSTRATED' : 'PATTERN_DISABLED',
        sourceEvidenceIds: component.sourceEvidenceIds,
        exampleCompleteTerms: rule.sourceExamples.map(example => ({english: example.english, vietnamese: example.firstVietnamese})),
      });
    }
  }
  for (const [conceptId, conceptClaims] of claimsByConcept) {
    if (conceptClaims.length !== 1) continue;
    const claim = conceptClaims[0];
    if (englishTokens(claim.sourceEnglishRaw).length !== 1) continue;
    const key = `HEAD:${safeEnglish(claim.sourceEnglishRaw)}`;
    add(key, {
      englishComponent: claim.sourceEnglishRaw,
      vietnameseRealizations: [claim.sourceVietnameseRaw],
      semanticRole: 'standalone_anatomical_head',
      allowedPosition: 'base_or_head',
      confidence: 'DIRECT_STANDALONE_ATTESTED',
      sourceEvidenceIds: [claim.claimId],
      exampleCompleteTerms: [{english: claim.sourceEnglishRaw, vietnamese: claim.sourceVietnameseRaw}],
    });
  }
  return {
    schemaVersion: 'M04B2H-AUTHORITY-COMPONENT-LEXICON-1',
    sourcePolicy: 'Only M04B2G direct source claims and source-demonstrated paired patterns are eligible.',
    componentCount: entries.size,
    components: [...entries.values()].map(entry => ({...entry, sourceEvidenceIds: unique(entry.sourceEvidenceIds), exampleCompleteTerms: entry.exampleCompleteTerms.slice(0, 20)})),
  };
}

function buildCandidateFromClaimGroup(info, concept) {
  const terms = unique(info.claims.map(claim => claim.sourceVietnameseRaw));
  const groups = new Map();
  for (const claim of info.claims) {
    const key = claim.sourceVietnameseRaw;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(claim);
  }
  return [...groups.entries()].map(([term, termClaims]) => ({
    conceptId: concept.id,
    atlasEnglish: concept.name,
    vietnamese: term,
    candidateType: info.kind === 'MULTI_AUTHORITY_TRANSLATION' && terms.length === 1 ? 'MULTI_AUTHORITY' : 'DIRECT_SOURCE',
    sourceClaims: termClaims.map(claim => claim.claimId),
    componentEvidence: [],
    compositionRuleId: null,
    blockers: info.kind === 'SOURCE_CONFLICT' ? ['SOURCE_CONFLICT_PRESERVED_NO_WINNER'] : info.kind === 'SOURCE_VARIANT' ? ['SOURCE_VARIANT_PRESERVED_NO_WINNER'] : [],
    provenance: termClaims.flatMap(claim => claim.provenance),
    productionEligible: false,
  }));
}

function buildLocalizationCandidates(localizationClaims, concept) {
  const byTerm = new Map();
  for (const claim of localizationClaims) {
    if (!byTerm.has(claim.sourceVietnameseRaw)) byTerm.set(claim.sourceVietnameseRaw, []);
    byTerm.get(claim.sourceVietnameseRaw).push(claim);
  }
  return [...byTerm.entries()].map(([term, termClaims]) => ({
    conceptId: concept.id,
    atlasEnglish: concept.name,
    vietnamese: term,
    candidateType: 'DIRECT_SOURCE',
    sourceClaims: termClaims.map(claim => claim.claimId),
    componentEvidence: [{
      componentEnglish: concept.name,
      vietnameseRealization: term,
      semanticRole: 'direct_localization_source_term',
      sourceEvidenceIds: termClaims.map(claim => claim.claimId),
    }],
    compositionRuleId: null,
    blockers: [],
    provenance: [
      ...termClaims.flatMap(claim => claim.provenance),
      {assertion: 'DIRECT_LOCALIZATION_CANDIDATE', gate: 'EXACT_PINNED_SYNONYM_WITH_STRUCTURE_ONLY_BLOCKER'},
    ],
    productionEligible: false,
    localizationDisposition: 'DIRECT_LOCALIZATION_CANDIDATE',
  }));
}

function deriveCandidates({atlas, indexes, rules, claimsByConcept}) {
  const derived = [];
  const derivedByConcept = new Map();
  for (const rule of rules) {
    for (const concept of atlas.concepts) {
      const decision = indexes.decisionsById.get(concept.id);
      if (!decision || decision.terminalDisposition !== 'NO_DIRECT_AUTHORITY_ATTESTATION') continue;
      rule.conceptsEvaluated += 1;
      const nameTokens = englishTokens(concept.name);
      const modifier = nameTokens[0];
      const rawRealization = rule.realizations?.[modifier];
      const realization = Array.isArray(rawRealization) && rawRealization.length === 1 ? rawRealization[0] : rawRealization;
      if (!rule.enabled || !realization) {
        addRejection(rule, !rule.enabled ? 'RULE_DISABLED_OR_INSUFFICIENT_EVIDENCE' : 'UNATTESTED_MODIFIER');
        continue;
      }
      if (nameTokens.length < 2) {
        addRejection(rule, 'NO_BASE_TERM');
        continue;
      }
      if (isBlacklisted(concept.name)) {
        addRejection(rule, 'BLACKLISTED_SCOPE_OR_HIERARCHY');
        continue;
      }
      const baseEnglish = nameTokens.slice(1).join(' ');
      const baseConcepts = indexes.atlasByName.get(baseEnglish) ?? [];
      if (baseConcepts.length !== 1) {
        addRejection(rule, baseConcepts.length === 0 ? 'NO_UNAMBIGUOUS_BASE_IDENTITY' : 'MULTIPLE_BASE_IDENTITIES');
        continue;
      }
      const baseConcept = baseConcepts[0];
      const baseDecision = indexes.decisionsById.get(baseConcept.id);
      const baseInfo = directInfo(baseConcept.id, claimsByConcept);
      if (!baseDecision || baseDecision.terminalDisposition === 'SOURCE_CONFLICT' || baseDecision.terminalDisposition === 'SCOPE_REVIEW') {
        addRejection(rule, 'BASE_CONFLICT_OR_SCOPE_REVIEW');
        continue;
      }
      if (baseInfo.claims.length === 0 || baseInfo.terms.length !== 1 || baseInfo.agreementTerms.length !== 1 || baseInfo.surfaceTerms.length !== 1) {
        addRejection(rule, 'AMBIGUOUS_BASE_TERM');
        continue;
      }
      const baseTerm = baseInfo.terms[0];
      const vietnamese = `${baseTerm} ${realization}`.trim();
      const baseEvidence = baseInfo.claims.map(claim => ({
        componentEnglish: baseEnglish,
        vietnameseRealization: baseTerm,
        semanticRole: 'direct_base_term',
        sourceEvidenceIds: [claim.claimId],
      }));
      const modifierEvidenceIds = unique(rule.sourceExamples.flatMap(example => example.claimIds));
      const modifierEvidence = [{
        componentEnglish: modifier,
        vietnameseRealization: realization,
        semanticRole: rule.family,
        sourceEvidenceIds: modifierEvidenceIds,
      }];
      const sourceClaims = unique([...baseInfo.claims.map(claim => claim.claimId), ...modifierEvidenceIds]);
      const provenance = [
        ...baseInfo.claims.flatMap(claim => claim.provenance),
        ...modifierEvidenceIds.flatMap(id => {
          const claim = indexes.claimById.get(id);
          return claim?.provenance ?? [];
        }),
        {ruleId: rule.ruleId, ruleVersion: rule.ruleVersion, assertion: 'CONTROLLED_SOURCE_DEMONSTRATED_COMPOSITION'},
      ];
      const candidate = {
        conceptId: concept.id,
        atlasEnglish: concept.name,
        vietnamese,
        candidateType: 'CONTROLLED_DERIVED',
        sourceClaims,
        componentEvidence: [...baseEvidence, ...modifierEvidence],
        compositionRuleId: rule.ruleId,
        compositionRuleVersion: rule.ruleVersion,
        blockers: [],
        provenance,
        productionEligible: false,
        derivedFromConceptIds: [baseConcept.id],
        sourceDependencies: unique([...baseInfo.claims.map(claim => claim.sourceId), ...modifierEvidenceIds.map(id => indexes.claimById.get(id)?.sourceId).filter(Boolean)]),
      };
      if (derivedByConcept.has(concept.id)) {
        const previous = derivedByConcept.get(concept.id);
        const previousIndex = derived.indexOf(previous);
        if (previousIndex >= 0) derived.splice(previousIndex, 1);
        derivedByConcept.delete(concept.id);
        addRejection(rule, 'AMBIGUOUS_MULTIPLE_RULE_OUTPUTS');
        continue;
      }
      derivedByConcept.set(concept.id, candidate);
      derived.push(candidate);
      rule.conceptsAccepted += 1;
    }
  }
  return derived;
}

function buildConceptCandidates({atlas, indexes, claimsByConcept, localizationByConcept, derived}) {
  const derivedByConcept = new Map(derived.map(candidate => [candidate.conceptId, candidate]));
  const directCandidates = [];
  const conceptCandidates = [];
  const residual = [];
  const counts = Object.fromEntries(B2H_DISPOSITIONS.map(disposition => [disposition, 0]));
  for (const concept of atlas.concepts) {
    const info = directInfo(concept.id, claimsByConcept);
    const direct = info.claims.length > 0 ? buildCandidateFromClaimGroup(info, concept) : [];
    const localized = info.claims.length === 0 ? buildLocalizationCandidates(localizationByConcept.get(concept.id) ?? [], concept) : [];
    const directUsable = [...direct, ...localized];
    directCandidates.push(...direct);
    directCandidates.push(...localized);
    let disposition;
    let usable = [...directUsable];
    if (info.claims.length > 0) {
      disposition = info.kind;
    } else if (localized.length > 0) {
      disposition = 'DIRECT_SOURCE_TRANSLATION';
    } else if (indexes.decisionsById.get(concept.id)?.terminalDisposition === 'SCOPE_REVIEW') {
      disposition = 'SCOPE_REVIEW';
      usable = [];
    } else if (derivedByConcept.has(concept.id)) {
      disposition = 'CONTROLLED_DERIVED_TRANSLATION';
      usable = [derivedByConcept.get(concept.id)];
    } else {
      disposition = 'NO_SAFE_TRANSLATION_CANDIDATE';
      usable = [];
    }
    counts[disposition] += 1;
    const decision = indexes.decisionsById.get(concept.id);
    const blockers = [
      ...(localized.length > 0 ? [] : (decision?.blockers ?? [])),
      ...(info.kind === 'SOURCE_CONFLICT' ? ['SOURCE_CONFLICT_PRESERVED_NO_WINNER'] : []),
    ];
    const provenance = usable.flatMap(candidate => candidate.provenance);
    const record = {
      conceptId: concept.id,
      atlasEnglish: concept.name,
      candidateDisposition: disposition,
      candidates: usable,
      directCandidates: directUsable,
      derivedCandidates: derivedByConcept.has(concept.id) ? [derivedByConcept.get(concept.id)] : [],
      blockers: unique(blockers),
      provenance,
      productionEligible: false,
      ...(localized.length > 0 ? {
        localizationReview: {
          previousDisposition: 'SCOPE_REVIEW',
          previousBlockers: decision?.blockers ?? [],
          gate: 'EXACT_PINNED_SYNONYM_WITH_STRUCTURE_ONLY_BLOCKER',
        },
      } : {}),
    };
    conceptCandidates.push(record);
    if (disposition === 'SCOPE_REVIEW' || disposition === 'SOURCE_CONFLICT' || disposition === 'NO_SAFE_TRANSLATION_CANDIDATE') {
      residual.push({
        conceptId: concept.id,
        atlasEnglish: concept.name,
        residualDisposition: disposition,
        blockers: record.blockers,
        sourceClaims: direct.flatMap(candidate => candidate.sourceClaims),
        candidateTerms: direct.map(candidate => candidate.vietnamese),
        provenance: record.provenance,
        productionEligible: false,
      });
    }
  }
  return {directCandidates, conceptCandidates, residual, counts};
}

function loadInputs() {
  const atlas = readJson(ATLAS_PATH);
  const claims = readJsonl(join(G2_DIR, 'translation-claims.jsonl'));
  const decisions = readJsonl(join(G2_DIR, 'concept-decisions.jsonl'));
  const closureSummary = readJson(join(G2_DIR, 'closure-summary.json'));
  const derivationRules = readJson(join(G2_DIR, 'derivation-rules.json'));
  const unresolvedReview = readJsonl(join(G2_DIR, 'unresolved-review.jsonl'));
  const sourceContribution = readJson(join(G2_DIR, 'source-contribution.json'));
  const g2RunManifest = readJson(join(G2_DIR, 'run-manifest.json'));
  const g2Files = Object.fromEntries(G2_INPUTS.map(name => [name, {path: join(G2_DIR, name), sha256: sha256File(join(G2_DIR, name))}]));
  const corpusRows = Object.fromEntries(CORPUS_SPECS.map(spec => [spec.sourceId, readJsonl(spec.path)]));
  const corpora = CORPUS_SPECS.map(spec => {
    const rows = corpusRows[spec.sourceId];
    return {sourceId: spec.sourceId, path: spec.path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'), rows: rows.length, approvedRows: rows.filter(spec.approved).length, sha256: sha256File(spec.path)};
  });
  if (atlas.concepts.length !== TOTAL) throw new Error(`Expected ${TOTAL} atlas concepts, got ${atlas.concepts.length}`);
  if (claims.length !== 472 || decisions.length !== TOTAL) throw new Error('M04B2G input dimensions changed');
  if (closureSummary.conceptsWithAtLeastOneVietnameseCandidate !== 1017 || closureSummary.conceptsWithDirectSourceAttestedVietnamese !== 418) throw new Error('M04B2G baseline changed');
  if (derivationRules.milestone !== 'M04B2G' || unresolvedReview.length === 0 || !Array.isArray(sourceContribution.sources) || sourceContribution.totals?.directClaims !== 472 || g2RunManifest.milestone !== 'M04B2G') throw new Error('M04B2G companion artifacts changed');
  if (corpora.find(item => item.sourceId === 'NVH2008')?.approvedRows !== APPROVED_NVH_ROWS) throw new Error('Approved NVH corpus dimension changed');
  if (corpora.find(item => item.sourceId === 'NATIONAL_BODY_TERMS_2025')?.rows !== MOH_ROWS) throw new Error('MOH corpus dimension changed');
  return {atlas, claims, decisions, closureSummary, derivationRules, unresolvedReview, sourceContribution, g2RunManifest, g2Files, corpora, corpusRows};
}

export function buildM04B2H() {
  mkdirSync(OUT_DIR, {recursive: true});
  const inputs = loadInputs();
  const indexes = buildConceptIndexes(inputs.atlas, inputs.claims, inputs.decisions);
  indexes.claimById = new Map(inputs.claims.map(claim => [claim.claimId, claim]));
  const claimsByConcept = indexes.claimsByConcept;
  const localization = buildMohLocalizationClaims(inputs.corpusRows.NATIONAL_BODY_TERMS_2025 ?? [], indexes.atlasByName, indexes.decisionsById);
  const {rules, claimsByEnglish} = buildRules(inputs.claims, claimsByConcept);
  const lexicon = buildAuthorityLexicon(inputs.claims, rules, claimsByConcept, localization.claims);
  const derived = deriveCandidates({atlas: inputs.atlas, indexes, rules, claimsByConcept});
  const candidates = buildConceptCandidates({atlas: inputs.atlas, indexes, claimsByConcept, localizationByConcept: localization.byConcept, derived});
  const directConcepts = new Set(inputs.claims.map(claim => claim.conceptId));
  const localizationConcepts = new Set(localization.byConcept.keys());
  const directUsableConcepts = new Set([...directConcepts, ...localizationConcepts]);
  const derivedConcepts = new Set(derived.map(candidate => candidate.conceptId));
  const scopeConcepts = new Set(inputs.decisions.filter(decision => decision.terminalDisposition === 'SCOPE_REVIEW').map(decision => decision.conceptId));
  const conflictConcepts = new Set(inputs.decisions.filter(decision => decision.terminalDisposition === 'SOURCE_CONFLICT').map(decision => decision.conceptId));
  const beforeCandidate = inputs.closureSummary.conceptsWithAtLeastOneVietnameseCandidate;
  const afterCandidate = beforeCandidate + derivedConcepts.size;
  const noSafe = candidates.counts.NO_SAFE_TRANSLATION_CANDIDATE;
  const productionSafety = {searchableVietnamese: 0, sourceVerified: 0, medicallyReviewed: 0, releaseEligible: 0, release: 'UNRELEASED'};
  const summary = {
    schemaVersion: 'M04B2H-COVERAGE-SUMMARY-1',
    milestone: 'M04B2H',
    totalConcepts: TOTAL,
    processedConcepts: candidates.conceptCandidates.length,
    unclassifiedConcepts: candidates.conceptCandidates.filter(record => !B2H_DISPOSITIONS.includes(record.candidateDisposition)).length,
    before: {m04b2gCandidateConcepts: beforeCandidate, m04b2gDirectSourceAttestedConcepts: inputs.closureSummary.conceptsWithDirectSourceAttestedVietnamese},
    after: {
      conceptsWithAnyVietnameseCandidate: afterCandidate,
      conceptsWithAnyUsableVietnameseCandidate: directUsableConcepts.size + derivedConcepts.size,
      conceptsWithUsableCandidate: directUsableConcepts.size + derivedConcepts.size,
      directUsableConcepts: directUsableConcepts.size,
      directSourceAttestedConcepts: directConcepts.size,
      directLocalizationConcepts: localizationConcepts.size,
      directCandidateRecords: candidates.directCandidates.length,
      multiAuthorityConcepts: candidates.counts.MULTI_AUTHORITY_TRANSLATION,
      controlledDerivedConcepts: derivedConcepts.size,
      sourceVariantConcepts: candidates.counts.SOURCE_VARIANT,
      sourceConflictConcepts: candidates.counts.SOURCE_CONFLICT,
      scopeReviewConcepts: candidates.counts.SCOPE_REVIEW,
      noSafeTranslationCandidateConcepts: noSafe,
      candidateGainOverM04B2G: afterCandidate - beforeCandidate,
      usableGainOverDirect: directUsableConcepts.size + derivedConcepts.size - directConcepts.size,
      coveragePercentage: Number(((afterCandidate / TOTAL) * 100).toFixed(2)),
      usableCoveragePercentage: Number((((directUsableConcepts.size + derivedConcepts.size) / TOTAL) * 100).toFixed(2)),
    },
    dispositionCounts: candidates.counts,
    ruleContribution: rules.map(rule => ({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      family: rule.family,
      examplesSupportingRule: rule.sourceExamples.length,
      conceptsEvaluated: rule.conceptsEvaluated,
      conceptsAccepted: rule.conceptsAccepted,
      conceptsRejected: rule.conceptsRejected,
      rejectionReasons: rule.rejectionReasons,
    })),
    productionSafety,
    policy: {
      aiTranslation: false,
      webTerminologySearch: false,
      umls: false,
      ontologyMapping: false,
      preferredTermAdjudication: false,
      medicalReview: false,
      productionPromotion: false,
      noMajorityVoting: true,
      noNewestSourceWinner: true,
      noUncontrolledLaterality: true,
      generatedTokensMustBeAuthorityObserved: true,
      sourceConflictsNeverDerived: true,
    },
    notes: 'M04B2G scope-review candidates are retained as unresolved unless the only blocker is generic Structure and an exact pinned atlas alias is present. Genuine Entire/Part/Region/Branch/Segment and laterality mismatches remain blocked.',
  };
  if (summary.processedConcepts !== TOTAL || summary.unclassifiedConcepts !== 0) throw new Error('M04B2H concept accounting failed');
  writeJson(join(OUT_DIR, 'authority-component-lexicon.json'), lexicon);
  writeJson(join(OUT_DIR, 'composition-rules.json'), {
    schemaVersion: 'M04B2H-COMPOSITION-RULES-1',
    researchOnly: true,
    rules,
    disabledFamilies: [
      {family: 'medial/lateral', reason: 'Observed realizations vary between giữa/bên and trong/ngoài; no generic word-order rule enabled.'},
      {family: 'internal/external', reason: 'Only one paired direct example; below minimum evidence for generic derivation.'},
      {family: 'simple relational complement', reason: 'No single deterministic order proven across multiple families.'},
    ],
    adversarialTests: [
      {id: 'ADV-RIGHT-LEFT', input: 'right/left renal artery', expected: 'suffix-only rule; no side synthesis without explicit rule'},
      {id: 'ADV-SUPERIOR-INFERIOR', input: 'superior/inferior renal artery', expected: 'not emitted unless base and paired rule evidence pass'},
      {id: 'ADV-ANTERIOR-POSTERIOR', input: 'anterior/posterior renal artery', expected: 'not emitted unless base and paired rule evidence pass'},
      {id: 'ADV-MEDIAL-LATERAL', input: 'medial/lateral renal artery', expected: 'REJECT_AMBIGUOUS_REALIZATION'},
      {id: 'ADV-INTERNAL-EXTERNAL', input: 'internal/external renal artery', expected: 'REJECT_INSUFFICIENT_PAIRED_EVIDENCE'},
      {id: 'ADV-NUMBERING', input: 'third/fourth rib', expected: 'ordinal suffix only when observed mapping exists'},
      {id: 'ADV-BRANCH', input: 'right branch of renal artery', expected: 'REJECT_BLACKLIST_BRANCH'},
      {id: 'ADV-PART-WHOLE', input: 'entire/part kidney', expected: 'REJECT_SCOPE'},
      {id: 'ADV-AGGREGATE', input: 'group/set of arteries', expected: 'REJECT_AGGREGATE'},
      {id: 'ADV-WORD-ORDER', input: 'complex relational complement', expected: 'REJECT_AMBIGUOUS_WORD_ORDER'},
    ],
  });
  writeJsonl(join(OUT_DIR, 'direct-candidates.jsonl'), candidates.directCandidates);
  writeJsonl(join(OUT_DIR, 'derived-candidates.jsonl'), derived);
  writeJsonl(join(OUT_DIR, 'concept-candidates.jsonl'), candidates.conceptCandidates);
  writeJsonl(join(OUT_DIR, 'residual.jsonl'), candidates.residual);
  writeJson(join(OUT_DIR, 'coverage-summary.json'), summary);
  writeFileSync(join(ROOT, 'docs', 'en-vi', 'M04B2H_CONTROLLED_TRANSLATION_EXPANSION_REPORT.md'), renderReport(summary, rules), 'utf8');
  const outputPaths = [
    'data/terminology/research/m04b2h/authority-component-lexicon.json',
    'data/terminology/research/m04b2h/composition-rules.json',
    'data/terminology/research/m04b2h/direct-candidates.jsonl',
    'data/terminology/research/m04b2h/derived-candidates.jsonl',
    'data/terminology/research/m04b2h/concept-candidates.jsonl',
    'data/terminology/research/m04b2h/residual.jsonl',
    'data/terminology/research/m04b2h/coverage-summary.json',
    'docs/en-vi/M04B2H_CONTROLLED_TRANSLATION_EXPANSION_REPORT.md',
  ];
  const outputHashes = Object.fromEntries(outputPaths.map(relative => [relative, sha256File(join(ROOT, relative))]));
  const productionHashes = Object.fromEntries(PRODUCTION_FILES.filter(existsSync).map(path => [path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'), sha256File(path)]));
  const runManifest = {
    schemaVersion: 'M04B2H-RUN-MANIFEST-1',
    milestone: 'M04B2H',
    git: {branch: gitValue(['branch', '--show-current'], 'unknown'), head: gitValue(['rev-parse', 'HEAD'], 'unknown')},
    atlas: {path: 'public/models/atlas.json', conceptCount: TOTAL, sha256: sha256File(ATLAS_PATH)},
    m04b2gInputs: g2FilesToManifest(inputs.g2Files),
    approvedCorpora: inputs.corpora,
    outputs: Object.fromEntries(outputPaths.map(relative => [relative.split('/').at(-1).replace('.jsonl', '').replace('.json', ''), relative])),
    outputHashes,
    productionHashes,
    productionSafety,
    policy: summary.policy,
    localization: {directLocalizationCandidates: localization.claims.length, directLocalizationConcepts: localizationConcepts.size, gate: 'EXACT_PINNED_SYNONYM_WITH_STRUCTURE_ONLY_BLOCKER'},
    derivation: {rules: rules.length, derivedCandidates: derived.length, sourceWebUsed: false, generatedAtOmitted: true, deterministic: true},
  };
  writeJson(join(OUT_DIR, 'run-manifest.json'), runManifest);
  return {inputs, lexicon, rules, derived, ...candidates, summary, runManifest};
}

function g2FilesToManifest(files) {
  return Object.fromEntries(Object.entries(files).map(([name, value]) => [name, {path: value.path.replace(`${ROOT}\\`, '').replaceAll('\\', '/'), sha256: value.sha256}]));
}

function renderReport(summary, rules) {
  const a = summary.after;
  const ruleRows = rules.map(rule => `| ${rule.ruleId} | ${rule.sourceExamples.length} | ${rule.conceptsEvaluated} | ${rule.conceptsAccepted} | ${rule.conceptsRejected} | ${Object.entries(rule.rejectionReasons).map(([reason, count]) => `${reason}=${count}`).join('; ') || '—'} |`).join('\n');
  return `# M04B2H — Controlled Vietnamese Translation Expansion

This research-only pass processes the frozen atlas identity set of **${summary.totalConcepts}** concepts. It reads the closed M04B2G evidence and approved local corpora; it does not acquire sources, use web terminology search, use UMLS, perform ontology mapping, adjudicate preferred terms, or promote production data.

## Coverage

| Measure | Count |
|---|---:|
| Total concepts | ${summary.totalConcepts} |
| Processed concepts | ${summary.processedConcepts} |
| Unclassified | ${summary.unclassifiedConcepts} |
| M04B2G concepts with a Vietnamese candidate | ${summary.before.m04b2gCandidateConcepts} |
| M04B2G direct source-attested concepts | ${summary.before.m04b2gDirectSourceAttestedConcepts} |
| M04B2H concepts with any carried or generated candidate | ${a.conceptsWithAnyVietnameseCandidate} (${a.coveragePercentage}%) |
| M04B2H concepts with any usable Vietnamese candidate | ${a.conceptsWithAnyUsableVietnameseCandidate} (${a.usableCoveragePercentage}%) |
| Direct source-attested usable | ${a.directSourceAttestedConcepts} |
| Direct localization candidates | ${a.directLocalizationConcepts} |
| Direct usable total | ${a.directUsableConcepts} |
| Multi-authority usable | ${a.multiAuthorityConcepts} |
| Controlled-derived usable | ${a.controlledDerivedConcepts} |
| Candidate gain over M04B2G 1,017 | ${a.candidateGainOverM04B2G} |
| Usable gain over direct 418 | ${a.usableGainOverDirect} |
| Remaining scope review | ${a.scopeReviewConcepts} |
| Source conflict | ${a.sourceConflictConcepts} |
| No safe translation candidate | ${a.noSafeTranslationCandidateConcepts} |

The scope gate was re-evaluated. **${a.directLocalizationConcepts}** MOH rows had an exact pinned atlas alias and only the generic \`Structure\` blocker, so their raw source terms are retained as \`DIRECT_LOCALIZATION_CANDIDATE\` evidence. Rows with an extra Entire, Part, Region, Branch, Segment, laterality, or other genuine scope qualifier remain in \`SCOPE_REVIEW\`.

## Final dispositions

| Disposition | Count |
|---|---:|
| DIRECT_SOURCE_TRANSLATION | ${summary.dispositionCounts.DIRECT_SOURCE_TRANSLATION} |
| MULTI_AUTHORITY_TRANSLATION | ${summary.dispositionCounts.MULTI_AUTHORITY_TRANSLATION} |
| CONTROLLED_DERIVED_TRANSLATION | ${summary.dispositionCounts.CONTROLLED_DERIVED_TRANSLATION} |
| SOURCE_VARIANT | ${summary.dispositionCounts.SOURCE_VARIANT} |
| SOURCE_CONFLICT | ${summary.dispositionCounts.SOURCE_CONFLICT} |
| SCOPE_REVIEW | ${summary.dispositionCounts.SCOPE_REVIEW} |
| NO_SAFE_TRANSLATION_CANDIDATE | ${summary.dispositionCounts.NO_SAFE_TRANSLATION_CANDIDATE} |

M04B2G's nine conflict terminal entries are preserved as seven substantive \`SOURCE_CONFLICT\` concepts and two punctuation/case-only \`SOURCE_VARIANT\` concepts; no form is selected as a winner.

## Composition rule contribution

| Rule | Supporting examples | Evaluated | Accepted | Rejected | Rejection reasons |
|---|---:|---:|---:|---:|---|
${ruleRows}

Enabled rules require source-demonstrated paired realizations and an unambiguous direct base term. The run emits no generic medial/lateral or internal/external rule because their observed realizations do not meet the deterministic evidence threshold. Hard blacklist terms cover unresolved branch/segment/part/whole, region/entity, aggregate, tributary, lobule, fascia, nerve-root/ramus, eponym, and ambiguous word-order cases.

## Evidence and safety

Every controlled-derived candidate records its direct base claim IDs, modifier-example claim IDs, rule ID/version, component evidence, and source dependencies. Source conflicts preserve all observed forms and never receive a derived winner. All candidates have \`productionEligible=false\`.

The production boundary remains unchanged: searchable Vietnamese = 0, SOURCE_VERIFIED = 0, MEDICAL_REVIEWED = 0, releaseEligible = 0, and release = UNRELEASED. The run manifest records input/output hashes and the production file hashes.

## Research artifacts

* \`data/terminology/research/m04b2h/authority-component-lexicon.json\`
* \`data/terminology/research/m04b2h/composition-rules.json\`
* \`data/terminology/research/m04b2h/direct-candidates.jsonl\`
* \`data/terminology/research/m04b2h/derived-candidates.jsonl\`
* \`data/terminology/research/m04b2h/concept-candidates.jsonl\`
* \`data/terminology/research/m04b2h/residual.jsonl\`
* \`data/terminology/research/m04b2h/coverage-summary.json\`
* \`data/terminology/research/m04b2h/run-manifest.json\`
* \`scripts/m04b2h-expand.mjs\`
* \`scripts/test-m04b2h.mjs\`

M04B2H stops after this finite controlled expansion pass. The residual is not a new research campaign.
`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = buildM04B2H();
  console.log(JSON.stringify({
    milestone: 'M04B2H',
    totalConcepts: result.summary.totalConcepts,
    unclassifiedConcepts: result.summary.unclassifiedConcepts,
    beforeCandidateConcepts: result.summary.before.m04b2gCandidateConcepts,
    afterCandidateConcepts: result.summary.after.conceptsWithAnyVietnameseCandidate,
    usableCandidateConcepts: result.summary.after.conceptsWithUsableCandidate,
    controlledDerivedConcepts: result.summary.after.controlledDerivedConcepts,
    dispositionCounts: result.summary.dispositionCounts,
  }, null, 2));
}
