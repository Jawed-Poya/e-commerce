using API.Entities.Common;
using API.Entities.Customers;
using ECommerce.Entities.Orders;

namespace API.Entities.Orders;

public class Order : BaseEntity
{
    public string OrderNumber { get; set; } = null!;

    public long CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public decimal Total { get; set; }

    public string? Notes { get; set; }

    public ICollection<OrderItem> Items { get; set; } = [];
}
