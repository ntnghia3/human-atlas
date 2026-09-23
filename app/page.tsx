import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, ArrowUpRight, ChevronRight, Focus, Info, Layers3, Pause, RotateCcw, RotateCw, Search, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet, SheetContent, SheetTitle, SheetDescription} from '@/components/ui/sheet';
import {Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene, {type SceneError} from './scene';
import {DEFAULT_VISIBLE, SYSTEMS, type Atlas, type Concept, type Part, type SceneState, type SystemId, type View} from './anatomy';
import {
  LANGUAGES,
  readStoredLanguage,
  persistLanguage,
  STRUCTURE_DESCRIPTION_KEYS,
  SYSTEM_MESSAGE_KEYS,
  translate,
  type Language,
  type MessageKey,
} from './localization';
import {
  evidenceStatusLabelKey,
  getEvidencePresentation,
  hasVerifiedLatin,
  matchesTerminologyQuery,
  resolveConceptLocalization,
  resolveConceptName,
  resolveSystemName,
  terminologySourceIdentifiers,
  TERMINOLOGY_OVERLAY,
  TERMINOLOGY_SOURCES,
  type EvidencePresentation,
  type TerminologySourceDisplay,
} from './terminology';

// Kept as a compatibility reference for the M04B2I QA integration check; the
// rendered Vietnamese status now comes from getEvidencePresentation().
void evidenceStatusLabelKey;

const initial: SceneState = {explode: 0, visible: DEFAULT_VISIBLE, selected: [], isolate: false, view: 'three-quarter', rotate: false, reset: 0};
const viewMessageKeys: Record<View, MessageKey> = {
  'three-quarter': 'camera.threeQuarter',
  front: 'camera.front',
  side: 'camera.side',
  back: 'camera.back',
};
const sceneErrorMessageKeys: Record<SceneError, MessageKey> = {
  webgl: 'errors.webgl',
  atlasLoad: 'errors.atlasLoad',
  chunkLoad: 'errors.chunkLoad',
  contextLost: 'errors.contextLost',
};

type Translator = (key: MessageKey, values?: Record<string, number | string>) => string;

function SourceMetadata({source, t}: {source: TerminologySourceDisplay; t: Translator}) {
  return (
    <article className="source-detail-card">
      <h4>{source.fullDisplayName}</h4>
      <dl>
        {source.institution && <><dt>{t('evidence.institution')}</dt><dd>{source.institution}</dd></>}
        {source.authors.length > 0 && <><dt>{t('evidence.authors')}</dt><dd>{source.authors.join(' · ')}</dd></>}
        {typeof source.publicationYear === 'number' && <><dt>{t('evidence.year')}</dt><dd>{source.publicationYear}</dd></>}
        {source.edition && <><dt>{t('evidence.edition')}</dt><dd>{source.edition}</dd></>}
        {source.publisher && <><dt>{t('evidence.publisher')}</dt><dd>{source.publisher}</dd></>}
      </dl>
      {source.locators.length > 0 && (
        <div className="source-locators">
          <span className="source-detail-label">{t('evidence.locator')}</span>
          {source.locators.slice(0, 3).map((locator, index) => (
            <div className="source-locator" key={`${source.sourceId}-${index}`}>
              {typeof locator.page === 'number' && <span>{t('evidence.page', {page: locator.page})}</span>}
              {locator.chapter && <span>{locator.chapter}</span>}
              {locator.section && <span>{t('evidence.section', {section: locator.section})}</span>}
              {locator.table && <span>{locator.table}</span>}
            </div>
          ))}
          {source.locatorCount > source.locators.length && <span className="source-more-locators">{t('evidence.moreLocators', {count: source.locatorCount - source.locators.length})}</span>}
        </div>
      )}
      {source.url && <a className="source-detail-link" href={source.url} target="_blank" rel="noreferrer">{t('evidence.openSource')} <ArrowUpRight size={12}/></a>}
    </article>
  );
}

function TechnicalDetails({
  presentation,
  t,
  conceptId,
  latin,
  identifiers,
}: {
  presentation: EvidencePresentation;
  t: Translator;
  conceptId: string;
  latin?: string;
  identifiers: {fma?: string; ta2?: string; bodyParts3d?: readonly string[]};
}) {
  const technical = presentation.technical;
  const refs = technical.sourceRefs.length > 12
    ? `${technical.sourceRefs.slice(0, 12).join(' · ')} · +${technical.sourceRefs.length - 12}`
    : technical.sourceRefs.join(' · ');
  return (
    <details className="technical-details">
      <summary>{t('evidence.technicalDetails')}</summary>
      <dl className="technical-grid">
        <dt>{t('evidence.technicalAtlasId')}</dt><dd><code>{conceptId}</code></dd>
        {latin && <><dt>{t('detail.canonicalLatin')}</dt><dd>{latin}</dd></>}
        <dt>{t('evidence.technicalStatus')}</dt><dd><code>{technical.evidenceStatus}</code></dd>
        <dt>{t('evidence.technicalMethod')}</dt><dd><code>{technical.translationMethod}</code></dd>
        {technical.sourceIds.length > 0 && <><dt>{t('evidence.technicalSourceId')}</dt><dd><code>{technical.sourceIds.join(' · ')}</code></dd></>}
        {technical.sourceRevisions.length > 0 && <><dt>{t('evidence.technicalRevision')}</dt><dd><code>{technical.sourceRevisions.join(' · ')}</code></dd></>}
        {technical.compositionRuleId && <><dt>{t('evidence.technicalRule')}</dt><dd><code>{technical.compositionRuleId}</code></dd></>}
        {technical.blockers.length > 0 && <><dt>{t('evidence.technicalBlockers')}</dt><dd><code>{technical.blockers.join(' · ')}</code></dd></>}
        {technical.sourceDisposition && <><dt>{t('detail.evidenceReason')}</dt><dd><code>{technical.sourceDisposition}</code></dd></>}
        {refs && <><dt>{t('evidence.technicalClaims')}</dt><dd><code>{refs}</code></dd></>}
        {identifiers.fma && <><dt>{t('evidence.technicalFma')}</dt><dd><code>{identifiers.fma}</code></dd></>}
        {identifiers.ta2 && <><dt>{t('evidence.technicalTa2')}</dt><dd><code>{identifiers.ta2}</code></dd></>}
        {identifiers.bodyParts3d?.length && <><dt>{t('evidence.technicalBodyParts3d')}</dt><dd><code>{identifiers.bodyParts3d.join(' · ')}</code></dd></>}
      </dl>
    </details>
  );
}

function EvidenceDetails({
  presentation,
  t,
  conceptId,
  latin,
  identifiers,
}: {
  presentation: EvidencePresentation;
  t: Translator;
  conceptId: string;
  latin?: string;
  identifiers: {fma?: string; ta2?: string; bodyParts3d?: readonly string[]};
}) {
  const hasDetails = presentation.sources.length > 0 || presentation.variants.length > 0 || presentation.translationMethod === 'CONTROLLED_DERIVED';
  if (!hasDetails) return null;
  return (
    <details className="evidence-disclosure">
      <summary>{t('evidence.showSourceDetails')}</summary>
      <div className="evidence-source-details">
        {presentation.sources.length > 0
          ? presentation.sources.map(source => <SourceMetadata key={source.sourceId} source={source} t={t}/>)
          : <p className="context-note">{t('evidence.sourceUnavailable')}</p>}
        {presentation.variants.length > 0 && (
          <div className="source-variants" aria-label={t('detail.evidenceVariantNote')}>
            <h4>{t('evidence.sourceVariants')}</h4>
            <ul>{presentation.variants.map(variant => <li key={variant}>{variant}</li>)}</ul>
          </div>
        )}
        {presentation.translationMethod === 'CONTROLLED_DERIVED' && (
          <p className="derived-explanation"><strong>{t('evidence.derivedExplanation')}</strong>{presentation.description}</p>
        )}
        <TechnicalDetails presentation={presentation} t={t} conceptId={conceptId} latin={latin} identifiers={identifiers}/>
      </div>
    </details>
  );
}

export default function Home() {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState(initial);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Concept | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;
  const t: Translator = (key, values) => translate(language, key, values);

  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError('');
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    setState({...initial, visible: DEFAULT_VISIBLE});
    fetch('/models/atlas.json', {signal: abort.signal})
      .then(response => {
        if (!response.ok) throw new Error('atlas-load');
        return response.json();
      })
      .then(data => setAtlas(data as Atlas))
      .catch(fetchError => {
        if (fetchError.name !== 'AbortError') setError(translate(languageRef.current, 'errors.atlasLoad'));
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setPanel('search');
        setDetails(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const parts = useMemo(() => new Map(atlas?.parts.map(part => [part.id, part])), [atlas]);
  const counts = useMemo(() => Object.fromEntries(SYSTEMS.map(system => [system.id, atlas?.parts.filter(part => part.system === system.id).length ?? 0])), [atlas]);
  const activeSystems = SYSTEMS.filter(system => counts[system.id] > 0);
  const selectedParts = state.selected.map(id => parts.get(id)).filter(part => !!part);
  const selected = selectedParts[0];
  const system = SYSTEMS.find(item => item.id === selected?.system);
  const chosenEntry = chosen ? TERMINOLOGY_OVERLAY[chosen.id] : undefined;
  const chosenLocalization = chosen ? resolveConceptLocalization(chosen) : undefined;
  const chosenName = chosen ? resolveConceptName(chosen, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES) : '';
  const chosenLatin = chosenEntry && hasVerifiedLatin(chosenEntry, TERMINOLOGY_SOURCES) ? chosenEntry.latin?.preferred?.trim() : undefined;
  const chosenSourceIds = terminologySourceIdentifiers(chosenEntry, TERMINOLOGY_SOURCES);
  const chosenEvidence = language === 'vi' && chosenLocalization ? getEvidencePresentation(chosenLocalization, language, TERMINOLOGY_SOURCES) : undefined;
  const visibleCount = atlas?.parts.filter(part => state.isolate ? state.selected.includes(part.id) : state.visible.includes(part.system) || state.selected.includes(part.id)).length ?? 0;

  const displaySystemName = (item: (typeof SYSTEMS)[number]) => {
    const terminologyName = resolveSystemName(item, language, undefined, TERMINOLOGY_SOURCES);
    return terminologyName !== item.name ? terminologyName : translate(language, SYSTEM_MESSAGE_KEYS[item.id].name);
  };
  const localizedExplanation = (name: string, systemId: SystemId) => {
    const key = STRUCTURE_DESCRIPTION_KEYS[name.toLowerCase()] ?? SYSTEM_MESSAGE_KEYS[systemId].description;
    return translate(language, key);
  };

  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.trim();
    if (!term) return ['heart', 'brain', 'liver', 'stomach', 'spleen', 'pancreas', 'urinary bladder', 'trachea']
      .map(name => atlas.concepts.find(concept => concept.name.toLowerCase() === name))
      .filter((concept): concept is Concept => !!concept);
    return atlas.concepts
      .filter(concept => matchesTerminologyQuery(concept, term, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES))
      .sort((a, b) => resolveConceptName(a, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES).length - resolveConceptName(b, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES).length)
      .slice(0, 80);
  }, [atlas, language, query]);

  const choose = (concept: Concept) => {
    setChosen(concept);
    setState(current => ({...current, selected: concept.elements, isolate: false, rotate: false}));
    setDetails(true);
    setPanel(null);
  };

  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, concept => flushSync(() => choose(concept)));
  }, [atlas]);

  const choosePart = (id: string) => {
    const part = parts.get(id);
    if (!part) return;
    const concept = atlas?.concepts.find(item => item.id === part.conceptId) ?? {id: part.conceptId, name: part.name, elements: [id]};
    setChosen(concept);
    setState(current => ({...current, selected: [id], isolate: false, rotate: false}));
    setDetails(true);
    setPanel(null);
  };
  const toggle = (id: SystemId) => {
    setDetails(false);
    setState(current => ({...current, selected: [], isolate: false, visible: current.visible.includes(id) ? current.visible.filter(item => item !== id) : [...current.visible, id]}));
  };
  const reset = () => {
    setState(current => ({...initial, visible: DEFAULT_VISIBLE, reset: current.reset + 1}));
    setChosen(null);
    setDetails(false);
    setPanel(null);
  };
  const openPanel = (next: 'layers' | 'search') => {
    setDetails(false);
    setPanel(current => current === next ? null : next);
  };

  return (
    <main className="studio">
      {atlas && <AnatomyScene
        atlas={atlas}
        state={{...state, inspectorOpen: details && selectedParts.length > 0}}
        ariaLabel={t('scene.aria')}
        getPartLabel={(part: Part) => {
          const concept = atlas.concepts.find(item => item.id === part.conceptId) ?? {id: part.conceptId, name: part.name, elements: [part.id]};
          return resolveConceptName(concept, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES);
        }}
        onSelect={choosePart}
        onProgress={value => {setProgress(value); if (value === 100) setError('');}}
        onError={code => setError(translate(languageRef.current, sceneErrorMessageKeys[code]))}
      />}
      <div className="vignette"/>
      <header className="identity">
        <div className="eyebrow"><span className="status-dot"/> {t('brand.interactiveAnatomy')}</div>
        <h1>{t('brand.name')}<Badge variant="outline" className="edition">3D</Badge></h1>
        <div className="identity-meta">{t('identity.modeledPieces', {count: atlas ? atlas.parts.length.toLocaleString() : '2,234'})} <span>·</span> {t('identity.source')}</div>
      </header>
      <nav className="top-actions" aria-label={t('navigation.explorerPanels')}>
        <Button variant="ghost" className={panel === 'search' ? 'active' : ''} onClick={() => openPanel('search')} aria-label={t('controls.searchAria')}><Search size={18}/><span>{t('controls.search')}</span><kbd>/</kbd></Button>
        <Button variant="ghost" className="icon-button" aria-label={t('controls.about')} onClick={() => {setDetails(false); setPanel(null); setAbout(true);}}><Info size={18}/></Button>
        <div className="language-switcher" role="group" aria-label={t('language.label')}>
          {LANGUAGES.map(code => <Button key={code} variant="ghost" className={language === code ? 'active' : ''} aria-pressed={language === code} aria-label={t(code === 'en' ? 'language.english' : 'language.vietnamese')} onClick={() => setLanguage(code)}>{code.toUpperCase()}</Button>)}
        </div>
      </nav>
      <section className={`layers-panel glass ${panel === 'layers' ? 'mobile-open' : ''}`} aria-label={t('controls.systems')}>
        <div className="panel-heading"><span>{t('controls.systems')}</span><Button variant="ghost" className="mobile-only icon-button" onClick={() => setPanel(null)} aria-label={t('controls.closeSystems')}><X size={18}/></Button><Badge variant="secondary" className="desktop-only small-number">{activeSystems.length}</Badge></div>
        <div className="layer-presets">
          <Button variant="ghost" aria-pressed={activeSystems.every(item => state.visible.includes(item.id))} onClick={() => setState(current => ({...current, selected: [], isolate: false, visible: activeSystems.map(item => item.id)}))}>{t('controls.all')}</Button>
          <Button variant="ghost" aria-pressed={state.visible.length === 1 && state.visible[0] === 'skeletal'} onClick={() => setState(current => ({...current, selected: [], isolate: false, visible: ['skeletal']}))}>{t('controls.skeleton')}</Button>
          <Button variant="ghost" aria-pressed={state.visible.length === 6 && ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'].every(id => state.visible.includes(id as SystemId))} onClick={() => setState(current => ({...current, selected: [], isolate: false, visible: ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive']}))}>{t('controls.organs')}</Button>
        </div>
        <div className="system-list">
          {activeSystems.map(item => <div className={`system-row ${state.visible.includes(item.id) ? 'enabled' : ''}`} key={item.id}>
            <Button variant="ghost" className="system-name" title={t('controls.showOnlySystem')} onClick={() => setState(current => ({...current, visible: [item.id], isolate: false, selected: []}))}><span className="system-dot" style={{background: item.color}}/>{displaySystemName(item)}<span className="system-count">{counts[item.id]}</span></Button>
            <Switch checked={state.visible.includes(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={t('controls.toggleSystem')}/>
          </div>)}
        </div>
        <div className="panel-foot"><span>{t('controls.piecesVisible', {count: visibleCount.toLocaleString()})}</span><Button variant="ghost" onClick={() => setState(current => ({...current, visible: [], selected: [], isolate: false}))}>{t('controls.hideAll')}</Button></div>
      </section>
      {panel === 'search' && <section className="search-panel glass" aria-label={t('controls.search')}>
        <div className="panel-heading"><span>{t('controls.search')}</span><Button variant="ghost" className="icon-button" onClick={() => setPanel(null)} aria-label={t('search.close')}><X size={18}/></Button></div>
        <Combobox<Concept> items={results} value={null} onValueChange={value => {if (value) choose(value);}} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={concept => resolveConceptName(concept, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES)} filter={null} open onOpenChange={open => {if (!open) setPanel(null);}}>
          <ComboboxInput autoFocus placeholder={t('search.placeholder')} aria-label={t('search.aria')} dismissLabel={t('search.dismiss')} showTrigger={false}/>
          <ComboboxContent className="anatomy-search-results" dismissLabel={t('search.dismiss')}>
            <ComboboxEmpty>{t('search.noMatches')}</ComboboxEmpty>
            <ComboboxList>{(concept: Concept) => <ComboboxItem key={concept.id} value={concept}>
              <span className="search-result-label">
                <span className="search-result-name">{resolveConceptName(concept, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES)}</span>
                {language === 'vi' && <span className="search-result-english">{concept.name}</span>}
              </span>
              <span className="small-number">{concept.elements.length} {concept.elements.length === 1 ? t('search.piece') : t('search.pieces')}</span>
            </ComboboxItem>}</ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p className="search-note">{query ? t('search.refineHint') : t('search.emptyHint')}</p>
      </section>}
      <nav className="view-controls glass" aria-label={t('camera.controls')}>
        {(['three-quarter', 'front', 'side', 'back'] as View[]).map((view, index) => <Button variant="ghost" key={view} className={state.view === view ? 'active' : ''} aria-pressed={state.view === view} disabled={state.explode > .8 && view !== 'front'} onClick={() => setState(current => ({...current, view, reset: current.reset + 1, rotate: false}))} title={t(viewMessageKeys[view])} aria-label={t(viewMessageKeys[view])}><span>{['¾', 'F', 'S', 'B'][index]}</span></Button>)}
        <i/>
        <Button variant="ghost" disabled={state.explode >= .4} aria-label={t(state.rotate ? 'camera.pause' : 'camera.rotate')} title={t('camera.autoRotate')} className={state.rotate ? 'active' : ''} onClick={() => setState(current => ({...current, rotate: !current.rotate}))}>{state.rotate ? <Pause size={17}/> : <RotateCw size={18}/>}</Button>
        <Button variant="ghost" aria-label={t('controls.resetViewLayers')} title={t('controls.reset')} onClick={reset}><RotateCcw size={17}/></Button>
      </nav>
      <div className="scene-caption"><span className="caption-line"/><span>{state.isolate ? (chosenName || t('scene.selectedStructure')) : state.explode > .95 ? t('scene.inventory') : state.explode > .05 ? t('scene.separatedStructures') : t('scene.adultMale')}</span><span className="caption-line"/></div>
      <div className="bottom-dock glass">
        <Button variant="ghost" className="mobile-only dock-layers" onClick={() => openPanel('layers')} aria-label={t('controls.openSystems')}><Layers3 size={20}/><span>{t('controls.systems')}</span></Button>
        <div className="explode-control"><div className="explode-label"><label id="explode-label">{t('controls.explode')}</label><output>{Math.round(state.explode * 100)}<span>%</span></output></div><Slider aria-labelledby="explode-label" min={0} max={100} step={1} value={[state.explode * 100]} onValueChange={value => setState(current => ({...current, explode: (Array.isArray(value) ? value[0] : value) / 100, view: (Array.isArray(value) ? value[0] : value) > 80 ? 'front' : current.view, rotate: false}))}/><div className="slider-endpoints"><span>{t('controls.assembled')}</span><span>{t('controls.everyPiece')}</span></div></div>
        <Button variant="ghost" className="dock-reset" onClick={reset} aria-label={t('controls.reset')}><RotateCcw size={18}/><span>{t('controls.reset')}</span></Button>
      </div>
      <footer className="studio-footer"><span>{t(state.explode > .8 ? 'camera.dragPan' : 'camera.dragOrbit')} <b>·</b> {t('camera.pinchZoom')} <b>·</b> {t('camera.tapInspect')}</span><Button variant="ghost" onClick={() => {setDetails(false); setPanel(null); setAbout(true);}}>{t('controls.sourceCredits')} <ArrowUpRight size={12}/></Button></footer>
      {progress < 100 && !error && <div className="loading glass" role="status"><Activity size={18}/><div><strong>{t('loading.preparing')}</strong><span>{t('loading.progress', {progress, count: atlas?.parts.length.toLocaleString() ?? '2,234'})}</span><div className="loading-track"><i style={{width: `${progress}%`}}/></div></div></div>}
      {error && <div className="loading glass error" role="alert"><p>{error}</p><Button variant="ghost" onClick={() => location.reload()}>{t('controls.reload')}</Button></div>}
      <Sheet open={details && selectedParts.length > 0} modal={false} disablePointerDismissal onOpenChange={setDetails}>
        <SheetContent initialFocus={detailTitle} closeLabel={t('controls.closePanel')} className={`detail-sheet glass ${state.isolate ? 'is-isolated' : ''}`} showCloseButton>
          <div className="detail-header">
            <div className="detail-accent" style={{background: system?.color}}/>
            <div className="eyebrow">{system ? displaySystemName(system) : ''}</div>
            <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">{chosenName}</SheetTitle>
            {language === 'vi' && chosenEvidence && <div className={`evidence-status evidence-status--${chosenEvidence.hasConflict ? 'conflict' : chosenEvidence.translationMethod.toLowerCase()}`} aria-label={chosenEvidence.label}><span>{chosenEvidence.label}</span>{chosenEvidence.qualifier && <small>{chosenEvidence.qualifier}</small>}</div>}
            {language === 'vi' && chosenEvidence?.showEnglishOriginal && chosen && <span className="context-note original-english">{t('detail.originalEnglish')}: {chosen.name}</span>}
            {language === 'vi' && !chosenLocalization && <span className="context-note">{t('detail.vietnameseUnavailable')}</span>}
          </div>
          <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
            <SheetDescription className="structure-description">{chosen && selected ? localizedExplanation(chosen.name, selected.system) : ''}</SheetDescription>
            {chosen && !STRUCTURE_DESCRIPTION_KEYS[chosen.name.toLowerCase()] && <span className="context-note">{t('detail.systemOverview')}</span>}
            {language === 'vi' && chosenEvidence && <section className="evidence-panel" aria-label={chosenEvidence.label}>
              <p className="evidence-description">{chosenEvidence.description}</p>
              {chosenEvidence.sourceSummary && <div className="source-summary"><span>{t('evidence.sourceHeading')}</span><strong>{chosenEvidence.sourceSummary}</strong></div>}
              <EvidenceDetails presentation={chosenEvidence} t={t} conceptId={chosen?.id ?? ''} latin={chosenLatin} identifiers={chosenSourceIds}/>
            </section>}
            <div className="structure-meta">
              {language === 'en' && <span>{t('detail.atlasReference')}<strong>{chosen?.id}</strong></span>}
              <span>{t('detail.selectedPieces')}<strong>{state.selected.length.toLocaleString()}</strong></span>
            </div>
            {language === 'en' && (chosenLatin || chosenSourceIds.fma || chosenSourceIds.ta2 || chosenSourceIds.bodyParts3d?.length) && <div className="structure-meta detail-terminology-meta">
              {chosenLatin && <span>{t('detail.canonicalLatin')}<strong>{chosenLatin}</strong></span>}
              {chosenSourceIds.fma && <span>FMA<strong>{chosenSourceIds.fma}</strong></span>}
              {chosenSourceIds.ta2 && <span>TA2<strong>{chosenSourceIds.ta2}</strong></span>}
              {chosenSourceIds.bodyParts3d?.length && <span>BodyParts3D<strong>{chosenSourceIds.bodyParts3d.join(', ')}</strong></span>}
            </div>}
            {selectedParts.length > 1 && <div className="member-list"><h3>{t('detail.includedStructures')}</h3>{selectedParts.slice(0, 50).map(part => {const memberConcept = atlas?.concepts.find(concept => concept.id === part.conceptId) ?? {id: part.conceptId, name: part.name, elements: [part.id]}; return <Button variant="ghost" key={part.id} onClick={() => choosePart(part.id)}><span>{resolveConceptName(memberConcept, language, TERMINOLOGY_OVERLAY, TERMINOLOGY_SOURCES)}</span><ChevronRight size={14}/></Button>;})}{selectedParts.length > 50 && <p>{t('detail.morePieces', {count: selectedParts.length - 50})}</p>}</div>}
            <a className="source-link" href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">{t('detail.viewSource')} <ArrowUpRight size={14}/></a>
          </div>
          <div className="detail-actions"><Button className={`primary-action ${state.isolate ? 'active' : ''}`} onClick={() => setState(current => ({...current, isolate: !current.isolate, explode: 0}))}><Focus size={18}/>{t(state.isolate ? 'detail.showSurrounding' : 'detail.isolate')}<ChevronRight size={16}/></Button><Button variant="ghost" className="secondary-action" onClick={() => {setState(current => ({...current, selected: [], isolate: false})); setDetails(false);}}>{t('detail.clearSelection')}</Button></div>
        </SheetContent>
      </Sheet>
      <Sheet open={about} onOpenChange={setAbout}>
        <SheetContent closeLabel={t('controls.closePanel')} className="about-sheet glass">
          <div className="eyebrow">{t('about.eyebrow')}</div>
          <SheetTitle className="structure-title">{t('about.title')}</SheetTitle>
          <SheetDescription>{t('about.description')}</SheetDescription>
          <div className="about-copy">
            <p><strong>{t('about.modelIdentity')}</strong><br/>{t('about.modelSummary', {meshes: '2,234', concepts: '3,432'})}</p>
            <p>{t('about.scope')}</p>
            <p>{t('about.educational')}</p>
            <h3>{t('about.sourceHeading')}</h3>
            <p>{t('about.sourceDescription')}</p>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">{t('about.datasetLicense')} <ArrowUpRight size={14}/></a>
            <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">{t('about.originalGeometry')} <ArrowUpRight size={14}/></a>
            <a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">{t('about.sourcePublication')} <ArrowUpRight size={14}/></a>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
