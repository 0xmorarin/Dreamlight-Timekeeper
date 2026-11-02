import {validTime} from '../reader.mjs';

const validPointer=value=>typeof value==='string'&&/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/.test(value);

export function createTimingDraft(snapshot,{maxEntries=10000,maxHistory=40}={}){
 if(!snapshot||!Array.isArray(snapshot.rows)||snapshot.capabilities?.editingAllowed!==false||
  snapshot.capabilities?.exportEditedAllowed!==false)throw new Error('Read-only timing snapshot required.');
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1||!Number.isSafeInteger(maxHistory)||maxHistory<1)
  throw new Error('Invalid draft limits.');
 if(snapshot.rows.length>maxEntries)throw new Error('Timing draft row limit exceeded.');
 const source=new Map();
 for(const row of snapshot.rows){
  if(!validPointer(row.pointer)||source.has(row.pointer))throw new Error('Invalid or duplicate timing pointer.');
  source.set(row.pointer,{pointer:row.pointer,originalTime:row.time,
   kind:row.kind,source:row.source,reviewStatus:row.review?.status??'UNREVIEWED'});
 }
 let entries=new Map(),undoStack=[],redoStack=[];
 const view=()=>Object.freeze({
  status:'READ_ONLY_EDIT_PLAN',
  writerAuthorized:false,editedCopyAuthorized:false,exportAvailable:false,
  count:entries.size,canUndo:undoStack.length>0,canRedo:redoStack.length>0,
  entries:Object.freeze([...entries.values()].sort((a,b)=>a.pointer.localeCompare(b.pointer))
   .map(row=>Object.freeze({...row,writerAuthorized:false})))
 });
 const change=(next)=>{
  if(next.size===entries.size&&[...next].every(([p,row])=>entries.get(p)?.targetTime===row.targetTime))return view();
  undoStack.push(new Map(entries));
  if(undoStack.length>maxHistory)undoStack.shift();
  entries=next;redoStack=[];return view();
 };
 const stage=(pointers,targetTime)=>{
  if(!Array.isArray(pointers)||pointers.length===0||pointers.length>maxEntries||
   new Set(pointers).size!==pointers.length)throw new Error('Invalid draft selection.');
  if(!validTime(targetTime))throw new Error('Invalid target UTC timestamp.');
  const next=new Map(entries);
  for(const pointer of pointers){
   const row=source.get(pointer);
   if(!row||!validTime(row.originalTime))throw new Error('Unrecognized or invalid original timing field.');
   if(row.originalTime===targetTime)next.delete(pointer);
   else next.set(pointer,{...row,targetTime});
  }
  return change(next);
 };
 const undo=()=>{
  if(!undoStack.length)return view();
  redoStack.push(new Map(entries));entries=undoStack.pop();return view();
 };
 const redo=()=>{
  if(!redoStack.length)return view();
  undoStack.push(new Map(entries));entries=redoStack.pop();return view();
 };
 const clear=()=>change(new Map());
 return Object.freeze({stage,undo,redo,clear,view});
}
