namespace ECommerce.Entities.Dashboard.Contracts;

public sealed record AdminDashboardResponse(
    DashboardKpis Kpis,
    InventoryHealthSummary Inventory,
    IReadOnlyCollection<DashboardStatusCount> OrderStatuses,
    IReadOnlyCollection<SalesTrendPoint> SalesTrend,
    IReadOnlyCollection<TopProductItem> TopViewedProducts,
    IReadOnlyCollection<TopProductItem> TopSellingProducts,
    IReadOnlyCollection<LowStockItem> LowStockProducts,
    IReadOnlyCollection<RecentOrderItem> RecentOrders,
    DateTime GeneratedAt);

public sealed record DashboardKpis(
    int TotalProducts,
    int ActiveProducts,
    long TotalProductViews,
    int TotalCustomers,
    int TotalOrders,
    int PendingOrders,
    int PendingPayments,
    decimal PaidRevenue,
    decimal RevenueLast30Days,
    int NotificationsLast24Hours,
    int RealtimeConnections,
    string Currency);

public sealed record InventoryHealthSummary(
    int HealthyProducts,
    int LowStockProducts,
    int OutOfStockProducts,
    decimal TotalQuantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity);

public sealed record DashboardStatusCount(string Status, int Count);

public sealed record SalesTrendPoint(DateOnly Date, int Orders, decimal Revenue);

public sealed record TopProductItem(
    long ProductId,
    string Name,
    string? ImageUrl,
    long ViewCount,
    decimal QuantitySold,
    decimal Revenue);

public sealed record LowStockItem(
    long ProductId,
    string Name,
    string? ImageUrl,
    decimal Quantity,
    decimal ReservedQuantity,
    decimal AvailableQuantity,
    decimal MinimumQuantity);

public sealed record RecentOrderItem(
    long Id,
    string OrderNumber,
    string CustomerName,
    string Status,
    string PaymentStatus,
    decimal Total,
    string Currency,
    DateTime CreatedAt);
