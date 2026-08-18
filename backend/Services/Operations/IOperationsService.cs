using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;

namespace ECommerce.Services.Operations;

public interface IOperationsService
{
    Task<OperationSummary> GetSummaryAsync(CancellationToken ct);
    Task<OperationPolicyResponse> GetPolicyAsync(bool canOverrideLineLimits, CancellationToken ct);
    Task<IReadOnlyList<OperationProductLookup>> GetProductLookupsAsync(string? search, int take, bool includeCurrentUnitCost, CancellationToken ct);
    Task<OperationProductLookup> QuickCreateProductAsync(QuickCreateProductRequest request, CancellationToken ct);
    Task<IReadOnlyList<OperationCustomerLookup>> GetCustomerLookupsAsync(string? search, int take, CancellationToken ct);
    Task<IReadOnlyList<SupplierResponse>> GetSuppliersAsync(string? search, int take, CancellationToken ct);
    Task<PagedResult<SupplierResponse>> GetSupplierPageAsync(string? search, int page, int pageSize, CancellationToken ct);
    Task<SupplierResponse> SaveSupplierAsync(long? id, CreateSupplierRequest request, CancellationToken ct);
    Task<SupplierLedgerResponse> GetSupplierLedgerAsync(long id, CancellationToken ct);
    Task<PagedResult<PurchaseListItem>> GetPurchasesAsync(string? search, int page, int pageSize, CancellationToken ct);
    Task<PurchaseDetailsResponse> GetPurchaseAsync(long id, CancellationToken ct);
    Task<PurchaseListItem> CreatePurchaseAsync(CreatePurchaseRequest request, string? userId, bool canOverrideLineLimits, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetPurchasePaymentsAsync(long purchaseId, CancellationToken ct);
    Task<PurchaseListItem> AddPurchasePaymentAsync(long purchaseId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<PagedResult<InventorySaleListItem>> GetSalesAsync(string? search, int page, int pageSize, CancellationToken ct);
    Task<IReadOnlyList<InventorySaleLotMovementResponse>> GetSaleLotsAsync(long saleId, CancellationToken ct);
    Task<InventorySaleListItem> CreateSaleAsync(CreateInventorySaleRequest request, string? userId, bool canOverrideLineLimits, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetSalePaymentsAsync(long saleId, CancellationToken ct);
    Task<InventorySaleListItem> AddSalePaymentAsync(long saleId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<StaffResponse>> GetStaffAsync(CancellationToken ct);
    Task<PagedResult<StaffResponse>> GetStaffPageAsync(string? search, int page, int pageSize, CancellationToken ct);
    Task<StaffResponse> SaveStaffAsync(long? id, StaffUpsertRequest request, CancellationToken ct);
    Task DeleteStaffAsync(long id, CancellationToken ct);
    Task<PagedResult<SalaryPaymentResponse>> GetSalaryPaymentsAsync(int page, int pageSize, CancellationToken ct);
    Task<SalaryPaymentResponse> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetSalaryInstallmentsAsync(long salaryId, CancellationToken ct);
    Task<SalaryPaymentResponse> AddSalaryInstallmentAsync(long salaryId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<ExpenseCategoryResponse>> GetExpenseCategoriesAsync(CancellationToken ct);
    Task<ExpenseCategoryResponse> SaveExpenseCategoryAsync(long? id, ExpenseCategoryUpsertRequest request, CancellationToken ct);
    Task<PagedResult<ExpenseResponse>> GetExpensesAsync(int page, int pageSize, CancellationToken ct);
    Task<ExpenseResponse> CreateExpenseAsync(CreateExpenseRequest request, string? userId, CancellationToken ct);
    Task<PagedResult<JournalVoucherResponse>> GetJournalVouchersAsync(string? search, JournalVoucherType? type, JournalVoucherStatus? status, bool? systemGenerated, int page, int pageSize, CancellationToken ct);
    Task<JournalVoucherSummaryResponse> GetJournalVoucherSummaryAsync(CancellationToken ct);
    Task<IReadOnlyList<JournalAccountBalanceResponse>> GetJournalAccountBalancesAsync(CancellationToken ct);
    Task<JournalVoucherResponse> CreateJournalVoucherAsync(CreateJournalVoucherRequest request, string? userId, CancellationToken ct);
    Task<JournalVoucherResponse> ReverseJournalVoucherAsync(long id, string reason, string? userId, CancellationToken ct);
    Task<JournalVoucherSyncResponse> SyncJournalVouchersAsync(string? userId, CancellationToken ct);
}
