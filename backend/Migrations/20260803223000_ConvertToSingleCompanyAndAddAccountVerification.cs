using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260803223000_ConvertToSingleCompanyAndAddAccountVerification")]
public sealed class ConvertToSingleCompanyAndAddAccountVerification : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
DECLARE @sql nvarchar(max) = N'';

-- Remove foreign keys tied to tenant scoping or legacy subscription tables.
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + N'.' +
    QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(10)
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN
      (N'TenantPermissionGrants',N'TenantSubscriptions',N'SubscriptionPlanPermissions',N'SubscriptionPlans',N'PlatformSettings')
   OR OBJECT_NAME(fk.referenced_object_id) IN
      (N'Tenants',N'TenantPermissionGrants',N'TenantSubscriptions',N'SubscriptionPlanPermissions',N'SubscriptionPlans',N'PlatformSettings')
   OR EXISTS
      (SELECT 1 FROM sys.foreign_key_columns fkc
       INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
       WHERE fkc.constraint_object_id = fk.object_id AND c.name = N'TenantId');
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

-- Drop every index whose key or included columns use TenantId.
SET @sql = N'';
SELECT @sql = @sql +
    CASE WHEN i.is_unique_constraint = 1
         THEN N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(i.object_id)) + N'.' + QUOTENAME(OBJECT_NAME(i.object_id)) +
              N' DROP CONSTRAINT ' + QUOTENAME(i.name) + N';'
         ELSE N'DROP INDEX ' + QUOTENAME(i.name) + N' ON ' + QUOTENAME(OBJECT_SCHEMA_NAME(i.object_id)) + N'.' +
              QUOTENAME(OBJECT_NAME(i.object_id)) + N';' END + CHAR(10)
FROM sys.indexes i
WHERE i.name IS NOT NULL
  AND i.is_primary_key = 0
  AND EXISTS
      (SELECT 1 FROM sys.index_columns ic
       INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
       WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND c.name = N'TenantId');
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

