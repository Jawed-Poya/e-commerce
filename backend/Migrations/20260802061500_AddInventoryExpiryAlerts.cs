using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260802061500_AddInventoryExpiryAlerts")]
public sealed class AddInventoryExpiryAlerts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertsEnabled') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [ExpiryAlertsEnabled] bit NOT NULL
            CONSTRAINT [DF_TenantSettings_ExpiryAlertsEnabled] DEFAULT(1);

    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertLeadDays') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [ExpiryAlertLeadDays] int NOT NULL
            CONSTRAINT [DF_TenantSettings_ExpiryAlertLeadDays] DEFAULT(30);

    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertSoundEnabled') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [ExpiryAlertSoundEnabled] bit NOT NULL
            CONSTRAINT [DF_TenantSettings_ExpiryAlertSoundEnabled] DEFAULT(1);

    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertSound') IS NULL
        ALTER TABLE [dbo].[TenantSettings] ADD [ExpiryAlertSound] nvarchar(40) NOT NULL
            CONSTRAINT [DF_TenantSettings_ExpiryAlertSound] DEFAULT(N'critical-pulse');
END
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[InventoryLots]', N'U') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM sys.indexes
       WHERE [object_id] = OBJECT_ID(N'[dbo].[InventoryLots]')
         AND [name] = N'IX_InventoryLots_TenantId_ExpiresAt_ActiveQuantity'
   )
BEGIN
    CREATE INDEX [IX_InventoryLots_TenantId_ExpiresAt_ActiveQuantity]
        ON [dbo].[InventoryLots]([TenantId], [ExpiresAt])
        INCLUDE ([Id], [ProductId], [WarehouseId], [BranchId], [LotNumber], [Quantity])
        WHERE [IsDeleted] = 0 AND [ExpiresAt] IS NOT NULL AND [Quantity] > 0;
END
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[InventoryLots]', N'U') IS NOT NULL
   AND EXISTS
   (
       SELECT 1
       FROM sys.indexes
       WHERE [object_id] = OBJECT_ID(N'[dbo].[InventoryLots]')
         AND [name] = N'IX_InventoryLots_TenantId_ExpiresAt_ActiveQuantity'
   )
    DROP INDEX [IX_InventoryLots_TenantId_ExpiresAt_ActiveQuantity] ON [dbo].[InventoryLots];
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
BEGIN
    DECLARE @constraintName sysname;

    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertSound') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'ExpiryAlertSound';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [ExpiryAlertSound];
    END

    SET @constraintName = NULL;
    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertSoundEnabled') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'ExpiryAlertSoundEnabled';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [ExpiryAlertSoundEnabled];
    END

    SET @constraintName = NULL;
    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertLeadDays') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'ExpiryAlertLeadDays';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [ExpiryAlertLeadDays];
    END

    SET @constraintName = NULL;
    IF COL_LENGTH(N'dbo.TenantSettings', N'ExpiryAlertsEnabled') IS NOT NULL
    BEGIN
        SELECT @constraintName = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[TenantSettings]')
          AND c.name = N'ExpiryAlertsEnabled';
        IF @constraintName IS NOT NULL
            EXEC(N'ALTER TABLE [dbo].[TenantSettings] DROP CONSTRAINT [' + @constraintName + N']');
        ALTER TABLE [dbo].[TenantSettings] DROP COLUMN [ExpiryAlertsEnabled];
    END
END
""");
    }
}
