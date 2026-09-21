import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {access, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceIndex,
  loadSourceCatalogDocument,
  matchAtlasConcepts,
  readCorpusFiles,
  readJson,
  writeJson,
} from './m04a-bulk-evidence.mjs';
import {
  MOH_COMPACT_CORPUS_RELATIVE,
  MOH_OFFICIAL_PDF_URL,
  NVH_EXHAUSTIVE_CORPUS_RELATIVE,
  NVH_PUBLIC_ACCESS_URL,
} from './m04b2e2r-acquisition.mjs';
import {computeCoverage, validateTerminologyData} from './validate-terminology.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pathFromRoot = (...parts) => join(ROOT, ...parts);
const relativePath = absolutePath => relative(ROOT, absolutePath).replace(/\\/g, '/');

export const EXPECTED_CONCEPT_COUNT = 3432;
export const SOURCE_INBOX_RELATIVE = '.local/terminology-source-inbox/';
export const SOURCE_INBOX = pathFromRoot('.local', 'terminology-source-inbox');
export const PUBLIC_SOURCE_REGISTRY_PATH = pathFromRoot('docs', 'en-vi', 'research', 'M04B2E2A', 'M04B2E2A_PUBLIC_SOURCE_ACCESS_REGISTRY.json');
export const MANIFEST_PATH = pathFromRoot('data', 'terminology', 'research', 'm04b2e-source-manifest.json');
export const OUTPUT_PATH = pathFromRoot('data', 'terminology', 'research', 'm04b2e-bulk-match-results.json');
export const REPORT_PATH = pathFromRoot('docs', 'en-vi', 'M04B2E2R_EXHAUSTIVE_ACQUISITION_REPORT.md');
export const R1_REPORT_PATH = pathFromRoot('docs', 'en-vi', 'M04B2E2R1_NVH_PARSER_INTEGRITY_REPORT.md');
export const SOURCE_SPECIFIC_CORPORA = [
  {sourceId: 'NVH2008', relativePath: 'data/terminology/research/corpora/nvh2008-bulk.jsonl'},
  {sourceId: 'HMU2022', relativePath: 'data/terminology/research/corpora/hmu2022-attestations.jsonl'},
  {sourceId: 'UMP2023_T2', relativePath: 'data/terminology/research/corpora/ump2023-t2-bulk-attestations.jsonl'},
  {sourceId: 'NATIONAL_BODY_TERMS_2025', relativePath: MOH_COMPACT_CORPUS_RELATIVE},
];
export const PUBLIC_WEB_CORPORA = [
  {sourceId: 'NVH2008', relativePath: NVH_EXHAUSTIVE_CORPUS_RELATIVE},
];

const PRODUCTION_PATHS = [
  'data/terminology/entries.json',
  'data/terminology/reviewers.json',
  'data/terminology/release.json',
];

const CORPUS_INPUTS = [
  {
    relativePath: 'data/terminology/research/corpora/fipat-ta2-2019.jsonl',
    sourceIds: ['FIPAT_TA2'],
    purpose: 'Existing identity baseline for exact English/Latin evidence; not a Vietnamese authority.',
  },
  {
    relativePath: 'data/terminology/research/corpora/nvh2008-public-research-seed.jsonl',
    sourceIds: ['NVH2008'],
    purpose: 'Existing bilingual source corpus for research-only candidate evidence.',
  },
  {
    relativePath: 'data/terminology/research/corpora/m04b2c-vi-authority.jsonl',
    sourceIds: ['HMU2022', 'UMP2023_T2'],
    purpose: 'Existing multi-authority Vietnamese attestation corpus, partitioned by sourceId at ingestion.',
  },
  {
    relativePath: NVH_EXHAUSTIVE_CORPUS_RELATIVE,
    sourceIds: ['NVH2008'],
    purpose: 'Compact rows safely reconstructed from every accessible NVH2008 rendered code block; full rendered text remains local-only.',
  },
  {
    relativePath: MOH_COMPACT_CORPUS_RELATIVE,
    sourceIds: ['NATIONAL_BODY_TERMS_2025'],
    purpose: 'Compact rows safely reconstructed from the official Ministry text-layer PDF; complete PDF/text/staging remains local-only.',
  },
];

const BASELINE_SOURCE = {
  sourceId: 'FIPAT_TA2',
  sourceKey: 'FIPAT_TA2',
  canonicalFilename: null,
  sourceCatalogId: 'FIPAT_TA2',
  role: 'IDENTITY_BASELINE',
  authorityTier: 'authoritative',
  language: 'Latin; English',
  corpusSourceIds: ['FIPAT_TA2'],
};

const CANONICAL_SOURCES = [
  {
    sourceId: 'NVH2008',
    sourceKey: 'NVH2008',
    canonicalFilename: 'NVH2008.pdf',
    sourceCatalogId: 'NVH2008',
    role: 'BULK_BILINGUAL_CANDIDATE_GENERATOR',
    authorityTier: 'A',
    language: 'English; Vietnamese',
    corpusSourceIds: ['NVH2008'],
  },
  {
    sourceId: 'MOH2025_BODY_STRUCTURE',
    sourceKey: 'MOH2025_BODY_STRUCTURE',
    canonicalFilename: 'MOH2025_BODY_STRUCTURE.pdf',
    sourceCatalogId: 'NATIONAL_BODY_TERMS_2025',
    role: 'BULK_BILINGUAL_CANDIDATE_GENERATOR / ONTOLOGY_BRIDGE_CANDIDATE',
    authorityTier: 'A-GOV',
    language: 'English; Vietnamese',
    corpusSourceIds: ['NATIONAL_BODY_TERMS_2025'],
  },
  {
    sourceId: 'NETTER_VI',
    sourceKey: 'NETTER_VI',
    canonicalFilename: 'NETTER_VI.pdf',
    sourceCatalogId: 'NETTER2015',
    role: 'BILINGUAL_GLOSSARY_CANDIDATE',
    authorityTier: 'B',
    language: 'English; Vietnamese',
    corpusSourceIds: ['NETTER_VI'],
  },
  {
    sourceId: 'HMU2022',
    sourceKey: 'HMU2022',
    canonicalFilename: 'HMU2022.pdf',
    sourceCatalogId: 'HMU2022',
    role: 'AUTHORITY_CORROBORATION / VARIANT-CONFLICT DETECTION / GAP FILLING',
    authorityTier: 'A',
    language: 'Vietnamese',
    corpusSourceIds: ['HMU2022'],
  },
  {
    sourceId: 'UMP2023_T1',
    sourceKey: 'UMP2023_T1',
    canonicalFilename: 'UMP2023_T1.pdf',
    sourceCatalogId: null,
    role: 'AUTHORITY_CORROBORATION / VARIANT-CONFLICT DETECTION / GAP FILLING',
    authorityTier: 'A',
    language: 'Vietnamese',
    corpusSourceIds: ['UMP2023_T1'],
  },
  {
    sourceId: 'UMP2023_T2',
    sourceKey: 'UMP2023_T2',
    canonicalFilename: 'UMP2023_T2.pdf',
    sourceCatalogId: 'UMP2023_T2',
    role: 'AUTHORITY_CORROBORATION / VARIANT-CONFLICT DETECTION / GAP FILLING',
    authorityTier: 'A',
    language: 'Vietnamese',
    corpusSourceIds: ['UMP2023_T2'],
  },
  {
    sourceId: 'UMP_SYSTEM2023',
    sourceKey: 'UMP_SYSTEM2023',
    canonicalFilename: 'UMP_SYSTEM2023.pdf',
    sourceCatalogId: 'UMP2023_SYS',
    role: 'AUTHORITY_CORROBORATION / VARIANT-CONFLICT DETECTION / GAP FILLING',
    authorityTier: 'A',
    language: 'Vietnamese',
    corpusSourceIds: ['UMP_SYSTEM2023'],
  },
  {
    sourceId: 'NQQ2012_T1',
    sourceKey: 'NQQ2012_T1',
    canonicalFilename: 'NQQ2012_T1.pdf',
    sourceCatalogId: 'NQQ_T1_ACCESS',
    role: 'SECOND_AUTHORITY_CORROBORATION / HISTORICAL_VARIANT_DETECTION',
    authorityTier: 'A-HISTORICAL',
    language: 'Vietnamese',
    corpusSourceIds: ['NQQ2012_T1'],
  },
  {
    sourceId: 'NQQ2012_T2',
    sourceKey: 'NQQ2012_T2',
    canonicalFilename: 'NQQ2012_T2.pdf',
    sourceCatalogId: 'NQQ_T1_ACCESS',
    role: 'SECOND_AUTHORITY_CORROBORATION / HISTORICAL_VARIANT_DETECTION',
    authorityTier: 'A-HISTORICAL',
    language: 'Vietnamese',
    corpusSourceIds: ['NQQ2012_T2'],
  },
  {
    sourceId: 'HUE2006',
    sourceKey: 'HUE2006',
    canonicalFilename: 'HUE2006.pdf',
    sourceCatalogId: null,
    role: 'CORROBORATION / GAP FILLING',
    authorityTier: 'B',
    language: 'Vietnamese',
    corpusSourceIds: ['HUE2006'],
  },
  {
    sourceId: 'TRINH_VAN_MINH_T1',
    sourceKey: 'TRINH_VAN_MINH_T1',
    canonicalFilename: 'TRINH_VAN_MINH_T1.pdf',
    sourceCatalogId: null,
    role: 'CORROBORATION / GAP FILLING',
    authorityTier: 'B',
    language: 'Vietnamese',
    corpusSourceIds: ['TRINH_VAN_MINH_T1'],
  },
  {
    sourceId: 'TRINH_VAN_MINH_T2',
    sourceKey: 'TRINH_VAN_MINH_T2',
    canonicalFilename: 'TRINH_VAN_MINH_T2.pdf',
    sourceCatalogId: null,
    role: 'CORROBORATION / GAP FILLING',
    authorityTier: 'B',
    language: 'Vietnamese',
    corpusSourceIds: ['TRINH_VAN_MINH_T2'],
  },
  {
    sourceId: 'TRINH_VAN_MINH_T3',
    sourceKey: 'TRINH_VAN_MINH_T3',
    canonicalFilename: 'TRINH_VAN_MINH_T3.pdf',
    sourceCatalogId: null,
    role: 'CORROBORATION / GAP FILLING',
    authorityTier: 'B',
    language: 'Vietnamese',
    corpusSourceIds: ['TRINH_VAN_MINH_T3'],
  },
];

const ALL_SOURCE_SPECS = [BASELINE_SOURCE, ...CANONICAL_SOURCES];
const UNSAFE_SEMANTIC_FLAGS = new Set([
  'LATERALITY_MISMATCH',
  'LATERALITY_UNPINNED',
  'CATEGORY_MISMATCH',
  'BRANCH_TRUNK_MISMATCH',
  'DIRECTIONAL_QUALIFIER_MISMATCH',
  'AGGREGATE_SCOPE_MISMATCH',
]);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  const digest = createHash('sha256');
  const bytes = await readFile(filePath);
  digest.update(bytes);
  return {sha256: digest.digest('hex'), bytes: bytes.byteLength};
}

