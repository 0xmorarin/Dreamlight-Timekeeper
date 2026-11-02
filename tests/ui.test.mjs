import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
test('landing page is translation-ready with neutral version details and bilingual unofficial notice',()=>{
 assert.match(page,/<html lang="en">/);
 assert.match(page,/<title>Dreamlight Timekeeper<\/title>/);
 assert.match(page,/<h1>Dreamlight Timekeeper<\/h1>/);
 for(const key of ['gameVersion','saveVersion','updated','dropHint','openSave','language'])assert.match(page,new RegExp('data-i18n="'+key+'"'));
 assert.match(page,/v1\.25\.3/);
 assert.match(page,/>: 626<\/span>/);
 assert.match(page,/2026-11-01/);
 assert.match(page,/Version details \/ 対応バージョン/);
 assert.doesNotMatch(page,/<span[^>]*data-i18n="official"/);
 assert.match(page,/assets\/app\/release-notice\.css/);
 assert.equal((page.match(/class="release-notice"/g)||[]).length,2);
 assert.equal((page.match(/lang="ja">非公式のファン制作ツールです/g)||[]).length,2);
 assert.equal((page.match(/lang="en">Unofficial fan-made tool/g)||[]).length,2);

 assert.doesNotMatch(page,/<header\b|DDV Save Timing Tools|Nintendo Switch/);
});
test('one global drop listener and independent four-tab three-pane editor',()=>{
 assert.match(page,/id="welcome"/);
 assert.match(page,/id="workspace"[^>]*hidden/);
 assert.match(page,/id="regions"/);
 assert.match(page,/id="records"/);
 assert.match(page,/id="preview"/);
 assert.match(app,/document\.addEventListener\('drop'/);
 assert.match(app,/document\.addEventListener\('dragover'/);
 assert.match(app,/document\.addEventListener\('dragenter'/);
 assert.match(app,/dataTransfer\?\.files\?\.\[0\]/);
 assert.match(app,/previewScope\(/);
 assert.match(app,/selected\.add\(/);
 assert.match(app,/original_/);
 assert.match(css,/100dvh/);
 assert.match(css,/grid-template-columns:minmax\(205px,240px\)/);
});
