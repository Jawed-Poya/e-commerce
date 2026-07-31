namespace ECommerce.Entities.Auditing.Contracts;

public sealed class RecordStoreVisitRequest
{
    public string SessionId { get; set; } = null!;
    public string Path { get; set; } = null!;
    public string? Referrer { get; set; }
    public string? Language { get; set; }
    public int? ScreenWidth { get; set; }
    public int? ScreenHeight { get; set; }
}

public sealed record ActivityLogResponse(
    long Id,
    DateTime CreatedAt,
    string? UserName,
    string Action,
    string EntityName,
    long? EntityId,
    string Description,
    string? Changes,
    string? HttpMethod,
    string? Path,
    int? StatusCode,
    long? DurationMs,
    string? IpAddress,
    string? DeviceType,
    string? Browser,
    string? OperatingSystem);

public sealed record CustomerVisitLogResponse(
    long Id,
    DateTime CreatedAt,
    long? CustomerId,
    string? CustomerName,
    string SessionId,
    string Path,
    string? Referrer,
    string? IpAddress,
    string? DeviceType,
    string? Browser,
    string? OperatingSystem,
    string? Language,
    bool IsAuthenticated);

public sealed record AuditPageResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