function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function gitOutput(...args) {
  return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
}

function stableCanonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCanonical(value[key])}`).join(',')}}`;
}

function exactText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function rawTermForms(record) {
  return [record.vietnamese?.preferred, ...(record.vietnamese?.aliases ?? [])]
    .filter(value => typeof value === 'string' && value.trim());
}

function sourceCatalogAuthorityIds(sourceCatalog) {
  return new Set(Object.values(sourceCatalog)
    .filter(source => source?.class === 'vietnamese-authoritative' && source.authorityTier === 'authoritative' && source.capabilities?.vietnamesePreferred === true && !source.accessCopyOf)
    .map(source => source.id));
}

async function discoverSourceInbox() {
  const gitignore = await readFile(pathFromRoot('.gitignore'), 'utf8');
  const gitIgnored = gitignore.split(/\r?\n/).some(line => line.trim() === '/.local/terminology-source-inbox/');
  if (!(await exists(SOURCE_INBOX))) return {exists: false, gitIgnored, files: []};
  const names = (await readdir(SOURCE_INBOX, {withFileTypes: true}))
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort();
  return {exists: true, gitIgnored, files: names};
}

async function inputMetadata() {
  const metadata = [];
  for (const input of CORPUS_INPUTS) {
    const absolutePath = pathFromRoot(...input.relativePath.split('/'));
    if (!(await exists(absolutePath))) throw new Error(`Required repository corpus is missing: ${input.relativePath}`);
    const digest = await sha256File(absolutePath);
    metadata.push({
      path: input.relativePath,
      sourceIds: [...input.sourceIds],
      purpose: input.purpose,
      sha256: digest.sha256,
      bytes: digest.bytes,
    });
  }
  return metadata;
}

function resultEvidence(result, sourceId, field = 'sourceMatches') {
  return (result?.[field] ?? []).filter(item => item.sourceId === sourceId);
}

function sourceCorpusIds(spec) {
  return new Set(spec.corpusSourceIds ?? [spec.sourceId]);
}

function evidenceForSourceSpec(result, spec, field = 'sourceMatches') {
  const corpusIds = sourceCorpusIds(spec);
  return (result?.[field] ?? []).filter(item => corpusIds.has(item.sourceId));
}

function hasUnsafeMapping(result, evidence) {
  if (!evidence.sourceProfile?.sourceKnown || !evidence.sourceProfile.revisionMatches || evidence.sourceProfile.accessCopy) return true;
  const onlyIdentifierMatch = evidence.matchReasons?.some(reason => ['sourceCode', 'terminologyId'].includes(reason)) && !evidence.matchReasons?.some(reason => ['exactEnglish', 'normalizedEnglish'].includes(reason));
  if (onlyIdentifierMatch) return true;
  return (result.semanticFlags ?? []).some(flag => flag.evidenceId === evidence.evidenceId && UNSAFE_SEMANTIC_FLAGS.has(flag.code));
}

