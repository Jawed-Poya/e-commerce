using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using ECommerce.Entities.Storefront;
using ECommerce.Entities.Tenancy;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Tenancy;

public sealed record TrashItemResponse(
    long Id,
    string EntityType,
    string EntityId,
    string DisplayName,
    DateTime DeletedAt,
    string? DeletedByName,
    long? BranchId,
    string? BranchName,
    DateTime ScheduledPurgeAt,
    string? SnapshotJson);

public interface ITrashService
{
    Task<IReadOnlyCollection<TrashItemResponse>> GetAsync(string? search, string? entityType, long? branchId, CancellationToken cancellationToken = default);
    Task RestoreAsync(long trashId, string? userId, CancellationToken cancellationToken = default);
    Task PurgeAsync(long trashId, CancellationToken cancellationToken = default);
    Task<int> PurgeExpiredAsync(CancellationToken cancellationToken = default);
}

public sealed class TrashService(
    ApplicationDbContext context,
    ITenantContext tenantContext,
    ILogger<TrashService> logger) : ITrashService
{
    public async Task<IReadOnlyCollection<TrashItemResponse>> GetAsync(
        string? search,
        string? entityType,
        long? branchId,
        CancellationToken cancellationToken = default)
    {
        var retention = await context.TenantSettings.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .Select(item => (int?)item.TrashRetentionDays)
            .FirstOrDefaultAsync(cancellationToken) ?? 30;
        retention = NormalizeRetention(retention);
        var branches = await context.Branches.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var query = context.TrashRecords.AsNoTracking()
            .Where(item => item.RestoredAt == null && item.PurgedAt == null);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(item => item.DisplayName.Contains(search) || item.EntityId.Contains(search));
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(item => item.EntityType == entityType);
        if (branchId.HasValue)
            query = query.Where(item => item.BranchId == branchId.Value);

        var items = await query.OrderByDescending(item => item.CreatedAt).Take(1000).ToListAsync(cancellationToken);
        return items.Select(item => new TrashItemResponse(
            item.Id,
            item.EntityType,
            item.EntityId,
            item.DisplayName,
            item.CreatedAt,
            item.DeletedByName,
            item.BranchId,
            item.BranchId.HasValue ? branches.GetValueOrDefault(item.BranchId.Value) : null,
            item.CreatedAt.AddDays(retention),
            item.SnapshotJson)).ToArray();
    }

    public async Task RestoreAsync(long trashId, string? userId, CancellationToken cancellationToken = default)
    {
        var trash = await context.TrashRecords.FirstOrDefaultAsync(item => item.Id == trashId && item.RestoredAt == null && item.PurgedAt == null, cancellationToken)
            ?? throw new KeyNotFoundException("Trash item not found.");
        if (!long.TryParse(trash.EntityId, out var entityId))
            throw new InvalidOperationException("The deleted entity identifier is invalid.");

        try
        {
            var restored = await RestoreEntityAsync(trash.EntityType, entityId, trash.TenantId, cancellationToken);
            if (!restored) throw new KeyNotFoundException("The deleted record no longer exists.");
            trash.RestoredAt = DateTime.UtcNow;
            trash.RestoredByUserId = userId;
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueConstraintViolation(exception))
        {
            throw new InvalidOperationException(
                "This item cannot be restored because an active record now uses the same unique value. Rename or remove the conflicting record first.",
                exception);
        }
    }

    public async Task PurgeAsync(long trashId, CancellationToken cancellationToken = default)
    {
        var trash = await context.TrashRecords.FirstOrDefaultAsync(item => item.Id == trashId && item.RestoredAt == null && item.PurgedAt == null, cancellationToken)
            ?? throw new KeyNotFoundException("Trash item not found.");
        if (!long.TryParse(trash.EntityId, out var entityId))
            throw new InvalidOperationException("The deleted entity identifier is invalid.");
        try
        {
            await DeleteEntityAsync(trash.EntityType, entityId, trash.TenantId, cancellationToken);
            trash.PurgedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (IsForeignKeyConstraintViolation(exception))
        {
            throw new InvalidOperationException(
                "This item cannot be permanently deleted because historical records still reference it. Keep it in trash or remove the dependent records first.",
                exception);
        }
    }

    public async Task<int> PurgeExpiredAsync(CancellationToken cancellationToken = default)
    {
        var settings = await context.TenantSettings.AsNoTracking().ToDictionaryAsync(item => item.TenantId, item => item.TrashRetentionDays, cancellationToken);
        var candidates = await context.TrashRecords.IgnoreQueryFilters()
            .Where(item => item.RestoredAt == null && item.PurgedAt == null)
            .OrderBy(item => item.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);
        var purged = 0;
        foreach (var item in candidates)
        {
            var retention = NormalizeRetention(settings.GetValueOrDefault(item.TenantId, 30));
            if (item.CreatedAt.AddDays(retention) > DateTime.UtcNow) continue;
            try
            {
                if (long.TryParse(item.EntityId, out var entityId))
                    await DeleteEntityAsync(item.EntityType, entityId, item.TenantId, cancellationToken);
                item.PurgedAt = DateTime.UtcNow;
                purged++;
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    exception,
                    "Skipped expired trash item {TrashId} ({EntityType} {EntityId}) for tenant {TenantId} because it could not be purged.",
                    item.Id,
                    item.EntityType,
                    item.EntityId,
                    item.TenantId);
            }
        }
        if (purged > 0) await context.SaveChangesAsync(cancellationToken);
        return purged;
    }

    private async Task<bool> RestoreEntityAsync(string type, long id, long tenantId, CancellationToken cancellationToken)
    {
        return type switch
        {
            nameof(Product) => await Restore(context.Products.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Customer) => await Restore(context.Customers.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Order) => await Restore(context.Orders.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(GeneralType) => await Restore(context.Types.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Supplier) => await Restore(context.Suppliers.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Purchase) => await Restore(context.Purchases.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(InventorySale) => await Restore(context.InventorySales.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Staff) => await Restore(context.StaffMembers.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(StaffSalaryPayment) => await Restore(context.StaffSalaryPayments.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Expense) => await Restore(context.Expenses.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(ProductReview) => await Restore(context.ProductReviews.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Warehouse) => await Restore(context.Warehouses.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(Notification) => await Restore(context.Notifications.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            nameof(StorefrontContent) => await Restore(context.StorefrontContents.IgnoreQueryFilters(), id, tenantId, cancellationToken),
            _ => false
        };
    }

    private async Task DeleteEntityAsync(string type, long id, long tenantId, CancellationToken cancellationToken)
    {
        var affected = type switch
        {
            nameof(Product) => await context.Products.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Customer) => await context.Customers.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Order) => await context.Orders.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(GeneralType) => await context.Types.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Supplier) => await context.Suppliers.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Purchase) => await context.Purchases.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(InventorySale) => await context.InventorySales.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Staff) => await context.StaffMembers.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(StaffSalaryPayment) => await context.StaffSalaryPayments.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Expense) => await context.Expenses.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(ProductReview) => await context.ProductReviews.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Warehouse) => await context.Warehouses.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(Notification) => await context.Notifications.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            nameof(StorefrontContent) => await context.StorefrontContents.IgnoreQueryFilters().Where(item => item.Id == id && item.TenantId == tenantId).ExecuteDeleteAsync(cancellationToken),
            _ => 0
        };
        if (affected == 0 && !KnownType(type))
            throw new InvalidOperationException($"Permanent deletion is not supported for '{type}'.");
    }

    private async Task<bool> Restore<TEntity>(IQueryable<TEntity> query, long id, long tenantId, CancellationToken cancellationToken)
        where TEntity : API.Entities.Common.BaseEntity
    {
        var entity = await query.FirstOrDefaultAsync(item => item.Id == id && item.TenantId == tenantId, cancellationToken);
        if (entity is null) return false;
        entity.IsDeleted = false;
        entity.DeletedAt = null;
        entity.UpdatedAt = DateTime.UtcNow;
        return true;
    }

    private static bool KnownType(string type) => type is nameof(Product) or nameof(Customer) or nameof(Order) or nameof(GeneralType)
        or nameof(Supplier) or nameof(Purchase) or nameof(InventorySale) or nameof(Staff) or nameof(StaffSalaryPayment)
        or nameof(Expense) or nameof(ProductReview) or nameof(Warehouse) or nameof(Notification) or nameof(StorefrontContent);

    private static int NormalizeRetention(int days) => Math.Clamp(days, 1, 3650);

    private static bool IsUniqueConstraintViolation(Exception exception) =>
        FindSqlException(exception) is { Number: 2601 or 2627 };

    private static bool IsForeignKeyConstraintViolation(Exception exception) =>
        FindSqlException(exception) is { Number: 547 };

    private static SqlException? FindSqlException(Exception? exception)
    {
        while (exception is not null)
        {
            if (exception is SqlException sqlException)
                return sqlException;
            exception = exception.InnerException;
        }

        return null;
    }
}

public sealed class TrashCleanupHostedService(IServiceScopeFactory scopeFactory, ILogger<TrashCleanupHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(12));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
                tenantContext.Initialize(1, null, "system", true);
                var service = scope.ServiceProvider.GetRequiredService<ITrashService>();
                var count = await service.PurgeExpiredAsync(stoppingToken);
                if (count > 0) logger.LogInformation("Permanently purged {Count} expired trash items.", count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception)
            {
                logger.LogError(exception, "Trash cleanup failed.");
            }
            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