-- Drop TenantId defaults and columns from every business and Identity table.
SET @sql = N'';
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(dc.parent_object_id)) + N'.' +
    QUOTENAME(OBJECT_NAME(dc.parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE c.name = N'TenantId';
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

SET @sql = N'';
SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(c.object_id)) + N'.' +
    QUOTENAME(OBJECT_NAME(c.object_id)) + N' DROP COLUMN [TenantId];' + CHAR(10)
FROM sys.columns c
INNER JOIN sys.tables t ON t.object_id = c.object_id
WHERE c.name = N'TenantId' AND t.is_ms_shipped = 0;
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NOT NULL AND OBJECT_ID(N'[dbo].[Companies]', N'U') IS NULL
    EXEC sys.sp_rename N'dbo.Tenants', N'Companies';
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL AND OBJECT_ID(N'[dbo].[CompanySettings]', N'U') IS NULL
    EXEC sys.sp_rename N'dbo.TenantSettings', N'CompanySettings';

-- Keep the oldest profile/settings rows as the one-company records.
IF OBJECT_ID(N'[dbo].[Companies]', N'U') IS NOT NULL
BEGIN
    WITH ranked AS (SELECT Id, ROW_NUMBER() OVER (ORDER BY Id) AS rn FROM [dbo].[Companies])
    DELETE FROM ranked WHERE rn > 1;
END;
IF OBJECT_ID(N'[dbo].[CompanySettings]', N'U') IS NOT NULL
BEGIN
    WITH ranked AS (SELECT Id, ROW_NUMBER() OVER (ORDER BY Id) AS rn FROM [dbo].[CompanySettings])
    DELETE FROM ranked WHERE rn > 1;
END;

IF OBJECT_ID(N'[dbo].[CompanySettings]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.CompanySettings', N'AllowTenantUserClaimManagement') IS NOT NULL
       AND COL_LENGTH(N'dbo.CompanySettings', N'AllowUserClaimManagement') IS NULL
        EXEC sys.sp_rename N'dbo.CompanySettings.AllowTenantUserClaimManagement', N'AllowUserClaimManagement', N'COLUMN';

    IF COL_LENGTH(N'dbo.CompanySettings', N'ExpiryAlertPeriodsJson') IS NULL
        ALTER TABLE [dbo].[CompanySettings] ADD [ExpiryAlertPeriodsJson] nvarchar(500) NOT NULL
            CONSTRAINT [DF_CompanySettings_ExpiryAlertPeriodsJson] DEFAULT(N'[30,14,7,3,1,0]');

    IF COL_LENGTH(N'dbo.CompanySettings', N'ExpiryAlertLeadDays') IS NOT NULL
    BEGIN
        EXEC sys.sp_executesql N'
            UPDATE [dbo].[CompanySettings]
            SET [ExpiryAlertPeriodsJson] = N''['' + CONVERT(nvarchar(12),
                CASE WHEN [ExpiryAlertLeadDays] BETWEEN 0 AND 365 THEN [ExpiryAlertLeadDays] ELSE 30 END) + N'',14,7,3,1,0]'';';
        DECLARE @leadDefault sysname;
        SELECT @leadDefault = dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[CompanySettings]') AND c.name = N'ExpiryAlertLeadDays';
        IF @leadDefault IS NOT NULL
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[CompanySettings] DROP CONSTRAINT ' + QUOTENAME(@leadDefault) + N';';
            EXEC sys.sp_executesql @sql;
        END;
        ALTER TABLE [dbo].[CompanySettings] DROP COLUMN [ExpiryAlertLeadDays];
    END;
END;

-- Remove obsolete hosted-platform columns from the retained company profile.
DECLARE @obsolete TABLE (Name sysname);
INSERT INTO @obsolete VALUES
(N'Slug'),(N'CustomDomain'),(N'StorefrontBaseUrlOverride'),(N'SiteRoutingMode'),
(N'StorefrontKey'),(N'StorefrontAccessMode'),(N'IsStorefrontPublished'),(N'StorefrontKeyRotatedAt');

SET @sql = N'';
SELECT @sql = @sql + N'DROP INDEX ' + QUOTENAME(i.name) + N' ON [dbo].[Companies];' + CHAR(10)
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'[dbo].[Companies]') AND i.name IS NOT NULL AND i.is_primary_key = 0
  AND EXISTS (SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              INNER JOIN @obsolete o ON o.Name = c.name
              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id);
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

SET @sql = N'';
SELECT @sql = @sql + N'ALTER TABLE [dbo].[Companies] DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
INNER JOIN @obsolete o ON o.Name = c.name
WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[Companies]');
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

SET @sql = N'';
SELECT @sql = @sql + N'ALTER TABLE [dbo].[Companies] DROP COLUMN ' + QUOTENAME(o.Name) + N';' + CHAR(10)
FROM @obsolete o WHERE COL_LENGTH(N'dbo.Companies', o.Name) IS NOT NULL;
IF LEN(@sql) > 0 EXEC sys.sp_executesql @sql;

DROP TABLE IF EXISTS [dbo].[TenantPermissionGrants];
DROP TABLE IF EXISTS [dbo].[TenantSubscriptions];
DROP TABLE IF EXISTS [dbo].[SubscriptionPlanPermissions];
DROP TABLE IF EXISTS [dbo].[SubscriptionPlans];
DROP TABLE IF EXISTS [dbo].[PlatformSettings];

