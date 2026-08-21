import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { setFormattingLocale } from '@/constants/theme';
import { translations } from '@/i18n/translations';

export type AppLocale = 'en' | 'ps' | 'dr';

type I18nContextValue = {
  locale: AppLocale;
  languageTag: string;
  isRtl: boolean;
  t: (value: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: AppLocale) => void;
};

const languageStorageKey = 'easycart-mobile-language';
const I18nContext = createContext<I18nContextValue | null>(null);
const languageTags: Record<AppLocale, string> = { en: 'en-US', ps: 'ps-AF', dr: 'fa-AF' };

function deviceLocale(): AppLocale {
  const language = getLocales()[0]?.languageCode?.toLowerCase();
  if (language === 'ps') return 'ps';
  if (language === 'fa' || language === 'prs') return 'dr';
  return 'en';
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(languageStorageKey).then((stored) => {
      if (active && (stored === 'en' || stored === 'ps' || stored === 'dr')) {
        setLocaleState(stored);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setFormattingLocale(languageTags[locale]);
  }, [locale]);

  const t = useCallback((value: string, params?: Record<string, string | number>) => {
    const translated = locale === 'en'
      ? value
      : (translations[locale] as Record<string, string>)[value] ?? patternTranslation(locale, value) ?? value;
    return Object.entries(params ?? {}).reduce(
      (result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)),
      translated,
    );
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(languageStorageKey, next);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    languageTag: languageTags[locale],
    isRtl: locale !== 'en',
    t,
    setLocale,
  }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider.');
  return context;
}

function patternTranslation(locale: AppLocale, value: string) {
  const patterns = locale === 'ps' ? {
    view: (name: string) => `${name} وګورئ`,
    remove: (name: string) => `${name} لرې کړئ`,
    add: (name: string) => `${name} ټوکرۍ ته زیات کړئ`,
    unavailable: (name: string) => `${name} شتون نه لري`,
  } : {
    view: (name: string) => `مشاهده ${name}`,
    remove: (name: string) => `حذف ${name}`,
    add: (name: string) => `افزودن ${name} به سبد`,
    unavailable: (name: string) => `${name} ناموجود است`,
  };
  const view = value.match(/^View (.+)$/);
  if (view) return patterns.view(view[1]);
  const remove = value.match(/^Remove (.+)$/);
  if (remove) return patterns.remove(remove[1]);
  const add = value.match(/^Add (.+) to cart$/);
  if (add) return patterns.add(add[1]);
  const unavailable = value.match(/^(.+) is unavailable$/);
  if (unavailable) return patterns.unavailable(unavailable[1]);
  return null;
}
