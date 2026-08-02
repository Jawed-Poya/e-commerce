using System;
using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260802073000_AddLotLevelInventoryTraceability")]
public sealed class AddLotLevelInventoryTraceability : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "InventoryTransactionLots",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                InventoryTransactionId = table.Column<long>(type: "bigint", nullable: false),
                InventoryLotId = table.Column<long>(type: "bigint", nullable: true),
                LotNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                WarehouseId = table.Column<long>(type: "bigint", nullable: false),
                WarehouseName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                ExpiresAt = table.Column<DateOnly>(type: "date", nullable: true),
                QuantityDelta = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                ReservedDelta = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                UnitCost = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                TenantId = table.Column<long>(type: "bigint", nullable: false),
                BranchId = table.Column<long>(type: "bigint", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_InventoryTransactionLots", x => x.Id);
                table.CheckConstraint(
                    "CK_InventoryTransactionLot_Movement",
                    "[QuantityDelta] <> 0 OR [ReservedDelta] <> 0");
                table.ForeignKey(
                    name: "FK_InventoryTransactionLots_InventoryLots_InventoryLotId",
                    column: x => x.InventoryLotId,
                    principalTable: "InventoryLots",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
                table.ForeignKey(
                    name: "FK_InventoryTransactionLots_InventoryTransactions_InventoryTransactionId",
                    column: x => x.InventoryTransactionId,
                    principalTable: "InventoryTransactions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_InventoryTransactionLots_InventoryLotId_CreatedAt",
            table: "InventoryTransactionLots",
            columns: new[] { "InventoryLotId", "CreatedAt" });

        migrationBuilder.CreateIndex(
            name: "IX_InventoryTransactionLots_InventoryTransactionId",
            table: "InventoryTransactionLots",
            column: "InventoryTransactionId");

        migrationBuilder.CreateIndex(
            name: "IX_InventoryTransactionLots_TenantId_LotNumber_CreatedAt",
            table: "InventoryTransactionLots",
            columns: new[] { "TenantId", "LotNumber", "CreatedAt" });

        // Convert any historical aggregate-only quantity to a visible legacy
        // lot so future stock-outs are fully traceable instead of silently
        // consuming an unknown batch.
        migrationBuilder.Sql("""
;WITH LotTotals AS
(
    SELECT [TenantId], [ProductId], SUM([Quantity]) AS [TrackedQuantity]
    FROM [dbo].[InventoryLots]
    WHERE [IsDeleted] = 0
    GROUP BY [TenantId], [ProductId]
)
INSERT INTO [dbo].[InventoryLots]
(
    [TenantId], [BranchId], [ProductId], [ProductVariantId], [WarehouseId],
    [LotNumber], [Quantity], [ReservedQuantity], [UnitCost], [ManufacturedAt],
    [ExpiresAt], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt]
)
SELECT
    inventory.[TenantId],
    inventory.[BranchId],
    inventory.[ProductId],
    NULL,
    warehouse.[Id],
    CONCAT(N'LEGACY-', inventory.[ProductId]),
    inventory.[Quantity] - COALESCE(totals.[TrackedQuantity], 0),
    0,
    NULL,
    NULL,
    NULL,
    SYSUTCDATETIME(),
    NULL,
    0,
    NULL
FROM [dbo].[ProductInventories] inventory
LEFT JOIN LotTotals totals
    ON totals.[TenantId] = inventory.[TenantId]
   AND totals.[ProductId] = inventory.[ProductId]
OUTER APPLY
(
    SELECT TOP (1) candidate.[Id]
    FROM [dbo].[Warehouses] candidate
    WHERE candidate.[TenantId] = inventory.[TenantId]
      AND candidate.[IsDeleted] = 0
      AND (candidate.[BranchId] = inventory.[BranchId]
           OR candidate.[BranchId] IS NULL
           OR inventory.[BranchId] IS NULL)
    ORDER BY
        CASE WHEN candidate.[BranchId] = inventory.[BranchId] THEN 0 ELSE 1 END,
        CASE WHEN candidate.[Code] = N'MAIN' THEN 0 ELSE 1 END,
        candidate.[Id]
) warehouse
WHERE warehouse.[Id] IS NOT NULL
  AND inventory.[IsDeleted] = 0
  AND inventory.[Quantity] - COALESCE(totals.[TrackedQuantity], 0) > 0.0005;

IF EXISTS
(
    SELECT 1
    FROM [dbo].[ProductInventories] inventory
    OUTER APPLY
    (
        SELECT SUM(lot.[Quantity]) AS [TrackedQuantity]
        FROM [dbo].[InventoryLots] lot
        WHERE lot.[ProductId] = inventory.[ProductId]
          AND lot.[IsDeleted] = 0
    ) lotTotals
    WHERE inventory.[IsDeleted] = 0
      AND ABS(inventory.[Quantity] - COALESCE(lotTotals.[TrackedQuantity], 0)) > 0.0005
)
    THROW 51000, 'Lot migration could not reconcile aggregate stock. Configure a warehouse and reconcile product lot quantities before retrying.', 1;
""");

        // Existing aggregate reservations are assigned across lots by FEFO so the
        // first post-upgrade sale or cancellation remains consistent. A later
        // fulfillment still rejects a lot that has expired in the meantime.
        migrationBuilder.Sql("""
DECLARE @ProductId bigint;
DECLARE @Reserved decimal(18,3);

DECLARE reservation_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT
    inventory.[ProductId],
    inventory.[ReservedQuantity] - COALESCE(lotTotals.[TrackedReservedQuantity], 0)
FROM [dbo].[ProductInventories] inventory
OUTER APPLY
(
    SELECT SUM(lot.[ReservedQuantity]) AS [TrackedReservedQuantity]
    FROM [dbo].[InventoryLots] lot
    WHERE lot.[ProductId] = inventory.[ProductId]
      AND lot.[IsDeleted] = 0
) lotTotals
WHERE inventory.[IsDeleted] = 0
  AND inventory.[ReservedQuantity] - COALESCE(lotTotals.[TrackedReservedQuantity], 0) > 0.0005;

OPEN reservation_cursor;
FETCH NEXT FROM reservation_cursor INTO @ProductId, @Reserved;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @LotId bigint;
    DECLARE @Available decimal(18,3);
    DECLARE @Take decimal(18,3);

    DECLARE lot_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT lot.[Id], lot.[Quantity] - lot.[ReservedQuantity]
    FROM [dbo].[InventoryLots] lot
    WHERE lot.[ProductId] = @ProductId
      AND lot.[IsDeleted] = 0
      AND lot.[Quantity] - lot.[ReservedQuantity] > 0.0005
    ORDER BY
        CASE WHEN lot.[ExpiresAt] IS NULL THEN 1 ELSE 0 END,
        lot.[ExpiresAt],
        lot.[CreatedAt],
        lot.[Id];

    OPEN lot_cursor;
    FETCH NEXT FROM lot_cursor INTO @LotId, @Available;

    WHILE @@FETCH_STATUS = 0 AND @Reserved > 0.0005
    BEGIN
        SET @Take = CASE WHEN @Available < @Reserved THEN @Available ELSE @Reserved END;
        UPDATE [dbo].[InventoryLots]
        SET [ReservedQuantity] = [ReservedQuantity] + @Take,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [Id] = @LotId;
        SET @Reserved = @Reserved - @Take;
        FETCH NEXT FROM lot_cursor INTO @LotId, @Available;
    END

    CLOSE lot_cursor;
    DEALLOCATE lot_cursor;
    FETCH NEXT FROM reservation_cursor INTO @ProductId, @Reserved;
END

CLOSE reservation_cursor;
DEALLOCATE reservation_cursor;

IF EXISTS
(
    SELECT 1
    FROM [dbo].[ProductInventories] inventory
    OUTER APPLY
    (
        SELECT SUM(lot.[ReservedQuantity]) AS [TrackedReservedQuantity]
        FROM [dbo].[InventoryLots] lot
        WHERE lot.[ProductId] = inventory.[ProductId]
          AND lot.[IsDeleted] = 0
    ) lotTotals
    WHERE inventory.[IsDeleted] = 0
      AND ABS(inventory.[ReservedQuantity] - COALESCE(lotTotals.[TrackedReservedQuantity], 0)) > 0.0005
)
    THROW 51001, 'Lot reservation migration could not reconcile aggregate reserved stock. Review inventory and warehouse data before retrying.', 1;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "InventoryTransactionLots");
    }
}
