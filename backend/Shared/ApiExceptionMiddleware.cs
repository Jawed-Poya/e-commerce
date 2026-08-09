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
            var (status, message, level) = MapException(exception);

            logger.Log(level, exception, "API request failed with status {StatusCode}: {Method} {Path}", status, context.Request.Method, context.Request.Path);
            if (context.Response.HasStarted) throw;

            context.Response.Clear();
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message), CancellationToken.None);
        }
    }

    public static int GetStatusCode(Exception exception) => MapException(exception).Status;

    private static (int Status, string Message, LogLevel Level) MapException(Exception exception)
    {
        var mapped = exception switch
        {
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, Message(exception, "You do not have permission to perform this action."), LogLevel.Warning),
            KeyNotFoundException => (StatusCodes.Status404NotFound, Message(exception, "The requested resource was not found."), LogLevel.Information),
            ArgumentException => (StatusCodes.Status400BadRequest, Message(exception, "Check the entered information and try again."), LogLevel.Information),
            DbUpdateException dbException when SqlServerExceptionClassifier.IsUniqueConstraintViolation(dbException) =>
                (StatusCodes.Status409Conflict, "This action was already completed or the value must be unique. Refresh and try again.", LogLevel.Warning),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "The record changed while you were editing it. Refresh and try again.", LogLevel.Warning),
            DbUpdateException => (StatusCodes.Status409Conflict, "The data could not be saved because it conflicts with the current database state.", LogLevel.Warning),
            OperationCanceledException => (StatusCodes.Status408RequestTimeout, "The request took too long and was cancelled. Please try again.", LogLevel.Warning),
            InvalidOperationException => (StatusCodes.Status409Conflict, Message(exception, "The operation conflicts with the current data. Refresh and try again."), LogLevel.Warning),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected server error occurred.", LogLevel.Error)
        };
        return mapped;
    }

    private static string Message(Exception exception, string fallback) =>
        string.IsNullOrWhiteSpace(exception.Message) ? fallback : exception.Message.Trim();
}
