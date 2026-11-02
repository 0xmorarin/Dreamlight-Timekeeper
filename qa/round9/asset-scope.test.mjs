// 05 QR Round9: acceptance boundary of updated ASSET zoom smoke, pending PR11 integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await text(path));
test('R9 ASSET trusted keyboard → button → hidden input, synthetic P1G; native OS chooser is non-gating',async()=>{
 const [smoke,workflow]=await Promise.all([text('tests/browser-asset-zoom.smoke.mjs'),text('.github/workflows/browser-ui.yml')]);
 assert.match(smoke,/page\.bringToFront\(\)/);
 assert.match(smoke,/document\.hasFocus\(\)/);
 assert.match(smoke,/page\.keyboard\.press\('Enter'\)/);
 assert.match(smoke,/e\.type==='keydown'&&e\.key==='Enter'/);
 assert.match(smoke,/e\.type==='click'&&e\.target==='open-welcome'&&e\.trusted/);
 assert.match(smoke,/e\.type==='click'&&e\.target==='save-file'&&e\.userActivation===true/);
 assert.match(smoke,/page\.locator\('#save-file'\)\.setInputFiles/);
 assert.match(smoke,/makeSyntheticP1gProfile/);
 assert.match(smoke,/\#workspace/);
 assert.match(smoke,/browserChooserEvents\+\+/);
 assert.match(smoke,/native chooser notification observed=/);
 assert.doesNotMatch(smoke,/waitForEvent\('filechooser'\)/);
 assert.match(workflow,/for sample in 1 2 3 4 5/);
 assert.match(workflow,/node tests\/browser-asset-zoom\.smoke\.mjs/);
});
test('R9 ASSET changed UI smoke cannot promote native-dialog evidence or held game images',async()=>{
 const [game,app,item,script]=await Promise.all([
  json('data/steam-ui-icons-v1253.json'),json('data/app-ui-icons.json'),
  json('data/steam-icons-v1253.json'),text('tests/browser-asset-zoom.smoke.mjs')]);
 assert.equal(Object.keys(game.icons).length,4);
 assert.equal(Object.keys(app.icons).length,16);
 assert.equal(Object.keys(item.icons).length,0);
 for(const key of ['world.hgw','tab.shops','tab.daily'])assert.equal(Object.hasOwn(game.icons,key),false);
 assert.match(script,/native chooser notification observed=/);
 assert.match(script,/non-gating/);
 assert.match(script,/page\.locator\('#save-file'\)\.setInputFiles/);
});
