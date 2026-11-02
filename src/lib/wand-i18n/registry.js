export const SUPPORTED_LOCALES = Object.freeze([
  { code: 'en', launchCode: 'EN', htmlLang: 'en', intlLocale: 'en', nativeName: 'English' },
  { code: 'fr', launchCode: 'FR', htmlLang: 'fr', intlLocale: 'fr', nativeName: 'Français' },
  { code: 'it', launchCode: 'IT', htmlLang: 'it', intlLocale: 'it', nativeName: 'Italiano' },
  { code: 'de', launchCode: 'DE', htmlLang: 'de', intlLocale: 'de', nativeName: 'Deutsch' },
  { code: 'es-ES', launchCode: 'ES-ES', htmlLang: 'es-ES', intlLocale: 'es-ES', nativeName: 'Español (España)' },
  { code: 'ja', launchCode: 'JA', htmlLang: 'ja', intlLocale: 'ja-JP', nativeName: '日本語' },
  { code: 'zh-CN', launchCode: 'ZH-CN', htmlLang: 'zh-CN', intlLocale: 'zh-CN', nativeName: '简体中文' },
  { code: 'pt-BR', launchCode: 'PT-BR', htmlLang: 'pt-BR', intlLocale: 'pt-BR', nativeName: 'Português (Brasil)' }
]);
export const FALLBACK_LOCALE = 'en';
const byCode = new Map(SUPPORTED_LOCALES.map((locale) => [locale.code.toLowerCase(), locale]));
export function normalizeLocale(value) {
  if (typeof value !== 'string') return null;
  const exact = byCode.get(value.trim().toLowerCase());
  if (exact) return exact.code;
  const primary = value.trim().split('-')[0].toLowerCase();
  const match = SUPPORTED_LOCALES.find((locale) => locale.code.toLowerCase() === primary);
  return match?.code ?? null;
}
export function getLocaleDefinition(code) {
  const normalized = normalizeLocale(code);
  return normalized ? SUPPORTED_LOCALES.find((locale) => locale.code === normalized) ?? null : null;
}
