namespace ECommerce.Services.Notifications;

public interface IInventoryExpiryAlertService
{
    Task<int> GenerateAsync(CancellationToken cancellationToken = default);
}
