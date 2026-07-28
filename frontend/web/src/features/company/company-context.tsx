import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";

import { useI18n } from "../../i18n/i18n-provider";
import { apiGet } from "../../shared/api/api-client";
import { configureMoney } from "../../shared/lib/money";
import { resolveCompanyFontStack, resolveCompanyHeadingStack } from "./company-fonts";

export interface CompanySettings {
    mainCurrencyCode: string;
    currencySymbol: string;
    currencyPosition: "before" | "after";
    currencyDecimalPlaces: number;
    adminPrimaryColor: string;
    adminSecondaryColor: string;
    storefrontPrimaryColor: string;
    storefrontSecondaryColor: string;
    englishFontFamily: string;
    dariFontFamily: string;
    pashtoFontFamily: string;
    baseFontSize: number;
    trashRetentionDays: number;
    notificationRetentionDays: number;
    allowUserClaimManagement: boolean;
}

export interface PublicCompanyBranch {
    id: number;
    name: string;
    code: string;
    phone: string | null;
    address: string | null;
    isMain: boolean;
    isActive: boolean;
}

export interface PublicCompanyProfile {
    id: number;
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    branches: PublicCompanyBranch[];
    settings: CompanySettings;
}

interface CompanyContextValue {
    company: PublicCompanyProfile | null;
    loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

function readableText(hex: string) {
    const value = hex.replace("#", "");
    if (value.length !== 6) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#ffffff";
}

export function CompanyProvider({ children }: PropsWithChildren) {
    const { language } = useI18n();
    const query = useQuery({
        queryKey: ["company", "public-profile"],
        queryFn: () => apiGet<PublicCompanyProfile>("/company/public-profile"),
        staleTime: 5 * 60_000,
        retry: 1,
    });
    const company = query.data ?? null;

    useEffect(() => {
        if (!company) return;
        const { settings } = company;
        const root = document.documentElement;
        root.style.setProperty("--primary", settings.storefrontPrimaryColor);
        root.style.setProperty("--primary-foreground", readableText(settings.storefrontPrimaryColor));
        root.style.setProperty("--brand-orange", settings.storefrontSecondaryColor);
        root.style.setProperty("--company-font-en", resolveCompanyFontStack("en", settings.englishFontFamily));
        root.style.setProperty("--company-font-dr", resolveCompanyFontStack("dr", settings.dariFontFamily));
        root.style.setProperty("--company-font-ps", resolveCompanyFontStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--company-heading-font-en", resolveCompanyHeadingStack("en", settings.englishFontFamily));
        root.style.setProperty("--company-heading-font-dr", resolveCompanyHeadingStack("dr", settings.dariFontFamily));
        root.style.setProperty("--company-heading-font-ps", resolveCompanyHeadingStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--company-base-font-size", `${settings.baseFontSize}px`);
        root.dataset.language = language;
        document.title = company.name;
        configureMoney(
            settings.mainCurrencyCode,
            settings.currencyDecimalPlaces,
            language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF",
        );
        if (company.faviconUrl) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) {
                link = document.createElement("link");
                link.rel = "icon";
                document.head.appendChild(link);
            }
            link.href = company.faviconUrl;
        }
    }, [company, language]);

    const value = useMemo<CompanyContextValue>(
        () => ({ company, loading: query.isLoading }),
        [company, query.isLoading],
    );

    return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
    const value = useContext(CompanyContext);
    if (!value) throw new Error("useCompany must be used inside CompanyProvider");
    return value;
}
