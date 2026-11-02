import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
test('landing page is translation-ready and contains confirmed official support fields',()=>{
 assert.match(page,/<html lang="en">/);
 assert.match(page,/<title>Dreamlight Timekeeper<\/title>/);
 assert.match(page,/<h1>Dreamlight Timekeeper<\/h1>/);
 for(const key of ['official','gameVersion','saveVersion','updated','dropHint','openSave','language'])assert.match(page,new RegExp('data-i18n="'+key+'"'));
 assert.match(page,/v1\.25\.3/);
 assert.match(page,/>: 626<\/span>/);
 assert.match(page,/2026-11-01/);
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

test('read-only timing audit is visible without implying repair or changing the save',()=>{
 assert.match(page,/id="timing-audit"/);
 assert.match(app,/function renderAudit\(/);
 assert.match(app,/a\.diagnosticOnly!==true\|\|a\.writerAuthorized!==false/);
 assert.match(app,/t\('auditNoRepair'\)/);
 assert.match(css,/\.audit-details/);
 assert.match(app,/detail\.open=wasOpen\?\?false/);
});

test('preview UI exposes approved past and future presets without enabling any writer',()=>{
 assert.match(page,/value="century"/);
 assert.match(page,/value="release"/);
 assert.match(app,/resolveTimePreset\(state\.mode/);
 assert.match(app,/mode:state\.mode==='now'\?'now':'custom'/);
 assert.doesNotMatch(page,/id="export-edited"/);
});

test('preview plan UI provides reversible staging without enabling save writes',()=>{
 for(const id of ['stage-preview','undo-plan','redo-plan','clear-plan','draft-plan'])assert.match(page,new RegExp('id="'+id+'"'));
 assert.match(app,/createTimingDraft\(result\.view\)/);
 assert.match(app,/state\.draft\.stage\(/);
 assert.match(app,/state\.draft\?\.undo\(\)/);
 assert.match(app,/state\.draft\?\.redo\(\)/);
 assert.match(app,/state\.draft\?\.clear\(\)/);
 assert.doesNotMatch(app,/request\('export'\)/);
 assert.doesNotMatch(page,/id="export-edited"/);
});

test('preflight is source-authoritative and does not introduce an edited save download path',()=>{
 assert.match(app,/request\('preflight',\{sessionId,entries\}\)/);
 assert.match(app,/request\('backup',\{sessionId:state\.sessionId\}\)/);
 assert.match(app,/preflightSequence/);
 assert.match(app,/preflightSummary/);
 assert.doesNotMatch(page,/id="export-edited"/);
 assert.doesNotMatch(app,/request\('encode'|request\('export'/);
});
