using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260817130000_AddProfessionalAccountingControls")]
public sealed class AddProfessionalAccountingControls : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF COL_LENGTH(N'dbo.CompanySettings', N'GeneralSalesDiscountPercent') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [GeneralSalesDiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_CompanySettings_GeneralSalesDiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.CompanySettings', N'MaximumCustomerDebt') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [MaximumCustomerDebt] decimal(18,2) NOT NULL CONSTRAINT [DF_CompanySettings_MaximumCustomerDebt] DEFAULT(300000);
IF COL_LENGTH(N'dbo.CompanySettings', N'DefaultDebtDueDays') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [DefaultDebtDueDays] int NOT NULL CONSTRAINT [DF_CompanySettings_DefaultDebtDueDays] DEFAULT(30);
IF COL_LENGTH(N'dbo.CompanySettings', N'AllowNegativeStockSales') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [AllowNegativeStockSales] bit NOT NULL CONSTRAINT [DF_CompanySettings_AllowNegativeStockSales] DEFAULT(0);
IF COL_LENGTH(N'dbo.CompanySettings', N'PurchaseNumberPrefix') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [PurchaseNumberPrefix] nvarchar(12) NOT NULL CONSTRAINT [DF_CompanySettings_PurchaseNumberPrefix] DEFAULT(N'PUR');
IF COL_LENGTH(N'dbo.CompanySettings', N'NextPurchaseNumber') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [NextPurchaseNumber] bigint NOT NULL CONSTRAINT [DF_CompanySettings_NextPurchaseNumber] DEFAULT(1);
IF COL_LENGTH(N'dbo.CompanySettings', N'PurchaseNumberIncrement') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [PurchaseNumberIncrement] int NOT NULL CONSTRAINT [DF_CompanySettings_PurchaseNumberIncrement] DEFAULT(1);
IF COL_LENGTH(N'dbo.CompanySettings', N'SaleNumberPrefix') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [SaleNumberPrefix] nvarchar(12) NOT NULL CONSTRAINT [DF_CompanySettings_SaleNumberPrefix] DEFAULT(N'SAL');
IF COL_LENGTH(N'dbo.CompanySettings', N'NextSaleNumber') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [NextSaleNumber] bigint NOT NULL CONSTRAINT [DF_CompanySettings_NextSaleNumber] DEFAULT(1);
IF COL_LENGTH(N'dbo.CompanySettings', N'SaleNumberIncrement') IS NULL ALTER TABLE [dbo].[CompanySettings] ADD [SaleNumberIncrement] int NOT NULL CONSTRAINT [DF_CompanySettings_SaleNumberIncrement] DEFAULT(1);

IF COL_LENGTH(N'dbo.Customers', N'AccountCredit') IS NULL ALTER TABLE [dbo].[Customers] ADD [AccountCredit] decimal(18,2) NOT NULL CONSTRAINT [DF_Customers_AccountCredit] DEFAULT(0);
IF COL_LENGTH(N'dbo.Customers', N'CreditLimit') IS NULL ALTER TABLE [dbo].[Customers] ADD [CreditLimit] decimal(18,2) NULL;
IF COL_LENGTH(N'dbo.Customers', N'DebtDueDays') IS NULL ALTER TABLE [dbo].[Customers] ADD [DebtDueDays] int NULL;
IF COL_LENGTH(N'dbo.Products', N'GenericName') IS NULL ALTER TABLE [dbo].[Products] ADD [GenericName] nvarchar(200) NULL;
IF COL_LENGTH(N'dbo.Products', N'Formula') IS NULL ALTER TABLE [dbo].[Products] ADD [Formula] nvarchar(500) NULL;

IF COL_LENGTH(N'dbo.Purchases', N'DiscountPercent') IS NULL ALTER TABLE [dbo].[Purchases] ADD [DiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_Purchases_DiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.Purchases', N'SecondaryDiscountPercent') IS NULL ALTER TABLE [dbo].[Purchases] ADD [SecondaryDiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_Purchases_SecondaryDiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.PurchaseItems', N'BonusQuantity') IS NULL ALTER TABLE [dbo].[PurchaseItems] ADD [BonusQuantity] decimal(18,3) NOT NULL CONSTRAINT [DF_PurchaseItems_BonusQuantity] DEFAULT(0);
IF COL_LENGTH(N'dbo.PurchaseItems', N'DiscountPercent') IS NULL ALTER TABLE [dbo].[PurchaseItems] ADD [DiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_PurchaseItems_DiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.PurchaseItems', N'SecondaryDiscountPercent') IS NULL ALTER TABLE [dbo].[PurchaseItems] ADD [SecondaryDiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_PurchaseItems_SecondaryDiscountPercent] DEFAULT(0);

IF COL_LENGTH(N'dbo.InventorySales', N'DiscountPercent') IS NULL ALTER TABLE [dbo].[InventorySales] ADD [DiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_InventorySales_DiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySales', N'SecondaryDiscountPercent') IS NULL ALTER TABLE [dbo].[InventorySales] ADD [SecondaryDiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_InventorySales_SecondaryDiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySales', N'DebtDueDate') IS NULL ALTER TABLE [dbo].[InventorySales] ADD [DebtDueDate] date NULL;
IF COL_LENGTH(N'dbo.InventorySales', N'CustomerCreditApplied') IS NULL ALTER TABLE [dbo].[InventorySales] ADD [CustomerCreditApplied] decimal(18,2) NOT NULL CONSTRAINT [DF_InventorySales_CustomerCreditApplied] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySales', N'CustomerCreditCreated') IS NULL ALTER TABLE [dbo].[InventorySales] ADD [CustomerCreditCreated] decimal(18,2) NOT NULL CONSTRAINT [DF_InventorySales_CustomerCreditCreated] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySaleItems', N'BonusQuantity') IS NULL ALTER TABLE [dbo].[InventorySaleItems] ADD [BonusQuantity] decimal(18,3) NOT NULL CONSTRAINT [DF_InventorySaleItems_BonusQuantity] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySaleItems', N'DiscountPercent') IS NULL ALTER TABLE [dbo].[InventorySaleItems] ADD [DiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_InventorySaleItems_DiscountPercent] DEFAULT(0);
IF COL_LENGTH(N'dbo.InventorySaleItems', N'SecondaryDiscountPercent') IS NULL ALTER TABLE [dbo].[InventorySaleItems] ADD [SecondaryDiscountPercent] decimal(5,2) NOT NULL CONSTRAINT [DF_InventorySaleItems_SecondaryDiscountPercent] DEFAULT(0);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InventorySales_CustomerId_DebtDueDate')
    CREATE INDEX [IX_InventorySales_CustomerId_DebtDueDate] ON [dbo].[InventorySales]([CustomerId], [DebtDueDate]) INCLUDE ([Total], [PaidAmount]);

IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[JournalVouchers](
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_JournalVouchers] PRIMARY KEY,
        [BranchId] bigint NULL,
        [VoucherNumber] nvarchar(50) NOT NULL,
        [VoucherDate] date NOT NULL,
        [CurrencyCode] nvarchar(10) NOT NULL,
        [Memo] nvarchar(1000) NOT NULL,
        [TotalDebit] decimal(18,2) NOT NULL,
        [TotalCredit] decimal(18,2) NOT NULL,
        [CreatedByUserId] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAt] datetime2 NULL
    );
    CREATE UNIQUE INDEX [IX_JournalVouchers_VoucherNumber] ON [dbo].[JournalVouchers]([VoucherNumber]);
    CREATE INDEX [IX_JournalVouchers_VoucherDate] ON [dbo].[JournalVouchers]([VoucherDate]);
