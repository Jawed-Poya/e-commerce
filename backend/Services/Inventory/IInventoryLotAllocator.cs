using ECommerce.Entities.Products;

namespace ECommerce.Services.Inventory;

public sealed record InventoryLotAllocation(
    InventoryLot Lot,
    decimal Quantity);

public interface IInventoryLotAllocator
{
    Task<IReadOnlyList<InventoryLotAllocation>> ReserveFefoAsync(
        long productId,
        decimal quantity,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InventoryLotAllocation>> ConsumeFefoAsync(
        long productId,
        decimal quantity,
        CancellationToken cancellationToken = default);

    Task<InventoryLotAllocation> ApplyAdjustmentAsync(
        long productId,
        long lotId,
        decimal quantityDelta,
        InventoryTransactionType type,
        CancellationToken cancellationToken = default);
}
