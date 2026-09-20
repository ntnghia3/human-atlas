import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  hasVerifiedVietnamese,
  sourceSupportsCapability,
} from '../app/terminology.ts';
import {normalizeSearchText} from '../app/search-normalization.ts';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const VALID_SOURCE_CLASSES = new Set([
  'international-nomenclature',
  'vietnamese-authoritative',
  'secondary-reference',
  'machine-generated',
]);
const VALID_SOURCE_STATUSES = new Set(['UNVERIFIED', 'VERIFIED']);
const VALID_MAPPING_STATUSES = new Set(['UNMAPPED', 'MAPPED', 'REJECTED']);
const VALID_REVIEW_STATUSES = new Set([
  'UNMAPPED',
  'DRAFT',
  'SOURCE_VERIFIED',
  'MEDICAL_REVIEWED',
  'VERIFIED',
  'REJECTED',
]);
const VALID_REVIEW_AUDIT_TYPES = new Set(['source-verification', 'medical-review', 'release-eligibility']);
const VALID_REVIEW_AUDIT_STATUSES = new Set(['PENDING', 'PASSED', 'REJECTED']);
const VALID_LOCATOR_KEYS = new Set([
  'page',
  'chapter',
  'section',
  'table',
  'entryId',
  'url',
  'nomenclatureId',
]);
const VALID_SOURCE_CAPABILITY_KEYS = new Set([
  'anatomicalIdentity',
  'canonicalLatin',
  'vietnamesePreferred',
  'secondaryCorroboration',
  'machineCandidateDiscovery',
]);
const PLACEHOLDER_PATTERN = /^(?:TODO|TBD|UNKNOWN|PLACEHOLDER|N\/A|NA)$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SEMANTIC_PAIRS = [
  ['left', 'right', 'trái', 'phải'],
  ['anterior', 'posterior', 'trước', 'sau'],
  ['superior', 'inferior', 'trên', 'dưới'],
  ['medial', 'lateral', 'trong', 'ngoài'],
  ['proximal', 'distal', 'gần', 'xa'],
  ['superficial', 'deep', 'nông', 'sâu'],
  ['artery', 'vein', 'động mạch', 'tĩnh mạch'],
  ['nerve', 'ligament', 'thần kinh', 'dây chằng'],
  ['branch', 'trunk', 'nhánh', 'thân'],
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonemptyString(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function isValidDate(value) {
  return nonemptyString(value) && DATE_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isValidUrl(value) {
  if (!nonemptyString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value.trim());
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  return false;
}

function addFinding(bucket, code, message, path, extra = {}) {
  bucket.push({code, message, ...(path ? {path} : {}), ...extra});
}

function addError(result, code, message, path, extra) {
  addFinding(result.errors, code, message, path, extra);
}

function addWarning(result, code, message, path, extra) {
  addFinding(result.warnings, code, message, path, extra);
}

function getArray(document, key, result) {
  if (!isObject(document) || !Array.isArray(document[key])) {
    addError(result, 'invalid-document-shape', `${key} must be an array`, key);
    return [];
  }
  return document[key];
}

function validateSchemaVersion(document, label, result) {
  if (!isObject(document) || document.schemaVersion !== 1) {
    addError(result, 'unsupported-schema-version', `${label} must declare schemaVersion 1`, `${label}.schemaVersion`);
  }
}

function validateStringArray(value, path, result, {allowEmpty = true} = {}) {
  if (value === undefined && allowEmpty) return [];
  if (!Array.isArray(value)) {
    addError(result, 'invalid-string-array', `${path} must be an array of strings`, path);
    return [];
  }
  const values = [];
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!nonemptyString(item)) {
      addError(result, 'invalid-string-array-item', `${path}[${index}] must be a non-empty string`, `${path}[${index}]`);
      continue;
    }
    const trimmed = item.trim();
    const normalized = normalizeSearchText(trimmed);
    if (seen.has(normalized)) {
      addError(result, 'duplicate-normalized-term', `${path} contains duplicate normalized terms`, `${path}[${index}]`);
    }
    seen.add(normalized);
    values.push(trimmed);
  }
  return values;
}

function validateSourceCapabilities(source, path, result) {
  if (!isObject(source.capabilities)) {
    addError(result, 'missing-source-capabilities', 'Source capabilities are required', `${path}.capabilities`);
    return {};
  }
  for (const key of VALID_SOURCE_CAPABILITY_KEYS) {
    if (typeof source.capabilities[key] !== 'boolean') {
      addError(result, 'invalid-source-capability', `${key} must be boolean`, `${path}.capabilities.${key}`);
    }
  }
  for (const key of Object.keys(source.capabilities)) {
    if (!VALID_SOURCE_CAPABILITY_KEYS.has(key)) {
      addError(result, 'unknown-source-capability', `${key} is not a supported source capability`, `${path}.capabilities.${key}`);
    }
  }
  return source.capabilities;
}

function validateSourceAudit(source, path, result) {
  if (!isObject(source.audit)) {
    addError(result, 'missing-source-audit', 'Source audit is required', `${path}.audit`);
    return;
  }
  if (!VALID_SOURCE_STATUSES.has(source.audit.status)) {
    addError(result, 'invalid-source-audit-status', 'Source audit status is invalid', `${path}.audit.status`);
  }
  for (const key of ['verifiedAt', 'verifiedBy', 'notes']) {
    if (source.audit[key] !== undefined && typeof source.audit[key] !== 'string') {
      addError(result, 'invalid-source-audit-field', `${key} must be a string`, `${path}.audit.${key}`);
    }
  }
  if (source.audit.status === 'VERIFIED') {
    if (!isValidDate(source.audit.verifiedAt)) {
      addError(result, 'verified-source-missing-date', 'VERIFIED sources require a valid verifiedAt date', `${path}.audit.verifiedAt`);
    }
    if (!nonemptyString(source.audit.verifiedBy)) {
      addError(result, 'verified-source-missing-reviewer', 'VERIFIED sources require verifiedBy', `${path}.audit.verifiedBy`);
    }
  }
}

function validateSourceClassPolicy(source, capabilities, path, result) {
  const identity = capabilities.anatomicalIdentity === true;
  const latin = capabilities.canonicalLatin === true;
  const vietnamese = capabilities.vietnamesePreferred === true;
  const secondary = capabilities.secondaryCorroboration === true;
  const machine = capabilities.machineCandidateDiscovery === true;
  const medicalCapabilities = identity || latin || vietnamese || secondary;

  if (source.class === 'machine-generated') {
    if (!machine || medicalCapabilities) {
      addError(
        result,
        'source-capability-conflict',
        'machine-generated sources may only advertise machine-candidate-discovery',
        path,
      );
    }
    return;
  }
  if (machine) {
    addError(result, 'source-capability-conflict', 'Non-machine sources cannot advertise machine discovery', path);
  }
  if (source.class === 'international-nomenclature' && (!identity && !latin || vietnamese)) {
    addError(
      result,
      'source-capability-conflict',
      'international-nomenclature sources require anatomical identity or canonical Latin and cannot provide Vietnamese preferred terms',
      path,
    );
  }
  if (source.class === 'vietnamese-authoritative' && !vietnamese) {
    addError(result, 'source-capability-conflict', 'vietnamese-authoritative sources require vietnamesePreferred', path);
  }
  if (source.class === 'secondary-reference' && (!secondary || identity || latin || vietnamese)) {
    addError(
      result,
      'source-capability-conflict',
      'secondary-reference sources require secondaryCorroboration and cannot be canonical authorities',
      path,
    );
  }
}

function validateSources(sourceRecords, result) {
  const sourceCatalog = {};
  const seenIds = new Set();
  sourceRecords.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isObject(source)) {
      addError(result, 'invalid-source-record', 'Source record must be an object', path);
      return;
    }
    if (!nonemptyString(source.id)) {
      addError(result, 'invalid-source-id', 'Source id must be a non-empty string', `${path}.id`);
    } else if (seenIds.has(source.id)) {
      addError(result, 'duplicate-source-id', `Duplicate source id: ${source.id}`, `${path}.id`);
    } else {
      seenIds.add(source.id);
    }
    if (!nonemptyString(source.title)) {
      addError(result, 'missing-source-title', 'Source title is required', `${path}.title`);
    }
    if (!VALID_SOURCE_CLASSES.has(source.class)) {
      addError(result, 'invalid-source-class', 'Source class is invalid', `${path}.class`);
    }
    const capabilities = validateSourceCapabilities(source, path, result);
    validateSourceAudit(source, path, result);
    validateSourceClassPolicy(source, capabilities, path, result);

    if (source.authors !== undefined) validateStringArray(source.authors, `${path}.authors`, result);
    for (const key of ['institution', 'edition', 'publisher', 'isbn', 'language', 'version', 'licenseNote']) {
      if (source[key] !== undefined && typeof source[key] !== 'string') {
        addError(result, 'invalid-source-field', `${key} must be a string`, `${path}.${key}`);
      }
    }
    if (source.publicationYear !== undefined &&
        (!Number.isInteger(source.publicationYear) || source.publicationYear < 1400 || source.publicationYear > 2200)) {
      addError(result, 'invalid-publication-year', 'publicationYear must be a plausible integer year', `${path}.publicationYear`);
    }
    for (const key of ['url']) {
      if (source[key] !== undefined && !isValidUrl(source[key])) {
        addError(result, 'invalid-source-url', `${key} must be an http(s) URL`, `${path}.${key}`);
      }
    }
    for (const key of ['accessedAt']) {
      if (source[key] !== undefined && !isValidDate(source[key])) {
        addError(result, 'invalid-source-date', `${key} must be a valid date`, `${path}.${key}`);
      }
    }
    for (const [key, value] of Object.entries(source)) {
      if (hasPlaceholder(value)) {
        addError(result, 'placeholder-source-metadata', `${key} contains placeholder metadata`, `${path}.${key}`);
      }
    }

    if (nonemptyString(source.id) && !sourceCatalog[source.id]) sourceCatalog[source.id] = source;
  });
  return sourceCatalog;
}

