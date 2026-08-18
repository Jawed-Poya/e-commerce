import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { companyService, resolveCompanyAssetUrl } from "./company-service";
import { apiBaseUrl } from "@/api/axios";
import type { PublicCompanyProfile } from "./company-types";
import { useI18n } from "@/i18n/i18n-provider";
import { resolveCompanyFontStack, resolveCompanyHeadingStack } from "@/features/company/company-fonts";
import { toFiniteNumber } from "@/lib/numbers";

interface CompanyContextValue {
    company: PublicCompanyProfile | null;
    loading: boolean;
    formatMoney: (amount: unknown, currency?: string) => string;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

function readableText(hex: string) {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#ffffff";
}

export function CompanyProvider({ children }: PropsWithChildren) {
    const { language } = useI18n();
    const query = useQuery({
        queryKey: ["company", "public-profile"],
        queryFn: companyService.publicProfile,
        staleTime: 5 * 60_000,
        retry: 1,
    });
    const company = query.data ?? null;

    useEffect(() => {
        if (!company) return;
        const root = document.documentElement;
        const settings = company.settings;
        root.style.setProperty("--primary", settings.adminPrimaryColor);
        root.style.setProperty("--primary-foreground", readableText(settings.adminPrimaryColor));
        root.style.setProperty("--company-secondary", settings.adminSecondaryColor);
        root.style.setProperty("--company-font-en", resolveCompanyFontStack("en", settings.englishFontFamily));
        root.style.setProperty("--company-font-dr", resolveCompanyFontStack("dr", settings.dariFontFamily));
        root.style.setProperty("--company-font-ps", resolveCompanyFontStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--company-heading-font-en", resolveCompanyHeadingStack("en", settings.englishFontFamily));
        root.style.setProperty("--company-heading-font-dr", resolveCompanyHeadingStack("dr", settings.dariFontFamily));
        root.style.setProperty("--company-heading-font-ps", resolveCompanyHeadingStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--company-base-font-size", `${settings.baseFontSize}px`);
        document.title = `${company.name} · Admin`;
        const favicon = resolveCompanyAssetUrl(company.faviconUrl);
        const logo = resolveCompanyAssetUrl(company.logoUrl);
        if (favicon) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) {
                link = document.createElement("link");
                link.rel = "icon";
                document.head.appendChild(link);
            }
            link.href = favicon;
        }
        const touchIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
        if (touchIcon && (favicon || logo)) touchIcon.href = favicon || logo || touchIcon.href;
        const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (manifest) {
            manifest.href = `${apiBaseUrl}/company/manifest.webmanifest?app=admin`;
            manifest.crossOrigin = "anonymous";
        }
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
            ?.setAttribute("content", settings.adminPrimaryColor);
    }, [company]);

    const value = useMemo<CompanyContextValue>(() => ({
        company,
        loading: query.isLoading,
        formatMoney(amount, currency) {
            const settings = company?.settings;
            const code = currency || settings?.mainCurrencyCode || "USD";
            const safeAmount = toFiniteNumber(amount);
            try {
                return new Intl.NumberFormat(language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF", {
                    style: "currency",
                    currency: code,
                    minimumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
                    maximumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
                }).format(safeAmount);
            } catch {
                const formatted = safeAmount.toFixed(settings?.currencyDecimalPlaces ?? 2);
                const symbol = settings?.currencySymbol || code;
                return settings?.currencyPosition === "after" ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
            }
        },
    }), [company, language, query.isLoading]);

    return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
    const value = useContext(CompanyContext);
    if (!value) throw new Error("useCompany must be used inside CompanyProvider");
    return value;
}
