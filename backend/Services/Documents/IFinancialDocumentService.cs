using ECommerce.Dtos.Documents;
using ECommerce.Dtos.Reports;
using ECommerce.Entities.Operations.Contracts;

namespace ECommerce.Services.Documents;

public interface IFinancialDocumentService
{
    byte[] CreateFinancialReportExcel(FinancialReportSummaryResponse report, string companyName);
    byte[] CreateFinancialReportPdf(FinancialReportSummaryResponse report, string companyName);
    byte[] CreateCustomerLedgerExcel(CustomerLedgerResponse ledger, string companyName);
    byte[] CreateCustomerLedgerPdf(CustomerLedgerResponse ledger, string companyName);
    byte[] CreateJournalVoucherPdf(JournalVoucherResponse voucher, string companyName);
    byte[] CreateJournalAccountLedgerPdf(JournalAccountLedgerResponse ledger, string companyName);
    Task<byte[]> CreateProductsPdfAsync(OperationalDocumentFilter filter, CancellationToken cancellationToken = default);
    Task<byte[]> CreateSalesPdfAsync(OperationalDocumentFilter filter, CancellationToken cancellationToken = default);
    Task<byte[]> CreatePurchasesPdfAsync(OperationalDocumentFilter filter, CancellationToken cancellationToken = default);
    Task<byte[]> CreatePayrollPdfAsync(OperationalDocumentFilter filter, CancellationToken cancellationToken = default);
    Task<byte[]> CreateExpensesPdfAsync(OperationalDocumentFilter filter, CancellationToken cancellationToken = default);
    Task<ReceiptResponse> GetReceiptAsync(string source, long id, CancellationToken cancellationToken = default);
    byte[] CreateReceiptPdf(ReceiptResponse receipt, bool thermal = false);
    byte[] CreateReceiptImage(ReceiptResponse receipt, bool thermal = false);
    Task<string> GetCompanyNameAsync(CancellationToken cancellationToken = default);
}
