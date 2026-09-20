import type {Concept} from './anatomy';
import type {Language} from './localization';
import {normalizeSearchText} from './search-normalization.ts';

export const TERMINOLOGY_STATUSES = [
  'UNMAPPED',
  'MAPPED',
  'DRAFT',
  'SOURCE_VERIFIED',
  'MEDICAL_REVIEWED',
  'VERIFIED',
  'REJECTED',
] as const;
export type TerminologyStatus = (typeof TERMINOLOGY_STATUSES)[number];
export type MappingStatus = Extract<TerminologyStatus, 'UNMAPPED' | 'MAPPED' | 'REJECTED'>;
export type ReviewStatus = Exclude<TerminologyStatus, 'MAPPED'>;

export type TerminologySourceClass =
  | 'international-nomenclature'
  | 'vietnamese-authoritative'
  | 'secondary-reference'
  | 'machine-generated';

export type TerminologySourceCapability =
  | 'anatomical-identity'
  | 'canonical-latin'
  | 'vietnamese-preferred'
  | 'secondary-corroboration'
  | 'machine-candidate-discovery';

export interface TerminologySourceCapabilities {
  anatomicalIdentity: boolean;
  canonicalLatin: boolean;
  vietnamesePreferred: boolean;
  secondaryCorroboration: boolean;
  machineCandidateDiscovery: boolean;
}

export type TerminologySourceRecordStatus = 'UNVERIFIED' | 'VERIFIED';

export interface TerminologySourceAudit {
  status: TerminologySourceRecordStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
}

export interface TerminologySourceIds {
  bodyParts3d?: {
    ids: readonly string[];
    scope: 'packaged-mesh' | 'external';
  };
  fma?: string;
  ta2?: string;
}

export interface TerminologyProvenanceLocator {
  page?: number;
  chapter?: string;
  section?: string;
  table?: string;
  entryId?: string;
  url?: string;
  nomenclatureId?: string;
}

export interface TerminologyProvenance {
  sourceId: string;
  locator?: TerminologyProvenanceLocator;
  checkedAt?: string;
  note?: string;
}

export interface TerminologySourceRecord {
  id: string;
  class: TerminologySourceClass;
  title: string;
  capabilities: TerminologySourceCapabilities;
  audit: TerminologySourceAudit;
  authors?: readonly string[];
  institution?: string;
  edition?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  url?: string;
  accessedAt?: string;
  language?: string;
  version?: string;
  licenseNote?: string;
}

export type TerminologySourceCatalog = Readonly<Record<string, TerminologySourceRecord>>;

export type TerminologyReviewAuditType = 'source-verification' | 'medical-review' | 'release-eligibility';
export type TerminologyReviewAuditStatus = 'PENDING' | 'PASSED' | 'REJECTED';

export interface TerminologyReviewAudit {
  type: TerminologyReviewAuditType;
  status: TerminologyReviewAuditStatus;
  reviewer?: string;
  reviewedAt?: string;
  notes?: string;
  automated?: boolean;
}

export interface TerminologyReview {
  status: ReviewStatus;
  sourceVerification?: TerminologyReviewAudit;
  medicalReview?: TerminologyReviewAudit;
  releaseEligibility?: TerminologyReviewAudit;
  notes?: string;
}

export interface TerminologyEntry {
  /** Stable runtime concept identity; never a mesh-local name. */
  conceptId: string;
  sourceIds: TerminologySourceIds;
  english: {
    preferred: string;
    aliases: readonly string[];
  };
  latin?: {
    preferred?: string;
    aliases?: readonly string[];
  };
  vietnamese?: {
    preferred?: string;
    aliases?: readonly string[];
    searchAliases?: readonly string[];
    /** Matching forms only; never canonical display text. */
    asciiSearchForms?: readonly string[];
  };
  provenance: readonly TerminologyProvenance[];
  mapping: {
    status: MappingStatus;
    notes?: string;
  };
  review: TerminologyReview;
}

export type TerminologyOverlay = Readonly<Record<string, TerminologyEntry>>;

/** Deliberately empty in Phase 0/1/M02A: no Vietnamese anatomy has been guessed. */
export const TERMINOLOGY_OVERLAY: TerminologyOverlay = Object.freeze({});
/** Source records are also empty until authoritative references are curated. */
export const TERMINOLOGY_SOURCES: TerminologySourceCatalog = Object.freeze({});

const capabilityProperties: Readonly<Record<TerminologySourceCapability, keyof TerminologySourceCapabilities>> = {
  'anatomical-identity': 'anatomicalIdentity',
  'canonical-latin': 'canonicalLatin',
  'vietnamese-preferred': 'vietnamesePreferred',
  'secondary-corroboration': 'secondaryCorroboration',
  'machine-candidate-discovery': 'machineCandidateDiscovery',
};

