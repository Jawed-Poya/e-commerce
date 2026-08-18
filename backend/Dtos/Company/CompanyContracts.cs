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
    IReadOnlyCollection<decimal> DefaultQuickOrderQuantities,
    int TrashRetentionDays,
    int NotificationRetentionDays,
    bool ExpiryAlertsEnabled,
    IReadOnlyCollection<int> ExpiryAlertPeriods,
    bool ExpiryAlertSoundEnabled,
    string ExpiryAlertSound,
    int MaximumPurchaseLines,
    int MaximumManualSaleLines,
    decimal GeneralSalesDiscountPercent,
    decimal MaximumCustomerDebt,
    int DefaultDebtDueDays,
    bool AllowNegativeStockSales,
    string PurchaseNumberPrefix,
    long NextPurchaseNumber,
    int PurchaseNumberIncrement,
    string SaleNumberPrefix,
    long NextSaleNumber,
    int SaleNumberIncrement,
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
    string? LegalName,
    string? Email,
    string? Phone,
    string? Address,
    string? LogoUrl,
    string? FaviconUrl,
    IReadOnlyCollection<CompanyBranchResponse> Branches,
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
    IReadOnlyCollection<decimal>? DefaultQuickOrderQuantities,
    int TrashRetentionDays,
    int NotificationRetentionDays,
    bool AllowUserClaimManagement,
    bool ExpiryAlertsEnabled = true,
    IReadOnlyCollection<int>? ExpiryAlertPeriods = null,
    bool ExpiryAlertSoundEnabled = true,
    string ExpiryAlertSound = "critical-pulse",
    decimal GeneralSalesDiscountPercent = 0,
    decimal MaximumCustomerDebt = 300000,
    int DefaultDebtDueDays = 30,
    bool AllowNegativeStockSales = false,
    string PurchaseNumberPrefix = "PUR",
    long NextPurchaseNumber = 1,
    int PurchaseNumberIncrement = 1,
    string SaleNumberPrefix = "SAL",
    long NextSaleNumber = 1,
    int SaleNumberIncrement = 1);

public sealed record UpdateOperationLimitsRequest(
    int MaximumPurchaseLines,
    int MaximumManualSaleLines);

public sealed record UpsertCompanyBranchRequest(
    string Name,
    string Code,
    string? Phone,
    string? Address,
    bool IsMain,
    bool IsActive);
