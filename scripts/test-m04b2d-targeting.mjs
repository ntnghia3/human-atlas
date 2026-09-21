import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {access, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_COMMIT = '5e0b1f9855b94c1f41d28b50383e67dcfb420a65';
const EXPECTED_CONCEPT_COUNT = 3432;
const PLAN_PATH = join(ROOT, 'data', 'terminology', 'research', 'm04b2d-targets.json');
const REPORT_PATH = join(ROOT, 'docs', 'en-vi', 'M04B2D_COVERAGE_TARGETING_REPORT.md');

const INPUT_PATHS = {
  atlas: join(ROOT, 'public', 'models', 'atlas.json'),
  matchResults: join(ROOT, 'data', 'terminology', 'research', 'bulk-match-results.json'),
  sourceIndex: join(ROOT, 'data', 'terminology', 'research', 'bulk-source-index.json'),
  sourceCatalog: join(ROOT, 'data', 'terminology', 'sources.json'),
  entries: join(ROOT, 'data', 'terminology', 'entries.json'),
  reviewers: join(ROOT, 'data', 'terminology', 'reviewers.json'),
  release: join(ROOT, 'data', 'terminology', 'release.json'),
  m03cMatrix: join(ROOT, 'docs', 'en-vi', 'research', 'M03C_RESEARCH_EVIDENCE_MATRIX.json'),
  m04b2cReport: join(ROOT, 'docs', 'en-vi', 'M04B2C_AUTHORITY_FIRST_EVIDENCE_REPORT.md'),
};

const CLASS_NAMES = [
  'CLEAN_SIMPLE_TARGET',
  'LATERALITY_TARGET',
  'AGGREGATE_OR_COMPOSITE_TARGET',
  'ONTOLOGY_SCOPE_TARGET',
  'IDENTITY_TARGET',
  'EXISTING_EVIDENCE',
  'EXISTING_CONFLICT_OR_VARIANT',
];

const QA_DISPOSITIONS = [
  'CONFIRMED_DIRECT_HARVEST_TARGET',
  'CLEAN_BUT_SCOPE_QA_REQUIRED',
  'RECLASSIFY_AGGREGATE_OR_COMPOSITE',
  'RECLASSIFY_ONTOLOGY_SCOPE',
  'RECLASSIFY_IDENTITY',
];

const POST_QA_CLASS_NAMES = [
  'CONFIRMED_DIRECT_HARVEST_TARGET',
  'CLEAN_BUT_SCOPE_QA_REQUIRED',
  'LATERALITY_TARGET',
  'AGGREGATE_OR_COMPOSITE_TARGET',
  'ONTOLOGY_SCOPE_TARGET',
  'IDENTITY_TARGET',
  'EXISTING_EVIDENCE',
  'EXISTING_CONFLICT_OR_VARIANT',
];

const FIRST_HARVEST_BATCH_CONCEPT_IDS = [
  'FMA55135',
  'FMA55138',
  'FMA55227',
  'FMA55230',
  'FMA55233',
];

const EXPECTED_CLASS_COUNTS = {
  CLEAN_SIMPLE_TARGET: 317,
  LATERALITY_TARGET: 1207,
  AGGREGATE_OR_COMPOSITE_TARGET: 1273,
  ONTOLOGY_SCOPE_TARGET: 573,
  IDENTITY_TARGET: 14,
  EXISTING_EVIDENCE: 16,
  EXISTING_CONFLICT_OR_VARIANT: 32,
};

const PRODUCTION_PATHS = [
  'data/terminology/entries.json',
  'data/terminology/reviewers.json',
  'data/terminology/release.json',
];

function stableCanonical(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableCanonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableCanonical(value[key])).join(',') + '}';
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function fileDigest(path) {
  return sha256(await readText(path));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function words(value) {
  return new Set(String(value ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean));
}

function hasWord(value, ...needles) {
  const tokenSet = words(value);
  return needles.some(needle => tokenSet.has(needle));
}

function hasEligibleVietnameseEvidence(result) {
  return (result.vietnameseCandidateEvidence ?? []).filter(evidence => evidence.sourceProfile?.researchEligibleVietnamese === true);
}

function hasExplicitLateralityCue(result) {
  return hasWord(result.atlasName, 'left', 'right', 'bilateral')
    || result.researchBucket === 'LATERALITY_REVIEW'
    || (result.detectedQualifiers ?? []).some(value => value.startsWith('laterality:'));
}

function hasIdentityNameCue(result) {
  const name = result.atlasName.toLowerCase();
  return /^(?:variant|atypical)\b/.test(name)
    || /^anatomical (?:boundary entity|cavity|line|lobe|conduit space)$/.test(name)
    || name === 'cardinal tissue part'
    || /^portion of (?:tissue|connective tissue)$/.test(name);
}

function hasAggregateNameCue(result) {
  const name = result.atlasName.toLowerCase();
  return /\b(?:aggregate|group|family|system|zone|compartment|tree|collective|set|segment|branch|trunk|anastomosis|plexus|complex|cluster|network)\b/.test(name)
    || /^content of\b/.test(name)
    || /^musculature of\b/.test(name)
    || name === 'heterogeneous cluster'
    || name === 'major salivary gland'
    || name === 'organ part cluster'
    || name === 'organ component cluster';
}

function hasOntologyNameCue(result) {
  const name = result.atlasName.toLowerCase();
  return /^(?:anatomical|cardinal)\b/.test(name)
    || /\b(?:subdivision|region|component|cavity|space|wall|layer|skeleton|parenchyma|portion|tissue)\b/.test(name)
    || /\bpart of\b/.test(name)
    || name === 'body of organ'
    || name === 'organ chamber'
    || name === 'organ cavity subdivision';
}

function isConflictOrVariant(result) {
  return ['CONFLICT_REQUIRES_ADJUDICATION', 'VARIANT_REVIEW'].includes(result.researchBucket)
    || ['CONFLICT', 'SURFACE_VARIANT_REVIEW'].includes(result.candidateConsensus?.status);
}

function isAggregateTarget(result, eligibleEvidenceCount) {
  const aggregateSemanticFlag = (result.semanticFlags ?? []).some(flag => flag.code === 'AGGREGATE_SCOPE_MISMATCH');
  return result.researchBucket === 'AGGREGATE_OR_COMPOSITE_REVIEW'
    || result.meshHeuristics?.aggregateOrComposite === true
    || (aggregateSemanticFlag && eligibleEvidenceCount === 0)
    || hasAggregateNameCue(result);
}

function isOntologyTarget(result, explicitLateralityCue) {
  return result.researchBucket === 'ONTOLOGY_SCOPE_REVIEW'
    || (result.meshHeuristics?.ontologyRisk === true && !explicitLateralityCue)
    || hasOntologyNameCue(result);
}

function classifyResult(result) {
  const eligibleEvidenceCount = hasEligibleVietnameseEvidence(result).length;
  const explicitLateralityCue = hasExplicitLateralityCue(result);
  let targetClass;
  let classificationReason;
  let recommendedNextAction;

  if (isConflictOrVariant(result)) {
    targetClass = 'EXISTING_CONFLICT_OR_VARIANT';
    classificationReason = 'The current deterministic research bucket is a conflict or variant review state and must be preserved.';
    recommendedNextAction = 'adjudication_or_variant_review_before_harvesting';
  } else if (result.researchBucket === 'HIGH_CONSENSUS_CANDIDATE') {
    targetClass = 'EXISTING_EVIDENCE';
    classificationReason = 'The current deterministic high-consensus bucket has eligible authority evidence but remains research-only.';
    recommendedNextAction = 'retain_research_only_and_do_not_promote';
  } else if (result.researchBucket === 'IDENTITY_GAP' || hasIdentityNameCue(result)) {
    targetClass = 'IDENTITY_TARGET';
    classificationReason = 'The atlas label or current bucket does not establish a sufficiently specific external identity for direct harvesting.';
    recommendedNextAction = 'pin_external_identity_before_harvesting';
  } else if (isAggregateTarget(result, eligibleEvidenceCount)) {
    targetClass = 'AGGREGATE_OR_COMPOSITE_TARGET';
    classificationReason = 'An aggregate/composite mesh, scope flag, or atlas-name cue prevents treating this as a simple single-structure harvest.';
    recommendedNextAction = 'keep_separate_from_simple_harvesting';
  } else if (isOntologyTarget(result, explicitLateralityCue)) {
    targetClass = 'ONTOLOGY_SCOPE_TARGET';
    classificationReason = 'Atlas membership or a generic scope signal requires atlas/FMA/TA2 correspondence review before harvesting.';
    recommendedNextAction = 'resolve_atlas_fma_ta2_scope_before_harvesting';
  } else if (explicitLateralityCue) {
    targetClass = 'LATERALITY_TARGET';
    classificationReason = 'A side or laterality review signal is present; an exact side-specific form must not be synthesized.';
    recommendedNextAction = 'research_base_entity_before_side_specific_harvesting';
  } else {
    targetClass = 'CLEAN_SIMPLE_TARGET';
    classificationReason = 'SOURCE_GAP with an unsided English atlas identity and no current conflict, aggregate, ontology, identity, laterality, or eligible-evidence blocker.';
    recommendedNextAction = 'harvest_authority_source_by_family';
  }

  return {
    targetClass,
    classificationReason,
    recommendedNextAction,
    eligibleEvidenceCount,
    explicitLateralityCue,
  };
}

function familyFor(result) {
  const name = result.atlasName.toLowerCase();
  const categorySignals = new Set((result.detectedQualifiers ?? [])
    .filter(value => value.startsWith('category:'))
    .map(value => value.slice('category:'.length)));

  if (categorySignals.has('artery') || /\b(?:artery|arterial)\b/.test(name)) return 'arteries';
  if (categorySignals.has('vein') || /\b(?:vein|venous)\b/.test(name)) return 'veins';
  if (categorySignals.has('tendon') || categorySignals.has('ligament') || /\b(?:tendon|ligament)\b/.test(name)) return 'tendons_ligaments';
  if (categorySignals.has('muscle') || /\bmuscle\b/.test(name) || /\b(?:anconeus|brachialis|brachioradialis|coccygeus|coracobrachialis|digastric|gemellus|genioglossus|geniohyoid|gluteus|gracilis|iliacus|iliococcygeus|iliocostalis|infraspinatus|intercostal|interspinalis|intertransversarius|longissimus|longus|obliquus|obturator|omohyoid|opponens|palatopharyngeus|palmaris|pectineus|pectoralis|piriformis|plantaris|popliteus|pubococcygeus|puborectalis|quadratus|rectus|rhomboid|rotator|sartorius|scalene|semimembranosus|semispinalis|semitendinosus|serratus|soleus|spinalis|splenius|sternocleidomastoid|sternohyoid|stylohyoid|subclavius|supraspinatus|temporalis|teres|thenar|thyro|tibialis|trapezius|transversus|vastus|vocalis)\b/.test(name)) return 'muscles';
  if (/\b(?:joint|symphysis|articulation|disk|disc|suture|junction)\b/.test(name)) return 'joints_symphyses_discs';
  if (/\b(?:bone|femur|tibia|fibula|talus|vomer|manubrium|rib|vertebra|phalanx|metacarp|metatars|carpal|tarsal|scaphoid|lunate|hamate|pisiform|triquetral|capitate|cuboid|cuneiform|sacrum|coccyx|mandible|maxilla|jaw|sternum|clavicle|scapula|patella|hyoid|sphenoid|ethmoid)\b/.test(name)) return 'bones';
  if (/\bnerve\b|\b(?:ganglion|gyrus|brain|cerebral|neuraxis|diencephalon|telencephalon|cortex|ventricle|fornix|commissure|nucleus|midbrain|hindbrain|white matter|gray matter|choroid plexus)\b/.test(name)) return 'nerves_neuroanatomy';
  if (/\b(?:gland|pituitary|thyroid|thymus|suprarenal|adrenal|lacrimal)\b/.test(name)) return 'glands';
  if (/\b(?:cartilage|cartilaginous)\b/.test(name)) return 'cartilage';
  if (/\b(?:fascia|connective|membrane|peritoneum|mesentery)\b/.test(name)) return 'fascia_connective_tissue';
  if (/\b(?:tooth|incisor|molar|premolar|canine)\b/.test(name)) return 'teeth';
  if (/\b(?:skin|hair|eyebrow|lip|gingiva|integument)\b/.test(name)) return 'integument';
  if (/\b(?:duct|canal|conduit)\b/.test(name)) return 'ducts_conduits';
  if (/\b(?:kidney|liver|spleen|pancreas|stomach|gallbladder|heart|lung|prostate|testis|ovary|uterus|bladder|eye|ear|nose|retina|choroid|cornea|iris|sclera|lens|perineum|intestin|jejunum|ileum|colon|duodenum|esoph|rectum|bronch|trachea|larynx|pharynx|epiglott|arytenoid)\b/.test(name)) return 'organs';
  return 'other';
}

function qaResult(disposition, ruleId, reason) {
  const postQaTargetClass = {
    CONFIRMED_DIRECT_HARVEST_TARGET: 'CONFIRMED_DIRECT_HARVEST_TARGET',
    CLEAN_BUT_SCOPE_QA_REQUIRED: 'CLEAN_BUT_SCOPE_QA_REQUIRED',
    RECLASSIFY_AGGREGATE_OR_COMPOSITE: 'AGGREGATE_OR_COMPOSITE_TARGET',
    RECLASSIFY_ONTOLOGY_SCOPE: 'ONTOLOGY_SCOPE_TARGET',
    RECLASSIFY_IDENTITY: 'IDENTITY_TARGET',
  }[disposition];
  return {disposition, postQaTargetClass, ruleId, reason};
}

function classifyCleanQa(result, record) {
  const name = result.atlasName.toLowerCase();
  const mesh = result.meshHeuristics ?? {};
  const family = record.category;

  if (
    name === 'ganglion'
    || name === 'cuneiform bone'
    || name === 'upper jaw'
    || name === 'lower jaw'
    || name === 'interosseous of foot'
    || name === 'cavernous organ'
    || name === 'corticomedullary organ'
    || name === 'process of organ'
    || name === 'decussation'
  ) {
    return qaResult(
      'RECLASSIFY_IDENTITY',
      'QA_GENERIC_IDENTITY_NOT_PINNED',
      'The English label is a broad or placeholder identity and does not safely establish one external entity.',
    );
  }

  if (
    /^(?:muscle|perineal|pectoral|intercostal|rotator|thoracic rotator|thenar|hypothenar|constrictor|intrinsic|extrinsic|superficial|intermediate postvertebral) muscle\b/.test(name)
    || /^(?:muscle of|musculature of)\b/.test(name)
    || /^(?:ligament of|nonskeletal ligament$)/.test(name)
    || /^(?:intrinsic|extrinsic) ligament of\b/.test(name)
    || /^(?:tarsal ligament|plantar tarsal ligament)$/.test(name)
    || /^tributary of\b/.test(name)
    || /^(?:cerebral white matter|white matter of|gray matter of|nucleus of|basal ganglion of|lobe of|lobule of)\b/.test(name)
    || /^(?:autonomic ganglion|cranial parasympathetic ganglion)$/.test(name)
    || /^(?:leaf of cardiac valve|cusp of cardiac valve)$/.test(name)
    || /^(?:lower urinary tract|upper gastrointestinal tract)$/.test(name)
    || /^circumventricular organ of\b/.test(name)
    || /^(?:skin|integument|skin appendage|hair|hair of head|pubic hair)$/.test(name)
    || /^(?:floating rib|nasal cartilage|chamber of eyeball)$/.test(name)
    || /^plantar interosseous of foot$/.test(name)
    || name === 'lingular vein'
    || name === 'cuneiform bone'
    || name === 'serratus posterior'
    || name === 'gemellus'
    || /^(?:semispinalis|iliocostalis|longissimus|spinalis|splenius)$/.test(name)
    || /(?:suboccipital muscle|intercostal muscle|\binterspinalis\b|\bintertransversarius\b|obturator muscle|scalene muscle)/.test(name)
    || /^thoracic rotator$/.test(name)
  ) {
    return qaResult(
      'RECLASSIFY_AGGREGATE_OR_COMPOSITE',
      'QA_GENERIC_GROUP_OR_FAMILY_ENTITY',
      'The label denotes a family, group, class, tissue field, role-based vessel set, or other non-discrete aggregate rather than a single harvest target.',
    );
  }

  if (
    /^(?:external ear|internal nose|root of nose|dorsum of nose|septum of internal nose|perineum)$/.test(name)
    || /^(?:anterior|posterior) mediastinum$/.test(name)
    || /^(?:tarsal plate of eyelid|gingiva of upper jaw|gingiva of lower jaw|lip)$/.test(name)
    || name === 'eyebrow'
    || /^(?:peritoneum|visceral peritoneum|peritoneal mesentery|peritoneal sac)$/.test(name)
    || /^(?:lamina|stria|commissure|peduncle|brachium|fornix|septum|capsule) of\b/.test(name)
    || /^(?:hindbrain|metencephalon|midbrain tectum|third ventricle)$/.test(name)
    || name === 'orbital gyrus'
  ) {
    return qaResult(
      'RECLASSIFY_ONTOLOGY_SCOPE',
      'QA_GENERIC_SCOPE_OR_LEVEL_ENTITY',
      'The label identifies a region, part, compartment, layer, or neuroanatomical level whose exact atlas/FMA/TA2 scope is not established by the English string alone.',
    );
  }

  if (
    /^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (?:cervical|thoracic|lumbar) vertebra$/.test(name)
    || /^intervertebral (?:disk|symphysis) of\b/.test(name)
    || /^(?:third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|first|second) (?:cervical|thoracic|lumbar) intervertebral symphysis$/.test(name)
    || /^intervertebral disk of\b/.test(name)
    || /^phalanx of\b/.test(name)
    || /^(?:upper|lower) secondary (?:canine|incisor|molar|premolar) tooth$/.test(name)
    || /^secondary (?:canine|incisor|molar|premolar) tooth$/.test(name)
    || /\bsegmental\b/.test(name)
    || /\bdigital\b/.test(name)
    || /^head of\b/.test(name)
    || /\b(?:leaflet|cusp) of (?:mitral|tricuspid|aortic|pulmonary) valve\b/.test(name)
    || /^fibrous ring of\b/.test(name)
    || /\b(?:artery|vein)\b/.test(name) && /\b(?:genicular|metatarsal|metacarpal|lingular|lobar|lumbar|mesenteric|ileal|sigmoid|pancreatic|pancreaticoduodenal|bronchial|esophageal|temporal|perforating|collateral|recurrent|hepatic|renal|phrenic|portal|cardiac|caudal|marginal|cerebellar|plantar|palmar|central)\b/.test(name)
    || /^artery of\b/.test(name)
    || /\b(?:artery|vein) of\b/.test(name)
    || /^extrahepatic bile duct$/.test(name)
    || /^ileocecal junction$/.test(name)
    || /^interosseous membrane$/.test(name)
    || /^(?:mesentery of small intestine|mesentery of large intestine|transverse mesocolon)$/.test(name)
    || /^(?:taenia coli|taenia mesocolica|taenia omentalis|taenia libera)$/.test(name)
    || name === 'subarachnoid incisure'
  ) {
    return qaResult(
      'CLEAN_BUT_SCOPE_QA_REQUIRED',
      'QA_REPEATED_OR_RELATIONAL_FAMILY',
      'The label is potentially discrete, but it belongs to a repeated level, digit, vessel-role, valve-substructure, muscle-head, or named-subpart family requiring per-concept identity and scope verification.',
    );
  }

  if (family === 'tendons_ligaments' && [
    'thyrohyoid ligament',
    'median thyrohyoid ligament',
    'hyo-epiglottic ligament',
    'thyro-epiglottic ligament',
    'cricothyroid ligament',
  ].includes(name)) {
    return qaResult(
      'CONFIRMED_DIRECT_HARVEST_TARGET',
      'QA_EXPLICIT_NAMED_LIGAMENT',
      'Explicit named, unsided ligament with no generic family or side-composition cue.',
    );
  }

  if ([
    'pituitary gland',
    'thymus',
    'short ciliary nerve',
    'central canal of spinal cord',
    'mesoappendix',
    'glans penis',
    'corpus spongiosum of penis',
    'corpus cavernosum of penis',
    'mons pubis',
    'pineal body',
    'uvula',
    'fibrous ring of mitral valve',
    'transverse arytenoid',
    'infraspinatus',
    'uvular muscle',
    'caudate lobe of liver',
    'deep palmar arterial arch',
    'brachial vein',
    'deep dorsal vein of penis',
  ].includes(name)) {
    return qaResult(
      'CONFIRMED_DIRECT_HARVEST_TARGET',
      'QA_EXPLICIT_NAMED_STRUCTURE',
      'Explicit named, unsided structure with no detected generic, aggregate, laterality, or unresolved scope cue.',
    );
  }

  if (mesh.meshCount >= 8 || mesh.aggregateOrComposite || mesh.ontologyRisk) {
    return qaResult(
      'CLEAN_BUT_SCOPE_QA_REQUIRED',
      'QA_RESIDUAL_MESH_SCOPE_SIGNAL',
      'The English label is not itself generic, but current mesh/relationship signals warrant per-concept scope checking before harvesting.',
    );
  }

  return qaResult(
    'CONFIRMED_DIRECT_HARVEST_TARGET',
    'QA_REMAINING_DISCRETE_ENTITY',
    'Remaining unsided label is treated as a discrete named entity after the explicit scope and identity exclusions.',
  );
}

function compactLocator(locator) {
  const compact = {};
  for (const key of ['page', 'plate', 'entryId', 'nomenclatureId', 'table']) {
    if (locator?.[key] !== undefined) compact[key] = locator[key];
  }
  return compact;
}

function compactEvidence(reference, matchType) {
  const value = {
    evidenceId: reference.evidenceId,
    sourceId: reference.sourceId,
    sourceRevision: reference.sourceRevision,
    matchType,
    matchReasons: [...(reference.matchReasons ?? [])].sort(),
    locator: compactLocator(reference.locator),
  };
  if (reference.english?.preferred) value.englishPreferred = reference.english.preferred;
  if (Array.isArray(reference.english?.aliases)) value.englishAliases = [...reference.english.aliases].sort();
  if (reference.latin?.preferred) value.latinPreferred = reference.latin.preferred;
  if (Array.isArray(reference.latin?.aliases)) value.latinAliases = [...reference.latin.aliases].sort();
  return value;
}

function compactEvidenceList(references, type) {
  const byEvidenceId = new Map();
  for (const reference of references ?? []) {
    if (!reference.english && type === 'english') continue;
    if (!reference.latin && type === 'latin') continue;
    const matchType = type === 'latin'
      ? 'latinPreferred'
      : (reference.matchReasons ?? []).includes('exactEnglish') ? 'exactEnglish' : 'normalizedEnglish';
    const compact = compactEvidence(reference, matchType);
    const existing = byEvidenceId.get(compact.evidenceId);
    if (!existing || (existing.matchType !== 'exactEnglish' && compact.matchType === 'exactEnglish')) {
      byEvidenceId.set(compact.evidenceId, compact);
    }
  }
  return [...byEvidenceId.values()].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sourceCoverageForRecord(record) {
  return record.matchedEnglishSourceEvidence.length > 0 || record.matchedLatinSourceEvidence.length > 0;
}

function buildFamilyBatches(cleanRecords) {
  const byFamily = new Map();
  for (const record of cleanRecords) {
    if (!byFamily.has(record.category)) byFamily.set(record.category, []);
    byFamily.get(record.category).push(record);
  }
  const batches = [...byFamily.entries()].map(([family, records]) => {
    const meshCounts = records.map(record => record.meshCount);
    const sourceCovered = records.filter(sourceCoverageForRecord).length;
    const count = records.length;
    return {
      family,
      cleanTargetCount: count,
      sizeBand: count >= 50 ? 'LARGE' : count >= 20 ? 'MEDIUM' : 'SMALL',
      cleanliness: {
        cleanTargetRate: 1,
        sourceEvidenceCoverageCount: sourceCovered,
        sourceEvidenceCoverageRate: Number((sourceCovered / count).toFixed(4)),
        zeroEligibleVietnameseEvidenceCount: count,
      },
      meshCount: {
        total: meshCounts.reduce((sum, value) => sum + value, 0),
        minimum: Math.min(...meshCounts),
        maximum: Math.max(...meshCounts),
        median: median(meshCounts),
      },
      conceptIds: records.map(record => record.conceptId).sort(),
    };
  });
  return batches.sort((left, right) => right.cleanTargetCount - left.cleanTargetCount || left.family.localeCompare(right.family))
    .map((batch, index) => ({batchId: 'M04B2D-0-' + String(index + 1).padStart(2, '0'), ...batch}));
}

function buildQaFamilyBatches(records, disposition) {
  const byFamily = new Map();
  for (const record of records.filter(record => record.cleanTargetQa?.disposition === disposition)) {
    if (!byFamily.has(record.category)) byFamily.set(record.category, []);
    byFamily.get(record.category).push(record);
  }
  const batches = [...byFamily.entries()].map(([family, familyRecords]) => {
    const meshCounts = familyRecords.map(record => record.meshCount);
    const sourceCovered = familyRecords.filter(sourceCoverageForRecord).length;
    const count = familyRecords.length;
    return {
      family,
      disposition,
      targetCount: count,
      sizeBand: count >= 50 ? 'LARGE' : count >= 20 ? 'MEDIUM' : 'SMALL',
      sourceEvidenceCoverageCount: sourceCovered,
      sourceEvidenceCoverageRate: Number((sourceCovered / count).toFixed(4)),
      meshCount: {
        total: meshCounts.reduce((sum, value) => sum + value, 0),
        minimum: Math.min(...meshCounts),
        maximum: Math.max(...meshCounts),
        median: median(meshCounts),
      },
      conceptIds: familyRecords.map(record => record.conceptId).sort(),
    };
  });
  const prefix = disposition === 'CONFIRMED_DIRECT_HARVEST_TARGET' ? 'M04B2D-0.1-DIRECT-' : 'M04B2D-0.1-SCOPE-';
  return batches.sort((left, right) => right.targetCount - left.targetCount || left.family.localeCompare(right.family))
    .map((batch, index) => ({batchId: prefix + String(index + 1).padStart(2, '0'), ...batch}));
}

function buildQaFamilyCounts(records) {
  const byFamily = new Map();
  for (const record of records.filter(record => record.originalTargetClass === 'CLEAN_SIMPLE_TARGET')) {
    if (!byFamily.has(record.category)) {
      byFamily.set(record.category, {
        family: record.category,
        originalCleanCount: 0,
        confirmedDirectCount: 0,
        scopeQaCount: 0,
        aggregateReclassCount: 0,
        ontologyReclassCount: 0,
        identityReclassCount: 0,
      });
    }
    const family = byFamily.get(record.category);
    family.originalCleanCount += 1;
    if (record.cleanTargetQa.disposition === 'CONFIRMED_DIRECT_HARVEST_TARGET') family.confirmedDirectCount += 1;
    if (record.cleanTargetQa.disposition === 'CLEAN_BUT_SCOPE_QA_REQUIRED') family.scopeQaCount += 1;
    if (record.cleanTargetQa.disposition === 'RECLASSIFY_AGGREGATE_OR_COMPOSITE') family.aggregateReclassCount += 1;
    if (record.cleanTargetQa.disposition === 'RECLASSIFY_ONTOLOGY_SCOPE') family.ontologyReclassCount += 1;
    if (record.cleanTargetQa.disposition === 'RECLASSIFY_IDENTITY') family.identityReclassCount += 1;
  }
  return [...byFamily.values()].sort((left, right) => left.family.localeCompare(right.family));
}

function buildFirstHarvestingBatch(records, qaFamilyCounts) {
  const byId = new Map(records.map(record => [record.conceptId, record]));
  const selected = FIRST_HARVEST_BATCH_CONCEPT_IDS.map(conceptId => byId.get(conceptId));
  assert(selected.every(Boolean), 'first harvesting batch contains an unknown concept ID');
  assert(selected.every(record => record.originalTargetClass === 'CLEAN_SIMPLE_TARGET'), 'first harvesting batch contains a non-original-clean concept');
  assert(selected.every(record => record.cleanTargetQa.disposition === 'CONFIRMED_DIRECT_HARVEST_TARGET'), 'first harvesting batch contains a non-confirmed concept');
  assert(new Set(selected.map(record => record.category)).size === 1, 'first harvesting batch must be one family');
  const selectedIds = new Set(FIRST_HARVEST_BATCH_CONCEPT_IDS);
  const directExcluded = records
    .filter(record => record.cleanTargetQa?.disposition === 'CONFIRMED_DIRECT_HARVEST_TARGET' && !selectedIds.has(record.conceptId))
    .map(record => record.conceptId)
    .sort();
  const excludedByQaDisposition = Object.fromEntries(QA_DISPOSITIONS
    .filter(disposition => disposition !== 'CONFIRMED_DIRECT_HARVEST_TARGET')
    .map(disposition => [disposition, records
      .filter(record => record.cleanTargetQa?.disposition === disposition)
      .map(record => record.conceptId)
      .sort()]));
  const excludedByOriginalTargetClass = Object.fromEntries(CLASS_NAMES
    .filter(className => className !== 'CLEAN_SIMPLE_TARGET')
    .map(className => [className, records
      .filter(record => record.originalTargetClass === className)
      .map(record => record.conceptId)
      .sort()]));
  return {
    batchId: 'M04B2D-0.1-FIRST-01-LARYNGEAL-LIGAMENTS',
    family: selected[0].category,
    conceptIds: [...FIRST_HARVEST_BATCH_CONCEPT_IDS],
    rationale: 'A small same-family set of explicit named, unsided laryngeal ligaments with no generic family, laterality, aggregate, or unresolved identity cue. The set is suitable for direct authority-source harvesting after the normal source-specific verification step.',
    directTargetCount: selected.length,
    excludedConceptCount: records.length - selected.length,
    excludedDirectConceptIds: directExcluded,
    excludedByQaDisposition,
    excludedByOriginalTargetClass,
    qaFamilyCountSnapshot: qaFamilyCounts.find(family => family.family === selected[0].category) ?? null,
  };
}

async function buildPlan() {
  const [atlas, matchResults, sourceIndex] = await Promise.all([
    readJson(INPUT_PATHS.atlas),
    readJson(INPUT_PATHS.matchResults),
    readJson(INPUT_PATHS.sourceIndex),
  ]);
  const atlasConcepts = atlas.concepts ?? [];
  const resultConcepts = matchResults.concepts ?? [];
  assert(atlasConcepts.length === EXPECTED_CONCEPT_COUNT, 'atlas concept count must be exactly 3432');
  assert(resultConcepts.length === EXPECTED_CONCEPT_COUNT, 'bulk-match result count must be exactly 3432');

  const resultsById = new Map(resultConcepts.map(result => [result.conceptId, result]));
  assert(resultsById.size === resultConcepts.length, 'bulk-match results must not contain duplicate concept IDs');
  const atlasIds = new Set(atlasConcepts.map(concept => concept.id));
  assert(atlasIds.size === atlasConcepts.length, 'atlas must not contain duplicate concept IDs');
  for (const concept of atlasConcepts) assert(resultsById.has(concept.id), 'missing bulk result for ' + concept.id);

  const records = [];
  for (const concept of atlasConcepts) {
    const result = resultsById.get(concept.id);
    const classification = classifyResult(result);
    const category = familyFor(result);
    const originalTargetClass = classification.targetClass;
    const record = {
      conceptId: concept.id,
      atlasEnglishName: concept.name,
      category,
      targetClass: originalTargetClass,
      originalTargetClass,
      postQaTargetClass: originalTargetClass,
      cleanTargetQa: null,
      meshCount: concept.elements.length,
      classificationReason: classification.classificationReason,
      recommendedNextAction: classification.recommendedNextAction,
      signals: {
        currentResearchBucket: result.researchBucket,
        currentResearchBucketReasons: [...(result.researchBucketReasons ?? [])].sort(),
        m03cPriorBucket: result.m03cRegression?.priorBucket ?? null,
        candidateConsensusStatus: result.candidateConsensus?.status ?? null,
        eligibleVietnameseEvidenceCount: classification.eligibleEvidenceCount,
        explicitLateralityCue: classification.explicitLateralityCue,
        detectedQualifierSignals: [...(result.detectedQualifiers ?? [])].sort(),
        semanticFlagCodes: [...new Set((result.semanticFlags ?? []).map(flag => flag.code))].sort(),
        meshHeuristics: {
          highMeshCount: Boolean(result.meshHeuristics?.highMeshCount),
          aggregateOrComposite: Boolean(result.meshHeuristics?.aggregateOrComposite),
          ontologyRisk: Boolean(result.meshHeuristics?.ontologyRisk),
          sharedMeshCount: result.meshHeuristics?.sharedMeshCount ?? 0,
          unsidedPairedMeshes: Boolean(result.meshHeuristics?.unsidedPairedMeshes),
          sideSpecificOverlap: Boolean(result.meshHeuristics?.sideSpecificOverlap),
        },
      },
    };
    if (originalTargetClass === 'CLEAN_SIMPLE_TARGET') {
      const qa = classifyCleanQa(result, record);
      record.postQaTargetClass = qa.postQaTargetClass;
      record.cleanTargetQa = {
        disposition: qa.disposition,
        postQaTargetClass: qa.postQaTargetClass,
        ruleId: qa.ruleId,
        reason: qa.reason,
        originalTargetClass,
        family: category,
      };
      record.matchedEnglishSourceEvidence = compactEvidenceList([
        ...(result.exactEnglishMatches ?? []),
        ...(result.normalizedEnglishMatches ?? []),
      ], 'english');
      record.matchedLatinSourceEvidence = compactEvidenceList(result.latinMatches ?? [], 'latin');
      record.qualificationReason = 'Single unsided atlas entity with stable English identity and no current review blocker in the deterministic research outputs.';
      record.recommendedAnatomySourceHarvestingFamily = category;
    }
    records.push(record);
  }

  const classCounts = Object.fromEntries(CLASS_NAMES.map(name => [
    name,
    records.filter(record => record.targetClass === name).length,
  ]));
  const qaDispositionCounts = Object.fromEntries(QA_DISPOSITIONS.map(disposition => [
    disposition,
    records.filter(record => record.cleanTargetQa?.disposition === disposition).length,
  ]));
  const postQaClassCounts = Object.fromEntries(POST_QA_CLASS_NAMES.map(className => [
    className,
    records.filter(record => record.postQaTargetClass === className).length,
  ]));
  const cleanRecords = records.filter(record => record.targetClass === 'CLEAN_SIMPLE_TARGET');
  const batches = buildFamilyBatches(cleanRecords);
  const qaFamilyCounts = buildQaFamilyCounts(records);
  const qaDirectFamilyBatches = buildQaFamilyBatches(records, 'CONFIRMED_DIRECT_HARVEST_TARGET');
  const qaScopeFamilyBatches = buildQaFamilyBatches(records, 'CLEAN_BUT_SCOPE_QA_REQUIRED');
  const firstHarvestingBatch = buildFirstHarvestingBatch(records, qaFamilyCounts);
  const eligibleResults = resultConcepts.filter(result => hasEligibleVietnameseEvidence(result).length > 0);
  const evidenceByBucket = {};
  const evidenceByClass = {};
  const recordById = new Map(records.map(record => [record.conceptId, record]));
  for (const result of eligibleResults) {
    const evidenceCount = hasEligibleVietnameseEvidence(result).length;
    evidenceByBucket[result.researchBucket] ??= {conceptCount: 0, evidenceRecordCount: 0};
    evidenceByBucket[result.researchBucket].conceptCount += 1;
    evidenceByBucket[result.researchBucket].evidenceRecordCount += evidenceCount;
    const targetClass = recordById.get(result.conceptId).targetClass;
    evidenceByClass[targetClass] ??= {conceptCount: 0, evidenceRecordCount: 0};
    evidenceByClass[targetClass].conceptCount += 1;
    evidenceByClass[targetClass].evidenceRecordCount += evidenceCount;
  }

  const sourceSummaryKeys = [
    'conceptCount',
    'expectedConceptCount',
    'sourceMatchConceptCount',
    'exactEnglishMatchConceptCount',
    'normalizedEnglishMatchConceptCount',
    'latinMatchConceptCount',
    'noSourceMatchConceptCount',
    'authoritativeVietnameseEvidenceConceptCount',
    'semanticFlaggedConceptCount',
    'aggregateHeuristicConceptCount',
    'normalizedCandidateCollisionCount',
    'regressionMismatchCount',
    'regressionInputGapCount',
  ];
  const sourceSummary = Object.fromEntries(sourceSummaryKeys
    .filter(key => matchResults.summary?.[key] !== undefined)
    .map(key => [key, matchResults.summary[key]]));

  const inputDigests = {};
  for (const [name, path] of Object.entries(INPUT_PATHS)) inputDigests[name] = await fileDigest(path);

  const plan = {
    schemaVersion: 'm04b2d-targeting-0.1',
    milestone: 'M04B2D-0.1',
    status: 'PLANNING_ONLY',
    baseline: {
      branch: 'main',
      commit: BASELINE_COMMIT,
      repository: 'D:/Nghia/human-atlas',
    },
    sourceInputs: {
      atlas: 'public/models/atlas.json',
      bulkMatchResults: 'data/terminology/research/bulk-match-results.json',
      bulkSourceIndex: 'data/terminology/research/bulk-source-index.json',
      sourceCatalog: 'data/terminology/sources.json',
      m03cMatrix: 'docs/en-vi/research/M03C_RESEARCH_EVIDENCE_MATRIX.json',
      m04b2cReport: 'docs/en-vi/M04B2C_AUTHORITY_FIRST_EVIDENCE_REPORT.md',
      sourceIndexRevision: sourceIndex.indexRevision ?? null,
      inputSha256: inputDigests,
    },
    policy: {
      targetClasses: CLASS_NAMES,
      precedence: [
        'EXISTING_CONFLICT_OR_VARIANT',
        'EXISTING_EVIDENCE',
        'IDENTITY_TARGET',
        'AGGREGATE_OR_COMPOSITE_TARGET',
        'ONTOLOGY_SCOPE_TARGET',
        'LATERALITY_TARGET',
        'CLEAN_SIMPLE_TARGET',
      ],
      cleanGuard: [
        'current research bucket is SOURCE_GAP',
        'no eligible Vietnamese authority evidence',
        'no current conflict or variant review state',
        'no aggregate/composite mesh or scope signal',
        'no ontology-risk signal or generic scope cue',
        'no explicit laterality cue',
        'English atlas identity is retained without translation or synthesis',
      ],
      conservativeCleanTargetQa: {
        definition: 'Only a discrete anatomical entity with sufficiently pinned scope may be confirmed for direct authority-source harvesting.',
        originalCleanTargetCount: EXPECTED_CLASS_COUNTS.CLEAN_SIMPLE_TARGET,
        dispositions: QA_DISPOSITIONS,
        genericOrScopeAbsenceIsInsufficient: true,
        directHarvestRequiresExplicitScopeOrDefensibleDiscreteIdentity: true,
      },
      terminologyRule: 'No Vietnamese term, translation, alias, search form, or release value is generated by this artifact.',
    },
    summary: {
      totalConcepts: records.length,
      conceptsAccountedForOnce: records.length,
      classCounts,
      cleanSimpleTargetCount: classCounts.CLEAN_SIMPLE_TARGET,
      originalCleanSimpleTargetCount: classCounts.CLEAN_SIMPLE_TARGET,
      qaDispositionCounts,
      postQaClassCounts,
      confirmedDirectHarvestTargetCount: qaDispositionCounts.CONFIRMED_DIRECT_HARVEST_TARGET,
      cleanButScopeQaRequiredCount: qaDispositionCounts.CLEAN_BUT_SCOPE_QA_REQUIRED,
      cleanReclassificationCounts: {
        aggregateOrComposite: qaDispositionCounts.RECLASSIFY_AGGREGATE_OR_COMPOSITE,
        ontologyScope: qaDispositionCounts.RECLASSIFY_ONTOLOGY_SCOPE,
        identity: qaDispositionCounts.RECLASSIFY_IDENTITY,
      },
      qaFamilyCounts,
      currentVietnameseEvidence: {
        conceptCount: eligibleResults.length,
        evidenceRecordCount: eligibleResults.reduce((sum, result) => sum + hasEligibleVietnameseEvidence(result).length, 0),
        byCurrentResearchBucket: Object.fromEntries(Object.entries(evidenceByBucket).sort(([left], [right]) => left.localeCompare(right))),
        byTargetClass: Object.fromEntries(Object.entries(evidenceByClass).sort(([left], [right]) => left.localeCompare(right))),
      },
      currentDeterministicMatcherSummary: sourceSummary,
      remainingResearchSurface: {
        nonExistingEvidenceConceptCount: records.length - classCounts.EXISTING_EVIDENCE,
        originalCleanSimpleTargetCount: classCounts.CLEAN_SIMPLE_TARGET,
        directCleanSimpleHarvestingCount: qaDispositionCounts.CONFIRMED_DIRECT_HARVEST_TARGET,
        cleanScopeQaCount: qaDispositionCounts.CLEAN_BUT_SCOPE_QA_REQUIRED,
        cleanReclassifiedCount: records.filter(record => record.originalTargetClass === 'CLEAN_SIMPLE_TARGET' && record.postQaTargetClass !== 'CONFIRMED_DIRECT_HARVEST_TARGET' && record.postQaTargetClass !== 'CLEAN_BUT_SCOPE_QA_REQUIRED').length,
        nonCleanResearchOrReviewCount: records.length - classCounts.EXISTING_EVIDENCE - qaDispositionCounts.CONFIRMED_DIRECT_HARVEST_TARGET,
        currentSourceGapBucketCount: matchResults.summary?.bucketCounts?.SOURCE_GAP ?? null,
        currentIdentityGapBucketCount: matchResults.summary?.bucketCounts?.IDENTITY_GAP ?? null,
        currentAggregateReviewBucketCount: matchResults.summary?.bucketCounts?.AGGREGATE_OR_COMPOSITE_REVIEW ?? null,
        currentOntologyReviewBucketCount: matchResults.summary?.bucketCounts?.ONTOLOGY_SCOPE_REVIEW ?? null,
        currentLateralityReviewBucketCount: matchResults.summary?.bucketCounts?.LATERALITY_REVIEW ?? null,
      },
    },
    familyBatches: batches,
    qaDirectFamilyBatches,
    qaScopeFamilyBatches,
    firstHarvestingBatch,
    concepts: records.sort((left, right) => left.conceptId.localeCompare(right.conceptId)),
  };
  plan.planDigest = sha256(stableCanonical(plan));
  return plan;
}

function classTable(plan) {
  const descriptions = {
    CLEAN_SIMPLE_TARGET: 'Unresolved but clean unsided source-harvesting candidate',
    LATERALITY_TARGET: 'Base entity may be researchable; side-specific form is not synthesized',
    AGGREGATE_OR_COMPOSITE_TARGET: 'Group, composite, aggregate, or scope-mismatch case',
    ONTOLOGY_SCOPE_TARGET: 'Atlas/FMA/TA2 correspondence or generic scope needs review',
    IDENTITY_TARGET: 'External identity is insufficiently established',
    EXISTING_EVIDENCE: 'Eligible authority evidence exists; remains research-only',
    EXISTING_CONFLICT_OR_VARIANT: 'Conflict or variant review state already exists',
  };
  return [
    '| Targeting class | Count | Meaning |',
    '| --- | ---: | --- |',
    ...CLASS_NAMES.map(name => '| ' + name + ' | ' + plan.summary.classCounts[name] + ' | ' + descriptions[name] + ' |'),
  ];
}

function familyTable(plan) {
  return [
    '| Batch | Family | Clean targets | Size | English/Latin evidence coverage | Median meshes |',
    '| --- | --- | ---: | --- | ---: | ---: |',
    ...plan.familyBatches.map(batch => '| ' + batch.batchId + ' | ' + batch.family + ' | ' + batch.cleanTargetCount + ' | ' + batch.sizeBand + ' | ' + batch.cleanliness.sourceEvidenceCoverageCount + '/' + batch.cleanTargetCount + ' (' + batch.cleanliness.sourceEvidenceCoverageRate + ') | ' + batch.meshCount.median + ' |'),
  ];
}

function qaDispositionTable(plan) {
  const descriptions = {
    CONFIRMED_DIRECT_HARVEST_TARGET: 'Confirmed discrete and sufficiently scoped for direct authority-source harvesting',
    CLEAN_BUT_SCOPE_QA_REQUIRED: 'Potentially discrete, but repeated, relational, or subpart scope requires per-concept QA first',
    RECLASSIFY_AGGREGATE_OR_COMPOSITE: 'Reclassified as a generic family, group, class, tissue field, or aggregate entity',
    RECLASSIFY_ONTOLOGY_SCOPE: 'Reclassified because exact atlas/FMA/TA2 level or region/part scope is unresolved',
    RECLASSIFY_IDENTITY: 'Reclassified because the English identity is too broad or insufficiently pinned',
  };
  return [
    '| Conservative QA disposition | Count | Meaning |',
    '| --- | ---: | --- |',
    ...QA_DISPOSITIONS.map(disposition => '| ' + disposition + ' | ' + plan.summary.qaDispositionCounts[disposition] + ' | ' + descriptions[disposition] + ' |'),
  ];
}

function qaFamilyTable(plan) {
  return [
    '| Family | Original clean | Confirmed direct | Scope QA | Aggregate reclass | Ontology reclass | Identity reclass |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...plan.summary.qaFamilyCounts.map(row => '| ' + row.family + ' | ' + row.originalCleanCount + ' | ' + row.confirmedDirectCount + ' | ' + row.scopeQaCount + ' | ' + row.aggregateReclassCount + ' | ' + row.ontologyReclassCount + ' | ' + row.identityReclassCount + ' |'),
  ];
}

function idLines(label, ids) {
  if (!ids.length) return ['- ' + label + ': none.'];
  return ['- ' + label + ' (' + ids.length + '):', '', '  `' + ids.join('`, `') + '`'];
}

function renderReport(plan) {
  const summary = plan.summary;
  const current = summary.currentVietnameseEvidence;
  const remaining = summary.remainingResearchSurface;
  const first = plan.firstHarvestingBatch;
  const planById = new Map(plan.concepts.map(record => [record.conceptId, record]));
  const firstRows = first.conceptIds.map(conceptId => {
    const record = planById.get(conceptId);
    return '- `' + conceptId + '` — ' + record.atlasEnglishName + ' (' + record.category + ')';
  });
  const lines = [
    '# M04B2D Coverage Expansion Targeting Report',
    '',
    '## Status and boundary',
    '',
    'M04B2D-0.1 is a conservative refinement of the M04B2D-0 planning/data-analysis milestone. This report does not harvest sources, translate terminology, generate Vietnamese terms, perform medical review, adjudicate conflicts, modify production terminology, make terms searchable, or begin UI work.',
    '',
    'Baseline: branch main, commit ' + plan.baseline.commit + '.',
    '',
    'The plan accounts for exactly **' + summary.totalConcepts + ' atlas concepts once**. No Vietnamese term is asserted by this targeting artifact.',
    '',
    'The original `targetClass` and its M04B2D-0 counts are retained for provenance. The `postQaTargetClass` and `cleanTargetQa` fields add the conservative audit result for the original 317 CLEAN_SIMPLE_TARGET records. Existing non-CLEAN classes are preserved unchanged.',
    '',
    '## Deterministic inputs',
    '',
    '- public/models/atlas.json',
    '- data/terminology/research/bulk-match-results.json',
    '- data/terminology/research/bulk-source-index.json',
    '- data/terminology/sources.json',
    '- docs/en-vi/research/M03C_RESEARCH_EVIDENCE_MATRIX.json',
    '- docs/en-vi/M04B2C_AUTHORITY_FIRST_EVIDENCE_REPORT.md',
    '',
    'The SHA-256 input manifest and the full per-concept plan are in data/terminology/research/m04b2d-targets.json. The plan is research-only and has no generated term fields.',
    '',
    '## Original targeting-class accounting',
    '',
    ...classTable(plan),
    '',
    'Original CLEAN_SIMPLE_TARGET count: **' + summary.originalCleanSimpleTargetCount + '**. The class precedence preserves existing conflict/variant states before any source-harvesting classification.',
    '',
    '## Conservative clean-target QA',
    '',
    'For this refinement, CLEAN_SIMPLE_TARGET is not treated as directly harvestable merely because the earlier blocker checks were absent. A record is confirmed for direct harvesting only when its English label and existing atlas signals support a discrete entity with sufficiently pinned scope. Specialized anatomy is not downgraded by specialization alone; the dispositions below record only a generic, repeated, relational, aggregate, ontology-scope, or identity reason.',
    '',
    ...qaDispositionTable(plan),
    '',
    '- Original CLEAN_SIMPLE_TARGET records: **' + summary.originalCleanSimpleTargetCount + '**.',
    '- Confirmed direct-harvest records after QA: **' + summary.confirmedDirectHarvestTargetCount + '**.',
    '- CLEAN_BUT_SCOPE_QA_REQUIRED records: **' + summary.cleanButScopeQaRequiredCount + '**.',
    '- Reclassified as aggregate/composite: **' + summary.cleanReclassificationCounts.aggregateOrComposite + '**.',
    '- Reclassified as ontology/scope: **' + summary.cleanReclassificationCounts.ontologyScope + '**.',
    '- Reclassified as identity: **' + summary.cleanReclassificationCounts.identity + '**.',
    '',
    'The post-QA class accounting remains exact: ' + POST_QA_CLASS_NAMES.map(name => name + '=' + summary.postQaClassCounts[name]).join(', ') + '.',
    '',
    '## Family-by-family QA accounting',
    '',
    ...qaFamilyTable(plan),
    '',
    'The original M04B2D family batches remain available in `familyBatches`; `qaDirectFamilyBatches` contains only confirmed direct records, and `qaScopeFamilyBatches` contains only records requiring scope QA. Counts are deterministic and do not imply a sourced Vietnamese equivalent.',
    '',
    '## Current Vietnamese-evidence coverage',
    '',
    'The current matcher reports eligible Vietnamese authority evidence for **' + current.conceptCount + ' concepts** across **' + current.evidenceRecordCount + ' evidence records**. This is evidence coverage only; it is not a production terminology claim.',
    '',
    'M04B2D-0.1 leaves this coverage unchanged at 47 concepts and 62 evidence records; the QA pass adds no evidence and generates no terminology.',
    '',
    'The EXISTING_EVIDENCE class contains ' + summary.classCounts.EXISTING_EVIDENCE + ' concepts. Other concepts with evidence remain in their blocking conflict, variant, laterality, identity, or scope class. No evidence was copied into a Vietnamese term field in the target plan.',
    '',
    'Current matcher source surface: ' + (summary.currentDeterministicMatcherSummary.sourceMatchConceptCount ?? 'n/a') + ' concepts with source matches, ' + (summary.currentDeterministicMatcherSummary.latinMatchConceptCount ?? 'n/a') + ' with Latin matches, and ' + (summary.currentDeterministicMatcherSummary.noSourceMatchConceptCount ?? 'n/a') + ' with no source match.',
    '',
    '## Remaining research surface',
    '',
    '- Non-existing-evidence concepts: **' + remaining.nonExistingEvidenceConceptCount + '**.',
    '- Original clean simple targets: **' + remaining.originalCleanSimpleTargetCount + '**.',
    '- Confirmed direct clean harvesting candidates after QA: **' + remaining.directCleanSimpleHarvestingCount + '**.',
    '- Clean candidates requiring scope QA: **' + remaining.cleanScopeQaCount + '**.',
    '- Clean candidates reclassified out of direct harvesting: **' + remaining.cleanReclassifiedCount + '**.',
    '- Other non-clean research/review cases: **' + remaining.nonCleanResearchOrReviewCount + '**.',
    '- The current matcher buckets still contain SOURCE_GAP=' + remaining.currentSourceGapBucketCount + ', IDENTITY_GAP=' + remaining.currentIdentityGapBucketCount + ', AGGREGATE_OR_COMPOSITE_REVIEW=' + remaining.currentAggregateReviewBucketCount + ', ONTOLOGY_SCOPE_REVIEW=' + remaining.currentOntologyReviewBucketCount + ', and LATERALITY_REVIEW=' + remaining.currentLateralityReviewBucketCount + '.',
    '',
    'These figures identify work surfaces; they do not claim that an unsourced Vietnamese equivalent exists.',
    '',
    '## Exact recommended FIRST harvesting batch',
    '',
    'Recommended first batch: **' + first.batchId + '** (' + first.family + ', ' + first.directTargetCount + ' concepts). The batch is intentionally small and same-family:',
    '',
    ...firstRows,
    '',
    first.rationale,
    '',
    'This batch is preferable because all five records are explicit named laryngeal ligaments, unsided, and not generic `ligament of X`, limb-wide, tarsal, tributary, segmental, numbered, or neuroanatomical class labels. It provides a narrow source-family test while preserving per-record source verification. No source has been harvested by this milestone.',
    '',
    '### Direct targets excluded from the FIRST batch',
    '',
    ...idLines('Confirmed direct targets not selected for the first batch', first.excludedDirectConceptIds),
    '',
    ...QA_DISPOSITIONS.filter(disposition => disposition !== 'CONFIRMED_DIRECT_HARVEST_TARGET')
      .flatMap(disposition => idLines(disposition + ' (excluded from first batch)', first.excludedByQaDisposition[disposition])),
    '',
    'All concepts in the original non-CLEAN classes are also excluded from this first batch and remain in their original class queues. Their exact IDs are preserved under `firstHarvestingBatch.excludedByOriginalTargetClass` in the JSON plan.',
    '',
    '### Family batch overview after QA',
    '',
    '| Direct batch | Family | Confirmed direct | Size | English/Latin evidence coverage | Median meshes |',
    '| --- | --- | ---: | --- | ---: | ---: |',
    ...plan.qaDirectFamilyBatches.map(batch => '| ' + batch.batchId + ' | ' + batch.family + ' | ' + batch.targetCount + ' | ' + batch.sizeBand + ' | ' + batch.sourceEvidenceCoverageCount + '/' + batch.targetCount + ' | ' + batch.meshCount.median + ' |'),
    '',
    'English/Latin evidence coverage above means an existing English and/or Latin match is available in the supplied research data; it does not mean Vietnamese evidence exists.',
    '',
    '## Explicit excluded/problem groups',
    '',
    '- EXISTING_CONFLICT_OR_VARIANT (' + summary.classCounts.EXISTING_CONFLICT_OR_VARIANT + '): preserve the current conflict and variant queue; do not harvest as if a preferred form were settled.',
    '- AGGREGATE_OR_COMPOSITE_TARGET (' + summary.classCounts.AGGREGATE_OR_COMPOSITE_TARGET + '): keep multi-structure, aggregate, branch/trunk, scope-mismatch, and aggregate-name cases separate from simple harvesting.',
    '- ONTOLOGY_SCOPE_TARGET (' + summary.classCounts.ONTOLOGY_SCOPE_TARGET + '): resolve atlas/FMA/TA2 granularity or generic scope before treating a source record as an exact identity.',
    '- LATERALITY_TARGET (' + summary.classCounts.LATERALITY_TARGET + '): research the base entity and exact side-specific evidence; never compose right/left forms automatically.',
    '- IDENTITY_TARGET (' + summary.classCounts.IDENTITY_TARGET + '): pin an external identity before source harvesting.',
    '- EXISTING_EVIDENCE (' + summary.classCounts.EXISTING_EVIDENCE + '): retain as research-only evidence; this milestone does not promote or release it.',
    '',
    'The raw integrated M04B2C conflict/variant states remain represented by the plan: current CONFLICT_REQUIRES_ADJUDICATION and VARIANT_REVIEW results are all classified as EXISTING_CONFLICT_OR_VARIANT, and none of them receives a clean-target QA disposition.',
    '',
    '## Safety and STOP condition',
    '',
    'The plan contains English atlas names, deterministic family labels, mesh counts, source IDs/revisions, English/Latin evidence metadata where available, and classification signals. It contains no generated Vietnamese terms, no search aliases, no release entries, and no medical decisions. Production terminology, reviewer, and release files remain unchanged.',
    '',
    '**STOP after M04B2D-0.1. Do not begin source harvesting, M04C UI work, or medical review.**',
    '',
    'Plan digest: ' + plan.planDigest + '.',
    '',
  ];
  return lines.join('\n');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function gitOutput(...args) {
  return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
}

async function assertProductionUnchanged() {
  for (const relativePath of PRODUCTION_PATHS) {
    const current = await readText(join(ROOT, relativePath));
    const baseline = execFileSync('git', ['show', 'HEAD:' + relativePath.replace(/\\/g, '/')], {cwd: ROOT, encoding: 'utf8'});
    assert(sha256(current) === sha256(baseline), relativePath + ' differs from baseline');
  }
  const release = await readJson(INPUT_PATHS.release);
  assert(release.releaseStatus === 'UNRELEASED', 'release state must remain UNRELEASED');
  assert(Object.keys(release.entryRevisions ?? {}).length === 0, 'release entry revisions must remain empty');
}

function walkKeys(value, callback) {
  if (Array.isArray(value)) {
    for (const item of value) walkKeys(item, callback);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    callback(key, child);
    walkKeys(child, callback);
  }
}

async function assertPlan(plan) {
  assert(plan.schemaVersion === 'm04b2d-targeting-0.1', 'plan schema must be M04B2D-0.1');
  assert(plan.milestone === 'M04B2D-0.1', 'plan milestone must be M04B2D-0.1');
  assert(plan.summary.totalConcepts === EXPECTED_CONCEPT_COUNT, 'plan must account for exactly 3432 concepts');
  assert(plan.summary.conceptsAccountedForOnce === EXPECTED_CONCEPT_COUNT, 'plan accounting marker must be exactly 3432');
  assert(plan.concepts.length === EXPECTED_CONCEPT_COUNT, 'plan concept rows must be exactly 3432');
  assert(new Set(plan.concepts.map(record => record.conceptId)).size === EXPECTED_CONCEPT_COUNT, 'plan concept IDs must be unique');
  assert(Object.values(plan.summary.classCounts).reduce((sum, count) => sum + count, 0) === EXPECTED_CONCEPT_COUNT, 'class counts must sum to 3432');
  for (const className of CLASS_NAMES) {
    assert(plan.summary.classCounts[className] === EXPECTED_CLASS_COUNTS[className], className + ' count is not deterministic');
  }
  assert(plan.familyBatches.reduce((sum, batch) => sum + batch.cleanTargetCount, 0) === EXPECTED_CLASS_COUNTS.CLEAN_SIMPLE_TARGET, 'family batches must cover all clean targets');
  assert(plan.summary.originalCleanSimpleTargetCount === EXPECTED_CLASS_COUNTS.CLEAN_SIMPLE_TARGET, 'original clean count must remain 317');
  assert(Object.values(plan.summary.qaDispositionCounts).reduce((sum, count) => sum + count, 0) === EXPECTED_CLASS_COUNTS.CLEAN_SIMPLE_TARGET, 'QA dispositions must cover all original clean targets');
  for (const disposition of QA_DISPOSITIONS) {
    assert(Number.isInteger(plan.summary.qaDispositionCounts[disposition]), disposition + ' count is missing');
  }
  assert(Object.values(plan.summary.postQaClassCounts).reduce((sum, count) => sum + count, 0) === EXPECTED_CONCEPT_COUNT, 'post-QA class counts must sum to 3432');
  assert(plan.summary.postQaClassCounts.CONFIRMED_DIRECT_HARVEST_TARGET === plan.summary.qaDispositionCounts.CONFIRMED_DIRECT_HARVEST_TARGET, 'post-QA direct count mismatch');
  assert(plan.summary.postQaClassCounts.CLEAN_BUT_SCOPE_QA_REQUIRED === plan.summary.qaDispositionCounts.CLEAN_BUT_SCOPE_QA_REQUIRED, 'post-QA scope-QA count mismatch');
  for (const className of CLASS_NAMES.filter(name => name !== 'CLEAN_SIMPLE_TARGET')) {
    assert(plan.summary.postQaClassCounts[className] === plan.summary.classCounts[className] + (
      className === 'AGGREGATE_OR_COMPOSITE_TARGET' ? plan.summary.qaDispositionCounts.RECLASSIFY_AGGREGATE_OR_COMPOSITE
        : className === 'ONTOLOGY_SCOPE_TARGET' ? plan.summary.qaDispositionCounts.RECLASSIFY_ONTOLOGY_SCOPE
          : className === 'IDENTITY_TARGET' ? plan.summary.qaDispositionCounts.RECLASSIFY_IDENTITY
            : 0
    ), className + ' post-QA preservation/count mismatch');
  }
  assert(plan.summary.qaFamilyCounts.reduce((sum, row) => sum + row.originalCleanCount, 0) === EXPECTED_CLASS_COUNTS.CLEAN_SIMPLE_TARGET, 'QA family counts must cover all original clean targets');
  assert(plan.summary.qaFamilyCounts.reduce((sum, row) => sum + row.confirmedDirectCount, 0) === plan.summary.confirmedDirectHarvestTargetCount, 'QA family direct counts mismatch');
  assert(plan.summary.qaFamilyCounts.reduce((sum, row) => sum + row.scopeQaCount, 0) === plan.summary.cleanButScopeQaRequiredCount, 'QA family scope counts mismatch');
  assert(plan.qaDirectFamilyBatches.reduce((sum, batch) => sum + batch.targetCount, 0) === plan.summary.confirmedDirectHarvestTargetCount, 'direct QA family batches mismatch');
  assert(plan.qaScopeFamilyBatches.reduce((sum, batch) => sum + batch.targetCount, 0) === plan.summary.cleanButScopeQaRequiredCount, 'scope QA family batches mismatch');
  assert(JSON.stringify(plan.firstHarvestingBatch.conceptIds) === JSON.stringify(FIRST_HARVEST_BATCH_CONCEPT_IDS), 'first harvesting batch IDs changed');
  assert(plan.firstHarvestingBatch.directTargetCount === FIRST_HARVEST_BATCH_CONCEPT_IDS.length, 'first harvesting batch count mismatch');
  assert(plan.firstHarvestingBatch.excludedConceptCount === EXPECTED_CONCEPT_COUNT - FIRST_HARVEST_BATCH_CONCEPT_IDS.length, 'first harvesting exclusion count mismatch');
  const excludedIds = [
    ...plan.firstHarvestingBatch.excludedDirectConceptIds,
    ...Object.values(plan.firstHarvestingBatch.excludedByQaDisposition).flat(),
    ...Object.values(plan.firstHarvestingBatch.excludedByOriginalTargetClass).flat(),
  ];
  assert(new Set(excludedIds).size === EXPECTED_CONCEPT_COUNT - FIRST_HARVEST_BATCH_CONCEPT_IDS.length, 'first harvesting exclusions must partition all non-selected concepts');
  assert(excludedIds.every(conceptId => !FIRST_HARVEST_BATCH_CONCEPT_IDS.includes(conceptId)), 'first harvesting exclusions contain a selected concept');

  const matchResults = await readJson(INPUT_PATHS.matchResults);
  const resultById = new Map((matchResults.concepts ?? []).map(result => [result.conceptId, result]));
  const planById = new Map(plan.concepts.map(record => [record.conceptId, record]));
  for (const [conceptId, result] of resultById) {
    const record = planById.get(conceptId);
    assert(record, 'plan missing ' + conceptId);
    if (['CONFLICT_REQUIRES_ADJUDICATION', 'VARIANT_REVIEW'].includes(result.researchBucket)) {
      assert(record.targetClass === 'EXISTING_CONFLICT_OR_VARIANT', conceptId + ' conflict/variant state was not preserved');
    }
    assert(record.originalTargetClass === record.targetClass, conceptId + ' original target class was not retained');
    if (record.targetClass === 'CLEAN_SIMPLE_TARGET') {
      assert(result.researchBucket === 'SOURCE_GAP', conceptId + ' clean target must be an unresolved source gap');
      assert(hasEligibleVietnameseEvidence(result).length === 0, conceptId + ' clean target must not have eligible Vietnamese evidence');
      assert(!result.meshHeuristics?.aggregateOrComposite, conceptId + ' clean target has aggregate heuristic');
      assert(!result.meshHeuristics?.ontologyRisk, conceptId + ' clean target has ontology risk');
      assert(!(result.semanticFlags ?? []).some(flag => flag.code === 'AGGREGATE_SCOPE_MISMATCH'), conceptId + ' clean target has aggregate scope flag');
      assert(!hasExplicitLateralityCue(result), conceptId + ' clean target has laterality cue');
      assert(!hasIdentityNameCue(result), conceptId + ' clean target has identity cue');
      assert(!hasAggregateNameCue(result), conceptId + ' clean target has aggregate cue');
      assert(!hasOntologyNameCue(result), conceptId + ' clean target has ontology cue');
      assert(Array.isArray(record.matchedEnglishSourceEvidence), conceptId + ' clean target missing English evidence array');
      assert(Array.isArray(record.matchedLatinSourceEvidence), conceptId + ' clean target missing Latin evidence array');
      assert(record.recommendedAnatomySourceHarvestingFamily === record.category, conceptId + ' clean target family mismatch');
      assert(record.cleanTargetQa && QA_DISPOSITIONS.includes(record.cleanTargetQa.disposition), conceptId + ' clean target missing QA disposition');
      assert(record.cleanTargetQa.originalTargetClass === 'CLEAN_SIMPLE_TARGET', conceptId + ' clean QA original class mismatch');
      assert(record.cleanTargetQa.family === record.category, conceptId + ' clean QA family mismatch');
      assert(record.postQaTargetClass === record.cleanTargetQa.postQaTargetClass, conceptId + ' clean QA post class mismatch');
      assert(record.cleanTargetQa.disposition === 'RECLASSIFY_AGGREGATE_OR_COMPOSITE' ? record.postQaTargetClass === 'AGGREGATE_OR_COMPOSITE_TARGET' : true, conceptId + ' aggregate QA mapping mismatch');
      assert(record.cleanTargetQa.disposition === 'RECLASSIFY_ONTOLOGY_SCOPE' ? record.postQaTargetClass === 'ONTOLOGY_SCOPE_TARGET' : true, conceptId + ' ontology QA mapping mismatch');
      assert(record.cleanTargetQa.disposition === 'RECLASSIFY_IDENTITY' ? record.postQaTargetClass === 'IDENTITY_TARGET' : true, conceptId + ' identity QA mapping mismatch');
      assert(record.cleanTargetQa.disposition === 'CONFIRMED_DIRECT_HARVEST_TARGET' ? record.postQaTargetClass === 'CONFIRMED_DIRECT_HARVEST_TARGET' : true, conceptId + ' direct QA mapping mismatch');
      assert(record.cleanTargetQa.disposition === 'CLEAN_BUT_SCOPE_QA_REQUIRED' ? record.postQaTargetClass === 'CLEAN_BUT_SCOPE_QA_REQUIRED' : true, conceptId + ' scope QA mapping mismatch');
    } else {
      assert(record.cleanTargetQa === null, conceptId + ' non-clean record received a clean-target QA disposition');
      assert(record.postQaTargetClass === record.targetClass, conceptId + ' non-clean target class changed during QA');
    }
  }

  assert(plan.summary.currentVietnameseEvidence.conceptCount === 47, 'current Vietnamese evidence concept count changed');
  assert(plan.summary.currentVietnameseEvidence.evidenceRecordCount === 62, 'current Vietnamese evidence record count changed');

  const forbiddenKeys = new Set([
    'vietnamese',
    'vietnamesePreferred',
    'sourceTermRaw',
    'candidateTerm',
    'candidateTermForReview',
    'suggestedFormForReview',
    'aliasCandidates',
    'searchForms',
    'searchable',
    'releaseEligible',
  ]);
  walkKeys(plan, key => assert(!forbiddenKeys.has(key), 'plan contains forbidden research/production key ' + key));
  const planText = JSON.stringify(plan);
  const reportText = await readText(REPORT_PATH);
  const allText = planText + reportText;
  for (const result of matchResults.concepts ?? []) {
    for (const evidence of result.vietnameseCandidateEvidence ?? []) {
      for (const value of [evidence.vietnamese?.preferred, ...(evidence.vietnamese?.aliases ?? [])]) {
        if (value) assert(!allText.includes(value), 'plan/report copied a Vietnamese term value');
      }
    }
  }
  assert(!planText.includes('SOURCE_VERIFIED'), 'plan must not enter source verification state');
  assert(!planText.includes('MEDICAL_REVIEWED'), 'plan must not enter medical review state');
  assert(!planText.includes('"searchable":true'), 'plan must not enter searchable state');

  await assertProductionUnchanged();
  const rebuilt = await buildPlan();
  assert(JSON.stringify(rebuilt) === JSON.stringify(plan), 'plan output is not deterministic');
  assert(renderReport(rebuilt) === reportText, 'report output is not deterministic');
}

async function writeArtifacts(plan) {
  const json = JSON.stringify(plan, null, 2) + '\n';
  const report = renderReport(plan);
  for (const [path, content] of [[PLAN_PATH, json], [REPORT_PATH, report]]) {
    if (await exists(path)) {
      const existing = await readText(path);
      if (existing !== content) await writeFile(path, content, 'utf8');
    } else {
      await writeFile(path, content, 'utf8');
    }
  }
}

async function main() {
  const writeRequested = process.argv.includes('--write');
  const branch = gitOutput('branch', '--show-current');
  const head = gitOutput('rev-parse', 'HEAD');
  assert(branch === 'main', 'repository must remain on main');
  assert(head === BASELINE_COMMIT, 'repository HEAD must remain at the M04B2D-0 baseline');
  const plan = await buildPlan();
  if (writeRequested) await writeArtifacts(plan);
  assert(await exists(PLAN_PATH), 'target plan is missing; run with --write once to create it');
  assert(await exists(REPORT_PATH), 'targeting report is missing; run with --write once to create it');
  const savedPlan = await readJson(PLAN_PATH);
  assert(JSON.stringify(savedPlan) === JSON.stringify(plan), 'saved target plan differs from deterministic rebuild');
  await assertPlan(savedPlan);
  console.log('M04B2D targeting: PASS');
  console.log('Concepts: ' + savedPlan.summary.totalConcepts + '/' + EXPECTED_CONCEPT_COUNT);
  console.log('Classes: ' + CLASS_NAMES.map(name => name + '=' + savedPlan.summary.classCounts[name]).join(', '));
  console.log('QA: ' + QA_DISPOSITIONS.map(disposition => disposition + '=' + savedPlan.summary.qaDispositionCounts[disposition]).join(', '));
  console.log('First harvesting batch: ' + savedPlan.firstHarvestingBatch.batchId + ' (' + savedPlan.firstHarvestingBatch.conceptIds.join(', ') + ')');
  console.log('Clean family batches: ' + savedPlan.familyBatches.map(batch => batch.family + '=' + batch.cleanTargetCount).join(', '));
  console.log('Production files unchanged; no Vietnamese term/search/release state generated.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('M04B2D targeting: FAIL\n' + (error.stack ?? error.message));
    process.exitCode = 1;
  });
}

export {
  buildPlan,
  classifyResult,
  familyFor,
  renderReport,
};