-- Merge legacy tenant/company-prefixed roles into global roles. Multiple old
-- companies may have used the same custom role name, so choose one canonical
-- target per normalized name and preserve all assignments and permission claims.
IF OBJECT_ID(N'[dbo].[AspNetRoles]', N'U') IS NOT NULL
BEGIN
    DECLARE @roleSources TABLE
    (
        SourceRoleId nvarchar(450) NOT NULL PRIMARY KEY,
        CleanName nvarchar(256) NOT NULL,
        CleanNormalizedName nvarchar(256) NOT NULL
    );

    INSERT INTO @roleSources (SourceRoleId, CleanName, CleanNormalizedName)
    SELECT role.[Id],
           SUBSTRING(role.[Name], CHARINDEX(N':', role.[Name]) + 1, 256),
           UPPER(SUBSTRING(role.[Name], CHARINDEX(N':', role.[Name]) + 1, 256))
    FROM [dbo].[AspNetRoles] role
    WHERE (role.[Name] LIKE N'company:%' OR role.[Name] LIKE N'tenant-%:%')
      AND CHARINDEX(N':', role.[Name]) > 0;

    DECLARE @roleTargets TABLE
    (
        CleanNormalizedName nvarchar(256) NOT NULL PRIMARY KEY,
        TargetRoleId nvarchar(450) NOT NULL,
        CleanName nvarchar(256) NOT NULL
    );

    INSERT INTO @roleTargets (CleanNormalizedName, TargetRoleId, CleanName)
    SELECT source.CleanNormalizedName,
           COALESCE(existing.[Id], MIN(source.SourceRoleId)),
           MIN(source.CleanName)
    FROM @roleSources source
    LEFT JOIN [dbo].[AspNetRoles] existing
      ON existing.[NormalizedName] = source.CleanNormalizedName
     AND NOT EXISTS (SELECT 1 FROM @roleSources candidate WHERE candidate.SourceRoleId = existing.[Id])
    GROUP BY source.CleanNormalizedName, existing.[Id];

    UPDATE role
    SET role.[Name] = target.CleanName,
        role.[NormalizedName] = target.CleanNormalizedName
    FROM [dbo].[AspNetRoles] role
    INNER JOIN @roleTargets target ON target.TargetRoleId = role.[Id]
    INNER JOIN @roleSources source ON source.SourceRoleId = role.[Id];

    IF OBJECT_ID(N'[dbo].[AspNetUserRoles]', N'U') IS NOT NULL
    BEGIN
        INSERT INTO [dbo].[AspNetUserRoles] ([UserId], [RoleId])
        SELECT DISTINCT assignment.[UserId], target.TargetRoleId
        FROM [dbo].[AspNetUserRoles] assignment
        INNER JOIN @roleSources source ON source.SourceRoleId = assignment.[RoleId]
        INNER JOIN @roleTargets target ON target.CleanNormalizedName = source.CleanNormalizedName
        WHERE assignment.[RoleId] <> target.TargetRoleId
          AND NOT EXISTS
              (SELECT 1 FROM [dbo].[AspNetUserRoles] existing
               WHERE existing.[UserId] = assignment.[UserId] AND existing.[RoleId] = target.TargetRoleId);

        DELETE assignment
        FROM [dbo].[AspNetUserRoles] assignment
        INNER JOIN @roleSources source ON source.SourceRoleId = assignment.[RoleId]
        INNER JOIN @roleTargets target ON target.CleanNormalizedName = source.CleanNormalizedName
        WHERE assignment.[RoleId] <> target.TargetRoleId;
    END;

    IF OBJECT_ID(N'[dbo].[AspNetRoleClaims]', N'U') IS NOT NULL
    BEGIN
        INSERT INTO [dbo].[AspNetRoleClaims] ([RoleId], [ClaimType], [ClaimValue])
        SELECT DISTINCT target.TargetRoleId, claim.[ClaimType], claim.[ClaimValue]
        FROM [dbo].[AspNetRoleClaims] claim
        INNER JOIN @roleSources source ON source.SourceRoleId = claim.[RoleId]
        INNER JOIN @roleTargets target ON target.CleanNormalizedName = source.CleanNormalizedName
        WHERE claim.[RoleId] <> target.TargetRoleId
          AND NOT EXISTS
              (SELECT 1 FROM [dbo].[AspNetRoleClaims] existing
               WHERE existing.[RoleId] = target.TargetRoleId
                 AND ISNULL(existing.[ClaimType], N'') = ISNULL(claim.[ClaimType], N'')
                 AND ISNULL(existing.[ClaimValue], N'') = ISNULL(claim.[ClaimValue], N''));

        DELETE claim
        FROM [dbo].[AspNetRoleClaims] claim
        INNER JOIN @roleSources source ON source.SourceRoleId = claim.[RoleId]
        INNER JOIN @roleTargets target ON target.CleanNormalizedName = source.CleanNormalizedName
        WHERE claim.[RoleId] <> target.TargetRoleId;
    END;

    DELETE role
    FROM [dbo].[AspNetRoles] role
    INNER JOIN @roleSources source ON source.SourceRoleId = role.[Id]
    INNER JOIN @roleTargets target ON target.CleanNormalizedName = source.CleanNormalizedName
    WHERE role.[Id] <> target.TargetRoleId;
