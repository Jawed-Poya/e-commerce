using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260818180000_AllowNegativeProductInventory")]
public sealed class AllowNegativeProductInventory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Allow manual sales to put inventory into a deficit when
        // CompanySettings.AllowNegativeStockSales is enabled.
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[ProductInventories]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_ProductInventory_Quantity' AND [parent_object_id] = OBJECT_ID(N'[dbo].[ProductInventories]'))
        ALTER TABLE [dbo].[ProductInventories]
        DROP CONSTRAINT [CK_ProductInventory_Quantity];

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_ProductInventory_ReservedQuantity' AND [parent_object_id] = OBJECT_ID(N'[dbo].[ProductInventories]'))
        ALTER TABLE [dbo].[ProductInventories]
        DROP CONSTRAINT [CK_ProductInventory_ReservedQuantity];

    ALTER TABLE [dbo].[ProductInventories] WITH CHECK
    ADD CONSTRAINT [CK_ProductInventory_ReservedQuantity]
    CHECK ([ReservedQuantity] >= 0);
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[ProductInventories]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM [dbo].[ProductInventories]
        WHERE [Quantity] < 0
           OR [ReservedQuantity] < 0
           OR [ReservedQuantity] > [Quantity])
    BEGIN
        THROW 51000, 'Cannot restore non-negative inventory constraints while negative or over-reserved inventory exists.', 1;
    END;

    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_ProductInventory_ReservedQuantity' AND [parent_object_id] = OBJECT_ID(N'[dbo].[ProductInventories]'))
        ALTER TABLE [dbo].[ProductInventories]
        DROP CONSTRAINT [CK_ProductInventory_ReservedQuantity];

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = N'CK_ProductInventory_Quantity' AND [parent_object_id] = OBJECT_ID(N'[dbo].[ProductInventories]'))
        ALTER TABLE [dbo].[ProductInventories] WITH CHECK
        ADD CONSTRAINT [CK_ProductInventory_Quantity]
        CHECK ([Quantity] >= 0);

    ALTER TABLE [dbo].[ProductInventories] WITH CHECK
    ADD CONSTRAINT [CK_ProductInventory_ReservedQuantity]
    CHECK ([ReservedQuantity] >= 0 AND [ReservedQuantity] <= [Quantity]);
END;
""");
    }
}
