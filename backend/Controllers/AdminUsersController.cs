using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Services.Users;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/users")]
public sealed class AdminUsersController(IAdminUserService users) : ControllerBase
{
    [Authorize(Policy = AppPermissions.UsersView)]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<AdminUserListItemResponse>>>> GetUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? isActive,
        CancellationToken cancellationToken)
    {
        return Ok(ApiResponse<IReadOnlyCollection<AdminUserListItemResponse>>.Ok(
            await users.GetUsersAsync(search, role, isActive, cancellationToken)));
    }

    [Authorize(Policy = AppPermissions.UsersView)]
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<AdminUserDetailsResponse>>> GetUser(
        string id,
        CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(id, cancellationToken);
        return user is null
            ? NotFound(ApiResponse<object>.Fail("User not found."))
            : Ok(ApiResponse<AdminUserDetailsResponse>.Ok(user));
    }

    [Authorize(Policy = AppPermissions.UsersManage)]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<AdminUserDetailsResponse>>> CreateUser(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await users.CreateUserAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<AdminUserDetailsResponse>.Ok(user, "User created successfully."));
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

    [Authorize(Policy = AppPermissions.UsersManage)]
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<AdminUserDetailsResponse>>> UpdateUser(
        string id,
        UpdateAdminUserRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await users.UpdateUserAsync(
                id,
                request,
                User.FindFirstValue(ClaimTypes.NameIdentifier),
                cancellationToken);
            return Ok(ApiResponse<AdminUserDetailsResponse>.Ok(user, "User updated successfully."));
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

    [Authorize(Policy = AppPermissions.UsersManage)]
    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(
        string id,
        ResetUserPasswordRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await users.ResetPasswordAsync(id, request, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { id }, "Password reset successfully."));
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

    [Authorize(Policy = AppPermissions.UsersManage)]
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> DeactivateUser(
        string id,
        CancellationToken cancellationToken)
    {
        try
        {
            await users.DeactivateUserAsync(
                id,
                User.FindFirstValue(ClaimTypes.NameIdentifier),
                cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { id }, "User deactivated successfully."));
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
}
