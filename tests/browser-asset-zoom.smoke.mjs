import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const temporary=await mkdtemp(join(tmpdir(),'timekeeper-asset-zoom-'));
const extension=join(temporary,'zoom-extension');
await mkdir(extension);
await writeFile(join(extension,'manifest.json'),JSON.stringify({
  manifest_version:3,name:'Local asset zoom test',version:'1.0',
  permissions:['tabs'],background:{service_worker:'background.js'}
}));
await writeFile(join(extension,'background.js'),'// Zoom only the locally served test tab.\n');
const probe=createServer();
probe.listen(0,'127.0.0.1');
await once(probe,'listening');
const port=probe.address().port;
probe.close();
await once(probe,'close');
const site='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let context;
try{
  let ready=false;
  for(let n=0;n<60;n++){
    try{if((await fetch(site)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert.ok(ready,'Local asset test server unavailable.');
  context=await chromium.launchPersistentContext(join(temporary,'profile'),{
    channel:'chromium',headless:true,viewport:{width:1280,height:900},
    args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]
  });
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:15000});
  const baseline=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
  const zoom=await worker.evaluate(async url=>{
    const tabs=await chrome.tabs.query({});
    const tab=tabs.find(t=>t.url===url);
    if(!tab)throw new Error('The local Timekeeper browser tab could not be found.');
    await chrome.tabs.setZoom(tab.id,2);
    return await chrome.tabs.getZoom(tab.id);
  },page.url());
  assert.equal(zoom,2,'Actual Chrome tab zoom must be 200%.');
  await page.waitForFunction(previous=>innerWidth<previous.width,{width:baseline.width},{timeout:10000});
  const dimensions=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(dimensions.width<baseline.width,'200% tab zoom must reduce available CSS viewport.');
  assert.ok(dimensions.dpr>baseline.dpr,'200% Chrome zoom must increase devicePixelRatio.');
  const [item,game,app]=await Promise.all([
    fetch(new URL('../data/steam-icons-v1253.json',import.meta.url)).then(r=>r.json()),
    fetch(new URL('../data/steam-ui-icons-v1253.json',import.meta.url)).then(r=>r.json()),
    fetch(new URL('../data/app-ui-icons.json',import.meta.url)).then(r=>r.json())
  ]);
  assert.equal(Object.keys(item.icons).length,0,'ItemID images remain unpublished.');
  assert.equal(Object.keys(game.icons).length,4,'Expected four approved Steam UI images.');
  assert.equal(Object.keys(app.icons).length,16,'Expected original sixteen SVG images.');
  const entries=[
    ...Object.entries(game.icons).map(([key,v])=>({key,kind:'game_ui',...v})),
    ...Object.entries(app.icons).map(([key,v])=>({key,kind:'app_ui',...v}))
  ];
  const decoded=await page.evaluate(async entries=>{
    return Promise.all(entries.map(async x=>{
      const img=new Image();
      img.src=new URL('../'+x.path,import.meta.url).href;
      await img.decode();
      return {
        key:x.key,kind:x.kind,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
        expectedWidth:x.width,expectedHeight:x.height
      };
    }));
  },entries);
  for(const d of decoded){
    assert.equal(d.naturalWidth,d.expectedWidth,d.kind+':'+d.key+' width');
    assert.equal(d.naturalHeight,d.expectedHeight,d.kind+':'+d.key+' height');
  }
  const control=page.locator('#open-welcome');
  await control.waitFor({state:'visible'});
  const geometry=await control.boundingBox();
  assert.ok(geometry.height>=44,'Zoomed save control remains a usable target.');
  const decorative=control.locator('img.semantic-icon');
  assert.equal(await decorative.evaluate(el=>el.alt===''&&el.getAttribute('aria-hidden')==='true'),true);
  await page.route('**/assets/app/ui/action/open-save.svg',route=>route.abort());
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dreamlightBooted===true);
  await decorative.waitFor({state:'detached'});
  assert.match(await control.innerText(),/Open save/);
  await control.focus();
  assert.equal(await control.evaluate(el=>el===document.activeElement),true);
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.keyboard.press('Enter')]);
  assert.equal(chooser.isMultiple(),false);
  assert.deepEqual(errors,[],'Unexpected browser page errors.');
  console.log('Actual Chromium tab zoom 200% PASS: '+decoded.length+
    ' decoded originals (4 Steam VP8L + 16 app SVG), viewport '+baseline.width+' -> '+
    dimensions.width+', missing SVG and keyboard file picker preserved.');
}finally{
  if(context)await context.close();
  server.kill();
  await rm(temporary,{recursive:true,force:true});
}
