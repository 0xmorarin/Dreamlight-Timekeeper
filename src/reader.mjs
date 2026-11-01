export const TAB_ORDER = Object.freeze([
  ['spawn','自動発生・スポーン'],
  ['resources','採集・生産'],
  ['shops','ショップ・販売'],
  ['daily','日次・その他']
]);

export const WORLD_ORDER = Object.freeze([
  ['all','全エリア'],
  ['valley','ドリームライトバレー・共通'],
  ['exp1','永遠の島'],
  ['exp2','物語の谷'],
  ['exp3','ウィッシュブロッサム牧場'],
  ['hgw','ハニーグローの森'],
  ['unknown','エリア未特定']
]);
export const worldForEventName = name => {
  const text=String(name??'');
  const match=text.match(/Expansion0([1-3])/);
  if(match)return `exp${match[1]}`;
  if(text.includes('Mini01'))return 'hgw';
  return 'valley';
};
export const worldForVillageName = name => {
  const text=String(name??'');
  if(/^Village04(?:Layout|ObjectLimit)/.test(text))return 'valley';
  const expansion=text.match(/^Expansion0([1-3])(?:Layout|ObjectLimit)/);
  if(expansion)return `exp${expansion[1]}`;
  if(/^WinnieDLC(?:Layout|ObjectLimit)/.test(text))return 'hgw';
  return 'unknown';
};
const TYPES = new Set([
  'ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage',
  'FishSpawningInVillage','SnippetSpawning','MiningRockTurningSpecial',
  'FlowerDryingInVillage','ChooseVillageArea','ChooseItem',
  'TimeLostTreasureSpawning','MakeCharacterEager','PendingFishUpgrade'
]);
const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/;
const MAP = ['Urban','Meadow','Beach','Forest','Glade','Plateau','Frosted','Forgotten'];
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const escapePtr = s => String(s).replaceAll('~','~0').replaceAll('/','~1');
export const validTime = v => typeof v === 'string' && TIME.test(v) && Number.isFinite(Date.parse(v)) && new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
export const safeText = v => String(v ?? '').replace(/<\/?nobr>/gi,'').replace(/<[^>]*>/g,'').replace(/[\u200B-\u200D\uFEFF]/g,'').normalize('NFC');
export function classifyDate(value,now=Date.now()){
  if(!validTime(value))return 'INVALID';
  if(value==='2126-08-20T00:00:00Z')return 'SPECIAL_2126_UNRESOLVED';
  const time=Date.parse(value);
  if(time > now + 365*86400000)return 'DISTANT_FUTURE_UNVERIFIED';
  return time > now?'FUTURE':'PAST';
}
const defaultTab = type => {
  if(type==='SnippetSpawning'||type==='FlowerSpawningInVillage'||type==='WildCropsSpawningInVillage'||type==='ItemSpawning'||type==='FlowerDryingInVillage')return 'spawn';
  if(type==='FishSpawningInVillage'||type==='MiningRockTurningSpecial')return 'resources';
  return 'daily';
};
const areaLabel = s => {
  return MAP.find(k=>s.includes(k))||'';
};
export function indexEvents(raw){
  if(!isObj(raw)||!isObj(raw.source)||raw.source.writerAuthorization!==false||!Array.isArray(raw.events)||raw.source.schema!==626)throw new Error('未検証または不正なイベント定義です');
  const events=new Map();
  for(const record of raw.events){
    if(!Number.isSafeInteger(record.id)||events.has(record.id)||!TAB_ORDER.some(([id])=>id===record.tab))throw new Error('イベントIDに重複・未定義カテゴリがあります');
    events.set(record.id,record);
  }
  if(events.size!==508)throw new Error('イベント定義の件数が期待値と異なります');
  return events;
}
function row(store,{tab,world='unknown',group,subgroup,label,id,kind,pointer,time,source,policy='HOLD',reason='',items=[],eventName=null,eventActive=null,structureValid=true,areaKey='',timingKey=null},now){
  const timing=timingKey||(kind.includes('LastRefresh')?'timeRefresh':kind.includes('LastCollect')?'timeCollect':kind.includes('EndOfGrowth')?'timeGrowth':kind.includes('EndOfLife')?'timeLife':kind==='ResetTimer'?'timeReset':kind==='DisplayInfo.LastRefresh'?'timeRefresh':'timeNext');
  store.push({tab,world,group,subgroup,label,id,kind,pointer,time:validTime(time)?time:null,
    status:classifyDate(time,now),source,policy,reason,items,eventName,eventActive,structureValid,areaKey,timingKey:timing,writeAuthorized:false});
}
function describeEvent(record,type,id){
  if(!record)return `${type} (${id})`;
  const area=areaLabel(record.name||'');
  const unique=[...new Set((record.items||[]).map(x=>safeText(x.ja)).filter(Boolean))];
  const core=record.subgroup&&record.subgroup!==record.group?record.subgroup:record.group;
  const text=unique.length===1?unique[0]:core;
  return area?`${text} · ${area}`:`${text} · ${safeText(record.name?.split('!').at(-1)||id)}`;
}
export function gridWorldFromVillages(world){
  const lookup=new Map();
  if(!Array.isArray(world.Villages))return lookup;
  for(const village of world.Villages){
    if(!isObj(village)||!isObj(village.Areas))continue;
    const region=worldForVillageName(village.VillageAreaDataName);
    for(const area of Object.values(village.Areas)){
      if(!isObj(area)||!Array.isArray(area.GridIDs))continue;
      for(const gridID of area.GridIDs){
        const id=String(gridID);
        if(!/^(?:0|[1-9]\d*)$/.test(id))continue;
        if(lookup.has(id)&&lookup.get(id)!==region)lookup.set(id,'unknown');
        else if(!lookup.has(id))lookup.set(id,region);
      }
    }
  }
  return lookup;
}
function scanObjectState(world,store,now,diagnostics,itemNames){
  if(!isObj(world.GridCollection))return;
  const gridWorld=gridWorldFromVillages(world);
  const queue=[{obj:world.GridCollection,path:'/World/GridCollection',depth:0}];
  let visited=0;
  while(queue.length){
    const {obj,path,depth}=queue.pop();
    if(++visited>220000){diagnostics.push('Grid内の日時調査は容量制限により途中で停止しました');break;}
    if(!obj||typeof obj!=='object'||depth>21)continue;
    if(isObj(obj.State)){
      const state=obj.State;
      const match=path.match(/^\/World\/GridCollection\/Grids\/(\d+)\/Objects\//);
      const region=match?(gridWorld.get(match[1])??'unknown'):'unknown';
      const itemId=obj.ItemID||obj.ItemId||null;
      const idText=itemId?`Item ${itemId}`:'設置物';
      const linked=itemId&&itemNames?.[String(itemId)]?[{id:itemId,names:itemNames[String(itemId)]}]:[];
      const specs=[
        ['FishingStallData','LastCollect','resources','生産施設','モアナの小舟','最終回収'],
        ['TreeAndBushData','EndOfGrowth','resources','果樹・茂み','再成長','成長予定'],
        ['TreeAndBushData','EndOfLife','resources','果樹・茂み','寿命管理','寿命の記録'],
        ['StallData','ShopData.LastRefresh','shops','各種ストール','設置物別','最終更新']
      ];
      for(const [type,field,tab,group,subgroup,title] of specs){
        const value=isObj(state[type])?field.split('.').reduce((v,k)=>isObj(v)?v[k]:undefined,state[type]):undefined;
        if(value===undefined)continue;
        const ptr=`${path}/State/${type}/${field.split('.').map(escapePtr).join('/')}`;
        row(store,{tab,world:region,group,subgroup,label:`${title} · ${idText}`,id:itemId,kind:`${type}.${field}`,pointer:ptr,time:value,source:'World.GridCollection',reason:'設置物ごとの状態と日時を表示。書込み条件は未検証',items:linked},now);
      }
      if(isObj(state.GardenData)&&Array.isArray(state.GardenData.Slots)){
        for(const [i,slot] of state.GardenData.Slots.entries()){
          if(!isObj(slot)||!isObj(slot.Sapling)||!('EndOfGrowth' in slot.Sapling))continue;
          row(store,{tab:'resources',world:region,group:'栽培・成長',subgroup:'庭の作物',label:`成長完了予定 · ${idText} · スロット ${i+1}`,id:itemId,
            kind:'GardenData.Slots.Sapling.EndOfGrowth',pointer:`${path}/State/GardenData/Slots/${i}/Sapling/EndOfGrowth`,time:slot.Sapling.EndOfGrowth,
            source:'World.GridCollection',reason:'成長・水やり・クエスト状態との整合性未確認',items:linked},now);
        }
      }
    }
    for(const [key,value] of Object.entries(obj)){
      if(value===null||typeof value!=='object')continue;
      if(Array.isArray(value)){for(let j=value.length-1;j>=0;j--)if(value[j]!==null&&typeof value[j]==='object')queue.push({obj:value[j],path:`${path}/${escapePtr(key)}/${j}`,depth:depth+1});}
      else if(isObj(value)){queue.push({obj:value,path:`${path}/${escapePtr(key)}`,depth:depth+1});}
    }
  }
}
export function projectProfile(profile,registry,{now=Date.now(),itemNames={}}={}){
  if(!isObj(profile)||!isObj(profile.GameInfo)||!isObj(profile.Player)||!isObj(profile.World)||!(registry instanceof Map))throw new Error('GameInfo、Player、Worldの構造を確認できません');
  const schema=Number(profile.GameInfo.Version);
  if(!Number.isSafeInteger(schema))throw new Error('セーブのスキーマが不正です');
  const identity={name:typeof profile.Player.Name==='string'?profile.Player.Name:'未確認',
    playerId:typeof profile.GameInfo.LastCustomIdOwner==='string'?profile.GameInfo.LastCustomIdOwner:'未確認',
    created:profile.GameInfo.Created??null,modified:profile.GameInfo.Modified??null,schema,buildId:null};
  const diagnostics=[],rows=[];
  const rec=profile.World.RecurringEvents;
  if(rec!==undefined&&!isObj(rec))diagnostics.push('RecurringEventsが非対応の保存構造です');
  if(isObj(rec))for(const [key,container] of Object.entries(rec)){
    if(!isObj(container))continue;
    const variants=Object.entries(container).filter(([type,val])=>TYPES.has(type)&&isObj(val));
    for(const [type,entry] of variants){
      if(!Object.hasOwn(entry,'NextOccurrence'))continue;
      const id=Number(entry.RecurringEventItemID);
      const known=Number.isSafeInteger(id)?registry.get(id):null;
      const status=classifyDate(entry.NextOccurrence,now);
      const reasons=[];
      if(schema!==626)reasons.push('未承認スキーマ');
      if(variants.length!==1)reasons.push('oneof構造に複数の種類');
      if(!known)reasons.push('イベント定義に存在しない');
      if(known?.eventPolicy!=='W1')reasons.push('更新条件の静的検証が未完了');
      if(status==='SPECIAL_2126_UNRESOLVED'||status==='DISTANT_FUTURE_UNVERIFIED')reasons.push('遠い未来日時の理由が不明');
      row(rows,{tab:known?.tab||defaultTab(type),world:known?worldForEventName(known.name):'unknown',group:known?.group||'未登録イベント',subgroup:known?.subgroup||type,
        label:describeEvent(known,type,id),id:Number.isSafeInteger(id)?id:null,kind:type,eventName:known?.name??null,eventActive:known?.active??null,structureValid:variants.length===1,areaKey:areaLabel(known?.name||''),
        pointer:`/World/RecurringEvents/${escapePtr(key)}/${escapePtr(type)}/NextOccurrence`,time:entry.NextOccurrence,
        source:'World.RecurringEvents',policy:known?.eventPolicy||'HOLD',reason:reasons.join('／')||'日時編集の実機検証は未完了',
        items:(known?.items||[]).map(x=>({id:x.id,name:safeText(x.en||x.ja),names:itemNames[String(x.id)]??{'en-US':safeText(x.en),'ja':safeText(x.ja)}}))},now);
    }
  }
  const stores=profile.World.Stores;
  if(Array.isArray(stores)||isObj(stores))for(const [i,store] of Object.entries(stores)){
    if(!isObj(store))continue;
    const id=store.BuildingItemID??i;
    const base=`/World/Stores/${escapePtr(i)}`;
    if('LastRefresh' in store)row(rows,{tab:'shops',group:'スクルージストア',subgroup:'店舗全体',label:`店舗 ${id}`,id,
      kind:'StoreInfo.LastRefresh',pointer:`${base}/LastRefresh`,time:store.LastRefresh,source:'World.Stores',reason:'設定時刻を現在にしても商品更新にはならない',items:itemNames[String(id)]?[{id,names:itemNames[String(id)]}]:[]},now);
    const displays=store.Displays;
    if(Array.isArray(displays)||isObj(displays))for(const [j,display] of Object.entries(displays)){
      if(!isObj(display))continue;
      const inner=isObj(display.DisplayInfo)?display.DisplayInfo:display;
      if(!('LastRefresh' in inner))continue;
      row(rows,{tab:'shops',group:'スクルージストア',subgroup:`店舗 ${id} · 陳列台`,label:`陳列台 ${Number(j)+1||j}`,
        id,kind:'DisplayInfo.LastRefresh',pointer:`${base}/Displays/${escapePtr(j)}${inner===display?'':'/DisplayInfo'}/LastRefresh`,time:inner.LastRefresh,
        source:'World.Stores',reason:'販売疲労・陳列の更新条件は未検証',items:itemNames[String(id)]?[{id,names:itemNames[String(id)]}]:[]},now);
    }
  }
  const shops=profile.World.Shops;
  if(Array.isArray(shops)||isObj(shops))for(const [i,shop] of Object.entries(shops)){
    if(!isObj(shop))continue;
    const data=isObj(shop.Data)?shop.Data:(isObj(shop.data)?shop.data:shop);
    if(!('LastRefresh' in data))continue;
    const name=shop.shopName||shop.ShopName||shop.Name||`販売所 ${i}`;
    row(rows,{tab:'shops',group:'各種ストール',subgroup:'販売所別',label:safeText(name),id:i,
      kind:'ShopData.LastRefresh',pointer:`/World/Shops/${escapePtr(i)}${data===shop?'':data===shop.Data?'/Data':'/data'}/LastRefresh`,time:data.LastRefresh,
      source:'World.Shops',reason:'初期値・更新回数・陳列状態の関係が未確認'},now);
  }
  for(const name of ['LastDailyReset','LastWeeklyReset'])for(const [base,obj] of [['',profile],['/World',profile.World]]){
    if(!Object.hasOwn(obj,name))continue;
    row(rows,{tab:'daily',group:'日次・週次更新',subgroup:name==='LastDailyReset'?'日次':'週次',label:name,id:name,kind:'ResetTimer',
      pointer:`${base}/${name}`,time:obj[name],source:'Profile',reason:'日次／週次回数とオンライン状態を含めた検証が必要'},now);
  }
  scanObjectState(profile.World,rows,now,diagnostics,itemNames);
  rows.sort((a,b)=>TAB_ORDER.findIndex(x=>x[0]===a.tab)-TAB_ORDER.findIndex(x=>x[0]===b.tab)
    ||a.group.localeCompare(b.group,'ja')||a.subgroup.localeCompare(b.subgroup,'ja')||a.label.localeCompare(b.label,'ja'));
  const worlds=WORLD_ORDER.filter(([id])=>id!=='all'&&rows.some(r=>r.world===id)).map(([id,label])=>({id,label}));
  return {identity,rows,worlds,diagnostics,capabilities:{schemaRecognized:schema===626,readOnly:true,editingAllowed:false,exportEditedAllowed:false}};
}
export function previewScope(snapshot,{tab,world='all',group=null,subgroup=null,pointer=null,pointers=null,mode='now',customTime=null,now=Date.now()}={}){
  if(!TAB_ORDER.some(x=>x[0]===tab)||!snapshot||!Array.isArray(snapshot.rows))throw new Error('対象が不正です');
  const time=mode==='now'?new Date(now).toISOString():customTime;
  if(!validTime(time))throw new Error('有効な日時を指定してください');
  if(world!=='all'&&!WORLD_ORDER.some(([id])=>id===world))throw new Error('未定義のエリアです');
  const allowed=pointers===null?null:new Set(pointers);
  const affected=snapshot.rows.filter(x=>x.tab===tab&&(world==='all'||x.world===world)&&(group===null||x.group===group)&&(subgroup===null||x.subgroup===subgroup)&&(pointer===null||x.pointer===pointer)&&(allowed===null||allowed.has(x.pointer)));
  return {tab,world,group,subgroup,previewTime:time,status:'PREVIEW_ONLY_NO_MUTATION',affected:affected.map(x=>({...x,writeAuthorized:false}))};
}
