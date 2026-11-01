export const EARLY_ACCESS_RELEASE_DATE='2022-09-06';
export const FORMAL_LAUNCH_DATE='2023-12-05';
export function resolveTimePreset(mode,{now=Date.now()}={}){
 if(!Number.isFinite(now)||now<0||!Number.isFinite(new Date(now).getTime()))throw new Error('Invalid preset clock.');
 if(mode==='now')return new Date(now).toISOString();
 if(mode==='century'){
  const d=new Date(now);
  const year=d.getUTCFullYear()+100,month=d.getUTCMonth();
  if(year>9999)throw new Error('100-year target outside supported timestamp range.');
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const target=new Date(Date.UTC(year,month,Math.min(d.getUTCDate(),last),
   d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()));
  if(!Number.isFinite(target.getTime())||target.getUTCFullYear()!==year)throw new Error('Invalid 100-year target.');
  return target.toISOString();
 }
 if(mode==='release'){
  const target=new Date(2022,8,6,0,0,0,0);
  if(target.getFullYear()!==2022||target.getMonth()!==8||target.getDate()!==6||target.getHours()!==0)
   throw new Error('Release date cannot be represented at local midnight.');
  return target.toISOString();
 }
 throw new Error('Unknown time preset.');
}
