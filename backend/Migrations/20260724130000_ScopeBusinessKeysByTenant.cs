using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724130000_ScopeBusinessKeysByTenant")]
public sealed class ScopeBusinessKeysByTenant : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.AspNetRoles', N'TenantId') IS NOT NULL
BEGIN
    UPDATE [dbo].[AspNetRoles]
    SET [TenantId] = 1
    WHERE [TenantId] IS NULL
      AND [Name] NOT IN (N'Admin', N'Customer', N'PlatformAdmin');

    UPDATE [dbo].[AspNetRoles]
    SET [Name] = CONCAT(N'tenant-', [TenantId], N':', [Name]),
        [NormalizedName] = UPPER(CONCAT(N'tenant-', [TenantId], N':', [Name]))
    WHERE [TenantId] IS NOT NULL
      AND [Name] NOT LIKE N'tenant-%:%';
END;
""");

        ReplaceUniqueIndex(migrationBuilder, "Types", "IX_Types_Group_Name",
            "IX_Types_TenantId_Group_Name", "[TenantId], [Group], [Name]");
        ReplaceUniqueIndex(migrationBuilder, "Products", "IX_Products_Barcode",
            "IX_Products_TenantId_Barcode", "[TenantId], [Barcode]", "[Barcode] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "Products", "IX_Products_Slug",
            "IX_Products_TenantId_Slug", "[TenantId], [Slug]", "[Slug] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "Customers", "IX_Customers_Phone",
            "IX_Customers_TenantId_Phone", "[TenantId], [Phone]");
        ReplaceUniqueIndex(migrationBuilder, "Customers", "IX_Customers_Email",
            "IX_Customers_TenantId_Email", "[TenantId], [Email]", "[Email] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "InventoryTransactions", "IX_InventoryTransactions_IdempotencyKey",
            "IX_InventoryTransactions_TenantId_IdempotencyKey", "[TenantId], [IdempotencyKey]", "[IdempotencyKey] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "Orders", "IX_Orders_OrderNumber",
            "IX_Orders_TenantId_OrderNumber", "[TenantId], [OrderNumber]");
        ReplaceUniqueIndex(migrationBuilder, "Payments", "IX_Payments_Provider_ExternalReference",
            "IX_Payments_TenantId_Provider_ExternalReference", "[TenantId], [Provider], [ExternalReference]", "[ExternalReference] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "ProductVariants", "IX_ProductVariants_Sku",
            "IX_ProductVariants_TenantId_Sku", "[TenantId], [Sku]");
        ReplaceUniqueIndex(migrationBuilder, "ProductVariants", "IX_ProductVariants_Barcode",
            "IX_ProductVariants_TenantId_Barcode", "[TenantId], [Barcode]", "[Barcode] IS NOT NULL");
        ReplaceUniqueIndex(migrationBuilder, "Warehouses", "IX_Warehouses_Code",
            "IX_Warehouses_TenantId_Code", "[TenantId], [Code]");
        ReplaceUniqueIndex(migrationBuilder, "Purchases", "IX_Purchases_PurchaseNumber",
            "IX_Purchases_TenantId_PurchaseNumber", "[TenantId], [PurchaseNumber]");
        ReplaceUniqueIndex(migrationBuilder, "InventorySales", "IX_InventorySales_SaleNumber",
            "IX_InventorySales_TenantId_SaleNumber", "[TenantId], [SaleNumber]");
        ReplaceUniqueIndex(migrationBuilder, "StaffMembers", "IX_StaffMembers_EmployeeNumber",
            "IX_StaffMembers_TenantId_EmployeeNumber", "[TenantId], [EmployeeNumber]");
        ReplaceUniqueIndex(migrationBuilder, "StaffSalaryPayments", "IX_StaffSalaryPayments_StaffId_PeriodYear_PeriodMonth",
            "IX_StaffSalaryPayments_TenantId_StaffId_PeriodYear_PeriodMonth", "[TenantId], [StaffId], [PeriodYear], [PeriodMonth]");
        ReplaceUniqueIndex(migrationBuilder, "ExpenseCategories", "IX_ExpenseCategories_Name",
            "IX_ExpenseCategories_TenantId_Name", "[TenantId], [Name]");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[AspNetUsers]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND [name] = N'IX_AspNetUsers_TenantId_NormalizedEmail')
        DROP INDEX [IX_AspNetUsers_TenantId_NormalizedEmail] ON [dbo].[AspNetUsers];
    CREATE UNIQUE INDEX [IX_AspNetUsers_TenantId_NormalizedEmail]
        ON [dbo].[AspNetUsers]([TenantId], [NormalizedEmail])
        WHERE [NormalizedEmail] IS NOT NULL;
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Tenant-scoped keys are intentionally retained to avoid reintroducing cross-company collisions.
    }

    private static void ReplaceUniqueIndex(
        MigrationBuilder migrationBuilder,
        string table,
        string oldName,
        string newName,
        string columns,
        string? filter = null)
    {
        var filterSql = string.IsNullOrWhiteSpace(filter) ? string.Empty : $" WHERE {filter}";
        migrationBuilder.Sql($"""
IF OBJECT_ID(N'[dbo].[{table}]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[{table}]') AND [name] = N'{oldName}')
        DROP INDEX [{oldName}] ON [dbo].[{table}];
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[{table}]') AND [name] = N'{newName}')
        CREATE UNIQUE INDEX [{newName}] ON [dbo].[{table}]({columns}){filterSql};
END;
""");
    }
}
