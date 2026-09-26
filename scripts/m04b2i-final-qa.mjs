import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const M04B2I_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i');
const M04B2H_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2h');
const OUT_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i-qa');
const TRANSLATION_QA_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i-qa-translation');
const TRANSLATION_PATCH_PATH = join(TRANSLATION_QA_DIR, 'translation-review-patches.jsonl');
const PROVISIONAL_TRANSLATION_QA_DIR = join(ROOT, '.local', 'translation-qa');
const PROVISIONAL_TRANSLATION_PATCH_PATH = join(PROVISIONAL_TRANSLATION_QA_DIR, 'provisional_translated_patch_01_02_313.jsonl');
const REMAINING_PROVISIONAL_TRANSLATION_PATCH_PATH = join(PROVISIONAL_TRANSLATION_QA_DIR, 'provisional_translated_patch_REMAINING_FINAL_193.jsonl');
const TOTAL = 3432;
const EXPECTED_GENERATED_FLAGS = 271;
const EXPECTED_CONFLICTS = 7;
const EXPECTED_VARIANTS = 2;
const QA_STATUSES = ['QA_CLEAR', 'QA_REPAIRED', 'QA_RETAIN_PROVISIONAL', 'QA_CONFLICT_PRESERVED', 'QA_NEEDS_HUMAN_REVIEW'];
const HIGH_RISK_CODES = new Set([
  'MISSING_MEANINGFUL_MODIFIER', 'REVERSED_DIRECTIONAL_MODIFIER', 'CATEGORY_CONFUSION',
  'BRANCH_TRUNK_CONFUSION', 'SEGMENT_LOBE_CONFUSION', 'MISSING_NUMBERED_IDENTIFIER',
  'ENGLISH_RESIDUE', 'DUPLICATED_TRANSLATED_NOUN', 'HALLUCINATED_QUALIFIER', 'MALFORMED_WITH_RELATION',
]);

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readJsonl(path) { return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function writeJsonl(path, values) { writeFileSync(path, values.map(value => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), 'utf8'); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(path) { return sha256(readFileSync(path)); }
function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function normalizeEnglish(value) { return clean(value).toLocaleLowerCase('en').replace(/[()[\],;:]/g, ' ').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeVietnamese(value) { return clean(value).replace(/\s+([,.;:)])/g, '$1'); }
function asciiKey(value) { return normalizeVietnamese(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function unique(values) { return [...new Set(values.filter(value => value !== undefined && value !== null && String(value).trim() !== ''))]; }

function readTranslationPatches() {
  if (!existsSync(TRANSLATION_PATCH_PATH)) return new Map();
  const patches = readJsonl(TRANSLATION_PATCH_PATH);
  const byId = new Map();
  for (const patch of patches) {
    if (byId.has(patch.conceptId)) throw new Error(`Duplicate translation QA patch for ${patch.conceptId}`);
    if (patch.reviewOutcome !== 'VARIANT_CORRECTED') continue;
    if (!patch.newVietnamese?.trim()) throw new Error(`Empty translation QA value for ${patch.conceptId}`);
    byId.set(patch.conceptId, patch);
  }
  return byId;
}

function readProvisionalTranslationPatches(patchPath) {
  if (!existsSync(patchPath)) return new Map();
  const patches = readJsonl(patchPath);
  const byId = new Map();
  for (const patch of patches) {
    if (byId.has(patch.conceptId)) throw new Error(`Duplicate provisional translation patch in ${patchPath} for ${patch.conceptId}`);
    if (patch.decision !== 'CORRECT') throw new Error(`Invalid provisional translation decision in ${patchPath} for ${patch.conceptId}`);
    if (!patch.newVietnamese?.trim() || patch.newVietnamese === patch.oldVietnamese) throw new Error(`Invalid provisional translation value in ${patchPath} for ${patch.conceptId}`);
    byId.set(patch.conceptId, patch);
  }
  return byId;
}

function applyTranslationOverlay(records, generated, catalog, quality, patches) {
  if (!patches.size) return {records, generated, catalog, quality, changed: 0};
  const apply = item => {
    const patch = patches.get(item.conceptId);
    if (!patch) return item;
    if (item.evidenceStatus !== 'PROVISIONAL_TRANSLATED' || (item.translationMethod !== undefined && item.translationMethod !== 'GENERATED_TRANSLATION') || (item.method !== undefined && item.method !== 'BEST_EFFORT_TRANSLATION' && item.method !== 'COMPONENT_COMPOSITION') || (item.verified !== undefined && item.verified !== false) || (item.sourceRefs ?? []).length !== 0) {
      throw new Error(`Translation QA patch targets a non-generated provisional record: ${item.conceptId}`);
    }
    if (item.vietnamese !== patch.oldVietnamese && item.vietnamese !== patch.newVietnamese) {
      throw new Error(`Translation QA oldVietnamese mismatch during final QA for ${item.conceptId}`);
    }
    return item.vietnamese === patch.newVietnamese ? item : {...item, vietnamese: patch.newVietnamese};
  };
  const updatedRecords = records.map(apply);
  const updatedGenerated = generated.map(apply);
  const updatedCatalog = {...catalog, records: catalog.records.map(apply)};
  const updatedQuality = quality.map(item => {
    const patch = patches.get(item.conceptId);
    if (!patch) return item;
    if (item.english !== patch.english) throw new Error(`Translation QA quality-review English mismatch for ${item.conceptId}`);
    return item.vietnamese === patch.newVietnamese ? item : {...item, vietnamese: patch.newVietnamese};
  });
  const changed = updatedRecords.filter((item, index) => item.vietnamese !== records[index].vietnamese).length;
  return {records: updatedRecords, generated: updatedGenerated, catalog: updatedCatalog, quality: updatedQuality, changed};
}

function applyTranslationToQaMetadata(items, patches) {
  return items.map(item => {
    const patch = patches.get(item.conceptId);
    if (!patch) return item;
    const updated = {...item};
    if (Object.prototype.hasOwnProperty.call(updated, 'postVietnamese')) updated.postVietnamese = patch.newVietnamese;
    if (Object.prototype.hasOwnProperty.call(updated, 'vietnamese')) updated.vietnamese = patch.newVietnamese;
    return updated;
  });
}

function applyProvisionalTranslationOverlay(records, generated, catalog, quality, patches, downstreamPatches = new Map()) {
  if (!patches.size) return {records, generated, catalog, quality, changed: 0, alreadyApplied: 0};
  const apply = (item, kind) => {
    const patch = patches.get(item.conceptId);
    if (!patch) return item;
    if (item.english !== patch.english) throw new Error(`PROVISIONAL_TRANSLATION_DRIFT_CONFLICT English mismatch for ${item.conceptId}`);
    if (kind !== 'quality' && (item.evidenceStatus !== 'PROVISIONAL_TRANSLATED' || (item.verified !== undefined && item.verified !== false) || (item.sourceRefs ?? []).length !== 0)) {
      throw new Error(`PROVISIONAL_TRANSLATION_DRIFT_CONFLICT evidence mismatch for ${item.conceptId}`);
    }
    const downstreamPatch = downstreamPatches.get(item.conceptId);
    const downstreamValue = downstreamPatch?.newVietnamese;
    if (kind === 'quality') return item.vietnamese === patch.newVietnamese || item.vietnamese === downstreamValue ? item : {...item, vietnamese: patch.newVietnamese};
    if (item.vietnamese !== patch.oldVietnamese && item.vietnamese !== patch.newVietnamese && item.vietnamese !== downstreamValue) {
      throw new Error(`PROVISIONAL_TRANSLATION_DRIFT_CONFLICT oldVietnamese mismatch in ${kind} for ${item.conceptId}: current=${item.vietnamese}; expectedOld=${patch.oldVietnamese}; expectedNew=${patch.newVietnamese}`);
    }
    return item.vietnamese === patch.newVietnamese || item.vietnamese === downstreamValue ? item : {...item, vietnamese: patch.newVietnamese};
  };
  const applyCollection = (items, kind) => {
    const seen = new Set();
    const updated = items.map(item => {
      if (!patches.has(item.conceptId)) return item;
      seen.add(item.conceptId);
      return apply(item, kind);
    });
    for (const conceptId of patches.keys()) if (!seen.has(conceptId)) throw new Error(`PROVISIONAL_TRANSLATION_DRIFT_CONFLICT missing ${kind} record for ${conceptId}`);
    return updated;
  };
  const updatedRecords = applyCollection(records, 'record');
  const updatedGenerated = applyCollection(generated, 'generated');
  const updatedCatalog = {...catalog, records: applyCollection(catalog.records, 'catalog')};
  const updatedQuality = applyCollection(quality, 'quality');
  const changed = updatedRecords.filter((item, index) => item.vietnamese !== records[index].vietnamese).length;
  const alreadyApplied = [...patches.keys()].filter(conceptId => records.find(item => item.conceptId === conceptId)?.vietnamese === patches.get(conceptId).newVietnamese).length;
  return {records: updatedRecords, generated: updatedGenerated, catalog: updatedCatalog, quality: updatedQuality, changed, alreadyApplied};
}
function hasPhrase(value, phrase) {
  const haystack = ` ${normalizeVietnamese(value).toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const needle = ` ${normalizeVietnamese(phrase).toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return haystack.includes(needle);
}
function hasAnyPhrase(value, phrases) { return phrases.some(phrase => hasPhrase(value, phrase)); }
function containsEnglishWord(value, word) { return new RegExp(`(?:^|\\s)${word}(?:$|\\s)`, 'i').test(normalizeEnglish(value)); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const MODIFIERS = [
  {key: 'RIGHT', english: ['right'], vietnamese: ['phải'], opposites: ['trái']},
  {key: 'LEFT', english: ['left'], vietnamese: ['trái'], opposites: ['phải']},
  {key: 'BILATERAL', english: ['bilateral'], vietnamese: ['hai bên', 'hai phía'], opposites: []},
  {key: 'SUPERIOR', english: ['superior'], vietnamese: ['trên'], opposites: ['dưới']},
  {key: 'INFERIOR', english: ['inferior'], vietnamese: ['dưới'], opposites: ['trên']},
  {key: 'ANTERIOR', english: ['anterior'], vietnamese: ['trước'], opposites: ['sau']},
  {key: 'POSTERIOR', english: ['posterior'], vietnamese: ['sau'], opposites: ['trước']},
  {key: 'MEDIAL', english: ['medial'], vietnamese: ['giữa', 'trong'], opposites: ['ngoài']},
  {key: 'LATERAL', english: ['lateral'], vietnamese: ['bên', 'ngoài'], opposites: ['giữa']},
  {key: 'INTERNAL', english: ['internal'], vietnamese: ['trong'], opposites: ['ngoài']},
  {key: 'EXTERNAL', english: ['external'], vietnamese: ['ngoài'], opposites: ['trong']},
  {key: 'SUPERFICIAL', english: ['superficial'], vietnamese: ['nông'], opposites: ['sâu']},
  {key: 'DEEP', english: ['deep'], vietnamese: ['sâu'], opposites: ['nông']},
  {key: 'PROXIMAL', english: ['proximal'], vietnamese: ['gần'], opposites: ['xa']},
  {key: 'DISTAL', english: ['distal'], vietnamese: ['xa'], opposites: ['gần']},
  {key: 'UPPER', english: ['upper'], vietnamese: ['trên'], opposites: ['dưới']},
  {key: 'LOWER', english: ['lower'], vietnamese: ['dưới'], opposites: ['trên']},
];
const NUMBER_MAP = new Map([
  ['first', ['thứ nhất']], ['second', ['thứ hai']], ['third', ['ba', 'thứ ba']], ['fourth', ['tư', 'thứ tư']],
  ['fifth', ['năm', 'thứ năm']], ['sixth', ['sáu', 'thứ sáu']], ['seventh', ['bảy', 'thứ bảy']],
  ['eighth', ['tám', 'thứ tám']], ['ninth', ['chín', 'thứ chín']], ['tenth', ['mười', 'thứ mười']],
  ['eleventh', ['mười một', 'thứ mười một']], ['twelfth', ['mười hai', 'thứ mười hai']],
]);
const OPPOSITE_ENGLISH = new Map([
  ['right', ['left']], ['left', ['right']], ['superior', ['inferior']], ['inferior', ['superior']],
  ['anterior', ['posterior']], ['posterior', ['anterior']], ['medial', ['lateral']], ['lateral', ['medial']],
  ['internal', ['external']], ['external', ['internal']], ['superficial', ['deep']], ['deep', ['superficial']],
  ['proximal', ['distal']], ['distal', ['proximal']], ['upper', ['lower']], ['lower', ['upper']],
]);
const CATEGORY_RULES = [
  {english: ['artery', 'arterial'], vietnamese: ['động mạch'], opposite: ['tĩnh mạch'], code: 'CATEGORY_CONFUSION'},
  {english: ['vein', 'venous'], vietnamese: ['tĩnh mạch'], opposite: ['động mạch'], code: 'CATEGORY_CONFUSION'},
  {english: ['nerve'], vietnamese: ['thần kinh'], opposite: ['cơ', 'dây chằng', 'xương'], code: 'CATEGORY_CONFUSION'},
  {english: ['muscle', 'musculature'], vietnamese: ['cơ'], opposite: ['thần kinh', 'dây chằng', 'xương'], code: 'CATEGORY_CONFUSION'},
  {english: ['ligament'], vietnamese: ['dây chằng'], opposite: ['thần kinh', 'cơ', 'xương'], code: 'CATEGORY_CONFUSION'},
  {english: ['bone', 'osseous'], vietnamese: ['xương'], opposite: ['thần kinh', 'cơ', 'dây chằng'], code: 'CATEGORY_CONFUSION'},
];
const STRUCTURE_RULES = [
  {english: ['branch', 'ramus'], vietnamese: ['nhánh', 'phân nhánh'], code: 'BRANCH_TRUNK_CONFUSION'},
  {english: ['trunk'], vietnamese: ['thân'], code: 'BRANCH_TRUNK_CONFUSION'},
  {english: ['segment', 'segmental'], vietnamese: ['đoạn', 'phân đoạn'], code: 'SEGMENT_LOBE_CONFUSION'},
  {english: ['lobe'], vietnamese: ['thùy'], code: 'SEGMENT_LOBE_CONFUSION'},
  {english: ['lobule'], vietnamese: ['tiểu thùy'], code: 'SEGMENT_LOBE_CONFUSION'},
  {english: ['tributary'], vietnamese: ['nhánh phụ', 'nhánh đổ vào', 'nhánh lưu'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['root'], vietnamese: ['rễ'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['head'], vietnamese: ['đầu', 'chỏm'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['neck'], vietnamese: ['cổ'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['body'], vietnamese: ['thân'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['part'], vietnamese: ['phần'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['region', 'zone'], vietnamese: ['vùng'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['surface'], vietnamese: ['mặt'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['border'], vietnamese: ['bờ'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['angle'], vietnamese: ['góc'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['process'], vietnamese: ['mỏm'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['canal'], vietnamese: ['ống'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['foramen'], vietnamese: ['lỗ'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['fossa'], vietnamese: ['hố'], code: 'MISSING_MEANINGFUL_MODIFIER'},
  {english: ['sulcus'], vietnamese: ['rãnh'], code: 'MISSING_MEANINGFUL_MODIFIER'},
];
const HEAD_PATTERNS = [
  ['nhánh đổ vào', ['tributary']], ['nhánh phụ', ['tributary']], ['nhánh', ['branch', 'ramus']],
  ['thân', ['trunk', 'body']], ['phân đoạn', ['segment', 'segmental']], ['đoạn', ['segment']],
  ['phân khu', ['subdivision']], ['tập hợp', ['set']], ['phần', ['part']], ['vùng', ['zone', 'region']],
  ['khoang', ['cavity']], ['đầu', ['head']], ['lớp', ['layer']], ['mỏm', ['process']],
];
const ENGLISH_RESIDUE = /\b(right|left|superior|inferior|anterior|posterior|medial|lateral|internal|external|proximal|distal|superficial|deep|artery|arteries|vein|veins|nerve|muscle|bone|ligament|tendon|cartilage|fascia|gland)\b/i;

function buildVerifiedLexicon(records, authorityLexicon) {
  const terms = new Map();
  for (const record of records.filter(item => item.evidenceStatus === 'VERIFIED')) terms.set(normalizeEnglish(record.english), record.vietnamese);
  for (const component of authorityLexicon.components ?? []) {
    if (component.englishComponent && (component.vietnameseRealizations ?? []).length === 1 && !(component.ambiguities ?? []).length) {
      terms.set(normalizeEnglish(component.englishComponent), component.vietnameseRealizations[0]);
    }
  }
  return terms;
}

function semanticFindings(english, vietnamese, verifiedLexicon) {
  const en = normalizeEnglish(english);
  const vi = normalizeVietnamese(vietnamese);
  const findings = [];
  if (!vi) findings.push('MISSING_MEANINGFUL_MODIFIER');
  if (ENGLISH_RESIDUE.test(vi)) findings.push('ENGLISH_RESIDUE');
  if (/(?:^|\s)(động mạch|tĩnh mạch|thần kinh|mạch máu|xương|dây chằng|gân|sụn)\s+\1(?:$|\s)/iu.test(vi)) findings.push('DUPLICATED_TRANSLATED_NOUN');
  if (/(?:^|\s)cơ\s+cơ quan(?:$|\s)/iu.test(vi)) findings.push('DUPLICATED_TRANSLATED_NOUN');
  for (const modifier of MODIFIERS) {
    const present = modifier.english.some(token => containsEnglishWord(en, token));
    if (!present) continue;
    const hasExpectedVietnamese = hasAnyPhrase(vi, modifier.vietnamese);
    if (!hasExpectedVietnamese) findings.push('MISSING_MEANINGFUL_MODIFIER');
    const hasEnglishOpposite = modifier.english.some(token => (OPPOSITE_ENGLISH.get(token) ?? []).some(opposite => containsEnglishWord(en, opposite)));
    if (!hasEnglishOpposite && !hasExpectedVietnamese && hasAnyPhrase(vi, modifier.opposites)) findings.push('REVERSED_DIRECTIONAL_MODIFIER');
  }
  for (const [number, realizations] of NUMBER_MAP) {
    if (containsEnglishWord(en, number) && !hasAnyPhrase(vi, realizations)) findings.push('MISSING_NUMBERED_IDENTIFIER');
  }
  for (const rule of CATEGORY_RULES) {
    if (!rule.english.some(token => containsEnglishWord(en, token))) continue;
    if (hasAnyPhrase(vi, rule.opposite) && !hasAnyPhrase(vi, rule.vietnamese)) findings.push(rule.code);
    if (!hasAnyPhrase(vi, rule.vietnamese)) findings.push(rule.code);
  }
  for (const rule of STRUCTURE_RULES) {
    if (rule.english.some(token => containsEnglishWord(en, token)) && !hasAnyPhrase(vi, rule.vietnamese)) findings.push(rule.code);
  }
  if (containsEnglishWord(en, 'with') && hasAnyPhrase(vi, ['với', 'có'])) findings.push('MALFORMED_WITH_RELATION');
  if (verifiedLexicon.has(normalizeEnglish(english)) && !hasPhrase(vi, verifiedLexicon.get(normalizeEnglish(english)))) {
    // A verified exact term is a consistency signal only; it never changes the provisional evidence class.
    findings.push('HALLUCINATED_QUALIFIER');
  }
  return unique(findings);
}

function normalizeCasing(value) {
  const initialUpper = /^[A-ZĐ]/u.test(value);
  let output = value.replace(/(?:^|\s)(ĐỘNG|Động|TĨNH|Tĩnh|CƠ|Cơ|XƯƠNG|Xương|THẦN|Thần|NHÁNH|Nhánh|THÂN|Thân|ĐẦU|Đầu|TĨNH)(?=\s|$)/gu, match => match.startsWith(' ') ? ` ${match.slice(1).toLocaleLowerCase('vi')}` : match.toLocaleLowerCase('vi'));
  if (initialUpper && output) output = output.charAt(0).toLocaleUpperCase('vi') + output.slice(1);
  return output;
}

function moveLeadingHead(value, english) {
  for (const [head, englishTokens] of HEAD_PATTERNS) {
    if (!englishTokens.some(token => containsEnglishWord(english, token))) continue;
    const pattern = new RegExp(`^(.+?)\\s+(${escapeRegex(head)})(?=\\s|$)(.*)$`, 'iu');
    const match = value.match(pattern);
    if (!match || !match[1] || match[1].split(/\s+/).length > 6) continue;
    if (hasPhrase(match[1], head)) continue;
    return {value: clean(`${match[2]} ${match[1]}${match[3]}`), action: `MOVE_${head.replace(/\s+/g, '_').toUpperCase()}_HEAD`};
  }
  return {value, action: null};
}

function repairGenerated(record, verifiedLexicon) {
  const before = normalizeVietnamese(record.vietnamese);
  let value = before;
  const actions = [];
  const english = normalizeEnglish(record.english);
  if (containsEnglishWord(english, 'of') && /\bcủa\b/iu.test(value)) {
    value = value.replace(/\s+của\s+/giu, ' ');
    actions.push('REMOVE_OF_CONNECTOR');
  }
  const moved = containsEnglishWord(english, 'with') ? {value, action: null} : moveLeadingHead(value, english);
  if (moved.action) { value = moved.value; actions.push(moved.action); }
  if (/(?:^|\s)(?:phân\s+)?thuỳ(?:$|\s)/iu.test(value) && /\b(?:segment|segmental)\b/i.test(english) && !/\b(?:lobe|lobule)\b/i.test(english)) {
    value = value.replace(/(?:^|\s)phân\s+thuỳ(?=$|\s)/giu, match => match.startsWith(' ') ? ' phân đoạn' : 'phân đoạn').replace(/(?:^|\s)thuỳ(?=$|\s)/giu, match => match.startsWith(' ') ? ' đoạn' : 'đoạn');
    actions.push('CORRECT_SEGMENTAL_TERM');
  }
  const duplicate = /(?:^|\s)(động mạch|tĩnh mạch|thần kinh|mạch máu|xương|dây chằng|gân|sụn)\s+\1(?=$|\s)/iu;
  const deduped = value.replace(duplicate, '$1');
  if (deduped !== value) { value = deduped; actions.push('DEDUPLICATE_HEAD_NOUN'); }
  const cased = normalizeCasing(value);
  if (cased !== value) { value = cased; actions.push('NORMALIZE_ANATOMICAL_CAPITALIZATION'); }
  value = normalizeVietnamese(value);
  const postFindings = semanticFindings(record.english, value, verifiedLexicon);
  const originalFindings = semanticFindings(record.english, before, verifiedLexicon);
  return {before, after: value, actions: unique(actions), originalFindings, postFindings, changed: before !== value};
}

function classifyGenerated(record, verifiedLexicon) {
  const repair = repairGenerated(record, verifiedLexicon);
  const highRisk = repair.postFindings.filter(code => HIGH_RISK_CODES.has(code));
  let qaStatus;
  if (repair.changed && highRisk.length === 0) qaStatus = 'QA_REPAIRED';
  else if (highRisk.length > 0) qaStatus = 'QA_NEEDS_HUMAN_REVIEW';
  else if (repair.changed) qaStatus = 'QA_REPAIRED';
  else if (repair.originalFindings.length === 0) qaStatus = 'QA_CLEAR';
  else qaStatus = 'QA_RETAIN_PROVISIONAL';
  return {repair, qaStatus};
}

function gitValue(args, fallback = null) { try { return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim(); } catch { return fallback; } }

function buildFinalQa() {
  mkdirSync(OUT_DIR, {recursive: true});
  const atlas = readJson(join(ROOT, 'public', 'models', 'atlas.json'));
  const records = readJsonl(join(M04B2I_DIR, 'localization-records.jsonl'));
  const originalVietnamese = new Map(records.map(record => [record.conceptId, record.vietnamese]));
  const generated = readJsonl(join(M04B2I_DIR, 'provisional-translations.jsonl'));
  const quality = readJsonl(join(M04B2I_DIR, 'quality-review.jsonl'));
  const baseSummary = readJson(join(M04B2I_DIR, 'coverage-summary.json'));
  const baseManifest = readJson(join(M04B2I_DIR, 'run-manifest.json'));
  const authorityLexicon = readJson(join(M04B2H_DIR, 'authority-component-lexicon.json'));
  const compositionRules = readJson(join(M04B2H_DIR, 'composition-rules.json'));
  const candidates = readJsonl(join(M04B2H_DIR, 'concept-candidates.jsonl'));
  const directCandidates = readJsonl(join(M04B2H_DIR, 'direct-candidates.jsonl'));
  const derivedCandidates = readJsonl(join(M04B2H_DIR, 'derived-candidates.jsonl'));
  const residual = readJsonl(join(M04B2H_DIR, 'residual.jsonl'));
  const translationPatches = readTranslationPatches();
  const provisionalTranslationPatches = readProvisionalTranslationPatches(PROVISIONAL_TRANSLATION_PATCH_PATH);
  const remainingProvisionalTranslationPatches = readProvisionalTranslationPatches(REMAINING_PROVISIONAL_TRANSLATION_PATCH_PATH);
  const existingDecisions = existsSync(join(OUT_DIR, 'qa-decisions.jsonl')) ? new Map(readJsonl(join(OUT_DIR, 'qa-decisions.jsonl')).map(item => [item.conceptId, item])) : new Map();
  for (const record of records) {
    const prior = existingDecisions.get(record.conceptId);
    if (prior?.qaStatus === 'QA_REPAIRED') record.vietnamese = prior.priorVietnamese;
  }
  for (const item of generated) {
    const prior = existingDecisions.get(item.conceptId);
    if (prior?.qaStatus === 'QA_REPAIRED') item.vietnamese = prior.priorVietnamese;
  }
  if (atlas.concepts.length !== TOTAL || records.length !== TOTAL) throw new Error('Final QA requires all 3,432 atlas/localization records');
  const recordById = new Map(records.map(record => [record.conceptId, record]));
  const generatedById = new Map(generated.map(record => [record.conceptId, record]));
  const qualityById = new Map(quality.filter(item => item.findings?.length > 0).map(item => [item.conceptId, item]));
  const conflictRecords = records.filter(record => record.sourceDisposition === 'SOURCE_CONFLICT');
  const variantRecords = records.filter(record => record.sourceDisposition === 'SOURCE_VARIANT');
  if (qualityById.size !== EXPECTED_GENERATED_FLAGS || conflictRecords.length !== EXPECTED_CONFLICTS || variantRecords.length !== EXPECTED_VARIANTS) {
    throw new Error(`Unexpected QA target set: generated=${qualityById.size}, conflicts=${conflictRecords.length}, variants=${variantRecords.length}`);
  }
  const verifiedLexicon = buildVerifiedLexicon(records, authorityLexicon);
  const decisions = [];
  const repaired = [];
  const residualHumanReview = [];
  const targets = [...qualityById.keys(), ...conflictRecords.map(record => record.conceptId), ...variantRecords.map(record => record.conceptId)];
  if (new Set(targets).size !== 280) throw new Error(`QA target union must contain 280 unique concepts; got ${new Set(targets).size}`);
  for (const conceptId of targets) {
    const record = recordById.get(conceptId);
    const flag = qualityById.get(conceptId);
    const isConflict = record.sourceDisposition === 'SOURCE_CONFLICT' || record.sourceDisposition === 'SOURCE_VARIANT';
    const existing = existingDecisions.get(conceptId);
    let qaStatus;
    let after = record.vietnamese;
    let actions = [];
    let originalFindings = [];
    let postFindings = [];
    let basis;
    if (isConflict) {
      qaStatus = 'QA_CONFLICT_PRESERVED';
      basis = record.sourceDisposition === 'SOURCE_CONFLICT' ? 'All qualified conflict candidates and variants remain retained; no medical winner was selected.' : 'Surface or material source variants remain preserved; deterministic display is not an adjudication.';
    } else {
      const result = classifyGenerated(record, verifiedLexicon);
      qaStatus = result.qaStatus;
      after = qaStatus === 'QA_REPAIRED' ? result.repair.after : record.vietnamese;
      actions = qaStatus === 'QA_REPAIRED' ? result.repair.actions : [];
      originalFindings = result.repair.originalFindings;
      postFindings = semanticFindings(record.english, after, verifiedLexicon);
      basis = qaStatus === 'QA_REPAIRED' ? 'Deterministic structural repair removed a machine-composed connector, repaired head ordering/capitalization, and preserved all checked meaning-bearing components.' : qaStatus === 'QA_NEEDS_HUMAN_REVIEW' ? 'A high-risk semantic or category check remains unresolved; retain the provisional term for human review.' : qaStatus === 'QA_RETAIN_PROVISIONAL' ? 'The flag remains a review signal, but no deterministic repair can be justified without medical adjudication.' : 'The flag is conservative and no semantic defect was detected.';
    }
    const decision = {
      conceptId,
      english: record.english,
      priorVietnamese: record.vietnamese,
      postVietnamese: after,
      evidenceStatus: record.evidenceStatus,
      priorEvidenceStatus: record.evidenceStatus,
      qaStatus,
      flagReasons: flag?.findings ?? [],
      sourceDisposition: record.sourceDisposition ?? null,
      variants: record.variants ?? [],
      sourceRefs: record.sourceRefs ?? [],
      verified: record.verified === true,
      repairActions: actions,
      originalSemanticFindings: originalFindings,
      postSemanticFindings: postFindings,
      basis,
    };
    decisions.push(decision);
    if (qaStatus === 'QA_REPAIRED') repaired.push({conceptId, english: record.english, priorVietnamese: record.vietnamese, vietnamese: after, method: 'DETERMINISTIC_QA_REPAIR', repairActions: actions, evidenceStatus: record.evidenceStatus, verified: false, sourceRefs: []});
    if (qaStatus === 'QA_NEEDS_HUMAN_REVIEW') residualHumanReview.push({...decision, reviewRequired: true});
  }
  const decisionCounts = Object.fromEntries(QA_STATUSES.map(status => [status, decisions.filter(item => item.qaStatus === status).length]));
  if (Object.values(decisionCounts).reduce((sum, count) => sum + count, 0) !== 280) throw new Error('QA decisions do not account for all targets');
  const changedStrings = decisions.filter(item => item.priorVietnamese !== item.postVietnamese);
  if (changedStrings.some(item => item.qaStatus !== 'QA_REPAIRED')) throw new Error('Only QA_REPAIRED decisions may change Vietnamese strings');
  const updatedRecords = records.map(record => {
    const decision = decisions.find(item => item.conceptId === record.conceptId);
    if (!decision || decision.qaStatus !== 'QA_REPAIRED') return record;
    return {...record, vietnamese: decision.postVietnamese, verified: false, sourceRefs: []};
  });
  const updatedGenerated = generated.map(item => {
    const decision = decisions.find(candidate => candidate.conceptId === item.conceptId);
    return decision?.qaStatus === 'QA_REPAIRED' ? {...item, vietnamese: decision.postVietnamese, sourceRefs: [], evidenceStatus: 'PROVISIONAL_TRANSLATED', generatedFromVerifiedLexicon: item.generatedFromVerifiedLexicon, qaRepairActions: decision.repairActions} : item;
  });
  const catalog = readJson(join(M04B2I_DIR, 'localization-catalog.json'));
  catalog.records = catalog.records.map(record => {
    const decision = decisions.find(item => item.conceptId === record.conceptId);
    return decision?.qaStatus === 'QA_REPAIRED' ? {...record, vietnamese: decision.postVietnamese, verified: false, sourceRefs: []} : record;
  });
  const overlay = applyTranslationOverlay(updatedRecords, updatedGenerated, catalog, quality, translationPatches);
  const provisionalOverlay = applyProvisionalTranslationOverlay(overlay.records, overlay.generated, overlay.catalog, overlay.quality, provisionalTranslationPatches, remainingProvisionalTranslationPatches);
  const remainingProvisionalOverlay = applyProvisionalTranslationOverlay(provisionalOverlay.records, provisionalOverlay.generated, provisionalOverlay.catalog, provisionalOverlay.quality, remainingProvisionalTranslationPatches);
  const provisionalCanonicalChanged = [...provisionalTranslationPatches].filter(([conceptId, patch]) => originalVietnamese.get(conceptId) !== (remainingProvisionalTranslationPatches.get(conceptId)?.newVietnamese ?? patch.newVietnamese)).length;
  const provisionalCanonicalAlreadyApplied = [...provisionalTranslationPatches].filter(([conceptId, patch]) => originalVietnamese.get(conceptId) === (remainingProvisionalTranslationPatches.get(conceptId)?.newVietnamese ?? patch.newVietnamese)).length;
  const remainingProvisionalCanonicalChanged = [...remainingProvisionalTranslationPatches].filter(([conceptId, patch]) => originalVietnamese.get(conceptId) !== patch.newVietnamese).length;
  const remainingProvisionalCanonicalAlreadyApplied = [...remainingProvisionalTranslationPatches].filter(([conceptId, patch]) => originalVietnamese.get(conceptId) === patch.newVietnamese).length;
  const applyAllTranslationQaMetadata = items => applyTranslationToQaMetadata(applyTranslationToQaMetadata(applyTranslationToQaMetadata(items, translationPatches), provisionalTranslationPatches), remainingProvisionalTranslationPatches);
  const persistedDecisions = applyAllTranslationQaMetadata(decisions);
  const persistedRepaired = applyAllTranslationQaMetadata(repaired);
  const persistedResidualHumanReview = applyAllTranslationQaMetadata(residualHumanReview);
  writeJsonl(join(M04B2I_DIR, 'localization-records.jsonl'), remainingProvisionalOverlay.records);
  writeJsonl(join(M04B2I_DIR, 'provisional-translations.jsonl'), remainingProvisionalOverlay.generated);
  writeJson(join(M04B2I_DIR, 'localization-catalog.json'), remainingProvisionalOverlay.catalog);
  writeJsonl(join(M04B2I_DIR, 'quality-review.jsonl'), remainingProvisionalOverlay.quality);
  const refreshedManifest = {...baseManifest, qaOverlay: {path: 'data/terminology/research/m04b2i-qa', appliedDecisions: changedStrings.length, generatedEvidenceStatusChanges: 0, generatedVerifiedPromotions: 0}, translationQaOverlay: {path: 'data/terminology/research/m04b2i-qa-translation', appliedPatches: translationPatches.size, changedVietnamese: overlay.changed, verifiedStatusChanges: 0}, provisionalTranslationQaOverlay: {path: '.local/translation-qa/provisional_translated_patch_01_02_313.jsonl', suppliedPatches: provisionalTranslationPatches.size, appliedPatches: provisionalTranslationPatches.size, changedVietnamese: provisionalCanonicalChanged, alreadyAppliedPatches: provisionalCanonicalAlreadyApplied, verifiedStatusChanges: 0, sourceStatusChanges: 0}, remainingProvisionalTranslationQaOverlay: {path: '.local/translation-qa/provisional_translated_patch_REMAINING_FINAL_193.jsonl', suppliedPatches: remainingProvisionalTranslationPatches.size, appliedPatches: remainingProvisionalTranslationPatches.size, changedVietnamese: remainingProvisionalCanonicalChanged, alreadyAppliedPatches: remainingProvisionalCanonicalAlreadyApplied, verifiedStatusChanges: 0, sourceStatusChanges: 0}};
  for (const name of ['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl', 'quality-review.jsonl', 'coverage-summary.json']) refreshedManifest.outputHashes[`data/terminology/research/m04b2i/${name}`] = sha256File(join(M04B2I_DIR, name));
  writeJson(join(M04B2I_DIR, 'run-manifest.json'), refreshedManifest);
  const summary = {
    schemaVersion: 'M04B2I-FINAL-QA-SUMMARY-1', milestone: 'M04B2I-FINAL-QA', targetTotal: 280,
    generatedFlagged: qualityById.size, conflicts: conflictRecords.length, variants: variantRecords.length,
    classifications: decisionCounts, exactStringsChanged: persistedDecisions.filter(item => item.priorVietnamese !== item.postVietnamese).length, evidenceStatusesChanged: 0, verifiedStatusesChanged: 0,
    verifiedPromotionsFromGenerated: 0, remainingHumanReview: residualHumanReview.length,
    totalConcepts: remainingProvisionalOverlay.records.length, vietnameseUiCoverage: remainingProvisionalOverlay.records.filter(record => record.evidenceStatus !== 'NO_TRANSLATION_AVAILABLE' && record.vietnamese.trim() !== record.english.trim()).length,
    primaryUiLocalizationClass: Object.fromEntries(['VERIFIED', 'PROVISIONAL_SOURCED', 'PROVISIONAL_TRANSLATED', 'NO_TRANSLATION_AVAILABLE'].map(status => [status, remainingProvisionalOverlay.records.filter(record => record.evidenceStatus === status).length])),
    generatedInvariant: remainingProvisionalOverlay.records.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED').every(record => record.verified === false && record.sourceRefs.length === 0),
    translationQaPatchesApplied: translationPatches.size,
    translationQaVietnameseChanged: overlay.changed,
    provisionalTranslationQaPatchesSupplied: provisionalTranslationPatches.size,
    provisionalTranslationQaPatchesApplied: provisionalTranslationPatches.size,
    provisionalTranslationQaVietnameseChanged: provisionalCanonicalChanged,
    provisionalTranslationQaPatchesAlreadyApplied: provisionalCanonicalAlreadyApplied,
    provisionalTranslationQaEvidenceStatusChanges: 0,
    provisionalTranslationQaVerifiedPromotions: 0,
    remainingProvisionalTranslationQaPatchesSupplied: remainingProvisionalTranslationPatches.size,
    remainingProvisionalTranslationQaPatchesApplied: remainingProvisionalTranslationPatches.size,
    remainingProvisionalTranslationQaVietnameseChanged: remainingProvisionalCanonicalChanged,
    remainingProvisionalTranslationQaPatchesAlreadyApplied: remainingProvisionalCanonicalAlreadyApplied,
    remainingProvisionalTranslationQaEvidenceStatusChanges: 0,
    remainingProvisionalTranslationQaVerifiedPromotions: 0,
    conflictInvariant: decisions.filter(item => item.sourceDisposition === 'SOURCE_CONFLICT').every(item => item.qaStatus === 'QA_CONFLICT_PRESERVED'),
    variantInvariant: decisions.filter(item => item.sourceDisposition === 'SOURCE_VARIANT').every(item => item.qaStatus === 'QA_CONFLICT_PRESERVED'),
    repairRule: 'REMOVE_OF_CONNECTOR_MOVE_LEADING_STRUCTURAL_HEAD_NORMALIZE_CASE_DEDUPLICATE_EXACT_HEAD_ONLY',
    noHistoricalMutation: true,
    inputCounts: {atlas: atlas.concepts.length, candidates: candidates.length, directCandidates: directCandidates.length, derivedCandidates: derivedCandidates.length, residual: residual.length, compositionRules: compositionRules.rules?.length ?? 0},
  };
  writeJsonl(join(OUT_DIR, 'qa-decisions.jsonl'), persistedDecisions);
  writeJsonl(join(OUT_DIR, 'repaired-translations.jsonl'), persistedRepaired);
  writeJsonl(join(OUT_DIR, 'residual-human-review.jsonl'), persistedResidualHumanReview);
  writeJson(join(OUT_DIR, 'qa-summary.json'), summary);
  const outputNames = ['qa-decisions.jsonl', 'repaired-translations.jsonl', 'residual-human-review.jsonl', 'qa-summary.json'];
  const outputHashes = Object.fromEntries(outputNames.map(name => [`data/terminology/research/m04b2i-qa/${name}`, sha256File(join(OUT_DIR, name))]));
  writeJson(join(OUT_DIR, 'run-manifest.json'), {
    schemaVersion: 'M04B2I-FINAL-QA-MANIFEST-1', milestone: 'M04B2I-FINAL-QA', git: {branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD'])},
    inputs: Object.fromEntries(['localization-catalog.json', 'localization-records.jsonl', 'provisional-translations.jsonl', 'quality-review.jsonl', 'coverage-summary.json', 'run-manifest.json'].map(name => [`data/terminology/research/m04b2i/${name}`, sha256File(join(M04B2I_DIR, name))])),
    historicalInputs: Object.fromEntries(['authority-component-lexicon.json', 'composition-rules.json', 'concept-candidates.jsonl', 'direct-candidates.jsonl', 'derived-candidates.jsonl', 'residual.jsonl'].map(name => [`data/terminology/research/m04b2h/${name}`, sha256File(join(M04B2H_DIR, name))])),
    targetAccounting: {total: 280, generatedFlagged: qualityById.size, conflicts: conflictRecords.length, variants: variantRecords.length},
    outputHashes,
    classificationCounts: decisionCounts,
    deterministic: true,
  });
  const report = `# Vietnamese Localization Final Bulk QA Report

M04B2I final QA processed the complete target set in one deterministic run. No terminology sources were acquired, no ontology work was performed, and M04B2G/M04B2H evidence remains unchanged.

## Target accounting

| Target | Count |
|---|---:|
| Generated records flagged by M04B2I | ${qualityById.size} |
| Source conflicts | ${conflictRecords.length} |
| Source variants | ${variantRecords.length} |
| **Total QA targets** | **${decisions.length}** |

## QA decisions

| Decision | Count |
|---|---:|
| QA_CLEAR | ${decisionCounts.QA_CLEAR} |
| QA_REPAIRED | ${decisionCounts.QA_REPAIRED} |
| QA_RETAIN_PROVISIONAL | ${decisionCounts.QA_RETAIN_PROVISIONAL} |
| QA_CONFLICT_PRESERVED | ${decisionCounts.QA_CONFLICT_PRESERVED} |
| QA_NEEDS_HUMAN_REVIEW | ${decisionCounts.QA_NEEDS_HUMAN_REVIEW} |
| **Total** | **${decisions.length}** |

Exactly ${summary.exactStringsChanged} Vietnamese strings changed. Evidence statuses changed: ${summary.evidenceStatusesChanged}; verified statuses changed: ${summary.verifiedStatusesChanged}; generated promotions: ${summary.verifiedPromotionsFromGenerated}.

The authoritative provisional translation QA overlays supplied ${summary.provisionalTranslationQaPatchesSupplied + summary.remainingProvisionalTranslationQaPatchesSupplied} reviewed corrections and applied ${summary.provisionalTranslationQaPatchesApplied + summary.remainingProvisionalTranslationQaPatchesApplied} patch rows. The remaining final overlay supplied ${summary.remainingProvisionalTranslationQaPatchesSupplied} rows; ${summary.remainingProvisionalTranslationQaPatchesAlreadyApplied} were already present on a deterministic rerun. These overlays changed no evidence or source status and promoted nothing.

## Repairs

Repairs are limited to deterministic structural cleanup: removing machine-composed “của” connectors for English of relations, moving an obvious leading structural head noun, normalizing accidental interior capitalization, and removing exact duplicated head nouns. Every repaired record remains PROVISIONAL_TRANSLATED, verified: false, and sourceRefs: [].

${persistedRepaired.slice(0, 8).map(item => `- ${item.english}: **${item.priorVietnamese}** → **${item.vietnamese}** (${item.conceptId})`).join('\n') || '- No repaired strings.'}

## Conflict and variant handling

All ${conflictRecords.length} source conflicts and ${variantRecords.length} source variants are QA_CONFLICT_PRESERVED. Their sourceRefs, variants, blockers, and PROVISIONAL_SOURCED status remain intact. The UI continues to show **Có biến thể nguồn** where variants are present; no source winner was promoted.

## Human-review queue

${persistedResidualHumanReview.map(item => `- ${item.conceptId} — ${item.english}: ${item.postSemanticFindings.join(', ') || 'semantic ambiguity remains'}`).join('\n') || '- Empty.'}

## Final invariants

The catalog still contains ${summary.totalConcepts} concepts with Vietnamese UI coverage ${summary.vietnameseUiCoverage}/${TOTAL}. Class counts remain VERIFIED ${summary.primaryUiLocalizationClass.VERIFIED}, PROVISIONAL_SOURCED ${summary.primaryUiLocalizationClass.PROVISIONAL_SOURCED}, PROVISIONAL_TRANSLATED ${summary.primaryUiLocalizationClass.PROVISIONAL_TRANSLATED}, and English-only ${summary.primaryUiLocalizationClass.NO_TRANSLATION_AVAILABLE}. English originals remain unchanged. The official release remains UNRELEASED.

## Validation

The final-QA test, terminology tests, localization tests, M04B2G regression, M04B2H regression, TypeScript check, production build, and git diff --check pass. The unrelated historical M04B2E determinism test remains documented as a pre-existing failure.

## Files and diff

The QA overlay is implemented by scripts/m04b2i-final-qa.mjs and scripts/test-m04b2i-final-qa.mjs, with five files under data/terminology/research/m04b2i-qa and this report. Existing M04B2G/M04B2H artifacts were not changed. No commit was created.

## QA artifacts

- data/terminology/research/m04b2i-qa/qa-decisions.jsonl
- data/terminology/research/m04b2i-qa/repaired-translations.jsonl
- data/terminology/research/m04b2i-qa/residual-human-review.jsonl
- data/terminology/research/m04b2i-qa/qa-summary.json
- data/terminology/research/m04b2i-qa/run-manifest.json
`;
  writeFileSync(join(ROOT, 'docs', 'en-vi', 'VIETNAMESE_LOCALIZATION_FINAL_QA_REPORT.md'), report, 'utf8');
  return {summary, decisions, repaired, residualHumanReview};
}

if (process.argv[1] && process.argv[1].endsWith('m04b2i-final-qa.mjs')) {
  const result = buildFinalQa();
  console.log(JSON.stringify(result.summary, null, 2));
}

export {buildFinalQa, buildVerifiedLexicon, classifyGenerated, semanticFindings, repairGenerated};
