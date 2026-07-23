using System.Security.Claims;
using ECommerce.Entities;
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

    [HttpGet("products")]
    public async Task<IActionResult> Products(CancellationToken ct)
    {
        if (!HasAnyPermission(
                AppPermissions.OperationsView,
                AppPermissions.PurchasesView,
                AppPermissions.ManualSalesView))
        {
            return Forbid();
        }

        return Ok(ApiResponse<IReadOnlyList<OperationProductLookup>>.Ok(
            await service.GetProductLookupsAsync(ct)));
    }

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("suppliers")]
    public async Task<IActionResult> Suppliers(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<SupplierResponse>>.Ok(await service.GetSuppliersAsync(ct)));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPost("suppliers")]
    public Task<IActionResult> CreateSupplier(CreateSupplierRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SupplierResponse>.Ok(await service.SaveSupplierAsync(null, request, ct), "Supplier created."));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPut("suppliers/{id:long}")]
    public Task<IActionResult> UpdateSupplier(long id, CreateSupplierRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SupplierResponse>.Ok(await service.SaveSupplierAsync(id, request, ct), "Supplier updated."));

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("purchases")]
    public async Task<IActionResult> Purchases(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<PurchaseListItem>>.Ok(await service.GetPurchasesAsync(ct)));

    [Authorize(Policy = AppPermissions.PurchasesManage)]
    [HttpPost("purchases")]
    public Task<IActionResult> CreatePurchase(CreatePurchaseRequest request, CancellationToken ct) => Handle(async () => ApiResponse<PurchaseListItem>.Ok(await service.CreatePurchaseAsync(request, UserId(), ct), "Purchase received and stock updated."));

    [Authorize(Policy = AppPermissions.ManualSalesView)]
    [HttpGet("sales")]
    public async Task<IActionResult> Sales(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<InventorySaleListItem>>.Ok(await service.GetSalesAsync(ct)));

    [Authorize(Policy = AppPermissions.ManualSalesManage)]
    [HttpPost("sales")]
    public Task<IActionResult> CreateSale(CreateInventorySaleRequest request, CancellationToken ct) => Handle(async () => ApiResponse<InventorySaleListItem>.Ok(await service.CreateSaleAsync(request, UserId(), ct), "Sale recorded and stock updated."));

    [Authorize(Policy = AppPermissions.StaffView)]
    [HttpGet("staff")]
    public async Task<IActionResult> Staff(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<StaffResponse>>.Ok(await service.GetStaffAsync(ct)));

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
    public async Task<IActionResult> Salaries(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<SalaryPaymentResponse>>.Ok(await service.GetSalaryPaymentsAsync(ct)));

    [Authorize(Policy = AppPermissions.PayrollManage)]
    [HttpPost("salaries")]
    public Task<IActionResult> CreateSalary(CreateSalaryPaymentRequest request, CancellationToken ct) => Handle(async () => ApiResponse<SalaryPaymentResponse>.Ok(await service.CreateSalaryPaymentAsync(request, UserId(), ct), "Salary payment recorded."));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("expense-categories")]
    public async Task<IActionResult> ExpenseCategories(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<ExpenseCategoryResponse>>.Ok(await service.GetExpenseCategoriesAsync(ct)));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("expense-categories")]
    public Task<IActionResult> CreateExpenseCategory(ExpenseCategoryUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseCategoryResponse>.Ok(await service.SaveExpenseCategoryAsync(null, request, ct), "Expense category created."));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPut("expense-categories/{id:long}")]
    public Task<IActionResult> UpdateExpenseCategory(long id, ExpenseCategoryUpsertRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseCategoryResponse>.Ok(await service.SaveExpenseCategoryAsync(id, request, ct), "Expense category updated."));

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("expenses")]
    public async Task<IActionResult> Expenses(CancellationToken ct) => Ok(ApiResponse<IReadOnlyList<ExpenseResponse>>.Ok(await service.GetExpensesAsync(ct)));

    [Authorize(Policy = AppPermissions.ExpensesManage)]
    [HttpPost("expenses")]
    public Task<IActionResult> CreateExpense(CreateExpenseRequest request, CancellationToken ct) => Handle(async () => ApiResponse<ExpenseResponse>.Ok(await service.CreateExpenseAsync(request, UserId(), ct), "Expense recorded."));

    private string? UserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private bool HasAnyPermission(params string[] permissions) =>
        User.IsInRole(AppRoles.Admin) ||
        permissions.Any(permission => User.HasClaim(AuthClaims.Permission, permission));

    private async Task<IActionResult> Handle<T>(Func<Task<ApiResponse<T>>> action)
    {
        try { return Ok(await action()); }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Inventory changed while this document was being saved. Refresh stock and try again.")); }
        catch (DbUpdateException) { return Conflict(ApiResponse<object>.Fail("The operation conflicted with another saved record. Refresh the page and try again.")); }
        catch (InvalidOperationException ex) { return Conflict(ApiResponse<object>.Fail(ex.Message)); }
    }
}
