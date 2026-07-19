import { apiGet } from "../../shared/api/api-client";
import type { Language } from "../../i18n/i18n-provider";

export interface LocalizedHeroContent {
    eyebrow: string;
    title: string;
    description: string;
    primaryButtonText: string;
    secondaryButtonText: string;
}

export interface StorefrontContent {
    heroImageUrl: string | null;
    primaryButtonUrl: string;
    secondaryButtonUrl: string;
    en: LocalizedHeroContent;
    ps: LocalizedHeroContent;
    dr: LocalizedHeroContent;
    updatedAt: string | null;
}

export const getStorefrontContent = () =>
    apiGet<StorefrontContent>("/storefront/content");

export function localizedHero(content: StorefrontContent, language: Language) {
    return content[language] ?? content.en;
}
