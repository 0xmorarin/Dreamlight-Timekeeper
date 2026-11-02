<script lang="ts">
 import {base} from '$app/paths';
 import manifest from '../../../data/steam-icons-v1253.json';
 import type {ItemProjection} from './model';
 import {legacyLocale} from './locale';
 export let item:ItemProjection|null=null;
 export let localeCode='en';
 let failed=false;
 $: entry=item ? (manifest as {icons:Record<string,{path?:string;verified?:boolean}>}).icons?.[String(item.id)] : null;
 $: image=entry?.verified===true&&/^assets\/steam\/v1253\/[A-Za-z0-9_/-]+\.webp$/.test(entry.path??'')
   ?base+'/'+entry.path:null;
 $: alt=item ?item.names?.[legacyLocale(localeCode)]??item.names?.['en-US']??item.name??String(item.id):'';
 $: if(image)failed=false;
</script>
<span class="item-thumb">
 {#if image&&!failed}
  <img src={image} alt={alt} loading="lazy" decoding="async" width="44" height="44" on:error={()=>failed=true}/>
 {:else}
  <img src={base+'/assets/app/ui/status/missing-asset.svg'} alt="" width="28" height="28" loading="lazy"/>
 {/if}
</span>
<style>
 .item-thumb{width:46px;height:46px;flex:0 0 46px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;background:#28434b}
 .item-thumb img{max-width:44px;max-height:44px;object-fit:contain}
</style>
