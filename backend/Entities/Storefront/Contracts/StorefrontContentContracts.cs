namespace ECommerce.Entities.Storefront.Contracts;

public sealed record LocalizedHeroContent(
    string Eyebrow,
    string Title,
    string Description,
    string PrimaryButtonText,
    string SecondaryButtonText);

public sealed record StorefrontContentResponse(
    string? HeroImageUrl,
    string PrimaryButtonUrl,
    string SecondaryButtonUrl,
    LocalizedHeroContent En,
    LocalizedHeroContent Ps,
    LocalizedHeroContent Dr,
    DateTime? UpdatedAt);

public sealed record UpdateStorefrontContentRequest(
    string? HeroImageUrl,
    string PrimaryButtonUrl,
    string SecondaryButtonUrl,
    LocalizedHeroContent En,
    LocalizedHeroContent Ps,
    LocalizedHeroContent Dr);
