using API.Entities.Common;
using ECommerce.Entities.Orders;

namespace API.Entities.Orders;

public class OrderStatusHistory : BaseEntity
{
    public long OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public OrderStatus FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    public string? Note { get; set; }
    public string? ChangedByUserId { get; set; }
}
