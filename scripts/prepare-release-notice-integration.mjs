import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const noticePattern=/<div class="release-notice" role="note" aria-label="Unofficial tool notice">[\s\S]*?<\/div>/g;
const styleLink='<link rel="stylesheet" href="./assets/app/release-notice.css">';
const originalTitle='<span class="support-title" data-i18n="official">Official support</span>';
const neutralTitle='<span class="support-title">Version details / 対応バージョン</span>';
const welcomeAnchor='<p id="welcome-status" class="status" role="status" aria-live="polite"></p>';
const backupAnchor='<button id="download-backup" type="button" class="subtle backup" disabled data-i18n="backup">Save original backup</button>';
const originalTestTitle="landing page is translation-ready and contains confirmed official support fields";
const neutralTestTitle="landing page is translation-ready with neutral version details and bilingual unofficial notice";

function once(text,needle,label){
  if(text.split(needle).length!==2)throw new Error(label+' requires exactly one unambiguous anchor');
}
function donorNotice(donor){
  const matches=[...donor.matchAll(noticePattern)].map(m=>m[0]);
  if(matches.length!==2||matches[0]!==matches[1]||
     !matches[0].includes('lang="en">Unofficial fan-made tool.')||
     !matches[0].includes('lang="ja">非公式のファン制作ツールです。')||
     !matches[0].includes('Not affiliated with, endorsed by, or approved by Disney or Gameloft.')||
     !matches[0].includes('ゲーム画像や商標等の権利は主張しません。'))
    throw new Error('Asset donor notice changed; re-review wording before integration');
  once(donor,styleLink,'Asset donor CSS link');
  once(donor,neutralTitle,'Asset donor neutral version title');
  return matches[0];
}

/** Return only the tiny approved static HTML changes; never replace a target UI wholesale. */
export function portNoticeHtml(target,donor){
  const notice=donorNotice(donor);
  for(const id of ['save-file','welcome','open-welcome','welcome-status','workspace',
                   'tabs','session-name','open-again','download-backup']){
    if(!target.includes('id="'+id+'"'))throw new Error('Target missing UI contract: '+id);
  }
  if(target.includes('class="release-notice"')||target.includes(styleLink)||
     target.includes(neutralTitle)){
    if((target.match(noticePattern)||[]).length===2&&
       [...target.matchAll(noticePattern)].every(m=>m[0]===notice)&&
       target.includes(styleLink)&&target.includes(neutralTitle)&&
       !target.includes(originalTitle))return target;
    throw new Error('Partially integrated notice detected; manual conflict review required');
  }
  once(target,'<link rel="stylesheet" href="./styles.css">','Stylesheet');
  once(target,originalTitle,'Original support header');
  once(target,welcomeAnchor,'Welcome status');
  once(target,backupAnchor,'Original-backup button');
  let result=target
    .replace('<link rel="stylesheet" href="./styles.css">',
             '<link rel="stylesheet" href="./styles.css">\n'+styleLink)
    .replace(originalTitle,neutralTitle)
    .replace(welcomeAnchor,welcomeAnchor+'\n    '+notice)
    .replace(backupAnchor,backupAnchor+'\n        '+notice);
  if((result.match(noticePattern)||[]).length!==2)throw new Error('Incomplete notice port');
  return result;
}

/** Modify only the legacy HTML contract test, retaining every other 03 WEB test unchanged. */
export function portNoticeUiTest(target,donor){
  const marker=' assert.match(page,/Version details \\/ 対応バージョン/);';
  const start=donor.indexOf(marker);
  const end=donor.indexOf(' assert.doesNotMatch(page,/<header',start);
  if(start<0||end<0)throw new Error('Asset donor notice assertions not found');
  const assertions=donor.slice(start,end);
  if(target.includes(neutralTestTitle)){
    if(target.includes(assertions))return target;
    throw new Error('Partial UI contract test migration');
  }
  once(target,originalTestTitle,'Legacy test title');
  once(target,"['official','gameVersion'","Legacy support key assertion");
  once(target,' assert.match(page,/2026-11-01/);','Legacy release-version marker');
  return target.replace(originalTestTitle,neutralTestTitle)
    .replace("['official','gameVersion'","['gameVersion'")
    .replace(' assert.match(page,/2026-11-01/);',
             ' assert.match(page,/2026-11-01/);\n'+assertions.trimEnd());
}

/**
 * Explicit manual integration aid only: outputs staged copies into a NEW folder.
 * Never mutates an input branch, PR, manifest, game image or Writer.
 */
export async function stageNoticePort(targetRoot,outputRoot,donorRoot=resolve(fileURLToPath(new URL('../',import.meta.url)))){
  const input=resolve(targetRoot),output=resolve(outputRoot),donor=resolve(donorRoot);
  if(input===output||output.startsWith(input+'/')||output.startsWith(donor+'/'))
    throw new Error('Output must not be inside the target or Asset donor checkout');
  const [html,test,donorHtml,donorTest,css]=await Promise.all([
    readFile(join(input,'index.html'),'utf8'),
    readFile(join(input,'tests/ui.test.mjs'),'utf8'),
    readFile(join(donor,'index.html'),'utf8'),
    readFile(join(donor,'tests/ui.test.mjs'),'utf8'),
    readFile(join(donor,'assets/app/release-notice.css'),'utf8')
  ]);
  const updatedHtml=portNoticeHtml(html,donorHtml);
  const updatedTest=portNoticeUiTest(test,donorTest);
  await mkdir(output); // exclusive: never overwrite an existing staging directory
  await mkdir(join(output,'tests'));
  await mkdir(join(output,'assets'));
  await mkdir(join(output,'assets/app'));
  await Promise.all([
    writeFile(join(output,'index.html'),updatedHtml,{flag:'wx'}),
    writeFile(join(output,'tests/ui.test.mjs'),updatedTest,{flag:'wx'}),
    writeFile(join(output,'assets/app/release-notice.css'),css,{flag:'wx'})
  ]);
  return {files:['index.html','tests/ui.test.mjs','assets/app/release-notice.css'],
    noteCount:(updatedHtml.match(noticePattern)||[]).length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4)throw new Error(
    'Usage: node scripts/prepare-release-notice-integration.mjs <03-WEB-checkout> <new-output-dir>'
  );
  const result=await stageNoticePort(process.argv[2],process.argv[3]);
  console.log('Asset notice staged only; review and integrate via 00 CTRL: '+result.files.join(', '));
}
