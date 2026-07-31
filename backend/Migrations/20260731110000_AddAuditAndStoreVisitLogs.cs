using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260731110000_AddAuditAndStoreVisitLogs")]
public sealed class AddAuditAndStoreVisitLogs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("Browser", "ActivityLogs", "nvarchar(100)", maxLength: 100, nullable: true);
        migrationBuilder.AddColumn<string>("DeviceType", "ActivityLogs", "nvarchar(40)", maxLength: 40, nullable: true);
        migrationBuilder.AddColumn<long>("DurationMs", "ActivityLogs", "bigint", nullable: true);
        migrationBuilder.AddColumn<string>("HttpMethod", "ActivityLogs", "nvarchar(12)", maxLength: 12, nullable: true);
        migrationBuilder.AddColumn<string>("OperatingSystem", "ActivityLogs", "nvarchar(100)", maxLength: 100, nullable: true);
        migrationBuilder.AddColumn<string>("Path", "ActivityLogs", "nvarchar(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddColumn<string>("RequestId", "ActivityLogs", "nvarchar(100)", maxLength: 100, nullable: true);
        migrationBuilder.AddColumn<int>("StatusCode", "ActivityLogs", "int", nullable: true);
        migrationBuilder.AddColumn<string>("UserName", "ActivityLogs", "nvarchar(256)", maxLength: 256, nullable: true);

        migrationBuilder.CreateTable(
            name: "CustomerVisitLogs",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false).Annotation("SqlServer:Identity", "1, 1"),
                CustomerId = table.Column<long>(type: "bigint", nullable: true),
                SessionId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                Path = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                Referrer = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                IpAddress = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                UserAgent = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                DeviceType = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                Browser = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                OperatingSystem = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                Language = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                ScreenWidth = table.Column<int>(type: "int", nullable: true),
                ScreenHeight = table.Column<int>(type: "int", nullable: true),
                IsAuthenticated = table.Column<bool>(type: "bit", nullable: false),
                TenantId = table.Column<long>(type: "bigint", nullable: false),
                BranchId = table.Column<long>(type: "bigint", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CustomerVisitLogs", x => x.Id);
                table.ForeignKey("FK_CustomerVisitLogs_Branches_BranchId", x => x.BranchId, "Branches", "Id");
                table.ForeignKey("FK_CustomerVisitLogs_Customers_CustomerId", x => x.CustomerId, "Customers", "Id", onDelete: ReferentialAction.SetNull);
                table.ForeignKey("FK_CustomerVisitLogs_Tenants_TenantId", x => x.TenantId, "Tenants", "Id");
            });

        migrationBuilder.CreateIndex("IX_ActivityLogs_TenantId_CreatedAt", "ActivityLogs", new[] { "TenantId", "CreatedAt" });
        migrationBuilder.CreateIndex("IX_ActivityLogs_TenantId_UserId_CreatedAt", "ActivityLogs", new[] { "TenantId", "UserId", "CreatedAt" });
        migrationBuilder.CreateIndex("IX_CustomerVisitLogs_BranchId", "CustomerVisitLogs", "BranchId");
        migrationBuilder.CreateIndex("IX_CustomerVisitLogs_CustomerId", "CustomerVisitLogs", "CustomerId");
        migrationBuilder.CreateIndex("IX_CustomerVisitLogs_TenantId_CreatedAt", "CustomerVisitLogs", new[] { "TenantId", "CreatedAt" });
        migrationBuilder.CreateIndex("IX_CustomerVisitLogs_TenantId_CustomerId_CreatedAt", "CustomerVisitLogs", new[] { "TenantId", "CustomerId", "CreatedAt" });
        migrationBuilder.CreateIndex("IX_CustomerVisitLogs_TenantId_SessionId_CreatedAt", "CustomerVisitLogs", new[] { "TenantId", "SessionId", "CreatedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("CustomerVisitLogs");
        migrationBuilder.DropIndex("IX_ActivityLogs_TenantId_CreatedAt", "ActivityLogs");
        migrationBuilder.DropIndex("IX_ActivityLogs_TenantId_UserId_CreatedAt", "ActivityLogs");
        migrationBuilder.DropColumn("Browser", "ActivityLogs");
        migrationBuilder.DropColumn("DeviceType", "ActivityLogs");
        migrationBuilder.DropColumn("DurationMs", "ActivityLogs");
        migrationBuilder.DropColumn("HttpMethod", "ActivityLogs");
        migrationBuilder.DropColumn("OperatingSystem", "ActivityLogs");
        migrationBuilder.DropColumn("Path", "ActivityLogs");
        migrationBuilder.DropColumn("RequestId", "ActivityLogs");
        migrationBuilder.DropColumn("StatusCode", "ActivityLogs");
        migrationBuilder.DropColumn("UserName", "ActivityLogs");
    }
}
