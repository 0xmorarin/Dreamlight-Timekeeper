import {defineConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
function existingAssets(){
 return {name:'timekeeper-existing-static-assets',generateBundle(this: any){
  const root=resolve('assets');
  const walk=(dir:string)=>{
   for(const name of readdirSync(dir)){
    const path=join(dir,name);
    if(statSync(path).isDirectory())walk(path);
    else if(/\.(svg|webp|css)$/i.test(name)){
     this.emitFile({type:'asset',fileName:'assets/'+relative(root,path).split('\\').join('/'),source:readFileSync(path)});
    }
   }
  };walk(root);
 }};
}
function workerGzipNeutralMime(){
 return {name:'timekeeper-worker-gzip-static-asset-compat',enforce:'pre' as const,
  transform(code:string,id:string){
   if(!id.includes('/src/worker.mjs'))return;
   const original="../data/item-names-v1250.json.gz";
   if(!code.includes(original))throw Error('Product Worker item data URL changed; inspect migration');
   return code.replace(original,"../data/item-names-v1250.json.bin");
  }
 };
}
export default defineConfig({plugins:[workerGzipNeutralMime(),sveltekit(),existingAssets()]});
