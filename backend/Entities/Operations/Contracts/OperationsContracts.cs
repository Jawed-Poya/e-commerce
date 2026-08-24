using ECommerce.Entities.Operations;

namespace ECommerce.Entities.Operations.Contracts;

public sealed record OperationProductUnitLookup(
    long UnitId,
    string UnitName,
    decimal ConversionFactor,
    string? Barcode,
    decimal? DefaultPrice,
    decimal AvailableQuantity,
    bool IsBase,
    bool IsDefault);

public sealed record OperationProductLookup(
    long Id,
    string Name,
    string? Strength,
    string? GenericName,
    string? Formula,
    string? Barcode,
    decimal AvailableQuantity,
    decimal? DefaultPrice,
    decimal? MinimumValue,
    decimal? MaximumValue,
    bool UsesDisplayStock,
    long? BaseUnitId,
    string? BaseUnitName,
    decimal? CurrentUnitCost,
    IReadOnlyList<OperationProductUnitLookup> Units);

public sealed class QuickCreateProductRequest
{
    public string Name { get; set; } = null!;
    public string? Barcode { get; set; }
    public string? Strength { get; set; }
    public string? GenericName { get; set; }
    public string? Formula { get; set; }
    public long CategoryId { get; set; }
    public long UnitId { get; set; }
    public decimal? DefaultSalePrice { get; set; }
}

public sealed record OperationCustomerLookup(long Id, string Name, string Phone, string? WhatsAppUrl, string? Email, string? CustomerTypeName, decimal AccountCredit, decimal OutstandingDebt, decimal CreditLimit, bool HasOverdueDebt);
public sealed record OperationSummary(decimal PurchasesThisMonth, decimal SalesThisMonth, decimal ExpensesThisMonth, decimal SalariesThisMonth, int LowStockProducts);
public sealed record OperationPolicyResponse(int MaximumPurchaseLines, int MaximumManualSaleLines, bool CanOverrideLineLimits, decimal GeneralSalesDiscountPercent, decimal MaximumCustomerDebt, int DefaultDebtDueDays, bool AllowNegativeStockSales);

