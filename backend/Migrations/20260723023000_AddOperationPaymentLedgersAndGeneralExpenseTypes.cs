using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723023000_AddOperationPaymentLedgersAndGeneralExpenseTypes")]
public sealed class AddOperationPaymentLedgersAndGeneralExpenseTypes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
ALTER TABLE [Expenses] DROP CONSTRAINT [FK_Expenses_ExpenseCategories_CategoryId];
ALTER TABLE [Expenses] ALTER COLUMN [CategoryId] bigint NULL;
ALTER TABLE [Expenses] ADD [GeneralTypeCategoryId] bigint NULL;
CREATE INDEX [IX_Expenses_GeneralTypeCategoryId] ON [Expenses]([GeneralTypeCategoryId]);
ALTER TABLE [Expenses] ADD CONSTRAINT [FK_Expenses_Types_GeneralTypeCategoryId]
    FOREIGN KEY ([GeneralTypeCategoryId]) REFERENCES [Types]([Id]) ON DELETE NO ACTION;

INSERT INTO [Types] ([Name], [Group], [SortOrder], [ParentId], [ImageUrl], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
SELECT ec.[Name], 5, ROW_NUMBER() OVER (ORDER BY ec.[Id]) - 1, NULL, NULL, SYSUTCDATETIME(), NULL, 0, NULL
FROM [ExpenseCategories] ec
WHERE ec.[IsDeleted] = 0
  AND NOT EXISTS (SELECT 1 FROM [Types] t WHERE t.[Group] = 5 AND t.[Name] = ec.[Name]);

UPDATE e SET e.[GeneralTypeCategoryId] = t.[Id]
FROM [Expenses] e
INNER JOIN [ExpenseCategories] ec ON ec.[Id] = e.[CategoryId]
INNER JOIN [Types] t ON t.[Group] = 5 AND t.[Name] = ec.[Name]
WHERE e.[GeneralTypeCategoryId] IS NULL;

INSERT INTO [Types] ([Name], [Group], [SortOrder], [ParentId], [ImageUrl], [CreatedAt], [UpdatedAt], [IsDeleted], [DeletedAt])
SELECT defaults.[Name], 5, defaults.[SortOrder], NULL, NULL, SYSUTCDATETIME(), NULL, 0, NULL
FROM (VALUES ('Rent',0),('Utilities',1),('Transport',2),('Office',3),('Other',4)) defaults([Name],[SortOrder])
WHERE NOT EXISTS (SELECT 1 FROM [Types] t WHERE t.[Group] = 5 AND t.[Name] = defaults.[Name]);

ALTER TABLE [StaffSalaryPayments] ADD [PaidAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_StaffSalaryPayments_PaidAmount] DEFAULT 0;
ALTER TABLE [StaffSalaryPayments] ADD [PaymentStatus] int NOT NULL CONSTRAINT [DF_StaffSalaryPayments_PaymentStatus] DEFAULT 1;

CREATE TABLE [PurchasePayments] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PurchasePayments] PRIMARY KEY,
    [PurchaseId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
    [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
    [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_PurchasePayments_Purchases_PurchaseId] FOREIGN KEY ([PurchaseId]) REFERENCES [Purchases]([Id]) ON DELETE CASCADE
);
CREATE INDEX [IX_PurchasePayments_PurchaseId_PaymentDate] ON [PurchasePayments]([PurchaseId],[PaymentDate]);

CREATE TABLE [InventorySalePayments] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySalePayments] PRIMARY KEY,
    [InventorySaleId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
    [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
    [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_InventorySalePayments_InventorySales_InventorySaleId] FOREIGN KEY ([InventorySaleId]) REFERENCES [InventorySales]([Id]) ON DELETE CASCADE
);
CREATE INDEX [IX_InventorySalePayments_InventorySaleId_PaymentDate] ON [InventorySalePayments]([InventorySaleId],[PaymentDate]);

CREATE TABLE [StaffSalaryInstallments] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StaffSalaryInstallments] PRIMARY KEY,
    [StaffSalaryPaymentId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL, [PaymentDate] date NOT NULL,
    [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL,
    [CreatedByUserId] nvarchar(max) NULL, [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL,
    [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_StaffSalaryInstallments_StaffSalaryPayments_StaffSalaryPaymentId] FOREIGN KEY ([StaffSalaryPaymentId]) REFERENCES [StaffSalaryPayments]([Id]) ON DELETE CASCADE
);
CREATE INDEX [IX_StaffSalaryInstallments_StaffSalaryPaymentId_PaymentDate] ON [StaffSalaryInstallments]([StaffSalaryPaymentId],[PaymentDate]);

INSERT INTO [PurchasePayments] ([PurchaseId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[PaidAmount],[PurchaseDate],'Legacy payment',[ReferenceNumber],'Migrated opening payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [Purchases] WHERE [PaidAmount] > 0;

INSERT INTO [InventorySalePayments] ([InventorySaleId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[PaidAmount],[SaleDate],[PaymentMethod],NULL,'Migrated opening payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [InventorySales] WHERE [PaidAmount] > 0;

UPDATE [StaffSalaryPayments] SET [PaidAmount] = [NetAmount], [PaymentStatus] = 3;
INSERT INTO [StaffSalaryInstallments] ([StaffSalaryPaymentId],[Amount],[PaymentDate],[PaymentMethod],[ReferenceNumber],[Notes],[CreatedByUserId],[CreatedAt],[UpdatedAt],[IsDeleted],[DeletedAt])
SELECT [Id],[NetAmount],[PaidDate],[PaymentMethod],[ReferenceNumber],'Migrated salary payment',[CreatedByUserId],[CreatedAt],NULL,0,NULL
FROM [StaffSalaryPayments] WHERE [NetAmount] > 0;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
DROP TABLE IF EXISTS [StaffSalaryInstallments];
DROP TABLE IF EXISTS [InventorySalePayments];
DROP TABLE IF EXISTS [PurchasePayments];
ALTER TABLE [StaffSalaryPayments] DROP CONSTRAINT [DF_StaffSalaryPayments_PaymentStatus];
ALTER TABLE [StaffSalaryPayments] DROP COLUMN [PaymentStatus];
ALTER TABLE [StaffSalaryPayments] DROP CONSTRAINT [DF_StaffSalaryPayments_PaidAmount];
ALTER TABLE [StaffSalaryPayments] DROP COLUMN [PaidAmount];
ALTER TABLE [Expenses] DROP CONSTRAINT [FK_Expenses_Types_GeneralTypeCategoryId];
DROP INDEX [IX_Expenses_GeneralTypeCategoryId] ON [Expenses];
ALTER TABLE [Expenses] DROP COLUMN [GeneralTypeCategoryId];
UPDATE [Expenses] SET [CategoryId] = (SELECT TOP 1 [Id] FROM [ExpenseCategories] ORDER BY [Id]) WHERE [CategoryId] IS NULL;
ALTER TABLE [Expenses] ALTER COLUMN [CategoryId] bigint NOT NULL;
ALTER TABLE [Expenses] ADD CONSTRAINT [FK_Expenses_ExpenseCategories_CategoryId]
    FOREIGN KEY ([CategoryId]) REFERENCES [ExpenseCategories]([Id]) ON DELETE NO ACTION;
""");
    }
}
