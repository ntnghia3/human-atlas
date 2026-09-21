import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, extname, isAbsolute, resolve} from 'node:path';

export const M04A_SCHEMA_VERSION = 1;
export const M04A_PIPELINE_VERSION = 'M04A-1';

export const RESEARCH_BUCKETS = [
  'HIGH_CONSENSUS_CANDIDATE',
  'VARIANT_REVIEW',
  'CONFLICT_REQUIRES_ADJUDICATION',
  'ONTOLOGY_SCOPE_REVIEW',
  'LATERALITY_REVIEW',
  'SOURCE_GAP',
  'IDENTITY_GAP',
  'AGGREGATE_OR_COMPOSITE_REVIEW',
];

const LOCATOR_KEYS = new Set(['page', 'plate', 'entryId', 'nomenclatureId', 'chapter', 'section', 'table', 'url']);
const TERM_BLOCKS = ['english', 'latin', 'vietnamese'];
const CORPUS_RECORD_KEYS = new Set([
  'sourceId', 'sourceRevision', 'sourceEdition', 'locator', 'sourceLanguage', 'english', 'latin', 'vietnamese',
  'sourceTermRaw', 'context', 'anatomicalCategory', 'laterality', 'directionalQualifiers', 'sourceCodes',
  'terminologyIds', 'notes',
]);
const M03C_TO_M04A = {
  CONFLICT_REQUIRES_ADJUDICATION: ['CONFLICT_REQUIRES_ADJUDICATION'],
  CONSENSUS_CANDIDATE: ['HIGH_CONSENSUS_CANDIDATE'],
  ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED: ['ONTOLOGY_SCOPE_REVIEW', 'AGGREGATE_OR_COMPOSITE_REVIEW'],
  BASE_TERM_SCOPE_OR_LATERALITY_REVIEW: ['LATERALITY_REVIEW'],
  IDENTITY_CONTEXT_REVIEW: ['IDENTITY_GAP', 'ONTOLOGY_SCOPE_REVIEW'],
  VARIANT_WITH_ALIAS_REVIEW: ['VARIANT_REVIEW'],
};

const SIGNALS = [
  ['laterality:left', /\b(?:left|trai)\b/],
  ['laterality:right', /\b(?:right|phai)\b/],
  ['direction:anterior', /\b(?:anterior|truoc)\b/],
  ['direction:posterior', /\bposterior\b/],
  ['direction:superior', /\b(?:superior|tren)\b/],
  ['direction:inferior', /\b(?:inferior|duoi)\b/],
  ['direction:medial', /\b(?:medial|trong)\b/],
  ['direction:lateral', /\b(?:lateral|ngoai)\b/],
  ['direction:proximal', /\bproximal\b/],
  ['direction:distal', /\b(?:distal|xa)\b/],
  ['depth:superficial', /\b(?:superficial|nong)\b/],
  ['depth:deep', /\bdeep\b/],
  ['category:artery', /\b(?:artery|arterial|dong mach)\b/],
  ['category:vein', /\b(?:vein|venous|tinh mach)\b/],
  ['category:nerve', /\b(?:nerve|than kinh)\b/],
  ['category:ligament', /\b(?:ligament|day chang)\b/],
  ['category:muscle', /\bmuscle\b/],
  ['category:tendon', /\btendon\b/],
  ['category:bone', /\b(?:bone|xuong)\b/],
  ['category:fascia', /\b(?:fascia|mac)\b/],
  ['structure:branch', /\b(?:branch|nhanh)\b/],
  ['structure:trunk', /\btrunk\b/],
  ['scope:aggregate', /\b(?:aggregate|group|family|system|zone|compartment|tree|segment|collective|set|muscle organ|bone organ|vascular tree)\b/],
  ['scope:plural', /\b(?:muscles|nerves|arteries|veins|bones|ligaments|tendons|cac)\b/],
];

const CATEGORY_PAIRS = new Map([
  ['artery', 'vein'],
  ['nerve', 'ligament'],
  ['muscle', 'tendon'],
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonemptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function stableCanonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCanonical(value[key])}`).join(',')}}`;
}

function hashText(value, prefix = 'm04a') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function clone(value) {
  return structuredClone(value);
}