END;

-- Branch codes must be globally unique in a single company.
IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NOT NULL
BEGIN
    WITH duplicateCodes AS
    (
        SELECT Id, Code, ROW_NUMBER() OVER (PARTITION BY Code ORDER BY Id) AS rn
        FROM [dbo].[Branches]
    )
    UPDATE branch
    SET Code = LEFT(branch.Code, 24) + N'-' + CONVERT(nvarchar(12), branch.Id)
    FROM [dbo].[Branches] branch
    INNER JOIN duplicateCodes duplicate ON duplicate.Id = branch.Id
    WHERE duplicate.rn > 1;
END;
""");

        migrationBuilder.CreateTable(
            name: "AccountVerificationCodes",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                Channel = table.Column<int>(type: "int", nullable: false),
                Destination = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                CodeHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                ConsumedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                AttemptCount = table.Column<int>(type: "int", nullable: false),
                BranchId = table.Column<long>(type: "bigint", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AccountVerificationCodes", x => x.Id);
                table.ForeignKey(
                    name: "FK_AccountVerificationCodes_AspNetUsers_UserId",
                    column: x => x.UserId,
                    principalTable: "AspNetUsers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_AccountVerificationCodes_ExpiresAt",
            table: "AccountVerificationCodes",
            column: "ExpiresAt");
        migrationBuilder.CreateIndex(
            name: "IX_AccountVerificationCodes_UserId_Channel_CreatedAt",
            table: "AccountVerificationCodes",
            columns: new[] { "UserId", "Channel", "CreatedAt" });

        migrationBuilder.Sql("""
-- Recreate the most important global indexes removed with TenantId. When legacy
-- cross-company duplicates exist, keep a non-unique index so upgrade succeeds;
-- application validation prevents new duplicates until those rows are cleaned.
-- ASP.NET Identity originally created PhoneNumber as nvarchar(max). SQL Server
-- cannot use a MAX column as an index key, so normalize it before creating the
-- filtered lookup index. Values beyond the supported phone length are truncated
-- and marked unconfirmed rather than aborting the complete company conversion.
IF OBJECT_ID(N'[dbo].[AspNetUsers]', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.AspNetUsers', N'PhoneNumber') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.AspNetUsers', N'PhoneNumberConfirmed') IS NOT NULL
        UPDATE [dbo].[AspNetUsers]
        SET [PhoneNumberConfirmed] = 0
        WHERE [PhoneNumber] IS NOT NULL
          AND DATALENGTH(CONVERT(nvarchar(max), [PhoneNumber])) > 128;

    UPDATE [dbo].[AspNetUsers]
    SET [PhoneNumber] = LEFT([PhoneNumber], 64)
    WHERE [PhoneNumber] IS NOT NULL
          AND DATALENGTH(CONVERT(nvarchar(max), [PhoneNumber])) > 128;

    IF EXISTS
    (
        SELECT 1
        FROM sys.columns columnInfo
        INNER JOIN sys.types typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
        WHERE columnInfo.object_id = OBJECT_ID(N'[dbo].[AspNetUsers]')
          AND columnInfo.name = N'PhoneNumber'
          AND (typeInfo.name <> N'nvarchar' OR columnInfo.max_length <> 128)
    )
        ALTER TABLE [dbo].[AspNetUsers]
            ALTER COLUMN [PhoneNumber] nvarchar(64) NULL;
END;

IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Branches]') AND name=N'IX_Branches_Code')
BEGIN
    IF NOT EXISTS (SELECT Code FROM [dbo].[Branches] GROUP BY Code HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_Branches_Code] ON [dbo].[Branches]([Code]);
    ELSE
        CREATE INDEX [IX_Branches_Code] ON [dbo].[Branches]([Code]);
