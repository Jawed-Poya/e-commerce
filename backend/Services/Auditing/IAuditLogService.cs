using ECommerce.Entities;
using ECommerce.Entities.Auditing.Contracts;

namespace ECommerce.Services.Auditing;

public interface IAuditLogService
{
    ValueTask RecordAuthenticationAsync(string userId, string userName, long? customerId, ActivityAction action, string area, HttpContext httpContext, CancellationToken ct = default);
    Task RecordStoreVisitAsync(RecordStoreVisitRequest request, HttpContext httpContext, CancellationToken ct);
    Task<AuditPageResponse<ActivityLogResponse>> GetActivityLogsAsync(string? search, string? action, int page, int pageSize, CancellationToken ct);
    Task<AuditPageResponse<CustomerVisitLogResponse>> GetVisitLogsAsync(string? search, int page, int pageSize, CancellationToken ct);
}