function validateLocator(locator, path, result) {
  if (locator === undefined) return false;
  if (!isObject(locator)) {
    addError(result, 'invalid-provenance-locator', 'Provenance locator must be an object', path);
    return false;
  }
  for (const key of Object.keys(locator)) {
    if (!VALID_LOCATOR_KEYS.has(key)) {
      addError(result, 'unknown-provenance-locator-field', `${key} is not a supported locator field`, `${path}.${key}`);
    }
  }
  if (locator.page !== undefined && (!Number.isInteger(locator.page) || locator.page <= 0)) {
    addError(result, 'invalid-provenance-page', 'Locator page must be a positive integer', `${path}.page`);
  }
  for (const key of ['chapter', 'section', 'table', 'entryId', 'nomenclatureId']) {
    if (locator[key] !== undefined && !nonemptyString(locator[key])) {
      addError(result, 'invalid-provenance-locator-field', `${key} must be a non-empty string`, `${path}.${key}`);
    }
  }
  if (locator.url !== undefined && !isValidUrl(locator.url)) {
    addError(result, 'invalid-provenance-url', 'Locator url must be an http(s) URL', `${path}.url`);
  }
  return Boolean(
    (Number.isInteger(locator.page) && locator.page > 0) ||
      ['chapter', 'section', 'table', 'entryId', 'url', 'nomenclatureId'].some(key => nonemptyString(locator[key])),
  );
}

