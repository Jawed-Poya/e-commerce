using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Services.Operations;
using ECommerce.Services.Documents;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/operations")]
[Authorize]
public sealed class AdminOperationsController(IOperationsService service, IFinancialDocumentService documents) : ControllerBase
{
    [Authorize(Policy = AppPermissions.OperationsView)]
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct) => Ok(ApiResponse<OperationSummary>.Ok(await service.GetSummaryAsync(ct)));

    [HttpGet("policy")]
    public async Task<IActionResult> Policy(CancellationToken ct)
    {
        if (!HasAnyPermission(AppPermissions.OperationsView, AppPermissions.PurchasesView, AppPermissions.ManualSalesView))
            return Forbid();
        return Ok(ApiResponse<OperationPolicyResponse>.Ok(
            await service.GetPolicyAsync(HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct)));
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products(
        [FromQuery] string? search,
        [FromQuery] int take = 20,
        [FromQuery] bool includeCurrentUnitCost = false,
        CancellationToken ct = default)
    {
        if (!HasAnyPermission(AppPermissions.OperationsView, AppPermissions.PurchasesView, AppPermissions.ManualSalesView)) return Forbid();
        var canIncludeCost = includeCurrentUnitCost && HasAnyPermission(AppPermissions.ManualSalesView);
        return Ok(ApiResponse<IReadOnlyList<OperationProductLookup>>.Ok(
            await service.GetProductLookupsAsync(search, take, canIncludeCost, ct)));
    }

    [HttpPost("products/quick")]
    public async Task<IActionResult> QuickCreateProduct(
        QuickCreateProductRequest request,
        CancellationToken ct)
    {
        if (!HasAnyPermission(
                AppPermissions.ProductsManage,
                AppPermissions.PurchasesManage,
                AppPermissions.ManualSalesManage))
            return Forbid();

        return await Handle(async () => ApiResponse<OperationProductLookup>.Ok(
            await service.QuickCreateProductAsync(request, ct),
            "Product created and selected."));
    }

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("customers")]
    public async Task<IActionResult> Customers([FromQuery] string? search, [FromQuery] int take = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<IReadOnlyList<OperationCustomerLookup>>.Ok(await service.GetCustomerLookupsAsync(search, take, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("customers/{id:long}/settlement-documents")]
    public Task<IActionResult> CustomerSettlementDocuments(long id, CancellationToken ct) =>
        Handle(async () => ApiResponse<IReadOnlyList<PartySettlementDocumentResponse>>.Ok(
            await service.GetCustomerSettlementDocumentsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers([FromQuery] string? search, [FromQuery] int take = 50, CancellationToken ct = default) =>
        Ok(ApiResponse<IReadOnlyList<SupplierResponse>>.Ok(await service.GetSuppliersAsync(search, take, ct)));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("suppliers/page")]
    public async Task<IActionResult> SupplierPage([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<SupplierResponse>>.Ok(await service.GetSupplierPageAsync(search, page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPost("suppliers")]
    public Task<IActionResult> CreateSupplier(CreateSupplierRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SupplierResponse>.Ok(await service.SaveSupplierAsync(null, request, ct), "Supplier created."));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPut("suppliers/{id:long}")]
    public Task<IActionResult> UpdateSupplier(long id, CreateSupplierRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SupplierResponse>.Ok(await service.SaveSupplierAsync(id, request, ct), "Supplier updated."));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("suppliers/{id:long}/ledger")]
    public Task<IActionResult> SupplierLedger(long id, CancellationToken ct) =>
        Handle(async () => ApiResponse<SupplierLedgerResponse>.Ok(await service.GetSupplierLedgerAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("suppliers/{id:long}/settlement-documents")]
    public Task<IActionResult> SupplierSettlementDocuments(long id, CancellationToken ct) =>
        Handle(async () => ApiResponse<IReadOnlyList<PartySettlementDocumentResponse>>.Ok(
            await service.GetSupplierSettlementDocumentsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("purchases")]
    public async Task<IActionResult> Purchases([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<PurchaseListItem>>.Ok(await service.GetPurchasesAsync(search, page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("purchases/{id:long}")]
    public Task<IActionResult> Purchase(long id, CancellationToken ct) =>
        Handle(async () => ApiResponse<PurchaseDetailsResponse>.Ok(await service.GetPurchaseAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPost("purchases")]
    public Task<IActionResult> CreatePurchase(CreatePurchaseRequest request, CancellationToken ct) => Handle(async () => ApiResponse<PurchaseListItem>.Ok(await service.CreatePurchaseAsync(request, UserId(), request.OverrideLineLimit && HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct), "Purchase received and stock updated."));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPut("purchases/{id:long}")]
    public Task<IActionResult> UpdatePurchase(long id, UpdatePurchaseRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<PurchaseListItem>.Ok(
            await service.UpdatePurchaseAsync(id, request, UserId(), request.OverrideLineLimit && HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct),
            "Purchase details updated."));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpDelete("purchases/{id:long}")]
    public Task<IActionResult> DeletePurchase(long id, CancellationToken ct) =>
        Handle(async () =>
        {
            await service.DeletePurchaseAsync(id, UserId(), ct);
            return ApiResponse<object>.Ok(new { id }, "Purchase deleted and stock reversed.");
        });

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("purchases/{id:long}/payments")]
    public async Task<IActionResult> PurchasePayments(long id, CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<DocumentPaymentResponse>>.Ok(await service.GetPurchasePaymentsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPost("purchases/{id:long}/payments")]
    public Task<IActionResult> AddPurchasePayment(long id, RecordDocumentPaymentRequest request, CancellationToken ct) => Handle(async () => ApiResponse<PurchaseListItem>.Ok(await service.AddPurchasePaymentAsync(id, request, UserId(), ct), "Purchase payment recorded."));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales")]
    public async Task<IActionResult> Sales([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<InventorySaleListItem>>.Ok(await service.GetSalesAsync(search, page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales/{id:long}")]
    public async Task<IActionResult> GetSale(long id, CancellationToken ct) =>
        Ok(ApiResponse<InventorySaleDetailsResponse>.Ok(await service.GetSaleAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales/{id:long}/lots")]
    public async Task<IActionResult> SaleLots(long id, CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<InventorySaleLotMovementResponse>>.Ok(
            await service.GetSaleLotsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPost("sales")]
    public Task<IActionResult> CreateSale(CreateInventorySaleRequest request, CancellationToken ct) => Handle(async () => ApiResponse<InventorySaleListItem>.Ok(await service.CreateSaleAsync(request, UserId(), request.OverrideLineLimit && HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct), "Sale recorded and stock updated."));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPut("sales/{id:long}")]
    public Task<IActionResult> UpdateSale(long id, UpdateInventorySaleRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<InventorySaleListItem>.Ok(
            await service.UpdateSaleAsync(id, request, UserId(), request.OverrideLineLimit && HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct),
            "Sale details updated."));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpDelete("sales/{id:long}")]
    public Task<IActionResult> DeleteSale(long id, CancellationToken ct) =>
        Handle(async () =>
        {
            await service.DeleteSaleAsync(id, UserId(), ct);
            return ApiResponse<object>.Ok(new { id }, "Sale deleted and stock reversed.");
        });

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales/{id:long}/returns")]
    public async Task<IActionResult> SaleReturns(long id, CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<InventorySaleReturnResponse>>.Ok(
            await service.GetSaleReturnsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPost("sales/{id:long}/returns")]
    public Task<IActionResult> CreateSaleReturn(long id, CreateInventorySaleReturnRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<InventorySaleReturnResponse>.Ok(
            await service.CreateSaleReturnAsync(id, request, UserId(), ct),
            "Customer return recorded and stock/balances updated."));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales/{id:long}/payments")]
    public async Task<IActionResult> SalePayments(long id, CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<DocumentPaymentResponse>>.Ok(await service.GetSalePaymentsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPost("sales/{id:long}/payments")]
    public Task<IActionResult> AddSalePayment(long id, RecordDocumentPaymentRequest request, CancellationToken ct) => Handle(async () => ApiResponse<InventorySaleListItem>.Ok(await service.AddSalePaymentAsync(id, request, UserId(), ct), "Sale payment recorded."));

    [Authorize(Policy = AppPermissions.StaffView)]
    [HttpGet("staff")]
    public async Task<IActionResult> Staff(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<StaffResponse>>.Ok(await service.GetStaffAsync(ct)));

    [Authorize(Policy = AppPermissions.StaffView)]
    [HttpGet("staff/page")]
    public async Task<IActionResult> StaffPage([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<StaffResponse>>.Ok(await service.GetStaffPageAsync(search, page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.StaffManage)]
    [HttpPost("staff")]
    public Task<IActionResult> CreateStaff(StaffUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<StaffResponse>.Ok(await service.SaveStaffAsync(null, request, ct), "Staff member created."));

    [Authorize(Policy = AppPermissions.StaffManage)]
    [HttpPut("staff/{id:long}")]
    public Task<IActionResult> UpdateStaff(long id, StaffUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<StaffResponse>.Ok(await service.SaveStaffAsync(id, request, ct), "Staff member updated."));

    [Authorize(Policy = AppPermissions.StaffManage)]
    [HttpDelete("staff/{id:long}")]
    public Task<IActionResult> DeleteStaff(long id, CancellationToken ct) => Handle(async () => { await service.DeleteStaffAsync(id, ct); return ApiResponse<object>.Ok(new { }, "Staff member archived."); });

    [Authorize(Policy = AppPermissions.PayrollView)]
    [HttpGet("salaries")]
    public async Task<IActionResult> Salaries([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<SalaryPaymentResponse>>.Ok(await service.GetSalaryPaymentsAsync(page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.PayrollManage)]
    [HttpPost("salaries")]
    public Task<IActionResult> CreateSalary(CreateSalaryPaymentRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SalaryPaymentResponse>.Ok(await service.CreateSalaryPaymentAsync(request, UserId(), ct), "Salary record created."));

    [Authorize(Policy = AppPermissions.PayrollView)]
    [HttpGet("salaries/{id:long}/payments")]
    public async Task<IActionResult> SalaryPayments(long id, CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<DocumentPaymentResponse>>.Ok(await service.GetSalaryInstallmentsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.PayrollManage)]
    [HttpPost("salaries/{id:long}/payments")]
    public Task<IActionResult> AddSalaryPayment(long id, RecordDocumentPaymentRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SalaryPaymentResponse>.Ok(await service.AddSalaryInstallmentAsync(id, request, UserId(), ct), "Salary payment recorded."));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("expense-categories")]
    public async Task<IActionResult> ExpenseCategories(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<ExpenseCategoryResponse>>.Ok(await service.GetExpenseCategoriesAsync(ct)));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("expense-categories")]
    public Task<IActionResult> CreateExpenseCategory(ExpenseCategoryUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseCategoryResponse>.Ok(await service.SaveExpenseCategoryAsync(null, request, ct), "Expense category created in General Types."));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPut("expense-categories/{id:long}")]
    public Task<IActionResult> UpdateExpenseCategory(long id, ExpenseCategoryUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseCategoryResponse>.Ok(await service.SaveExpenseCategoryAsync(id, request, ct), "Expense category updated."));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<ExpenseResponse>>.Ok(await service.GetExpensesAsync(page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("expenses")]
    public Task<IActionResult> CreateExpense(CreateExpenseRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseResponse>.Ok(await service.CreateExpenseAsync(request, UserId(), ct), "Expense recorded."));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers")]
    public async Task<IActionResult> JournalVouchers(
        [FromQuery] string? search,
        [FromQuery] JournalVoucherType? type,
        [FromQuery] JournalVoucherStatus? status,
        [FromQuery] bool? systemGenerated,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] string? currencyCode,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<JournalVoucherResponse>>.Ok(
            await service.GetJournalVouchersAsync(search, type, status, systemGenerated, startDate, endDate, currencyCode, page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/summary")]
    public async Task<IActionResult> JournalVoucherSummary(CancellationToken ct = default) =>
        Ok(ApiResponse<JournalVoucherSummaryResponse>.Ok(await service.GetJournalVoucherSummaryAsync(ct)));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/accounts")]
    public async Task<IActionResult> JournalAccountBalances(CancellationToken ct = default) =>
        Ok(ApiResponse<IReadOnlyList<JournalAccountBalanceResponse>>.Ok(await service.GetJournalAccountBalancesAsync(ct)));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/ledger")]
    public Task<IActionResult> JournalAccountLedger(
        [FromQuery] string accountCode,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] string? currencyCode,
        CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalAccountLedgerResponse>.Ok(
            await service.GetJournalAccountLedgerAsync(accountCode, startDate, endDate, currencyCode, ct)));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/ledger/pdf")]
    public async Task<IActionResult> JournalAccountLedgerPdf(
        [FromQuery] string accountCode,
        [FromQuery] DateOnly? startDate,
        [FromQuery] DateOnly? endDate,
        [FromQuery] string? currencyCode,
        CancellationToken ct)
    {
        var ledger = await service.GetJournalAccountLedgerAsync(accountCode, startDate, endDate, currencyCode, ct);
        var companyName = await documents.GetCompanyNameAsync(ct);
        var fileName = $"general-ledger-{ledger.AccountCode}-{ledger.StartDate:yyyyMMdd}-{ledger.EndDate:yyyyMMdd}.pdf";
        return File(documents.CreateJournalAccountLedgerPdf(ledger, companyName), "application/pdf", fileName);
    }

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/{id:long}")]
    public Task<IActionResult> JournalVoucher(long id, CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalVoucherResponse>.Ok(await service.GetJournalVoucherAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("journal-vouchers/{id:long}/pdf")]
    public async Task<IActionResult> JournalVoucherPdf(long id, CancellationToken ct)
    {
        var voucher = await service.GetJournalVoucherAsync(id, ct);
        var companyName = await documents.GetCompanyNameAsync(ct);
        return File(
            documents.CreateJournalVoucherPdf(voucher, companyName),
            "application/pdf",
            $"voucher-{voucher.VoucherNumber}.pdf");
    }

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("journal-vouchers")]
    public Task<IActionResult> CreateJournalVoucher(CreateJournalVoucherRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalVoucherResponse>.Ok(await service.CreateJournalVoucherAsync(request, UserId(), ct), "Balanced adjustment voucher posted."));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("journal-vouchers/{id:long}/reverse")]
    public Task<IActionResult> ReverseJournalVoucher(long id, ReverseJournalVoucherRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalVoucherResponse>.Ok(
            await service.ReverseJournalVoucherAsync(id, request.Reason, UserId(), ct),
            "Voucher reversed with a balancing audit entry."));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("journal-vouchers/sync")]
    public Task<IActionResult> SyncJournalVouchers(CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalVoucherSyncResponse>.Ok(
            await service.SyncJournalVouchersAsync(UserId(), ct),
            "Operational accounting vouchers synchronized."));

    private string? UserId() => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    private bool HasAnyPermission(params string[] permissions) =>
        permissions.Any(permission => AppPermissions.IsGranted(User, permission));

    private async Task<IActionResult> Handle<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (KeyNotFoundException exception) { return NotFound(ApiResponse<object>.Fail(exception.Message)); }
        catch (ArgumentException exception) { return BadRequest(ApiResponse<object>.Fail(exception.Message)); }
        catch (InvalidOperationException exception) { return Conflict(ApiResponse<object>.Fail(exception.Message)); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Inventory changed while this operation was being saved. Refresh the page and try again.")); }
    }
}
