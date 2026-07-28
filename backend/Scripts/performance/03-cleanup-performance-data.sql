/* Permanently removes only records whose business key starts with PERF-LOAD-. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @TenantId bigint = 1; -- PERF_TENANT_ID
DECLARE @Prefix nvarchar(30) = N'PERF-LOAD-';
DECLARE @StartedAt datetime2(3) = SYSUTCDATETIME();

DELETE payment
FROM dbo.Payments payment
INNER JOIN dbo.Orders orders ON orders.Id = payment.OrderId
WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%';
DECLARE @PaymentsDeleted bigint = @@ROWCOUNT;

DELETE item
FROM dbo.OrderItems item
INNER JOIN dbo.Orders orders ON orders.Id = item.OrderId
WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%';
DECLARE @ItemsDeleted bigint = @@ROWCOUNT;

DELETE FROM dbo.Orders
WHERE TenantId = @TenantId AND OrderNumber LIKE @Prefix + N'ORD-%';
DECLARE @OrdersDeleted bigint = @@ROWCOUNT;

DELETE price
FROM dbo.ProductPrices price
INNER JOIN dbo.Products product ON product.Id = price.ProductId
WHERE product.TenantId = @TenantId AND product.Barcode LIKE @Prefix + N'P-%';
DECLARE @PricesDeleted bigint = @@ROWCOUNT;

DELETE inventory
FROM dbo.ProductInventories inventory
INNER JOIN dbo.Products product ON product.Id = inventory.ProductId
WHERE product.TenantId = @TenantId AND product.Barcode LIKE @Prefix + N'P-%';
DECLARE @InventoryDeleted bigint = @@ROWCOUNT;

DELETE FROM dbo.Products
WHERE TenantId = @TenantId AND Barcode LIKE @Prefix + N'P-%';
DECLARE @ProductsDeleted bigint = @@ROWCOUNT;

DELETE FROM dbo.Customers
WHERE TenantId = @TenantId AND Phone LIKE @Prefix + N'C-%';
DECLARE @CustomersDeleted bigint = @@ROWCOUNT;

DELETE FROM dbo.Types
WHERE TenantId = @TenantId
  AND Name IN (N'PERF Load Category', N'PERF Load Customer')
  AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE CategoryId = dbo.Types.Id)
  AND NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerTypeId = dbo.Types.Id);

SELECT
    @PaymentsDeleted AS PaymentsDeleted,
    @ItemsDeleted AS OrderItemsDeleted,
    @OrdersDeleted AS OrdersDeleted,
    @PricesDeleted AS ProductPricesDeleted,
    @InventoryDeleted AS ProductInventoriesDeleted,
    @ProductsDeleted AS ProductsDeleted,
    @CustomersDeleted AS CustomersDeleted,
    DATEDIFF_BIG(millisecond, @StartedAt, SYSUTCDATETIME()) AS ElapsedMilliseconds;
