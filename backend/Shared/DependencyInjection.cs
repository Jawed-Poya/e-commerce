namespace ECommerce.Shared;

using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Options;
using ECommerce.Services.Auth;
using ECommerce.Services.Customers;
using ECommerce.Services.Dashboard;
using ECommerce.Services.GeneralTypes;
using ECommerce.Services.Inventory;
using ECommerce.Services.Notifications;
using ECommerce.Services.Orders;
using ECommerce.Services.Operations;
using ECommerce.Services.Products;
using ECommerce.Services.Storefront;
using ECommerce.Services.Tenancy;
using ECommerce.Services.Reviews;
using ECommerce.Services.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

public static class DependencyInjection
{
    public static IServiceCollection AddCatalog(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(provider => provider.GetRequiredService<TenantContext>());
        services.AddScoped<ITenantPermissionService, TenantPermissionService>();
        services.AddScoped<ITenantManagementService, TenantManagementService>();
        services.AddScoped<IPlatformManagementService, PlatformManagementService>();
        services.AddScoped<ITenantPlanGuard, TenantPlanGuard>();
        services.AddSingleton<IStorefrontAccessTokenService, StorefrontAccessTokenService>();
        services.AddScoped<ITrashService, TrashService>();
        services.AddHostedService<TrashCleanupHostedService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IProductPricingService, ProductPricingService>();
        services.AddScoped<IGeneralTypeService, GeneralTypesService>();
        services.AddScoped<IProductImageStorage, LocalProductImageStorage>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<ICurrentCustomerAccessor, CurrentCustomerAccessor>();
        services.AddScoped<IDefaultCustomerTypeResolver, DefaultCustomerTypeResolver>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IStoreNotificationService, StoreNotificationService>();
        services.AddScoped<IAdminNotificationService, AdminNotificationService>();
        services.AddHostedService<AdminNotificationCleanupHostedService>();
        services.AddSingleton<AdminNotificationBroker>();
        services.AddSingleton<StoreRealtimeMetrics>();
        services.AddScoped<IAdminDashboardService, AdminDashboardService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<IStorefrontContentService, StorefrontContentService>();
        services.AddScoped<IProductReviewService, ProductReviewService>();
        services.AddScoped<IOperationsService, OperationsService>();

        return services;
    }

    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<CommerceOptions>(configuration.GetSection(CommerceOptions.SectionName));
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<SeedAdminOptions>(configuration.GetSection(SeedAdminOptions.SectionName));

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            // Tenant migrations are intentionally hand-authored and idempotent so
            // existing single-company databases can be upgraded safely. EF Core 10
            // otherwise treats the stale design-time snapshot as a startup error
            // before those compatibility migrations can run.
            options.ConfigureWarnings(warnings =>
                warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                sqlOptions =>
                {
                    sqlOptions.CommandTimeout(60);
                });
        });

        services
            .AddIdentity<User, Role>(ConfigureIdentity)
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        return services;
    }

    private static void ConfigureIdentity(IdentityOptions options)
    {
        options.Password.RequiredLength = 6;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = false;

        options.User.RequireUniqueEmail = false;
        options.SignIn.RequireConfirmedEmail = false;
        options.SignIn.RequireConfirmedPhoneNumber = false;

        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.MaxFailedAccessAttempts = 5;
    }
}
