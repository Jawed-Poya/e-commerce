using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723033000_AddStorefrontShippingRules")]
public sealed class AddStorefrontShippingRules : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "ShippingEnabled",
            table: "StorefrontContents",
            type: "bit",
            nullable: false,
            defaultValue: true);

        migrationBuilder.AddColumn<decimal>(
            name: "FlatShippingFee",
            table: "StorefrontContents",
            type: "decimal(18,2)",
            precision: 18,
            scale: 2,
            nullable: false,
            defaultValue: 7.50m);

        migrationBuilder.AddColumn<decimal>(
            name: "FreeShippingThreshold",
            table: "StorefrontContents",
            type: "decimal(18,2)",
            precision: 18,
            scale: 2,
            nullable: false,
            defaultValue: 75m);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ShippingEnabled", table: "StorefrontContents");
        migrationBuilder.DropColumn(name: "FlatShippingFee", table: "StorefrontContents");
        migrationBuilder.DropColumn(name: "FreeShippingThreshold", table: "StorefrontContents");
    }
}
