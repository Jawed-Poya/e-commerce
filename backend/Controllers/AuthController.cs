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
}