function validateProvenance(entry, entryPath, sourceCatalog, result, requiresProvenance) {
  if (!Array.isArray(entry.provenance)) {
    addError(result, 'invalid-provenance', 'provenance must be an array', `${entryPath}.provenance`);
    return;
  }
  if (requiresProvenance && entry.provenance.length === 0) {
    addError(result, 'missing-provenance', 'Mapped or release-candidate entries require provenance', `${entryPath}.provenance`);
  }
  entry.provenance.forEach((reference, index) => {
    const path = `${entryPath}.provenance[${index}]`;
    if (!isObject(reference)) {
      addError(result, 'invalid-provenance-reference', 'Provenance reference must be an object', path);
      return;
    }
    if (!nonemptyString(reference.sourceId)) {
      addError(result, 'invalid-provenance-source-id', 'Provenance sourceId is required', `${path}.sourceId`);
    } else if (!sourceCatalog[reference.sourceId]) {
      addError(result, 'unresolved-provenance-source', `Unknown provenance source: ${reference.sourceId}`, `${path}.sourceId`);
    }
    const hasLocator = validateLocator(reference.locator, `${path}.locator`, result);
    if (requiresProvenance && !hasLocator) {
      addError(result, 'unreproducible-provenance', 'Release-candidate provenance requires a structured locator', `${path}.locator`);
    }
    if (reference.checkedAt !== undefined && !isValidDate(reference.checkedAt)) {
      addError(result, 'invalid-provenance-date', 'checkedAt must be a valid date', `${path}.checkedAt`);
    }
    if (reference.note !== undefined && typeof reference.note !== 'string') {
      addError(result, 'invalid-provenance-note', 'note must be a string', `${path}.note`);
    }
  });
}

