using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260809224500_AddStorefrontOrderQuantitySteps")]
public sealed class AddStorefrontOrderQuantitySteps : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "OrderQuantityStep",
            table: "Products",
            type: "decimal(18,3)",
            precision: 18,
            scale: 3,
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<decimal>(
            name: "OrderQuantityStep",
            table: "ProductUnitConversions",
            type: "decimal(18,3)",
            precision: 18,
            scale: 3,
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddCheckConstraint(
            name: "CK_Product_OrderQuantityStep",
            table: "Products",
            sql: "[OrderQuantityStep] > 0");

        migrationBuilder.AddCheckConstraint(
            name: "CK_ProductUnitConversion_OrderQuantityStep",
            table: "ProductUnitConversions",
            sql: "[OrderQuantityStep] > 0");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_ProductUnitConversion_OrderQuantityStep",
            table: "ProductUnitConversions");

        migrationBuilder.DropCheckConstraint(
            name: "CK_Product_OrderQuantityStep",
            table: "Products");

        migrationBuilder.DropColumn(
            name: "OrderQuantityStep",
            table: "ProductUnitConversions");

        migrationBuilder.DropColumn(
            name: "OrderQuantityStep",
            table: "Products");
    }
}
