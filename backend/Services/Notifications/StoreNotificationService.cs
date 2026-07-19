using ECommerce.Data;
using ECommerce.Entities.Notifications;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Customers;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Notifications;

public sealed class StoreNotificationService(
    ApplicationDbContext context,
    ICurrentCustomerAccessor currentCustomer,
    IDefaultCustomerTypeResolver defaultCustomerType) : IStoreNotificationService
{
    private const string StockEntityType = "StoreProductStock";
    private const string PriceEntityTypePrefix = "StoreProductPrice:";

    public async Task CreatePriceChangedAsync(
        long productId,
        long customerTypeId,
        decimal? previousPrice,
        decimal newPrice,
        CancellationToken cancellationToken = default)
    {
        if (previousPrice.HasValue && previousPrice.Value == newPrice) return;

        var data = await context.Products
            .AsNoTracking()
            .Where(product => product.Id == productId && product.IsActive)
            .Select(product => new
            {
                product.Name,
                CustomerTypeName = context.Types
                    .Where(type => type.Id == customerTypeId)
                    .Select(type => type.Name)
                    .FirstOrDefault()
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (data is null) return;

        var audience = string.IsNullOrWhiteSpace(data.CustomerTypeName)
            ? "customers"
            : $"{data.CustomerTypeName} customers";
        var message = previousPrice.HasValue
            ? $"{data.Name} changed from {previousPrice.Value:0.##} to {newPrice:0.##} for {audience}."
            : $"{data.Name} now has a price of {newPrice:0.##} for {audience}.";

        context.Notifications.Add(new Notification
        {
            Title = $"Price updated: {data.Name}",
            Message = message,
            Type = NotificationType.Product,
            EntityType = PriceEntityTypePrefix + customerTypeId,
            EntityId = productId,
            UserId = null
        });
    }

    public async Task CreateStockIncreasedAsync(
        long productId,
        decimal previousAvailable,
        decimal newAvailable,
        CancellationToken cancellationToken = default)
    {
        if (newAvailable <= previousAvailable) return;

        var productName = await context.Products
            .AsNoTracking()
            .Where(product => product.Id == productId && product.IsActive)
            .Select(product => product.Name)
            .SingleOrDefaultAsync(cancellationToken);

        if (productName is null) return;

        context.Notifications.Add(new Notification
        {
            Title = $"Back in stock: {productName}",
            Message = previousAvailable <= 0
                ? $"{productName} is available again."
                : $"More {productName} stock is now available.",
            Type = NotificationType.Inventory,
            EntityType = StockEntityType,
            EntityId = productId,
            UserId = null
        });
    }

    public async Task<StoreNotificationsResponse> GetStoreNotificationsAsync(
        DateTime? after,
        IReadOnlyCollection<long> productIds,
        CancellationToken cancellationToken = default)
    {
        var serverTime = DateTime.UtcNow;
        var ids = productIds.Where(id => id > 0).Distinct().Take(100).ToArray();
        if (ids.Length == 0)
            return new StoreNotificationsResponse(serverTime, []);

        var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
        var currentTypeId = await currentCustomer.GetCustomerTypeIdAsync(cancellationToken);
        var allowedPriceTypes = new[]
        {
            PriceEntityTypePrefix + defaultTypeId,
            currentTypeId.HasValue ? PriceEntityTypePrefix + currentTypeId.Value : null
        }.OfType<string>().Distinct().ToArray();

        var threshold = after?.ToUniversalTime() ?? serverTime.AddDays(-2);
        if (threshold < serverTime.AddDays(-30)) threshold = serverTime.AddDays(-30);

        var rows = await context.Notifications
            .AsNoTracking()
            .Where(notification =>
                !notification.IsDeleted &&
                notification.UserId == null &&
                notification.EntityId.HasValue &&
                ids.Contains(notification.EntityId.Value) &&
                notification.CreatedAt > threshold &&
                (notification.EntityType == StockEntityType ||
                 allowedPriceTypes.Contains(notification.EntityType!)))
            .OrderBy(notification => notification.CreatedAt)
            .Take(50)
            .Select(notification => new
            {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                ProductId = notification.EntityId!.Value,
                ProductName = context.Products
                    .IgnoreQueryFilters()
                    .Where(product => product.Id == notification.EntityId.Value)
                    .Select(product => product.Name)
                    .FirstOrDefault(),
                notification.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new StoreNotificationsResponse(
            serverTime,
            rows.Select(row => new StoreNotificationResponse(
                row.Id,
                row.Title,
                row.Message,
                row.Type == NotificationType.Inventory ? "Stock" : "Price",
                row.ProductId,
                row.ProductName ?? "Product",
                $"/products/{row.ProductId}",
                row.CreatedAt)).ToList());
    }
}
