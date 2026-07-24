using System.ComponentModel.DataAnnotations;
using ECommerce.Data;
using ECommerce.Dtos.Tenancy;
using ECommerce.Entities.Tenancy;
using ECommerce.Entities.Users;
using ECommerce.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public interface ITenantManagementService
{
    Task<TenantProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default);
    Task<TenantProfileResponse> UpdateProfileAsync(UpdateTenantProfileRequest request, CancellationToken cancellationToken = default);
    Task<TenantProfileResponse> UpdateSettingsAsync(UpdateTenantSettingsRequest request, CancellationToken cancellationToken = default);
    Task<BranchResponse> CreateBranchAsync(UpsertBranchRequest request, CancellationToken cancellationToken = default);
    Task<BranchResponse> UpdateBranchAsync(long id, UpsertBranchRequest request, CancellationToken cancellationToken = default);
    Task<PublicTenantProfileResponse> GetPublicProfileAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<TenantProfileResponse>> GetTenantsAsync(CancellationToken cancellationToken = default);
    Task<TenantProfileResponse> CreateTenantAsync(CreateTenantRequest request, CancellationToken cancellationToken = default);
    Task<TenantProfileResponse> UpdateTenantAsync(long tenantId, PlatformUpdateTenantRequest request, CancellationToken cancellationToken = default);
    Task<TenantProfileResponse> UpdateSubscriptionAsync(long tenantId, UpdateTenantSubscriptionRequest request, CancellationToken cancellationToken = default);
}

