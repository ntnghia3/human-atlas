import type {Concept} from './anatomy';
import type {Language} from './localization';
import {normalizeSearchText} from './search-normalization.ts';
import {
  PRODUCTION_TERMINOLOGY_OVERLAY,
  PRODUCTION_TERMINOLOGY_RELEASE,
  PRODUCTION_TERMINOLOGY_REVIEWERS,
  PRODUCTION_TERMINOLOGY_SOURCES,
} from './terminology-data.ts';

export const TERMINOLOGY_SCHEMA_VERSION = 2;
export const TERMINOLOGY_STATUSES = [
  'UNMAPPED',
  'MAPPED',
  'DRAFT',
  'SOURCE_VERIFIED',
  'MEDICAL_REVIEWED',
  'VERIFIED',
  'RELEASE_ELIGIBLE',
  'REJECTED',
] as const;
export type TerminologyStatus = (typeof TERMINOLOGY_STATUSES)[number];
export type MappingStatus = 'UNMAPPED' | 'MAPPED' | 'REJECTED';
export type MappingDisposition = 'NOT_INVESTIGATED' | 'UNRESOLVED' | 'CONFIRMED_NO_EQUIVALENT';
export type ReviewStatus = Exclude<TerminologyStatus, 'MAPPED'>;

export type TerminologySourceClass =
  | 'international-nomenclature'
  | 'atlas-dataset'
  | 'vietnamese-authoritative'
  | 'secondary-reference'
  | 'machine-generated';

export type TerminologySourceCapability =
  | 'anatomical-identity'
  | 'canonical-latin'
  | 'vietnamese-preferred'
  | 'secondary-corroboration'
  | 'machine-candidate-discovery';

export type TerminologySourceAuthorityTier = 'authoritative' | 'corroborative' | 'discovery-only' | 'rejected';
export type TerminologySourceAccessStatus = 'FULL_ACCESS' | 'PARTIAL_ACCESS' | 'METADATA_ONLY' | 'UNAVAILABLE';
export type TerminologySourceLocatorCapability = 'PAGE' | 'PLATE' | 'CHAPTER_SECTION' | 'TERM_ID' | 'STABLE_ENTRY' | 'INSUFFICIENT';

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

export interface TerminologySourceRecord {
  id: string;
  class: TerminologySourceClass;
  title: string;
  revision: string;
  identityVerified: boolean;
  authorityTier: TerminologySourceAuthorityTier;
  authorityScope: readonly string[];
  accessStatus: TerminologySourceAccessStatus;
  locatorCapability: TerminologySourceLocatorCapability;
  fullTextAvailableForReview: boolean;
  contentInspected: boolean;
  verificationEvidence: readonly string[];
  limitations: readonly string[];
  capabilities: TerminologySourceCapabilities;
  audit: TerminologySourceAudit;
  authors?: readonly string[];
  institution?: string;
  edition?: string;
  publicationYear?: number | null;
  publisher?: string;
  isbn?: string | null;
  doi?: string;
  url?: string;
  accessedAt?: string;
  language?: string;
  version?: string;
  licenseNote?: string;
}

export type TerminologySourceCatalog = Readonly<Record<string, TerminologySourceRecord>>;

export interface TerminologyReviewerRecord {
  id: string;
  displayName: string;
  role: string;
  qualifications: readonly string[];
  authorizationScope: readonly string[];
  status: 'ACTIVE' | 'INACTIVE';
  evidenceRef?: string;
}

export type TerminologyReviewerCatalog = Readonly<Record<string, TerminologyReviewerRecord>>;

export type TerminologyMappingRelation =
  | 'exact'
  | 'equivalent'
  | 'target-broader'
  | 'target-narrower'
  | 'overlapping'
  | 'related'
  | 'composite'
  | 'collective'
  | 'obsolete-replaced';
export type TerminologyExternalMappingDisposition = 'CANDIDATE' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED';

export interface TerminologyExternalMapping {
  id: string;
  namespace: string;
  identifier: string;
  sourceRevision: string;
  relation: TerminologyMappingRelation;
  disposition: TerminologyExternalMappingDisposition;
  evidenceClaimIds: readonly string[];
  notes?: string;
}

