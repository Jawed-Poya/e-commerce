using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260809232500_SimplifyUnitQuantitySettings")]
public sealed class SimplifyUnitQuantitySettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_ProductUnitConversion_OrderQuantityStep",
            table: "ProductUnitConversions");

        migrationBuilder.DropColumn(
            name: "QuickOrderQuantities",
            table: "ProductUnitConversions");

        migrationBuilder.DropColumn(
            name: "OrderQuantityStep",
            table: "ProductUnitConversions");

        migrationBuilder.AddColumn<string>(
            name: "DefaultQuickOrderQuantitiesJson",
            table: "CompanySettings",
            type: "nvarchar(500)",
            maxLength: 500,
            nullable: false,
            defaultValue: "[20,30,40,50]");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "DefaultQuickOrderQuantitiesJson",
            table: "CompanySettings");

        migrationBuilder.AddColumn<decimal>(
            name: "OrderQuantityStep",
            table: "ProductUnitConversions",
            type: "decimal(18,3)",
            precision: 18,
            scale: 3,
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<string>(
            name: "QuickOrderQuantities",
            table: "ProductUnitConversions",
            type: "nvarchar(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddCheckConstraint(
            name: "CK_ProductUnitConversion_OrderQuantityStep",
            table: "ProductUnitConversions",
            sql: "[OrderQuantityStep] > 0");
    }
}
