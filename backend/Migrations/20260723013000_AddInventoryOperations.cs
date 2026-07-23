using ECommerce.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260723013000_AddInventoryOperations")]
public sealed class AddInventoryOperations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
CREATE TABLE [Suppliers] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Suppliers] PRIMARY KEY,
    [Name] nvarchar(180) NOT NULL, [ContactPerson] nvarchar(150) NULL, [Phone] nvarchar(40) NULL,
    [Email] nvarchar(256) NULL, [Address] nvarchar(max) NULL, [TaxNumber] nvarchar(80) NULL, [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL
);
CREATE INDEX [IX_Suppliers_Name] ON [Suppliers]([Name]);

CREATE TABLE [Purchases] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Purchases] PRIMARY KEY,
    [PurchaseNumber] nvarchar(50) NOT NULL, [SupplierId] bigint NULL, [PurchaseDate] date NOT NULL,
    [Status] int NOT NULL, [PaymentStatus] int NOT NULL,
    [Subtotal] decimal(18,2) NOT NULL, [Discount] decimal(18,2) NOT NULL, [Tax] decimal(18,2) NOT NULL,
    [OtherCost] decimal(18,2) NOT NULL, [Total] decimal(18,2) NOT NULL, [PaidAmount] decimal(18,2) NOT NULL,
    [ReferenceNumber] nvarchar(100) NULL, [Notes] nvarchar(max) NULL, [CreatedByUserId] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_Purchases_Suppliers_SupplierId] FOREIGN KEY ([SupplierId]) REFERENCES [Suppliers]([Id]) ON DELETE NO ACTION
);
CREATE UNIQUE INDEX [IX_Purchases_PurchaseNumber] ON [Purchases]([PurchaseNumber]);
CREATE INDEX [IX_Purchases_PurchaseDate] ON [Purchases]([PurchaseDate]);
CREATE INDEX [IX_Purchases_SupplierId] ON [Purchases]([SupplierId]);

CREATE TABLE [PurchaseItems] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_PurchaseItems] PRIMARY KEY,
    [PurchaseId] bigint NOT NULL, [ProductId] bigint NOT NULL, [Quantity] decimal(18,3) NOT NULL,
    [UnitCost] decimal(18,2) NOT NULL, [LineTotal] decimal(18,2) NOT NULL, [LotNumber] nvarchar(100) NULL, [ExpireDate] date NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_PurchaseItems_Purchases_PurchaseId] FOREIGN KEY ([PurchaseId]) REFERENCES [Purchases]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_PurchaseItems_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products]([Id]) ON DELETE NO ACTION
);
CREATE INDEX [IX_PurchaseItems_PurchaseId] ON [PurchaseItems]([PurchaseId]);
CREATE INDEX [IX_PurchaseItems_ProductId] ON [PurchaseItems]([ProductId]);

CREATE TABLE [InventorySales] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySales] PRIMARY KEY,
    [SaleNumber] nvarchar(50) NOT NULL, [CustomerId] bigint NULL, [CustomerName] nvarchar(180) NULL, [CustomerPhone] nvarchar(40) NULL,
    [SaleDate] date NOT NULL, [PaymentStatus] int NOT NULL, [PaymentMethod] nvarchar(50) NOT NULL,
    [Subtotal] decimal(18,2) NOT NULL, [Discount] decimal(18,2) NOT NULL, [Tax] decimal(18,2) NOT NULL,
    [Total] decimal(18,2) NOT NULL, [PaidAmount] decimal(18,2) NOT NULL, [Notes] nvarchar(max) NULL, [CreatedByUserId] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_InventorySales_Customers_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [Customers]([Id]) ON DELETE NO ACTION
);
CREATE UNIQUE INDEX [IX_InventorySales_SaleNumber] ON [InventorySales]([SaleNumber]);
CREATE INDEX [IX_InventorySales_SaleDate] ON [InventorySales]([SaleDate]);
CREATE INDEX [IX_InventorySales_CustomerId] ON [InventorySales]([CustomerId]);