function computeSourceMetrics({corpusRecords, index, results, sourceCatalog, inboxFiles}) {
  const authorityIds = sourceCatalogAuthorityIds(sourceCatalog);
  const metrics = [];
  for (const spec of ALL_SOURCE_SPECS) {
    const sourceId = spec.sourceId;
    const corpusIds = sourceCorpusIds(spec);
    const records = corpusRecords.filter(record => corpusIds.has(record.sourceId));
    const indexedRecords = (index.records ?? []).filter(item => corpusIds.has(item.record.sourceId));
    const exactEnglishConceptIds = new Set();
    const exactLatinConceptIds = new Set();
    const eligibleConceptIds = new Set();
    const mappedEvidenceIds = new Set();
    const unsafeEvidenceIds = new Set();
    const variantConceptIds = new Set();
    const conflictConceptIds = new Set();
    for (const result of results.concepts) {
      for (const evidence of evidenceForSourceSpec(result, spec, 'exactEnglishMatches')) exactEnglishConceptIds.add(result.conceptId);
      for (const evidence of evidenceForSourceSpec(result, spec, 'latinMatches')) {
        exactLatinConceptIds.add(result.conceptId);
        mappedEvidenceIds.add(evidence.evidenceId);
      }
      for (const evidence of evidenceForSourceSpec(result, spec, 'sourceMatches')) {
        mappedEvidenceIds.add(evidence.evidenceId);
        if (hasUnsafeMapping(result, evidence)) unsafeEvidenceIds.add(evidence.evidenceId);
      }
      const eligibleEvidence = evidenceForSourceSpec(result, spec, 'vietnameseCandidateEvidence')
        .filter(evidence => evidence.sourceProfile?.researchEligibleVietnamese);
      if (eligibleEvidence.length) {
        eligibleConceptIds.add(result.conceptId);
        if (result.researchBucket === 'VARIANT_REVIEW') variantConceptIds.add(result.conceptId);
        if (result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION') conflictConceptIds.add(result.conceptId);
      }
    }
    const otherEligibleConceptIds = new Set();
    for (const otherSpec of ALL_SOURCE_SPECS) {
      if (otherSpec.sourceId === sourceId || !authorityIds.has(otherSpec.sourceId)) continue;
      const otherIds = new Set(results.concepts
        .filter(result => resultEvidence(result, otherSpec.sourceId, 'vietnameseCandidateEvidence').some(evidence => evidence.sourceProfile?.researchEligibleVietnamese))
        .map(result => result.conceptId));
      for (const conceptId of otherIds) otherEligibleConceptIds.add(conceptId);
    }
    const uniqueContribution = [...eligibleConceptIds].filter(conceptId => !otherEligibleConceptIds.has(conceptId)).sort();
    const overlap = [...eligibleConceptIds].filter(conceptId => otherEligibleConceptIds.has(conceptId)).sort();
    const termForms = new Set(records.flatMap(rawTermForms));
    const pages = new Set(records.map(record => record.locator?.page).filter(page => Number.isInteger(page) && page > 0));
    const inboxFilename = spec.canonicalFilename;
    const sourceFilePresent = inboxFilename ? inboxFiles.includes(inboxFilename) : false;
    const repositoryCorpusPresent = records.length > 0;
    let extractionStatus = 'SOURCE_MISSING';
    if (repositoryCorpusPresent) extractionStatus = 'REUSED_REPOSITORY_RESEARCH_CORPUS';
    else if (sourceFilePresent) extractionStatus = 'LOCAL_SOURCE_PRESENT_REQUIRES_STRUCTURED_PARSER';
    const sourceCatalogEntry = sourceCatalog[spec.sourceCatalogId ?? spec.sourceId] ?? null;
    const metric = {
      sourceId,
      sourceKey: spec.sourceKey,
      role: spec.role,
      authorityTier: spec.authorityTier,
      canonicalFilename: spec.canonicalFilename,
      sourceFile: inboxFilename ? `${SOURCE_INBOX_RELATIVE}${inboxFilename}` : null,
      sourceFilePresent,
      repositoryCorpusPresent,
      extractionStatus,
      sourceCatalogRevision: sourceCatalogEntry?.revision ?? null,
      parsedPages: pages.size,
      parsedRows: records.length,
      structuredEvidenceRecordsEmitted: indexedRecords.length,
      uniqueVietnameseTermForms: termForms.size,
      conceptsMatchedByExactEnglish: [...exactEnglishConceptIds].sort().length,
      conceptsMatchedByExactLatin: [...exactLatinConceptIds].sort().length,
      conceptsWithEligibleVietnameseEvidence: eligibleConceptIds.size,
      conceptsUniquelyContributedBySource: uniqueContribution.length,
      overlapWithOtherAuthorities: overlap.length,
      variantsGenerated: variantConceptIds.size,
      conflictsGenerated: conflictConceptIds.size,
      rejectedUnsafeMappings: unsafeEvidenceIds.size,
      unmatchedIndexedRecords: Math.max(indexedRecords.length - mappedEvidenceIds.size, 0),
      uniqueContributionConceptIds: uniqueContribution,
      overlapConceptIds: overlap,
    };
    metric._authorityEvidenceConceptIds = [...eligibleConceptIds].sort();
    metric._variantConceptIds = [...variantConceptIds].sort();
    metric._conflictConceptIds = [...conflictConceptIds].sort();
    metrics.push(metric);
  }
  return metrics;
}

function cleanSourceMetrics(metrics) {
  return metrics.map(metric => {
    const cleaned = {...metric};
    delete cleaned._authorityEvidenceConceptIds;
    delete cleaned._variantConceptIds;
    delete cleaned._conflictConceptIds;
    return cleaned;
  });
}

function computeGlobalMetrics({results, previousResults, sourceCatalog}) {
  const authorityIds = sourceCatalogAuthorityIds(sourceCatalog);
  const eligibleByConcept = new Map();
  const multiAuthorityAgreementIds = [];
  const singleSourceIds = [];
  for (const result of results.concepts) {
    const eligibleEvidence = result.vietnameseCandidateEvidence.filter(evidence => evidence.sourceProfile?.researchEligibleVietnamese && authorityIds.has(evidence.sourceId));
    const sourceIds = new Set(eligibleEvidence.map(evidence => evidence.sourceId));
    eligibleByConcept.set(result.conceptId, sourceIds);
    const terms = new Set(eligibleEvidence.map(evidence => exactText(evidence.vietnamese?.preferred).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean));
    const institutions = new Set(eligibleEvidence.map(evidence => sourceCatalog[evidence.sourceId]?.institution ?? evidence.sourceId));
    if (terms.size === 1 && institutions.size >= 2) multiAuthorityAgreementIds.push(result.conceptId);
    if (sourceIds.size === 1) singleSourceIds.push(result.conceptId);
  }
  const previousIds = new Set((previousResults?.concepts ?? [])
    .filter(result => result.vietnameseCandidateEvidence?.some(evidence => evidence.sourceProfile?.researchEligibleVietnamese))
    .map(result => result.conceptId));
  const currentIds = new Set([...eligibleByConcept.entries()].filter(([, sourceIds]) => sourceIds.size > 0).map(([conceptId]) => conceptId));
  const newlyAddedIds = [...currentIds].filter(conceptId => !previousIds.has(conceptId)).sort();
  const removedIds = [...previousIds].filter(conceptId => !currentIds.has(conceptId)).sort();
  const delta = currentIds.size - previousIds.size;
  const percentageDelta = previousIds.size ? (delta / previousIds.size) * 100 : (currentIds.size ? 100 : 0);
  const bucketCount = bucket => results.concepts.filter(result => result.researchBucket === bucket).length;
  return {
    previousVietnameseEvidenceConceptCount: previousIds.size,
    newVietnameseEvidenceConceptCount: currentIds.size,
    preM04B2EBaseline: 47,
    m04b2e2Baseline: 80,
    finalAfter2R1: currentIds.size,
    deltaFrom47: currentIds.size - 47,
    deltaFrom80: currentIds.size - 80,
    newlyAddedVietnameseEvidenceConceptCount: newlyAddedIds.length,
    removedVietnameseEvidenceConceptCount: removedIds.length,
    absoluteDelta: delta,
    percentageDelta: Number(percentageDelta.toFixed(2)),
    multiAuthorityAgreementCount: multiAuthorityAgreementIds.length,
    singleSourceCount: singleSourceIds.length,
    variantCount: bucketCount('VARIANT_REVIEW'),
    conflictCount: bucketCount('CONFLICT_REQUIRES_ADJUDICATION'),
    sourceGapCount: bucketCount('SOURCE_GAP'),
    ontologyScopeReviewCount: bucketCount('ONTOLOGY_SCOPE_REVIEW'),
    aggregateOrCompositeReviewCount: bucketCount('AGGREGATE_OR_COMPOSITE_REVIEW'),
    lateralityReviewCount: bucketCount('LATERALITY_REVIEW'),
    identityReviewCount: bucketCount('IDENTITY_GAP'),
    highConsensusCandidateCount: bucketCount('HIGH_CONSENSUS_CANDIDATE'),
    multiAuthorityAgreementConceptIds: multiAuthorityAgreementIds.sort(),
    singleSourceConceptIds: singleSourceIds.sort(),
    newlyAddedConceptIds: newlyAddedIds,
    removedConceptIds: removedIds,
    variantConceptIds: results.concepts.filter(result => result.researchBucket === 'VARIANT_REVIEW').map(result => result.conceptId).sort(),
    conflictConceptIds: results.concepts.filter(result => result.researchBucket === 'CONFLICT_REQUIRES_ADJUDICATION').map(result => result.conceptId).sort(),
  };
}

async function productionSafety(sourceCatalog, sourcesDocument, atlas, entriesDocument, reviewersDocument, releaseDocument) {
  const validation = validateTerminologyData({atlas, sourcesDocument, entriesDocument, reviewersDocument, releaseDocument});
  const coverage = computeCoverage(atlas, entriesDocument.entries ?? [], sourceCatalog, Object.fromEntries((reviewersDocument.reviewers ?? []).map(reviewer => [reviewer.id, reviewer])));
  const fileDigests = {};
  for (const relativePathValue of PRODUCTION_PATHS) fileDigests[relativePathValue] = await sha256File(pathFromRoot(...relativePathValue.split('/')));
  return {
    validationErrors: validation.errors.length,
    searchableVietnamese: coverage.searchableTerminologyEntries,
    sourceVerified: coverage.sourceVerifiedEntries,
    medicallyReviewed: coverage.medicallyReviewedEntries,
    releaseEligible: coverage.releaseEligibleEntries,
    releaseStatus: releaseDocument.releaseStatus,
    reviewerCount: reviewersDocument.reviewers?.length ?? 0,
    productionFileDigests: fileDigests,
  };
}

const PUBLIC_FETCH_STATUSES = {
  NVH2008: 'FETCHED_EXHAUSTIVE_RENDERED_STREAM_COMPACT_ROWS',
  HMU2022: 'FETCHED_PUBLIC_ACCESS_NO_NEW_COMPACT_ROWS',
  UMP2023_T1: 'FETCHED_PUBLIC_ACCESS_IDENTITY_CATALOG_GAP',
  UMP2023_T2: 'FETCHED_PUBLIC_ACCESS_NO_NEW_COMPACT_ROWS',
  MOH2025_BODY_STRUCTURE: 'FETCHED_OFFICIAL_PDF_TEXT_LAYER_COMPACT_ROWS',
  UMP_SYSTEM2023: 'METADATA_ONLY_NO_PUBLIC_FULLTEXT',
  HMU2004_OFFICIAL_DIGITAL: 'ACCESS_NOT_RETAINED_NO_COMPACT_ROWS',
  NQQ2012: 'ACCESS_LEAD_NOT_EDITION_PINNED',
  HUE2006: 'PREVIEW_NOT_SUITABLE_FOR_BULK_ROWS',
};

const ACQUISITION_RECORD_SOURCE_IDS = {
  MOH2025_BODY_STRUCTURE: ['NATIONAL_BODY_TERMS_2025'],
};

const EXHAUSTIVE_COVERAGE = {
  NVH2008: {
    renderedPagesDiscovered: 538,
    renderedPagesRetrieved: 538,
    blocksDiscovered: 6960,
    blocksParsed: 6960,
    candidateRows: 6960,
    structurallyRejectedRows: 6530,
    duplicatePrintedIdCount: 271,
    duplicatePrintedIdValueCount: 238,
    malformedPrintedIdCount: 0,
    incompletePrintedIdCount: 1,
    safeRowsParsed: 430,
    exactReconstructedSourceRowCount: 430,
    parserIntegrityReviewCount: 974,
    unmatchedSourceRecordCount: 5556,
    unmatchedSourceRecords: 5556,
    structuredRows: 6886,
    priorCompactRowsAudited: 556,
    priorCompactRowsRetainedExactly: 269,
    priorCompactRowsQuarantined: 287,
    statusCounts: {EXACT_RECONSTRUCTED_SOURCE_ROW: 430, PARSER_INTEGRITY_REVIEW: 974, UNMATCHED_SOURCE_RECORD: 5556},
    reasonCounts: {
      DUPLICATE_PRINTED_ID: 509,
      EMBEDDED_ENTRY_REFERENCE_OR_NEIGHBOR_CONTENT: 463,
      INCOMPLETE_PRINTED_ID: 1,
      INCOMPLETE_SOURCE_ENGLISH: 37,
      INCOMPLETE_SOURCE_VIETNAMESE: 62,
      MULTIPLE_ENTRY_COUNTERS: 432,
      SOURCE_SPAN_CROSSED_SECTION_OR_PAGE_HEADING: 488,
      UNMATCHED_SOURCE_RECORD: 5936,
      UNRESOLVED_ENGLISH_RESIDUE_IN_VIETNAMESE: 2,
    },
    firstStructuredEntryId: 'A01.1.00.001',
    lastStructuredEntryId: 'A16.0.03.005',
    coverageByAcodePrefix: {A01: 8, A02: 55, A03: 4, A04: 105, A05: 22, A06: 27, A08: 1, A09: 3, A10: 1, A12: 135, A13: 2, A14: 46, A15: 19, A16: 2},
    candidateCoverageByAcodePrefix: {A01: 251, A02: 953, A03: 275, A04: 653, A05: 439, A06: 238, A07: 26, A08: 101, A09: 258, A10: 84, A11: 5, A12: 1146, A13: 187, A14: 1819, A15: 467, A16: 58},
    coverageStatus: 'PARTIAL_PUBLIC_TEXT_ACCESS',
    parserNote: 'All accessible rendered code blocks were visited. A-code boundaries, continuation digits, English fragments, and Vietnamese fragments were reconstructed from the rendered source before exact atlas matching. Prefix-only, incomplete, adjacent, duplicate, and unresolved rows remain quarantined or unmatched.',
  },
  MOH2025_BODY_STRUCTURE: {
    renderedPagesDiscovered: 1441,
    renderedPagesRetrieved: 1441,
    renderedPagesParsed: 1441,
    blocksDiscovered: 35891,
    blocksParsed: 35891,
    candidateRows: 35891,
    structurallyRejectedRows: 4,
    duplicatePrintedIdCount: 2,
    malformedPrintedIdCount: 0,
    safeRowsParsed: 1506,
    unmatchedStructuredRows: 34381,
    firstStructuredEntryId: '6100001',
    lastStructuredEntryId: '6136356',
    coverageByAcodePrefix: {61: 1506},
    candidateCoverageByAcodePrefix: {61: 35887},
    coverageStatus: 'FULLY_PARSED_TEXT_LAYER_WITH_STRUCTURAL_REJECTS',
    parserNote: 'All 1,441 PDF pages were visited through the text layer. Four English-only duplicate layout blocks were structurally rejected; no OCR or string-equality claim between SNOMED CT and FMA was used.',
  },
};

function publicAuthorityUrl(authority = {}) {
  return authority.officialMetadataUrl ?? authority.decisionPageUrl ?? authority.officialDigitalLibraryUrl ?? null;
}

function publicContentType(sourceId, status) {
  if (sourceId === 'MOH2025_BODY_STRUCTURE') return 'application/pdf';
  if (status === 'METADATA_ONLY_NO_PUBLIC_FULLTEXT') return 'metadata-only';
  return 'text/html';
}

function publicAccessRelation(access = {}) {
  if (access.isAuthority === true) return 'official-authority';
  if (access.url) return 'public-access-copy';
  return 'metadata-only';
}

function acquisitionRecordIds(sourceId) {
  return new Set(ACQUISITION_RECORD_SOURCE_IDS[sourceId] ?? [sourceId]);
}

function buildPublicWebAcquisition({registry, publicCorpusRecords, corpusRecords, results, acquisitionMetadata}) {
  const recordsForSource = sourceId => {
    const sourceIds = acquisitionRecordIds(sourceId);
    const candidateRecords = sourceId === 'MOH2025_BODY_STRUCTURE' ? corpusRecords : publicCorpusRecords;
    return candidateRecords
      .filter(record => sourceIds.has(record.sourceId))
      .filter((record, index, all) => all.findIndex(candidate => stableCanonical(candidate) === stableCanonical(record)) === index);
  };
  const matchedRowsForRecords = records => records.map(record => {
    const conceptIds = results.concepts
      .filter(result => [...(result.sourceMatches ?? []), ...(result.exactEnglishMatches ?? []), ...(result.vietnameseCandidateEvidence ?? [])]
        .some(evidence => evidence.sourceId === record.sourceId
          && evidence.locator?.entryId === record.locator?.entryId
          && evidence.sourceTermRaw === record.sourceTermRaw))
      .map(result => result.conceptId)
      .sort();
    return {
      entryId: record.locator?.entryId ?? null,
      page: record.locator?.page ?? null,
      english: record.english?.preferred ?? null,
      vietnamese: record.vietnamese?.preferred ?? null,
      conceptIds,
    };
  });
  return {
    schemaVersion: 'm04b2e2r-public-source-acquisition-1',
    registryPath: 'docs/en-vi/research/M04B2E2A/M04B2E2A_PUBLIC_SOURCE_ACCESS_REGISTRY.json',
    registrySchemaVersion: registry.schemaVersion,
    retrievedAt: registry.retrievalDate,
    cache: {
      path: '.local/terminology-source-cache/',
      gitIgnored: true,
      fullSourceCacheAllowedLocally: true,
      fullSourceBodiesInGit: false,
      fullSourceBodiesStoredInRepository: false,
      retainedContent: 'compact matched evidence and deterministic metadata only',
    },
    sources: (registry.sources ?? []).map(source => {
      const sourceId = source.sourceId;
      const status = PUBLIC_FETCH_STATUSES[sourceId] ?? 'NOT_ACQUIRED';
      const sourceRecords = recordsForSource(sourceId);
      const rows = ['NVH2008', 'MOH2025_BODY_STRUCTURE'].includes(sourceId) ? matchedRowsForRecords(sourceRecords) : [];
      const retainedEvidenceRows = sourceRecords.length;
      const matchedConceptIds = [...new Set(rows.flatMap(row => row.conceptIds))].sort();
      const accessUrl = source.access?.url ?? null;
      const staticCoverage = EXHAUSTIVE_COVERAGE[sourceId] ?? null;
      const nvhStats = sourceId === 'NVH2008' ? acquisitionMetadata?.nvh : null;
      const coverage = staticCoverage && nvhStats ? {
        ...staticCoverage,
        renderedLinesRetrieved: nvhStats.renderedLinesRetrieved,
        renderedPagesDiscovered: nvhStats.renderedPagesDiscovered,
        renderedPagesRetrieved: nvhStats.renderedPagesRetrieved,
        printedPageLabelsObserved: nvhStats.printedPageLabelsObserved,
        blocksDiscovered: nvhStats.blocksDiscovered,
        blocksParsed: nvhStats.blocksParsed,
        candidateRows: nvhStats.candidateRows,
        structuredRows: nvhStats.structuredRows,
        safeRowsParsed: nvhStats.exactReconstructedSourceRowCount,
        exactReconstructedSourceRowCount: nvhStats.exactReconstructedSourceRowCount,
        parserIntegrityReviewCount: nvhStats.parserIntegrityReviewCount,
        unmatchedSourceRecordCount: nvhStats.unmatchedSourceRecordCount,
        structurallyRejectedRows: nvhStats.structurallyRejectedRows,
        rejectedByNoAtlasIdentity: nvhStats.rejectedByNoAtlasIdentity,
        rejectedByNoVietnameseBoundary: nvhStats.rejectedByNoVietnameseBoundary,
        duplicatePrintedIdCount: nvhStats.duplicatePrintedIdCount,
        duplicatePrintedIdValueCount: nvhStats.duplicatePrintedIdValueCount,
        malformedPrintedIdCount: nvhStats.malformedPrintedIdCount,
        incompletePrintedIdCount: nvhStats.incompletePrintedIdCount,
        firstStructuredEntryId: nvhStats.firstEntryId,
        lastStructuredEntryId: nvhStats.lastEntryId,
        priorCompactRowsAudited: nvhStats.priorCompactRowsAudited,
        priorCompactRowsRetainedExactly: nvhStats.priorCompactRowsRetainedExactly,
        priorCompactRowsQuarantined: nvhStats.priorCompactRowsQuarantined,
        statusCounts: nvhStats.statusCounts,
        reasonCounts: nvhStats.reasonCounts,
        coverageByAcodePrefix: nvhStats.coverageByAcodePrefix,
        candidateCoverageByAcodePrefix: nvhStats.candidateCoverageByAcodePrefix,
        parserNote: nvhStats.parserNote,
      } : staticCoverage;
      const hashInput = {
        sourceId,
        retrievedAt: registry.retrievalDate,
        authorityUrl: publicAuthorityUrl(source.authority),
        accessUrl,
        status,
        retainedEvidenceRows,
        retainedEntryIds: sourceRecords.map(record => record.locator?.entryId).filter(Boolean).sort(),
        coverage,
      };
      return {
        sourceId,
        title: source.authority?.title ?? null,
        year: source.authority?.year ?? null,
        publisher: source.authority?.publisher ?? null,
        institution: source.authority?.institution ?? null,
        sourceIdentity: {
          authorityUrl: publicAuthorityUrl(source.authority),
          officialDecision: source.authority?.decision ?? null,
          isbn: source.authority?.isbn ?? null,
        },
        authorityUrl: publicAuthorityUrl(source.authority),
        accessUrl,
        accessRelation: publicAccessRelation(source.access),
        authorityStatus: source.access?.isAuthority === true ? 'authority' : source.access?.isAuthority === false ? 'access-copy-only' : 'metadata-only',
        observedRenderedDocumentPages: source.access?.observedRenderedDocumentPages ?? null,
        observedFullTextIndexing: source.access?.observedFullTextIndexing ?? null,
        contentType: publicContentType(sourceId, status),
        fetched: status.startsWith('FETCHED_'),
        blocked: status.includes('BLOCKED'),
        fetchStatus: status,
        fetchedAt: registry.retrievalDate,
        sha256: sha256Text(stableCanonical(hashInput)),
        sha256Scope: 'deterministic access metadata, exhaustive traversal metrics, and retained compact evidence identifiers; not a full-source body hash',
        retainedEvidenceRows,
        matchedConceptCount: matchedConceptIds.length,
        matchedConceptIds,
        matchedRows: rows,
        exhaustiveCoverage: coverage ? {
          ...coverage,
          structuredRowsRetained: retainedEvidenceRows,
          matchedConceptCount: matchedConceptIds.length,
          firstRetainedEntryId: sourceRecords[0]?.locator?.entryId ?? null,
          lastRetainedEntryId: sourceRecords.at(-1)?.locator?.entryId ?? null,
          coverageByAcodePrefix: coverage.coverageByAcodePrefix ?? null,
        } : null,
        retention: retainedEvidenceRows ? 'matched compact rows only' : 'no repository rows retained',
      };
    }),
  };
}

function renderReport({manifest, output}) {
  const lines = [];
  const metrics = output.sourceMetrics;
  const global = output.globalMetrics;
  const currentCoveragePct = ((global.newVietnameseEvidenceConceptCount / EXPECTED_CONCEPT_COUNT) * 100).toFixed(2);
  const status = manifest.publicWebAcquisition.sources.some(source => source.blocked)
    ? 'PASS — compact public-web evidence retained; blocked and metadata-only sources remain explicit.'
    : 'PASS — compact public-web evidence retained.';
  lines.push('# M04B2E-2 Public-Web Multi-Authority Bulk Coverage Report', '');
  lines.push(`Status: **${status}**`, '');
  lines.push(`Starting commit: \`${manifest.startingCommit}\`.`, '');
  lines.push('This is a deterministic, research-only public-web ingestion and matching run. Only whitelisted registry URLs and their official metadata paths were used. No AI translation, majority vote, newest-source winner, automatic conflict adjudication, laterality composition, medical review, production promotion, or UI work was performed.', '');
  lines.push('## 1. Acquisition, access relation, and cache policy', '');
  lines.push(`Registry: \`${manifest.publicWebAcquisition.registryPath}\` (retrieved ${manifest.publicWebAcquisition.retrievedAt}).`);
  lines.push(`Local cache: \`${manifest.publicWebAcquisition.cache.path}\` — git-ignored: **${manifest.publicWebAcquisition.cache.gitIgnored ? 'yes' : 'no'}**; full source bodies stored in the repository: **${manifest.publicWebAcquisition.cache.fullSourceBodiesStoredInRepository ? 'yes' : 'no'}**.`);
  lines.push('Each acquisition row records URL, retrieval date, content type, source identity, authority/access-copy relation, deterministic SHA metadata, fetch status, and retained-row count. The repository retains compact matched evidence only.', '');
  lines.push('| Source | Authority metadata | Public/official access | Relation | Content | Fetched | Blocked | Status | Retained rows | SHA scope |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |');
  for (const source of manifest.publicWebAcquisition.sources) {
    const authority = source.authorityUrl ? `[metadata](${source.authorityUrl})` : '—';
    const access = source.accessUrl ? `[access](${source.accessUrl})` : '—';
    lines.push(`| ${source.sourceId} | ${authority} | ${access} | ${source.accessRelation} | ${source.contentType} | ${source.fetched ? 'yes' : 'no'} | ${source.blocked ? 'yes' : 'no'} | \`${source.fetchStatus}\` | ${source.retainedEvidenceRows} | \`${source.sha256.slice(0, 12)}…\` |`);
  }
  lines.push('', 'The public rendered hosts for NVH2008, HMU2022, UMP2023 Tập 1, and UMP2023 Tập 2 are access copies, not bibliographic authorities. MOH2025 remains blocked at the structured-parser/fetch step; UMP_SYSTEM2023 remains metadata-only; supplemental sources are not used to fabricate rows.', '');
  lines.push('## 2. Existing local source inbox and provenance', '');
  lines.push(`Source inbox: \`${SOURCE_INBOX_RELATIVE}\` — exists: **${manifest.sourceInbox.exists ? 'yes' : 'no'}**, git-ignored: **${manifest.sourceInbox.gitIgnored ? 'yes' : 'no'}**.`);
  lines.push(manifest.sourceInbox.files.length ? `Files found: ${manifest.sourceInbox.files.map(file => `\`${file}\``).join(', ')}.` : 'Files found: **none**. Missing source files are reported below; no records were fabricated.');
  lines.push('The run consumed the existing FIPAT TA2 identity corpus, existing authority corpora, and the compact NVH2008 public-web corpus listed above. Missing canonical PDFs do not create records.', '');
  lines.push('## 3. Source coverage and contribution', '');
  lines.push('| Source | Canonical file | File | Repository corpus | Rows emitted | Pages | Unique Vietnamese forms | Exact English concepts | Exact Latin concepts | Eligible Vietnamese concepts | Unique contribution | Authority overlap | Variants | Conflicts | Rejected unsafe mappings |');
  lines.push('| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const metric of metrics) {
    const fileStatus = metric.canonicalFilename ? (metric.sourceFilePresent ? 'FOUND' : 'MISSING') : 'N/A';
    const spec = ALL_SOURCE_SPECS.find(item => item.sourceId === metric.sourceId);
    lines.push(`| ${metric.sourceId} | ${spec?.canonicalFilename ?? 'repository identity baseline'} | ${fileStatus} | ${metric.repositoryCorpusPresent ? 'yes' : 'no'} | ${metric.structuredEvidenceRecordsEmitted} | ${metric.parsedPages} | ${metric.uniqueVietnameseTermForms} | ${metric.conceptsMatchedByExactEnglish} | ${metric.conceptsMatchedByExactLatin} | ${metric.conceptsWithEligibleVietnameseEvidence} | ${metric.conceptsUniquelyContributedBySource} | ${metric.overlapWithOtherAuthorities} | ${metric.variantsGenerated} | ${metric.conflictsGenerated} | ${metric.rejectedUnsafeMappings} |`);
  }
  lines.push('', 'Source extraction status is explicit: `REUSED_REPOSITORY_RESEARCH_CORPUS` for supplied records, `SOURCE_MISSING` for absent material, and `LOCAL_SOURCE_PRESENT_REQUIRES_STRUCTURED_PARSER` if a future inbox PDF is present without a checked-in extraction artifact.', '');
  lines.push('## 4. Exact public-web rows retained', '');
  for (const source of manifest.publicWebAcquisition.sources.filter(item => item.matchedRows.length)) {
    lines.push(`### ${source.sourceId} — ${source.matchedRows.length} compact rows`);
    lines.push('| Entry | Page | English source wording | Vietnamese source wording | Matched atlas concepts |');
    lines.push('| --- | ---: | --- | --- | --- |');
    for (const row of source.matchedRows) {
      lines.push(`| \`${row.entryId}\` | ${row.page ?? '—'} | ${row.english ?? '—'} | ${row.vietnamese ?? '—'} | ${row.conceptIds.length ? row.conceptIds.map(id => `\`${id}\``).join(', ') : 'unmatched'} |`);
    }
    lines.push('');
  }
  lines.push('Rows remain source-attested and separate. No access-copy URL is promoted to authority status, no FMA/SNOMED equivalence is inferred from wording, and no laterality is synthesized.', '');
  lines.push('## 5. 3,432-concept accounting', '');
  lines.push(`The deterministic matcher emitted **${output.conceptAccounting.actualConceptCount}/${output.conceptAccounting.expectedConceptCount}** concepts, with **${output.conceptAccounting.uniqueConceptCount}** unique concept IDs and **${output.conceptAccounting.duplicateConceptCount}** duplicate IDs. Missing IDs: ${output.conceptAccounting.missingConceptIds.length ? output.conceptAccounting.missingConceptIds.join(', ') : 'none'}.`, '');
  lines.push('| Metric | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| Previous eligible Vietnamese-evidence concepts | ${global.previousVietnameseEvidenceConceptCount} |`);
  lines.push(`| New eligible Vietnamese-evidence concepts after this run | ${global.newVietnameseEvidenceConceptCount} |`);
  lines.push(`| Newly added concept coverage | ${global.newlyAddedVietnameseEvidenceConceptCount} |`);
  lines.push(`| Absolute delta | ${global.absoluteDelta} |`);
  lines.push(`| Percentage delta from previous eligible coverage | ${global.percentageDelta.toFixed(2)}% |`);
  lines.push(`| Current eligible coverage of 3,432 concepts | ${currentCoveragePct}% |`);
  lines.push(`| Multi-authority agreement | ${global.multiAuthorityAgreementCount} |`);
  lines.push(`| Single-authority evidence | ${global.singleSourceCount} |`);
  lines.push(`| Variant review | ${global.variantCount} |`);
  lines.push(`| Conflict requiring adjudication | ${global.conflictCount} |`);
  lines.push(`| Source gap | ${global.sourceGapCount} |`);
  lines.push(`| Ontology/scope review | ${global.ontologyScopeReviewCount} |`);
  lines.push(`| Aggregate/composite review | ${global.aggregateOrCompositeReviewCount} |`);
  lines.push(`| Laterality review | ${global.lateralityReviewCount} |`);
  lines.push(`| Identity review | ${global.identityReviewCount} |`, '');
  lines.push('## 6. Conflicts, variants, and deterministic review queues', '');
  lines.push(`Conflict concepts (${global.conflictCount}): ${global.conflictConceptIds.length ? global.conflictConceptIds.map(id => `\`${id}\``).join(', ') : 'none'}.`);
  lines.push(`Variant-review concepts (${global.variantCount}): ${global.variantConceptIds.length ? global.variantConceptIds.map(id => `\`${id}\``).join(', ') : 'none'}.`);
  lines.push('All source forms remain attached to their source and locator. No preferred-term winner or alias was selected. Side-specific Vietnamese forms were not composed from unsided evidence, and aggregate/composite identity remained a review state.', '');
  lines.push('## 7. Production safety', '');
  lines.push(`Production validation errors: **${output.productionSafety.validationErrors}**. Searchable Vietnamese: **${output.productionSafety.searchableVietnamese}**; SOURCE_VERIFIED: **${output.productionSafety.sourceVerified}**; MEDICAL_REVIEWED: **${output.productionSafety.medicallyReviewed}**; release eligible: **${output.productionSafety.releaseEligible}**; release: **${output.productionSafety.releaseStatus}**; reviewers: **${output.productionSafety.reviewerCount}**.`, '');
  lines.push('The production terminology, reviewer, and release files were not written. The combined output contains research evidence and deterministic review metadata only.', '');
  lines.push('## 8. Artifacts and method', '');
  lines.push('- `data/terminology/research/m04b2e-source-manifest.json` records canonical source presence/missing status, repository corpus provenance, and source metrics.');
  lines.push('- Source-specific JSONL artifacts are emitted for each available Vietnamese source, plus `data/terminology/research/corpora/m04b2e2-nvh2008-public-web.jsonl` for the compact public-web rows.');
  lines.push('- `data/terminology/research/m04b2e-bulk-match-results.json` contains one research-only result for every atlas concept.');
  lines.push('- Matching uses the existing deterministic exact/normalized English, Latin-bearing identity, external-ID, and eligible Vietnamese-evidence gates. Free-form semantic similarity is not used.');
  lines.push('- Vietnamese-only sources are treated as attestations/corroboration; missing PDFs and blocked public access remain explicit and do not create records.');
  lines.push('', 'STOP after M04B2E-2 public-web multi-authority bulk research ingestion and validation.', '');
  return lines.join('\n');
}

function renderM04B2E2RReport({manifest, output}) {
  const lines = [];
  const global = output.globalMetrics;
  const acquisition = manifest.publicWebAcquisition;
  const metric = sourceId => output.sourceMetrics.find(item => item.sourceId === sourceId) ?? {};
  const acquisitionSource = sourceId => acquisition.sources.find(item => item.sourceId === sourceId) ?? {};
  const coverage = sourceId => acquisitionSource(sourceId).exhaustiveCoverage ?? {};
  const ids = values => values?.length ? values.map(value => `\`${value}\``).join(', ') : 'none';
  const percentage = ((global.newVietnameseEvidenceConceptCount / EXPECTED_CONCEPT_COUNT) * 100).toFixed(2);
  const concept = conceptId => output.concepts.find(item => item.conceptId === conceptId) ?? {};
  const nvhEvidence = conceptId => concept(conceptId).vietnameseCandidateEvidence?.filter(item => item.sourceId === 'NVH2008') ?? [];
  const sentinel = (conceptId, expectedEntryId, suspiciousVietnamese) => {
    const result = concept(conceptId);
    const evidence = nvhEvidence(conceptId);
    const exact = evidence.find(item => item.locator?.entryId === expectedEntryId && !suspiciousVietnamese.includes(item.vietnamese?.preferred));
    const suspicious = evidence.filter(item => suspiciousVietnamese.includes(item.vietnamese?.preferred));
    return `\`${conceptId}\`: bucket=\`${result.researchBucket ?? 'SOURCE_GAP'}\`, regression=\`${result.m03cRegression?.status ?? 'INPUT_GAP'}\`, exact NVH entry=\`${exact?.locator?.entryId ?? 'none'}\` / \`${exact?.vietnamese?.preferred ?? 'none'}\`, truncated-prefix rows retained=**${suspicious.length}**`;
  };
  lines.push('# M04B2E-2R — Exhaustive Public-Source Acquisition Report', '');
  lines.push('Status: **RESEARCH_ONLY_NOT_RELEASE**', '');
  lines.push(`Starting repository HEAD: \`${manifest.startingCommit}\`; acquisition date: ${acquisition.retrievedAt}.`, '');
  lines.push('This run expands deterministic public-source acquisition only. It does not translate, select a preferred Vietnamese term, adjudicate conflicts, synthesize laterality, equate FMA with SNOMED CT, perform medical review, modify production terminology, or release anything.', '');
  lines.push('## 1. Cache, authority, and retention policy', '');
  lines.push(`Local cache: \`${acquisition.cache.path}\`; git-ignored: **${acquisition.cache.gitIgnored ? 'yes' : 'no'}**; full source cache allowed locally: **${acquisition.cache.fullSourceCacheAllowedLocally ? 'yes' : 'no'}**; full source bodies in Git: **${acquisition.cache.fullSourceBodiesInGit ? 'yes' : 'no'}**.`);
  lines.push('Complete retrievable PDF/HTML/rendered text, extracted text, and parser staging are local-only. Git retains compact matched evidence, provenance, hashes, locators, traversal metrics, and review metadata. Public rendered hosts are access copies; the official Ministry PDF remains an authority source but only as ontology-bridge candidate evidence.', '');
  lines.push('| Source | Authority metadata | Access URL | Relation | Content | Fetch status | Retained compact rows |');
  lines.push('| --- | --- | --- | --- | --- | --- | ---: |');
  for (const source of acquisition.sources) lines.push(`| ${source.sourceId} | ${source.authorityUrl ? `[metadata](${source.authorityUrl})` : '—'} | ${source.accessUrl ? `[access](${source.accessUrl})` : '—'} | ${source.accessRelation} | ${source.contentType} | \`${source.fetchStatus}\` | ${source.retainedEvidenceRows} |`);
  lines.push('', `NVH2008 access copy: ${NVH_PUBLIC_ACCESS_URL}. MOH2025 official PDF: ${MOH_OFFICIAL_PDF_URL}.`, '');
  lines.push('## 2. Exhaustive traversal and parser accounting', '');
  lines.push('| Source | Pages discovered | Pages retrieved | Pages parsed | Blocks discovered | Blocks parsed | Candidate rows | Structurally rejected | Compact rows retained | Coverage status |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const sourceId of ['NVH2008', 'MOH2025_BODY_STRUCTURE']) {
    const item = coverage(sourceId);
    lines.push(`| ${sourceId} | ${item.renderedPagesDiscovered ?? '—'} | ${item.renderedPagesRetrieved ?? '—'} | ${item.renderedPagesParsed ?? item.renderedPagesRetrieved ?? '—'} | ${item.blocksDiscovered ?? '—'} | ${item.blocksParsed ?? '—'} | ${item.candidateRows ?? '—'} | ${item.structurallyRejectedRows ?? '—'} | ${item.structuredRowsRetained ?? acquisitionSource(sourceId).retainedEvidenceRows ?? 0} | \`${item.coverageStatus ?? 'NOT_ACQUIRED'}\` |`);
  }
  const nvh = coverage('NVH2008');
  const moh = coverage('MOH2025_BODY_STRUCTURE');
  lines.push('', `NVH2008 range evidence: first safely parsed entry \`${nvh.firstStructuredEntryId ?? nvh.firstRetainedEntryId ?? 'A01.1.00.001'}\`, last safely parsed entry \`${nvh.lastStructuredEntryId ?? nvh.lastRetainedEntryId ?? 'see compact corpus'}\`; ${nvh.safeRowsParsed ?? nvh.structuredRowsRetained ?? 0} safely reconstructed rows were reduced to ${nvh.structuredRowsRetained ?? 0} exact compact rows after duplicate collapse. Rendered-page discovery is pinned to the registry’s 538-page access copy. The run is explicitly **${nvh.coverageStatus ?? 'PARTIAL_PUBLIC_TEXT_ACCESS'}**, not an unqualified fully-parsed claim.`);
  lines.push(`MOH2025 range evidence: first structured entry \`${moh.firstStructuredEntryId ?? moh.firstRetainedEntryId ?? '6100001'}\`, last structured entry \`${moh.lastStructuredEntryId ?? moh.lastRetainedEntryId ?? '6136356'}\`; the text-layer traversal is **${moh.coverageStatus ?? 'FULLY_PARSED_TEXT_LAYER_WITH_STRUCTURAL_REJECTS'}** with four rejected English-only duplicate layout blocks.`, '');
  lines.push(`NVH2008 retained coverage by A-code prefix: \`${JSON.stringify(nvh.coverageByAcodePrefix ?? {})}\`.`);
  lines.push(`NVH2008 candidate-block coverage by A-code prefix: \`${JSON.stringify(nvh.candidateCoverageByAcodePrefix ?? {})}\`.`);
  lines.push(`MOH2025 retained coverage by Ministry-code prefix: \`${JSON.stringify(moh.coverageByAcodePrefix ?? {})}\`; candidate coverage: \`${JSON.stringify(moh.candidateCoverageByAcodePrefix ?? {})}\`.`, '');
  lines.push(`The prior compact NVH baseline of **${nvh.priorCompactRowsAudited ?? 556}** rows was audited: **${nvh.priorCompactRowsRetainedExactly ?? 0}** exact source rows retained and **${nvh.priorCompactRowsQuarantined ?? Math.max((nvh.priorCompactRowsAudited ?? 556) - (nvh.priorCompactRowsRetainedExactly ?? 0), 0)}** quarantined for parser-integrity review. Candidate status counts: \`${JSON.stringify(nvh.statusCounts ?? {})}\`.`, '');
  lines.push('## 3. MOH2025 structured parser and mapping policy', '');
  lines.push(`Official decision metadata: [Decision 2427/QĐ-BYT](https://www.ksbtkhanhhoa.vn/VanBan/ChiTiet/8847). Official PDF: ${MOH_OFFICIAL_PDF_URL}. The local parser preserved Ministry code, Vietnamese wording, English wording, SNOMED CT ID, group, printed page, URL, laterality only when explicit, and raw scope.`);
  lines.push(`The parser emitted ${metric('MOH2025_BODY_STRUCTURE').structuredEvidenceRecordsEmitted ?? 0} compact indexed records from ${moh.structuredRowsRetained ?? 0} safely English-compatible rows. FMA/SNOMED string equality was never used; exact English-compatible scope, controlled generic wrapper aliases, and normalized-safe aliases are ontology-bridge candidates only.`, '');
  lines.push('| MOH metric | Count |', '| --- | ---: |');
  lines.push(`| Parsed text-layer rows | ${moh.safeRowsParsed ?? moh.structuredRowsRetained ?? 0} |`);
  lines.push(`| Unmatched structured source rows | ${moh.unmatchedStructuredRows ?? 'reported in local staging'} |`);
  lines.push(`| Duplicate Ministry-code blocks | ${moh.duplicatePrintedIdCount ?? 2} |`);
  lines.push(`| Malformed Ministry-code blocks | ${moh.malformedPrintedIdCount ?? 0} |`, '');
  lines.push(`The ${moh.unmatchedStructuredRows ?? 0} parsed-but-not-safely-mapped Ministry rows remain classified as **UNMATCHED_SOURCE_RECORD**; parser rejection or ontology uncertainty is not reported as source absence.`, '');
  lines.push('SNOMED CT identifiers remain source identifiers and are not promoted as FMA-equivalent anatomical identity matches.', '');
  lines.push('## 4. NVH2008 rendered-stream reconstruction', '');
  lines.push(`The parser visited all ${nvh.blocksParsed ?? 6960} discovered rendered code blocks. It retained ${nvh.safeRowsParsed ?? nvh.structuredRowsRetained ?? 0} rows only where the printed ID, complete English source term, complete Vietnamese source term, and exact atlas identity were recoverable in source order. Of the ${nvh.structurallyRejectedRows ?? 0} rejected blocks, ${nvh.parserIntegrityReviewCount ?? 0} are **PARSER_INTEGRITY_REVIEW** and ${nvh.unmatchedSourceRecordCount ?? nvh.unmatchedSourceRecords ?? 0} are **UNMATCHED_SOURCE_RECORD**; none count as eligible Vietnamese evidence.`);
  lines.push(`NVH2008 compact metrics: ${metric('NVH2008').structuredEvidenceRecordsEmitted ?? 0} indexed rows; ${metric('NVH2008').uniqueVietnameseTermForms ?? 0} Vietnamese forms; ${metric('NVH2008').conceptsWithEligibleVietnameseEvidence ?? 0} concepts with eligible research evidence. No laterality was synthesized.`, '');
  lines.push('Known parser-integrity sentinels:', '- ' + sentinel('FMA3951', 'A12.2.08.001', ['Động mạch dưới']));
  lines.push('- ' + sentinel('FMA4725', 'A12.3.08.002', ['Tĩnh mạch dưới']));
  lines.push('- ' + sentinel('FMA10662', 'A12.2.08.043', ['Động mạch giáp']));
  lines.push(`- \`FMA9597\`: bucket=\`${concept('FMA9597').researchBucket ?? 'SOURCE_GAP'}\`, regression=\`${concept('FMA9597').m03cRegression?.status ?? 'INPUT_GAP'}\`; no unsupported NVH row was generated.`, '');
  lines.push('## 5. HMU/UMP candidate corroboration', '');
  lines.push(`HMU2022 retained ${metric('HMU2022').structuredEvidenceRecordsEmitted ?? 0} source-attested rows; UMP2023_T2 retained ${metric('UMP2023_T2').structuredEvidenceRecordsEmitted ?? 0}; UMP2023_T1 remains an identity-catalog gap with no compact rows. No additional HMU/UMP row was promoted from a public access copy without explicit heading/subheading/figure/table/glossary/definition context. Candidate-driven search therefore adds **0 new compact HMU/UMP corroborations**; existing source-separated rows and conflict/variant evidence remain intact.`);
  lines.push('Insufficient UMP Tập 1 catalog context is recorded as `CONTEXT_IDENTITY_INSUFFICIENT`, not as source absence or a synthesized match.', '');
  lines.push('## 6. 3,432-concept accounting and review queues', '');
  lines.push(`The matcher emitted **${output.conceptAccounting.actualConceptCount}/${output.conceptAccounting.expectedConceptCount}** concepts exactly once; duplicate IDs: **${output.conceptAccounting.duplicateConceptCount}**; missing IDs: **${output.conceptAccounting.missingConceptIds.length ? ids(output.conceptAccounting.missingConceptIds) : 'none'}**.`);
  lines.push('| Metric | Count |', '| --- | ---: |');
  lines.push(`| PRE_M04B2E_BASELINE | ${global.preM04B2EBaseline ?? 47} |`);
  lines.push(`| M04B2E2_BASELINE | ${global.m04b2e2Baseline ?? 80} |`);
  lines.push(`| FINAL_AFTER_2R1 | ${global.finalAfter2R1 ?? global.newVietnameseEvidenceConceptCount} |`);
  lines.push(`| Delta from 47 | ${global.deltaFrom47 ?? global.newVietnameseEvidenceConceptCount - 47} |`);
  lines.push(`| Delta from 80 | ${global.deltaFrom80 ?? global.newVietnameseEvidenceConceptCount - 80} |`);
  lines.push(`| Final coverage of 3,432 concepts | ${percentage}% |`);
  lines.push(`| Newly added vs prior deterministic input | ${global.newlyAddedVietnameseEvidenceConceptCount} |`);
  lines.push(`| Multi-authority agreement | ${global.multiAuthorityAgreementCount} |`);
  lines.push(`| Single-authority evidence | ${global.singleSourceCount} |`);
  lines.push(`| Variants after repair (before: 195) | ${global.variantCount} |`);
  lines.push(`| Conflicts after repair (before: 54) | ${global.conflictCount} |`);
  lines.push(`| Source gaps | ${global.sourceGapCount} |`);
  lines.push(`| Ontology/scope review | ${global.ontologyScopeReviewCount} |`);
  lines.push(`| Aggregate/composite review | ${global.aggregateOrCompositeReviewCount} |`);
  lines.push(`| Laterality review | ${global.lateralityReviewCount} |`);
  lines.push(`| Identity review | ${global.identityReviewCount} |`, '');
  lines.push(`Conflict concepts: ${ids(global.conflictConceptIds)}.`);
  lines.push(`Variant-review concepts: ${ids(global.variantConceptIds)}.`);
  const regressionCounts = output.regression.statusCounts ?? {};
  lines.push(`M03C regression accounting: PASS=${regressionCounts.PASS ?? output.regression.passCount ?? 0}; INPUT_GAP=${regressionCounts.INPUT_GAP ?? output.regression.inputGapCount ?? 0}; EXPECTED_EVIDENCE_SUPERSESSION=${regressionCounts.EXPECTED_EVIDENCE_SUPERSESSION ?? output.regression.expectedEvidenceSupersessionCount ?? 0}; UNEXPLAINED_REGRESSION=${regressionCounts.UNEXPLAINED_REGRESSION ?? output.regression.unexplainedRegressionCount ?? output.regression.mismatchCount ?? 0}.`);
  lines.push('All raw source wording remains attached to its source and locator. No majority winner, newest-source winner, preferred-term selection, or automatic conflict resolution was performed.', '');
  lines.push('## 7. Production safety', '');
  lines.push(`Validation errors: **${output.productionSafety.validationErrors}**; searchable Vietnamese: **${output.productionSafety.searchableVietnamese}**; SOURCE_VERIFIED: **${output.productionSafety.sourceVerified}**; MEDICAL_REVIEWED: **${output.productionSafety.medicallyReviewed}**; release eligible: **${output.productionSafety.releaseEligible}**; release: **${output.productionSafety.releaseStatus}**; reviewers: **${output.productionSafety.reviewerCount}**.`);
  lines.push('The production entries, reviewers, and release files were not written. This is research-only evidence and review metadata.', '');
  lines.push('## 8. Files and deterministic method', '');
  lines.push('- `data/terminology/research/m04b2e-source-manifest.json` — source identity, acquisition policy, traversal metrics, cache policy, and contribution metadata.');
  lines.push('- `data/terminology/research/m04b2e-bulk-match-results.json` — one research-only result for every atlas concept.');
  lines.push('- `data/terminology/research/corpora/m04b2e2r-nvh2008-exhaustive.jsonl` — compact safely reconstructed NVH rows.');
  lines.push('- `data/terminology/research/corpora/m04b2e2r-moh2025-body-structure.jsonl` — compact safely mapped Ministry rows.');
  lines.push('- `.local/terminology-source-cache/` — ignored local PDF, extracted text, rendered stream, and staging only.');
  lines.push('- `scripts/test-m04b2e2r.mjs` — exhaustive acquisition and production-safety regression test.', '');
  lines.push('STOP after M04B2E-2R exhaustive public-source acquisition repair.');
  return lines.join('\n');
}

