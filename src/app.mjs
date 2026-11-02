import {TAB_ORDER,WORLD_ORDER,previewScope,safeText} from './reader.mjs';
import {resolveTimePreset} from './time-presets.mjs';
import {createTimingDraft} from './core/timing-draft.mjs';
import {createOriginalBackupCoordinator} from './ui-backup-coordinator.mjs';
import {createVerifiedPairDownloadUi} from './ui-verified-pair-downloads.mjs';
import {SUPPORTED_LOCALES,initialLocale,translate,categoryName,areaName,localDate,parseLocalDateTime} from './i18n.mjs';
const $=id=>document.getElementById(id);
const make=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const click=(label,handler,cls='subtle')=>{const el=make('button',cls,label);el.type='button';el.addEventListener('click',handler);return el;};
const state={snapshot:null,draft:null,sessionId:null,preflight:null,planPending:false,tab:'spawn',world:'all',group:null,subgroup:null,query:'',sort:'name',selected:new Set(),limit:120,mode:'now',loading:false,locale:initialLocale()};
const t=(key,values)=>translate(state.locale,key,values);
const fmt=value=>localDate(value,state.locale);
let worker=null,seq=0,noticeCount=0,iconManifest=null,preflightSequence=0,outputPlanRevision=0;
const pending=new Map();
function failWorker(message){for(const p of pending.values())p.reject(new Error(message));pending.clear();if(worker){worker.terminate();worker=null;}}
function request(type,payload={},transfer=[]){return new Promise((resolve,reject)=>{
 const id=++seq;
 try{
  if(!worker){
   worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data):p.reject(new Error(data.error||'Internal error'));};
   worker.onerror=e=>{e.preventDefault();failWorker('Save reader initialization failed. Reload the page.');};
   worker.onmessageerror=()=>failWorker('Save reader response could not be received.');
  }
  pending.set(id,{resolve,reject});worker.postMessage({id,type,...payload},transfer);
 }catch(err){pending.delete(id);reject(err);}
});}
function message(text,error=false){
 const el=state.snapshot?$('workspace-status'):$('welcome-status');
 el.hidden=!text;el.textContent=text;el.className=state.snapshot?(error?'workspace-status error':'workspace-status'):(error?'status error':'status');
 if(state.snapshot){const count=++noticeCount;setTimeout(()=>{if(count===noticeCount)el.hidden=true;},6500);}
}
function renderAudit(){
 const root=$('timing-audit');
 if(!root)return;
 const prior=root.querySelector('details');
 const wasOpen=prior?.open;
 root.replaceChildren();
 const a=state.snapshot?.timingAudit;
 if(!a||a.diagnosticOnly!==true||a.writerAuthorized!==false)return;
 const detail=make('details','audit-details');
 detail.open=wasOpen??false;
 detail.append(make('summary','',t('auditTitle')+' · '+a.total));
 const numbers=make('div','audit-counters');
 for(const [key,n] of [
  ['auditShared',a.statuses.SPECIAL_2126_UNRESOLVED],
  ['auditDistant',a.statuses.DISTANT_FUTURE_UNVERIFIED],
  ['auditFuture',a.statuses.FUTURE],
  ['auditInvalid',a.statuses.INVALID],
  ['auditPast',a.statuses.PAST]
 ])numbers.append(make('span','',t(key,{n})));
 detail.append(numbers);
 if(a.shared2126.multiTypePattern)detail.append(make('p','audit-uncertainty',t('auditMulti')));
 detail.append(make('p','audit-uncertainty',t('auditNoRepair')));
 detail.append(make('p','audit-provenance',t('auditUnknown')));
 root.append(detail);
 const envelope=state.snapshot?.containerAudit;
 if(envelope&&envelope.writerAuthorized===false){
  const box=make('details','audit-details container-audit');
  box.append(make('summary','',t('containerAuditTitle')));
  box.append(make('p','audit-provenance',t('containerAuditStatus',{status:envelope.status})));
  for(const code of envelope.findings||[])box.append(make('p','audit-provenance',code));
  box.append(make('p','audit-uncertainty',t('containerAuditNoWrite')));
  root.append(box);
 }
}
function showEditor(){
 $('welcome').hidden=true;$('workspace').hidden=false;
 $('session-name').textContent=state.snapshot.identity.name||'Save opened';
 $('download-backup').disabled=false;verifiedOutputs.sync();
 renderAudit();renderTabs();renderFilters();renderList();renderDetails();
}
function showWelcome(){if(state.snapshot)return;$('welcome').hidden=false;$('workspace').hidden=true;}
const backupCoordinator=createOriginalBackupCoordinator({
 requestBackup:sessionId=>request('backup',{sessionId}),
 isCurrentSession:sessionId=>!state.loading&&state.sessionId===sessionId,
 saveOriginal:data=>{
  const blob=new Blob([data.buffer],{type:'application/octet-stream'}),url=URL.createObjectURL(blob);
  const anchor=make('a');anchor.href=url;anchor.download=`original_${data.name}`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
});

// Phase A: presentation-only download wiring. No Writer command or receipt
// producer is connected. CORE/02 TIME/05 QR must first authorize an exact
// SourceHash+Session+Plan contract; UI must never mint WORKER_VERIFIED_PAIR.
const verifiedOutputs=createVerifiedPairDownloadUi({
 currentSession:()=>state.loading?null:state.sessionId,
 currentPlanRevision:()=>outputPlanRevision,
 controls:{panel:$('verified-pair-downloads'),both:$('download-verified-both'),
  original:$('retry-verified-original'),edited:$('retry-verified-edited')},
 triggerDownload:(kind,file)=>{
  if(state.loading||!state.sessionId||!(file?.buffer instanceof ArrayBuffer)||
     !/^[^/\\\u0000-\u001f]{1,180}\.p1g$/i.test(file.name)||
     !file.name.startsWith(kind+'_'))
   throw new Error('Verified output filename/session is invalid.');
  const url=URL.createObjectURL(new Blob([file.buffer],{type:'application/octet-stream'}));
  try{
   const anchor=make('a');
   anchor.href=url;anchor.download=file.name;anchor.click();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),10000);}
 },
 onStatus:(kind,result)=>{
  const label=value=>value==='TRIGGER_REQUESTED_UNCONFIRMED'?t('pairRequested'):
    value==='TRIGGER_FAILED'?t('pairBlocked'):t('pairNotAttempted');
  const status=$('verified-pair-status');
  status.textContent=kind==='error'?String(result):typeof result==='string'
   ?label(result):t('pairBothStatus',{original:label(result.original),edited:label(result.edited)});
 }
});
function invalidateVerifiedOutput(){++outputPlanRevision;verifiedOutputs.invalidate();$('verified-pair-status').textContent='';}
// Future Phase B may call acceptWorkerPair ONLY on a CORE-authenticated Worker
// result with matching source hash, event/path old values, session and plan.
// Deliberately no product invocation exists while writerAuthorized=false.

