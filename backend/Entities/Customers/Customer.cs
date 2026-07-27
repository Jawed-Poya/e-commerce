using API.Entities.Common;
using API.Entities.Orders;
using API.Entities.Types;

namespace API.Entities.Customers;

public class Customer : BaseEntity
{
    public string FirstName { get; set; } = null!;
    public string? LastName { get; set; }

    public string Phone { get; set; } = null!;

    public string? Email { get; set; }

    public string? Address { get; set; }

    public long? CustomerTypeId { get; set; }

    public GeneralType? CustomerType { get; set; }

    public ICollection<Order> Orders { get; set; } = [];

    public ICollection<CustomerAddress> Addresses { get; set; } = [];
}
