using System.Security.Claims;
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
    Task<TenantProfileResponse> UpdateSubscriptionAsync(long tenantId, TenantPlan plan, SubscriptionStatus status, DateTime? endsAt, CancellationToken cancellationToken = default);
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
        return Map(tenant);
    }

    public async Task<TenantProfileResponse> UpdateProfileAsync(
        UpdateTenantProfileRequest request,
        CancellationToken cancellationToken = default)
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

    public async Task<TenantProfileResponse> UpdateSettingsAsync(
        UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateSettings(request);
        var setting = await context.TenantSettings.FirstOrDefaultAsync(item => item.TenantId == tenantContext.TenantId, cancellationToken);
        if (setting is null)
        {
            setting = new TenantSetting { TenantId = tenantContext.TenantId };
            context.TenantSettings.Add(setting);
        }

        setting.MainCurrencyCode = request.MainCurrencyCode.Trim().ToUpperInvariant();
        setting.CurrencySymbol = request.CurrencySymbol.Trim();
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
        await context.SaveChangesAsync(cancellationToken);
        return await GetProfileAsync(cancellationToken);
    }

    public async Task<BranchResponse> CreateBranchAsync(
        UpsertBranchRequest request,
        CancellationToken cancellationToken = default)
    {
        await EnsureBranchCapacityAsync(cancellationToken);
        var code = Required(request.Code, "Branch code").ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.TenantId == tenantContext.TenantId && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain && !request.IsActive)
            throw new ArgumentException("The main branch must remain active.");
        if (request.IsMain)
            await ClearMainBranchAsync(null, cancellationToken);

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

    public async Task<BranchResponse> UpdateBranchAsync(
        long id,
        UpsertBranchRequest request,
        CancellationToken cancellationToken = default)
    {
        var branch = await context.Branches.FirstOrDefaultAsync(item => item.Id == id && item.TenantId == tenantContext.TenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Branch not found.");
        var code = Required(request.Code, "Branch code").ToUpperInvariant();
        if (await context.Branches.AnyAsync(item => item.Id != id && item.TenantId == tenantContext.TenantId && item.Code == code, cancellationToken))
            throw new InvalidOperationException("A branch with this code already exists.");
        if (request.IsMain && !request.IsActive)
            throw new ArgumentException("The main branch must remain active.");
        if (branch.IsMain && !request.IsMain)
            throw new InvalidOperationException("Choose another branch as the main branch before changing this one.");
        if (branch.IsMain && !request.IsActive)
            throw new InvalidOperationException("The main branch cannot be deactivated.");
        if (request.IsMain)
            await ClearMainBranchAsync(id, cancellationToken);
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
        return new PublicTenantProfileResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.LogoUrl,
            tenant.FaviconUrl,
            Map(tenant.Setting ?? new TenantSetting { TenantId = tenant.Id }));
    }

    public async Task<IReadOnlyCollection<TenantProfileResponse>> GetTenantsAsync(CancellationToken cancellationToken = default)
    {
        if (!tenantContext.IsPlatformAdmin) throw new UnauthorizedAccessException();
        var tenants = await context.Tenants.AsNoTracking()
            .Include(item => item.Branches)
            .Include(item => item.Setting)
            .Include(item => item.Subscriptions)
            .Include(item => item.PermissionGrants)
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);
        return tenants.Select(Map).ToArray();
    }

    public async Task<TenantProfileResponse> CreateTenantAsync(
        CreateTenantRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!tenantContext.IsPlatformAdmin) throw new UnauthorizedAccessException();
        var slug = NormalizeSlug(request.Slug);
        if (await context.Tenants.AnyAsync(item => item.Slug == slug, cancellationToken))
            throw new InvalidOperationException("This company slug is already in use.");
        if (string.IsNullOrWhiteSpace(request.AdminEmail) || !request.AdminEmail.Contains('@'))
            throw new ArgumentException("A valid administrator email is required.");
        if (request.AdminPassword?.Length < 6)
            throw new ArgumentException("Administrator password must contain at least 6 characters.");
        var currencyCode = NormalizeCurrency(request.MainCurrencyCode);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var tenant = new Tenant
            {
                Name = Required(request.Name, "Company name"),
                LegalName = Required(request.Name, "Company name"),
                Slug = slug,
                IsActive = true
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync(cancellationToken);

            context.Branches.Add(new Branch
            {
                TenantId = tenant.Id,
                Name = "Main Branch",
                Code = "MAIN",
                IsMain = true,
                IsActive = true
            });
            context.TenantSettings.Add(new TenantSetting
            {
                TenantId = tenant.Id,
                MainCurrencyCode = currencyCode,
                CurrencySymbol = CurrencySymbol(currencyCode)
            });
            var planLimits = PlanLimits(request.Plan);
            context.TenantSubscriptions.Add(new TenantSubscription
            {
                TenantId = tenant.Id,
                Plan = request.Plan,
                Status = SubscriptionStatus.Active,
                StartsAt = DateTime.UtcNow,
                MaxUsers = planLimits.Users,
                MaxBranches = planLimits.Branches,
                MaxProducts = planLimits.Products
            });
            var permissions = PlanPermissions(request.Plan);
            context.TenantPermissionGrants.AddRange(permissions.Select(permission => new TenantPermissionGrant
            {
                TenantId = tenant.Id,
                Permission = permission,
                IsEnabled = true
            }));
            await context.SaveChangesAsync(cancellationToken);

            var email = request.AdminEmail.Trim().ToLowerInvariant();
            var user = new User
            {
                TenantId = tenant.Id,
                BranchId = await context.Branches.Where(item => item.TenantId == tenant.Id).Select(item => (long?)item.Id).FirstAsync(cancellationToken),
                FullName = Required(request.AdminFullName, "Administrator name"),
                Email = email,
                UserName = $"{tenant.Id}:{email}",
                EmailConfirmed = true,
                IsActive = true
            };
            var createResult = await userManager.CreateAsync(user, request.AdminPassword);
            EnsureSucceeded(createResult, "Could not create tenant administrator.");
            EnsureSucceeded(await userManager.AddToRoleAsync(user, AppRoles.Admin), "Could not assign tenant administrator role.");

            await transaction.CommitAsync(cancellationToken);
            return Map((await LoadTenantAsync(tenant.Id, cancellationToken))!);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<TenantProfileResponse> UpdateSubscriptionAsync(
        long tenantId,
        TenantPlan plan,
        SubscriptionStatus status,
        DateTime? endsAt,
        CancellationToken cancellationToken = default)
    {
        if (!tenantContext.IsPlatformAdmin) throw new UnauthorizedAccessException();
        var tenant = await context.Tenants.FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken)
            ?? throw new KeyNotFoundException("Company not found.");
        var current = await context.TenantSubscriptions
            .Where(item => item.TenantId == tenantId)
            .OrderByDescending(item => item.StartsAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (current is null)
        {
            current = new TenantSubscription { TenantId = tenantId, StartsAt = DateTime.UtcNow };
            context.TenantSubscriptions.Add(current);
        }
        var limits = PlanLimits(plan);
        current.Plan = plan;
        current.Status = status;
        current.EndsAt = endsAt;
        current.MaxUsers = limits.Users;
        current.MaxBranches = limits.Branches;
        current.MaxProducts = limits.Products;

        var enabled = PlanPermissions(plan).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var grants = await context.TenantPermissionGrants.Where(item => item.TenantId == tenantId).ToListAsync(cancellationToken);
        foreach (var permission in AppPermissions.All.Where(value => value != AppPermissions.PlatformTenantsManage))
        {
            var grant = grants.FirstOrDefault(item => string.Equals(item.Permission, permission, StringComparison.OrdinalIgnoreCase));
            if (grant is null)
                context.TenantPermissionGrants.Add(new TenantPermissionGrant { TenantId = tenantId, Permission = permission, IsEnabled = enabled.Contains(permission) });
            else
                grant.IsEnabled = enabled.Contains(permission);
        }
        tenant.IsActive = status is not SubscriptionStatus.Suspended and not SubscriptionStatus.Cancelled and not SubscriptionStatus.Expired;
        tenant.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map((await LoadTenantAsync(tenantId, cancellationToken))!);
    }

    private async Task<Tenant?> LoadTenantAsync(long tenantId, CancellationToken cancellationToken) =>
        await context.Tenants.AsNoTracking()
            .Include(item => item.Branches)
            .Include(item => item.Setting)
            .Include(item => item.Subscriptions)
            .Include(item => item.PermissionGrants)
            .FirstOrDefaultAsync(item => item.Id == tenantId, cancellationToken);

    private async Task EnsureBranchCapacityAsync(CancellationToken cancellationToken)
    {
        var subscription = await context.TenantSubscriptions
            .Where(item => item.TenantId == tenantContext.TenantId &&
                item.Status != SubscriptionStatus.Suspended &&
                item.Status != SubscriptionStatus.Cancelled &&
                item.Status != SubscriptionStatus.Expired)
            .OrderByDescending(item => item.StartsAt)
            .FirstOrDefaultAsync(cancellationToken);
        var max = subscription?.MaxBranches ?? 1;
        var count = await context.Branches.CountAsync(item => item.TenantId == tenantContext.TenantId, cancellationToken);
        if (count >= max)
            throw new InvalidOperationException($"Your subscription allows {max} branch(es). Upgrade the plan to add more.");
    }

    private async Task ClearMainBranchAsync(long? exceptId, CancellationToken cancellationToken)
    {
        var branches = await context.Branches
            .Where(item => item.TenantId == tenantContext.TenantId && item.IsMain && (!exceptId.HasValue || item.Id != exceptId.Value))
            .ToListAsync(cancellationToken);
        foreach (var branch in branches) branch.IsMain = false;
    }

    private static TenantProfileResponse Map(Tenant tenant)
    {
        var setting = tenant.Setting ?? new TenantSetting { TenantId = tenant.Id };
        var subscription = tenant.Subscriptions.OrderByDescending(item => item.StartsAt).FirstOrDefault();
        return new TenantProfileResponse(
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            tenant.LegalName,
            tenant.RegistrationNumber,
            tenant.Email,
            tenant.Phone,
            tenant.Address,
            tenant.LogoUrl,
            tenant.FaviconUrl,
            tenant.Branches.OrderByDescending(item => item.IsMain).ThenBy(item => item.Name).Select(Map).ToArray(),
            subscription is null ? null : new TenantSubscriptionResponse(subscription.Id, subscription.Plan, subscription.Status, subscription.StartsAt, subscription.EndsAt, subscription.MaxUsers, subscription.MaxBranches, subscription.MaxProducts, subscription.MonthlyPrice, subscription.BillingCurrencyCode),
            Map(setting),
            tenant.PermissionGrants.Where(item => item.IsEnabled).Select(item => item.Permission).OrderBy(item => item).ToArray());
    }

    private static BranchResponse Map(Branch branch) =>
        new(branch.Id, branch.Name, branch.Code, branch.Phone, branch.Address, branch.IsMain, branch.IsActive);

    private static TenantSettingsResponse Map(TenantSetting setting) =>
        new(setting.MainCurrencyCode, setting.CurrencySymbol, setting.CurrencyPosition, setting.CurrencyDecimalPlaces,
            setting.AdminPrimaryColor, setting.AdminSecondaryColor, setting.StorefrontPrimaryColor, setting.StorefrontSecondaryColor,
            setting.EnglishFontFamily, setting.DariFontFamily, setting.PashtoFontFamily, setting.BaseFontSize,
            setting.TrashRetentionDays, setting.AllowTenantUserClaimManagement);

    private static void ValidateSettings(UpdateTenantSettingsRequest request)
    {
        if (request.MainCurrencyCode?.Trim().Length != 3) throw new ArgumentException("Currency code must contain three letters.");
        if (request.CurrencyDecimalPlaces is < 0 or > 4) throw new ArgumentException("Currency decimals must be between 0 and 4.");
        if (request.CurrencyPosition is not ("before" or "after")) throw new ArgumentException("Currency position must be before or after.");
        if (request.BaseFontSize is < 12 or > 22) throw new ArgumentException("Base font size must be between 12 and 22 pixels.");
        if (request.TrashRetentionDays is < 1 or > 3650) throw new ArgumentException("Trash retention must be between 1 and 3650 days.");
        _ = NormalizeColor(request.AdminPrimaryColor);
        _ = NormalizeColor(request.AdminSecondaryColor);
        _ = NormalizeColor(request.StorefrontPrimaryColor);
        _ = NormalizeColor(request.StorefrontSecondaryColor);
    }

    private static string NormalizeColor(string value)
    {
        var color = value?.Trim() ?? string.Empty;
        if (!System.Text.RegularExpressions.Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$"))
            throw new ArgumentException($"'{value}' is not a valid six-digit hex color.");
        return color.ToLowerInvariant();
    }

    private static string NormalizeSlug(string value)
    {
        var slug = string.Join('-', (value ?? string.Empty).Trim().ToLowerInvariant()
            .Split([' ', '_', '-'], StringSplitOptions.RemoveEmptyEntries));
        if (slug.Length < 2 || !slug.All(character => char.IsLetterOrDigit(character) || character == '-'))
            throw new ArgumentException("Enter a valid company slug.");
        return slug;
    }

    private static (int Users, int Branches, int Products) PlanLimits(TenantPlan plan) => plan switch
    {
        TenantPlan.Free => (3, 1, 100),
        TenantPlan.Premium => (20, 5, 10_000),
        TenantPlan.Full => (100, 25, 100_000),
        TenantPlan.Enterprise => (10_000, 1_000, 10_000_000),
        _ => (3, 1, 100)
    };

    private static IReadOnlyCollection<string> PlanPermissions(TenantPlan plan)
    {
        var free = new[] { AppPermissions.DashboardView, AppPermissions.ProductsView, AppPermissions.ProductsManage, AppPermissions.InventoryView, AppPermissions.OrdersView, AppPermissions.OrdersManage, AppPermissions.CustomersView, AppPermissions.CustomersManage, AppPermissions.UsersView, AppPermissions.TenantProfileManage, AppPermissions.TenantSettingsManage, AppPermissions.TenantReportsView };
        var premium = free.Concat(new[] { AppPermissions.ProductPricingManage, AppPermissions.InventoryManage, AppPermissions.PaymentsManage, AppPermissions.UsersManage, AppPermissions.RolesManage, AppPermissions.TenantBranchesManage, AppPermissions.TenantClaimsManage, AppPermissions.TenantTrashManage, AppPermissions.SystemManage }).Distinct().ToArray();
        var full = AppPermissions.All.Where(value => value != AppPermissions.PlatformTenantsManage).ToArray();
        return plan switch { TenantPlan.Free => free, TenantPlan.Premium => premium, TenantPlan.Full or TenantPlan.Enterprise => full, _ => free };
    }


    private static string NormalizeCurrency(string? value)
    {
        var code = (value ?? string.Empty).Trim().ToUpperInvariant();
        if (code.Length != 3 || !code.All(char.IsLetter))
            throw new ArgumentException("Currency code must contain three letters.");
        return code;
    }

    private static string CurrencySymbol(string code) => code.Trim().ToUpperInvariant() switch
    {
        "AFN" => "؋", "USD" => "$", "EUR" => "€", "GBP" => "£", "PKR" => "₨", "INR" => "₹", _ => code.Trim().ToUpperInvariant()
    };

    private static string Required(string? value, string field)
    {
        var clean = Clean(value);
        return clean ?? throw new ArgumentException($"{field} is required.");
    }

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(message + " " + string.Join(" ", result.Errors.Select(item => item.Description)));
    }
}
