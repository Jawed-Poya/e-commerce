using System.Globalization;
using ClosedXML.Excel;
using ECommerce.Data;
using ECommerce.Dtos.Documents;
using ECommerce.Dtos.Reports;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Services.Company;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;
using PaymentStatus = API.Entities.Orders.PaymentStatus;

namespace ECommerce.Services.Documents;

public sealed class FinancialDocumentService(ApplicationDbContext context, IBranchContext branchContext) : IFinancialDocumentService
{
    private const string Navy = "#0F172A";
    private const string Slate = "#475569";
    private const string Light = "#F8FAFC";
    private const string Border = "#E2E8F0";
    private const string Green = "#047857";
    private const string Red = "#B91C1C";

    public async Task<string> GetCompanyNameAsync(CancellationToken cancellationToken = default) =>
        await TransientSqlRetry.ExecuteAsync(
            token => context.Companies.AsNoTracking()
                .Select(item => item.Name)
                .SingleOrDefaultAsync(token),
            cancellationToken) ?? "Company";

    public byte[] CreateFinancialReportExcel(FinancialReportSummaryResponse report, string companyName)
    {
        using var workbook = new XLWorkbook();
        workbook.Properties.Title = $"{companyName} financial report";
        workbook.Properties.Company = companyName;
        workbook.Properties.Subject = "Profit, cash flow and transaction report";

        var summary = workbook.AddWorksheet("Summary");
        WriteTitle(summary, $"{companyName} · Financial Report", report.StartDate, report.EndDate, report.CurrencyCode);
        var metrics = new (string Label, decimal Value)[]
        {
            ("Total revenue", report.TotalRevenue),
            ("Cost of goods sold", report.CostOfGoodsSold),
            ("Gross profit", report.GrossProfit),
            ("Operating expenses", report.Expenses),
            ("Payroll obligation", report.PayrollObligation),
            ("Net profit / loss", report.NetProfit),
            ("Cash received", report.CashReceived),
            ("Cash paid", report.CashPaid),
            ("Net cash flow", report.NetCashFlow),
            ("Accounts receivable", report.OutstandingReceivables),
            ("Supplier payables", report.OutstandingSupplierPayables),
            ("Payroll payables", report.OutstandingPayroll)
        };
        for (var index = 0; index < metrics.Length; index++)
        {
            var row = index + 6;
            summary.Cell(row, 1).Value = metrics[index].Label;
            summary.Cell(row, 2).Value = metrics[index].Value;
        }
        summary.Range(6, 1, 6 + metrics.Length - 1, 1).Style.Font.Bold = true;
        summary.Range(6, 2, 6 + metrics.Length - 1, 2).Style.NumberFormat.Format = "#,##0.00;[Red]-#,##0.00";
        summary.Cell(20, 1).Value = "Gross margin";
        summary.Cell(20, 2).Value = report.GrossMarginPercent / 100m;
        summary.Cell(21, 1).Value = "Net margin";
        summary.Cell(21, 2).Value = report.NetMarginPercent / 100m;
        summary.Range(20, 2, 21, 2).Style.NumberFormat.Format = "0.00%";
        summary.Columns(1, 2).AdjustToContents();

        var transactions = workbook.AddWorksheet("Transactions");
        var transactionHeaders = new[] { "Date", "Source", "Reference", "Description", "Status", "Amount", "Paid", "Balance", "Direction", "Branch", "Currency" };
        WriteHeader(transactions, 1, transactionHeaders);
        var transactionRow = 2;
        foreach (var item in report.Results)
        {
            transactions.Cell(transactionRow, 1).Value = item.Date;
            transactions.Cell(transactionRow, 2).Value = item.Source;
            transactions.Cell(transactionRow, 3).Value = item.Reference;
            transactions.Cell(transactionRow, 4).Value = item.Description;
            transactions.Cell(transactionRow, 5).Value = item.Status;
            transactions.Cell(transactionRow, 6).Value = item.Amount;
            transactions.Cell(transactionRow, 7).Value = item.PaidAmount;
            transactions.Cell(transactionRow, 8).Value = item.BalanceAmount;
            transactions.Cell(transactionRow, 9).Value = item.Direction;
            transactions.Cell(transactionRow, 10).Value = item.BranchName ?? "All company";
            transactions.Cell(transactionRow, 11).Value = item.CurrencyCode;
            transactionRow++;
        }
        FormatTable(transactions, transactionRow - 1, 6, 8);

        var cash = workbook.AddWorksheet("Cash Flow");
        WriteHeader(cash, 1, ["Date", "Cash In", "Cash Out", "Net Cash"]);
        var cashRow = 2;
        foreach (var point in report.Trend)
        {
            cash.Cell(cashRow, 1).Value = point.Date.ToDateTime(TimeOnly.MinValue);
            cash.Cell(cashRow, 2).Value = point.Revenue;
            cash.Cell(cashRow, 3).Value = point.Cost;
            cash.Cell(cashRow, 4).Value = point.Net;
            cashRow++;
        }
        FormatTable(cash, cashRow - 1, 2, 4);

        var profit = workbook.AddWorksheet("Profit Trend");
        WriteHeader(profit, 1, ["Date", "Revenue", "COGS + operating cost", "Net profit / loss"]);
        var profitRow = 2;
        foreach (var point in report.ProfitTrend)
        {
            profit.Cell(profitRow, 1).Value = point.Date.ToDateTime(TimeOnly.MinValue);
            profit.Cell(profitRow, 2).Value = point.Revenue;
            profit.Cell(profitRow, 3).Value = point.Cost;
            profit.Cell(profitRow, 4).Value = point.Net;
            profitRow++;
        }
        FormatTable(profit, profitRow - 1, 2, 4);

        var products = workbook.AddWorksheet("Top Products");
        WriteHeader(products, 1, ["Product", "Quantity sold", "Revenue"]);
        var productRow = 2;
        foreach (var product in report.TopProducts)
        {
            products.Cell(productRow, 1).Value = product.ProductName;
            products.Cell(productRow, 2).Value = product.Quantity;
            products.Cell(productRow, 3).Value = product.Revenue;
            productRow++;
        }
        FormatTable(products, productRow - 1, 2, 3);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] CreateCustomerLedgerExcel(CustomerLedgerResponse ledger, string companyName)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Customer Ledger");
        WriteTitle(sheet, $"{companyName} · Customer Ledger", ledger.StartDate, ledger.EndDate, ledger.CurrencyCode);
        sheet.Cell(5, 1).Value = "Customer";
        sheet.Cell(5, 2).Value = ledger.CustomerName;
        sheet.Cell(6, 1).Value = "Phone";
        sheet.Cell(6, 2).Value = ledger.Phone ?? "—";
        sheet.Cell(7, 1).Value = "Opening balance";
        sheet.Cell(7, 2).Value = ledger.OpeningBalance;
        sheet.Cell(8, 1).Value = "Period sales";
        sheet.Cell(8, 2).Value = ledger.TotalSales;
        sheet.Cell(9, 1).Value = "Payments";
        sheet.Cell(9, 2).Value = ledger.TotalPayments;
        sheet.Cell(10, 1).Value = "Closing balance";
        sheet.Cell(10, 2).Value = ledger.ClosingBalance;
        sheet.Cell(11, 1).Value = "Gross profit";
        sheet.Cell(11, 2).Value = ledger.GrossProfit;
        sheet.Range(7, 2, 11, 2).Style.NumberFormat.Format = "#,##0.00;[Red]-#,##0.00";

