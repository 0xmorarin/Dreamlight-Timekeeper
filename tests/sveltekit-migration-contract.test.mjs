import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('SvelteKit static Wand stack without Wand backend or auth',async()=>{
 const pkg=JSON.parse(await src('package.json')),config=await src('svelte.config.js');
 assert(pkg.devDependencies['@sveltejs/kit'].startsWith('^2'));
 assert(pkg.devDependencies.svelte.startsWith('^5'));
 assert(pkg.devDependencies.vite.startsWith('^7'));
 assert(pkg.devDependencies.typescript.startsWith('^5'));
 assert.match(config,/fallback:'404.html'/);
 assert.match(config,/process\.env\.BASE_PATH/);
 assert(!/supabase|community|@auth|server-only/.test(JSON.stringify(pkg)));
});
test('Pinned Wand canonical locale and manual-only device preference',async()=>{
 const registry=await src('src/lib/wand-i18n/registry.js');
 const preference=await src('src/lib/wand-i18n/preference.js');
 const runtime=await src('src/lib/wand-i18n/runtime.js');
 assert.match(registry,/es-ES/);assert.match(registry,/zh-CN/);
 assert.match(preference,/dreamwishwand-locale-manual-v1/);
 assert.match(runtime,/restoreLocalePreference/);
 assert.match(runtime,/FALLBACK_LOCALE/);
 assert.match(await src('src/lib/timekeeper/locale.ts'),/en:'en-US'.*'es-ES':'es'/);
});
test('Worker data remains off Svelte store; typed full-source transfer and invalidation',async()=>{
 const adapter=await src('src/lib/timekeeper/worker-adapter.ts');
 const page=await src('src/routes/+page.svelte');
 assert.match(adapter,/new Worker\(new URL\('\.\.\/\.\.\/worker\.mjs'/);
 assert.match(adapter,/postMessage\(\{\.\.\.message,id\},transfer\)/);
 assert.match(adapter,/this\.worker\?\.terminate\(\)/);
 assert.match(adapter,/SAVE_PORT_VERSION/);
 assert.match(page,/createOriginalBackupCoordinator/);
 assert.match(page,/createVerifiedPairDownloadUi/);
 assert.match(page,/assessMinimalW1WriteTargets|prepareEdited/);
 assert(!/JSON\.parse\(await file\.text\(\)\)/.test(page));
 assert(!/persistentReplace|overwriteOriginal/.test(page));
});
test('Owner original svg and image mapping remain display-only',async()=>{
 const thumb=await src('src/lib/timekeeper/ItemThumb.svelte');
 const page=await src('src/routes/+page.svelte');
 assert.match(thumb,/loading="lazy"/);
 assert.match(thumb,/steam-icons-v1253/);
 assert.match(page,/assets\/app\/ui\/action\/open-save\.svg/);
 assert.match(page,/Option value|option value="release"/);
});
