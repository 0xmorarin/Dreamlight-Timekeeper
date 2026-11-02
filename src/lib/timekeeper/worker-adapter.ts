import type {SaveRequest,SaveResponse,TimingSnapshot} from './model';
export interface ProgressUpdate {phase:'reading'|'transferring'|'decoding'|'ready'|'cancelled';loaded?:number;total?:number}
export interface SaveEnginePort {
 request<T extends SaveResponse=SaveResponse>(message:SaveRequest,transfer?:Transferable[]):Promise<T>;
 open(file:File,onProgress?:(p:ProgressUpdate)=>void):Promise<Extract<SaveResponse,{type:'opened'}>>;
 invalidate(reason?:string):void;close():void;
}
/**
 * Versioned browser-host API. Rust/WASM implementation may replace internals
 * only after 01 CORE + 05 QR acceptance; this uses unchanged JS product Worker.
 * No private save bytes, JSON graph, or encode-copy buffer are stored here.
 */
export const SAVE_PORT_VERSION='timekeeper.save-worker@1';
export class JsWorkerAdapter implements SaveEnginePort {
 private worker:Worker|null=null;
 private nextId=0;
 private generation=0;
 private pending=new Map<number,{resolve:(v:any)=>void;reject:(error:Error)=>void;generation:number}>();
 private ensureWorker(){
  if(this.worker)return this.worker;
  const worker=new Worker(new URL('../../worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data}:MessageEvent<SaveResponse&{error?:string;id:number;ok:boolean}>)=>{
   const p=this.pending.get(data?.id);
   if(!p)return;
   this.pending.delete(data.id);
   if(p.generation!==this.generation)return p.reject(new Error('STALE_WORKER_RESPONSE'));
   if(data.ok)p.resolve(data);else p.reject(new Error(data.error||'Worker rejected request'));
  };
  const fail=()=>this.invalidate('WORKER_UNAVAILABLE');
  worker.onerror=fail;worker.onmessageerror=fail;
  this.worker=worker;return worker;
 }
 request<T extends SaveResponse=SaveResponse>(message:SaveRequest,transfer:Transferable[]=[]):Promise<T>{
  const generation=this.generation,id=++this.nextId;
  return new Promise((resolve,reject)=>{
   try{
    const worker=this.ensureWorker();
    this.pending.set(id,{resolve,reject,generation});
    worker.postMessage({...message,id},transfer);
   }catch(e){this.pending.delete(id);reject(e);}
  });
 }
 async open(file:File,onProgress?:(p:ProgressUpdate)=>void){
  this.invalidate('SAVE_SWITCH');
  const gen=this.generation;
  onProgress?.({phase:'reading',loaded:0,total:file.size});
  const buffer=await file.arrayBuffer();
  if(gen!==this.generation)throw new Error('STALE_FILE_READ');
  onProgress?.({phase:'transferring',loaded:file.size,total:file.size});
  if(!buffer.byteLength)throw new Error('Empty source file');
  const p=this.request<Extract<SaveResponse,{type:'opened'}>>({type:'open',buffer,name:file.name},[buffer]);
  onProgress?.({phase:'decoding'});
  const result=await p;
  if(gen!==this.generation)throw new Error('STALE_SAVE_SESSION');
  onProgress?.({phase:'ready'});
  return result;
 }
 invalidate(reason='STALE_WORKER_RESPONSE'){
  ++this.generation;
  for(const p of this.pending.values())p.reject(new Error(reason));
  this.pending.clear();
  this.worker?.terminate();
  this.worker=null;
 }
 close(){this.invalidate('WORKER_CLOSED');}
}
