namespace ECommerce.Dtos.Company;

public sealed record CompanySettingsResponse(
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
    bool AllowUserClaimManagement);

public sealed record CompanyBranchResponse(
    long Id,
    string Name,
    string Code,
    string? Phone,
    string? Address,
    bool IsMain,
    bool IsActive);

public sealed record CompanyProfileResponse(
    long Id,
    string Name,
    string? LegalName,
    string? RegistrationNumber,
    string? Email,
    string? Phone,
    string? Address,
    string? LogoUrl,
    string? FaviconUrl,
    IReadOnlyCollection<CompanyBranchResponse> Branches,
    CompanySettingsResponse Settings);

public sealed record PublicCompanyProfileResponse(
    long Id,
    string Name,
    string? LogoUrl,
    string? FaviconUrl,
    CompanySettingsResponse Settings);

public sealed record UpdateCompanyProfileRequest(
    string Name,
    string? LegalName,
    string? RegistrationNumber,
    string? Email,
    string? Phone,
    string? Address,
    string? LogoUrl,
    string? FaviconUrl);

public sealed record UpdateCompanySettingsRequest(
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
    bool AllowUserClaimManagement);

public sealed record UpsertCompanyBranchRequest(
    string Name,
    string Code,
    string? Phone,
    string? Address,
    bool IsMain,
    bool IsActive);
