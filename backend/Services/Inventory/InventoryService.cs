using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Filters;
using Microsoft.EntityFrameworkCore;
using ECommerce.Services.Notifications;

namespace ECommerce.Services.Inventory;

public sealed class InventoryService(
    ApplicationDbContext context,
    IStoreNotificationService notifications,
    IInventoryLotAllocator lotAllocator) : IInventoryService
{
    public async Task<InventoryOverviewResponse> GetOverviewAsync(InventoryFilter filter, CancellationToken ct = default)
    {
        var today = InventoryAvailability.UtcToday;
        var expiringThreshold = today.AddDays(30);

        var catalogQuery = context.Products
            .AsNoTracking()
            .Where(product => !product.IsDeleted && !product.UsesDisplayStock)
            .Select(product => new InventoryCatalogProjection
            {
                ProductId = product.Id,
                Name = product.Name,
                Strength = product.Strength,
                Barcode = product.Barcode,
                CategoryId = product.CategoryId,
                CategoryName = product.Category.Name,
                UnitName = product.Unit == null ? null : product.Unit.Name,
                IsActive = product.IsActive,
                Quantity = product.Inventory == null ? 0 : product.Inventory.Quantity,
                ReservedQuantity = product.Inventory == null ? 0 : product.Inventory.ReservedQuantity,
                PhysicalAvailableQuantity = product.Inventory == null
                    ? 0
                    : product.Inventory.Quantity - product.Inventory.ReservedQuantity,
                ExpiredAvailableQuantity = context.InventoryLots
                    .Where(lot => lot.ProductId == product.Id &&
                        lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                        lot.Quantity - lot.ReservedQuantity > 0)
                    .Sum(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity)) ?? 0,
                MinimumQuantity = product.Inventory == null ? 0 : product.Inventory.MinimumQuantity,
                ExpireDate = product.Inventory == null ? null : product.Inventory.ExpireDate,
                ActiveLotCount = context.InventoryLots.Count(lot =>
                    lot.ProductId == product.Id &&
                    (lot.Quantity > 0 || lot.ReservedQuantity > 0)),
                EarliestExpiry = context.InventoryLots
                    .Where(lot => lot.ProductId == product.Id &&
                        (lot.Quantity > 0 || lot.ReservedQuantity > 0) &&
                        lot.ExpiresAt.HasValue)
                    .Min(lot => lot.ExpiresAt),
                EarliestSellableExpiry = context.InventoryLots
                    .Where(lot => lot.ProductId == product.Id &&
                        lot.Quantity - lot.ReservedQuantity > 0 &&
                        lot.ExpiresAt.HasValue && lot.ExpiresAt.Value >= today)
                    .Min(lot => lot.ExpiresAt),
                PrimaryImageUrl = product.Images
                    .Where(image => image.IsPrimary)
                    .Select(image => "/" + image.ImagePath.Replace("\\", "/"))
                    .FirstOrDefault(),
                UpdatedAt = product.Inventory == null
                    ? product.UpdatedAt ?? product.CreatedAt
                    : product.Inventory.UpdatedAt ?? product.Inventory.CreatedAt
            });

        var totals = await catalogQuery
            .GroupBy(_ => 1)
            .Select(group => new InventorySummaryProjection
            {
                TotalProducts = group.Count(),
                ActiveProducts = group.Count(item => item.IsActive),
                HealthyProducts = group.Count(item =>
                    item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity > item.MinimumQuantity),
                LowStockProducts = group.Count(item =>
                    item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity > 0 &&
                    item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= item.MinimumQuantity),
                OutOfStockProducts = group.Count(item =>
                    item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= 0),
                ExpiredProducts = group.Count(item => item.ExpiredAvailableQuantity > 0),
                TotalQuantity = group.Sum(item => item.Quantity),
                ReservedQuantity = group.Sum(item => item.ReservedQuantity),
                AvailableQuantity = group.Sum(item =>
                    item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity),
                ExpiredQuantity = group.Sum(item => item.ExpiredAvailableQuantity)
            })
            .SingleOrDefaultAsync(ct) ?? new InventorySummaryProjection();

        var expiringSoonProducts = await context.InventoryLots
            .AsNoTracking()
            .Where(lot => lot.Quantity - lot.ReservedQuantity > 0 &&
                lot.ExpiresAt.HasValue && lot.ExpiresAt.Value >= today &&
                lot.ExpiresAt.Value <= expiringThreshold)
            .Select(lot => lot.ProductId)
            .Distinct()
            .CountAsync(ct);

        var query = catalogQuery;
        var search = filter.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(item =>
                item.Name.Contains(search) ||
                (item.Barcode != null && item.Barcode.Contains(search)));
        }

        if (filter.CategoryId.HasValue)
            query = query.Where(item => item.CategoryId == filter.CategoryId.Value);

        if (filter.IsActive.HasValue)
            query = query.Where(item => item.IsActive == filter.IsActive.Value);

        query = filter.Status switch
        {
            InventoryStockStatus.Healthy => query.Where(item =>
                item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity > item.MinimumQuantity),
            InventoryStockStatus.LowStock => query.Where(item =>
                item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity > 0 &&
                item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= item.MinimumQuantity),
            InventoryStockStatus.OutOfStock => query.Where(item =>
                item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= 0),
            InventoryStockStatus.Expired => query.Where(item =>
                item.ExpiredAvailableQuantity > 0),
            _ => query
        };

        query = filter.SortBy?.ToLowerInvariant() switch
        {
            "name" => filter.SortDescending
                ? query.OrderByDescending(item => item.Name)
                : query.OrderBy(item => item.Name),
            "quantity" => filter.SortDescending
                ? query.OrderByDescending(item => item.Quantity)
                : query.OrderBy(item => item.Quantity),
            "available" => filter.SortDescending
                ? query.OrderByDescending(item => item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity)
                : query.OrderBy(item => item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity),
            "expiry" => filter.SortDescending
                ? query.OrderByDescending(item => item.EarliestExpiry ?? item.ExpireDate)
                : query.OrderBy(item => item.EarliestExpiry ?? item.ExpireDate),
            "updatedat" => filter.SortDescending
                ? query.OrderByDescending(item => item.UpdatedAt)
                : query.OrderBy(item => item.UpdatedAt),
            _ => query
                .OrderBy(item => item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= 0
                    ? 0
                    : item.PhysicalAvailableQuantity - item.ExpiredAvailableQuantity <= item.MinimumQuantity ? 1 : 2)
                .ThenByDescending(item => item.ExpiredAvailableQuantity > 0)
                .ThenBy(item => item.Name)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var totalCount = await query.CountAsync(ct);
        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = rows.Select(row =>
        {
            var sellableAvailable = Math.Max(
                0,
                row.PhysicalAvailableQuantity - row.ExpiredAvailableQuantity);
            var status = sellableAvailable <= 0
                ? InventoryStockStatus.OutOfStock
                : sellableAvailable <= row.MinimumQuantity
                    ? InventoryStockStatus.LowStock
                    : InventoryStockStatus.Healthy;
            var expireDate = row.EarliestExpiry ?? row.ExpireDate;
            var isExpiringSoon = row.EarliestSellableExpiry.HasValue &&
                row.EarliestSellableExpiry.Value <= expiringThreshold &&
                sellableAvailable > 0;

            return new InventoryListItemResponse(
                row.ProductId,
                row.Name,
                row.Strength,
                row.Barcode,
                row.CategoryName,
                row.UnitName,
                row.IsActive,
                row.Quantity,
                row.ReservedQuantity,
                sellableAvailable,
                Math.Max(0, row.ExpiredAvailableQuantity),
                row.MinimumQuantity,
                expireDate,
                row.ActiveLotCount,
                status,
                isExpiringSoon,
                row.PrimaryImageUrl,
                row.UpdatedAt);
        }).ToList();

        return new InventoryOverviewResponse(
            new InventorySummaryResponse(
                totals.TotalProducts,
                totals.ActiveProducts,
                totals.HealthyProducts,
                totals.LowStockProducts,
                totals.OutOfStockProducts,
                totals.ExpiredProducts,
                expiringSoonProducts,
                totals.TotalQuantity,
                totals.ReservedQuantity,
                Math.Max(0, totals.AvailableQuantity),
                Math.Max(0, totals.ExpiredQuantity)),
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
            query = query.Where(x =>
                x.Product.Name.Contains(search) ||
                (x.Product.Barcode != null && x.Product.Barcode.Contains(search)) ||
                x.Lots.Any(lot => lot.LotNumber != null && lot.LotNumber.Contains(search)));
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
                x.ReferenceType, x.ReferenceId, x.PerformedByUserId, x.Description,
                x.Lots.OrderBy(lot => lot.Id)
                    .Select(lot => new InventoryTransactionLotResponse(
                        lot.Id, lot.InventoryLotId, lot.LotNumber, lot.WarehouseId,
                        lot.WarehouseName, lot.ExpiresAt, lot.QuantityDelta,
                        lot.ReservedDelta, lot.UnitCost))
                    .ToList(),
                x.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<InventoryTransactionResponse>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<IReadOnlyList<InventoryLotResponse>> GetLotsAsync(
        long productId,
        CancellationToken ct = default)
    {
        var productExists = await context.Products.AsNoTracking()
            .AnyAsync(product => product.Id == productId, ct);
        if (!productExists)
            throw new KeyNotFoundException("Product not found.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var expiringThreshold = today.AddDays(30);
        return await context.InventoryLots.AsNoTracking()
            .Where(lot => lot.ProductId == productId &&
                (lot.Quantity > 0 || lot.ReservedQuantity > 0))
            .OrderBy(lot => lot.ExpiresAt == null)
            .ThenBy(lot => lot.ExpiresAt)
            .ThenBy(lot => lot.CreatedAt)
            .Select(lot => new InventoryLotResponse(
                lot.Id,
                lot.ProductId,
                lot.Product.Name,
                lot.Product.Strength,
                lot.Product.Barcode,
                lot.WarehouseId,
                lot.Warehouse.Name,
                lot.LotNumber,
                lot.Quantity,
                lot.ReservedQuantity,
                lot.Quantity - lot.ReservedQuantity,
                lot.UnitCost,
                lot.ManufacturedAt,
                lot.ExpiresAt,
                lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today,
                lot.ExpiresAt.HasValue && lot.ExpiresAt.Value >= today &&
                    lot.ExpiresAt.Value <= expiringThreshold,
                lot.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<StockResult?> GetAsync(long productId, CancellationToken ct = default) =>
        await context.ProductInventories.AsNoTracking().Where(x => x.ProductId == productId)
            .Select(x => new StockResult(x.ProductId, x.Quantity, x.ReservedQuantity, x.Quantity - x.ReservedQuantity))
            .SingleOrDefaultAsync(ct);

    public Task<StockResult> AdjustAsync(long productId, AdjustStockRequest request, string? userId, CancellationToken ct = default)
    {
        if (request.Quantity == 0) throw new ArgumentException("Quantity adjustment cannot be zero.");
        return MutateAsync(productId, request.Quantity, 0, request.Type, request.Description, null, request.IdempotencyKey, request.LotId, userId, ct);
    }

    public Task<StockResult> ReserveAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateReservationAsync(
            productId,
            request.Quantity,
            InventoryTransactionType.Reservation,
            "Stock reserved from traceable lots.",
            request.OrderId,
            request.IdempotencyKey,
            userId,
            ct);
    }

    public Task<StockResult> ReleaseAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateReservationAsync(
            productId,
            request.Quantity,
            InventoryTransactionType.ReservationRelease,
            "Stock reservation released to its traceable lots.",
            request.OrderId,
            request.IdempotencyKey,
            userId,
            ct);
    }

    public Task<StockResult> CommitSaleAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken ct = default)
    {
        RequirePositive(request.Quantity);
        return MutateReservationAsync(
            productId,
            request.Quantity,
            InventoryTransactionType.Sale,
            "Reserved stock sold from its traceable lots.",
            request.OrderId,
            request.IdempotencyKey,
            userId,
            ct);
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

    private async Task<StockResult> MutateReservationAsync(
        long productId,
        decimal quantity,
        InventoryTransactionType type,
        string description,
        long? referenceId,
        string? idempotencyKey,
        string? userId,
        CancellationToken ct)
    {
        if (type is not (InventoryTransactionType.Reservation or
            InventoryTransactionType.ReservationRelease or
            InventoryTransactionType.Sale))
            throw new ArgumentOutOfRangeException(nameof(type));

        if (!string.IsNullOrWhiteSpace(idempotencyKey) &&
            await context.InventoryTransactions.AnyAsync(
                item => item.IdempotencyKey == idempotencyKey,
                ct))
            return await GetAsync(productId, ct)
                ?? throw new KeyNotFoundException("Product inventory not found.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var inventory = await context.ProductInventories
            .FromSqlInterpolated($"SELECT * FROM [ProductInventories] WITH (UPDLOCK, ROWLOCK) WHERE [ProductId] = {productId}")
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Product inventory not found.");

        var quantityBefore = inventory.Quantity;
        var reservedBefore = inventory.ReservedQuantity;
        var allocations = type == InventoryTransactionType.Reservation
            ? await lotAllocator.ReserveFefoAsync(productId, quantity, ct)
            : await MutateReservedLotsAsync(
                productId,
                quantity,
                referenceId,
                commitQuantity: type == InventoryTransactionType.Sale,
                ct);

        var quantityDelta = type == InventoryTransactionType.Sale ? -quantity : 0;
        var reservedDelta = type == InventoryTransactionType.Reservation ? quantity : -quantity;
        var quantityAfter = quantityBefore + quantityDelta;
        var reservedAfter = reservedBefore + reservedDelta;
        if (quantityAfter < 0 || reservedAfter < 0 || reservedAfter > quantityAfter)
            throw new InvalidOperationException("Insufficient available or reserved stock.");

        inventory.Quantity = quantityAfter;
        inventory.ReservedQuantity = reservedAfter;
        inventory.UpdatedAt = DateTime.UtcNow;

        var inventoryTransaction = new InventoryTransaction
        {
            ProductId = productId,
            Quantity = quantityDelta,
            Type = type,
            QuantityBefore = quantityBefore,
            QuantityAfter = quantityAfter,
            ReservedBefore = reservedBefore,
            ReservedAfter = reservedAfter,
            ReferenceType = referenceId.HasValue ? "Order" : null,
            ReferenceId = referenceId,
            IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey)
                ? null
                : idempotencyKey.Trim(),
            PerformedByUserId = userId,
            Description = description
        };
        AddLotMovements(
            inventoryTransaction,
            allocations,
            quantitySign: type == InventoryTransactionType.Sale ? -1 : 0,
            reservedSign: type == InventoryTransactionType.Reservation ? 1 : -1);
        context.InventoryTransactions.Add(inventoryTransaction);

        var availableBefore = quantityBefore - reservedBefore;
        var availableAfter = quantityAfter - reservedAfter;
        PendingStoreNotification? pendingNotification = null;
        if (availableAfter > availableBefore)
        {
            pendingNotification = await notifications.CreateStockIncreasedAsync(
                productId,
                availableBefore,
                availableAfter,
                ct);
        }

        await context.SaveChangesAsync(ct);
        await RefreshInventoryExpiryAsync(inventory, productId, ct);
        await transaction.CommitAsync(ct);
        await notifications.PublishAsync([pendingNotification], ct);
        return new StockResult(productId, quantityAfter, reservedAfter, availableAfter);
    }

    private async Task<IReadOnlyList<InventoryLotAllocation>> MutateReservedLotsAsync(
        long productId,
        decimal requiredQuantity,
        long? referenceId,
        bool commitQuantity,
        CancellationToken ct)
    {
        const decimal tolerance = 0.0005m;
        var remaining = requiredQuantity;
        var allocations = new List<InventoryLotAllocation>();
        var usedLotIds = new HashSet<long>();
        decimal? legacyFallbackLimit = null;

        if (referenceId.HasValue)
        {
            var aggregateReservationBalance = await context.InventoryTransactions
                .AsNoTracking()
                .Where(item =>
                    item.ProductId == productId &&
                    item.ReferenceType == "Order" &&
                    item.ReferenceId == referenceId.Value)
                .SumAsync(item => (decimal?)(item.ReservedAfter - item.ReservedBefore), ct) ?? 0;
            if (aggregateReservationBalance + tolerance < requiredQuantity)
                throw new InvalidOperationException(
                    "The order does not contain enough outstanding reserved stock for this product.");

            var reservationBalances = await context.InventoryTransactionLots
                .AsNoTracking()
                .Where(item =>
                    item.InventoryTransaction.ProductId == productId &&
                    item.InventoryTransaction.ReferenceType == "Order" &&
                    item.InventoryTransaction.ReferenceId == referenceId.Value &&
                    item.InventoryLotId.HasValue)
                .GroupBy(item => item.InventoryLotId!.Value)
                .Select(group => new
                {
                    LotId = group.Key,
                    Quantity = group.Sum(item => item.ReservedDelta)
                })
                .Where(item => item.Quantity > tolerance)
                .ToListAsync(ct);

            var traceableReservationBalance = reservationBalances.Sum(item => item.Quantity);
            legacyFallbackLimit = Math.Max(0, aggregateReservationBalance - traceableReservationBalance);

            if (reservationBalances.Count > 0)
            {
                var balancesByLotId = reservationBalances.ToDictionary(
                    item => item.LotId,
                    item => item.Quantity);
                var lotIds = balancesByLotId.Keys.ToArray();
                var exactLots = await context.InventoryLots
                    .Include(item => item.Warehouse)
                    .Where(item => lotIds.Contains(item.Id))
                    .OrderBy(item => item.ExpiresAt == null)
                    .ThenBy(item => item.ExpiresAt)
                    .ThenBy(item => item.CreatedAt)
                    .ThenBy(item => item.Id)
                    .ToListAsync(ct);

                foreach (var lot in exactLots)
                {
                    if (remaining <= tolerance) break;
                    var quantity = Math.Min(balancesByLotId[lot.Id], remaining);
                    MutateReservedLot(lot, quantity, commitQuantity);
                    allocations.Add(new InventoryLotAllocation(lot, quantity));
                    usedLotIds.Add(lot.Id);
                    remaining -= quantity;
                }
            }
        }

        if (remaining > tolerance &&
            (!legacyFallbackLimit.HasValue || legacyFallbackLimit.Value > tolerance))
        {
            var fallbackRemaining = legacyFallbackLimit.HasValue
                ? Math.Min(remaining, legacyFallbackLimit.Value)
                : remaining;
            var fallbackLots = await context.InventoryLots
                .Include(item => item.Warehouse)
                .Where(item => item.ProductId == productId &&
                    item.ReservedQuantity > 0 &&
                    !usedLotIds.Contains(item.Id))
                .OrderBy(item => item.ExpiresAt == null)
                .ThenBy(item => item.ExpiresAt)
                .ThenBy(item => item.CreatedAt)
                .ThenBy(item => item.Id)
                .ToListAsync(ct);

            foreach (var lot in fallbackLots)
            {
                if (fallbackRemaining <= tolerance) break;
                var quantity = Math.Min(lot.ReservedQuantity, fallbackRemaining);
                MutateReservedLot(lot, quantity, commitQuantity);
                allocations.Add(new InventoryLotAllocation(lot, quantity));
                remaining -= quantity;
                fallbackRemaining -= quantity;
            }
        }

        if (remaining > tolerance)
            throw new InvalidOperationException(
                "The requested quantity is not available in reserved lots. Refresh inventory and try again.");

        return allocations;
    }

    private static void MutateReservedLot(
        InventoryLot lot,
        decimal quantity,
        bool commitQuantity)
    {
        const decimal tolerance = 0.0005m;
        if (lot.ReservedQuantity + tolerance < quantity)
            throw new InvalidOperationException(
                $"Lot '{DisplayLot(lot)}' does not contain enough reserved stock.");

        if (commitQuantity)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                        lot.Quantity - lot.ReservedQuantity > 0)
                throw new InvalidOperationException(
                    $"Reserved lot '{DisplayLot(lot)}' expired on {lot.ExpiresAt:yyyy-MM-dd}. Release or replace the batch before completing the sale.");
            if (lot.Quantity + tolerance < quantity)
                throw new InvalidOperationException(
                    $"Lot '{DisplayLot(lot)}' does not contain enough physical stock.");
            lot.Quantity -= quantity;
        }

        lot.ReservedQuantity -= quantity;
        lot.UpdatedAt = DateTime.UtcNow;
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

    private static string DisplayLot(InventoryLot lot) =>
        string.IsNullOrWhiteSpace(lot.LotNumber) ? $"#{lot.Id}" : lot.LotNumber;

    private async Task<StockResult> MutateAsync(
        long productId,
        decimal quantityDelta,
        decimal reservedDelta,
        InventoryTransactionType type,
        string? description,
        long? referenceId,
        string? idempotencyKey,
        long? lotId,
        string? userId,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(idempotencyKey) && await context.InventoryTransactions.AnyAsync(x => x.IdempotencyKey == idempotencyKey, ct))
            return await GetAsync(productId, ct) ?? throw new KeyNotFoundException("Product inventory not found.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var inventory = await context.ProductInventories
            .FromSqlInterpolated($"SELECT * FROM [ProductInventories] WITH (UPDLOCK, ROWLOCK) WHERE [ProductId] = {productId}")
            .SingleOrDefaultAsync(ct);
        if (inventory is null)
        {
            if (!await context.Products.AnyAsync(x => x.Id == productId, ct))
                throw new KeyNotFoundException("Product not found.");

            inventory = new ProductInventory
            {
                ProductId = productId,
                Quantity = 0,
                ReservedQuantity = 0,
                MinimumQuantity = 0
            };
            context.ProductInventories.Add(inventory);
        }

        InventoryLotAllocation? lotAllocation = null;
        if (lotId.HasValue)
        {
            lotAllocation = await lotAllocator.ApplyAdjustmentAsync(
                productId, lotId.Value, quantityDelta, type, ct);
        }
        else if (type == InventoryTransactionType.Expired)
        {
            throw new ArgumentException("Select the expired lot or batch before recording expired stock.");
        }
        else if (quantityDelta < 0 && await context.InventoryLots.AnyAsync(
                     item => item.ProductId == productId && item.Quantity - item.ReservedQuantity > 0, ct))
        {
            throw new ArgumentException("Select the exact lot or batch for this stock-out movement.");
        }

        var quantityBefore = inventory.Quantity;
        var reservedBefore = inventory.ReservedQuantity;
        var quantityAfter = quantityBefore + quantityDelta;
        var reservedAfter = reservedBefore + reservedDelta;
        if (quantityAfter < 0 || reservedAfter < 0 || reservedAfter > quantityAfter)
            throw new InvalidOperationException("Insufficient available or reserved stock.");

        inventory.Quantity = quantityAfter;
        inventory.ReservedQuantity = reservedAfter;
        inventory.UpdatedAt = DateTime.UtcNow;
        var inventoryTransaction = new InventoryTransaction
        {
            ProductId = productId, Quantity = quantityDelta, Type = type, Description = description,
            QuantityBefore = quantityBefore, QuantityAfter = quantityAfter,
            ReservedBefore = reservedBefore, ReservedAfter = reservedAfter,
            ReferenceType = referenceId.HasValue ? "Order" : null, ReferenceId = referenceId,
            IdempotencyKey = string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey.Trim(),
            PerformedByUserId = userId
        };
        if (lotAllocation is not null)
        {
            inventoryTransaction.Lots.Add(new InventoryTransactionLot
            {
                InventoryLot = lotAllocation.Lot,
                InventoryLotId = lotAllocation.Lot.Id,
                LotNumber = lotAllocation.Lot.LotNumber,
                WarehouseId = lotAllocation.Lot.WarehouseId,
                WarehouseName = lotAllocation.Lot.Warehouse.Name,
                ExpiresAt = lotAllocation.Lot.ExpiresAt,
                QuantityDelta = quantityDelta,
                ReservedDelta = 0,
                UnitCost = lotAllocation.Lot.UnitCost
            });

        }
        context.InventoryTransactions.Add(inventoryTransaction);

        var availableBefore = quantityBefore - reservedBefore;
        var availableAfter = quantityAfter - reservedAfter;
        PendingStoreNotification? pendingNotification = null;
        if (availableAfter > availableBefore)
        {
            pendingNotification = await notifications.CreateStockIncreasedAsync(
                productId,
                availableBefore,
                availableAfter,
                ct);
        }

        await context.SaveChangesAsync(ct);
        if (lotAllocation is not null)
            await RefreshInventoryExpiryAsync(inventory, productId, ct);
        await transaction.CommitAsync(ct);
        await notifications.PublishAsync([pendingNotification], ct);
        return new StockResult(productId, quantityAfter, reservedAfter, quantityAfter - reservedAfter);
    }

    private async Task RefreshInventoryExpiryAsync(
        ProductInventory inventory,
        long productId,
        CancellationToken ct)
    {
        var expiry = await context.InventoryLots.AsNoTracking()
            .Where(item => item.ProductId == productId &&
                item.Quantity - item.ReservedQuantity > 0 &&
                item.ExpiresAt.HasValue)
            .MinAsync(item => item.ExpiresAt, ct);
        if (inventory.ExpireDate == expiry) return;

        inventory.ExpireDate = expiry;
        inventory.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
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
        public int ExpiredProducts { get; init; }
        public decimal TotalQuantity { get; init; }
        public decimal ReservedQuantity { get; init; }
        public decimal AvailableQuantity { get; init; }
        public decimal ExpiredQuantity { get; init; }
    }

    private sealed class InventoryCatalogProjection
    {
        public long ProductId { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Strength { get; init; }
        public string? Barcode { get; init; }
        public long CategoryId { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public string? UnitName { get; init; }
        public bool IsActive { get; init; }
        public decimal Quantity { get; init; }
        public decimal ReservedQuantity { get; init; }
        public decimal PhysicalAvailableQuantity { get; init; }
        public decimal ExpiredAvailableQuantity { get; init; }
        public decimal MinimumQuantity { get; init; }
        public DateOnly? ExpireDate { get; init; }
        public int ActiveLotCount { get; init; }
        public DateOnly? EarliestExpiry { get; init; }
        public DateOnly? EarliestSellableExpiry { get; init; }
        public string? PrimaryImageUrl { get; init; }
        public DateTime UpdatedAt { get; init; }
    }
}
