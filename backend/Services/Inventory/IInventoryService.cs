using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Filters;
using ECommerce.Entities.Common;

namespace ECommerce.Services.Inventory;

public interface IInventoryService
{
    Task<InventoryOverviewResponse> GetOverviewAsync(InventoryFilter filter, CancellationToken cancellationToken = default);
    Task<PagedResult<InventoryTransactionResponse>> GetTransactionsAsync(InventoryTransactionFilter filter, CancellationToken cancellationToken = default);
    Task<StockResult?> GetAsync(long productId, CancellationToken cancellationToken = default);
    Task<StockResult> AdjustAsync(long productId, AdjustStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> ReserveAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> ReleaseAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> CommitSaleAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> UpdateSettingsAsync(long productId, UpdateInventorySettingsRequest request, CancellationToken cancellationToken = default);
}
