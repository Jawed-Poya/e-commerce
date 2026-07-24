using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724200000_AddSingleHostStorefrontAccessAndNotificationRetention")]
public sealed class AddSingleHostStorefrontAccessAndNotificationRetention : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.Tenants', N'StorefrontKey') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [StorefrontKey] nvarchar(64) NULL;
    IF COL_LENGTH(N'dbo.Tenants', N'StorefrontAccessMode') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [StorefrontAccessMode] int NOT NULL CONSTRAINT [DF_Tenants_StorefrontAccessMode] DEFAULT(1);
    IF COL_LENGTH(N'dbo.Tenants', N'IsStorefrontPublished') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [IsStorefrontPublished] bit NOT NULL CONSTRAINT [DF_Tenants_IsStorefrontPublished] DEFAULT(1);
    IF COL_LENGTH(N'dbo.Tenants', N'StorefrontKeyRotatedAt') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [StorefrontKeyRotatedAt] datetime2 NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Tenants', N'StorefrontKey') IS NOT NULL
BEGIN
    UPDATE [dbo].[Tenants]
    SET [StorefrontKey] = LOWER(REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''))
    WHERE [StorefrontKey] IS NULL OR LEN(LTRIM(RTRIM([StorefrontKey]))) < 24;

    IF COL_LENGTH(N'dbo.Tenants', N'SiteRoutingMode') IS NOT NULL
        EXEC sys.sp_executesql N'UPDATE [dbo].[Tenants] SET [SiteRoutingMode] = 4';
    IF COL_LENGTH(N'dbo.Tenants', N'CustomDomain') IS NOT NULL
        EXEC sys.sp_executesql N'UPDATE [dbo].[Tenants] SET [CustomDomain] = NULL';
    IF COL_LENGTH(N'dbo.Tenants', N'StorefrontBaseUrlOverride') IS NOT NULL
        EXEC sys.sp_executesql N'UPDATE [dbo].[Tenants] SET [StorefrontBaseUrlOverride] = NULL';
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Tenants', N'StorefrontKey') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[Tenants] ALTER COLUMN [StorefrontKey] nvarchar(64) NOT NULL;

    IF NOT EXISTS
    (
        SELECT 1 FROM sys.indexes
        WHERE [object_id] = OBJECT_ID(N'[dbo].[Tenants]')
          AND [name] = N'IX_Tenants_StorefrontKey'
    )
        CREATE UNIQUE INDEX [IX_Tenants_StorefrontKey]
            ON [dbo].[Tenants]([StorefrontKey]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.TenantSettings', N'NotificationRetentionDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[TenantSettings]
        ADD [NotificationRetentionDays] int NOT NULL
            CONSTRAINT [DF_TenantSettings_NotificationRetentionDays] DEFAULT(30);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[PlatformSettings]', N'U') IS NOT NULL
BEGIN
    UPDATE [dbo].[PlatformSettings]
    SET [RootDomain] = NULL,
        [DefaultRoutingMode] = 4,
        [AllowCustomDomains] = 0,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [Id] = 1;
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The new opaque storefront key is a security boundary and is intentionally
        // retained on rollback. Removing it would restore mutable slug/query routing.
    }
}
