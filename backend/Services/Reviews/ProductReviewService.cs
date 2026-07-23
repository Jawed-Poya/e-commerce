using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Entities.Orders;
using ECommerce.Entities.Products;
using ECommerce.Entities.Products.Reviews;
using ECommerce.Services.Customers;
using ECommerce.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Reviews;

public sealed class ProductReviewService(
    ApplicationDbContext context,
    ICurrentCustomerAccessor currentCustomer,
    IAdminNotificationService adminNotifications) : IProductReviewService
{
    public async Task<ProductReviewSummaryResponse?> GetForProductAsync(
        long productId,
        CancellationToken cancellationToken = default)
    {
        if (!await context.Products.AsNoTracking().AnyAsync(product => product.Id == productId && product.IsActive, cancellationToken))
            return null;

        var customerId = currentCustomer.CustomerId;
        var rows = await context.ProductReviews
            .AsNoTracking()
            .Where(review => review.ProductId == productId && (review.IsApproved || (customerId.HasValue && review.CustomerId == customerId.Value)))
            .OrderByDescending(review => review.CreatedAt)
            .Select(review => new
            {
                Review = review,
                review.Customer.FirstName,
                review.Customer.LastName
            })
            .Take(100)
            .ToListAsync(cancellationToken);

        var approved = rows.Where(row => row.Review.IsApproved).ToArray();
        var distribution = Enumerable.Range(1, 5).ToDictionary(
            rating => rating,
            rating => approved.Count(row => row.Review.Rating == rating));
        var items = rows
            .Where(row => row.Review.IsApproved)
            .Select(row => Map(row.Review, PublicCustomerName(row.FirstName, row.LastName), customerId))
            .ToArray();
        var mine = customerId.HasValue
            ? rows.Where(row => row.Review.CustomerId == customerId.Value)
                .Select(row => Map(row.Review, PublicCustomerName(row.FirstName, row.LastName), customerId))
                .FirstOrDefault()
            : null;

        return new ProductReviewSummaryResponse(
            approved.Length == 0 ? 0 : Math.Round(approved.Average(row => row.Review.Rating), 1),
            approved.Length,
            distribution,
            mine,
            items);
    }

    public async Task<ProductReviewItemResponse> UpsertMineAsync(
        long productId,
        UpsertProductReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);
        var customerId = currentCustomer.CustomerId
            ?? throw new UnauthorizedAccessException("A customer account is required to review a product.");
        var product = await context.Products
            .AsNoTracking()
            .Where(item => item.Id == productId && item.IsActive)
            .Select(item => new { item.Id, item.Name })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Product not found.");

        var verifiedPurchase = await context.OrderItems
            .AsNoTracking()
            .AnyAsync(item =>
                item.ProductId == productId &&
                item.Order.CustomerId == customerId &&
                item.Order.Status == OrderStatus.Delivered,
                cancellationToken);

        var review = await context.ProductReviews
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                item => item.ProductId == productId && item.CustomerId == customerId,
                cancellationToken);
        var isNew = review is null;
        if (review is null)
        {
            review = new ProductReview
            {
                ProductId = productId,
                CustomerId = customerId,
                CreatedAt = DateTime.UtcNow
            };
            context.ProductReviews.Add(review);
        }

        review.IsDeleted = false;
        review.DeletedAt = null;
        review.Rating = request.Rating;
        review.Comment = CleanComment(request.Comment);
        review.IsVerifiedPurchase = verifiedPurchase;
        review.IsApproved = false;
        review.UpdatedAt = isNew ? null : DateTime.UtcNow;

        var customer = await context.Customers
            .AsNoTracking()
            .Where(item => item.Id == customerId)
            .Select(item => new { item.FirstName, item.LastName })
            .SingleAsync(cancellationToken);
        var customerName = PublicCustomerName(customer.FirstName, customer.LastName);

        var pendingNotification = isNew
            ? await adminNotifications.CreateReviewSubmittedAsync(
                review,
                product.Name,
                customerName,
                cancellationToken)
            : null;
        await context.SaveChangesAsync(cancellationToken);
        await adminNotifications.PublishAsync(pendingNotification, CancellationToken.None);
        return Map(review, customerName, customerId);
    }

    public async Task DeleteMineAsync(long productId, CancellationToken cancellationToken = default)
    {
        var customerId = currentCustomer.CustomerId
            ?? throw new UnauthorizedAccessException("A customer account is required.");
        var review = await context.ProductReviews
            .FirstOrDefaultAsync(item => item.ProductId == productId && item.CustomerId == customerId, cancellationToken)
            ?? throw new KeyNotFoundException("Review not found.");
        review.IsDeleted = true;
        review.DeletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<AdminProductReviewResponse>> GetForAdminAsync(
        bool? approved,
        CancellationToken cancellationToken = default)
    {
        var query = context.ProductReviews.AsNoTracking().AsQueryable();
        if (approved.HasValue) query = query.Where(review => review.IsApproved == approved.Value);
        return await query
            .OrderBy(review => review.IsApproved)
            .ThenByDescending(review => review.CreatedAt)
            .Take(500)
            .Select(review => new AdminProductReviewResponse(
                review.Id,
                review.ProductId,
                review.Product.Name,
                review.CustomerId,
                review.Customer.FirstName + (review.Customer.LastName == null ? "" : " " + review.Customer.LastName),
                review.Rating,
                review.Comment,
                review.IsApproved,
                review.IsVerifiedPurchase,
                review.CreatedAt,
                review.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminProductReviewResponse> SetApprovalAsync(
        long reviewId,
        bool approved,
        CancellationToken cancellationToken = default)
    {
        var review = await context.ProductReviews
            .Include(item => item.Product)
            .Include(item => item.Customer)
            .FirstOrDefaultAsync(item => item.Id == reviewId, cancellationToken)
            ?? throw new KeyNotFoundException("Review not found.");
        review.IsApproved = approved;
        review.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return MapAdmin(review);
    }

    public async Task DeleteAsync(long reviewId, CancellationToken cancellationToken = default)
    {
        var review = await context.ProductReviews.FirstOrDefaultAsync(item => item.Id == reviewId, cancellationToken)
            ?? throw new KeyNotFoundException("Review not found.");
        review.IsDeleted = true;
        review.DeletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
    }

    private static ProductReviewItemResponse Map(ProductReview review, string customerName, long? currentCustomerId) =>
        new(
            review.Id,
            review.ProductId,
            customerName,
            review.Rating,
            review.Comment,
            review.IsApproved,
            review.IsVerifiedPurchase,
            currentCustomerId.HasValue && currentCustomerId.Value == review.CustomerId,
            review.CreatedAt,
            review.UpdatedAt);

    private static AdminProductReviewResponse MapAdmin(ProductReview review) =>
        new(
            review.Id,
            review.ProductId,
            review.Product.Name,
            review.CustomerId,
            $"{review.Customer.FirstName} {review.Customer.LastName}".Trim(),
            review.Rating,
            review.Comment,
            review.IsApproved,
            review.IsVerifiedPurchase,
            review.CreatedAt,
            review.UpdatedAt);

    private static string PublicCustomerName(string firstName, string? lastName)
    {
        var cleanFirst = string.IsNullOrWhiteSpace(firstName) ? "Customer" : firstName.Trim();
        var cleanLast = lastName?.Trim();
        return string.IsNullOrEmpty(cleanLast)
            ? cleanFirst
            : $"{cleanFirst} {cleanLast[0]}.";
    }

    private static void Validate(UpsertProductReviewRequest request)
    {
        if (request.Rating is < 1 or > 5)
            throw new ArgumentException("Rating must be between 1 and 5.");
        if (request.Comment?.Trim().Length > 2000)
            throw new ArgumentException("Review comment cannot exceed 2,000 characters.");
    }

    private static string? CleanComment(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
