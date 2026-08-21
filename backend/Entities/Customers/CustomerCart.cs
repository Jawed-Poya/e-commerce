using API.Entities.Common;

namespace API.Entities.Customers;

/// <summary>
/// A customer-owned cart snapshot shared by every authenticated storefront client.
/// Checkout still revalidates product price, stock, unit, and quantity rules.
/// </summary>
public sealed class CustomerCart : BaseEntity
{
    public long CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public long Revision { get; set; }
    public string Payload { get; set; } = "[]";
}
