using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Entities.Products;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Orders;

/// <summary>
/// Applies order inventory mutations in base units. Order lines are grouped by
/// product because the same product may be ordered in multiple selling units.
/// One product therefore produces one reservation/release/sale transaction per
/// order and operation.
/// </summary>
public sealed class OrderInventoryService(ApplicationDbContext context) : IOrderInventoryService
{
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

            var reservedBefore = inventory.ReservedQuantity;
            inventory.ReservedQuantity += line.Quantity;

            context.InventoryTransactions.Add(new InventoryTransaction
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
                Description = $"Stock reserved for order {order.OrderNumber}."
            });

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

            context.InventoryTransactions.Add(new InventoryTransaction
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
                Description = $"Reservation released for cancelled order {order.OrderNumber}."
            });

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

        foreach (var line in lines)
        {
            var key = BuildKey(order.Id, "sale", line.ProductId);
            if (existingKeys.Contains(key)) continue;

            var inventory = GetInventory(inventories, line);
            if (inventory.ReservedQuantity < line.Quantity || inventory.Quantity < line.Quantity)
                throw InconsistentReservation(line.ProductName);

            var quantityBefore = inventory.Quantity;
            var reservedBefore = inventory.ReservedQuantity;
            inventory.Quantity -= line.Quantity;
            inventory.ReservedQuantity -= line.Quantity;

            context.InventoryTransactions.Add(new InventoryTransaction
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
                Description = $"Stock sold for delivered order {order.OrderNumber}."
            });

            existingKeys.Add(key);
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

        // Include unsaved transactions already tracked in this unit of work so a
        // duplicate can never be added before SaveChanges reaches SQL Server.
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
        new($"Reserved stock is inconsistent for '{productName}'. Refresh inventory and try again.");

    private static string BuildKey(long orderId, string operation, long productId) =>
        $"order:{orderId}:{operation}:{productId}";

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record OrderInventoryLine(
        long ProductId,
        string ProductName,
        decimal Quantity);
}
