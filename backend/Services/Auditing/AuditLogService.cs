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
    StorePresenceTracker presence,
    ECommerce.Services.Company.IBranchContext branchContext) : IAuditLogService
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
            BranchId = branchContext.BranchId,
            UserId = userId,
            UserName = Clean(userName, 256),
            CustomerId = customerId,
            Action = action,
            EntityName = area,
            Description = action == ActivityAction.Login
                ? $"{userName} signed in to {area}."
                : $"{userName} created a customer account.",
            HttpMethod = Clean(httpContext.Request.Method.ToUpperInvariant(), 12),
            Path = Clean(httpContext.Request.Path + httpContext.Request.QueryString, 1000),
            StatusCode = httpContext.Response.StatusCode is >= 200 and < 400
                ? httpContext.Response.StatusCode
                : StatusCodes.Status200OK,
            RequestId = Clean(httpContext.TraceIdentifier, 100),
            IpAddress = Clean(httpContext.Connection.RemoteIpAddress?.ToString(), 64),
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
        var activity = Clean(request.Activity, 20)?.ToLowerInvariant() ?? "pageview";
        if (activity == "leave")
        {
            presence.Leave(sessionId);
            return;
        }

        var customerIdValue = httpContext.User.FindFirstValue(AuthClaims.CustomerId);
        var customerId = long.TryParse(customerIdValue, out var parsedCustomerId) ? parsedCustomerId : (long?)null;
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        var device = ClientDeviceParser.Parse(userAgent);
        var now = DateTime.UtcNow;
        string? customerName = null;
        if (customerId.HasValue)
        {
            presence.TryGet(sessionId, out var currentPresence);
            customerName = currentPresence?.CustomerId == customerId
                ? currentPresence.CustomerName
                : await context.Customers.AsNoTracking()
                    .Where(customer => customer.Id == customerId.Value)
                    .Select(customer => (customer.FirstName + " " + (customer.LastName ?? "")).Trim())
                    .SingleOrDefaultAsync(ct);

            // Once a guest signs in, stitch this browser session's recent
            // anonymous journey to the verified customer. This makes product
            // and search intent visible on the customer profile without
            // trusting any identity supplied by the browser.
            if (currentPresence?.CustomerId != customerId)
            {
                var journeyCutoff = now.AddDays(-30);
                await context.CustomerVisitLogs
                    .Where(visit =>
                        visit.SessionId == sessionId &&
                        visit.CustomerId == null &&
                        visit.CreatedAt >= journeyCutoff)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(visit => visit.CustomerId, customerId)
                        .SetProperty(visit => visit.IsAuthenticated, true), ct);
            }
        }

        presence.Touch(new StorePresenceEntry(
            sessionId,
            customerId,
            customerName,
            path,
            Clean(request.PageTitle, 200),
            now,
            now,
            httpContext.Connection.RemoteIpAddress?.ToString(),
            device.DeviceType,
            device.Browser,
            device.OperatingSystem,
            Clean(request.Language, 20),
            httpContext.User.Identity?.IsAuthenticated == true));

        // Heartbeats maintain online presence only. Persisting them as visits
        // would make a customer who waits on one product look like many views.
        if (activity == "heartbeat") return;

        // React development mode and fast redirects can issue the same page
        // view twice. Deduplicate only that small window without suppressing a
        // genuine return to the page later.
        var cutoff = now.AddSeconds(-10);
        var duplicate = await context.CustomerVisitLogs.AsNoTracking().AnyAsync(
            x => x.SessionId == sessionId && x.Path == path && x.CreatedAt >= cutoff,
            ct);
        if (duplicate) return;

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

    public async Task<AuditPageResponse<ActivityLogResponse>> GetActivityLogsAsync(string? search, string? action, int page, int pageSize, CancellationToken ct)
    {
        var query = context.ActivityLogs.AsNoTracking();
        var cleanAction = Clean(action, 50);
        if (cleanAction is not null &&
            Enum.TryParse<ActivityAction>(cleanAction, ignoreCase: true, out var parsedAction))
        {
            query = query.Where(x => x.Action == parsedAction);
        }

        var clean = Clean(search, 200);
        if (clean is not null)
        {
            var hasSearchAction = Enum.TryParse<ActivityAction>(
                clean.Equals("add", StringComparison.OrdinalIgnoreCase) ? nameof(ActivityAction.Create) : clean,
                ignoreCase: true,
                out var searchAction);
            query = query.Where(x =>
                (hasSearchAction && x.Action == searchAction) ||
                (x.UserName != null && x.UserName.Contains(clean)) ||
                x.EntityName.Contains(clean) ||
                x.Description.Contains(clean) ||
                (x.Changes != null && x.Changes.Contains(clean)) ||
                (x.Path != null && x.Path.Contains(clean)) ||
                (x.IpAddress != null && x.IpAddress.Contains(clean)));
        }

        var paging = Normalize(page, pageSize);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize).Take(paging.PageSize)
            .Select(x => new ActivityLogResponse(x.Id, x.CreatedAt, x.UserName, x.Action.ToString(), x.EntityName, x.EntityId, x.Description, x.Changes, x.HttpMethod, x.Path, x.StatusCode, x.DurationMs, x.IpAddress, x.DeviceType, x.Browser, x.OperatingSystem))
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

    public async Task<VisitAnalyticsResponse> GetVisitAnalyticsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var analyticsCutoff = now.AddDays(-30);
        var dayCutoff = now.AddHours(-24);

        var visits = await context.CustomerVisitLogs.AsNoTracking()
            .Where(x => x.CreatedAt >= analyticsCutoff)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.SessionId,
                x.CustomerId,
                CustomerName = x.Customer == null ? null : (x.Customer.FirstName + " " + (x.Customer.LastName ?? "")).Trim(),
                x.Path,
                x.CreatedAt,
                x.DeviceType,
                x.IsAuthenticated
            })
            .Take(50000)
            .ToListAsync(ct);

        var active = presence.GetActive(now)
            .Take(50)
            .Select(x => new ActiveVisitorResponse(
                x.SessionId,
                x.CustomerId,
                x.CustomerName,
                x.CurrentPath,
                x.PageTitle,
                x.FirstSeenAt,
                x.LastSeenAt,
                x.DeviceType,
                x.Browser,
                x.OperatingSystem,
                x.Language,
                x.IsAuthenticated))
            .ToArray();

        var productGroups = visits
            .Select(x => NormalizePath(x.Path))
            .Where(path => path.StartsWith("/products/", StringComparison.OrdinalIgnoreCase))
            .GroupBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Select(group => new { Path = group.Key, Visits = group.Count(), ProductId = ProductId(group.Key) })
            .OrderByDescending(x => x.Visits)
            .Take(8)
            .ToArray();
        var productIds = productGroups
            .Where(item => item.ProductId.HasValue)
            .Select(item => item.ProductId!.Value)
            .Distinct()
            .ToArray();
        var productNames = await context.Products
            .AsNoTracking()
            .Where(product => productIds.Contains(product.Id))
            .Select(product => new { product.Id, product.Name })
            .ToDictionaryAsync(product => product.Id, product => product.Name, ct);
        var products = productGroups
            .Select(item => new VisitMetricResponse(
                item.ProductId.HasValue
                    ? productNames.GetValueOrDefault(item.ProductId.Value, ProductLabel(item.Path))
                    : ProductLabel(item.Path),
                item.Path,
                item.Visits))
            .ToArray();

        var searches = visits
            .Select(x => QueryValue(x.Path, "search"))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .GroupBy(value => value!, StringComparer.OrdinalIgnoreCase)
            .Select(group => new SearchMetricResponse(group.Key, group.Count()))
            .OrderByDescending(x => x.Searches)
            .ThenBy(x => x.Term)
            .Take(8)
            .ToArray();

        var visitsToday = visits.Where(x => x.CreatedAt >= dayCutoff).ToArray();
        return new VisitAnalyticsResponse(
            now,
            active.Length,
            active.Count(x => x.IsAuthenticated),
            visitsToday.Length,
            visitsToday.Select(x => x.SessionId).Distinct().Count(),
            products,
            searches,
            active);
    }

    private static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 10, 100));
    private static int? Positive(int? value) => value > 0 ? value : null;
    private static string? Clean(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];

    private static string NormalizePath(string value)
    {
        var index = value.IndexOf('?');
        return index < 0 ? value : value[..index];
    }

    private static string ProductLabel(string path)
    {
        var value = path["/products/".Length..].Trim('/');
        return Uri.UnescapeDataString(value.Replace('-', ' '));
    }

    private static long? ProductId(string path)
    {
        var value = path["/products/".Length..].Trim('/');
        return long.TryParse(value, out var id) && id > 0 ? id : null;
    }

    private static string? QueryValue(string path, string name)
    {
        var index = path.IndexOf('?');
        if (index < 0 || index == path.Length - 1) return null;
        foreach (var pair in path[(index + 1)..].Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var separator = pair.IndexOf('=');
            var key = separator < 0 ? pair : pair[..separator];
            if (!Uri.UnescapeDataString(key).Equals(name, StringComparison.OrdinalIgnoreCase)) continue;
            var raw = separator < 0 ? string.Empty : pair[(separator + 1)..];
            return Uri.UnescapeDataString(raw.Replace('+', ' ')).Trim();
        }
        return null;
    }
}