END;

IF OBJECT_ID(N'[dbo].[JournalVoucherLines]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[JournalVoucherLines](
        [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_JournalVoucherLines] PRIMARY KEY,
        [BranchId] bigint NULL,
        [JournalVoucherId] bigint NOT NULL,
        [AccountCode] nvarchar(50) NOT NULL,
        [AccountName] nvarchar(180) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Debit] decimal(18,2) NOT NULL,
        [Credit] decimal(18,2) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [IsDeleted] bit NOT NULL,
        [DeletedAt] datetime2 NULL,
        CONSTRAINT [FK_JournalVoucherLines_JournalVouchers_JournalVoucherId] FOREIGN KEY ([JournalVoucherId]) REFERENCES [dbo].[JournalVouchers]([Id]) ON DELETE CASCADE,
        CONSTRAINT [CK_JournalVoucherLine_DebitCredit] CHECK (([Debit] > 0 AND [Credit] = 0) OR ([Credit] > 0 AND [Debit] = 0))
    );
    CREATE INDEX [IX_JournalVoucherLines_JournalVoucherId_AccountCode] ON [dbo].[JournalVoucherLines]([JournalVoucherId], [AccountCode]);
END;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InventorySales_CustomerId_DebtDueDate') DROP INDEX [IX_InventorySales_CustomerId_DebtDueDate] ON [dbo].[InventorySales];
IF OBJECT_ID(N'[dbo].[JournalVoucherLines]', N'U') IS NOT NULL DROP TABLE [dbo].[JournalVoucherLines];
IF OBJECT_ID(N'[dbo].[JournalVouchers]', N'U') IS NOT NULL DROP TABLE [dbo].[JournalVouchers];
""");
        migrationBuilder.DropColumn(name: "SecondaryDiscountPercent", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "DiscountPercent", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "BonusQuantity", table: "InventorySaleItems");
        migrationBuilder.DropColumn(name: "CustomerCreditCreated", table: "InventorySales");
        migrationBuilder.DropColumn(name: "CustomerCreditApplied", table: "InventorySales");
        migrationBuilder.DropColumn(name: "DebtDueDate", table: "InventorySales");
        migrationBuilder.DropColumn(name: "SecondaryDiscountPercent", table: "InventorySales");
        migrationBuilder.DropColumn(name: "DiscountPercent", table: "InventorySales");
        migrationBuilder.DropColumn(name: "SecondaryDiscountPercent", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "DiscountPercent", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "BonusQuantity", table: "PurchaseItems");
        migrationBuilder.DropColumn(name: "SecondaryDiscountPercent", table: "Purchases");
        migrationBuilder.DropColumn(name: "DiscountPercent", table: "Purchases");
        migrationBuilder.DropColumn(name: "DebtDueDays", table: "Customers");
        migrationBuilder.DropColumn(name: "CreditLimit", table: "Customers");
        migrationBuilder.DropColumn(name: "AccountCredit", table: "Customers");
        migrationBuilder.DropColumn(name: "Formula", table: "Products");
        migrationBuilder.DropColumn(name: "GenericName", table: "Products");
        migrationBuilder.DropColumn(name: "SaleNumberIncrement", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "NextSaleNumber", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "SaleNumberPrefix", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "PurchaseNumberIncrement", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "NextPurchaseNumber", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "PurchaseNumberPrefix", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "AllowNegativeStockSales", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "DefaultDebtDueDays", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "MaximumCustomerDebt", table: "CompanySettings");
        migrationBuilder.DropColumn(name: "GeneralSalesDiscountPercent", table: "CompanySettings");
    }
}
