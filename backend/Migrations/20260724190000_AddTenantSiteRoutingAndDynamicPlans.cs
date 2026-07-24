using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724190000_AddTenantSiteRoutingAndDynamicPlans")]
public sealed class AddTenantSiteRoutingAndDynamicPlans : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.Tenants', N'CustomDomain') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [CustomDomain] nvarchar(255) NULL;
    IF COL_LENGTH(N'dbo.Tenants', N'StorefrontBaseUrlOverride') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [StorefrontBaseUrlOverride] nvarchar(2048) NULL;
    IF COL_LENGTH(N'dbo.Tenants', N'SiteRoutingMode') IS NULL
        ALTER TABLE [dbo].[Tenants] ADD [SiteRoutingMode] int NOT NULL CONSTRAINT [DF_Tenants_SiteRoutingMode] DEFAULT(1);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [object_id] = OBJECT_ID(N'[dbo].[Tenants]') AND [name] = N'IX_Tenants_CustomDomain')
BEGIN
    CREATE UNIQUE INDEX [IX_Tenants_CustomDomain] ON [dbo].[Tenants]([CustomDomain]) WHERE [CustomDomain] IS NOT NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[PlatformSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PlatformSettings]
    (
        [Id] bigint NOT NULL CONSTRAINT [PK_PlatformSettings] PRIMARY KEY,
        [StorefrontBaseUrl] nvarchar(2048) NOT NULL,
        [AdminBaseUrl] nvarchar(2048) NOT NULL,
        [RootDomain] nvarchar(255) NULL,
        [DefaultRoutingMode] int NOT NULL,
        [AllowCustomDomains] bit NOT NULL,
        [UpdatedAt] datetime2 NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM [dbo].[PlatformSettings] WHERE [Id] = 1)
BEGIN
    INSERT INTO [dbo].[PlatformSettings]
        ([Id],[StorefrontBaseUrl],[AdminBaseUrl],[RootDomain],[DefaultRoutingMode],[AllowCustomDomains],[UpdatedAt])
    VALUES
        (1,N'http://localhost:5174',N'http://localhost:5173',NULL,1,1,SYSUTCDATETIME());
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[SubscriptionPlans]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubscriptionPlans]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SubscriptionPlans] PRIMARY KEY,
        [Code] nvarchar(80) NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Description] nvarchar(600) NULL,
        [IsSystem] bit NOT NULL,
        [IsActive] bit NOT NULL,
        [SortOrder] int NOT NULL,
        [LegacyPlan] int NOT NULL,
        [MonthlyPrice] decimal(18,2) NOT NULL,
        [YearlyPrice] decimal(18,2) NOT NULL,
        [CurrencyCode] nvarchar(3) NOT NULL,
        [MaxUsers] int NOT NULL,
        [MaxBranches] int NOT NULL,
        [MaxProducts] int NOT NULL,
        [MaxOrdersPerMonth] int NOT NULL,
        [MaxStorageMb] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL
    );
    CREATE UNIQUE INDEX [IX_SubscriptionPlans_Code] ON [dbo].[SubscriptionPlans]([Code]);
END;

