using ECommerce.Data;
using ECommerce.Entities.Products;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Inventory;

/// <summary>
/// Central lot allocator. Sellable lots follow FEFO (first-expire, first-out),
/// while lots without an expiry date fall back to FIFO by receipt date.
/// Expired lots are never allocated to a sale or reservation.
/// </summary>
public sealed class InventoryLotAllocator(ApplicationDbContext context) : IInventoryLotAllocator
{
    private const decimal QuantityTolerance = 0.0005m;

    public Task<IReadOnlyList<InventoryLotAllocation>> ReserveFefoAsync(
        long productId,
        decimal quantity,
        CancellationToken cancellationToken = default) =>
        AllocateFefoAsync(productId, quantity, reserve: true, cancellationToken);

    public Task<IReadOnlyList<InventoryLotAllocation>> ConsumeFefoAsync(
        long productId,
        decimal quantity,
        CancellationToken cancellationToken = default) =>
        AllocateFefoAsync(productId, quantity, reserve: false, cancellationToken);

    public async Task<InventoryLotAllocation> ApplyAdjustmentAsync(
        long productId,
        long lotId,
        decimal quantityDelta,
        InventoryTransactionType type,
        CancellationToken cancellationToken = default)
    {
        if (quantityDelta == 0)
            throw new ArgumentException("Quantity adjustment cannot be zero.");

        await EnsureLegacyLotAsync(productId, cancellationToken);

        var lot = await context.InventoryLots
            .Include(item => item.Warehouse)
            .SingleOrDefaultAsync(item => item.Id == lotId && item.ProductId == productId, cancellationToken)
            ?? throw new KeyNotFoundException("The selected lot or batch was not found.");

        if (quantityDelta < 0)
        {
            var required = -quantityDelta;
            var available = lot.Quantity - lot.ReservedQuantity;
            if (available + QuantityTolerance < required)
                throw new InvalidOperationException(
                    $"Lot '{DisplayLot(lot)}' has only {Math.Max(0, available):N3} available unit(s).");

            if (type == InventoryTransactionType.Expired)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                if (!lot.ExpiresAt.HasValue || lot.ExpiresAt.Value >= today)
                    throw new InvalidOperationException(
                        $"Lot '{DisplayLot(lot)}' is not expired yet. Use a stock correction or damaged-stock movement instead.");
            }
        }

        lot.Quantity += quantityDelta;
        lot.UpdatedAt = DateTime.UtcNow;
        return new InventoryLotAllocation(lot, Math.Abs(quantityDelta));
    }

    private async Task<IReadOnlyList<InventoryLotAllocation>> AllocateFefoAsync(
        long productId,
        decimal quantity,
        bool reserve,
        CancellationToken cancellationToken)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantity must be greater than zero.");

        var legacyLot = await EnsureLegacyLotAsync(productId, cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var lots = await context.InventoryLots
            .Include(item => item.Warehouse)
            .Where(item => item.ProductId == productId &&
                item.Quantity - item.ReservedQuantity > 0 &&
                (!item.ExpiresAt.HasValue || item.ExpiresAt.Value >= today))
            .OrderBy(item => item.ExpiresAt == null)
            .ThenBy(item => item.ExpiresAt)
            .ThenBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        if (legacyLot is not null &&
            legacyLot.Quantity - legacyLot.ReservedQuantity > 0 &&
            lots.All(item => item != legacyLot && (legacyLot.Id <= 0 || item.Id != legacyLot.Id)))
        {
            lots.Add(legacyLot);
            lots = lots
                .OrderBy(item => item.ExpiresAt == null)
                .ThenBy(item => item.ExpiresAt)
                .ThenBy(item => item.CreatedAt)
                .ThenBy(item => item.Id)
                .ToList();
        }

        var remaining = quantity;
        var allocations = new List<InventoryLotAllocation>();
        foreach (var lot in lots)
        {
            if (remaining <= QuantityTolerance) break;

            var available = lot.Quantity - lot.ReservedQuantity;
            if (available <= 0) continue;

            var allocated = Math.Min(available, remaining);
            if (reserve)
                lot.ReservedQuantity += allocated;
            else
                lot.Quantity -= allocated;

            lot.UpdatedAt = DateTime.UtcNow;
            allocations.Add(new InventoryLotAllocation(lot, allocated));
            remaining -= allocated;
        }

        if (remaining > QuantityTolerance)
        {
            var sellable = quantity - remaining;
            throw new InvalidOperationException(
                $"Only {sellable:N3} sellable unit(s) are available in unexpired lots. Expired stock cannot be sold or reserved.");
        }

        return allocations;
    }

    private async Task<InventoryLot?> EnsureLegacyLotAsync(long productId, CancellationToken cancellationToken)
    {
        var inventory = await context.ProductInventories
            .SingleOrDefaultAsync(item => item.ProductId == productId, cancellationToken)
            ?? throw new KeyNotFoundException("Product inventory was not found.");

        var trackedQuantity = await context.InventoryLots
            .Where(item => item.ProductId == productId)
            .SumAsync(item => (decimal?)item.Quantity, cancellationToken) ?? 0;
        var unassignedQuantity = inventory.Quantity - trackedQuantity;
        if (unassignedQuantity <= QuantityTolerance) return null;

        var warehouse = await context.Warehouses
            .OrderBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException(
                "A warehouse is required before legacy stock can be assigned to a traceable lot.");

        var legacyNumber = $"LEGACY-{productId}";
        var legacyLot = await context.InventoryLots.SingleOrDefaultAsync(item =>
            item.ProductId == productId &&
            item.WarehouseId == warehouse.Id &&
            item.LotNumber == legacyNumber,
            cancellationToken);

        if (legacyLot is null)
        {
            legacyLot = new InventoryLot
            {
                ProductId = productId,
                WarehouseId = warehouse.Id,
                Warehouse = warehouse,
                LotNumber = legacyNumber,
                Quantity = 0,
                ReservedQuantity = 0,
                ExpiresAt = inventory.ExpireDate
            };
            context.InventoryLots.Add(legacyLot);
        }
        else if (!legacyLot.ExpiresAt.HasValue && inventory.ExpireDate.HasValue)
        {
            // Older inventory records stored expiry at product-inventory level.
            // Carry it into the traceable legacy lot so expired stock cannot be sold.
            legacyLot.ExpiresAt = inventory.ExpireDate;
        }

        legacyLot.Quantity += unassignedQuantity;
        legacyLot.UpdatedAt = DateTime.UtcNow;
        return legacyLot;
    }

    private static string DisplayLot(InventoryLot lot) =>
        string.IsNullOrWhiteSpace(lot.LotNumber) ? $"#{lot.Id}" : lot.LotNumber;
}