public sealed class CreateSupplierRequest
{
    public string Name { get; set; } = null!;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? TaxNumber { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed record SupplierResponse(long Id, string Name, string? ContactPerson, string? Phone, string? Email, string? Address, string? TaxNumber, bool IsActive, decimal OutstandingBalance);
public sealed record SupplierLedgerEntryResponse(DateOnly Date, string Type, string Reference, string Description, decimal Debit, decimal Credit, decimal Balance, long SourceId);
public sealed record SupplierLedgerResponse(long SupplierId, string SupplierName, string CurrencyCode, decimal TotalPurchases, decimal TotalPayments, decimal ClosingBalance, IReadOnlyList<SupplierLedgerEntryResponse> Entries);

public sealed class CreatePurchaseRequest
{
    public bool OverrideLineLimit { get; set; }
    public long? SupplierId { get; set; }
    public DateOnly PurchaseDate { get; set; }
    public decimal Discount { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal SecondaryDiscountPercent { get; set; }
    public decimal Tax { get; set; }
    public decimal OtherCost { get; set; }
    public decimal PaidAmount { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? PaymentReferenceNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? ClientRequestId { get; set; }
    public string? Notes { get; set; }
    public List<PurchaseItemRequest> Items { get; set; } = [];
}
public sealed class PurchaseItemRequest
{
    public long ProductId { get; set; }
    public long? UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal BonusQuantity { get; set; }
    public decimal DiscountPercent { get; set; }
    public string? LotNumber { get; set; }
    public DateOnly? ExpireDate { get; set; }
}
public sealed record PurchaseListItem(long Id, string PurchaseNumber, string? ReferenceNumber, DateOnly PurchaseDate, string? SupplierName, int ItemCount, decimal Total, decimal PaidAmount, decimal RemainingAmount, DocumentPaymentStatus PaymentStatus, PurchaseStatus Status, DateTime CreatedAt);
public sealed record PurchaseItemDetailsResponse(
    long Id,
    long ProductId,
    string ProductName,
    string? Strength,
    string? Barcode,
    decimal Quantity,
    decimal UnitCost,
    decimal EnteredQuantity,
    long? SelectedUnitId,
    string? SelectedUnitName,
    decimal UnitConversionFactor,
    decimal EnteredUnitCost,
    decimal LineTotal,
    string? LotNumber,
    DateOnly? ExpireDate);

public sealed record PurchaseDetailsResponse(
    long Id,
    string PurchaseNumber,
    string? ReferenceNumber,
    DateOnly PurchaseDate,
    long? SupplierId,
    string? SupplierName,
    PurchaseStatus Status,
    DocumentPaymentStatus PaymentStatus,
    decimal Subtotal,
    decimal Discount,
    decimal Tax,
    decimal OtherCost,
    decimal Total,
    decimal PaidAmount,
    decimal RemainingAmount,
    string CurrencyCode,
    string? Notes,
    DateTime CreatedAt,
    IReadOnlyList<PurchaseItemDetailsResponse> Items);

public sealed class CreateInventorySaleRequest
{
    public bool OverrideLineLimit { get; set; }
    public long? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public DateOnly SaleDate { get; set; }
    public decimal Discount { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal SecondaryDiscountPercent { get; set; }
    public decimal Tax { get; set; }
    public decimal PaidAmount { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? PaymentReferenceNumber { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? ClientRequestId { get; set; }
    public string? Notes { get; set; }
    public bool UseCustomerCredit { get; set; } = true;
    public DateOnly? DebtDueDate { get; set; }
    public List<InventorySaleItemRequest> Items { get; set; } = [];
}
public sealed class InventorySaleItemRequest
{
    public long ProductId { get; set; }
    public long? UnitId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal BonusQuantity { get; set; }
    public decimal DiscountPercent { get; set; }
}
public sealed record InventorySaleListItem(long Id, string SaleNumber, string? ReferenceNumber, DateOnly SaleDate, string CustomerName, string? CustomerPhone, string? WhatsAppUrl, int ItemCount, decimal Total, decimal PaidAmount, decimal RemainingAmount, DocumentPaymentStatus PaymentStatus, decimal CostOfGoods, decimal GrossProfit, decimal ProfitMargin, DateTime CreatedAt);
public sealed record InventorySaleLotMovementResponse(
    long Id,
    long ProductId,
    string ProductName,
    long? InventoryLotId,
    string? LotNumber,
    long WarehouseId,
    string WarehouseName,
    DateOnly? ExpiresAt,
    decimal Quantity,
    DateTime CreatedAt);

public sealed class RecordDocumentPaymentRequest
{
    public decimal Amount { get; set; }
    public DateOnly PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}
public sealed record DocumentPaymentResponse(long Id, decimal Amount, DateOnly PaymentDate, string PaymentMethod, string? ReferenceNumber, string? Notes, DateTime CreatedAt);

public sealed class StaffUpsertRequest
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
}
public sealed record StaffResponse(long Id, string EmployeeNumber, string FullName, string? Phone, string? Email, string? Position, string? Department, DateOnly HireDate, decimal BaseSalary, bool IsActive, string? Address, string? Notes, bool IsSystemUser);

public sealed class CreateSalaryPaymentRequest
{
    public long StaffId { get; set; }
    public int PeriodYear { get; set; }
    public int PeriodMonth { get; set; }
    public decimal Bonus { get; set; }
    public decimal Deduction { get; set; }
    public decimal PaidAmount { get; set; }
    public DateOnly PaidDate { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}
public sealed record SalaryPaymentResponse(long Id, long StaffId, string StaffName, int PeriodYear, int PeriodMonth, decimal BaseSalary, decimal Bonus, decimal Deduction, decimal NetAmount, decimal PaidAmount, decimal RemainingAmount, DocumentPaymentStatus PaymentStatus, DateOnly PaidDate, string PaymentMethod, string? ReferenceNumber, DateTime CreatedAt);

public sealed class ExpenseCategoryUpsertRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed record ExpenseCategoryResponse(long Id, string Name, string? Description, bool IsActive);

public sealed class CreateExpenseRequest
{
    public DateOnly ExpenseDate { get; set; }
    public long CategoryId { get; set; }
    public decimal Amount { get; set; }
    public string? Vendor { get; set; }
    public string PaymentMethod { get; set; } = "Cash";
    public string? ReferenceNumber { get; set; }
    public string Description { get; set; } = null!;
}
public sealed record ExpenseResponse(long Id, DateOnly ExpenseDate, long CategoryId, string CategoryName, decimal Amount, string? Vendor, string PaymentMethod, string? ReferenceNumber, string Description, DateTime CreatedAt);

public sealed class CreateJournalVoucherRequest
{
    public DateOnly VoucherDate { get; set; }
    public string? CurrencyCode { get; set; }
    public JournalVoucherType VoucherType { get; set; } = JournalVoucherType.ManualAdjustment;
    public string Memo { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public List<CreateJournalVoucherLineRequest> Lines { get; set; } = [];
}

public sealed class CreateJournalVoucherLineRequest
{
    public string AccountCode { get; set; } = null!;
    public string AccountName { get; set; } = null!;
    public string? Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public sealed record JournalVoucherLineResponse(long Id, string AccountCode, string AccountName, string? Description, decimal Debit, decimal Credit);
public sealed record JournalVoucherResponse(
    long Id,
    string VoucherNumber,
    DateOnly VoucherDate,
    string CurrencyCode,
    JournalVoucherType VoucherType,
    JournalVoucherStatus Status,
    bool IsSystemGenerated,
    string? ReferenceNumber,
    string? SourceType,
    long? SourceId,
    string? SourceNumber,
    string? CounterpartyType,
    long? CounterpartyId,
    string? CounterpartyName,
    string Memo,
    decimal TotalDebit,
    decimal TotalCredit,
    string? OperatorName,
    DateTime PostedAt,
    DateTime? ReversedAt,
    string? ReversalReason,
    long? ReversalOfVoucherId,
    long? ReversalVoucherId,
    DateTime CreatedAt,
    IReadOnlyList<JournalVoucherLineResponse> Lines);
public sealed record JournalAccountBalanceResponse(string AccountCode, string AccountName, string CurrencyCode, decimal TotalDebit, decimal TotalCredit, decimal Balance, int EntryCount);
public sealed record JournalAccountLedgerEntryResponse(
    long VoucherId,
    string VoucherNumber,
    DateOnly VoucherDate,
    JournalVoucherType VoucherType,
    string Memo,
    string? ReferenceNumber,
    string? CounterpartyName,
    decimal Debit,
    decimal Credit,
    decimal Balance,
    JournalVoucherStatus Status,
    bool IsReversal);
public sealed record JournalAccountLedgerResponse(
    string AccountCode,
    string AccountName,
    string CurrencyCode,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal OpeningBalance,
    decimal PeriodDebit,
    decimal PeriodCredit,
    decimal ClosingBalance,
    IReadOnlyList<JournalAccountLedgerEntryResponse> Entries);
public sealed record JournalVoucherSummaryResponse(int TotalVouchers, int SystemGeneratedVouchers, int ManualVouchers, int ReversedVouchers, decimal TotalPostedDebits, string CurrencyCode, DateOnly? LastPostingDate);
public sealed record JournalVoucherSyncResponse(int CreatedVouchers);
public sealed class ReverseJournalVoucherRequest { public string Reason { get; set; } = null!; }