END;

IF OBJECT_ID(N'[dbo].[AspNetUsers]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[AspNetUsers]') AND name=N'IX_AspNetUsers_BranchId')
        CREATE INDEX [IX_AspNetUsers_BranchId] ON [dbo].[AspNetUsers]([BranchId]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[AspNetUsers]') AND name=N'IX_AspNetUsers_NormalizedEmail')
    BEGIN
        IF NOT EXISTS (SELECT NormalizedEmail FROM [dbo].[AspNetUsers] WHERE NormalizedEmail IS NOT NULL GROUP BY NormalizedEmail HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_AspNetUsers_NormalizedEmail] ON [dbo].[AspNetUsers]([NormalizedEmail]) WHERE [NormalizedEmail] IS NOT NULL;
        ELSE CREATE INDEX [IX_AspNetUsers_NormalizedEmail] ON [dbo].[AspNetUsers]([NormalizedEmail]) WHERE [NormalizedEmail] IS NOT NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[AspNetUsers]') AND name=N'IX_AspNetUsers_PhoneNumber')
    BEGIN
        IF NOT EXISTS (SELECT PhoneNumber FROM [dbo].[AspNetUsers] WHERE PhoneNumber IS NOT NULL GROUP BY PhoneNumber HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_AspNetUsers_PhoneNumber] ON [dbo].[AspNetUsers]([PhoneNumber]) WHERE [PhoneNumber] IS NOT NULL;
        ELSE CREATE INDEX [IX_AspNetUsers_PhoneNumber] ON [dbo].[AspNetUsers]([PhoneNumber]) WHERE [PhoneNumber] IS NOT NULL;
    END;
END;

IF OBJECT_ID(N'[dbo].[ActivityLogs]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ActivityLogs]') AND name=N'IX_ActivityLogs_CreatedAt') CREATE INDEX [IX_ActivityLogs_CreatedAt] ON [dbo].[ActivityLogs]([CreatedAt]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ActivityLogs]') AND name=N'IX_ActivityLogs_UserId_CreatedAt') CREATE INDEX [IX_ActivityLogs_UserId_CreatedAt] ON [dbo].[ActivityLogs]([UserId],[CreatedAt]);
END;
IF OBJECT_ID(N'[dbo].[CustomerVisitLogs]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[CustomerVisitLogs]') AND name=N'IX_CustomerVisitLogs_CreatedAt') CREATE INDEX [IX_CustomerVisitLogs_CreatedAt] ON [dbo].[CustomerVisitLogs]([CreatedAt]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[CustomerVisitLogs]') AND name=N'IX_CustomerVisitLogs_SessionId_CreatedAt') CREATE INDEX [IX_CustomerVisitLogs_SessionId_CreatedAt] ON [dbo].[CustomerVisitLogs]([SessionId],[CreatedAt]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[CustomerVisitLogs]') AND name=N'IX_CustomerVisitLogs_CustomerId_CreatedAt') CREATE INDEX [IX_CustomerVisitLogs_CustomerId_CreatedAt] ON [dbo].[CustomerVisitLogs]([CustomerId],[CreatedAt]);
END;

IF OBJECT_ID(N'[dbo].[Customers]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Customers]') AND name=N'IX_Customers_Phone')
    BEGIN
        IF NOT EXISTS (SELECT Phone FROM [dbo].[Customers] GROUP BY Phone HAVING COUNT(*) > 1) CREATE UNIQUE INDEX [IX_Customers_Phone] ON [dbo].[Customers]([Phone]);
        ELSE CREATE INDEX [IX_Customers_Phone] ON [dbo].[Customers]([Phone]);
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Customers]') AND name=N'IX_Customers_Email')
    BEGIN
        IF NOT EXISTS (SELECT Email FROM [dbo].[Customers] WHERE Email IS NOT NULL GROUP BY Email HAVING COUNT(*) > 1) CREATE UNIQUE INDEX [IX_Customers_Email] ON [dbo].[Customers]([Email]) WHERE [Email] IS NOT NULL;
        ELSE CREATE INDEX [IX_Customers_Email] ON [dbo].[Customers]([Email]) WHERE [Email] IS NOT NULL;
    END;
