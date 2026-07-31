using ECommerce.Data;
using ECommerce.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Auditing;

public sealed class AuditCleanupHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<AuditOptions> options,
    ILogger<AuditCleanupHostedService> logger) : BackgroundService
{
    private readonly AuditOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Avoid adding cleanup work to application startup and migration time.
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
        var interval = TimeSpan.FromHours(Math.Clamp(_options.CleanupIntervalHours, 1, 168));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var now = DateTime.UtcNow;
                var activityCutoff = now.AddDays(-Math.Clamp(_options.ActivityRetentionDays, 30, 3650));
                var visitCutoff = now.AddDays(-Math.Clamp(_options.VisitRetentionDays, 30, 3650));

                var activities = await context.ActivityLogs
                    .Where(item => item.CreatedAt < activityCutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                var visits = await context.CustomerVisitLogs
                    .Where(item => item.CreatedAt < visitCutoff)
                    .ExecuteDeleteAsync(stoppingToken);

                if (activities > 0 || visits > 0)
                    logger.LogInformation(
                        "Removed {ActivityCount} expired activity logs and {VisitCount} expired visit logs.",
                        activities,
                        visits);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Audit log retention cleanup failed.");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
