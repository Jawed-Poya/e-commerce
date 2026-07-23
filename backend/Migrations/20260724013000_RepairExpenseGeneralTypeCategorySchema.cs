using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

/// <summary>
/// Repairs databases where the operation-payment migration is recorded as applied
/// but the Expenses.GeneralTypeCategoryId schema change is missing or incomplete.
/// The statements are intentionally idempotent so this migration is also safe on
/// databases whose schema is already correct.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724013000_RepairExpenseGeneralTypeCategorySchema")]
public sealed class RepairExpenseGeneralTypeCategorySchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
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

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE [object_id] = OBJECT_ID(N'[dbo].[Expenses]')
          AND [name] = N'IX_Expenses_GeneralTypeCategoryId'
    )
        CREATE INDEX [IX_Expenses_GeneralTypeCategoryId]
            ON [dbo].[Expenses]([GeneralTypeCategoryId]);
END;

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

        IF COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NOT NULL
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

    ALTER TABLE [dbo].[Expenses]
        CHECK CONSTRAINT [FK_Expenses_Types_GeneralTypeCategoryId];
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally left empty. This migration repairs schema drift for a column
        // already required by the current model; rolling it back would recreate the error.
    }
}
