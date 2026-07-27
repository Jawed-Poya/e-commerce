using ECommerce.Dtos.Documents;
using ECommerce.Dtos.Reports;

namespace ECommerce.Services.Documents;

public interface IFinancialDocumentService
{
    byte[] CreateFinancialReportExcel(FinancialReportSummaryResponse report, string companyName);
    byte[] CreateFinancialReportPdf(FinancialReportSummaryResponse report, string companyName);
    byte[] CreateCustomerLedgerExcel(CustomerLedgerResponse ledger, string companyName);
    byte[] CreateCustomerLedgerPdf(CustomerLedgerResponse ledger, string companyName);
    Task<ReceiptResponse> GetReceiptAsync(string source, long id, CancellationToken cancellationToken = default);
    byte[] CreateReceiptPdf(ReceiptResponse receipt, bool thermal = false);
    byte[] CreateReceiptImage(ReceiptResponse receipt, bool thermal = false);
    Task<string> GetCompanyNameAsync(CancellationToken cancellationToken = default);
}
