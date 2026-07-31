namespace ECommerce.Entities;

using API.Entities.Common;
using API.Entities.Customers;

public sealed class CustomerVisitLog : BaseEntity
{
    public long? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string SessionId { get; set; } = null!;
    public string Path { get; set; } = null!;
    public string? Referrer { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? DeviceType { get; set; }
    public string? Browser { get; set; }
    public string? OperatingSystem { get; set; }
    public string? Language { get; set; }
    public int? ScreenWidth { get; set; }
    public int? ScreenHeight { get; set; }
    public bool IsAuthenticated { get; set; }
}
