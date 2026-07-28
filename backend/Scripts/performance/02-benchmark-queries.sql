/* Query benchmark for the deterministic PERF-LOAD dataset. */
SET NOCOUNT ON;
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

DECLARE @TenantId bigint = 1;       -- PERF_TENANT_ID
DECLARE @CatalogRows int = 10000;   -- PERF_CATALOG_ROWS
DECLARE @Prefix nvarchar(30) = N'PERF-LOAD-';
DECLARE @BranchId bigint =
(
    SELECT TOP (1) Id FROM dbo.Branches
    WHERE TenantId = @TenantId AND IsActive = 1
    ORDER BY IsMain DESC, Id
);
DECLARE @Currency nvarchar(3) = COALESCE
(
    (SELECT TOP (1) MainCurrencyCode FROM dbo.TenantSettings WHERE TenantId = @TenantId),
    N'USD'
);

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE TenantId = @TenantId AND Barcode LIKE @Prefix + N'P-%')
    THROW 51100, 'No performance dataset was found. Run 01-seed-performance-data.sql first.', 1;

PRINT 'Benchmark 1: product catalog / product PDF projection';
DECLARE @CatalogStarted datetime2(3) = SYSUTCDATETIME();
DROP TABLE IF EXISTS #CatalogResult;
SELECT TOP (@CatalogRows)
    product.Id,
    product.Name,
    product.Barcode,
    category.Name AS Category,
    product.UsesDisplayStock,
    product.DisplayStockQuantity,
    COALESCE(inventory.Stock, 0) AS Stock,
    COALESCE(inventory.MinimumStock, 0) AS MinimumStock,
    price.Price
INTO #CatalogResult
FROM dbo.Products product
INNER JOIN dbo.Types category ON category.Id = product.CategoryId
OUTER APPLY
(
    SELECT
        SUM(stock.Quantity - stock.ReservedQuantity) AS Stock,
        MAX(stock.MinimumQuantity) AS MinimumStock
    FROM dbo.ProductInventories stock
    WHERE stock.TenantId = @TenantId
      AND stock.IsDeleted = 0
      AND stock.ProductId = product.Id
      AND (@BranchId IS NULL OR stock.BranchId = @BranchId)
) inventory
OUTER APPLY
(
    SELECT TOP (1) COALESCE(productPrice.SalePrice, productPrice.RegularPrice) AS Price
    FROM dbo.ProductPrices productPrice
    WHERE productPrice.TenantId = @TenantId
      AND productPrice.IsDeleted = 0
      AND productPrice.ProductId = product.Id
    ORDER BY productPrice.CustomerTypeId, productPrice.Id
) price
WHERE product.TenantId = @TenantId
  AND product.IsDeleted = 0
ORDER BY product.Name
OPTION (RECOMPILE);
SELECT
    N'Catalog projection' AS Benchmark,
    COUNT_BIG(*) AS RowsRead,
    DATEDIFF_BIG(millisecond, @CatalogStarted, SYSUTCDATETIME()) AS ElapsedMilliseconds,
    SUM(CASE WHEN UsesDisplayStock = 0 THEN Stock ELSE 0 END) AS PhysicalStock,
    SUM(CASE WHEN UsesDisplayStock = 1 THEN DisplayStockQuantity ELSE 0 END) AS DisplayStock
FROM #CatalogResult;

PRINT 'Benchmark 2: yearly sales, cost and payment aggregation';
DECLARE @SalesStarted datetime2(3) = SYSUTCDATETIME();
DECLARE @StartDate datetime2(0) = DATEADD(day, -365, SYSUTCDATETIME());
DROP TABLE IF EXISTS #SalesResult;
SELECT
    orders.Id,
    orders.OrderNumber,
    orders.CreatedAt,
    orders.Total,
    COALESCE(cost.CostOfGoods, 0) AS CostOfGoods,
    COALESCE(payment.PaidAmount, CASE WHEN orders.PaymentStatus = 3 THEN orders.Total ELSE 0 END) AS PaidAmount
