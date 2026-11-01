export const APP_ICON_GLYPHS = Object.freeze({
  "action.open-save": "<path d=\"M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2\"/><path d=\"M3 11h18l-2 9H5l-2-9Z\"/>",
  "action.open-another": "<path d=\"M3 8V6a2 2 0 0 1 2-2h4l2 2h7\"/><path d=\"M3 11h12l-2 9H5l-2-9Z\"/><path d=\"M15 7h6m-3-3v6\"/>",
  "action.backup": "<path d=\"M12 3v11m-4-4 4 4 4-4\"/><path d=\"M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3\"/>",
  "status.warning": "<path d=\"M10.3 3.6a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3l8-14Z\"/><path d=\"M12 9v5\"/><circle cx=\"12\" cy=\"17.5\" r=\".7\" fill=\"#f2f6f6\" stroke=\"none\"/>",
  "status.error": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m9 9 6 6m0-6-6 6\"/>",
  "status.success": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m7.5 12 3 3 6-7\"/>",
  "action.search": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m16 16 5 5\"/>",
  "action.filter": "<path d=\"M3 5h18l-7 8v6l-4 2v-8L3 5Z\"/>",
  "action.expand": "<path d=\"m6 9 6 6 6-6\"/>",
  "action.collapse": "<path d=\"m6 15 6-6 6 6\"/>",
  "action.calendar": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 3v4m10-4v4M3 10h18\"/><path d=\"M8 14h3m3 0h2m-8 3h3\"/>",
  "action.clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/>",
  "action.utc": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18\"/>",
  "action.local-time": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/><path d=\"m4 20-2 2\"/>",
  "action.technical-details": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6\"/><circle cx=\"12\" cy=\"7.5\" r=\".7\" fill=\"#f2f6f6\" stroke=\"none\"/>",
  "status.missing-asset": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 16 8 11l4 4 3-3 6 6M16 8h.01\"/><path d=\"m4 4 16 16\"/>"
});
export const APP_SVG_VIEWBOX = '0 0 24 24';
export const APP_SVG_SIZE = 24;
export function renderAppUiIconSvg(key){
  const shapes=APP_ICON_GLYPHS[key];
  if(!shapes)throw new Error('Unknown app UI icon: '+key);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f2f6f6" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>\n`;
}