function validateAudit(audit, expectedType, path, result) {
  if (audit === undefined) return;
  if (!isObject(audit)) {
    addError(result, 'invalid-review-audit', 'Review audit must be an object', path);
    return;
  }
  if (!VALID_REVIEW_AUDIT_TYPES.has(audit.type) || audit.type !== expectedType) {
    addError(result, 'invalid-review-audit-type', `Audit type must be ${expectedType}`, `${path}.type`);
  }
  if (!VALID_REVIEW_AUDIT_STATUSES.has(audit.status)) {
    addError(result, 'invalid-review-audit-status', 'Review audit status is invalid', `${path}.status`);
  }
  for (const key of ['reviewer', 'reviewedAt', 'notes']) {
    if (audit[key] !== undefined && typeof audit[key] !== 'string') {
      addError(result, 'invalid-review-audit-field', `${key} must be a string`, `${path}.${key}`);
    }
  }
  if (audit.automated !== undefined && typeof audit.automated !== 'boolean') {
    addError(result, 'invalid-review-audit-field', 'automated must be boolean', `${path}.automated`);
  }
  if (audit.status === 'PASSED') {
    if (!isValidDate(audit.reviewedAt)) {
      addError(result, 'passed-audit-missing-date', 'PASSED audits require reviewedAt', `${path}.reviewedAt`);
    }
    if (expectedType === 'medical-review' && (!nonemptyString(audit.reviewer) || audit.automated === true)) {
      addError(result, 'medical-review-requires-human', 'PASSED medical review requires a named non-automated reviewer', path);
    }
    if (expectedType !== 'release-eligibility' && !nonemptyString(audit.reviewer)) {
      addError(result, 'passed-audit-missing-reviewer', 'PASSED source and medical audits require a reviewer', `${path}.reviewer`);
    }
    if (expectedType === 'release-eligibility' && audit.automated !== true && !nonemptyString(audit.reviewer)) {
      addError(result, 'passed-audit-missing-reviewer', 'Non-automated release audits require a reviewer', `${path}.reviewer`);
    }
  }
}

function validateReview(entry, entryPath, result) {
  if (!isObject(entry.review)) {
    addError(result, 'invalid-review', 'review must be an object', `${entryPath}.review`);
    return;
  }
  if (!VALID_REVIEW_STATUSES.has(entry.review.status)) {
    addError(result, 'invalid-review-status', 'review.status is invalid', `${entryPath}.review.status`);
  }
  validateAudit(entry.review.sourceVerification, 'source-verification', `${entryPath}.review.sourceVerification`, result);
  validateAudit(entry.review.medicalReview, 'medical-review', `${entryPath}.review.medicalReview`, result);
  validateAudit(entry.review.releaseEligibility, 'release-eligibility', `${entryPath}.review.releaseEligibility`, result);
  if (entry.review.status === 'VERIFIED') {
    for (const key of ['sourceVerification', 'medicalReview', 'releaseEligibility']) {
      if (!isObject(entry.review[key])) {
        addError(result, 'missing-review-audit', `VERIFIED entries require ${key} audit`, `${entryPath}.review.${key}`);
      }
    }
  }
  if (entry.review.notes !== undefined && typeof entry.review.notes !== 'string') {
    addError(result, 'invalid-review-notes', 'review.notes must be a string', `${entryPath}.review.notes`);
  }
}

