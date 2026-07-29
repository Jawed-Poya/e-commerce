using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260729203000_AddProductUnitConversions")]
public sealed class AddProductUnitConversions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_OrderItem_Values",
            table: "OrderItems");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitPrice",
            table: "OrderItems",
            type: "decimal(18,6)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,2)");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitCost",
            table: "PurchaseItems",
            type: "decimal(18,4)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,2)");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitPrice",
            table: "InventorySaleItems",
            type: "decimal(18,4)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,2)");

        migrationBuilder.AddColumn<decimal>(
            name: "OrderedQuantity",
            table: "OrderItems",
            type: "decimal(18,3)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<long>(
            name: "SelectedUnitId",
            table: "OrderItems",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SelectedUnitName",
            table: "OrderItems",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "UnitConversionFactor",
            table: "OrderItems",
            type: "decimal(18,6)",
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<decimal>(
            name: "SellingUnitPrice",
            table: "OrderItems",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "EnteredQuantity",
            table: "PurchaseItems",
            type: "decimal(18,3)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<long>(
            name: "SelectedUnitId",
            table: "PurchaseItems",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SelectedUnitName",
            table: "PurchaseItems",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "UnitConversionFactor",
            table: "PurchaseItems",
            type: "decimal(18,6)",
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<decimal>(
            name: "EnteredUnitCost",
            table: "PurchaseItems",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "EnteredQuantity",
            table: "InventorySaleItems",
            type: "decimal(18,3)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<long>(
            name: "SelectedUnitId",
            table: "InventorySaleItems",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "SelectedUnitName",
            table: "InventorySaleItems",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "UnitConversionFactor",
            table: "InventorySaleItems",
            type: "decimal(18,6)",
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<decimal>(
            name: "EnteredUnitPrice",
            table: "InventorySaleItems",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.Sql("""
            UPDATE item
            SET item.[OrderedQuantity] = item.[Quantity],
                item.[SelectedUnitId] = product.[UnitId],
                item.[SelectedUnitName] = unitType.[Name],
                item.[UnitConversionFactor] = 1,
                item.[SellingUnitPrice] = item.[UnitPrice]
            FROM [OrderItems] item
            INNER JOIN [Products] product ON product.[Id] = item.[ProductId]
            LEFT JOIN [Types] unitType ON unitType.[Id] = product.[UnitId]
            WHERE item.[OrderedQuantity] = 0;

            UPDATE item
            SET item.[EnteredQuantity] = item.[Quantity],
                item.[SelectedUnitId] = product.[UnitId],
                item.[SelectedUnitName] = unitType.[Name],
                item.[UnitConversionFactor] = 1,
                item.[EnteredUnitCost] = item.[UnitCost]
            FROM [PurchaseItems] item
            INNER JOIN [Products] product ON product.[Id] = item.[ProductId]
            LEFT JOIN [Types] unitType ON unitType.[Id] = product.[UnitId]
            WHERE item.[EnteredQuantity] = 0;

            UPDATE item
            SET item.[EnteredQuantity] = item.[Quantity],
                item.[SelectedUnitId] = product.[UnitId],
                item.[SelectedUnitName] = unitType.[Name],
                item.[UnitConversionFactor] = 1,
                item.[EnteredUnitPrice] = item.[UnitPrice]
            FROM [InventorySaleItems] item
            INNER JOIN [Products] product ON product.[Id] = item.[ProductId]
            LEFT JOIN [Types] unitType ON unitType.[Id] = product.[UnitId]
            WHERE item.[EnteredQuantity] = 0;
            """);

        migrationBuilder.AddCheckConstraint(
            name: "CK_OrderItem_Values",
            table: "OrderItems",
            sql: "[Quantity] > 0 AND [OrderedQuantity] > 0 AND [UnitConversionFactor] > 0 AND [UnitPrice] >= 0 AND [SellingUnitPrice] >= 0 AND [Discount] >= 0 AND [Tax] >= 0");

        migrationBuilder.AddCheckConstraint(
            name: "CK_PurchaseItem_UnitValues",
            table: "PurchaseItems",
            sql: "[Quantity] > 0 AND [EnteredQuantity] > 0 AND [UnitConversionFactor] > 0 AND [UnitCost] >= 0 AND [EnteredUnitCost] >= 0");

        migrationBuilder.AddCheckConstraint(
            name: "CK_InventorySaleItem_UnitValues",
            table: "InventorySaleItems",
            sql: "[Quantity] > 0 AND [EnteredQuantity] > 0 AND [UnitConversionFactor] > 0 AND [UnitPrice] >= 0 AND [EnteredUnitPrice] >= 0");

        migrationBuilder.CreateTable(
            name: "ProductUnitConversions",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                ProductId = table.Column<long>(type: "bigint", nullable: false),
                UnitId = table.Column<long>(type: "bigint", nullable: false),
                ConversionFactor = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                PriceOverride = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                OldPriceOverride = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                IsDefault = table.Column<bool>(type: "bit", nullable: false),
                IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                SortOrder = table.Column<int>(type: "int", nullable: false),
                TenantId = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                BranchId = table.Column<long>(type: "bigint", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProductUnitConversions", x => x.Id);
                table.CheckConstraint("CK_ProductUnitConversion_Factor", "[ConversionFactor] >= 1");
                table.CheckConstraint("CK_ProductUnitConversion_Prices", "[PriceOverride] IS NULL OR ([PriceOverride] >= 0 AND ([OldPriceOverride] IS NULL OR [OldPriceOverride] >= [PriceOverride]))");
                table.CheckConstraint("CK_ProductUnitConversion_DefaultActive", "[IsDefault] = 0 OR [IsActive] = 1");
                table.ForeignKey(
                    name: "FK_ProductUnitConversions_Products_ProductId",
                    column: x => x.ProductId,
                    principalTable: "Products",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_ProductUnitConversions_Types_UnitId",
                    column: x => x.UnitId,
                    principalTable: "Types",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ProductUnitConversions_ProductId_UnitId",
            table: "ProductUnitConversions",
            columns: new[] { "ProductId", "UnitId" },
            unique: true,
            filter: "[IsDeleted] = 0");

        migrationBuilder.CreateIndex(
            name: "IX_ProductUnitConversions_ProductId_Default",
            table: "ProductUnitConversions",
            column: "ProductId",
            unique: true,
            filter: "[IsDefault] = 1 AND [IsDeleted] = 0");

        migrationBuilder.CreateIndex(
            name: "IX_ProductUnitConversions_TenantId_Barcode",
            table: "ProductUnitConversions",
            columns: new[] { "TenantId", "Barcode" },
            unique: true,
            filter: "[Barcode] IS NOT NULL AND [IsDeleted] = 0");

        migrationBuilder.CreateIndex(
            name: "IX_ProductUnitConversions_UnitId",
            table: "ProductUnitConversions",
            column: "UnitId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_OrderItem_Values", table: "OrderItems");
        migrationBuilder.DropCheckConstraint(name: "CK_PurchaseItem_UnitValues", table: "PurchaseItems");
        migrationBuilder.DropCheckConstraint(name: "CK_InventorySaleItem_UnitValues", table: "InventorySaleItems");
        migrationBuilder.DropTable(name: "ProductUnitConversions");
        migrationBuilder.DropColumn(name: "OrderedQuantity", table: "OrderItems");
        migrationBuilder.DropColumn(name: "SelectedUnitId", table: "OrderItems");
        migrationBuilder.DropColumn(name: "SelectedUnitName", table: "OrderItems");
        migrationBuilder.DropColumn(name: "UnitConversionFactor", table: "OrderItems");
        migrationBuilder.DropColumn(name: "SellingUnitPrice", table: "OrderItems");
        migrationBuilder.DropColumn(name: "EnteredQuantity", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "SelectedUnitId", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "SelectedUnitName", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "UnitConversionFactor", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "EnteredUnitCost", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "EnteredQuantity", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "SelectedUnitId", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "SelectedUnitName", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "UnitConversionFactor", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "EnteredUnitPrice", table: "InventorySaleItems");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitPrice",
            table: "OrderItems",
            type: "decimal(18,2)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,6)");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitCost",
            table: "PurchaseItems",
            type: "decimal(18,2)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,4)");

        migrationBuilder.AlterColumn<decimal>(
            name: "UnitPrice",
            table: "InventorySaleItems",
            type: "decimal(18,2)",
            nullable: false,
            oldClrType: typeof(decimal),
            oldType: "decimal(18,4)");

        migrationBuilder.AddCheckConstraint(
            name: "CK_OrderItem_Values",
            table: "OrderItems",
            sql: "[Quantity] > 0 AND [UnitPrice] >= 0 AND [Discount] >= 0 AND [Tax] >= 0");
    }
}
