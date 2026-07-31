using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260731130000_AddOperationLineLimits")]
public sealed class AddOperationLineLimits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.TenantSettings', N'MaximumPurchaseLines') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [MaximumPurchaseLines] int NOT NULL
            CONSTRAINT [DF_TenantSettings_MaximumPurchaseLines] DEFAULT(50);

    IF COL_LENGTH(N'dbo.TenantSettings', N'MaximumManualSaleLines') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [MaximumManualSaleLines] int NOT NULL
            CONSTRAINT [DF_TenantSettings_MaximumManualSaleLines] DEFAULT(50);
END
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
BEGIN
    DECLARE @constraintName sysname;

    IF COL_LENGTH(N'dbo.TenantSettings', N'MaximumManualSaleLines') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'MaximumManualSaleLines';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [MaximumManualSaleLines];
    END

    SET @constraintName = NULL;
    IF COL_LENGTH(N'dbo.TenantSettings', N'MaximumPurchaseLines') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'MaximumPurchaseLines';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [MaximumPurchaseLines];
    END
END
""");
    }
}
