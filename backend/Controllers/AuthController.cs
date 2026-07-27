using ECommerce.Entities;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Services.Auth;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("customer/register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RegisterCustomer(
        RegisterCustomerRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateWriteScope();
            var response = await auth.RegisterCustomerAsync(request, operation.Token);
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<AuthResponse>.Ok(response, "Customer account created successfully."));
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

    [HttpPost("customer/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginCustomer(
        LoginRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            return Ok(ApiResponse<AuthResponse>.Ok(
                await auth.LoginCustomerAsync(request, operation.Token),
                "Welcome back."));
        }
        catch (InvalidOperationException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpPost("admin/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginAdmin(
        LoginRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            return Ok(ApiResponse<AuthResponse>.Ok(
                await auth.LoginAdminAsync(request, operation.Token),
                "Admin login successful."));
        }
        catch (UnauthorizedAccessException exception)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<AuthUserResponse>>> Me()
    {
        using var operation = ServerOperation.CreateReadScope();
        var user = await TransientSqlRetry.ExecuteAsync(
            token => auth.GetCurrentAsync(token),
            operation.Token);
        return user is null
            ? Unauthorized(ApiResponse<object>.Fail("Authentication is required."))
            : Ok(ApiResponse<AuthUserResponse>.Ok(user));
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> Profile()
    {
        using var operation = ServerOperation.CreateReadScope();
        var profile = await TransientSqlRetry.ExecuteAsync(
            token => auth.GetProfileAsync(token),
            operation.Token);
        return profile is null
            ? Unauthorized(ApiResponse<object>.Fail("Authentication is required."))
            : Ok(ApiResponse<UserProfileResponse>.Ok(profile));
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> UpdateProfile(
        UpdateUserProfileRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateWriteScope();
            var profile = await auth.UpdateProfileAsync(request, operation.Token);
            return Ok(ApiResponse<UserProfileResponse>.Ok(profile, "Profile updated successfully."));
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

    [Authorize]
    [HttpPost("change-password")]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword(
        ChangePasswordRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateWriteScope();
            await auth.ChangePasswordAsync(request, operation.Token);
            return Ok(ApiResponse<object>.Ok(new { }, "Password changed successfully."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