public sealed class TenantManagementService(
    ApplicationDbContext context,
    ITenantContext tenantContext,
    UserManager<User> userManager) : ITenantManagementService
{
    public async Task<TenantProfileResponse> GetProfileAsync(CancellationToken cancellationToken = default)
    {
        var tenant = await LoadTenantAsync(tenantContext.TenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Company not found.");
        return Map(tenant, await GetPlatformSettingsAsync(cancellationToken));
    }

    public async Task<TenantProfileResponse> UpdateProfileAsync(UpdateTenantProfileRequest request, CancellationToken cancellationToken = default)
    {
        var tenant = await context.Tenants.FirstOrDefaultAsync(item => item.Id == tenantContext.TenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Company not found.");
        tenant.Name = Required(request.Name, "Company name");
        tenant.LegalName = Clean(request.LegalName);
        tenant.RegistrationNumber = Clean(request.RegistrationNumber);
        tenant.Email = Clean(request.Email)?.ToLowerInvariant();
        tenant.Phone = Clean(request.Phone);
        tenant.Address = Clean(request.Address);
        tenant.LogoUrl = Clean(request.LogoUrl);
        tenant.FaviconUrl = Clean(request.FaviconUrl);
        tenant.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<TenantProfileResponse> UpdateSettingsAsync(UpdateTenantSettingsRequest request, CancellationToken cancellationToken = default)
    {
        ValidateSettings(request);
        var setting = await context.TenantSettings.FirstOrDefaultAsync(item => item.TenantId == tenantContext.TenantId, cancellationToken);
        if (setting is null)
        {
            setting = new TenantSetting { TenantId = tenantContext.TenantId };
            context.TenantSettings.Add(setting);
        }
        ApplySettings(setting, request);
        await context.SaveChangesAsync(cancellationToken);
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<BranchResponse> CreateBranchAsync(UpsertBranchRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureBranchCapacityAsync(cancellationToken);
        var code = Required(request.Code, "Branch code").ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.TenantId == tenantContext.TenantId && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain && !request.IsActive) throw new ArgumentException("The main branch must remain active.");
        if (request.IsMain) await ClearMainBranchAsync(null, cancellationToken);
        var branch = new Branch
        {
            TenantId = tenantContext.TenantId,
            Name = Required(request.Name, "Branch name"),
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

    public async Task<BranchResponse> UpdateBranchAsync(long id, UpsertBranchRequest request, CancellationToken cancellationToken = default)
    {
        var branch = await context.Branches.FirstOrDefaultAsync(item => item.Id == id && item.TenantId == tenantContext.TenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Branch not found.");
        var code = Required(request.Code, "Branch code").ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.Id != id && item.TenantId == tenantContext.TenantId && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain && !request.IsActive) throw new ArgumentException("The main branch must remain active.");
        if (branch.IsMain && !request.IsMain) throw new InvalidOperationException("Choose another branch as the main branch before changing this one.");
        if (branch.IsMain && !request.IsActive) throw new InvalidOperationException("The main branch cannot be deactivated.");
        if (request.IsMain) await ClearMainBranchAsync(id, cancellationToken);
        branch.Name = Required(request.Name, "Branch name");
        branch.Code = code;
        branch.Phone = Clean(request.Phone);
        branch.Address = Clean(request.Address);
        branch.IsMain = request.IsMain;
        branch.IsActive = request.IsActive;
        branch.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(branch);
    }

    public async Task<PublicTenantProfileResponse> GetPublicProfileAsync(CancellationToken cancellationToken = default)
    {
        var tenant = await LoadTenantAsync(tenantContext.TenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Company not found.");
        var platform = await GetPlatformSettingsAsync(cancellationToken);
        return new PublicTenantProfileResponse(
            tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.FaviconUrl,
            TenantSiteUrlBuilder.Build(tenant, platform).StorefrontUrl,
            Map(tenant.Setting ?? new TenantSetting { TenantId = tenant.Id }));
    }

    public async Task<IReadOnlyCollection<TenantProfileResponse>> GetTenantsAsync(CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var platform = await GetPlatformSettingsAsync(cancellationToken);
        var tenants = await context.Tenants.AsNoTracking()
            .Include(item => item.Branches).Include(item => item.Setting)
            .Include(item => item.Subscriptions).Include(item => item.PermissionGrants)
            .OrderBy(item => item.Name).ToListAsync(cancellationToken);
        return tenants.Select(item => Map(item, platform)).ToArray();
    }

    public async Task<TenantProfileResponse> CreateTenantAsync(CreateTenantRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var slug = NormalizeSlug(request.Slug);
        if (await context.Tenants.AnyAsync(item => item.Slug == slug, cancellationToken))
            throw new InvalidOperationException("This company slug is already in use.");
        var email = request.AdminEmail?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !new EmailAddressAttribute().IsValid(email))
            throw new ArgumentException("A valid administrator email is required.");
        if (request.AdminPassword?.Length < 6) throw new ArgumentException("Administrator password must contain at least 6 characters.");
        var currencyCode = NormalizeCurrency(request.MainCurrencyCode);
        var plan = await ResolvePlanAsync(request.SubscriptionPlanId, request.Plan, cancellationToken);
        var platform = await GetPlatformSettingsAsync(cancellationToken);
        var routingMode = request.SiteRoutingMode ?? platform.DefaultRoutingMode;
        var customDomain = TenantSiteUrlBuilder.NormalizeDomain(request.CustomDomain);
        if (customDomain is not null && !platform.AllowCustomDomains)
            throw new InvalidOperationException("Custom domains are disabled in platform settings.");
        if (customDomain is not null && await context.Tenants.AnyAsync(item => item.CustomDomain == customDomain, cancellationToken))
            throw new InvalidOperationException("This custom domain is already linked to another company.");
        if (routingMode == TenantSiteRoutingMode.CustomDomain && customDomain is null)
            throw new ArgumentException("A custom domain is required for custom-domain routing.");
        if (routingMode == TenantSiteRoutingMode.Subdomain && string.IsNullOrWhiteSpace(platform.RootDomain))
            throw new InvalidOperationException("Configure a root domain in Platform Settings before using subdomain routing.");
        var storefrontOverride = string.IsNullOrWhiteSpace(request.StorefrontBaseUrlOverride)
            ? null
            : TenantSiteUrlBuilder.NormalizeBaseUrl(request.StorefrontBaseUrlOverride, "Storefront override URL");

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var tenant = new Tenant
            {
                Name = Required(request.Name, "Company name"), LegalName = Required(request.Name, "Company name"), Slug = slug,
                SiteRoutingMode = routingMode, CustomDomain = customDomain,
                StorefrontBaseUrlOverride = storefrontOverride, IsActive = true
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync(cancellationToken);
            var branch = new Branch { TenantId = tenant.Id, Name = "Main Branch", Code = "MAIN", IsMain = true, IsActive = true };
            context.Branches.Add(branch);
            context.TenantSettings.Add(new TenantSetting { TenantId = tenant.Id, MainCurrencyCode = currencyCode, CurrencySymbol = CurrencySymbol(currencyCode) });
            var subscriptionOverrides = new UpdateTenantSubscriptionRequest(
                plan.Id, plan.LegacyPlan, SubscriptionStatus.Active, null,
                request.MaxUsers, request.MaxBranches, request.MaxProducts,
                request.MaxOrdersPerMonth, request.MaxStorageMb,
                request.MonthlyPrice, plan.CurrencyCode, null);
            var subscription = CreateSubscription(tenant.Id, plan, SubscriptionStatus.Active, null, subscriptionOverrides);
            ValidateSubscriptionLimits(subscription);
            context.TenantSubscriptions.Add(subscription);
            context.TenantPermissionGrants.AddRange(plan.Permissions.Select(permission => new TenantPermissionGrant { TenantId = tenant.Id, Permission = permission, IsEnabled = true }));
            await context.SaveChangesAsync(cancellationToken);

            var user = new User
            {
                TenantId = tenant.Id, BranchId = branch.Id, FullName = Required(request.AdminFullName, "Administrator name"),
                Email = email, EmailConfirmed = true, IsActive = true
            };
            user.UserName = TenantUserName.Create(tenant.Id, user.Id);
            EnsureSucceeded(await userManager.CreateAsync(user, request.AdminPassword), "Could not create tenant administrator.");
            EnsureSucceeded(await userManager.AddToRoleAsync(user, AppRoles.Admin), "Could not assign tenant administrator role.");
            await transaction.CommitAsync(cancellationToken);
            return Map((await LoadTenantAsync(tenant.Id, cancellationToken))!, platform);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<TenantProfileResponse> UpdateTenantAsync(long tenantId, PlatformUpdateTenantRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        ValidateSettings(request.Settings);
        var platform = await GetPlatformSettingsAsync(cancellationToken);
        var tenant = await context.Tenants.Include(item => item.Setting).Include(item => item.PermissionGrants).Include(item => item.Subscriptions)
            .FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken) ?? throw new KeyNotFoundException("Company not found.");
        var slug = NormalizeSlug(request.Slug);
        if (await context.Tenants.AnyAsync(item => item.Id != tenantId && item.Slug == slug, cancellationToken))
            throw new InvalidOperationException("This company slug is already in use.");
        var customDomain = TenantSiteUrlBuilder.NormalizeDomain(request.CustomDomain);
        if (customDomain is not null && !platform.AllowCustomDomains)
            throw new InvalidOperationException("Custom domains are disabled in platform settings.");
        if (customDomain is not null && await context.Tenants.AnyAsync(item => item.Id != tenantId && item.CustomDomain == customDomain, cancellationToken))
            throw new InvalidOperationException("This custom domain is already linked to another company.");
        if (request.SiteRoutingMode == TenantSiteRoutingMode.CustomDomain && customDomain is null)
            throw new ArgumentException("A custom domain is required for custom-domain routing.");
        if (request.SiteRoutingMode == TenantSiteRoutingMode.Subdomain && string.IsNullOrWhiteSpace(platform.RootDomain))
            throw new InvalidOperationException("Configure a root domain in Platform Settings before using subdomain routing.");

        tenant.Name = Required(request.Name, "Company name");
        tenant.Slug = slug;
        tenant.LegalName = Clean(request.LegalName);
        tenant.RegistrationNumber = Clean(request.RegistrationNumber);
        tenant.Email = Clean(request.Email)?.ToLowerInvariant();
        tenant.Phone = Clean(request.Phone);
        tenant.Address = Clean(request.Address);
        tenant.LogoUrl = Clean(request.LogoUrl);
        tenant.FaviconUrl = Clean(request.FaviconUrl);
        tenant.SiteRoutingMode = request.SiteRoutingMode;
        tenant.CustomDomain = customDomain;
        tenant.StorefrontBaseUrlOverride = string.IsNullOrWhiteSpace(request.StorefrontBaseUrlOverride)
            ? null : TenantSiteUrlBuilder.NormalizeBaseUrl(request.StorefrontBaseUrlOverride, "Storefront override URL");
        tenant.UpdatedAt = DateTime.UtcNow;

        var setting = tenant.Setting ?? new TenantSetting { TenantId = tenantId };
        if (tenant.Setting is null) context.TenantSettings.Add(setting);
        ApplySettings(setting, request.Settings);

        var subscription = tenant.Subscriptions.OrderByDescending(item => item.StartsAt).FirstOrDefault();
        var allowed = await GetSubscriptionPermissionsAsync(subscription, cancellationToken);
        var requested = (request.EnabledPermissions ?? []).Where(item => item != AppPermissions.PlatformTenantsManage)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var unsupported = requested.Where(item => !allowed.Contains(item)).OrderBy(item => item).ToArray();
        if (unsupported.Length > 0) throw new ArgumentException($"The current subscription does not include: {string.Join(", ", unsupported)}.");
        ApplyTenantPermissionGrants(tenantId, tenant.PermissionGrants, requested);
        await context.SaveChangesAsync(cancellationToken);
        return Map((await LoadTenantAsync(tenantId, cancellationToken))!, platform);
    }

    public async Task<TenantProfileResponse> UpdateSubscriptionAsync(long tenantId, UpdateTenantSubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        EnsurePlatformAdmin();
        var tenant = await context.Tenants.FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Company not found.");
        var plan = await ResolvePlanAsync(request.SubscriptionPlanId, request.Plan, cancellationToken);
        var current = await context.TenantSubscriptions.Where(item => item.TenantId == tenantId)
            .OrderByDescending(item => item.StartsAt).FirstOrDefaultAsync(cancellationToken);
        if (current is null)
        {
            current = CreateSubscription(tenantId, plan, request.Status, request.EndsAt, request);
            context.TenantSubscriptions.Add(current);
        }
        else
        {
            ApplySubscription(current, plan, request.Status, request.EndsAt, request);
        }
        ValidateSubscriptionLimits(current);
        await ValidateCurrentUsageAsync(tenantId, current, cancellationToken);

        var grants = await context.TenantPermissionGrants.Where(item => item.TenantId == tenantId).ToListAsync(cancellationToken);
        var allowed = plan.Permissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var currentlyEnabled = grants.Where(item => item.IsEnabled).Select(item => item.Permission).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var enabled = currentlyEnabled.Count == 0 ? allowed : currentlyEnabled.Where(allowed.Contains).ToHashSet(StringComparer.OrdinalIgnoreCase);
        ApplyTenantPermissionGrants(tenantId, grants, enabled);
        tenant.IsActive = request.Status is not SubscriptionStatus.Suspended and not SubscriptionStatus.Cancelled and not SubscriptionStatus.Expired;
        tenant.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map((await LoadTenantAsync(tenantId, cancellationToken))!, await GetPlatformSettingsAsync(cancellationToken));
    }

    private async Task<Tenant?> LoadTenantAsync(long tenantId, CancellationToken cancellationToken) =>
        await context.Tenants.AsNoTracking().Include(item => item.Branches).Include(item => item.Setting)
            .Include(item => item.Subscriptions).Include(item => item.PermissionGrants)
            .FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken);

    private async Task<PlatformSetting> GetPlatformSettingsAsync(CancellationToken cancellationToken) =>
        await context.PlatformSettings.AsNoTracking().FirstOrDefaultAsync(item => item.Id == 1, cancellationToken) ?? new PlatformSetting();

    private async Task<PlanSelection> ResolvePlanAsync(long? planId, TenantPlan? legacyPlan, CancellationToken cancellationToken)
    {
        SubscriptionPlan? entity = null;
        if (planId.HasValue)
            entity = await context.SubscriptionPlans.AsNoTracking().Include(item => item.Permissions)
                .FirstOrDefaultAsync(item => item.Id == planId && item.IsActive, cancellationToken)
                ?? throw new KeyNotFoundException("Subscription plan not found or inactive.");
        else
        {
            var legacy = legacyPlan ?? TenantPlan.Free;
            var code = legacy.ToString().ToLowerInvariant();
            entity = await context.SubscriptionPlans.AsNoTracking().Include(item => item.Permissions)
                .FirstOrDefaultAsync(item => item.Code == code && item.IsActive, cancellationToken);
            if (entity is null) return FallbackPlan(legacy);
        }
        return new PlanSelection(entity.Id, entity.Name, entity.LegacyPlan, entity.MaxUsers, entity.MaxBranches, entity.MaxProducts,
            entity.MaxOrdersPerMonth, entity.MaxStorageMb, entity.MonthlyPrice, entity.CurrencyCode,
            entity.Permissions.Where(item => item.IsEnabled).Select(item => item.Permission).ToArray());
    }

    private async Task<HashSet<string>> GetSubscriptionPermissionsAsync(TenantSubscription? subscription, CancellationToken cancellationToken)
    {
        if (subscription?.SubscriptionPlanId is long planId)
        {
            return (await context.SubscriptionPlanPermissions.AsNoTracking()
                .Where(item => item.SubscriptionPlanId == planId && item.IsEnabled).Select(item => item.Permission).ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }
        return FallbackPlan(subscription?.Plan ?? TenantPlan.Free).Permissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task EnsureBranchCapacityAsync(CancellationToken cancellationToken)
    {
        var subscription = await context.TenantSubscriptions.Where(item => item.TenantId == tenantContext.TenantId &&
                item.Status != SubscriptionStatus.Suspended && item.Status != SubscriptionStatus.Cancelled && item.Status != SubscriptionStatus.Expired)
            .OrderByDescending(item => item.StartsAt).FirstOrDefaultAsync(cancellationToken);
        var max = subscription?.MaxBranches ?? 1;
        var count = await context.Branches.CountAsync(item => item.TenantId == tenantContext.TenantId, cancellationToken);
        if (count >= max) throw new InvalidOperationException($"Your subscription allows {max} branch(es). Upgrade the plan or increase the tenant limit.");
    }

    private async Task ValidateCurrentUsageAsync(long tenantId, TenantSubscription subscription, CancellationToken cancellationToken)
    {
        var activeUsers = await context.Users.CountAsync(item => item.TenantId == tenantId && item.IsActive, cancellationToken);
        var branches = await context.Branches.CountAsync(item => item.TenantId == tenantId, cancellationToken);
        var products = await context.Products.IgnoreQueryFilters().CountAsync(item => item.TenantId == tenantId && !item.IsDeleted, cancellationToken);
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextMonth = monthStart.AddMonths(1);
        var onlineOrders = await context.Orders.IgnoreQueryFilters().CountAsync(item => item.TenantId == tenantId && !item.IsDeleted && item.CreatedAt >= monthStart && item.CreatedAt < nextMonth, cancellationToken);
        var manualSales = await context.InventorySales.IgnoreQueryFilters().CountAsync(item => item.TenantId == tenantId && !item.IsDeleted && item.CreatedAt >= monthStart && item.CreatedAt < nextMonth, cancellationToken);

        if (subscription.MaxUsers < activeUsers)
            throw new InvalidOperationException($"This company already has {activeUsers} active users. The user limit cannot be lower than current usage.");
        if (subscription.MaxBranches < branches)
            throw new InvalidOperationException($"This company already has {branches} branches. The branch limit cannot be lower than current usage.");
        if (subscription.MaxProducts < products)
            throw new InvalidOperationException($"This company already has {products} products. The product limit cannot be lower than current usage.");
        if (subscription.MaxOrdersPerMonth < onlineOrders + manualSales)
            throw new InvalidOperationException($"This company already has {onlineOrders + manualSales} orders this month. The monthly order limit cannot be lower than current usage.");
    }

    private async Task ClearMainBranchAsync(long? exceptId, CancellationToken cancellationToken)
    {
        var branches = await context.Branches.Where(item => item.TenantId == tenantContext.TenantId && item.IsMain && (!exceptId.HasValue || item.Id != exceptId.Value)).ToListAsync(cancellationToken);
        foreach (var branch in branches) branch.IsMain = false;
    }

    private static TenantProfileResponse Map(Tenant tenant, PlatformSetting platform)
    {
        var setting = tenant.Setting ?? new TenantSetting { TenantId = tenant.Id };
        var subscription = tenant.Subscriptions.OrderByDescending(item => item.StartsAt).FirstOrDefault();
        return new TenantProfileResponse(
            tenant.Id, tenant.Name, tenant.Slug, tenant.LegalName, tenant.RegistrationNumber, tenant.Email, tenant.Phone,
            tenant.Address, tenant.LogoUrl, tenant.FaviconUrl, TenantSiteUrlBuilder.Build(tenant, platform),
            tenant.Branches.OrderByDescending(item => item.IsMain).ThenBy(item => item.Name).Select(Map).ToArray(),
            subscription is null ? null : new TenantSubscriptionResponse(subscription.Id, subscription.SubscriptionPlanId,
                subscription.PlanName, subscription.Plan, subscription.Status, subscription.StartsAt, subscription.EndsAt,
                subscription.MaxUsers, subscription.MaxBranches, subscription.MaxProducts, subscription.MaxOrdersPerMonth,
                subscription.MaxStorageMb, subscription.MonthlyPrice, subscription.BillingCurrencyCode, subscription.Notes),
            Map(setting), tenant.PermissionGrants.Where(item => item.IsEnabled).Select(item => item.Permission).OrderBy(item => item).ToArray());
    }

    private static BranchResponse Map(Branch branch) => new(branch.Id, branch.Name, branch.Code, branch.Phone, branch.Address, branch.IsMain, branch.IsActive);
    private static TenantSettingsResponse Map(TenantSetting setting) => new(setting.MainCurrencyCode, setting.CurrencySymbol, setting.CurrencyPosition, setting.CurrencyDecimalPlaces,
        setting.AdminPrimaryColor, setting.AdminSecondaryColor, setting.StorefrontPrimaryColor, setting.StorefrontSecondaryColor,
        setting.EnglishFontFamily, setting.DariFontFamily, setting.PashtoFontFamily, setting.BaseFontSize, setting.TrashRetentionDays, setting.AllowTenantUserClaimManagement);

    private static TenantSubscription CreateSubscription(long tenantId, PlanSelection plan, SubscriptionStatus status, DateTime? endsAt, UpdateTenantSubscriptionRequest? overrides)
    {
        var subscription = new TenantSubscription { TenantId = tenantId, StartsAt = DateTime.UtcNow };
        ApplySubscription(subscription, plan, status, endsAt, overrides);
        return subscription;
    }

    private static void ApplySubscription(TenantSubscription target, PlanSelection plan, SubscriptionStatus status, DateTime? endsAt, UpdateTenantSubscriptionRequest? overrides)
    {
        target.SubscriptionPlanId = plan.Id;
        target.PlanName = plan.Name;
        target.Plan = plan.LegacyPlan;
        target.Status = status;
        target.EndsAt = endsAt;
        target.MaxUsers = overrides?.MaxUsers ?? plan.MaxUsers;
        target.MaxBranches = overrides?.MaxBranches ?? plan.MaxBranches;
        target.MaxProducts = overrides?.MaxProducts ?? plan.MaxProducts;
        target.MaxOrdersPerMonth = overrides?.MaxOrdersPerMonth ?? plan.MaxOrdersPerMonth;
        target.MaxStorageMb = overrides?.MaxStorageMb ?? plan.MaxStorageMb;
        target.MonthlyPrice = overrides?.MonthlyPrice ?? plan.MonthlyPrice;
        target.BillingCurrencyCode = NormalizeCurrency(overrides?.BillingCurrencyCode ?? plan.CurrencyCode);
        target.Notes = Clean(overrides?.Notes);
    }

    private static void ValidateSubscriptionLimits(TenantSubscription value)
    {
        if (value.MaxUsers < 1 || value.MaxBranches < 1 || value.MaxProducts < 1 || value.MaxOrdersPerMonth < 1 || value.MaxStorageMb < 1)
            throw new ArgumentException("Every tenant subscription limit must be at least one.");
        if (value.MonthlyPrice < 0) throw new ArgumentException("Monthly price cannot be negative.");
    }

    private void ApplyTenantPermissionGrants(long tenantId, ICollection<TenantPermissionGrant> grants, HashSet<string> enabled)
    {
        foreach (var permission in AppPermissions.All.Where(value => value != AppPermissions.PlatformTenantsManage))
        {
            var grant = grants.FirstOrDefault(item => string.Equals(item.Permission, permission, StringComparison.OrdinalIgnoreCase));
            if (grant is null)
            {
                grant = new TenantPermissionGrant { TenantId = tenantId, Permission = permission, IsEnabled = enabled.Contains(permission) };
                context.TenantPermissionGrants.Add(grant);
                grants.Add(grant);
            }
            else grant.IsEnabled = enabled.Contains(permission);
        }
    }

    private static void ApplySettings(TenantSetting setting, UpdateTenantSettingsRequest request)
    {
        setting.MainCurrencyCode = NormalizeCurrency(request.MainCurrencyCode);
        setting.CurrencySymbol = Required(request.CurrencySymbol, "Currency symbol");
        setting.CurrencyPosition = request.CurrencyPosition.Trim().ToLowerInvariant();
        setting.CurrencyDecimalPlaces = request.CurrencyDecimalPlaces;
        setting.AdminPrimaryColor = NormalizeColor(request.AdminPrimaryColor);
        setting.AdminSecondaryColor = NormalizeColor(request.AdminSecondaryColor);
        setting.StorefrontPrimaryColor = NormalizeColor(request.StorefrontPrimaryColor);
        setting.StorefrontSecondaryColor = NormalizeColor(request.StorefrontSecondaryColor);
        setting.EnglishFontFamily = Required(request.EnglishFontFamily, "English font");
        setting.DariFontFamily = Required(request.DariFontFamily, "Dari font");
        setting.PashtoFontFamily = Required(request.PashtoFontFamily, "Pashto font");
        setting.BaseFontSize = request.BaseFontSize;
        setting.TrashRetentionDays = request.TrashRetentionDays;
        setting.AllowTenantUserClaimManagement = request.AllowTenantUserClaimManagement;
        setting.UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateSettings(UpdateTenantSettingsRequest request)
    {
        _ = NormalizeCurrency(request.MainCurrencyCode);
        if (request.CurrencyDecimalPlaces is < 0 or > 4) throw new ArgumentException("Currency decimals must be between 0 and 4.");
        if (request.CurrencyPosition is not ("before" or "after")) throw new ArgumentException("Currency position must be before or after.");
        if (request.BaseFontSize is < 12 or > 22) throw new ArgumentException("Base font size must be between 12 and 22 pixels.");
        if (request.TrashRetentionDays is < 1 or > 3650) throw new ArgumentException("Trash retention must be between 1 and 3650 days.");
        _ = NormalizeColor(request.AdminPrimaryColor); _ = NormalizeColor(request.AdminSecondaryColor);
        _ = NormalizeColor(request.StorefrontPrimaryColor); _ = NormalizeColor(request.StorefrontSecondaryColor);
    }

    private static PlanSelection FallbackPlan(TenantPlan plan)
    {
        var free = new[] { AppPermissions.DashboardView, AppPermissions.ProductsView, AppPermissions.ProductsManage, AppPermissions.InventoryView, AppPermissions.OrdersView, AppPermissions.OrdersManage, AppPermissions.CustomersView, AppPermissions.CustomersManage, AppPermissions.UsersView, AppPermissions.TenantProfileManage, AppPermissions.TenantSettingsManage, AppPermissions.TenantReportsView };
        var premium = free.Concat(new[] { AppPermissions.ProductPricingManage, AppPermissions.InventoryManage, AppPermissions.PaymentsManage, AppPermissions.UsersManage, AppPermissions.RolesManage, AppPermissions.TenantBranchesManage, AppPermissions.TenantClaimsManage, AppPermissions.TenantTrashManage, AppPermissions.SystemManage }).Distinct().ToArray();
        var full = AppPermissions.All.Where(value => value != AppPermissions.PlatformTenantsManage).ToArray();
        return plan switch
        {
            TenantPlan.Premium => new(null, "Premium", plan, 20, 5, 10_000, 10_000, 10_240, 0, "USD", premium),
            TenantPlan.Full => new(null, "Full", plan, 100, 25, 100_000, 100_000, 51_200, 0, "USD", full),
            TenantPlan.Enterprise => new(null, "Enterprise", plan, 10_000, 1_000, 10_000_000, 10_000_000, 1_048_576, 0, "USD", full),
            _ => new(null, "Free", TenantPlan.Free, 3, 1, 100, 500, 1_024, 0, "USD", free)
        };
    }

    private static string NormalizeColor(string value)
    {
        var color = value?.Trim() ?? string.Empty;
        if (!System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$")) throw new ArgumentException($"'{value}' is not a valid six-digit hex color.");
        return color.ToLowerInvariant();
    }
    private static string NormalizeSlug(string value)
    {
        var slug = string.Join('-', (value ?? string.Empty).Trim().ToLowerInvariant()
            .Split([' ', '_', '-'], StringSplitOptions.RemoveEmptyEntries));
        if (slug.Length < 2 || !System.Text.RegularExpressions.Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
            throw new ArgumentException("Company slug may contain only lowercase English letters, numbers, and single hyphens.");
        return slug;
    }
    private static string NormalizeCurrency(string? value)
    {
        var code = (value ?? string.Empty).Trim().ToUpperInvariant();
        if (code.Length != 3 || !code.All(char.IsLetter)) throw new ArgumentException("Currency code must contain three letters.");
        return code;
    }
    private static string CurrencySymbol(string code) => code switch { "AFN" => "؋", "USD" => "$", "EUR" => "€", "GBP" => "£", "PKR" => "₨", "INR" => "₹", _ => code };
    private static string Required(string? value, string field) => Clean(value) ?? throw new ArgumentException($"{field} is required.");
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value?.Trim()) ? null : value.Trim();
    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded) throw new InvalidOperationException(message + " " + string.Join(" ", result.Errors.Select(item => item.Description)));
    }
    private void EnsurePlatformAdmin() { if (!tenantContext.IsPlatformAdmin) throw new UnauthorizedAccessException(); }

    private sealed record PlanSelection(long? Id, string Name, TenantPlan LegacyPlan, int MaxUsers, int MaxBranches, int MaxProducts, int MaxOrdersPerMonth, int MaxStorageMb, decimal MonthlyPrice, string CurrencyCode, IReadOnlyCollection<string> Permissions);
}
