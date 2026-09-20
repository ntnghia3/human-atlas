import entriesDocument from '../data/terminology/entries.json' with {type: 'json'};
import sourcesDocument from '../data/terminology/sources.json' with {type: 'json'};
import type {
  TerminologyEntry,
  TerminologyOverlay,
  TerminologySourceCatalog,
  TerminologySourceRecord,
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

const sourceRecords = (sourcesDocument as SourceRegistryDocument).sources;
const entryRecords = (entriesDocument as EntryRegistryDocument).entries;

const sourceCatalog = Object.fromEntries(
  (Array.isArray(sourceRecords) ? sourceRecords : [])
    .filter((source): source is TerminologySourceRecord =>
      Boolean(source && typeof source === 'object' && typeof (source as {id?: unknown}).id === 'string'),
    )
    .map(source => [source.id, source]),
);

const terminologyOverlay = Object.fromEntries(
  (Array.isArray(entryRecords) ? entryRecords : [])
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

/**
 * The static registry is the only production terminology input. The M02A
 * documents are intentionally empty today, so both maps are empty at runtime.
 */
export const PRODUCTION_TERMINOLOGY_SOURCES = Object.freeze(sourceCatalog) as TerminologySourceCatalog;
export const PRODUCTION_TERMINOLOGY_OVERLAY = Object.freeze(terminologyOverlay) as TerminologyOverlay;
