using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260724120000_AddMultiTenantPlatform")]
public sealed class AddMultiTenantPlatform : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Tenants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Tenants]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Tenants] PRIMARY KEY,
        [Name] nvarchar(160) NOT NULL,
        [Slug] nvarchar(100) NOT NULL,
        [LegalName] nvarchar(200) NULL,
        [RegistrationNumber] nvarchar(40) NULL,
        [Email] nvarchar(256) NULL,
        [Phone] nvarchar(40) NULL,
        [Address] nvarchar(500) NULL,
        [LogoUrl] nvarchar(2048) NULL,
        [FaviconUrl] nvarchar(2048) NULL,
        [IsActive] bit NOT NULL CONSTRAINT [DF_Tenants_IsActive] DEFAULT(1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Tenants_CreatedAt] DEFAULT(SYSUTCDATETIME()),
        [UpdatedAt] datetime2 NULL
    );
    CREATE UNIQUE INDEX [IX_Tenants_Slug] ON [dbo].[Tenants]([Slug]);
END;
""");

        migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM [dbo].[Tenants] WHERE [Id] = 1)
BEGIN
    SET IDENTITY_INSERT [dbo].[Tenants] ON;
    INSERT INTO [dbo].[Tenants] ([Id],[Name],[Slug],[LegalName],[IsActive],[CreatedAt])
    VALUES (1,N'Default Company',N'default',N'Default Company',1,SYSUTCDATETIME());
    SET IDENTITY_INSERT [dbo].[Tenants] OFF;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[Branches]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Branches]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Branches] PRIMARY KEY,
        [TenantId] bigint NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Code] nvarchar(40) NOT NULL,
        [Phone] nvarchar(40) NULL,
        [Address] nvarchar(500) NULL,
        [IsMain] bit NOT NULL CONSTRAINT [DF_Branches_IsMain] DEFAULT(0),
        [IsActive] bit NOT NULL CONSTRAINT [DF_Branches_IsActive] DEFAULT(1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_Branches_CreatedAt] DEFAULT(SYSUTCDATETIME()),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [FK_Branches_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [IX_Branches_TenantId_Code] ON [dbo].[Branches]([TenantId],[Code]);
END;
""");

        migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM [dbo].[Branches] WHERE [Id] = 1)
