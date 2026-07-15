namespace ECommerce.Entities.Orders;

public enum OrderStatus
{
    Pending = 1,

    Confirmed = 2,

    Processing = 3,

    Delivered = 4,

    Returned = 5,

    Cancelled = 6,
}