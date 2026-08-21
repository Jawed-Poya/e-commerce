using ECommerce.Entities.Notifications.Contracts;

namespace ECommerce.Services.Notifications;

public interface IStorePushService
{
    Task<StorePushPublicKeyResponse> GetPublicKeyAsync(
        CancellationToken cancellationToken = default);

    Task SaveSubscriptionAsync(
        StorePushSubscriptionRequest request,
        CancellationToken cancellationToken = default);

    Task RemoveSubscriptionAsync(
        string endpoint,
        CancellationToken cancellationToken = default);

    Task SaveMobileSubscriptionAsync(
        MobilePushSubscriptionRequest request,
        CancellationToken cancellationToken = default);

    Task RemoveMobileSubscriptionAsync(
        string token,
        string deviceId,
        CancellationToken cancellationToken = default);

    Task PublishAsync(
        StoreNotificationResponse notification,
        long? customerTypeId,
        CancellationToken cancellationToken = default);

    Task PublishOrderAsync(
        long customerId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default);
}
