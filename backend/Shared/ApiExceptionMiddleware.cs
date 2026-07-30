using ECommerce.Entities;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Shared;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The browser disconnected or replaced the request. This is not an API failure.
        }
        catch (Exception exception)
        {
            var (status, message, level) = exception switch
            {
                UnauthorizedAccessException => (StatusCodes.Status403Forbidden, exception.Message.Length > 0 ? exception.Message : "You do not have permission to perform this action.", LogLevel.Warning),
                KeyNotFoundException => (StatusCodes.Status404NotFound, exception.Message, LogLevel.Information),
                ArgumentException => (StatusCodes.Status400BadRequest, exception.Message, LogLevel.Information),
                DbUpdateException dbException when SqlServerExceptionClassifier.IsUniqueConstraintViolation(dbException) =>
                    (StatusCodes.Status409Conflict, "This action was already completed or the value must be unique. Refresh and try again.", LogLevel.Warning),
                DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "The record changed while you were editing it. Refresh and try again.", LogLevel.Warning),
                DbUpdateException => (StatusCodes.Status409Conflict, "The data could not be saved because it conflicts with the current database state.", LogLevel.Warning),
                OperationCanceledException => (StatusCodes.Status408RequestTimeout, "The request took too long and was cancelled. Please try again.", LogLevel.Warning),
                InvalidOperationException => (StatusCodes.Status409Conflict, exception.Message, LogLevel.Warning),
                _ => (StatusCodes.Status500InternalServerError, "An unexpected server error occurred.", LogLevel.Error)
            };

            logger.Log(level, exception, "API request failed with status {StatusCode}: {Method} {Path}", status, context.Request.Method, context.Request.Path);
            if (context.Response.HasStarted) throw;

            context.Response.Clear();
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message), CancellationToken.None);
        }
    }
}
