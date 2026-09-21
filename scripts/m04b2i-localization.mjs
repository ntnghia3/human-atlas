import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS_PATH = join(ROOT, 'public', 'models', 'atlas.json');
const B2H_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2h');
const OUT_DIR = join(ROOT, 'data', 'terminology', 'research', 'm04b2i');
const TOTAL = 3432;
const EVIDENCE_STATUSES = ['VERIFIED', 'PROVISIONAL_SOURCED', 'PROVISIONAL_TRANSLATED', 'NO_TRANSLATION_AVAILABLE'];
const TRANSLATION_METHODS = ['DIRECT_SOURCE', 'MULTI_AUTHORITY', 'CONTROLLED_DERIVED', 'SOURCE_CANDIDATE', 'GENERATED_TRANSLATION'];
const QUALITY_CHECKS = [
  'UNTRANSLATED_ENGLISH_RESIDUE',
  'MISSING_LATERALITY',
  'DUPLICATED_ANATOMICAL_HEAD',
  'REVERSED_LEFT_RIGHT',
  'REVERSED_SUPERIOR_INFERIOR',
  'REVERSED_ANTERIOR_POSTERIOR',
  'MALFORMED_VIETNAMESE_WORD_ORDER',
  'ENGLISH_VIETNAMESE_MIXTURE',
  'INCONSISTENT_COMPONENT_TRANSLATION',
  'SUSPICIOUS_LEXICON_INCONSISTENCY',
];

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readJsonl(path) { return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function writeJsonl(path, values) { writeFileSync(path, values.map(value => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), 'utf8'); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function sha256File(path) { return sha256(readFileSync(path)); }
function gitValue(args, fallback = null) { try { return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim(); } catch { return fallback; } }
function unique(values) { return [...new Set(values.filter(value => value !== undefined && value !== null && String(value).trim() !== ''))]; }
function cleanText(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function normalizeEnglish(value) { return cleanText(value).toLocaleLowerCase('en').replace(/[()[\],;:]/g, ' ').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeVietnamese(value) { return cleanText(value).replace(/\s+([,.;:)])/g, '$1'); }
function normalizeSourceVietnamese(value) { return normalizeVietnamese(value).replace(/^Cấu trúc\s+/i, '').replace(/^Toàn bộ\s+/i, '').replace(/\s*\(cấu trúc cơ thể\)$/i, '').trim(); }
function asciiKey(value) { return normalizeVietnamese(value).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function sourceRefValues(candidate) { return unique(candidate?.sourceClaims ?? []); }
function provenanceFor(candidate) {
  const seen = new Set();
  return (candidate?.provenance ?? []).filter(item => item && typeof item === 'object' && item.sourceId).map(item => ({
    sourceId: item.sourceId, sourceRevision: item.sourceRevision ?? null, sourceEdition: item.sourceEdition ?? null, locator: item.locator ?? null,
  })).filter(item => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; });
}
function isPlausibleSourceTerm(value) {
  const text = cleanText(value);
  if (!text || text.length > 120) return false;
  const lower = text.toLocaleLowerCase('vi');
  if (/\b(?:được bỏ|vốn|bởi vì|được gọi|theo|từ .+ được)\b/.test(lower)) return false;
  if (/[.!?]{2,}/.test(text)) return false;
  return true;
}
function selectCandidate(candidates) {
  const plausible = candidates.filter(candidate => isPlausibleSourceTerm(candidate?.vietnamese));
  const pool = plausible.length ? plausible : candidates;
  return [...pool].sort((a, b) => {
    const ar = {sources: new Set((a.provenance ?? []).map(item => item?.sourceId).filter(Boolean)).size, length: cleanText(a.vietnamese).length, index: candidates.indexOf(a), key: asciiKey(a.vietnamese)};
    const br = {sources: new Set((b.provenance ?? []).map(item => item?.sourceId).filter(Boolean)).size, length: cleanText(b.vietnamese).length, index: candidates.indexOf(b), key: asciiKey(b.vietnamese)};
    return br.sources - ar.sources || ar.length - br.length || ar.index - br.index || ar.key.localeCompare(br.key, 'vi');
  })[0];
}
function compactProvenance(candidates) {
  const seen = new Set();
  return candidates.flatMap(candidate => provenanceFor(candidate)).filter(item => {
    const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true;
  });
}
function sourceCandidateRecord(record) {
  const candidates = record.candidates ?? [];
  const chosen = selectCandidate(candidates);
  if (!chosen || !cleanText(chosen.vietnamese)) return null;
  return {
    vietnamese: normalizeVietnamese(chosen.vietnamese),
    sourceRefs: unique(candidates.flatMap(candidate => sourceRefValues(candidate))),
    componentEvidence: chosen.componentEvidence ?? [],
    compositionRuleId: chosen.compositionRuleId ?? null,
    blockers: unique([...record.blockers ?? [], ...candidates.flatMap(candidate => candidate.blockers ?? []),
      ...(record.candidateDisposition === 'SOURCE_CONFLICT' ? ['SOURCE_CONFLICT_PRESERVED_NO_WINNER'] : []),
      ...(record.candidateDisposition === 'SOURCE_VARIANT' ? ['SOURCE_VARIANT_PRESERVED_NO_WINNER'] : [])]),
    variants: unique(candidates.map(candidate => normalizeVietnamese(candidate.vietnamese))),
    provenance: compactProvenance(candidates),
  };
}
function candidateRecord(record) {
  const chosen = selectCandidate(record.candidates ?? []);
  if (!chosen || !cleanText(chosen.vietnamese)) return null;
  return {
    vietnamese: normalizeVietnamese(chosen.vietnamese),
    sourceRefs: sourceRefValues(chosen),
    componentEvidence: chosen.componentEvidence ?? [],
    compositionRuleId: chosen.compositionRuleId ?? null,
    blockers: unique([...record.blockers ?? [], ...chosen.blockers ?? []]),
    variants: unique((record.candidates ?? []).map(item => normalizeVietnamese(item.vietnamese))),
    provenance: provenanceFor(chosen),
  };
}
function addMap(map, key, value) {
  if (!key || !value) return;
  const values = map.get(key) ?? [];
  if (!values.some(item => item.vietnamese === value.vietnamese)) values.push(value);
  map.set(key, values);
}
function stableLexiconValue(entry) {
  const terms = unique(entry.vietnameseRealizations ?? []).map(normalizeVietnamese);
  if (terms.length !== 1 || (entry.ambiguities ?? []).length > 0) return null;
  return terms[0];
}
function addCorpusEvidence(map, key, value) {
  if (!key || !value?.vietnamese) return;
  const values = map.get(key) ?? [];
  if (!values.some(item => item.vietnamese === value.vietnamese)) values.push(value);
  map.set(key, values);
}
function buildTranslationLexicon(records, lexiconDocument, rulesDocument, corpusRows) {
  const phrases = new Map(), tokens = new Map();
  for (const record of records.filter(item => item.evidenceStatus === 'VERIFIED')) addMap(phrases, normalizeEnglish(record.english), {
    vietnamese: record.vietnamese, origin: 'VERIFIED_TERM', sourceEvidenceIds: record.sourceRefs, compositionRuleId: record.compositionRuleId,
  });
  for (const entry of lexiconDocument.components ?? []) {
    const vietnamese = stableLexiconValue(entry);
    if (!vietnamese || !entry.englishComponent) continue;
    const key = normalizeEnglish(entry.englishComponent);
    const value = {vietnamese, origin: 'VERIFIED_LEXICON', sourceEvidenceIds: unique(entry.sourceEvidenceIds ?? []), compositionRuleId: null};
    addMap(phrases, key, value);
    if (!key.includes(' ')) addMap(tokens, key, value);
  }
  for (const rule of rulesDocument.rules ?? []) {
    if (!rule.enabled) continue;
    for (const component of rule.requiredComponents ?? []) {
      if (!component.englishComponent || !component.vietnameseRealization) continue;
      const key = normalizeEnglish(component.englishComponent);
      const value = {vietnamese: normalizeVietnamese(component.vietnameseRealization), origin: 'VERIFIED_RULE', sourceEvidenceIds: unique(component.sourceEvidenceIds ?? []), compositionRuleId: rule.ruleId};
      addMap(phrases, key, value);
      if (!key.includes(' ')) addMap(tokens, key, value);
    }
  }
  const corpusPhrases = new Map(), corpusTokens = new Map();
  for (const row of corpusRows) {
    const englishValues = [row.english?.preferred, ...(row.english?.aliases ?? [])].filter(Boolean);
    const vietnamese = normalizeSourceVietnamese(row.vietnamese?.preferred ?? row.sourceVietnameseRaw ?? row.vietnameseTerm);
    if (!vietnamese) continue;
    for (const english of englishValues) {
      const key = normalizeEnglish(english.replace(/\s*\(body structure\)\s*$/i, '').replace(/^structure of\s+/i, ''));
      if (!key) continue;
      const value = {vietnamese, origin: 'SOURCE_CORPUS', sourceEvidenceIds: [], compositionRuleId: null};
      addCorpusEvidence(corpusPhrases, key, value);
      if (!key.includes(' ')) addCorpusEvidence(corpusTokens, key, value);
    }
  }
  const uniqueMap = (map, allowSourceChoice = false) => new Map([...map].flatMap(([key, values]) => {
    if (values.length === 1) return [[key, values[0]]];
    if (!allowSourceChoice || values.some(value => !['SOURCE_CORPUS'].includes(value.origin))) return [];
    const chosen = [...values].sort((a, b) => a.vietnamese.length - b.vietnamese.length || asciiKey(a.vietnamese).localeCompare(asciiKey(b.vietnamese), 'vi'))[0];
    return chosen ? [[key, {...chosen, origin: 'SOURCE_CORPUS_CONFLICT'}]] : [];
  }));
  const sourcePhraseMap = uniqueMap(corpusPhrases, true), sourceTokenMap = uniqueMap(corpusTokens, true);
  for (const [key, value] of sourcePhraseMap) if (!phrases.has(key)) phrases.set(key, [value]);
  for (const [key, value] of sourceTokenMap) if (!tokens.has(key)) tokens.set(key, [value]);
  const fallbackTokens = new Map(Object.entries(BEST_EFFORT_TOKENS).map(([key, vietnamese]) => [key, {vietnamese, origin: 'BEST_EFFORT', sourceEvidenceIds: [], compositionRuleId: null}]));
  for (const [key, value] of fallbackTokens) if (!tokens.has(key)) tokens.set(key, [value]);
  return {phrases: uniqueMap(phrases, true), tokens: uniqueMap(tokens, true)};
}

// These are deliberately a lower-precedence, source-free vocabulary for residual
// composition. They are never copied into sourceRefs and always remain provisional.
const BEST_EFFORT_TOKENS = {
  of: 'của', branch: 'nhánh', segment: 'đoạn', segmental: 'phân đoạn', part: 'phần', subdivision: 'phân khu', set: 'tập hợp', tributary: 'nhánh đổ vào', tree: 'cây', vascular: 'mạch máu', variant: 'biến thể', anastomosis: 'miệng nối', arch: 'cung', conus: 'nón', ventricular: 'thất', interventricular: 'liên thất', septal: 'vách', coronary: 'vành', common: 'chung', anterior: 'trước', posterior: 'sau', superior: 'trên', inferior: 'dưới', lateral: 'bên', medial: 'giữa', internal: 'trong', external: 'ngoài', proximal: 'gần', distal: 'xa', superficial: 'nông', deep: 'sâu',
  artery: 'động mạch', arterial: 'động mạch', arteries: 'động mạch', vein: 'tĩnh mạch', veins: 'tĩnh mạch', venous: 'tĩnh mạch', nerve: 'thần kinh', muscle: 'cơ', musculature: 'cơ', bone: 'xương', ligament: 'dây chằng', tendon: 'gân', cartilage: 'sụn', fascia: 'mạc', membrane: 'màng', gland: 'tuyến', organ: 'cơ quan', component: 'thành phần', tissue: 'mô',
  hepatic: 'gan', liver: 'gan', palmar: 'gan tay', phalanx: 'đốt ngón', cerebral: 'não', cerebellar: 'tiểu não', cerebral: 'não', finger: 'ngón tay', toe: 'ngón chân', digital: 'ngón', secondary: 'thứ cấp', tooth: 'răng', proper: 'chính', bronchial: 'phế quản', bronchopulmonary: 'phế quản-phổi', pulmonary: 'phổi', hemiazygos: 'bán đơn', azygos: 'đơn', accessory: 'phụ',
  foot: 'bàn chân', hand: 'bàn tay', upper: 'trên', lower: 'dưới', middle: 'giữa', first: 'thứ nhất', second: 'thứ hai', third: 'ba', fourth: 'tư', fifth: 'năm', sixth: 'sáu', seventh: 'bảy', eighth: 'tám', ninth: 'chín', tenth: 'mười', eleventh: 'mười một', twelfth: 'mười hai',
  rib: 'xương sườn', vertebra: 'đốt sống', thoracic: 'ngực', lumbar: 'thắt lưng', cervical: 'cổ', zone: 'vùng', region: 'vùng', neuraxis: 'trục thần kinh', symphysis: 'khớp', compartment: 'khoang', acromial: 'mỏm cùng vai', digiti: 'ngón', minimi: 'út', basal: 'đáy', apical: 'đỉnh', lobe: 'thùy', lobar: 'thùy', segmental: 'phân đoạn', subsegmental: 'dưới phân đoạn', portal: 'cửa', renal: 'thận', biliary: 'mật',
  flexor: 'gấp', plantar: 'gan chân', disk: 'đĩa', intervertebral: 'gian đốt sống', lumbar: 'thắt lưng', limb: 'chi', symphysis: 'khớp', deep: 'sâu', proper: 'chính',
  flexor: 'gấp', extensor: 'duỗi', adductor: 'khép', abductor: 'dạng', pronator: 'sấp', supinator: 'ngửa', rotator: 'xoay', constrictor: 'khít',
  pectoral: 'ngực', pectoralis: 'ngực', temporal: 'thái dương', occipital: 'chẩm', cerebral: 'não', hemisphere: 'bán cầu', gyrus: 'hồi', sulcus: 'rãnh', cortex: 'vỏ', matter: 'chất', white: 'trắng', caudate: 'đuôi', forebrain: 'não trước', colliculus: 'củ',
  trunk: 'thân', head: 'đầu', neck: 'cổ', thorax: 'ngực', cavity: 'khoang', wall: 'thành', chamber: 'buồng', content: 'nội dung', layer: 'lớp', body: 'thân', compartment: 'khoang',
  ventricle: 'tâm thất', atrium: 'tâm nhĩ', cardiac: 'tim', valve: 'van', cusp: 'lá', papillary: 'nhú', myocardium: 'cơ tim', coronary: 'vành',
  lingular: 'lưỡi', apical: 'đỉnh', basal: 'đáy', lobar: 'thùy', duct: 'ống', capsule: 'bao', plate: 'bản', layer: 'lớp', sector: 'vùng', division: 'ngành', cluster: 'cụm', system: 'hệ', skeleton: 'bộ xương', organ: 'cơ quan', anatomical: 'giải phẫu',
  flexor: 'gấp', palmar: 'gan tay', plantar: 'gan chân', finger: 'ngón tay', toe: 'ngón chân', phalanx: 'đốt ngón', metatarsal: 'bàn chân', tarsal: 'cổ chân', wrist: 'cổ tay', forearm: 'cẳng tay', arm: 'cánh tay', thigh: 'đùi', leg: 'cẳng chân', chest: 'ngực', abdomen: 'bụng', abdominal: 'bụng', femoral: 'đùi', brachial: 'cánh tay', humeral: 'cánh tay', brachium: 'cánh tay',
  iliac: 'chậu', iliococcygeus: 'chậu-cụt', iliocostalis: 'chậu-sườn', femoris: 'đùi', fibularis: 'mác', radialis: 'quay', radial: 'quay', ulnar: 'trụ', ulnaris: 'trụ', brachii: 'cánh tay', carpi: 'cổ tay', thoracis: 'ngực', costarum: 'sườn', clavicular: 'đòn', cricothyroid: 'nhẫn-giáp', gemellus: 'sinh đôi', gastrocnemius: 'bụng chân', triceps: 'tam đầu', biceps: 'nhị đầu', trapezius: 'thang', longus: 'dài', short: 'ngắn', long: 'dài', intermediate: 'giữa', central: 'trung tâm', oblique: 'chéo', transverse: 'ngang', dorsal: 'lưng', investing: 'bao phủ', free: 'tự do', major: 'lớn', little: 'út', big: 'lớn',
  ciliary: 'mi', choroidal: 'mạch mạc', eyeball: 'nhãn cầu', eyelid: 'mi mắt', lacrimal: 'lệ', nose: 'mũi', orbital: 'ổ mắt', pharyngeal: 'hầu', pharynx: 'hầu', vocal: 'thanh âm', pontine: 'cầu', communicating: 'thông', intrapulmonary: 'trong phổi', systemic: 'toàn thân', hepatovenous: 'gan-tĩnh mạch', ileocolic: 'hồi-đại tràng',
  aorta: 'động mạch chủ', descending: 'xuống', free: 'tự do', fibrous: 'xơ', plate: 'bản', proper: 'chính', medial: 'giữa', lateral: 'bên',
  anterolateral: 'trước-bên', posteromedial: 'sau-giữa', intermediomedial: 'giữa-trong', paracentral: 'cạnh trung tâm', precommunicating: 'trước thông', postcommunicating: 'sau thông', terminal: 'tận', hypothalamic: 'hạ đồi', frontobasal: 'trước-đáy', callosomarginal: 'chai-bờ', pericallosal: 'quanh chai', temporo: 'thái dương', occipital: 'chẩm', splenial: 'lách', insular: 'đảo', sphenoid: 'bướm', optic: 'thị', retina: 'võng mạc', eye: 'mắt',
  shoulder: 'vai', girdle: 'đai', cuneiform: 'xương chêm', triquetral: 'xương tháp', cuboid: 'xương hộp', carpal: 'cổ tay', metacarpal: 'bàn tay', bony: 'xương', cartilaginous: 'sụn',
  brevis: 'ngắn', longus: 'dài', lumborum: 'thắt lưng', cervicis: 'cổ', colli: 'cổ', teres: 'tròn', accessorius: 'phụ', lumbrical: 'giun', interosseous: 'gian cốt', interossei: 'gian cốt', hallucis: 'ngón cái', pollicis: 'ngón cái', opponens: 'đối chiếu', levatores: 'cơ nâng', interspinalis: 'liên gai', intertransversarius: 'liên ngang', semispinalis: 'bán gai', scalenus: 'bậc thang', deltoid: 'delta', tensor: 'cơ căng', vastus: 'rộng', rectus: 'thẳng', pectoral: 'ngực', larynx: 'thanh quản', outflow: 'dòng ra', inflow: 'dòng vào', postvertebral: 'sau đốt sống', intrinsic: 'nội tại', extrinsic: 'ngoại tại', stria: 'dải', fornix: 'vòm', septum: 'vách', gray: 'xám', spinal: 'tủy', jaw: 'hàm', tongue: 'lưỡi', nose: 'mũi', mouth: 'miệng',
  intrinsic: 'nội tại', extrinsic: 'ngoại tại', tendinous: 'gân', elasticus: 'đàn hồi', trochlea: 'ròng rọc', check: 'hãm', ring: 'vòng', cardinal: 'chính', sector: 'vùng', cluster: 'cụm', space: 'khoang', conduit: 'ống dẫn', cage: 'lồng', with: 'với', to: 'đến', in: 'trong',
  typical: 'điển hình', atypical: 'không điển hình', perineal: 'đáy chậu', portion: 'phần', line: 'đường', continuity: 'liên tục', atlas: 'đốt đội', rhomboid: 'trám', serratus: 'răng trước', mesentery: 'mạc treo', coeliac: 'tạng', celiac: 'tạng', gastro: 'dạ dày', epiploic: 'mạc nối', great: 'lớn', pancreatic: 'tụy', caudal: 'đuôi', ileal: 'hồi tràng', marginal: 'bờ', colic: 'đại tràng', colon: 'đại tràng', rectal: 'trực tràng', sacrum: 'xương cùng', piriformis: 'hình lê', coccygeus: 'cụt', levator: 'nâng', ani: 'hậu môn', deferent: 'tinh', peritoneum: 'phúc mạc', irregular: 'không đều', connective: 'liên kết', mucoid: 'nhầy', cavernous: 'hang', nonskeletal: 'không xương', prevertebral: 'trước đốt sống', obliquus: 'chéo', suboccipital: 'dưới chẩm', sternocostal: 'ức-sườn', pectoralis: 'ngực', genicular: 'gối', parenchyma: 'nhu mô', aryepiglotticus: 'phễu-thanh thiệt', straight: 'thẳng', palatopharyngeus: 'khẩu cái-hầu', ocular: 'nhãn cầu', extra: 'ngoài', vermian: 'nhộng', trigeminal: 'sinh ba', ethmoid: 'sàng', pubic: 'mu', hair: 'lông', laryngopharynx: 'họng-thanh quản', parenchymatous: 'nhu mô', lobular: 'tiểu thùy', corticomedullary: 'vỏ-tủy', nonparenchymatous: 'không nhu mô', solid: 'đặc', cavitated: 'có khoang', hollow: 'rỗng', neural: 'thần kinh', auriculotemporal: 'tai-thái dương', suspensory: 'treo', lens: 'thể thủy tinh', lake: 'hồ', pineal: 'tùng', chiasm: 'giao thoa', diencephalon: 'gian não', peduncle: 'cuống', tectum: 'mái', dorsal: 'lưng', network: 'mạng', entity: 'thực thể', serous: 'thanh mạc', gluteal: 'mông', heterogeneous: 'không đồng nhất', dorsum: 'mu', autonomic: 'tự chủ', articular: 'khớp', leaf: 'lá', process: 'mỏm', lamina: 'phiến', subsuperior: 'dưới trên', laterobasal: 'bên-đáy', mediobasal: 'giữa-đáy', perforating: 'xuyên', pudendal: 'thẹn', ureteric: 'niệu quản', epidermis: 'biểu bì', facial: 'mặt', oesophageal: 'thực quản', esophageal: 'thực quản', calcaneal: 'gót', tibial: 'chày', prehepatic: 'trước gan', intracranial: 'trong sọ', circumflex: 'mũ', vena: 'tĩnh mạch', caval: 'chủ', canal: 'ống', cord: 'dây', organ: 'cơ quan', cell: 'tế bào', nuclear: 'nhân', subarachnoid: 'dưới nhện', incisure: 'khuyết', alimentary: 'tiêu hóa', axial: 'trục', lung: 'phổi', hemiliver: 'nửa gan', human: 'người', sternal: 'ức', hip: 'hông', frontal: 'trán', skull: 'sọ', basicranium: 'nền sọ', orbit: 'hốc mắt', neurocranium: 'sọ thần kinh', viscerocranium: 'sọ mặt', uvula: 'lưỡi gà', mandibular: 'hàm dưới', maxillary: 'hàm trên', faucial: 'hầu miệng', back: 'sau', urinary: 'tiết niệu', pelvic: 'chậu', integument: 'da', fascial: 'mạc', patellar: 'bánh chè', pulmopleural: 'phổi-màng phổi', vasculature: 'mạch máu', subcortex: 'dưới vỏ', archicortex: 'vỏ cổ', prefrontal: 'trước trán', hippocampal: 'hải mã', pancreaticobiliary: 'tụy-mật', basicranial: 'nền sọ',
  thalamogeniculate: 'gối-đồi thị', myocardiac: 'cơ tim', myocardial: 'cơ tim', amygdala: 'hạnh nhân', fusiform: 'hình thoi', choroid: 'mạch mạc', plexus: 'đám rối', forebrain: 'não trước', medullaris: 'tủy', thalamus: 'đồi thị', pericallosal: 'quanh chai', laryngopharyngeal: 'họng-thanh quản', anal: 'hậu môn', sphincter: 'cơ thắt', medial: 'giữa', collateral: 'bên', ascending: 'lên', descending: 'xuống', sternocostal: 'ức-sườn', apicoposterior: 'đỉnh-sau', subaortic: 'dưới động mạch chủ', curtain: 'màn', upper: 'trên', urinary: 'tiết niệu', nervous: 'thần kinh', tract: 'đường', formation: 'thể', zone: 'vùng', region: 'vùng', terminal: 'tận',
  intercostal: 'liên sườn', cranial: 'sọ', parasympathetic: 'đối giao cảm', subsector: 'phân vùng', peritoneal: 'phúc mạc', quadriceps: 'tứ đầu', tertius: 'ba', fasciae: 'mạc', lata: 'rộng', latae: 'rộng', navicular: 'thuyền', capitis: 'đầu', lumbricals: 'giun', fibular: 'mác', arteria: 'động mạch', princeps: 'chính', indicis: 'ngón trỏ', index: 'trỏ', thoraco: 'ngực', acromial: 'mỏm cùng vai', vertical: 'dọc', precentral: 'trước trung tâm', postcentral: 'sau trung tâm', boundary: 'ranh giới', pre: 'trước', hepatic: 'gan', oculomotor: 'vận nhãn', cavitated: 'có khoang', parts: 'phần', epithelium: 'biểu mô', metencephalon: 'não sau', hairs: 'lông', dura: 'màng cứng', mater: 'màng', interspinales: 'liên gai', longi: 'dài', intertransversarii: 'liên ngang', branches: 'nhánh', lobule: 'tiểu thùy', nucleus: 'nhân', nuclei: 'nhân', complex: 'phức hợp', circumventricular: 'quanh não thất', cranial: 'sọ', scapular: 'vai', osseous: 'xương', parietal: 'đỉnh', metencephalon: 'não sau', inferomedial: 'dưới-giữa', antero: 'trước', thyrocervical: 'giáp-cổ', costocervical: 'sườn-cổ', vertebrae: 'đốt sống', limbic: 'viền', subendocardial: 'dưới nội tâm mạc', intercostal: 'liên sườn', in: 'trong', vivo: 'sống', ii: 'hai', iii: 'ba', iv: 'bốn', v: 'năm', vi: 'sáu', vii: 'bảy', viii: 'tám', ix: 'chín', '4': 'bốn', '11': 'mười một', '12': 'mười hai', medialis: 'giữa', precuneal: 'tiền chêm', commissure: 'mép', side: 'bên', organs: 'cơ quan', regions: 'vùng', clusters: 'cụm', breves: 'ngắn', subdivisionof: 'phân khu của',
};
const MODIFIER_RULES = new Map([
  ['right', 'M04B2H-LATERALITY-SUFFIX-001'], ['left', 'M04B2H-LATERALITY-SUFFIX-001'],
  ['superior', 'M04B2H-SUPERIOR-INFERIOR-SUFFIX-001'], ['inferior', 'M04B2H-SUPERIOR-INFERIOR-SUFFIX-001'],
  ['anterior', 'M04B2H-ANTERIOR-POSTERIOR-SUFFIX-001'], ['posterior', 'M04B2H-ANTERIOR-POSTERIOR-SUFFIX-001'],
  ['first', 'M04B2H-ORDINAL-SUFFIX-001'], ['second', 'M04B2H-ORDINAL-SUFFIX-001'],
  ['third', 'M04B2H-ORDINAL-SUFFIX-001'], ['fourth', 'M04B2H-ORDINAL-SUFFIX-001'],
]);
function translateResidual(english, lexicon) {
  const key = normalizeEnglish(english);
  const exact = lexicon.phrases.get(key);
  if (exact && !qualityFindings(english, exact.vietnamese).some(code => ['MISSING_LATERALITY', 'MISSING_SUPERIOR_INFERIOR', 'MISSING_ANTERIOR_POSTERIOR'].includes(code))) return {vietnamese: exact.vietnamese, generatedFromVerifiedLexicon: ['VERIFIED_LEXICON', 'VERIFIED_TERM', 'VERIFIED_RULE'].includes(exact.origin), components: [{english, vietnamese: exact.vietnamese, origin: exact.origin, sourceEvidenceIds: exact.sourceEvidenceIds}], ruleOrReasoningSummary: 'Exact term reused from the accepted Vietnamese lexicon.', compositionRuleId: exact.compositionRuleId};
  const tokens = key.split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const modifierRule = MODIFIER_RULES.get(tokens[0]);
  if (modifierRule && lexicon.tokens.has(tokens[0])) {
    const base = translateResidual(tokens.slice(1).join(' '), lexicon);
    if (base) {
      const modifier = lexicon.tokens.get(tokens[0]);
      return {vietnamese: `${base.vietnamese} ${modifier.vietnamese}`.trim(), generatedFromVerifiedLexicon: base.generatedFromVerifiedLexicon, components: [{english: tokens[0], vietnamese: modifier.vietnamese, origin: modifier.origin, sourceEvidenceIds: modifier.sourceEvidenceIds}, ...base.components], ruleOrReasoningSummary: `Applied the source-demonstrated suffix realization for ${tokens[0]}.`, compositionRuleId: modifierRule};
    }
  }
  const components = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    let match = null;
    for (let length = Math.min(4, tokens.length - cursor); length >= 1; length -= 1) {
      const phrase = tokens.slice(cursor, cursor + length).join(' ');
      const value = lexicon.phrases.get(phrase) ?? (length === 1 ? lexicon.tokens.get(phrase) : null);
      if (value) { match = {length, value, phrase}; break; }
    }
    if (!match) return null;
    components.push({english: match.phrase, vietnamese: match.value.vietnamese, origin: match.value.origin, sourceEvidenceIds: match.value.sourceEvidenceIds});
    cursor += match.length;
  }
  if (!components.length) return null;
  return {vietnamese: components.map(item => item.vietnamese).join(' ').replace(/\s+/g, ' ').trim(), generatedFromVerifiedLexicon: components.every(item => ['VERIFIED_LEXICON', 'VERIFIED_TERM', 'VERIFIED_RULE'].includes(item.origin)), components, ruleOrReasoningSummary: 'Composed from stable Vietnamese components observed in accepted terminology evidence.', compositionRuleId: null};
}
function qualityFindings(english, vietnamese) {
  const findings = [];
  const en = normalizeEnglish(english), vi = normalizeVietnamese(vietnamese);
  if (!vi) findings.push('BLANK_VIETNAMESE');
  if (normalizeEnglish(vi) === en) findings.push('UNTRANSLATED_ENGLISH_RESIDUE');
  if (/\b(right|left|superior|inferior|anterior|posterior|medial|lateral|internal|external|proximal|distal|superficial|deep)\b/i.test(vi)) findings.push('ENGLISH_VIETNAMESE_MIXTURE');
  if (/\b(artery|arteries|vein|veins|nerve|muscle|bone|ligament|tendon|cartilage|fascia|gland|arterial|venous)\b/i.test(vi)) findings.push('ENGLISH_VIETNAMESE_MIXTURE');
  if (/\b(left|right)\b/i.test(en) && !/\b(phải|trái)\b/.test(vi)) findings.push('MISSING_LATERALITY');
  if (/\b(superior|inferior)\b/i.test(en) && !/\b(trên|dưới)\b/.test(vi)) findings.push('MISSING_SUPERIOR_INFERIOR');
  if (/\b(anterior|posterior)\b/i.test(en) && !/\b(trước|sau)\b/.test(vi)) findings.push('MISSING_ANTERIOR_POSTERIOR');
  const hasLeft = /\bleft\b/i.test(en), hasRight = /\bright\b/i.test(en), hasTrai = /\btrái\b/.test(vi), hasPhai = /\bphải\b/.test(vi);
  if (hasLeft && !hasRight && hasPhai && !hasTrai) findings.push('REVERSED_LEFT_RIGHT');
  if (hasRight && !hasLeft && hasTrai && !hasPhai) findings.push('REVERSED_LEFT_RIGHT');
  const hasSuperior = /\bsuperior\b/i.test(en), hasInferior = /\binferior\b/i.test(en), hasTren = /\btrên\b/.test(vi), hasDuoi = /\bdưới\b/.test(vi);
  if (hasSuperior && !hasInferior && hasDuoi && !hasTren) findings.push('REVERSED_SUPERIOR_INFERIOR');
  if (hasInferior && !hasSuperior && hasTren && !hasDuoi) findings.push('REVERSED_SUPERIOR_INFERIOR');
  const hasAnterior = /\banterior\b/i.test(en), hasPosterior = /\bposterior\b/i.test(en), hasTruoc = /\btrước\b/.test(vi), hasSau = /\bsau\b/.test(vi);
  if (hasAnterior && !hasPosterior && hasSau && !hasTruoc) findings.push('REVERSED_ANTERIOR_POSTERIOR');
  if (hasPosterior && !hasAnterior && hasTruoc && !hasSau) findings.push('REVERSED_ANTERIOR_POSTERIOR');
  if (/(?:^|\s)(động mạch|tĩnh mạch|thần kinh|cơ|xương|dây chằng|gân|sụn|mạch máu)\s+\1(?:$|\s)/iu.test(vi)) findings.push('DUPLICATED_ANATOMICAL_HEAD');
  if (/(?:^|\s)(của|với|đến)\s+(động mạch|tĩnh mạch|thần kinh|cơ|xương)(?:$|\s)/iu.test(vi) || /(?:^|\s)(của|với|đến|trong)\s+\1(?:$|\s)/iu.test(vi)) findings.push('MALFORMED_VIETNAMESE_WORD_ORDER');
  return unique(findings);
}

function buildRecords() {
  const atlas = readJson(ATLAS_PATH);
  const candidates = readJsonl(join(B2H_DIR, 'concept-candidates.jsonl'));
  const lexiconDocument = readJson(join(B2H_DIR, 'authority-component-lexicon.json'));
  const rulesDocument = readJson(join(B2H_DIR, 'composition-rules.json'));
  if (atlas.concepts.length !== TOTAL || candidates.length !== TOTAL) throw new Error(`Expected ${TOTAL} atlas and M04B2H rows`);
  const candidateById = new Map(candidates.map(record => [record.conceptId, record]));
  const provisionalSourced = [];
  const baseRecords = [];
  for (const concept of atlas.concepts) {
    const record = candidateById.get(concept.id);
    if (!record) throw new Error(`Missing M04B2H record for ${concept.id}`);
    const directType = record.candidates?.[0]?.candidateType;
    if (['DIRECT_SOURCE_TRANSLATION', 'MULTI_AUTHORITY_TRANSLATION', 'CONTROLLED_DERIVED_TRANSLATION'].includes(record.candidateDisposition) && !record.localizationReview) {
      const selected = candidateRecord(record);
      if (!selected) throw new Error(`Missing accepted Vietnamese candidate for ${concept.id}`);
      const method = directType === 'MULTI_AUTHORITY' || record.candidateDisposition === 'MULTI_AUTHORITY_TRANSLATION' ? 'MULTI_AUTHORITY' : directType === 'CONTROLLED_DERIVED' || record.candidateDisposition === 'CONTROLLED_DERIVED_TRANSLATION' ? 'CONTROLLED_DERIVED' : 'DIRECT_SOURCE';
      baseRecords.push({conceptId: concept.id, english: concept.name, vietnamese: selected.vietnamese, evidenceStatus: 'VERIFIED', translationMethod: method, sourceRefs: selected.sourceRefs, componentEvidence: selected.componentEvidence, compositionRuleId: selected.compositionRuleId, blockers: selected.blockers, variants: selected.variants.length > 1 ? selected.variants : [], verified: true, provenance: selected.provenance, sourceDisposition: record.candidateDisposition});
      continue;
    }
    if (record.localizationReview || record.candidateDisposition === 'SOURCE_VARIANT' || record.candidateDisposition === 'SOURCE_CONFLICT') {
      const selected = sourceCandidateRecord(record);
      if (selected) {
        const localized = {conceptId: concept.id, english: concept.name, vietnamese: selected.vietnamese, evidenceStatus: 'PROVISIONAL_SOURCED', translationMethod: 'SOURCE_CANDIDATE', sourceRefs: selected.sourceRefs, componentEvidence: selected.componentEvidence, compositionRuleId: selected.compositionRuleId, blockers: selected.blockers, variants: selected.variants, verified: false, provenance: selected.provenance, sourceDisposition: record.candidateDisposition, selectionRule: selected.variants.length > 1 ? 'DETERMINISTIC_SOURCE_COUNT_LENGTH_INPUT_ORDER' : null};
        baseRecords.push(localized); provisionalSourced.push(localized); continue;
      }
    }
    baseRecords.push({conceptId: concept.id, english: concept.name, residualDisposition: record.candidateDisposition, blockers: unique(record.blockers ?? [])});
  }
  const corpusPaths = [
    'm04b2e2r-nvh2008-exhaustive.jsonl',
    'm04b2e2r-moh2025-body-structure.jsonl',
    'hmu2022-attestations.jsonl',
    'ump2023-t2-bulk-attestations.jsonl',
  ].map(name => join(ROOT, 'data', 'terminology', 'research', 'corpora', name));
  const corpusRows = corpusPaths.flatMap(path => readJsonl(path));
  const lexicon = buildTranslationLexicon(baseRecords, lexiconDocument, rulesDocument, corpusRows);
  const generated = [], quality = [];
  const records = baseRecords.map(record => {
    if (record.evidenceStatus) return record;
    const translation = translateResidual(record.english, lexicon);
    if (translation && translation.vietnamese && normalizeEnglish(translation.vietnamese) !== normalizeEnglish(record.english)) {
      const findings = qualityFindings(record.english, translation.vietnamese);
      const generationMethod = translation.generatedFromVerifiedLexicon ? 'COMPONENT_COMPOSITION' : 'BEST_EFFORT_TRANSLATION';
      const localized = {conceptId: record.conceptId, english: record.english, vietnamese: translation.vietnamese, evidenceStatus: 'PROVISIONAL_TRANSLATED', translationMethod: 'GENERATED_TRANSLATION', sourceRefs: [], componentEvidence: translation.components, compositionRuleId: translation.compositionRuleId, blockers: unique(record.blockers ?? []), variants: [], verified: false, provenance: [], generatedFromVerifiedLexicon: translation.generatedFromVerifiedLexicon, generationMethod, ruleOrReasoningSummary: translation.ruleOrReasoningSummary, qualityFindings: findings, sourceDisposition: record.residualDisposition};
      generated.push({conceptId: localized.conceptId, english: localized.english, vietnamese: localized.vietnamese, method: localized.generationMethod, components: localized.componentEvidence, ruleOrReasoningSummary: localized.ruleOrReasoningSummary, evidenceStatus: localized.evidenceStatus, generatedFromVerifiedLexicon: localized.generatedFromVerifiedLexicon, sourceRefs: []});
      quality.push({conceptId: localized.conceptId, english: localized.english, vietnamese: localized.vietnamese, findings});
      return localized;
    }
    const fallback = {conceptId: record.conceptId, english: record.english, vietnamese: record.english, evidenceStatus: 'NO_TRANSLATION_AVAILABLE', translationMethod: 'GENERATED_TRANSLATION', sourceRefs: [], componentEvidence: [], compositionRuleId: null, blockers: unique([...(record.blockers ?? []), 'NO_TRANSLATION_AVAILABLE']), variants: [], verified: false, provenance: [], generatedFromVerifiedLexicon: false, generationMethod: 'ENGLISH_FALLBACK', ruleOrReasoningSummary: 'No defensible Vietnamese composition was available; the English atlas label is retained.', qualityFindings: ['NO_TRANSLATION_AVAILABLE'], sourceDisposition: record.residualDisposition};
    quality.push({conceptId: fallback.conceptId, english: fallback.english, vietnamese: fallback.vietnamese, findings: fallback.qualityFindings});
    return fallback;
  });
  const generatedById = new Map(generated.map(item => [item.conceptId, item]));
  const componentTranslations = new Map();
  for (const item of generated) {
    for (const component of item.components ?? []) {
      const key = normalizeEnglish(component.english);
      const values = componentTranslations.get(key) ?? new Map();
      values.set(asciiKey(component.vietnamese), component.vietnamese);
      componentTranslations.set(key, values);
    }
  }
  const stableComponentKeys = new Set((lexiconDocument.components ?? []).filter(entry => stableLexiconValue(entry)).map(entry => normalizeEnglish(entry.englishComponent)));
  for (const item of quality) {
    const generatedRecord = generatedById.get(item.conceptId);
    const findings = new Set(item.findings ?? []);
    for (const component of generatedRecord?.components ?? []) {
      const values = componentTranslations.get(normalizeEnglish(component.english));
      if (values && values.size > 1) findings.add('INCONSISTENT_COMPONENT_TRANSLATION');
      if (component.origin === 'BEST_EFFORT' && stableComponentKeys.has(normalizeEnglish(component.english))) findings.add('SUSPICIOUS_LEXICON_INCONSISTENCY');
    }
    item.findings = unique([...findings]);
    const localized = records.find(record => record.conceptId === item.conceptId);
    if (localized) localized.qualityFindings = item.findings;
  }
  const statusCounts = Object.fromEntries(EVIDENCE_STATUSES.map(status => [status, records.filter(record => record.evidenceStatus === status).length]));
  const methodCounts = Object.fromEntries(TRANSLATION_METHODS.map(method => [method, records.filter(record => record.translationMethod === method).length]));
  const summary = {schemaVersion: 'M04B2I-COVERAGE-SUMMARY-1', milestone: 'M04B2I', totalConcepts: TOTAL, processedConcepts: records.length, unclassifiedConcepts: records.filter(record => !EVIDENCE_STATUSES.includes(record.evidenceStatus)).length, primaryUiLocalizationClass: statusCounts, verified: statusCounts.VERIFIED, provisionalSourced: statusCounts.PROVISIONAL_SOURCED, provisionalTranslated: statusCounts.PROVISIONAL_TRANSLATED, noTranslationAvailable: statusCounts.NO_TRANSLATION_AVAILABLE, vietnameseUiCoverage: statusCounts.VERIFIED + statusCounts.PROVISIONAL_SOURCED + statusCounts.PROVISIONAL_TRANSLATED, vietnameseUiCoveragePercentage: Number((((statusCounts.VERIFIED + statusCounts.PROVISIONAL_SOURCED + statusCounts.PROVISIONAL_TRANSLATED) / TOTAL) * 100).toFixed(2)), translationMethods: methodCounts, generatedByComponentComposition: records.filter(record => record.generationMethod === 'COMPONENT_COMPOSITION').length, generatedByBestEffortTranslation: records.filter(record => record.evidenceStatus === 'PROVISIONAL_TRANSLATED' && record.generationMethod !== 'COMPONENT_COMPOSITION').length, sourceConflicts: records.filter(record => record.sourceDisposition === 'SOURCE_CONFLICT').length, sourceVariants: records.filter(record => record.sourceDisposition === 'SOURCE_VARIANT').length, englishOnlyFallback: records.filter(record => record.evidenceStatus === 'NO_TRANSLATION_AVAILABLE').length, quality: {generatedRecords: generated.length, flaggedRecords: quality.filter(item => item.findings.length > 0).length, findings: Object.fromEntries(unique(quality.flatMap(item => item.findings)).map(code => [code, quality.filter(item => item.findings.includes(code)).length])), checks: QUALITY_CHECKS}, productionSafety: {searchableVietnamese: 0, sourceVerified: 0, medicallyReviewed: 0, releaseEligible: 0, release: 'UNRELEASED'}, policy: {historicalM04B2GAndM04B2HImmutable: true, generatedSourceRefs: [], generatedVerified: false, conflictSelectionRule: 'DETERMINISTIC_SOURCE_COUNT_LENGTH_INPUT_ORDER', releasePromotion: false}};
  return {atlas, records, generated, quality, summary, provisionalSourced, inputs: {lexiconDocument, rulesDocument}};
}

function report(summary, records) {
  const examples = status => records.filter(record => record.evidenceStatus === status).slice(0, 3).map(record => `- \`${record.english}\` → **${record.vietnamese}** (${record.conceptId})`).join('\n') || '- None';
  const methods = Object.entries(summary.translationMethods).map(([key, value]) => `| ${key} | ${value} |`).join('\n');
  return `# Vietnamese Full-Coverage Localization Report

M04B2I adds a research-only Vietnamese localization layer over all ${summary.totalConcepts.toLocaleString('en-US')} atlas concepts. M04B2G/M04B2H artifacts remain unchanged and the official release gate is unchanged.

## Accounting

| UI class | Concepts |
|---|---:|
| VERIFIED | ${summary.verified} |
| PROVISIONAL_SOURCED | ${summary.provisionalSourced} |
| PROVISIONAL_TRANSLATED | ${summary.provisionalTranslated} |
| NO_TRANSLATION_AVAILABLE | ${summary.noTranslationAvailable} |
| **Total** | **${summary.totalConcepts}** |

Vietnamese UI coverage is **${summary.vietnameseUiCoverage}/${summary.totalConcepts} (${summary.vietnameseUiCoveragePercentage}%)**; English-only fallback is ${summary.englishOnlyFallback}.

## Translation methods

| Method | Concepts |
|---|---:|
${methods}

Generated records use component composition for ${summary.generatedByComponentComposition} concepts and best-effort fallback composition for ${summary.generatedByBestEffortTranslation} concepts. Source conflicts: ${summary.sourceConflicts}; source variants: ${summary.sourceVariants}.

## Examples

### VERIFIED
${examples('VERIFIED')}

### PROVISIONAL_SOURCED
${examples('PROVISIONAL_SOURCED')}

### PROVISIONAL_TRANSLATED
${examples('PROVISIONAL_TRANSLATED')}

## UI and search

Vietnamese mode resolves VERIFIED, then PROVISIONAL_SOURCED, then PROVISIONAL_TRANSLATED, then English. The detail sheet keeps the English atlas label available and shows a small evidence badge. Source candidates show blockers and variants; generated terms say that no source has been identified. Search indexes all three Vietnamese classes while keeping English names and IDs searchable.

## Provenance and release

VERIFIED records retain direct, multi-authority, or controlled-derived provenance and rule IDs. PROVISIONAL_SOURCED records retain source claims, blockers, and every observed variant; their display selection is deterministic and is not an adjudication. Generated records have sourceRefs: [] and verified: false, and never create reviewer, SOURCE_VERIFIED, MEDICAL_REVIEWED, or release eligibility data. Official release remains UNRELEASED.

## Quality and artifacts

Quality review ran ${summary.quality.generatedRecords} generated records; ${summary.quality.flaggedRecords} records have one or more findings. Checks cover ${summary.quality.checks.join(', ')}. Findings are retained in quality-review.jsonl for review without blocking provisional UI display. Artifacts: localization-records.jsonl, localization-catalog.json, provisional-translations.jsonl, quality-review.jsonl, coverage-summary.json, run-manifest.json, scripts/m04b2i-localization.mjs, and scripts/test-m04b2i.mjs.
`;
}

export function buildM04B2I() {
  mkdirSync(OUT_DIR, {recursive: true});
  const result = buildRecords();
  const catalog = {schemaVersion: 'M04B2I-LOCALIZATION-CATALOG-1', milestone: 'M04B2I', totalConcepts: result.records.length, records: result.records};
  writeJsonl(join(OUT_DIR, 'localization-records.jsonl'), result.records);
  writeJson(join(OUT_DIR, 'localization-catalog.json'), catalog);
  writeJsonl(join(OUT_DIR, 'provisional-translations.jsonl'), result.generated);
  writeJsonl(join(OUT_DIR, 'quality-review.jsonl'), result.quality);
  writeJson(join(OUT_DIR, 'coverage-summary.json'), result.summary);
  writeFileSync(join(ROOT, 'docs', 'en-vi', 'VIETNAMESE_FULL_COVERAGE_LOCALIZATION_REPORT.md'), report(result.summary, result.records), 'utf8');
  const outputNames = ['localization-records.jsonl', 'localization-catalog.json', 'provisional-translations.jsonl', 'quality-review.jsonl', 'coverage-summary.json'];
  const manifest = {schemaVersion: 'M04B2I-RUN-MANIFEST-1', milestone: 'M04B2I', git: {branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD'])}, atlas: {path: 'public/models/atlas.json', conceptCount: result.atlas.concepts.length, sha256: sha256File(ATLAS_PATH)}, inputs: {conceptCandidates: {path: 'data/terminology/research/m04b2h/concept-candidates.jsonl', sha256: sha256File(join(B2H_DIR, 'concept-candidates.jsonl'))}, authorityComponentLexicon: {path: 'data/terminology/research/m04b2h/authority-component-lexicon.json', sha256: sha256File(join(B2H_DIR, 'authority-component-lexicon.json'))}, compositionRules: {path: 'data/terminology/research/m04b2h/composition-rules.json', sha256: sha256File(join(B2H_DIR, 'composition-rules.json'))}}, outputs: Object.fromEntries([...outputNames, 'run-manifest.json'].map(name => [name, `data/terminology/research/m04b2i/${name}`])), outputHashes: Object.fromEntries(outputNames.map(name => [`data/terminology/research/m04b2i/${name}`, sha256File(join(OUT_DIR, name))])), accounting: result.summary, productionSafety: result.summary.productionSafety};
  writeJson(join(OUT_DIR, 'run-manifest.json'), manifest);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = buildM04B2I();
  console.log(JSON.stringify({milestone: 'M04B2I', ...result.summary}, null, 2));
}
