import {access} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  buildSourceIndex,
  loadSourceCatalogDocument,
  matchAtlasConcepts,
  readCorpusFiles,
  readJson,
  resolvePath,
  writeJson,
} from './m04a-bulk-evidence.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ATLAS = join(ROOT, 'public', 'models', 'atlas.json');
const DEFAULT_SOURCES = join(ROOT, 'data', 'terminology', 'sources.json');
const DEFAULT_ENTRIES = join(ROOT, 'data', 'terminology', 'entries.json');
const DEFAULT_INDEX = join(ROOT, 'data', 'terminology', 'research', 'bulk-source-index.json');
const DEFAULT_CORPORA = [
  join(ROOT, 'data', 'terminology', 'research', 'corpora', 'fipat-ta2-2019.jsonl'),
  join(ROOT, 'data', 'terminology', 'research', 'corpora', 'nvh2008-public-research-seed.jsonl'),
];
const LEGACY_CORPUS = join(ROOT, 'data', 'terminology', 'research', 'bulk-source-corpus.jsonl');
const DEFAULT_RESEARCH_PACK = join(ROOT, 'docs', 'en-vi', 'research', 'M04B2A', 'M04B2_PUBLIC_RESEARCH_PACK.json');
const DEFAULT_OUTPUT = join(ROOT, 'data', 'terminology', 'research', 'bulk-match-results.json');

function parseArgs(argv) {
  const args = {atlas: DEFAULT_ATLAS, sources: DEFAULT_SOURCES, entries: DEFAULT_ENTRIES, index: DEFAULT_INDEX, output: DEFAULT_OUTPUT, corpus: []};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--atlas') args.atlas = argv[++index];
    else if (argument === '--sources') args.sources = argv[++index];
    else if (argument === '--entries') args.entries = argv[++index];
    else if (argument === '--index') args.index = argv[++index];
    else if (argument === '--corpus') args.corpus.push(argv[++index]);
    else if (argument === '--output') args.output = argv[++index];
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
      console.log('Usage: node scripts/bulk-match-terminology.mjs [--index path | --corpus path] [--output path]');
      process.exit(0);
    }
    const atlasPath = resolvePath(ROOT, args.atlas);
    const sourcesPath = resolvePath(ROOT, args.sources);
    const entriesPath = resolvePath(ROOT, args.entries);
    const indexPath = resolvePath(ROOT, args.index);
    const outputPath = resolvePath(ROOT, args.output);
    const [atlas, sourcesDocument, entriesDocument, researchPack] = await Promise.all([
      readJson(atlasPath),
      readJson(sourcesPath),
      exists(entriesPath) ? readJson(entriesPath) : Promise.resolve({entries: []}),
      exists(DEFAULT_RESEARCH_PACK) ? readJson(DEFAULT_RESEARCH_PACK) : Promise.resolve(undefined),
    ]);
    let index;
    if (args.corpus.length) {
      const corpus = await readCorpusFiles(args.corpus.map(path => resolvePath(ROOT, path)));
      index = buildSourceIndex({records: corpus.records, inputFiles: corpus.files, inputFileLabels: args.corpus, sourceCatalogDocument: sourcesDocument});
    } else if (await exists(indexPath)) {
      index = await readJson(indexPath);
    } else {
      const defaultCorpusPaths = (await Promise.all(DEFAULT_CORPORA.map(async path => (await exists(path) ? path : null)))).filter(Boolean);
      const fallbackCorpusPaths = defaultCorpusPaths.length ? defaultCorpusPaths : (await exists(LEGACY_CORPUS) ? [LEGACY_CORPUS] : []);
      const defaultCorpus = fallbackCorpusPaths.length ? await readCorpusFiles(fallbackCorpusPaths) : {records: [], files: []};
      const inputFileLabels = defaultCorpus.files.map(path => relative(ROOT, path).replace(/\\/g, '/'));
      index = buildSourceIndex({records: defaultCorpus.records, inputFiles: defaultCorpus.files, inputFileLabels, sourceCatalogDocument: sourcesDocument});
    }
    const results = matchAtlasConcepts({
      atlas,
      index,
      sourceCatalog: loadSourceCatalogDocument(sourcesDocument),
      m03cEntries: entriesDocument.entries ?? [],
      researchPack,
    });
    await writeJson(outputPath, results);
    console.log('M04A bulk matcher: PASS');
    console.log(`Atlas concepts: ${results.summary.conceptCount}/${results.summary.expectedConceptCount}; source matches: ${results.summary.sourceMatchConceptCount}; normalized collisions: ${results.summary.normalizedCandidateCollisionCount}`);
    console.log(`Buckets: ${Object.entries(results.summary.bucketCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`);
    console.log(`M03C regression mismatches: ${results.regression.mismatchCount}; input gaps: ${results.regression.inputGapCount}`);
    console.log(`Output: ${outputPath}`);
  } catch (error) {
    console.error(`M04A bulk matcher: FAIL\n${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
