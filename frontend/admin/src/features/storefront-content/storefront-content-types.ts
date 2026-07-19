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

export type UpdateStorefrontContentRequest = Omit<StorefrontContent, "updatedAt">;
