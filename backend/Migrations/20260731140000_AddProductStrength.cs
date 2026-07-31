using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260731140000_AddProductStrength")]
public sealed class AddProductStrength : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF COL_LENGTH('dbo.Products', 'Strength') IS NULL
                ALTER TABLE dbo.Products ADD Strength nvarchar(100) NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF COL_LENGTH('dbo.Products', 'Strength') IS NOT NULL
                ALTER TABLE dbo.Products DROP COLUMN Strength;
            """);
    }
}
