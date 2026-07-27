using ECommerce.Dtos.Documents;
using ECommerce.Services.Documents;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/documents")]
[Authorize]
public sealed class AdminDocumentsController(IFinancialDocumentService documents) : ControllerBase
{
    [Authorize(Policy = AppPermissions.ProductsView)]
    [HttpGet("products/pdf")]
    public async Task<IActionResult> ProductsPdf(
        [FromQuery] OperationalDocumentFilter filter)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var content = await TransientSqlRetry.ExecuteAsync(
            token => documents.CreateProductsPdfAsync(filter, token),
            operation.Token);
        return File(content, "application/pdf", FileName("products", filter));
    }

    [Authorize(Policy = AppPermissions.FinancialReportsView)]
    [HttpGet("sales/pdf")]
    public async Task<IActionResult> SalesPdf(
        [FromQuery] OperationalDocumentFilter filter)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var content = await TransientSqlRetry.ExecuteAsync(
            token => documents.CreateSalesPdfAsync(filter, token),
            operation.Token);
        return File(content, "application/pdf", FileName("sales", filter));
    }

    [Authorize(Policy = AppPermissions.PurchasesView)]
    [HttpGet("purchases/pdf")]
    public async Task<IActionResult> PurchasesPdf(
        [FromQuery] OperationalDocumentFilter filter)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var content = await TransientSqlRetry.ExecuteAsync(
            token => documents.CreatePurchasesPdfAsync(filter, token),
            operation.Token);
        return File(content, "application/pdf", FileName("purchases", filter));
    }

    [Authorize(Policy = AppPermissions.PayrollView)]
    [HttpGet("payroll/pdf")]
    public async Task<IActionResult> PayrollPdf(
        [FromQuery] OperationalDocumentFilter filter)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var content = await TransientSqlRetry.ExecuteAsync(
            token => documents.CreatePayrollPdfAsync(filter, token),
            operation.Token);
        return File(content, "application/pdf", FileName("payroll", filter));
    }

    [Authorize(Policy = AppPermissions.ExpensesView)]
    [HttpGet("expenses/pdf")]
    public async Task<IActionResult> ExpensesPdf(
        [FromQuery] OperationalDocumentFilter filter)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var content = await TransientSqlRetry.ExecuteAsync(
            token => documents.CreateExpensesPdfAsync(filter, token),
            operation.Token);
        return File(content, "application/pdf", FileName("expenses", filter));
    }

    private static string FileName(string document, OperationalDocumentFilter filter)
    {
        var suffix = filter.StartDate.HasValue || filter.EndDate.HasValue
            ? $"-{filter.StartDate?.ToString("yyyyMMdd") ?? "start"}-{filter.EndDate?.ToString("yyyyMMdd") ?? "today"}"
            : $"-{DateTime.UtcNow:yyyyMMdd}";
        return $"{document}{suffix}.pdf";
    }
}