async function openSave(file){
 if(!file||state.loading)return;
 backupCoordinator.invalidate();invalidateVerifiedOutput();++preflightSequence;state.planPending=false;
 state.loading=true;$('open-welcome').disabled=true;$('open-again').disabled=true;
 const old=state.snapshot,oldDraft=state.draft,oldSession=state.sessionId,oldPreflight=state.preflight;
 let workerSessionCommitted=false;
 message(t('loading',{name:file.name}));
 try{
  const buffer=await file.arrayBuffer();
  if(!buffer.byteLength)throw new Error('Empty file');
  const result=await request('open',{buffer,name:file.name},[buffer]);
  workerSessionCommitted=true;
  ++preflightSequence;
  state.snapshot=result.view;state.sessionId=result.sessionId;state.preflight=null;state.planPending=false;
  state.draft=createTimingDraft(result.view);state.tab='spawn';state.world='all';state.group=null;state.subgroup=null;state.selected.clear();state.query='';state.limit=120;state.mode='now';
  $('filter-input').value='';$('sort-order').value='name';$('time-mode').value='now';$('custom-time').value='';$('custom-time').disabled=true;
  showEditor();message(t('opened',{format:result.format}));
 }catch(err){
  if(!workerSessionCommitted&&old){state.snapshot=old;state.draft=oldDraft;state.sessionId=oldSession;state.preflight=oldPreflight;showEditor();}
  else{state.snapshot=null;state.draft=null;state.sessionId=null;state.preflight=null;showWelcome();}
  message(t('loadError',{name:file.name,reason:err instanceof Error?err.message:String(err)}),true);
 }finally{state.loading=false;$('open-welcome').disabled=false;$('open-again').disabled=false;$('save-file').value='';renderPlan();}
}
function fileDialog(){$('save-file').click();}
function localizedItem(item){const names=item.names||{};return safeText(names[state.locale]||names['en-US']||item.name||t('recordIndex',{id:item.id}));}
function recordTitle(r){
 if(r.items.length){const unique=[...new Set(r.items.map(localizedItem).filter(Boolean))];if(unique.length===1)return unique[0];if(unique.length>1)return categoryName(state.locale,r.subgroup||r.group);}
 if(r.source==='World.RecurringEvents')return categoryName(state.locale,r.subgroup||r.group)||t('eventId',{id:r.id});
 if(r.kind==='StoreInfo.LastRefresh')return t('storeName',{id:r.id});
 if(r.kind==='DisplayInfo.LastRefresh'){const slot=r.label.match(/(\d+)$/)?.[1]||'?';return t('displaySlot',{n:slot});}
 if(r.kind==='GardenData.Slots.Sapling.EndOfGrowth'){const slot=r.label.match(/(\d+)$/)?.[1]||'?';return t('gardenSlot',{n:slot});}
 if(r.kind?.includes('TreeAndBushData'))return categoryName(state.locale,'果樹・茂み');
 if(r.kind?.includes('StallData')||r.kind?.includes('ShopData'))return categoryName(state.locale,r.group);
 if(r.kind==='ResetTimer')return r.id==='LastDailyReset'?'Daily reset':'Weekly reset';
 return r.label&&state.locale==='ja'?r.label:categoryName(state.locale,r.subgroup||r.group)||t('defaultEvent',{id:r.id});
}
function recordLocation(r){const region=t(r.world);const biome=areaName(state.locale,r.areaKey);return biome?`${region} · ${biome}`:region;}
function recordSearch(r){return [recordTitle(r),r.label,r.id,r.kind,r.group,r.subgroup,r.eventName,...r.items.flatMap(x=>[x.id,x.name,...Object.values(x.names||{})])].filter(Boolean).join(' ').toLocaleLowerCase();}
function renderTabs(){
 const root=$('tabs');root.replaceChildren();
 for(const [tab] of TAB_ORDER){const b=click(t('tab_'+tab),()=>{state.tab=tab;state.world='all';state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderTabs();renderFilters();renderList();renderDetails();},'');b.className=state.tab===tab?'active':'';b.setAttribute('aria-current',String(state.tab===tab));root.append(b);}
}
const tabRows=()=>state.snapshot?.rows.filter(r=>r.tab===state.tab)||[];
const worldRows=()=>tabRows().filter(r=>state.world==='all'||r.world===state.world);
const groupRows=()=>worldRows().filter(r=>(state.group===null||r.group===state.group)&&(state.subgroup===null||r.subgroup===state.subgroup));
function visibleRows(){
 const query=state.query;let rows=groupRows().filter(r=>!query||recordSearch(r).includes(query));
 if(state.sort==='name')return rows.slice().sort((a,b)=>recordTitle(a).localeCompare(recordTitle(b),state.locale));
 const clone=rows.slice();
 if(state.sort==='time')clone.sort((a,b)=>(a.time===null)-(b.time===null)||(a.time||'').localeCompare(b.time||'')||recordTitle(a).localeCompare(recordTitle(b),state.locale));
 if(state.sort==='future')clone.sort((a,b)=>Number(['FUTURE','DISTANT_FUTURE_UNVERIFIED','SPECIAL_2126_UNRESOLVED'].includes(b.status))-Number(['FUTURE','DISTANT_FUTURE_UNVERIFIED','SPECIAL_2126_UNRESOLVED'].includes(a.status))||recordTitle(a).localeCompare(recordTitle(b),state.locale));
 return clone;
}
function filterButton(name,count,active,fn){const b=click(name,fn,'');b.className=active?'active':'';b.append(make('small','',count));return b;}
function renderFilters(){
 const rows=tabRows(),regions=$('regions');regions.replaceChildren();
 for(const [id] of WORLD_ORDER){const count=rows.filter(r=>id==='all'||r.world===id).length;if(id!=='all'&&!count)continue;regions.append(filterButton(t(id==='all'?'allRegions':id),count,state.world===id,()=>{state.world=id;state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));}
 const grouped=worldRows(),groups=$('groups');groups.replaceChildren();
 groups.append(filterButton(t('all'),grouped.length,state.group===null,()=>{state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));
 const byGroup=new Map();
 for(const r of grouped){if(!byGroup.has(r.group))byGroup.set(r.group,new Map());const inner=byGroup.get(r.group);inner.set(r.subgroup,(inner.get(r.subgroup)||0)+1);}
 for(const [group,subs] of byGroup){const total=[...subs.values()].reduce((a,b)=>a+b,0);const list=make('div');list.append(filterButton(categoryName(state.locale,group),total,state.group===group&&state.subgroup===null,()=>{state.group=group;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));if(subs.size>1){const details=make('details');details.open=state.group===group;const summary=make('summary','',categoryName(state.locale,group));details.append(summary);for(const [sub,count] of subs)details.append(filterButton(categoryName(state.locale,sub),count,state.group===group&&state.subgroup===sub,()=>{state.group=group;state.subgroup=sub;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));list.append(details);}groups.append(list);}
}
function iconFor(item){const record=iconManifest?.icons?.[String(item.id)];if(!record||record.platform!=='Steam'||record.gameVersion!=='1.25.3'||record.verified!==true||typeof record.path!=='string'||!/^assets\/steam\/v1253\/[a-zA-Z0-9_/-]+\.(?:webp|png)$/.test(record.path)||!(/^[0-9a-f]{64}$/.test(record.sha256||'')))return null;return new URL('../'+record.path,import.meta.url).href;}
function imageCluster(r){
 const root=make('span','record-art');const all=r.items.slice(0,3);
 if(!all.length){const empty=make('span','record-art-empty','✦');empty.setAttribute('aria-label',t('imagesUnavailable'));root.append(empty);return root;}
 for(const item of all){const url=iconFor(item);if(!url){const empty=make('span','record-art-empty','✦');empty.setAttribute('title',t('imagesUnavailable'));root.append(empty);continue;}
  const image=make('img','record-icon');image.src=url;image.alt=localizedItem(item);image.loading='lazy';image.decoding='async';image.addEventListener('error',()=>{const empty=make('span','record-art-empty','✦');empty.setAttribute('title',t('imagesUnavailable'));image.replaceWith(empty);});root.append(image);
 }
 if(r.items.length>3)root.append(make('span','art-more','+'+(r.items.length-3)));
 return root;
}
function makeRecord(r){
 const label=make('label',state.selected.has(r.pointer)?'record checked':'record');
 const check=make('input');check.type='checkbox';check.checked=state.selected.has(r.pointer);check.setAttribute('aria-label',`${recordTitle(r)}: ${t('selectVisible')}`);
 check.addEventListener('change',()=>{if(check.checked)state.selected.add(r.pointer);else state.selected.delete(r.pointer);label.classList.toggle('checked',check.checked);renderSelectionLabel();renderDetails();});
 const body=make('span','record-data');body.append(make('span','record-title',recordTitle(r)),make('span','record-subtitle',recordLocation(r)));
 if(r.items.length>1)body.append(make('span','record-items',r.items.length<=3?r.items.map(localizedItem).join(' · '):t('multiItems',{n:r.items.length})));
 const timing=make('span','record-timing');timing.append(make('span','record-timing-label',t(r.timingKey||'timeStored')),make('span','record-time',fmt(r.time)));
 if(['SPECIAL_2126_UNRESOLVED','DISTANT_FUTURE_UNVERIFIED'].includes(r.status)){timing.classList.add('record-warning');timing.append(make('span','record-timing-note',t(r.status==='SPECIAL_2126_UNRESOLVED'?'statusSentinel':'statusDistant')));}
 label.append(check,imageCluster(r),body,timing);return label;
}
function renderSelectionLabel(){const n=state.selected.size;$('selection-label').textContent=n?t('selected',{n}):t('unselected');}
function renderList(){
 const rows=visibleRows();$('category-title').textContent=t('tab_'+state.tab);
 $('record-count').textContent=t('recordCount',{n:rows.length});const root=$('records');root.replaceChildren();
 if(!rows.length)root.append(make('p','empty',t('noRecords')));
 else for(const r of rows.slice(0,state.limit))root.append(makeRecord(r));
 $('more-records').hidden=rows.length<=state.limit;$('more-records').textContent=t('more',{n:rows.length-state.limit});
 $('select-visible').disabled=!rows.length;renderSelectionLabel();
}
function setTime(){state.mode=$('time-mode').value;$('custom-time').disabled=state.mode!=='custom';renderDetails();}
function renderPlan(){
 const root=$('draft-plan');root.replaceChildren();
 const v=state.draft?.view();
 $('stage-preview').disabled=!v||state.loading||state.selected.size===0;
 $('undo-plan').disabled=state.loading||!v?.canUndo;
 $('redo-plan').disabled=state.loading||!v?.canRedo;
 $('clear-plan').disabled=state.loading||!v?.count;
 if(!v){root.textContent=t('planEmpty');return;}
 root.append(make('strong','draft-plan-title',v.count?t('planCount',{n:v.count}):t('planEmpty')));
 const rowsByPointer=new Map(state.snapshot.rows.map(r=>[r.pointer,r]));
 const preflightCodes=new Map((state.preflight?.rows||[]).map(r=>[r.pointer,r.code]));
 const compatibilityCodes=new Map((state.preflight?.compatibility?.rows||[]).map(r=>[r.pointer,r.code]));
 for(const change of v.entries.slice(0,8)){
  const el=make('div','draft-plan-item');
  const row=rowsByPointer.get(change.pointer);
  el.append(make('strong','',row?recordTitle(row):change.pointer),
   make('span','',fmt(change.originalTime)+' → '+fmt(change.targetTime)));
  if(preflightCodes.has(change.pointer))el.append(make('span','draft-plan-check',t('preflightRow',{code:preflightCodes.get(change.pointer)})));
  if(compatibilityCodes.has(change.pointer))el.append(make('span','draft-plan-check',t('compatibilityRow',{code:compatibilityCodes.get(change.pointer)})));
  root.append(el);
 }
 if(v.count>8)root.append(make('p','caption',t('planMore',{n:v.count-8})));
 const audit=state.preflight?.summary;
 if(state.planPending)root.append(make('p','draft-plan-note',t('preflightPending')));
 else if(audit)root.append(make('p','draft-plan-note',t('preflightSummary',{
  observed:audit.structuralShapeObserved,held:audit.heldForReview,rejected:audit.rejected
 })));
 const research=state.preflight?.compatibility?.summary;
 if(research&&!state.planPending)root.append(make('p','draft-plan-note',
  t('compatibilitySummary',{candidates:research.researchCandidate,drift:research.versionReview,excluded:research.excluded})));
 root.append(make('p','draft-plan-note',t('planReadOnly')));
}
function renderDetails(){
 renderPlan();
 const rows=state.snapshot?.rows.filter(r=>state.selected.has(r.pointer))||[],n=rows.length;
 const selected=$('selection-info');selected.replaceChildren();
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Local';$('timezone-label').textContent=`${t('timeZone')}: ${zone}`;
 if(!n){selected.textContent=t('selectPrompt');$('preview').replaceChildren();$('technical-details').replaceChildren();return;}
 selected.append(make('strong','',t('selected',{n})));
 if(n===1)selected.append(make('p','',recordTitle(rows[0])));
 const preview=$('preview');preview.replaceChildren();const custom=$('custom-time').value;
 const clock=Date.now();
 try{
  const when=state.mode==='custom'?parseLocalDateTime(custom):state.mode==='now'?null:resolveTimePreset(state.mode,{now:clock});
  if(state.mode==='custom'&&custom&&!when)throw new Error(t('errorInvalidLocal'));
  const result=previewScope(state.snapshot,{tab:state.tab,pointers:rows.map(r=>r.pointer),world:'all',mode:state.mode==='now'?'now':'custom',customTime:when,now:clock});
  const summary=make('div','preview-summary');summary.append(make('span','',t('previewScope',{n:result.affected.length})),make('strong','',`${t('previewTime')}: ${fmt(result.previewTime)}`));preview.append(summary);
  for(const row of result.affected.slice(0,24)){const item=make('div','preview-row');item.append(make('strong','',recordTitle(row)),make('span','',`${fmt(row.time)} → ${fmt(result.previewTime)}`));preview.append(item);}
  if(result.affected.length>24)preview.append(make('p','caption',t('morePreview',{n:result.affected.length-24})));
 }catch(err){preview.append(make('p','caption',state.mode==='custom'&&!custom?t('needsTime'):err.message));}
 const details=$('technical-details');details.replaceChildren();
 for(const r of rows.slice(0,8)){const p=make('p','');p.textContent=`${recordTitle(r)} | Event/Item ID: ${r.id??'unknown'} | ${r.kind} | ${r.source} | ${r.pointer} | ${t('rawUTC')}: ${r.time||'unknown'}${r.reason?' | '+r.reason:''}${r.review?' | Review: '+r.review.status+' | '+r.review.reason:''}`;details.append(p);}
 if(n>8)details.append(make('p','',t('morePreview',{n:n-8})));
}
async function refreshPreflight(){
 const seq=++preflightSequence,sessionId=state.sessionId;
 const plan=state.draft?.view();
 state.preflight=null;state.planPending=Boolean(plan?.count);renderPlan();
 if(!plan?.count)return;
 try{
  const entries=plan.entries.map(x=>({
   pointer:x.pointer,originalTime:x.originalTime,targetTime:x.targetTime
  }));
  const response=await request('preflight',{sessionId,entries});
  if(seq!==preflightSequence||sessionId!==state.sessionId)return;
  if(response.sessionId!==sessionId)throw new Error('Preflight session changed.');
  state.preflight={...response.report,compatibility:response.compatibility};
 }catch(err){
  if(seq===preflightSequence&&sessionId===state.sessionId)
   message(t('preflightFailed',{reason:err.message}),true);
 }finally{
  if(seq===preflightSequence&&sessionId===state.sessionId){
   state.planPending=false;renderPlan();
  }
 }
}
function stagePreview(){
 try{
  if(!state.draft||!state.snapshot||state.loading)throw new Error('No available read-only session.');
  const rows=state.snapshot.rows.filter(r=>state.selected.has(r.pointer)&&r.tab===state.tab);
  if(rows.length!==state.selected.size||!rows.length)throw new Error('Select current timing records.');
  const clock=Date.now(),custom=$('custom-time').value;
  const target=state.mode==='custom'?parseLocalDateTime(custom):resolveTimePreset(state.mode,{now:clock});
  if(!target)throw new Error(t('needsTime'));
  const preview=previewScope(state.snapshot,{
   tab:state.tab,pointers:rows.map(r=>r.pointer),world:'all',mode:'custom',
   customTime:target,now:clock
  });
  if(preview.affected.length!==rows.length)throw new Error('Preview selection was not consistent.');
  state.draft.stage(preview.affected.map(r=>r.pointer),preview.previewTime);
  invalidateVerifiedOutput();renderDetails();void refreshPreflight();message(t('planUpdated'));
 }catch(err){message(t('planFail',{reason:err.message}),true);}
}
async function backup(){try{await backupCoordinator.download(state.sessionId);}catch(err){message(t('backupError',{reason:err.message}),true);}}
function bindDrop(){
 const overlay=$('drop-overlay'),fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 document.addEventListener('dragenter',e=>{if(fileDrag(e)){e.preventDefault();overlay.hidden=false;}});
 document.addEventListener('dragover',e=>{if(fileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';overlay.hidden=false;}});
 document.addEventListener('dragleave',e=>{if(!e.relatedTarget||e.relatedTarget===document.documentElement)overlay.hidden=true;});
 document.addEventListener('drop',e=>{e.preventDefault();overlay.hidden=true;const file=e.dataTransfer?.files?.[0];if(file)openSave(file);});
 window.addEventListener('blur',()=>{overlay.hidden=true;});
}
function refreshLanguage(){
 document.documentElement.lang=state.locale;
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 $('filter-input').placeholder=t('search');
 for(const id of ['welcome-language','workspace-language'])$(id).value=state.locale;
 const overlay=$('drop-overlay').querySelector('.drop-message');overlay.lastChild.textContent=' '+t('dropHint');
 if(state.snapshot){renderAudit();renderTabs();renderFilters();renderList();renderDetails();}
}
function setLanguage(locale){if(!SUPPORTED_LOCALES.includes(locale))return;state.locale=locale;try{localStorage.setItem('dreamlight-timekeeper-locale',locale);}catch{}refreshLanguage();}
async function loadIcons(){try{const r=await fetch(new URL('../data/steam-icons-v1253.json',import.meta.url));if(!r.ok)return;const file=await r.json();if(file?.source?.platform==='Steam/Windows'&&file?.source?.gameVersion==='1.25.3'&&file.icons&&typeof file.icons==='object')iconManifest=file;}catch{}}
function boot(){
 for(const id of ['welcome-language','workspace-language']){const el=$(id);for(const locale of SUPPORTED_LOCALES){const name=new Intl.DisplayNames([locale],{type:'language'}).of(locale);el.append(make('option','',name));el.lastChild.value=locale;}el.addEventListener('change',()=>setLanguage(el.value));}
 $('open-welcome').addEventListener('click',fileDialog);$('open-again').addEventListener('click',fileDialog);
 $('save-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)openSave(file);});
 $('download-backup').addEventListener('click',backup);
 $('stage-preview').addEventListener('click',stagePreview);
 $('undo-plan').addEventListener('click',()=>{if(state.loading)return;state.draft?.undo();invalidateVerifiedOutput();renderDetails();void refreshPreflight();});
 $('redo-plan').addEventListener('click',()=>{if(state.loading)return;state.draft?.redo();invalidateVerifiedOutput();renderDetails();void refreshPreflight();});
 $('clear-plan').addEventListener('click',()=>{if(state.loading)return;state.draft?.clear();invalidateVerifiedOutput();renderDetails();void refreshPreflight();});
 $('filter-input').addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase();state.limit=120;state.selected.clear();renderList();renderDetails();});
 $('sort-order').addEventListener('change',e=>{state.sort=e.target.value;state.limit=120;renderList();});
 $('select-visible').addEventListener('click',()=>{for(const row of visibleRows())state.selected.add(row.pointer);renderList();renderDetails();});
 $('clear-selection').addEventListener('click',()=>{state.selected.clear();renderList();renderDetails();});
 $('more-records').addEventListener('click',()=>{state.limit+=120;renderList();});
 $('time-mode').addEventListener('change',setTime);
 $('custom-time').addEventListener('change',renderDetails);
 bindDrop();refreshLanguage();window.__dreamlightBooted=true;
 loadIcons().then(()=>{if(state.snapshot)renderList();});
 request('check').catch(err=>message('Initialization error: '+err.message,true));
}
boot();