function validateVietnamese(entry, entryPath, result) {
  const vietnamese = entry.vietnamese;
  if (vietnamese === undefined) return;
  if (!isObject(vietnamese)) {
    addError(result, 'invalid-vietnamese-record', 'vietnamese must be an object', `${entryPath}.vietnamese`);
    return;
  }
  const allTerms = [];
  for (const key of ['preferred', 'aliases', 'searchAliases']) {
    if (key === 'preferred') {
      if (vietnamese.preferred !== undefined && !nonemptyString(vietnamese.preferred)) {
        addError(result, 'invalid-vietnamese-preferred', 'vietnamese.preferred must be a non-empty string', `${entryPath}.vietnamese.preferred`);
      }
      if (nonemptyString(vietnamese.preferred)) allTerms.push(vietnamese.preferred.trim());
      continue;
    }
    if (vietnamese[key] !== undefined) {
      const values = validateStringArray(vietnamese[key], `${entryPath}.vietnamese.${key}`, result);
      allTerms.push(...values);
    }
  }
  const seen = new Set();
  for (const term of allTerms) {
    const normalized = normalizeSearchText(term);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      addError(result, 'duplicate-normalized-vietnamese-term', 'Vietnamese forms collide after normalization within one entry', `${entryPath}.vietnamese`);
    }
    seen.add(normalized);
  }
  if (Array.isArray(vietnamese.asciiSearchForms)) {
    const expected = new Set(
      [vietnamese.preferred, ...(vietnamese.aliases ?? []), ...(vietnamese.searchAliases ?? [])]
        .filter(nonemptyString)
        .map(normalizeSearchText),
    );
    for (const [index, form] of vietnamese.asciiSearchForms.entries()) {
      if (!/^[\x00-\x7F]*$/.test(form)) {
        addError(result, 'non-ascii-search-form', 'asciiSearchForms must contain ASCII only', `${entryPath}.vietnamese.asciiSearchForms[${index}]`);
      }
      if (nonemptyString(vietnamese.preferred) && form === vietnamese.preferred.trim()) {
        addError(result, 'ascii-display-term', 'ASCII search forms must not replace the canonical display term', `${entryPath}.vietnamese.asciiSearchForms[${index}]`);
      }
      if (!expected.has(form)) {
        addError(result, 'invalid-ascii-search-form', 'asciiSearchForms must equal the normalized form of a Vietnamese term', `${entryPath}.vietnamese.asciiSearchForms[${index}]`);
      }
    }
  }
}

function validateSourceIds(entry, entryPath, atlasPartIds, result) {
  if (!isObject(entry.sourceIds)) {
    addError(result, 'invalid-source-ids', 'sourceIds must be an object', `${entryPath}.sourceIds`);
    return;
  }
  const bodyParts = entry.sourceIds.bodyParts3d;
  if (bodyParts !== undefined) {
    if (!isObject(bodyParts) || !Array.isArray(bodyParts.ids) || !['packaged-mesh', 'external'].includes(bodyParts.scope)) {
      addError(result, 'invalid-bodyparts3d-reference', 'bodyParts3d requires ids and scope packaged-mesh or external', `${entryPath}.sourceIds.bodyParts3d`);
    } else {
      bodyParts.ids.forEach((id, index) => {
        if (!nonemptyString(id)) {
          addError(result, 'invalid-bodyparts3d-id', 'bodyParts3d ids must be non-empty strings', `${entryPath}.sourceIds.bodyParts3d.ids[${index}]`);
        } else if (bodyParts.scope === 'packaged-mesh' && !atlasPartIds.has(id)) {
          addError(result, 'unknown-packaged-mesh-id', `Unknown packaged mesh id: ${id}`, `${entryPath}.sourceIds.bodyParts3d.ids[${index}]`);
        }
      });
    }
  }
  for (const key of ['fma', 'ta2']) {
    if (entry.sourceIds[key] !== undefined && !nonemptyString(entry.sourceIds[key])) {
      addError(result, 'invalid-nomenclature-id', `${key} must be a non-empty string`, `${entryPath}.sourceIds.${key}`);
    }
  }
}

function validateExternalIdentifierProvenance(entry, entryPath, sourceCatalog, result) {
  for (const key of ['fma', 'ta2']) {
    const identifier = entry.sourceIds?.[key];
    if (!identifier) continue;
    if (entry.mapping?.status !== 'MAPPED') {
      addError(result, 'nomenclature-requires-mapped-entry', `${key} requires mapping.status MAPPED`, `${entryPath}.sourceIds.${key}`);
    }
    const match = Array.isArray(entry.provenance) && entry.provenance.some(reference => {
      const source = sourceCatalog[reference.sourceId];
      return sourceSupportsCapability(source, 'anatomical-identity') && reference.locator?.nomenclatureId === identifier;
    });
    if (!match) {
      addError(
        result,
        'nomenclature-locator-mismatch',
        `${key} requires provenance with anatomical-identity capability and locator.nomenclatureId ${identifier}`,
        `${entryPath}.provenance`,
      );
    }
  }
}

