import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const PILOT_PATH = join(REPOSITORY_ROOT, 'docs', 'en-vi', 'pilot', 'M03A_PILOT_CONCEPTS.json');
const ATLAS_PATH = join(REPOSITORY_ROOT, 'public', 'models', 'atlas.json');
const ENTRIES_PATH = join(REPOSITORY_ROOT, 'data', 'terminology', 'entries.json');
const RELEASE_PATH = join(REPOSITORY_ROOT, 'data', 'terminology', 'release.json');
const SOURCES_PATH = join(REPOSITORY_ROOT, 'data', 'terminology', 'sources.json');
const REVIEWERS_PATH = join(REPOSITORY_ROOT, 'data', 'terminology', 'reviewers.json');

const EXPECTED_COUNTS = {
  Bone: 6,
  Muscle: 6,
  Tendon: 4,
  Ligament: 4,
  Artery: 5,
  Vein: 4,
  Nerve: 5,
  Organ: 4,
  Gland: 3,
  Joint: 4,
  'Fascia/connective tissue': 5,
};
const ALLOWED_CATEGORIES = new Set(Object.keys(EXPECTED_COUNTS));
const ALLOWED_TAGS = new Set([
  'LEFT_RIGHT', 'ANTERIOR_POSTERIOR', 'SUPERIOR_INFERIOR', 'MEDIAL_LATERAL',
  'PROXIMAL_DISTAL', 'SUPERFICIAL_DEEP', 'COMPOUND_DIRECTIONAL', 'BRANCH_TRUNK',
  'ARTERY_VEIN_DISTINCTION', 'MUSCLE_TENDON_DISTINCTION', 'NERVE_LIGAMENT_DISTINCTION',
  'MULTI_MESH', 'AGGREGATE_CANDIDATE', 'SHARED_MEMBERSHIP_CANDIDATE',
  'ONTOLOGY_GRANULARITY_RISK', 'ONE_TO_MANY_RISK', 'MANY_TO_ONE_RISK',
  'NO_CLEAN_TA2_RISK', 'SOURCE_SPECIFIC_IDENTITY_RISK', 'VIETNAMESE_VARIATION_RISK',
  'SYNONYM_RISK', 'NORMALIZATION_COLLISION_RISK', 'CONTROL_EXACT_MAPPING_CANDIDATE',
]);
const DIRECTION_PATTERNS = {
  LEFT_RIGHT: /\b(left|right)\b/i,
  ANTERIOR_POSTERIOR: /\b(anterior|posterior)\b/i,
  SUPERIOR_INFERIOR: /\b(superior|inferior)\b/i,
  MEDIAL_LATERAL: /\b(medial|lateral)\b/i,
  PROXIMAL_DISTAL: /\b(proximal|distal)\b/i,
  SUPERFICIAL_DEEP: /\b(superficial|deep)\b/i,
};
const CATEGORY_PATTERNS = {
  Bone: /\bbone\b/i,
  Muscle: /\bmuscle\b/i,
  Tendon: /\btendon\b/i,
  Ligament: /\bligament\b/i,
  Artery: /\bartery\b/i,
  Vein: /\bvein\b/i,
  Nerve: /\bnerve\b/i,
  Organ: /\b(spleen|stomach|pancreas|kidney|heart|liver|brain|organ)\b/i,
  Gland: /\bgland\b/i,
  Joint: /\b(symphysis|joint|articular|junction)\b/i,
  'Fascia/connective tissue': /\b(fascia|fascial|connective|tract)\b/i,
};
const CATEGORY_SYSTEM_FALLBACKS = {Muscle: new Set(['muscular'])};
const REQUIRED_RECORD_KEYS = new Set([
  'conceptId', 'atlasName', 'elements', 'elementCount', 'primaryCategory',
  'edgeCaseTags', 'selectionRationale', 'investigationHypotheses', 'control',
]);
const ONTOLOGY_RISK_TAGS = new Set([
  'ONTOLOGY_GRANULARITY_RISK', 'ONE_TO_MANY_RISK', 'MANY_TO_ONE_RISK',
  'NO_CLEAN_TA2_RISK', 'SOURCE_SPECIFIC_IDENTITY_RISK',
]);

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function add(errors, message) { errors.push(message); }
function sameArray(left, right) { return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]); }
function directionTokenCount(name) {
  return Object.values(DIRECTION_PATTERNS).reduce((count, pattern) => count + (pattern.test(name) ? 1 : 0), 0);
}

const [pilot, atlas, entries, release, sources, reviewers] = await Promise.all([
  readFile(PILOT_PATH, 'utf8').then(JSON.parse),
  readFile(ATLAS_PATH, 'utf8').then(JSON.parse),
  readFile(ENTRIES_PATH, 'utf8').then(JSON.parse),
  readFile(RELEASE_PATH, 'utf8').then(JSON.parse),
  readFile(SOURCES_PATH, 'utf8').then(JSON.parse),
  readFile(REVIEWERS_PATH, 'utf8').then(JSON.parse),
]);
const errors = [];