END;

IF OBJECT_ID(N'[dbo].[Types]', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Types]') AND name=N'IX_Types_Group_Name')
BEGIN
    IF NOT EXISTS (SELECT [Group],[Name] FROM [dbo].[Types] GROUP BY [Group],[Name] HAVING COUNT(*) > 1) CREATE UNIQUE INDEX [IX_Types_Group_Name] ON [dbo].[Types]([Group],[Name]);
    ELSE CREATE INDEX [IX_Types_Group_Name] ON [dbo].[Types]([Group],[Name]);
END;

IF OBJECT_ID(N'[dbo].[Orders]', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Orders]') AND name=N'IX_Orders_OrderNumber')
BEGIN
    IF NOT EXISTS (SELECT OrderNumber FROM [dbo].[Orders] GROUP BY OrderNumber HAVING COUNT(*) > 1) CREATE UNIQUE INDEX [IX_Orders_OrderNumber] ON [dbo].[Orders]([OrderNumber]);
    ELSE CREATE INDEX [IX_Orders_OrderNumber] ON [dbo].[Orders]([OrderNumber]);
END;
IF OBJECT_ID(N'[dbo].[InventoryTransactions]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventoryTransactions]') AND name=N'IX_InventoryTransactions_IdempotencyKey')
BEGIN
    IF NOT EXISTS (SELECT IdempotencyKey FROM [dbo].[InventoryTransactions] WHERE IdempotencyKey IS NOT NULL GROUP BY IdempotencyKey HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_InventoryTransactions_IdempotencyKey] ON [dbo].[InventoryTransactions]([IdempotencyKey]) WHERE [IdempotencyKey] IS NOT NULL;
    ELSE CREATE INDEX [IX_InventoryTransactions_IdempotencyKey] ON [dbo].[InventoryTransactions]([IdempotencyKey]) WHERE [IdempotencyKey] IS NOT NULL;
END;
IF OBJECT_ID(N'[dbo].[InventoryTransactionLots]', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventoryTransactionLots]') AND name=N'IX_InventoryTransactionLots_LotNumber_CreatedAt')
    CREATE INDEX [IX_InventoryTransactionLots_LotNumber_CreatedAt] ON [dbo].[InventoryTransactionLots]([LotNumber],[CreatedAt]);

IF OBJECT_ID(N'[dbo].[InventoryLots]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventoryLots]') AND name=N'IX_InventoryLots_ExpiresAt_ActiveQuantity')
    CREATE INDEX [IX_InventoryLots_ExpiresAt_ActiveQuantity]
        ON [dbo].[InventoryLots]([ExpiresAt])
        INCLUDE ([Id],[ProductId],[WarehouseId],[BranchId],[LotNumber],[Quantity])
        WHERE [IsDeleted] = 0 AND [ExpiresAt] IS NOT NULL AND [Quantity] > 0;

IF OBJECT_ID(N'[dbo].[Products]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Products]') AND name=N'IX_Products_Barcode')
    BEGIN
        IF NOT EXISTS (SELECT Barcode FROM [dbo].[Products] WHERE Barcode IS NOT NULL GROUP BY Barcode HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_Products_Barcode] ON [dbo].[Products]([Barcode]) WHERE [Barcode] IS NOT NULL;
        ELSE CREATE INDEX [IX_Products_Barcode] ON [dbo].[Products]([Barcode]) WHERE [Barcode] IS NOT NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Products]') AND name=N'IX_Products_Slug')
    BEGIN
        IF NOT EXISTS (SELECT Slug FROM [dbo].[Products] WHERE Slug IS NOT NULL GROUP BY Slug HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_Products_Slug] ON [dbo].[Products]([Slug]) WHERE [Slug] IS NOT NULL;
        ELSE CREATE INDEX [IX_Products_Slug] ON [dbo].[Products]([Slug]) WHERE [Slug] IS NOT NULL;
    END;
END;

