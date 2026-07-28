using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260728120000_AddDisplayStockProducts")]
public sealed class AddDisplayStockProducts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "AffectsInventory",
            table: "OrderItems",
            type: "bit",
            nullable: false,
            defaultValue: true);

        migrationBuilder.AddColumn<decimal>(
            name: "DisplayStockQuantity",
            table: "Products",
            type: "decimal(18,3)",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "UsesDisplayStock",
            table: "Products",
            type: "bit",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddCheckConstraint(
            name: "CK_Product_DisplayStockQuantity",
            table: "Products",
            sql: "[DisplayStockQuantity] IS NULL OR [DisplayStockQuantity] >= 0");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_Product_DisplayStockQuantity",
            table: "Products");

        migrationBuilder.DropColumn(
            name: "AffectsInventory",
            table: "OrderItems");

        migrationBuilder.DropColumn(
            name: "DisplayStockQuantity",
            table: "Products");

        migrationBuilder.DropColumn(
            name: "UsesDisplayStock",
            table: "Products");
    }
}
