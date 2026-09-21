import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {readJson} from './m04a-bulk-evidence.mjs';
import {
  MOH_COMPACT_CORPUS_RELATIVE,
  MOH_STAGING_RELATIVE,
  NVH_EXHAUSTIVE_CORPUS_RELATIVE,
  NVH_STAGING_RELATIVE,
  parseMohText,
  parseNvhRenderedLines,
  readLocalAcquisitionInputs,
  toMohCorpusRecords,
  toNvhCorpusRecords,
} from './m04b2e2r-acquisition.mjs';
import {buildM04B2E, writeM04B2EArtifacts} from './m04b2e-bulk-ingestion.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pathFromRoot = relativePath => join(ROOT, ...relativePath.split('/'));

async function writeJsonl(relativePath, records) {
  const absolutePath = pathFromRoot(relativePath);
  await mkdir(dirname(absolutePath), {recursive: true});
  const text = records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
  await writeFile(absolutePath, text, 'utf8');
  return {relativePath, recordCount: records.length, bytes: Buffer.byteLength(text, 'utf8')};
}

async function readJsonlIfPresent(relativePath) {
  try {
    const text = await readFile(pathFromRoot(relativePath), 'utf8');
    return text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readAcquisitionMetadataIfPresent() {
  try {
    return JSON.parse(await readFile(pathFromRoot('.local/terminology-source-cache/m04b2e2r-acquisition-metadata.json'), 'utf8'));
  } catch {
    return null;
  }
}

export async function acquireM04B2E2R() {
  const atlas = await readJson(pathFromRoot('public/models/atlas.json'));
  const local = await readLocalAcquisitionInputs(ROOT);
  const priorNvhRecords = await readJsonlIfPresent(NVH_EXHAUSTIVE_CORPUS_RELATIVE);
  const priorMetadata = await readAcquisitionMetadataIfPresent();
  const priorCompactRowsAudited = priorMetadata?.nvh?.priorCompactRowsAudited ?? priorNvhRecords.length;
  const nvh = parseNvhRenderedLines(local.nvhRenderedLines, atlas, {
    priorCompactRecords: priorNvhRecords,
    priorCompactRowsAudited,
  });
  if (priorMetadata?.nvh?.priorCompactRowsRetainedExactly !== undefined) {
    nvh.stats.priorCompactRowsRetainedExactly = priorMetadata.nvh.priorCompactRowsRetainedExactly;
  }
  nvh.stats.priorCompactRowsQuarantined = Math.max(priorCompactRowsAudited - (nvh.stats.priorCompactRowsRetainedExactly ?? 0), 0);
  const moh = parseMohText(local.mohText, atlas);
  const nvhRecords = toNvhCorpusRecords(nvh.rows);
  const mohRecords = toMohCorpusRecords(moh.matchedRows);

  const nvhArtifact = await writeJsonl(NVH_EXHAUSTIVE_CORPUS_RELATIVE, nvhRecords);
  const mohArtifact = await writeJsonl(MOH_COMPACT_CORPUS_RELATIVE, mohRecords);
  await writeJsonl(NVH_STAGING_RELATIVE, nvh.auditRows);
  await writeJsonl(MOH_STAGING_RELATIVE, moh.rows);
  await writeFile(pathFromRoot('.local/terminology-source-cache/m04b2e2r-acquisition-metadata.json'), `${JSON.stringify({
    schemaVersion: 'm04b2e2r-local-acquisition-metadata-1',
    nvh: nvh.stats,
    moh: {...moh.stats, unmatchedStructuredRows: moh.unmatchedRows.length},
    compactArtifacts: [nvhArtifact, mohArtifact],
  }, null, 2)}\n`, 'utf8');

  const built = await buildM04B2E();
  await writeM04B2EArtifacts(built);
  return {built, nvh, moh, nvhArtifact, mohArtifact};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const acquired = await acquireM04B2E2R();
    console.log('M04B2E-2R exhaustive acquisition: PASS');
    console.log(`NVH2008: pages=${acquired.nvh.stats.renderedPagesRetrieved}; blocks=${acquired.nvh.stats.blocksParsed}; safeRows=${acquired.nvh.rows.length}; compactRows=${acquired.nvhArtifact.recordCount}`);
    console.log(`MOH2025: pages=${acquired.moh.stats.renderedPagesParsed}; blocks=${acquired.moh.stats.blocksParsed}; parsedRows=${acquired.moh.rows.length}; safeRows=${acquired.moh.matchedRows.length}; compactRows=${acquired.mohArtifact.recordCount}`);
    console.log(`Concepts: ${acquired.built.output.conceptAccounting.actualConceptCount}/${acquired.built.output.conceptAccounting.expectedConceptCount}; eligible Vietnamese evidence=${acquired.built.output.globalMetrics.newVietnameseEvidenceConceptCount}`);
    console.log(`Production: searchable=${acquired.built.output.productionSafety.searchableVietnamese}; source-verified=${acquired.built.output.productionSafety.sourceVerified}; medically-reviewed=${acquired.built.output.productionSafety.medicallyReviewed}; release-eligible=${acquired.built.output.productionSafety.releaseEligible}; release=${acquired.built.output.productionSafety.releaseStatus}`);
  } catch (error) {
    console.error(`M04B2E-2R exhaustive acquisition: FAIL\n${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
