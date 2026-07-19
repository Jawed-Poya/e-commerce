using ECommerce.Entities;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Services.Users;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/roles")]
public sealed class AdminRolesController(IAdminUserService users) : ControllerBase
{
    [Authorize(Policy = AppPermissions.UsersView)]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<RoleListItemResponse>>>> GetRoles(
        CancellationToken cancellationToken)
    {
        return Ok(ApiResponse<IReadOnlyCollection<RoleListItemResponse>>.Ok(
            await users.GetRolesAsync(cancellationToken)));
    }

    [Authorize(Policy = AppPermissions.RolesManage)]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoleListItemResponse>>> CreateRole(
        UpsertRoleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var role = await users.CreateRoleAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<RoleListItemResponse>.Ok(role, "Role created successfully."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.RolesManage)]
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<RoleListItemResponse>>> UpdateRole(
        string id,
        UpsertRoleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<RoleListItemResponse>.Ok(
                await users.UpdateRoleAsync(id, request, cancellationToken),
                "Role updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.RolesManage)]
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteRole(
        string id,
        CancellationToken cancellationToken)
    {
        try
        {
            await users.DeleteRoleAsync(id, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { id }, "Role deleted successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.UsersView)]
    [HttpGet("permissions")]
    public ActionResult<ApiResponse<IReadOnlyCollection<PermissionGroupResponse>>> GetPermissions()
    {
        return Ok(ApiResponse<IReadOnlyCollection<PermissionGroupResponse>>.Ok(
            users.GetPermissionGroups()));
    }
}
