using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723023000_AddOperationPaymentLedgersAndGeneralExpenseTypes")]
public sealed class AddOperationPaymentLedgersAndGeneralExpenseTypes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Keep schema creation in its own command. SQL Server compiles a complete
        // batch before executing it, so a column cannot be added and referenced
        // later in the same migrationBuilder.Sql batch.
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
BEGIN
    DECLARE @legacyExpenseFk sysname;

    SELECT TOP (1) @legacyExpenseFk = fk.[name]
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.[constraint_object_id] = fk.[object_id]
    INNER JOIN sys.tables parentTable ON parentTable.[object_id] = fk.[parent_object_id]
    INNER JOIN sys.columns parentColumn
        ON parentColumn.[object_id] = parentTable.[object_id]
       AND parentColumn.[column_id] = fkc.[parent_column_id]
    WHERE parentTable.[name] = N'Expenses'
      AND parentColumn.[name] = N'CategoryId';

    IF @legacyExpenseFk IS NOT NULL
        EXEC(N'ALTER TABLE [dbo].[Expenses] DROP CONSTRAINT [' + @legacyExpenseFk + N']');

    IF COL_LENGTH(N'dbo.Expenses', N'CategoryId') IS NOT NULL
        ALTER TABLE [dbo].[Expenses] ALTER COLUMN [CategoryId] bigint NULL;

    IF COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NULL
        ALTER TABLE [dbo].[Expenses] ADD [GeneralTypeCategoryId] bigint NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM sys.indexes
       WHERE [object_id] = OBJECT_ID(N'[dbo].[Expenses]')
         AND [name] = N'IX_Expenses_GeneralTypeCategoryId'
   )
BEGIN
    CREATE INDEX [IX_Expenses_GeneralTypeCategoryId]
        ON [dbo].[Expenses]([GeneralTypeCategoryId]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Types]', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'[dbo].[ExpenseCategories]', N'U') IS NOT NULL
    BEGIN
        INSERT INTO [dbo].[Types]
            ([Name], [Group], [SortOrder], [ParentId], [ImageUrl], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
        SELECT
            ec.[Name],
            5,
            ROW_NUMBER() OVER (ORDER BY ec.[Id]) - 1,
            NULL,
            NULL,
            SYSUTCDATETIME(),
            NULL,
            0,
            NULL
        FROM [dbo].[ExpenseCategories] ec
        WHERE ec.[IsDeleted] = 0
          AND NOT EXISTS
          (
              SELECT 1
              FROM [dbo].[Types] t
              WHERE t.[Group] = 5
                AND t.[Name] = ec.[Name]
                AND t.[IsDeleted] = 0
          );
    END;

    INSERT INTO [dbo].[Types]
        ([Name], [Group], [SortOrder], [ParentId], [ImageUrl], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
    SELECT
        defaults.[Name],
        5,
        defaults.[SortOrder],
        NULL,
        NULL,
        SYSUTCDATETIME(),
        NULL,
        0,
        NULL
    FROM (VALUES
        (N'Rent', 0),
        (N'Utilities', 1),
        (N'Transport', 2),
        (N'Office', 3),
        (N'Other', 4)
    ) defaults([Name], [SortOrder])
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [dbo].[Types] t
        WHERE t.[Group] = 5
          AND t.[Name] = defaults.[Name]
          AND t.[IsDeleted] = 0
    );
END;
""");

        // This command is deliberately separate from the ALTER TABLE command above.
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Types]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[ExpenseCategories]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NOT NULL
BEGIN
    UPDATE expense
    SET expense.[GeneralTypeCategoryId] = generalType.[Id]
    FROM [dbo].[Expenses] expense
    INNER JOIN [dbo].[ExpenseCategories] legacyCategory
        ON legacyCategory.[Id] = expense.[CategoryId]
    INNER JOIN [dbo].[Types] generalType
        ON generalType.[Group] = 5
       AND generalType.[Name] = legacyCategory.[Name]
       AND generalType.[IsDeleted] = 0
    WHERE expense.[GeneralTypeCategoryId] IS NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Types]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM sys.foreign_keys
       WHERE [parent_object_id] = OBJECT_ID(N'[dbo].[Expenses]')
         AND [name] = N'FK_Expenses_Types_GeneralTypeCategoryId'
   )
BEGIN
    ALTER TABLE [dbo].[Expenses] WITH CHECK
        ADD CONSTRAINT [FK_Expenses_Types_GeneralTypeCategoryId]
        FOREIGN KEY ([GeneralTypeCategoryId])
        REFERENCES [dbo].[Types]([Id]);
END;
""");

        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.StaffSalaryPayments', N'PaidAmount') IS NULL
    ALTER TABLE [dbo].[StaffSalaryPayments] ADD [PaidAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_StaffSalaryPayments_PaidAmount] DEFAULT 0;
