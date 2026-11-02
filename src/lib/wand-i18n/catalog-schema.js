export const MESSAGE_KEY_PATTERN = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;
const PLACEHOLDER_PATTERN = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
export function placeholders(value) {
  const values = typeof value === 'string' ? [value] : Object.values(value ?? {});
  return [...new Set(values.flatMap((text) => [...String(text).matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1])))].sort();
}
export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) return ['catalog must be an object'];
  for (const [key, value] of Object.entries(catalog)) {
    if (!MESSAGE_KEY_PATTERN.test(key)) errors.push(`invalid message key: ${key}`);
    if (typeof value === 'string') continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${key}: message must be string or plural object`); continue; }
    if (typeof value.other !== 'string') errors.push(`${key}: plural object requires string "other"`);
    for (const [category, text] of Object.entries(value)) if (typeof text !== 'string') errors.push(`${key}.${category}: plural form must be string`);
  }
  return errors;
}
