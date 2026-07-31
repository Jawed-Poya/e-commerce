namespace ECommerce.Entities;

using API.Entities.Common;
using API.Entities.Customers;
using ECommerce.Entities.Users;

public class ActivityLog : BaseEntity
{
    public string? UserId { get; set; }

    public User? User { get; set; }

    public long? CustomerId { get; set; }

    public Customer? Customer { get; set; }

    public ActivityAction Action { get; set; }

    public string EntityName { get; set; } = null!;

    public long? EntityId { get; set; }

    public string Description { get; set; } = null!;

    public string? Changes { get; set; } // as json (string values)

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public string? UserName { get; set; }
    public string? HttpMethod { get; set; }
    public string? Path { get; set; }
    public int? StatusCode { get; set; }
    public long? DurationMs { get; set; }
    public string? RequestId { get; set; }
    public string? DeviceType { get; set; }
    public string? Browser { get; set; }
    public string? OperatingSystem { get; set; }
}
