import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';

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
    channel:'chromium',headless:process.env.DDV_ASSET_HEADFUL!=='1',viewport:{width:1280,height:900},
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
    readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../data/steam-ui-icons-v1253.json',import.meta.url),'utf8').then(JSON.parse),
    readFile(new URL('../data/app-ui-icons.json',import.meta.url),'utf8').then(JSON.parse)
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
      img.src=new URL('./'+x.path,location.href).href;
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
  // The original filechooser timeout on PR #11 attempt 1 was not a timeout
  // of SVG decode or zoom; it lacked evidence that Enter reached the button
  // and its hidden input. Retain a genuine keyboard action (no DOM click).
  await page.bringToFront();
  await control.waitFor({state:'visible'});
  assert.equal(await control.isEnabled(),true,'The restored Open save control must be enabled.');
  await page.evaluate(()=>{
    window.__assetFileChooserTrace=[];
    for(const type of ['keydown','keyup','click','focusin']){
      document.addEventListener(type,event=>{
        if(event.target?.id!=='open-welcome'&&event.target?.id!=='save-file')return;
        window.__assetFileChooserTrace.push({
          type,target:event.target.id,key:event.key??null,
          trusted:event.isTrusted,activeElement:document.activeElement?.id??null,
          userActivation:navigator.userActivation?.isActive??null
        });
      },true);
    }
  });
  await control.focus();
  await page.waitForFunction(
    ()=>document.hasFocus()&&document.activeElement?.id==='open-welcome',null,{timeout:5000}
  );
  // The native OS filechooser notification is intermittent in both headless
  // and Xvfb-headed Chromium despite a trusted button click and the handler-
  // forwarded input click. Record it, but gate on the observable input path and
  // on a real synthetic file load. Do not claim native dialog acceptance here.
  let browserChooserEvents=0;
  page.on('filechooser',()=>{browserChooserEvents++;});
  await page.keyboard.press('Enter');
  const trace=await page.evaluate(()=>window.__assetFileChooserTrace??[]);
  const traceDetails=JSON.stringify(trace);
  assert.ok(trace.some(e=>e.type==='keydown'&&e.key==='Enter'&&e.target==='open-welcome'&&e.trusted),
    'Trusted Enter must reach the Open save button: '+traceDetails);
  assert.ok(trace.some(e=>e.type==='click'&&e.target==='open-welcome'&&e.trusted),
    'Enter must trigger native trusted button activation: '+traceDetails);
  assert.ok(trace.some(e=>e.type==='click'&&e.target==='save-file'&&e.userActivation===true),
    'Button handler must forward user-activated click to file input: '+traceDetails);
  const synthetic=new Uint8Array(makeSyntheticP1gProfile({
    GameInfo:{InitialVersion:518,Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      Created:'2025-01-01T00:00:00Z',Modified:'2026-11-01T00:00:00Z'},
    Player:{Name:'Synthetic Zoom Test'},
    World:{RecurringEvents:{'0':{FlowerSpawningInVillage:{
      RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}}}}
  }));
  await page.locator('#save-file').setInputFiles({
    name:'synthetic-zoom.p1g',mimeType:'application/octet-stream',buffer:Buffer.from(synthetic)
  });
  await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('#download-backup').isEnabled(),true,
    'Keyboard-accessible file input must lead to a usable loaded synthetic save.');
  assert.deepEqual(errors,[],'Unexpected browser page errors.');
  console.log('Actual Chromium tab zoom 200% PASS: '+decoded.length+
    ' decoded originals (4 Steam VP8L + 16 app SVG), viewport '+baseline.width+' -> '+
    dimensions.width+', missing SVG, trusted keyboard file-input dispatch, synthetic save '+
    'load PASS; native chooser notification observed='+browserChooserEvents+' (non-gating).');
}finally{
  if(context)await context.close();
  server.kill();
  await rm(temporary,{recursive:true,force:true});
}
