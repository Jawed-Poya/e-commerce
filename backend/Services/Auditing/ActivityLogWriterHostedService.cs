using ECommerce.Data;
using ECommerce.Entities;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Auditing;

/// <summary>
/// Persists audit records outside the request transaction. Normal operation
/// retries until SQL Server becomes available. During graceful shutdown the
/// retry window is bounded so the process cannot hang forever.
/// </summary>
public sealed class ActivityLogWriterHostedService(
    ActivityLogQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<ActivityLogWriterHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<ActivityLog>(100);

        await foreach (var item in queue.Reader.ReadAllAsync())
        {
            batch.Add(item);
            while (batch.Count < 100 && queue.Reader.TryRead(out var queued))
                batch.Add(queued);

            var persisted = await PersistWithRetryAsync(batch, stoppingToken);
            if (!persisted)
            {
                logger.LogCritical(
                    "Audit writer stopped with {Count} records that could not be persisted before shutdown.",
                    batch.Count);
            }
            batch.Clear();
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        queue.Complete();
        return base.StopAsync(cancellationToken);
    }

    private async Task<bool> PersistWithRetryAsync(
        IReadOnlyCollection<ActivityLog> batch,
        CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(1);
        var shutdownAttempts = 0;

        while (true)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await NormalizeForPersistenceAsync(context, batch);
                context.ActivityLogs.AddRange(batch);

                // Bound a single SQL attempt even if the provider or network is
                // unresponsive. The next iteration retries the same batch.
                using var attemptTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
                await context.SaveChangesAsync(attemptTimeout.Token);
                return true;
            }
            catch (Exception exception)
            {
                if (stoppingToken.IsCancellationRequested && ++shutdownAttempts >= 3)
                {
                    logger.LogError(
                        exception,
                        "Failed to persist {Count} audit records after {Attempts} shutdown attempts.",
                        batch.Count,
                        shutdownAttempts);
                    return false;
                }

                var retryDelay = stoppingToken.IsCancellationRequested
                    ? TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds, 2))
                    : delay;
                logger.LogError(
                    exception,
                    "Failed to persist {Count} activity records. Retrying in {DelaySeconds} seconds.",
                    batch.Count,
                    retryDelay.TotalSeconds);
                await Task.Delay(retryDelay, CancellationToken.None);
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
            }
        }
    }

    private static async Task NormalizeForPersistenceAsync(
        ApplicationDbContext context,
        IReadOnlyCollection<ActivityLog> batch)
    {
        var userIds = batch
            .Select(item => item.UserId)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var validUserIds = userIds.Length == 0
            ? []
            : await context.Users.AsNoTracking()
                .Where(user => userIds.Contains(user.Id))
                .Select(user => user.Id)
                .ToArrayAsync();
        var validUsers = validUserIds.ToHashSet(StringComparer.Ordinal);

        var customerIds = batch
            .Where(item => item.CustomerId.HasValue)
            .Select(item => item.CustomerId!.Value)
            .Distinct()
            .ToArray();
        var validCustomerIds = customerIds.Length == 0
            ? []
            : await context.Customers.IgnoreQueryFilters().AsNoTracking()
                .Where(customer => customerIds.Contains(customer.Id))
                .Select(customer => customer.Id)
                .ToArrayAsync();
        var validCustomers = validCustomerIds.ToHashSet();

        foreach (var item in batch)
        {
            if (item.UserId is not null && !validUsers.Contains(item.UserId))
                item.UserId = null;
            if (item.CustomerId.HasValue && !validCustomers.Contains(item.CustomerId.Value))
                item.CustomerId = null;

            item.EntityName = Limit(item.EntityName, 160) ?? "Api";
            item.Description = Limit(item.Description, 1000) ?? "Audited request.";
            item.UserName = Limit(item.UserName, 256);
            item.HttpMethod = Limit(item.HttpMethod, 12);
            item.Path = Limit(item.Path, 1000);
            item.RequestId = Limit(item.RequestId, 100);
            item.IpAddress = Limit(item.IpAddress, 64);
            item.UserAgent = Limit(item.UserAgent, 1000);
            item.DeviceType = Limit(item.DeviceType, 40);
            item.Browser = Limit(item.Browser, 100);
            item.OperatingSystem = Limit(item.OperatingSystem, 100);
        }
    }

    private static string? Limit(string? value, int maximum) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value.Length <= maximum ? value : value[..maximum];
}
