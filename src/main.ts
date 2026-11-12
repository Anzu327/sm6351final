import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createIcons, ChevronDown, Plus, Minus, RotateCcw, X, ExternalLink } from 'lucide';
import { blackBeautyId, chapters, chelyabinskFireballId, heroes, sources } from './story';
import { SpaceScene } from './scene';
import { loadData, filterRecords, massLabel } from './data';
import { drawCharts } from './charts';
import { hasLocation, isMeteorite, type DataBundle, type Filters, type Layer, type RecordItem } from './types';
gsap.registerPlugin(ScrollTrigger);
const root=document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML=`
<a class="skip" href="#many">Skip opening</a>
<div id="space" aria-label="Interactive three-dimensional meteorites and Earth"></div>
<div id="scene-warning" role="status" hidden></div>
<header id="header" hidden><a class="wordmark" href="#story">TRACES <span>FROM SPACE</span></a><nav aria-label="Story chapters">${chapters.map((c,i)=>'<a href="#'+c.slug+'" data-chapter="'+i+'">'+c.short+'</a>').join('')}</nav><button class="text-button" data-enter>Explore the atlas</button></header>
<main id="story">
<section id="intro" aria-label="A fragment from space. Scroll to follow it to Earth.">
  <button id="scroll-hint" aria-label="Scroll down to begin"><i data-lucide="chevron-down"></i><span>Scroll</span></button>
</section>
<div id="chapters">${chapters.map((c,i)=>`
  <section class="chapter" id="${c.slug}" data-step="${i}">
    <article>
      <h1 data-reveal>${c.title}</h1>
      <div data-reveal>
        <p>${c.text}</p>
        ${i===0?`<p>One record catalogs fragments on the ground. The other marks where the fireball shone brightest in the atmosphere, about 23.3 km up.</p>`:`<p class="note">${c.note}</p>`}
      </div>
      <div data-reveal class="chapter-actions">
        ${c.hero==='chelyabinsk'?`
        <div class="arrival-records" role="group" aria-label="Chelyabinsk observations">
          <button data-arrival-layer="meteorites" aria-pressed="true" disabled><span class="ground-symbol" aria-hidden="true"></span>Ground record</button>
          <button data-arrival-layer="fireballs" aria-pressed="false" disabled><span class="air-symbol" aria-hidden="true"></span>Peak brightness</button>
        </div>
        <p id="arrival-location" class="inspect-note" aria-live="polite">Meteorite catalog location · 54.817° N, 61.117° E</p>
        <div class="arrival-sources">
          <a class="source-link" href="${heroes.chelyabinsk.source}" target="_blank" rel="noopener noreferrer">Meteorite catalog</a>
          <a class="source-link" href="https://cneos.jpl.nasa.gov/news/fireball_130301.html" target="_blank" rel="noopener noreferrer">NASA/JPL event report</a>
        </div>`:''}
        ${c.hero==='fukang'?`<button class="surface-toggle" data-story-preview="fukang" aria-pressed="false">Inspect the cut</button>`:''}
        ${c.hero==='hoba'?`<button class="surface-toggle" data-story-preview="hoba" aria-expanded="false" aria-controls="hoba-scale">Compare the scale</button>
        <figure id="hoba-scale" class="hoba-scale" hidden>
          <figcaption>Hoba width compared with human height</figcaption>
          <div><span class="hoba-scale-bar" style="--length:100%"></span><span>Hoba · 2.95 m</span></div>
          <div><span class="hoba-scale-bar" style="--length:59.32%"></span><span>Person · 1.75 m</span></div>
        </figure>`:''}
        ${c.hero==='fukang'||c.hero==='hoba'?`<a class="source-link" href="${heroes[c.hero].source}" target="_blank" rel="noopener noreferrer">Read the evidence <i data-lucide="external-link"></i></a>`:''}
        ${i===3?'<button class="primary" data-enter>Enter the atlas</button>':''}
      </div>
    </article>
  </section>`).join('')}</div>
<footer id="story-footer"><p>Some are witnessed. Most are found.<br>Every record is a beginning.</p><div class="source-list">${sources.map(([name,url])=>'<a target="_blank" rel="noopener noreferrer" href="'+url+'">'+name+'</a>').join('')}</div><p class="small">An information visualization project · SpaceUHK</p></footer>
</main>
<div id="story-heroes" hidden aria-label="Featured meteorites">${Object.entries(heroes).map(([key,h])=>'<button data-hero="'+key+'">'+h.name+'</button>').join('')}</div>
<section id="atlas" aria-label="Global record explorer" hidden>
  <div class="atlas-heading"><h1>The visitors<br><em>we know.</em></h1><button id="return-story" class="text-button"><i data-lucide="rotate-ccw"></i> Return to story</button></div>
  <aside id="filters" aria-label="Filter records">
    <div class="layer-switch" role="group" aria-label="Data layer"><button data-layer="meteorites" aria-pressed="true">Meteorites</button><button data-layer="fireballs" aria-pressed="false">Fireballs</button></div>
    <label>Search records<input id="search" type="search" placeholder="Name, nickname or catalog ID" autocomplete="off"></label>
    <fieldset><legend>Year range</legend><div class="year-inputs"><label class="sr-only" for="from">From year</label><input id="from" type="number" placeholder="From" min="860" max="2026"><span>to</span><label class="sr-only" for="to">To year</label><input id="to" type="number" placeholder="To" min="860" max="2026"></div><p id="range-error" role="status" hidden>Start year must be no later than end year.</p></fieldset>
    <label class="check"><input id="undated" type="checkbox" checked> Include undated records</label>
    <div id="meteorite-filters"><label>Record type<select id="status"><option value="">Fell + Found</option><option>Fell</option><option>Found</option></select></label><label>Classification<select id="classification"><option value="">All classifications</option></select></label></div>
    <button id="reset" class="text-button">Reset filters</button>
    <div id="legend"><p class="legend-title">Documented meteorites</p><div class="legend-dots"><span></span><span></span><span></span></div><p id="size-legend">Point size: catalog mass, logarithmic scale.<br>Unknown mass uses the smallest symbol.</p><p id="layer-note">Fell = witnessed fall. Found = recovered later. Year means fall or discovery year, respectively.</p></div>
    <details class="data-notes"><summary>Sources & limitations</summary><p>This is a historical catalog snapshot, not a live census. Discovery and observing effort affect the map. Blank coordinates and 0,0 placeholders are not plotted.</p><p id="snapshot-info"></p><p><a href="data/manifest.json" target="_blank">Snapshot manifest</a> · <a href="https://data.nasa.gov/dataset/meteorite-landings" target="_blank" rel="noopener noreferrer">NASA catalog</a> · <a href="https://ssd-api.jpl.nasa.gov/doc/fireball.html" target="_blank" rel="noopener noreferrer">JPL field definitions</a></p></details>
  </aside>
  <div id="map-controls" aria-label="Map controls"><button id="zoom-in" aria-label="Zoom in"><i data-lucide="plus"></i></button><button id="zoom-out" aria-label="Zoom out"><i data-lucide="minus"></i></button></div>
  <div id="results" aria-live="polite"><p id="counts">Loading the archive…</p><p id="map-count"></p></div>
  <aside id="records-panel" aria-label="Records and details"><div id="details"><h2>Choose a visitor.</h2><p>Hover a featured record for its 3D preview. Select any record for the evidence behind its point.</p></div><div class="list-heading"><h3>Matching records</h3><span id="page-label"></span></div><div id="record-list" role="list"></div><div class="pagination"><button id="previous">Previous</button><button id="next">Next</button></div></aside>
  <div id="charts"></div>
  <p class="atlas-caption">A map of what we have recorded.<br>Not a map of everything that has fallen.</p>
</section>
<div id="hover-preview" hidden><p id="hover-name"></p><p id="hover-meta"></p></div>
<div id="data-error" role="alert" hidden><p id="error-message"></p><button id="retry">Retry loading data</button></div>
<div id="load-status" class="sr-only" role="status">Loading the archive.</div>
`;
createIcons({icons:{ChevronDown,Plus,Minus,RotateCcw,X,ExternalLink}});
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let scene:SpaceScene|null=null, bundle:DataBundle|null=null, layer:Layer='meteorites',filtered:RecordItem[]=[],page=0,mode:'story'|'explore'='story',returnY=0;
let activeChapter=0;
let storyLayer: Layer = 'meteorites';
const issue=(message:string)=>{el('scene-warning').textContent=message;el('scene-warning').hidden=false;};
try{scene=new SpaceScene(el('space'),issue);}catch(error){document.body.classList.add('no-webgl');issue('3D is unavailable in this browser. The story and searchable records remain available.');console.warn('3D unavailable',error);}
function hidePreview(){scene?.preview(null);el('hover-preview').hidden=true;}
function preview(r:RecordItem|null){scene?.preview(r);if(!r||!Object.values(heroes).some(h=>h.id===r.id)){el('hover-preview').hidden=true;return;}el('hover-preview').hidden=false;el('hover-name').textContent=r.name;el('hover-meta').textContent=isMeteorite(r)?r.classification:'';}
if (scene) {
  scene.onSelect = record => {
    selectRecord(record, false);
    if (matchMedia('(hover: none)').matches) preview(record);
  };
  scene.onPreview = preview;
}

