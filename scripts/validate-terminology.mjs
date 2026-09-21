import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  computeTerminologyRevision,
  hasVerifiedLatin,
  hasVerifiedVietnamese,
  terminologySearchTerms,
  sourceSupportsCapability,
} from '../app/terminology.ts';
import {normalizeSearchText} from '../app/search-normalization.ts';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const SCHEMA_VERSION = 2;
const SOURCE_SCHEMA_VERSION = 3;
const VALID_SOURCE_CLASSES = new Set(['international-nomenclature', 'atlas-dataset', 'vietnamese-authoritative', 'secondary-reference', 'machine-generated']);
const VALID_SOURCE_STATUSES = new Set(['UNVERIFIED', 'VERIFIED']);
const VALID_SOURCE_AUTHORITY_TIERS = new Set(['authoritative', 'corroborative', 'discovery-only', 'rejected']);
const VALID_SOURCE_ACCESS_STATUSES = new Set(['FULL_ACCESS', 'PARTIAL_ACCESS', 'METADATA_ONLY', 'UNAVAILABLE']);
const VALID_SOURCE_LOCATOR_CAPABILITIES = new Set(['PAGE', 'PLATE', 'CHAPTER_SECTION', 'TERM_ID', 'STABLE_ENTRY', 'INSUFFICIENT']);
const VALID_MAPPING_STATUSES = new Set(['UNMAPPED', 'MAPPED', 'REJECTED']);
const VALID_MAPPING_DISPOSITIONS = new Set(['NOT_INVESTIGATED', 'UNRESOLVED', 'CONFIRMED_NO_EQUIVALENT']);
const VALID_MAPPING_RELATIONS = new Set(['exact', 'equivalent', 'target-broader', 'target-narrower', 'overlapping', 'related', 'composite', 'collective', 'obsolete-replaced']);
const VALID_MAPPING_DISPOSITION = new Set(['CANDIDATE', 'VERIFIED', 'REJECTED', 'SUPERSEDED']);
const VALID_REVIEW_STATUSES = new Set(['UNMAPPED', 'DRAFT', 'SOURCE_VERIFIED', 'MEDICAL_REVIEWED', 'VERIFIED', 'RELEASE_ELIGIBLE', 'REJECTED']);
const VALID_REVIEW_AUDIT_TYPES = new Set(['source-verification', 'medical-review', 'release-eligibility']);
const VALID_REVIEW_AUDIT_STATUSES = new Set(['PENDING', 'PASSED', 'REJECTED']);
const VALID_CLAIM_TYPES = new Set(['atlas-identity', 'atlas-fma-mapping', 'atlas-ta2-mapping', 'canonical-latin', 'latin-alias', 'english-alias', 'vietnamese-preferred', 'vietnamese-alias', 'vietnamese-search-alias', 'secondary-corroboration']);
const VALID_EVIDENCE_DISPOSITIONS = new Set(['CANDIDATE', 'SUPPORTED', 'REJECTED', 'SUPERSEDED']);
const VALID_CLAIM_REVIEW_STATES = new Set(['PENDING', 'VERIFIED', 'REJECTED']);
const VALID_CONFLICT_TYPES = new Set(['identity-disagreement', 'granularity-disagreement', 'contextual-difference', 'edition-version-difference', 'competing-preferred-terminology']);
const VALID_CONFLICT_STATUSES = new Set(['OPEN', 'ADJUDICATED', 'REJECTED']);
const VALID_LOCATOR_KEYS = new Set(['page', 'plate', 'chapter', 'section', 'table', 'entryId', 'url', 'nomenclatureId']);
const VALID_SOURCE_CAPABILITY_KEYS = new Set(['anatomicalIdentity', 'canonicalLatin', 'vietnamesePreferred', 'secondaryCorroboration', 'machineCandidateDiscovery']);
const PLACEHOLDER_PATTERN = /^(?:TODO|TBD|UNKNOWN|PLACEHOLDER|N\/A|NA)$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonemptyString(value) { return typeof value === 'string' && Boolean(value.trim()); }
function isValidDate(value) { return nonemptyString(value) && DATE_PATTERN.test(value) && Number.isFinite(Date.parse(value)); }
function isValidUrl(value) { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol); } catch { return false; } }
function hasPlaceholder(value) { return typeof value === 'string' ? PLACEHOLDER_PATTERN.test(value.trim()) : Array.isArray(value) && value.some(hasPlaceholder); }
function addFinding(bucket, code, message, path, extra = {}) { bucket.push({code, message, ...(path ? {path} : {}), ...extra}); }
function addError(result, code, message, path, extra) { addFinding(result.errors, code, message, path, extra); }
function addWarning(result, code, message, path, extra) { addFinding(result.warnings, code, message, path, extra); }

function stableCanonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableCanonical(value[key])}`).join(',')}}`;
}
function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `m02b-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
function documentRevision(document) { return hashText(stableCanonical(document)); }

function validateSchemaVersion(document, label, expected, result) {
  if (!isObject(document) || document.schemaVersion !== expected) addError(result, 'unsupported-schema-version', `${label} must declare schemaVersion ${expected}`, `${label}.schemaVersion`);
}
function getArray(document, key, result) {
  if (!isObject(document) || !Array.isArray(document[key])) { addError(result, 'invalid-document-shape', `${key} must be an array`, key); return []; }
  return document[key];
}
function validateStringArray(value, path, result, {allowEmpty = true} = {}) {
  if (value === undefined && allowEmpty) return [];
  if (!Array.isArray(value)) { addError(result, 'invalid-string-array', `${path} must be an array of strings`, path); return []; }
  const seen = new Set();
  value.forEach((item, index) => {
    if (!nonemptyString(item)) { addError(result, 'invalid-string-array-item', `${path}[${index}] must be a non-empty string`, `${path}[${index}]`); return; }
    const normalized = normalizeSearchText(item.trim());
    if (seen.has(normalized)) addError(result, 'duplicate-normalized-term', `${path} contains duplicate normalized terms`, `${path}[${index}]`);
    seen.add(normalized);
  });
  return value.filter(nonemptyString).map(item => item.trim());
}

function validateSources(records, result) {
  const sourceCatalog = {};
  const seen = new Set();
  records.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isObject(source)) { addError(result, 'invalid-source', 'Source record must be an object', path); return; }
    if (!nonemptyString(source.id)) addError(result, 'invalid-source-id', 'Source id is required', `${path}.id`);
    if (seen.has(source.id)) addError(result, 'duplicate-source-id', `Duplicate source id: ${source.id}`, `${path}.id`);
    seen.add(source.id);
    if (!VALID_SOURCE_CLASSES.has(source.class)) addError(result, 'invalid-source-class', 'Source class is invalid', `${path}.class`);
    if (!nonemptyString(source.title) || hasPlaceholder(source.title)) addError(result, 'invalid-source-title', 'Source title is required and cannot be a placeholder', `${path}.title`);
    if (!nonemptyString(source.revision) || hasPlaceholder(source.revision)) addError(result, 'invalid-source-revision', 'Source revision is required and cannot be a placeholder', `${path}.revision`);
    if (typeof source.identityVerified !== 'boolean') addError(result, 'invalid-source-identity-verification', 'identityVerified must be boolean', `${path}.identityVerified`);
    if (!VALID_SOURCE_AUTHORITY_TIERS.has(source.authorityTier)) addError(result, 'invalid-source-authority-tier', 'authorityTier is invalid', `${path}.authorityTier`);
    validateStringArray(source.authorityScope, `${path}.authorityScope`, result, {allowEmpty: false});
    if (!VALID_SOURCE_ACCESS_STATUSES.has(source.accessStatus)) addError(result, 'invalid-source-access-status', 'accessStatus is invalid', `${path}.accessStatus`);
    if (!VALID_SOURCE_LOCATOR_CAPABILITIES.has(source.locatorCapability)) addError(result, 'invalid-source-locator-capability', 'locatorCapability is invalid', `${path}.locatorCapability`);
    if (typeof source.fullTextAvailableForReview !== 'boolean') addError(result, 'invalid-source-full-text-flag', 'fullTextAvailableForReview must be boolean', `${path}.fullTextAvailableForReview`);
    if (typeof source.contentInspected !== 'boolean') addError(result, 'invalid-source-content-inspection', 'contentInspected must be boolean', `${path}.contentInspected`);
    validateStringArray(source.verificationEvidence, `${path}.verificationEvidence`, result, {allowEmpty: false});
    validateStringArray(source.limitations, `${path}.limitations`, result, {allowEmpty: false});
    if (!isObject(source.capabilities)) addError(result, 'missing-source-capabilities', 'Source capabilities are required', `${path}.capabilities`);
    else {
      for (const key of VALID_SOURCE_CAPABILITY_KEYS) if (typeof source.capabilities[key] !== 'boolean') addError(result, 'invalid-source-capability', `${key} must be boolean`, `${path}.capabilities.${key}`);
      for (const key of Object.keys(source.capabilities)) if (!VALID_SOURCE_CAPABILITY_KEYS.has(key)) addError(result, 'unknown-source-capability', `${key} is not supported`, `${path}.capabilities.${key}`);
    }
    if (!isObject(source.audit) || !VALID_SOURCE_STATUSES.has(source.audit.status)) addError(result, 'invalid-source-audit', 'Source audit status is invalid', `${path}.audit`);
    if (source.audit?.status === 'VERIFIED' && (!isValidDate(source.audit.verifiedAt) || !nonemptyString(source.audit.verifiedBy))) addError(result, 'verified-source-missing-audit', 'VERIFIED sources require verifiedAt and verifiedBy', `${path}.audit`);
    if (source.audit?.status === 'VERIFIED' && source.identityVerified !== true) addError(result, 'verified-source-identity-mismatch', 'A VERIFIED source audit requires identityVerified=true', `${path}.identityVerified`);
    if (source.identityVerified === true && source.audit?.status !== 'VERIFIED') addError(result, 'identity-without-verified-audit', 'identityVerified=true requires a VERIFIED source audit', `${path}.audit`);
    if (source.accessStatus === 'METADATA_ONLY' || source.accessStatus === 'UNAVAILABLE') {
      if (source.fullTextAvailableForReview === true) addError(result, 'access-status-full-text-conflict', 'Metadata-only or unavailable sources cannot advertise full text availability', `${path}.fullTextAvailableForReview`);
      if (source.contentInspected === true) addError(result, 'access-status-inspection-conflict', 'Metadata-only or unavailable sources cannot claim content inspection', `${path}.contentInspected`);
    }
    if (source.locatorCapability === 'INSUFFICIENT' && source.fullTextAvailableForReview === true) addWarning(result, 'full-text-with-insufficient-locator', 'Full text is available but no reproducible claim locator capability is recorded', `${path}.locatorCapability`);
    if (source.class === 'machine-generated' && (source.capabilities?.machineCandidateDiscovery !== true || source.capabilities?.anatomicalIdentity || source.capabilities?.canonicalLatin || source.capabilities?.vietnamesePreferred || source.capabilities?.secondaryCorroboration)) addError(result, 'source-capability-conflict', 'Machine sources can advertise only machine candidate discovery', path);
    if (source.class === 'vietnamese-authoritative' && source.capabilities?.vietnamesePreferred !== true) addError(result, 'source-capability-conflict', 'Vietnamese authoritative sources require vietnamesePreferred', path);
    if (source.class === 'atlas-dataset' && source.capabilities?.anatomicalIdentity !== true) addError(result, 'source-capability-conflict', 'Atlas datasets require anatomicalIdentity', path);
    if (source.class === 'secondary-reference' && source.capabilities?.secondaryCorroboration !== true) addError(result, 'source-capability-conflict', 'Secondary sources require secondaryCorroboration', path);
    if (source.capabilities?.machineCandidateDiscovery && source.class !== 'machine-generated') addError(result, 'source-capability-conflict', 'Only machine-generated sources may advertise machine discovery', path);
    if (source.class === 'machine-generated' && source.authorityTier !== 'discovery-only') addError(result, 'machine-source-authority-conflict', 'Machine-generated sources must be discovery-only', `${path}.authorityTier`);
    if (source.class === 'vietnamese-authoritative' && source.authorityTier !== 'authoritative') addError(result, 'vietnamese-source-authority-conflict', 'Vietnamese authoritative sources must declare authoritative tier', `${path}.authorityTier`);
    if (source.authorityTier === 'rejected' && source.audit?.status === 'VERIFIED') addError(result, 'rejected-source-verified', 'Rejected sources cannot have a VERIFIED source audit', path);
    if (nonemptyString(source.url) && !isValidUrl(source.url)) addError(result, 'invalid-source-url', 'Source URL must be http(s)', `${path}.url`);
    if (nonemptyString(source.id)) sourceCatalog[source.id] = source;
  });
  return sourceCatalog;
}

function validateReviewers(records, result) {
  const reviewerCatalog = {};
  const seen = new Set();
  records.forEach((reviewer, index) => {
    const path = `reviewers[${index}]`;
    if (!isObject(reviewer)) { addError(result, 'invalid-reviewer', 'Reviewer record must be an object', path); return; }
    if (!nonemptyString(reviewer.id)) addError(result, 'invalid-reviewer-id', 'Reviewer id is required', `${path}.id`);
    if (seen.has(reviewer.id)) addError(result, 'duplicate-reviewer-id', `Duplicate reviewer id: ${reviewer.id}`, `${path}.id`);
    seen.add(reviewer.id);
    if (!nonemptyString(reviewer.displayName) || !nonemptyString(reviewer.role)) addError(result, 'invalid-reviewer-identity', 'Reviewer displayName and role are required', path);
    validateStringArray(reviewer.qualifications, `${path}.qualifications`, result, {allowEmpty: false});
    validateStringArray(reviewer.authorizationScope, `${path}.authorizationScope`, result, {allowEmpty: false});
    if (!['ACTIVE', 'INACTIVE'].includes(reviewer.status)) addError(result, 'invalid-reviewer-status', 'Reviewer status is invalid', `${path}.status`);
    if (nonemptyString(reviewer.evidenceRef) && !isValidUrl(reviewer.evidenceRef) && !reviewer.evidenceRef.startsWith('git:')) addError(result, 'invalid-reviewer-evidence', 'Reviewer evidenceRef must be an http(s) URL or git reference', `${path}.evidenceRef`);
    if (nonemptyString(reviewer.id)) reviewerCatalog[reviewer.id] = reviewer;
  });
  return reviewerCatalog;
}

function hasExactLocator(locator) {
  return Boolean(locator && ((Number.isInteger(locator.page) && locator.page > 0) || ['plate', 'chapter', 'section', 'table', 'entryId', 'nomenclatureId'].some(key => nonemptyString(locator[key]))));
}
function claimCapability(type) {
  if (['atlas-identity', 'atlas-fma-mapping', 'atlas-ta2-mapping'].includes(type)) return 'anatomical-identity';
  if (['canonical-latin', 'latin-alias'].includes(type)) return 'canonical-latin';
  if (['vietnamese-preferred', 'vietnamese-alias', 'vietnamese-search-alias'].includes(type)) return 'vietnamese-preferred';
  if (type === 'secondary-corroboration') return 'secondary-corroboration';
  return undefined;
}

function sourceLocatorSupportsClaim(source, locator) {
  if (!source || !isObject(locator)) return false;
  switch (source.locatorCapability) {
    case 'PAGE': return Number.isInteger(locator.page) && locator.page > 0;
    case 'PLATE': return nonemptyString(locator.plate) || nonemptyString(locator.table);
    case 'CHAPTER_SECTION': return nonemptyString(locator.chapter) || nonemptyString(locator.section);
    case 'TERM_ID':
    case 'STABLE_ENTRY': return nonemptyString(locator.entryId) || nonemptyString(locator.nomenclatureId);
    case 'INSUFFICIENT':
    default: return false;
  }
}

function sourceEvidenceUsable(source, claim) {
  return Boolean(
    source &&
      source.identityVerified === true &&
      source.authorityTier !== 'discovery-only' &&
      source.authorityTier !== 'rejected' &&
      !['METADATA_ONLY', 'UNAVAILABLE'].includes(source.accessStatus) &&
      source.fullTextAvailableForReview === true &&
      source.contentInspected === true &&
      source.locatorCapability !== 'INSUFFICIENT' &&
      sourceLocatorSupportsClaim(source, claim.locator),
  );
}
function validateLocator(locator, path, result, {exact = false} = {}) {
  if (!isObject(locator)) { addError(result, 'invalid-claim-locator', 'Claim locator must be an object', path); return; }
  for (const key of Object.keys(locator)) if (!VALID_LOCATOR_KEYS.has(key)) addError(result, 'unknown-claim-locator-field', `${key} is not supported`, `${path}.${key}`);
  if (locator.page !== undefined && (!Number.isInteger(locator.page) || locator.page <= 0)) addError(result, 'invalid-claim-page', 'Locator page must be a positive integer', `${path}.page`);
  for (const key of ['plate', 'chapter', 'section', 'table', 'entryId', 'nomenclatureId']) if (locator[key] !== undefined && !nonemptyString(locator[key])) addError(result, 'invalid-claim-locator-field', `${key} must be non-empty`, `${path}.${key}`);
  if (locator.url !== undefined && !isValidUrl(locator.url)) addError(result, 'invalid-claim-url', 'Locator URL must be http(s)', `${path}.url`);
  if (exact && !hasExactLocator(locator)) addError(result, 'unreproducible-claim', 'A claim requires an exact page, section, entry, table, or nomenclature locator; a generic URL is insufficient', path);
}

function validateClaims(entry, entryPath, sourceCatalog, result) {
  if (!Array.isArray(entry.claims)) { addError(result, 'invalid-claims', 'claims must be an array', `${entryPath}.claims`); return new Map(); }
  const claims = new Map();
  entry.claims.forEach((claim, index) => {
    const path = `${entryPath}.claims[${index}]`;
    if (!isObject(claim)) { addError(result, 'invalid-claim', 'Claim must be an object', path); return; }
    if (!nonemptyString(claim.id)) addError(result, 'invalid-claim-id', 'Claim id is required', `${path}.id`);
    if (claims.has(claim.id)) addError(result, 'duplicate-claim-id', `Duplicate claim id: ${claim.id}`, `${path}.id`);
    if (!VALID_CLAIM_TYPES.has(claim.type)) addError(result, 'invalid-claim-type', 'Claim type is invalid', `${path}.type`);
    if (!nonemptyString(claim.target)) addError(result, 'invalid-claim-target', 'Claim target is required', `${path}.target`);
    if (!nonemptyString(claim.sourceId) || !sourceCatalog[claim.sourceId]) addError(result, 'unresolved-claim-source', 'Claim sourceId must resolve in the source catalog', `${path}.sourceId`);
    if (!nonemptyString(claim.sourceRevision)) addError(result, 'invalid-claim-source-revision', 'Claim sourceRevision is required', `${path}.sourceRevision`);
    if (sourceCatalog[claim.sourceId] && claim.sourceRevision !== sourceCatalog[claim.sourceId].revision) addError(result, 'claim-source-revision-mismatch', 'Claim sourceRevision must match the source catalog revision', `${path}.sourceRevision`);
    const requiredCapability = claimCapability(claim.type);
    if (requiredCapability && sourceCatalog[claim.sourceId] && !sourceSupportsCapability(sourceCatalog[claim.sourceId], requiredCapability)) addError(result, 'claim-capability-mismatch', `Claim type ${claim.type} requires source capability ${requiredCapability}`, `${path}.sourceId`);
    if ((claim.evidenceDisposition === 'SUPPORTED' || claim.reviewState === 'VERIFIED') && sourceCatalog[claim.sourceId] && !sourceEvidenceUsable(sourceCatalog[claim.sourceId], claim)) addError(result, 'source-evidence-unusable', 'Supported or verified claims require inspected non-metadata source access and a matching locator capability', `${path}.sourceId`);
    if (claim.type.startsWith('vietnamese-') && sourceCatalog[claim.sourceId] && (sourceCatalog[claim.sourceId].class !== 'vietnamese-authoritative' || sourceCatalog[claim.sourceId].authorityTier !== 'authoritative')) addError(result, 'vietnamese-claim-source-authority', 'Vietnamese term claims require an authoritative Vietnamese source', `${path}.sourceId`);
    if ((claim.type === 'canonical-latin' || claim.type === 'latin-alias') && sourceCatalog[claim.sourceId] && sourceCatalog[claim.sourceId].class !== 'international-nomenclature') addError(result, 'latin-claim-source-authority', 'Latin claims require an international nomenclature source', `${path}.sourceId`);
    validateLocator(claim.locator, `${path}.locator`, result, {exact: claim.evidenceDisposition === 'SUPPORTED' || claim.reviewState === 'VERIFIED'});
    if (!VALID_EVIDENCE_DISPOSITIONS.has(claim.evidenceDisposition)) addError(result, 'invalid-evidence-disposition', 'Claim evidenceDisposition is invalid', `${path}.evidenceDisposition`);
    if (!VALID_CLAIM_REVIEW_STATES.has(claim.reviewState)) addError(result, 'invalid-claim-review-state', 'Claim reviewState is invalid', `${path}.reviewState`);
    if (claim.reviewState === 'VERIFIED' && claim.evidenceDisposition !== 'SUPPORTED') addError(result, 'verified-claim-without-support', 'VERIFIED claims require SUPPORTED evidence', path);
    if (sourceCatalog[claim.sourceId]?.class === 'machine-generated' && claim.reviewState === 'VERIFIED') addError(result, 'machine-claim-authority', 'Machine candidate evidence cannot be a VERIFIED claim', path);
    if (nonemptyString(claim.id)) claims.set(claim.id, claim);
  });
  return claims;
}

function validateAtlasMembership(entry, entryPath, concept, atlas, result) {
  if (entry.atlas === undefined) return;
  if (!isObject(entry.atlas)) { addError(result, 'invalid-atlas-membership', 'atlas membership must be an object', `${entryPath}.atlas`); return; }
  const ids = validateStringArray(entry.atlas.meshIds, `${entryPath}.atlas.meshIds`, result, {allowEmpty: false});
  if (!['packaged-mesh', 'external'].includes(entry.atlas.scope)) addError(result, 'invalid-atlas-membership-scope', 'atlas scope is invalid', `${entryPath}.atlas.scope`);
  const partMap = new Map((Array.isArray(atlas?.parts) ? atlas.parts : []).filter(isObject).map(part => [part.id, part]));
  if (entry.atlas.scope === 'packaged-mesh') ids.forEach(meshId => {
    const part = partMap.get(meshId);
    if (!part) addError(result, 'unknown-packaged-mesh-id', `Unknown packaged mesh id: ${meshId}`, `${entryPath}.atlas.meshIds`);
    else if (!Array.isArray(concept?.elements) || !concept.elements.includes(meshId)) addError(result, 'mesh-membership-mismatch', `Mesh ${meshId} is not a member of this specific Atlas Concept`, `${entryPath}.atlas.meshIds`);
  });
}

function validateMappings(entry, entryPath, claims, result) {
  if (!isObject(entry.mapping)) { addError(result, 'invalid-mapping', 'mapping is required', `${entryPath}.mapping`); return; }
  if (!VALID_MAPPING_STATUSES.has(entry.mapping.status)) addError(result, 'invalid-mapping-status', 'mapping.status is invalid', `${entryPath}.mapping.status`);
  if (entry.mapping.disposition !== undefined && !VALID_MAPPING_DISPOSITIONS.has(entry.mapping.disposition)) addError(result, 'invalid-mapping-disposition', 'mapping.disposition is invalid', `${entryPath}.mapping.disposition`);
  if (!Array.isArray(entry.mapping.mappings)) addError(result, 'invalid-external-mappings', 'mapping.mappings must be an array', `${entryPath}.mapping.mappings`);
  const mappingIds = new Set();
  (Array.isArray(entry.mapping.mappings) ? entry.mapping.mappings : []).forEach((mapping, index) => {
    const path = `${entryPath}.mapping.mappings[${index}]`;
    if (!isObject(mapping)) { addError(result, 'invalid-external-mapping', 'External mapping must be an object', path); return; }
    for (const key of ['id', 'namespace', 'identifier', 'sourceRevision']) if (!nonemptyString(mapping[key])) addError(result, 'invalid-external-mapping-field', `${key} is required`, `${path}.${key}`);
    if (mappingIds.has(mapping.id)) addError(result, 'duplicate-external-mapping-id', `Duplicate mapping id: ${mapping.id}`, `${path}.id`);
    mappingIds.add(mapping.id);
    if (!VALID_MAPPING_RELATIONS.has(mapping.relation)) addError(result, 'invalid-mapping-relation', 'External mapping relation is invalid', `${path}.relation`);
    if (!VALID_MAPPING_DISPOSITION.has(mapping.disposition)) addError(result, 'invalid-external-mapping-disposition', 'External mapping disposition is invalid', `${path}.disposition`);
    if (!Array.isArray(mapping.evidenceClaimIds)) addError(result, 'invalid-mapping-evidence', 'evidenceClaimIds must be an array', `${path}.evidenceClaimIds`);
    (Array.isArray(mapping.evidenceClaimIds) ? mapping.evidenceClaimIds : []).forEach(claimId => {
      const claim = claims.get(claimId);
      if (!claim) addError(result, 'missing-mapping-claim', `Mapping evidence claim does not exist: ${claimId}`, `${path}.evidenceClaimIds`);
      else if (claim.target !== mapping.identifier || claim.sourceRevision !== mapping.sourceRevision) addError(result, 'mapping-claim-target-mismatch', 'Mapping evidence must target the exact identifier and revision', `${path}.evidenceClaimIds`);
      else if (['FMA', 'TA2'].includes(mapping.namespace.toUpperCase()) && claim.locator?.nomenclatureId !== mapping.identifier) addError(result, 'mapping-nomenclature-locator-mismatch', 'FMA/TA2 mapping evidence requires a matching nomenclatureId locator', `${path}.evidenceClaimIds`);
      else if (mapping.namespace.toUpperCase() === 'FMA' && claim.type !== 'atlas-fma-mapping') addError(result, 'mapping-claim-type-mismatch', 'FMA mapping requires atlas-fma-mapping evidence', `${path}.evidenceClaimIds`);
      else if (mapping.namespace.toUpperCase() === 'TA2' && claim.type !== 'atlas-ta2-mapping') addError(result, 'mapping-claim-type-mismatch', 'TA2 mapping requires atlas-ta2-mapping evidence', `${path}.evidenceClaimIds`);
    });
    if (mapping.disposition === 'VERIFIED' && (!Array.isArray(mapping.evidenceClaimIds) || mapping.evidenceClaimIds.length === 0)) addError(result, 'verified-mapping-without-evidence', 'A VERIFIED external mapping requires claim evidence', path);
  });
  const mappings = Array.isArray(entry.mapping.mappings) ? entry.mapping.mappings : [];
  if (entry.mapping.status === 'MAPPED' && mappings.length === 0) addError(result, 'mapped-without-external-mapping', 'MAPPED requires one or more external mappings', `${entryPath}.mapping`);
  if (entry.mapping.status !== 'MAPPED' && mappings.some(mapping => mapping.disposition === 'VERIFIED')) addError(result, 'verified-mapping-with-unmapped-status', 'A non-MAPPED entry cannot contain a VERIFIED external mapping', `${entryPath}.mapping`);
  if (entry.mapping.status === 'UNMAPPED' && !VALID_MAPPING_DISPOSITIONS.has(entry.mapping.disposition)) addError(result, 'unmapped-without-disposition', 'UNMAPPED entries must state not investigated, unresolved, or confirmed no equivalent', `${entryPath}.mapping.disposition`);
}

function validateTermFields(entry, entryPath, concept, result) {
  if (!isObject(entry.english) || !nonemptyString(entry.english.preferred)) addError(result, 'invalid-english-field', 'english.preferred is required', `${entryPath}.english`);
  else if (concept && entry.english.preferred !== concept.name) addWarning(result, 'english-snapshot-mismatch', 'English snapshot differs from the current atlas name', `${entryPath}.english.preferred`);
  validateStringArray(entry.english?.aliases, `${entryPath}.english.aliases`, result);
  for (const [group, field] of [['latin', 'aliases'], ['vietnamese', 'aliases'], ['vietnamese', 'searchAliases'], ['vietnamese', 'asciiSearchForms']]) {
    if (entry[group] !== undefined) validateStringArray(entry[group]?.[field], `${entryPath}.${group}.${field}`, result);
  }
  if (entry.vietnamese?.asciiSearchForms) entry.vietnamese.asciiSearchForms.forEach((term, index) => {
    if (normalizeSearchText(term) !== term.trim().toLowerCase()) addError(result, 'invalid-ascii-search-form', 'ASCII search forms must be matching-only no-diacritic forms', `${entryPath}.vietnamese.asciiSearchForms[${index}]`);
  });
  if (entry.scope !== undefined && (!isObject(entry.scope) || (entry.scope.qualifiers !== undefined && !Array.isArray(entry.scope.qualifiers)))) addError(result, 'invalid-scope', 'scope.qualifiers must be an array when present', `${entryPath}.scope`);
  const claimTypes = [
    ['english', 'aliases', 'english-alias'],
    ['latin', 'aliases', 'latin-alias'],
    ['vietnamese', 'aliases', 'vietnamese-alias'],
    ['vietnamese', 'searchAliases', 'vietnamese-search-alias'],
    ['vietnamese', 'asciiSearchForms', 'vietnamese-search-alias'],
  ];
  for (const [group, field, claimType] of claimTypes) {
    for (const term of entry[group]?.[field] ?? []) if (!(entry.claims ?? []).some(claim => claim.type === claimType && claim.target === term)) addWarning(result, 'unapproved-search-form', `${group}.${field} has no matching approved claim and cannot enter production search`, `${entryPath}.${group}.${field}`);
  }
}

function validateCandidateOrigins(entry, entryPath, sourceCatalog, result) {
  if (entry.candidateOrigins === undefined) return;
  if (!Array.isArray(entry.candidateOrigins)) { addError(result, 'invalid-candidate-origins', 'candidateOrigins must be an array', `${entryPath}.candidateOrigins`); return; }
  const ids = new Set();
  entry.candidateOrigins.forEach((origin, index) => {
    const path = `${entryPath}.candidateOrigins[${index}]`;
    if (!isObject(origin) || !nonemptyString(origin.id) || ids.has(origin.id)) addError(result, 'invalid-candidate-origin', 'Candidate origin id must be unique and non-empty', `${path}.id`);
    ids.add(origin.id);
    if (!['human', 'machine'].includes(origin.method)) addError(result, 'invalid-candidate-origin-method', 'Candidate origin method must be human or machine', `${path}.method`);
    if (!isValidDate(origin.createdAt)) addError(result, 'invalid-candidate-origin-date', 'Candidate origin createdAt must be a valid date', `${path}.createdAt`);
    if (origin.sourceId !== undefined && !sourceCatalog[origin.sourceId]) addError(result, 'unresolved-candidate-origin-source', 'Candidate origin sourceId must resolve in the source catalog', `${path}.sourceId`);
  });
}

function validateAudit(audit, expectedType, entryPath, entry, claims, reviewers, result) {
  if (audit === undefined) return;
  const path = `${entryPath}.review.${expectedType}`;
  if (!isObject(audit)) { addError(result, 'invalid-review-audit', 'Review audit must be an object', path); return; }
  if (audit.type !== expectedType || !VALID_REVIEW_AUDIT_TYPES.has(audit.type)) addError(result, 'invalid-review-audit-type', `Audit type must be ${expectedType}`, `${path}.type`);
  if (!VALID_REVIEW_AUDIT_STATUSES.has(audit.status)) addError(result, 'invalid-review-audit-status', 'Review audit status is invalid', `${path}.status`);
  if (audit.reviewedAt !== undefined && !isValidDate(audit.reviewedAt)) addError(result, 'invalid-review-audit-date', 'reviewedAt must be a valid date', `${path}.reviewedAt`);
  if (audit.entryRevision !== undefined && !nonemptyString(audit.entryRevision)) addError(result, 'invalid-review-entry-revision', 'entryRevision must be non-empty', `${path}.entryRevision`);
  if (audit.claimIds !== undefined) validateStringArray(audit.claimIds, `${path}.claimIds`, result);
  for (const claimId of audit.claimIds ?? []) if (!claims.has(claimId)) addError(result, 'review-unknown-claim', `Review references unknown claim: ${claimId}`, `${path}.claimIds`);
  if (audit.automated !== undefined && typeof audit.automated !== 'boolean') addError(result, 'invalid-review-automation', 'automated must be boolean', `${path}.automated`);
  if (audit.status === 'PASSED') {
    if (!isValidDate(audit.reviewedAt) || audit.decision !== 'APPROVE') addError(result, 'passed-audit-incomplete', 'PASSED audits require reviewedAt and decision APPROVE', path);
    if (!Array.isArray(audit.claimIds) || audit.claimIds.length === 0) addError(result, 'passed-audit-missing-claims', 'PASSED audits require a non-empty reviewed claim scope', `${path}.claimIds`);
    if (audit.entryRevision !== computeTerminologyRevision(entry)) addError(result, 'stale-approval', 'Approval does not match the current entry revision', `${path}.entryRevision`);
    if (expectedType !== 'release-eligibility') {
      if (!nonemptyString(audit.reviewerId)) addError(result, 'missing-reviewer-id', 'Source and medical audits require reviewerId', `${path}.reviewerId`);
      else if (!reviewers[audit.reviewerId]) addError(result, 'unregistered-reviewer', 'Reviewer is not registered', `${path}.reviewerId`);
      else if (reviewers[audit.reviewerId].status !== 'ACTIVE') addError(result, 'inactive-reviewer', 'Reviewer is not active', `${path}.reviewerId`);
      else if (!reviewers[audit.reviewerId].authorizationScope.includes('*') && !(audit.claimIds ?? []).every(claimId => reviewers[audit.reviewerId].authorizationScope.includes(claimId))) addError(result, 'unauthorized-reviewer', 'Reviewer authorization scope does not cover the reviewed claims', `${path}.reviewerId`);
    }
    if (expectedType === 'medical-review' && (audit.automated === true || !nonemptyString(audit.reviewerId))) addError(result, 'medical-review-requires-human', 'Medical review requires a registered named human reviewer', path);
  }
}

function validateReview(entry, entryPath, claims, reviewers, result) {
  if (!isObject(entry.review)) { addError(result, 'invalid-review', 'review is required', `${entryPath}.review`); return; }
  if (!VALID_REVIEW_STATUSES.has(entry.review.status)) addError(result, 'invalid-review-status', 'review.status is invalid', `${entryPath}.review.status`);
  validateAudit(entry.review.sourceVerification, 'source-verification', entryPath, entry, claims, reviewers, result);
  validateAudit(entry.review.medicalReview, 'medical-review', entryPath, entry, claims, reviewers, result);
  validateAudit(entry.review.releaseEligibility, 'release-eligibility', entryPath, entry, claims, reviewers, result);
  if (entry.review.status === 'VERIFIED' || entry.review.status === 'RELEASE_ELIGIBLE') {
    if (!entry.review.sourceVerification || !entry.review.medicalReview) addError(result, 'missing-review-audit', 'Release-like stored states require source and medical audits', `${entryPath}.review`);
  }
}

function validateConflicts(entry, entryPath, claims, reviewers, result) {
  if (entry.conflicts === undefined) return;
  if (!Array.isArray(entry.conflicts)) { addError(result, 'invalid-conflicts', 'conflicts must be an array', `${entryPath}.conflicts`); return; }
  const ids = new Set();
  entry.conflicts.forEach((conflict, index) => {
    const path = `${entryPath}.conflicts[${index}]`;
    if (!isObject(conflict)) { addError(result, 'invalid-conflict', 'Conflict must be an object', path); return; }
    if (!nonemptyString(conflict.id) || ids.has(conflict.id)) addError(result, 'invalid-conflict-id', 'Conflict id must be unique and non-empty', `${path}.id`);
    ids.add(conflict.id);
    if (!VALID_CONFLICT_TYPES.has(conflict.type)) addError(result, 'invalid-conflict-type', 'Conflict type is invalid', `${path}.type`);
    if (!VALID_CONFLICT_STATUSES.has(conflict.status)) addError(result, 'invalid-conflict-status', 'Conflict status is invalid', `${path}.status`);
    validateStringArray(conflict.claimIds, `${path}.claimIds`, result, {allowEmpty: false});
    for (const claimId of conflict.claimIds ?? []) if (!claims.has(claimId)) addError(result, 'conflict-unknown-claim', `Conflict references unknown claim: ${claimId}`, `${path}.claimIds`);
    if (conflict.status === 'OPEN') addWarning(result, 'conflict-awaiting-adjudication', 'Open authoritative-source conflict blocks release', path);
    if (conflict.status === 'ADJUDICATED') {
      if (!nonemptyString(conflict.decision) || !nonemptyString(conflict.rationale) || !nonemptyString(conflict.reviewerId) || !isValidDate(conflict.resolvedAt) || conflict.entryRevision !== computeTerminologyRevision(entry)) addError(result, 'invalid-conflict-adjudication', 'Adjudicated conflicts require current revision, rationale, decision, reviewer, and date', path);
      if (!reviewers[conflict.reviewerId] || reviewers[conflict.reviewerId].status !== 'ACTIVE') addError(result, 'unregistered-conflict-reviewer', 'Conflict adjudicator must be an active registered reviewer', `${path}.reviewerId`);
    }
    if (conflict.ambiguityAllowed !== undefined && typeof conflict.ambiguityAllowed !== 'boolean') addError(result, 'invalid-conflict-ambiguity', 'ambiguityAllowed must be boolean', `${path}.ambiguityAllowed`);
  });
}

function validateEntries(records, atlas, sourceCatalog, reviewers, result) {
  const concepts = new Map((Array.isArray(atlas?.concepts) ? atlas.concepts : []).filter(isObject).map(concept => [concept.id, concept]));
  const entries = [];
  const seenKeys = new Set();
  records.forEach((entry, index) => {
    const path = `entries[${index}]`;
    if (!isObject(entry)) { addError(result, 'invalid-entry', 'Entry must be an object', path); return; }
    if (!nonemptyString(entry.key) || entry.key !== entry.conceptId) addError(result, 'entry-key-mismatch', 'Registry key must equal conceptId', `${path}.key`);
    if (seenKeys.has(entry.key)) addError(result, 'duplicate-entry-key', `Duplicate entry key: ${entry.key}`, `${path}.key`);
    seenKeys.add(entry.key);
    const concept = concepts.get(entry.conceptId);
    if (!concept) addError(result, 'orphan-concept-id', `Unknown atlas concept: ${entry.conceptId}`, `${path}.conceptId`);
    validateTermFields(entry, path, concept, result);
    validateCandidateOrigins(entry, path, sourceCatalog, result);
    const claims = validateClaims(entry, path, sourceCatalog, result);
    validateAtlasMembership(entry, path, concept, atlas, result);
    validateMappings(entry, path, claims, result);
    validateReview(entry, path, claims, reviewers, result);
    validateConflicts(entry, path, claims, reviewers, result);
    for (const claim of entry.claims ?? []) if (claim.type === 'vietnamese-preferred' && entry.vietnamese?.preferred && claim.target !== entry.vietnamese.preferred) addWarning(result, 'preferred-claim-target-mismatch', 'Vietnamese preferred claim does not target the preferred field', `${path}.claims`);
    if (entry.vietnamese && !hasVerifiedVietnamese(entry, sourceCatalog, reviewers)) addWarning(result, 'unreleased-search-term', 'Vietnamese candidate is not release-eligible and cannot enter production search', `${path}.vietnamese`);
    if (entry.latin && !hasVerifiedLatin(entry, sourceCatalog)) addWarning(result, 'unreleased-latin', 'Latin candidate is not source-verified and cannot enter production search', `${path}.latin`);
    entries.push(entry);
  });
  return {entries, concepts};
}

function conflictAllowsAmbiguity(entry, term) {
  return (entry.conflicts ?? []).some(conflict => conflict.status === 'ADJUDICATED' && conflict.ambiguityAllowed === true && conflict.entryRevision === computeTerminologyRevision(entry) && (conflict.permittedAliasClaimIds?.length ?? 0) > 0 && (entry.claims ?? []).some(claim => conflict.permittedAliasClaimIds.includes(claim.id) && claim.target === term));
}

function validateSearchCollisions(entries, concepts, sourceCatalog, reviewers, result) {
  const candidateTerms = new Map();
  const releasedTerms = new Map();
  for (const entry of entries) {
    const concept = concepts.get(entry.conceptId);
    if (!concept) continue;
    const baseline = new Set([concept.name, concept.id].map(normalizeSearchText));
    const terms = terminologySearchTerms(concept, entry, sourceCatalog, reviewers);
    for (const term of terms) {
      const normalized = normalizeSearchText(term);
      if (!normalized || baseline.has(normalized)) continue;
      if (!candidateTerms.has(normalized)) candidateTerms.set(normalized, []);
      candidateTerms.get(normalized).push({entry, term});
      if (hasVerifiedVietnamese(entry, sourceCatalog, reviewers) || hasVerifiedLatin(entry, sourceCatalog)) {
        if (!releasedTerms.has(normalized)) releasedTerms.set(normalized, []);
        releasedTerms.get(normalized).push({entry, term});
      }
    }
  }
  for (const [normalized, occurrences] of candidateTerms) {
    const ids = new Set(occurrences.map(item => item.entry.conceptId));
    if (ids.size > 1) addWarning(result, 'normalized-alias-collision', `Terminology forms collide after normalization: ${normalized}`, undefined, {conceptIds: [...ids]});
  }
  for (const [normalized, occurrences] of releasedTerms) {
    const ids = new Set(occurrences.map(item => item.entry.conceptId));
    if (ids.size > 1 && !occurrences.every(item => conflictAllowsAmbiguity(item.entry, item.term))) addError(result, 'release-normalized-alias-collision', `Released terminology forms collide after normalization: ${normalized}`, undefined, {conceptIds: [...ids]});
  }
}

function auditPassed(audit, type, entry, reviewers, requireHuman) {
  if (!audit || audit.type !== type || audit.status !== 'PASSED' || audit.decision !== 'APPROVE' || !isValidDate(audit.reviewedAt) || audit.entryRevision !== computeTerminologyRevision(entry)) return false;
  if (!requireHuman) return true;
  const reviewer = reviewers[audit.reviewerId];
  return Boolean(reviewer && reviewer.status === 'ACTIVE' && audit.automated !== true && (reviewer.authorizationScope.includes('*') || (audit.claimIds ?? []).every(id => reviewer.authorizationScope.includes(id))));
}

export function computeCoverage(atlas, entries, sourceCatalog, reviewers = {}) {
  const concepts = Array.isArray(atlas?.concepts) ? atlas.concepts.filter(isObject) : [];
  const conceptIds = new Set(concepts.map(concept => concept.id));
  const candidateEntries = entries.filter(entry => Boolean(entry.vietnamese || entry.latin || entry.claims?.length || entry.mapping?.mappings?.length));
  const sourceVerifiedEntries = entries.filter(entry => auditPassed(entry.review?.sourceVerification, 'source-verification', entry, reviewers, true));
  const medicallyReviewedEntries = entries.filter(entry => auditPassed(entry.review?.medicalReview, 'medical-review', entry, reviewers, true));
  const releaseEntries = entries.filter(entry => hasVerifiedVietnamese(entry, sourceCatalog, reviewers));
  const searchableEntries = entries.filter(entry => {
    const concept = concepts.find(item => item.id === entry.conceptId);
    if (!concept) return false;
    return terminologySearchTerms(concept, entry, sourceCatalog, reviewers).some(term => ![concept.name, concept.id].includes(term));
  });
  const mappedIds = new Set(entries.filter(entry => entry.mapping?.status === 'MAPPED' && conceptIds.has(entry.conceptId)).map(entry => entry.conceptId));
  const mappingInvestigated = entries.filter(entry => entry.mapping?.status !== 'UNMAPPED' || entry.mapping?.disposition !== 'NOT_INVESTIGATED');
  const mappingUnresolved = entries.filter(entry => entry.mapping?.disposition === 'UNRESOLVED');
  const noEquivalent = entries.filter(entry => entry.mapping?.disposition === 'CONFIRMED_NO_EQUIVALENT');
  const sourceGaps = entries.filter(entry => (entry.claims ?? []).some(claim => !sourceCatalog[claim.sourceId] || sourceCatalog[claim.sourceId].audit?.status !== 'VERIFIED'));
  const staleApprovals = entries.filter(entry => [entry.review?.sourceVerification, entry.review?.medicalReview, entry.review?.releaseEligibility].some(audit => audit?.status === 'PASSED' && audit.entryRevision !== computeTerminologyRevision(entry)));
  const conflicts = entries.filter(entry => (entry.conflicts ?? []).some(conflict => conflict.status === 'OPEN'));
  const total = concepts.length;
  const percentage = count => total === 0 ? 0 : Number(((count / total) * 100).toFixed(2));
  return {
    totalAtlasConcepts: total,
    terminologyEntries: entries.length,
    vietnameseCandidateEntries: candidateEntries.length,
    searchableTerminologyEntries: searchableEntries.length,
    sourceVerifiedEntries: sourceVerifiedEntries.length,
    medicallyReviewedEntries: medicallyReviewedEntries.length,
    releaseEligibleEntries: releaseEntries.length,
    unresolvedOrUnmappedConcepts: Math.max(total - mappedIds.size, 0),
    mappingInvestigatedEntries: mappingInvestigated.length,
    mappingUnresolvedEntries: mappingUnresolved.length,
    confirmedNoExternalEquivalentEntries: noEquivalent.length,
    sourceGapEntries: sourceGaps.length,
    staleApprovalEntries: staleApprovals.length,
    conflictsAwaitingAdjudication: conflicts.length,
    percentages: {
      vietnameseCandidate: percentage(candidateEntries.length), searchable: percentage(searchableEntries.length), sourceVerified: percentage(sourceVerifiedEntries.length), medicallyReviewed: percentage(medicallyReviewedEntries.length), releaseEligible: percentage(releaseEntries.length), resolvedMapped: percentage(mappedIds.size),
    },
  };
}

function validateReleaseManifest(manifest, atlas, entries, sourcesDocument, entriesDocument, reviewersDocument, result) {
  if (!isObject(manifest) || manifest.schemaVersion !== 1) { addError(result, 'invalid-release-manifest', 'release manifest must declare schemaVersion 1', 'release'); return; }
  if (!['UNRELEASED', 'RELEASED'].includes(manifest.releaseStatus)) addError(result, 'invalid-release-status', 'releaseStatus is invalid', 'release.releaseStatus');
  for (const key of ['atlasVersion', 'atlasRevision', 'registryRevision', 'sourceCatalogRevision', 'reviewersRevision', 'policyVersion']) if (!nonemptyString(manifest[key])) addError(result, 'invalid-release-identity', `${key} is required`, `release.${key}`);
  if (manifest.releaseStatus === 'RELEASED') {
    if (!nonemptyString(manifest.contentHash)) addError(result, 'released-missing-content-hash', 'Released manifests require contentHash', 'release.contentHash');
    if (!isObject(manifest.entryRevisions)) addError(result, 'released-missing-entry-revisions', 'Released manifests require entryRevisions', 'release.entryRevisions');
    else entries.forEach(entry => { const released = hasVerifiedVietnamese(entry, result.sourceCatalog, result.reviewerCatalog) || hasVerifiedLatin(entry, result.sourceCatalog, result.reviewerCatalog); if (released && manifest.entryRevisions[entry.conceptId] !== computeTerminologyRevision(entry)) addError(result, 'release-entry-revision-mismatch', 'Released entry revision is not bound in the manifest', `release.entryRevisions.${entry.conceptId}`); });
    if (manifest.atlasVersion !== atlas?.version) addError(result, 'release-atlas-version-mismatch', 'Release atlasVersion does not match the current atlas', 'release.atlasVersion');
    const atlasRevision = documentRevision({version: atlas?.version, concepts: atlas?.concepts, parts: Array.isArray(atlas?.parts) ? atlas.parts.map(part => ({id: part.id, conceptId: part.conceptId, name: part.name})) : []});
    const registryRevision = documentRevision(entriesDocument);
    const sourceCatalogRevision = documentRevision(sourcesDocument);
    const reviewersRevision = documentRevision(reviewersDocument);
    if (manifest.atlasRevision !== atlasRevision) addError(result, 'release-atlas-revision-mismatch', 'Release atlasRevision does not match the current atlas identity snapshot', 'release.atlasRevision');
    if (manifest.registryRevision !== registryRevision) addError(result, 'release-registry-revision-mismatch', 'Release registryRevision does not match entries.json', 'release.registryRevision');
    if (manifest.sourceCatalogRevision !== sourceCatalogRevision) addError(result, 'release-source-revision-mismatch', 'Release sourceCatalogRevision does not match sources.json', 'release.sourceCatalogRevision');
    if (manifest.reviewersRevision !== reviewersRevision) addError(result, 'release-reviewer-revision-mismatch', 'Release reviewersRevision does not match reviewers.json', 'release.reviewersRevision');
    const expectedContentHash = documentRevision({atlasRevision, registryRevision, sourceCatalogRevision, reviewersRevision, policyVersion: manifest.policyVersion, entryRevisions: manifest.entryRevisions});
    if (manifest.contentHash !== expectedContentHash) addError(result, 'release-content-hash-mismatch', 'Release contentHash does not match the bound release identity', 'release.contentHash');
  }
}

export function validateTerminologyData({atlas, sourcesDocument, entriesDocument, reviewersDocument = {schemaVersion: 1, reviewers: []}, releaseDocument = {schemaVersion: 1, releaseStatus: 'UNRELEASED', atlasVersion: atlas?.version ?? '', atlasRevision: 'UNRELEASED', registryRevision: 'UNRELEASED', sourceCatalogRevision: 'UNRELEASED', reviewersRevision: 'UNRELEASED', policyVersion: 'M02B', entryRevisions: {}}}) {
  const result = {errors: [], warnings: [], sourceCatalog: {}, reviewerCatalog: {}, entries: [], coverage: null, release: releaseDocument};
  validateSchemaVersion(sourcesDocument, 'sources', SOURCE_SCHEMA_VERSION, result);
  validateSchemaVersion(entriesDocument, 'entries', SCHEMA_VERSION, result);
  validateSchemaVersion(reviewersDocument, 'reviewers', 1, result);
  const sourceRecords = getArray(sourcesDocument, 'sources', result);
  const entryRecords = getArray(entriesDocument, 'entries', result);
  const reviewerRecords = getArray(reviewersDocument, 'reviewers', result);
  result.sourceCatalog = validateSources(sourceRecords, result);
  result.reviewerCatalog = validateReviewers(reviewerRecords, result);
  const validated = validateEntries(entryRecords, atlas, result.sourceCatalog, result.reviewerCatalog, result);
  result.entries = validated.entries;
  result.coverage = computeCoverage(atlas, result.entries, result.sourceCatalog, result.reviewerCatalog);
  validateSearchCollisions(result.entries, validated.concepts, result.sourceCatalog, result.reviewerCatalog, result);
  validateReleaseManifest(releaseDocument, atlas, result.entries, sourcesDocument, entriesDocument, reviewersDocument, {...result, sourceCatalog: result.sourceCatalog, reviewerCatalog: result.reviewerCatalog});
  return result;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [atlas, sourcesDocument, entriesDocument, reviewersDocument, releaseDocument] = await Promise.all([
    readJson(join(REPOSITORY_ROOT, 'public', 'models', 'atlas.json')),
    readJson(join(REPOSITORY_ROOT, 'data', 'terminology', 'sources.json')),
    readJson(join(REPOSITORY_ROOT, 'data', 'terminology', 'entries.json')),
    readJson(join(REPOSITORY_ROOT, 'data', 'terminology', 'reviewers.json')),
    readJson(join(REPOSITORY_ROOT, 'data', 'terminology', 'release.json')),
  ]);
  const result = validateTerminologyData({atlas, sourcesDocument, entriesDocument, reviewersDocument, releaseDocument});
  const c = result.coverage;
  const status = result.errors.length ? 'FAIL' : 'PASS';
  if (process.argv.includes('--json')) console.log(JSON.stringify({status, errors: result.errors, warnings: result.warnings, coverage: result.coverage}, null, 2));
  else {
    console.log(`Terminology validation: ${status}`);
    console.log(`Sources: ${Object.keys(result.sourceCatalog).length}; reviewers: ${Object.keys(result.reviewerCatalog).length}; registry entries: ${c.terminologyEntries}`);
    console.log(`Candidates: ${c.vietnameseCandidateEntries}; searchable: ${c.searchableTerminologyEntries}; source-verified: ${c.sourceVerifiedEntries}; medically reviewed: ${c.medicallyReviewedEntries}; release eligible: ${c.releaseEligibleEntries}`);
    console.log(`Mapping investigated: ${c.mappingInvestigatedEntries}; unresolved: ${c.mappingUnresolvedEntries}; confirmed no equivalent: ${c.confirmedNoExternalEquivalentEntries}; source gaps: ${c.sourceGapEntries}; stale approvals: ${c.staleApprovalEntries}; conflicts awaiting adjudication: ${c.conflictsAwaitingAdjudication}`);
    if (result.warnings.length) console.log(`Warnings: ${result.warnings.length}`);
    if (result.errors.length) console.error(`Errors: ${result.errors.length}`);
  }
  if (result.errors.length) process.exitCode = 1;
}
