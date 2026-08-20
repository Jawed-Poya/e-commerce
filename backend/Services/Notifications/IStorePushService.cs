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

    Task PublishAsync(
        StoreNotificationResponse notification,
        long? customerTypeId,
        CancellationToken cancellationToken = default);
}
