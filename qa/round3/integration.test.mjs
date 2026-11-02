import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateUiManifest,resolveGameUiIcon,resolveAppUiIcon,verifyUiAssetBytes} from '../src/ui-assets.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
const text=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Round3 combined app has both semantic icons and Session/backup/preflight, without exported writer',async()=>{
 const app=await text('src/app.mjs'),worker=await text('src/worker.mjs');
 for(const pattern of [
  /createOriginalBackupCoordinator/,
  /backupCoordinator\.invalidate\(\)/,
  /backupCoordinator\.download\(state\.sessionId\)/,
  /\+\+preflightSequence/,
  /request\('preflight',\{sessionId,entries\}\)/,
  /resolveAppUiIcon\(manifest,key\)/,
  /resolveGameUiIcon\(manifest,key\)/,
  /refreshActionIcons\(\)/,
  /decorateWithIcon\(b,'game_ui','tab\.'\+tab\)/,
  /image\.setAttribute\('aria-hidden','true'\)/,
  /Promise\.all\(definitions\.map/,
 ])assert.match(app,pattern);
 assert.match(worker,/type:'backup',sessionId:activeSessionId/);
 assert.doesNotMatch(worker,/data\.type\s*===?\s*['"](?:encode|export|write|overwrite|edited)['"]/);
 assert.doesNotMatch(app,/createSeparateDownloadCoordinator\(/);
 assert.doesNotMatch(app,/request\(['"](?:export|encode|write|overwrite)['"]/);
 assert.doesNotMatch(await text('index.html'),/id=['"]export-edited['"]/);
});
test('Round3 UI manifests fail closed independently across both icon kinds',async()=>{
 const app=JSON.parse(await text('data/app-ui-icons.json'));
 const game=JSON.parse(await text('data/steam-ui-icons-v1253.json'));
 assert.equal(validateUiManifest(app,'app_ui'),true);
 assert.equal(validateUiManifest(game,'game_ui'),true);
 assert.equal(Object.keys(app.icons).length,16);
 assert.equal(Object.keys(game.icons).length,4);
 assert.equal(resolveAppUiIcon(app,'action.open-save').path,'assets/app/ui/action/open-save.svg');
 assert.equal(resolveAppUiIcon(app,'action.non-existent'),null);
 assert.equal(resolveGameUiIcon(app,'action.open-save'),null);
 assert.equal(resolveAppUiIcon(game,'tab.spawn'),null);
 assert.equal(resolveGameUiIcon(game,'world.valley').kind,'game_ui');
 for(const corrupt of [
  {...app,source:{...app.source,writerAuthorization:true}},
  {...app,icons:{...app.icons,'action.open-save':{...app.icons['action.open-save'],path:'assets/app/ui/action/../open-save.svg'}}},
  {...app,icons:{...app.icons,'action.open-save':{...app.icons['action.open-save'],sha256:'bad'}}},
  {...app,icons:{...app.icons,'action.open-save':{...app.icons['action.open-save'],verified:false}}}
 ]){assert.throws(()=>validateUiManifest(corrupt,'app_ui'));assert.equal(resolveAppUiIcon(corrupt,'action.open-save'),null);}
 const entry=app.icons['action.open-save'];
 const svg=new Uint8Array(await readFile(new URL('../'+entry.path,import.meta.url)));
 assert.equal(verifyUiAssetBytes(entry,svg,'app_ui'),true);
 const dangerous=new TextEncoder().encode(new TextDecoder().decode(svg).replace('</svg>','<script>alert(1)</script></svg>'));
 assert.throws(()=>verifyUiAssetBytes(entry,dangerous,'app_ui'));
});
test('Round3 integrated Native research and codec still cannot grant write on synthetic P1G',async()=>{
 const events=JSON.parse(await text('data/events-v1253.json'));
 const wood=JSON.parse(await text('data/wand-iswood-crosswalk-v1253.json'));
 const ledger=compileW1NativeSemantics(events,{woodTagPack:wood});
 assert.equal(ledger.rows.length,508);
 const branch=analyzeW1StaticBranches(ledger,{eventId:2010000021,saveKind:'ItemSpawning',
  nowTicks:100n,nextOccurrenceTicks:200n,maxIntervalTicks:10n});
 assert.equal(branch.readinessCondition,false);
 assert.equal(branch.writerAuthorized,false);
 assert.equal(ledger.query(2010000064,'ItemSpawning').writerAuthorized,false);
 const json={GameInfo:{Version:626},Player:{Name:'Round3'},World:{RecurringEvents:{}},Unmodified:{sentinel:'keep'}};
 const bytes=makeSyntheticP1gProfile(json),before=Buffer.from(bytes);
 const loaded=await p1gPackagedProfileCodec.loadProfile(bytes);
 const audit=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
 assert.equal(audit.metadataPreservationVerified,false);
 assert.deepEqual(Buffer.from(bytes),before);
 assert.deepEqual(JSON.parse(loaded.jsonText).Unmodified,json.Unmodified);
});
test('Round3 timing-review push and pull_request paths include both Native and independent QA',async()=>{
 const workflow=await text('.github/workflows/timing-review.yml');
 for(const name of ['pull_request:','push:'])assert(workflow.includes(name));
 const [pull,push]=workflow.split(/\n  push:/);
 assert(pull.includes('pull_request:')&&push);
 for(const field of ['src/timing-native-semantics.mjs','tests/timing-native-semantics.test.mjs','tests/qa-release-gate-independent.test.mjs']){
  assert(pull.includes(field),'pull request missing '+field);
  assert(push.includes(field),'push missing '+field);
 }
});
