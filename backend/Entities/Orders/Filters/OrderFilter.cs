using API.Entities.Orders;
using ECommerce.Entities.Orders;

namespace ECommerce.Entities.Orders.Filters;

public sealed class OrderFilter
{
    public string? Search { get; set; }

    public OrderStatus? Status { get; set; }

    public PaymentStatus? PaymentStatus { get; set; }

    public PaymentMethod? PaymentMethod { get; set; }

    public DateTime? From { get; set; }

    public DateTime? To { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}