if (!isObject(pilot) || pilot.schemaVersion !== 1) add(errors, 'Pilot file must declare schemaVersion 1');
if (pilot?.milestone !== 'M03A') add(errors, 'Pilot milestone must be M03A');
if (pilot?.sourceCommit !== 'c134f30') add(errors, 'Pilot sourceCommit must be the M02B checkpoint c134f30');
if (pilot?.atlasDataset !== 'public/models/atlas.json') add(errors, 'Pilot atlasDataset must be public/models/atlas.json');
if (!Array.isArray(pilot?.concepts)) add(errors, 'Pilot concepts must be an array');
const records = Array.isArray(pilot?.concepts) ? pilot.concepts : [];
if (records.length !== 50) add(errors, `Pilot must contain exactly 50 concepts; found ${records.length}`);

const concepts = new Map((Array.isArray(atlas?.concepts) ? atlas.concepts : []).map(concept => [concept.id, concept]));
const parts = new Map((Array.isArray(atlas?.parts) ? atlas.parts : []).map(part => [part.id, part]));
const selectedIds = new Set();
const selectedElements = new Map();
const categoryCounts = Object.fromEntries(Object.keys(EXPECTED_COUNTS).map(category => [category, 0]));
const tagCounts = {};
const ontologyRiskIds = new Set();

