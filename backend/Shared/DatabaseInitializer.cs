using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Users;
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
        await context.Database.MigrateAsync();

        var roleManager = services.GetRequiredService<RoleManager<Role>>();
        foreach (var roleName in new[] { AppRoles.Admin, AppRoles.Customer })
        {
            if (await roleManager.RoleExistsAsync(roleName)) continue;

            var roleResult = await roleManager.CreateAsync(new Role
            {
                Name = roleName,
                Description = $"{roleName} application role"
            });
            if (!roleResult.Succeeded)
                throw new InvalidOperationException($"Could not create role '{roleName}': " +
                    string.Join(" ", roleResult.Errors.Select(error => error.Description)));
        }

        var hasGeneralCustomerType = await context.Types.AnyAsync(type =>
            type.Group == GeneralTypeEnum.CustomerType &&
            (type.Name == "General" || type.Name == "Default"));
        if (!hasGeneralCustomerType)
        {
            context.Types.Add(new GeneralType
            {
                Name = "General",
                Group = GeneralTypeEnum.CustomerType,
                SortOrder = 0
            });
            await context.SaveChangesAsync();
        }

        if (!app.Environment.IsDevelopment()) return;

        var seed = services.GetRequiredService<IOptions<SeedAdminOptions>>().Value;
        if (string.IsNullOrWhiteSpace(seed.Email) || string.IsNullOrWhiteSpace(seed.Password)) return;

        var userManager = services.GetRequiredService<UserManager<User>>();
        var admin = await userManager.FindByEmailAsync(seed.Email);
        if (admin is null)
        {
            admin = new User
            {
                UserName = seed.Email,
                Email = seed.Email,
                FullName = seed.FullName,
                IsActive = true,
                EmailConfirmed = true
            };
            var result = await userManager.CreateAsync(admin, seed.Password);
            if (!result.Succeeded)
                throw new InvalidOperationException("Could not seed admin user: " +
                    string.Join(" ", result.Errors.Select(error => error.Description)));
        }

        if (!await userManager.IsInRoleAsync(admin, AppRoles.Admin))
        {
            var addRoleResult = await userManager.AddToRoleAsync(admin, AppRoles.Admin);
            if (!addRoleResult.Succeeded)
                throw new InvalidOperationException("Could not assign the admin role: " +
                    string.Join(" ", addRoleResult.Errors.Select(error => error.Description)));
        }
    }
}
