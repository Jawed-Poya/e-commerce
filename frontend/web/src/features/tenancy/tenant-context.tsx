import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../shared/api/api-client";
import { useI18n } from "../../i18n/i18n-provider";
import { configureMoney } from "../../shared/lib/money";
import { resolveTenantFontStack, resolveTenantHeadingStack } from "./tenant-fonts";

export interface TenantSettings {
    mainCurrencyCode: string; currencySymbol: string; currencyPosition: "before" | "after"; currencyDecimalPlaces: number;
    adminPrimaryColor: string; adminSecondaryColor: string; storefrontPrimaryColor: string; storefrontSecondaryColor: string;
    englishFontFamily: string; dariFontFamily: string; pashtoFontFamily: string; baseFontSize: number; trashRetentionDays: number; notificationRetentionDays: number; allowTenantUserClaimManagement: boolean;
}
export interface PublicTenantProfile { id: number; name: string; slug: string; logoUrl: string | null; faviconUrl: string | null; storefrontUrl: string; settings: TenantSettings }

const TenantContext = createContext<{ tenant: PublicTenantProfile | null; loading: boolean } | null>(null);

function readableText(hex: string) {
    const value = hex.replace("#", "");
    if (value.length !== 6) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "#0f172a" : "#ffffff";
}

export function TenantProvider({ children }: PropsWithChildren) {
    const { language } = useI18n();
    const query = useQuery({ queryKey: ["tenant", "public-profile"], queryFn: () => apiGet<PublicTenantProfile>("/tenant/public-profile"), staleTime: 5 * 60_000, retry: 1 });
    const tenant = query.data ?? null;
    useEffect(() => {
        if (!tenant) return;
        const { settings } = tenant;
        const root = document.documentElement;
        root.style.setProperty("--primary", settings.storefrontPrimaryColor);
        root.style.setProperty("--primary-foreground", readableText(settings.storefrontPrimaryColor));
        root.style.setProperty("--brand-orange", settings.storefrontSecondaryColor);
        root.style.setProperty("--tenant-font-en", resolveTenantFontStack("en", settings.englishFontFamily));
        root.style.setProperty("--tenant-font-dr", resolveTenantFontStack("dr", settings.dariFontFamily));
        root.style.setProperty("--tenant-font-ps", resolveTenantFontStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--tenant-heading-font-en", resolveTenantHeadingStack("en", settings.englishFontFamily));
        root.style.setProperty("--tenant-heading-font-dr", resolveTenantHeadingStack("dr", settings.dariFontFamily));
        root.style.setProperty("--tenant-heading-font-ps", resolveTenantHeadingStack("ps", settings.pashtoFontFamily));
        root.style.setProperty("--tenant-base-font-size", `${settings.baseFontSize}px`);
        root.dataset.language = language;
        document.title = tenant.name;
        configureMoney(settings.mainCurrencyCode, settings.currencyDecimalPlaces, language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF");
        if (tenant.faviconUrl) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
            link.href = tenant.faviconUrl;
        }
    }, [language, tenant]);
    const value = useMemo(() => ({ tenant, loading: query.isLoading }), [query.isLoading, tenant]);
    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
    const value = useContext(TenantContext);
    if (!value) throw new Error("useTenant must be used inside TenantProvider");
    return value;
}