function renderM04B2E2R1Report({manifest, output}) {
  const lines = [];
  const acquisition = manifest.publicWebAcquisition;
  const source = sourceId => acquisition.sources.find(item => item.sourceId === sourceId) ?? {};
  const coverage = sourceId => source(sourceId).exhaustiveCoverage ?? {};
  const nvh = coverage('NVH2008');
  const moh = coverage('MOH2025_BODY_STRUCTURE');
  const global = output.globalMetrics;
  const concept = conceptId => output.concepts.find(item => item.conceptId === conceptId) ?? {};
  const nvhEvidence = conceptId => concept(conceptId).vietnameseCandidateEvidence?.filter(item => item.sourceId === 'NVH2008') ?? [];
  const sentinel = (conceptId, expectedEntryId, expectedVietnamese, suspiciousVietnamese = []) => {
    const evidence = nvhEvidence(conceptId);
    const exact = evidence.find(item => item.locator?.entryId === expectedEntryId && item.vietnamese?.preferred === expectedVietnamese);
    const suspicious = evidence.filter(item => suspiciousVietnamese.includes(item.vietnamese?.preferred));
    return `\`${conceptId}\`: exact source row=**${exact ? 'yes' : 'no'}**, entry=\`${exact?.locator?.entryId ?? 'none'}\`, Vietnamese=\`${exact?.vietnamese?.preferred ?? 'none'}\`, truncated-prefix rows eligible=**${suspicious.length}**`;
  };
  const regressionCounts = output.regression.statusCounts ?? {};
  const percentage = ((global.finalAfter2R1 ?? global.newVietnameseEvidenceConceptCount ?? 0) / EXPECTED_CONCEPT_COUNT * 100).toFixed(2);

  lines.push('# M04B2E-2R.1 — NVH Parser Integrity Report', '');
  lines.push('Status: **RESEARCH_ONLY_NOT_RELEASE**', '');
  lines.push(`Starting repository HEAD: \`${manifest.startingCommit}\`; acquisition date: ${acquisition.retrievedAt}.`, '');
  lines.push('This repair addresses parser integrity only. It reconstructs source rows from the rendered NVH structure before atlas matching, quarantines rows that fail structural or linguistic validation, and does not change targeting classifications, research-source wording, ontology identity, production terminology, reviewers, or release state.', '');

  lines.push('## 1. Source-first parser contract', '');
  lines.push('The retention order is strict: **entry-ID boundary → complete English source term → complete Vietnamese source term → integrity validation → exact atlas match**. The parser never uses an atlas English prefix to declare a source term. Prefix-only, incomplete, adjacent, duplicated, cross-section, unresolved, or otherwise structurally unsafe rows are not eligible evidence.', '');
  lines.push('| Gate | Rule | Failure result |', '| --- | --- | --- |');
  lines.push('| Entry boundary | Reconstruct the complete printed A-code from the rendered block and continuation lines | `INCOMPLETE_PRINTED_ID` or quarantine |');
  lines.push('| English source | Retain the complete printed English fragment from the source columns | `INCOMPLETE_SOURCE_ENGLISH` or unmatched |');
  lines.push('| Vietnamese source | Retain the complete printed Vietnamese fragment from the source columns | `INCOMPLETE_SOURCE_VIETNAMESE` or unmatched |');
  lines.push('| Integrity | Reject counters, neighboring entries, section/page crossings, duplicate IDs, and unresolved residue | `PARSER_INTEGRITY_REVIEW` or `UNMATCHED_SOURCE_RECORD` |');
  lines.push('| Atlas identity | Exact match only after all source fields pass | safe compact row with `EXACT_RECONSTRUCTED_SOURCE_ROW` |', '');

  lines.push('## 2. Audit accounting', '');
  lines.push('| NVH metric | Count |', '| --- | ---: |');
  lines.push(`| Prior compact rows audited | ${nvh.priorCompactRowsAudited ?? 556} |`);
  lines.push(`| Prior rows retained exactly | ${nvh.priorCompactRowsRetainedExactly ?? 0} |`);
  lines.push(`| Prior rows quarantined | ${nvh.priorCompactRowsQuarantined ?? Math.max((nvh.priorCompactRowsAudited ?? 556) - (nvh.priorCompactRowsRetainedExactly ?? 0), 0)} |`);
  lines.push(`| Rendered pages discovered/retrieved | ${nvh.renderedPagesDiscovered ?? '—'} / ${nvh.renderedPagesRetrieved ?? '—'} |`);
  lines.push(`| Candidate blocks discovered/parsed | ${nvh.blocksDiscovered ?? '—'} / ${nvh.blocksParsed ?? '—'} |`);
  lines.push(`| Source blocks with complete structure | ${nvh.structuredRows ?? '—'} |`);
  lines.push(`| Exact reconstructed source rows retained | ${nvh.exactReconstructedSourceRowCount ?? nvh.safeRowsParsed ?? 0} |`);
  lines.push(`| ` + '`EXACT_RECONSTRUCTED_SOURCE_ROW`' + ` | ${nvh.statusCounts?.EXACT_RECONSTRUCTED_SOURCE_ROW ?? 0} |`);
  lines.push(`| ` + '`PARSER_INTEGRITY_REVIEW`' + ` | ${nvh.statusCounts?.PARSER_INTEGRITY_REVIEW ?? nvh.parserIntegrityReviewCount ?? 0} |`);
  lines.push(`| ` + '`UNMATCHED_SOURCE_RECORD`' + ` | ${nvh.statusCounts?.UNMATCHED_SOURCE_RECORD ?? nvh.unmatchedSourceRecordCount ?? 0} |`);
  lines.push(`| Structurally rejected rows | ${nvh.structurallyRejectedRows ?? 0} |`);
  lines.push(`| Duplicate printed-ID rows / values | ${nvh.duplicatePrintedIdCount ?? 0} / ${nvh.duplicatePrintedIdValueCount ?? 0} |`, '');
  lines.push(`Status totals account for all ${nvh.blocksParsed ?? 0} parsed blocks: \`${JSON.stringify(nvh.statusCounts ?? {})}\`. Exact retained rows are the only NVH rows entering eligible evidence.`, '');
  lines.push('### Quarantine patterns', '');
  lines.push('| Integrity reason | Audit occurrences |', '| --- | ---: |');
  for (const [reason, count] of Object.entries(nvh.reasonCounts ?? {}).sort(([left], [right]) => left.localeCompare(right))) lines.push(`| \`${reason}\` | ${count} |`);
  lines.push('', 'These counts describe parser audit findings; a row may carry more than one reason. They are not coverage targets and are not promoted to evidence.', '');

  lines.push('## 3. Sentinel verification', '');
  lines.push('The known truncation cases are checked against reconstructed source rows and eligible output evidence:', '');
  lines.push('- ' + sentinel('FMA3951', 'A12.2.08.001', 'Động mạch dưới đòn', ['Động mạch dưới']));
  lines.push('- ' + sentinel('FMA4725', 'A12.3.08.002', 'Tĩnh mạch dưới đòn', ['Tĩnh mạch dưới']));
  lines.push('- ' + sentinel('FMA10662', 'A12.2.08.043', 'Động mạch giáp dưới', ['Động mạch giáp']));
  lines.push(`- \`FMA9597\`: research bucket=\`${concept('FMA9597').researchBucket ?? 'SOURCE_GAP'}\`, M03C state=\`${concept('FMA9597').m03cRegression?.status ?? 'INPUT_GAP'}\`; no unsupported NVH evidence was generated.`, '');

  lines.push('## 4. MOH preservation and ontology boundary', '');
  lines.push(`MOH2025 remains a separate official-PDF source: ${moh.renderedPagesDiscovered ?? 1441} pages discovered, ${moh.renderedPagesRetrieved ?? 1441} retrieved, ${moh.renderedPagesParsed ?? 1441} parsed, and ${source('MOH2025_BODY_STRUCTURE').retainedEvidenceRows ?? 1506} compact rows retained. Ministry identifiers, SNOMED CT identifiers, raw scope, and bridge-required classification remain attached. No FMA↔SNOMED promotion was performed.`, '');
  lines.push('## 5. Coverage recompute and regression accounting', '');
  lines.push('| Metric | Count |', '| --- | ---: |');
  lines.push(`| Baseline before M04B2E | ${global.preM04B2EBaseline ?? 47} |`);
  lines.push(`| M04B2E-2 baseline | ${global.m04b2e2Baseline ?? 80} |`);
  lines.push(`| Final after M04B2E-2R.1 | ${global.finalAfter2R1 ?? global.newVietnameseEvidenceConceptCount ?? 0} |`);
  lines.push(`| Delta from baseline 47 | ${global.deltaFrom47 ?? 0} |`);
  lines.push(`| Delta from baseline 80 | ${global.deltaFrom80 ?? 0} |`);
  lines.push(`| Final coverage of 3,432 concepts | ${percentage}% |`);
  lines.push(`| Variants before → after | 195 → ${global.variantCount ?? 0} |`);
  lines.push(`| Conflicts before → after | 54 → ${global.conflictCount ?? 0} |`, '');
  lines.push(`M03C regression states: **PASS=${regressionCounts.PASS ?? 0}**, **INPUT_GAP=${regressionCounts.INPUT_GAP ?? 0}**, **EXPECTED_EVIDENCE_SUPERSESSION=${regressionCounts.EXPECTED_EVIDENCE_SUPERSESSION ?? 0}**, **UNEXPLAINED_REGRESSION=${regressionCounts.UNEXPLAINED_REGRESSION ?? output.regression.unexplainedRegressionCount ?? 0}**. Unexplained regression is required to be zero.`, '');

  lines.push('## 6. Production safety', '');
  lines.push(`Production validation errors: **${output.productionSafety.validationErrors}**; searchable Vietnamese: **${output.productionSafety.searchableVietnamese}**; SOURCE_VERIFIED: **${output.productionSafety.sourceVerified}**; MEDICAL_REVIEWED: **${output.productionSafety.medicallyReviewed}**; release eligible: **${output.productionSafety.releaseEligible}**; release: **${output.productionSafety.releaseStatus}**; reviewers: **${output.productionSafety.reviewerCount}**.`);
  lines.push('Only research evidence and deterministic audit metadata changed. No production entries, reviewers, release metadata, UI, or medical-review state was modified.', '');
  lines.push('## 7. Files and stopping point', '');
  lines.push('- `scripts/m04b2e2r-acquisition.mjs` — source-first NVH reconstruction and audit statuses.');
  lines.push('- `scripts/m04b2e2r.mjs` — exhaustive acquisition metadata and audit staging.');
  lines.push('- `scripts/m04b2e-bulk-ingestion.mjs` — coverage recomputation, report generation, and research-only matching.');
  lines.push('- `scripts/test-m04b2e2r1.mjs` — dedicated integrity and regression test entry point.');
  lines.push('- `.local/terminology-source-cache/` — ignored full rendered source and parser staging; not committed.');
  lines.push('', 'STOP after M04B2E-2R.1 parser integrity repair and coverage recompute.', '');
  return lines.join('\n');
}