/** Matching-only normalization. It never replaces source wording. */
export function normalizeMatchingText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeExactEnglish(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function asStrings(value) {
  return Array.isArray(value) ? value.filter(nonemptyString) : [];
}

function termValues(block) {
  if (!isObject(block)) return [];
  return [block.preferred, ...asStrings(block.aliases)].filter(nonemptyString);
}

function termBlockErrors(block, path) {
  const errors = [];
  if (block === undefined) return errors;
  if (!isObject(block)) return [`${path} must be an object`];
  for (const key of Object.keys(block)) {
    if (!['preferred', 'aliases'].includes(key)) errors.push(`${path}.${key} is not supported`);
  }
  if (block.preferred !== undefined && !nonemptyString(block.preferred)) errors.push(`${path}.preferred must be a non-empty string`);
  if (block.aliases !== undefined && (!Array.isArray(block.aliases) || block.aliases.some(item => !nonemptyString(item)))) {
    errors.push(`${path}.aliases must be an array of non-empty strings`);
  }
  return errors;
}

export function validateCorpusRecord(record, path = 'record') {
  const errors = [];
  if (!isObject(record)) return [`${path} must be an object`];
  for (const key of Object.keys(record)) if (!CORPUS_RECORD_KEYS.has(key)) errors.push(`${path}.${key} is not supported`);
  for (const key of ['sourceId', 'sourceRevision', 'sourceTermRaw']) {
    if (!nonemptyString(record[key])) errors.push(`${path}.${key} must be a non-empty string`);
  }
  if (!isObject(record.locator)) errors.push(`${path}.locator must be an object`);
  else {
    for (const key of Object.keys(record.locator)) if (!LOCATOR_KEYS.has(key)) errors.push(`${path}.locator.${key} is not supported`);
    if (record.locator.page !== undefined && (!Number.isInteger(record.locator.page) || record.locator.page <= 0)) errors.push(`${path}.locator.page must be a positive integer`);
    for (const key of ['plate', 'entryId', 'nomenclatureId', 'chapter', 'section', 'table', 'url']) {
      if (record.locator[key] !== undefined && !nonemptyString(record.locator[key])) errors.push(`${path}.locator.${key} must be a non-empty string`);
    }
  }
  for (const blockName of TERM_BLOCKS) errors.push(...termBlockErrors(record[blockName], `${path}.${blockName}`));
  for (const key of ['sourceEdition', 'sourceLanguage', 'context', 'anatomicalCategory', 'laterality']) {
    if (record[key] !== undefined && !nonemptyString(record[key])) errors.push(`${path}.${key} must be a non-empty string when present`);
  }
  if (record.laterality !== undefined && !['left', 'right', 'bilateral', 'unsided', 'unknown'].includes(record.laterality)) errors.push(`${path}.laterality is invalid`);
  for (const key of ['directionalQualifiers', 'sourceCodes', 'terminologyIds']) {
    if (record[key] !== undefined && (!Array.isArray(record[key]) || record[key].some(item => !nonemptyString(item)))) errors.push(`${path}.${key} must be an array of non-empty strings`);
  }
  if (record.notes !== undefined && !nonemptyString(record.notes)) errors.push(`${path}.notes must be a non-empty string when present`);
  return errors;
}

async function parseCorpusText(text, path) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (extname(path).toLowerCase() !== '.jsonl') {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (isObject(parsed) && Array.isArray(parsed.records)) return parsed.records;
    return [parsed];
  }
  const records = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Unable to parse ${path}:${index + 1}: ${error.message}`);
    }
  }
  return records;
}

export async function readCorpusFiles(paths = []) {
  const records = [];
  const files = [];
  for (const path of paths) {
    const text = await readFile(path, 'utf8');
    const parsed = await parseCorpusText(text, path);
    records.push(...parsed);
    files.push(path);
  }
  return {records, files};
}

function addIndex(index, key, evidenceId) {
  if (!key) return;
  if (!index[key]) index[key] = [];
  if (!index[key].includes(evidenceId)) index[key].push(evidenceId);
}

function sortedIndex(index) {
  return Object.fromEntries(Object.keys(index).sort().map(key => [key, [...new Set(index[key])].sort()]));
}

function sourceCatalogRevision(sourceCatalogDocument) {
  return sourceCatalogDocument ? hashText(stableCanonical(sourceCatalogDocument), 'm04a-source') : 'UNAVAILABLE';
}

export function buildSourceIndex({records = [], inputFiles = [], inputFileLabels = inputFiles, sourceCatalogDocument} = {}) {
  const errors = records.flatMap((record, index) => validateCorpusRecord(record, `records[${index}]`));
  if (errors.length) throw new Error(`Invalid bulk source corpus:\n${errors.map(error => `- ${error}`).join('\n')}`);

  const byFingerprint = new Map();
  for (const record of records) {
    const fingerprint = stableCanonical(record);
    const existing = byFingerprint.get(fingerprint);
    if (existing) existing.duplicateCount += 1;
    else byFingerprint.set(fingerprint, {
      evidenceId: hashText(fingerprint),
      record: clone(record),
      duplicateCount: 1,
    });
  }

  const indexedRecords = [...byFingerprint.values()].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const recordsById = new Map(indexedRecords.map(item => [item.evidenceId, item.record]));
  const indexes = {
    exactEnglish: {},
    normalizedEnglish: {},
    latinPreferred: {},
    latinAliases: {},
    vietnamese: {},
    sourceCodes: {},
    terminologyIds: {},
    anatomicalCategory: {},
  };

  for (const item of indexedRecords) {
    const {record} = item;
    for (const value of termValues(record.english)) {
      addIndex(indexes.exactEnglish, normalizeExactEnglish(value), item.evidenceId);
      addIndex(indexes.normalizedEnglish, normalizeMatchingText(value), item.evidenceId);
    }
    if (record.latin?.preferred) addIndex(indexes.latinPreferred, normalizeMatchingText(record.latin.preferred), item.evidenceId);
    for (const value of asStrings(record.latin?.aliases)) addIndex(indexes.latinAliases, normalizeMatchingText(value), item.evidenceId);
    for (const value of termValues(record.vietnamese)) addIndex(indexes.vietnamese, normalizeMatchingText(value), item.evidenceId);
    for (const value of asStrings(record.sourceCodes)) addIndex(indexes.sourceCodes, normalizeMatchingText(value), item.evidenceId);
    for (const value of asStrings(record.terminologyIds)) addIndex(indexes.terminologyIds, normalizeMatchingText(value), item.evidenceId);
    if (record.anatomicalCategory) addIndex(indexes.anatomicalCategory, normalizeMatchingText(record.anatomicalCategory), item.evidenceId);
  }

  const sourceRecords = sourceCatalogDocument?.sources ?? [];
  const sourceMap = new Map(sourceRecords.filter(isObject).map(source => [source.id, source]));
  const unresolvedSources = [...new Set(indexedRecords.map(item => item.record.sourceId).filter(sourceId => !sourceMap.has(sourceId)))].sort();
  const revisionMismatches = [...new Set(indexedRecords
    .filter(item => sourceMap.has(item.record.sourceId) && sourceMap.get(item.record.sourceId).revision !== item.record.sourceRevision)
    .map(item => `${item.record.sourceId}:${item.record.sourceRevision}`))].sort();

  const indexBody = {
    schemaVersion: M04A_SCHEMA_VERSION,
    pipelineVersion: M04A_PIPELINE_VERSION,
    normalization: {
      matchingOnly: true,
      unicode: 'NFD',
      lowercase: true,
      whitespace: 'collapse-trim',
      vietnameseDiacriticFolding: true,
      mapDStrokeToD: true,
    },
    inputFiles: [...inputFileLabels].map(value => String(value).replace(/\\/g, '/')).sort(),
    sourceCatalogRevision: sourceCatalogRevision(sourceCatalogDocument),
    inputRecordCount: records.length,
    indexedRecordCount: indexedRecords.length,
    duplicateEvidenceRecordCount: indexedRecords.reduce((sum, item) => sum + Math.max(item.duplicateCount - 1, 0), 0),
    unresolvedSourceIds: unresolvedSources,
    sourceRevisionMismatches: revisionMismatches,
    records: indexedRecords,
    indexes: Object.fromEntries(Object.entries(indexes).map(([key, value]) => [key, sortedIndex(value)])),
  };
  return {...indexBody, indexRevision: hashText(stableCanonical(indexBody), 'm04a-index')};
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function exactLocator(locator) {
  return Boolean(locator && (
    (Number.isInteger(locator.page) && locator.page > 0) ||
    ['plate', 'entryId', 'nomenclatureId', 'chapter', 'section', 'table'].some(key => nonemptyString(locator[key]))
  ));
}

function locatorSupported(source, locator) {
  if (!source || !locator) return false;
  switch (source.locatorCapability) {
    case 'PAGE': return Number.isInteger(locator.page) && locator.page > 0;
    case 'PLATE': return nonemptyString(locator.plate) || nonemptyString(locator.table);
    case 'CHAPTER_SECTION': return nonemptyString(locator.chapter) || nonemptyString(locator.section);
    case 'TERM_ID':
    case 'STABLE_ENTRY': return nonemptyString(locator.entryId) || nonemptyString(locator.nomenclatureId);
    default: return false;
  }
}

export function assessSourceEvidence(record, sourceCatalog = {}) {
  const source = sourceCatalog[record.sourceId];
  const revisionMatches = Boolean(source && source.revision === record.sourceRevision);
  const authoritativeVietnamese = Boolean(
    source &&
      source.class === 'vietnamese-authoritative' &&
      source.authorityTier === 'authoritative' &&
      source.capabilities?.vietnamesePreferred === true &&
      source.identityVerified === true &&
      !source.accessCopyOf,
  );
  const researchEligibleVietnamese = Boolean(
    authoritativeVietnamese &&
      revisionMatches &&
      exactLocator(record.locator) &&
      locatorSupported(source, record.locator),
  );
  const sourceVerifiedClaimEligible = Boolean(
    researchEligibleVietnamese &&
      source.accessStatus !== 'METADATA_ONLY' &&
      source.accessStatus !== 'UNAVAILABLE' &&
      source.fullTextAvailableForReview === true &&
      source.contentInspected === true &&
      source.audit?.status === 'VERIFIED',
  );
  return {
    sourceKnown: Boolean(source),
    sourceClass: source?.class ?? 'UNKNOWN',
    authorityTier: source?.authorityTier ?? 'UNKNOWN',
    accessCopy: Boolean(source?.accessCopyOf),
    sourceRevision: source?.revision ?? null,
    revisionMatches,
    exactLocator: exactLocator(record.locator),
    locatorSupported: locatorSupported(source, record.locator),
    authoritativeVietnamese,
    researchEligibleVietnamese,
    sourceVerifiedClaimEligible,
  };
}

function recordReference(item, matchReasons, sourceCatalog) {
  const record = item.record;
  const profile = assessSourceEvidence(record, sourceCatalog);
  return {
    evidenceId: item.evidenceId,
    duplicateCount: item.duplicateCount,
    sourceId: record.sourceId,
    sourceRevision: record.sourceRevision,
    ...(record.sourceEdition ? {sourceEdition: record.sourceEdition} : {}),
    locator: clone(record.locator),
    sourceTermRaw: record.sourceTermRaw,
    ...(record.english ? {english: clone(record.english)} : {}),
    ...(record.latin ? {latin: clone(record.latin)} : {}),
    ...(record.vietnamese ? {vietnamese: clone(record.vietnamese)} : {}),
    ...(record.context ? {context: record.context} : {}),
    ...(record.anatomicalCategory ? {anatomicalCategory: record.anatomicalCategory} : {}),
    ...(record.laterality ? {laterality: record.laterality} : {}),
    ...(record.directionalQualifiers ? {directionalQualifiers: clone(record.directionalQualifiers)} : {}),
    matchReasons: [...new Set(matchReasons)].sort(),
    sourceProfile: profile,
  };
}

function recordHasLatin(record) {
  return Boolean(record.latin?.preferred || asStrings(record.latin?.aliases).length);
}

function recordVietnameseTerms(record) {
  return termValues(record.vietnamese);
}

function signalSetForText(value) {
  const normalized = normalizeMatchingText(value);
  const signals = new Set(SIGNALS.filter(([, pattern]) => pattern.test(normalized)).map(([signal]) => signal));
  const raw = String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\b(?:gần)\b/.test(raw)) signals.add('direction:proximal');
  if (/\b(?:sau)\b/.test(raw)) signals.add('direction:posterior');
  if (/\b(?:sâu)\b/.test(raw)) signals.add('depth:deep');
  if (/\b(?:cơ)\b/.test(raw)) signals.add('category:muscle');
  if (/\b(?:gân)\b/.test(raw)) signals.add('category:tendon');
  if (/\b(?:thân)\b/.test(raw)) signals.add('structure:trunk');
  return signals;
}

function signalSetForRecord(record) {
  const values = [
    record.sourceTermRaw,
    record.context,
    record.anatomicalCategory,
    record.laterality,
    ...(record.directionalQualifiers ?? []),
    ...termValues(record.english),
    ...termValues(record.latin),
    ...termValues(record.vietnamese),
  ].filter(nonemptyString);
  const signals = new Set();
  for (const value of values) for (const signal of signalSetForText(value)) signals.add(signal);
  return signals;
}

function signalValues(signals) {
  return [...signals].sort();
}

function signalCategory(signals) {
  for (const category of ['artery', 'vein', 'nerve', 'ligament', 'muscle', 'tendon', 'bone', 'fascia']) {
    if (signals.has(`category:${category}`)) return category;
  }
  return null;
}

function signalValue(signals, prefix) {
  return [...signals].find(value => value.startsWith(`${prefix}:`))?.slice(prefix.length + 1) ?? null;
}

function conceptSignals(concept) {
  return signalSetForText(concept.name);
}

function lateralityBase(name) {
  return normalizeMatchingText(name)
    .replace(/\b(?:left|right|trai|phai)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSemanticFlag(flags, flag) {
  const key = stableCanonical(flag);
  if (!flags.some(existing => stableCanonical(existing) === key)) flags.push(flag);
}

function compareSemantics(concept, sourceItem, sourceSignals, matchReasons) {
  const flags = [];
  const conceptSignalsValue = conceptSignals(concept);
  const conceptLaterality = signalValue(conceptSignalsValue, 'laterality');
  const sourceLaterality = sourceItem.record.laterality || signalValue(sourceSignals, 'laterality');
  if (conceptLaterality && sourceLaterality && conceptLaterality !== sourceLaterality) {
    addSemanticFlag(flags, {
      code: 'LATERALITY_MISMATCH',
      evidenceId: sourceItem.evidenceId,
      atlasValue: conceptLaterality,
      sourceValue: sourceLaterality,
      matchReasons,
    });
  } else if (conceptLaterality && (matchReasons.includes('terminologyId') || matchReasons.includes('sourceCode')) && !sourceLaterality) {
    addSemanticFlag(flags, {
      code: 'LATERALITY_UNPINNED',
      evidenceId: sourceItem.evidenceId,
      atlasValue: conceptLaterality,
      matchReasons,
    });
  }

  const conceptCategory = signalCategory(conceptSignalsValue);
  const sourceCategory = sourceItem.record.anatomicalCategory || signalCategory(sourceSignals);
  const categoryMismatch = Boolean(
    conceptCategory &&
      sourceCategory &&
      conceptCategory !== sourceCategory &&
      (CATEGORY_PAIRS.get(conceptCategory) === sourceCategory || CATEGORY_PAIRS.get(sourceCategory) === conceptCategory),
  );
  if (categoryMismatch) {
    const pair = [conceptCategory, sourceCategory].sort().join('/');
    addSemanticFlag(flags, {
      code: 'CATEGORY_MISMATCH',
      evidenceId: sourceItem.evidenceId,
      pair,
      atlasValue: conceptCategory,
      sourceValue: sourceCategory,
      matchReasons,
    });
  }

  const conceptBranch = conceptSignalsValue.has('structure:branch');
  const conceptTrunk = conceptSignalsValue.has('structure:trunk');
  const sourceBranch = sourceSignals.has('structure:branch');
  const sourceTrunk = sourceSignals.has('structure:trunk');
  if ((conceptBranch && sourceTrunk) || (conceptTrunk && sourceBranch)) {
    addSemanticFlag(flags, {
      code: 'BRANCH_TRUNK_MISMATCH',
      evidenceId: sourceItem.evidenceId,
      matchReasons,
    });
  }

  for (const prefix of ['direction', 'depth']) {
    const atlasValue = signalValue(conceptSignalsValue, prefix);
    const sourceValue = signalValue(sourceSignals, prefix);
    if (atlasValue && sourceValue && atlasValue !== sourceValue) {
      addSemanticFlag(flags, {
        code: 'DIRECTIONAL_QUALIFIER_MISMATCH',
        evidenceId: sourceItem.evidenceId,
        qualifier: prefix,
        atlasValue,
        sourceValue,
        matchReasons,
      });
    }
  }

  const aggregateCue = conceptSignalsValue.has('scope:aggregate') || conceptSignalsValue.has('scope:plural');
  const sourceAggregateCue = sourceSignals.has('scope:aggregate') || sourceSignals.has('scope:plural');
  if (aggregateCue !== sourceAggregateCue && (aggregateCue || sourceAggregateCue)) {
    addSemanticFlag(flags, {
      code: 'AGGREGATE_SCOPE_MISMATCH',
      evidenceId: sourceItem.evidenceId,
      atlasAggregate: aggregateCue,
      sourceAggregate: sourceAggregateCue,
      matchReasons,
    });
  }
  return flags;
}

function buildMeshHeuristics(atlas, concept, relationships) {
  const signals = relationships.conceptSignalsById.get(concept.id) ?? conceptSignals(concept);
  const normalizedName = normalizeMatchingText(concept.name);
  const highMeshCount = concept.elements.length >= 8;
  const aggregateCue = Boolean(
    signals.has('scope:aggregate') ||
    signals.has('scope:plural') ||
    signals.has('structure:branch') ||
    signals.has('structure:trunk') ||
    /\b(?:proximal|distal) carpal bone\b/.test(normalizedName),
  );
  const side = signalValue(signals, 'laterality');
  const sharedMeshIds = concept.elements.filter(meshId => (relationships.meshToConceptIds.get(meshId)?.length ?? 0) > 1).sort();
  const overlapIds = new Set();
  for (const meshId of sharedMeshIds) for (const id of relationships.meshToConceptIds.get(meshId) ?? []) if (id !== concept.id) overlapIds.add(id);
  const overlappingConceptIds = [...overlapIds].sort();
  const baseName = lateralityBase(concept.name);
  const relatedSideConcepts = relationships.sideConceptsByBase.get(baseName) ?? [];
  const unsidedPairedMeshes = !side && relatedSideConcepts.some(other => concept.elements.some(meshId => other.elements.includes(meshId)));
  const sideSpecificOverlap = Boolean(side && overlappingConceptIds.some(id => !signalValue(relationships.conceptSignalsById.get(id), 'laterality')));
  return {
    highMeshCount,
    aggregateCue,
    branchOrTrunkCue: signals.has('structure:branch') || signals.has('structure:trunk'),
    sharedMeshCount: sharedMeshIds.length,
    sharedMeshIds,
    overlappingConceptCount: overlappingConceptIds.length,
    overlappingConceptIds: overlappingConceptIds.slice(0, 25),
    unsidedPairedMeshes,
    sideSpecificOverlap,
    aggregateOrComposite: highMeshCount || aggregateCue,
    ontologyRisk: unsidedPairedMeshes || sideSpecificOverlap,
  };
}

function makeMeshRelationships(atlas) {
  const concepts = Array.isArray(atlas?.concepts) ? atlas.concepts.filter(isObject) : [];
  const conceptsById = new Map(concepts.map(concept => [concept.id, concept]));
  const conceptSignalsById = new Map(concepts.map(concept => [concept.id, conceptSignals(concept)]));
  const sideConceptsByBase = new Map();
  for (const concept of concepts) {
    const signals = conceptSignalsById.get(concept.id);
    if (!signalValue(signals, 'laterality')) continue;
    const base = lateralityBase(concept.name);
    if (!sideConceptsByBase.has(base)) sideConceptsByBase.set(base, []);
    sideConceptsByBase.get(base).push(concept);
  }
  const meshToConceptIds = new Map();
  for (const concept of concepts) for (const meshId of concept.elements ?? []) {
    if (!meshToConceptIds.has(meshId)) meshToConceptIds.set(meshId, []);
    meshToConceptIds.get(meshId).push(concept.id);
  }
  for (const ids of meshToConceptIds.values()) ids.sort();
  return {concepts, conceptsById, conceptSignalsById, sideConceptsByBase, meshToConceptIds};
}

function getIndexIds(index, collection, key) {
  return index?.indexes?.[collection]?.[key] ?? [];
}

function candidatePreferredTerms(candidateEvidence) {
  const terms = [];
  for (const evidence of candidateEvidence) {
    const preferred = evidence.vietnamese?.preferred;
    if (nonemptyString(preferred) && evidence.sourceProfile.researchEligibleVietnamese) {
      terms.push({
        term: preferred,
        normalizedTerm: normalizeMatchingText(preferred),
        sourceId: evidence.sourceId,
        evidenceId: evidence.evidenceId,
      });
    }
  }
  return terms;
}

function candidateAliases(candidateEvidence) {
  const aliases = [];
  for (const evidence of candidateEvidence) {
    for (const alias of asStrings(evidence.vietnamese?.aliases)) {
      if (evidence.sourceProfile.researchEligibleVietnamese) aliases.push({term: alias, sourceId: evidence.sourceId, evidenceId: evidence.evidenceId});
    }
  }
  return aliases;
}

function candidateConsensus(candidateEvidence, exactOrNormalizedIdentity, semanticFlags) {
  const preferredTerms = candidatePreferredTerms(candidateEvidence);
  const aliases = candidateAliases(candidateEvidence);
  const groups = new Map();
  for (const item of preferredTerms) {
    if (!groups.has(item.normalizedTerm)) groups.set(item.normalizedTerm, []);
    groups.get(item.normalizedTerm).push(item);
  }
  const groupRecords = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([normalizedTerm, items]) => ({
    normalizedTerm,
    surfaceForms: [...new Set(items.map(item => item.term))].sort(),
    sourceIds: [...new Set(items.map(item => item.sourceId))].sort(),
    evidenceIds: [...new Set(items.map(item => item.evidenceId))].sort(),
  }));
  const independentSourceCount = new Set(preferredTerms.map(item => item.sourceId)).size;
  const semanticBlocker = semanticFlags.some(flag => [
    'LATERALITY_MISMATCH',
    'LATERALITY_UNPINNED',
    'CATEGORY_MISMATCH',
    'BRANCH_TRUNK_MISMATCH',
    'DIRECTIONAL_QUALIFIER_MISMATCH',
    'AGGREGATE_SCOPE_MISMATCH',
  ].includes(flag.code));
  let status = 'NONE';
  if (groupRecords.length > 1) status = 'CONFLICT';
  else if (groupRecords.length === 1 && groupRecords[0].surfaceForms.length > 1) status = 'SURFACE_VARIANT_REVIEW';
  else if (groupRecords.length === 1 && exactOrNormalizedIdentity && !semanticBlocker) status = 'AGREED';
  else if (groupRecords.length === 1) status = 'BLOCKED_BY_SAFETY_FLAG';
  else if (aliases.length > 0) status = 'VARIANT_ONLY';
  else if (candidateEvidence.length > 0) status = 'NO_AUTHORITATIVE_PREFERRED_TERM';
  return {
    status,
    agreedTerm: status === 'AGREED' ? groupRecords[0].surfaceForms[0] : null,
    preferredTermGroups: groupRecords,
    aliases: aliases.sort((left, right) => `${left.term}:${left.sourceId}`.localeCompare(`${right.term}:${right.sourceId}`)),
    independentAuthoritativeSourceCount: independentSourceCount,
    evidenceIds: [...new Set(candidateEvidence.filter(item => item.sourceProfile.researchEligibleVietnamese).map(item => item.evidenceId))].sort(),
  };
}

function sourceMatchForConcept(concept, index, sourceCatalog, recordsById) {
  const exactIds = getIndexIds(index, 'exactEnglish', normalizeExactEnglish(concept.name));
  const normalizedIds = getIndexIds(index, 'normalizedEnglish', normalizeMatchingText(concept.name)).filter(id => !exactIds.includes(id));
  const terminologyIdIds = getIndexIds(index, 'terminologyIds', normalizeMatchingText(concept.id));
  const sourceCodeIds = getIndexIds(index, 'sourceCodes', normalizeMatchingText(concept.id));
  const allIds = [...new Set([...exactIds, ...normalizedIds, ...terminologyIdIds, ...sourceCodeIds])].sort();
  const sourceMatches = [];
  const exactEnglishMatches = [];
  const normalizedEnglishMatches = [];
  const latinMatches = [];
  const candidateEvidence = [];
  const semanticFlags = [];
  const qualifierSignals = new Set(conceptSignals(concept));
  for (const evidenceId of allIds) {
    const item = recordsById.get(evidenceId);
    if (!item) continue;
    const reasons = [];
    if (exactIds.includes(evidenceId)) reasons.push('exactEnglish');
    if (normalizedIds.includes(evidenceId)) reasons.push('normalizedEnglish');
    if (terminologyIdIds.includes(evidenceId)) reasons.push('terminologyId');
    if (sourceCodeIds.includes(evidenceId)) reasons.push('sourceCode');
    const reference = recordReference(item, reasons, sourceCatalog);
    sourceMatches.push(reference);
    if (reasons.includes('exactEnglish')) exactEnglishMatches.push(reference);
    if (reasons.includes('normalizedEnglish')) normalizedEnglishMatches.push(reference);
    if (recordHasLatin(item.record)) latinMatches.push(reference);
    if (recordVietnameseTerms(item.record).length) candidateEvidence.push(reference);
    const signals = signalSetForRecord(item.record);
    for (const signal of signals) qualifierSignals.add(signal);
    semanticFlags.push(...compareSemantics(concept, item, signals, reasons));
  }
  return {
    sourceMatches,
    exactEnglishMatches,
    normalizedEnglishMatches,
    latinMatches,
    candidateEvidence,
    semanticFlags,
    detectedQualifiers: signalValues(qualifierSignals),
    identityMatch: exactEnglishMatches.length > 0 || normalizedEnglishMatches.length > 0,
    sourceCodeOnlyMatch: sourceMatches.length > 0 && exactEnglishMatches.length === 0 && normalizedEnglishMatches.length === 0,
  };
}

function candidateTermCollisionKey(evidence) {
  return recordVietnameseTerms({vietnamese: evidence.vietnamese}).map(normalizeMatchingText).filter(Boolean);
}

function classifyConcept({concept, match, meshHeuristics, m03cEntry}) {
  const openPriorConflict = Boolean(m03cEntry?.conflicts?.some(conflict => conflict.status === 'OPEN'));
  const semanticCodes = new Set(match.semanticFlags.map(flag => flag.code));
  const priorBucket = m03cEntry?.researchDisposition?.dispositionBucket;
  const authoritativeCandidateEvidence = match.candidateEvidence.filter(item => item.sourceProfile.researchEligibleVietnamese);
  const preferredTerms = candidatePreferredTerms(authoritativeCandidateEvidence);
  const normalizedPreferred = new Set(preferredTerms.map(item => item.normalizedTerm));
  const hasAnyCandidateEvidence = match.candidateEvidence.length > 0;
  const hasRevisionMismatch = match.sourceMatches.some(item => !item.sourceProfile.revisionMatches);
  const hasExactIdentity = match.identityMatch;
  const hasSurfaceVariant = normalizedPreferred.size === 1 && new Set(preferredTerms.map(item => item.term)).size > 1;
  const hasSemanticConflict = ['CATEGORY_MISMATCH', 'BRANCH_TRUNK_MISMATCH', 'DIRECTIONAL_QUALIFIER_MISMATCH', 'AGGREGATE_SCOPE_MISMATCH'].some(code => semanticCodes.has(code));
  let researchBucket;
  if (openPriorConflict || normalizedPreferred.size > 1 || hasSemanticConflict && (normalizedPreferred.size > 1 || authoritativeCandidateEvidence.length > 0 && semanticCodes.has('CATEGORY_MISMATCH'))) {
    researchBucket = 'CONFLICT_REQUIRES_ADJUDICATION';
  } else if (semanticCodes.has('LATERALITY_MISMATCH') || semanticCodes.has('LATERALITY_UNPINNED')) {
    researchBucket = 'LATERALITY_REVIEW';
  } else if (meshHeuristics.aggregateOrComposite && !(priorBucket === 'IDENTITY_CONTEXT_REVIEW' && !hasExactIdentity && !hasAnyCandidateEvidence)) {
    researchBucket = 'AGGREGATE_OR_COMPOSITE_REVIEW';
  } else if (priorBucket === 'ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED' && !hasExactIdentity && !hasAnyCandidateEvidence) {
    researchBucket = meshHeuristics.aggregateOrComposite ? 'AGGREGATE_OR_COMPOSITE_REVIEW' : 'ONTOLOGY_SCOPE_REVIEW';
  } else if (priorBucket === 'BASE_TERM_SCOPE_OR_LATERALITY_REVIEW' && !hasExactIdentity && !hasAnyCandidateEvidence) {
    researchBucket = 'LATERALITY_REVIEW';
  } else if (priorBucket === 'IDENTITY_CONTEXT_REVIEW' && !hasExactIdentity && !hasAnyCandidateEvidence) {
    researchBucket = 'IDENTITY_GAP';
  } else if (priorBucket === 'VARIANT_WITH_ALIAS_REVIEW' && !hasExactIdentity && !hasAnyCandidateEvidence) {
    researchBucket = 'VARIANT_REVIEW';
  } else if (match.sourceCodeOnlyMatch) {
    researchBucket = 'IDENTITY_GAP';
  } else if (!match.sourceMatches.length || !hasExactIdentity) {
    researchBucket = match.sourceMatches.length ? 'IDENTITY_GAP' : 'SOURCE_GAP';
  } else if (!authoritativeCandidateEvidence.length || hasRevisionMismatch) {
    researchBucket = 'SOURCE_GAP';
  } else if (normalizedPreferred.size > 1) {
    researchBucket = 'CONFLICT_REQUIRES_ADJUDICATION';
  } else if (normalizedPreferred.size === 1 && match.candidateEvidence.some(item => item.sourceProfile.researchEligibleVietnamese) && !semanticCodes.size && !hasSurfaceVariant) {
    researchBucket = 'HIGH_CONSENSUS_CANDIDATE';
  } else if (match.candidateEvidence.length > 0) {
    researchBucket = 'VARIANT_REVIEW';
  } else {
    researchBucket = 'SOURCE_GAP';
  }
  const reasons = [];
  if (!match.sourceMatches.length) reasons.push('NO_INDEXED_SOURCE_MATCH');
  if (match.sourceCodeOnlyMatch) reasons.push('SOURCE_CODE_OR_TERMINOLOGY_ID_WITHOUT_ENGLISH_IDENTITY');
  if (!match.identityMatch) reasons.push('NO_EXACT_OR_SAFELY_NORMALIZED_ENGLISH_IDENTITY');
  if (!authoritativeCandidateEvidence.length && hasAnyCandidateEvidence) reasons.push('NO_AUTHORITY_ELIGIBLE_VIETNAMESE_EVIDENCE');
  if (hasRevisionMismatch) reasons.push('SOURCE_REVISION_MISMATCH');
  if (match.semanticFlags.length) reasons.push('SEMANTIC_SAFETY_FLAG');
  if (meshHeuristics.aggregateOrComposite) reasons.push('ATLAS_AGGREGATE_OR_COMPOSITE_HEURISTIC');
  if (meshHeuristics.ontologyRisk) reasons.push('ATLAS_MESH_OVERLAP_OR_LATERALITY_HEURISTIC');
  return {researchBucket, reasons: [...new Set(reasons)].sort()};
}

function regressionAssessment(result, m03cEntry) {
  if (!m03cEntry?.researchDisposition) return null;
  const priorBucket = m03cEntry.researchDisposition.dispositionBucket;
  const compatible = M03C_TO_M04A[priorBucket] ?? [];
  if (compatible.includes(result.researchBucket)) return {status: 'PASS', priorBucket, compatibleBuckets: compatible, finding: null};
  if (priorBucket === 'CONSENSUS_CANDIDATE' && result.researchBucket === 'VARIANT_REVIEW' && result.semanticFlags?.length) {
    return {
      status: 'PASS',
      priorBucket,
      compatibleBuckets: [...compatible, 'VARIANT_REVIEW'],
      finding: 'A new safety flag keeps the research candidate in variant review rather than promoting it.',
    };
  }
  const inputGap = ['SOURCE_GAP', 'IDENTITY_GAP'].includes(result.researchBucket);
  if (inputGap) return {status: 'INPUT_GAP', priorBucket, compatibleBuckets: compatible, finding: 'The current corpus has not supplied enough evidence to reassess this frozen M03C disposition.'};
  return {
    status: 'MISMATCH',
    priorBucket,
    compatibleBuckets: compatible,
    finding: `Bulk classification ${result.researchBucket} is not compatible with frozen M03C1 disposition ${priorBucket}.`,
  };
}

function buildResearchAnnotationPayload(researchPack) {
  if (!isObject(researchPack) || !Array.isArray(researchPack.conceptBindings)) return null;
  const conceptBindings = researchPack.conceptBindings.filter(isObject).map(clone);
  return {
    schemaVersion: 'm04b2a-research-annotations-1',
    sourcePack: {
      artifact: 'docs/en-vi/research/M04B2A/M04B2_PUBLIC_RESEARCH_PACK.json',
      schemaVersion: researchPack.schemaVersion ?? null,
      generatedDate: researchPack.generatedDate ?? null,
      startingRepoCommit: researchPack.startingRepoCommit ?? null,
      status: researchPack.status ?? null,
      source: clone(researchPack.source ?? {}),
      corroboration: clone(researchPack.corroboration ?? {}),
      releaseState: clone(researchPack.releaseState ?? {}),
    },
    conceptBindingCount: conceptBindings.length,
    boundConceptCount: new Set(conceptBindings.map(binding => binding.conceptId).filter(nonemptyString)).size,
    conceptBindings,
  };
}

function applyResearchBindingGuard(classification, conceptBindings) {
  const dispositions = new Set(conceptBindings.map(binding => binding.disposition));
  const guard = dispositions.has('CONFLICT_REQUIRES_ADJUDICATION')
    ? 'CONFLICT_REQUIRES_ADJUDICATION'
    : dispositions.has('ONTOLOGY_OR_SOURCE_SCOPE_UNRESOLVED')
      ? 'ONTOLOGY_SCOPE_REVIEW'
      : dispositions.has('BASE_TERM_SCOPE_OR_LATERALITY_REVIEW')
        ? 'LATERALITY_REVIEW'
        : dispositions.has('IDENTITY_CONTEXT_REVIEW')
          ? 'IDENTITY_GAP'
          : dispositions.has('VARIANT_WITH_ALIAS_REVIEW')
            ? 'VARIANT_REVIEW'
            : null;
  if (!guard) return classification;
  const compatible = guard === 'ONTOLOGY_SCOPE_REVIEW'
    ? ['ONTOLOGY_SCOPE_REVIEW', 'AGGREGATE_OR_COMPOSITE_REVIEW']
    : [guard];
  if (compatible.includes(classification.researchBucket)) return classification;
  return {
    researchBucket: guard,
    reasons: [...new Set([...classification.reasons, 'RESEARCH_ONLY_BINDING_DISPOSITION_GUARD'])].sort(),
  };
}

export function matchAtlasConcepts({atlas, index, sourceCatalog = {}, m03cEntries = [], researchPack} = {}) {
  const relationships = makeMeshRelationships(atlas);
  const recordsById = new Map((index?.records ?? []).map(item => [item.evidenceId, item]));
  const m03cById = new Map((m03cEntries ?? []).filter(isObject).map(entry => [entry.conceptId, entry]));
  const researchAnnotations = buildResearchAnnotationPayload(researchPack);
  const bindingsByConceptId = new Map();
  for (const binding of researchAnnotations?.conceptBindings ?? []) {
    if (!bindingsByConceptId.has(binding.conceptId)) bindingsByConceptId.set(binding.conceptId, []);
    bindingsByConceptId.get(binding.conceptId).push(clone(binding));
  }
  const concepts = relationships.concepts;
  const conceptResults = [];
  for (const concept of concepts) {
    const match = sourceMatchForConcept(concept, index, sourceCatalog, recordsById);
    const meshHeuristics = buildMeshHeuristics(atlas, concept, relationships);
    const candidateConsensusValue = candidateConsensus(match.candidateEvidence, match.identityMatch, match.semanticFlags);
    if (m03cById.get(concept.id)?.conflicts?.some(conflict => conflict.status === 'OPEN') && candidateConsensusValue.status === 'NONE') {
      candidateConsensusValue.status = 'CONFLICT';
    }
    const conceptBindings = bindingsByConceptId.get(concept.id) ?? [];
    const classification = applyResearchBindingGuard(
      classifyConcept({concept, match, meshHeuristics, m03cEntry: m03cById.get(concept.id)}),
      conceptBindings,
    );
    const result = {
      conceptId: concept.id,
      atlasName: concept.name,
      meshCount: concept.elements.length,
      sourceMatches: match.sourceMatches,
      exactEnglishMatches: match.exactEnglishMatches,
      normalizedEnglishMatches: match.normalizedEnglishMatches,
      latinMatches: match.latinMatches,
      vietnameseCandidateEvidence: match.candidateEvidence,
      detectedQualifiers: match.detectedQualifiers,
      semanticFlags: match.semanticFlags.sort((left, right) => stableCanonical(left).localeCompare(stableCanonical(right))),
      meshHeuristics,
      candidateConsensus: candidateConsensusValue,
      researchBucket: classification.researchBucket,
      researchBucketReasons: classification.reasons,
      sourceGapReasons: classification.reasons.filter(reason => reason.includes('SOURCE') || reason.includes('IDENTITY') || reason.includes('AUTHORITY')),
      m03cRegression: regressionAssessment({
        researchBucket: classification.researchBucket,
        sourceMatches: match.sourceMatches,
        semanticFlags: match.semanticFlags,
      }, m03cById.get(concept.id)),
    };
    if (conceptBindings.length) result.researchAnnotations = {conceptBindings};
    conceptResults.push(result);
  }

  const collisionMap = new Map();
  for (const result of conceptResults) for (const evidence of result.vietnameseCandidateEvidence) {
    for (const term of candidateTermCollisionKey(evidence)) {
      if (!collisionMap.has(term)) collisionMap.set(term, []);
      collisionMap.get(term).push({conceptId: result.conceptId, evidenceId: evidence.evidenceId, sourceId: evidence.sourceId, term: recordVietnameseTerms({vietnamese: evidence.vietnamese}).find(value => normalizeMatchingText(value) === term)});
    }
  }
  const normalizedCandidateCollisions = [...collisionMap.entries()]
    .map(([normalizedTerm, occurrences]) => ({
      normalizedTerm,
      occurrences: occurrences.sort((left, right) => `${left.conceptId}:${left.evidenceId}:${left.term}`.localeCompare(`${right.conceptId}:${right.evidenceId}:${right.term}`)),
      conceptIds: [...new Set(occurrences.map(item => item.conceptId))].sort(),
    }))
    .filter(item => item.conceptIds.length > 1);
  const collisionsByConcept = new Map();
  for (const collision of normalizedCandidateCollisions) for (const conceptId of collision.conceptIds) {
    if (!collisionsByConcept.has(conceptId)) collisionsByConcept.set(conceptId, []);
    collisionsByConcept.get(conceptId).push(collision.normalizedTerm);
  }
  for (const result of conceptResults) {
    const collisions = collisionsByConcept.get(result.conceptId) ?? [];
    for (const normalizedTerm of collisions) result.semanticFlags.push({code: 'NORMALIZED_CANDIDATE_COLLISION', normalizedTerm});
    result.semanticFlags.sort((left, right) => stableCanonical(left).localeCompare(stableCanonical(right)));
    if (collisions.length && result.researchBucket === 'HIGH_CONSENSUS_CANDIDATE') result.researchBucket = 'VARIANT_REVIEW';
    const m03cEntry = m03cById.get(result.conceptId);
    if (m03cEntry) result.m03cRegression = regressionAssessment(result, m03cEntry);
  }

  const bucketCounts = Object.fromEntries(RESEARCH_BUCKETS.map(bucket => [bucket, 0]));
  for (const result of conceptResults) bucketCounts[result.researchBucket] = (bucketCounts[result.researchBucket] ?? 0) + 1;
  const regressionResults = conceptResults.map(result => result.m03cRegression).filter(Boolean);
  const regressionMismatches = regressionResults.filter(item => item.status === 'MISMATCH');
  const regressionInputGaps = regressionResults.filter(item => item.status === 'INPUT_GAP');
  const outputBody = {
    schemaVersion: M04A_SCHEMA_VERSION,
    pipelineVersion: M04A_PIPELINE_VERSION,
    artifact: 'bulk-match-results',
    atlas: {
      version: atlas?.version ?? null,
      source: atlas?.source ?? null,
      conceptCount: concepts.length,
      expectedConceptCount: 3432,
    },
    inputIndexRevision: index?.indexRevision ?? 'UNAVAILABLE',
    sourceCatalogRevision: sourceCatalogRevision({sources: Object.values(sourceCatalog)}),
    concepts: conceptResults,
    normalizedCandidateCollisions,
    regression: {
      frozenM03CConceptCount: regressionResults.length,
      passCount: regressionResults.filter(item => item.status === 'PASS').length,
      inputGapCount: regressionInputGaps.length,
      mismatchCount: regressionMismatches.length,
      findings: regressionMismatches.map(item => item.finding),
    },
    ...(researchAnnotations ? {researchAnnotations} : {}),
    summary: {
      conceptCount: concepts.length,
      expectedConceptCount: 3432,
      exactConceptCount: concepts.length === 3432 ? 3432 : concepts.length,
      bucketCounts,
      sourceMatchConceptCount: conceptResults.filter(result => result.sourceMatches.length > 0).length,
      exactEnglishMatchConceptCount: conceptResults.filter(result => result.exactEnglishMatches.length > 0).length,
      normalizedEnglishMatchConceptCount: conceptResults.filter(result => result.normalizedEnglishMatches.length > 0).length,
      latinMatchConceptCount: conceptResults.filter(result => result.latinMatches.length > 0).length,
      noSourceMatchConceptCount: conceptResults.filter(result => result.sourceMatches.length === 0).length,
      authoritativeVietnameseEvidenceConceptCount: conceptResults.filter(result => result.vietnameseCandidateEvidence.some(item => item.sourceProfile.researchEligibleVietnamese)).length,
      semanticFlaggedConceptCount: conceptResults.filter(result => result.semanticFlags.length > 0).length,
      aggregateHeuristicConceptCount: conceptResults.filter(result => result.meshHeuristics.aggregateOrComposite).length,
      normalizedCandidateCollisionCount: normalizedCandidateCollisions.length,
      regressionMismatchCount: regressionMismatches.length,
      regressionInputGapCount: regressionInputGaps.length,
    },
  };
  return outputBody;
}

export function loadSourceCatalogDocument(document) {
  return Object.fromEntries((document?.sources ?? []).filter(isObject).map(source => [source.id, source]));
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function resolvePath(root, path) {
  return isAbsolute(path) ? path : resolve(root, path);
}
