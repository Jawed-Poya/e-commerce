export type TenantLanguage = "en" | "dr" | "ps";

export interface TenantFontOption {
    value: string;
    label: string;
    bundled: boolean;
}

export const tenantFontOptions: Record<TenantLanguage, TenantFontOption[]> = {
    en: [
        { value: "Inter", label: "Inter · bundled", bundled: true },
        { value: "Manrope", label: "Manrope · bundled", bundled: true },
        { value: "Poppins", label: "Poppins · installed locally", bundled: false },
        { value: "Segoe UI", label: "Segoe UI · system font", bundled: false },
        { value: "Arial", label: "Arial · system font", bundled: false },
    ],
    dr: [
        { value: "Vazirmatn", label: "Vazirmatn · bundled", bundled: true },
        { value: "Noto Naskh Arabic", label: "Noto Naskh Arabic · bundled", bundled: true },
        { value: "Noto Sans Arabic", label: "Noto Sans Arabic · bundled", bundled: true },
        { value: "B Nazanin", label: "B Nazanin · installed locally", bundled: false },
        { value: "B Mitra", label: "B Mitra · installed locally", bundled: false },
        { value: "B Wahid", label: "B Wahid · installed locally", bundled: false },
        { value: "B Titr", label: "B Titr · installed locally", bundled: false },
        { value: "Tahoma", label: "Tahoma · system font", bundled: false },
    ],
    ps: [
        { value: "Noto Sans Arabic", label: "Noto Sans Arabic · bundled", bundled: true },
        { value: "Noto Naskh Arabic", label: "Noto Naskh Arabic · bundled", bundled: true },
        { value: "Vazirmatn", label: "Vazirmatn · bundled", bundled: true },
        { value: "Bahij TheSansArabic", label: "Bahij TheSansArabic · installed locally", bundled: false },
        { value: "Bahij Nassim", label: "Bahij Nassim · installed locally", bundled: false },
        { value: "Bahij Nazanin", label: "Bahij Nazanin · installed locally", bundled: false },
        { value: "Bahij Roya", label: "Bahij Roya · installed locally", bundled: false },
        { value: "Bahij SultanNahia", label: "Bahij SultanNahia · installed locally", bundled: false },
        { value: "Bahij Tanseek Pro", label: "Bahij Tanseek Pro · installed locally", bundled: false },
        { value: "Bahij Titr", label: "Bahij Titr · installed locally", bundled: false },
        { value: "Bahij Traffic", label: "Bahij Traffic · installed locally", bundled: false },
        { value: "Bahij Uthman Taha", label: "Bahij Uthman Taha · installed locally", bundled: false },
        { value: "Bahij Yakout", label: "Bahij Yakout · installed locally", bundled: false },
        { value: "Bahij Yekan", label: "Bahij Yekan · installed locally", bundled: false },
        { value: "Bahij Zar", label: "Bahij Zar · installed locally", bundled: false },
        { value: "Tahoma", label: "Tahoma · system font", bundled: false },
    ],
};

const bundledFamily: Record<string, string> = {
    Inter: '"Inter Variable"',
    Manrope: '"Manrope Variable"',
    Vazirmatn: '"Vazirmatn Variable"',
    "Noto Sans Arabic": '"Noto Sans Arabic Variable"',
    "Noto Naskh Arabic": '"Noto Naskh Arabic Variable"',
};

function quoted(value: string) {
    return `"${value.replace(/["\\]/g, "").trim()}"`;
}

export function resolveTenantFontStack(language: TenantLanguage, selected: string) {
    const chosen = bundledFamily[selected] ?? quoted(selected);
    if (language === "en")
        return `${chosen}, "Inter Variable", "Manrope Variable", "Segoe UI", Arial, sans-serif`;
    if (language === "dr")
        return `${chosen}, "Vazirmatn Variable", "Noto Naskh Arabic Variable", "Noto Sans Arabic Variable", Tahoma, Arial, sans-serif`;
    return `${chosen}, "Noto Sans Arabic Variable", "Noto Naskh Arabic Variable", "Vazirmatn Variable", Tahoma, Arial, sans-serif`;
}

export function resolveTenantHeadingStack(language: TenantLanguage, selected: string) {
    if (language === "en")
        return `"Manrope Variable", ${resolveTenantFontStack(language, selected)}`;
    if (language === "dr")
        return `"Noto Naskh Arabic Variable", ${resolveTenantFontStack(language, selected)}`;
    return `"Noto Naskh Arabic Variable", ${resolveTenantFontStack(language, selected)}`;
}