BEGIN
    SET IDENTITY_INSERT [dbo].[Branches] ON;
    INSERT INTO [dbo].[Branches] ([Id],[TenantId],[Name],[Code],[IsMain],[IsActive],[CreatedAt])
    VALUES (1,1,N'Main Branch',N'MAIN',1,1,SYSUTCDATETIME());
    SET IDENTITY_INSERT [dbo].[Branches] OFF;
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TenantSettings]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantSettings] PRIMARY KEY,
        [TenantId] bigint NOT NULL,
        [MainCurrencyCode] nvarchar(3) NOT NULL CONSTRAINT [DF_TenantSettings_Currency] DEFAULT(N'USD'),
        [CurrencySymbol] nvarchar(8) NOT NULL CONSTRAINT [DF_TenantSettings_Symbol] DEFAULT(N'$'),
        [CurrencyPosition] nvarchar(10) NOT NULL CONSTRAINT [DF_TenantSettings_Position] DEFAULT(N'before'),
        [CurrencyDecimalPlaces] int NOT NULL CONSTRAINT [DF_TenantSettings_Decimals] DEFAULT(2),
        [AdminPrimaryColor] nvarchar(20) NOT NULL CONSTRAINT [DF_TenantSettings_AdminPrimary] DEFAULT(N'#2563eb'),
        [AdminSecondaryColor] nvarchar(20) NOT NULL CONSTRAINT [DF_TenantSettings_AdminSecondary] DEFAULT(N'#0f172a'),
        [StorefrontPrimaryColor] nvarchar(20) NOT NULL CONSTRAINT [DF_TenantSettings_WebPrimary] DEFAULT(N'#2563eb'),
        [StorefrontSecondaryColor] nvarchar(20) NOT NULL CONSTRAINT [DF_TenantSettings_WebSecondary] DEFAULT(N'#0f172a'),
        [EnglishFontFamily] nvarchar(120) NOT NULL CONSTRAINT [DF_TenantSettings_EnglishFont] DEFAULT(N'Inter'),
        [DariFontFamily] nvarchar(120) NOT NULL CONSTRAINT [DF_TenantSettings_DariFont] DEFAULT(N'Vazirmatn'),
        [PashtoFontFamily] nvarchar(120) NOT NULL CONSTRAINT [DF_TenantSettings_PashtoFont] DEFAULT(N'Noto Sans Arabic'),
        [BaseFontSize] int NOT NULL CONSTRAINT [DF_TenantSettings_BaseFontSize] DEFAULT(16),
        [TrashRetentionDays] int NOT NULL CONSTRAINT [DF_TenantSettings_TrashRetention] DEFAULT(30),
        [AllowTenantUserClaimManagement] bit NOT NULL CONSTRAINT [DF_TenantSettings_Claims] DEFAULT(1),
        [UpdatedAt] datetime2 NOT NULL CONSTRAINT [DF_TenantSettings_UpdatedAt] DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT [FK_TenantSettings_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [IX_TenantSettings_TenantId] ON [dbo].[TenantSettings]([TenantId]);
END;
IF NOT EXISTS (SELECT 1 FROM [dbo].[TenantSettings] WHERE [TenantId] = 1)
    INSERT INTO [dbo].[TenantSettings] ([TenantId]) VALUES (1);
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantSubscriptions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TenantSubscriptions]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantSubscriptions] PRIMARY KEY,
        [TenantId] bigint NOT NULL,
        [Plan] int NOT NULL,
        [Status] int NOT NULL,
        [StartsAt] datetime2 NOT NULL,
        [EndsAt] datetime2 NULL,
        [MaxUsers] int NOT NULL,
        [MaxBranches] int NOT NULL,
        [MaxProducts] int NOT NULL,
        [MonthlyPrice] decimal(18,2) NOT NULL CONSTRAINT [DF_TenantSubscriptions_MonthlyPrice] DEFAULT(0),
        [BillingCurrencyCode] nvarchar(3) NOT NULL CONSTRAINT [DF_TenantSubscriptions_Currency] DEFAULT(N'USD'),
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_TenantSubscriptions_CreatedAt] DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT [FK_TenantSubscriptions_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_TenantSubscriptions_TenantId_Status] ON [dbo].[TenantSubscriptions]([TenantId],[Status]);
END;
IF NOT EXISTS (SELECT 1 FROM [dbo].[TenantSubscriptions] WHERE [TenantId] = 1)
    INSERT INTO [dbo].[TenantSubscriptions] ([TenantId],[Plan],[Status],[StartsAt],[MaxUsers],[MaxBranches],[MaxProducts])
    VALUES (1,3,2,SYSUTCDATETIME(),1000,100,1000000);
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TenantPermissionGrants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TenantPermissionGrants]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TenantPermissionGrants] PRIMARY KEY,
        [TenantId] bigint NOT NULL,
        [Permission] nvarchar(160) NOT NULL,
        [IsEnabled] bit NOT NULL CONSTRAINT [DF_TenantPermissionGrants_IsEnabled] DEFAULT(1),
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_TenantPermissionGrants_CreatedAt] DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT [FK_TenantPermissionGrants_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX [IX_TenantPermissionGrants_TenantId_Permission] ON [dbo].[TenantPermissionGrants]([TenantId],[Permission]);
END;
""");

        migrationBuilder.Sql("""
IF OBJECT_ID(N'[dbo].[TrashRecords]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TrashRecords]
    (
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TrashRecords] PRIMARY KEY,
        [TenantId] bigint NOT NULL,
        [BranchId] bigint NULL,
        [EntityType] nvarchar(160) NOT NULL,
        [EntityId] nvarchar(160) NOT NULL,
        [DisplayName] nvarchar(300) NOT NULL,
        [DeletedByUserId] nvarchar(120) NULL,
        [DeletedByName] nvarchar(180) NULL,
        [SnapshotJson] nvarchar(max) NULL,
        [RestoredAt] datetime2 NULL,
        [RestoredByUserId] nvarchar(120) NULL,
        [PurgedAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT [DF_TrashRecords_IsDeleted] DEFAULT(0),
        [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_TrashRecords_Tenants_TenantId] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants]([Id]),
        CONSTRAINT [FK_TrashRecords_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([Id])
    );
    CREATE INDEX [IX_TrashRecords_TenantId_EntityType_EntityId_PurgedAt]
        ON [dbo].[TrashRecords]([TenantId],[EntityType],[EntityId],[PurgedAt]);
END;
""");

        migrationBuilder.Sql("""
DECLARE @tables TABLE([Name] sysname NOT NULL);
INSERT INTO @tables([Name]) VALUES
(N'ActivityLogs'),(N'CustomerAddresses'),(N'Customers'),(N'ExpenseCategories'),(N'Expenses'),
(N'InventoryLots'),(N'InventorySaleItems'),(N'InventorySalePayments'),(N'InventorySales'),(N'InventoryTransactions'),
(N'Notifications'),(N'OrderItems'),(N'OrderStatusHistories'),(N'Orders'),(N'Payments'),
(N'ProductImages'),(N'ProductInventories'),(N'ProductPrices'),(N'ProductReviews'),(N'ProductVariants'),(N'Products'),
(N'PurchaseItems'),(N'PurchasePayments'),(N'Purchases'),(N'StaffMembers'),(N'StaffSalaryInstallments'),(N'StaffSalaryPayments'),
(N'StorefrontContents'),(N'Suppliers'),(N'Types'),(N'Warehouses');

DECLARE @table sysname, @sql nvarchar(max);
DECLARE tenant_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT [Name] FROM @tables;
OPEN tenant_cursor;
FETCH NEXT FROM tenant_cursor INTO @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'[dbo].[' + @table + N']', N'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH(N'dbo.' + @table, N'TenantId') IS NULL
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @table + N'] ADD [TenantId] bigint NOT NULL CONSTRAINT [DF_' + @table + N'_TenantId] DEFAULT(1) WITH VALUES;';
            EXEC sp_executesql @sql;
        END;
        IF COL_LENGTH(N'dbo.' + @table, N'BranchId') IS NULL
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @table + N'] ADD [BranchId] bigint NULL;';
            EXEC sp_executesql @sql;
        END;
        SET @sql = N'UPDATE [dbo].[' + @table + N'] SET [TenantId] = 1 WHERE [TenantId] IS NULL OR [TenantId] = 0; UPDATE [dbo].[' + @table + N'] SET [BranchId] = 1 WHERE [BranchId] IS NULL;';
        EXEC sp_executesql @sql;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[' + @table + N']') AND name = N'IX_' + @table + N'_TenantId')
        BEGIN
            SET @sql = N'CREATE INDEX [IX_' + @table + N'_TenantId] ON [dbo].[' + @table + N']([TenantId]);';
            EXEC sp_executesql @sql;
        END;
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[' + @table + N']') AND name = N'IX_' + @table + N'_BranchId')
        BEGIN
            SET @sql = N'CREATE INDEX [IX_' + @table + N'_BranchId] ON [dbo].[' + @table + N']([BranchId]);';
            EXEC sp_executesql @sql;
        END;
    END;
    FETCH NEXT FROM tenant_cursor INTO @table;
END;
CLOSE tenant_cursor;
DEALLOCATE tenant_cursor;
""");

        // Keep schema creation and column-dependent statements in separate SQL batches.
        // SQL Server compiles an entire batch before executing ALTER TABLE, so combining
        // these statements can produce "Invalid column name" on existing databases.
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.AspNetUsers', N'TenantId') IS NULL
    ALTER TABLE [dbo].[AspNetUsers] ADD [TenantId] bigint NOT NULL CONSTRAINT [DF_AspNetUsers_TenantId] DEFAULT(1) WITH VALUES;
IF COL_LENGTH(N'dbo.AspNetUsers', N'BranchId') IS NULL
    ALTER TABLE [dbo].[AspNetUsers] ADD [BranchId] bigint NULL;
IF COL_LENGTH(N'dbo.AspNetRoles', N'TenantId') IS NULL
    ALTER TABLE [dbo].[AspNetRoles] ADD [TenantId] bigint NULL;
""");

        migrationBuilder.Sql("""
UPDATE [dbo].[AspNetUsers] SET [TenantId] = 1 WHERE [TenantId] IS NULL OR [TenantId] = 0;
UPDATE [dbo].[AspNetUsers] SET [BranchId] = 1 WHERE [BranchId] IS NULL;
""");

        migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = N'IX_AspNetUsers_TenantId_NormalizedEmail')
    CREATE INDEX [IX_AspNetUsers_TenantId_NormalizedEmail] ON [dbo].[AspNetUsers]([TenantId],[NormalizedEmail]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = N'IX_AspNetUsers_BranchId')
    CREATE INDEX [IX_AspNetUsers_BranchId] ON [dbo].[AspNetUsers]([BranchId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[AspNetRoles]') AND name = N'IX_AspNetRoles_TenantId')
    CREATE INDEX [IX_AspNetRoles_TenantId] ON [dbo].[AspNetRoles]([TenantId]);
""");

        migrationBuilder.Sql("""
DECLARE @currencyTables TABLE([Name] sysname NOT NULL);
INSERT INTO @currencyTables([Name]) VALUES (N'Purchases'),(N'InventorySales'),(N'StaffSalaryPayments'),(N'Expenses');
DECLARE @currencyTable sysname, @currencySql nvarchar(max);
DECLARE currency_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT [Name] FROM @currencyTables;
OPEN currency_cursor;
FETCH NEXT FROM currency_cursor INTO @currencyTable;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'[dbo].[' + @currencyTable + N']', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @currencyTable, N'CurrencyCode') IS NULL
    BEGIN
        SET @currencySql = N'ALTER TABLE [dbo].[' + @currencyTable + N'] ADD [CurrencyCode] nvarchar(3) NOT NULL CONSTRAINT [DF_' + @currencyTable + N'_CurrencyCode] DEFAULT(N''USD'') WITH VALUES;';
        EXEC sp_executesql @currencySql;
    END;
    FETCH NEXT FROM currency_cursor INTO @currencyTable;
END;
CLOSE currency_cursor;
DEALLOCATE currency_cursor;
""");

        migrationBuilder.Sql("""
DECLARE @tables TABLE([Name] sysname NOT NULL);
INSERT INTO @tables([Name]) VALUES
(N'ActivityLogs'),(N'CustomerAddresses'),(N'Customers'),(N'ExpenseCategories'),(N'Expenses'),
(N'InventoryLots'),(N'InventorySaleItems'),(N'InventorySalePayments'),(N'InventorySales'),(N'InventoryTransactions'),
(N'Notifications'),(N'OrderItems'),(N'OrderStatusHistories'),(N'Orders'),(N'Payments'),
(N'ProductImages'),(N'ProductInventories'),(N'ProductPrices'),(N'ProductReviews'),(N'ProductVariants'),(N'Products'),
(N'PurchaseItems'),(N'PurchasePayments'),(N'Purchases'),(N'StaffMembers'),(N'StaffSalaryInstallments'),(N'StaffSalaryPayments'),
(N'StorefrontContents'),(N'Suppliers'),(N'Types'),(N'Warehouses');
DECLARE @table sysname, @sql nvarchar(max), @fk sysname;
DECLARE fk_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT [Name] FROM @tables;
OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @table;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'[dbo].[' + @table + N']', N'U') IS NOT NULL
    BEGIN
        SET @fk = N'FK_' + @table + N'_Tenants_TenantId';
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[dbo].[' + @table + N']') AND name = @fk)
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @table + N'] WITH CHECK ADD CONSTRAINT [' + @fk + N'] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants]([Id]);';
            EXEC sp_executesql @sql;
        END;
        SET @fk = N'FK_' + @table + N'_Branches_BranchId';
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[dbo].[' + @table + N']') AND name = @fk)
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @table + N'] WITH CHECK ADD CONSTRAINT [' + @fk + N'] FOREIGN KEY([BranchId]) REFERENCES [dbo].[Branches]([Id]);';
            EXEC sp_executesql @sql;
        END;
    END;
    FETCH NEXT FROM fk_cursor INTO @table;
END;
CLOSE fk_cursor;
DEALLOCATE fk_cursor;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = N'FK_AspNetUsers_Tenants_TenantId')
    ALTER TABLE [dbo].[AspNetUsers] WITH CHECK ADD CONSTRAINT [FK_AspNetUsers_Tenants_TenantId] FOREIGN KEY([TenantId]) REFERENCES [dbo].[Tenants]([Id]);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'[dbo].[AspNetUsers]') AND name = N'FK_AspNetUsers_Branches_BranchId')
    ALTER TABLE [dbo].[AspNetUsers] WITH CHECK ADD CONSTRAINT [FK_AspNetUsers_Branches_BranchId] FOREIGN KEY([BranchId]) REFERENCES [dbo].[Branches]([Id]);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Multi-tenancy is a data-boundary migration. Rollback is intentionally non-destructive.
    }
}