        WriteHeader(sheet, 13, ["Date", "Type", "Reference", "Description", "Debit", "Credit", "Running balance", "Currency"]);
        var row = 14;
        foreach (var entry in ledger.Entries)
        {
            sheet.Cell(row, 1).Value = entry.Date;
            sheet.Cell(row, 2).Value = entry.Type;
            sheet.Cell(row, 3).Value = entry.Reference;
            sheet.Cell(row, 4).Value = entry.Description;
            sheet.Cell(row, 5).Value = entry.Debit;
            sheet.Cell(row, 6).Value = entry.Credit;
            sheet.Cell(row, 7).Value = entry.Balance;
            sheet.Cell(row, 8).Value = entry.CurrencyCode;
            row++;
        }
        FormatTable(sheet, row - 1, 5, 7, 13);
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] CreateFinancialReportPdf(FinancialReportSummaryResponse report, string companyName) =>
        Document.Create(document =>
        {
            document.Page(page =>
            {
                ConfigurePage(page);
                page.Header().Element(container => ReportHeader(container, companyName, "Financial performance report", report.StartDate, report.EndDate));
                page.Content().PaddingVertical(16).Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Element(container => MetricGrid(container,
                    [
                        ("Revenue", report.TotalRevenue, Green),
                        ("COGS", report.CostOfGoodsSold, Slate),
                        ("Gross profit", report.GrossProfit, report.GrossProfit >= 0 ? Green : Red),
                        ("Net profit / loss", report.NetProfit, report.NetProfit >= 0 ? Green : Red),
                        ("Cash flow", report.NetCashFlow, report.NetCashFlow >= 0 ? Green : Red),
                        ("Receivables", report.OutstandingReceivables, Slate)
                    ], report.CurrencyCode));
                    column.Item().Text($"Gross margin {report.GrossMarginPercent:N2}%  ·  Net margin {report.NetMarginPercent:N2}%")
                        .FontSize(10).FontColor(Slate);
                    column.Item().Text("Transaction ledger").FontSize(15).SemiBold().FontColor(Navy);
                    column.Item().Element(container => TransactionTable(container, report.Results, report.CurrencyCode));
                });
                page.Footer()
                    .AlignCenter()
                    .Text(text =>
                    {
                        text.DefaultTextStyle(style => style.FontSize(8).FontColor(Slate));
                        text.Span("Generated by the company commerce system · ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
            });
        }).GeneratePdf();

    public byte[] CreateCustomerLedgerPdf(CustomerLedgerResponse ledger, string companyName) =>
        Document.Create(document =>
        {
            document.Page(page =>
            {
                ConfigurePage(page);
                page.Header().Element(container => ReportHeader(container, companyName, $"Customer ledger · {ledger.CustomerName}", ledger.StartDate, ledger.EndDate));
                page.Content().PaddingVertical(16).Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Element(container => MetricGrid(container,
                    [
                        ("Opening balance", ledger.OpeningBalance, Slate),
                        ("Sales", ledger.TotalSales, Navy),
                        ("Payments", ledger.TotalPayments, Green),
                        ("Closing balance", ledger.ClosingBalance, ledger.ClosingBalance > 0 ? Red : Green),
                        ("Revenue", ledger.Revenue, Navy),
                        ("Gross profit", ledger.GrossProfit, ledger.GrossProfit >= 0 ? Green : Red)
                    ], ledger.CurrencyCode));
                    column.Item().Text(ledger.Phone is null ? ledger.CustomerName : $"{ledger.CustomerName} · {ledger.Phone}")
                        .FontSize(10).FontColor(Slate);
                    column.Item().Element(container => LedgerTable(container, ledger.Entries, ledger.CurrencyCode));
                });
                page.Footer()
                    .AlignCenter()
                    .Text(text =>
                    {
                        text.DefaultTextStyle(style => style.FontSize(8).FontColor(Slate));
                        text.Span("Customer account statement · ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
            });
        }).GeneratePdf();

    public byte[] CreateJournalVoucherPdf(JournalVoucherResponse voucher, string companyName) =>
        Document.Create(document =>
        {
            document.Page(page =>
            {
                ConfigurePage(page);
                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(column =>
                    {
                        column.Item().Text(companyName).FontSize(18).Bold().FontColor(Navy);
                        column.Item().Text("Journal voucher").FontSize(11).FontColor(Slate);
                    });
                    row.AutoItem().AlignRight().Column(column =>
                    {
                        column.Item().AlignRight().Text(voucher.VoucherNumber).FontSize(13).Bold().FontColor(Navy);
                        column.Item().AlignRight().Text($"{voucher.VoucherDate:yyyy-MM-dd} · {voucher.CurrencyCode} · {voucher.Status}").FontSize(8).FontColor(Slate);
                    });
                });
                page.Content().PaddingVertical(18).Column(column =>
                {
                    column.Spacing(14);
                    column.Item().Element(container => MetricGrid(container,
                    [
                        ("Total debit", voucher.TotalDebit, Navy),
                        ("Total credit", voucher.TotalCredit, Green),
                        ("Difference", Math.Abs(voucher.TotalDebit - voucher.TotalCredit), voucher.TotalDebit == voucher.TotalCredit ? Green : Red)
                    ], voucher.CurrencyCode));
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(); columns.RelativeColumn(); columns.RelativeColumn();
                        });
                        VoucherInfoCell(table.Cell(), "Voucher type", SplitEnum(voucher.VoucherType.ToString()));
                        VoucherInfoCell(table.Cell(), "Origin", voucher.IsSystemGenerated ? "Workflow generated" : "Controlled adjustment");
                        VoucherInfoCell(table.Cell(), "External reference", voucher.ReferenceNumber ?? "—");
                        VoucherInfoCell(table.Cell(), "Source document", voucher.SourceNumber ?? "—");
                        VoucherInfoCell(table.Cell(), "Counterparty", voucher.CounterpartyName ?? "—");
                        VoucherInfoCell(table.Cell(), "Posted by", voucher.OperatorName ?? "System");
                    });
                    column.Item().Column(details =>
                    {
                        details.Spacing(4);
                        details.Item().Text("Business narration").FontSize(8).SemiBold().FontColor(Slate);
                        details.Item().Background(Light).Border(1).BorderColor(Border).Padding(10).Text(voucher.Memo).FontSize(10);
                    });
                    column.Item().Text("Double-entry posting").FontSize(14).SemiBold().FontColor(Navy);
                    column.Item().Element(container => VoucherLinesTable(container, voucher.Lines, voucher.CurrencyCode));
                    if (!string.IsNullOrWhiteSpace(voucher.ReversalReason))
                        column.Item().Background("#FEF2F2").Border(1).BorderColor("#FECACA").Padding(10)
                            .Text($"Reversal reason: {voucher.ReversalReason}").FontColor(Red);
                    column.Item().PaddingTop(22).Row(row =>
                    {
                        SignatureLine(row.RelativeItem(), "Prepared by");
                        row.ConstantItem(18);
                        SignatureLine(row.RelativeItem(), "Checked by");
                        row.ConstantItem(18);
                        SignatureLine(row.RelativeItem(), "Approved by");
                    });
                });
                page.Footer().AlignCenter().Text(text =>
                {
                    text.DefaultTextStyle(style => style.FontSize(8).FontColor(Slate));
                    text.Span("Immutable accounting record · Generated ");
                    text.Span($"{DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC · ");
                    text.CurrentPageNumber();
                    text.Span(" / ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

    public byte[] CreateJournalAccountLedgerPdf(JournalAccountLedgerResponse ledger, string companyName) =>
        Document.Create(document =>
        {
            document.Page(page =>
            {
                ConfigurePage(page);
                page.Header().Element(container => ReportHeader(
                    container,
                    companyName,
                    $"General ledger · {ledger.AccountCode} · {ledger.AccountName}",
                    ledger.StartDate.ToDateTime(TimeOnly.MinValue),
                    ledger.EndDate.ToDateTime(TimeOnly.MinValue)));
                page.Content().PaddingVertical(16).Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Element(container => MetricGrid(container,
                    [
                        ("Opening balance", ledger.OpeningBalance, Slate),
                        ("Period debit", ledger.PeriodDebit, Navy),
                        ("Period credit", ledger.PeriodCredit, Green),
                        ("Closing balance", ledger.ClosingBalance, ledger.ClosingBalance >= 0 ? Navy : Red)
                    ], ledger.CurrencyCode));
                    column.Item().Text($"{ledger.AccountCode} · {ledger.AccountName} · {ledger.CurrencyCode}")
                        .FontSize(10).SemiBold().FontColor(Slate);
                    column.Item().Element(container => JournalLedgerTable(container, ledger.Entries, ledger.CurrencyCode));
                    column.Item().PaddingTop(18).Row(row =>
                    {
                        SignatureLine(row.RelativeItem(), "Prepared by");
                        row.ConstantItem(22);
                        SignatureLine(row.RelativeItem(), "Checked by");
                    });
                });
                page.Footer().AlignCenter().Text(text =>
                {
                    text.DefaultTextStyle(style => style.FontSize(8).FontColor(Slate));
                    text.Span("General ledger statement · ");
                    text.CurrentPageNumber();
                    text.Span(" / ");
                    text.TotalPages();
                });
            });
        }).GeneratePdf();

    public async Task<byte[]> CreateProductsPdfAsync(
        OperationalDocumentFilter filter,
        CancellationToken cancellationToken = default)
    {
        filter = filter with { BranchId = ResolveBranchId(filter.BranchId) };
        var company = await GetDocumentCompanyAsync(cancellationToken);
        var search = CleanSearch(filter.Search);
        var productsQuery = context.Products.AsNoTracking();
        if (search is not null)
            productsQuery = productsQuery.Where(item =>
                item.Name.Contains(search) ||
                (item.Barcode != null && item.Barcode.Contains(search)) ||
                item.Category.Name.Contains(search));

        IQueryable<API.Entities.Products.Product> orderedProducts = productsQuery.OrderBy(item => item.Name);
        var maxRows = NormalizeDocumentRowLimit(filter.MaxRows);
        if (maxRows.HasValue)
            orderedProducts = orderedProducts.Take(maxRows.Value);

        var products = await orderedProducts
            .Select(item => new ProductDocumentRow(
                item.Name,
                item.Barcode,
                item.Category.Name,
                item.Brand != null ? item.Brand.Name : null,
                item.Unit != null ? item.Unit.Name : null,
                item.UsesDisplayStock,
                item.DisplayStockQuantity,
                context.ProductInventories
                    .Where(stock => stock.ProductId == item.Id &&
                        (!filter.BranchId.HasValue || stock.BranchId == filter.BranchId.Value))
                    .Sum(stock => (decimal?)(stock.Quantity - stock.ReservedQuantity)) ?? 0,
                context.ProductInventories
                    .Where(stock => stock.ProductId == item.Id &&
                        (!filter.BranchId.HasValue || stock.BranchId == filter.BranchId.Value))
                    .Max(stock => (decimal?)stock.MinimumQuantity) ?? 0,
                context.ProductPrices
                    .Where(price => price.ProductId == item.Id)
                    .OrderBy(price => price.CustomerTypeId)
                    .Select(price => (decimal?)(price.SalePrice ?? price.RegularPrice))
                    .FirstOrDefault(),
                item.IsActive,
                item.IsFeatured))
            .ToArrayAsync(cancellationToken);

        var currency = company.CurrencyCode;
        var inventoryProducts = products.Where(item => !item.UsesDisplayStock).ToArray();
        var lowStock = inventoryProducts.Count(item => item.Stock <= item.MinimumStock);
        var model = new OperationalPdfModel(
            company,
            "Product catalog and stock report",
            filter.BranchId.HasValue ? $"Branch stock view · Branch #{filter.BranchId.Value}" : "Company-wide catalog and available stock",
            null,
            [
                new("Products", products.Length.ToString("N0"), Navy),
                new("Active", products.Count(item => item.IsActive).ToString("N0"), Green),
                new("Low stock", lowStock.ToString("N0"), lowStock > 0 ? Red : Green),
                new("Physical units", inventoryProducts.Sum(item => item.Stock).ToString("N2"), Slate),
                new("Inventory value", Money(inventoryProducts.Sum(item => item.Stock * (item.Price ?? 0)), currency), Navy)
            ],
            ["Product", "Barcode", "Category", "Brand / unit", "Stock", "Minimum", "Price", "Status"],
            products.Select(item => new[]
            {
                item.Name,
                item.Barcode ?? "—",
                item.Category,
                JoinNonEmpty(item.Brand, item.Unit),
                item.UsesDisplayStock ? $"{(item.DisplayStockQuantity ?? 0):N2} display" : item.Stock.ToString("N2"),
                item.UsesDisplayStock ? "—" : item.MinimumStock.ToString("N2"),
                item.Price.HasValue ? Money(item.Price.Value, currency) : "Not priced",
                item.UsesDisplayStock
                    ? item.IsActive ? "Display stock · Active" : "Display stock · Inactive"
                    : item.IsActive ? item.IsFeatured ? "Active · Featured" : "Active" : "Inactive"
            }).ToArray(),
            [2.3f, 1.1f, 1.25f, 1.15f, .75f, .75f, 1f, 1f],
            [4, 5, 6]);

        return CreateOperationalPdf(model);
    }

    public async Task<byte[]> CreateSalesPdfAsync(
        OperationalDocumentFilter filter,
        CancellationToken cancellationToken = default)
    {
        filter = filter with { BranchId = ResolveBranchId(filter.BranchId) };
        var company = await GetDocumentCompanyAsync(cancellationToken);
        var (start, end) = ResolvePeriod(filter, 30);
        var startDateTime = start.ToDateTime(TimeOnly.MinValue);
        var endExclusive = end.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var currency = ResolveCurrency(filter.CurrencyCode, company.CurrencyCode);
        var search = CleanSearch(filter.Search);

        var onlineQuery = context.Orders.AsNoTracking()
            .Where(item => item.CreatedAt >= startDateTime && item.CreatedAt < endExclusive &&
                item.Status != OrderStatus.Cancelled && item.Currency == currency &&
                (!filter.BranchId.HasValue || item.BranchId == filter.BranchId.Value));
        if (search is not null)
            onlineQuery = onlineQuery.Where(item =>
                item.OrderNumber.Contains(search) ||
                item.Customer.FirstName.Contains(search) ||
                (item.Customer.LastName != null && item.Customer.LastName.Contains(search)) ||
                item.Customer.Phone.Contains(search));

        var onlineProjection = await onlineQuery
            .Select(item => new
            {
                item.CreatedAt,
                item.OrderNumber,
                Customer = (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim(),
                item.Total,
                item.PaymentStatus,
                PaymentSum = item.Payments
                    .Where(payment => payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded)
                    .Sum(payment => (decimal?)payment.Amount),
                Cost = item.Items.Sum(line => (decimal?)(line.Quantity * line.UnitCost)) ?? 0,
                Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault()
            })
            .ToArrayAsync(cancellationToken);

        var online = onlineProjection
            .Select(item => new SalesDocumentRow(
                item.CreatedAt,
                item.OrderNumber,
                "Online order",
                item.Customer,
                item.Total,
                item.PaymentSum ?? (item.PaymentStatus == PaymentStatus.Paid ? item.Total : 0),
                item.Cost,
                item.PaymentStatus.ToString(),
                item.Branch))
            .ToArray();

        var manualQuery = context.InventorySales.AsNoTracking()
            .Where(item => item.SaleDate >= start && item.SaleDate <= end &&
                item.CurrencyCode == currency &&
                (!filter.BranchId.HasValue || item.BranchId == filter.BranchId.Value));
        if (search is not null)
            manualQuery = manualQuery.Where(item =>
                item.SaleNumber.Contains(search) ||
                (item.CustomerName != null && item.CustomerName.Contains(search)) ||
                (item.CustomerPhone != null && item.CustomerPhone.Contains(search)) ||
                (item.Customer != null &&
                    (item.Customer.FirstName.Contains(search) ||
                     (item.Customer.LastName != null && item.Customer.LastName.Contains(search)) ||
                     item.Customer.Phone.Contains(search))));

        var manualProjection = await manualQuery
            .Select(item => new
            {
                item.SaleDate,
                item.SaleNumber,
                Customer = item.Customer != null
                    ? (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim()
                    : item.CustomerName ?? "Walk-in customer",
                item.Total,
                item.PaidAmount,
                Cost = item.Items.Sum(line => (decimal?)(line.Quantity * line.UnitCost)) ?? 0,
                item.PaymentStatus,
                Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault()
            })
            .ToArrayAsync(cancellationToken);

        var manual = manualProjection
            .Select(item => new SalesDocumentRow(
                item.SaleDate.ToDateTime(TimeOnly.MinValue),
                item.SaleNumber,
                "Counter sale",
                item.Customer,
                item.Total,
                item.PaidAmount,
                item.Cost,
                item.PaymentStatus.ToString(),
                item.Branch))
            .ToArray();

        var rows = online.Concat(manual).OrderByDescending(item => item.Date).ToArray();
        var revenue = rows.Sum(item => item.Total);
        var paid = rows.Sum(item => item.Paid);
        var cost = rows.Sum(item => item.Cost);
        var profit = revenue - cost;
        var model = new OperationalPdfModel(
            company,
            "Sales performance report",
            "Online orders and counter sales in one audited view",
            (start, end),
            [
                new("Sales", rows.Length.ToString("N0"), Navy),
                new("Revenue", Money(revenue, currency), Green),
                new("Paid", Money(paid, currency), Green),
                new("Outstanding", Money(Math.Max(0, revenue - paid), currency), revenue > paid ? Red : Green),
                new("Gross profit", Money(profit, currency), profit >= 0 ? Green : Red)
            ],
            ["Date", "Reference", "Channel", "Customer", "Total", "Paid", "Balance", "Status", "Branch"],
            rows.Select(item => new[]
            {
                item.Date.ToString("yyyy-MM-dd"),
                item.Reference,
                item.Channel,
                item.Customer,
                Money(item.Total, currency),
                Money(item.Paid, currency),
                Money(Math.Max(0, item.Total - item.Paid), currency),
                item.Status,
                item.Branch ?? "Company"
            }).ToArray(),
            [.75f, 1f, .9f, 1.65f, 1f, 1f, 1f, .9f, 1f],
            [4, 5, 6]);

        return CreateOperationalPdf(model);
    }

    public async Task<byte[]> CreatePurchasesPdfAsync(
        OperationalDocumentFilter filter,
        CancellationToken cancellationToken = default)
    {
        filter = filter with { BranchId = ResolveBranchId(filter.BranchId) };
        var company = await GetDocumentCompanyAsync(cancellationToken);
        var (start, end) = ResolvePeriod(filter, 30);
        var currency = ResolveCurrency(filter.CurrencyCode, company.CurrencyCode);
        var search = CleanSearch(filter.Search);
        var purchaseQuery = context.Purchases.AsNoTracking()
            .Where(item => item.PurchaseDate >= start && item.PurchaseDate <= end &&
                item.CurrencyCode == currency && item.Status != PurchaseStatus.Cancelled &&
                (!filter.BranchId.HasValue || item.BranchId == filter.BranchId.Value));
        if (search is not null)
            purchaseQuery = purchaseQuery.Where(item =>
                item.PurchaseNumber.Contains(search) ||
                (item.ReferenceNumber != null && item.ReferenceNumber.Contains(search)) ||
                (item.Supplier != null && item.Supplier.Name.Contains(search)) ||
                item.Items.Any(line =>
                    line.Product.Name.Contains(search) ||
                    (line.Product.Strength != null && line.Product.Strength.Contains(search)) ||
                    (line.Product.Barcode != null && line.Product.Barcode.Contains(search)) ||
                    (line.LotNumber != null && line.LotNumber.Contains(search))));

        var purchases = await purchaseQuery
            .OrderByDescending(item => item.PurchaseDate)
            .Select(item => new PurchaseDocumentRow(
                item.PurchaseDate,
                item.PurchaseNumber,
                item.Supplier != null ? item.Supplier.Name : "Direct purchase",
                item.Items.Count,
                item.Total,
                item.PaidAmount,
                item.PaymentStatus.ToString(),
                item.Status.ToString(),
                context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault()))
            .ToArrayAsync(cancellationToken);

        var lineQuery = context.PurchaseItems.AsNoTracking()
            .Where(line => line.Purchase.PurchaseDate >= start && line.Purchase.PurchaseDate <= end &&
                line.Purchase.CurrencyCode == currency && line.Purchase.Status != PurchaseStatus.Cancelled &&
                (!filter.BranchId.HasValue || line.Purchase.BranchId == filter.BranchId.Value));
        if (search is not null)
            lineQuery = lineQuery.Where(line =>
                line.Purchase.PurchaseNumber.Contains(search) ||
                (line.Purchase.ReferenceNumber != null && line.Purchase.ReferenceNumber.Contains(search)) ||
                (line.Purchase.Supplier != null && line.Purchase.Supplier.Name.Contains(search)) ||
                line.Product.Name.Contains(search) ||
                (line.Product.Strength != null && line.Product.Strength.Contains(search)) ||
                (line.Product.Barcode != null && line.Product.Barcode.Contains(search)) ||
                (line.LotNumber != null && line.LotNumber.Contains(search)));

        var lines = await lineQuery
            .OrderByDescending(line => line.Purchase.PurchaseDate)
            .ThenByDescending(line => line.PurchaseId)
            .ThenBy(line => line.Id)
            .Select(line => new PurchaseLineDocumentRow(
                line.Purchase.PurchaseDate,
                line.Purchase.PurchaseNumber,
                line.Purchase.Supplier != null ? line.Purchase.Supplier.Name : "Direct purchase",
                line.Product.Name,
                line.Product.Strength,
                line.Product.Barcode,
                line.LotNumber,
                line.ExpireDate,
                line.EnteredQuantity,
                line.SelectedUnitName,
                line.EnteredUnitCost,
                line.LineTotal,
                context.Branches.Where(branch => branch.Id == line.Purchase.BranchId).Select(branch => branch.Name).FirstOrDefault()))
            .ToArrayAsync(cancellationToken);

        var total = purchases.Sum(item => item.Total);
        var paid = purchases.Sum(item => item.Paid);
        var model = new OperationalPdfModel(
            company,
            "Purchases and received items",
            "Supplier documents with product, strength, lot, expiry, quantity, and line cost",
            (start, end),
            [
                new("Purchases", purchases.Length.ToString("N0"), Navy),
                new("Purchased", Money(total, currency), Navy),
                new("Paid", Money(paid, currency), Green),
                new("Supplier balance", Money(Math.Max(0, total - paid), currency), total > paid ? Red : Green),
                new("Item lines", lines.Length.ToString("N0"), Slate)
            ],
            ["Date", "Purchase", "Supplier", "Product / strength", "Lot", "Expiry", "Qty / unit", "Unit cost", "Line total", "Branch"],
            lines.Select(item => new[]
            {
                item.Date.ToString("yyyy-MM-dd"),
                item.Reference,
                item.Supplier,
                item.Strength is null ? item.Product : $"{item.Product} · {item.Strength}",
                item.LotNumber ?? "—",
                item.ExpireDate?.ToString("yyyy-MM-dd") ?? "—",
                $"{item.Quantity:N3} {item.UnitName ?? "base"}",
                Money(item.UnitCost, currency),
                Money(item.LineTotal, currency),
                item.Branch ?? "Company"
            }).ToArray(),
            [.65f, .9f, 1.2f, 1.65f, .85f, .8f, .95f, .9f, .95f, .9f],
            [6, 7, 8]);

        return CreateOperationalPdf(model);
    }

    public async Task<byte[]> CreatePayrollPdfAsync(
        OperationalDocumentFilter filter,
        CancellationToken cancellationToken = default)
    {
        filter = filter with { BranchId = ResolveBranchId(filter.BranchId) };
        var company = await GetDocumentCompanyAsync(cancellationToken);
        var (start, end) = ResolvePeriod(filter, 90);
        var currency = ResolveCurrency(filter.CurrencyCode, company.CurrencyCode);
        var search = CleanSearch(filter.Search);
        var query = context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.PaidDate >= start && item.PaidDate <= end &&
                item.CurrencyCode == currency &&
                (!filter.BranchId.HasValue || item.BranchId == filter.BranchId.Value));
        if (search is not null)
            query = query.Where(item =>
                item.Staff.FullName.Contains(search) ||
                item.Staff.EmployeeNumber.Contains(search) ||
                (item.Staff.Department != null && item.Staff.Department.Contains(search)) ||
                (item.Staff.Position != null && item.Staff.Position.Contains(search)));

        var salaries = await query
            .OrderByDescending(item => item.PeriodYear)
            .ThenByDescending(item => item.PeriodMonth)
            .ThenBy(item => item.Staff.FullName)
            .Select(item => new PayrollDocumentRow(
                item.Staff.EmployeeNumber,
                item.Staff.FullName,
                item.Staff.Department,
                item.Staff.Position,
                item.PeriodYear,
                item.PeriodMonth,
                item.BaseSalary,
                item.Bonus,
                item.Deduction,
                item.NetAmount,
                item.PaidAmount,
                item.PaymentStatus.ToString()))
            .ToArrayAsync(cancellationToken);

        var net = salaries.Sum(item => item.Net);
        var paid = salaries.Sum(item => item.Paid);
        var model = new OperationalPdfModel(
            company,
            "Employee payroll report",
            "Salary obligations, adjustments, paid amounts, and outstanding payroll",
            (start, end),
            [
                new("Salary records", salaries.Length.ToString("N0"), Navy),
                new("Net payroll", Money(net, currency), Navy),
                new("Paid", Money(paid, currency), Green),
                new("Outstanding", Money(Math.Max(0, net - paid), currency), net > paid ? Red : Green),
                new("Bonuses", Money(salaries.Sum(item => item.Bonus), currency), Slate),
                new("Deductions", Money(salaries.Sum(item => item.Deduction), currency), Slate)
            ],
            ["Employee", "Name", "Department / position", "Period", "Base", "Bonus", "Deduction", "Net", "Paid", "Balance", "Status"],
            salaries.Select(item => new[]
            {
                item.EmployeeNumber,
                item.Name,
                JoinNonEmpty(item.Department, item.Position),
                $"{item.Year:D4}-{item.Month:D2}",
                Money(item.BaseSalary, currency),
                Money(item.Bonus, currency),
                Money(item.Deduction, currency),
                Money(item.Net, currency),
                Money(item.Paid, currency),
                Money(Math.Max(0, item.Net - item.Paid), currency),
                item.Status
            }).ToArray(),
            [.7f, 1.35f, 1.35f, .65f, .9f, .8f, .8f, .9f, .9f, .9f, .8f],
            [4, 5, 6, 7, 8, 9]);

        return CreateOperationalPdf(model);
    }

    public async Task<byte[]> CreateExpensesPdfAsync(
        OperationalDocumentFilter filter,
        CancellationToken cancellationToken = default)
    {
        filter = filter with { BranchId = ResolveBranchId(filter.BranchId) };
        var company = await GetDocumentCompanyAsync(cancellationToken);
        var (start, end) = ResolvePeriod(filter, 30);
        var currency = ResolveCurrency(filter.CurrencyCode, company.CurrencyCode);
        var search = CleanSearch(filter.Search);
        var query = context.Expenses.AsNoTracking()
            .Where(item => item.ExpenseDate >= start && item.ExpenseDate <= end &&
                item.CurrencyCode == currency &&
                (!filter.BranchId.HasValue || item.BranchId == filter.BranchId.Value));
        if (search is not null)
            query = query.Where(item =>
                item.Description.Contains(search) ||
                (item.Vendor != null && item.Vendor.Contains(search)) ||
                (item.ReferenceNumber != null && item.ReferenceNumber.Contains(search)) ||
                (item.GeneralTypeCategory != null && item.GeneralTypeCategory.Name.Contains(search)) ||
                (item.Category != null && item.Category.Name.Contains(search)));

        var expenses = await query
            .OrderByDescending(item => item.ExpenseDate)
            .Select(item => new ExpenseDocumentRow(
                item.ExpenseDate,
                item.GeneralTypeCategory != null
                    ? item.GeneralTypeCategory.Name
                    : item.Category != null ? item.Category.Name : "Uncategorized",
                item.Description,
                item.Vendor,
                item.PaymentMethod,
                item.ReferenceNumber,
                item.Amount,
                context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault()))
            .ToArrayAsync(cancellationToken);

        var total = expenses.Sum(item => item.Amount);
        var byCategory = expenses.GroupBy(item => item.Category).OrderByDescending(group => group.Sum(item => item.Amount)).FirstOrDefault();
        var model = new OperationalPdfModel(
            company,
            "Operating expenses report",
            "Categorized business costs and payment audit trail",
            (start, end),
            [
                new("Expense records", expenses.Length.ToString("N0"), Navy),
                new("Total expenses", Money(total, currency), Red),
                new("Average expense", Money(expenses.Length == 0 ? 0 : total / expenses.Length, currency), Slate),
                new("Largest category", byCategory is null ? "—" : $"{byCategory.Key} · {Money(byCategory.Sum(item => item.Amount), currency)}", Navy)
            ],
            ["Date", "Category", "Description", "Vendor", "Method", "Reference", "Amount", "Branch"],
            expenses.Select(item => new[]
            {
                item.Date.ToString("yyyy-MM-dd"),
                item.Category,
                item.Description,
                item.Vendor ?? "—",
                item.PaymentMethod,
                item.Reference ?? "—",
                Money(item.Amount, currency),
                item.Branch ?? "Company"
            }).ToArray(),
            [.75f, 1.1f, 2.2f, 1.1f, .85f, 1f, 1f, 1f],
            [6]);

        return CreateOperationalPdf(model);
    }

    public async Task<ReceiptResponse> GetReceiptAsync(string source, long id, CancellationToken cancellationToken = default)
    {
        var company = await TransientSqlRetry.ExecuteAsync(
            token => context.Companies.AsNoTracking()
                .Select(item => new { item.Name, item.LegalName, item.Phone, item.Email, item.Address, item.LogoUrl })
                .SingleOrDefaultAsync(token),
            cancellationToken)
            ?? throw new InvalidOperationException("Company profile has not been configured.");

        var normalizedSource = NormalizeReceiptSource(source);

        if (normalizedSource == "orders")
        {
            var order = await context.Orders.AsNoTracking()
                .Where(item => item.Id == id &&
                    (!branchContext.BranchId.HasValue ||
                     item.BranchId == branchContext.BranchId.Value ||
                     item.BranchId == null))
                .Select(item => new
                {
                    item.Id, item.OrderNumber, item.CreatedAt, item.Currency, item.CustomerId, item.Subtotal, item.DiscountTotal,
                    item.TaxTotal, item.ShippingTotal, item.Total, item.PaymentStatus, item.Notes,
                    Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault(),
                    CustomerName = (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim(),
                    item.Customer.Phone, item.Customer.Address,
                    Paid = item.Payments.Where(payment => payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded)
                        .Sum(payment => (decimal?)payment.Amount) ?? 0,
                    PaymentMethod = item.Payments.OrderByDescending(payment => payment.PaidAt).Select(payment => payment.Provider).FirstOrDefault(),
                    Items = item.Items.Select(line => new ReceiptItemResponse(line.ProductName, line.OrderedQuantity > 0 ? line.OrderedQuantity : line.Quantity, line.SelectedUnitName, line.SellingUnitPrice > 0 ? line.SellingUnitPrice : line.UnitPrice, line.Discount, line.Tax, (line.OrderedQuantity > 0 ? line.OrderedQuantity * line.SellingUnitPrice : line.Quantity * line.UnitPrice) - line.Discount + line.Tax)).ToArray()
                }).SingleOrDefaultAsync(cancellationToken)
                ?? throw new KeyNotFoundException("Order was not found.");

            var paid = order.Paid > 0 ? order.Paid : order.PaymentStatus == PaymentStatus.Paid ? order.Total : 0;
            var previousBalance = await GetCustomerBalanceBeforeAsync(order.CustomerId, order.CreatedAt, order.Currency, "orders", order.Id, cancellationToken);
            return new ReceiptResponse("orders", order.Id, order.OrderNumber, order.CreatedAt, company.Name, company.LegalName,
                company.Phone, company.Email, company.Address, company.LogoUrl, order.Branch, order.CustomerName,
                order.Phone, order.Address, order.Currency, order.Subtotal, order.DiscountTotal, order.TaxTotal,
                order.ShippingTotal, order.Total, paid, Math.Max(0, order.Total - paid), previousBalance, order.PaymentStatus.ToString(),
                order.PaymentMethod, order.Notes, order.Items);
        }

        if (normalizedSource == "manual-sales")
        {
            var sale = await context.InventorySales.AsNoTracking()
                .Where(item => item.Id == id &&
                    (!branchContext.BranchId.HasValue ||
                     item.BranchId == branchContext.BranchId.Value ||
                     item.BranchId == null))
                .Select(item => new
                {
                    item.Id, item.SaleNumber, item.SaleDate, item.CreatedAt, item.CustomerId, item.CurrencyCode, item.Subtotal, item.Discount, item.Tax,
                    item.Total, item.ReturnedAmount, item.PaidAmount, item.PaymentStatus, item.PaymentMethod, item.Notes,
                    Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault(),
                    CustomerName = item.Customer != null
                        ? (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim()
                        : item.CustomerName ?? "Walk-in customer",
                    CustomerPhone = item.Customer != null ? item.Customer.Phone : item.CustomerPhone,
                    CustomerAddress = item.Customer != null ? item.Customer.Address : null,
                    Items = item.Items.Select(line => new ReceiptItemResponse(line.Product.Strength == null ? line.Product.Name : line.Product.Name + " — " + line.Product.Strength, line.EnteredQuantity > 0 ? line.EnteredQuantity : line.Quantity, line.SelectedUnitName ?? (line.Product.Unit != null ? line.Product.Unit.Name : null), line.EnteredUnitPrice > 0 ? line.EnteredUnitPrice : line.UnitPrice, 0, 0, line.LineTotal)).ToArray()
                }).SingleOrDefaultAsync(cancellationToken)
                ?? throw new KeyNotFoundException("Manual sale was not found.");

            var previousBalance = sale.CustomerId.HasValue
                ? await GetCustomerBalanceBeforeAsync(sale.CustomerId.Value, sale.CreatedAt, sale.CurrencyCode, "manual-sales", sale.Id, cancellationToken)
                : 0;
            return new ReceiptResponse("manual-sales", sale.Id, sale.SaleNumber, sale.SaleDate.ToDateTime(TimeOnly.MinValue),
                company.Name, company.LegalName, company.Phone, company.Email, company.Address, company.LogoUrl,
                sale.Branch, sale.CustomerName, sale.CustomerPhone, sale.CustomerAddress, sale.CurrencyCode,
                sale.Subtotal, sale.Discount, sale.Tax, 0, sale.Total - sale.ReturnedAmount, sale.PaidAmount,
                Math.Max(0, sale.Total - sale.ReturnedAmount - sale.PaidAmount), previousBalance, sale.PaymentStatus.ToString(), sale.PaymentMethod,
                sale.Notes, sale.Items);
        }

        throw new ArgumentException("Receipt source must be 'orders' or 'manual-sales'.");
    }

    private static string NormalizeReceiptSource(string source) =>
        source.Trim().ToLowerInvariant() switch
        {
            "order" or "orders" => "orders",
            "sale" or "sales" or "manual-sale" or "manual-sales" => "manual-sales",
            _ => throw new ArgumentException("Receipt source must be 'orders' or 'manual-sales'.")
        };

    private async Task<decimal> GetCustomerBalanceBeforeAsync(
        long customerId,
        DateTime before,
        string currency,
        string source,
        long currentId,
        CancellationToken cancellationToken)
    {
        var orders = await context.Orders.AsNoTracking()
            .Where(item => item.CustomerId == customerId && item.Currency == currency &&
                item.Status != OrderStatus.Cancelled && item.Status != OrderStatus.Returned &&
                item.CreatedAt < before && (source != "orders" || item.Id != currentId))
            .Select(item => new
            {
                item.Total,
                Paid = item.Payments.Where(payment => payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded)
                    .Sum(payment => (decimal?)payment.Amount) ?? (item.PaymentStatus == PaymentStatus.Paid ? item.Total : 0)
            })
            .ToListAsync(cancellationToken);
        var manualRows = await context.InventorySales.AsNoTracking()
            .Where(item => item.CustomerId == customerId && item.CurrencyCode == currency &&
                item.CreatedAt < before && (source != "manual-sales" || item.Id != currentId))
            .Select(item => new
            {
                item.Total,
                Returned = item.Returns
                    .Where(salesReturn => salesReturn.CreatedAt < before)
                    .Sum(salesReturn => (decimal?)salesReturn.Total) ?? 0,
                Paid = item.Payments
                    .Where(payment => payment.CreatedAt < before)
                    .Sum(payment => (decimal?)payment.Amount) ?? 0
            })
            .ToListAsync(cancellationToken);
        var manual = manualRows.Sum(item => Math.Max(0, item.Total - item.Returned - item.Paid));
        return orders.Sum(item => Math.Max(0, item.Total - item.Paid)) + manual;
    }

    private long? ResolveBranchId(long? requestedBranchId)
    {
        if (!branchContext.BranchId.HasValue)
            return requestedBranchId;

        if (requestedBranchId.HasValue &&
            requestedBranchId.Value != branchContext.BranchId.Value)
            throw new UnauthorizedAccessException(
                "You can export documents only for your assigned branch.");

        return branchContext.BranchId.Value;
    }

    public byte[] CreateReceiptPdf(ReceiptResponse receipt, bool thermal = false) =>
        ReceiptDocument(receipt, thermal).GeneratePdf();

    public byte[] CreateReceiptImage(ReceiptResponse receipt, bool thermal = false)
    {
        // Images use a continuous page so the complete receipt is returned as one PNG.
        // A slightly wider non-thermal image is easier to share while the thermal mode
        // remains exactly 80 mm for receipt printers.
        var document = ReceiptImageDocument(receipt, thermal);
        var image = document.GenerateImages(new ImageGenerationSettings
        {
            ImageFormat = ImageFormat.Png,
            ImageCompressionQuality = ImageCompressionQuality.Best,
            RasterDpi = 144
        }).FirstOrDefault();

        return image ?? throw new InvalidOperationException("The receipt image could not be generated.");
    }

    private static IDocument ReceiptDocument(ReceiptResponse receipt, bool thermal) => Document.Create(document =>
    {
        document.Page(page =>
        {
            if (thermal)
            {
                ConfigureThermalPage(page, 80);
                page.Content().Element(container => ComposeThermalReceipt(container, receipt));
                return;
            }

            page.Size(PageSizes.A4);
            page.Margin(22, Unit.Millimetre);
            page.DefaultTextStyle(text => text.FontFamily(Fonts.Arial).FontSize(9).FontColor(Navy));
            page.Content().Element(container => ComposeA4Receipt(container, receipt));
            page.Footer().AlignCenter().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(8).FontColor(Slate));
                text.Span("Receipt · ");
                text.CurrentPageNumber();
                text.Span(" / ");
                text.TotalPages();
            });
        });
    });

    private static IDocument ReceiptImageDocument(ReceiptResponse receipt, bool thermal) => Document.Create(document =>
    {
        document.Page(page =>
        {
            ConfigureThermalPage(page, thermal ? 80 : 110);
            page.Content().Element(container => ComposeThermalReceipt(container, receipt));
        });
    });

    private static void ConfigureThermalPage(PageDescriptor page, float widthMillimetres)
    {
        page.ContinuousSize(widthMillimetres, Unit.Millimetre);
        page.MarginHorizontal(4, Unit.Millimetre);
        page.MarginVertical(5, Unit.Millimetre);
        page.DefaultTextStyle(text => text.FontFamily(Fonts.Arial).FontSize(8).FontColor(Navy));
    }

    private static void ComposeA4Receipt(IContainer container, ReceiptResponse receipt)
    {
        container.Column(column =>
        {
            column.Spacing(12);
            column.Item().Element(header => ReceiptIdentity(header, receipt, 22, 9));
            column.Item().LineHorizontal(1).LineColor(Border);
            column.Item().Element(details => ReceiptDetails(details, receipt, compact: false));
            column.Item().Element(table => ReceiptItemsTable(table, receipt, compact: false));
            column.Item().LineHorizontal(1).LineColor(Border);
            column.Item().AlignRight().MaxWidth(260).Element(total => ReceiptTotals(total, receipt, compact: false));
            column.Item().Element(payment => ReceiptPayment(payment, receipt, compact: false));
            column.Item().Element(footer => ReceiptNotesAndFooter(footer, receipt, compact: false));
        });
    }

    private static void ComposeThermalReceipt(IContainer container, ReceiptResponse receipt)
    {
        container.Column(column =>
        {
            column.Spacing(7);
            column.Item().Element(header => ReceiptIdentity(header, receipt, 15, 8));
            column.Item().LineHorizontal(1).LineColor(Border);
            column.Item().Element(details => ReceiptDetails(details, receipt, compact: true));
            column.Item().Element(table => ReceiptItemsTable(table, receipt, compact: true));
            column.Item().LineHorizontal(1).LineColor(Border);
            column.Item().Element(total => ReceiptTotals(total, receipt, compact: true));
            column.Item().Element(payment => ReceiptPayment(payment, receipt, compact: true));
            column.Item().Element(footer => ReceiptNotesAndFooter(footer, receipt, compact: true));
        });
    }

    private static void ReceiptIdentity(IContainer container, ReceiptResponse receipt, float companyFontSize, float subtitleFontSize)
    {
        container.AlignCenter().Column(column =>
        {
            column.Spacing(2);
            column.Item().AlignCenter().Text(receipt.CompanyName).FontSize(companyFontSize).Bold();
            if (!string.IsNullOrWhiteSpace(receipt.LegalName) &&
                !string.Equals(receipt.LegalName, receipt.CompanyName, StringComparison.OrdinalIgnoreCase))
                column.Item().AlignCenter().Text(receipt.LegalName).FontSize(8).FontColor(Slate);
            column.Item().AlignCenter().Text("SALES RECEIPT")
                .FontSize(subtitleFontSize).SemiBold().LetterSpacing(0.08f).FontColor(Slate);
        });
    }

    private static void ReceiptDetails(IContainer container, ReceiptResponse receipt, bool compact)
    {
        container.Column(column =>
        {
            column.Spacing(4);
            if (compact)
            {
                ReceiptLabelValue(column, "Receipt", receipt.Reference);
                ReceiptLabelValue(column, "Date", receipt.Date.ToString("yyyy-MM-dd HH:mm"));
            }
            else
            {
                column.Item().Row(row =>
                {
                    row.RelativeItem().Text(text =>
                    {
                        text.Span("Receipt\n").FontColor(Slate);
                        text.Span(receipt.Reference).SemiBold();
                    });
                    row.RelativeItem().AlignRight().Text(text =>
                    {
                        text.Span("Date\n").FontColor(Slate);
                        text.Span(receipt.Date.ToString("yyyy-MM-dd HH:mm")).SemiBold();
                    });
                });
            }

            ReceiptLabelValue(column, "Customer", JoinNonEmpty(receipt.CustomerName, receipt.CustomerPhone));
            if (!string.IsNullOrWhiteSpace(receipt.CustomerAddress))
                ReceiptLabelValue(column, "Customer address", receipt.CustomerAddress!);
            if (!string.IsNullOrWhiteSpace(receipt.BranchName))
                ReceiptLabelValue(column, "Branch", receipt.BranchName!);
        });
    }

    private static void ReceiptItemsTable(IContainer container, ReceiptResponse receipt, bool compact)
    {
        if (compact)
        {
            container.Column(column =>
            {
                column.Spacing(0);
                column.Item().Background(Navy).PaddingVertical(4).PaddingHorizontal(3).Row(row =>
                {
                    row.RelativeItem(2).Text("Item").FontSize(7).SemiBold().FontColor(Colors.White);
                    row.RelativeItem().AlignRight().Text("Total").FontSize(7).SemiBold().FontColor(Colors.White);
                });

                foreach (var item in receipt.Items)
                {
                    column.Item().BorderBottom(1).BorderColor(Border).PaddingVertical(5).PaddingHorizontal(3).Column(itemColumn =>
                    {
                        itemColumn.Spacing(2);
                        itemColumn.Item().Text(item.Name).FontSize(7.5f).SemiBold();
                        itemColumn.Item().Row(row =>
                        {
                            row.RelativeItem(2).Text($"{item.Quantity:N2}{(string.IsNullOrWhiteSpace(item.UnitName) ? string.Empty : $" {item.UnitName}")} × {Money(item.UnitPrice, receipt.CurrencyCode)}")
                                .FontSize(6.5f).FontColor(Slate);
                            row.RelativeItem().AlignRight().ScaleToFit()
                                .Text(Money(item.Total, receipt.CurrencyCode)).FontSize(7.5f).SemiBold();
                        });
                    });
                }
            });
            return;
        }

        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn(4);
                columns.ConstantColumn(46);
                columns.ConstantColumn(78);
                columns.ConstantColumn(82);
            });

            table.Header(header =>
            {
                ReceiptHeaderCell(header.Cell(), "Item", compact: false);
                ReceiptHeaderCell(header.Cell().AlignRight(), "Qty", compact: false);
                ReceiptHeaderCell(header.Cell().AlignRight(), "Price", compact: false);
                ReceiptHeaderCell(header.Cell().AlignRight(), "Total", compact: false);
            });

            foreach (var item in receipt.Items)
            {
                table.Cell().BorderBottom(1).BorderColor(Border).PaddingVertical(6).PaddingHorizontal(5)
                    .Text(item.Name).FontSize(8).SemiBold();
                ReceiptBodyCell(table.Cell().AlignRight(), $"{item.Quantity:N2}{(string.IsNullOrWhiteSpace(item.UnitName) ? string.Empty : $" {item.UnitName}")}", compact: false);
                ReceiptBodyCell(table.Cell().AlignRight(), Money(item.UnitPrice, receipt.CurrencyCode), compact: false);
                ReceiptBodyCell(table.Cell().AlignRight(), Money(item.Total, receipt.CurrencyCode), compact: false, semiBold: true);
            }
        });
    }

    private static void ReceiptTotals(IContainer container, ReceiptResponse receipt, bool compact)
    {
        container.Column(total =>
        {
            total.Spacing(compact ? 3 : 4);
            TotalRow(total, "Subtotal", receipt.Subtotal, receipt.CurrencyCode, compact);
            if (receipt.Discount != 0) TotalRow(total, "Discount", -receipt.Discount, receipt.CurrencyCode, compact);
            if (receipt.Tax != 0) TotalRow(total, "Tax", receipt.Tax, receipt.CurrencyCode, compact);
            if (receipt.Shipping != 0) TotalRow(total, "Shipping", receipt.Shipping, receipt.CurrencyCode, compact);
            total.Item().PaddingTop(5).BorderTop(1).BorderColor(Border).Row(row =>
            {
                row.RelativeItem().Text("TOTAL").Bold();
                row.RelativeItem(compact ? 1.5f : 1f).AlignRight().ScaleToFit()
                    .Text(Money(receipt.Total, receipt.CurrencyCode)).FontSize(compact ? 10 : 14).Bold();
            });
            TotalRow(total, "Paid", receipt.PaidAmount, receipt.CurrencyCode, compact);
            TotalRow(total, "Balance", receipt.BalanceAmount, receipt.CurrencyCode, compact);
            if (receipt.PreviousBalance > 0)
            {
                TotalRow(total, "Previous balance", receipt.PreviousBalance, receipt.CurrencyCode, compact);
                TotalRow(total, "Customer account due", receipt.PreviousBalance + receipt.BalanceAmount, receipt.CurrencyCode, compact);
            }
        });
    }

    private static void ReceiptPayment(IContainer container, ReceiptResponse receipt, bool compact)
    {
        container.Background(Light).Padding(compact ? 7 : 10).Column(column =>
        {
            column.Spacing(2);
            column.Item().Text($"Payment status: {receipt.PaymentStatus}").SemiBold();
            if (!string.IsNullOrWhiteSpace(receipt.PaymentMethod))
                column.Item().Text($"Method: {receipt.PaymentMethod}").FontSize(compact ? 7 : 8).FontColor(Slate);
        });
    }

    private static void ReceiptNotesAndFooter(IContainer container, ReceiptResponse receipt, bool compact)
    {
        container.Column(column =>
        {
            column.Spacing(5);
            if (!string.IsNullOrWhiteSpace(receipt.Notes))
                column.Item().Text(text =>
                {
                    text.Span("Note: ").FontColor(Slate);
                    text.Span(receipt.Notes);
                });
            column.Item().AlignCenter().Text("Thank you for your business").SemiBold();
            var contact = JoinNonEmpty(receipt.CompanyPhone, receipt.CompanyEmail, receipt.CompanyAddress);
            if (!string.IsNullOrWhiteSpace(contact))
                column.Item().AlignCenter().Text(contact).FontSize(compact ? 6.5f : 7).FontColor(Slate);
        });
    }

    private static void ReceiptLabelValue(ColumnDescriptor column, string label, string value) =>
        column.Item().Text(text =>
        {
            text.Span($"{label}: ").FontColor(Slate);
            text.Span(value).SemiBold();
        });

    private static void ReceiptHeaderCell(IContainer container, string text, bool compact) =>
        container.Background(Navy).PaddingVertical(compact ? 4 : 6).PaddingHorizontal(compact ? 2 : 5)
            .Text(text).FontSize(compact ? 7 : 8).SemiBold().FontColor(Colors.White);

    private static void ReceiptBodyCell(IContainer container, string text, bool compact, bool semiBold = false)
    {
        var descriptor = container.BorderBottom(1).BorderColor(Border)
            .PaddingVertical(compact ? 4 : 6).PaddingHorizontal(compact ? 2 : 5)
            .Text(text).FontSize(compact ? 7 : 8);
        if (semiBold) descriptor.SemiBold();
    }

    private static string JoinNonEmpty(params string?[] values) =>
        string.Join(" · ", values.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value!.Trim()));

    private async Task<DocumentCompanyProfile> GetDocumentCompanyAsync(CancellationToken cancellationToken)
    {
        var currencyCode = await TransientSqlRetry.ExecuteAsync<string?>(
            token => context.CompanySettings.AsNoTracking()
                .Select(item => item.MainCurrencyCode)
                .SingleOrDefaultAsync(token),
            cancellationToken) ?? "USD";

        var company = await TransientSqlRetry.ExecuteAsync<DocumentCompanyProfile?>(
            token => context.Companies.AsNoTracking()
                .Select(item => new DocumentCompanyProfile(
                    item.Name,
                    item.LegalName,
                    item.Phone,
                    item.Email,
                    item.Address,
                    currencyCode))
                .SingleOrDefaultAsync(token),
            cancellationToken);

        return company ?? throw new InvalidOperationException("Company profile has not been configured.");
    }

    private static byte[] CreateOperationalPdf(OperationalPdfModel model) =>
        Document.Create(document =>
        {
            document.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(14, Unit.Millimetre);
                page.DefaultTextStyle(text => text.FontFamily(Fonts.Arial).FontSize(8).FontColor(Navy));
                page.Header().Element(container => OperationalHeader(container, model));
                page.Content().PaddingVertical(10).Column(column =>
                {
                    column.Spacing(10);
                    column.Item().Element(container => OperationalMetricGrid(container, model.Metrics));
                    column.Item().Element(container => OperationalTable(container, model));
                });
                page.Footer().Row(row =>
                {
                    row.RelativeItem().Text("Generated by the company commerce system").FontSize(7).FontColor(Slate);
                    row.AutoItem().Text(text =>
                    {
                        text.DefaultTextStyle(style => style.FontSize(7).FontColor(Slate));
                        text.Span("Page ");
                        text.CurrentPageNumber();
                        text.Span(" / ");
                        text.TotalPages();
                    });
                });
            });
        }).GeneratePdf();

    private static void OperationalHeader(IContainer container, OperationalPdfModel model)
    {
        container.BorderBottom(1).BorderColor(Border).PaddingBottom(9).Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Spacing(2);
                column.Item().Text(model.Company.Name).FontSize(17).Bold().FontColor(Navy);
                if (!string.IsNullOrWhiteSpace(model.Company.LegalName) &&
                    !string.Equals(model.Company.LegalName, model.Company.Name, StringComparison.OrdinalIgnoreCase))
                    column.Item().Text(model.Company.LegalName).FontSize(8).FontColor(Slate);
                column.Item().Text(model.Title).FontSize(11).SemiBold().FontColor(Navy);
                column.Item().Text(model.Subtitle).FontSize(8).FontColor(Slate);
            });
            row.ConstantItem(255).AlignRight().Column(column =>
            {
                column.Spacing(2);
                var period = model.Period.HasValue
                    ? $"Period: {model.Period.Value.Start:yyyy-MM-dd} — {model.Period.Value.End:yyyy-MM-dd}"
                    : "Current catalog snapshot";
                column.Item().AlignRight().Text(period).SemiBold();
                column.Item().AlignRight().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(7).FontColor(Slate);
                var contact = JoinNonEmpty(model.Company.Phone, model.Company.Email, model.Company.Address);
                if (!string.IsNullOrWhiteSpace(contact))
                    column.Item().AlignRight().Text(contact).FontSize(7).FontColor(Slate);
            });
        });
    }

    private static void OperationalMetricGrid(IContainer container, IReadOnlyCollection<ReportMetric> metrics)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.RelativeColumn();
                columns.RelativeColumn();
                columns.RelativeColumn();
                columns.RelativeColumn();
            });
            foreach (var metric in metrics)
            {
                table.Cell().Padding(3).Element(cell =>
                    cell.Border(1).BorderColor(Border).Background(Light).Padding(8).Column(column =>
                    {
                        column.Item().Text(metric.Label).FontSize(7).FontColor(Slate);
                        column.Item().Text(metric.Value).FontSize(11).SemiBold().FontColor(metric.Color);
                    }));
            }
        });
    }

    private static void OperationalTable(IContainer container, OperationalPdfModel model)
    {
        if (model.Rows.Count == 0)
        {
            container.Border(1).BorderColor(Border).Background(Light).Padding(24)
                .AlignCenter().Text("No records match the selected filters.").FontColor(Slate);
            return;
        }

        var rightAligned = model.RightAlignedColumns.ToHashSet();
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                foreach (var width in model.ColumnWidths)
                    columns.RelativeColumn(width);
            });
            table.Header(header =>
            {
                foreach (var title in model.Headers)
                    header.Cell().Background(Navy).PaddingVertical(6).PaddingHorizontal(4)
                        .Text(title).FontSize(7).SemiBold().FontColor(Colors.White);
            });

            for (var rowIndex = 0; rowIndex < model.Rows.Count; rowIndex++)
            {
                var row = model.Rows[rowIndex];
                for (var columnIndex = 0; columnIndex < model.Headers.Count; columnIndex++)
                {
                    var value = columnIndex < row.Length ? row[columnIndex] : string.Empty;
                    var cell = table.Cell()
                        .Background(rowIndex % 2 == 0 ? Colors.White : Light)
                        .BorderBottom(1).BorderColor(Border)
                        .PaddingVertical(5).PaddingHorizontal(4);
                    if (rightAligned.Contains(columnIndex)) cell = cell.AlignRight();
                    cell.Text(value).FontSize(7);
                }
            }
        });
    }

    private static (DateOnly Start, DateOnly End) ResolvePeriod(OperationalDocumentFilter filter, int defaultDays)
    {
        var end = filter.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = filter.StartDate ?? end.AddDays(-(Math.Max(1, defaultDays) - 1));
        if (start > end)
            throw new ArgumentException("Start date cannot be after end date.");
        if (end.DayNumber - start.DayNumber > 3660)
            throw new ArgumentException("The report range cannot exceed ten years.");
        return (start, end);
    }

    private static string ResolveCurrency(string? requested, string fallback)
    {
        var currency = string.IsNullOrWhiteSpace(requested) ? fallback : requested.Trim().ToUpperInvariant();
        if (currency.Length != 3 || !currency.All(char.IsLetter))
            throw new ArgumentException("Currency code must contain exactly three letters.");
        return currency;
    }

    private static int? NormalizeDocumentRowLimit(int? value)
    {
        if (!value.HasValue) return null;
        return Math.Clamp(value.Value, 1, 50_000);
    }

    private static string? CleanSearch(string? search)
    {
        var value = search?.Trim();
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static void ConfigurePage(PageDescriptor page)
    {
        page.Size(PageSizes.A4);
        page.Margin(24, Unit.Millimetre);
        page.DefaultTextStyle(text => text.FontFamily(Fonts.Arial).FontSize(9).FontColor(Navy));
    }

    private static void ReportHeader(IContainer container, string companyName, string title, DateTime start, DateTime end)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text(companyName).FontSize(18).Bold().FontColor(Navy);
                column.Item().Text(title).FontSize(11).FontColor(Slate);
            });
            row.AutoItem().AlignRight().Column(column =>
            {
                column.Item().Text($"{start:yyyy-MM-dd} — {end:yyyy-MM-dd}").SemiBold();
                column.Item().AlignRight().Text($"Generated {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(8).FontColor(Slate);
            });
        });
    }

    private static void MetricGrid(IContainer container, IReadOnlyList<(string Label, decimal Value, string Color)> metrics, string currency)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns => { columns.RelativeColumn(); columns.RelativeColumn(); columns.RelativeColumn(); });
            foreach (var metric in metrics)
            {
                table.Cell().Padding(4).Element(cell => cell.Background(Light).Border(1).BorderColor(Border).Padding(10).Column(column =>
                {
                    column.Item().Text(metric.Label).FontSize(8).FontColor(Slate);
                    column.Item().Text(Money(metric.Value, currency)).FontSize(12).SemiBold().FontColor(metric.Color);
                }));
            }
        });
    }

    private static void TransactionTable(IContainer container, IReadOnlyCollection<FinancialReportLineResponse> lines, string currency)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(58); columns.ConstantColumn(62); columns.RelativeColumn(2.2f);
                columns.RelativeColumn(); columns.ConstantColumn(70);
            });
            table.Header(header =>
            {
                HeaderCell(header.Cell(), "Date"); HeaderCell(header.Cell(), "Reference");
                HeaderCell(header.Cell(), "Description"); HeaderCell(header.Cell(), "Status");
                HeaderCell(header.Cell().AlignRight(), "Amount");
            });
            foreach (var line in lines)
            {
                BodyCell(table.Cell(), line.Date.ToString("yyyy-MM-dd"));
                BodyCell(table.Cell(), line.Reference);
                BodyCell(table.Cell(), line.Description);
                BodyCell(table.Cell(), line.Status);
                BodyCell(table.Cell().AlignRight(), Money(line.Direction == "out" ? -line.Amount : line.Amount, currency));
            }
        });
    }

    private static void LedgerTable(IContainer container, IReadOnlyCollection<LedgerEntryResponse> entries, string currency)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(58); columns.ConstantColumn(62); columns.RelativeColumn(2);
                columns.ConstantColumn(62); columns.ConstantColumn(62); columns.ConstantColumn(72);
            });
            table.Header(header =>
            {
                HeaderCell(header.Cell(), "Date"); HeaderCell(header.Cell(), "Reference");
                HeaderCell(header.Cell(), "Description"); HeaderCell(header.Cell().AlignRight(), "Debit");
                HeaderCell(header.Cell().AlignRight(), "Credit"); HeaderCell(header.Cell().AlignRight(), "Balance");
            });
            foreach (var entry in entries)
            {
                BodyCell(table.Cell(), entry.Date.ToString("yyyy-MM-dd")); BodyCell(table.Cell(), entry.Reference);
                BodyCell(table.Cell(), entry.Description); BodyCell(table.Cell().AlignRight(), Money(entry.Debit, currency));
                BodyCell(table.Cell().AlignRight(), Money(entry.Credit, currency)); BodyCell(table.Cell().AlignRight(), Money(entry.Balance, currency));
            }
        });
    }

    private static void VoucherLinesTable(IContainer container, IReadOnlyCollection<JournalVoucherLineResponse> lines, string currency)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(54); columns.RelativeColumn(1.4f); columns.RelativeColumn(2);
                columns.ConstantColumn(78); columns.ConstantColumn(78);
            });
            table.Header(header =>
            {
                HeaderCell(header.Cell(), "Account"); HeaderCell(header.Cell(), "Account name");
                HeaderCell(header.Cell(), "Description"); HeaderCell(header.Cell().AlignRight(), "Debit");
                HeaderCell(header.Cell().AlignRight(), "Credit");
            });
            foreach (var line in lines)
            {
                BodyCell(table.Cell(), line.AccountCode); BodyCell(table.Cell(), line.AccountName);
                BodyCell(table.Cell(), line.Description ?? "—");
                BodyCell(table.Cell().AlignRight(), line.Debit > 0 ? Money(line.Debit, currency) : "—");
                BodyCell(table.Cell().AlignRight(), line.Credit > 0 ? Money(line.Credit, currency) : "—");
            }
        });
    }

    private static void JournalLedgerTable(IContainer container, IReadOnlyCollection<JournalAccountLedgerEntryResponse> entries, string currency)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(58); columns.ConstantColumn(76); columns.RelativeColumn(2);
                columns.ConstantColumn(66); columns.ConstantColumn(66); columns.ConstantColumn(76);
            });
            table.Header(header =>
            {
                HeaderCell(header.Cell(), "Date"); HeaderCell(header.Cell(), "Voucher");
                HeaderCell(header.Cell(), "Narration"); HeaderCell(header.Cell().AlignRight(), "Debit");
                HeaderCell(header.Cell().AlignRight(), "Credit"); HeaderCell(header.Cell().AlignRight(), "Balance");
            });
            foreach (var entry in entries)
            {
                BodyCell(table.Cell(), entry.VoucherDate.ToString("yyyy-MM-dd"));
                BodyCell(table.Cell(), entry.VoucherNumber);
                BodyCell(table.Cell(), entry.CounterpartyName is null ? entry.Memo : $"{entry.CounterpartyName} · {entry.Memo}");
                BodyCell(table.Cell().AlignRight(), entry.Debit > 0 ? Money(entry.Debit, currency) : "—");
                BodyCell(table.Cell().AlignRight(), entry.Credit > 0 ? Money(entry.Credit, currency) : "—");
                BodyCell(table.Cell().AlignRight(), Money(entry.Balance, currency));
            }
            if (entries.Count == 0)
                BodyCell(table.Cell().ColumnSpan(6).AlignCenter(), "No account activity in this period.");
        });
    }

    private static void VoucherInfoCell(IContainer container, string label, string value) =>
        container.Padding(4).Background(Light).Border(1).BorderColor(Border).Padding(9).Column(column =>
        {
            column.Item().Text(label).FontSize(7.5f).FontColor(Slate);
            column.Item().Text(value).FontSize(9).SemiBold().FontColor(Navy);
        });

    private static void SignatureLine(IContainer container, string label) =>
        container.PaddingTop(22).BorderTop(1).BorderColor(Slate).PaddingTop(5).Text(label).FontSize(8).FontColor(Slate);

    private static string SplitEnum(string value) => string.Concat(value.Select((character, index) =>
        index > 0 && char.IsUpper(character) ? $" {character}" : character.ToString()));

    private static void HeaderCell(IContainer container, string text) =>
        container.Background(Navy).PaddingVertical(6).PaddingHorizontal(5).Text(text).FontSize(8).SemiBold().FontColor(Colors.White);

    private static void BodyCell(IContainer container, string text) =>
        container.BorderBottom(1).BorderColor(Border).PaddingVertical(6).PaddingHorizontal(5).Text(text).FontSize(8);

    private static void TotalRow(ColumnDescriptor column, string label, decimal value, string currency, bool compact = false) =>
        column.Item().Row(row =>
        {
            row.RelativeItem().Text(label).FontSize(compact ? 7.5f : 9).FontColor(Slate);
            row.RelativeItem(compact ? 1.5f : 1f).AlignRight().ScaleToFit()
                .Text(Money(value, currency)).FontSize(compact ? 7.5f : 9).SemiBold();
        });

    private static readonly CultureInfo MoneyCulture = CultureInfo.GetCultureInfo("en-US");

    private static string Money(decimal value, string currency) => $"{currency} {value.ToString("N2", MoneyCulture)}";

    private static void WriteTitle(IXLWorksheet sheet, string title, DateTime start, DateTime end, string currency)
    {
        sheet.Cell(1, 1).Value = title;
        sheet.Range(1, 1, 1, 8).Merge().Style.Font.SetBold().Font.SetFontSize(18).Font.SetFontColor(XLColor.FromHtml(Navy));
        sheet.Cell(2, 1).Value = $"Period: {start:yyyy-MM-dd} to {end:yyyy-MM-dd}";
        sheet.Cell(3, 1).Value = $"Currency: {currency} · Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
        sheet.Range(2, 1, 3, 8).Style.Font.FontColor = XLColor.FromHtml(Slate);
    }

    private static void WriteHeader(IXLWorksheet sheet, int row, IReadOnlyList<string> headers)
    {
        for (var index = 0; index < headers.Count; index++) sheet.Cell(row, index + 1).Value = headers[index];
        var range = sheet.Range(row, 1, row, headers.Count);
        range.Style.Fill.BackgroundColor = XLColor.FromHtml(Navy);
        range.Style.Font.FontColor = XLColor.White;
        range.Style.Font.Bold = true;
        range.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        range.SetAutoFilter();
        sheet.SheetView.FreezeRows(row);
    }

    private static void FormatTable(IXLWorksheet sheet, int lastRow, int moneyStart, int moneyEnd, int headerRow = 1)
    {
        if (lastRow >= headerRow + 1)
        {
            sheet.Range(headerRow + 1, moneyStart, lastRow, moneyEnd).Style.NumberFormat.Format = "#,##0.00;[Red]-#,##0.00";
            sheet.Range(headerRow, 1, lastRow, sheet.LastColumnUsed()?.ColumnNumber() ?? moneyEnd)
                .Style.Border.BottomBorder = XLBorderStyleValues.Hair;
        }
        foreach (var column in sheet.ColumnsUsed())
            column.AdjustToContents(headerRow, Math.Max(headerRow, lastRow), 8, 48);
        sheet.Rows(headerRow, Math.Max(headerRow, lastRow)).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
    }

    private sealed record DocumentCompanyProfile(
        string Name,
        string? LegalName,
        string? Phone,
        string? Email,
        string? Address,
        string CurrencyCode);

    private sealed record ReportMetric(string Label, string Value, string Color);

    private sealed record OperationalPdfModel(
        DocumentCompanyProfile Company,
        string Title,
        string Subtitle,
        (DateOnly Start, DateOnly End)? Period,
        IReadOnlyCollection<ReportMetric> Metrics,
        IReadOnlyList<string> Headers,
        IReadOnlyList<string[]> Rows,
        IReadOnlyList<float> ColumnWidths,
        IReadOnlyCollection<int> RightAlignedColumns);

    private sealed record ProductDocumentRow(
        string Name,
        string? Barcode,
        string Category,
        string? Brand,
        string? Unit,
        bool UsesDisplayStock,
        decimal? DisplayStockQuantity,
        decimal Stock,
        decimal MinimumStock,
        decimal? Price,
        bool IsActive,
        bool IsFeatured);

    private sealed record SalesDocumentRow(
        DateTime Date,
        string Reference,
        string Channel,
        string Customer,
        decimal Total,
        decimal Paid,
        decimal Cost,
        string Status,
        string? Branch);

    private sealed record PurchaseDocumentRow(
        DateOnly Date,
        string Reference,
        string Supplier,
        int ItemCount,
        decimal Total,
        decimal Paid,
        string PaymentStatus,
        string Status,
        string? Branch);

    private sealed record PurchaseLineDocumentRow(
        DateOnly Date,
        string Reference,
        string Supplier,
        string Product,
        string? Strength,
        string? Barcode,
        string? LotNumber,
        DateOnly? ExpireDate,
        decimal Quantity,
        string? UnitName,
        decimal UnitCost,
        decimal LineTotal,
        string? Branch);

    private sealed record PayrollDocumentRow(
        string EmployeeNumber,
        string Name,
        string? Department,
        string? Position,
        int Year,
        int Month,
        decimal BaseSalary,
        decimal Bonus,
        decimal Deduction,
        decimal Net,
        decimal Paid,
        string Status);

    private sealed record ExpenseDocumentRow(
        DateOnly Date,
        string Category,
        string Description,
        string? Vendor,
        string PaymentMethod,
        string? Reference,
        decimal Amount,
        string? Branch);

}
