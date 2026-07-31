using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Entities;
using ECommerce.Entities.Auditing.Contracts;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Auditing;

public sealed class AuditLogService(
    ApplicationDbContext context,
    ActivityLogQueue queue,
    ECommerce.Services.Company.ICompanyContext companyContext) : IAuditLogService
{
    public async ValueTask RecordAuthenticationAsync(
        string userId,
        string userName,
        long? customerId,
        ActivityAction action,
        string area,
        HttpContext httpContext,
        CancellationToken ct = default)
    {
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        var device = ClientDeviceParser.Parse(userAgent);
        await queue.EnqueueAsync(new ActivityLog
        {
            TenantId = companyContext.CompanyId,
            BranchId = companyContext.BranchId,
            UserId = userId,
            UserName = Clean(userName, 256),
            CustomerId = customerId,
            Action = action,
            EntityName = area,
            Description = action == ActivityAction.Login
                ? $"{userName} signed in to {area}."
                : $"{userName} created a customer account.",
            HttpMethod = httpContext.Request.Method.ToUpperInvariant(),
            Path = httpContext.Request.Path,
            StatusCode = httpContext.Response.StatusCode is >= 200 and < 400
                ? httpContext.Response.StatusCode
                : StatusCodes.Status200OK,
            RequestId = httpContext.TraceIdentifier,
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Clean(userAgent, 1000),
            DeviceType = device.DeviceType,
            Browser = device.Browser,
            OperatingSystem = device.OperatingSystem,
            CreatedAt = DateTime.UtcNow
        }, ct);
    }

    public async Task RecordStoreVisitAsync(RecordStoreVisitRequest request, HttpContext httpContext, CancellationToken ct)
    {
        var sessionId = Clean(request.SessionId, 100) ?? throw new ArgumentException("Visit session is required.");
        var path = Clean(request.Path, 1000) ?? "/";
        var cutoff = DateTime.UtcNow.AddMinutes(-15);
        var duplicate = await context.CustomerVisitLogs.AsNoTracking().AnyAsync(
            x => x.SessionId == sessionId && x.Path == path && x.CreatedAt >= cutoff,
            ct);
        if (duplicate) return;

        var customerIdValue = httpContext.User.FindFirstValue(AuthClaims.CustomerId);
        var customerId = long.TryParse(customerIdValue, out var parsedCustomerId) ? parsedCustomerId : (long?)null;
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        var device = ClientDeviceParser.Parse(userAgent);
        context.CustomerVisitLogs.Add(new CustomerVisitLog
        {
            CustomerId = customerId,
            SessionId = sessionId,
            Path = path,
            Referrer = Clean(request.Referrer, 2000),
            IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Clean(userAgent, 1000),
            DeviceType = device.DeviceType,
            Browser = device.Browser,
            OperatingSystem = device.OperatingSystem,
            Language = Clean(request.Language, 20),
            ScreenWidth = Positive(request.ScreenWidth),
            ScreenHeight = Positive(request.ScreenHeight),
            IsAuthenticated = httpContext.User.Identity?.IsAuthenticated == true
        });
        await context.SaveChangesAsync(ct);
    }

    public async Task<AuditPageResponse<ActivityLogResponse>> GetActivityLogsAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        var query = context.ActivityLogs.AsNoTracking();
        var clean = Clean(search, 200);
        if (clean is not null)
            query = query.Where(x =>
                (x.UserName != null && x.UserName.Contains(clean)) ||
                x.EntityName.Contains(clean) ||
                x.Description.Contains(clean) ||
                (x.Path != null && x.Path.Contains(clean)) ||
                (x.IpAddress != null && x.IpAddress.Contains(clean)));

        var paging = Normalize(page, pageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize).Take(paging.PageSize)
            .Select(x => new ActivityLogResponse(x.Id, x.CreatedAt, x.UserName, x.Action.ToString(), x.EntityName, x.EntityId, x.Description, x.HttpMethod, x.Path, x.StatusCode, x.DurationMs, x.IpAddress, x.DeviceType, x.Browser, x.OperatingSystem))
            .ToListAsync(ct);
        return new AuditPageResponse<ActivityLogResponse>(items, total, paging.Page, paging.PageSize);
    }

    public async Task<AuditPageResponse<CustomerVisitLogResponse>> GetVisitLogsAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        var query = context.CustomerVisitLogs.AsNoTracking();
        var clean = Clean(search, 200);
        if (clean is not null)
            query = query.Where(x =>
                x.Path.Contains(clean) ||
                x.SessionId.Contains(clean) ||
                (x.IpAddress != null && x.IpAddress.Contains(clean)) ||
                (x.Browser != null && x.Browser.Contains(clean)) ||
                (x.Customer != null && (x.Customer.FirstName.Contains(clean) || (x.Customer.LastName != null && x.Customer.LastName.Contains(clean)))));

        var paging = Normalize(page, pageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize).Take(paging.PageSize)
            .Select(x => new CustomerVisitLogResponse(x.Id, x.CreatedAt, x.CustomerId, x.Customer == null ? null : (x.Customer.FirstName + " " + (x.Customer.LastName ?? "")).Trim(), x.SessionId, x.Path, x.Referrer, x.IpAddress, x.DeviceType, x.Browser, x.OperatingSystem, x.Language, x.IsAuthenticated))
            .ToListAsync(ct);
        return new AuditPageResponse<CustomerVisitLogResponse>(items, total, paging.Page, paging.PageSize);
    }

    private static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 10, 100));
    private static int? Positive(int? value) => value > 0 ? value : null;
    private static string? Clean(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];
}
