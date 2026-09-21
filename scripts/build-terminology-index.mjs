import {access} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceIndex,
  readCorpusFiles,
  readJson,
  resolvePath,
  writeJson,
} from './m04a-bulk-evidence.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CORPORA = [
  join(ROOT, 'data', 'terminology', 'research', 'corpora', 'fipat-ta2-2019.jsonl'),
  join(ROOT, 'data', 'terminology', 'research', 'corpora', 'nvh2008-public-research-seed.jsonl'),
];
const LEGACY_CORPUS = join(ROOT, 'data', 'terminology', 'research', 'bulk-source-corpus.jsonl');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'terminology', 'research', 'bulk-source-index.json');
const DEFAULT_SOURCES = join(ROOT, 'data', 'terminology', 'sources.json');

function parseArgs(argv) {
  const args = {corpus: [], output: DEFAULT_OUTPUT, sources: DEFAULT_SOURCES};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--corpus') args.corpus.push(argv[++index]);
    else if (argument === '--output') args.output = argv[++index];
    else if (argument === '--sources') args.sources = argv[++index];
    else if (argument === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return args;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node scripts/build-terminology-index.mjs [--corpus path] [--output path] [--sources path]');
      process.exit(0);
    }
    const defaultCorpusPaths = (await Promise.all(DEFAULT_CORPORA.map(async path => (await exists(path) ? path : null)))).filter(Boolean);
    const corpusPaths = args.corpus.length
      ? args.corpus.map(path => resolvePath(ROOT, path))
      : (defaultCorpusPaths.length ? defaultCorpusPaths : (await exists(LEGACY_CORPUS) ? [LEGACY_CORPUS] : []));
    const sourcesPath = resolvePath(ROOT, args.sources);
    const outputPath = resolvePath(ROOT, args.output);
    const [corpus, sourcesDocument] = await Promise.all([
      readCorpusFiles(corpusPaths),
      exists(sourcesPath) ? readJson(sourcesPath) : Promise.resolve(undefined),
    ]);
    const inputFileLabels = args.corpus.length
      ? args.corpus
      : corpus.files.map(path => relative(ROOT, path).replace(/\\/g, '/'));
    const index = buildSourceIndex({records: corpus.records, inputFiles: corpus.files, inputFileLabels, sourceCatalogDocument: sourcesDocument});
    await writeJson(outputPath, index);
    console.log(`M04A source index: PASS`);
    console.log(`Corpus files: ${corpus.files.length}; input records: ${index.inputRecordCount}; indexed records: ${index.indexedRecordCount}; duplicates: ${index.duplicateEvidenceRecordCount}`);
    console.log(`Output: ${outputPath}`);
    if (index.unresolvedSourceIds.length) console.log(`Unresolved source ids: ${index.unresolvedSourceIds.join(', ')}`);
    if (index.sourceRevisionMismatches.length) console.log(`Source revision mismatches: ${index.sourceRevisionMismatches.join(', ')}`);
  } catch (error) {
    console.error(`M04A source index: FAIL\n${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