export interface TerminologyAtlasMembership {
  meshIds: readonly string[];
  scope: 'packaged-mesh' | 'external';
}

export interface TerminologyProvenanceLocator {
  page?: number;
  plate?: string;
  chapter?: string;
  section?: string;
  table?: string;
  entryId?: string;
  url?: string;
  nomenclatureId?: string;
}

export type TerminologyClaimType =
  | 'atlas-identity'
  | 'atlas-fma-mapping'
  | 'atlas-ta2-mapping'
  | 'canonical-latin'
  | 'latin-alias'
  | 'english-alias'
  | 'vietnamese-preferred'
  | 'vietnamese-alias'
  | 'vietnamese-search-alias'
  | 'secondary-corroboration';
export type TerminologyEvidenceDisposition = 'CANDIDATE' | 'SUPPORTED' | 'REJECTED' | 'SUPERSEDED';
export type TerminologyClaimReviewState = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface TerminologyClaim {
  id: string;
  type: TerminologyClaimType;
  target: string;
  sourceId: string;
  sourceRevision: string;
  locator: TerminologyProvenanceLocator;
  evidenceDisposition: TerminologyEvidenceDisposition;
  reviewState: TerminologyClaimReviewState;
  candidateOriginId?: string;
  notes?: string;
}

export interface TerminologyCandidateOrigin {
  id: string;
  method: 'human' | 'machine';
  sourceId?: string;
  createdAt: string;
  note?: string;
}

export type TerminologyConflictType =
  | 'identity-disagreement'
  | 'granularity-disagreement'
  | 'contextual-difference'
  | 'edition-version-difference'
  | 'competing-preferred-terminology';
export type TerminologyConflictStatus = 'OPEN' | 'ADJUDICATED' | 'REJECTED';

export interface TerminologyConflict {
  id: string;
  type: TerminologyConflictType;
  claimIds: readonly string[];
  status: TerminologyConflictStatus;
  decision?: string;
  rationale?: string;
  acceptedPreferredClaimId?: string;
  permittedAliasClaimIds?: readonly string[];
  ambiguityAllowed?: boolean;
  reviewerId?: string;
  resolvedAt?: string;
  entryRevision?: string;
}

export type TerminologyReviewAuditType = 'source-verification' | 'medical-review' | 'release-eligibility';
export type TerminologyReviewAuditStatus = 'PENDING' | 'PASSED' | 'REJECTED';

export interface TerminologyReviewAudit {
  type: TerminologyReviewAuditType;
  status: TerminologyReviewAuditStatus;
  reviewerId?: string;
  reviewedAt?: string;
  entryRevision?: string;
  claimIds?: readonly string[];
  decision?: 'APPROVE' | 'REJECT' | 'SUPERSEDE';
  evidenceRef?: string;
  notes?: string;
  /** Informational only; automated checks can never satisfy medical review. */
  automated?: boolean;
}

export interface TerminologyReview {
  /** Compatibility/workflow hint. Effective release is derived from current dependencies. */
  status: ReviewStatus;
  sourceVerification?: TerminologyReviewAudit;
  medicalReview?: TerminologyReviewAudit;
  releaseEligibility?: TerminologyReviewAudit;
  notes?: string;
}

export interface TerminologyEntry {
  /** Opaque stable atlas identity; an FMA-like spelling is not an FMA assertion. */
  conceptId: string;
  atlas?: TerminologyAtlasMembership;
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
  /** Optional medically meaningful qualifiers included in revision calculation. */
  scope?: {
    qualifiers?: readonly string[];
    notes?: string;
  };
  mapping: {
    status: MappingStatus;
    disposition?: MappingDisposition;
    mappings: readonly TerminologyExternalMapping[];
    notes?: string;
  };
  claims: readonly TerminologyClaim[];
  candidateOrigins?: readonly TerminologyCandidateOrigin[];
  conflicts?: readonly TerminologyConflict[];
  review: TerminologyReview;
}

