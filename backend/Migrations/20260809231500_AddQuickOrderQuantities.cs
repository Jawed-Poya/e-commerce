using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260809231500_AddQuickOrderQuantities")]
public sealed class AddQuickOrderQuantities : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "QuickOrderQuantities",
            table: "Products",
            type: "nvarchar(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "QuickOrderQuantities",
            table: "ProductUnitConversions",
            type: "nvarchar(500)",
            maxLength: 500,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "QuickOrderQuantities", table: "ProductUnitConversions");
        migrationBuilder.DropColumn(name: "QuickOrderQuantities", table: "Products");
    }
}
