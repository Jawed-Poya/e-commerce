using ECommerce.Entities;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Services.Auth;
using ECommerce.Services.Auth.Verification;
using ECommerce.Services.Auth.PasswordRecovery;
using ECommerce.Services.Auditing;
using ECommerce.Options;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IAuthService auth,
    IAccountVerificationService verification,
    IPasswordRecoveryService passwordRecovery,
    IAuditLogService audit,
    IOptions<GoogleAuthOptions> googleOptions) : ControllerBase
{
    [HttpPost("customer/register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> RegisterCustomer(
        RegisterCustomerRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateWriteScope();
            var response = await auth.RegisterCustomerAsync(request, operation.Token);
            await audit.RecordAuthenticationAsync(
                response.User.UserId,
                response.User.FullName,
                response.User.CustomerId,
                ActivityAction.Create,
                "Customer account",
                HttpContext,
                CancellationToken.None);
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
            var response = await auth.LoginCustomerAsync(request, operation.Token);
            await audit.RecordAuthenticationAsync(
                response.User.UserId,
                response.User.FullName,
                response.User.CustomerId,
                ActivityAction.Login,
                "Storefront",
                HttpContext,
                CancellationToken.None);
            return Ok(ApiResponse<AuthResponse>.Ok(response, "Welcome back."));
        }
        catch (InvalidOperationException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
    }


    [HttpPost("customer/google")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> SignInWithGoogle(
        GoogleSignInRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await auth.SignInWithGoogleAsync(request, cancellationToken);
            await audit.RecordAuthenticationAsync(
                response.User.UserId,
                response.User.FullName,
                response.User.CustomerId,
                ActivityAction.Login,
                "Google storefront sign-in",
                HttpContext,
                CancellationToken.None);
            return Ok(ApiResponse<AuthResponse>.Ok(response, "Google sign-in successful."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
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

    [HttpGet("customer/google/config")]
    public ActionResult<ApiResponse<object>> GoogleConfiguration()
    {
        var clientId = googleOptions.Value.ClientId?.Trim();
        return Ok(ApiResponse<object>.Ok(new
        {
            enabled = !string.IsNullOrWhiteSpace(clientId),
            clientId
        }));
    }

    [HttpPost("customer/forgot-password")]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPassword(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await passwordRecovery.RequestResetAsync(request.Email, cancellationToken);
            return Ok(ApiResponse<object>.Ok(
                new { },
                "If a customer account exists for this email, a password reset link has been sent."));
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

    [HttpPost("customer/reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await passwordRecovery.ResetAsync(
                request.Email,
                request.Token,
                request.NewPassword,
                cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { }, "Password reset successfully. You can sign in now."));
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

    [Authorize]
    [HttpPost("verification/send")]
    public async Task<ActionResult<ApiResponse<VerificationDispatchResponse>>> SendVerification(
        VerificationRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Channel))
            return BadRequest(ApiResponse<object>.Fail("Select a valid verification channel."));
        if (request.Channel != VerificationChannel.Email)
            return BadRequest(ApiResponse<object>.Fail(
                "Phone verification is disabled. Verify your email instead."));

        try
        {
            var result = await verification.SendAsync(request.Channel, cancellationToken);
            var message = result.AlreadyVerified
                ? "This email is already verified."
                : result.DevelopmentCode is null
                    ? "Verification code sent."
                    : "Development verification code generated.";
            return Ok(ApiResponse<VerificationDispatchResponse>.Ok(result, message));
        }
        catch (UnauthorizedAccessException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize]
    [HttpPost("verification/confirm")]
    public async Task<ActionResult<ApiResponse<AuthUserResponse>>> ConfirmVerification(
        ConfirmVerificationRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Channel))
            return BadRequest(ApiResponse<object>.Fail("Select a valid verification channel."));
        if (request.Channel != VerificationChannel.Email)
            return BadRequest(ApiResponse<object>.Fail(
                "Phone verification is disabled. Verify your email instead."));
        if (string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(ApiResponse<object>.Fail("Verification code is required."));

        try
        {
            var result = await verification.ConfirmAsync(request.Channel, request.Code, cancellationToken);
            return Ok(ApiResponse<AuthUserResponse>.Ok(result, "Email verified successfully."));
        }
        catch (UnauthorizedAccessException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpPost("admin/login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> LoginAdmin(
        LoginRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            var response = await auth.LoginAdminAsync(request, operation.Token);
            await audit.RecordAuthenticationAsync(
                response.User.UserId,
                response.User.FullName,
                response.User.CustomerId,
                ActivityAction.Login,
                "Admin panel",
                HttpContext,
                CancellationToken.None);
            return Ok(ApiResponse<AuthResponse>.Ok(response, "Admin login successful."));
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
    [HttpPost("customer/set-password")]
    [HttpPost("set-password")]
    public async Task<ActionResult<ApiResponse<object>>> SetPassword(
        SetPasswordRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateWriteScope();
            await auth.SetPasswordAsync(request, operation.Token);
            return Ok(ApiResponse<object>.Ok(new { }, "Password created successfully."));
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

    [Authorize]
    [HttpPost("customer/change-password")]
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
