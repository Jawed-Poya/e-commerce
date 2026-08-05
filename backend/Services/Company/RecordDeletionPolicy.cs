using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Company;

public interface IRecordDeletionPolicy
{
    Task EnsureProductCanBeArchivedAsync(long productId, CancellationToken cancellationToken = default);
    Task EnsureCustomerCanBeArchivedAsync(long customerId, CancellationToken cancellationToken = default);
    Task EnsureGeneralTypeCanBeArchivedAsync(long typeId, CancellationToken cancellationToken = default);
    Task EnsureCanBePermanentlyDeletedAsync(string entityType, long entityId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Protects master data and immutable financial history. Referenced records are
/// deactivated instead of being hidden in trash, keeping old documents auditable.
/// </summary>
public sealed class RecordDeletionPolicy(ApplicationDbContext context) : IRecordDeletionPolicy
{
    public async Task EnsureProductCanBeArchivedAsync(
        long productId,
        CancellationToken cancellationToken = default)
    {
        var referenced =
            await context.OrderItems.IgnoreQueryFilters().AnyAsync(item => item.ProductId == productId, cancellationToken) ||
            await context.PurchaseItems.IgnoreQueryFilters().AnyAsync(item => item.ProductId == productId, cancellationToken) ||
            await context.InventorySaleItems.IgnoreQueryFilters().AnyAsync(item => item.ProductId == productId, cancellationToken) ||
            await context.InventoryTransactions.IgnoreQueryFilters().AnyAsync(item => item.ProductId == productId, cancellationToken) ||
            await context.InventoryLots.IgnoreQueryFilters().AnyAsync(item => item.ProductId == productId, cancellationToken) ||
            await context.ProductInventories.IgnoreQueryFilters().AnyAsync(
                item => item.ProductId == productId && (item.Quantity != 0 || item.ReservedQuantity != 0),
                cancellationToken);

        if (referenced)
        {
            throw new InvalidOperationException(
                "This product has stock, sales, purchases, or inventory history and cannot be moved to trash. Deactivate it to keep historical documents accurate.");
        }
    }

    public async Task EnsureCustomerCanBeArchivedAsync(
        long customerId,
        CancellationToken cancellationToken = default)
    {
        var referenced =
            await context.Orders.IgnoreQueryFilters().AnyAsync(item => item.CustomerId == customerId, cancellationToken) ||
            await context.InventorySales.IgnoreQueryFilters().AnyAsync(item => item.CustomerId == customerId, cancellationToken) ||
            await context.ProductReviews.IgnoreQueryFilters().AnyAsync(item => item.CustomerId == customerId, cancellationToken);

        if (referenced)
        {
            throw new InvalidOperationException(
                "This customer has sales, orders, or review history and cannot be moved to trash. Keep the record for auditing.");
        }
    }

    public async Task EnsureGeneralTypeCanBeArchivedAsync(
        long typeId,
        CancellationToken cancellationToken = default)
    {
        var referenced =
            await context.Types.IgnoreQueryFilters().AnyAsync(item => item.ParentId == typeId, cancellationToken) ||
            await context.Products.IgnoreQueryFilters().AnyAsync(
                item => item.CategoryId == typeId || item.BrandId == typeId || item.UnitId == typeId,
                cancellationToken) ||
            await context.ProductPrices.IgnoreQueryFilters().AnyAsync(
                item => item.CustomerTypeId == typeId || item.PriceTypeId == typeId,
                cancellationToken) ||
            await context.ProductUnitConversions.IgnoreQueryFilters().AnyAsync(item => item.UnitId == typeId, cancellationToken) ||
            await context.Customers.IgnoreQueryFilters().AnyAsync(item => item.CustomerTypeId == typeId, cancellationToken) ||
            await context.Expenses.IgnoreQueryFilters().AnyAsync(item => item.GeneralTypeCategoryId == typeId, cancellationToken);

        if (referenced)
        {
            throw new InvalidOperationException(
                "This type is used by existing business records and cannot be moved to trash. Rename or deactivate the related record instead.");
        }
    }

    public async Task EnsureCanBePermanentlyDeletedAsync(
        string entityType,
        long entityId,
        CancellationToken cancellationToken = default)
    {
        if (entityType is nameof(Order) or nameof(Purchase) or nameof(InventorySale)
            or nameof(StaffSalaryPayment) or nameof(Expense))
        {
            throw new InvalidOperationException(
                "Financial documents cannot be permanently deleted. Keep them for auditing and use their cancel or reverse workflow instead.");
        }

        switch (entityType)
        {
            case nameof(Product):
                await EnsureProductCanBeArchivedAsync(entityId, cancellationToken);
                break;
            case nameof(Customer):
                await EnsureCustomerCanBeArchivedAsync(entityId, cancellationToken);
                break;
            case nameof(GeneralType):
                await EnsureGeneralTypeCanBeArchivedAsync(entityId, cancellationToken);
                break;
            case nameof(Supplier):
                if (await context.Purchases.IgnoreQueryFilters().AnyAsync(item => item.SupplierId == entityId, cancellationToken))
                    throw Referenced("supplier", "purchase");
                break;
            case nameof(Staff):
                if (await context.StaffSalaryPayments.IgnoreQueryFilters().AnyAsync(item => item.StaffId == entityId, cancellationToken))
                    throw Referenced("staff member", "payroll");
                break;
            case nameof(Warehouse):
                if (await context.InventoryLots.IgnoreQueryFilters().AnyAsync(item => item.WarehouseId == entityId, cancellationToken))
                    throw Referenced("warehouse", "inventory-lot");
                break;
        }
    }

    private static InvalidOperationException Referenced(string record, string history) =>
        new($"This {record} has {history} history and cannot be permanently deleted.");
}
