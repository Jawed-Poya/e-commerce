using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Entities.Dashboard.Contracts;
using ECommerce.Entities.Orders;
using ECommerce.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Dashboard;

public sealed class AdminDashboardService(
    ApplicationDbContext context,
    StoreRealtimeMetrics realtimeMetrics) : IAdminDashboardService
{
    public async Task<AdminDashboardResponse> GetAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var from30Days = now.Date.AddDays(-29);

        var productStats = await context.Products
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Count(),
                Active = group.Count(product => product.IsActive),
                Views = group.Sum(product => product.ViewCount)
            })
            .SingleOrDefaultAsync(cancellationToken);

        var customerCount = await context.Customers.AsNoTracking().CountAsync(cancellationToken);
        var orderCount = await context.Orders.AsNoTracking().CountAsync(cancellationToken);
        var pendingOrders = await context.Orders.AsNoTracking()
            .CountAsync(order => order.Status == OrderStatus.Pending, cancellationToken);
        var pendingPayments = await context.Orders.AsNoTracking()
            .CountAsync(order => order.PaymentStatus == PaymentStatus.Pending, cancellationToken);

        var paidRevenue = await context.Orders.AsNoTracking()
            .Where(order => order.PaymentStatus == PaymentStatus.Paid)
            .SumAsync(order => (decimal?)order.Total, cancellationToken) ?? 0m;
        var revenueLast30Days = await context.Orders.AsNoTracking()
            .Where(order => order.PaymentStatus == PaymentStatus.Paid && order.CreatedAt >= from30Days)
            .SumAsync(order => (decimal?)order.Total, cancellationToken) ?? 0m;
        var currency = await context.Orders.AsNoTracking()
            .OrderByDescending(order => order.Id)
            .Select(order => order.Currency)
            .FirstOrDefaultAsync(cancellationToken) ?? "USD";
        var notificationsLast24Hours = await context.Notifications
            .AsNoTracking()
            .CountAsync(notification => !notification.IsDeleted && notification.CreatedAt >= now.AddHours(-24), cancellationToken);

        var inventory = await context.ProductInventories
            .AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new InventoryHealthSummary(
                group.Count(item => item.Quantity - item.ReservedQuantity > item.MinimumQuantity),
                group.Count(item => item.Quantity - item.ReservedQuantity > 0 && item.Quantity - item.ReservedQuantity <= item.MinimumQuantity),
                group.Count(item => item.Quantity - item.ReservedQuantity <= 0),
                group.Sum(item => item.Quantity),
                group.Sum(item => item.ReservedQuantity),
                group.Sum(item => item.Quantity - item.ReservedQuantity)))
            .SingleOrDefaultAsync(cancellationToken)
            ?? new InventoryHealthSummary(0, 0, 0, 0, 0, 0);

        var statusCounts = await context.Orders
            .AsNoTracking()
            .GroupBy(order => order.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var salesRows = await context.Orders
            .AsNoTracking()
            .Where(order => order.CreatedAt >= from30Days)
            .Select(order => new
            {
                Date = order.CreatedAt.Date,
                Revenue = order.PaymentStatus == PaymentStatus.Paid ? order.Total : 0m
            })
            .ToListAsync(cancellationToken);

        var trendByDate = salesRows
            .GroupBy(row => DateOnly.FromDateTime(row.Date))
            .ToDictionary(
                group => group.Key,
                group => new { Orders = group.Count(), Revenue = group.Sum(row => row.Revenue) });

        var salesTrend = Enumerable.Range(0, 30)
            .Select(offset => DateOnly.FromDateTime(from30Days.AddDays(offset)))
            .Select(date => trendByDate.TryGetValue(date, out var point)
                ? new SalesTrendPoint(date, point.Orders, point.Revenue)
                : new SalesTrendPoint(date, 0, 0))
            .ToArray();

        var topViewed = await context.Products
            .AsNoTracking()
            .OrderByDescending(product => product.ViewCount)
            .ThenBy(product => product.Name)
            .Take(6)
            .Select(product => new TopProductItem(
                product.Id,
                product.Name,
                product.Images.OrderBy(image => image.SortOrder).Select(image => image.ImagePath).FirstOrDefault(),
                product.ViewCount,
                0,
                0))
            .ToListAsync(cancellationToken);

        var topSellingRows = await context.OrderItems
            .AsNoTracking()
            .Where(item => item.Order.Status == OrderStatus.Delivered)
            .GroupBy(item => new { item.ProductId, item.ProductName })
            .Select(group => new
            {
                group.Key.ProductId,
                Name = group.Key.ProductName,
                Quantity = group.Sum(item => item.Quantity),
                Revenue = group.Sum(item => (item.Quantity * item.UnitPrice) - item.Discount + item.Tax)
            })
            .OrderByDescending(item => item.Quantity)
            .Take(6)
            .ToListAsync(cancellationToken);

        var topSellingIds = topSellingRows.Select(item => item.ProductId).ToArray();
        var productVisuals = await context.Products
            .AsNoTracking()
            .Where(product => topSellingIds.Contains(product.Id))
            .Select(product => new
            {
                product.Id,
                product.ViewCount,
                ImageUrl = product.Images.OrderBy(image => image.SortOrder).Select(image => image.ImagePath).FirstOrDefault()
            })
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var topSelling = topSellingRows.Select(item =>
        {
            productVisuals.TryGetValue(item.ProductId, out var visual);
            return new TopProductItem(
                item.ProductId,
                item.Name,
                visual?.ImageUrl,
                visual?.ViewCount ?? 0,
                item.Quantity,
                item.Revenue);
        }).ToArray();

        var lowStock = await context.ProductInventories
            .AsNoTracking()
            .Where(item => item.Quantity - item.ReservedQuantity <= item.MinimumQuantity)
            .OrderBy(item => item.Quantity - item.ReservedQuantity)
            .Take(8)
            .Select(item => new LowStockItem(
                item.ProductId,
                item.Product.Name,
                item.Product.Images.OrderBy(image => image.SortOrder).Select(image => image.ImagePath).FirstOrDefault(),
                item.Quantity,
                item.ReservedQuantity,
                item.Quantity - item.ReservedQuantity,
                item.MinimumQuantity))
            .ToListAsync(cancellationToken);

        var recentOrders = await context.Orders
            .AsNoTracking()
            .OrderByDescending(order => order.CreatedAt)
            .Take(8)
            .Select(order => new RecentOrderItem(
                order.Id,
                order.OrderNumber,
                order.Customer.FirstName + (order.Customer.LastName == null ? "" : " " + order.Customer.LastName),
                order.Status.ToString(),
                order.PaymentStatus.ToString(),
                order.Total,
                order.Currency,
                order.CreatedAt))
            .ToListAsync(cancellationToken);

        return new AdminDashboardResponse(
            new DashboardKpis(
                productStats?.Total ?? 0,
                productStats?.Active ?? 0,
                productStats?.Views ?? 0,
                customerCount,
                orderCount,
                pendingOrders,
                pendingPayments,
                paidRevenue,
                revenueLast30Days,
                notificationsLast24Hours,
                realtimeMetrics.ActiveConnections,
                currency),
            inventory,
            Enum.GetValues<OrderStatus>()
                .Select(status => new DashboardStatusCount(
                    status.ToString(),
                    statusCounts.FirstOrDefault(item => item.Status == status)?.Count ?? 0))
                .ToArray(),
            salesTrend,
            topViewed,
            topSelling,
            lowStock,
            recentOrders,
            now);
    }
}
