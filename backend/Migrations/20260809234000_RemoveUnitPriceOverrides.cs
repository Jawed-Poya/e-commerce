using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260809234000_RemoveUnitPriceOverrides")]
public sealed class RemoveUnitPriceOverrides : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_ProductUnitConversion_Prices",
            table: "ProductUnitConversions");

        migrationBuilder.DropColumn(
            name: "OldPriceOverride",
            table: "ProductUnitConversions");

        migrationBuilder.DropColumn(
            name: "PriceOverride",
            table: "ProductUnitConversions");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "OldPriceOverride",
            table: "ProductUnitConversions",
            type: "decimal(18,2)",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "PriceOverride",
            table: "ProductUnitConversions",
            type: "decimal(18,2)",
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "CK_ProductUnitConversion_Prices",
            table: "ProductUnitConversions",
            sql: "[PriceOverride] IS NULL OR ([PriceOverride] >= 0 AND ([OldPriceOverride] IS NULL OR [OldPriceOverride] >= [PriceOverride]))");
    }
}
