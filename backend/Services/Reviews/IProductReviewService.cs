using ECommerce.Entities.Products.Reviews;

namespace ECommerce.Services.Reviews;

public interface IProductReviewService
{
    Task<ProductReviewSummaryResponse?> GetForProductAsync(long productId, CancellationToken cancellationToken = default);
    Task<ProductReviewItemResponse> UpsertMineAsync(long productId, UpsertProductReviewRequest request, CancellationToken cancellationToken = default);
    Task DeleteMineAsync(long productId, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<AdminProductReviewResponse>> GetForAdminAsync(bool? approved, CancellationToken cancellationToken = default);
    Task<AdminProductReviewResponse> SetApprovalAsync(long reviewId, bool approved, CancellationToken cancellationToken = default);
    Task DeleteAsync(long reviewId, CancellationToken cancellationToken = default);
}
