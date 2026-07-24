import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";

import { literalTranslations } from "./literal-translations";
import { en } from "./locales/en";
import { dr } from "./locales/dr";
import { ps } from "./locales/ps";

export type Language = "en" | "ps" | "dr";
type TranslationKey = keyof typeof en;
type TranslationResources = Record<TranslationKey, string>;

const resources: Record<Language, TranslationResources> = { en, ps, dr };
const englishValueToKey = new Map<string, TranslationKey>();
const translatedValueToEnglish = new Map<string, string>();

for (const [key, english] of Object.entries(en) as [TranslationKey, string][]) {
    if (!englishValueToKey.has(english)) englishValueToKey.set(english, key);
    translatedValueToEnglish.set(english, english);
    translatedValueToEnglish.set(dr[key], english);
    translatedValueToEnglish.set(ps[key], english);
}
for (const language of ["dr", "ps"] as const) {
    for (const [english, translated] of Object.entries(literalTranslations[language])) {
        translatedValueToEnglish.set(english, english);
        translatedValueToEnglish.set(translated, english);
    }
}

export function translateLiteral(text: string, language: Language): string {
    const canonical = translatedValueToEnglish.get(text) ?? text;
    if (language === "en") return canonical;

    const literal = literalTranslations[language][canonical];
    if (literal) return literal;

    const key = englishValueToKey.get(canonical);
    return key ? resources[language][key] ?? canonical : canonical;
}

interface I18nContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: TranslationKey) => string;
    tr: (text: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem("language") as Language | null;
        return saved === "dr" || saved === "ps" || saved === "en" ? saved : "en";
    });

    useEffect(() => {
        localStorage.setItem("language", language);
        document.documentElement.lang = language;
        document.documentElement.dir = language === "en" ? "ltr" : "rtl";
    }, [language]);

    // This bridge localizes older admin surfaces that still contain literal UI
    // text. New code should continue using t(...). The observer also covers
    // portals such as dialogs and Sonner notifications.
    useEffect(() => {
        const translatableAttributes = ["placeholder", "title", "aria-label", "alt"];
        let applying = false;

        const translateElement = (element: Element) => {
            if (element.closest("[data-no-auto-translate], pre, code, script, style")) return;
            for (const attribute of translatableAttributes) {
                const current = element.getAttribute(attribute);
                if (!current) continue;
                const translated = translateLiteral(current.trim(), language);
                if (translated !== current.trim()) element.setAttribute(attribute, translated);
            }
        };

        const translateNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const parent = node.parentElement;
                if (!parent || parent.closest("[data-no-auto-translate], pre, code, script, style")) return;
                const current = node.textContent ?? "";
                const trimmed = current.trim();
                if (!trimmed) return;
                const translated = translateLiteral(trimmed, language);
                if (translated !== trimmed) node.textContent = current.replace(trimmed, translated);
                return;
            }
            if (!(node instanceof Element)) return;
            translateElement(node);
            const walker = document.createTreeWalker(
                node,
                NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            );
            let current: Node | null;
            while ((current = walker.nextNode())) {
                if (current instanceof Element) translateElement(current);
                else translateNode(current);
            }
        };

        const apply = () => {
            if (applying) return;
            applying = true;
            try {
                translateNode(document.body);
            } finally {
                applying = false;
            }
        };

        apply();
        const observer = new MutationObserver((mutations) => {
            if (applying) return;
            for (const mutation of mutations) {
                if (mutation.type === "characterData") translateNode(mutation.target);
                for (const node of mutation.addedNodes) translateNode(node);
                if (mutation.type === "attributes" && mutation.target instanceof Element) {
                    translateElement(mutation.target);
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: translatableAttributes,
        });
        return () => observer.disconnect();
    }, [language]);

    const value = useMemo<I18nContextValue>(
        () => ({
            language,
            setLanguage,
            t: (key) => resources[language][key] ?? en[key],
            tr: (text) => translateLiteral(text, language),
        }),
        [language],
    );
    const direction = language === "en" ? "ltr" : "rtl";

    return (
        <I18nContext.Provider value={value}>
            <DirectionProvider direction={direction}>{children}</DirectionProvider>
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const value = useContext(I18nContext);
    if (!value) throw new Error("useI18n must be used inside I18nProvider");
    return value;
}