INTO #SalesResult
FROM dbo.Orders orders
OUTER APPLY
(
    SELECT SUM(item.Quantity * item.UnitCost) AS CostOfGoods
    FROM dbo.OrderItems item
    WHERE item.TenantId = @TenantId
      AND item.IsDeleted = 0
      AND item.OrderId = orders.Id
) cost
OUTER APPLY
(
    SELECT SUM(entry.Amount) AS PaidAmount
    FROM dbo.Payments entry
    WHERE entry.TenantId = @TenantId
      AND entry.IsDeleted = 0
      AND entry.OrderId = orders.Id
      AND entry.Status IN (3, 4)
) payment
WHERE orders.TenantId = @TenantId
  AND orders.IsDeleted = 0
  AND orders.Status <> 6
  AND orders.Currency = @Currency
  AND orders.CreatedAt >= @StartDate
OPTION (RECOMPILE);
SELECT
    N'Yearly sales aggregation' AS Benchmark,
    COUNT_BIG(*) AS OrdersRead,
    DATEDIFF_BIG(millisecond, @SalesStarted, SYSUTCDATETIME()) AS ElapsedMilliseconds,
    SUM(Total) AS Revenue,
    SUM(CostOfGoods) AS CostOfGoods,
    SUM(Total - CostOfGoods) AS GrossProfit,
    SUM(PaidAmount) AS PaidAmount
FROM #SalesResult;

PRINT 'Benchmark 3: one high-volume customer ledger';
DECLARE @CustomerId bigint =
(
    SELECT TOP (1) CustomerId
    FROM dbo.Orders
    WHERE TenantId = @TenantId AND OrderNumber LIKE @Prefix + N'ORD-%'
    GROUP BY CustomerId
    ORDER BY COUNT_BIG(*) DESC, CustomerId
);
DECLARE @LedgerStarted datetime2(3) = SYSUTCDATETIME();
DROP TABLE IF EXISTS #LedgerResult;
SELECT
    orders.CreatedAt,
    orders.OrderNumber,
    orders.Total,
    COALESCE(payment.PaidAmount, 0) AS PaidAmount,
    orders.Total - COALESCE(payment.PaidAmount, 0) AS Balance
INTO #LedgerResult
FROM dbo.Orders orders
OUTER APPLY
(
    SELECT SUM(entry.Amount) AS PaidAmount
    FROM dbo.Payments entry
    WHERE entry.TenantId = @TenantId
      AND entry.IsDeleted = 0
      AND entry.OrderId = orders.Id
      AND entry.Status IN (3, 4)
) payment
WHERE orders.TenantId = @TenantId
  AND orders.IsDeleted = 0
  AND orders.CustomerId = @CustomerId
OPTION (RECOMPILE);
SELECT
    N'Customer ledger' AS Benchmark,
    @CustomerId AS CustomerId,
    COUNT_BIG(*) AS LedgerRows,
    DATEDIFF_BIG(millisecond, @LedgerStarted, SYSUTCDATETIME()) AS ElapsedMilliseconds,
    SUM(Total) AS Sales,
    SUM(PaidAmount) AS Payments,
    SUM(Balance) AS Balance
FROM #LedgerResult;

PRINT 'Performance table sizes';
SELECT
    schemaName = OBJECT_SCHEMA_NAME(partitionStats.object_id),
    tableName = OBJECT_NAME(partitionStats.object_id),
    rowCount = SUM(partitionStats.row_count),
    reservedMb = CONVERT(decimal(18,2), SUM(partitionStats.reserved_page_count) * 8.0 / 1024),
    usedMb = CONVERT(decimal(18,2), SUM(partitionStats.used_page_count) * 8.0 / 1024)
FROM sys.dm_db_partition_stats partitionStats
WHERE partitionStats.index_id IN (0, 1)
  AND OBJECT_NAME(partitionStats.object_id) IN
      (N'Products', N'ProductInventories', N'ProductPrices', N'Customers', N'Orders', N'OrderItems', N'Payments')
GROUP BY partitionStats.object_id
ORDER BY reservedMb DESC;

PRINT 'Performance index usage';
SELECT
    tableName = OBJECT_NAME(indexes.object_id),
    indexes.name AS indexName,
    COALESCE(usageStats.user_seeks, 0) AS userSeeks,
    COALESCE(usageStats.user_scans, 0) AS userScans,
    COALESCE(usageStats.user_lookups, 0) AS userLookups,
    COALESCE(usageStats.user_updates, 0) AS userUpdates
FROM sys.indexes indexes
LEFT JOIN sys.dm_db_index_usage_stats usageStats
    ON usageStats.database_id = DB_ID()
   AND usageStats.object_id = indexes.object_id
   AND usageStats.index_id = indexes.index_id
WHERE indexes.name LIKE N'%Performance%'
ORDER BY tableName, indexName;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
