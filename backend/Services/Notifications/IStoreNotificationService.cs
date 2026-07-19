using ECommerce.Entities.Notifications.Contracts;

namespace ECommerce.Services.Notifications;

public interface IStoreNotificationService
{
    Task CreatePriceChangedAsync(
        long productId,
        long customerTypeId,
        decimal? previousPrice,
        decimal newPrice,
        CancellationToken cancellationToken = default);

    Task CreateStockIncreasedAsync(
        long productId,
        decimal previousAvailable,
        decimal newAvailable,
        CancellationToken cancellationToken = default);

    Task<StoreNotificationsResponse> GetStoreNotificationsAsync(
        DateTime? after,
        IReadOnlyCollection<long> productIds,
        CancellationToken cancellationToken = default);
}
