using ECommerce.Data;
using ECommerce.Dtos.Tenancy;
using ECommerce.Entities.Tenancy;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public interface IPlatformManagementService
{
    Task<PlatformSettingsResponse> GetSettingsAsync(CancellationToken cancellationToken = default);
    Task<PlatformSettingsResponse> UpdateSettingsAsync(UpdatePlatformSettingsRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<SubscriptionPlanResponse>> GetPlansAsync(bool includeInactive = true, CancellationToken cancellationToken = default);
    Task<SubscriptionPlanResponse> CreatePlanAsync(UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken = default);
    Task<SubscriptionPlanResponse> UpdatePlanAsync(long id, UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken = default);
    Task ArchivePlanAsync(long id, CancellationToken cancellationToken = default);
}

public sealed class PlatformManagementService(
    ApplicationDbContext context,
    ITenantContext tenantContext) : IPlatformManagementService
{
    public async Task<PlatformSettingsResponse> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        return Map(await GetOrCreateSettingsAsync(cancellationToken));
    }

    public async Task<PlatformSettingsResponse> UpdateSettingsAsync(UpdatePlatformSettingsRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        settings.StorefrontBaseUrl = TenantSiteUrlBuilder.NormalizeBaseUrl(request.StorefrontBaseUrl, "Storefront base URL");
        settings.AdminBaseUrl = TenantSiteUrlBuilder.NormalizeBaseUrl(request.AdminBaseUrl, "Admin base URL");
        settings.RootDomain = TenantSiteUrlBuilder.NormalizeDomain(request.RootDomain);
        settings.DefaultRoutingMode = request.DefaultRoutingMode;
        settings.AllowCustomDomains = request.AllowCustomDomains;
        if (settings.DefaultRoutingMode == TenantSiteRoutingMode.Subdomain && settings.RootDomain is null)
            throw new ArgumentException("Root domain is required when subdomain routing is the default.");
        if (settings.DefaultRoutingMode == TenantSiteRoutingMode.CustomDomain && !settings.AllowCustomDomains)
            throw new ArgumentException("Custom domains must be enabled when custom-domain routing is the default.");
        settings.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(settings);
    }

    public async Task<IReadOnlyCollection<SubscriptionPlanResponse>> GetPlansAsync(bool includeInactive = true, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var query = context.SubscriptionPlans.AsNoTracking().Include(item => item.Permissions).AsQueryable();
        if (!includeInactive) query = query.Where(item => item.IsActive);
        return (await query.OrderBy(item => item.SortOrder).ThenBy(item => item.Name).ToListAsync(cancellationToken)).Select(Map).ToArray();
    }

    public async Task<SubscriptionPlanResponse> CreatePlanAsync(UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        ValidatePlan(request);
        var code = NormalizeCode(request.Code);
        if (await context.SubscriptionPlans.AnyAsync(item => item.Code == code, cancellationToken))
            throw new InvalidOperationException("A subscription plan with this code already exists.");
        var plan = new SubscriptionPlan { Code = code, IsSystem = false, CreatedAt = DateTime.UtcNow };
        ApplyPlan(plan, request);
        context.SubscriptionPlans.Add(plan);
        await context.SaveChangesAsync(cancellationToken);
        await ReplacePermissionsAsync(plan.Id, request.EnabledPermissions, cancellationToken);
        return Map(await LoadPlanAsync(plan.Id, cancellationToken));
    }

    public async Task<SubscriptionPlanResponse> UpdatePlanAsync(long id, UpsertSubscriptionPlanRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        ValidatePlan(request);
        var plan = await context.SubscriptionPlans.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Subscription plan not found.");
        var code = NormalizeCode(request.Code);
        if (await context.SubscriptionPlans.AnyAsync(item => item.Id != id && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A subscription plan with this code already exists.");
        if (!plan.IsSystem) plan.Code = code;
        ApplyPlan(plan, request);
        plan.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        await ReplacePermissionsAsync(id, request.EnabledPermissions, cancellationToken);
        return Map(await LoadPlanAsync(id, cancellationToken));
    }

    public async Task ArchivePlanAsync(long id, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var plan = await context.SubscriptionPlans.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Subscription plan not found.");
        if (plan.IsSystem) throw new InvalidOperationException("Built-in plans cannot be deleted. Disable the plan instead.");
        if (await context.TenantSubscriptions.AnyAsync(item => item.SubscriptionPlanId == id && item.Status != SubscriptionStatus.Expired && item.Status != SubscriptionStatus.Cancelled, cancellationToken))
            throw new InvalidOperationException("This plan is still assigned to an active tenant subscription.");
        plan.IsActive = false;
        plan.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task<PlatformSetting> GetOrCreateSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await context.PlatformSettings.FirstOrDefaultAsync(item => item.Id == 1, cancellationToken);
        if (settings is not null) return settings;
        settings = new PlatformSetting();
        context.PlatformSettings.Add(settings);
        await context.SaveChangesAsync(cancellationToken);
        return settings;
    }

    private async Task<SubscriptionPlan> LoadPlanAsync(long id, CancellationToken cancellationToken) =>
        await context.SubscriptionPlans.AsNoTracking().Include(item => item.Permissions)
            .FirstAsync(item => item.Id == id, cancellationToken);

    private async Task ReplacePermissionsAsync(long planId, IReadOnlyCollection<string>? requested, CancellationToken cancellationToken)
    {
        var allowed = (requested ?? []).Where(item => AppPermissions.All.Contains(item, StringComparer.OrdinalIgnoreCase) && item != AppPermissions.PlatformTenantsManage)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var current = await context.SubscriptionPlanPermissions.Where(item => item.SubscriptionPlanId == planId).ToListAsync(cancellationToken);
        foreach (var permission in AppPermissions.All.Where(item => item != AppPermissions.PlatformTenantsManage))
        {
            var row = current.FirstOrDefault(item => string.Equals(item.Permission, permission, StringComparison.OrdinalIgnoreCase));
            if (row is null) context.SubscriptionPlanPermissions.Add(new SubscriptionPlanPermission { SubscriptionPlanId = planId, Permission = permission, IsEnabled = allowed.Contains(permission) });
            else row.IsEnabled = allowed.Contains(permission);
        }
        await context.SaveChangesAsync(cancellationToken);
    }

    private static void ApplyPlan(SubscriptionPlan plan, UpsertSubscriptionPlanRequest request)
    {
        plan.Name = Required(request.Name, "Plan name");
        plan.Description = Clean(request.Description);
        plan.IsActive = request.IsActive;
        plan.SortOrder = request.SortOrder;
        plan.LegacyPlan = request.LegacyPlan;
        plan.MonthlyPrice = request.MonthlyPrice;
        plan.YearlyPrice = request.YearlyPrice;
        plan.CurrencyCode = NormalizeCurrency(request.CurrencyCode);
        plan.MaxUsers = request.MaxUsers;
        plan.MaxBranches = request.MaxBranches;
        plan.MaxProducts = request.MaxProducts;
        plan.MaxOrdersPerMonth = request.MaxOrdersPerMonth;
        plan.MaxStorageMb = request.MaxStorageMb;
    }

    private static void ValidatePlan(UpsertSubscriptionPlanRequest request)
    {
        if (request.MonthlyPrice < 0 || request.YearlyPrice < 0) throw new ArgumentException("Plan prices cannot be negative.");
        if (request.MaxUsers < 1 || request.MaxBranches < 1 || request.MaxProducts < 1 || request.MaxOrdersPerMonth < 1 || request.MaxStorageMb < 1)
            throw new ArgumentException("Every plan limit must be at least one.");
        _ = NormalizeCurrency(request.CurrencyCode);
        _ = NormalizeCode(request.Code);
        _ = Required(request.Name, "Plan name");
    }

    private static SubscriptionPlanResponse Map(SubscriptionPlan plan) => new(
        plan.Id, plan.Code, plan.Name, plan.Description, plan.IsSystem, plan.IsActive, plan.SortOrder, plan.LegacyPlan,
        plan.MonthlyPrice, plan.YearlyPrice, plan.CurrencyCode, plan.MaxUsers, plan.MaxBranches, plan.MaxProducts,
        plan.MaxOrdersPerMonth, plan.MaxStorageMb,
        plan.Permissions.Where(item => item.IsEnabled).Select(item => item.Permission).OrderBy(item => item).ToArray());

    private static PlatformSettingsResponse Map(PlatformSetting settings) =>
        new(settings.StorefrontBaseUrl, settings.AdminBaseUrl, settings.RootDomain, settings.DefaultRoutingMode, settings.AllowCustomDomains);

    private void EnsurePlatformAdmin()
    {
        if (!tenantContext.IsPlatformAdmin) throw new UnauthorizedAccessException();
    }

    private static string NormalizeCode(string? value)
    {
        var code = string.Join('-', (value ?? string.Empty).Trim().ToLowerInvariant().Split([' ', '_', '-'], StringSplitOptions.RemoveEmptyEntries));
        if (code.Length < 2 || !code.All(character => char.IsLetterOrDigit(character) || character == '-'))
            throw new ArgumentException("Enter a valid plan code.");
        return code;
    }
    private static string NormalizeCurrency(string? value)
    {
        var code = (value ?? string.Empty).Trim().ToUpperInvariant();
        if (code.Length != 3 || !code.All(char.IsLetter)) throw new ArgumentException("Currency code must contain three letters.");
        return code;
    }
    private static string Required(string? value, string field) => Clean(value) ?? throw new ArgumentException($"{field} is required.");
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value?.Trim()) ? null : value.Trim();
}
