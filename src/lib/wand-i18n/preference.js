import { FALLBACK_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from './registry.js';
import {
  configureLocalePreferenceAdapter,
  resetLocalePreference,
  restoreLocalePreference,
  setManualLocale
} from './runtime.js';

export const LOCALE_PREFERENCE_STORAGE_KEY = 'dreamwishwand-locale-manual-v1';

const exactSupported = new Map(SUPPORTED_LOCALES.map((entry) => [entry.code.toLowerCase(), entry.code]));
const aliases = Object.freeze({
  en: 'en',
  fr: 'fr',
  it: 'it',
  de: 'de',
  es: 'es-ES',
  ja: 'ja',
  pt: 'pt-BR'
});

export function resolveBrowserLanguageTag(value) {
  if (typeof value !== 'string') return null;
  const tag = value.trim().toLowerCase();
  if (!tag) return null;

  const exact = exactSupported.get(tag);
  if (exact) return exact;

  if (tag === 'zh' || tag === 'zh-sg' || tag === 'zh-hans' || tag.startsWith('zh-hans-')) return 'zh-CN';
  if (tag === 'zh-tw' || tag === 'zh-hk' || tag === 'zh-mo' || tag === 'zh-hant' || tag.startsWith('zh-hant-')) return null;

  const primary = tag.split('-')[0];
  if (tag.startsWith(`${primary}-`) && Object.prototype.hasOwnProperty.call(aliases, primary)) return aliases[primary];
  return null;
}

export function resolveBrowserPreferredLocale(preferredLanguages = []) {
  const list = Array.isArray(preferredLanguages) ? preferredLanguages : [preferredLanguages];
  for (const language of list) {
    const resolved = resolveBrowserLanguageTag(language);
    if (resolved) return resolved;
  }
  return FALLBACK_LOCALE;
}

export function readBrowserPreferredLanguages(navigatorLike = globalThis.navigator) {
  const languages = Array.isArray(navigatorLike?.languages)
    ? navigatorLike.languages.filter((value) => typeof value === 'string' && value.trim())
    : [];
  if (languages.length) return languages;
  return typeof navigatorLike?.language === 'string' && navigatorLike.language.trim() ? [navigatorLike.language] : [];
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createLocalLocalePreferenceAdapter(storageLike = defaultStorage()) {
  return {
    read() {
      try {
        return storageLike?.getItem?.(LOCALE_PREFERENCE_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(locale) {
      const canonical = typeof locale === 'string' ? exactSupported.get(locale.trim().toLowerCase()) ?? null : null;
      if (!canonical) return false;
      try {
        storageLike?.setItem?.(LOCALE_PREFERENCE_STORAGE_KEY, canonical);
        return Boolean(storageLike?.setItem);
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storageLike?.removeItem?.(LOCALE_PREFERENCE_STORAGE_KEY);
        return Boolean(storageLike?.removeItem);
      } catch {
        return false;
      }
    }
  };
}

export async function initializeLocalePreference({ storage = defaultStorage(), navigatorLike = globalThis.navigator } = {}) {
  const adapter = createLocalLocalePreferenceAdapter(storage);
  configureLocalePreferenceAdapter(adapter);
  const automaticLocale = resolveBrowserPreferredLocale(readBrowserPreferredLanguages(navigatorLike));
  return restoreLocalePreference({ automaticLocale, invalidateUnsupported: true });
}

export function setManualLocalePreference(locale) {
  const canonical = typeof locale === 'string' ? exactSupported.get(locale.trim().toLowerCase()) ?? null : null;
  if (!canonical) throw new RangeError(`Unsupported manual locale: ${String(locale)}`);
  return setManualLocale(canonical);
}

export async function resetToBrowserLanguage({ navigatorLike = globalThis.navigator } = {}) {
  const automaticLocale = resolveBrowserPreferredLocale(readBrowserPreferredLanguages(navigatorLike));
  return resetLocalePreference(automaticLocale);
}
