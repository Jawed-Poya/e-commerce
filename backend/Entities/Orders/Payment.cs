using API.Entities.Common;

namespace API.Entities.Orders;

public class Payment : BaseEntity
{
    public long OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public string Provider { get; set; } = null!;
    public string? ExternalReference { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "AFN";
    public PaymentStatus Status { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
}
