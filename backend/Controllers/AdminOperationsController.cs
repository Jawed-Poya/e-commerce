using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Services.Operations;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/operations")]
[Authorize]
public sealed class AdminOperationsController(IOperationsService service) : ControllerBase
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

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("customers")]
    public async Task<IActionResult> Customers([FromQuery] string? search, [FromQuery] int take = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<IReadOnlyList<OperationCustomerLookup>>.Ok(await service.GetCustomerLookupsAsync(search, take, ct)));

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
    [HttpGet("sales/{id:long}/lots")]
    public async Task<IActionResult> SaleLots(long id, CancellationToken ct) =>
        Ok(ApiResponse<IReadOnlyList<InventorySaleLotMovementResponse>>.Ok(
            await service.GetSaleLotsAsync(id, ct)));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPost("sales")]
    public Task<IActionResult> CreateSale(CreateInventorySaleRequest request, CancellationToken ct) => Handle(async () => ApiResponse<InventorySaleListItem>.Ok(await service.CreateSaleAsync(request, UserId(), request.OverrideLineLimit && HasAnyPermission(AppPermissions.OperationLineLimitsOverride), ct), "Sale recorded and stock updated."));

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
    public async Task<IActionResult> JournalVouchers([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(ApiResponse<PagedResult<JournalVoucherResponse>>.Ok(await service.GetJournalVouchersAsync(page, pageSize, ct)));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("journal-vouchers")]
    public Task<IActionResult> CreateJournalVoucher(CreateJournalVoucherRequest request, CancellationToken ct) =>
        Handle(async () => ApiResponse<JournalVoucherResponse>.Ok(await service.CreateJournalVoucherAsync(request, UserId(), ct), "Balanced journal voucher posted."));

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
