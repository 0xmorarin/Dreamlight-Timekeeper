<script lang="ts">
 import {base} from '$app/paths';
 import {onMount} from 'svelte';
 import ResponsiveFrame from '$lib/wand-ui/ResponsiveFrame.svelte';
 import SegmentedControl from '$lib/wand-ui/SegmentedControl.svelte';
 import LiveRegion from '$lib/wand-a11y/LiveRegion.svelte';
 import {locale,t as wandTranslate,SUPPORTED_LOCALES,initializeLocalePreference,setManualLocalePreference,resetToBrowserLanguage,legacyLocale,oldText,dateLabel,parseLocalDateTime,categoryName,areaName} from '$lib/timekeeper/locale';
 import {JsWorkerAdapter} from '$lib/timekeeper/worker-adapter';
 import type {TimingSnapshot,TimingRow,PlanView,VerifiedPair,SaveResponse} from '$lib/timekeeper/model';
 import {TAB_ORDER,WORLD_ORDER,previewScope} from '../reader.mjs';
 import {resolveTimePreset} from '../time-presets.mjs';
 import {createTimingDraft} from '../core/timing-draft.mjs';
 import {createOriginalBackupCoordinator} from '../ui-backup-coordinator.mjs';
 import {createVerifiedPairDownloadUi} from '../ui-verified-pair-downloads.mjs';
 import ItemThumb from '$lib/timekeeper/ItemThumb.svelte';
 import itemTypeAudit from '../../data/web-text-item-types-v1253.json';
 import {rcTextOnlyItem} from '$lib/timekeeper/item-text-only.mjs';

 let localeCode='en',snapshot:TimingSnapshot|null=null,sessionId=0,sourceFormat='';
 let t=(key:string,params:Record<string,unknown>={})=>wandTranslate(key,params);
 let tab='spawn',world='all',category='',subCategory='',query='',sort='name',selected=new Set<string>(),limit=80;
 let mode='now',customTime='',confirmedSwitch=false;
 let draft:any=null,plan:PlanView|null=null,preflight:any=null,planPending=false;
 let busy=false,preparing=false,prepared=false,revision=0,preflightSerial=0;
 let progress='',notice='',error='',preparedMessage='';
 let drag=false,uploaded:HTMLInputElement;
 let pairPanel:HTMLElement,pairBoth:HTMLButtonElement,pairOriginal:HTMLButtonElement,pairEdited:HTMLButtonElement;
 let verified:any=null,backupCoordinator:any=null,engine:JsWorkerAdapter|null=null;
 let localeUnsubscribe:()=>void=()=>{};
 const targetBid='9A239D3DB569756D';
 const tabs=TAB_ORDER.map(([value]:[string,string])=>({value,label:value}));
 const worlds=WORLD_ORDER.map(([value]:[string,string])=>value);
 const phase=()=>({sessionId,planRevision:revision});
 const saveFile=(name:string,buffer:ArrayBuffer)=>{
  if(!name||name.includes('/')||name.includes('\\')||name.length>180)throw Error('Unsafe download name');
  const u=URL.createObjectURL(new Blob([buffer],{type:'application/octet-stream'}));
  try{const a=document.createElement('a');a.href=u;a.download=name;a.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(u),10000);}
 };
 const invalidateOutput=()=>{
  revision++;prepared=false;verified?.invalidate();preparedMessage='';preflight=null;
 };
 const updatePlan=()=>{plan=draft?.view()??null;};
 function selectedRows(){return snapshot?.rows.filter(r=>selected.has(r.pointer))??[];}
 function labelRow(r:TimingRow){
  const names=r.items?.map(i=>i.names?.[legacyLocale(localeCode)]??i.names?.['en-US']??i.name).filter(Boolean)??[];
  if(names.length===1)return String(names[0]);
  return String(r.subgroup||r.group||r.label||r.eventName||r.id);
 }
 const location=(r:TimingRow)=>{
  const key=r.world==='all'?'allRegions':r.world;
  return oldText(legacyLocale(localeCode),key)+(r.areaKey?' · '+areaName(legacyLocale(localeCode),r.areaKey):'');
 };
 $: tabRows=snapshot?.rows.filter(r=>r.tab===tab)??[];
 $: worldRows=tabRows.filter(r=>world==='all'||r.world===world);
 $: categories=[...new Set(worldRows.map(r=>r.group).filter(Boolean))];
 $: subCategories=category?[...new Set(worldRows.filter(r=>r.group===category).map(r=>r.subgroup).filter(Boolean))]:[];
 $: visible=worldRows.filter(r=>(!category||r.group===category)&&(!subCategory||r.subgroup===subCategory)&&
   (!query||[labelRow(r),r.id,r.kind,r.group,r.subgroup,r.eventName,r.label,
     ...(r.items??[]).flatMap(i=>[i.id,i.name,...Object.values(i.names??{})])]
       .filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
    .sort((a,b)=>sort==='time'?String(a.time??'').localeCompare(String(b.time??'')):
     sort==='future'?Number((b.status??'').includes('FUTURE'))-Number((a.status??'').includes('FUTURE')):
     labelRow(a).localeCompare(labelRow(b),legacyLocale(localeCode)));
 $: chosen=snapshot?.rows.filter(row=>selected.has(row.pointer))??[];
 $: targetTime=mode==='custom'?(customTime?parseLocalDateTime(customTime):null):
  resolveTimePreset(mode,{now:Date.now()});
 $: preview=(()=>{
  if(!snapshot||!chosen.length||!targetTime)return null;
  try{return (previewScope as any)(snapshot,{tab,pointers:chosen.map(r=>r.pointer),world:'all',
   mode:'custom',customTime:targetTime,now:Date.now()});}
  catch{return null;}
 })();
 $: canPrepare=Boolean(snapshot&&sourceFormat==='packaged'&&!busy&&!preparing&&!prepared&&
   !planPending&&confirmedSwitch&&plan?.count&&plan.count<=100);

 function resetScope(){selected=new Set();limit=80;}
 function resetFilter(){category='';subCategory='';resetScope();}
 function selectAll(){selected=new Set(visible.map(r=>r.pointer));}
 function toggle(pointer:string,checked:boolean){const next=new Set(selected);checked?next.add(pointer):next.delete(pointer);selected=next;}
 function updateRevision(){invalidateOutput();}
 async function open(file:File|null|undefined){
  if(!file||busy||!engine)return;
  busy=true;progress='';notice='';error='';invalidateOutput();backupCoordinator?.invalidate();
  // Fail closed on failed replacement: the old Worker is terminated and source
  // bytes are never retained in Svelte stores.
  snapshot=null;sessionId=0;draft=null;plan=null;sourceFormat='';selected=new Set();
  try{
   const response=await engine.open(file,p=>{
    progress=p.phase+(p.loaded===undefined?'':` ${p.loaded}/${p.total??0}`);
   });
   snapshot=response.view;sessionId=response.sessionId;sourceFormat=response.format;
   draft=createTimingDraft(response.view);updatePlan();
   tab='spawn';world='all';category='';subCategory='';query='';sort='name';mode='now';
   confirmedSwitch=false;customTime='';notice=t('tk.ready');progress='';
  }catch(e){error=String(e instanceof Error?e.message:e);progress='';}
  finally{busy=false;if(uploaded)uploaded.value='';}
 }
 async function backup(){
  if(!sessionId||busy)return;
  try{await backupCoordinator?.download(sessionId);notice=t('tk.saveState');}
  catch(e){error=String(e instanceof Error?e.message:e);}
 }
 async function refreshPreflight(){
  const current=++preflightSerial,s=sessionId,entries=plan?.entries??[];
  preflight=null;planPending=entries.length>0;
  if(!entries.length)return;
  try{
   const data=await engine?.request({type:'preflight',sessionId:s,entries});
   if(current===preflightSerial&&s===sessionId)preflight=data;
  }catch(e){if(current===preflightSerial&&s===sessionId)error=String(e);}
  finally{if(current===preflightSerial&&s===sessionId)planPending=false;}
 }
 function stage(){
  if(!draft||!preview||preview.affected.length!==selected.size||!selected.size){
   error=t('tk.invalid');return;
  }
  try{draft.stage(preview.affected.map((r:TimingRow)=>r.pointer),preview.previewTime);
   invalidateOutput();updatePlan();void refreshPreflight();notice=oldText(localeCode,'planUpdated');}
  catch(e){error=String(e instanceof Error?e.message:e);}
 }
 function changePlan(action:'undo'|'redo'|'clear'){
  if(!draft||busy)return;
  draft[action]();invalidateOutput();updatePlan();void refreshPreflight();
 }
 async function prepare(){
  if(!engine||!snapshot||!canPrepare||!plan)return;
  const s=sessionId,at=revision;
  const lookup=new Map(snapshot.rows.map(row=>[row.pointer,row]));
  const entries=plan.entries.map(e=>({pointer:e.pointer,eventId:lookup.get(e.pointer)?.id??'',
    kind:lookup.get(e.pointer)?.kind??'',originalTime:e.originalTime,targetTime:e.targetTime}));
  preparing=true;error='';
  try{
   const out=await engine.request<Extract<SaveResponse,{type:'preparedEdited'}>>({
    type:'prepareEdited',sessionId:s,planRevision:at,entries,
    targetBuildId:targetBid,confirmedSwitchTarget:true
   });
   if(s!==sessionId||at!==revision||sourceFormat!=='packaged')return;
   if(out.type!=='preparedEdited'||out.sessionId!==s||out.planRevision!==at||
      out.receipt?.status!=='WORKER_VERIFIED_PAIR')throw Error('Unverified Worker output');
   verified?.acceptWorkerPair(out.receipt,phase());prepared=true;
   notice=oldText(localeCode,'pairReady');
  }catch(e){if(s===sessionId&&at===revision)error=String(e instanceof Error?e.message:e);}
  finally{preparing=false;}
 }
 async function resetLanguage(){await resetToBrowserLanguage();notice='';}
 onMount(()=>{
  engine=new JsWorkerAdapter();
  localeUnsubscribe=locale.subscribe(code=>{
   localeCode=code;
   // Svelte tracks an assigned function reference; Wand locale runtime itself
   // is shared, while this triggers UI copy updates on manual locale changes.
   t=(key:string,params:Record<string,unknown>={})=>wandTranslate(key,params);
  });
  void initializeLocalePreference().catch(()=>{});
  backupCoordinator=createOriginalBackupCoordinator({
   requestBackup:(s:number)=>engine!.request({type:'backup',sessionId:s}),
   isCurrentSession:(s:number)=>!busy&&s===sessionId&&Boolean(snapshot),
   saveOriginal:(response:{name:string;buffer:ArrayBuffer})=>saveFile('original_'+response.name,response.buffer)
  });
  verified=(createVerifiedPairDownloadUi as any)({
   currentSession:()=>busy?null:sessionId,
   currentPlanRevision:()=>revision,
   controls:{panel:pairPanel,both:pairBoth,original:pairOriginal,edited:pairEdited},
   triggerDownload:(kind:string,file:{name:string;buffer:ArrayBuffer})=>{
    if(!sessionId||busy||!file.name.startsWith(kind+'_')||!file.name.endsWith('.p1g'))throw Error('Bad verified file');
    saveFile(file.name,file.buffer);
   },
   onStatus:(kind:string,result:any)=>{
    if(kind==='error'){error=String(result);return;}
    const toText=(status:string)=>oldText(localeCode,status==='TRIGGER_FAILED'?'pairBlocked':
      status==='TRIGGER_REQUESTED_UNCONFIRMED'?'pairRequested':'pairNotAttempted');
    preparedMessage=typeof result==='string'?toText(result):
      `${toText(result.original)} / ${toText(result.edited)}`;
   }
  });
  void engine.request({type:'check'}).catch(e=>{error=String(e);});
  return ()=>{localeUnsubscribe();backupCoordinator?.invalidate();verified?.invalidate();engine?.close();};
 });
</script>
<svelte:head><title>Dreamlight Timekeeper</title><meta name="description" content="Local DDV save timing viewer and verified W1 edited P1G copies"/></svelte:head>
<a class="skip" href="#main">{t('tk.open')}</a>
<ResponsiveFrame width="full">
 <header class="tk-head">
  <div class="brand"><img src={base+'/assets/app/ui/action/clock.svg'} alt="" width="26" height="26"/><strong>{t('tk.title')}</strong></div>
  <div class="language"><label for="tk-language">{t('tk.manual')}</label>
   <select id="tk-language" bind:value={localeCode} on:change={()=>setManualLocalePreference(localeCode)}>
    {#each SUPPORTED_LOCALES as l}<option value={l.code}>{l.nativeName}</option>{/each}
   </select><button type="button" class="quiet" on:click={resetLanguage}>{t('tk.resetLocale')}</button>
  </div>
 </header>
 <main id="main">
  <div class="notice" role="note"><span lang="en">Unofficial fan-made tool. Not affiliated with Disney or Gameloft. No rights to game images or trademarks claimed.</span><span lang="ja">非公式のファン制作ツールです。Disney／Gameloftとは無関係です。ゲーム画像や商標等の権利は主張しません。</span></div>
  <input bind:this={uploaded} id="tk-save-file" class="visually-hidden" type="file" accept=".p1g,.json,application/json" on:change={(e)=>open(e.currentTarget.files?.[0])}/>
  {#if !snapshot}
   <div class="landing" role="region" aria-label="Local save file drop area" class:drag on:dragover={(e)=>{e.preventDefault();drag=true;}} on:dragleave={()=>drag=false} on:drop={(e)=>{e.preventDefault();drag=false;void open(e.dataTransfer?.files?.[0]);}}>
    <img src={base+'/assets/app/ui/action/open-save.svg'} alt="" width="58" height="58"/>
    <h1>{t('tk.drop')}</h1>
    <button class="primary" type="button" disabled={busy} on:click={()=>uploaded?.click()}>{t('tk.open')}</button>
    <p>Local only · P1G / JSON · {t('tk.loading')}</p>
   </div>
  {:else}
   <div class="workspace-head">
    <h1>{snapshot.identity?.name??'Save'}</h1>
    <button type="button" on:click={()=>uploaded?.click()} disabled={busy}>{t('tk.again')}</button>
    <button type="button" on:click={backup} disabled={busy||!sessionId}><img src={base+'/assets/app/ui/action/backup.svg'} alt="" width="16" height="16"/>{t('tk.original')}</button>
   </div>
   <nav class="tabs" aria-label="Timing categories">
    <SegmentedControl label="Timing sections" items={tabs.map(x=>({value:x.value,label:oldText(localeCode,'tab_'+x.value)}))} value={tab}
     on:change={(e)=>{tab=e.detail.value;world='all';resetFilter();}}/>
   </nav>
   <div class="work-columns">
    <aside class="filters">
     <h2>{t('tk.region')}</h2>
     <div class="filter-options">
      {#each worlds as w}{#if w==='all'||tabRows.some(r=>r.world===w)}
       <button type="button" class:active={world===w} aria-pressed={world===w} on:click={()=>{world=w;resetFilter();}}>
        {oldText(localeCode,w==='all'?'allRegions':w)} <small>{tabRows.filter(r=>w==='all'||r.world===w).length}</small>
       </button>
      {/if}{/each}
     </div>
     <h2>{t('tk.category')}</h2>
     <button type="button" class:active={!category} on:click={resetFilter}>{oldText(localeCode,'all')}</button>
     {#each categories as cat}
      <button type="button" class:active={category===cat&&!subCategory} on:click={()=>{category=cat;subCategory='';resetScope();}}>{categoryName(legacyLocale(localeCode),cat)}</button>
     {/each}
     {#if subCategories.length>1}
      <div class="subcats">{#each subCategories as sub}
       <button type="button" class:active={subCategory===sub} on:click={()=>{subCategory=sub;resetScope();}}>{categoryName(legacyLocale(localeCode),sub)}</button>
      {/each}</div>
     {/if}
    </aside>
    <section class="items" aria-label={t('tk.item')}>
     <div class="searchbar">
      <label for="tk-filter">{t('tk.search')}</label>
      <input id="tk-filter" type="search" bind:value={query} on:input={resetScope}/>
      <label for="tk-sort" class="visually-hidden">Sort</label>
      <select id="tk-sort" bind:value={sort}><option value="name">Name</option><option value="time">Date</option><option value="future">Future</option></select>
     </div>
     <div class="bulk"><span>{visible.length} {t('tk.item')} · {selected.size} {oldText(localeCode,'selected',{n:selected.size})}</span>
      <button type="button" on:click={selectAll} disabled={!visible.length}>{t('tk.select')}</button>
      <button type="button" on:click={()=>selected=new Set()} disabled={!selected.size}>{t('tk.deselect')}</button>
     </div>
     <div class="row-list">
      {#each visible.slice(0,limit) as r (r.pointer)}
       <label class="event-row" class:checked={selected.has(r.pointer)}>
        <input type="checkbox" checked={selected.has(r.pointer)} on:change={(e)=>toggle(r.pointer,e.currentTarget.checked)}
          aria-label={labelRow(r)}/>
        <ItemThumb item={r.items?.[0]??null} localeCode={localeCode}/>
        <span class="row-text"><strong>{labelRow(r)}</strong><small>{location(r)} · {r.kind} · EventID {r.id}</small>
         {#if r.items?.length}
          <small class="item-type" aria-label={rcTextOnlyItem(r.items[0],localeCode,itemTypeAudit).ariaLabel}>{rcTextOnlyItem(r.items[0],localeCode,itemTypeAudit).displayLine}</small>
         {/if}
        </span>
        <span class="row-time">{dateLabel(r.time,localeCode)}</span>
       </label>
      {:else}<p class="empty">{t('tk.none')}</p>{/each}
     </div>
     {#if visible.length>limit}<button type="button" on:click={()=>limit+=80}>{t('tk.showMore')} ({visible.length-limit})</button>{/if}
    </section>
    <aside class="details">
     <h2>{t('tk.preview')}</h2>
     <p>{selected.size} {oldText(localeCode,'selected',{n:selected.size})}</p>
     <label for="tk-time-mode">Preset</label>
     <select id="tk-time-mode" bind:value={mode} on:change={updateRevision}>
      <option value="now">Now</option><option value="century">+100 years</option>
      <option value="release">2022-09-06</option><option value="custom">{t('tk.custom')}</option>
     </select>
     {#if mode==='custom'}<label for="tk-custom-time">{t('tk.custom')}</label>
      <input id="tk-custom-time" type="datetime-local" bind:value={customTime} on:input={updateRevision}/>
     {/if}
     <p class="meta">UTC: {targetTime??t('tk.invalid')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
     {#if preview}
      <p>{preview.affected.length} → {dateLabel(preview.previewTime,localeCode)}</p>
      <ul class="preview-list">{#each preview.affected.slice(0,12) as r}<li>{labelRow(r)}: {dateLabel(r.time,localeCode)} → {dateLabel(preview.previewTime,localeCode)}</li>{/each}</ul>
     {/if}
     <button type="button" class="primary" disabled={!preview||busy||!selected.size} on:click={stage}>{oldText(localeCode,'stagePreview')}</button>
     <div class="plan-tools">
      <button type="button" disabled={!plan?.canUndo||busy} on:click={()=>changePlan('undo')}>Undo</button>
      <button type="button" disabled={!plan?.canRedo||busy} on:click={()=>changePlan('redo')}>Redo</button>
      <button type="button" disabled={!plan?.count||busy} on:click={()=>changePlan('clear')}>Clear</button>
     </div>
     <p>{plan?.count??0} staged</p>
     {#each plan?.entries.slice(0,6)??[] as row (row.pointer)}
      <p class="plan-entry">{row.pointer}<small>{dateLabel(row.originalTime,localeCode)} → {dateLabel(row.targetTime,localeCode)}</small></p>
     {/each}
     {#if planPending}<p role="status">Preflight…</p>{/if}
     <div class="write-controls" hidden={sourceFormat!=='packaged'}>
      <label><input type="checkbox" bind:checked={confirmedSwitch} on:change={updateRevision}/>{t('tk.confirm')}</label>
      <button type="button" class="primary" disabled={!canPrepare} on:click={prepare}>{t('tk.edit')}</button>
     </div>
     <details class="audit"><summary>{t('tk.diagnostics')}</summary>
      <p>Source: {sourceFormat}, session {sessionId}</p>
      {#if snapshot.timingAudit}<pre>{JSON.stringify(snapshot.timingAudit).slice(0,3200)}</pre>{/if}
      {#if snapshot.containerAudit}<pre>{JSON.stringify(snapshot.containerAudit).slice(0,3200)}</pre>{/if}
      {#if preflight}<pre>{JSON.stringify(preflight).slice(0,3200)}</pre>{/if}
     </details>
    </aside>
   </div>
  {/if}
  <div class="output-bottom" hidden={!snapshot}>
   <section bind:this={pairPanel} hidden class="verified-pair" aria-label="Verified separate P1G downloads">
    <p>{oldText(localeCode,'pairWarning')}</p>
    <button bind:this={pairBoth} type="button" disabled>{t('tk.request')}</button>
    <div class="plan-tools">
     <button bind:this={pairOriginal} type="button" disabled>{oldText(localeCode,'pairRetryOriginal')}</button>
     <button bind:this={pairEdited} type="button" disabled>{oldText(localeCode,'pairRetryEdited')}</button>
    </div>
    <p aria-live="polite">{preparedMessage}</p>
   </section>
  </div>
  {#if progress}<p class="progress" role="status">{progress}</p>{/if}
  {#if error}<p class="alert" role="alert">{error}</p>{/if}
  {#if notice}<p class="progress" role="status">{notice}</p>{/if}
  <LiveRegion message={progress||error||notice}/>
 </main>
</ResponsiveFrame>
<style>
 :global(*){box-sizing:border-box}
 :global(body){margin:0;background:#10282c;color:#e8f2ee;font:14px/1.5 system-ui,-apple-system,sans-serif}
 :global(button),:global(input),:global(select){font:inherit}
 :global(button){background:#254449;color:#e8f2ee;border:1px solid #54737a;border-radius:8px;padding:8px 10px;cursor:pointer}
 :global(button:disabled){opacity:.45;cursor:not-allowed}
 :global(button:hover:not(:disabled)){background:#315960}
 :global(:focus-visible){outline:3px solid #f7d88f;outline-offset:3px}
 :global(.responsive-frame){width:100%;max-width:1600px;margin:0 auto;padding:12px}
 :global(.visually-hidden){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
 .skip{position:absolute;left:-5000px}.skip:focus{left:12px;top:4px;z-index:10;background:#faf8ed;color:#101d1d}
 .tk-head,.workspace-head,.bulk,.searchbar,.language,.brand,.plan-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
 .tk-head{justify-content:space-between;border-bottom:1px solid #3b5659;padding:10px 6px}
 .brand{font-size:18px}.language{justify-content:flex-end}.language select{max-width:158px}
 .quiet{font-size:11px;padding:4px 6px}.notice{display:flex;flex-direction:column;gap:3px;color:#cbd6d5;font-size:11px;padding:12px 6px}
 .landing{border:2px dashed #628284;border-radius:16px;max-width:650px;margin:7vh auto;padding:48px 24px;text-align:center;background:#163337}
 .landing.drag{border-color:#e1cc8b;background:#254e54}.landing h1{font-size:22px}.landing p{font-size:12px;color:#aac0c1}
 .primary{background:#41645c;border-color:#93afa1;color:white;font-weight:600}
 .workspace-head{padding:12px 0;justify-content:flex-start}.workspace-head h1{margin:0 auto 0 0;font-size:18px}
 .workspace-head button{display:flex;align-items:center;gap:6px}
 .tabs{margin:4px 0 12px}.tabs :global(.segmented-control){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
 .tabs :global(.segmented-control button){padding:12px 6px}.tabs :global(button.selected){background:#3e766d;border-color:#9acaad}
 .work-columns{display:grid;grid-template-columns:minmax(170px,225px) minmax(0,1fr) minmax(240px,320px);gap:12px;align-items:start}
 .filters,.items,.details{background:#173439;border:1px solid #3b535a;border-radius:12px;padding:12px;min-width:0}
 .filters button{width:100%;text-align:left;margin-bottom:4px;display:flex;justify-content:space-between}.filters button.active{background:#3e766d}
 .filters h2,.details h2{font-size:14px;margin:10px 0}.filters small{opacity:.7}.subcats{padding-left:12px}
 .searchbar{margin-bottom:12px}.searchbar label{font-size:12px}.searchbar input{flex:1;min-width:100px}
 input[type=search],input[type=datetime-local],select{color:#ecf5f3;background:#12282e;border:1px solid #587277;border-radius:7px;padding:8px;max-width:100%}
 .items .bulk{margin:10px 0}.bulk span{margin-right:auto}.bulk button{font-size:12px}
 .row-list{max-height:68vh;overflow:auto;overscroll-behavior:contain}
 .event-row{display:flex;align-items:center;gap:9px;border:1px solid #35535a;border-radius:8px;margin:5px 0;padding:10px 7px;cursor:pointer;min-width:0}
 .event-row.checked{border-color:#e4bf7a;background:#2b4c4d}.row-text{min-width:0;flex:1;overflow-wrap:anywhere}
 .row-text strong{display:block}.row-text small{display:block;font-size:11px;opacity:.8}
 .row-time{font-size:11px;max-width:145px;text-align:right;overflow-wrap:anywhere}
 .details>label,.details>select,.details>input{display:block;width:100%;margin:8px 0}
 .meta{font-size:11px;overflow-wrap:anywhere}.preview-list{font-size:11px;max-height:140px;overflow:auto;padding-left:20px}
 .plan-entry{border-top:1px solid #47616b;padding:6px 0;font-size:11px;overflow-wrap:anywhere}
 .plan-entry small{display:block}.write-controls{border-top:1px solid #526974;margin-top:18px;padding-top:12px}
 .write-controls label{display:flex;align-items:flex-start;gap:8px;font-size:12px}.write-controls button{margin-top:8px}
 .output-bottom{width:min(100%,340px);margin:12px 0 12px auto}.output-bottom[hidden]{display:none}
 .verified-pair{border:1px solid #d7b87c;border-radius:8px;margin-top:10px;padding:9px}.verified-pair[hidden],.write-controls[hidden]{display:none}
 .verified-pair p{font-size:11px}.verified-pair button{margin:4px 0}.audit{border-top:1px solid #47616b;margin-top:16px;padding-top:10px}
 pre{font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere}.progress{color:#c0dfcd}.alert{color:#ffd2c7}
 @media(max-width:900px){.work-columns{grid-template-columns:1fr 2fr}.details{grid-column:1/-1}}
 @media(max-width:600px){:global(.responsive-frame){padding:7px}.work-columns{grid-template-columns:1fr}.filters,.items,.details{grid-column:1}.filters{max-height:240px;overflow:auto}.row-list{max-height:55vh}.row-time{max-width:100px}.language{width:100%}.tabs :global(.segmented-control button){font-size:11px;padding:8px 2px}}
 @media(max-width:340px){.event-row{flex-wrap:wrap}.row-time{max-width:none;width:100%;text-align:left}.tk-head{align-items:start}}
</style>
