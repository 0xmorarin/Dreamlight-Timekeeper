// 05 QR R17: independently verify changed attribution wording and unchanged UI contract.
// No Writer, P1G, staging, native, console or previous full-suite reexecution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [html,scopeDoc,css,app,worker,scope]=await Promise.all([
 read('index.html'),read('docs/INITIAL_RELEASE_ASSET_SCOPE.md'),
 read('assets/app/release-notice.css'),read('src/app.mjs'),read('src/worker.mjs'),
 read('data/release-asset-scope-v1.json').then(JSON.parse)
]);
const en='Unofficial fan-made tool. Not affiliated with, sponsored, endorsed, or approved by Disney or Gameloft. Disney Dreamlight Valley and game-derived images, characters, logos, and other materials are the property of Disney, Gameloft, and their respective rights holders.';
const ja='非公式のファン制作ツールです。DisneyおよびGameloftとは提携・後援関係になく、承認・推奨も受けていません。『ディズニー ドリームライトバレー』およびゲーム由来の画像・キャラクター・ロゴ等の権利は、Disney、Gameloftおよび各権利者に帰属します。';
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,'missing section '+a);return html.slice(i,j);}
test('R17-N01 English and Japanese attribution text exactly matches both Welcome and Workspace',()=>{
 const blocks=[section('<section id="welcome"','<section id="workspace"'),section('<section id="workspace"','<script>')];
 for(const block of blocks){
  assert.equal((block.match(/class="release-notice"/g)||[]).length,1);
  assert.equal((block.match(/role="note"/g)||[]).length,1);
  assert.equal((block.match(/aria-label="Unofficial tool notice"/g)||[]).length,1);
  assert(block.includes('<p lang="en">'+en+'</p>'));
  assert(block.includes('<p lang="ja">'+ja+'</p>'));
 }
 assert.equal((html.match(/class="release-notice"/g)||[]).length,2);
 assert.equal((html.match(/lang="en">Unofficial fan-made tool/g)||[]).length,2);
 assert.equal((html.match(/lang="ja">非公式のファン制作ツールです/g)||[]).length,2);
 assert.match(html,/Version details \/ 対応バージョン/);
});
test('R17-N02 attribution and copyright wording does NOT grant reproduction, redistribution or affiliation',()=>{
 for(const word of ['Not affiliated','sponsored','endorsed','approved','game-derived images, characters, logos','respective rights holders']) assert(en.includes(word));
 for(const word of ['提携・後援関係になく','承認・推奨も受けていません','ゲーム由来の画像・キャラクター・ロゴ等','各権利者に帰属します']) assert(ja.includes(word));
 assert.match(scopeDoc,/These are examples of transparent credit, not transferable licences/);
 assert.match(scopeDoc,/NOT_ESTABLISHED/);
 assert.match(scopeDoc,/no new game sprites or profile publication is authorized by this UI wording update/);
 assert.equal(scope.decision,'OWNER_00_CTRL_PENDING');
 assert.equal(scope.permissionFromNotice,false);
 assert.equal(scope.profiles.current_repo_game_ui.status,'EXISTING_REPOSITORY_FILES_NOT_RELEASE_LICENSE');
 assert(scope.gameUi.every(x=>x.rights==='NOT_ESTABLISHED'));
 assert.doesNotMatch(html,/\bwe (?:may|can|are allowed to) (?:re)?distribut|\blicensed by Disney\b|\bofficially authorized\b/i);
});
test('R17-N03 existing four-tab, backup, verified edited-copy and separate retries DOM contract stays intact',()=>{
 for(const id of ['welcome','workspace','tabs','records','regions','preview','save-file','open-welcome','open-again',
 'download-backup','prepare-edited-panel','confirm-switch-build','prepare-edited',
 'verified-pair-downloads','download-verified-both','retry-verified-original','retry-verified-edited',
 'stage-preview','undo-plan','redo-plan','clear-plan'])
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(html,/<nav id="tabs" class="tabs" aria-label="Timing categories"><\/nav>/);
 assert.match(html,/<section id="workspace"[^>]*hidden>/);
 assert.match(html,/<section id="prepare-edited-panel"[^>]*hidden/);
 assert.match(html,/<section id="verified-pair-downloads"[^>]*hidden/);
 assert.match(app,/createVerifiedPairDownloadUi\(/);
 assert.match(app,/request\('prepareEdited'/);
 assert.match(worker,/if\(data\.type==='prepareEdited'\)/);
 assert.match(worker,/assessMinimalW1WriteTargets\(/);
 assert.match(worker,/WORKER_VERIFIED_PAIR/);
});
test('R17-N04 existing notice CSS remains purely informational; no input interceptions',()=>{
 assert.match(html,/assets\/app\/release-notice\.css/);
 assert.match(css,/\.release-notice\s*\{/);
 assert.match(css,/overflow-wrap:anywhere/);
 for(const p of [/@import\b/,/display\s*:\s*none/,/visibility\s*:\s*hidden/,/position\s*:\s*(?:fixed|absolute)/,/pointer-events\s*:\s*none/,/\bz-index\s*:/,/input\b|button\b|#prepare-edited|#download-backup|#tabs|@font-face/])
   assert.doesNotMatch(css,p);
});
test('R17-N05 attribution remains shown without source-metadata policy escalation',()=>{
 assert.match(scopeDoc,/## Owner-selected attribution wording \/ community precedents/);
 assert.match(scopeDoc,/not transferable licences or proof that the Timekeeper images are automatically distributable/);
 assert.match(scopeDoc,/Profile selection remains an explicit separate decision/);
 assert.equal(scope.writerAuthorizationUnchanged,true);
 assert.equal(scope.itemImageCount,0);
 assert.equal(scope.profiles.owner_svg_text_only.shipOriginalGameWebp,false);
 assert.equal(scope.profiles.current_repo_game_ui.shipOriginalGameWebp,true);
});
