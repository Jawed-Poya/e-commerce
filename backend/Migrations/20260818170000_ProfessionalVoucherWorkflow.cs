using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260818170000_ProfessionalVoucherWorkflow")]
public sealed class ProfessionalVoucherWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Keep schema creation separate from every statement that references the
        // new columns. SQL Server compiles each migration command independently,
        // so the new columns are visible before UPDATE/index/FK commands compile.
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.JournalVouchers', N'VoucherType') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [VoucherType] int NOT NULL CONSTRAINT [DF_JournalVouchers_VoucherType] DEFAULT(1);
    IF COL_LENGTH(N'dbo.JournalVouchers', N'Status') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [Status] int NOT NULL CONSTRAINT [DF_JournalVouchers_Status] DEFAULT(1);
    IF COL_LENGTH(N'dbo.JournalVouchers', N'IsSystemGenerated') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [IsSystemGenerated] bit NOT NULL CONSTRAINT [DF_JournalVouchers_IsSystemGenerated] DEFAULT(0);
    IF COL_LENGTH(N'dbo.JournalVouchers', N'ReferenceNumber') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [ReferenceNumber] nvarchar(100) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'SourceType') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [SourceType] nvarchar(50) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'SourceId') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [SourceId] bigint NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'SourceNumber') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [SourceNumber] nvarchar(100) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'CounterpartyType') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [CounterpartyType] nvarchar(50) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'CounterpartyId') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [CounterpartyId] bigint NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'CounterpartyName') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [CounterpartyName] nvarchar(250) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'PostedAt') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [PostedAt] datetime2 NOT NULL CONSTRAINT [DF_JournalVouchers_PostedAt] DEFAULT(SYSUTCDATETIME());
    IF COL_LENGTH(N'dbo.JournalVouchers', N'PostedByUserId') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [PostedByUserId] nvarchar(max) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'ReversedAt') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [ReversedAt] datetime2 NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'ReversedByUserId') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [ReversedByUserId] nvarchar(max) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'ReversalReason') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [ReversalReason] nvarchar(1000) NULL;
    IF COL_LENGTH(N'dbo.JournalVouchers', N'ReversalOfVoucherId') IS NULL
        ALTER TABLE [dbo].[JournalVouchers] ADD [ReversalOfVoucherId] bigint NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'IsSystemGenerated') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'PostedAt') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'PostedByUserId') IS NOT NULL
BEGIN
    UPDATE [dbo].[JournalVouchers]
    SET [PostedAt] = [CreatedAt],
        [PostedByUserId] = COALESCE([PostedByUserId], [CreatedByUserId])
    WHERE [IsSystemGenerated] = 0;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'SourceType') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'SourceId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE [name] = N'IX_JournalVouchers_SourceType_SourceId'
         AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
BEGIN
    CREATE UNIQUE INDEX [IX_JournalVouchers_SourceType_SourceId]
    ON [dbo].[JournalVouchers] ([SourceType], [SourceId])
    WHERE [SourceType] IS NOT NULL
      AND [SourceId] IS NOT NULL
      AND [IsDeleted] = 0;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'ReversalOfVoucherId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE [name] = N'IX_JournalVouchers_ReversalOfVoucherId'
         AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
BEGIN
    CREATE UNIQUE INDEX [IX_JournalVouchers_ReversalOfVoucherId]
    ON [dbo].[JournalVouchers] ([ReversalOfVoucherId])
    WHERE [ReversalOfVoucherId] IS NOT NULL
      AND [IsDeleted] = 0;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.JournalVouchers', N'ReversalOfVoucherId') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE [name] = N'FK_JournalVouchers_JournalVouchers_ReversalOfVoucherId')
BEGIN
    ALTER TABLE [dbo].[JournalVouchers] WITH CHECK
    ADD CONSTRAINT [FK_JournalVouchers_JournalVouchers_ReversalOfVoucherId]
    FOREIGN KEY ([ReversalOfVoucherId]) REFERENCES [dbo].[JournalVouchers] ([Id]);
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE [name] = N'FK_JournalVouchers_JournalVouchers_ReversalOfVoucherId')
        ALTER TABLE [dbo].[JournalVouchers] DROP CONSTRAINT [FK_JournalVouchers_JournalVouchers_ReversalOfVoucherId];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_JournalVouchers_SourceType_SourceId' AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
        DROP INDEX [IX_JournalVouchers_SourceType_SourceId] ON [dbo].[JournalVouchers];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_JournalVouchers_ReversalOfVoucherId' AND [object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]'))
        DROP INDEX [IX_JournalVouchers_ReversalOfVoucherId] ON [dbo].[JournalVouchers];

    DECLARE @column nvarchar(128), @constraint nvarchar(128), @sql nvarchar(max);
    DECLARE columns_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT [name] FROM (VALUES
            (N'VoucherType'), (N'Status'), (N'IsSystemGenerated'), (N'ReferenceNumber'),
            (N'SourceType'), (N'SourceId'), (N'SourceNumber'), (N'CounterpartyType'),
            (N'CounterpartyId'), (N'CounterpartyName'), (N'PostedAt'), (N'PostedByUserId'),
            (N'ReversedAt'), (N'ReversedByUserId'), (N'ReversalReason'), (N'ReversalOfVoucherId')) AS c([name]);
    OPEN columns_cursor;
    FETCH NEXT FROM columns_cursor INTO @column;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @constraint = dc.[name]
        FROM sys.default_constraints dc
        JOIN sys.columns sc ON sc.[default_object_id] = dc.[object_id]
        WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[JournalVouchers]') AND sc.[name] = @column;
        IF @constraint IS NOT NULL
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[JournalVouchers] DROP CONSTRAINT [' + REPLACE(@constraint, N']', N']]') + N']';
            EXEC sp_executesql @sql;
        END;
        IF COL_LENGTH(N'dbo.JournalVouchers', @column) IS NOT NULL
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[JournalVouchers] DROP COLUMN [' + REPLACE(@column, N']', N']]') + N']';
            EXEC sp_executesql @sql;
        END;
        SET @constraint = NULL;
        FETCH NEXT FROM columns_cursor INTO @column;
    END;
    CLOSE columns_cursor;
    DEALLOCATE columns_cursor;
END;
""");
    }
}
