using ECommerce.Data;
using ECommerce.Entities.Notifications.Contracts;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Notifications;

/// <summary>
/// Emits the same storefront alert when a dated sale starts or ends. Direct
/// admin edits are handled by the product services; this worker covers price
/// changes caused only by the calendar crossing a configured boundary.
/// </summary>
public sealed class ScheduledPriceNotificationHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<ScheduledPriceNotificationHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await CheckAsync(stoppingToken);
        using var timer = new PeriodicTimer(CheckInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await CheckAsync(stoppingToken);
    }

    private async Task CheckAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = scope.ServiceProvider.GetRequiredService<IStoreNotificationService>();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var yesterday = today.AddDays(-1);

            var candidates = await context.ProductPrices
                .AsNoTracking()
                .Where(price =>
                    price.Product.IsActive &&
                    price.SalePrice.HasValue &&
                    (price.StartDate == today || price.EndDate == yesterday))
                .Select(price => new
                {
                    price.ProductId,
                    price.CustomerTypeId,
                    price.RegularPrice,
                    price.SalePrice,
                    price.StartDate,
                    price.EndDate
                })
                .ToListAsync(cancellationToken);
            if (candidates.Count == 0) return;

            var dayStart = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            var productIds = candidates.Select(item => item.ProductId).Distinct().ToArray();
            var entityTypes = candidates
                .Select(item => StoreNotificationService.PriceEntityType(item.CustomerTypeId))
                .Distinct()
                .ToArray();
            var alreadyNotified = await context.Notifications
                .AsNoTracking()
                .Where(item =>
                    item.CreatedAt >= dayStart &&
                    item.EntityId.HasValue &&
                    productIds.Contains(item.EntityId.Value) &&
                    item.EntityType != null &&
                    entityTypes.Contains(item.EntityType))
                .Select(item => new { ProductId = item.EntityId!.Value, item.EntityType })
                .ToListAsync(cancellationToken);
            var existingKeys = alreadyNotified
                .Select(item => $"{item.ProductId}:{item.EntityType}")
                .ToHashSet(StringComparer.Ordinal);

            var pending = new List<PendingStoreNotification?>();
            foreach (var item in candidates)
            {
                var entityType = StoreNotificationService.PriceEntityType(item.CustomerTypeId);
                if (existingKeys.Contains($"{item.ProductId}:{entityType}")) continue;

                var previousPrice = EffectivePrice(
                    item.RegularPrice,
                    item.SalePrice,
                    item.StartDate,
                    item.EndDate,
                    yesterday);
                var currentPrice = EffectivePrice(
                    item.RegularPrice,
                    item.SalePrice,
                    item.StartDate,
                    item.EndDate,
                    today);
                if (previousPrice == currentPrice) continue;

                pending.Add(await notifications.CreatePriceChangedAsync(
                    item.ProductId,
                    item.CustomerTypeId,
                    previousPrice,
                    currentPrice,
                    cancellationToken));
                existingKeys.Add($"{item.ProductId}:{entityType}");
            }

            if (!pending.Any(item => item is not null)) return;
            await context.SaveChangesAsync(cancellationToken);
            await notifications.PublishAsync(pending, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Scheduled storefront price notifications could not be checked.");
        }
    }

    private static decimal EffectivePrice(
        decimal regularPrice,
        decimal? salePrice,
        DateOnly? startDate,
        DateOnly? endDate,
        DateOnly date) =>
        salePrice.HasValue &&
        (!startDate.HasValue || startDate.Value <= date) &&
        (!endDate.HasValue || endDate.Value >= date)
            ? salePrice.Value
            : regularPrice;
}