export type TerminologyReleaseEntry = Omit<TerminologyEntry, 'conceptId'>;
export type SystemTerminologyOverlay = Readonly<Record<string, TerminologyReleaseEntry>>;
export type TerminologyOverlay = Readonly<Record<string, TerminologyEntry>>;

export interface TerminologyReleaseManifest {
  schemaVersion: number;
  releaseStatus: 'UNRELEASED' | 'RELEASED';
  atlasVersion: string;
  atlasRevision: string;
  registryRevision: string;
  sourceCatalogRevision: string;
  reviewersRevision: string;
  policyVersion: string;
  entryRevisions: Readonly<Record<string, string>>;
  contentHash?: string;
}

export const TERMINOLOGY_OVERLAY: TerminologyOverlay = PRODUCTION_TERMINOLOGY_OVERLAY;
export const TERMINOLOGY_SOURCES: TerminologySourceCatalog = PRODUCTION_TERMINOLOGY_SOURCES;
export const TERMINOLOGY_REVIEWERS: TerminologyReviewerCatalog = PRODUCTION_TERMINOLOGY_REVIEWERS;
export const TERMINOLOGY_RELEASE: TerminologyReleaseManifest = PRODUCTION_TERMINOLOGY_RELEASE;
export const SYSTEM_TERMINOLOGY_OVERLAY: SystemTerminologyOverlay = Object.freeze({});

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
  return Boolean(source?.capabilities?.[capabilityProperties[capability]]);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function stableCanonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stableCanonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `m02b-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Deterministic revision over all medically meaningful entry content, excluding review records. */
export function computeTerminologyRevision(entry: TerminologyEntry): string {
  const {review: _review, conflicts, ...rest} = entry;
  const material = {
    ...rest,
    conflicts: conflicts?.map(({entryRevision: _entryRevision, ...conflict}) => conflict),
  };
  return hashText(stableCanonical(material));
}

function hasExactLocator(locator: TerminologyProvenanceLocator | undefined): boolean {
  return Boolean(
    locator &&
      ((typeof locator.page === 'number' && Number.isInteger(locator.page) && locator.page > 0) ||
        hasText(locator.plate) ||
        hasText(locator.chapter) ||
        hasText(locator.section) ||
        hasText(locator.table) ||
        hasText(locator.entryId) ||
        hasText(locator.nomenclatureId)),
  );
}

function sourceLocatorSupportsClaim(source: TerminologySourceRecord, locator: TerminologyProvenanceLocator): boolean {
  switch (source.locatorCapability) {
    case 'PAGE': return typeof locator.page === 'number' && Number.isInteger(locator.page) && locator.page > 0;
    case 'PLATE': return hasText(locator.plate) || hasText(locator.table);
    case 'CHAPTER_SECTION': return hasText(locator.chapter) || hasText(locator.section);
    case 'TERM_ID': return hasText(locator.entryId) || hasText(locator.nomenclatureId);
    case 'STABLE_ENTRY': return hasText(locator.entryId) || hasText(locator.nomenclatureId);
    case 'INSUFFICIENT':
    default: return false;
  }
}

function claimCapability(type: TerminologyClaimType): TerminologySourceCapability | undefined {
  if (type === 'atlas-identity' || type === 'atlas-fma-mapping' || type === 'atlas-ta2-mapping') return 'anatomical-identity';
  if (type === 'canonical-latin' || type === 'latin-alias') return 'canonical-latin';
  if (type === 'vietnamese-preferred' || type === 'vietnamese-alias' || type === 'vietnamese-search-alias') return 'vietnamese-preferred';
  if (type === 'secondary-corroboration') return 'secondary-corroboration';
  return undefined;
}

function sourceCanSupportClaim(source: TerminologySourceRecord | undefined, claim: TerminologyClaim): boolean {
  return Boolean(
    source &&
      source.identityVerified === true &&
      source.authorityTier !== 'discovery-only' &&
      source.authorityTier !== 'rejected' &&
      source.accessStatus !== 'METADATA_ONLY' &&
      source.accessStatus !== 'UNAVAILABLE' &&
      source.fullTextAvailableForReview === true &&
      source.contentInspected === true &&
      source.audit?.status === 'VERIFIED' &&
      source.class !== 'machine-generated' &&
      !sourceSupportsCapability(source, 'machine-candidate-discovery') &&
      source.revision === claim.sourceRevision &&
      (() => {
        const capability = claimCapability(claim.type);
        if (capability && !sourceSupportsCapability(source, capability)) return false;
        if (capability === 'vietnamese-preferred' && (source.class !== 'vietnamese-authoritative' || source.authorityTier !== 'authoritative')) return false;
        if (capability === 'canonical-latin' && source.class !== 'international-nomenclature') return false;
        return true;
      })() &&
      hasExactLocator(claim.locator) &&
      sourceLocatorSupportsClaim(source, claim.locator),
  );
}

function claimTypeForMapping(namespace: string): TerminologyClaimType | undefined {
  const normalized = namespace.trim().toUpperCase();
  if (normalized === 'FMA') return 'atlas-fma-mapping';
  if (normalized === 'TA2') return 'atlas-ta2-mapping';
  return undefined;
}

function approvedClaim(
  entry: TerminologyEntry,
  type: TerminologyClaimType,
  target: string,
  sourceCatalog: TerminologySourceCatalog,
): boolean {
  return entry.claims.some(claim =>
    claim.type === type &&
    claim.target === target &&
    claim.evidenceDisposition === 'SUPPORTED' &&
    claim.reviewState === 'VERIFIED' &&
    sourceCanSupportClaim(sourceCatalog[claim.sourceId], claim),
  );
}

function mappingEvidenceApproved(
  entry: TerminologyEntry,
  mapping: TerminologyExternalMapping,
  sourceCatalog: TerminologySourceCatalog,
): boolean {
  const expectedType = claimTypeForMapping(mapping.namespace);
  return (
    mapping.disposition === 'VERIFIED' &&
    mapping.evidenceClaimIds.length > 0 &&
    mapping.evidenceClaimIds.every(claimId => {
      const claim = entry.claims.find(item => item.id === claimId);
      return Boolean(
          claim &&
          (!expectedType || claim.type === expectedType) &&
          claim.target === mapping.identifier &&
          (!expectedType || claim.locator.nomenclatureId === mapping.identifier) &&
          claim.sourceRevision === mapping.sourceRevision &&
          claim.evidenceDisposition === 'SUPPORTED' &&
          claim.reviewState === 'VERIFIED' &&
          sourceCanSupportClaim(sourceCatalog[claim.sourceId], claim),
      );
    })
  );
}

function mappingReleaseReady(entry: TerminologyEntry, sourceCatalog: TerminologySourceCatalog): boolean {
  if (entry.mapping.status === 'MAPPED') {
    return entry.mapping.mappings.some(mapping =>
      mappingEvidenceApproved(entry, mapping, sourceCatalog) &&
      ['exact', 'equivalent', 'composite', 'collective'].includes(mapping.relation),
    );
  }
  return (
    entry.mapping.status === 'UNMAPPED' &&
    entry.mapping.disposition === 'CONFIRMED_NO_EQUIVALENT' &&
    approvedClaim(entry, 'atlas-identity', entry.conceptId, sourceCatalog)
  );
}

function reviewerCanReview(
  reviewerId: string | undefined,
  reviewers: TerminologyReviewerCatalog,
  claimIds: readonly string[],
): boolean {
  const reviewer = reviewerId ? reviewers[reviewerId] : undefined;
  if (!reviewer || reviewer.status !== 'ACTIVE' || !hasText(reviewer.displayName) || !hasText(reviewer.role)) return false;
  return reviewer.authorizationScope.includes('*') || claimIds.every(claimId => reviewer.authorizationScope.includes(claimId));
}

function hasPassedAudit(
  audit: TerminologyReviewAudit | undefined,
  type: TerminologyReviewAuditType,
  entry: TerminologyEntry,
  reviewers: TerminologyReviewerCatalog,
  requireHuman: boolean,
): boolean {
  const revision = computeTerminologyRevision(entry);
  const claimIds = audit?.claimIds ?? [];
  return Boolean(
    audit?.type === type &&
      audit.status === 'PASSED' &&
      audit.decision === 'APPROVE' &&
      hasText(audit.reviewedAt) &&
      audit.entryRevision === revision &&
      claimIds.length > 0 &&
      (!requireHuman ||
        (hasText(audit.reviewerId) && audit.automated !== true && reviewerCanReview(audit.reviewerId, reviewers, claimIds))),
  );
}

function auditCoversClaims(audit: TerminologyReviewAudit | undefined, requiredClaimIds: readonly string[]): boolean {
  const reviewed = new Set(audit?.claimIds ?? []);
  return requiredClaimIds.length > 0 && requiredClaimIds.every(claimId => reviewed.has(claimId));
}

function conflictsResolved(entry: TerminologyEntry, reviewers: TerminologyReviewerCatalog): boolean {
  return (entry.conflicts ?? []).every(conflict => {
    if (conflict.status === 'REJECTED') return true;
    if (conflict.status !== 'ADJUDICATED') return false;
    return Boolean(
      hasText(conflict.decision) &&
        hasText(conflict.rationale) &&
        hasText(conflict.reviewerId) &&
        reviewerCanReview(conflict.reviewerId, reviewers, conflict.claimIds) &&
        conflict.entryRevision === computeTerminologyRevision(entry),
    );
  });
}

export function hasVerifiedVietnamese(
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): boolean {
  if (!entry || entry.review?.status === 'REJECTED' || !hasText(entry.vietnamese?.preferred)) return false;
  const preferred = entry.vietnamese.preferred.trim();
  const preferredClaim = approvedClaim(entry, 'vietnamese-preferred', preferred, sourceCatalog);
  const claimIds = entry.claims.filter(claim => claim.evidenceDisposition === 'SUPPORTED').map(claim => claim.id);
  const reviewClaimIds = entry.claims
    .filter(claim => ['atlas-identity', 'atlas-fma-mapping', 'atlas-ta2-mapping', 'vietnamese-preferred'].includes(claim.type))
    .map(claim => claim.id);
  return Boolean(
    mappingReleaseReady(entry, sourceCatalog) &&
      preferredClaim &&
      hasPassedAudit(entry.review?.sourceVerification, 'source-verification', entry, reviewers, true) &&
      hasPassedAudit(entry.review?.medicalReview, 'medical-review', entry, reviewers, true) &&
      auditCoversClaims(entry.review?.sourceVerification, reviewClaimIds) &&
      auditCoversClaims(entry.review?.medicalReview, reviewClaimIds) &&
      conflictsResolved(entry, reviewers) &&
      claimIds.length > 0,
  );
}

export function hasVerifiedLatin(
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): boolean {
  if (!entry || !hasText(entry.latin?.preferred)) return false;
  return Boolean(
    mappingReleaseReady(entry, sourceCatalog) &&
      approvedClaim(entry, 'canonical-latin', entry.latin.preferred.trim(), sourceCatalog) &&
      hasPassedAudit(entry.review?.sourceVerification, 'source-verification', entry, reviewers, true) &&
      auditCoversClaims(entry.review?.sourceVerification, entry.claims.filter(claim => ['atlas-identity', 'atlas-fma-mapping', 'atlas-ta2-mapping', 'canonical-latin'].includes(claim.type)).map(claim => claim.id)),
  );
}

function approvedMappingIdentifiers(entry: TerminologyEntry, sourceCatalog: TerminologySourceCatalog): Array<{namespace: string; identifier: string}> {
  return entry.mapping.mappings
    .filter(mapping => mappingEvidenceApproved(entry, mapping, sourceCatalog))
    .map(mapping => ({namespace: mapping.namespace, identifier: mapping.identifier}));
}

export function terminologySourceIdentifiers(
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
): {fma?: string; ta2?: string; bodyParts3d?: readonly string[]} {
  if (!entry) return {};
  const identifiers = approvedMappingIdentifiers(entry, sourceCatalog);
  const fma = identifiers.find(item => item.namespace.toUpperCase() === 'FMA')?.identifier;
  const ta2 = identifiers.find(item => item.namespace.toUpperCase() === 'TA2')?.identifier;
  const bodyParts3d = entry.atlas?.meshIds.filter(meshId => approvedClaim(entry, 'atlas-identity', meshId, sourceCatalog));
  return {fma, ta2, bodyParts3d: bodyParts3d?.length ? bodyParts3d : undefined};
}

export function resolveSystemName(
  system: Pick<{id: string; name: string}, 'id' | 'name'>,
  language: Language,
  overlay: SystemTerminologyOverlay = SYSTEM_TERMINOLOGY_OVERLAY,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): string {
  const entry = overlay[system.id];
  if (language === 'vi' && entry && hasVerifiedVietnamese({...entry, conceptId: system.id}, sourceCatalog, reviewers)) return entry.vietnamese!.preferred!.trim();
  return system.name;
}

export function resolveConceptName(
  concept: Pick<Concept, 'id' | 'name'>,
  language: Language,
  overlay: TerminologyOverlay = TERMINOLOGY_OVERLAY,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): string {
  const entry = overlay[concept.id];
  if (language === 'vi' && hasVerifiedVietnamese(entry, sourceCatalog, reviewers)) return entry.vietnamese!.preferred!.trim();
  return concept.name;
}

function uniqueNonempty(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => hasText(value)).map(value => value.trim()))];
}

function approvedAliasTerms(entry: TerminologyEntry, type: TerminologyClaimType, values: readonly string[], sourceCatalog: TerminologySourceCatalog): string[] {
  return values.filter(value => approvedClaim(entry, type, value.trim(), sourceCatalog));
}

/** Build only the search surface whose semantic claim has passed its gate. */
export function terminologySearchTerms(
  concept: Pick<Concept, 'id' | 'name' | 'elements'>,
  entry: TerminologyEntry | undefined,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): readonly string[] {
  const terms = uniqueNonempty([concept.name, concept.id]);
  if (!entry) return terms;
  terms.push(...approvedAliasTerms(entry, 'english-alias', entry.english?.aliases ?? [], sourceCatalog));
  terms.push(...entry.atlas?.meshIds.filter(meshId => concept.elements.includes(meshId) && approvedClaim(entry, 'atlas-identity', meshId, sourceCatalog)) ?? []);
  for (const mapping of entry.mapping.mappings) {
    if (mappingEvidenceApproved(entry, mapping, sourceCatalog)) terms.push(mapping.identifier);
  }
  if (hasVerifiedLatin(entry, sourceCatalog, reviewers)) {
    if (entry.latin?.preferred && approvedClaim(entry, 'canonical-latin', entry.latin.preferred.trim(), sourceCatalog)) terms.push(entry.latin.preferred);
    terms.push(...approvedAliasTerms(entry, 'latin-alias', entry.latin?.aliases ?? [], sourceCatalog));
  }
  if (hasVerifiedVietnamese(entry, sourceCatalog, reviewers)) {
    if (entry.vietnamese?.preferred && approvedClaim(entry, 'vietnamese-preferred', entry.vietnamese.preferred.trim(), sourceCatalog)) terms.push(entry.vietnamese.preferred);
    terms.push(...approvedAliasTerms(entry, 'vietnamese-alias', entry.vietnamese?.aliases ?? [], sourceCatalog));
    terms.push(...approvedAliasTerms(entry, 'vietnamese-search-alias', entry.vietnamese?.searchAliases ?? [], sourceCatalog));
    terms.push(...approvedAliasTerms(entry, 'vietnamese-search-alias', entry.vietnamese?.asciiSearchForms ?? [], sourceCatalog));
  }
  return [...new Set(uniqueNonempty(terms))];
}

export function matchesTerminologyQuery(
  concept: Pick<Concept, 'id' | 'name' | 'elements'>,
  query: string,
  overlay: TerminologyOverlay = TERMINOLOGY_OVERLAY,
  sourceCatalog: TerminologySourceCatalog = TERMINOLOGY_SOURCES,
  reviewers: TerminologyReviewerCatalog = TERMINOLOGY_REVIEWERS,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  return terminologySearchTerms(concept, overlay[concept.id], sourceCatalog, reviewers).some(term =>
    normalizeSearchText(term).includes(normalizedQuery),
  );
}
