using ECommerce.Data;
using ECommerce.Entities.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public interface ITenantPlanGuard
{
    Task EnsureUserCapacityAsync(int additionalUsers = 1, CancellationToken cancellationToken = default);
    Task EnsureProductCapacityAsync(int additionalProducts = 1, CancellationToken cancellationToken = default);
    Task<TenantSubscription?> GetCurrentSubscriptionAsync(CancellationToken cancellationToken = default);
}

public sealed class TenantPlanGuard(
    ApplicationDbContext context,
    ITenantContext tenantContext) : ITenantPlanGuard
{
    public async Task EnsureUserCapacityAsync(int additionalUsers = 1, CancellationToken cancellationToken = default)
    {
        if (tenantContext.IsPlatformAdmin) return;
        var subscription = await GetRequiredSubscriptionAsync(cancellationToken);
        var current = await context.Users.CountAsync(item => item.TenantId == tenantContext.TenantId && item.IsActive, cancellationToken);
        if (current + Math.Max(1, additionalUsers) > subscription.MaxUsers)
            throw new InvalidOperationException($"Your {subscription.Plan} subscription allows {subscription.MaxUsers} active users. Upgrade the plan to add more users.");
    }

    public async Task EnsureProductCapacityAsync(int additionalProducts = 1, CancellationToken cancellationToken = default)
    {
        if (tenantContext.IsPlatformAdmin) return;
        var subscription = await GetRequiredSubscriptionAsync(cancellationToken);
        var current = await context.Products.CountAsync(cancellationToken);
        if (current + Math.Max(1, additionalProducts) > subscription.MaxProducts)
            throw new InvalidOperationException($"Your {subscription.Plan} subscription allows {subscription.MaxProducts} products. Upgrade the plan to add more products.");
    }

    public async Task<TenantSubscription?> GetCurrentSubscriptionAsync(CancellationToken cancellationToken = default) =>
        await context.TenantSubscriptions.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .OrderByDescending(item => item.StartsAt)
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<TenantSubscription> GetRequiredSubscriptionAsync(CancellationToken cancellationToken)
    {
        var subscription = await GetCurrentSubscriptionAsync(cancellationToken)
            ?? throw new InvalidOperationException("This company has no active subscription.");
        if (subscription.Status is SubscriptionStatus.Suspended or SubscriptionStatus.Cancelled or SubscriptionStatus.Expired)
            throw new InvalidOperationException("This company subscription is not active.");
        if (subscription.EndsAt.HasValue && subscription.EndsAt.Value < DateTime.UtcNow)
            throw new InvalidOperationException("This company subscription has expired.");
        return subscription;
    }
}
