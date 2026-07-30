using ECommerce.Dtos.Reports;
using ECommerce.Entities;
using ECommerce.Services.Documents;
using ECommerce.Services.Reports;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Route("api/admin/reports")]
[Authorize(Policy = AppPermissions.FinancialReportsView)]
public sealed class FinancialReportsController(
    IFinancialReportService reports,
    IFinancialDocumentService documents) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<FinancialReportSummaryResponse>>> Get(
        [FromQuery] FinancialReportRequest request)
    {
        using var operation = ServerOperation.CreateReadScope();
        var report = await TransientSqlRetry.ExecuteAsync(
            token => reports.GetReportAsync(request, cancellationToken: token),
            operation.Token);
        return Success(report);
    }

    [HttpGet("company-worth")]
    public async Task<ActionResult<ApiResponse<CompanyWorthResponse>>> GetCompanyWorth(
        [FromQuery] DateTime? asOfDate,
        [FromQuery] DateTime? periodStartDate,
        [FromQuery] long? branchId,
        [FromQuery] string? currencyCode)
    {
        using var operation = ServerOperation.CreateReadScope();
        var worth = await TransientSqlRetry.ExecuteAsync(
            token => reports.GetCompanyWorthAsync(
                asOfDate,
                periodStartDate,
                branchId,
                currencyCode,
                token),
            operation.Token);
        return Success(worth);
    }

    [HttpGet("customers/{customerId:long}/ledger")]
    public async Task<ActionResult<ApiResponse<CustomerLedgerResponse>>> GetCustomerLedger(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode)
    {
        using var operation = ServerOperation.CreateReadScope();
        var ledger = await TransientSqlRetry.ExecuteAsync(
            token => reports.GetCustomerLedgerAsync(
                customerId,
                startDate,
                endDate,
                currencyCode,
                token),
            operation.Token);
        return Success(ledger);
    }

    [HttpGet("export/excel")]
    public Task<IActionResult> ExportExcel([FromQuery] FinancialReportRequest request) =>
        ExportFinancialReportAsync(request, "excel");

    [HttpGet("export/pdf")]
    public Task<IActionResult> ExportPdf([FromQuery] FinancialReportRequest request) =>
        ExportFinancialReportAsync(request, "pdf");

    [HttpGet("customers/{customerId:long}/ledger/export/excel")]
    public Task<IActionResult> ExportCustomerLedgerExcel(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode) =>
        ExportCustomerLedgerAsync(customerId, startDate, endDate, currencyCode, "excel");

    [HttpGet("customers/{customerId:long}/ledger/export/pdf")]
    public Task<IActionResult> ExportCustomerLedgerPdf(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode) =>
        ExportCustomerLedgerAsync(customerId, startDate, endDate, currencyCode, "pdf");

    private async Task<IActionResult> ExportFinancialReportAsync(
        FinancialReportRequest request,
        string format)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var report = await TransientSqlRetry.ExecuteAsync(
            token => reports.GetReportAsync(
                request,
                includeAllResults: true,
                cancellationToken: token),
            operation.Token);
        var companyName = await documents.GetCompanyNameAsync(operation.Token);
        var fileStem = $"financial-report-{report.StartDate:yyyyMMdd}-{report.EndDate:yyyyMMdd}";

        return format == "excel"
            ? File(
                documents.CreateFinancialReportExcel(report, companyName),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{fileStem}.xlsx")
            : File(
                documents.CreateFinancialReportPdf(report, companyName),
                "application/pdf",
                $"{fileStem}.pdf");
    }

    private async Task<IActionResult> ExportCustomerLedgerAsync(
        long customerId,
        DateTime? startDate,
        DateTime? endDate,
        string? currencyCode,
        string format)
    {
        using var operation = ServerOperation.CreateDocumentScope();
        var ledger = await TransientSqlRetry.ExecuteAsync(
            token => reports.GetCustomerLedgerAsync(
                customerId,
                startDate,
                endDate,
                currencyCode,
                token),
            operation.Token);
        var companyName = await documents.GetCompanyNameAsync(operation.Token);
        var fileStem = $"customer-ledger-{customerId}-{ledger.StartDate:yyyyMMdd}-{ledger.EndDate:yyyyMMdd}";

        return format == "excel"
            ? File(
                documents.CreateCustomerLedgerExcel(ledger, companyName),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"{fileStem}.xlsx")
            : File(
                documents.CreateCustomerLedgerPdf(ledger, companyName),
                "application/pdf",
                $"{fileStem}.pdf");
    }
}
