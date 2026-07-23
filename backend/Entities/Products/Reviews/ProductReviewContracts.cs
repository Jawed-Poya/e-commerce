namespace ECommerce.Entities.Products.Reviews;

public sealed record ProductReviewItemResponse(
    long Id,
    long ProductId,
    string CustomerName,
    int Rating,
    string? Comment,
    bool IsApproved,
    bool IsVerifiedPurchase,
    bool IsOwn,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductReviewSummaryResponse(
    double AverageRating,
    int ReviewCount,
    IReadOnlyDictionary<int, int> Distribution,
    ProductReviewItemResponse? MyReview,
    IReadOnlyCollection<ProductReviewItemResponse> Items);

public sealed record UpsertProductReviewRequest(int Rating, string? Comment);
public sealed record ReviewApprovalRequest(bool IsApproved);

public sealed record AdminProductReviewResponse(
    long Id,
    long ProductId,
    string ProductName,
    long CustomerId,
    string CustomerName,
    int Rating,
    string? Comment,
    bool IsApproved,
    bool IsVerifiedPurchase,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
