// Synthetic/research-only isolated delta proof.
// Never return the edited clone, JSON, encrypted data or any export token.
// This is NOT a save serializer, operation allowlist, or runtime acceptance.
import {inspectTimingPlan} from './timing-plan-preflight.mjs';
import {diffPaths,parseSafeJson} from './safe-edit-session.mjs';

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const escapePart=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
const keySort=(a,b)=>a<b?-1:a>b?1:0;
const cleanPointer=value=>typeof value==='string'&&
 /^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/.test(value);
function resolveParent(root,pointer){
 if(!cleanPointer(pointer))throw new Error('Noncanonical delta pointer.');
 const parts=pointer.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));
 if(parts.some(x=>['__proto__','constructor','prototype'].includes(x)))
  throw new Error('Unsafe delta path segment.');
 let parent=root;
 for(const part of parts.slice(0,-1)){
  if(!record(parent)||!Object.hasOwn(parent,part))
   throw new Error('Delta path parent missing.');
  parent=parent[part];
 }
 const last=parts.at(-1);
 if(!record(parent)||!Object.hasOwn(parent,last))
  throw new Error('Delta path target missing.');
 return {parent,key:last};
}
function summarize(result,code,paths=[]){
 return Object.freeze({
  status:code,sourceMutationPerformed:false,sourceBuildVerified:false,
  sourceSerializationVerified:false,profileContainerRoundTripVerified:false,
  nativeSemanticsVerified:false,writerAuthorized:false,
  editedCopyAuthorized:false,exportAvailable:false,
  requested:result.summary.requested,
  checked:paths.length,plannedPaths:Object.freeze(paths.slice()),
  preflight:Object.freeze({...result.summary})
 });
}
export function auditTimingDeltaIsolated(profile,snapshot,plan,{maxChanges=1000}={}){
 if(!Number.isSafeInteger(maxChanges)||maxChanges<1||maxChanges>10000)
  throw new Error('Invalid isolated-diff capacity.');
 // Preflight reruns from Worker-owned sources, not a caller-supplied "PASS".
 const checked=inspectTimingPlan(profile,snapshot,plan,{maxEntries:maxChanges});
 if(checked.summary.requested===0||
    checked.summary.structuralShapeObserved!==checked.summary.requested)
  return summarize(checked,'HOLD_PREFLIGHT');
 const expected=checked.rows.map(r=>r.pointer).sort(keySort);
 if(new Set(expected).size!==expected.length)
  throw new Error('Ambiguous planned delta pointers.');
 // A temporary clone is made only on explicit invocation, NEVER on a stage/undo
 // operation; memory and runtime limits must be benchmarked before UI release.
 const candidate=structuredClone(profile);
 for(const row of checked.rows){
  const {parent,key}=resolveParent(candidate,row.pointer);
  parent[key]=row.targetTime;
 }
 const actual=diffPaths(profile,candidate).sort(keySort);
 if(actual.length!==expected.length||actual.some((path,i)=>path!==expected[i]))
  throw new Error('Isolated delta changed unplanned profile field(s).');
 // JSON preservation here proves *semantic equality* within JSON, not raw text,
 // ZIP entry metadata, unknown serialized extension fields or game compatibility.
 const text=JSON.stringify(candidate);
 if(typeof text!=='string')throw new Error('Isolated delta cannot be represented as JSON.');
 const reparsed=parseSafeJson(text);
 if(diffPaths(candidate,reparsed).length!==0)
  throw new Error('Isolated delta lost information on JSON reparse.');
 const checkedAgain=diffPaths(profile,reparsed).sort(keySort);
 if(checkedAgain.length!==expected.length||
    checkedAgain.some((path,i)=>path!==expected[i]))
  throw new Error('JSON reparse changed unplanned profile field(s).');
 // Do NOT return candidate, serialized text, any save bytes or field edit callback.
 return summarize(checked,'READ_ONLY_ISOLATED_JSON_DIFF_PASS',expected);
}
