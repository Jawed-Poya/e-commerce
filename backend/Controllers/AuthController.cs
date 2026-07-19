using ECommerce.Entities;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService auth) : ControllerBase
{
    [HttpPost("customer/register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RegisterCustomer(
        RegisterCustomerRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await auth.RegisterCustomerAsync(request, cancellationToken);
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
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<AuthResponse>.Ok(
                await auth.LoginCustomerAsync(request, cancellationToken),
                "Welcome back."));
        }
        catch (InvalidOperationException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpPost("admin/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginAdmin(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<AuthResponse>.Ok(
                await auth.LoginAdminAsync(request, cancellationToken),
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
    public async Task<ActionResult<ApiResponse<AuthUserResponse>>> Me(CancellationToken cancellationToken)
    {
        var user = await auth.GetCurrentAsync(cancellationToken);
        return user is null
            ? Unauthorized(ApiResponse<object>.Fail("Authentication is required."))
            : Ok(ApiResponse<AuthUserResponse>.Ok(user));
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> Profile(
        CancellationToken cancellationToken)
    {
        var profile = await auth.GetProfileAsync(cancellationToken);
        return profile is null
            ? Unauthorized(ApiResponse<object>.Fail("Authentication is required."))
            : Ok(ApiResponse<UserProfileResponse>.Ok(profile));
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileResponse>>> UpdateProfile(
        UpdateUserProfileRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var profile = await auth.UpdateProfileAsync(request, cancellationToken);
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
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await auth.ChangePasswordAsync(request, cancellationToken);
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