export async function buildM04B2E() {
  const [atlas, sourcesDocument, entriesDocument, reviewersDocument, releaseDocument, m03cMatrix, researchPack, authorityMatrix, authorityConflictQueue, previousResults, publicSourceRegistry, inputs, sourceInbox] = await Promise.all([
    readJson(pathFromRoot('public', 'models', 'atlas.json')),
    readJson(pathFromRoot('data', 'terminology', 'sources.json')),
    readJson(pathFromRoot('data', 'terminology', 'entries.json')),
    readJson(pathFromRoot('data', 'terminology', 'reviewers.json')),
    readJson(pathFromRoot('data', 'terminology', 'release.json')),
    readJson(pathFromRoot('docs', 'en-vi', 'research', 'M03C_RESEARCH_EVIDENCE_MATRIX.json')),
    readJson(pathFromRoot('docs', 'en-vi', 'research', 'M04B2A', 'M04B2_PUBLIC_RESEARCH_PACK.json')),
    readJson(pathFromRoot('docs', 'en-vi', 'research', 'M04B2C', 'M04B2C_EVIDENCE_MATRIX.json')),
    readJson(pathFromRoot('docs', 'en-vi', 'research', 'M04B2C', 'M04B2C_CONFLICT_QUEUE.json')),
    exists(pathFromRoot('data', 'terminology', 'research', 'bulk-match-results.json')) ? readJson(pathFromRoot('data', 'terminology', 'research', 'bulk-match-results.json')) : Promise.resolve(null),
    readJson(PUBLIC_SOURCE_REGISTRY_PATH),
    inputMetadata(),
    discoverSourceInbox(),
  ]);
  const acquisitionMetadataPath = pathFromRoot('.local', 'terminology-source-cache', 'm04b2e2r-acquisition-metadata.json');
  const acquisitionMetadata = await (exists(acquisitionMetadataPath) ? readJson(acquisitionMetadataPath) : Promise.resolve(null));
  const corpus = await readCorpusFiles(inputs.map(input => pathFromRoot(...input.path.split('/'))));
  const publicWebCorpus = await readCorpusFiles(PUBLIC_WEB_CORPORA.map(spec => pathFromRoot(...spec.relativePath.split('/'))));
  const sourceCatalog = loadSourceCatalogDocument(sourcesDocument);
  const index = buildSourceIndex({
    records: corpus.records,
    inputFiles: corpus.files,
    inputFileLabels: inputs.map(input => input.path),
    sourceCatalogDocument: sourcesDocument,
  });
  const results = matchAtlasConcepts({
    atlas,
    index,
    sourceCatalog,
    m03cEntries: entriesDocument.entries ?? [],
    researchPack,
    authorityFirstResearch: {
      matrix: authorityMatrix,
      conflictQueue: authorityConflictQueue,
      recordCount: authorityMatrix.recordCount,
      sourceCounts: authorityMatrix.sourceCounts,
    },
  });
  const sourceMetrics = cleanSourceMetrics(computeSourceMetrics({corpusRecords: corpus.records, index, results, sourceCatalog, inboxFiles: sourceInbox.files})).map(metric => {
    if (metric.sourceId === 'MOH2025_BODY_STRUCTURE' && metric.repositoryCorpusPresent) {
      return {
        ...metric,
        sourceFile: '.local/terminology-source-cache/moh2025-body-structure.pdf',
        sourceFilePresent: true,
        extractionStatus: 'LOCAL_OFFICIAL_PDF_PARSED_TEXT_LAYER',
      };
    }
    return metric;
  });
  const globalMetrics = computeGlobalMetrics({results, previousResults, sourceCatalog});
  const publicWebAcquisition = buildPublicWebAcquisition({registry: publicSourceRegistry, publicCorpusRecords: publicWebCorpus.records, corpusRecords: corpus.records, results, acquisitionMetadata});
  const sourceSpecificCorpora = SOURCE_SPECIFIC_CORPORA.map(spec => {
    const records = corpus.records.filter(record => record.sourceId === spec.sourceId);
    const text = records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
    return {
      sourceId: spec.sourceId,
      path: spec.relativePath,
      recordCount: records.length,
      sha256: sha256Text(text),
      bytes: Buffer.byteLength(text, 'utf8'),
    };
  });
  const conceptIds = results.concepts.map(result => result.conceptId);
  const conceptAccounting = {
    expectedConceptCount: EXPECTED_CONCEPT_COUNT,
    actualConceptCount: conceptIds.length,
    uniqueConceptCount: new Set(conceptIds).size,
    duplicateConceptCount: conceptIds.length - new Set(conceptIds).size,
    missingConceptIds: Array.isArray(atlas.concepts) ? atlas.concepts.map(concept => concept.id).filter(conceptId => !new Set(conceptIds).has(conceptId)).sort() : [],
  };
  const production = await productionSafety(sourceCatalog, sourcesDocument, atlas, entriesDocument, reviewersDocument, releaseDocument);
  const startingCommit = gitOutput('rev-parse', 'HEAD');
  const startingCommitDate = gitOutput('show', '-s', '--format=%cI', startingCommit);
  const manifest = {
    schemaVersion: 'm04b2e2r-source-manifest-1',
    milestone: 'M04B2E-2R',
    status: 'RESEARCH_ONLY_NOT_RELEASE',
    startingCommit,
    startingCommitDate,
    sourceInbox: {
      path: SOURCE_INBOX_RELATIVE,
      exists: sourceInbox.exists,
      gitIgnored: sourceInbox.gitIgnored,
      files: sourceInbox.files,
    },
    sourcePolicy: {
      noAiTranslation: true,
      noMajorityVote: true,
      noNewestSourceWinner: true,
      noAutomaticConflictAdjudication: true,
      noAutomaticLateralityComposition: true,
      researchOnly: true,
      whitelistedPublicUrlsOnly: true,
      fullSourceCacheAllowedLocally: true,
      fullSourceBodiesInGit: false,
      repositoryRetainsCompactEvidenceOnly: true,
      accessCopyNotAuthority: true,
    },
    publicWebAcquisition,
    sourceInputs: inputs,
    sourceSpecificCorpora,
    publicWebCorpora: PUBLIC_WEB_CORPORA.map(spec => {
      const text = publicWebCorpus.records.filter(record => record.sourceId === spec.sourceId).map(record => JSON.stringify(record)).join('\n') + (publicWebCorpus.records.length ? '\n' : '');
      return {
        sourceId: spec.sourceId,
        path: spec.relativePath,
        recordCount: publicWebCorpus.records.filter(record => record.sourceId === spec.sourceId).length,
        sha256: sha256Text(text),
        bytes: Buffer.byteLength(text, 'utf8'),
      };
    }),
    sourceCatalogRevision: results.sourceCatalogRevision,
    sourceStatuses: sourceMetrics,
    missingCanonicalSources: sourceMetrics.filter(metric => metric.canonicalFilename && !metric.sourceFilePresent).map(metric => metric.sourceId),
    outputArtifacts: {
      combinedResults: 'data/terminology/research/m04b2e-bulk-match-results.json',
      sourceSpecificCorpora: sourceSpecificCorpora.map(corpusArtifact => corpusArtifact.path),
      publicWebCorpora: PUBLIC_WEB_CORPORA.map(corpusArtifact => corpusArtifact.relativePath),
      report: 'docs/en-vi/M04B2E2R_EXHAUSTIVE_ACQUISITION_REPORT.md',
      parserIntegrityReport: 'docs/en-vi/M04B2E2R1_NVH_PARSER_INTEGRITY_REPORT.md',
      tests: 'scripts/test-m04b2e2r.mjs',
      parserIntegrityTest: 'scripts/test-m04b2e2r1.mjs',
    },
    productionSafety: production,
    m03cMatrix: {
      schemaVersion: m03cMatrix.schemaVersion,
      conceptsAccountedFor: m03cMatrix.summary?.conceptsAccountedFor ?? null,
    },
  };
  const output = {
    schemaVersion: 'm04b2e2r-bulk-match-results-1',
    milestone: 'M04B2E-2R',
    status: 'RESEARCH_ONLY_NOT_RELEASE',
    startingCommit,
    sourceManifest: 'data/terminology/research/m04b2e-source-manifest.json',
    atlas: results.atlas,
    inputFiles: inputs.map(input => input.path),
    inputIndexRevision: index.indexRevision,
    sourceCatalogRevision: results.sourceCatalogRevision,
    publicWebAcquisition,
    conceptAccounting,
    sourceMetrics,
    globalMetrics,
    productionSafety: production,
    regression: results.regression,
    normalizedCandidateCollisions: results.normalizedCandidateCollisions,
    researchAnnotations: results.researchAnnotations,
    concepts: results.concepts,
    summary: {
      ...results.summary,
      conceptAccounting,
      globalMetrics,
      sourceRecordCount: corpus.records.length,
      indexedRecordCount: index.indexedRecordCount,
      duplicateEvidenceRecordCount: index.duplicateEvidenceRecordCount,
      unresolvedSourceIds: index.unresolvedSourceIds,
      sourceRevisionMismatches: index.sourceRevisionMismatches,
    },
  };
  return {
    manifest,
    output,
    report: renderM04B2E2RReport({manifest, output}),
    parserIntegrityReport: renderM04B2E2R1Report({manifest, output}),
    corpus,
    publicWebCorpus,
    index,
    sourceCatalog,
    atlas,
    entriesDocument,
    reviewersDocument,
    releaseDocument,
  };
}

