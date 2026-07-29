/*
  Deterministic performance data for local/development databases only.
  The PowerShell runner replaces the five marked constants before execution.
  All generated business keys start with PERF-LOAD- and can be removed safely
  with 03-cleanup-performance-data.sql.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @TenantId bigint = 1;                 -- PERF_TENANT_ID
DECLARE @ProductCount int = 10000;            -- PERF_PRODUCT_COUNT
DECLARE @CustomerCount int = 20000;           -- PERF_CUSTOMER_COUNT
DECLARE @OrderCount int = 50000;              -- PERF_ORDER_COUNT
DECLARE @ItemsPerOrder int = 4;               -- PERF_ITEMS_PER_ORDER
DECLARE @CleanupExisting bit = 1;             -- PERF_CLEANUP_EXISTING
DECLARE @Prefix nvarchar(30) = N'PERF-LOAD-';
DECLARE @StartedAt datetime2(3) = SYSUTCDATETIME();

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
    THROW 51000, 'Performance data cannot be inserted into a system database.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.Tenants WHERE Id = @TenantId)
    THROW 51001, 'The configured company row does not exist.', 1;

IF COL_LENGTH(N'dbo.Products', N'UsesDisplayStock') IS NULL OR
   COL_LENGTH(N'dbo.OrderItems', N'UnitCost') IS NULL OR
   COL_LENGTH(N'dbo.OrderItems', N'AffectsInventory') IS NULL OR
   COL_LENGTH(N'dbo.OrderItems', N'OrderedQuantity') IS NULL OR
   OBJECT_ID(N'dbo.ProductUnitConversions', N'U') IS NULL
    THROW 51002, 'Apply the latest EF Core migrations before running the performance seed.', 1;

IF @ProductCount < 1 OR @ProductCount > 100000 OR
   @CustomerCount < 1 OR @CustomerCount > 250000 OR
   @OrderCount < 1 OR @OrderCount > 500000 OR
   @ItemsPerOrder < 1 OR @ItemsPerOrder > 20
    THROW 51003, 'Requested performance data size is outside the safety limits.', 1;

DECLARE @BranchId bigint =
(
    SELECT TOP (1) Id
    FROM dbo.Branches
    WHERE TenantId = @TenantId AND IsActive = 1
    ORDER BY IsMain DESC, Id
);

IF @BranchId IS NULL
    THROW 51004, 'No active branch exists for the company.', 1;

DECLARE @Currency nvarchar(3) = COALESCE
(
    (SELECT TOP (1) MainCurrencyCode FROM dbo.TenantSettings WHERE TenantId = @TenantId),
    N'USD'
);

IF @CleanupExisting = 1
BEGIN
    PRINT 'Removing data from the previous PERF-LOAD run...';

    DELETE payment
    FROM dbo.Payments payment
    INNER JOIN dbo.Orders orders ON orders.Id = payment.OrderId
    WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%';

    DELETE item
    FROM dbo.OrderItems item
    INNER JOIN dbo.Orders orders ON orders.Id = item.OrderId
    WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%';

    DELETE FROM dbo.Orders
    WHERE TenantId = @TenantId AND OrderNumber LIKE @Prefix + N'ORD-%';

    DELETE price
    FROM dbo.ProductPrices price
    INNER JOIN dbo.Products product ON product.Id = price.ProductId
    WHERE product.TenantId = @TenantId AND product.Barcode LIKE @Prefix + N'P-%';

    DELETE inventory
    FROM dbo.ProductInventories inventory
    INNER JOIN dbo.Products product ON product.Id = inventory.ProductId
    WHERE product.TenantId = @TenantId AND product.Barcode LIKE @Prefix + N'P-%';

    DELETE FROM dbo.Products
    WHERE TenantId = @TenantId AND Barcode LIKE @Prefix + N'P-%';

    DELETE FROM dbo.Customers
    WHERE TenantId = @TenantId AND Phone LIKE @Prefix + N'C-%';
END;

DECLARE @CategoryId bigint =
(
    SELECT TOP (1) Id
    FROM dbo.Types
    WHERE TenantId = @TenantId AND [Group] = 1 AND Name = N'PERF Load Category'
);

IF @CategoryId IS NULL
BEGIN
    INSERT dbo.Types (TenantId, BranchId, [Group], Name, SortOrder, CreatedAt, IsDeleted)
    VALUES (@TenantId, @BranchId, 1, N'PERF Load Category', 9990, SYSUTCDATETIME(), 0);
    SET @CategoryId = SCOPE_IDENTITY();
END;

DECLARE @CustomerTypeId bigint =
(
    SELECT TOP (1) Id
    FROM dbo.Types
    WHERE TenantId = @TenantId AND [Group] = 4 AND Name = N'PERF Load Customer'
);

IF @CustomerTypeId IS NULL
BEGIN
    INSERT dbo.Types (TenantId, BranchId, [Group], Name, SortOrder, CreatedAt, IsDeleted)
    VALUES (@TenantId, @BranchId, 4, N'PERF Load Customer', 9990, SYSUTCDATETIME(), 0);
    SET @CustomerTypeId = SCOPE_IDENTITY();
END;

DECLARE @ProductUnitId bigint =
(
    SELECT TOP (1) Id
    FROM dbo.Types
    WHERE TenantId = @TenantId AND [Group] = 3 AND IsDeleted = 0
    ORDER BY CASE WHEN Name = N'Piece (Dana)' THEN 0 ELSE 1 END, SortOrder, Id
);

IF @ProductUnitId IS NULL
BEGIN
    INSERT dbo.Types (TenantId, BranchId, [Group], Name, SortOrder, CreatedAt, IsDeleted)
    VALUES (@TenantId, @BranchId, 3, N'Piece (Dana)', 0, SYSUTCDATETIME(), 0);
    SET @ProductUnitId = SCOPE_IDENTITY();
END;

DECLARE @ProductUnitName nvarchar(200) =
(
    SELECT Name FROM dbo.Types WHERE Id = @ProductUnitId
);

DECLARE @MaximumNumber int =
(
    SELECT MAX(Value)
    FROM (VALUES (@ProductCount), (@CustomerCount), (@OrderCount)) source(Value)
);

DROP TABLE IF EXISTS #Numbers;
SELECT TOP (@MaximumNumber)
    ROW_NUMBER() OVER (ORDER BY firstSet.object_id, secondSet.object_id) AS Number
INTO #Numbers
FROM sys.all_objects firstSet
CROSS JOIN sys.all_objects secondSet;

CREATE UNIQUE CLUSTERED INDEX IX_Numbers_Number ON #Numbers(Number);

PRINT CONCAT('Inserting ', FORMAT(@ProductCount, 'N0'), ' products...');
INSERT dbo.Products
(
    TenantId, BranchId, Name, Barcode, ShortDescription, Description,
    MinimumValue, MaximumValue, UsesDisplayStock, DisplayStockQuantity,
    CategoryId, BrandId, UnitId, IsFeatured, IsActive, Slug, ViewCount,
    CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    CONCAT(N'Performance Product ', RIGHT(REPLICATE('0', 6) + CONVERT(varchar(10), Number), 6)),
    CONCAT(@Prefix, N'P-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), Number), 10)),
    N'Generated performance product used for query and PDF load testing.',
    REPLICATE(CONCAT(N'Performance description ', Number, N'. '), 5),
    1,
    1000,
    CASE WHEN Number % 5 = 0 THEN 1 ELSE 0 END,
    CASE WHEN Number % 5 = 0 THEN CONVERT(decimal(18,3), 1000 + Number % 9000) END,
    @CategoryId,
    NULL,
    @ProductUnitId,
    CASE WHEN Number % 20 = 0 THEN 1 ELSE 0 END,
    1,
    CONCAT(N'perf-load-product-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), Number), 10)),
    Number % 5000,
    DATEADD(second, -Number, SYSUTCDATETIME()),
    0
FROM #Numbers
WHERE Number <= @ProductCount;

DROP TABLE IF EXISTS #PerfProducts;
SELECT
    ROW_NUMBER() OVER (ORDER BY Id) AS Number,
    Id,
    UsesDisplayStock
INTO #PerfProducts
FROM dbo.Products
WHERE TenantId = @TenantId AND Barcode LIKE @Prefix + N'P-%';
CREATE UNIQUE CLUSTERED INDEX IX_PerfProducts_Number ON #PerfProducts(Number);
CREATE UNIQUE INDEX IX_PerfProducts_Id ON #PerfProducts(Id);

INSERT dbo.ProductPrices
(
    TenantId, BranchId, ProductId, CustomerTypeId, StartDate, EndDate,
    PriceTypeId, RegularPrice, SalePrice, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    product.Id,
    @CustomerTypeId,
    NULL,
    NULL,
    NULL,
    CONVERT(decimal(18,2), 10 + product.Number % 990),
    CASE WHEN product.Number % 8 = 0
        THEN CONVERT(decimal(18,2), (10 + product.Number % 990) * 0.90)
        ELSE NULL
    END,
    SYSUTCDATETIME(),
    0
FROM #PerfProducts product;

INSERT dbo.ProductInventories
(
    TenantId, BranchId, ProductId, Quantity, ReservedQuantity,
    MinimumQuantity, ExpireDate, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    product.Id,
    CONVERT(decimal(18,3), 100 + product.Number % 5000),
    CONVERT(decimal(18,3), product.Number % 25),
    CONVERT(decimal(18,3), 25 + product.Number % 50),
    NULL,
    SYSUTCDATETIME(),
    0
FROM #PerfProducts product
WHERE product.UsesDisplayStock = 0;

PRINT CONCAT('Inserting ', FORMAT(@CustomerCount, 'N0'), ' customers...');
INSERT dbo.Customers
(
    TenantId, BranchId, FirstName, LastName, Phone, Email, Address,
    CustomerTypeId, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    CONCAT(N'Performance ', RIGHT(REPLICATE('0', 6) + CONVERT(varchar(10), Number), 6)),
    N'Customer',
    CONCAT(@Prefix, N'C-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), Number), 10)),
    CONCAT(N'perf-load-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), Number), 10), N'@example.invalid'),
    CONCAT(N'Performance address ', Number),
    @CustomerTypeId,
    DATEADD(second, -Number, SYSUTCDATETIME()),
    0
FROM #Numbers
WHERE Number <= @CustomerCount;

DROP TABLE IF EXISTS #PerfCustomers;
SELECT ROW_NUMBER() OVER (ORDER BY Id) AS Number, Id
INTO #PerfCustomers
FROM dbo.Customers
WHERE TenantId = @TenantId AND Phone LIKE @Prefix + N'C-%';
CREATE UNIQUE CLUSTERED INDEX IX_PerfCustomers_Number ON #PerfCustomers(Number);

PRINT CONCAT('Inserting ', FORMAT(@OrderCount, 'N0'), ' orders...');
INSERT dbo.Orders
(
    TenantId, BranchId, OrderNumber, CustomerId, Status, Total, Subtotal,
    DiscountTotal, TaxTotal, ShippingTotal, Currency, PaymentStatus,
    FulfillmentStatus, ReservationExpiresAt, Notes, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    CONCAT(@Prefix, N'ORD-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), number.Number), 10)),
    customer.Id,
    4,
    0,
    0,
    0,
    0,
    0,
    @Currency,
    3,
    4,
    NULL,
    N'Generated performance order.',
    DATEADD(minute, -(number.Number % 525600), SYSUTCDATETIME()),
    0
FROM #Numbers number
INNER JOIN #PerfCustomers customer
    ON customer.Number = ((number.Number - 1) % @CustomerCount) + 1
WHERE number.Number <= @OrderCount;

DROP TABLE IF EXISTS #PerfOrders;
SELECT ROW_NUMBER() OVER (ORDER BY Id) AS Number, Id, CreatedAt
INTO #PerfOrders
FROM dbo.Orders
WHERE TenantId = @TenantId AND OrderNumber LIKE @Prefix + N'ORD-%';
CREATE UNIQUE CLUSTERED INDEX IX_PerfOrders_Number ON #PerfOrders(Number);
CREATE UNIQUE INDEX IX_PerfOrders_Id ON #PerfOrders(Id);

DROP TABLE IF EXISTS #ItemOffsets;
SELECT Number AS OffsetNumber
INTO #ItemOffsets
FROM #Numbers
WHERE Number <= @ItemsPerOrder;
CREATE UNIQUE CLUSTERED INDEX IX_ItemOffsets_Number ON #ItemOffsets(OffsetNumber);

PRINT CONCAT('Inserting ', FORMAT(@OrderCount * @ItemsPerOrder, 'N0'), ' order items...');
INSERT dbo.OrderItems
(
    TenantId, BranchId, OrderId, ProductId,
    Quantity, OrderedQuantity, SelectedUnitId, SelectedUnitName, UnitConversionFactor,
    UnitPrice, SellingUnitPrice, UnitCost,
    AffectsInventory, Discount, ProductName, ProductBarcode,
    VariantDescription, Tax, Currency, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    orders.Id,
    product.Id,
    CONVERT(decimal(18,3), 1 + ((orders.Number + item.OffsetNumber) % 4)),
    CONVERT(decimal(18,3), 1 + ((orders.Number + item.OffsetNumber) % 4)),
    @ProductUnitId,
    @ProductUnitName,
    CONVERT(decimal(18,6), 1),
    CONVERT(decimal(18,6), 10 + product.Number % 990),
    CONVERT(decimal(18,2), 10 + product.Number % 990),
    CONVERT(decimal(18,4), (10 + product.Number % 990) * 0.62),
    CASE WHEN product.UsesDisplayStock = 1 THEN 0 ELSE 1 END,
    0,
    CONCAT(N'Performance Product ', RIGHT(REPLICATE('0', 6) + CONVERT(varchar(10), product.Number), 6)),
    CONCAT(@Prefix, N'P-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), product.Number), 10)),
    NULL,
    0,
    @Currency,
    orders.CreatedAt,
    0
FROM #PerfOrders orders
CROSS JOIN #ItemOffsets item
INNER JOIN #PerfProducts product
    ON product.Number = ((orders.Number + item.OffsetNumber - 2) % @ProductCount) + 1;

UPDATE orders
SET
    orders.Subtotal = totals.Subtotal,
    orders.Total = totals.Subtotal,
    orders.UpdatedAt = SYSUTCDATETIME()
FROM dbo.Orders orders
INNER JOIN
(
    SELECT OrderId, SUM((OrderedQuantity * SellingUnitPrice) - Discount + Tax) AS Subtotal
    FROM dbo.OrderItems
    WHERE TenantId = @TenantId AND IsDeleted = 0
    GROUP BY OrderId
) totals ON totals.OrderId = orders.Id
WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%';

INSERT dbo.Payments
(
    TenantId, BranchId, OrderId, Provider, ExternalReference,
    Amount, Currency, Status, PaidAt, CreatedAt, IsDeleted
)
SELECT
    @TenantId,
    @BranchId,
    orders.Id,
    N'performance-test',
    CONCAT(@Prefix, N'PAY-', RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), orders.Number), 10)),
    source.Total,
    @Currency,
    3,
    source.CreatedAt,
    source.CreatedAt,
    0
FROM #PerfOrders orders
INNER JOIN dbo.Orders source ON source.Id = orders.Id;

PRINT 'Updating statistics on performance-sensitive tables...';
UPDATE STATISTICS dbo.Products;
UPDATE STATISTICS dbo.ProductInventories;
UPDATE STATISTICS dbo.ProductPrices;
UPDATE STATISTICS dbo.Customers;
UPDATE STATISTICS dbo.Orders;
UPDATE STATISTICS dbo.OrderItems;
UPDATE STATISTICS dbo.Payments;

SELECT
    @TenantId AS TenantId,
    @BranchId AS BranchId,
    @Currency AS CurrencyCode,
    (SELECT COUNT_BIG(*) FROM dbo.Products WHERE TenantId = @TenantId AND Barcode LIKE @Prefix + N'P-%') AS ProductsInserted,
    (SELECT COUNT_BIG(*) FROM dbo.Customers WHERE TenantId = @TenantId AND Phone LIKE @Prefix + N'C-%') AS CustomersInserted,
    (SELECT COUNT_BIG(*) FROM dbo.Orders WHERE TenantId = @TenantId AND OrderNumber LIKE @Prefix + N'ORD-%') AS OrdersInserted,
    (SELECT COUNT_BIG(*) FROM dbo.OrderItems item INNER JOIN dbo.Orders orders ON orders.Id = item.OrderId WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%') AS OrderItemsInserted,
    (SELECT COUNT_BIG(*) FROM dbo.Payments payment INNER JOIN dbo.Orders orders ON orders.Id = payment.OrderId WHERE orders.TenantId = @TenantId AND orders.OrderNumber LIKE @Prefix + N'ORD-%') AS PaymentsInserted,
    DATEDIFF_BIG(millisecond, @StartedAt, SYSUTCDATETIME()) AS TotalElapsedMilliseconds;
