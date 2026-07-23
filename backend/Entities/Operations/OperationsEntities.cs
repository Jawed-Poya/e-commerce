using API.Entities.Common;
using API.Entities.Customers;
using API.Entities.Products;

namespace ECommerce.Entities.Operations;

public enum PurchaseStatus { Draft = 1, Received = 2, Cancelled = 3 }
public enum DocumentPaymentStatus { Unpaid = 1, Partial = 2, Paid = 3 }

public sealed class Supplier : BaseEntity
{
    public string Name { get; set; } = null!;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Purchase> Purchases { get; set; } = [];
}

public sealed class Purchase : BaseEntity
{
    public string PurchaseNumber { get; set; } = null!;
    public long? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public PurchaseStatus Status { get; set; } = PurchaseStatus.Received;
    public DocumentPaymentStatus PaymentStatus { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal OtherCost { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public string? CreatedByUserId { get; set; }
    public ICollection<PurchaseItem> Items { get; set; } = [];
}

public sealed class PurchaseItem : BaseEntity
{
    public long PurchaseId { get; set; }
    public Purchase Purchase { get; set; } = null!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal { get; set; }
    public string? LotNumber { get; set; }
    public DateOnly? ExpireDate { get; set; }
}

public sealed class InventorySale : BaseEntity
{
    public string SaleNumber { get; set; } = null!;
    public long? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public DateOnly SaleDate { get; set; }
    public DocumentPaymentStatus PaymentStatus { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public string? Notes { get; set; }
    public string? CreatedByUserId { get; set; }
    public ICollection<InventorySaleItem> Items { get; set; } = [];
}

public sealed class InventorySaleItem : BaseEntity
{
    public long InventorySaleId { get; set; }
    public InventorySale InventorySale { get; set; } = null!;
    public long ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

public sealed class Staff : BaseEntity
{
    public string EmployeeNumber { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Position { get; set; }
    public string? Department { get; set; }
    public DateOnly HireDate { get; set; }
    public decimal BaseSalary { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public ICollection<StaffSalaryPayment> SalaryPayments { get; set; } = [];
}

public sealed class StaffSalaryPayment : BaseEntity
{
    public long StaffId { get; set; }
    public Staff Staff { get; set; } = null!;
    public int PeriodYear { get; set; }
    public int PeriodMonth { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal Bonus { get; set; }
    public decimal Deduction { get; set; }
    public decimal NetAmount { get; set; }
    public DateOnly PaidDate { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public string? CreatedByUserId { get; set; }
}

public sealed class ExpenseCategory : BaseEntity
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Expense> Expenses { get; set; } = [];
}

public sealed class Expense : BaseEntity
{
    public DateOnly ExpenseDate { get; set; }
    public long CategoryId { get; set; }
    public ExpenseCategory Category { get; set; } = null!;
    public decimal Amount { get; set; }
    public string? Vendor { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string Description { get; set; } = null!;
    public string? CreatedByUserId { get; set; }
}
