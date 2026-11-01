import {p1gPackagedProfileCodec} from './core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from './core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from './reader.mjs';
const decoder=new TextDecoder('utf-8',{fatal:true});
let indexPromise;
let original=null;
let originalName=null;
const getIndex=()=>indexPromise??=fetch(new URL('../data/events-v1253.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('イベント定義の取得に失敗しました');return r.json()}).then(indexEvents);
self.onmessage=async({data})=>{
  const id=data?.id;
  if(!Number.isSafeInteger(id))return;
  try{
    if(data.type==='open'){
      original=null;originalName=null;
      const bytes=new Uint8Array(data.buffer);
      if(bytes.length===0||bytes.length>128*1024*1024)throw new Error('セーブファイルが空、または128MiBを超えています');
      let text,format;
      if(bytes[0]===123||bytes[0]===32||bytes[0]===10||bytes[0]===13||bytes[0]===9||bytes[0]===0xef){text=decoder.decode(bytes).replace(/^\uFEFF/,'');format='json'}
      else {const loaded=await p1gPackagedProfileCodec.loadProfile(bytes);text=loaded.jsonText;format='packaged'}
      const profile=parseSafeJson(text);
      const view=projectProfile(profile,await getIndex());
      original=bytes.slice();originalName=String(data.name||'profile.json').slice(0,180);
      self.postMessage({id,ok:true,type:'opened',format,view});
      return;
    }
    if(data.type==='backup'){
      if(!original)throw new Error('先にセーブを読み込んでください');
      const payload=original.slice().buffer;
      self.postMessage({id,ok:true,type:'backup',name:originalName,buffer:payload},[payload]);
      return;
    }
    if(data.type==='check'){
      await getIndex();self.postMessage({id,ok:true,type:'ready'});return;
    }
    throw new Error('未対応の操作です');
  }catch(err){self.postMessage({id,ok:false,error:err instanceof Error?err.message:String(err)})}
};
