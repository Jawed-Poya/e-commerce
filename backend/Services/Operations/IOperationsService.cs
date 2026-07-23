using ECommerce.Entities.Operations.Contracts;

namespace ECommerce.Services.Operations;

public interface IOperationsService
{
    Task<OperationSummary> GetSummaryAsync(CancellationToken ct);
    Task<IReadOnlyList<OperationProductLookup>> GetProductLookupsAsync(string? search, int take, CancellationToken ct);
    Task<IReadOnlyList<OperationCustomerLookup>> GetCustomerLookupsAsync(string? search, int take, CancellationToken ct);
    Task<IReadOnlyList<SupplierResponse>> GetSuppliersAsync(string? search, int take, CancellationToken ct);
    Task<SupplierResponse> SaveSupplierAsync(long? id, CreateSupplierRequest request, CancellationToken ct);
    Task<IReadOnlyList<PurchaseListItem>> GetPurchasesAsync(CancellationToken ct);
    Task<PurchaseListItem> CreatePurchaseAsync(CreatePurchaseRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetPurchasePaymentsAsync(long purchaseId, CancellationToken ct);
    Task<PurchaseListItem> AddPurchasePaymentAsync(long purchaseId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<InventorySaleListItem>> GetSalesAsync(CancellationToken ct);
    Task<InventorySaleListItem> CreateSaleAsync(CreateInventorySaleRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetSalePaymentsAsync(long saleId, CancellationToken ct);
    Task<InventorySaleListItem> AddSalePaymentAsync(long saleId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<StaffResponse>> GetStaffAsync(CancellationToken ct);
    Task<StaffResponse> SaveStaffAsync(long? id, StaffUpsertRequest request, CancellationToken ct);
    Task DeleteStaffAsync(long id, CancellationToken ct);
    Task<IReadOnlyList<SalaryPaymentResponse>> GetSalaryPaymentsAsync(CancellationToken ct);
    Task<SalaryPaymentResponse> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<DocumentPaymentResponse>> GetSalaryInstallmentsAsync(long salaryId, CancellationToken ct);
    Task<SalaryPaymentResponse> AddSalaryInstallmentAsync(long salaryId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct);
    Task<IReadOnlyList<ExpenseCategoryResponse>> GetExpenseCategoriesAsync(CancellationToken ct);
    Task<ExpenseCategoryResponse> SaveExpenseCategoryAsync(long? id, ExpenseCategoryUpsertRequest request, CancellationToken ct);
    Task<IReadOnlyList<ExpenseResponse>> GetExpensesAsync(CancellationToken ct);
    Task<ExpenseResponse> CreateExpenseAsync(CreateExpenseRequest request, string? userId, CancellationToken ct);
}
