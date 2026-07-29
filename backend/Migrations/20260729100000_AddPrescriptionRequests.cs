using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260729100000_AddPrescriptionRequests")]
public sealed class AddPrescriptionRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "PrescriptionRequests",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                RequestNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                FullName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                Phone = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                Notes = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                AttachmentPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                OriginalFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                FileSize = table.Column<long>(type: "bigint", nullable: false),
                Status = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                AdminNotes = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                TenantId = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L),
                BranchId = table.Column<long>(type: "bigint", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                IsDeleted = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PrescriptionRequests", x => x.Id);
                table.ForeignKey(
                    name: "FK_PrescriptionRequests_Branches_BranchId",
                    column: x => x.BranchId,
                    principalTable: "Branches",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_PrescriptionRequests_Tenants_TenantId",
                    column: x => x.TenantId,
                    principalTable: "Tenants",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_PrescriptionRequests_BranchId",
            table: "PrescriptionRequests",
            column: "BranchId");

        migrationBuilder.CreateIndex(
            name: "IX_PrescriptionRequests_RequestNumber",
            table: "PrescriptionRequests",
            column: "RequestNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_PrescriptionRequests_TenantId_BranchId_Status_CreatedAt",
            table: "PrescriptionRequests",
            columns: new[] { "TenantId", "BranchId", "Status", "CreatedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "PrescriptionRequests");
    }
}
