using ClosedXML.Excel;
using ECommerce.Data;
using ECommerce.Dtos.Documents;
using ECommerce.Dtos.Reports;
using ECommerce.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;
using PaymentStatus = API.Entities.Orders.PaymentStatus;

namespace ECommerce.Services.Documents;

public sealed class FinancialDocumentService(ApplicationDbContext context) : IFinancialDocumentService
{
    private const string Navy = "#0F172A";
    private const string Slate = "#475569";
    private const string Light = "#F8FAFC";
    private const string Border = "#E2E8F0";
    private const string Green = "#047857";
    private const string Red = "#B91C1C";

    public async Task<string> GetCompanyNameAsync(CancellationToken cancellationToken = default) =>
        await context.Tenants.AsNoTracking().OrderBy(item => item.Id)
            .Select(item => item.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? "Company";

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

    public async Task<ReceiptResponse> GetReceiptAsync(string source, long id, CancellationToken cancellationToken = default)
    {
        var company = await context.Tenants.AsNoTracking().OrderBy(item => item.Id)
            .Select(item => new { item.Name, item.LegalName, item.Phone, item.Email, item.Address, item.LogoUrl })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Company profile has not been configured.");

        if (source.Equals("orders", StringComparison.OrdinalIgnoreCase) || source.Equals("order", StringComparison.OrdinalIgnoreCase))
        {
            var order = await context.Orders.AsNoTracking()
                .Where(item => item.Id == id && item.Status != OrderStatus.Cancelled)
                .Select(item => new
                {
                    item.Id, item.OrderNumber, item.CreatedAt, item.Currency, item.Subtotal, item.DiscountTotal,
                    item.TaxTotal, item.ShippingTotal, item.Total, item.PaymentStatus, item.Notes,
                    Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault(),
                    CustomerName = (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim(),
                    item.Customer.Phone, item.Customer.Address,
                    Paid = item.Payments.Where(payment => payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded)
                        .Sum(payment => (decimal?)payment.Amount) ?? 0,
                    PaymentMethod = item.Payments.OrderByDescending(payment => payment.PaidAt).Select(payment => payment.Provider).FirstOrDefault(),
                    Items = item.Items.Select(line => new ReceiptItemResponse(line.ProductName, line.Quantity, line.UnitPrice, line.Discount, line.Tax, (line.Quantity * line.UnitPrice) - line.Discount + line.Tax)).ToArray()
                }).SingleOrDefaultAsync(cancellationToken)
                ?? throw new KeyNotFoundException("Order was not found.");

            var paid = order.Paid > 0 ? order.Paid : order.PaymentStatus == PaymentStatus.Paid ? order.Total : 0;
            return new ReceiptResponse("orders", order.Id, order.OrderNumber, order.CreatedAt, company.Name, company.LegalName,
                company.Phone, company.Email, company.Address, company.LogoUrl, order.Branch, order.CustomerName,
                order.Phone, order.Address, order.Currency, order.Subtotal, order.DiscountTotal, order.TaxTotal,
                order.ShippingTotal, order.Total, paid, Math.Max(0, order.Total - paid), order.PaymentStatus.ToString(),
                order.PaymentMethod, order.Notes, order.Items);
        }

        if (source.Equals("manual-sales", StringComparison.OrdinalIgnoreCase) || source.Equals("sale", StringComparison.OrdinalIgnoreCase))
        {
            var sale = await context.InventorySales.AsNoTracking()
                .Where(item => item.Id == id)
                .Select(item => new
                {
                    item.Id, item.SaleNumber, item.SaleDate, item.CurrencyCode, item.Subtotal, item.Discount, item.Tax,
                    item.Total, item.PaidAmount, item.PaymentStatus, item.PaymentMethod, item.Notes,
                    Branch = context.Branches.Where(branch => branch.Id == item.BranchId).Select(branch => branch.Name).FirstOrDefault(),
                    CustomerName = item.Customer != null
                        ? (item.Customer.FirstName + " " + (item.Customer.LastName ?? "")).Trim()
                        : item.CustomerName ?? "Walk-in customer",
                    CustomerPhone = item.Customer != null ? item.Customer.Phone : item.CustomerPhone,
                    CustomerAddress = item.Customer != null ? item.Customer.Address : null,
                    Items = item.Items.Select(line => new ReceiptItemResponse(line.Product.Name, line.Quantity, line.UnitPrice, 0, 0, line.LineTotal)).ToArray()
                }).SingleOrDefaultAsync(cancellationToken)
                ?? throw new KeyNotFoundException("Manual sale was not found.");

            return new ReceiptResponse("manual-sales", sale.Id, sale.SaleNumber, sale.SaleDate.ToDateTime(TimeOnly.MinValue),
                company.Name, company.LegalName, company.Phone, company.Email, company.Address, company.LogoUrl,
                sale.Branch, sale.CustomerName, sale.CustomerPhone, sale.CustomerAddress, sale.CurrencyCode,
                sale.Subtotal, sale.Discount, sale.Tax, 0, sale.Total, sale.PaidAmount,
                Math.Max(0, sale.Total - sale.PaidAmount), sale.PaymentStatus.ToString(), sale.PaymentMethod,
                sale.Notes, sale.Items);
        }

        throw new ArgumentException("Receipt source must be 'orders' or 'manual-sales'.");
    }

    public byte[] CreateReceiptPdf(ReceiptResponse receipt, bool thermal = false) =>
        ReceiptDocument(receipt, thermal).GeneratePdf();

    public byte[] CreateReceiptImage(ReceiptResponse receipt, bool thermal = false)
    {
        // A continuous 80 mm layout produces one complete, shareable image instead of
        // returning only the first page of a potentially multi-page A4 document.
        _ = thermal;
        return ReceiptDocument(receipt, thermal: true).GenerateImages(new ImageGenerationSettings
        {
            ImageFormat = ImageFormat.Png,
            ImageCompressionQuality = ImageCompressionQuality.Best,
            RasterDpi = 144
        }).First();
    }

    private static IDocument ReceiptDocument(ReceiptResponse receipt, bool thermal) => Document.Create(document =>
    {
        document.Page(page =>
        {
            if (thermal)
                page.ContinuousSize(80, Unit.Millimetre);
            else
                page.Size(PageSizes.A4);
            page.Margin(thermal ? 7 : 28, Unit.Millimetre);
            page.DefaultTextStyle(text => text.FontFamily(Fonts.Arial).FontSize(thermal ? 8 : 10).FontColor(Navy));
            page.Content().Column(column =>
            {
                column.Spacing(thermal ? 7 : 12);
                column.Item().AlignCenter().Text(receipt.CompanyName).FontSize(thermal ? 15 : 22).Bold();
                if (!string.IsNullOrWhiteSpace(receipt.LegalName) && receipt.LegalName != receipt.CompanyName)
                    column.Item().AlignCenter().Text(receipt.LegalName).FontSize(8).FontColor(Slate);
                column.Item().AlignCenter().Text("SALES RECEIPT").FontSize(9).SemiBold().LetterSpacing(0.08f).FontColor(Slate);
                column.Item().LineHorizontal(1).LineColor(Border);
                column.Item().Row(row =>
                {
                    row.RelativeItem().Text(text => { text.Span("Receipt\n").FontColor(Slate); text.Span(receipt.Reference).SemiBold(); });
                    row.RelativeItem().AlignRight().Text(text => { text.Span("Date\n").FontColor(Slate); text.Span(receipt.Date.ToString("yyyy-MM-dd HH:mm")).SemiBold(); });
                });
                column.Item().Text(text =>
                {
                    text.Span("Customer: ").FontColor(Slate);
                    text.Span(receipt.CustomerName).SemiBold();
                    if (!string.IsNullOrWhiteSpace(receipt.CustomerPhone)) text.Span($" · {receipt.CustomerPhone}");
                });
                if (!string.IsNullOrWhiteSpace(receipt.CustomerAddress))
                    column.Item().Text($"Customer address: {receipt.CustomerAddress}").FontSize(8).FontColor(Slate);
                if (!string.IsNullOrWhiteSpace(receipt.BranchName))
                    column.Item().Text($"Branch: {receipt.BranchName}").FontSize(8).FontColor(Slate);
                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(4);
                        columns.RelativeColumn(1);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                    });
                    table.Header(header =>
                    {
                        HeaderCell(header.Cell(), "Item");
                        HeaderCell(header.Cell().AlignRight(), "Qty");
                        HeaderCell(header.Cell().AlignRight(), "Price");
                        HeaderCell(header.Cell().AlignRight(), "Total");
                    });
                    foreach (var item in receipt.Items)
                    {
                        BodyCell(table.Cell(), item.Name);
                        BodyCell(table.Cell().AlignRight(), item.Quantity.ToString("N2"));
                        BodyCell(table.Cell().AlignRight(), item.UnitPrice.ToString("N2"));
                        BodyCell(table.Cell().AlignRight(), item.Total.ToString("N2"));
                    }
                });
                column.Item().LineHorizontal(1).LineColor(Border);
                column.Item().AlignRight().Width(thermal ? 210 : 240).Column(total =>
                {
                    total.Spacing(4);
                    TotalRow(total, "Subtotal", receipt.Subtotal, receipt.CurrencyCode);
                    if (receipt.Discount != 0) TotalRow(total, "Discount", -receipt.Discount, receipt.CurrencyCode);
                    if (receipt.Tax != 0) TotalRow(total, "Tax", receipt.Tax, receipt.CurrencyCode);
                    if (receipt.Shipping != 0) TotalRow(total, "Shipping", receipt.Shipping, receipt.CurrencyCode);
                    total.Item().PaddingTop(5).BorderTop(1).BorderColor(Border).Row(row =>
                    {
                        row.RelativeItem().Text("TOTAL").Bold();
                        row.AutoItem().Text(Money(receipt.Total, receipt.CurrencyCode)).FontSize(thermal ? 11 : 14).Bold();
                    });
                    TotalRow(total, "Paid", receipt.PaidAmount, receipt.CurrencyCode);
                    TotalRow(total, "Balance", receipt.BalanceAmount, receipt.CurrencyCode);
                });
                column.Item().Background(Light).Padding(10).Row(row =>
                {
                    row.RelativeItem().Text($"Payment: {receipt.PaymentStatus}").SemiBold();
                    if (!string.IsNullOrWhiteSpace(receipt.PaymentMethod)) row.AutoItem().Text(receipt.PaymentMethod).FontColor(Slate);
                });
                if (!string.IsNullOrWhiteSpace(receipt.Notes))
                    column.Item().Text(text =>
                    {
                        text.Span("Note: ").FontColor(Slate);
                        text.Span(receipt.Notes);
                    });
                column.Item().AlignCenter().Text("Thank you for your business").SemiBold();
                var contact = string.Join(" · ", new[] { receipt.CompanyPhone, receipt.CompanyEmail, receipt.CompanyAddress }.Where(value => !string.IsNullOrWhiteSpace(value)));
                if (!string.IsNullOrWhiteSpace(contact)) column.Item().AlignCenter().Text(contact).FontSize(7).FontColor(Slate);
            });
        });
    });

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

    private static void HeaderCell(IContainer container, string text) =>
        container.Background(Navy).PaddingVertical(6).PaddingHorizontal(5).Text(text).FontSize(8).SemiBold().FontColor(Colors.White);

    private static void BodyCell(IContainer container, string text) =>
        container.BorderBottom(1).BorderColor(Border).PaddingVertical(6).PaddingHorizontal(5).Text(text).FontSize(8);

    private static void TotalRow(ColumnDescriptor column, string label, decimal value, string currency) =>
        column.Item().Row(row => { row.RelativeItem().Text(label).FontColor(Slate); row.AutoItem().Text(Money(value, currency)).SemiBold(); });

    private static string Money(decimal value, string currency) => $"{currency} {value:N2}";

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
}
