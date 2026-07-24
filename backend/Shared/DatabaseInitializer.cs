using System.Security.Claims;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Users;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using ECommerce.Entities.Tenancy;
using ECommerce.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Shared;

public static class DatabaseInitializer
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var context = services.GetRequiredService<ApplicationDbContext>();

        await EnsurePreMigrationSchemaCompatibilityAsync(context);
        await context.Database.MigrateAsync();
        var workspace = await EnsureDefaultTenantAsync(context);
        await EnsureRolesAsync(services);
        await EnsureAdminPermissionsAsync(services);
        await EnsureDefaultCustomerTypeAsync(context, workspace.Tenant.Id, workspace.Branch.Id);
        await EnsureOperationDefaultsAsync(context, workspace.Tenant.Id, workspace.Branch.Id);
        await EnsureAdminAsync(services, workspace.Tenant.Id, workspace.Branch.Id);
    }

    private static async Task EnsurePreMigrationSchemaCompatibilityAsync(ApplicationDbContext context)
    {
        // Some upgraded databases have the payment/general-type migration recorded
        // while the physical expense category column is absent. Repair only this
        // additive schema prerequisite before EF evaluates the remaining migrations.
        // A new database cannot be queried yet, so MigrateAsync handles it normally.
        if (!await context.Database.CanConnectAsync())
            return;

        await context.Database.ExecuteSqlRawAsync("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Expenses]
        ADD [GeneralTypeCategoryId] bigint NULL;
END;
""");
    }


    private sealed record DefaultWorkspace(Tenant Tenant, Branch Branch);

    private static async Task<DefaultWorkspace> EnsureDefaultTenantAsync(ApplicationDbContext context)
    {
        // The reserved default workspace must always exist for localhost and
        // local-network deployments that do not use tenant subdomains.
        var tenant = await context.Tenants
            .FirstOrDefaultAsync(item => item.Slug == "default");
        if (tenant is null)
        {
            tenant = new Tenant
            {
                Name = "Default Company",
                Slug = "default",
                LegalName = "Default Company",
                IsActive = true
            };
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync();
        }

        var branch = await context.Branches
            .Where(item => item.TenantId == tenant.Id)
            .OrderByDescending(item => item.IsMain)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync();
        if (branch is null)
        {
            branch = new Branch
            {
                TenantId = tenant.Id,
                Name = "Main Branch",
                Code = "MAIN",
                IsMain = true,
                IsActive = true
            };
            context.Branches.Add(branch);
            await context.SaveChangesAsync();
        }
        else
        {
            var branchChanged = false;
            if (!branch.IsMain)
            {
                branch.IsMain = true;
                branchChanged = true;
            }
            if (!branch.IsActive)
            {
                branch.IsActive = true;
                branchChanged = true;
            }
            if (branchChanged)
                await context.SaveChangesAsync();
        }

        if (!await context.TenantSettings.AnyAsync(item => item.TenantId == tenant.Id))
            context.TenantSettings.Add(new TenantSetting { TenantId = tenant.Id });

        if (!await context.TenantSubscriptions.AnyAsync(item => item.TenantId == tenant.Id))
            context.TenantSubscriptions.Add(new TenantSubscription
            {
                TenantId = tenant.Id,
                Plan = TenantPlan.Full,
                Status = SubscriptionStatus.Active,
                StartsAt = DateTime.UtcNow,
                MaxUsers = 1000,
                MaxBranches = 100,
                MaxProducts = 1_000_000
            });

        var granted = await context.TenantPermissionGrants
            .Where(item => item.TenantId == tenant.Id)
            .Select(item => item.Permission)
            .ToListAsync();
        context.TenantPermissionGrants.AddRange(AppPermissions.All
            .Where(permission => !granted.Contains(permission, StringComparer.OrdinalIgnoreCase))
            .Select(permission => new TenantPermissionGrant
            {
                TenantId = tenant.Id,
                Permission = permission,
                IsEnabled = true
            }));

        await context.SaveChangesAsync();
        return new DefaultWorkspace(tenant, branch);
    }

    private static async Task EnsureRolesAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();

        foreach (var roleName in new[] { AppRoles.PlatformAdmin, AppRoles.Admin, AppRoles.Customer })
        {
            var existingRole = await roleManager.FindByNameAsync(roleName);
            if (existingRole is not null)
                continue;

            var roleResult = await roleManager.CreateAsync(new Role
            {
                Name = roleName,
                Description = $"{roleName} application role"
            });

            if (!roleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not create role '{roleName}': " +
                    string.Join(" ", roleResult.Errors.Select(error => error.Description)));
            }
        }
    }

    private static async Task EnsureAdminPermissionsAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();
        var adminRole = await roleManager.FindByNameAsync(AppRoles.Admin)
            ?? throw new InvalidOperationException("Admin role is missing.");

        var existing = (await roleManager.GetClaimsAsync(adminRole))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var permission in AppPermissions.All.Where(permission => !existing.Contains(permission)))
        {
            var result = await roleManager.AddClaimAsync(
                adminRole,
                new Claim(AuthClaims.Permission, permission));

            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not assign permission '{permission}' to the Admin role: " +
                    string.Join(" ", result.Errors.Select(error => error.Description)));
            }
        }
    }

    private static async Task EnsureDefaultCustomerTypeAsync(ApplicationDbContext context, long tenantId, long branchId)
    {
        var hasGeneralCustomerType = await context.Types
            .IgnoreQueryFilters()
            .AnyAsync(type =>
                type.TenantId == tenantId &&
                !type.IsDeleted &&
                type.Group == GeneralTypeEnum.CustomerType &&
                (type.Name == "General" || type.Name == "Default"));

        if (hasGeneralCustomerType)
            return;

        context.Types.Add(new GeneralType
        {
            TenantId = tenantId,
            BranchId = branchId,
            Name = "General",
            Group = GeneralTypeEnum.CustomerType,
            SortOrder = 0
        });

        await context.SaveChangesAsync();
    }


    private static async Task EnsureOperationDefaultsAsync(ApplicationDbContext context, long tenantId, long branchId)
    {
        var changed = false;
        var expenseCategoryNames = new[] { "Rent", "Utilities", "Transport", "Office", "Other" };
        var existingExpenseCategoryNames = await context.Types
            .IgnoreQueryFilters()
            .Where(type => type.TenantId == tenantId && !type.IsDeleted && type.Group == GeneralTypeEnum.ExpenseCategory)
            .Select(type => type.Name)
            .ToListAsync();
        var missingExpenseCategories = expenseCategoryNames
            .Where(name => !existingExpenseCategoryNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            .Select((name, index) => new GeneralType
            {
                TenantId = tenantId,
                BranchId = branchId,
                Name = name,
                Group = GeneralTypeEnum.ExpenseCategory,
                SortOrder = index
            })
            .ToList();
        if (missingExpenseCategories.Count > 0)
        {
            context.Types.AddRange(missingExpenseCategories);
            changed = true;
        }

        if (!await context.Warehouses
                .IgnoreQueryFilters()
                .AnyAsync(item => item.TenantId == tenantId && !item.IsDeleted))
        {
            context.Warehouses.Add(new Warehouse
            {
                TenantId = tenantId,
                BranchId = branchId,
                Name = "Main Warehouse",
                Code = "MAIN",
                IsActive = true
            });
            changed = true;
        }

        if (changed) await context.SaveChangesAsync();
    }

    private static async Task EnsureAdminAsync(IServiceProvider services, long tenantId, long branchId)
    {
        var seed = services.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        var email = seed.Email?.Trim().ToLowerInvariant();

        // No credentials in configuration means seeding is intentionally disabled.
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(seed.Password))
            return;

        var userManager = services.GetRequiredService<UserManager<User>>();
        var context = services.GetRequiredService<ApplicationDbContext>();
        var normalizedEmail = userManager.NormalizeEmail(email);
        var admin = await context.Users.FirstOrDefaultAsync(user =>
            user.TenantId == tenantId && user.NormalizedEmail == normalizedEmail);

        if (admin is null)
        {
            admin = new User
            {
                TenantId = tenantId,
                BranchId = branchId,
                UserName = tenantId <= 1 ? email : $"{tenantId}:{email}",
                Email = email,
                FullName = string.IsNullOrWhiteSpace(seed.FullName)
                    ? "System Administrator"
                    : seed.FullName.Trim(),
                IsActive = true,
                EmailConfirmed = true
            };

            var createResult = await userManager.CreateAsync(admin, seed.Password);
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(
                    "Could not seed admin user: " +
                    string.Join(" ", createResult.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            var changed = false;

            if (admin.TenantId != tenantId)
            {
                admin.TenantId = tenantId;
                changed = true;
            }

            if (!admin.BranchId.HasValue)
            {
                admin.BranchId = branchId;
                changed = true;
            }

            var expectedUserName = tenantId <= 1 ? email : $"{tenantId}:{email}";
            if (!string.Equals(admin.UserName, expectedUserName, StringComparison.OrdinalIgnoreCase))
            {
                admin.UserName = expectedUserName;
                changed = true;
            }

            if (!admin.IsActive)
            {
                admin.IsActive = true;
                changed = true;
            }

            if (!admin.EmailConfirmed)
            {
                admin.EmailConfirmed = true;
                changed = true;
            }

            if (string.IsNullOrWhiteSpace(admin.FullName))
            {
                admin.FullName = string.IsNullOrWhiteSpace(seed.FullName)
                    ? "System Administrator"
                    : seed.FullName.Trim();
                changed = true;
            }

            if (changed)
            {
                var updateResult = await userManager.UpdateAsync(admin);
                if (!updateResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        "Could not repair the seeded admin user: " +
                        string.Join(" ", updateResult.Errors.Select(error => error.Description)));
                }
            }
        }

        foreach (var role in new[] { AppRoles.Admin, AppRoles.PlatformAdmin })
        {
            if (await userManager.IsInRoleAsync(admin, role)) continue;
            var addRoleResult = await userManager.AddToRoleAsync(admin, role);
            if (!addRoleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not assign the {role} role: " +
                    string.Join(" ", addRoleResult.Errors.Select(error => error.Description)));
            }
        }
    }
}
