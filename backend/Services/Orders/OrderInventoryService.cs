using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Entities.Products;
using ECommerce.Services.Inventory;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Orders;

/// <summary>
/// Applies order inventory mutations in base units. Physical stock is reserved
/// by FEFO lot at checkout, released from those exact lots when cancelled, and
/// committed from the same lots when delivered.
/// </summary>
public sealed class OrderInventoryService(
    ApplicationDbContext context,
    IInventoryLotAllocator lotAllocator) : IOrderInventoryService
{
    private const decimal QuantityTolerance = 0.0005m;

    public async Task ReserveAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var lines = BuildInventoryLines(order);
        if (lines.Count == 0) return;

        var existingKeys = await LoadExistingKeysAsync(
            lines.Select(line => BuildKey(order.Id, "reserve", line.ProductId)),
            cancellationToken);
        var inventories = await LoadInventoriesAsync(lines, cancellationToken);

        foreach (var line in lines)
        {
            var key = BuildKey(order.Id, "reserve", line.ProductId);
            if (existingKeys.Contains(key)) continue;

            var inventory = GetInventory(inventories, line);
            var availableQuantity = inventory.Quantity - inventory.ReservedQuantity;
            if (availableQuantity < line.Quantity)
                throw new InvalidOperationException(
                    $"Insufficient stock for '{line.ProductName}'. Refresh inventory and try again.");

            var allocations = await lotAllocator.ReserveFefoAsync(
                line.ProductId,
                line.Quantity,
                cancellationToken);
            var reservedBefore = inventory.ReservedQuantity;
            inventory.ReservedQuantity += line.Quantity;

            var inventoryTransaction = new InventoryTransaction
            {
                ProductId = line.ProductId,
                Type = InventoryTransactionType.Reservation,
                Quantity = 0,
                QuantityBefore = inventory.Quantity,
                QuantityAfter = inventory.Quantity,
                ReservedBefore = reservedBefore,
                ReservedAfter = inventory.ReservedQuantity,
                ReferenceType = "Order",
                ReferenceId = order.Id,
                IdempotencyKey = key,
                PerformedByUserId = Clean(userId),
                Description = $"Stock reserved by FEFO for order {order.OrderNumber}."
            };
            AddLotMovements(inventoryTransaction, allocations, quantitySign: 0, reservedSign: 1);
            context.InventoryTransactions.Add(inventoryTransaction);
            existingKeys.Add(key);
        }
    }

    public async Task<IReadOnlyCollection<InventoryAvailabilityChange>> ReleaseReservationsAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var lines = BuildInventoryLines(order);
        if (lines.Count == 0) return [];

        var existingKeys = await LoadExistingKeysAsync(
            lines.Select(line => BuildKey(order.Id, "release", line.ProductId)),
            cancellationToken);
        var inventories = await LoadInventoriesAsync(lines, cancellationToken);
        var reservations = await LoadReservationMovementsAsync(order.Id, cancellationToken);
        var changes = new List<InventoryAvailabilityChange>(lines.Count);

        foreach (var line in lines)
        {
            var key = BuildKey(order.Id, "release", line.ProductId);
            if (existingKeys.Contains(key)) continue;

            var inventory = GetInventory(inventories, line);
            if (inventory.ReservedQuantity < line.Quantity)
                throw InconsistentReservation(line.ProductName);

            var reservedBefore = inventory.ReservedQuantity;
            var availableBefore = inventory.Quantity - reservedBefore;
            inventory.ReservedQuantity -= line.Quantity;
            var availableAfter = inventory.Quantity - inventory.ReservedQuantity;

            var inventoryTransaction = new InventoryTransaction
            {
                ProductId = line.ProductId,
                Type = InventoryTransactionType.ReservationRelease,
                Quantity = 0,
                QuantityBefore = inventory.Quantity,
                QuantityAfter = inventory.Quantity,
                ReservedBefore = reservedBefore,
                ReservedAfter = inventory.ReservedQuantity,
                ReferenceType = "Order",
                ReferenceId = order.Id,
                IdempotencyKey = key,
                PerformedByUserId = Clean(userId),
                Description = $"Lot reservation released for cancelled order {order.OrderNumber}."
            };

            IReadOnlyList<InventoryLotAllocation> released;
            if (reservations.TryGetValue(line.ProductId, out var reservedLots) && reservedLots.Count > 0)
                released = ReleaseExactLots(reservedLots, line.Quantity, line.ProductName);
            else
                released = await ReleaseLegacyReservedLotsAsync(
                    line.ProductId,
                    line.Quantity,
                    line.ProductName,
                    cancellationToken);

            AddLotMovements(inventoryTransaction, released, quantitySign: 0, reservedSign: -1);

            context.InventoryTransactions.Add(inventoryTransaction);
            existingKeys.Add(key);
            changes.Add(new InventoryAvailabilityChange(
                line.ProductId,
                availableBefore,
                availableAfter));
        }

        return changes;
    }

    public async Task CommitReservationsAsync(
        Order order,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var lines = BuildInventoryLines(order);
        if (lines.Count == 0) return;

        var existingKeys = await LoadExistingKeysAsync(
            lines.Select(line => BuildKey(order.Id, "sale", line.ProductId)),
            cancellationToken);
        var inventories = await LoadInventoriesAsync(lines, cancellationToken);
        var reservations = await LoadReservationMovementsAsync(order.Id, cancellationToken);

        foreach (var line in lines)
        {
            var key = BuildKey(order.Id, "sale", line.ProductId);
            if (existingKeys.Contains(key)) continue;

            var inventory = GetInventory(inventories, line);
            if (inventory.ReservedQuantity < line.Quantity || inventory.Quantity < line.Quantity)
                throw InconsistentReservation(line.ProductName);

            IReadOnlyList<InventoryLotAllocation> allocations;
            if (reservations.TryGetValue(line.ProductId, out var reservedLots) && reservedLots.Count > 0)
                allocations = CommitExactLots(reservedLots, line.Quantity, line.ProductName);
            else
                allocations = await CommitLegacyReservedLotsAsync(
                    line.ProductId,
                    line.Quantity,
                    line.ProductName,
                    cancellationToken);

            var quantityBefore = inventory.Quantity;
            var reservedBefore = inventory.ReservedQuantity;
            inventory.Quantity -= line.Quantity;
            inventory.ReservedQuantity -= line.Quantity;

            var inventoryTransaction = new InventoryTransaction
            {
                ProductId = line.ProductId,
                Type = InventoryTransactionType.Sale,
                Quantity = -line.Quantity,
                QuantityBefore = quantityBefore,
                QuantityAfter = inventory.Quantity,
                ReservedBefore = reservedBefore,
                ReservedAfter = inventory.ReservedQuantity,
                ReferenceType = "Order",
                ReferenceId = order.Id,
                IdempotencyKey = key,
                PerformedByUserId = Clean(userId),
                Description = $"Reserved lots sold for delivered order {order.OrderNumber}."
            };
            AddLotMovements(inventoryTransaction, allocations, quantitySign: -1, reservedSign: -1);
            context.InventoryTransactions.Add(inventoryTransaction);
            existingKeys.Add(key);
        }
    }

    private async Task<Dictionary<long, List<ReservedLotMovement>>> LoadReservationMovementsAsync(
        long orderId,
        CancellationToken cancellationToken)
    {
        var rows = await context.InventoryTransactionLots
            .Include(item => item.InventoryTransaction)
            .Where(item =>
                item.InventoryTransaction.ReferenceType == "Order" &&
                item.InventoryTransaction.ReferenceId == orderId &&
                item.InventoryTransaction.Type == InventoryTransactionType.Reservation &&
                item.ReservedDelta > 0 &&
                item.InventoryLotId.HasValue)
            .Include(item => item.InventoryLot!)
                .ThenInclude(lot => lot.Warehouse)
            .OrderBy(item => item.Id)
            .ToListAsync(cancellationToken);

        return rows
            .Where(item => item.InventoryLot is not null)
            .GroupBy(item => item.InventoryTransaction.ProductId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => new ReservedLotMovement(
                    item.InventoryLot!,
                    item.ReservedDelta)).ToList());
    }

    private Task<IReadOnlyList<InventoryLotAllocation>> ReleaseLegacyReservedLotsAsync(
        long productId,
        decimal quantity,
        string productName,
        CancellationToken cancellationToken) =>
        MutateLegacyReservedLotsAsync(
            productId,
            quantity,
            productName,
            commitQuantity: false,
            cancellationToken);

    private Task<IReadOnlyList<InventoryLotAllocation>> CommitLegacyReservedLotsAsync(
        long productId,
        decimal quantity,
        string productName,
        CancellationToken cancellationToken) =>
        MutateLegacyReservedLotsAsync(
            productId,
            quantity,
            productName,
            commitQuantity: true,
            cancellationToken);

    private async Task<IReadOnlyList<InventoryLotAllocation>> MutateLegacyReservedLotsAsync(
        long productId,
        decimal requiredQuantity,
        string productName,
        bool commitQuantity,
        CancellationToken cancellationToken)
    {
        var lots = await context.InventoryLots
            .Include(lot => lot.Warehouse)
            .Where(lot => lot.ProductId == productId && lot.ReservedQuantity > 0)
            .OrderBy(lot => lot.ExpiresAt == null)
            .ThenBy(lot => lot.ExpiresAt)
            .ThenBy(lot => lot.CreatedAt)
            .ThenBy(lot => lot.Id)
            .ToListAsync(cancellationToken);

        var remaining = requiredQuantity;
        var result = new List<InventoryLotAllocation>(lots.Count);
        foreach (var lot in lots)
        {
            if (remaining <= QuantityTolerance) break;

            var quantity = Math.Min(lot.ReservedQuantity, remaining);
            if (commitQuantity && lot.ExpiresAt.HasValue &&
                lot.ExpiresAt.Value < DateOnly.FromDateTime(DateTime.UtcNow))
                throw ExpiredReservation(productName, lot);
            if (commitQuantity && lot.Quantity + QuantityTolerance < quantity)
                throw InconsistentReservation(productName);

            lot.ReservedQuantity -= quantity;
            if (commitQuantity)
                lot.Quantity -= quantity;

            lot.UpdatedAt = DateTime.UtcNow;
            result.Add(new InventoryLotAllocation(lot, quantity));
            remaining -= quantity;
        }

        if (remaining > QuantityTolerance)
            throw InconsistentReservation(productName);

        return result;
    }

    private static IReadOnlyList<InventoryLotAllocation> ReleaseExactLots(
        IReadOnlyList<ReservedLotMovement> reservedLots,
        decimal requiredQuantity,
        string productName)
    {
        var remaining = requiredQuantity;
        var result = new List<InventoryLotAllocation>(reservedLots.Count);
        foreach (var reserved in reservedLots)
        {
            if (remaining <= QuantityTolerance) break;
            var quantity = Math.Min(reserved.Quantity, remaining);
            if (reserved.Lot.ReservedQuantity + QuantityTolerance < quantity)
                throw InconsistentReservation(productName);

            reserved.Lot.ReservedQuantity -= quantity;
            reserved.Lot.UpdatedAt = DateTime.UtcNow;
            result.Add(new InventoryLotAllocation(reserved.Lot, quantity));
            remaining -= quantity;
        }

        if (remaining > QuantityTolerance)
            throw InconsistentReservation(productName);

        return result;
    }

    private static IReadOnlyList<InventoryLotAllocation> CommitExactLots(
        IReadOnlyList<ReservedLotMovement> reservedLots,
        decimal requiredQuantity,
        string productName)
    {
        var remaining = requiredQuantity;
        var result = new List<InventoryLotAllocation>(reservedLots.Count);
        foreach (var reserved in reservedLots)
        {
            if (remaining <= QuantityTolerance) break;
            var quantity = Math.Min(reserved.Quantity, remaining);
            if (reserved.Lot.ExpiresAt.HasValue &&
                reserved.Lot.ExpiresAt.Value < DateOnly.FromDateTime(DateTime.UtcNow))
                throw ExpiredReservation(productName, reserved.Lot);
            if (reserved.Lot.ReservedQuantity + QuantityTolerance < quantity ||
                reserved.Lot.Quantity + QuantityTolerance < quantity)
                throw InconsistentReservation(productName);

            reserved.Lot.Quantity -= quantity;
            reserved.Lot.ReservedQuantity -= quantity;
            reserved.Lot.UpdatedAt = DateTime.UtcNow;
            result.Add(new InventoryLotAllocation(reserved.Lot, quantity));
            remaining -= quantity;
        }

        if (remaining > QuantityTolerance)
            throw InconsistentReservation(productName);

        return result;
    }

    private static void AddLotMovements(
        InventoryTransaction transaction,
        IEnumerable<InventoryLotAllocation> allocations,
        int quantitySign,
        int reservedSign)
    {
        foreach (var allocation in allocations)
        {
            transaction.Lots.Add(new InventoryTransactionLot
            {
                InventoryLot = allocation.Lot,
                InventoryLotId = allocation.Lot.Id > 0 ? allocation.Lot.Id : null,
                LotNumber = allocation.Lot.LotNumber,
                WarehouseId = allocation.Lot.WarehouseId,
                WarehouseName = allocation.Lot.Warehouse.Name,
                ExpiresAt = allocation.Lot.ExpiresAt,
                QuantityDelta = allocation.Quantity * quantitySign,
                ReservedDelta = allocation.Quantity * reservedSign,
                UnitCost = allocation.Lot.UnitCost
            });
        }
    }

    private async Task<Dictionary<long, API.Entities.Products.ProductInventory>> LoadInventoriesAsync(
        IReadOnlyCollection<OrderInventoryLine> lines,
        CancellationToken cancellationToken)
    {
        var productIds = lines.Select(line => line.ProductId).ToArray();
        return await context.ProductInventories
            .Where(inventory => productIds.Contains(inventory.ProductId))
            .ToDictionaryAsync(inventory => inventory.ProductId, cancellationToken);
    }

    private async Task<HashSet<string>> LoadExistingKeysAsync(
        IEnumerable<string> keys,
        CancellationToken cancellationToken)
    {
        var keyArray = keys.Distinct(StringComparer.Ordinal).ToArray();
        var existing = await context.InventoryTransactions
            .Where(transaction => transaction.IdempotencyKey != null && keyArray.Contains(transaction.IdempotencyKey))
            .Select(transaction => transaction.IdempotencyKey!)
            .ToListAsync(cancellationToken);

        existing.AddRange(context.InventoryTransactions.Local
            .Select(transaction => transaction.IdempotencyKey)
            .Where(key => key is not null && keyArray.Contains(key))
            .Select(key => key!));

        return existing.ToHashSet(StringComparer.Ordinal);
    }

    private static IReadOnlyList<OrderInventoryLine> BuildInventoryLines(Order order) =>
        order.Items
            .Where(item => item.AffectsInventory)
            .GroupBy(item => item.ProductId)
            .Select(group => new OrderInventoryLine(
                group.Key,
                group.Select(item => item.ProductName).FirstOrDefault() ?? $"Product #{group.Key}",
                group.Sum(item => item.Quantity)))
            .Where(line => line.Quantity > 0)
            .ToArray();

    private static API.Entities.Products.ProductInventory GetInventory(
        IReadOnlyDictionary<long, API.Entities.Products.ProductInventory> inventories,
        OrderInventoryLine line)
    {
        if (inventories.TryGetValue(line.ProductId, out var inventory)) return inventory;
        throw InconsistentReservation(line.ProductName);
    }

    private static InvalidOperationException InconsistentReservation(string productName) =>
        new($"Reserved lot stock is inconsistent for '{productName}'. Review the lot ledger before continuing.");

    private static InvalidOperationException ExpiredReservation(string productName, InventoryLot lot) =>
        new($"Reserved lot '{(string.IsNullOrWhiteSpace(lot.LotNumber) ? $"#{lot.Id}" : lot.LotNumber)}' " +
            $"for '{productName}' expired before fulfillment. Cancel or re-reserve the order from a sellable lot.");

    private static string BuildKey(long orderId, string operation, long productId) =>
        $"order:{orderId}:{operation}:{productId}";

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record OrderInventoryLine(
        long ProductId,
        string ProductName,
        decimal Quantity);

    private sealed record ReservedLotMovement(
        InventoryLot Lot,
        decimal Quantity);
}
