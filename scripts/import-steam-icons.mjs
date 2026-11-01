import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile,writeFile,copyFile,mkdir,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,resolve,join,sep} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {validateIconManifest,inspectLosslessWebP} from '../src/icon-assets.mjs';
import {checkIconImportPlan,readPngRgbaHeader} from '../src/icon-import-plan.mjs';

const exec = promisify(execFile);
const planPath=process.argv[2];
const outputRoot=resolve(process.argv[3]||fileURLToPath(new URL('../',import.meta.url)));
if (!planPath || process.argv.length>4) {
  console.error('Usage: node scripts/import-steam-icons.mjs <local-plan.json> [output-root]');
  process.exitCode=2;
} else {
  const hex=bytes=>createHash('sha256').update(bytes).digest('hex');
  const assertInside=(base,target)=>{if (target===base || !target.startsWith(base+sep)) throw new Error('Source path escaped the import directory.');};
  const run=async(binary,args)=>exec(binary,args,{encoding:'buffer',maxBuffer:8*1024*1024});
  const pixels=async args=>{try{return await run('magick',args);}catch(e){if(e.code==='ENOENT')return run('convert',args);throw e;}};
  const validatePublished=async(root)=>{
    const manifestPath=join(root,'data','steam-icons-v1253.json');
    try {const original=JSON.parse(await readFile(manifestPath,'utf8'));validateIconManifest(original);return original;}
    catch(e){if(e.code==='ENOENT')return {source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'NO_STEAM_ASSET_BYTES_VERIFIED',assetAuthoringRequired:true},icons:{}};throw e;}
  };
  const runImport=async()=>{
    const planLocation=resolve(planPath), base=await realpath(dirname(planLocation));
    const plan=JSON.parse(await readFile(planLocation,'utf8'));
    checkIconImportPlan(plan);
    const old=await validatePublished(outputRoot);
    const manifest=structuredClone(old);
    const prepared=[];
    const tmp=await mkdtemp(join(tmpdir(),'timekeeper-icons-'));
    try{
      for(const item of plan.icons){
        if (Object.hasOwn(manifest.icons,item.itemId)) throw new Error('Item ID already published: '+item.itemId);
        const source=resolve(base,item.pngPath);
        assertInside(base,source);
        const actual=await realpath(source);
        assertInside(base,actual);
        const png=await readFile(actual);
        if(png.length>16*1024*1024)throw new Error('Source PNG too large: '+item.pngPath);
        if(hex(png)!==item.sourceSha256)throw new Error('Source PNG SHA-256 mismatch: '+item.itemId);
        const dims=readPngRgbaHeader(png);
        const file=join(tmp,item.itemId+'.webp');
        await run('cwebp',['-lossless','-z','9','-exact','-metadata','none',actual,'-o',file]);
        const webp=await readFile(file),decoded=inspectLosslessWebP(webp);
        if(decoded.width!==dims.width||decoded.height!==dims.height)throw new Error('WebP dimensions changed: '+item.itemId);
        const [originalRgba,convertedRgba]=await Promise.all([
          pixels([actual,'-alpha','on','-depth','8','RGBA:-']),
          pixels([file,'-alpha','on','-depth','8','RGBA:-'])
        ]);
        if(!Buffer.from(originalRgba.stdout).equals(Buffer.from(convertedRgba.stdout)))
          throw new Error('Decoded RGBA pixels differ: '+item.itemId);
        const path='assets/steam/v1253/'+item.itemId+'.webp';
        prepared.push({file,path,entry:{platform:'Steam',gameVersion:'1.25.3',verified:true,
          path,sha256:hex(webp),sourceSha256:item.sourceSha256,
          sourceAsset:item.sourceAsset,itemIdEvidence:item.itemIdEvidence,...dims}});
      }
      for(const asset of prepared){
        const destination=join(outputRoot,asset.path);
        await mkdir(dirname(destination),{recursive:true});
        await copyFile(asset.file,destination);
        manifest.icons[asset.path.split('/').at(-1).replace('.webp','')]=asset.entry;
      }
      manifest.source.status='VERIFIED_STEAM_ASSETS';
      manifest.source.assetAuthoringRequired=false;
      validateIconManifest(manifest);
      const destination=join(outputRoot,'data','steam-icons-v1253.json');
      await mkdir(dirname(destination),{recursive:true});
      await writeFile(destination,JSON.stringify(manifest,null,2)+'\n');
      console.log('Imported and pixel-verified '+prepared.length+' Steam lossless WebP icons.');
    }finally{await rm(tmp,{recursive:true,force:true});}
  };
  await runImport().catch(err=>{console.error(err instanceof Error?err.message:err);process.exitCode=1;});
}
