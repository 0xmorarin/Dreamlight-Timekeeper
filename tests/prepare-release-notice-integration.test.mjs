import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {portNoticeHtml,portNoticeUiTest,stageNoticePort} from '../scripts/prepare-release-notice-integration.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const donorHtml=await readFile(new URL('../index.html',import.meta.url),'utf8');
const donorTest=await readFile(new URL('./ui.test.mjs',import.meta.url),'utf8');
const donorCss=await readFile(new URL('../assets/app/release-notice.css',import.meta.url),'utf8');
const targetHead='<link rel="stylesheet" href="./styles.css">';
const targetNotice='<span class="support-title" data-i18n="official">Official support</span>';
const oldTestTitle="landing page is translation-ready and contains confirmed official support fields";
const legacyTest=donorTest
  .replace('landing page is translation-ready with neutral version details and bilingual unofficial notice',oldTestTitle)
  .replace("['gameVersion','saveVersion'","['official','gameVersion','saveVersion'")
  .replace(/ assert.match\(page,\/Version details[\s\S]*?(?= assert.doesNotMatch\(page,\/<header)/,'');
const legacyHtml=extra=>[
  '<!doctype html><html lang="en"><head>',
  targetHead,
  '</head><body><input id="save-file" type="file" hidden>',
  '<section id="welcome"><div class="support">'+targetNotice+'</div>',
  '<button id="open-welcome">Open save</button>',
  '<p id="welcome-status" class="status" role="status" aria-live="polite"></p></section>',
  '<section id="workspace" hidden><nav id="tabs"></nav>',
  '<div id="session-name"></div><button id="open-again">Open again</button>',
  '<div id="draft-plan"></div><div class="detail-bottom">',
  '<button id="download-backup" type="button" class="subtle backup" disabled data-i18n="backup">Save original backup</button>',
  extra,
  '</div></section></body></html>'
].join('\n');
const variant=[
  ['PR11 contract','<div id="timing-audit"></div><button id="stage-preview">Plan</button>'],
  ['03 WEB Phase B download contract','<section id="verified-pair-downloads" hidden><button id="download-verified-both">Both</button><button id="retry-verified-edited">Retry edited</button></section>']
];

test('integration donor has exactly two matching bilingual paragraphs and no new image rights',()=>{
  assert.equal((donorHtml.match(/class="release-notice"/g)||[]).length,2);
  assert.match(donorHtml,/no rights to game images or trademarks/);
  assert.match(donorHtml,/ゲーム画像や商標等の権利は主張しません/);
  assert.doesNotMatch(donorHtml,/Official support/);
  assert.match(donorCss,/\.release-notice/);
});

for(const [name,extra] of variant){
  test(name+' receives only four isolated HTML insertions and preserves other 03 WEB controls',()=>{
    const input=legacyHtml(extra);
    const output=portNoticeHtml(input,donorHtml);
    assert.equal((output.match(/class="release-notice"/g)||[]).length,2);
    assert.equal((output.match(/lang="ja">非公式のファン制作ツールです/g)||[]).length,2);
    assert.match(output,/Version details \/ 対応バージョン/);
    assert.doesNotMatch(output,/Official support/);
    assert.ok(output.includes(extra),'Original integrated plan/download controls must survive unchanged.');
    for(const id of ['welcome','workspace','tabs','open-welcome','open-again','save-file','download-backup']){
      assert.equal((output.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    }
    assert.equal(portNoticeHtml(output,donorHtml),output,'Already integrated file is idempotent');
    const testOutput=portNoticeUiTest(legacyTest,donorTest);
    assert.equal(testOutput,donorTest,'Legacy static UI test upgrade matches Asset source exactly');
    assert.equal(portNoticeUiTest(testOutput,donorTest),testOutput);
  });
}

test('partial port, changed download anchor, duplicate anchor or unapproved test source fails closed',()=>{
  const target=legacyHtml('<!-- preserve -->');
  assert.throws(()=>portNoticeHtml(target.replace(targetNotice,'Changed Support'),donorHtml),/requires exactly one/);
  assert.throws(()=>portNoticeHtml(target.replace(targetHead,targetHead+targetHead),donorHtml),/exactly one/);
  assert.throws(()=>portNoticeHtml(target.replace('id="download-backup"','id="removed-backup"'),donorHtml),/missing UI contract/);
  assert.throws(()=>portNoticeHtml(target.replace(targetHead,targetHead+'\n<link rel="stylesheet" href="./assets/app/release-notice.css">'),donorHtml),/Partially integrated/);
  assert.throws(()=>portNoticeHtml(target,donorHtml.replace('Not affiliated with','Affiliated with')),/donor notice changed/);
  assert.throws(()=>portNoticeUiTest(legacyTest.replace('official support fields','changed support fields'),donorTest),/exactly one/);
  assert.throws(()=>portNoticeUiTest(legacyTest,donorTest.replace('Version details','Official support')),/Asset donor notice assertions/);
});

test('CLI staging creates separate files, never overwrites a target or an existing output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'timekeeper-notice-port-'));
  try{
    const input=join(dir,'input'),output=join(dir,'out');
    await mkdir(input);await mkdir(join(input,'tests'));
    const target=legacyHtml('<section id="verified-pair-downloads" hidden>Phase B</section>');
    await writeFile(join(input,'index.html'),target);
    await writeFile(join(input,'tests/ui.test.mjs'),legacyTest);
    const result=await stageNoticePort(input,output,root);
    assert.deepEqual(result.files,['index.html','tests/ui.test.mjs','assets/app/release-notice.css']);
    assert.equal(result.noteCount,2);
    assert.equal(await readFile(join(input,'index.html'),'utf8'),target,'Source must be untouched.');
    assert.equal(await readFile(join(output,'index.html'),'utf8'),portNoticeHtml(target,donorHtml));
    assert.equal(await readFile(join(output,'tests/ui.test.mjs'),'utf8'),donorTest);
    assert.equal(await readFile(join(output,'assets/app/release-notice.css'),'utf8'),donorCss);
    await assert.rejects(stageNoticePort(input,output,root),/EEXIST/);
    await assert.rejects(stageNoticePort(input,input,root),/Output must not/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
