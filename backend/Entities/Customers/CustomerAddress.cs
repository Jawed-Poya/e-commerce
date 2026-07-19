using API.Entities.Common;

namespace API.Entities.Customers;

public class CustomerAddress : BaseEntity
{
    public long CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string Label { get; set; } = "Home";
    public string RecipientName { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string AddressLine1 { get; set; } = null!;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = null!;
    public string? State { get; set; }
    public string Country { get; set; } = null!;
    public string? PostalCode { get; set; }
    public bool IsDefaultShipping { get; set; }
    public bool IsDefaultBilling { get; set; }
}
