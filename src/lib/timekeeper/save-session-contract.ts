/**
 * Issue #19 accepted architecture — future Wand-owned Rust SaveSession port.
 *
 * This is a *type contract*, not a runnable P1G/WASM implementation or a Writer
 * permission grant. Current product continues to use timekeeper.save-worker@1.
 * Core/Worker alone owns source SHA, revision, ChangeSet, capabilities and CAS.
 */
export const COMMON_SAVE_SESSION_PORT = 'ddv.common-save-session/1' as const;
export type SaveCapability = 'READ' | 'ENCODE_COPY' | 'PERSISTENT_REPLACE';
export type CapabilityEvidence = 'CONFIRMED' | 'STATIC_ONLY' | 'SYNTHETIC_TESTED' | 'REAL_SAVE_READ_ONLY' | 'RUNTIME_TESTED' | 'UNKNOWN' | 'BLOCKED';
export type CapabilityDecision = Readonly<{
  state: 'AVAILABLE' | 'DENIED' | 'UNKNOWN';
  evidence: CapabilityEvidence;
  operation?: string;
  reason?: string;
}>;
/** Fields are issued/verified by the engine; never synthesized in Svelte. */
export type SessionIdentity = Readonly<{
  sessionKey: string;
  generation: number;
  revision: number;
  originalSha256: string;
  schema: number;
  origin: 'local-file';
  capabilities: Readonly<Record<SaveCapability, CapabilityDecision>>;
}>;
export type Domain = 'timing' | 'inventory' | 'collections' | 'storage' |
  'world-grid' | 'rooms' | 'progression' | 'quests';
/** Transport limits are UI rejection guards, not proof that Core fulfilled a full
 * domain query. Large Grid/Inventory/Quest state must be indexed and projected
 * as compact typed rows, never transported as one raw nested save subtree. */
export type ProjectionTransportBounds = Readonly<{
  maxRows: number;
  maxRowBytes: number;
  maxPageBytes: number;
  maxCursorChars: number;
}>;
export const RESEARCH_PROJECTION_TRANSPORT_BOUNDS: ProjectionTransportBounds = Object.freeze({
  maxRows: 200, maxRowBytes: 65536, maxPageBytes: 2097152, maxCursorChars: 512
});
export type ProjectionQuery = Readonly<{
  identity: SessionIdentity;
  domain: Domain;
  view: string;
  page: Readonly<{cursor?: string; limit: number}>;
  filters?: Readonly<Record<string, string | number | boolean>>;
  sort?: string;
}>;
/** Bounded detached rows; complete and nextCursor are mutually exclusive. A
 * non-complete page requires a nonempty new opaque Core-issued nextCursor.
 * UI dispatches through issuePageQuery() and rejects stale/out-of-order replies. */
export type ProjectionPage<Row> = Readonly<{
  identity: SessionIdentity;
  domain: Domain;
  view: string;
  rows: readonly Readonly<Row>[];
  nextCursor: string | null;
  complete: boolean;
  revision: number;
}>;
export type W1OccurrenceIntent = Readonly<{
  kind: 'timekeeper.w1.set-next-occurrence';
  eventDefinitionId: number;
  savedEventIndex: number;
  variant: string;
  expectedOldUtc: string;
  newUtc: string;
}>;
/** Other domains are owned by Wand, and are not implementable by Timekeeper. */
export type SemanticCommand =
  | W1OccurrenceIntent
  | Readonly<{kind: 'wand.domain-command';domain: Exclude<Domain,'timing'>;commandId: string;payload: unknown}>;
export type TransactionPlan = Readonly<{
  identity: SessionIdentity;
  expectedRevision: number;
  expectedSourceSha256: string;
  commands: readonly SemanticCommand[];
}>;
export type ChangeSetReference = Readonly<{
  identity: SessionIdentity;
  changeSetId: string;
  revision: number;
  affectedDomains: readonly Domain[];
  state: 'PLANNED' | 'VALIDATED' | 'DENIED';
  reason?: string;
}>;
export type ValidationReport = Readonly<{
  identity: SessionIdentity;
  changeSetId: string;
  accepted: boolean;
  reasonCodes: readonly string[];
  requiredCapability: 'ENCODE_COPY';
  unchangedDependenciesVerified: boolean;
}>;
export type VerifiedOriginalAndEdited = Readonly<{
  status:'WORKER_VERIFIED_PAIR';
  identity: SessionIdentity;
  original: Readonly<{name:string;buffer:ArrayBuffer}>;
  edited: Readonly<{name:string;buffer:ArrayBuffer}>;
  changedPaths: readonly string[];
  originalSha256: string;
  editedSha256: string;
}>;
export interface CommonSaveSessionPort {
  readonly protocol: typeof COMMON_SAVE_SESSION_PORT;
  openLocal(file:File,signal?:AbortSignal):Promise<SessionIdentity>;
  queryPage<Row>(query:ProjectionQuery,signal?:AbortSignal):Promise<ProjectionPage<Row>>;
  planCAS(intent:TransactionPlan,signal?:AbortSignal):Promise<ChangeSetReference>;
  validate(change:ChangeSetReference,signal?:AbortSignal):Promise<ValidationReport>;
  history(command:Readonly<{identity:SessionIdentity;action:'undo'|'redo';expectedRevision:number}>,signal?:AbortSignal):Promise<ChangeSetReference>;
  backupOriginal(identity:SessionIdentity,signal?:AbortSignal):Promise<Readonly<{name:string;buffer:ArrayBuffer;sha256:string}>>;
  encodeCopy(command:Readonly<{identity:SessionIdentity;changeSetId:string;expectedRevision:number}>,signal?:AbortSignal):Promise<VerifiedOriginalAndEdited>;
  invalidate(reason?:string):void;
  close():void;
}
/**
 * No implementation may be installed by UI configuration alone.
 * Integration prerequisites: 01 CORE stable Rust P1G/JSON/capabilities,
 * 02 TIME semantic parity, 05 QR fixed-head independent negative acceptance.
 */
export const RUST_SAVE_SESSION_INTEGRATION = Object.freeze({
  state:'API_PENDING_CORE', wasmInstalled:false, writerGranted:false,
  existingJsWorkerOracle:'timekeeper.save-worker@1'
} as const);
