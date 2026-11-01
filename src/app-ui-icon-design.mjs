export const LUCIDE_PINNED_COMMIT = 'a630cec77eac6568b989e87e4947a8bfe45caacd';
export const APP_ICON_SOURCES = Object.freeze({
  "action.open-save": "folder-open",
  "action.open-another": "folder-input",
  "action.backup": "download",
  "status.warning": "triangle-alert",
  "status.error": "circle-x",
  "status.success": "circle-check",
  "action.search": "search",
  "action.filter": "list-filter",
  "action.expand": "chevron-down",
  "action.collapse": "chevron-up",
  "action.calendar": "calendar-days",
  "action.clock": "clock",
  "action.utc": "globe",
  "action.local-time": "map-pin",
  "action.technical-details": "info",
  "status.missing-asset": "image-off"
});
export const APP_SVG_SIZE = 24;
export function renderAppUiIconSvg(key,upstream){
  if(!Object.prototype.hasOwnProperty.call(APP_ICON_SOURCES,key))throw new Error('Unknown app UI icon: '+key);
  if(typeof upstream!=='string'||!upstream.includes('stroke="currentColor"')||!upstream.includes('viewBox="0 0 24 24"'))throw new Error('Invalid Lucide source SVG');
  const shapes=upstream.match(/>\n([\s\S]*?)<\/svg>\n$/)?.[1];
  if(!shapes)throw new Error('Missing Lucide icon geometry');
  const body=shapes.trim().split('\n').map(line=>line.trim().replace(/\s+\/>$/,'/>')).join('');
  if(!body||/<(?:svg|image|script|use|style|foreignObject)\b/i.test(body))throw new Error('Unrecognized Lucide shapes');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f2f6f6" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>\n';
}
