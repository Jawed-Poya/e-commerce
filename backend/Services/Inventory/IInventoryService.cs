using ECommerce.Entities.Products.Contracts;

namespace ECommerce.Services.Inventory;

public interface IInventoryService
{
    Task<StockResult?> GetAsync(long productId, CancellationToken cancellationToken = default);
    Task<StockResult> AdjustAsync(long productId, AdjustStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> ReserveAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> ReleaseAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<StockResult> CommitSaleAsync(long productId, ReserveStockRequest request, string? userId, CancellationToken cancellationToken = default);
}
