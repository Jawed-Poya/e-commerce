using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260727110000_AddCostSnapshotsForProfitReporting")]
public sealed class AddCostSnapshotsForProfitReporting : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "UnitCost",
            table: "OrderItems",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "UnitCost",
            table: "InventorySaleItems",
            type: "decimal(18,4)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.Sql("""
            UPDATE item
            SET item.UnitCost = COALESCE(cost.UnitCost, 0)
            FROM OrderItems item
            OUTER APPLY
            (
                SELECT TOP (1) purchaseItem.UnitCost
                FROM PurchaseItems purchaseItem
                INNER JOIN Purchases purchase ON purchase.Id = purchaseItem.PurchaseId
                WHERE purchaseItem.ProductId = item.ProductId
                  AND purchase.IsDeleted = 0
                  AND purchase.Status <> 3
                  AND purchase.CreatedAt <= item.CreatedAt
                ORDER BY purchase.PurchaseDate DESC, purchaseItem.Id DESC
            ) cost;

            UPDATE item
            SET item.UnitCost = COALESCE(cost.UnitCost, 0)
            FROM InventorySaleItems item
            INNER JOIN InventorySales sale ON sale.Id = item.InventorySaleId
            OUTER APPLY
            (
                SELECT TOP (1) purchaseItem.UnitCost
                FROM PurchaseItems purchaseItem
                INNER JOIN Purchases purchase ON purchase.Id = purchaseItem.PurchaseId
                WHERE purchaseItem.ProductId = item.ProductId
                  AND purchase.IsDeleted = 0
                  AND purchase.Status <> 3
                  AND purchase.PurchaseDate <= sale.SaleDate
                ORDER BY purchase.PurchaseDate DESC, purchaseItem.Id DESC
            ) cost;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "UnitCost", table: "OrderItems");
        migrationBuilder.DropColumn(name: "UnitCost", table: "InventorySaleItems");
    }
}
