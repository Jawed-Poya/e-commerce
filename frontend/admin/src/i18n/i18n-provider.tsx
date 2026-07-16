import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./locales/en";
import { ps } from "./locales/ps";
import { dr } from "./locales/dr";
import { DirectionProvider } from "@base-ui/react/direction-provider";

export type Language = "en" | "ps" | "dr";
type TranslationKey = keyof typeof en;
const resources: Record<Language, Record<TranslationKey, string>> = { en, ps, dr };
const I18nContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("language") as Language) || "en");
  useEffect(() => { localStorage.setItem("language", language); document.documentElement.lang = language; document.documentElement.dir = language === "en" ? "ltr" : "rtl"; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => resources[language][key] ?? en[key] }), [language]);
  const direction = language === "en" ? "ltr" : "rtl";
  return <I18nContext.Provider value={value}><DirectionProvider direction={direction}>{children}</DirectionProvider></I18nContext.Provider>;
}

export function useI18n() { const value = useContext(I18nContext); if (!value) throw new Error("useI18n must be used inside I18nProvider"); return value; }
