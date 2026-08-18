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

    /// <summary>Reusable customer money created by overpayments.</summary>
    public decimal AccountCredit { get; set; }

    /// <summary>Optional per-customer override; null uses the company limit.</summary>
    public decimal? CreditLimit { get; set; }

    /// <summary>Optional per-customer debt due period; null uses company settings.</summary>
    public int? DebtDueDays { get; set; }

    public GeneralType? CustomerType { get; set; }

    public ICollection<Order> Orders { get; set; } = [];

    public ICollection<CustomerAddress> Addresses { get; set; } = [];
}
