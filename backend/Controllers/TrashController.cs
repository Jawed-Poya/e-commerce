using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/trash")]
[Authorize(Policy = AppPermissions.TenantTrashManage)]
public sealed class TrashController(ITrashService trash) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<TrashItemResponse>>>> Get(
        [FromQuery] string? search,
        [FromQuery] string? entityType,
        [FromQuery] long? branchId,
        CancellationToken cancellationToken) =>
        Ok(ApiResponse<IReadOnlyCollection<TrashItemResponse>>.Ok(await trash.GetAsync(search, entityType, branchId, cancellationToken)));

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