IF OBJECT_ID(N'[dbo].[ProductUnitConversions]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ProductUnitConversions]') AND name=N'IX_ProductUnitConversions_Barcode')
BEGIN
    IF NOT EXISTS (SELECT Barcode FROM [dbo].[ProductUnitConversions] WHERE Barcode IS NOT NULL AND IsDeleted = 0 GROUP BY Barcode HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_ProductUnitConversions_Barcode] ON [dbo].[ProductUnitConversions]([Barcode]) WHERE [Barcode] IS NOT NULL AND [IsDeleted] = 0;
    ELSE CREATE INDEX [IX_ProductUnitConversions_Barcode] ON [dbo].[ProductUnitConversions]([Barcode]) WHERE [Barcode] IS NOT NULL AND [IsDeleted] = 0;
END;

IF OBJECT_ID(N'[dbo].[Payments]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Payments]') AND name=N'IX_Payments_Provider_ExternalReference')
BEGIN
    IF NOT EXISTS (SELECT Provider, ExternalReference FROM [dbo].[Payments] WHERE ExternalReference IS NOT NULL GROUP BY Provider, ExternalReference HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_Payments_Provider_ExternalReference] ON [dbo].[Payments]([Provider],[ExternalReference]) WHERE [ExternalReference] IS NOT NULL;
    ELSE CREATE INDEX [IX_Payments_Provider_ExternalReference] ON [dbo].[Payments]([Provider],[ExternalReference]) WHERE [ExternalReference] IS NOT NULL;
END;

IF OBJECT_ID(N'[dbo].[ProductVariants]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ProductVariants]') AND name=N'IX_ProductVariants_Sku')
    BEGIN
        IF NOT EXISTS (SELECT Sku FROM [dbo].[ProductVariants] GROUP BY Sku HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_ProductVariants_Sku] ON [dbo].[ProductVariants]([Sku]);
        ELSE CREATE INDEX [IX_ProductVariants_Sku] ON [dbo].[ProductVariants]([Sku]);
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ProductVariants]') AND name=N'IX_ProductVariants_Barcode')
    BEGIN
        IF NOT EXISTS (SELECT Barcode FROM [dbo].[ProductVariants] WHERE Barcode IS NOT NULL GROUP BY Barcode HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_ProductVariants_Barcode] ON [dbo].[ProductVariants]([Barcode]) WHERE [Barcode] IS NOT NULL;
        ELSE CREATE INDEX [IX_ProductVariants_Barcode] ON [dbo].[ProductVariants]([Barcode]) WHERE [Barcode] IS NOT NULL;
    END;
END;

IF OBJECT_ID(N'[dbo].[Warehouses]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Warehouses]') AND name=N'IX_Warehouses_Code')
BEGIN
    IF NOT EXISTS (SELECT Code FROM [dbo].[Warehouses] GROUP BY Code HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_Warehouses_Code] ON [dbo].[Warehouses]([Code]);
    ELSE CREATE INDEX [IX_Warehouses_Code] ON [dbo].[Warehouses]([Code]);
END;

IF OBJECT_ID(N'[dbo].[Purchases]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Purchases]') AND name=N'IX_Purchases_PurchaseNumber')
    BEGIN
        IF NOT EXISTS (SELECT PurchaseNumber FROM [dbo].[Purchases] GROUP BY PurchaseNumber HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_Purchases_PurchaseNumber] ON [dbo].[Purchases]([PurchaseNumber]);
        ELSE CREATE INDEX [IX_Purchases_PurchaseNumber] ON [dbo].[Purchases]([PurchaseNumber]);
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Purchases]') AND name=N'IX_Purchases_ClientRequestId')
    BEGIN
        IF NOT EXISTS (SELECT ClientRequestId FROM [dbo].[Purchases] WHERE ClientRequestId IS NOT NULL GROUP BY ClientRequestId HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_Purchases_ClientRequestId] ON [dbo].[Purchases]([ClientRequestId]) WHERE [ClientRequestId] IS NOT NULL;
        ELSE CREATE INDEX [IX_Purchases_ClientRequestId] ON [dbo].[Purchases]([ClientRequestId]) WHERE [ClientRequestId] IS NOT NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[Purchases]') AND name=N'IX_Purchases_ReferenceNumber')
        CREATE INDEX [IX_Purchases_ReferenceNumber] ON [dbo].[Purchases]([ReferenceNumber]);
