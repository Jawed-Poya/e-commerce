using ECommerce.Entities.Tenancy;

namespace ECommerce.Dtos.Tenancy;

public sealed record TenantSummaryResponse(long Id, string Name, string Slug, bool IsActive, string? LogoUrl);
public sealed record BranchResponse(long Id, string Name, string Code, string? Phone, string? Address, bool IsMain, bool IsActive);
public sealed record TenantSubscriptionResponse(long Id, TenantPlan Plan, SubscriptionStatus Status, DateTime StartsAt, DateTime? EndsAt, int MaxUsers, int MaxBranches, int MaxProducts, decimal MonthlyPrice, string BillingCurrencyCode);
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
    IReadOnlyCollection<BranchResponse> Branches,
    TenantSubscriptionResponse? Subscription,
    TenantSettingsResponse Settings,
    IReadOnlyCollection<string> EnabledPermissions);
public sealed record UpdateTenantProfileRequest(string Name, string? LegalName, string? RegistrationNumber, string? Email, string? Phone, string? Address, string? LogoUrl, string? FaviconUrl);
public sealed record UpdateTenantSettingsRequest(string MainCurrencyCode, string CurrencySymbol, string CurrencyPosition, int CurrencyDecimalPlaces, string AdminPrimaryColor, string AdminSecondaryColor, string StorefrontPrimaryColor, string StorefrontSecondaryColor, string EnglishFontFamily, string DariFontFamily, string PashtoFontFamily, int BaseFontSize, int TrashRetentionDays, bool AllowTenantUserClaimManagement);
public sealed record UpsertBranchRequest(string Name, string Code, string? Phone, string? Address, bool IsMain, bool IsActive);
public sealed record CreateTenantRequest(string Name, string Slug, string AdminFullName, string AdminEmail, string AdminPassword, TenantPlan Plan, string MainCurrencyCode);
public sealed record PublicTenantProfileResponse(long Id, string Name, string Slug, string? LogoUrl, string? FaviconUrl, TenantSettingsResponse Settings);
