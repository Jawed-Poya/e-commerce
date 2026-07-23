using API.Entities.Customers;

namespace ECommerce.Entities.Products;

public class ProductReview : ProductEntity
{
    public long CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public int Rating { get; set; }

    public string? Comment { get; set; }

    public bool IsApproved { get; set; } = false;

    public bool IsVerifiedPurchase { get; set; }
}
