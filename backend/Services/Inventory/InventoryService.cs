using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Filters;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Inventory;

public sealed class InventoryService(ApplicationDbContext context) : IInventoryService
{
    public async Task<InventoryOverviewResponse> GetOverviewAsync(InventoryFilter filter, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var expiringThreshold = today.AddDays(30);
        var baseQuery = context.Products.AsNoTracking().Where(x => !x.IsDeleted);

        var totals = await baseQuery
            .GroupBy(_ => 1)
            .Select(group => new InventorySummaryProjection
            {
                TotalProducts = group.Count(),
                ActiveProducts = group.Count(x => x.IsActive),
                HealthyProducts = group.Count(x => x.Inventory != null && x.Inventory.Quantity - x.Inventory.ReservedQuantity > x.Inventory.MinimumQuantity),
                LowStockProducts = group.Count(x => x.Inventory != null && x.Inventory.Quantity - x.Inventory.ReservedQuantity > 0 && x.Inventory.Quantity - x.Inventory.ReservedQuantity <= x.Inventory.MinimumQuantity),
                OutOfStockProducts = group.Count(x => x.Inventory == null || x.Inventory.Quantity - x.Inventory.ReservedQuantity <= 0),
                ExpiringSoonProducts = group.Count(x => x.Inventory != null && x.Inventory.Quantity - x.Inventory.ReservedQuantity > 0 && x.Inventory.ExpireDate.HasValue && x.Inventory.ExpireDate.Value >= today && x.Inventory.ExpireDate.Value <= expiringThreshold),
                TotalQuantity = group.Sum(x => x.Inventory == null ? 0 : x.Inventory.Quantity),
                ReservedQuantity = group.Sum(x => x.Inventory == null ? 0 : x.Inventory.ReservedQuantity),
                AvailableQuantity = group.Sum(x => x.Inventory == null ? 0 : x.Inventory.Quantity - x.Inventory.ReservedQuantity)
            })
            .SingleOrDefaultAsync(ct) ?? new InventorySummaryProjection();

        var query = baseQuery;
        var search = filter.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Name.Contains(search) || (x.Barcode != null && x.Barcode.Contains(search)));
        }

        if (filter.CategoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == filter.CategoryId.Value);
        }

        if (filter.IsActive.HasValue)
        {
            query = query.Where(x => x.IsActive == filter.IsActive.Value);
        }

        query = filter.Status switch
        {
            InventoryStockStatus.Healthy => query.Where(x => x.Inventory != null && x.Inventory.Quantity - x.Inventory.ReservedQuantity > x.Inventory.MinimumQuantity),
            InventoryStockStatus.LowStock => query.Where(x => x.Inventory != null && x.Inventory.Quantity - x.Inventory.ReservedQuantity > 0 && x.Inventory.Quantity - x.Inventory.ReservedQuantity <= x.Inventory.MinimumQuantity),
            InventoryStockStatus.OutOfStock => query.Where(x => x.Inventory == null || x.Inventory.Quantity - x.Inventory.ReservedQuantity <= 0),
            _ => query
        };

        query = filter.SortBy?.ToLowerInvariant() switch
        {
            "name" => filter.SortDescending ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name),
            "quantity" => filter.SortDescending
                ? query.OrderByDescending(x => x.Inventory == null ? 0 : x.Inventory.Quantity)
                : query.OrderBy(x => x.Inventory == null ? 0 : x.Inventory.Quantity),
            "available" => filter.SortDescending
                ? query.OrderByDescending(x => x.Inventory == null ? 0 : x.Inventory.Quantity - x.Inventory.ReservedQuantity)
                : query.OrderBy(x => x.Inventory == null ? 0 : x.Inventory.Quantity - x.Inventory.ReservedQuantity),
            "expiry" => filter.SortDescending
                ? query.OrderByDescending(x => x.Inventory == null ? null : x.Inventory.ExpireDate)
                : query.OrderBy(x => x.Inventory == null ? null : x.Inventory.ExpireDate),
            "updatedat" => filter.SortDescending
                ? query.OrderByDescending(x => x.Inventory == null ? x.UpdatedAt ?? x.CreatedAt : x.Inventory.UpdatedAt ?? x.Inventory.CreatedAt)
                : query.OrderBy(x => x.Inventory == null ? x.UpdatedAt ?? x.CreatedAt : x.Inventory.UpdatedAt ?? x.Inventory.CreatedAt),
            _ => query
                .OrderBy(x => x.Inventory == null || x.Inventory.Quantity - x.Inventory.ReservedQuantity <= 0
                    ? 0
                    : x.Inventory.Quantity - x.Inventory.ReservedQuantity <= x.Inventory.MinimumQuantity ? 1 : 2)
                .ThenBy(x => x.Name)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalCount = await query.CountAsync(ct);
        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new InventoryRowProjection
            {
                ProductId = x.Id,
                Name = x.Name,
                Barcode = x.Barcode,
                CategoryName = x.Category.Name,
                UnitName = x.Unit == null ? null : x.Unit.Name,
                IsActive = x.IsActive,
                Quantity = x.Inventory == null ? 0 : x.Inventory.Quantity,
                ReservedQuantity = x.Inventory == null ? 0 : x.Inventory.ReservedQuantity,
                MinimumQuantity = x.Inventory == null ? 0 : x.Inventory.MinimumQuantity,
                ExpireDate = x.Inventory == null ? null : x.Inventory.ExpireDate,
                PrimaryImageUrl = x.Images.Where(image => image.IsPrimary).Select(image => "/" + image.ImagePath.Replace("\\", "/")).FirstOrDefault(),
                UpdatedAt = x.Inventory == null ? x.UpdatedAt ?? x.CreatedAt : x.Inventory.UpdatedAt ?? x.Inventory.CreatedAt
            })
            .ToListAsync(ct);

        var items = rows.Select(row =>
        {
            var available = row.Quantity - row.ReservedQuantity;
            var status = available <= 0
                ? InventoryStockStatus.OutOfStock
                : available <= row.MinimumQuantity ? InventoryStockStatus.LowStock : InventoryStockStatus.Healthy;
            var isExpiringSoon = row.ExpireDate.HasValue && row.ExpireDate.Value >= today && row.ExpireDate.Value <= expiringThreshold && available > 0;
            return new InventoryListItemResponse(
                row.ProductId, row.Name, row.Barcode, row.CategoryName, row.UnitName, row.IsActive,
                row.Quantity, row.ReservedQuantity, available, row.MinimumQuantity, row.ExpireDate,
                status, isExpiringSoon, row.PrimaryImageUrl, row.UpdatedAt);
        }).ToList();

        return new InventoryOverviewResponse(
            new InventorySummaryResponse(
                totals.TotalProducts, totals.ActiveProducts, totals.HealthyProducts, totals.LowStockProducts,
                totals.OutOfStockProducts, totals.ExpiringSoonProducts, totals.TotalQuantity,
                totals.ReservedQuantity, totals.AvailableQuantity),
            new PagedResult<InventoryListItemResponse>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            });
    }

    public async Task<PagedResult<InventoryTransactionResponse>> GetTransactionsAsync(InventoryTransactionFilter filter, CancellationToken ct = default)
    {
        var query = context.InventoryTransactions.AsNoTracking().Where(x => !x.IsDeleted);
        var search = filter.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Product.Name.Contains(search) || (x.Product.Barcode != null && x.Product.Barcode.Contains(search)));
        }

        if (filter.ProductId.HasValue) query = query.Where(x => x.ProductId == filter.ProductId.Value);
        if (filter.Type.HasValue) query = query.Where(x => x.Type == filter.Type.Value);
        if (filter.From.HasValue) query = query.Where(x => x.CreatedAt >= filter.From.Value);
        if (filter.To.HasValue) query = query.Where(x => x.CreatedAt <= filter.To.Value);

        query = filter.SortBy?.ToLowerInvariant() switch
        {
            "product" => filter.SortDescending ? query.OrderByDescending(x => x.Product.Name) : query.OrderBy(x => x.Product.Name),
            "quantity" => filter.SortDescending ? query.OrderByDescending(x => x.Quantity) : query.OrderBy(x => x.Quantity),
            _ => filter.SortDescending ? query.OrderBy(x => x.CreatedAt) : query.OrderByDescending(x => x.CreatedAt)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new InventoryTransactionResponse(
                x.Id, x.ProductId, x.Product.Name, x.Product.Barcode, x.Type, x.Quantity,
                x.QuantityBefore, x.QuantityAfter, x.ReservedBefore, x.ReservedAfter,
                x.ReferenceType, x.ReferenceId, x.PerformedByUserId, x.Description, x.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<InventoryTransactionResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

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

    public async Task<StockResult> UpdateSettingsAsync(long productId, UpdateInventorySettingsRequest request, CancellationToken ct = default)
    {
        if (request.MinimumQuantity < 0) throw new ArgumentException("Minimum quantity cannot be negative.");

        var inventory = await context.ProductInventories.SingleOrDefaultAsync(x => x.ProductId == productId, ct);
        if (inventory is null)
        {
            if (!await context.Products.AnyAsync(x => x.Id == productId, ct))
                throw new KeyNotFoundException("Product not found.");

            inventory = new ProductInventory
            {
                ProductId = productId,
                Quantity = 0,
                ReservedQuantity = 0,
                MinimumQuantity = request.MinimumQuantity,
                ExpireDate = request.ExpireDate
            };
            context.ProductInventories.Add(inventory);
        }
        else
        {
            inventory.MinimumQuantity = request.MinimumQuantity;
            inventory.ExpireDate = request.ExpireDate;
            inventory.UpdatedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(ct);
        return new StockResult(productId, inventory.Quantity, inventory.ReservedQuantity, inventory.Quantity - inventory.ReservedQuantity);
    }

    private async Task<StockResult> MutateAsync(long productId, decimal quantityDelta, decimal reservedDelta, InventoryTransactionType type, string? description, long? referenceId, string? idempotencyKey, string? userId, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey) && await context.InventoryTransactions.AnyAsync(x => x.IdempotencyKey == idempotencyKey, ct))
            return await GetAsync(productId, ct) ?? throw new KeyNotFoundException("Product inventory not found.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var before = await context.ProductInventories.AsNoTracking().SingleOrDefaultAsync(x => x.ProductId == productId, ct);
        if (before is null)
        {
            if (!await context.Products.AnyAsync(x => x.Id == productId, ct))
                throw new KeyNotFoundException("Product not found.");

            before = new ProductInventory { ProductId = productId, Quantity = 0, ReservedQuantity = 0, MinimumQuantity = 0 };
            context.ProductInventories.Add(before);
            await context.SaveChangesAsync(ct);
            context.Entry(before).State = EntityState.Detached;
        }

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

    private sealed class InventorySummaryProjection
    {
        public int TotalProducts { get; init; }
        public int ActiveProducts { get; init; }
        public int HealthyProducts { get; init; }
        public int LowStockProducts { get; init; }
        public int OutOfStockProducts { get; init; }
        public int ExpiringSoonProducts { get; init; }
        public decimal TotalQuantity { get; init; }
        public decimal ReservedQuantity { get; init; }
        public decimal AvailableQuantity { get; init; }
    }

    private sealed class InventoryRowProjection
    {
        public long ProductId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Barcode { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public string? UnitName { get; init; }
        public bool IsActive { get; init; }
        public decimal Quantity { get; init; }
        public decimal ReservedQuantity { get; init; }
        public decimal MinimumQuantity { get; init; }
        public DateOnly? ExpireDate { get; init; }
        public string? PrimaryImageUrl { get; init; }
        public DateTime UpdatedAt { get; init; }
    }
}
