namespace ECommerce.Dtos.Reports;

public sealed class FinancialReportRequest
{
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public long? BranchId { get; set; }
    public string? CurrencyCode { get; set; }
    public string? Source { get; set; }
    public string? Status { get; set; }
    public string? Search { get; set; }
    public decimal? MinimumAmount { get; set; }
    public decimal? MaximumAmount { get; set; }
    public string Sort { get; set; } = "date-desc";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed record FinancialReportSummaryResponse(
    DateTime StartDate,
    DateTime EndDate,
    string CurrencyCode,
    IReadOnlyCollection<string> AvailableCurrencies,
    decimal OnlineRevenue,
    decimal ManualSalesRevenue,
    decimal TotalRevenue,
    decimal CostOfGoodsSold,
    decimal GrossProfit,
    decimal GrossMarginPercent,
    decimal Expenses,
    decimal PayrollObligation,
    decimal NetProfit,
    decimal NetMarginPercent,
    decimal CashReceived,
    decimal Purchases,
    decimal PayrollPaid,
    decimal CashPaid,
    decimal NetCashFlow,
    decimal OperatingBalance,
    decimal OutstandingReceivables,
    decimal OutstandingSupplierPayables,
    decimal OutstandingPayroll,
    int OnlineOrders,
    int ManualSales,
    int PurchaseCount,
    int CustomerCount,
    int ProductCount,
    int LowStockProducts,
    decimal AverageOrderValue,
    IReadOnlyCollection<FinancialTrendPoint> Trend,
    IReadOnlyCollection<FinancialTrendPoint> ProfitTrend,
    IReadOnlyCollection<TopProductResponse> TopProducts,
    IReadOnlyCollection<FinancialReportLineResponse> Results,
    int TotalResults,
    int Page,
    int PageSize);

public sealed record FinancialTrendPoint(DateOnly Date, decimal Revenue, decimal Cost, decimal Net);
public sealed record TopProductResponse(long ProductId, string ProductName, decimal Quantity, decimal Revenue);
public sealed record FinancialReportLineResponse(
    string Source,
    long Id,
    string Reference,
    DateTime Date,
    string Description,
    string Status,
    decimal Amount,
    decimal PaidAmount,
    decimal BalanceAmount,
    string CurrencyCode,
    string Direction,
    long? BranchId,
    string? BranchName);

public sealed record CompanyWorthResponse(
    DateTime AsOfDate,
    DateTime PeriodStartDate,
    string CurrencyCode,
    decimal CashPosition,
    decimal InventoryValue,
    decimal AccountsReceivable,
    decimal TotalAssets,
    decimal SupplierPayables,
    decimal PayrollPayables,
    decimal TotalLiabilities,
    decimal NetWorth,
    decimal PeriodRevenue,
    decimal PeriodCostOfGoodsSold,
    decimal PeriodExpenses,
    decimal PeriodPayroll,
    decimal PeriodNetProfit,
    decimal ReturnOnAssetsPercent);

public sealed record LedgerEntryResponse(
    DateTime Date,
    string Type,
    string Reference,
    string Description,
    decimal Debit,
    decimal Credit,
    decimal Balance,
    string CurrencyCode,
    long? SourceId);

public sealed record CustomerLedgerResponse(
    long CustomerId,
    string CustomerName,
    string? Phone,
    DateTime StartDate,
    DateTime EndDate,
    string CurrencyCode,
    decimal OpeningBalance,
    decimal TotalSales,
    decimal TotalPayments,
    decimal ClosingBalance,
    decimal Revenue,
    decimal CostOfGoodsSold,
    decimal GrossProfit,
    IReadOnlyCollection<LedgerEntryResponse> Entries);
