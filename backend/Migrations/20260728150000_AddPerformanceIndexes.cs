using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260728150000_AddPerformanceIndexes")]
public sealed class AddPerformanceIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_PerformanceCatalog')
                CREATE INDEX [IX_Products_PerformanceCatalog]
                ON [dbo].[Products] ([TenantId], [IsDeleted], [Name])
                INCLUDE ([CategoryId], [BrandId], [UnitId], [Barcode], [UsesDisplayStock], [DisplayStockQuantity], [IsFeatured]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductInventories]') AND name = N'IX_ProductInventories_PerformanceProductBranch')
                CREATE INDEX [IX_ProductInventories_PerformanceProductBranch]
                ON [dbo].[ProductInventories] ([TenantId], [ProductId], [BranchId], [IsDeleted])
                INCLUDE ([Quantity], [ReservedQuantity], [MinimumQuantity]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductPrices]') AND name = N'IX_ProductPrices_PerformanceProduct')
                CREATE INDEX [IX_ProductPrices_PerformanceProduct]
                ON [dbo].[ProductPrices] ([TenantId], [ProductId], [IsDeleted], [CustomerTypeId])
                INCLUDE ([RegularPrice], [SalePrice], [StartDate], [EndDate]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_PerformanceReports')
                CREATE INDEX [IX_Orders_PerformanceReports]
                ON [dbo].[Orders] ([TenantId], [IsDeleted], [Currency], [CreatedAt], [Status], [BranchId])
                INCLUDE ([CustomerId], [OrderNumber], [Total], [Subtotal], [PaymentStatus]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = N'IX_OrderItems_PerformanceOrder')
                CREATE INDEX [IX_OrderItems_PerformanceOrder]
                ON [dbo].[OrderItems] ([TenantId], [OrderId], [IsDeleted])
                INCLUDE ([ProductId], [Quantity], [UnitPrice], [UnitCost], [Discount], [Tax], [AffectsInventory]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = N'IX_Payments_PerformanceOrder')
                CREATE INDEX [IX_Payments_PerformanceOrder]
                ON [dbo].[Payments] ([TenantId], [OrderId], [IsDeleted], [Status])
                INCLUDE ([Amount], [Currency], [PaidAt]);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customers]') AND name = N'IX_Customers_PerformanceLookup')
                CREATE INDEX [IX_Customers_PerformanceLookup]
                ON [dbo].[Customers] ([TenantId], [IsDeleted], [Id])
                INCLUDE ([FirstName], [LastName], [Phone], [Email], [CustomerTypeId]);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Customers]') AND name = N'IX_Customers_PerformanceLookup')
                DROP INDEX [IX_Customers_PerformanceLookup] ON [dbo].[Customers];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Payments]') AND name = N'IX_Payments_PerformanceOrder')
                DROP INDEX [IX_Payments_PerformanceOrder] ON [dbo].[Payments];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[OrderItems]') AND name = N'IX_OrderItems_PerformanceOrder')
                DROP INDEX [IX_OrderItems_PerformanceOrder] ON [dbo].[OrderItems];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Orders]') AND name = N'IX_Orders_PerformanceReports')
                DROP INDEX [IX_Orders_PerformanceReports] ON [dbo].[Orders];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductPrices]') AND name = N'IX_ProductPrices_PerformanceProduct')
                DROP INDEX [IX_ProductPrices_PerformanceProduct] ON [dbo].[ProductPrices];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[ProductInventories]') AND name = N'IX_ProductInventories_PerformanceProductBranch')
                DROP INDEX [IX_ProductInventories_PerformanceProductBranch] ON [dbo].[ProductInventories];
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Products]') AND name = N'IX_Products_PerformanceCatalog')
                DROP INDEX [IX_Products_PerformanceCatalog] ON [dbo].[Products];
            """);
    }
}