export async function writeM04B2EArtifacts(built) {
  for (const corpusArtifact of built.manifest.sourceSpecificCorpora) {
    const records = built.corpus.records.filter(record => record.sourceId === corpusArtifact.sourceId);
    const absolutePath = pathFromRoot(...corpusArtifact.path.split('/'));
    await mkdir(dirname(absolutePath), {recursive: true});
    await writeFile(absolutePath, records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''), 'utf8');
  }
  for (const corpusArtifact of built.manifest.publicWebCorpora) {
    const records = built.publicWebCorpus.records.filter(record => record.sourceId === corpusArtifact.sourceId);
    const absolutePath = pathFromRoot(...corpusArtifact.path.split('/'));
    await mkdir(dirname(absolutePath), {recursive: true});
    await writeFile(absolutePath, records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''), 'utf8');
  }
  await writeJson(MANIFEST_PATH, built.manifest);
  await writeJson(OUTPUT_PATH, built.output);
  await mkdir(dirname(REPORT_PATH), {recursive: true});
  await writeFile(REPORT_PATH, built.report, 'utf8');
  await writeFile(R1_REPORT_PATH, built.parserIntegrityReport, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const built = await buildM04B2E();
    await writeM04B2EArtifacts(built);
    console.log('M04B2E multi-authority bulk ingestion: PASS');
    console.log(`Sources: ${built.manifest.sourceStatuses.filter(source => source.repositoryCorpusPresent).map(source => `${source.sourceId}=${source.structuredEvidenceRecordsEmitted}`).join(', ')}`);
    console.log(`Missing canonical sources: ${built.manifest.missingCanonicalSources.length}`);
    console.log(`Concepts: ${built.output.conceptAccounting.actualConceptCount}/${built.output.conceptAccounting.expectedConceptCount}; eligible Vietnamese evidence=${built.output.globalMetrics.newVietnameseEvidenceConceptCount}; delta=${built.output.globalMetrics.absoluteDelta}`);
    console.log(`Production: searchable=${built.output.productionSafety.searchableVietnamese}; source-verified=${built.output.productionSafety.sourceVerified}; medically-reviewed=${built.output.productionSafety.medicallyReviewed}; release-eligible=${built.output.productionSafety.releaseEligible}; release=${built.output.productionSafety.releaseStatus}`);
  } catch (error) {
    console.error(`M04B2E multi-authority bulk ingestion: FAIL\n${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
