using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260731100000_AddOperationDocumentReferencesAndOfflineIdempotency")]
public sealed class AddOperationDocumentReferencesAndOfflineIdempotency : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ClientRequestId",
            table: "Purchases",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ClientRequestId",
            table: "InventorySales",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ReferenceNumber",
            table: "InventorySales",
            type: "nvarchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Purchases_TenantId_ClientRequestId",
            table: "Purchases",
            columns: new[] { "TenantId", "ClientRequestId" },
            unique: true,
            filter: "[ClientRequestId] IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_Purchases_TenantId_ReferenceNumber",
            table: "Purchases",
            columns: new[] { "TenantId", "ReferenceNumber" });

        migrationBuilder.CreateIndex(
            name: "IX_InventorySales_TenantId_ClientRequestId",
            table: "InventorySales",
            columns: new[] { "TenantId", "ClientRequestId" },
            unique: true,
            filter: "[ClientRequestId] IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_InventorySales_TenantId_ReferenceNumber",
            table: "InventorySales",
            columns: new[] { "TenantId", "ReferenceNumber" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Purchases_TenantId_ClientRequestId",
            table: "Purchases");

        migrationBuilder.DropIndex(
            name: "IX_Purchases_TenantId_ReferenceNumber",
            table: "Purchases");

        migrationBuilder.DropIndex(
            name: "IX_InventorySales_TenantId_ClientRequestId",
            table: "InventorySales");

        migrationBuilder.DropIndex(
            name: "IX_InventorySales_TenantId_ReferenceNumber",
            table: "InventorySales");

        migrationBuilder.DropColumn(
            name: "ClientRequestId",
            table: "Purchases");

        migrationBuilder.DropColumn(
            name: "ClientRequestId",
            table: "InventorySales");

        migrationBuilder.DropColumn(
            name: "ReferenceNumber",
            table: "InventorySales");
    }
}
