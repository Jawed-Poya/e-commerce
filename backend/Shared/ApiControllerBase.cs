using System.Security.Claims;
using ECommerce.Entities;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Shared;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    protected ActionResult<ApiResponse<T>> Success<T>(T data, string? message = null) =>
        Ok(ApiResponse<T>.Ok(data, message ?? "Operation completed successfully."));

    protected ActionResult<ApiResponse<T>> CreatedSuccess<T>(T data, string? message = null) =>
        StatusCode(StatusCodes.Status201Created, ApiResponse<T>.Ok(data, message ?? "Operation completed successfully."));
}
