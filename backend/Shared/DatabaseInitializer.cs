using System.Security.Claims;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Users;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using ECommerce.Entities.Company;
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
        await EnsureStoreOperatorRoleAsync(services);
        await EnsureDefaultCustomerTypesAsync(context, company.MainBranch.Id);
        await EnsureDefaultProductUnitsAsync(context, company.MainBranch.Id);
        await EnsureOperationDefaultsAsync(context, company.MainBranch.Id);
        await EnsureAdminAsync(services, company.MainBranch.Id);
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


    private sealed record DefaultCompany(Company Company, Branch MainBranch);

    private static async Task<DefaultCompany> EnsureCompanyAsync(ApplicationDbContext context)
    {
        var company = await context.Companies.SingleOrDefaultAsync();
        if (company is null)
        {
            company = new Company
            {
                Name = "Default Company",
                LegalName = "Default Company",
                IsActive = true
            };
            context.Companies.Add(company);
        }
        else
        {
            company.IsActive = true;
            company.UpdatedAt = DateTime.UtcNow;
        }

        var branch = await context.Branches
            .OrderByDescending(item => item.IsMain)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync();
        if (branch is null)
        {
            branch = new Branch
            {
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
                .Where(item => item.Id != branch.Id && item.IsMain)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsMain, false));
        }

        if (!await context.CompanySettings.AnyAsync())
            context.CompanySettings.Add(new CompanySetting());

        await context.SaveChangesAsync();
        return new DefaultCompany(company, branch);
    }

    private static async Task EnsureRolesAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();
        foreach (var roleName in new[] { AppRoles.Admin, AppRoles.Customer })
        {
            if (await roleManager.FindByNameAsync(roleName) is not null)
                continue;

            EnsureSucceeded(
                await roleManager.CreateAsync(new Role
                {
                    Name = roleName,
                    Description = $"{roleName} application role"
                }),
                $"Could not create role '{roleName}'.");
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
            EnsureSucceeded(
                await roleManager.AddClaimAsync(adminRole, new Claim(AuthClaims.Permission, permission)),
                $"Could not assign permission '{permission}' to the Admin role.");
    }

    private static async Task EnsureStoreOperatorRoleAsync(IServiceProvider services)
    {
        var roleManager = services.GetRequiredService<RoleManager<Role>>();
        var role = await roleManager.FindByNameAsync(AppRoles.StoreOperator);
        if (role is null)
        {
            role = new Role { Name = AppRoles.StoreOperator };
            EnsureSucceeded(await roleManager.CreateAsync(role),
                $"Could not create role '{AppRoles.StoreOperator}'.");
        }

        role.Description = "Daily catalog, inventory, order, customer, purchase, sales, payroll, expense, and report operations without user, role, branch, or company settings access.";
        EnsureSucceeded(await roleManager.UpdateAsync(role),
            $"Could not update role '{AppRoles.StoreOperator}'.");

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
            EnsureSucceeded(
                await roleManager.AddClaimAsync(role, new Claim(AuthClaims.Permission, permission)),
                $"Could not assign permission '{permission}' to '{AppRoles.StoreOperator}'.");

        var allowed = safePermissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in claims.Where(claim => !allowed.Contains(claim.Value)))
            EnsureSucceeded(
                await roleManager.RemoveClaimAsync(role, claim),
                $"Could not remove restricted permission '{claim.Value}' from '{AppRoles.StoreOperator}'.");
    }

    private static async Task EnsureDefaultCustomerTypesAsync(
        ApplicationDbContext context,
        long mainBranchId)
    {
        var general = await context.Types
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(type =>
                type.Group == GeneralTypeEnum.CustomerType &&
                type.Name == "General");

        if (general is null)
        {
            context.Types.Add(new GeneralType
            {
                BranchId = mainBranchId,
                Name = "General",
                Group = GeneralTypeEnum.CustomerType,
                SortOrder = 0
            });
        }
        else
        {
            general.IsDeleted = false;
            general.DeletedAt = null;
            general.BranchId ??= mainBranchId;
            general.SortOrder ??= 0;
            general.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync();
    }

    private static async Task EnsureDefaultProductUnitsAsync(
        ApplicationDbContext context,
        long mainBranchId)
    {
        var unitNames = new[]
        {
            "Piece (Dana)", "Tablet", "Capsule", "Strip", "Box", "Bottle",
            "Pack", "Vial", "Tube", "Sachet", "Carton"
        };
        var existing = await context.Types
            .IgnoreQueryFilters()
            .Where(type => type.Group == GeneralTypeEnum.ProductUnit)
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
            }
            else
            {
                context.Types.Add(new GeneralType
                {
                    BranchId = mainBranchId,
                    Name = name,
                    Group = GeneralTypeEnum.ProductUnit,
                    SortOrder = index
                });
            }
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }

    private static async Task EnsureOperationDefaultsAsync(ApplicationDbContext context, long branchId)
    {
        var changed = false;
        var names = new[] { "Rent", "Utilities", "Transport", "Office", "Other" };
        var existingNames = await context.Types
            .IgnoreQueryFilters()
            .Where(type => !type.IsDeleted && type.Group == GeneralTypeEnum.ExpenseCategory)
            .Select(type => type.Name)
            .ToListAsync();

        var missing = names
            .Where(name => !existingNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            .Select((name, index) => new GeneralType
            {
                BranchId = branchId,
                Name = name,
                Group = GeneralTypeEnum.ExpenseCategory,
                SortOrder = index
            })
            .ToArray();
        if (missing.Length > 0)
        {
            context.Types.AddRange(missing);
            changed = true;
        }

        var warehouse = await context.Warehouses
            .IgnoreQueryFilters()
            .OrderBy(item => item.Id)
            .FirstOrDefaultAsync();
        if (warehouse is null)
        {
            context.Warehouses.Add(new Warehouse
            {
                BranchId = branchId,
                Name = "Main Warehouse",
                Code = "MAIN",
                IsActive = true
            });
            changed = true;
        }
        else if (warehouse.IsDeleted || !warehouse.IsActive || !warehouse.BranchId.HasValue)
        {
            warehouse.IsDeleted = false;
            warehouse.DeletedAt = null;
            warehouse.IsActive = true;
            warehouse.BranchId ??= branchId;
            warehouse.UpdatedAt = DateTime.UtcNow;
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }

    private static async Task EnsureAdminAsync(IServiceProvider services, long branchId)
    {
        var seed = services.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        var email = seed.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(seed.Password))
            return;

        var userManager = services.GetRequiredService<UserManager<User>>();
        var context = services.GetRequiredService<ApplicationDbContext>();
        var normalizedEmail = userManager.NormalizeEmail(email);
        var admin = await context.Users.FirstOrDefaultAsync(user => user.NormalizedEmail == normalizedEmail);

        if (admin is null)
        {
            admin = new User
            {
                BranchId = branchId,
                Email = email,
                FullName = string.IsNullOrWhiteSpace(seed.FullName)
                    ? "System Administrator"
                    : seed.FullName.Trim(),
                IsActive = true,
                EmailConfirmed = true
            };
            admin.UserName = CompanyUserName.Create(admin.Id);
            EnsureSucceeded(await userManager.CreateAsync(admin, seed.Password), "Could not seed admin user.");
        }
        else
        {
            var changed = false;
            if (!admin.BranchId.HasValue) { admin.BranchId = branchId; changed = true; }
            if (CompanyUserName.RequiresRepair(admin.UserName)) { admin.UserName = CompanyUserName.Create(admin.Id); changed = true; }
            if (!admin.IsActive) { admin.IsActive = true; changed = true; }
            if (!admin.EmailConfirmed) { admin.EmailConfirmed = true; changed = true; }
            if (string.IsNullOrWhiteSpace(admin.FullName))
            {
                admin.FullName = string.IsNullOrWhiteSpace(seed.FullName)
                    ? "System Administrator"
                    : seed.FullName.Trim();
                changed = true;
            }
            if (changed)
                EnsureSucceeded(await userManager.UpdateAsync(admin), "Could not repair the seeded admin user.");
        }

        if (!await userManager.IsInRoleAsync(admin, AppRoles.Admin))
            EnsureSucceeded(await userManager.AddToRoleAsync(admin, AppRoles.Admin), "Could not assign the Admin role.");
    }

    private static async Task EnsureSafeIdentityUserNamesAsync(IServiceProvider services)
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<User>>();
        var users = await context.Users
            .Where(user => user.UserName == null || user.UserName.Contains(":") || user.UserName.StartsWith("T"))
            .ToListAsync();

        foreach (var user in users)
        {
            if (!CompanyUserName.RequiresRepair(user.UserName))
                continue;
            user.UserName = CompanyUserName.Create(user.Id);
            EnsureSucceeded(await userManager.UpdateAsync(user),
                $"Could not repair the internal username for {user.Email ?? user.Id}.");
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(
                message + " " + string.Join(" ", result.Errors.Select(error => error.Description)));
    }
}
