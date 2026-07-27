using API.Entities.Common;
using API.Entities.Products;

namespace ECommerce.Entities.Products;

public class ProductEntity : BaseEntity
{
    public long ProductId { get; set; }

    public Product Product { get; set; } = null!;
}