records.forEach((record, index) => {
  const path = `concepts[${index}]`;
  if (!isObject(record)) { add(errors, `${path} must be an object`); return; }
  for (const key of REQUIRED_RECORD_KEYS) if (!(key in record)) add(errors, `${path}.${key} is required`);
  for (const key of Object.keys(record)) if (!REQUIRED_RECORD_KEYS.has(key)) add(errors, `${path}.${key} is not allowed in the non-production pilot schema`);
  if (typeof record.conceptId !== 'string' || !record.conceptId.trim()) add(errors, `${path}.conceptId must be a non-empty string`);
  if (selectedIds.has(record.conceptId)) add(errors, `${path}.conceptId is duplicated: ${record.conceptId}`);
  selectedIds.add(record.conceptId);
  const concept = concepts.get(record.conceptId);
  if (!concept) { add(errors, `${path}.conceptId is absent from the pinned atlas: ${record.conceptId}`); return; }
  if (record.atlasName !== concept.name) add(errors, `${path}.atlasName does not match the pinned atlas name`);
  if (!Array.isArray(record.elements) || record.elements.some(element => typeof element !== 'string')) add(errors, `${path}.elements must be an array of strings`);
  if (record.elementCount !== record.elements?.length) add(errors, `${path}.elementCount must equal elements.length`);
  if (!sameArray(record.elements, concept.elements)) add(errors, `${path}.elements must exactly snapshot Concept.elements`);
  const seenElements = new Set();
  for (const element of record.elements ?? []) {
    if (seenElements.has(element)) add(errors, `${path}.elements contains a duplicate mesh id: ${element}`);
    seenElements.add(element);
    if (!parts.has(element)) add(errors, `${path}.elements contains an unknown mesh id: ${element}`);
    if (!concept.elements?.includes(element)) add(errors, `${path}.elements is not a member of this Concept.elements set: ${element}`);
  }
  if (!ALLOWED_CATEGORIES.has(record.primaryCategory)) add(errors, `${path}.primaryCategory is invalid`);
  else {
    categoryCounts[record.primaryCategory] += 1;
    const nameJustified = CATEGORY_PATTERNS[record.primaryCategory].test(record.atlasName);
    const systems = (record.elements ?? []).map(element => parts.get(element)?.system).filter(Boolean);
    const systemJustified = CATEGORY_SYSTEM_FALLBACKS[record.primaryCategory]?.size > 0 && systems.some(system => CATEGORY_SYSTEM_FALLBACKS[record.primaryCategory].has(system));
    if (!nameJustified && !systemJustified) add(errors, `${path}.primaryCategory is not justified by the atlas name or available runtime system`);
  }
  if (!Array.isArray(record.edgeCaseTags) || record.edgeCaseTags.some(tag => !ALLOWED_TAGS.has(tag))) add(errors, `${path}.edgeCaseTags contains an unknown tag`);
  const tags = new Set(record.edgeCaseTags ?? []);
  for (const tag of tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  for (const [tag, pattern] of Object.entries(DIRECTION_PATTERNS)) if (tags.has(tag) && !pattern.test(record.atlasName)) add(errors, `${path}.${tag} is not lexically supported by the atlas name`);
  if (tags.has('COMPOUND_DIRECTIONAL') && directionTokenCount(record.atlasName) < 2) add(errors, `${path}.COMPOUND_DIRECTIONAL requires at least two atlas direction tokens`);
  if (tags.has('MULTI_MESH') && record.elementCount <= 1) add(errors, `${path}.MULTI_MESH requires more than one mesh element`);
  if (tags.has('AGGREGATE_CANDIDATE') && record.elementCount <= 1) add(errors, `${path}.AGGREGATE_CANDIDATE requires more than one mesh element`);
  if (record.control !== true && record.control !== false) add(errors, `${path}.control must be boolean`);
  if (record.control !== tags.has('CONTROL_EXACT_MAPPING_CANDIDATE')) add(errors, `${path}.control must agree with CONTROL_EXACT_MAPPING_CANDIDATE`);
  if (typeof record.selectionRationale !== 'string' || !record.selectionRationale.trim()) add(errors, `${path}.selectionRationale is required`);
  if (!Array.isArray(record.investigationHypotheses) || record.investigationHypotheses.some(item => typeof item !== 'string' || !item.trim())) add(errors, `${path}.investigationHypotheses must contain non-empty strings`);
  const forbiddenKeyPattern = /^(?:vietnamese|latin|preferred|aliases?|sourceId|provenance|review|status|release|mapping|claims?|evidence)/i;
  for (const key of Object.keys(record)) if (forbiddenKeyPattern.test(key)) add(errors, `${path} contains a production terminology/review field: ${key}`);
  const recordText = JSON.stringify(record);
  if (/(?:fma|ta2)[^\n]{0,80}(?:verified|confirmed)|(?:verified|confirmed)[^\n]{0,80}(?:fma|ta2)/i.test(recordText)) add(errors, `${path} asserts a verified FMA/TA2 mapping`);
  if (tagsHasOntology(tags)) ontologyRiskIds.add(record.conceptId);
  selectedElements.set(record.conceptId, new Set(record.elements ?? []));
});

function tagsHasOntology(tags) { return [...tags].some(tag => ONTOLOGY_RISK_TAGS.has(tag)); }

for (const [category, expected] of Object.entries(EXPECTED_COUNTS)) if (categoryCounts[category] !== expected) add(errors, `${category} count must be ${expected}; found ${categoryCounts[category]}`);
for (const tag of ['LEFT_RIGHT', 'ANTERIOR_POSTERIOR', 'SUPERIOR_INFERIOR', 'MEDIAL_LATERAL', 'PROXIMAL_DISTAL', 'SUPERFICIAL_DEEP', 'COMPOUND_DIRECTIONAL']) if ((tagCounts[tag] ?? 0) < 1) add(errors, `Directional quota requires at least one ${tag} candidate`);
for (const [tag, minimum] of [['BRANCH_TRUNK', 2], ['ARTERY_VEIN_DISTINCTION', 2], ['MUSCLE_TENDON_DISTINCTION', 2], ['NERVE_LIGAMENT_DISTINCTION', 2], ['MULTI_MESH', 3], ['AGGREGATE_CANDIDATE', 1], ['SHARED_MEMBERSHIP_CANDIDATE', 1], ['VIETNAMESE_VARIATION_RISK', 6], ['SYNONYM_RISK', 2], ['NORMALIZATION_COLLISION_RISK', 2]]) if ((tagCounts[tag] ?? 0) < minimum) add(errors, `${tag} quota requires at least ${minimum}; found ${tagCounts[tag] ?? 0}`);
if (ontologyRiskIds.size < 10) add(errors, `Ontology investigation quota requires 10 distinct concepts; found ${ontologyRiskIds.size}`);
if (records.filter(record => record.control === true).length < 5) add(errors, 'Pilot requires at least five straightforward control concepts');

const sharedMembershipIds = new Set();
for (const [conceptId, elements] of selectedElements) {
  for (const [otherId, otherElements] of selectedElements) {
    if (conceptId === otherId) continue;
    if ([...elements].some(element => otherElements.has(element))) { sharedMembershipIds.add(conceptId); break; }
  }
}
for (const record of records) if (record.edgeCaseTags?.includes('SHARED_MEMBERSHIP_CANDIDATE') && !sharedMembershipIds.has(record.conceptId)) add(errors, `${record.conceptId} claims SHARED_MEMBERSHIP_CANDIDATE without selected-concept element overlap`);

if (!isObject(entries) || !Array.isArray(entries.entries) || entries.entries.length !== 0) add(errors, 'Production terminology entries must remain empty during M03A');
if (!isObject(release) || release.releaseStatus !== 'UNRELEASED') add(errors, 'Production release manifest must remain UNRELEASED during M03A');
if (!isObject(sources) || !Array.isArray(sources.sources) || sources.sources.length !== 0) add(errors, 'Production source catalog must remain empty during M03A');
if (!isObject(reviewers) || !Array.isArray(reviewers.reviewers) || reviewers.reviewers.length !== 0) add(errors, 'Production reviewer registry must remain empty during M03A');

if (errors.length > 0) {
  console.error(`M03A pilot validation failed with ${errors.length} error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('M03A pilot validation passed');
  console.log(`Concepts: ${records.length}; categories: ${Object.entries(categoryCounts).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`Edge tags: ${Object.entries(tagCounts).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`Ontology investigation concepts: ${ontologyRiskIds.size}; shared-membership candidates: ${sharedMembershipIds.size}`);
  console.log('Production entries: 0; sources: 0; reviewers: 0; releaseStatus: UNRELEASED; FMA/TA2 mappings: none asserted');
}
