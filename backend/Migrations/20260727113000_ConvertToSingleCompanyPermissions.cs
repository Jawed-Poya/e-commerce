using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260727113000_ConvertToSingleCompanyPermissions")]
public sealed class ConvertToSingleCompanyPermissions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(BuildPermissionMigrationSql(toCompanyPermissions: true));

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
BEGIN
    UPDATE [dbo].[Tenants]
    SET [Slug] = N'company',
        [IsActive] = 1,
        [CustomDomain] = NULL,
        [StorefrontBaseUrlOverride] = NULL
    WHERE [Id] = 1;
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql(BuildPermissionMigrationSql(toCompanyPermissions: false));

    private static string BuildPermissionMigrationSql(bool toCompanyPermissions)
    {
        var mappings = toCompanyPermissions
            ? """
(N'tenant.profile.manage', N'company.profile.manage'),
(N'tenant.branches.manage', N'company.branches.manage'),
(N'tenant.claims.manage', N'company.claims.manage'),
(N'tenant.reports.view', N'company.reports.view'),
(N'tenant.trash.manage', N'company.trash.manage'),
(N'tenant.settings.manage', N'company.settings.manage')
"""
            : """
(N'company.profile.manage', N'tenant.profile.manage'),
(N'company.branches.manage', N'tenant.branches.manage'),
(N'company.claims.manage', N'tenant.claims.manage'),
(N'company.reports.view', N'tenant.reports.view'),
(N'company.trash.manage', N'tenant.trash.manage'),
(N'company.settings.manage', N'tenant.settings.manage')
""";

        return $$"""
DECLARE @PermissionMap TABLE (OldValue nvarchar(256) NOT NULL, NewValue nvarchar(256) NOT NULL);
INSERT INTO @PermissionMap (OldValue, NewValue) VALUES
{{mappings}};

IF OBJECT_ID(N'[dbo].[AspNetRoleClaims]', N'U') IS NOT NULL
BEGIN
    DELETE oldClaim
    FROM [dbo].[AspNetRoleClaims] oldClaim
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = oldClaim.ClaimValue
    WHERE oldClaim.ClaimType = N'permission'
      AND EXISTS
      (
          SELECT 1
          FROM [dbo].[AspNetRoleClaims] newClaim
          WHERE newClaim.RoleId = oldClaim.RoleId
            AND newClaim.ClaimType = oldClaim.ClaimType
            AND newClaim.ClaimValue = permissionMap.NewValue
      );

    UPDATE roleClaim
    SET ClaimValue = permissionMap.NewValue
    FROM [dbo].[AspNetRoleClaims] roleClaim
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = roleClaim.ClaimValue
    WHERE roleClaim.ClaimType = N'permission';
END;

IF OBJECT_ID(N'[dbo].[AspNetUserClaims]', N'U') IS NOT NULL
BEGIN
    DELETE oldClaim
    FROM [dbo].[AspNetUserClaims] oldClaim
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = oldClaim.ClaimValue
    WHERE oldClaim.ClaimType = N'permission'
      AND EXISTS
      (
          SELECT 1
          FROM [dbo].[AspNetUserClaims] newClaim
          WHERE newClaim.UserId = oldClaim.UserId
            AND newClaim.ClaimType = oldClaim.ClaimType
            AND newClaim.ClaimValue = permissionMap.NewValue
      );

    UPDATE userClaim
    SET ClaimValue = permissionMap.NewValue
    FROM [dbo].[AspNetUserClaims] userClaim
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = userClaim.ClaimValue
    WHERE userClaim.ClaimType = N'permission';
END;

IF OBJECT_ID(N'[dbo].[TenantPermissionGrants]', N'U') IS NOT NULL
BEGIN
    DELETE oldGrant
    FROM [dbo].[TenantPermissionGrants] oldGrant
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = oldGrant.Permission
    WHERE EXISTS
    (
        SELECT 1
        FROM [dbo].[TenantPermissionGrants] newGrant
        WHERE newGrant.TenantId = oldGrant.TenantId
          AND newGrant.Permission = permissionMap.NewValue
    );

    UPDATE permissionGrant
    SET Permission = permissionMap.NewValue
    FROM [dbo].[TenantPermissionGrants] permissionGrant
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = permissionGrant.Permission;
END;

IF OBJECT_ID(N'[dbo].[SubscriptionPlanPermissions]', N'U') IS NOT NULL
BEGIN
    DELETE oldPermission
    FROM [dbo].[SubscriptionPlanPermissions] oldPermission
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = oldPermission.Permission
    WHERE EXISTS
    (
        SELECT 1
        FROM [dbo].[SubscriptionPlanPermissions] newPermission
        WHERE newPermission.SubscriptionPlanId = oldPermission.SubscriptionPlanId
          AND newPermission.Permission = permissionMap.NewValue
    );

    UPDATE planPermission
    SET Permission = permissionMap.NewValue
    FROM [dbo].[SubscriptionPlanPermissions] planPermission
    INNER JOIN @PermissionMap permissionMap ON permissionMap.OldValue = planPermission.Permission;
END;
""";
    }
}
