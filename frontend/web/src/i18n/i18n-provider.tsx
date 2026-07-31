import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";

import { dr } from "./locales/dr";
import { en } from "./locales/en";
import { ps } from "./locales/ps";
import type { Language, Messages } from "./types";

export type { Language } from "./types";

const languageKey = "easycart-language";
const messages: Record<Language, Messages> = { en, dr, ps };

type I18nContextValue = {
    language: Language;
    direction: "ltr" | "rtl";
    setLanguage: (language: Language) => void;
    t: (key: string, values?: Record<string, string | number>) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readLanguage(): Language {
    const value = localStorage.getItem(languageKey);
    return value === "dr" || value === "ps" || value === "en" ? value : "en";
}

export function I18nProvider({ children }: PropsWithChildren) {
    const [language, setLanguageState] = useState<Language>(readLanguage);
    const direction: I18nContextValue["direction"] =
        language === "en" ? "ltr" : "rtl";

    useEffect(() => {
        document.documentElement.lang = language === "dr" ? "fa-AF" : language;
        document.documentElement.dir = direction;
    }, [direction, language]);

    const locale = language === "dr" ? "fa-AF" : language === "ps" ? "ps-AF" : "en-US";

    const setLanguage = useCallback((next: Language) => {
        localStorage.setItem(languageKey, next);
        setLanguageState(next);
    }, []);

    const t = useCallback(
        (key: string, values?: Record<string, string | number>) => {
            let text = messages[language][key] ?? messages.en[key] ?? key;
            Object.entries(values ?? {}).forEach(([name, value]) => {
                const localizedValue =
                    typeof value === "number"
                        ? new Intl.NumberFormat(locale).format(value)
                        : value;
                text = text.replaceAll(`{${name}}`, String(localizedValue));
            });
            return text;
        },
        [language, locale],
    );

    const formatNumber = useCallback(
        (value: number, options?: Intl.NumberFormatOptions) =>
            new Intl.NumberFormat(locale, options).format(value),
        [locale],
    );

    const value = useMemo(
        () => ({ language, direction, setLanguage, t, formatNumber }),
        [direction, formatNumber, language, setLanguage, t],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const value = useContext(I18nContext);
    if (!value) throw new Error("useI18n must be used inside I18nProvider.");
    return value;
}
