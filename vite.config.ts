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
export default defineConfig({plugins:[sveltekit(),existingAssets()]});
