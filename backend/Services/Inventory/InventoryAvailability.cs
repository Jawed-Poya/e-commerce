using ECommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Inventory;

/// <summary>
/// Central rules for stock that may legally and operationally be sold.
/// Expired lot quantities remain visible to administrators for quarantine and
/// write-off, but they are excluded from storefront, checkout, and manual-sale
/// availability.
/// </summary>
public static class InventoryAvailability
{
    public static DateOnly UtcToday => DateOnly.FromDateTime(DateTime.UtcNow);

    public static bool IsExpired(DateOnly? expiresAt, DateOnly today) =>
        expiresAt.HasValue && expiresAt.Value < today;

    public static decimal PhysicalAvailable(decimal quantity, decimal reservedQuantity) =>
        Math.Max(0, quantity - reservedQuantity);

    public static decimal SellableAvailable(
        decimal quantity,
        decimal reservedQuantity,
        decimal expiredAvailableQuantity) =>
        Math.Max(0, PhysicalAvailable(quantity, reservedQuantity) - Math.Max(0, expiredAvailableQuantity));

    public static async Task<IReadOnlyDictionary<long, decimal>> LoadExpiredAvailableByProductAsync(
        ApplicationDbContext context,
        IEnumerable<long> productIds,
        CancellationToken cancellationToken = default)
    {
        var ids = productIds.Distinct().ToArray();
        if (ids.Length == 0) return new Dictionary<long, decimal>();

        var today = UtcToday;
        return await context.InventoryLots
            .AsNoTracking()
            .Where(lot =>
                ids.Contains(lot.ProductId) &&
                lot.ExpiresAt.HasValue &&
                lot.ExpiresAt.Value < today &&
                lot.Quantity - lot.ReservedQuantity > 0)
            .GroupBy(lot => lot.ProductId)
            .Select(group => new
            {
                ProductId = group.Key,
                Quantity = group.Sum(lot => lot.Quantity - lot.ReservedQuantity)
            })
            .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);
    }
}
