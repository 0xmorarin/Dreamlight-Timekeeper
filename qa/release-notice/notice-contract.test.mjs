// 05 QR notice-only release delta. Static DOM+source invariants only; no Writer reruns.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [html,css,app,worker]=await Promise.all([
 root('index.html'),root('assets/app/release-notice.css'),
 root('src/app.mjs'),root('src/worker.mjs')
]);
const unofficialEN='Unofficial fan-made tool. Not affiliated with, endorsed by, or approved by Disney or Gameloft. We claim no rights to game images or trademarks.';
const unofficialJA='非公式のファン制作ツールです。DisneyおよびGameloftとは提携しておらず、承認・推奨も受けていません。ゲーム画像や商標等の権利は主張しません。';
function getSection(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing section boundary '+start);
 return html.slice(a,b);
}
test('N01 Welcome and Workspace independently show readable bilingual unofficial notice',()=>{
 const welcome=getSection('<section id="welcome"','<section id="workspace"');
 const workspace=getSection('<section id="workspace"','<script>');
 for(const section of [welcome,workspace]){
  assert.equal((section.match(/class="release-notice"/g)||[]).length,1);
  assert.equal((section.match(/role="note"/g)||[]).length,1);
  assert.equal((section.match(/aria-label="Unofficial tool notice"/g)||[]).length,1);
  assert(section.includes('<p lang="en">'+unofficialEN+'</p>'));
  assert(section.includes('<p lang="ja">'+unofficialJA+'</p>'));
 }
 assert.equal((html.match(/class="release-notice"/g)||[]).length,2);
 assert.doesNotMatch(html,/data-i18n="official"|Official support/);
 assert.match(html,/Version details \/ 対応バージョン/);
 assert.match(html,/assets\/app\/release-notice\.css/);
 assert.doesNotMatch(html,/<script[^>]*release-notice|onclick=/);
});
test('N02 notice CSS has informational style only; no click overlays, hidden copy or scope mutation',()=>{
 assert.match(css,/\.release-notice\s*\{/);
 assert.match(css,/\.detail-bottom \.release-notice\s*\{/);
 assert.match(css,/overflow-wrap:anywhere/);
 for(const prohibited of [/@import\b/,/display\s*:\s*none/,/visibility\s*:\s*hidden/,/opacity\s*:\s*0(?:\s|;|})/,/position\s*:\s*(?:fixed|absolute)/,/pointer-events\s*:\s*none/,/z-index\s*:/,/input\b|button\b|#prepare-edited|#download-backup|#tabs|@font-face/])
  assert.doesNotMatch(css,prohibited);
});
test('N03 four tabs, backup, exact Worker-copy and separated per-file retry DOM contracts unchanged',()=>{
 assert.match(app,/createVerifiedPairDownloadUi\(/);
 assert.match(app,/request\('prepareEdited'/);
 assert.match(worker,/if\(data\.type==='prepareEdited'\)/);
 assert.match(worker,/assessMinimalW1WriteTargets\(/);
 assert.match(worker,/WORKER_VERIFIED_PAIR/);
 for(const id of ['welcome','workspace','tabs','download-backup','prepare-edited-panel',
 'confirm-switch-build','prepare-edited','verified-pair-downloads',
 'download-verified-both','retry-verified-original','retry-verified-edited',
 'undo-plan','redo-plan','clear-plan'])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.equal((html.match(/<nav id="tabs"/g)||[]).length,1);
 assert.match(html,/<section id="workspace"[^>]*hidden>/);
 assert.match(html,/<section id="prepare-edited-panel"[^>]*hidden/);
 assert.match(html,/<section id="verified-pair-downloads"[^>]*hidden/);
 assert.doesNotMatch(html,/id="export-edited"/);
});
test('N04 do not mistake disclaimer notice for game image redistribution rights or product release',()=>{
 assert.match(html,/We claim no rights to game images or trademarks/);
 assert.match(html,/ゲーム画像や商標等の権利は主張しません/);
 assert.match(html,/Not affiliated with, endorsed by, or approved by Disney or Gameloft/);
 assert.doesNotMatch(html,/official support|Official support|authorized by Disney|licensed by Gameloft/i);
});
