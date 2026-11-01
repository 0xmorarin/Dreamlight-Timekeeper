import {TAB_ORDER,previewScope,safeText} from './reader.mjs';
const $=id=>document.getElementById(id);
const newElement=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const action=(text,callback,cls='mini')=>{const e=newElement('button',cls,text);e.type='button';e.addEventListener('click',callback);return e;};
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
let seq=0;
const pending=new Map();
worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.ok?p.resolve(data):p.reject(new Error(data.error||'内部処理エラー'))};
worker.onerror=()=>{for(const p of pending.values())p.reject(new Error('セーブ処理スレッドが停止しました'));pending.clear();showStatus('セーブ処理スレッドが停止しました。ページを再読み込みしてください',true)};
const request=(type,payload={},transfer=[])=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,type,...payload},transfer)});
const state={snapshot:null,tab:'spawn',preview:null,mode:'now',customTime:null,filter:'',filename:null};
function showStatus(value,error=false){const e=$('status');e.textContent=value;e.className=error?'status error':'status'}
function timeDisplay(input){if(!input)return '未確認';const d=new Date(input);return Number.isFinite(d.getTime())?`${d.toLocaleString('ja-JP')} (${input})`:safeText(input)}
function renderHeader(){const root=$('save-info');root.replaceChildren();const s=state.snapshot;if(!s){root.append(newElement('span','','セーブ未読込み'),newElement('span','muted','ファイルはブラウザー内だけで処理します'));return;}
  for(const [label,val] of [['プレイヤー',s.identity.name],['Player ID',s.identity.playerId],['作成',timeDisplay(s.identity.created)],['更新',timeDisplay(s.identity.modified)],['セーブschema',s.identity.schema]]){
    const e=newElement('span','meta');e.append(newElement('span','meta-label',`${label}  `),newElement('span','meta-value',safeText(val)));root.append(e);
  }
}
function renderTabs(){const root=$('tabs');root.replaceChildren();for(const [id,label] of TAB_ORDER){const b=action(label,()=>{state.tab=id;state.preview=null;renderTabs();renderRecords();renderPreview()},id===state.tab?'tab active':'tab');b.role='tab';b.setAttribute('aria-selected',String(id===state.tab));root.append(b)}}
function selectScope(scope){if(!state.snapshot)return;try{state.preview=previewScope(state.snapshot,{...scope,mode:state.mode,customTime:state.customTime,now:Date.now()});renderPreview()}catch(e){showStatus(e.message,true)}}
function makeRow(record){const div=newElement('div','item');const left=newElement('div','item-main');left.append(newElement('strong','item-name',record.label),newElement('small','muted',`Event / Item ID: ${record.id??'不明'} · ${record.kind}`),newElement('small','muted',`保存日時: ${timeDisplay(record.time)}`));if(record.status==='SPECIAL_2126_UNRESOLVED'||record.status==='DISTANT_FUTURE_UNVERIFIED')left.append(newElement('small','hint','長期未来日時：通常値か異常値かは未確定'));div.append(left,action('個別を確認',()=>selectScope({tab:state.tab,group:record.group,subgroup:record.subgroup,pointer:record.pointer})));return div}
function appendSubgroup(parent,group,subgroup,records){const node=newElement('details','subgroup');const summary=newElement('summary','group-head');summary.append(newElement('span','',subgroup),action('小カテゴリを確認',event=>{event.stopPropagation();event.preventDefault();selectScope({tab:state.tab,group,subgroup})}));node.append(summary);for(const r of records)node.append(makeRow(r));parent.append(node)}
function renderRecords(){const root=$('records');root.replaceChildren();$('current-category').textContent=TAB_ORDER.find(x=>x[0]===state.tab)[1];$('bulk').disabled=!state.snapshot;
  if(!state.snapshot){root.append(newElement('p','muted','セーブを読み込むと、実際に保存されている日時を表示します。'));return}
  const data=state.snapshot.rows.filter(r=>r.tab===state.tab&&(!state.filter||`${r.label} ${r.id} ${r.kind} ${r.group} ${r.subgroup} ${r.items.map(x=>x.name).join(' ')}`.toLowerCase().includes(state.filter)));
  if(!data.length){root.append(newElement('p','muted','この条件に一致する対応済み日時は見つかりませんでした。'));return}
  const groups=new Map();for(const record of data){if(!groups.has(record.group))groups.set(record.group,new Map());const subs=groups.get(record.group);if(!subs.has(record.subgroup))subs.set(record.subgroup,[]);subs.get(record.subgroup).push(record)}
  for(const [group,subs] of groups){const details=newElement('details','group');details.open=state.tab==='spawn'&&group==='障害物'||Boolean(state.filter);const summary=newElement('summary','group-head');summary.append(newElement('strong','',group),action('中カテゴリを確認',event=>{event.stopPropagation();event.preventDefault();selectScope({tab:state.tab,group})}));details.append(summary);for(const [sub,rows] of subs)appendSubgroup(details,group,sub,rows);root.append(details)}
}
function renderPreview(){const e=$('preview');e.replaceChildren();const p=state.preview;if(!p){e.append(newElement('p','muted','大・中・小カテゴリ、または個別項目の「確認」を押してください。'));return}
  const summary=[TAB_ORDER.find(x=>x[0]===p.tab)?.[1],p.group,p.subgroup].filter(Boolean).join(' / ');
  e.append(newElement('h5','',summary),newElement('p','warning','読取り専用です。すべての書込みは安全性検証が完了するまで無効です。'),newElement('p','muted',`設定候補日時：${timeDisplay(p.previewTime)}`));
  if(!p.affected.length){e.append(newElement('p','muted','指定階層に一致する日時はありません。'));return}
  const list=newElement('div','preview-list');for(const r of p.affected.slice(0,80)){const x=newElement('div','preview-row');x.append(newElement('strong','',r.label),newElement('small','',`${r.time??'不明'} → ${p.previewTime}`),newElement('small','',r.reason));list.append(x)}e.append(list);
  if(p.affected.length>80)e.append(newElement('p','muted','残りの候補はこのプレビューでは省略しています。保存処理はありません。'));
}
async function openSave(file){showStatus('セーブの検査と日時の分類を実行しています');$('save-file').disabled=true;$('download-backup').disabled=true;state.snapshot=null;state.preview=null;renderHeader();renderRecords();renderPreview();
  try{const buffer=await file.arrayBuffer();const answer=await request('open',{buffer,name:file.name},[buffer]);state.snapshot=answer.view;state.filename=file.name;state.tab='spawn';state.filter='';$('filter-input').value='';renderTabs();renderHeader();renderRecords();renderPreview();$('download-backup').disabled=false;
    const diagnostics=answer.view.diagnostics.length?` 構造診断: ${answer.view.diagnostics.join(' / ')}`:'';
    showStatus(`${answer.format==='packaged'?'暗号化セーブ':'復号済みJSON'}を読み取りました。schema ${answer.view.identity.schema}。Build IDはセーブ単体からは確認できません。編集機能は無効です。${diagnostics}`);
  }catch(err){state.snapshot=null;state.filename=null;renderHeader();renderRecords();renderPreview();showStatus(err.message,true)}finally{$('save-file').disabled=false;$('save-file').value=''}
}
async function backup(){try{const out=await request('backup');const blob=new Blob([out.buffer],{type:'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`original_${out.name}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)}catch(err){showStatus(err.message,true)}}
function boot(){renderTabs();renderHeader();renderRecords();$('timezone').textContent=`タイムゾーン: ${Intl.DateTimeFormat().resolvedOptions().timeZone||'不明'} · 保存値はUTC`;
  $('save-file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)openSave(file)});
  $('download-backup').addEventListener('click',backup);
  $('bulk').addEventListener('click',()=>selectScope({tab:state.tab}));
  $('filter-input').addEventListener('input',event=>{state.filter=event.target.value.trim().toLowerCase();renderRecords()});
  $('expand-all').addEventListener('click',()=>{const nodes=[...document.querySelectorAll('#records details')];const shouldOpen=nodes.some(n=>!n.open);for(const node of nodes)node.open=shouldOpen;$('expand-all').textContent=shouldOpen?'すべて閉じる':'すべて開く'});
  document.querySelectorAll('[name=time-mode]').forEach(input=>input.addEventListener('change',()=>{state.mode=input.value;$('custom-time').disabled=state.mode!=='custom';if(state.preview)selectScope({tab:state.preview.tab,group:state.preview.group,subgroup:state.preview.subgroup,pointer:state.preview.affected.length===1?state.preview.affected[0].pointer:null})}));
  $('custom-time').addEventListener('change',event=>{const d=new Date(event.target.value);state.customTime=Number.isFinite(d.getTime())?d.toISOString():null;if(state.preview&&state.mode==='custom')selectScope({tab:state.preview.tab,group:state.preview.group,subgroup:state.preview.subgroup})});
  request('check').then(()=>showStatus('イベント定義を確認しました。暗号化されたSwitch版profileまたは復号済みJSONを開いてください。')).catch(err=>showStatus(err.message,true));
}
boot();
