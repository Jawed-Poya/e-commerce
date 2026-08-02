using ECommerce.Data;
using ECommerce.Dtos.Company;
using ECommerce.Entities.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Company;

public sealed class CompanyService(ApplicationDbContext context, ICompanyContext companyContext) : ICompanyService
{
    public async Task<PublicCompanyProfileResponse> GetPublicProfileAsync(CancellationToken cancellationToken = default)
    {
        var company = await LoadAsync(cancellationToken);
        return new PublicCompanyProfileResponse(
            company.Id,
            company.Name,
            company.LegalName,
            company.Email,
            company.Phone,
            company.Address,
            company.LogoUrl,
            company.FaviconUrl,
            company.Branches
                .Where(item => item.IsActive)
                .OrderByDescending(item => item.IsMain)
                .ThenBy(item => item.Name)
                .Select(Map)
                .ToArray(),
            Map(company.Setting ?? DefaultSettings(company.Id)));
    }

    public async Task<CompanyProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default) =>
        Map(await LoadAsync(cancellationToken));

    public async Task<CompanyProfileResponse> UpdateProfileAsync(
        UpdateCompanyProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var company = await LoadTrackedAsync(cancellationToken);

        company.Name = Required(request.Name, "Company name");
        company.LegalName = Clean(request.LegalName);
        company.RegistrationNumber = Clean(request.RegistrationNumber);
        company.Email = Clean(request.Email)?.ToLowerInvariant();
        company.Phone = Clean(request.Phone);
        company.Address = Clean(request.Address);
        company.LogoUrl = Clean(request.LogoUrl);
        company.FaviconUrl = Clean(request.FaviconUrl);
        company.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(company);
    }

    public async Task<CompanyProfileResponse> UpdateSettingsAsync(
        UpdateCompanySettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateSettings(request);
        var company = await LoadTrackedAsync(cancellationToken);
        var settings = company.Setting;
        if (settings is null)
        {
            settings = DefaultSettings(company.Id);
            company.Setting = settings;
            context.TenantSettings.Add(settings);
        }

        settings.MainCurrencyCode = Required(request.MainCurrencyCode, "Currency code").ToUpperInvariant();
        settings.CurrencySymbol = Clean(request.CurrencySymbol) ?? settings.MainCurrencyCode;
        settings.CurrencyPosition = Required(request.CurrencyPosition, "Currency position").ToLowerInvariant();
        settings.CurrencyDecimalPlaces = request.CurrencyDecimalPlaces;
        settings.AdminPrimaryColor = Required(request.AdminPrimaryColor, "Admin primary color");
        settings.AdminSecondaryColor = Required(request.AdminSecondaryColor, "Admin secondary color");
        settings.StorefrontPrimaryColor = Required(request.StorefrontPrimaryColor, "Storefront primary color");
        settings.StorefrontSecondaryColor = Required(request.StorefrontSecondaryColor, "Storefront secondary color");
        settings.EnglishFontFamily = Required(request.EnglishFontFamily, "English font");
        settings.DariFontFamily = Required(request.DariFontFamily, "Dari font");
        settings.PashtoFontFamily = Required(request.PashtoFontFamily, "Pashto font");
        settings.BaseFontSize = request.BaseFontSize;
        settings.TrashRetentionDays = request.TrashRetentionDays;
        settings.NotificationRetentionDays = request.NotificationRetentionDays;
        settings.ExpiryAlertsEnabled = request.ExpiryAlertsEnabled;
        settings.ExpiryAlertLeadDays = request.ExpiryAlertLeadDays;
        settings.ExpiryAlertSoundEnabled = request.ExpiryAlertSoundEnabled;
        settings.ExpiryAlertSound = Required(request.ExpiryAlertSound, "Expiry alert sound").ToLowerInvariant();
        settings.AllowTenantUserClaimManagement = request.AllowUserClaimManagement;
        settings.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(company);
    }


    public async Task<CompanyProfileResponse> UpdateOperationLimitsAsync(
        UpdateOperationLimitsRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateOperationLimits(request);
        var company = await LoadTrackedAsync(cancellationToken);
        var settings = company.Setting;
        if (settings is null)
        {
            settings = DefaultSettings(company.Id);
            company.Setting = settings;
            context.TenantSettings.Add(settings);
        }

        settings.MaximumPurchaseLines = request.MaximumPurchaseLines;
        settings.MaximumManualSaleLines = request.MaximumManualSaleLines;
        settings.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(company);
    }

    public async Task<CompanyBranchResponse> CreateBranchAsync(
        UpsertCompanyBranchRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateBranch(request);
        var code = request.Code.Trim().ToUpperInvariant();
        if (await context.Branches.AnyAsync(
                item => item.TenantId == companyContext.CompanyId && item.Code == code,
                cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain)
            await context.Branches
                .Where(item => item.TenantId == companyContext.CompanyId)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(item => item.IsMain, false),
                    cancellationToken);

        var branch = new Branch
        {
            TenantId = companyContext.CompanyId,
            Name = request.Name.Trim(),
            Code = code,
            Phone = Clean(request.Phone),
            Address = Clean(request.Address),
            IsMain = request.IsMain,
            IsActive = request.IsActive
        };
        context.Branches.Add(branch);
        await context.SaveChangesAsync(cancellationToken);
        return Map(branch);
    }

    public async Task<CompanyBranchResponse> UpdateBranchAsync(
        long id,
        UpsertCompanyBranchRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateBranch(request);
        var branch = await context.Branches.SingleOrDefaultAsync(
                item => item.Id == id && item.TenantId == companyContext.CompanyId,
                cancellationToken)
            ?? throw new KeyNotFoundException("Branch was not found.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await context.Branches.AnyAsync(
                item => item.TenantId == companyContext.CompanyId &&
                    item.Id != id && item.Code == code,
                cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (branch.IsMain && !request.IsActive)
            throw new ArgumentException("The main branch must remain active.");
        if (branch.IsMain && !request.IsMain)
            throw new ArgumentException("Assign another branch as main before changing the current main branch.");
        if (request.IsMain)
            await context.Branches
                .Where(item => item.TenantId == companyContext.CompanyId && item.Id != id)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(item => item.IsMain, false),
                    cancellationToken);

        branch.Name = request.Name.Trim();
        branch.Code = code;
        branch.Phone = Clean(request.Phone);
        branch.Address = Clean(request.Address);
        branch.IsMain = request.IsMain;
        branch.IsActive = request.IsActive;
        branch.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(branch);
    }

    private async Task<Tenant> LoadAsync(CancellationToken cancellationToken) =>
        await context.Tenants.AsNoTracking()
            .Include(item => item.Setting)
            .Include(item => item.Branches)
            .SingleOrDefaultAsync(item => item.Id == companyContext.CompanyId, cancellationToken)
            ?? throw new KeyNotFoundException("Company profile was not found.");

    private async Task<Tenant> LoadTrackedAsync(CancellationToken cancellationToken) =>
        await context.Tenants
            .Include(item => item.Setting)
            .Include(item => item.Branches)
            .SingleOrDefaultAsync(item => item.Id == companyContext.CompanyId, cancellationToken)
            ?? throw new KeyNotFoundException("Company profile was not found.");

    private static CompanyProfileResponse Map(Tenant company) => new(
        company.Id,
        company.Name,
        company.LegalName,
        company.RegistrationNumber,
        company.Email,
        company.Phone,
        company.Address,
        company.LogoUrl,
        company.FaviconUrl,
        company.Branches.OrderByDescending(item => item.IsMain).ThenBy(item => item.Name).Select(Map).ToArray(),
        Map(company.Setting ?? DefaultSettings(company.Id)));

    private static CompanyBranchResponse Map(Branch branch) => new(
        branch.Id, branch.Name, branch.Code, branch.Phone, branch.Address, branch.IsMain, branch.IsActive);

    private static CompanySettingsResponse Map(TenantSetting settings) => new(
        settings.MainCurrencyCode,
        settings.CurrencySymbol,
        settings.CurrencyPosition,
        settings.CurrencyDecimalPlaces,
        settings.AdminPrimaryColor,
        settings.AdminSecondaryColor,
        settings.StorefrontPrimaryColor,
        settings.StorefrontSecondaryColor,
        settings.EnglishFontFamily,
        settings.DariFontFamily,
        settings.PashtoFontFamily,
        settings.BaseFontSize,
        settings.TrashRetentionDays,
        settings.NotificationRetentionDays,
        settings.ExpiryAlertsEnabled,
        settings.ExpiryAlertLeadDays,
        settings.ExpiryAlertSoundEnabled,
        settings.ExpiryAlertSound,
        settings.MaximumPurchaseLines,
        settings.MaximumManualSaleLines,
        settings.AllowTenantUserClaimManagement);

    private static TenantSetting DefaultSettings(long companyId) => new() { TenantId = companyId };

    private static void ValidateBranch(UpsertCompanyBranchRequest request)
    {
        _ = Required(request.Name, "Branch name");
        _ = Required(request.Code, "Branch code");
        if (request.IsMain && !request.IsActive)
            throw new ArgumentException("The main branch must remain active.");
    }

    private static void ValidateSettings(UpdateCompanySettingsRequest request)
    {
        var currency = Required(request.MainCurrencyCode, "Currency code");
        if (currency.Length != 3 || !currency.All(char.IsLetter))
            throw new ArgumentException("Currency code must contain exactly three letters.");
        var currencyPosition = Required(request.CurrencyPosition, "Currency position").ToLowerInvariant();
        if (currencyPosition is not ("before" or "after"))
            throw new ArgumentException("Currency position must be before or after.");
        ValidateHexColor(request.AdminPrimaryColor, "Admin primary color");
        ValidateHexColor(request.AdminSecondaryColor, "Admin secondary color");
        ValidateHexColor(request.StorefrontPrimaryColor, "Storefront primary color");
        ValidateHexColor(request.StorefrontSecondaryColor, "Storefront secondary color");
        if (request.CurrencyDecimalPlaces is < 0 or > 4)
            throw new ArgumentException("Currency decimal places must be between 0 and 4.");
        if (request.BaseFontSize is < 12 or > 22)
            throw new ArgumentException("Base font size must be between 12 and 22.");
        if (request.TrashRetentionDays is < 1 or > 3650 || request.NotificationRetentionDays is < 1 or > 3650)
            throw new ArgumentException("Retention days must be between 1 and 3650.");
        if (request.ExpiryAlertLeadDays is < 1 or > 365)
            throw new ArgumentException("Expiry alert lead days must be between 1 and 365.");
        var expirySound = Required(request.ExpiryAlertSound, "Expiry alert sound").ToLowerInvariant();
        if (expirySound is not ("critical-pulse" or "urgent-alarm" or "warning-chime"))
            throw new ArgumentException("Expiry alert sound is not supported.");
    }


    private static void ValidateOperationLimits(UpdateOperationLimitsRequest request)
    {
        if (request.MaximumPurchaseLines is < 1 or > 500)
            throw new ArgumentException("Maximum purchase lines must be between 1 and 500.");
        if (request.MaximumManualSaleLines is < 1 or > 500)
            throw new ArgumentException("Maximum manual sale lines must be between 1 and 500.");
    }

    private static void ValidateHexColor(string? value, string name)
    {
        var color = Required(value, name);
        if (color.Length != 7 || color[0] != '#' || !color[1..].All(Uri.IsHexDigit))
            throw new ArgumentException($"{name} must use the #RRGGBB format.");
    }

    private static string Required(string? value, string name) =>
        string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required.") : value.Trim();

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