function entryHasVietnameseCandidate(entry) {
  return isObject(entry.vietnamese) &&
    ['preferred', 'aliases', 'searchAliases', 'asciiSearchForms'].some(key => {
      const value = entry.vietnamese[key];
      return nonemptyString(value) || (Array.isArray(value) && value.length > 0);
    });
}

function validateEntries(entryRecords, atlas, sourceCatalog, result) {
  const conceptMap = new Map(
    Array.isArray(atlas?.concepts)
      ? atlas.concepts.filter(isObject).filter(concept => nonemptyString(concept.id)).map(concept => [concept.id, concept])
      : [],
  );
  const atlasPartIds = new Set(
    Array.isArray(atlas?.parts)
      ? atlas.parts.filter(isObject).map(part => part.id).filter(nonemptyString)
      : [],
  );
  const seenKeys = new Set();
  const entries = [];
  const vietnameseTerms = new Map();

  entryRecords.forEach((record, index) => {
    const entryPath = `entries[${index}]`;
    if (!isObject(record)) {
      addError(result, 'invalid-entry-record', 'Terminology entry must be an object', entryPath);
      return;
    }
    if (!nonemptyString(record.key)) {
      addError(result, 'missing-entry-key', 'Each registry entry requires a stable key', `${entryPath}.key`);
    } else if (seenKeys.has(record.key)) {
      addError(result, 'duplicate-entry-key', `Duplicate terminology map key: ${record.key}`, `${entryPath}.key`);
    } else {
      seenKeys.add(record.key);
    }
    if (!nonemptyString(record.conceptId)) {
      addError(result, 'missing-entry-concept-id', 'conceptId is required', `${entryPath}.conceptId`);
    }
    if (nonemptyString(record.key) && nonemptyString(record.conceptId) && record.key !== record.conceptId) {
      addError(result, 'entry-key-concept-mismatch', 'Entry key must equal conceptId', `${entryPath}.key`);
    }
    if (nonemptyString(record.conceptId) && !conceptMap.has(record.conceptId)) {
      addError(result, 'orphan-concept', `Terminology entry references unknown atlas concept: ${record.conceptId}`, `${entryPath}.conceptId`);
    }
    if (!isObject(record.english) || !nonemptyString(record.english.preferred)) {
      addError(result, 'missing-english-snapshot', 'english.preferred is required', `${entryPath}.english.preferred`);
    } else {
      validateStringArray(record.english.aliases, `${entryPath}.english.aliases`, result);
      const concept = conceptMap.get(record.conceptId);
      if (concept && record.english.preferred.trim() !== concept.name) {
        if (record.review?.status === 'VERIFIED') {
          addError(result, 'english-snapshot-mismatch', 'Verified entries must snapshot the current atlas English name', `${entryPath}.english.preferred`);
        } else {
          addWarning(result, 'english-snapshot-mismatch', 'English snapshot differs from the current atlas name and needs review', `${entryPath}.english.preferred`);
        }
      }
    }
    if (!VALID_MAPPING_STATUSES.has(record.mapping?.status)) {
      addError(result, 'invalid-mapping-status', 'mapping.status is invalid', `${entryPath}.mapping.status`);
    }
    validateReview(record, entryPath, result);
    validateSourceIds(record, entryPath, atlasPartIds, result);
    const requiresProvenance = record.mapping?.status === 'MAPPED' || record.review?.status === 'VERIFIED' || entryHasVietnameseCandidate(record);
    validateProvenance(record, entryPath, sourceCatalog, result, requiresProvenance);
    validateExternalIdentifierProvenance(record, entryPath, sourceCatalog, result);
    validateVietnamese(record, entryPath, result);

    if (entryHasVietnameseCandidate(record)) {
      const terms = [
        record.vietnamese.preferred,
        ...(record.vietnamese.aliases ?? []),
        ...(record.vietnamese.searchAliases ?? []),
        ...(record.vietnamese.asciiSearchForms ?? []),
      ].filter(nonemptyString);
      for (const term of terms) {
        const normalized = normalizeSearchText(term);
        if (!normalized) continue;
        if (!vietnameseTerms.has(normalized)) vietnameseTerms.set(normalized, []);
        vietnameseTerms.get(normalized).push({entry: record, path: entryPath, term});
      }
      if (!hasVerifiedVietnamese(record, sourceCatalog)) {
        addWarning(result, 'unreleased-search-term', 'Vietnamese candidate is not release-eligible and must not enter production search', `${entryPath}.vietnamese`);
      }
    }
    const concept = conceptMap.get(record.conceptId);
    if (concept && nonemptyString(record.english?.preferred) && nonemptyString(record.vietnamese?.preferred)) {
      validateSemanticPair(record, entryPath, result);
    }
    entries.push(record);
  });

  for (const [normalized, occurrences] of vietnameseTerms) {
    const conceptIds = new Set(occurrences.map(item => item.entry.conceptId));
    if (conceptIds.size < 2) continue;
    addWarning(
      result,
      'normalized-alias-collision',
      `Vietnamese forms collide after normalization: ${normalized}`,
      occurrences.map(item => item.path).join(', '),
      {conceptIds: [...conceptIds]},
    );
    if (occurrences.every(item => hasVerifiedVietnamese(item.entry, sourceCatalog))) {
      addError(
        result,
        'release-normalized-alias-collision',
        `Release-eligible Vietnamese forms collide after normalization: ${normalized}`,
        occurrences.map(item => item.path).join(', '),
        {conceptIds: [...conceptIds]},
      );
    }
  }
  return {entries, conceptMap};
}