CREATE TABLE [InventorySaleItems] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventorySaleItems] PRIMARY KEY,
    [InventorySaleId] bigint NOT NULL, [ProductId] bigint NOT NULL, [Quantity] decimal(18,3) NOT NULL,
    [UnitPrice] decimal(18,2) NOT NULL, [LineTotal] decimal(18,2) NOT NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_InventorySaleItems_InventorySales_InventorySaleId] FOREIGN KEY ([InventorySaleId]) REFERENCES [InventorySales]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_InventorySaleItems_Products_ProductId] FOREIGN KEY ([ProductId]) REFERENCES [Products]([Id]) ON DELETE NO ACTION
);
CREATE INDEX [IX_InventorySaleItems_InventorySaleId] ON [InventorySaleItems]([InventorySaleId]);
CREATE INDEX [IX_InventorySaleItems_ProductId] ON [InventorySaleItems]([ProductId]);

CREATE TABLE [StaffMembers] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StaffMembers] PRIMARY KEY,
    [EmployeeNumber] nvarchar(50) NOT NULL, [FullName] nvarchar(180) NOT NULL, [Phone] nvarchar(40) NULL,
    [Email] nvarchar(256) NULL, [Position] nvarchar(120) NULL, [Department] nvarchar(120) NULL, [HireDate] date NOT NULL,
    [BaseSalary] decimal(18,2) NOT NULL, [IsActive] bit NOT NULL, [Address] nvarchar(max) NULL, [Notes] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL
);
CREATE UNIQUE INDEX [IX_StaffMembers_EmployeeNumber] ON [StaffMembers]([EmployeeNumber]);
CREATE INDEX [IX_StaffMembers_IsActive] ON [StaffMembers]([IsActive]);

CREATE TABLE [StaffSalaryPayments] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_StaffSalaryPayments] PRIMARY KEY,
    [StaffId] bigint NOT NULL, [PeriodYear] int NOT NULL, [PeriodMonth] int NOT NULL,
    [BaseSalary] decimal(18,2) NOT NULL, [Bonus] decimal(18,2) NOT NULL, [Deduction] decimal(18,2) NOT NULL, [NetAmount] decimal(18,2) NOT NULL,
    [PaidDate] date NOT NULL, [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL,
    [Notes] nvarchar(max) NULL, [CreatedByUserId] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_StaffSalaryPayments_StaffMembers_StaffId] FOREIGN KEY ([StaffId]) REFERENCES [StaffMembers]([Id]) ON DELETE NO ACTION
);
CREATE UNIQUE INDEX [IX_StaffSalaryPayments_StaffId_PeriodYear_PeriodMonth] ON [StaffSalaryPayments]([StaffId],[PeriodYear],[PeriodMonth]);
CREATE INDEX [IX_StaffSalaryPayments_PaidDate] ON [StaffSalaryPayments]([PaidDate]);

CREATE TABLE [ExpenseCategories] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_ExpenseCategories] PRIMARY KEY,
    [Name] nvarchar(150) NOT NULL, [Description] nvarchar(max) NULL, [IsActive] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL
);
CREATE UNIQUE INDEX [IX_ExpenseCategories_Name] ON [ExpenseCategories]([Name]);

CREATE TABLE [Expenses] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Expenses] PRIMARY KEY,
    [ExpenseDate] date NOT NULL, [CategoryId] bigint NOT NULL, [Amount] decimal(18,2) NOT NULL,
    [Vendor] nvarchar(180) NULL, [PaymentMethod] nvarchar(50) NOT NULL, [ReferenceNumber] nvarchar(100) NULL,
    [Description] nvarchar(1000) NOT NULL, [CreatedByUserId] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL, [UpdatedAt] datetime2 NULL, [IsDeleted] bit NOT NULL, [DeletedAt] datetime2 NULL,
    CONSTRAINT [FK_Expenses_ExpenseCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [ExpenseCategories]([Id]) ON DELETE NO ACTION
);
CREATE INDEX [IX_Expenses_CategoryId] ON [Expenses]([CategoryId]);
CREATE INDEX [IX_Expenses_ExpenseDate] ON [Expenses]([ExpenseDate]);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
DROP TABLE IF EXISTS [Expenses];
DROP TABLE IF EXISTS [ExpenseCategories];
DROP TABLE IF EXISTS [StaffSalaryPayments];
DROP TABLE IF EXISTS [StaffMembers];
DROP TABLE IF EXISTS [InventorySaleItems];
DROP TABLE IF EXISTS [InventorySales];
DROP TABLE IF EXISTS [PurchaseItems];
DROP TABLE IF EXISTS [Purchases];
DROP TABLE IF EXISTS [Suppliers];
""");
    }
}
