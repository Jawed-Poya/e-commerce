using API.Entities.Orders;
using ECommerce.Entities.Operations;

namespace ECommerce.Services.Accounting;

public interface IAccountingPostingService
{
    Task<bool> PostPurchaseAsync(Purchase purchase, string? supplierName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostPurchasePaymentAsync(Purchase purchase, PurchasePayment payment, string? supplierName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostManualSaleAsync(InventorySale sale, string customerName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostSalePaymentAsync(InventorySale sale, InventorySalePayment payment, decimal receivableBeforePayment, string customerName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostExpenseAsync(Expense expense, string categoryName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostPayrollAccrualAsync(StaffSalaryPayment salary, string staffName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostPayrollPaymentAsync(StaffSalaryPayment salary, StaffSalaryInstallment payment, string staffName, string? postedByUserId, CancellationToken ct);
    Task<bool> PostOnlineSaleAsync(Order order, string? postedByUserId, CancellationToken ct);
    Task<bool> PostOnlinePaymentAsync(Order order, Payment payment, string? postedByUserId, CancellationToken ct);
    Task<int> SyncOperationalVouchersAsync(string? postedByUserId, CancellationToken ct);
    Task<JournalVoucher> ReverseManualVoucherAsync(long voucherId, string reason, string? userId, CancellationToken ct);
}