function validateSemanticPair(entry, entryPath, result) {
  const english = normalizeSearchText(entry.english.preferred);
  const vietnamese = normalizeSearchText(entry.vietnamese.preferred);
  for (const [englishA, englishB, vietnameseA, vietnameseB] of SEMANTIC_PAIRS) {
    const hasEnglishA = english.includes(normalizeSearchText(englishA));
    const hasEnglishB = english.includes(normalizeSearchText(englishB));
    const hasVietnameseA = vietnamese.includes(normalizeSearchText(vietnameseA));
    const hasVietnameseB = vietnamese.includes(normalizeSearchText(vietnameseB));
    if ((hasEnglishA && hasVietnameseB) || (hasEnglishB && hasVietnameseA)) {
      addWarning(
        result,
        'semantic-direction-mismatch',
        `Conservative semantic heuristic flagged a possible ${englishA}/${englishB} mismatch; human review is required`,
        `${entryPath}.vietnamese.preferred`,
      );
    }
  }
}

function auditPassed(audit, type, requireHuman = false) {
  return Boolean(
    audit?.type === type &&
      audit.status === 'PASSED' &&
      isValidDate(audit.reviewedAt) &&
      (!requireHuman || (nonemptyString(audit.reviewer) && audit.automated !== true)),
  );
}

export function computeCoverage(atlas, entries, sourceCatalog) {
  const totalConcepts = Array.isArray(atlas?.concepts) ? atlas.concepts.length : 0;
  const conceptIds = new Set(
    Array.isArray(atlas?.concepts)
      ? atlas.concepts.filter(isObject).map(concept => concept.id).filter(nonemptyString)
      : [],
  );
  const mappedConceptIds = new Set(
    entries.filter(entry => entry?.mapping?.status === 'MAPPED' && conceptIds.has(entry.conceptId)).map(entry => entry.conceptId),
  );
  const candidateEntries = entries.filter(entryHasVietnameseCandidate);
  const sourceVerifiedEntries = entries.filter(entry => auditPassed(entry.review?.sourceVerification, 'source-verification', true));
  const medicallyReviewedEntries = entries.filter(entry => auditPassed(entry.review?.medicalReview, 'medical-review', true));
  const releaseEntries = entries.filter(entry => hasVerifiedVietnamese(entry, sourceCatalog));
  const searchableEntries = entries.filter(entry => {
    const englishAliases = Array.isArray(entry.english?.aliases) && entry.english.aliases.some(nonemptyString);
    const latinTerms = entry.mapping?.status === 'MAPPED' &&
      (nonemptyString(entry.latin?.preferred) || (Array.isArray(entry.latin?.aliases) && entry.latin.aliases.some(nonemptyString)));
    return englishAliases || latinTerms || hasVerifiedVietnamese(entry, sourceCatalog);
  });
  const percentage = count => totalConcepts === 0 ? 0 : Number(((count / totalConcepts) * 100).toFixed(2));
  return {
    totalAtlasConcepts: totalConcepts,
    terminologyEntries: entries.length,
    vietnameseCandidateEntries: candidateEntries.length,
    searchableTerminologyEntries: searchableEntries.length,
    sourceVerifiedEntries: sourceVerifiedEntries.length,
    medicallyReviewedEntries: medicallyReviewedEntries.length,
    releaseEligibleEntries: releaseEntries.length,
    unresolvedOrUnmappedConcepts: Math.max(totalConcepts - mappedConceptIds.size, 0),
    percentages: {
      vietnameseCandidate: percentage(candidateEntries.length),
      searchable: percentage(searchableEntries.length),
      sourceVerified: percentage(sourceVerifiedEntries.length),
      medicallyReviewed: percentage(medicallyReviewedEntries.length),
      releaseEligible: percentage(releaseEntries.length),
      resolvedMapped: percentage(mappedConceptIds.size),
    },
  };
}

