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

    public decimal Subtotal { get; set; }

    public decimal DiscountTotal { get; set; }

    public decimal TaxTotal { get; set; }

    public decimal ShippingTotal { get; set; }

    public string Currency { get; set; } = "AFN";

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    public FulfillmentStatus FulfillmentStatus { get; set; } = FulfillmentStatus.Unfulfilled;

    public DateTime? ReservationExpiresAt { get; set; }

    public string? ShippingAddressJson { get; set; }

    public string? BillingAddressJson { get; set; }

    public string? Notes { get; set; }

    public ICollection<OrderItem> Items { get; set; } = [];

    public ICollection<Payment> Payments { get; set; } = [];

    public ICollection<OrderStatusHistory> StatusHistory { get; set; } = [];
}
