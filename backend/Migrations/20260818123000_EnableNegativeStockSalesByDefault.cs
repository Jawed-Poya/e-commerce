using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260818123000_EnableNegativeStockSalesByDefault")]
public sealed class EnableNegativeStockSalesByDefault : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.CompanySettings', N'AllowNegativeStockSales') IS NOT NULL
BEGIN
    UPDATE [dbo].[CompanySettings]
    SET [AllowNegativeStockSales] = 1
    WHERE [AllowNegativeStockSales] = 0;

    IF OBJECT_ID(N'[DF_CompanySettings_AllowNegativeStockSales]', N'D') IS NOT NULL
        ALTER TABLE [dbo].[CompanySettings] DROP CONSTRAINT [DF_CompanySettings_AllowNegativeStockSales];

    ALTER TABLE [dbo].[CompanySettings]
        ADD CONSTRAINT [DF_CompanySettings_AllowNegativeStockSales] DEFAULT(1) FOR [AllowNegativeStockSales];
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.CompanySettings', N'AllowNegativeStockSales') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'[DF_CompanySettings_AllowNegativeStockSales]', N'D') IS NOT NULL
        ALTER TABLE [dbo].[CompanySettings] DROP CONSTRAINT [DF_CompanySettings_AllowNegativeStockSales];

    ALTER TABLE [dbo].[CompanySettings]
        ADD CONSTRAINT [DF_CompanySettings_AllowNegativeStockSales] DEFAULT(0) FOR [AllowNegativeStockSales];
END;
""");
    }
}
