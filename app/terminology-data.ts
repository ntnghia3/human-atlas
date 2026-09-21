import entriesDocument from '../data/terminology/entries.json' with {type: 'json'};
import releaseDocument from '../data/terminology/release.json' with {type: 'json'};
import reviewersDocument from '../data/terminology/reviewers.json' with {type: 'json'};
import sourcesDocument from '../data/terminology/sources.json' with {type: 'json'};
import localizationDocument from '../data/terminology/research/m04b2i/localization-catalog.json' with {type: 'json'};
import type {
  TerminologyEntry,
  TerminologyOverlay,
  TerminologyReleaseManifest,
  TerminologyReviewerCatalog,
  TerminologyReviewerRecord,
  TerminologySourceCatalog,
  TerminologySourceRecord,
  TerminologyLocalizationCatalog,
  TerminologyLocalizationRecord,
} from './terminology';

interface SourceRegistryDocument {
  schemaVersion: number;
  sources: unknown[];
}
interface EntryRegistryRecord extends TerminologyEntry {
  key: string;
}
interface EntryRegistryDocument {
  schemaVersion: number;
  entries: unknown[];
}
interface ReviewerRegistryDocument {
  schemaVersion: number;
  reviewers: unknown[];
}
interface LocalizationRegistryDocument {
  records: unknown[];
}

const sourceRecords = (sourcesDocument as SourceRegistryDocument).sources;
const entryRecords = (entriesDocument as EntryRegistryDocument).entries;
const reviewerRecords = (reviewersDocument as ReviewerRegistryDocument).reviewers;
const localizationRecords = (localizationDocument as LocalizationRegistryDocument).records;
const releaseIsActive = (releaseDocument as {releaseStatus?: unknown}).releaseStatus === 'RELEASED';

const sourceCatalog = Object.fromEntries(
  (Array.isArray(sourceRecords) ? sourceRecords : [])
    .filter((source): source is TerminologySourceRecord =>
      Boolean(source && typeof source === 'object' && typeof (source as {id?: unknown}).id === 'string'),
    )
    .map(source => [source.id, source]),
);

const terminologyOverlay = Object.fromEntries(
  (releaseIsActive && Array.isArray(entryRecords) ? entryRecords : [])
    .filter((entry): entry is EntryRegistryRecord =>
      Boolean(
        entry &&
          typeof entry === 'object' &&
          typeof (entry as {key?: unknown}).key === 'string' &&
          (entry as {key?: unknown}).key === (entry as {conceptId?: unknown}).conceptId,
      ),
    )
    .map(entry => [entry.key, entry]),
);

const reviewerCatalog = Object.fromEntries(
  (Array.isArray(reviewerRecords) ? reviewerRecords : [])
    .filter((reviewer): reviewer is TerminologyReviewerRecord =>
      Boolean(reviewer && typeof reviewer === 'object' && typeof (reviewer as {id?: unknown}).id === 'string'),
    )
    .map(reviewer => [reviewer.id, reviewer]),
);

export const PRODUCTION_TERMINOLOGY_SOURCES = Object.freeze(sourceCatalog) as TerminologySourceCatalog;
export const PRODUCTION_TERMINOLOGY_OVERLAY = Object.freeze(terminologyOverlay) as TerminologyOverlay;
export const PRODUCTION_TERMINOLOGY_REVIEWERS = Object.freeze(reviewerCatalog) as TerminologyReviewerCatalog;
export const PRODUCTION_TERMINOLOGY_RELEASE = Object.freeze(releaseDocument) as TerminologyReleaseManifest;
const localizationByConcept = Object.fromEntries(
  (Array.isArray(localizationRecords) ? localizationRecords : [])
    .filter((record): record is TerminologyLocalizationRecord =>
      Boolean(record && typeof record === 'object' && typeof (record as {conceptId?: unknown}).conceptId === 'string'),
    )
    .map(record => [record.conceptId, record]),
);
export const RESEARCH_LOCALIZATION_CATALOG = Object.freeze(localizationByConcept) as TerminologyLocalizationCatalog;
