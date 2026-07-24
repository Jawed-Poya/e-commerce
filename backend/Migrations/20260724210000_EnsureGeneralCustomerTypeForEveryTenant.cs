using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

/// <summary>
/// Guarantees that every existing company has the General customer type required
/// by storefront pricing, customer creation, notifications, and checkout.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724210000_EnsureGeneralCustomerTypeForEveryTenant")]
public sealed class EnsureGeneralCustomerTypeForEveryTenant : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[Types]', N'U') IS NOT NULL
BEGIN
    UPDATE customerType
    SET customerType.[IsDeleted] = 0,
        customerType.[DeletedAt] = NULL,
        customerType.[UpdatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Types] AS customerType
    INNER JOIN [dbo].[Tenants] AS tenant ON tenant.[Id] = customerType.[TenantId]
    WHERE tenant.[IsActive] = 1
      AND customerType.[Group] = 4
      AND customerType.[Name] = N'General'
      AND customerType.[IsDeleted] = 1;

    INSERT INTO [dbo].[Types]
        ([TenantId], [BranchId], [Name], [ImageUrl], [Group], [SortOrder], [ParentId],
         [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
    SELECT
        tenant.[Id],
        mainBranch.[Id],
        N'General',
        NULL,
        4,
        0,
        NULL,
        SYSUTCDATETIME(),
        NULL,
        0,
        NULL
    FROM [dbo].[Tenants] AS tenant
    OUTER APPLY
    (
        SELECT TOP (1) branch.[Id]
        FROM [dbo].[Branches] AS branch
        WHERE branch.[TenantId] = tenant.[Id]
          AND branch.[IsActive] = 1
        ORDER BY branch.[IsMain] DESC, branch.[Id]
    ) AS mainBranch
    WHERE tenant.[IsActive] = 1
      AND NOT EXISTS
      (
          SELECT 1
          FROM [dbo].[Types] AS customerType
          WHERE customerType.[TenantId] = tenant.[Id]
            AND customerType.[Group] = 4
            AND customerType.[Name] = N'General'
      );
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // General is operational reference data. Removing it would break pricing
        // and existing customer relationships, so rollback is intentionally safe.
    }
}
