using ECommerce.Data;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Company;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Notifications;

public sealed class InventoryExpiryAlertService(
    ApplicationDbContext context,
    ICompanyContext companyContext,
    AdminNotificationBroker broker,
    ILogger<InventoryExpiryAlertService> logger) : IInventoryExpiryAlertService
{
    private const string EntityTypePrefix = "Admin:InventoryExpiry:";
    private const string LotEntityTypePrefix = EntityTypePrefix + "Lot:";
    private const string ProductEntityTypePrefix = EntityTypePrefix + "Product:";
    private const int MaximumNewAlertsPerRun = 250;

    public async Task<int> GenerateAsync(CancellationToken cancellationToken = default)
    {
        var settings = await context.TenantSettings
            .AsNoTracking()
            .Where(item => item.TenantId == companyContext.CompanyId)
            .Select(item => new
            {
                item.ExpiryAlertsEnabled,
                item.ExpiryAlertLeadDays
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (settings is { ExpiryAlertsEnabled: false })
        {
            await RemoveActiveSystemAlertsAsync(cancellationToken);
            return 0;
        }

        var leadDays = Math.Clamp(settings?.ExpiryAlertLeadDays ?? 30, 1, 365);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alertThrough = today.AddDays(leadDays);

        var lotEvents = await LoadLotEventsAsync(today, alertThrough, cancellationToken);
        var productEvents = await LoadProductFallbackEventsAsync(today, alertThrough, cancellationToken);
        var expiryEvents = lotEvents
            .Concat(productEvents)
            .OrderBy(item => item.ExpiresAt)
            .ThenBy(item => item.Title)
            .ToArray();

        var dueKeys = expiryEvents
            .Select(item => Key(item.EntityId, item.EntityType))
            .ToHashSet(StringComparer.Ordinal);

        var existing = await context.Notifications
            .AsNoTracking()
            .Where(item =>
                item.UserId == null &&
                item.EntityType != null &&
                item.EntityType.StartsWith(EntityTypePrefix))
            .ToListAsync(cancellationToken);

        var resolvedIds = existing
            .Where(item =>
                !item.IsDeleted &&
                !dueKeys.Contains(Key(item.EntityId ?? 0, item.EntityType!)))
            .Select(item => item.Id)
            .ToArray();

        if (resolvedIds.Length > 0)
        {
            await context.Notifications
                .Where(item => resolvedIds.Contains(item.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }

        // Deleted rows represent alerts an administrator intentionally dismissed.
        // Keep those keys until retention cleanup so the scanner does not recreate
        // the same alert every 15 minutes.
        var existingKeys = existing
            .Where(item =>
                !resolvedIds.Contains(item.Id) &&
                item.EntityId.HasValue &&
                item.EntityType is not null)
            .Select(item => Key(item.EntityId!.Value, item.EntityType!))
            .ToHashSet(StringComparer.Ordinal);

        var pending = new List<Notification>();
        foreach (var expiryEvent in expiryEvents)
        {
            if (!existingKeys.Add(Key(expiryEvent.EntityId, expiryEvent.EntityType)))
                continue;

            pending.Add(new Notification
            {
                TenantId = expiryEvent.TenantId,
                BranchId = expiryEvent.BranchId,
                Title = expiryEvent.Title,
                Message = expiryEvent.Message,
                Type = NotificationType.Inventory,
                EntityType = expiryEvent.EntityType,
                EntityId = expiryEvent.EntityId,
                UserId = null
            });

            if (pending.Count >= MaximumNewAlertsPerRun)
                break;
        }

        if (pending.Count == 0)
            return 0;

        context.Notifications.AddRange(pending);
        await context.SaveChangesAsync(cancellationToken);

        foreach (var notification in pending)
        {
            try
            {
                broker.Publish(companyContext.CompanyId, Map(notification));
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Could not publish inventory expiry notification {NotificationId}.",
                    notification.Id);
            }
        }

        logger.LogInformation(
            "Created {Count} inventory expiry alerts through {AlertThrough} for company {CompanyId}.",
            pending.Count,
            alertThrough,
            companyContext.CompanyId);

        return pending.Count;
    }

    private async Task<IReadOnlyCollection<ExpiryEvent>> LoadLotEventsAsync(
        DateOnly today,
        DateOnly alertThrough,
        CancellationToken cancellationToken)
    {
        var lots = await context.InventoryLots
            .AsNoTracking()
            .Where(lot =>
                lot.Quantity > 0 &&
                lot.ExpiresAt.HasValue &&
                lot.ExpiresAt.Value <= alertThrough)
            .OrderBy(lot => lot.ExpiresAt)
            .ThenBy(lot => lot.Product.Name)
            .ThenBy(lot => lot.Id)
            .Select(lot => new
            {
                lot.Id,
                lot.TenantId,
                lot.BranchId,
                lot.Product.Name,
                lot.Product.Strength,
                WarehouseName = lot.Warehouse.Name,
                lot.LotNumber,
                lot.Quantity,
                ExpiresAt = lot.ExpiresAt!.Value
            })
            .ToListAsync(cancellationToken);

        return lots.Select(lot =>
        {
            var productName = ProductLabel(lot.Name, lot.Strength);
            var lotLabel = string.IsNullOrWhiteSpace(lot.LotNumber)
                ? $"Lot #{lot.Id}"
                : $"Lot {lot.LotNumber}";
            var status = BuildStatus(
                productName,
                lot.ExpiresAt,
                today,
                $"{lotLabel} in {lot.WarehouseName}",
                lot.Quantity);

            return new ExpiryEvent(
                lot.Id,
                $"{LotEntityTypePrefix}{lot.ExpiresAt:yyyyMMdd}",
                lot.TenantId,
                lot.BranchId,
                lot.ExpiresAt,
                status.Title,
                status.Message);
        }).ToArray();
    }

    private async Task<IReadOnlyCollection<ExpiryEvent>> LoadProductFallbackEventsAsync(
        DateOnly today,
        DateOnly alertThrough,
        CancellationToken cancellationToken)
    {
        var products = await context.ProductInventories
            .AsNoTracking()
            .Where(inventory =>
                inventory.Quantity > 0 &&
                inventory.ExpireDate.HasValue &&
                inventory.ExpireDate.Value <= alertThrough &&
                !context.InventoryLots.Any(lot =>
                    lot.ProductId == inventory.ProductId &&
                    lot.Quantity > 0 &&
                    lot.ExpiresAt.HasValue))
            .OrderBy(inventory => inventory.ExpireDate)
            .ThenBy(inventory => inventory.Product.Name)
            .Select(inventory => new
            {
                inventory.ProductId,
                inventory.TenantId,
                inventory.BranchId,
                inventory.Product.Name,
                inventory.Product.Strength,
                inventory.Quantity,
                ExpiresAt = inventory.ExpireDate!.Value
            })
            .ToListAsync(cancellationToken);

        return products.Select(product =>
        {
            var productName = ProductLabel(product.Name, product.Strength);
            var status = BuildStatus(
                productName,
                product.ExpiresAt,
                today,
                "Product inventory",
                product.Quantity);

            return new ExpiryEvent(
                product.ProductId,
                $"{ProductEntityTypePrefix}{product.ExpiresAt:yyyyMMdd}",
                product.TenantId,
                product.BranchId,
                product.ExpiresAt,
                status.Title,
                status.Message);
        }).ToArray();
    }

    private Task<int> RemoveActiveSystemAlertsAsync(CancellationToken cancellationToken) =>
        context.Notifications
            .Where(item =>
                !item.IsDeleted &&
                item.UserId == null &&
                item.EntityType != null &&
                item.EntityType.StartsWith(EntityTypePrefix))
            .ExecuteDeleteAsync(cancellationToken);

    private static (string Title, string Message) BuildStatus(
        string productName,
        DateOnly expiresAt,
        DateOnly today,
        string locationLabel,
        decimal quantity)
    {
        var daysRemaining = expiresAt.DayNumber - today.DayNumber;
        var dateLabel = expiresAt.ToString("yyyy-MM-dd");
        var quantityLabel = quantity.ToString("0.###");

        return daysRemaining switch
        {
            < 0 => (
                $"Expired inventory: {productName}",
                $"{locationLabel} expired on {dateLabel}. {quantityLabel} units remain and should be isolated immediately."),
            0 => (
                $"Expires today: {productName}",
                $"{locationLabel} expires today ({dateLabel}). {quantityLabel} units remain."),
            1 => (
                $"Expires tomorrow: {productName}",
                $"{locationLabel} expires tomorrow ({dateLabel}). {quantityLabel} units remain."),
            _ => (
                $"Expiry warning: {productName}",
                $"{locationLabel} expires in {daysRemaining} days on {dateLabel}. {quantityLabel} units remain.")
        };
    }

    private static string ProductLabel(string name, string? strength) =>
        string.IsNullOrWhiteSpace(strength) ? name : $"{name} · {strength}";

    private static AdminNotificationResponse Map(Notification notification) =>
        new(
            notification.Id,
            notification.Title,
            notification.Message,
            "Expiry",
            notification.EntityId,
            "/inventory",
            notification.CreatedAt);

    private static string Key(long entityId, string entityType) => $"{entityId}:{entityType}";

    private sealed record ExpiryEvent(
        long EntityId,
        string EntityType,
        long TenantId,
        long? BranchId,
        DateOnly ExpiresAt,
        string Title,
        string Message);
}

public sealed class InventoryExpiryAlertHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<InventoryExpiryAlertHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await GenerateAsync(stoppingToken);

        using var timer = new PeriodicTimer(CheckInterval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
                await GenerateAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
    }

    private async Task GenerateAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var companyContext = scope.ServiceProvider.GetRequiredService<CompanyContext>();
            companyContext.Initialize();
            var service = scope.ServiceProvider.GetRequiredService<IInventoryExpiryAlertService>();
            await service.GenerateAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Inventory expiry alert generation failed.");
        }
    }
}
