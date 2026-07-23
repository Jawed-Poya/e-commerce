using API.Entities.Types;
using ECommerce.Entities.Products;

namespace API.Entities.Products;


public class ProductPrice : ProductEntity
{
    public long CustomerTypeId { get; set; }

    public GeneralType CustomerType { get; set; } = null!;
    
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public long? PriceTypeId { get; set; }

    public GeneralType? PriceType { get; set; } = null!;

    public decimal RegularPrice { get; set; }

    public decimal? SalePrice { get; set; }
}
