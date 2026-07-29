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
        var company = await EnsureCompanyAsync(context);
        await EnsureRolesAsync(services);
        await EnsureAdminPermissionsAsync(services);
        await EnsureStoreOperatorRoleAsync(services, company.Company.Id);
        await EnsureDefaultCustomerTypesAsync(context, company.Company.Id, company.MainBranch.Id);
        await EnsureDefaultProductUnitsAsync(context, company.Company.Id, company.MainBranch.Id);
        await EnsureOperationDefaultsAsync(context, company.Company.Id, company.MainBranch.Id);
        await EnsureAdminAsync(services, company.Company.Id, company.MainBranch.Id);
        await EnsureSafeIdentityUserNamesAsync(services);
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

-- Repair a partially-applied cost-snapshot migration. A normal pending
-- migration is intentionally left to EF Core; this block only runs when the
-- migration history says it was applied but one of its physical columns is
-- missing.
IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NOT NULL
   AND EXISTS
   (
       SELECT 1
       FROM [dbo].[__EFMigrationsHistory]
       WHERE [MigrationId] = N'20260727110000_AddCostSnapshotsForProfitReporting'
   )
BEGIN
    IF OBJECT_ID(N'[dbo].[OrderItems]', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.OrderItems', N'UnitCost') IS NULL
    BEGIN
        ALTER TABLE [dbo].[OrderItems]
            ADD [UnitCost] decimal(18,4) NOT NULL DEFAULT (0);

        UPDATE item
        SET item.UnitCost = COALESCE(cost.UnitCost, 0)
        FROM [dbo].[OrderItems] item
        OUTER APPLY
        (
            SELECT TOP (1) purchaseItem.UnitCost
            FROM [dbo].[PurchaseItems] purchaseItem
            INNER JOIN [dbo].[Purchases] purchase ON purchase.Id = purchaseItem.PurchaseId
            WHERE purchaseItem.ProductId = item.ProductId
              AND purchase.IsDeleted = 0
              AND purchase.Status <> 3
              AND purchase.CreatedAt <= item.CreatedAt
            ORDER BY purchase.PurchaseDate DESC, purchaseItem.Id DESC
        ) cost;
    END;

    IF OBJECT_ID(N'[dbo].[InventorySaleItems]', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.InventorySaleItems', N'UnitCost') IS NULL
    BEGIN
        ALTER TABLE [dbo].[InventorySaleItems]
            ADD [UnitCost] decimal(18,4) NOT NULL DEFAULT (0);

        UPDATE item
        SET item.UnitCost = COALESCE(cost.UnitCost, 0)
        FROM [dbo].[InventorySaleItems] item
        INNER JOIN [dbo].[InventorySales] sale ON sale.Id = item.InventorySaleId
        OUTER APPLY
        (
            SELECT TOP (1) purchaseItem.UnitCost
            FROM [dbo].[PurchaseItems] purchaseItem
            INNER JOIN [dbo].[Purchases] purchase ON purchase.Id = purchaseItem.PurchaseId
            WHERE purchaseItem.ProductId = item.ProductId
              AND purchase.IsDeleted = 0
              AND purchase.Status <> 3
              AND purchase.PurchaseDate <= sale.SaleDate
            ORDER BY purchase.PurchaseDate DESC, purchaseItem.Id DESC
        ) cost;
    END;
END;
""");
    }


    private sealed record DefaultCompany(Tenant Company, Branch MainBranch);

    private static async Task<DefaultCompany> EnsureCompanyAsync(ApplicationDbContext context)
    {
        // Tenant is the retained legacy table name. Runtime behavior is strictly
        // single-company and always uses the reserved row with id 1.
        var company = await context.Tenants
            .OrderBy(item => item.Id)
            .FirstOrDefaultAsync();

        if (company is null)
        {
            company = new Tenant
            {
                Name = "Default Company",
                Slug = "company",
                LegalName = "Default Company",
                IsActive = true
            };
            context.Tenants.Add(company);
            await context.SaveChangesAsync();
        }
        else
        {
            company.IsActive = true;
            company.Slug = "company";
            await context.SaveChangesAsync();
        }

        if (company.Id != ECommerce.Services.Company.CompanyContext.SingleCompanyId)
            throw new InvalidOperationException(
                "The single-company compatibility row must use id 1. Back up and normalize the legacy company row before starting the API.");

        // Preserve old portal records for recovery, but prevent them from behaving
        // as active companies in the refactored single-company application.
        await context.Tenants
            .Where(item => item.Id != company.Id && item.IsActive)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.IsActive, false)
                .SetProperty(item => item.UpdatedAt, DateTime.UtcNow));

        var branch = await context.Branches
            .Where(item => item.TenantId == company.Id)
            .OrderByDescending(item => item.IsMain)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync();

        if (branch is null)
        {
            branch = new Branch
            {
                TenantId = company.Id,
                Name = "Main Branch",
                Code = "MAIN",
                IsMain = true,
                IsActive = true
            };
            context.Branches.Add(branch);
        }
        else
        {
            branch.IsMain = true;
            branch.IsActive = true;
            await context.Branches
                .Where(item => item.TenantId == company.Id && item.Id != branch.Id && item.IsMain)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsMain, false));
        }

        if (!await context.TenantSettings.AnyAsync(item => item.TenantId == company.Id))
            context.TenantSettings.Add(new TenantSetting { TenantId = company.Id });

        await context.SaveChangesAsync();
        return new DefaultCompany(company, branch);
    }

    private static async Task EnsureRolesAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();

        foreach (var roleName in new[] { AppRoles.Admin, AppRoles.Customer })
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

    private static async Task EnsureStoreOperatorRoleAsync(IServiceProvider services, long companyId)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();
        var internalName = $"company:{AppRoles.StoreOperator}";
        var role = await roleManager.FindByNameAsync(internalName);
        if (role is null)
        {
            role = new Role
            {
                Name = internalName,
                Description = "Daily catalog, inventory, order, customer, purchase, sales, payroll, expense, and report operations without user, role, branch, or company settings access.",
                TenantId = companyId
            };
            var create = await roleManager.CreateAsync(role);
            if (!create.Succeeded)
                throw new InvalidOperationException(
                    $"Could not create role '{AppRoles.StoreOperator}': " +
                    string.Join(" ", create.Errors.Select(error => error.Description)));
        }
        else if (role.TenantId != companyId)
        {
            role.TenantId = companyId;
            role.Description = "Daily catalog, inventory, order, customer, purchase, sales, payroll, expense, and report operations without user, role, branch, or company settings access.";
            var update = await roleManager.UpdateAsync(role);
            if (!update.Succeeded)
                throw new InvalidOperationException($"Could not scope role '{AppRoles.StoreOperator}' to the active company.");
        }

        var safePermissions = new[]
        {
            AppPermissions.DashboardView,
            AppPermissions.ProductsView,
            AppPermissions.ProductsManage,
            AppPermissions.ProductPricingManage,
            AppPermissions.InventoryView,
            AppPermissions.InventoryManage,
            AppPermissions.OrdersView,
            AppPermissions.OrdersManage,
            AppPermissions.PaymentsManage,
            AppPermissions.CustomersView,
            AppPermissions.CustomersManage,
            AppPermissions.OperationsView,
            AppPermissions.PurchasesView,
            AppPermissions.PurchasesManage,
            AppPermissions.ManualSalesView,
            AppPermissions.ManualSalesManage,
            AppPermissions.StaffView,
            AppPermissions.StaffManage,
            AppPermissions.PayrollView,
            AppPermissions.PayrollManage,
            AppPermissions.ExpensesView,
            AppPermissions.ExpensesManage,
            AppPermissions.FinancialReportsView
        };

        var claims = (await roleManager.GetClaimsAsync(role))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .ToArray();
        var existing = claims.Select(claim => claim.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var permission in safePermissions.Where(permission => !existing.Contains(permission)))
        {
            var result = await roleManager.AddClaimAsync(role, new Claim(AuthClaims.Permission, permission));
            if (!result.Succeeded)
                throw new InvalidOperationException(
                    $"Could not assign permission '{permission}' to '{AppRoles.StoreOperator}': " +
                    string.Join(" ", result.Errors.Select(error => error.Description)));
        }

        var allowed = safePermissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in claims.Where(claim => !allowed.Contains(claim.Value)))
        {
            var remove = await roleManager.RemoveClaimAsync(role, claim);
            if (!remove.Succeeded)
                throw new InvalidOperationException(
                    $"Could not remove restricted permission '{claim.Value}' from '{AppRoles.StoreOperator}'.");
        }
    }

    private static async Task EnsureDefaultCustomerTypesAsync(
        ApplicationDbContext context,
        long companyId,
        long mainBranchId)
    {
        var general = await context.Types
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(type =>
                type.TenantId == companyId &&
                type.Group == GeneralTypeEnum.CustomerType &&
                type.Name == "General");

        if (general is not null)
        {
            if (!general.IsDeleted && general.BranchId.HasValue)
                return;

            general.IsDeleted = false;
            general.DeletedAt = null;
            general.BranchId ??= mainBranchId;
            general.SortOrder ??= 0;
            general.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            context.Types.Add(new GeneralType
            {
                TenantId = companyId,
                BranchId = mainBranchId,
                Name = "General",
                Group = GeneralTypeEnum.CustomerType,
                SortOrder = 0
            });
        }

        await context.SaveChangesAsync();
    }


    private static async Task EnsureDefaultProductUnitsAsync(
        ApplicationDbContext context,
        long companyId,
        long mainBranchId)
    {
        var unitNames = new[]
        {
            "Piece (Dana)",
            "Tablet",
            "Capsule",
            "Strip",
            "Box",
            "Bottle",
            "Pack",
            "Vial",
            "Tube",
            "Sachet",
            "Carton"
        };

        var existing = await context.Types
            .IgnoreQueryFilters()
            .Where(type => type.TenantId == companyId && type.Group == GeneralTypeEnum.ProductUnit)
            .ToListAsync();
        var byName = existing
            .GroupBy(type => type.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.OrderBy(type => type.Id).First(), StringComparer.OrdinalIgnoreCase);
        var changed = false;

        for (var index = 0; index < unitNames.Length; index++)
        {
            var name = unitNames[index];
            if (byName.TryGetValue(name, out var unit))
            {
                if (!unit.IsDeleted && unit.BranchId.HasValue && unit.SortOrder == index)
                    continue;

                unit.IsDeleted = false;
                unit.DeletedAt = null;
                unit.BranchId ??= mainBranchId;
                unit.SortOrder = index;
                unit.UpdatedAt = DateTime.UtcNow;
                changed = true;
                continue;
            }

            context.Types.Add(new GeneralType
            {
                TenantId = companyId,
                BranchId = mainBranchId,
                Name = name,
                Group = GeneralTypeEnum.ProductUnit,
                SortOrder = index
            });
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }


    private static async Task EnsureOperationDefaultsAsync(ApplicationDbContext context, long companyId, long branchId)
    {
        var changed = false;
        var expenseCategoryNames = new[] { "Rent", "Utilities", "Transport", "Office", "Other" };
        var existingExpenseCategoryNames = await context.Types
            .IgnoreQueryFilters()
            .Where(type => type.TenantId == companyId && !type.IsDeleted && type.Group == GeneralTypeEnum.ExpenseCategory)
            .Select(type => type.Name)
            .ToListAsync();
        var missingExpenseCategories = expenseCategoryNames
            .Where(name => !existingExpenseCategoryNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            .Select((name, index) => new GeneralType
            {
                TenantId = companyId,
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
                .AnyAsync(item => item.TenantId == companyId && !item.IsDeleted))
        {
            context.Warehouses.Add(new Warehouse
            {
                TenantId = companyId,
                BranchId = branchId,
                Name = "Main Warehouse",
                Code = "MAIN",
                IsActive = true
            });
            changed = true;
        }

        if (changed) await context.SaveChangesAsync();
    }

    private static async Task EnsureAdminAsync(IServiceProvider services, long companyId, long branchId)
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
            user.TenantId == companyId && user.NormalizedEmail == normalizedEmail);

        if (admin is null)
        {
            admin = new User
            {
                TenantId = companyId,
                BranchId = branchId,
                Email = email,
                FullName = string.IsNullOrWhiteSpace(seed.FullName)
                    ? "System Administrator"
                    : seed.FullName.Trim(),
                IsActive = true,
                EmailConfirmed = true
            };
            admin.UserName = CompanyUserName.Create(companyId, admin.Id);

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

            if (admin.TenantId != companyId)
            {
                admin.TenantId = companyId;
                changed = true;
            }

            if (!admin.BranchId.HasValue)
            {
                admin.BranchId = branchId;
                changed = true;
            }

            if (CompanyUserName.RequiresRepair(admin.UserName))
            {
                admin.UserName = CompanyUserName.Create(companyId, admin.Id);
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

        if (!await userManager.IsInRoleAsync(admin, AppRoles.Admin))
        {
            var addRoleResult = await userManager.AddToRoleAsync(admin, AppRoles.Admin);
            if (!addRoleResult.Succeeded)
            {
                throw new InvalidOperationException(
                    "Could not assign the Admin role: " +
                    string.Join(" ", addRoleResult.Errors.Select(error => error.Description)));
            }
        }
    }

    private static async Task EnsureSafeIdentityUserNamesAsync(IServiceProvider services)
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<User>>();
        var users = await context.Users
            .Where(user => user.UserName == null || user.UserName.Contains(":"))
            .ToListAsync();

        foreach (var user in users)
        {
            user.UserName = CompanyUserName.Create(user.TenantId, user.Id);
            var result = await userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Could not repair the internal username for {user.Email ?? user.Id}: " +
                    string.Join(" ", result.Errors.Select(error => error.Description)));
            }
        }
    }
}