export function validateTerminologyData({atlas, sourcesDocument, entriesDocument}) {
  const result = {
    errors: [],
    warnings: [],
    sourceCatalog: {},
    entries: [],
    coverage: null,
  };
  validateSchemaVersion(sourcesDocument, 'sources', result);
  validateSchemaVersion(entriesDocument, 'entries', result);
  const sourceRecords = getArray(sourcesDocument, 'sources', result);
  const entryRecords = getArray(entriesDocument, 'entries', result);
  result.sourceCatalog = validateSources(sourceRecords, result);
  const validated = validateEntries(entryRecords, atlas, result.sourceCatalog, result);
  result.entries = validated.entries;
  result.coverage = computeCoverage(atlas, result.entries, result.sourceCatalog);
  return result;
}

export async function loadProductionData({root = REPOSITORY_ROOT} = {}) {
  const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));
  const [atlas, sourcesDocument, entriesDocument] = await Promise.all([
    readJson(join(root, 'public', 'models', 'atlas.json')),
    readJson(join(root, 'data', 'terminology', 'sources.json')),
    readJson(join(root, 'data', 'terminology', 'entries.json')),
  ]);
  return {atlas, sourcesDocument, entriesDocument};
}

function printHumanSummary(result) {
  const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
  const c = result.coverage;
  console.log(`M02A terminology validation: ${status}`);
  console.log(`Sources: ${Object.keys(result.sourceCatalog).length}; registry entries: ${c.terminologyEntries}`);
  console.log(`Atlas concepts: ${c.totalAtlasConcepts}; unresolved/unmapped: ${c.unresolvedOrUnmappedConcepts}`);
  console.log(`Vietnamese candidates: ${c.vietnameseCandidateEntries} (${c.percentages.vietnameseCandidate}%)`);
  console.log(`Searchable terminology entries: ${c.searchableTerminologyEntries} (${c.percentages.searchable}%)`);
  console.log(`Source-verified: ${c.sourceVerifiedEntries} (${c.percentages.sourceVerified}%)`);
  console.log(`Medically reviewed: ${c.medicallyReviewedEntries} (${c.percentages.medicallyReviewed}%)`);
  console.log(`Release eligible: ${c.releaseEligibleEntries} (${c.percentages.releaseEligible}%)`);
  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    result.errors.forEach(item => console.log(`- ${item.code}: ${item.message}${item.path ? ` [${item.path}]` : ''}`));
  }
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    result.warnings.forEach(item => console.log(`- ${item.code}: ${item.message}${item.path ? ` [${item.path}]` : ''}`));
  }
}

export async function main(argv = process.argv.slice(2)) {
  const data = await loadProductionData();
  const result = validateTerminologyData(data);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({
      status: result.errors.length === 0 ? 'PASS' : 'FAIL',
      errors: result.errors,
      warnings: result.warnings,
      coverage: result.coverage,
    }, null, 2));
  } else {
    printHumanSummary(result);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => {
    process.exitCode = result.errors.length === 0 ? 0 : 1;
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
