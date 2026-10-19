import { useMemo, useSyncExternalStore } from "react";
import { I18nManager } from "react-native";
import { en, PluralKey, TranslationKey } from "./en";
import { ptBR } from "./pt-BR";

export type { PluralKey, TranslationKey } from "./en";

export type Language = "en" | "pt-BR";

/** Shown in the language selector, always in the language itself. */
export const LANGUAGES: readonly { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt-BR", label: "Português (Brasil)" },
];

export const DEFAULT_LANGUAGE: Language = "en";

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  en,
  "pt-BR": ptBR,
};

export type TranslationParams = Record<string, string | number>;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt-BR";
}

/** True when `key` exists; used for keys built at run time (fault codes). */
export function hasTranslation(key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/** Looks `key` up in `language`, falling back to English, then to the key itself. */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = DICTIONARIES[language][key] ?? en[key] ?? key;
  return interpolate(template, params);
}

/** Message that counts something: picks `<key>_one` or `<key>_other`; `{count}` is filled in. */
export function translatePlural(
  language: Language,
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  const form = count === 1 ? "one" : "other";
  return translate(language, `${key}_${form}` as TranslationKey, { ...params, count });
}

/**
 * Which language the phone uses: Portuguese (any region) gives pt-BR, anything
 * else gives English. `tag` is a BCP 47 / POSIX locale such as "pt-BR",
 * "pt_BR" or "en-US"; leave it out to read the device.
 */
export function detectDeviceLanguage(tag: string = deviceLocaleTag()): Language {
  return /^pt([-_]|$)/i.test(tag.trim()) ? "pt-BR" : DEFAULT_LANGUAGE;
}

function deviceLocaleTag(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) return locale;
  } catch {
    // Intl may be unavailable; fall through to the native constant.
  }
  try {
    const constants = I18nManager.getConstants() as { localeIdentifier?: string };
    if (constants.localeIdentifier) return constants.localeIdentifier;
  } catch {
    // No locale information: English.
  }
  return "";
}

// ---- current language (module state, observable) --------------------------

/**
 * Where the choice could be remembered between launches. The app has no
 * storage library yet, so by default the choice lives until the app closes
 * (see `configureLanguageStorage`).
 */
export type LanguageStorage = {
  load: () => Promise<string | null | undefined>;
  save: (language: Language) => Promise<void> | void;
};

let current: Language = DEFAULT_LANGUAGE;
let storage: LanguageStorage | null = null;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function apply(language: Language): boolean {
  if (language === current) return false;
  current = language;
  listeners.forEach((listener) => listener());
  return true;
}

/** Changes the language everywhere and remembers it when storage is configured. */
export function setLanguage(language: Language): void {
  apply(language);
  if (storage) {
    try {
      void Promise.resolve(storage.save(language)).catch(() => {});
    } catch {
      // A failing store must never break the UI.
    }
  }
}

/**
 * Picks the starting language from the phone. Call once, before the first
 * screen renders. Returns the language chosen.
 */
export function initLanguage(deviceTag?: string): Language {
  apply(detectDeviceLanguage(deviceTag));
  return current;
}

/**
 * Remembers the language choice between launches: pass anything with
 * `load` and `save` (an AsyncStorage wrapper, for instance). A saved choice
 * overrides the phone's language once it has loaded.
 */
export function configureLanguageStorage(adapter: LanguageStorage | null): Promise<void> {
  storage = adapter;
  if (!adapter) return Promise.resolve();
  return Promise.resolve()
    .then(() => adapter.load())
    .then((saved) => {
      if (isLanguage(saved)) apply(saved);
    })
    .catch(() => {});
}

/** For tests: back to English, no storage, no listeners kept by hooks. */
export function resetLanguageForTests(): void {
  storage = null;
  apply(DEFAULT_LANGUAGE);
}

// ---- use ------------------------------------------------------------------

/** Translates with the language in use right now. For code outside React. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(current, key, params);
}

/** Plural version of `t`, outside React. */
export function tp(key: PluralKey, count: number, params?: TranslationParams): string {
  return translatePlural(current, key, count, params);
}

/**
 * Language and translators for a component. The component re-renders when the
 * language changes, so every string it builds from `t` follows along.
 */
export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return useMemo(
    () => ({
      language,
      t: (key: TranslationKey, params?: TranslationParams) => translate(language, key, params),
      tp: (key: PluralKey, count: number, params?: TranslationParams) =>
        translatePlural(language, key, count, params),
      setLanguage,
    }),
    [language],
  );
}
