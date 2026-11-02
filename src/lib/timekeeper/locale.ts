import {locale, t, formatDate} from '$lib/wand-i18n/runtime.js';
import {initializeLocalePreference,setManualLocalePreference,resetToBrowserLanguage} from '$lib/wand-i18n/preference.js';
import {SUPPORTED_LOCALES} from '$lib/wand-i18n/registry.js';
import {translate,categoryName,areaName,parseLocalDateTime} from '../../i18n.mjs';
export {locale,t,formatDate,SUPPORTED_LOCALES,initializeLocalePreference,setManualLocalePreference,resetToBrowserLanguage,parseLocalDateTime,categoryName,areaName};
const legacyCodes:Record<string,string>={en:'en-US','es-ES':'es'};
export function legacyLocale(code:string){return legacyCodes[code]??code;}
export function oldText(code:string,key:string,params:Record<string,unknown>={}){return translate(legacyLocale(code),key,params);}
export function dateLabel(value:string|null,code:string){
 if(!value)return oldText(code,'timeUnknown');
 const parsed=new Date(value);if(!Number.isFinite(parsed.getTime()))return oldText(code,'timeUnknown');
 return formatDate(parsed,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'},code);
}
