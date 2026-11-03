import adapter from '@sveltejs/adapter-static';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';
import {execFileSync} from 'node:child_process';

// SvelteKit's default version name is build-time dependent, changing
// _app/version.json and hashed entry/chunks on repeated identical builds.
// Pin this to the checked-out Git HEAD for reproducible *review* artifacts.
// A copied tree without Git is tagged LOCAL_UNPINNED, never public-approved.
function reviewedVersion(){
 try{
  const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',
   stdio:['ignore','pipe','ignore']}).trim();
  if(/^[0-9a-f]{40}$/.test(revision))return 'git-'+revision;
 }catch{}
 return 'LOCAL_UNPINNED_NOT_FOR_RELEASE';
}
/** Static SvelteKit adapter, local save; deterministic version is NOT release grant. */
export default {
 preprocess:vitePreprocess(),
 kit:{
  adapter:adapter({fallback:'404.html'}),
  paths:{base:process.env.BASE_PATH??''},
  version:{name:reviewedVersion()}
 }
};
