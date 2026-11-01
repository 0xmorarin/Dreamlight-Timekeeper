import {TAB_ORDER,WORLD_ORDER,previewScope,safeText} from './reader.mjs';
const $=id=>document.getElementById(id);
const make=(tag,cls='',value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const click=(label,handler,cls='subtle')=>{const el=make('button',cls,label);el.type='button';el.addEventListener('click',handler);return el;};
const state={snapshot:null,tab:'spawn',world:'all',group:null,subgroup:null,query:'',sort:'name',selected:new Set(),limit:120,mode:'now',customTime:null,loading:false};
let worker=null,seq=0,noticeCount=0;
const pending=new Map();
const fmt=value=>{if(!value)return '日時不明';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):safeText(value);};
function failWorker(message){for(const p of pending.values())p.reject(new Error(message));pending.clear();if(worker){worker.terminate();worker=null;}}
function request(type,payload={},transfer=[]){return new Promise((resolve,reject)=>{
 const id=++seq;
 try{
  if(!worker){
   worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data):p.reject(new Error(data.error||'内部エラー'));};
   worker.onerror=e=>{e.preventDefault();failWorker('セーブ処理の初期化に失敗しました。ページを再読み込みしてください。');};
   worker.onmessageerror=()=>failWorker('セーブ処理の応答を受信できませんでした。');
  }
  pending.set(id,{resolve,reject});worker.postMessage({id,type,...payload},transfer);
 }catch(err){pending.delete(id);reject(err);}
});}
function message(text,error=false){
 const el=state.snapshot?$('workspace-status'):$('welcome-status');
 el.hidden=!text;el.textContent=text;el.className=state.snapshot?(error?'workspace-status error':'workspace-status'):(error?'status error':'status');
 if(state.snapshot){const count=++noticeCount;setTimeout(()=>{if(count===noticeCount)el.hidden=true;},6500);}
}
function showEditor(){
 $('welcome').hidden=true;$('workspace').hidden=false;
 $('session-name').textContent=state.snapshot.identity.name||'セーブ読込み済み';
 $('download-backup').disabled=false;
 renderTabs();renderFilters();renderList();renderDetails();
}
function showWelcome(){if(state.snapshot)return;$('welcome').hidden=false;$('workspace').hidden=true;}
async function openSave(file){
 if(!file||state.loading)return;
 state.loading=true;$('open-welcome').disabled=true;$('open-again').disabled=true;
 const old=state.snapshot;
 message(`読込み中：${file.name}`);
 try{
  const buffer=await file.arrayBuffer();
  if(!buffer.byteLength)throw new Error('空のファイルです');
  const result=await request('open',{buffer,name:file.name},[buffer]);
  state.snapshot=result.view;state.tab='spawn';state.world='all';state.group=null;state.subgroup=null;state.selected.clear();state.query='';state.limit=120;state.mode='now';state.customTime=null;
  $('filter-input').value='';$('sort-order').value='name';$('time-mode').value='now';$('custom-time').value='';$('custom-time').disabled=true;
  showEditor();
  message(`${result.format==='packaged'?'暗号化されたセーブ':'JSON'}を読み込みました。${result.view.diagnostics.length?result.view.diagnostics.join(' / '):''}`);
 }catch(err){
  if(old){state.snapshot=old;showEditor();}else{state.snapshot=null;showWelcome();}
  message(`読込み失敗（${file.name}）：${err instanceof Error?err.message:String(err)}`,true);
 }finally{state.loading=false;$('open-welcome').disabled=false;$('open-again').disabled=false;$('save-file').value='';}
}
function fileDialog(){$('save-file').click();}
function renderTabs(){
 const root=$('tabs');root.replaceChildren();
 for(const [tab,name] of TAB_ORDER){const b=click(name,()=>{state.tab=tab;state.world='all';state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderTabs();renderFilters();renderList();renderDetails();},'');b.className=state.tab===tab?'active':'';b.setAttribute('aria-current',String(state.tab===tab));root.append(b);}
}
const tabRows=()=>state.snapshot?.rows.filter(row=>row.tab===state.tab)||[];
const worldRows=()=>tabRows().filter(row=>state.world==='all'||row.world===state.world);
function groupRows(){return worldRows().filter(row=>state.group===null||row.group===state.group).filter(row=>state.subgroup===null||row.subgroup===state.subgroup);}
function visibleRows(){
 const query=state.query;let rows=groupRows().filter(row=>!query||[row.label,row.id,row.kind,row.group,row.subgroup,...row.items.map(x=>x.name)].join(' ').toLocaleLowerCase().includes(query));
 if(state.sort==='name')return rows;
 const clone=rows.slice();
 if(state.sort==='time')clone.sort((a,b)=>(a.time===null)-(b.time===null)||(a.time||'').localeCompare(b.time||'')||a.label.localeCompare(b.label,'ja'));
 if(state.sort==='future')clone.sort((a,b)=>Number(['FUTURE','DISTANT_FUTURE_UNVERIFIED','SPECIAL_2126_UNRESOLVED'].includes(b.status))-Number(['FUTURE','DISTANT_FUTURE_UNVERIFIED','SPECIAL_2126_UNRESOLVED'].includes(a.status))||a.label.localeCompare(b.label,'ja'));
 return clone;
}
function filterButton(name,count,active,fn){const b=click(name,fn,'');b.className=active?'active':'';b.append(make('small','',count));return b;}
function renderFilters(){
 const rows=tabRows(),regions=$('regions');regions.replaceChildren();
 for(const [id,label] of WORLD_ORDER){const count=rows.filter(r=>id==='all'||r.world===id).length;if(id!=='all'&&!count)continue;regions.append(filterButton(label,count,state.world===id,()=>{state.world=id;state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));}
 const grouped=worldRows(),groups=$('groups');groups.replaceChildren();
 groups.append(filterButton('すべて',grouped.length,state.group===null,()=>{state.group=null;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));
 const byGroup=new Map();
 for(const r of grouped){if(!byGroup.has(r.group))byGroup.set(r.group,new Map());const inner=byGroup.get(r.group);inner.set(r.subgroup,(inner.get(r.subgroup)||0)+1);}
 for(const [group,subs] of byGroup){const total=[...subs.values()].reduce((a,b)=>a+b,0);const list=make('div');list.append(filterButton(group,total,state.group===group&&state.subgroup===null,()=>{state.group=group;state.subgroup=null;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));if(subs.size>1){const details=make('details');details.open=state.group===group;const summary=make('summary','','細分類');details.append(summary);for(const [sub,count] of subs)details.append(filterButton(sub,count,state.group===group&&state.subgroup===sub,()=>{state.group=group;state.subgroup=sub;state.selected.clear();state.limit=120;renderFilters();renderList();renderDetails();}));list.append(details);}groups.append(list);}
}
function makeRecord(r){
 const label=make('label',state.selected.has(r.pointer)?'record checked':'record');
 const check=make('input');check.type='checkbox';check.checked=state.selected.has(r.pointer);check.setAttribute('aria-label',`${r.label}を選択`);
 check.addEventListener('change',()=>{if(check.checked)state.selected.add(r.pointer);else state.selected.delete(r.pointer);label.classList.toggle('checked',check.checked);renderSelectionLabel();renderDetails();});
 const body=make('span','record-data');body.append(make('span','record-title',r.label));
 const time=make('span','record-meta',fmt(r.time));
 if(['SPECIAL_2126_UNRESOLVED','DISTANT_FUTURE_UNVERIFIED'].includes(r.status))time.classList.add('record-tag');
 body.append(time);label.append(check,body);return label;
}
function renderSelectionLabel(){const n=state.selected.size;$('selection-label').textContent=n?`${n}件選択中`:'未選択';}
function renderList(){
 const rows=visibleRows();$('category-title').textContent=TAB_ORDER.find(x=>x[0]===state.tab)?.[1]||'';
 $('record-count').textContent=`${rows.length}件の保存済み日時`;
 const root=$('records');root.replaceChildren();
 if(!rows.length)root.append(make('p','empty','条件に一致する日時情報がありません。'));
 else for(const r of rows.slice(0,state.limit))root.append(makeRecord(r));
 $('more-records').hidden=rows.length<=state.limit;$('more-records').textContent=`続きを表示（残り${rows.length-state.limit}件）`;
 $('select-visible').disabled=!rows.length;renderSelectionLabel();
}
function setTime(){state.mode=$('time-mode').value;$('custom-time').disabled=state.mode!=='custom';renderDetails();}
function renderDetails(){
 const rows=state.snapshot?.rows.filter(r=>state.selected.has(r.pointer))||[],n=rows.length;
 const selected=$('selection-info');selected.replaceChildren();
 if(!n){selected.textContent='中央の一覧から項目を選択してください。';$('preview').replaceChildren();$('technical-details').replaceChildren();return;}
 selected.append(make('strong','',`${n}件を選択中`));
 if(n===1)selected.append(make('p','',rows[0].label));
 const preview=$('preview');preview.replaceChildren();
 const custom=$('custom-time').value;
 let when=null;
 if(state.mode==='custom'&&custom){const date=new Date(custom);if(Number.isFinite(date.getTime()))when=date.toISOString();}
 try{
  const result=previewScope(state.snapshot,{tab:state.tab,pointers:rows.map(r=>r.pointer),world:'all',mode:state.mode,customTime:when,now:Date.now()});
  preview.append(make('div','preview-summary',`確認対象：${result.affected.length}件\n指定日時：${fmt(result.previewTime)}`));
  for(const row of result.affected.slice(0,24)){const item=make('div','preview-row');item.append(make('strong','',row.label),make('span','',`${fmt(row.time)} → ${fmt(result.previewTime)}`));preview.append(item);}
  if(result.affected.length>24)preview.append(make('p','caption',`ほか${result.affected.length-24}件は省略しています。`));
 }catch(err){preview.append(make('p','caption',state.mode==='custom'&&!custom?'日時を指定してください。':err.message));}
 const details=$('technical-details');details.replaceChildren();
 for(const r of rows.slice(0,8)){const p=make('p','');p.textContent=`${r.label} / ID ${r.id??'不明'} / ${r.kind} / ${r.source} / ${r.pointer}${r.reason?' / '+r.reason:''}`;details.append(p);}
 if(n>8)details.append(make('p','','ほか'+(n-8)+'件'));
}
async function backup(){try{const data=await request('backup');const blob=new Blob([data.buffer],{type:'application/octet-stream'}),url=URL.createObjectURL(blob);const anchor=make('a');anchor.href=url;anchor.download=`original_${data.name}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(err){message(`バックアップ失敗：${err.message}`,true);}}
function bindDrop(){
 const overlay=$('drop-overlay');
 const fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 document.addEventListener('dragenter',e=>{if(fileDrag(e)){e.preventDefault();overlay.hidden=false;}});
 document.addEventListener('dragover',e=>{if(fileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect='copy';overlay.hidden=false;}});
 document.addEventListener('dragleave',e=>{if(!e.relatedTarget||e.relatedTarget===document.documentElement)overlay.hidden=true;});
 document.addEventListener('drop',e=>{e.preventDefault();overlay.hidden=true;const file=e.dataTransfer?.files?.[0];if(file)openSave(file);});
 window.addEventListener('blur',()=>{overlay.hidden=true;});
}
function boot(){
 $('open-welcome').addEventListener('click',fileDialog);$('open-again').addEventListener('click',fileDialog);
 $('save-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)openSave(file);});
 $('download-backup').addEventListener('click',backup);
 $('filter-input').addEventListener('input',e=>{state.query=e.target.value.trim().toLocaleLowerCase();state.limit=120;state.selected.clear();renderList();renderDetails();});
 $('sort-order').addEventListener('change',e=>{state.sort=e.target.value;state.limit=120;renderList();});
 $('select-visible').addEventListener('click',()=>{for(const row of visibleRows())state.selected.add(row.pointer);renderList();renderDetails();});
 $('clear-selection').addEventListener('click',()=>{state.selected.clear();renderList();renderDetails();});
 $('more-records').addEventListener('click',()=>{state.limit+=120;renderList();});
 $('time-mode').addEventListener('change',setTime);
 $('custom-time').addEventListener('change',e=>{const date=new Date(e.target.value);state.customTime=Number.isFinite(date.getTime())?date.toISOString():null;renderDetails();});
 bindDrop();window.__dreamlightBooted=true;
 request('check').catch(err=>message('初期化エラー：'+err.message,true));
}
boot();
