using API.Entities.Common;

namespace ECommerce.Entities.Products;

public class Warehouse : BaseEntity
{
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
}