IF COL_LENGTH(N'dbo.StaffSalaryPayments', N'PaymentStatus') IS NULL
    ALTER TABLE [dbo].[StaffSalaryPayments] ADD [PaymentStatus] int NOT NULL CONSTRAINT [DF_StaffSalaryPayments_PaymentStatus] DEFAULT 1;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[PurchasePayments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PurchasePayments] (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PurchasePayments] PRIMARY KEY,
        [PurchaseId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
        [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
        [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_PurchasePayments_Purchases_PurchaseId] FOREIGN KEY ([PurchaseId]) REFERENCES [dbo].[Purchases]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_PurchasePayments_PurchaseId_PaymentDate] ON [dbo].[PurchasePayments]([PurchaseId],[PaymentDate]);
END;

IF OBJECT_ID(N'[dbo].[InventorySalePayments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InventorySalePayments] (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySalePayments] PRIMARY KEY,
        [InventorySaleId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
        [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
        [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_InventorySalePayments_InventorySales_InventorySaleId] FOREIGN KEY ([InventorySaleId]) REFERENCES [dbo].[InventorySales]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_InventorySalePayments_InventorySaleId_PaymentDate] ON [dbo].[InventorySalePayments]([InventorySaleId],[PaymentDate]);
END;

IF OBJECT_ID(N'[dbo].[StaffSalaryInstallments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[StaffSalaryInstallments] (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StaffSalaryInstallments] PRIMARY KEY,
        [StaffSalaryPaymentId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
        [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
        [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_StaffSalaryInstallments_StaffSalaryPayments_StaffSalaryPaymentId] FOREIGN KEY ([StaffSalaryPaymentId]) REFERENCES [dbo].[StaffSalaryPayments]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_StaffSalaryInstallments_StaffSalaryPaymentId_PaymentDate] ON [dbo].[StaffSalaryInstallments]([StaffSalaryPaymentId],[PaymentDate]);
END;
""");

        migrationBuilder.Sql("""
INSERT INTO [dbo].[PurchasePayments] ([PurchaseId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[PaidAmount],[PurchaseDate],N'Legacy payment',[ReferenceNumber],N'Migrated opening payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [dbo].[Purchases] p
WHERE [PaidAmount] > 0
  AND NOT EXISTS (SELECT 1 FROM [dbo].[PurchasePayments] pp WHERE pp.[PurchaseId] = p.[Id]);

INSERT INTO [dbo].[InventorySalePayments] ([InventorySaleId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[PaidAmount],[SaleDate],[PaymentMethod],NULL,N'Migrated opening payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [dbo].[InventorySales] s
WHERE [PaidAmount] > 0
  AND NOT EXISTS (SELECT 1 FROM [dbo].[InventorySalePayments] sp WHERE sp.[InventorySaleId] = s.[Id]);

UPDATE salary
SET salary.[PaidAmount] = salary.[NetAmount], salary.[PaymentStatus] = 3
FROM [dbo].[StaffSalaryPayments] salary
WHERE salary.[PaidAmount] = 0
  AND salary.[NetAmount] > 0
  AND NOT EXISTS
  (
      SELECT 1 FROM [dbo].[StaffSalaryInstallments] installment
      WHERE installment.[StaffSalaryPaymentId] = salary.[Id]
  );

INSERT INTO [dbo].[StaffSalaryInstallments] ([StaffSalaryPaymentId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[NetAmount],[PaidDate],[PaymentMethod],[ReferenceNumber],N'Migrated salary payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [dbo].[StaffSalaryPayments] salary
WHERE [NetAmount] > 0
  AND NOT EXISTS
  (
      SELECT 1 FROM [dbo].[StaffSalaryInstallments] installment
      WHERE installment.[StaffSalaryPaymentId] = salary.[Id]
  );
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
DROP TABLE IF EXISTS [StaffSalaryInstallments];
DROP TABLE IF EXISTS [InventorySalePayments];
DROP TABLE IF EXISTS [PurchasePayments];
ALTER TABLE [StaffSalaryPayments] DROP CONSTRAINT [DF_StaffSalaryPayments_PaymentStatus];
ALTER TABLE [StaffSalaryPayments] DROP COLUMN [PaymentStatus];
ALTER TABLE [StaffSalaryPayments] DROP CONSTRAINT [DF_StaffSalaryPayments_PaidAmount];
ALTER TABLE [StaffSalaryPayments] DROP COLUMN [PaidAmount];
ALTER TABLE [Expenses] DROP CONSTRAINT [FK_Expenses_Types_GeneralTypeCategoryId];
DROP INDEX [IX_Expenses_GeneralTypeCategoryId] ON [Expenses];
ALTER TABLE [Expenses] DROP COLUMN [GeneralTypeCategoryId];
UPDATE [Expenses] SET [CategoryId] = (SELECT TOP 1 [Id] FROM [ExpenseCategories] ORDER BY [Id]) WHERE [CategoryId] IS NULL;
ALTER TABLE [Expenses] ALTER COLUMN [CategoryId] bigint NOT NULL;
ALTER TABLE [Expenses] ADD CONSTRAINT [FK_Expenses_ExpenseCategories_CategoryId]
    FOREIGN KEY ([CategoryId]) REFERENCES [ExpenseCategories]([Id]) ON DELETE NO ACTION;
""");
    }
}