END;

IF OBJECT_ID(N'[dbo].[InventorySales]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventorySales]') AND name=N'IX_InventorySales_SaleNumber')
    BEGIN
        IF NOT EXISTS (SELECT SaleNumber FROM [dbo].[InventorySales] GROUP BY SaleNumber HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_InventorySales_SaleNumber] ON [dbo].[InventorySales]([SaleNumber]);
        ELSE CREATE INDEX [IX_InventorySales_SaleNumber] ON [dbo].[InventorySales]([SaleNumber]);
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventorySales]') AND name=N'IX_InventorySales_ClientRequestId')
    BEGIN
        IF NOT EXISTS (SELECT ClientRequestId FROM [dbo].[InventorySales] WHERE ClientRequestId IS NOT NULL GROUP BY ClientRequestId HAVING COUNT(*) > 1)
            CREATE UNIQUE INDEX [IX_InventorySales_ClientRequestId] ON [dbo].[InventorySales]([ClientRequestId]) WHERE [ClientRequestId] IS NOT NULL;
        ELSE CREATE INDEX [IX_InventorySales_ClientRequestId] ON [dbo].[InventorySales]([ClientRequestId]) WHERE [ClientRequestId] IS NOT NULL;
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[InventorySales]') AND name=N'IX_InventorySales_ReferenceNumber')
        CREATE INDEX [IX_InventorySales_ReferenceNumber] ON [dbo].[InventorySales]([ReferenceNumber]);
END;

IF OBJECT_ID(N'[dbo].[StaffMembers]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[StaffMembers]') AND name=N'IX_StaffMembers_EmployeeNumber')
BEGIN
    IF NOT EXISTS (SELECT EmployeeNumber FROM [dbo].[StaffMembers] GROUP BY EmployeeNumber HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_StaffMembers_EmployeeNumber] ON [dbo].[StaffMembers]([EmployeeNumber]);
    ELSE CREATE INDEX [IX_StaffMembers_EmployeeNumber] ON [dbo].[StaffMembers]([EmployeeNumber]);
END;

IF OBJECT_ID(N'[dbo].[StaffSalaryPayments]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[StaffSalaryPayments]') AND name=N'IX_StaffSalaryPayments_StaffId_PeriodYear_PeriodMonth')
BEGIN
    IF NOT EXISTS (SELECT StaffId, PeriodYear, PeriodMonth FROM [dbo].[StaffSalaryPayments] GROUP BY StaffId, PeriodYear, PeriodMonth HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_StaffSalaryPayments_StaffId_PeriodYear_PeriodMonth] ON [dbo].[StaffSalaryPayments]([StaffId],[PeriodYear],[PeriodMonth]);
    ELSE CREATE INDEX [IX_StaffSalaryPayments_StaffId_PeriodYear_PeriodMonth] ON [dbo].[StaffSalaryPayments]([StaffId],[PeriodYear],[PeriodMonth]);
END;

IF OBJECT_ID(N'[dbo].[ExpenseCategories]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[ExpenseCategories]') AND name=N'IX_ExpenseCategories_Name')
BEGIN
    IF NOT EXISTS (SELECT Name FROM [dbo].[ExpenseCategories] GROUP BY Name HAVING COUNT(*) > 1)
        CREATE UNIQUE INDEX [IX_ExpenseCategories_Name] ON [dbo].[ExpenseCategories]([Name]);
    ELSE CREATE INDEX [IX_ExpenseCategories_Name] ON [dbo].[ExpenseCategories]([Name]);
END;

IF OBJECT_ID(N'[dbo].[TrashRecords]', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'[dbo].[TrashRecords]') AND name=N'IX_TrashRecords_EntityType_EntityId_PurgedAt')
    CREATE INDEX [IX_TrashRecords_EntityType_EntityId_PurgedAt] ON [dbo].[TrashRecords]([EntityType],[EntityId],[PurgedAt]);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("The destructive single-company conversion cannot safely restore removed tenant and subscription data.");
}
