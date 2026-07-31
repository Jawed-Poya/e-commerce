using ECommerce.Entities;
using ECommerce.Entities.Auditing.Contracts;
using ECommerce.Services.Auditing;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Route("api/storefront/visits")]
public sealed class StoreVisitController(IAuditLogService service) : ApiControllerBase
{
    [AllowAnonymous]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Record(
        RecordStoreVisitRequest request,
        CancellationToken cancellationToken)
    {
        await service.RecordStoreVisitAsync(request, HttpContext, cancellationToken);
        return StatusCode(
            StatusCodes.Status202Accepted,
            ApiResponse<object>.Ok(new { }, "Visit recorded."));
    }
}
