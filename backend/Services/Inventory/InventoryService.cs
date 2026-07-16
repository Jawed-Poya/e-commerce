using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Products;
using ECommerce.Entities.Products.Contracts;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Inventory;

public sealed class InventoryService(ApplicationDbContext context) : IInventoryService
{
    public async Task<StockResult?> GetAsync(long productId, CancellationToken ct = default) =>
        await context.ProductInventories.AsNoTracking().Where(x => x.ProductId == productId)
            .Select(x => new StockResult(x.ProductId, x.Quantity, x.ReservedQuantity, x.Quantity - x.ReservedQuantity))
            .SingleOrDefaultAsync(ct);

    public Task<StockResult> AdjustAsync(long productId, AdjustStockRequest request, string? userId, CancellationToken ct = default)
    {
        if (request.Quantity == 0) throw new ArgumentException("Quantity adjustment cannot be zero.");
        return MutateAsync(productId, request.Quantity, 0, request.Type, request.Description, null, request.IdempotencyKey, userId, ct);
    }

    public Task<StockResult> ReserveAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateAsync(productId, 0, request.Quantity, InventoryTransactionType.Reservation, "Stock reserved.", request.OrderId, request.IdempotencyKey, userId, ct);
    }

    public Task<StockResult> ReleaseAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateAsync(productId, 0, -request.Quantity, InventoryTransactionType.ReservationRelease, "Stock reservation released.", request.OrderId, request.IdempotencyKey, userId, ct);
    }

    public Task<StockResult> CommitSaleAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateAsync(productId, -request.Quantity, -request.Quantity, InventoryTransactionType.Sale, "Reserved stock sold.", request.OrderId, request.IdempotencyKey, userId, ct);
    }

    private async Task<StockResult> MutateAsync(long productId, decimal quantityDelta, decimal reservedDelta, InventoryTransactionType type, string? description, long? referenceId, string? idempotencyKey, string? userId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey) && await context.InventoryTransactions.AnyAsync(x => x.IdempotencyKey == idempotencyKey, ct))
            return await GetAsync(productId, ct) ?? throw new KeyNotFoundException("Product inventory not found.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var before = await context.ProductInventories.AsNoTracking().SingleOrDefaultAsync(x => x.ProductId == productId, ct)
            ?? throw new KeyNotFoundException("Product inventory not found.");

        var affected = await context.ProductInventories.Where(x => x.ProductId == productId
                && x.Quantity + quantityDelta >= 0
                && x.ReservedQuantity + reservedDelta >= 0
                && x.ReservedQuantity + reservedDelta <= x.Quantity + quantityDelta)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Quantity, x => x.Quantity + quantityDelta)
                .SetProperty(x => x.ReservedQuantity, x => x.ReservedQuantity + reservedDelta), ct);

        if (affected != 1) throw new InvalidOperationException("Insufficient available or reserved stock.");

        var after = await context.ProductInventories.AsNoTracking().SingleAsync(x => x.ProductId == productId, ct);
        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId, Quantity = quantityDelta, Type = type, Description = description,
            QuantityBefore = before.Quantity, QuantityAfter = after.Quantity,
            ReservedBefore = before.ReservedQuantity, ReservedAfter = after.ReservedQuantity,
            ReferenceType = referenceId.HasValue ? "Order" : null, ReferenceId = referenceId,
            IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey.Trim(),
            PerformedByUserId = userId
        });
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new StockResult(productId, after.Quantity, after.ReservedQuantity, after.Quantity - after.ReservedQuantity);
    }

    private static void RequirePositive(decimal quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be greater than zero.");
    }
}
