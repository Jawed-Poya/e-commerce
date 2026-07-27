using ECommerce.Dtos.Reports;
using ECommerce.Entities;
using ECommerce.Services.Documents;
using ECommerce.Services.Reports;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = AppPermissions.FinancialReportsView)]
public sealed class FinancialReportsController(
    IFinancialReportService reports,
    IFinancialDocumentService documents) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<FinancialReportSummaryResponse>>> Get(
        [FromQuery] FinancialReportRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            return Ok(ApiResponse<FinancialReportSummaryResponse>.Ok(
                await TransientSqlRetry.ExecuteAsync(
                    token => reports.GetReportAsync(request, cancellationToken: token),
                    operation.Token)));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("company-worth")]
    public async Task<ActionResult<ApiResponse<CompanyWorthResponse>>> GetCompanyWorth(
        [FromQuery] DateTime? asOfDate,
        [FromQuery] DateTime? periodStartDate,
        [FromQuery] long? branchId,
        [FromQuery] string? currencyCode)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            return Ok(ApiResponse<CompanyWorthResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
                token => reports.GetCompanyWorthAsync(
                    asOfDate, periodStartDate, branchId, currencyCode, token),
                operation.Token)));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("customers/{customerId:long}/ledger")]
    public async Task<ActionResult<ApiResponse<CustomerLedgerResponse>>> GetCustomerLedger(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode)
    {
        try
        {
            using var operation = ServerOperation.CreateReadScope();
            return Ok(ApiResponse<CustomerLedgerResponse>.Ok(await TransientSqlRetry.ExecuteAsync(
                token => reports.GetCustomerLedgerAsync(
                    customerId, startDate, endDate, currencyCode, token),
                operation.Token)));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel([FromQuery] FinancialReportRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateDocumentScope();
            var report = await TransientSqlRetry.ExecuteAsync(
                token => reports.GetReportAsync(request, includeAllResults: true, cancellationToken: token),
                operation.Token);
            var companyName = await documents.GetCompanyNameAsync(operation.Token);
            var content = documents.CreateFinancialReportExcel(report, companyName);
            return File(content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"financial-report-{report.StartDate:yyyyMMdd}-{report.EndDate:yyyyMMdd}.xlsx");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("export/pdf")]
    public async Task<IActionResult> ExportPdf([FromQuery] FinancialReportRequest request)
    {
        try
        {
            using var operation = ServerOperation.CreateDocumentScope();
            var report = await TransientSqlRetry.ExecuteAsync(
                token => reports.GetReportAsync(request, includeAllResults: true, cancellationToken: token),
                operation.Token);
            var companyName = await documents.GetCompanyNameAsync(operation.Token);
            var content = documents.CreateFinancialReportPdf(report, companyName);
            return File(content, "application/pdf",
                $"financial-report-{report.StartDate:yyyyMMdd}-{report.EndDate:yyyyMMdd}.pdf");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("customers/{customerId:long}/ledger/export/excel")]
    public async Task<IActionResult> ExportCustomerLedgerExcel(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode)
    {
        try
        {
            using var operation = ServerOperation.CreateDocumentScope();
            var ledger = await TransientSqlRetry.ExecuteAsync(
                token => reports.GetCustomerLedgerAsync(customerId, startDate, endDate, currencyCode, token),
                operation.Token);
            var companyName = await documents.GetCompanyNameAsync(operation.Token);
            var content = documents.CreateCustomerLedgerExcel(ledger, companyName);
            return File(content,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"customer-ledger-{customerId}-{ledger.StartDate:yyyyMMdd}-{ledger.EndDate:yyyyMMdd}.xlsx");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("customers/{customerId:long}/ledger/export/pdf")]
    public async Task<IActionResult> ExportCustomerLedgerPdf(
        long customerId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? currencyCode)
    {
        try
        {
            using var operation = ServerOperation.CreateDocumentScope();
            var ledger = await TransientSqlRetry.ExecuteAsync(
                token => reports.GetCustomerLedgerAsync(customerId, startDate, endDate, currencyCode, token),
                operation.Token);
            var companyName = await documents.GetCompanyNameAsync(operation.Token);
            var content = documents.CreateCustomerLedgerPdf(ledger, companyName);
            return File(content, "application/pdf",
                $"customer-ledger-{customerId}-{ledger.StartDate:yyyyMMdd}-{ledger.EndDate:yyyyMMdd}.pdf");
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
