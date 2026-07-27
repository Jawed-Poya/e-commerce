using ECommerce.Data;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Inventory;

public sealed class InventoryCostService(ApplicationDbContext context) : IInventoryCostService
{
    public async Task<IReadOnlyDictionary<long, decimal>> GetCurrentUnitCostsAsync(
        IEnumerable<long> productIds,
        CancellationToken cancellationToken = default)
    {
        var ids = productIds.Where(id => id > 0).Distinct().ToArray();
        if (ids.Length == 0)
            return new Dictionary<long, decimal>();

        var lots = await context.InventoryLots
            .AsNoTracking()
            .Where(item => ids.Contains(item.ProductId) && item.Quantity > 0 && item.UnitCost.HasValue)
            .Select(item => new { item.ProductId, item.Quantity, UnitCost = item.UnitCost!.Value })
            .ToListAsync(cancellationToken);

        var costs = lots
            .GroupBy(item => item.ProductId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var quantity = group.Sum(item => item.Quantity);
                    return quantity <= 0
                        ? 0
                        : decimal.Round(group.Sum(item => item.Quantity * item.UnitCost) / quantity, 4);
                });

        var missing = ids.Where(id => !costs.ContainsKey(id)).ToArray();
        if (missing.Length > 0)
        {
            var purchaseRows = await context.PurchaseItems
                .AsNoTracking()
                .Where(item => missing.Contains(item.ProductId))
                .Select(item => new
                {
                    item.ProductId,
                    item.UnitCost,
                    item.Purchase.PurchaseDate,
                    item.Id
                })
                .ToListAsync(cancellationToken);

            foreach (var row in purchaseRows
                         .GroupBy(item => item.ProductId)
                         .Select(group => group
                             .OrderByDescending(item => item.PurchaseDate)
                             .ThenByDescending(item => item.Id)
                             .First()))
            {
                costs[row.ProductId] = row.UnitCost;
            }
        }

        foreach (var id in ids)
            costs.TryAdd(id, 0);

        return costs;
    }
}
