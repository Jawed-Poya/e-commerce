using System.Diagnostics;
using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Services.Auditing;
using ECommerce.Services.Company;
using Microsoft.AspNetCore.Mvc.Controllers;
using System.Threading.Channels;

namespace ECommerce.Shared;

public sealed class ActivityAuditMiddleware(
    RequestDelegate next,
    ActivityLogQueue queue,
    ILogger<ActivityAuditMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext httpContext, IBranchContext branchContext)
    {
        if (!ShouldAudit(httpContext))
        {
            await next(httpContext);
            return;
        }

        var timer = Stopwatch.StartNew();
        Exception? failure = null;
        try
        {
            await next(httpContext);
        }
        catch (Exception exception)
        {
            failure = exception;
            throw;
        }
        finally
        {
            timer.Stop();
            var route = httpContext.Request.RouteValues;
            var descriptor = httpContext.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>();
            var controller = descriptor?.ControllerName ?? route["controller"]?.ToString() ?? "Api";
            var actionName = descriptor?.ActionName ?? route["action"]?.ToString();
            var idValue = route["id"]?.ToString();
            var entityId = long.TryParse(idValue, out var parsedId) ? parsedId : (long?)null;
            var userAgent = httpContext.Request.Headers.UserAgent.ToString();
            var device = ClientDeviceParser.Parse(userAgent);
            var statusCode = failure is null
                ? httpContext.Response.StatusCode
                : ApiExceptionMiddleware.GetStatusCode(failure);
            var method = httpContext.Request.Method.ToUpperInvariant();

            var activity = new ActivityLog
            {
                BranchId = branchContext.BranchId,
                UserId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? httpContext.User.FindFirstValue("sub"),
                UserName = httpContext.User.FindFirstValue(ClaimTypes.Name)
                    ?? httpContext.User.Identity?.Name,
                CustomerId = TryGetCustomerId(httpContext.User),
                Action = ToAction(method, httpContext.Request.Path, httpContext.Request.QueryString),
                EntityName = controller,
                EntityId = entityId,
                Description = actionName is null
                    ? $"{method} {httpContext.Request.Path} returned {statusCode}."
                    : $"{controller}.{actionName} returned {statusCode}.",
                HttpMethod = method,
                Path = httpContext.Request.Path + httpContext.Request.QueryString,
                StatusCode = statusCode,
                DurationMs = timer.ElapsedMilliseconds,
                RequestId = httpContext.TraceIdentifier,
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Limit(userAgent, 1000),
                DeviceType = device.DeviceType,
                Browser = device.Browser,
                OperatingSystem = device.OperatingSystem,
                CreatedAt = DateTime.UtcNow
            };

            try
            {
                await queue.EnqueueAsync(activity, CancellationToken.None);
            }
            catch (ChannelClosedException exception)
            {
                logger.LogCritical(
                    exception,
                    "Audit queue closed before request {RequestId} ({Method} {Path}) could be recorded.",
                    httpContext.TraceIdentifier,
                    method,
                    httpContext.Request.Path);
            }
        }
    }

    private static bool ShouldAudit(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true) return false;
        if (!context.Request.Path.StartsWithSegments("/api")) return false;
        if (context.Request.Path.StartsWithSegments("/api/storefront/visits") ||
            context.Request.Path.StartsWithSegments("/api/admin/audit-logs") ||
            context.Request.Path.StartsWithSegments("/api/auth/me")) return false;
        return !HttpMethods.IsHead(context.Request.Method) &&
               !HttpMethods.IsOptions(context.Request.Method);
    }

    private static ActivityAction ToAction(string method, PathString path, QueryString query)
    {
        var route = path.Value ?? string.Empty;

        if (Contains(route, "logout", "sign-out", "signout")) return ActivityAction.Logout;
        if (Contains(route, "login", "sign-in", "signin")) return ActivityAction.Login;
        if (Contains(route, "change-password", "reset-password", "password/change")) return ActivityAction.ChangePassword;
        if (Contains(route, "restore", "undelete")) return ActivityAction.Restore;
        if (Contains(route, "unarchive")) return ActivityAction.Restore;
        if (Contains(route, "archive")) return ActivityAction.Archive;
        if (Contains(route, "deactivate", "disable")) return ActivityAction.Deactivate;
        if (Contains(route, "activate", "enable")) return ActivityAction.Activate;
        if (Contains(route, "approve")) return ActivityAction.Approve;
        if (Contains(route, "reject", "decline")) return ActivityAction.Reject;
        if (Contains(route, "cancel") && Contains(route, "order")) return ActivityAction.CancelOrder;
        if (method == "POST" && Contains(route, "checkout", "place-order")) return ActivityAction.PlaceOrder;
        if (method != "GET" && Contains(route, "assign", "permission", "claim")) return ActivityAction.Assign;
        if (Contains(route, "synchronize", "synchronise", "sync")) return ActivityAction.Sync;
        if (Contains(route, "import")) return ActivityAction.Import;
        if (Contains(route, "export")) return ActivityAction.Export;
        if (Contains(route, "print")) return ActivityAction.Print;
        if (Contains(route, "download")) return ActivityAction.Download;
        if (Contains(route, "upload", "assets")) return ActivityAction.Upload;
        if (method == "GET") return query.HasValue ? ActivityAction.Search : ActivityAction.View;

        return method switch
        {
            "POST" => ActivityAction.Create,
            "PUT" or "PATCH" => ActivityAction.Update,
            "DELETE" => ActivityAction.Delete,
            _ => ActivityAction.Other
        };
    }

    private static bool Contains(string value, params string[] candidates) =>
        candidates.Any(candidate =>
            value.Contains(candidate, StringComparison.OrdinalIgnoreCase));

    private static long? TryGetCustomerId(ClaimsPrincipal principal) =>
        long.TryParse(principal.FindFirstValue(AuthClaims.CustomerId), out var customerId)
            ? customerId
            : null;

    private static string? Limit(string? value, int maxLength) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value.Length <= maxLength ? value : value[..maxLength];
}
