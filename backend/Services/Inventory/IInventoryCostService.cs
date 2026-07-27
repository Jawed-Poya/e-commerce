namespace ECommerce.Services.Inventory;

public interface IInventoryCostService
{
    Task<IReadOnlyDictionary<long, decimal>> GetCurrentUnitCostsAsync(
        IEnumerable<long> productIds,
        CancellationToken cancellationToken = default);
}
