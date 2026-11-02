import { catalogs } from './messages/index.js';
import { FALLBACK_LOCALE, SUPPORTED_LOCALES, getLocaleDefinition, normalizeLocale } from './registry.js';

let activeLocale = FALLBACK_LOCALE;
let preferenceAdapter = null;
let missingKeyReporter = null;
const subscribers = new Set();
const diagnostics = [];
export { FALLBACK_LOCALE, SUPPORTED_LOCALES };

export const locale = { subscribe(run) { subscribers.add(run); run(activeLocale); return () => subscribers.delete(run); } };

export function getActiveLocale() { return activeLocale; }

export function applyDocumentLanguage(documentLike, code) {
  const definition = getLocaleDefinition(code);
  if (!definition || !documentLike?.documentElement) return false;
  documentLike.documentElement.lang = definition.htmlLang;
  documentLike.documentElement.dataset.locale = definition.code;
  return true;
}
function emitDiagnostic(entry) {
  diagnostics.push(entry);
  if (diagnostics.length > 100) diagnostics.shift();
  if (missingKeyReporter) missingKeyReporter(entry);
}
export function getLocaleDiagnostics() { return diagnostics.slice(); }
export function clearLocaleDiagnostics() { diagnostics.length = 0; }
export function setMissingKeyReporter(reporter) { missingKeyReporter = typeof reporter === 'function' ? reporter : null; }
export function configureLocalePreferenceAdapter(adapter) {
  if (adapter !== null && (
    typeof adapter !== 'object' ||
    typeof adapter.read !== 'function' ||
    typeof adapter.write !== 'function' ||
    (adapter.clear !== undefined && typeof adapter.clear !== 'function')
  )) throw new TypeError('Locale preference adapter must expose read(), write(locale), and optional clear().');
  preferenceAdapter = adapter;
}
export async function restoreLocalePreference({ automaticLocale = FALLBACK_LOCALE, invalidateUnsupported = true } = {}) {
  const automatic = normalizeLocale(automaticLocale) ?? FALLBACK_LOCALE;
  if (!preferenceAdapter) return setLocale(automatic);

  let stored = null;
  try {
    stored = await preferenceAdapter.read();
  } catch (error) {
    emitDiagnostic({ type: 'preference-read-failed', message: error instanceof Error ? error.message : String(error) });
  }

  const candidate = typeof stored === 'string' ? SUPPORTED_LOCALES.find((entry) => entry.code === stored)?.code ?? null : null;
  if (candidate) return setLocale(candidate);

  if (invalidateUnsupported && stored !== null && stored !== undefined && typeof preferenceAdapter.clear === 'function') {
    try {
      await preferenceAdapter.clear();
      emitDiagnostic({ type: 'preference-invalidated', value: String(stored) });
    } catch (error) {
      emitDiagnostic({ type: 'preference-clear-failed', message: error instanceof Error ? error.message : String(error) });
    }
  }
  return setLocale(automatic);
}
export function setLocale(next, { persist = false } = {}) {
  const normalized = normalizeLocale(next);
  if (!normalized) throw new RangeError(`Unsupported locale: ${String(next)}`);
  activeLocale = normalized;
  if (typeof document !== 'undefined') applyDocumentLanguage(document, normalized);
  for (const run of subscribers) run(activeLocale);
  if (persist && preferenceAdapter) {
    try {
      void Promise.resolve(preferenceAdapter.write(activeLocale)).catch((error) => emitDiagnostic({ type: 'preference-write-failed', message: error instanceof Error ? error.message : String(error) }));
    } catch (error) {
      emitDiagnostic({ type: 'preference-write-failed', message: error instanceof Error ? error.message : String(error) });
    }
  }
  return activeLocale;
}
export function setManualLocale(next) {
  return setLocale(next, { persist: true });
}
export async function resetLocalePreference(automaticLocale = FALLBACK_LOCALE) {
  const automatic = normalizeLocale(automaticLocale) ?? FALLBACK_LOCALE;
  if (preferenceAdapter && typeof preferenceAdapter.clear === 'function') {
    try {
      await preferenceAdapter.clear();
    } catch (error) {
      emitDiagnostic({ type: 'preference-clear-failed', message: error instanceof Error ? error.message : String(error) });
    }
  }
  return setLocale(automatic);
}
function interpolate(template, params) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}
export function resolveMessageFromCatalogs(sourceCatalogs, code, key, params = {}, fallbackLocale = FALLBACK_LOCALE) {
  const normalized = normalizeLocale(code) ?? fallbackLocale;
  const localeCatalog = sourceCatalogs[normalized] ?? {};
  const fallbackCatalog = sourceCatalogs[fallbackLocale] ?? {};
  let entry = localeCatalog[key], usedFallback = false;
  if (entry === undefined) { entry = fallbackCatalog[key]; usedFallback = true; }
  if (entry === undefined) return { text: `⟦${key}⟧`, missing: true, usedFallback: true };
  if (entry && typeof entry === 'object') {
    const count = Number(params.count);
    const localeDef = getLocaleDefinition(normalized) ?? getLocaleDefinition(fallbackLocale);
    const category = Number.isFinite(count) ? new Intl.PluralRules(localeDef?.intlLocale ?? fallbackLocale).select(count) : 'other';
    entry = entry[category] ?? entry.other;
  }
  return { text: interpolate(String(entry), params), missing: false, usedFallback };
}
export function t(key, params = {}, code = activeLocale) {
  const result = resolveMessageFromCatalogs(catalogs, code, key, params);
  if (result.missing || result.usedFallback) emitDiagnostic({ type: result.missing ? 'missing-key' : 'fallback-used', locale: normalizeLocale(code) ?? code, key });
  return result.text;
}
export function formatNumber(value, options = {}, code = activeLocale) {
  const definition = getLocaleDefinition(code) ?? getLocaleDefinition(FALLBACK_LOCALE);
  return new Intl.NumberFormat(definition.intlLocale, options).format(value);
}
export function formatDate(value, options = {}, code = activeLocale) {
  const definition = getLocaleDefinition(code) ?? getLocaleDefinition(FALLBACK_LOCALE);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date value');
  return new Intl.DateTimeFormat(definition.intlLocale, options).format(date);
}
if (typeof document !== 'undefined') {
  const fromHtml = normalizeLocale(document.documentElement.lang);
  if (fromHtml) activeLocale = fromHtml;
  applyDocumentLanguage(document, activeLocale);
}
