using ECommerce.Data;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Entities.Products;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Notifications;

public sealed class AdminNotificationService(
    ApplicationDbContext context,
    AdminNotificationBroker broker,
    ILogger<AdminNotificationService> logger) : IAdminNotificationService
{
    private const string OrderCreatedEntityType = "Admin:OrderCreated";
    private const string OrderStatusEntityType = "Admin:OrderStatus";
    private const string PaymentStatusEntityType = "Admin:PaymentStatus";
    private const string ReviewSubmittedEntityType = "Admin:ReviewSubmitted";

    public Task<PendingAdminNotification> CreateOrderCreatedAsync(
        long orderId,
        string orderNumber,
        string customerName,
        decimal total,
        string currency,
        CancellationToken cancellationToken = default)
    {
        var entity = new Notification
        {
            Title = $"New order {orderNumber}",
            Message = $"{customerName} placed an order for {total:0.##} {currency}.",
            Type = NotificationType.Order,
            EntityType = OrderCreatedEntityType,
            EntityId = orderId,
            UserId = null
        };
        context.Notifications.Add(entity);
        return Task.FromResult(new PendingAdminNotification(entity));
    }

    public Task<PendingAdminNotification> CreateOrderStatusChangedAsync(
        long orderId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default)
    {
        var entity = new Notification
        {
            Title = $"Order {orderNumber} updated",
            Message = $"Order status changed to {status}.",
            Type = NotificationType.Order,
            EntityType = OrderStatusEntityType,
            EntityId = orderId,
            UserId = null
        };
        context.Notifications.Add(entity);
        return Task.FromResult(new PendingAdminNotification(entity));
    }


    public Task<PendingAdminNotification> CreateReviewSubmittedAsync(
        ProductReview review,
        string productName,
        string customerName,
        CancellationToken cancellationToken = default)
    {
        var entity = new Notification
        {
            Title = $"New {review.Rating}-star review",
            Message = $"{customerName} reviewed {productName}. Approval is required before it appears publicly.",
            Type = NotificationType.Product,
            EntityType = ReviewSubmittedEntityType,
            EntityId = review.ProductId,
            UserId = null
        };
        context.Notifications.Add(entity);
        return Task.FromResult(new PendingAdminNotification(entity));
    }

    public Task<PendingAdminNotification> CreatePaymentStatusChangedAsync(
        long orderId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default)
    {
        var entity = new Notification
        {
            Title = $"Payment for {orderNumber}",
            Message = $"Payment status changed to {status}.",
            Type = NotificationType.Payment,
            EntityType = PaymentStatusEntityType,
            EntityId = orderId,
            UserId = null
        };
        context.Notifications.Add(entity);
        return Task.FromResult(new PendingAdminNotification(entity));
    }

    public Task PublishAsync(
        PendingAdminNotification? notification,
        CancellationToken cancellationToken = default)
    {
        if (notification is null || notification.Entity.Id <= 0)
            return Task.CompletedTask;

        try
        {
            broker.Publish(notification.Entity.TenantId, Map(notification.Entity));
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Could not publish admin notification {NotificationId}.",
                notification.Entity.Id);
        }

        return Task.CompletedTask;
    }

    public async Task<AdminNotificationsResponse> GetAsync(
        DateTime? after,
        int take,
        CancellationToken cancellationToken = default)
    {
        var serverTime = DateTime.UtcNow;
        var retentionDays = await context.TenantSettings.AsNoTracking()
            .Select(item => (int?)item.NotificationRetentionDays)
            .FirstOrDefaultAsync(cancellationToken) ?? 30;
        var earliestAvailable = serverTime.AddDays(-Math.Clamp(retentionDays, 1, 365));
        var threshold = after?.ToUniversalTime() ?? serverTime.AddDays(-2);
        if (threshold < earliestAvailable) threshold = earliestAvailable;

        var items = await context.Notifications
            .AsNoTracking()
            .Where(notification =>
                !notification.IsDeleted &&
                notification.UserId == null &&
                notification.EntityType != null &&
                notification.EntityType.StartsWith("Admin:") &&
                notification.CreatedAt > threshold)
            .OrderByDescending(notification => notification.CreatedAt)
            .Take(Math.Clamp(take, 1, 100))
            .Select(notification => new AdminNotificationResponse(
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type == NotificationType.Payment
                    ? "Payment"
                    : notification.Type == NotificationType.Product ? "Review" : "Order",
                notification.EntityId,
                notification.Type == NotificationType.Product
                    ? "/reviews"
                    : notification.EntityId.HasValue ? $"/orders/{notification.EntityId.Value}" : "/orders",
                notification.CreatedAt))
            .ToListAsync(cancellationToken);

        return new AdminNotificationsResponse(serverTime, items);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken = default)
    {
        var notification = await context.Notifications.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Notification not found.");
        notification.IsDeleted = true;
        notification.DeletedAt = DateTime.UtcNow;
        notification.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    public Task<int> ClearAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        return context.Notifications
            .Where(item => !item.IsDeleted && item.UserId == null &&
                item.EntityType != null && item.EntityType.StartsWith("Admin:"))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(item => item.IsDeleted, true)
                .SetProperty(item => item.DeletedAt, now)
                .SetProperty(item => item.UpdatedAt, now), cancellationToken);
    }

    public async Task<int> CleanupExpiredAsync(CancellationToken cancellationToken = default)
    {
        var settings = await context.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .ToDictionaryAsync(
                item => item.TenantId,
                item => Math.Clamp(item.NotificationRetentionDays, 1, 365),
                cancellationToken);
        var tenantIds = await context.Tenants.IgnoreQueryFilters().AsNoTracking()
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var removed = 0;

        foreach (var tenantId in tenantIds)
        {
            var cutoff = now.AddDays(-settings.GetValueOrDefault(tenantId, 30));
            removed += await context.Notifications.IgnoreQueryFilters()
                .Where(item => item.TenantId == tenantId &&
                    item.EntityType != null &&
                    item.EntityType.StartsWith("Admin:") &&
                    item.CreatedAt <= cutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }

        return removed;
    }

    private static AdminNotificationResponse Map(Notification notification) =>
        new(
            notification.Id,
            notification.Title,
            notification.Message,
            notification.Type == NotificationType.Payment
                ? "Payment"
                : notification.Type == NotificationType.Product ? "Review" : "Order",
            notification.EntityId,
            notification.Type == NotificationType.Product
                ? "/reviews"
                : notification.EntityId.HasValue ? $"/orders/{notification.EntityId.Value}" : "/orders",
            notification.CreatedAt);
}


public sealed class AdminNotificationCleanupHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<AdminNotificationCleanupHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var tenantContext = scope.ServiceProvider.GetRequiredService<ECommerce.Services.Tenancy.TenantContext>();
                tenantContext.Initialize(1, null, "notification-cleanup", true);
                var service = scope.ServiceProvider.GetRequiredService<IAdminNotificationService>();
                var count = await service.CleanupExpiredAsync(stoppingToken);
                if (count > 0) logger.LogInformation("Permanently removed {Count} expired admin notifications.", count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception)
            {
                logger.LogError(exception, "Admin notification cleanup failed.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
