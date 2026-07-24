using ECommerce.Entities.Tenancy;

namespace ECommerce.Dtos.Tenancy;

public sealed record TenantSummaryResponse(long Id, string Name, string Slug, bool IsActive, string? LogoUrl);
public sealed record BranchResponse(long Id, string Name, string Code, string? Phone, string? Address, bool IsMain, bool IsActive);

public sealed record TenantSiteLinkResponse(
    TenantSiteRoutingMode RoutingMode,
    StorefrontAccessMode AccessMode,
    bool IsPublished,
    string StorefrontKey,
    string? StorefrontUrl,
    string AdminUrl,
    string WorkspaceCode,
    string? CustomDomain,
    string? StorefrontBaseUrlOverride);

public sealed record StorefrontPreviewLinkResponse(string Url, DateTime ExpiresAt);
public sealed record UpdateTenantStorefrontRequest(bool IsPublished, StorefrontAccessMode AccessMode);


public sealed record TenantSubscriptionResponse(
    long Id,
    long? SubscriptionPlanId,
    string PlanName,
    TenantPlan Plan,
    SubscriptionStatus Status,
    DateTime StartsAt,
    DateTime? EndsAt,
    int MaxUsers,
    int MaxBranches,
    int MaxProducts,
    int MaxOrdersPerMonth,
    int MaxStorageMb,
    decimal MonthlyPrice,
    string BillingCurrencyCode,
    string? Notes);

public sealed record TenantSettingsResponse(
    string MainCurrencyCode,
    string CurrencySymbol,
    string CurrencyPosition,
    int CurrencyDecimalPlaces,
    string AdminPrimaryColor,
    string AdminSecondaryColor,
    string StorefrontPrimaryColor,
    string StorefrontSecondaryColor,
    string EnglishFontFamily,
    string DariFontFamily,
    string PashtoFontFamily,
    int BaseFontSize,
    int TrashRetentionDays,
    int NotificationRetentionDays,
    bool AllowTenantUserClaimManagement);

public sealed record TenantProfileResponse(
    long Id,
    string Name,
    string Slug,
    string? LegalName,
    string? RegistrationNumber,
    string? Email,
    string? Phone,
    string? Address,
    string? LogoUrl,
    string? FaviconUrl,
    TenantSiteLinkResponse Site,
    IReadOnlyCollection<BranchResponse> Branches,
    TenantSubscriptionResponse? Subscription,
    TenantSettingsResponse Settings,
    IReadOnlyCollection<string> EnabledPermissions);

public sealed record UpdateTenantProfileRequest(string Name, string? LegalName, string? RegistrationNumber, string? Email, string? Phone, string? Address, string? LogoUrl, string? FaviconUrl);
public sealed record UpdateTenantSettingsRequest(string MainCurrencyCode, string CurrencySymbol, string CurrencyPosition, int CurrencyDecimalPlaces, string AdminPrimaryColor, string AdminSecondaryColor, string StorefrontPrimaryColor, string StorefrontSecondaryColor, string EnglishFontFamily, string DariFontFamily, string PashtoFontFamily, int BaseFontSize, int TrashRetentionDays, int NotificationRetentionDays, bool AllowTenantUserClaimManagement);
public sealed record UpsertBranchRequest(string Name, string Code, string? Phone, string? Address, bool IsMain, bool IsActive);

public sealed record PlatformUpdateTenantRequest(
    string Name,
    string Slug,
    string? LegalName,
    string? RegistrationNumber,
    string? Email,
    string? Phone,
    string? Address,
    string? LogoUrl,
    string? FaviconUrl,
    TenantSiteRoutingMode SiteRoutingMode,
    StorefrontAccessMode StorefrontAccessMode,
    bool IsStorefrontPublished,
    string? CustomDomain,
    string? StorefrontBaseUrlOverride,
    UpdateTenantSettingsRequest Settings,
    IReadOnlyCollection<string> EnabledPermissions);

public sealed record CreateTenantRequest(
    string Name,
    string Slug,
    string AdminFullName,
    string AdminEmail,
    string AdminPassword,
    long? SubscriptionPlanId,
    TenantPlan? Plan,
    string MainCurrencyCode,
    TenantSiteRoutingMode? SiteRoutingMode,
    StorefrontAccessMode? StorefrontAccessMode,
    bool? IsStorefrontPublished,
    string? CustomDomain,
    string? StorefrontBaseUrlOverride,
    int? MaxUsers,
    int? MaxBranches,
    int? MaxProducts,
    int? MaxOrdersPerMonth,
    int? MaxStorageMb,
    decimal? MonthlyPrice);

public sealed record UpdateTenantSubscriptionRequest(
    long? SubscriptionPlanId,
    TenantPlan? Plan,
    SubscriptionStatus Status,
    DateTime? EndsAt,
    int? MaxUsers,
    int? MaxBranches,
    int? MaxProducts,
    int? MaxOrdersPerMonth,
    int? MaxStorageMb,
    decimal? MonthlyPrice,
    string? BillingCurrencyCode,
    string? Notes);

public sealed record PublicTenantProfileResponse(
    long Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? FaviconUrl,
    string? StorefrontUrl,
    TenantSettingsResponse Settings);

public sealed record PlatformSettingsResponse(
    string StorefrontBaseUrl,
    string AdminBaseUrl,
    string? RootDomain,
    TenantSiteRoutingMode DefaultRoutingMode,
    bool AllowCustomDomains);

public sealed record UpdatePlatformSettingsRequest(
    string StorefrontBaseUrl,
    string AdminBaseUrl,
    string? RootDomain,
    TenantSiteRoutingMode DefaultRoutingMode,
    bool AllowCustomDomains);

public sealed record SubscriptionPlanResponse(
    long Id,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    bool IsActive,
    int SortOrder,
    TenantPlan LegacyPlan,
    decimal MonthlyPrice,
    decimal YearlyPrice,
    string CurrencyCode,
    int MaxUsers,
    int MaxBranches,
    int MaxProducts,
    int MaxOrdersPerMonth,
    int MaxStorageMb,
    IReadOnlyCollection<string> EnabledPermissions);

public sealed record UpsertSubscriptionPlanRequest(
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    int SortOrder,
    TenantPlan LegacyPlan,
    decimal MonthlyPrice,
    decimal YearlyPrice,
    string CurrencyCode,
    int MaxUsers,
    int MaxBranches,
    int MaxProducts,
    int MaxOrdersPerMonth,
    int MaxStorageMb,
    IReadOnlyCollection<string> EnabledPermissions);