export function sourceSupportsCapability(
  source: TerminologySourceRecord | undefined,
  capability: TerminologySourceCapability,
): boolean {
  if (!source) return false;
  return Boolean(source.capabilities?.[capabilityProperties[capability]]);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function hasReproducibleLocator(locator: TerminologyProvenanceLocator | undefined): boolean {
  if (!locator) return false;
  return Boolean(
    (typeof locator.page === 'number' && Number.isInteger(locator.page) && locator.page > 0) ||
      hasText(locator.chapter) ||
      hasText(locator.section) ||
      hasText(locator.table) ||
      hasText(locator.entryId) ||
      hasText(locator.url) ||
      hasText(locator.nomenclatureId),
  );
}

function hasPassedAudit(
  audit: TerminologyReviewAudit | undefined,
  type: TerminologyReviewAuditType,
  requireReviewer: boolean,
): boolean {
  return Boolean(
      audit?.type === type &&
      audit.status === 'PASSED' &&
      hasText(audit.reviewedAt) &&
      (!requireReviewer || hasText(audit.reviewer)) &&
      (type !== 'medical-review' || audit.automated !== true),
  );
}

function hasRequiredNomenclatureLocators(
  entry: TerminologyEntry,
  sourceCatalog: TerminologySourceCatalog,
): boolean {
  for (const identifier of [entry.sourceIds.fma, entry.sourceIds.ta2]) {
    if (!identifier) continue;
    const found = entry.provenance.some(reference => {
      const source = sourceCatalog[reference.sourceId];
      return (
        sourceSupportsCapability(source, 'anatomical-identity') &&
        reference.locator?.nomenclatureId === identifier
      );
    });
    if (!found) return false;
  }
  return true;
}

function hasReleaseProvenance(entry: TerminologyEntry, sourceCatalog: TerminologySourceCatalog): boolean {
  const records = entry.provenance.map(reference => sourceCatalog[reference.sourceId]);
  return Boolean(
    records.length &&
      entry.provenance.every(reference => hasReproducibleLocator(reference.locator)) &&
      records.every(
        (record): record is TerminologySourceRecord =>
          Boolean(record) &&
          record.class !== 'machine-generated' &&
          record.audit?.status === 'VERIFIED' &&
          hasText(record.audit?.verifiedAt) &&
          hasText(record.audit?.verifiedBy) &&
          !sourceSupportsCapability(record, 'machine-candidate-discovery'),
      ) &&
      records.some(record => sourceSupportsCapability(record, 'vietnamese-preferred')) &&
      hasRequiredNomenclatureLocators(entry, sourceCatalog),
  );
}

export function hasVerifiedVietnamese(
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
): boolean {
  return Boolean(
    entry &&
      entry.mapping.status === 'MAPPED' &&
      entry.review.status === 'VERIFIED' &&
      entry.vietnamese?.preferred?.trim() &&
      hasPassedAudit(entry.review.sourceVerification, 'source-verification', true) &&
      hasPassedAudit(entry.review.medicalReview, 'medical-review', true) &&
      hasPassedAudit(entry.review.releaseEligibility, 'release-eligibility', false) &&
      hasReleaseProvenance(entry, sourceCatalog),
  );
}

export function resolveConceptName(
  concept: Pick<Concept, 'id' | 'name'>,
  language: Language,
  overlay: TerminologyOverlay = TERMINOLOGY_OVERLAY,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
): string {
  const entry = overlay[concept.id];
  if (language === 'vi' && hasVerifiedVietnamese(entry, sourceCatalog)) return entry.vietnamese!.preferred!.trim();
  // The atlas name remains the English source of truth; an overlay cannot rewrite it.
  return concept.name;
}

function uniqueNonempty(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))];
}

/**
 * Build a small linear search surface from the overlay. It is intentionally not
 * a second persisted index; callers can measure before introducing one.
 */
export function terminologySearchTerms(
  concept: Pick<Concept, 'id' | 'name'>,
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
): readonly string[] {
  const terms = uniqueNonempty([
    concept.name,
    concept.id,
    entry?.english.preferred,
    ...(entry?.english.aliases ?? []),
    ...(entry?.sourceIds.bodyParts3d?.ids ?? []),
    entry?.sourceIds.fma,
    entry?.sourceIds.ta2,
  ]);
  if (entry?.mapping.status === 'MAPPED') {
    terms.push(...uniqueNonempty([entry.latin?.preferred, ...(entry.latin?.aliases ?? [])]));
  }
  if (entry && hasVerifiedVietnamese(entry, sourceCatalog)) {
    terms.push(
      ...uniqueNonempty([
        entry.vietnamese?.preferred,
        ...(entry.vietnamese?.aliases ?? []),
        ...(entry.vietnamese?.searchAliases ?? []),
        ...(entry.vietnamese?.asciiSearchForms ?? []),
      ]),
    );
  }
  return [...new Set(terms)];
}

export function matchesTerminologyQuery(
  concept: Pick<Concept, 'id' | 'name'>,
  query: string,
  overlay: TerminologyOverlay = TERMINOLOGY_OVERLAY,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  return terminologySearchTerms(concept, overlay[concept.id], sourceCatalog).some(term =>
    normalizeSearchText(term).includes(normalizedQuery),
  );
}
