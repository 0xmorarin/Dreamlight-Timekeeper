import adapter from '@sveltejs/adapter-static';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';
/** Wand static adapter, no server access to saves. */
export default {preprocess:vitePreprocess(),kit:{adapter:adapter({fallback:'404.html'}),paths:{base:process.env.BASE_PATH??''}}};
