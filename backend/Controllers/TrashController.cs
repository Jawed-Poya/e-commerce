using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Services.Company;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/trash")]
[Authorize(Policy = AppPermissions.CompanyTrashManage)]
public sealed class TrashController(ITrashService trash) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<TrashItemResponse>>>> Get(
        [FromQuery] string? search,
        [FromQuery] string? entityType,
        [FromQuery] long? branchId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default) =>
        Ok(ApiResponse<PagedResult<TrashItemResponse>>.Ok(await trash.GetAsync(search, entityType, branchId, page, pageSize, cancellationToken)));

    [HttpPost("{id:long}/restore")]
    public async Task<ActionResult<ApiResponse<object>>> Restore(long id, CancellationToken cancellationToken)
    {
        await trash.RestoreAsync(id, User.FindFirstValue(ClaimTypes.NameIdentifier), cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { id }, "Item restored."));
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Purge(long id, CancellationToken cancellationToken)
    {
        await trash.PurgeAsync(id, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { id }, "Item permanently deleted."));
    }
}