function closeStoryPreview() {
  document.querySelector('[data-story-preview="fukang"]')?.setAttribute('aria-pressed', 'false');
  document.querySelector('[data-story-preview="hoba"]')?.setAttribute('aria-expanded', 'false');
  el('hoba-scale').hidden = true;
  hidePreview();
}

ScrollTrigger.create({
  trigger: '#intro', start: 'top top', end: 'bottom bottom',
  onUpdate: self => {
    if (mode === 'explore' || self.scroll() > self.end) return;
    if (storyLayer === 'fireballs') setArrivalLayer('meteorites');
    scene?.setIntro(self.progress * 4);
    const hint = el<HTMLButtonElement>('scroll-hint');
    hint.style.opacity = String(1 - Math.min(1, self.progress * 5));
    hint.hidden = self.progress >= .2;
    el('header').hidden = self.progress < .995;
    closeStoryPreview();
  },
});

for (const [i, chapter] of chapters.entries()) {
  const section = el(chapter.slug);
  ScrollTrigger.create({
    trigger: section, start: 'top 65%',
    end: i === chapters.length - 1 ? () => ScrollTrigger.maxScroll(window) + 1 : 'bottom 65%',
    onToggle: self => { if (self.isActive) activate(i); },
  });
}
const motion = gsap.matchMedia();
motion.add('(prefers-reduced-motion: no-preference)', () => {
  for (const chapter of chapters) {
    const groups = el(chapter.slug).querySelectorAll('[data-reveal]');
    ScrollTrigger.create({
      trigger: groups[0], start: 'top 85%', once: true,
      onEnter: () => {
        if (mode === 'explore' || groups[0].getBoundingClientRect().bottom < 0) return;
        gsap.fromTo(groups, { y: 8, opacity: 0 }, {
          y: 0, opacity: 1, duration: .2, stagger: .05, ease: 'power3.out', clearProps: 'transform,opacity',
        });
      },
    });
  }
});

