using ECommerce.Data;
using ECommerce.Entities;

namespace ECommerce.Services.Auditing;

/// <summary>
/// Persists audit records in batches. A failed database write is retried with
/// the same batch so a transient SQL error does not silently discard activity.
/// </summary>
public sealed class ActivityLogWriterHostedService(
    ActivityLogQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<ActivityLogWriterHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var batch = new List<ActivityLog>(100);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                batch.Add(await queue.Reader.ReadAsync(stoppingToken));
                while (batch.Count < 100 && queue.Reader.TryRead(out var item))
                    batch.Add(item);

                await PersistWithRetryAsync(batch, stoppingToken);
                batch.Clear();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task PersistWithRetryAsync(
        IReadOnlyCollection<ActivityLog> batch,
        CancellationToken cancellationToken)
    {
        var delay = TimeSpan.FromSeconds(1);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                context.ActivityLogs.AddRange(batch);
                await context.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Failed to persist {Count} activity records. Retrying in {DelaySeconds} seconds.",
                    batch.Count,
                    delay.TotalSeconds);
                await Task.Delay(delay, cancellationToken);
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
            }
        }
    }
}