IF OBJECT_ID(N'[dbo].[SubscriptionPlanPermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubscriptionPlanPermissions]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_SubscriptionPlanPermissions] PRIMARY KEY,
        [SubscriptionPlanId] bigint NOT NULL,
        [Permission] nvarchar(160) NOT NULL,
        [IsEnabled] bit NOT NULL,
        CONSTRAINT [FK_SubscriptionPlanPermissions_SubscriptionPlans_SubscriptionPlanId]
            FOREIGN KEY ([SubscriptionPlanId]) REFERENCES [dbo].[SubscriptionPlans]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [IX_SubscriptionPlanPermissions_SubscriptionPlanId_Permission]
        ON [dbo].[SubscriptionPlanPermissions]([SubscriptionPlanId],[Permission]);
END;
""");

        migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM [dbo].[SubscriptionPlans] WHERE [Code] = N'free')
    INSERT INTO [dbo].[SubscriptionPlans] ([Code],[Name],[Description],[IsSystem],[IsActive],[SortOrder],[LegacyPlan],[MonthlyPrice],[YearlyPrice],[CurrencyCode],[MaxUsers],[MaxBranches],[MaxProducts],[MaxOrdersPerMonth],[MaxStorageMb],[CreatedAt])
    VALUES (N'free',N'Free',N'Essential commerce tools for a small company.',1,1,10,1,0,0,N'USD',3,1,100,500,1024,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM [dbo].[SubscriptionPlans] WHERE [Code] = N'premium')
    INSERT INTO [dbo].[SubscriptionPlans] ([Code],[Name],[Description],[IsSystem],[IsActive],[SortOrder],[LegacyPlan],[MonthlyPrice],[YearlyPrice],[CurrencyCode],[MaxUsers],[MaxBranches],[MaxProducts],[MaxOrdersPerMonth],[MaxStorageMb],[CreatedAt])
    VALUES (N'premium',N'Premium',N'Growing commerce operations with teams and branches.',1,1,20,2,49,490,N'USD',20,5,10000,10000,10240,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM [dbo].[SubscriptionPlans] WHERE [Code] = N'full')
    INSERT INTO [dbo].[SubscriptionPlans] ([Code],[Name],[Description],[IsSystem],[IsActive],[SortOrder],[LegacyPlan],[MonthlyPrice],[YearlyPrice],[CurrencyCode],[MaxUsers],[MaxBranches],[MaxProducts],[MaxOrdersPerMonth],[MaxStorageMb],[CreatedAt])
    VALUES (N'full',N'Full',N'Complete platform access for established organizations.',1,1,30,3,99,990,N'USD',100,25,100000,100000,51200,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM [dbo].[SubscriptionPlans] WHERE [Code] = N'enterprise')
    INSERT INTO [dbo].[SubscriptionPlans] ([Code],[Name],[Description],[IsSystem],[IsActive],[SortOrder],[LegacyPlan],[MonthlyPrice],[YearlyPrice],[CurrencyCode],[MaxUsers],[MaxBranches],[MaxProducts],[MaxOrdersPerMonth],[MaxStorageMb],[CreatedAt])
    VALUES (N'enterprise',N'Enterprise',N'High-capacity custom deployment and governance.',1,1,40,4,299,2990,N'USD',10000,1000,10000000,10000000,1048576,SYSUTCDATETIME());
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSubscriptions]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.TenantSubscriptions', N'SubscriptionPlanId') IS NULL
        ALTER TABLE [dbo].[TenantSubscriptions] ADD [SubscriptionPlanId] bigint NULL;
    IF COL_LENGTH(N'dbo.TenantSubscriptions', N'PlanName') IS NULL
        ALTER TABLE [dbo].[TenantSubscriptions] ADD [PlanName] nvarchar(120) NOT NULL CONSTRAINT [DF_TenantSubscriptions_PlanName] DEFAULT(N'Free');
    IF COL_LENGTH(N'dbo.TenantSubscriptions', N'MaxOrdersPerMonth') IS NULL
        ALTER TABLE [dbo].[TenantSubscriptions] ADD [MaxOrdersPerMonth] int NOT NULL CONSTRAINT [DF_TenantSubscriptions_MaxOrdersPerMonth] DEFAULT(500);
    IF COL_LENGTH(N'dbo.TenantSubscriptions', N'MaxStorageMb') IS NULL
        ALTER TABLE [dbo].[TenantSubscriptions] ADD [MaxStorageMb] int NOT NULL CONSTRAINT [DF_TenantSubscriptions_MaxStorageMb] DEFAULT(1024);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSubscriptions]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[SubscriptionPlans]', N'U') IS NOT NULL
BEGIN
    UPDATE subscription
    SET [SubscriptionPlanId] = plan.[Id], [PlanName] = plan.[Name],
        [MaxOrdersPerMonth] = CASE WHEN subscription.[MaxOrdersPerMonth] < 1 THEN plan.[MaxOrdersPerMonth] ELSE subscription.[MaxOrdersPerMonth] END,
        [MaxStorageMb] = CASE WHEN subscription.[MaxStorageMb] < 1 THEN plan.[MaxStorageMb] ELSE subscription.[MaxStorageMb] END
    FROM [dbo].[TenantSubscriptions] subscription
    INNER JOIN [dbo].[SubscriptionPlans] plan ON plan.[LegacyPlan] = subscription.[Plan]
    WHERE subscription.[SubscriptionPlanId] IS NULL;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSubscriptions]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.TenantSubscriptions', N'SubscriptionPlanId') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.indexes
       WHERE [object_id] = OBJECT_ID(N'[dbo].[TenantSubscriptions]')
         AND [name] = N'IX_TenantSubscriptions_SubscriptionPlanId'
   )
BEGIN
    CREATE INDEX [IX_TenantSubscriptions_SubscriptionPlanId]
        ON [dbo].[TenantSubscriptions]([SubscriptionPlanId]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSubscriptions]', N'U') IS NOT NULL
   AND OBJECT_ID(N'[dbo].[SubscriptionPlans]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.TenantSubscriptions', N'SubscriptionPlanId') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1 FROM sys.foreign_keys
       WHERE [parent_object_id] = OBJECT_ID(N'[dbo].[TenantSubscriptions]')
         AND [name] = N'FK_TenantSubscriptions_SubscriptionPlans_SubscriptionPlanId'
   )
BEGIN
    ALTER TABLE [dbo].[TenantSubscriptions] WITH CHECK
        ADD CONSTRAINT [FK_TenantSubscriptions_SubscriptionPlans_SubscriptionPlanId]
        FOREIGN KEY ([SubscriptionPlanId]) REFERENCES [dbo].[SubscriptionPlans]([Id]) ON DELETE SET NULL;
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Deliberately non-destructive. Tenant links and subscription history are operational data.
    }
}
