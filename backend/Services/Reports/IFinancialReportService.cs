using ECommerce.Dtos.Reports;

namespace ECommerce.Services.Reports;

public interface IFinancialReportService
{
    Task<FinancialReportSummaryResponse> GetReportAsync(
        FinancialReportRequest request,
        bool includeAllResults = false,
        CancellationToken cancellationToken = default);

    Task<CompanyWorthResponse> GetCompanyWorthAsync(
        DateTime? asOfDate,
        DateTime? periodStartDate,
        long? branchId,
        string? currencyCode,
        CancellationToken cancellationToken = default);

    Task<CustomerLedgerResponse> GetCustomerLedgerAsync(
        long customerId,
        DateTime? startDate,
        DateTime? endDate,
        string? currencyCode,
        CancellationToken cancellationToken = default);

    Task<ProductPerformanceReportResponse> GetProductPerformanceAsync(
        long productId,
        DateTime? startDate,
        DateTime? endDate,
        long? branchId,
        string? currencyCode,
        CancellationToken cancellationToken = default);
}
