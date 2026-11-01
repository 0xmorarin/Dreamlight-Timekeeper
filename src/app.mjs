import {TAB_ORDER,previewScope,safeText} from './reader.mjs';
const $=id=>document.getElementById(id);
const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const button=(text,fn)=>{const e=element('button','',text);e.type='button';e.addEventListener('click',fn);return e;};
let worker=null;
let seq=0;
const pending=new Map();
function failWorker(message){for(const p of pending.values())p.reject(new Error(message));pending.clear();if(worker){worker.terminate();worker=null;}}
function request(type,payload={},transfer=[]){return new Promise((resolve,reject)=>{
  const id=++seq;
  try{
    if(!worker){
      worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data):p.reject(new Error(data.error||'内部エラー'));};
      worker.onerror=e=>{e.preventDefault();failWorker('セーブ処理Workerの起動・実行に失敗しました。HTTPサーバーから開いているか確認してください。');};
      worker.onmessageerror=()=>failWorker('セーブ処理Workerからの結果を受信できませんでした。');
    }
    pending.set(id,{resolve,reject});
    worker.postMessage({id,type,...payload},transfer);
  }catch(err){pending.delete(id);reject(err);}
});}
const state={snapshot:null,tab:'spawn',preview:null,mode:'now',customTime:null,filter:''};
function status(value,kind=''){const e=$('status');e.textContent=value;e.className=kind;}
function displayTime(t){if(!t)return '未確認';const d=new Date(t);return Number.isFinite(d.getTime())?`${d.toLocaleString('ja-JP')} (${t})`:safeText(t);}
function renderHeader(){const root=$('save-info');root.replaceChildren();const s=state.snapshot;if(!s){root.textContent='セーブ未読込み';return;}
  for(const [k,v] of [['プレイヤー',s.identity.name],['ID',s.identity.playerId],['作成',displayTime(s.identity.created)],['更新',displayTime(s.identity.modified)],['schema',s.identity.schema]]){
    const x=element('span','meta');x.append(element('strong','',`${k}: `),document.createTextNode(safeText(v)));root.append(x);
  }
}
function renderTabs(){const root=$('tabs');root.replaceChildren();for(const [id,label] of TAB_ORDER){const e=button(label,()=>{state.tab=id;state.preview=null;renderTabs();renderRecords();renderPreview();});e.className=id===state.tab?'active':'';e.setAttribute('aria-current',String(id===state.tab));root.append(e);}}
function selectScope(scope){try{state.preview=previewScope(state.snapshot,{...scope,mode:state.mode,customTime:state.customTime,now:Date.now()});renderPreview();}catch(err){status(err.message,'error');}}
function renderRecord(r){const box=element('div','item');const left=element('div','item-main');left.append(element('span','item-name',r.label),element('span','muted',`ID ${r.id??'不明'} · ${r.kind} · ${displayTime(r.time)}`));
  if(r.status==='SPECIAL_2126_UNRESOLVED'||r.status==='DISTANT_FUTURE_UNVERIFIED')left.append(element('span','hint','長期未来日時（意味未確定）'));
  box.append(left,button('確認',()=>selectScope({tab:state.tab,group:r.group,subgroup:r.subgroup,pointer:r.pointer})));return box;
}
function renderRecords(){const root=$('records');root.replaceChildren();$('current-category').textContent=TAB_ORDER.find(x=>x[0]===state.tab)[1];$('bulk').disabled=!state.snapshot;
  if(!state.snapshot){root.append(element('p','muted','セーブを読み込むと日時情報を表示します。'));return;}
  const matches=state.snapshot.rows.filter(r=>r.tab===state.tab&&(!state.filter||`${r.label} ${r.id} ${r.kind} ${r.group} ${r.subgroup} ${r.items.map(x=>x.name).join(' ')}`.toLowerCase().includes(state.filter)));
  if(!matches.length){root.append(element('p','muted','表示できる日時情報がありません。'));return;}
  const groups=new Map();for(const r of matches){if(!groups.has(r.group))groups.set(r.group,new Map());const sub=groups.get(r.group);if(!sub.has(r.subgroup))sub.set(r.subgroup,[]);sub.get(r.subgroup).push(r);}
  for(const [group,sub] of groups){const parent=element('details','group');parent.open=Boolean(state.filter);const head=element('summary','group-head');head.append(element('span','',group),button('確認',e=>{e.stopPropagation();e.preventDefault();selectScope({tab:state.tab,group});}));parent.append(head);
    for(const [subgroup,rows] of sub){const nested=element('details','subgroup');nested.open=Boolean(state.filter);const h=element('summary','group-head');h.append(element('span','',subgroup),button('確認',e=>{e.stopPropagation();e.preventDefault();selectScope({tab:state.tab,group,subgroup});}));nested.append(h);for(const r of rows)nested.append(renderRecord(r));parent.append(nested);}
    root.append(parent);
  }
}
function renderPreview(){const root=$('preview');root.replaceChildren();const p=state.preview;if(!p){root.textContent='対象を選択してください。';return;}
  root.append(element('p','',`指定日時: ${displayTime(p.previewTime)}`),element('p','warning','確認のみ。セーブへの書込みは無効です。'));
  if(!p.affected.length){root.append(element('p','muted','対象がありません。'));return;}
  for(const r of p.affected.slice(0,20)){const x=element('div','preview-row');x.append(element('span','',r.label),element('span','muted',`${r.time??'不明'} → ${p.previewTime}`));root.append(x);}
  if(p.affected.length>20)root.append(element('p','muted',`ほか${p.affected.length-20}件（表示のみ省略）`));
}
async function openSave(file){status(`選択: ${file.name} / 読込み中…`,'busy');$('save-file').disabled=true;$('download-backup').disabled=true;state.snapshot=null;state.preview=null;renderHeader();renderRecords();renderPreview();
  try{const buffer=await file.arrayBuffer();status(`選択: ${file.name} / セーブの検査中…`,'busy');const result=await request('open',{buffer,name:file.name},[buffer]);state.snapshot=result.view;state.tab='spawn';state.filter='';$('filter-input').value='';renderTabs();renderHeader();renderRecords();renderPreview();$('download-backup').disabled=false;
    status(`${result.format==='packaged'?'暗号化セーブ':'JSON'}を読み込みました。schema ${result.view.identity.schema}。日時書込みは無効です。${result.view.diagnostics.length?' / '+result.view.diagnostics.join(' / '):''}`);
  }catch(err){state.snapshot=null;renderHeader();renderRecords();renderPreview();status(`読込み失敗（${file.name}）: ${err instanceof Error?err.message:String(err)}`,'error');}
  finally{$('save-file').disabled=false;$('save-file').value='';}
}
async function backup(){try{const out=await request('backup');const blob=new Blob([out.buffer],{type:'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`original_${out.name}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(err){status(err.message,'error');}}
function boot(){renderHeader();renderTabs();renderRecords();renderPreview();
  $('save-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)openSave(file);});
  $('download-backup').addEventListener('click',backup);
  $('bulk').addEventListener('click',()=>selectScope({tab:state.tab}));
  $('filter-input').addEventListener('input',e=>{state.filter=e.target.value.trim().toLowerCase();renderRecords();});
  $('time-mode').addEventListener('change',e=>{state.mode=e.target.value;$('custom-time').disabled=state.mode!=='custom';state.preview=null;renderPreview();});
  $('custom-time').addEventListener('change',e=>{const d=new Date(e.target.value);state.customTime=Number.isFinite(d.getTime())?d.toISOString():null;state.preview=null;renderPreview();});
  window.__ddvBooted=true;
  request('check').then(()=>status('準備完了。セーブファイルを選択してください。')).catch(err=>status(`初期化エラー: ${err.message}`,'error'));
}
boot();
