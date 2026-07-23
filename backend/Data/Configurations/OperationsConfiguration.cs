using ECommerce.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ECommerce.Data.Configurations;

public sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> b)
    {
        b.Property(x => x.Name).HasMaxLength(180).IsRequired();
        b.Property(x => x.ContactPerson).HasMaxLength(150);
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.TaxNumber).HasMaxLength(80);
        b.HasIndex(x => x.Name);
    }
}

public sealed class PurchaseConfiguration : IEntityTypeConfiguration<Purchase>
{
    public void Configure(EntityTypeBuilder<Purchase> b)
    {
        b.Property(x => x.PurchaseNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.Subtotal).HasPrecision(18, 2);
        b.Property(x => x.Discount).HasPrecision(18, 2);
        b.Property(x => x.Tax).HasPrecision(18, 2);
        b.Property(x => x.OtherCost).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.PaidAmount).HasPrecision(18, 2);
        b.HasIndex(x => x.PurchaseNumber).IsUnique();
        b.HasIndex(x => x.PurchaseDate);
        b.HasOne(x => x.Supplier).WithMany(x => x.Purchases).HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Payments).WithOne(x => x.Purchase).HasForeignKey(x => x.PurchaseId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PurchaseItemConfiguration : IEntityTypeConfiguration<PurchaseItem>
{
    public void Configure(EntityTypeBuilder<PurchaseItem> b)
    {
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitCost).HasPrecision(18, 2);
        b.Property(x => x.LineTotal).HasPrecision(18, 2);
        b.Property(x => x.LotNumber).HasMaxLength(100);
        b.HasOne(x => x.Purchase).WithMany(x => x.Items).HasForeignKey(x => x.PurchaseId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class InventorySaleConfiguration : IEntityTypeConfiguration<InventorySale>
{
    public void Configure(EntityTypeBuilder<InventorySale> b)
    {
        b.Property(x => x.SaleNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.CustomerName).HasMaxLength(180);
        b.Property(x => x.CustomerPhone).HasMaxLength(40);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.Subtotal).HasPrecision(18, 2);
        b.Property(x => x.Discount).HasPrecision(18, 2);
        b.Property(x => x.Tax).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.PaidAmount).HasPrecision(18, 2);
        b.HasIndex(x => x.SaleNumber).IsUnique();
        b.HasIndex(x => x.SaleDate);
        b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Payments).WithOne(x => x.InventorySale).HasForeignKey(x => x.InventorySaleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class InventorySaleItemConfiguration : IEntityTypeConfiguration<InventorySaleItem>
{
    public void Configure(EntityTypeBuilder<InventorySaleItem> b)
    {
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.LineTotal).HasPrecision(18, 2);
        b.HasOne(x => x.InventorySale).WithMany(x => x.Items).HasForeignKey(x => x.InventorySaleId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class StaffConfiguration : IEntityTypeConfiguration<Staff>
{
    public void Configure(EntityTypeBuilder<Staff> b)
    {
        b.Property(x => x.EmployeeNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(180).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Position).HasMaxLength(120);
        b.Property(x => x.Department).HasMaxLength(120);
        b.Property(x => x.BaseSalary).HasPrecision(18, 2);
        b.HasIndex(x => x.EmployeeNumber).IsUnique();
        b.HasIndex(x => x.IsActive);
    }
}

public sealed class StaffSalaryPaymentConfiguration : IEntityTypeConfiguration<StaffSalaryPayment>
{
    public void Configure(EntityTypeBuilder<StaffSalaryPayment> b)
    {
        b.Property(x => x.BaseSalary).HasPrecision(18, 2);
        b.Property(x => x.Bonus).HasPrecision(18, 2);
        b.Property(x => x.Deduction).HasPrecision(18, 2);
        b.Property(x => x.NetAmount).HasPrecision(18, 2);
        b.Property(x => x.PaidAmount).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.HasIndex(x => new { x.StaffId, x.PeriodYear, x.PeriodMonth }).IsUnique();
        b.HasIndex(x => x.PaidDate);
        b.HasOne(x => x.Staff).WithMany(x => x.SalaryPayments).HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Installments).WithOne(x => x.StaffSalaryPayment).HasForeignKey(x => x.StaffSalaryPaymentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> b)
    {
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.HasIndex(x => x.Name).IsUnique();
    }
}

public sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Vendor).HasMaxLength(180);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(1000).IsRequired();
        b.HasIndex(x => x.ExpenseDate);
        b.HasOne(x => x.Category).WithMany(x => x.Expenses).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.GeneralTypeCategory).WithMany().HasForeignKey(x => x.GeneralTypeCategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}


public sealed class PurchasePaymentConfiguration : IEntityTypeConfiguration<PurchasePayment>
{
    public void Configure(EntityTypeBuilder<PurchasePayment> b)
    {
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.HasIndex(x => new { x.PurchaseId, x.PaymentDate });
    }
}

public sealed class InventorySalePaymentConfiguration : IEntityTypeConfiguration<InventorySalePayment>
{
    public void Configure(EntityTypeBuilder<InventorySalePayment> b)
    {
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.HasIndex(x => new { x.InventorySaleId, x.PaymentDate });
    }
}

public sealed class StaffSalaryInstallmentConfiguration : IEntityTypeConfiguration<StaffSalaryInstallment>
{
    public void Configure(EntityTypeBuilder<StaffSalaryInstallment> b)
    {
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50).IsRequired();
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.HasIndex(x => new { x.StaffSalaryPaymentId, x.PaymentDate });
    }
}
