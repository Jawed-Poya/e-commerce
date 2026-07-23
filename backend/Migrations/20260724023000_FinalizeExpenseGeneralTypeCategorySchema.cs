using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

/// <summary>
/// Final idempotent guard for databases whose migration history says the expense
/// category conversion ran while the physical GeneralTypeCategoryId schema is missing.
/// Every step is a separate SQL command to avoid SQL Server batch-compilation errors.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724023000_FinalizeExpenseGeneralTypeCategorySchema")]
public sealed class FinalizeExpenseGeneralTypeCategorySchema : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Expenses]
        ADD [GeneralTypeCategoryId] bigint NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Expenses]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Expenses', N'GeneralTypeCategoryId') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.indexes
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
    INSERT INTO [dbo].[Types]
        ([Name], [Group], [SortOrder], [ParentId], [ImageUrl], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
    SELECT defaults.[Name], 5, defaults.[SortOrder], NULL, NULL,
           SYSUTCDATETIME(), NULL, 0, NULL
    FROM (VALUES
        (N'Rent', 0), (N'Utilities', 1), (N'Transport', 2),
        (N'Office', 3), (N'Other', 4)
    ) defaults([Name], [SortOrder])
    WHERE NOT EXISTS
    (
        SELECT 1 FROM [dbo].[Types] t
        WHERE t.[Group] = 5
          AND t.[Name] = defaults.[Name]
          AND t.[IsDeleted] = 0
    );
END;
""");

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
       SELECT 1 FROM sys.foreign_keys
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
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // This migration repairs required schema and is intentionally non-destructive.
    }
}
