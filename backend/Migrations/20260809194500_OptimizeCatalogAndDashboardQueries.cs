using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260809194500_OptimizeCatalogAndDashboardQueries")]
public sealed class OptimizeCatalogAndDashboardQueries : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_CatalogList')
    CREATE INDEX [IX_Products_CatalogList]
    ON [dbo].[Products] ([IsDeleted], [Id])
    INCLUDE ([Name], [Strength], [Barcode], [CategoryId], [BrandId], [UnitId], [UsesDisplayStock], [DisplayStockQuantity], [IsFeatured], [IsActive], [ViewCount]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_CatalogName')
    CREATE INDEX [IX_Products_CatalogName]
    ON [dbo].[Products] ([IsDeleted], [Name], [Id])
    INCLUDE ([Barcode], [CategoryId], [BrandId], [UnitId], [UsesDisplayStock], [DisplayStockQuantity], [IsFeatured], [IsActive], [ViewCount]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductPrices]') AND name = N'IX_ProductPrices_ProductCustomerType')
    CREATE INDEX [IX_ProductPrices_ProductCustomerType]
    ON [dbo].[ProductPrices] ([ProductId], [IsDeleted], [CustomerTypeId])
    INCLUDE ([RegularPrice], [SalePrice], [StartDate], [EndDate]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductInventories]') AND name = N'IX_ProductInventories_Product')
    CREATE INDEX [IX_ProductInventories_Product]
    ON [dbo].[ProductInventories] ([ProductId], [IsDeleted])
    INCLUDE ([Quantity], [ReservedQuantity], [MinimumQuantity], [ExpireDate], [UpdatedAt], [CreatedAt]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InventoryLots]') AND name = N'IX_InventoryLots_ProductExpiry')
    CREATE INDEX [IX_InventoryLots_ProductExpiry]
    ON [dbo].[InventoryLots] ([ProductId], [IsDeleted], [ExpiresAt])
    INCLUDE ([Quantity], [ReservedQuantity], [WarehouseId], [LotNumber]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductUnitConversions]') AND name = N'IX_ProductUnitConversions_ProductLookup')
    CREATE INDEX [IX_ProductUnitConversions_ProductLookup]
    ON [dbo].[ProductUnitConversions] ([ProductId], [IsDeleted], [IsActive], [UnitId])
    INCLUDE ([Barcode]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductImages]') AND name = N'IX_ProductImages_ProductPrimarySort')
    CREATE INDEX [IX_ProductImages_ProductPrimarySort]
    ON [dbo].[ProductImages] ([ProductId], [IsDeleted], [IsPrimary], [SortOrder])
    INCLUDE ([ImagePath]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductReviews]') AND name = N'IX_ProductReviews_ProductApproved')
    CREATE INDEX [IX_ProductReviews_ProductApproved]
    ON [dbo].[ProductReviews] ([ProductId], [IsDeleted], [IsApproved])
    INCLUDE ([Rating]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardCreatedAt')
    CREATE INDEX [IX_Orders_DashboardCreatedAt]
    ON [dbo].[Orders] ([IsDeleted], [CreatedAt])
    INCLUDE ([Status], [PaymentStatus], [Total], [Currency], [CustomerId], [OrderNumber]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardPaymentStatus')
    CREATE INDEX [IX_Orders_DashboardPaymentStatus]
    ON [dbo].[Orders] ([IsDeleted], [PaymentStatus], [CreatedAt])
    INCLUDE ([Status], [Total], [Currency]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardStatus')
    CREATE INDEX [IX_Orders_DashboardStatus]
    ON [dbo].[Orders] ([IsDeleted], [Status], [CreatedAt])
    INCLUDE ([PaymentStatus], [Total], [Currency], [CustomerId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = N'IX_OrderItems_ProductDashboard')
    CREATE INDEX [IX_OrderItems_ProductDashboard]
    ON [dbo].[OrderItems] ([ProductId], [IsDeleted], [OrderId])
    INCLUDE ([ProductName], [Quantity], [OrderedQuantity], [SellingUnitPrice], [UnitPrice], [Discount], [Tax]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Notifications]') AND name = N'IX_Notifications_DashboardCreatedAt')
    CREATE INDEX [IX_Notifications_DashboardCreatedAt]
    ON [dbo].[Notifications] ([IsDeleted], [CreatedAt]);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Notifications]') AND name = N'IX_Notifications_DashboardCreatedAt')
    DROP INDEX [IX_Notifications_DashboardCreatedAt] ON [dbo].[Notifications];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = N'IX_OrderItems_ProductDashboard')
    DROP INDEX [IX_OrderItems_ProductDashboard] ON [dbo].[OrderItems];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardStatus')
    DROP INDEX [IX_Orders_DashboardStatus] ON [dbo].[Orders];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardPaymentStatus')
    DROP INDEX [IX_Orders_DashboardPaymentStatus] ON [dbo].[Orders];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_DashboardCreatedAt')
    DROP INDEX [IX_Orders_DashboardCreatedAt] ON [dbo].[Orders];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductReviews]') AND name = N'IX_ProductReviews_ProductApproved')
    DROP INDEX [IX_ProductReviews_ProductApproved] ON [dbo].[ProductReviews];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductImages]') AND name = N'IX_ProductImages_ProductPrimarySort')
    DROP INDEX [IX_ProductImages_ProductPrimarySort] ON [dbo].[ProductImages];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductUnitConversions]') AND name = N'IX_ProductUnitConversions_ProductLookup')
    DROP INDEX [IX_ProductUnitConversions_ProductLookup] ON [dbo].[ProductUnitConversions];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[InventoryLots]') AND name = N'IX_InventoryLots_ProductExpiry')
    DROP INDEX [IX_InventoryLots_ProductExpiry] ON [dbo].[InventoryLots];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductInventories]') AND name = N'IX_ProductInventories_Product')
    DROP INDEX [IX_ProductInventories_Product] ON [dbo].[ProductInventories];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductPrices]') AND name = N'IX_ProductPrices_ProductCustomerType')
    DROP INDEX [IX_ProductPrices_ProductCustomerType] ON [dbo].[ProductPrices];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_CatalogName')
    DROP INDEX [IX_Products_CatalogName] ON [dbo].[Products];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_CatalogList')
    DROP INDEX [IX_Products_CatalogList] ON [dbo].[Products];
""");
    }
}
