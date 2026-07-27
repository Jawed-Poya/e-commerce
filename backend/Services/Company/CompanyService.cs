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
            company.LogoUrl,
            company.FaviconUrl,
            Map(company.Setting ?? DefaultSettings(company.Id)));
    }

    public async Task<CompanyProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default) =>
        Map(await LoadAsync(cancellationToken));

    public async Task<CompanyProfileResponse> UpdateProfileAsync(
        UpdateCompanyProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var company = await context.Tenants.SingleOrDefaultAsync(item => item.Id == companyContext.CompanyId, cancellationToken)
            ?? throw new KeyNotFoundException("Company profile was not found.");

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
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<CompanyProfileResponse> UpdateSettingsAsync(
        UpdateCompanySettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateSettings(request);
        var settings = await context.TenantSettings.SingleOrDefaultAsync(
            item => item.TenantId == companyContext.CompanyId,
            cancellationToken);
        if (settings is null)
        {
            settings = DefaultSettings(companyContext.CompanyId);
            context.TenantSettings.Add(settings);
        }

        settings.MainCurrencyCode = request.MainCurrencyCode.Trim().ToUpperInvariant();
        settings.CurrencySymbol = request.CurrencySymbol.Trim();
        settings.CurrencyPosition = request.CurrencyPosition.Trim().ToLowerInvariant();
        settings.CurrencyDecimalPlaces = request.CurrencyDecimalPlaces;
        settings.AdminPrimaryColor = request.AdminPrimaryColor.Trim();
        settings.AdminSecondaryColor = request.AdminSecondaryColor.Trim();
        settings.StorefrontPrimaryColor = request.StorefrontPrimaryColor.Trim();
        settings.StorefrontSecondaryColor = request.StorefrontSecondaryColor.Trim();
        settings.EnglishFontFamily = Required(request.EnglishFontFamily, "English font");
        settings.DariFontFamily = Required(request.DariFontFamily, "Dari font");
        settings.PashtoFontFamily = Required(request.PashtoFontFamily, "Pashto font");
        settings.BaseFontSize = request.BaseFontSize;
        settings.TrashRetentionDays = request.TrashRetentionDays;
        settings.NotificationRetentionDays = request.NotificationRetentionDays;
        settings.AllowTenantUserClaimManagement = request.AllowUserClaimManagement;
        settings.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<CompanyBranchResponse> CreateBranchAsync(
        UpsertCompanyBranchRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateBranch(request);
        var code = request.Code.Trim().ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain)
            await context.Branches.ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsMain, false), cancellationToken);

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
        var branch = await context.Branches.SingleOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Branch was not found.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.Id != id && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (branch.IsMain && !request.IsActive)
            throw new ArgumentException("The main branch must remain active.");
        if (branch.IsMain && !request.IsMain)
            throw new ArgumentException("Assign another branch as main before changing the current main branch.");
        if (request.IsMain)
            await context.Branches.Where(item => item.Id != id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsMain, false), cancellationToken);

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
