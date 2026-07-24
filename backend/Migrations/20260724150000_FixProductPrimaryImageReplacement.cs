using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

public partial class FixProductPrimaryImageReplacement : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE [name] = N'IX_ProductImages_ProductId_IsPrimary'
                  AND [object_id] = OBJECT_ID(N'[dbo].[ProductImages]'))
            BEGIN
                DROP INDEX [IX_ProductImages_ProductId_IsPrimary]
                    ON [dbo].[ProductImages];
            END;
            """);

        migrationBuilder.Sql(
            """
            CREATE UNIQUE INDEX [IX_ProductImages_ProductId_IsPrimary]
                ON [dbo].[ProductImages] ([ProductId], [IsPrimary])
                WHERE [IsPrimary] = 1 AND [IsDeleted] = 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE [name] = N'IX_ProductImages_ProductId_IsPrimary'
                  AND [object_id] = OBJECT_ID(N'[dbo].[ProductImages]'))
            BEGIN
                DROP INDEX [IX_ProductImages_ProductId_IsPrimary]
                    ON [dbo].[ProductImages];
            END;
            """);

        migrationBuilder.Sql(
            """
            CREATE UNIQUE INDEX [IX_ProductImages_ProductId_IsPrimary]
                ON [dbo].[ProductImages] ([ProductId], [IsPrimary])
                WHERE [IsPrimary] = 1;
            """);
    }
}
