using ECommerce.Data;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Notifications.Contracts;
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
            broker.Publish(Map(notification.Entity));
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
        var threshold = after?.ToUniversalTime() ?? serverTime.AddDays(-2);
        if (threshold < serverTime.AddDays(-30)) threshold = serverTime.AddDays(-30);

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
                notification.Type == NotificationType.Payment ? "Payment" : "Order",
                notification.EntityId,
                notification.EntityId.HasValue ? $"/orders/{notification.EntityId.Value}" : "/orders",
                notification.CreatedAt))
            .ToListAsync(cancellationToken);

        return new AdminNotificationsResponse(serverTime, items);
    }

    private static AdminNotificationResponse Map(Notification notification) =>
        new(
            notification.Id,
            notification.Title,
            notification.Message,
            notification.Type == NotificationType.Payment ? "Payment" : "Order",
            notification.EntityId,
            notification.EntityId.HasValue ? $"/orders/{notification.EntityId.Value}" : "/orders",
            notification.CreatedAt);
}
