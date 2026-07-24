import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/i18n-provider";
import { tenantService } from "./tenant-service";
import type { PublicTenantProfile } from "./tenant-types";
import { resolveTenantFontStack, resolveTenantHeadingStack } from "./tenant-fonts";

interface TenantContextValue {
    tenant: PublicTenantProfile | null;
    loading: boolean;
    formatMoney: (amount: number, currency?: string) => string;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readableText(hex: string) {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#ffffff";
}

export function TenantProvider({ children }: PropsWithChildren) {
    const { language } = useI18n();
    const query = useQuery({ queryKey: ["tenant", "public-profile"], queryFn: tenantService.publicProfile, staleTime: 5 * 60_000, retry: 1 });
    const tenant = query.data ?? null;

    useEffect(() => {
        if (!tenant) return;
        const root = document.documentElement;
        const settings = tenant.settings;
        root.style.setProperty("--primary", settings.adminPrimaryColor);
        root.style.setProperty("--primary-foreground", readableText(settings.adminPrimaryColor));
        root.style.setProperty("--tenant-secondary", settings.adminSecondaryColor);
        root.style.setProperty("--tenant-font-en", resolveTenantFontStack("en", settings.englishFontFamily));
        root.style.setProperty("--tenant-font-dr", resolveTenantFontStack("dr", settings.dariFontFamily));
        root.style.setProperty("--tenant-font-ps", resolveTenantFontStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--tenant-heading-font-en", resolveTenantHeadingStack("en", settings.englishFontFamily));
        root.style.setProperty("--tenant-heading-font-dr", resolveTenantHeadingStack("dr", settings.dariFontFamily));
        root.style.setProperty("--tenant-heading-font-ps", resolveTenantHeadingStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--tenant-base-font-size", `${settings.baseFontSize}px`);
        document.title = `${tenant.name} · Admin`;
        if (tenant.faviconUrl) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
            link.href = tenant.faviconUrl;
        }
    }, [tenant]);

    useEffect(() => {
        document.documentElement.dataset.language = language;
    }, [language]);

    const value = useMemo<TenantContextValue>(() => ({
        tenant,
        loading: query.isLoading,
        formatMoney(amount, currency) {
            const settings = tenant?.settings;
            const code = currency || settings?.mainCurrencyCode || "USD";
            try {
                return new Intl.NumberFormat(language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF", {
                    style: "currency", currency: code, minimumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
                    maximumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
                }).format(amount);
            } catch {
                const value = amount.toFixed(settings?.currencyDecimalPlaces ?? 2);
                const symbol = settings?.currencySymbol || code;
                return settings?.currencyPosition === "after" ? `${value} ${symbol}` : `${symbol}${value}`;
            }
        },
    }), [language, query.isLoading, tenant]);

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
    const value = useContext(TenantContext);
    if (!value) throw new Error("useTenant must be used inside TenantProvider");
    return value;
}