function activate(index: number, immediate = false) {
  if (mode === 'explore') return;
  closeStoryPreview();
  activeChapter = index;
  if (storyLayer === 'fireballs') setArrivalLayer('meteorites');
  scene?.setChapter(index, immediate);
  el('header').hidden = false;
  el('scroll-hint').hidden = true;
  document.querySelectorAll<HTMLElement>('[data-chapter]').forEach(link => {
    if (Number(link.dataset.chapter) === index) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
}

function setArrivalLayer(next: Layer, confirmed = false) {
  if (!bundle) return;
  const record = next === 'fireballs'
    ? bundle.fireballs.find(r => r.id === chelyabinskFireballId)
    : bundle.meteorites.find(r => r.id === heroes.chelyabinsk.id);
  if (!record || !hasLocation(record)) return;

  if (storyLayer !== next) scene?.setRecords(bundle[next], next);
  storyLayer = next;
  scene?.highlight(record, false, next === 'fireballs');
  if (confirmed) scene?.confirmSelection();
  document.querySelectorAll<HTMLButtonElement>('[data-arrival-layer]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.arrivalLayer === next));
  });
  const coordinates = `${record.lat.toFixed(3)}° N, ${record.lng.toFixed(3)}° E`;
  el('arrival-location').textContent = isMeteorite(record)
    ? `Meteorite catalog location · ${coordinates}`
    : `Peak brightness · ${coordinates}. Altitude: ${record.altitudeKm ?? 'unknown'} km.`;
}
document.querySelectorAll<HTMLButtonElement>('[data-arrival-layer]').forEach(button => {
  button.addEventListener('click', event => setArrivalLayer(button.dataset.arrivalLayer as Layer, event.detail > 0));
});

document.querySelectorAll<HTMLButtonElement>('[data-story-preview]').forEach(button => {
  button.addEventListener('click', () => {
    const hero = button.dataset.storyPreview === 'hoba' ? 'hoba' : 'fukang';
    const attribute = hero === 'hoba' ? 'aria-expanded' : 'aria-pressed';
    const open = button.getAttribute(attribute) === 'true';
    closeStoryPreview();
    if (open) return;
    button.setAttribute(attribute, 'true');
    if (hero === 'hoba') el('hoba-scale').hidden = false;
    const record = bundle?.meteorites.find(r => r.id === heroes[hero].id);
    if (scene && record) {
      preview(record);
      if (hero === 'fukang') scene.setCut(true);
    }
  });
});

el('scroll-hint').addEventListener('click', event => {
  el('many').scrollIntoView({ behavior: event.detail === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
document.querySelectorAll<HTMLElement>('[data-hero]').forEach(button=>{
  const hero=heroes[button.dataset.hero as keyof typeof heroes];
  const record=()=>bundle?.meteorites.find(r=>r.id===hero.id)??null;
  button.addEventListener('mouseenter',()=>preview(record()));button.addEventListener('mouseleave',hidePreview);button.addEventListener('focus',()=>preview(record()));button.addEventListener('blur',hidePreview);
  button.addEventListener('click',()=>{const r=record();if(!r)return;if(mode!=='explore')enterAtlas();if(layer!=='meteorites')document.querySelector<HTMLButtonElement>('[data-layer="meteorites"]')?.click();selectRecord(r,true);if(matchMedia('(hover: none)').matches)preview(r);});
});
function enterAtlas(){closeStoryPreview();returnY=scrollY;mode='explore';document.body.classList.add('exploring');el('story').hidden=true;el('header').hidden=true;el('atlas').hidden=false;el('story-heroes').hidden=false;scene?.explore();hidePreview();update();el('return-story').focus();}
document.querySelectorAll('[data-enter]').forEach(b=>b.addEventListener('click',enterAtlas));
el('return-story').addEventListener('click', () => {
  mode = 'story';
  document.body.classList.remove('exploring');
  el('story').hidden = false;
  el('atlas').hidden = true;
  el('story-heroes').hidden = true;
  closeStoryPreview();
  window.scrollTo({ top: returnY, behavior: 'instant' });
  ScrollTrigger.refresh();
  if (bundle) scene?.setRecords(bundle.meteorites, 'meteorites');
  const introEnd = el('intro').offsetHeight - innerHeight;
  if (returnY < introEnd) scene?.setIntro(Math.min(4, 4 * returnY / introEnd));
  else {
    activate(activeChapter, true);
    if (activeChapter === 0) setArrivalLayer('meteorites');
  }
});
el('zoom-in').addEventListener('click',()=>scene?.zoom(.8));el('zoom-out').addEventListener('click',()=>scene?.zoom(1.25));
function numberInput(id:string){const v=(el<HTMLInputElement>(id).value).trim();return v===''?null:Number(v);}
function filters():Filters{return {query:el<HTMLInputElement>('search').value,from:numberInput('from'),to:numberInput('to'),status:el<HTMLSelectElement>('status').value,classification:el<HTMLSelectElement>('classification').value,includeUndated:el<HTMLInputElement>('undated').checked};}
function update(){if(!bundle)return;const f=filters();const invalid=f.from!==null&&f.to!==null&&f.from>f.to;el('range-error').hidden=!invalid;
  filtered=invalid?[]:filterRecords(layer==='meteorites'?bundle.meteorites:bundle.fireballs,f);page=0;renderRecords();drawCharts(el('charts'),filtered);
  if(mode==='explore')scene?.setRecords(filtered,layer);
  el('counts').textContent=filtered.length.toLocaleString('en')+' matching records';const mapped=filtered.filter(hasLocation).length;el('map-count').textContent=mapped.toLocaleString('en')+' mapped · '+(filtered.length-mapped).toLocaleString('en')+' without usable coordinates';
  el('details').replaceChildren();const h=document.createElement('h2');h.textContent='Choose a visitor.';const p=document.createElement('p');p.textContent=filtered.length?'Select a point or a record below. Featured meteorites also have 3D previews on hover.':'No records match. Try a different name, year range or classification.';el('details').append(h,p);scene?.highlight(null,false);hidePreview();
}
let inputTimer:ReturnType<typeof setTimeout>;
for(const id of ['search','from','to'])el(id).addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(update,120);});
for(const id of ['status','classification','undated'])el(id).addEventListener('change',update);
function reset(){el<HTMLInputElement>('search').value='';el<HTMLInputElement>('from').value='';el<HTMLInputElement>('to').value='';el<HTMLSelectElement>('status').value='';el<HTMLSelectElement>('classification').value='';el<HTMLInputElement>('undated').checked=true;update();}
el('reset').addEventListener('click',reset);
document.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b=>b.addEventListener('click',()=>{layer=b.dataset.layer as Layer;document.querySelectorAll<HTMLElement>('[data-layer]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.layer===layer)));el('meteorite-filters').hidden=layer==='fireballs';el('size-legend').textContent=layer==='meteorites'?'Point size: catalog mass, logarithmic scale. Unknown mass uses the smallest symbol.':'Point size: estimated impact energy (kt TNT), logarithmic scale.';el('layer-note').textContent=layer==='meteorites'?'Fell = witnessed fall. Found = recovered later. Year means fall or discovery year, respectively.':'JPL coordinates mark peak brightness, not recovered meteorites. Estimated impact energy is not measured ground damage. Time is UTC.';el('legend').querySelector('.legend-title')!.textContent=layer==='meteorites'?'Documented meteorites':'Observed fireballs';reset();}));
const pageSize=30;
function renderRecords(){const list=el('record-list');list.replaceChildren();const start=page*pageSize;
  for(const r of filtered.slice(start,start+pageSize)){
    const button=document.createElement('button');button.className='record';button.setAttribute('role','listitem');button.dataset.record=r.id;
    const name=document.createElement('span');name.textContent=r.id===blackBeautyId?'Black Beauty · NWA 7034':r.name;
    const meta=document.createElement('small');meta.textContent=(r.year??'Undated')+' · '+(isMeteorite(r)?r.status:'UTC')+(!hasLocation(r)?' · Not mapped':'');button.append(name,meta);
    button.addEventListener('click',()=>{selectRecord(r,true);if(matchMedia('(hover: none)').matches)preview(r);});button.addEventListener('mouseenter',()=>preview(r));button.addEventListener('mouseleave',hidePreview);button.addEventListener('focus',()=>preview(r));button.addEventListener('blur',hidePreview);list.append(button);
  }
  if(!filtered.length){const p=document.createElement('p');p.textContent='No matching records.';list.append(p);}
  el<HTMLButtonElement>('previous').disabled=page===0;el<HTMLButtonElement>('next').disabled=(page+1)*pageSize>=filtered.length;
  el('page-label').textContent=filtered.length?(start+1)+'–'+Math.min(start+pageSize,filtered.length):'0';
}
el('previous').addEventListener('click',()=>{page=Math.max(0,page-1);renderRecords();});el('next').addEventListener('click',()=>{page++;renderRecords();});
function selectRecord(r:RecordItem,fly:boolean){const host=el('details');host.replaceChildren();const h=document.createElement('h2');h.textContent=r.id===blackBeautyId?'Black Beauty':r.name;host.append(h);const dl=document.createElement('dl');
  const fields:[string,string][] = isMeteorite(r)?
    [['Catalog ID',r.sourceId],['Classification',r.classification],['Record type',r.status],[(r.status==='Fell'?'Fall':'Discovery')+' year',String(r.year??'Unknown')],['Catalog mass',massLabel(r.massG)],['Name type',r.nameType]]:
    [['Peak brightness (UTC)',r.date.replace('T',' ').replace('Z','')],['Estimated impact energy',r.energyKt===null?'Unknown':r.energyKt+' kt TNT'],['Radiated energy',r.radiatedEnergyJ===null?'Unknown':r.radiatedEnergyJ.toExponential(2)+' J'],['Height at peak brightness',r.altitudeKm===null?'Unknown':r.altitudeKm+' km']];
  fields.push(['Coordinates',hasLocation(r)?r.lat.toFixed(3)+', '+r.lng.toFixed(3):'Unavailable · not mapped']);
  for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}host.append(dl);
  if(r.id===heroes.fukang.id){let cut=true;const inspect=document.createElement('button');inspect.className='surface-toggle';inspect.textContent='View exterior';const show=()=>{preview(r);scene?.setCut(cut);};inspect.addEventListener('mouseenter',show);inspect.addEventListener('mouseleave',hidePreview);inspect.addEventListener('focus',show);inspect.addEventListener('blur',hidePreview);inspect.addEventListener('click',()=>{cut=!cut;show();inspect.textContent=cut?'View exterior':'View cut surface';});host.append(inspect);}
  if(isMeteorite(r)){const p=document.createElement('p');p.className='small';p.textContent='Catalog mass can represent recovered material from multiple fragments; it is not necessarily the mass of the displayed specimen.';host.append(p);}
  const anchor=document.createElement('a');anchor.className='source-link';anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.textContent='View source record';anchor.href=isMeteorite(r)?'https://www.lpi.usra.edu/meteor/metbull.php?code='+encodeURIComponent(r.sourceId):'https://cneos.jpl.nasa.gov/fireballs/';host.append(anchor);scene?.highlight(r,fly,!isMeteorite(r));
}
async function initializeData(){el('data-error').hidden=true;el('load-status').textContent='Loading the archive.';
  try{bundle=await loadData();const classifications=[...new Set(bundle.meteorites.map(r=>r.classification))].sort();const select=el<HTMLSelectElement>('classification');select.replaceChildren(new Option('All classifications',''));for(const name of classifications)select.add(new Option(name,name));el('snapshot-info').textContent='Acquired '+bundle.manifest.acquiredAt.slice(0,10)+'. Meteorites: '+bundle.meteorites.length.toLocaleString('en')+' records. Fireballs: '+bundle.fireballs.length.toLocaleString('en')+' events. Time coverage differs between layers.';el('load-status').textContent='Archive loaded.';document.body.dataset.data='ready';scene?.setRecords(bundle.meteorites,'meteorites');update();
    document.querySelectorAll<HTMLButtonElement>('[data-arrival-layer]').forEach(button => {
      button.disabled = (button.dataset.arrivalLayer === 'fireballs'
        ? !bundle?.fireballs.some(r => r.id === chelyabinskFireballId && hasLocation(r))
        : !bundle?.meteorites.some(r => r.id === heroes.chelyabinsk.id && hasLocation(r)));
    });
    if (activeChapter === 0 && scene?.mode === 'story') setArrivalLayer('meteorites');
  }
  catch(error){el('data-error').hidden=false;el('error-message').textContent='The archive could not be loaded. '+(error instanceof Error?error.message:'Please retry.');document.body.dataset.data='failed';}
}
el('retry').addEventListener('click',initializeData);
void initializeData();
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (mode === 'story') closeStoryPreview();
  else hidePreview();
});
