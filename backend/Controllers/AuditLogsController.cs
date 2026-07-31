using ECommerce.Entities.Auditing.Contracts;
using ECommerce.Services.Auditing;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Route("api/admin/audit-logs")]
[Authorize(Policy = AppPermissions.AuditLogsView)]
public sealed class AuditLogsController(IAuditLogService service) : ApiControllerBase
{
    [HttpGet("activities")]
    public async Task<ActionResult<ApiResponse<AuditPageResponse<ActivityLogResponse>>>> Activities(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await service.GetActivityLogsAsync(
            search,
            page,
            pageSize,
            cancellationToken);
        return Success(result);
    }

    [HttpGet("visits")]
    public async Task<ActionResult<ApiResponse<AuditPageResponse<CustomerVisitLogResponse>>>> Visits(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await service.GetVisitLogsAsync(
            search,
            page,
            pageSize,
            cancellationToken);
        return Success(result);
    }
}
