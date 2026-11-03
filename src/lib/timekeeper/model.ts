export interface ItemProjection{id:string|number;name?:string;names?:Record<string,string>}
export interface TimingRow {
 pointer:string;id:string|number;kind:string;time:string|null;status?:string;reason?:string;
 tab:string;world:string;group:string;subgroup:string;label:string;areaKey?:string;
 source:string;eventName?:string;items:ItemProjection[];review?:{status:string;reason:string};
}
export interface TimingSnapshot {
 identity:{name:string};rows:TimingRow[];
 capabilities:{editingAllowed:false;exportEditedAllowed:false};timingAudit?:unknown;containerAudit?:unknown;
}
export interface PlanEntry{pointer:string;originalTime:string;targetTime:string;kind?:string;source?:string}
export interface PlanView{count:number;canUndo:boolean;canRedo:boolean;entries:PlanEntry[]}
export interface PairFile{name:string;buffer:ArrayBuffer}
export interface VerifiedPair{
 status:'WORKER_VERIFIED_PAIR';sessionId:number;sourceRawSha256:string;editedRawSha256:string;
 original:PairFile;edited:PairFile;changedPaths:string[];
}
export type SaveRequest=
 | {type:'check'}|{type:'queryPage';domain:string;view:string;limit:number;cursor?:string|null;filters?:Record<string,string|number|boolean>;sort?:string}|{type:'open';buffer:ArrayBuffer;name:string}
 | {type:'backup';sessionId:number}|{type:'preflight';sessionId:number;entries:PlanEntry[]}
 | {type:'prepareEdited';sessionId:number;planRevision:number;entries:{pointer:string;eventId:string|number;kind:string;originalTime:string;targetTime:string}[];targetBuildId:string;confirmedSwitchTarget:true};
export type SaveResponse=
 | {type:'ready';ok:true;id:number}
 | {type:'opened';ok:true;id:number;sessionId:number;format:'json'|'packaged';view:TimingSnapshot}
 | {type:'backup';ok:true;id:number;sessionId:number;name:string;buffer:ArrayBuffer}
 | {type:'preflight';ok:true;id:number;sessionId:number;report:unknown;compatibility:unknown}
 | {type:'preparedEdited';ok:true;id:number;sessionId:number;planRevision:number;receipt:VerifiedPair};
