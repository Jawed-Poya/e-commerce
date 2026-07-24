using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Entities.Products;

namespace ECommerce.Services.Notifications;

public interface IAdminNotificationService
{
    Task<PendingAdminNotification> CreateOrderCreatedAsync(
        long orderId,
        string orderNumber,
        string customerName,
        decimal total,
        string currency,
        CancellationToken cancellationToken = default);

    Task<PendingAdminNotification> CreateOrderStatusChangedAsync(
        long orderId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default);

    Task<PendingAdminNotification> CreateReviewSubmittedAsync(
        ProductReview review,
        string productName,
        string customerName,
        CancellationToken cancellationToken = default);

    Task<PendingAdminNotification> CreatePaymentStatusChangedAsync(
        long orderId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default);

    Task PublishAsync(
        PendingAdminNotification? notification,
        CancellationToken cancellationToken = default);

    Task<AdminNotificationsResponse> GetAsync(
        DateTime? after,
        int take,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(long id, CancellationToken cancellationToken = default);
    Task<int> ClearAsync(CancellationToken cancellationToken = default);
    Task<int> CleanupExpiredAsync(CancellationToken cancellationToken = default);
}
