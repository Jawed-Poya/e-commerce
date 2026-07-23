using System.Security.Claims;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Users;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
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
        await EnsureRolesAsync(services);
        await EnsureAdminPermissionsAsync(services);
        await EnsureDefaultCustomerTypeAsync(context);
        await EnsureOperationDefaultsAsync(context);
        await EnsureAdminAsync(services);
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

    private static async Task EnsureDefaultCustomerTypeAsync(ApplicationDbContext context)
    {
        var hasGeneralCustomerType = await context.Types.AnyAsync(type =>
            type.Group == GeneralTypeEnum.CustomerType &&
            (type.Name == "General" || type.Name == "Default"));

        if (hasGeneralCustomerType)
            return;

        context.Types.Add(new GeneralType
        {
            Name = "General",
            Group = GeneralTypeEnum.CustomerType,
            SortOrder = 0
        });

        await context.SaveChangesAsync();
    }


    private static async Task EnsureOperationDefaultsAsync(ApplicationDbContext context)
    {
        var changed = false;
        var expenseCategoryNames = new[] { "Rent", "Utilities", "Transport", "Office", "Other" };
        var existingExpenseCategoryNames = await context.Types
            .Where(type => type.Group == GeneralTypeEnum.ExpenseCategory)
            .Select(type => type.Name)
            .ToListAsync();
        var missingExpenseCategories = expenseCategoryNames
            .Where(name => !existingExpenseCategoryNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            .Select((name, index) => new GeneralType
            {
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

        if (!await context.Warehouses.AnyAsync())
        {
            context.Warehouses.Add(new Warehouse
            {
                Name = "Main Warehouse",
                Code = "MAIN",
                IsActive = true
            });
            changed = true;
        }

        if (changed) await context.SaveChangesAsync();
    }

    private static async Task EnsureAdminAsync(IServiceProvider services)
    {
        var seed = services.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        var email = seed.Email?.Trim().ToLowerInvariant();

        // No credentials in configuration means seeding is intentionally disabled.
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(seed.Password))
            return;

        var userManager = services.GetRequiredService<UserManager<User>>();
        var admin = await userManager.FindByEmailAsync(email);

        if (admin is null)
        {
            admin = new User
            {
                UserName = email,
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

        if (await userManager.IsInRoleAsync(admin, AppRoles.Admin))
            return;

        var addRoleResult = await userManager.AddToRoleAsync(admin, AppRoles.Admin);
        if (!addRoleResult.Succeeded)
        {
            throw new InvalidOperationException(
                "Could not assign the admin role: " +
                string.Join(" ", addRoleResult.Errors.Select(error => error.Description)));
        }
    }
}
