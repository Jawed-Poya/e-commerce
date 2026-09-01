using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260901011000_AddSalesCorrectionsAndReturns")]
public sealed class AddSalesCorrectionsAndReturns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.InventorySales', N'ReturnedAmount') IS NULL
    ALTER TABLE [dbo].[InventorySales]
    ADD [ReturnedAmount] decimal(18,2) NOT NULL
        CONSTRAINT [DF_InventorySales_ReturnedAmount] DEFAULT(0);
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[InventorySaleReturns]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InventorySaleReturns](
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySaleReturns] PRIMARY KEY,
        [ReturnNumber] nvarchar(50) NOT NULL,
        [InventorySaleId] bigint NOT NULL,
        [CustomerId] bigint NULL,
        [ReturnDate] date NOT NULL,
        [SettlementMode] int NOT NULL,
        [Total] decimal(18,2) NOT NULL,
        [TaxAmount] decimal(18,2) NOT NULL,
        [DebtReduction] decimal(18,2) NOT NULL,
        [RefundAmount] decimal(18,2) NOT NULL,
        [CreditAmount] decimal(18,2) NOT NULL,
        [RefundMethod] nvarchar(50) NOT NULL,
        [CurrencyCode] nvarchar(10) NOT NULL,
        [Reason] nvarchar(500) NOT NULL,
        [Notes] nvarchar(2000) NULL,
        [CreatedByUserId] nvarchar(max) NULL,
        [BranchId] bigint NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_InventorySaleReturns_InventorySales_InventorySaleId]
            FOREIGN KEY ([InventorySaleId]) REFERENCES [dbo].[InventorySales]([Id]),
        CONSTRAINT [FK_InventorySaleReturns_Customers_CustomerId]
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[Customers]([Id])
    );
    CREATE UNIQUE INDEX [IX_InventorySaleReturns_ReturnNumber]
        ON [dbo].[InventorySaleReturns]([ReturnNumber]);
    CREATE INDEX [IX_InventorySaleReturns_InventorySaleId_ReturnDate]
        ON [dbo].[InventorySaleReturns]([InventorySaleId], [ReturnDate]);
    CREATE INDEX [IX_InventorySaleReturns_CustomerId]
        ON [dbo].[InventorySaleReturns]([CustomerId]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[InventorySaleReturnItems]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InventorySaleReturnItems](
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySaleReturnItems] PRIMARY KEY,
        [InventorySaleReturnId] bigint NOT NULL,
        [InventorySaleItemId] bigint NOT NULL,
        [ProductId] bigint NOT NULL,
        [Quantity] decimal(18,3) NOT NULL,
        [EnteredQuantity] decimal(18,3) NOT NULL,
        [SelectedUnitId] bigint NULL,
        [SelectedUnitName] nvarchar(100) NULL,
        [UnitConversionFactor] decimal(18,6) NOT NULL,
        [UnitPrice] decimal(18,4) NOT NULL,
        [UnitCost] decimal(18,4) NOT NULL,
        [LineTotal] decimal(18,2) NOT NULL,
        [Restock] bit NOT NULL,
        [BranchId] bigint NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAt] datetime2 NULL,
        CONSTRAINT [CK_InventorySaleReturnItem_Quantity]
            CHECK ([Quantity] > 0 AND [EnteredQuantity] > 0 AND [UnitConversionFactor] > 0),
        CONSTRAINT [FK_InventorySaleReturnItems_InventorySaleReturns_InventorySaleReturnId]
            FOREIGN KEY ([InventorySaleReturnId]) REFERENCES [dbo].[InventorySaleReturns]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_InventorySaleReturnItems_InventorySaleItems_InventorySaleItemId]
            FOREIGN KEY ([InventorySaleItemId]) REFERENCES [dbo].[InventorySaleItems]([Id]),
        CONSTRAINT [FK_InventorySaleReturnItems_Products_ProductId]
            FOREIGN KEY ([ProductId]) REFERENCES [dbo].[Products]([Id])
    );
    CREATE INDEX [IX_InventorySaleReturnItems_InventorySaleReturnId]
        ON [dbo].[InventorySaleReturnItems]([InventorySaleReturnId]);
    CREATE INDEX [IX_InventorySaleReturnItems_InventorySaleItemId]
        ON [dbo].[InventorySaleReturnItems]([InventorySaleItemId]);
    CREATE INDEX [IX_InventorySaleReturnItems_ProductId]
        ON [dbo].[InventorySaleReturnItems]([ProductId]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'Status') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'IX_JournalVouchers_SourceType_SourceId'
          AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
        DROP INDEX [IX_JournalVouchers_SourceType_SourceId] ON [dbo].[JournalVouchers];

    CREATE UNIQUE INDEX [IX_JournalVouchers_SourceType_SourceId]
        ON [dbo].[JournalVouchers]([SourceType], [SourceId])
        WHERE [SourceType] IS NOT NULL AND [SourceId] IS NOT NULL
          AND [IsDeleted] = 0 AND [Status] = 1;
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[InventorySaleReturnItems]', N'U') IS NOT NULL
    DROP TABLE [dbo].[InventorySaleReturnItems];
IF OBJECT_ID(N'[dbo].[InventorySaleReturns]', N'U') IS NOT NULL
    DROP TABLE [dbo].[InventorySaleReturns];
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'Status') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE [name] = N'IX_JournalVouchers_SourceType_SourceId'
          AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
        DROP INDEX [IX_JournalVouchers_SourceType_SourceId] ON [dbo].[JournalVouchers];

    CREATE UNIQUE INDEX [IX_JournalVouchers_SourceType_SourceId]
        ON [dbo].[JournalVouchers]([SourceType], [SourceId])
        WHERE [SourceType] IS NOT NULL AND [SourceId] IS NOT NULL AND [IsDeleted] = 0;
END;
""");

        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.InventorySales', N'ReturnedAmount') IS NOT NULL
BEGIN
    DECLARE @constraint sysname;
    SELECT @constraint = dc.[name]
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.[object_id] = dc.[parent_object_id]
        AND c.[column_id] = dc.[parent_column_id]
    WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[InventorySales]')
      AND c.[name] = N'ReturnedAmount';
    IF @constraint IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[InventorySales] DROP CONSTRAINT [' +
            REPLACE(@constraint, N']', N']]') + N']');
    ALTER TABLE [dbo].[InventorySales] DROP COLUMN [ReturnedAmount];
END;
""");
    }
}
