using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Dtos.Reports;
using ECommerce.Entities.Operations;
using ECommerce.Services.Company;
using Microsoft.EntityFrameworkCore;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;

namespace ECommerce.Services.Reports;

public sealed class FinancialReportService(
    ApplicationDbContext context,
    ICompanyContext companyContext) : IFinancialReportService
{
    private static readonly HashSet<string> SupportedSources = new(StringComparer.OrdinalIgnoreCase)
    {
        "orders",
        "manual-sales",
        "purchases",
        "expenses",
        "payroll"
    };

    private static readonly HashSet<string> SupportedSorts = new(StringComparer.OrdinalIgnoreCase)
    {
        "date-desc",
        "date-asc",
        "amount-desc",
        "amount-asc"
    };

    public async Task<FinancialReportSummaryResponse> GetReportAsync(
        FinancialReportRequest request,
        bool includeAllResults = false,
        CancellationToken cancellationToken = default)
    {
        request.BranchId = ResolveBranchId(request.BranchId);
        var end = (request.EndDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
        var start = (request.StartDate ?? end.AddDays(-29)).Date;
        ValidateRange(start, end, request.MinimumAmount, request.MaximumAmount);

        var source = Clean(request.Source);
        if (source is not null && !SupportedSources.Contains(source))
            throw new ArgumentException("The selected report source is not supported.");

        var sort = string.IsNullOrWhiteSpace(request.Sort)
            ? "date-desc"
            : request.Sort.Trim().ToLowerInvariant();
        if (!SupportedSorts.Contains(sort))
            throw new ArgumentException("The selected report sort is not supported.");

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 10, 200);
        var startOnly = DateOnly.FromDateTime(start);
        var endOnly = DateOnly.FromDateTime(end);
        var mainCurrency = await GetMainCurrencyAsync(cancellationToken);
        var selectedCurrency = NormalizeCurrency(request.CurrencyCode, mainCurrency);
        var availableCurrencies = await GetAvailableCurrenciesAsync(selectedCurrency, cancellationToken);

        if (request.BranchId.HasValue && !await context.Branches.AsNoTracking()
                .AnyAsync(item => item.Id == request.BranchId.Value &&
                    item.TenantId == companyContext.CompanyId && item.IsActive,
                    cancellationToken))
            throw new ArgumentException("The selected branch is not available for this company.");

        var ordersQuery = context.Orders.AsNoTracking()
            .Where(item => item.CreatedAt >= start && item.CreatedAt <= end &&
                item.Status != OrderStatus.Cancelled && item.Currency == selectedCurrency);
        var salesQuery = context.InventorySales.AsNoTracking()
            .Where(item => item.SaleDate >= startOnly && item.SaleDate <= endOnly &&
                item.CurrencyCode == selectedCurrency);
        var purchasesQuery = context.Purchases.AsNoTracking()
            .Where(item => item.PurchaseDate >= startOnly && item.PurchaseDate <= endOnly &&
                item.Status != PurchaseStatus.Cancelled && item.CurrencyCode == selectedCurrency);
        var expensesQuery = context.Expenses.AsNoTracking()
            .Where(item => item.ExpenseDate >= startOnly && item.ExpenseDate <= endOnly &&
                item.CurrencyCode == selectedCurrency);
        var payrollQuery = context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.PaidDate >= startOnly && item.PaidDate <= endOnly &&
                item.CurrencyCode == selectedCurrency);

        if (request.BranchId.HasValue)
        {
            ordersQuery = ordersQuery.Where(item => item.BranchId == request.BranchId.Value);
            salesQuery = salesQuery.Where(item => item.BranchId == request.BranchId.Value);
            purchasesQuery = purchasesQuery.Where(item => item.BranchId == request.BranchId.Value);
            expensesQuery = expensesQuery.Where(item => item.BranchId == request.BranchId.Value);
            payrollQuery = payrollQuery.Where(item => item.BranchId == request.BranchId.Value);
        }

        var onlineRevenue = await ordersQuery.SumAsync(item => (decimal?)item.Total, cancellationToken) ?? 0;
        var manualRevenue = await salesQuery.SumAsync(item => (decimal?)item.Total, cancellationToken) ?? 0;
        var purchaseTotal = await purchasesQuery.SumAsync(item => (decimal?)item.Total, cancellationToken) ?? 0;
        var expenseTotal = await expensesQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var payrollObligation = await payrollQuery.SumAsync(item => (decimal?)item.NetAmount, cancellationToken) ?? 0;
        var payrollPaidForDocuments = await payrollQuery.SumAsync(item => (decimal?)item.PaidAmount, cancellationToken) ?? 0;
        var orderCount = await ordersQuery.CountAsync(cancellationToken);
        var saleCount = await salesQuery.CountAsync(cancellationToken);
        var purchaseCount = await purchasesQuery.CountAsync(cancellationToken);

        var onlineCost = await context.OrderItems.AsNoTracking()
            .Where(item => item.Order.CreatedAt >= start && item.Order.CreatedAt <= end &&
                item.Order.Status != OrderStatus.Cancelled && item.Order.Currency == selectedCurrency &&
                (!request.BranchId.HasValue || item.Order.BranchId == request.BranchId.Value))
            .SumAsync(item => (decimal?)(item.Quantity * item.UnitCost), cancellationToken) ?? 0;
        var manualCost = await context.InventorySaleItems.AsNoTracking()
            .Where(item => item.InventorySale.SaleDate >= startOnly && item.InventorySale.SaleDate <= endOnly &&
                item.InventorySale.CurrencyCode == selectedCurrency &&
                (!request.BranchId.HasValue || item.InventorySale.BranchId == request.BranchId.Value))
            .SumAsync(item => (decimal?)(item.Quantity * item.UnitCost), cancellationToken) ?? 0;
        var costOfGoodsSold = onlineCost + manualCost;

        var onlineCashQuery = context.Payments.AsNoTracking().Where(item =>
            item.PaidAt.HasValue && item.PaidAt.Value >= start && item.PaidAt.Value <= end &&
            item.Currency == selectedCurrency &&
            (item.Status == PaymentStatus.Paid || item.Status == PaymentStatus.PartiallyRefunded));
        var manualCashQuery = context.InventorySalePayments.AsNoTracking().Where(item =>
            item.PaymentDate >= startOnly && item.PaymentDate <= endOnly &&
            item.InventorySale.CurrencyCode == selectedCurrency);
        var purchaseCashQuery = context.PurchasePayments.AsNoTracking().Where(item =>
            item.PaymentDate >= startOnly && item.PaymentDate <= endOnly &&
            item.Purchase.Status != PurchaseStatus.Cancelled && item.Purchase.CurrencyCode == selectedCurrency);
        var payrollCashQuery = context.StaffSalaryInstallments.AsNoTracking().Where(item =>
            item.PaymentDate >= startOnly && item.PaymentDate <= endOnly &&
            item.StaffSalaryPayment.CurrencyCode == selectedCurrency);

        if (request.BranchId.HasValue)
        {
            onlineCashQuery = onlineCashQuery.Where(item => item.Order.BranchId == request.BranchId.Value);
            manualCashQuery = manualCashQuery.Where(item => item.InventorySale.BranchId == request.BranchId.Value);
            purchaseCashQuery = purchaseCashQuery.Where(item => item.Purchase.BranchId == request.BranchId.Value);
            payrollCashQuery = payrollCashQuery.Where(item => item.StaffSalaryPayment.BranchId == request.BranchId.Value);
        }

        var onlineCash = await onlineCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var manualCash = await manualCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var purchaseCash = await purchaseCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var payrollCash = await payrollCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var cashReceived = onlineCash + manualCash;
        var cashPaid = purchaseCash + payrollCash + expenseTotal;

        var outstandingReceivables = await GetOutstandingReceivablesAsync(
            end,
            endOnly,
            request.BranchId,
            selectedCurrency,
            cancellationToken);
        var outstandingSupplierPayables = await context.Purchases.AsNoTracking()
            .Where(item => item.PurchaseDate <= endOnly && item.Status != PurchaseStatus.Cancelled &&
                item.CurrencyCode == selectedCurrency &&
                (!request.BranchId.HasValue || item.BranchId == request.BranchId.Value))
            .SumAsync(item => (decimal?)(item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0), cancellationToken) ?? 0;
        var outstandingPayroll = await context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.PaidDate <= endOnly && item.CurrencyCode == selectedCurrency &&
                (!request.BranchId.HasValue || item.BranchId == request.BranchId.Value))
            .SumAsync(item => (decimal?)(item.NetAmount > item.PaidAmount ? item.NetAmount - item.PaidAmount : 0), cancellationToken) ?? 0;

        var customerQuery = context.Customers.AsNoTracking().AsQueryable();
        var inventoryQuery = context.ProductInventories.AsNoTracking()
            .Where(item => !item.Product.UsesDisplayStock)
            .AsQueryable();
        if (request.BranchId.HasValue)
        {
            customerQuery = customerQuery.Where(item => item.BranchId == request.BranchId.Value);
            inventoryQuery = inventoryQuery.Where(item => item.BranchId == request.BranchId.Value);
        }

        var customerCount = await customerQuery.CountAsync(cancellationToken);
        var productCount = await context.Products
            .CountAsync(item => !item.UsesDisplayStock, cancellationToken);
        var healthyInventoryProducts = await inventoryQuery
            .GroupBy(item => item.ProductId)
            .Where(group => group.Sum(item => item.Quantity - item.ReservedQuantity) >
                group.Sum(item => item.MinimumQuantity))
            .CountAsync(cancellationToken);
        var lowStock = Math.Max(0, productCount - healthyInventoryProducts);

        var branches = await context.Branches.AsNoTracking()
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var lines = await BuildLinesAsync(
            ordersQuery,
            salesQuery,
            purchasesQuery,
            expensesQuery,
            payrollQuery,
            source,
            branches,
            selectedCurrency,
            cancellationToken);

        var status = Clean(request.Status);
        if (status is not null)
            lines = lines.Where(item => item.Status.Contains(status, StringComparison.OrdinalIgnoreCase)).ToList();

        var search = Clean(request.Search);
        if (search is not null)
        {
            lines = lines.Where(item =>
                item.Reference.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                item.Description.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                (item.BranchName?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }

        if (request.MinimumAmount.HasValue)
            lines = lines.Where(item => item.Amount >= request.MinimumAmount.Value).ToList();
        if (request.MaximumAmount.HasValue)
            lines = lines.Where(item => item.Amount <= request.MaximumAmount.Value).ToList();

        lines = sort switch
        {
            "date-asc" => lines.OrderBy(item => item.Date).ToList(),
            "amount-desc" => lines.OrderByDescending(item => item.Amount).ToList(),
            "amount-asc" => lines.OrderBy(item => item.Amount).ToList(),
            _ => lines.OrderByDescending(item => item.Date).ToList()
        };

        var totalResults = lines.Count;
        var pagedLines = includeAllResults
            ? lines.ToArray()
            : lines.Skip((page - 1) * pageSize).Take(pageSize).ToArray();

        var cashTrend = await BuildCashTrendAsync(
            startOnly,
            endOnly,
            onlineCashQuery,
            manualCashQuery,
            purchaseCashQuery,
            payrollCashQuery,
            expensesQuery,
            cancellationToken);
        var profitTrend = await BuildProfitTrendAsync(
            startOnly,
            endOnly,
            request.BranchId,
            selectedCurrency,
            cancellationToken);
        var topProducts = await GetTopProductsAsync(
            start,
            end,
            startOnly,
            endOnly,
            request.BranchId,
            selectedCurrency,
            cancellationToken);

        var totalRevenue = onlineRevenue + manualRevenue;
        var grossProfit = totalRevenue - costOfGoodsSold;
        var netProfit = grossProfit - expenseTotal - payrollObligation;

        return new FinancialReportSummaryResponse(
            start,
            end,
            selectedCurrency,
            availableCurrencies,
            onlineRevenue,
            manualRevenue,
            totalRevenue,
            costOfGoodsSold,
            grossProfit,
            Percentage(grossProfit, totalRevenue),
            expenseTotal,
            payrollObligation,
            netProfit,
            Percentage(netProfit, totalRevenue),
            cashReceived,
            purchaseTotal,
            payrollPaidForDocuments,
            cashPaid,
            cashReceived - cashPaid,
            netProfit,
            outstandingReceivables,
            outstandingSupplierPayables,
            outstandingPayroll,
            orderCount,
            saleCount,
            purchaseCount,
            customerCount,
            productCount,
            lowStock,
            orderCount == 0 ? 0 : onlineRevenue / orderCount,
            cashTrend,
            profitTrend,
            topProducts,
            pagedLines,
            totalResults,
            page,
            includeAllResults ? Math.Max(totalResults, 1) : pageSize);
    }

    public async Task<CompanyWorthResponse> GetCompanyWorthAsync(
        DateTime? asOfDate,
        DateTime? periodStartDate,
        long? branchId,
        string? currencyCode,
        CancellationToken cancellationToken = default)
    {
        branchId = ResolveBranchId(branchId);
        var asOf = (asOfDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
        var periodStart = (periodStartDate ?? new DateTime(asOf.Year, asOf.Month, 1)).Date;
        if (periodStart > asOf)
            throw new ArgumentException("Period start must be before the selected date.");

        var currency = NormalizeCurrency(currencyCode, await GetMainCurrencyAsync(cancellationToken));
        var asOfOnly = DateOnly.FromDateTime(asOf);

        var cashReceived = await GetCashReceivedUntilAsync(asOf, asOfOnly, branchId, currency, cancellationToken);
        var cashPaid = await GetCashPaidUntilAsync(asOfOnly, branchId, currency, cancellationToken);
        var cashPosition = cashReceived - cashPaid;
        var receivables = await GetOutstandingReceivablesAsync(asOf, asOfOnly, branchId, currency, cancellationToken);
        var supplierPayables = await context.Purchases.AsNoTracking()
            .Where(item => item.PurchaseDate <= asOfOnly && item.Status != PurchaseStatus.Cancelled &&
                item.CurrencyCode == currency && (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0), cancellationToken) ?? 0;
        var payrollPayables = await context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.PaidDate <= asOfOnly && item.CurrencyCode == currency &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.NetAmount > item.PaidAmount ? item.NetAmount - item.PaidAmount : 0), cancellationToken) ?? 0;
        var inventoryValue = await GetInventoryValueAsync(asOf, branchId, cancellationToken);

        var period = await GetReportAsync(new FinancialReportRequest
        {
            StartDate = periodStart,
            EndDate = asOf,
            BranchId = branchId,
            CurrencyCode = currency,
            Page = 1,
            PageSize = 10
        }, cancellationToken: cancellationToken);

        var totalAssets = cashPosition + inventoryValue + receivables;
        var totalLiabilities = supplierPayables + payrollPayables;
        var netWorth = totalAssets - totalLiabilities;

        return new CompanyWorthResponse(
            asOf,
            periodStart,
            currency,
            cashPosition,
            inventoryValue,
            receivables,
            totalAssets,
            supplierPayables,
            payrollPayables,
            totalLiabilities,
            netWorth,
            period.TotalRevenue,
            period.CostOfGoodsSold,
            period.Expenses,
            period.PayrollObligation,
            period.NetProfit,
            Percentage(period.NetProfit, totalAssets));
    }

    public async Task<CustomerLedgerResponse> GetCustomerLedgerAsync(
        long customerId,
        DateTime? startDate,
        DateTime? endDate,
        string? currencyCode,
        CancellationToken cancellationToken = default)
    {
        // Customers are company-wide records. Their ledger can include online orders,
        // manual sales, and receipts from multiple branches, so lookup visibility must
        // match the customer details page instead of the currently selected branch.
        var customer = await context.Customers.AsNoTracking()
            .Where(item => item.Id == customerId)
            .Select(item => new
            {
                item.Id,
                Name = (item.FirstName + " " + (item.LastName ?? "")).Trim(),
                item.Phone
            })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new KeyNotFoundException("Customer not found.");

        var end = (endDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
        var start = (startDate ?? end.AddDays(-29)).Date;
        ValidateRange(start, end, null, null);
        var startOnly = DateOnly.FromDateTime(start);
        var endOnly = DateOnly.FromDateTime(end);
        var currency = NormalizeCurrency(currencyCode, await GetMainCurrencyAsync(cancellationToken));

        var onlineInvoices = await context.Orders.AsNoTracking()
            .Where(item => item.CustomerId == customerId && item.Status != OrderStatus.Cancelled &&
                item.Currency == currency && item.CreatedAt <= end)
            .Select(item => new
            {
                item.Id,
                Date = item.CreatedAt,
                item.OrderNumber,
                item.Total,
                Cost = item.Items.Sum(line => line.Quantity * line.UnitCost)
            })
            .ToListAsync(cancellationToken);
        var manualInvoices = await context.InventorySales.AsNoTracking()
            .Where(item => item.CustomerId == customerId && item.CurrencyCode == currency &&
                item.SaleDate <= endOnly)
            .Select(item => new
            {
                item.Id,
                Date = item.SaleDate,
                item.SaleNumber,
                item.Total,
                Cost = item.Items.Sum(line => line.Quantity * line.UnitCost)
            })
            .ToListAsync(cancellationToken);
        var onlinePayments = await context.Payments.AsNoTracking()
            .Where(item => item.Order.CustomerId == customerId && item.Order.Currency == currency &&
                item.PaidAt.HasValue && item.PaidAt.Value <= end &&
                (item.Status == PaymentStatus.Paid || item.Status == PaymentStatus.PartiallyRefunded))
            .Select(item => new
            {
                item.Id,
                Date = item.PaidAt!.Value,
                item.Amount,
                Reference = item.ExternalReference ?? item.Order.OrderNumber
            })
            .ToListAsync(cancellationToken);
        var manualPayments = await context.InventorySalePayments.AsNoTracking()
            .Where(item => item.InventorySale.CustomerId == customerId &&
                item.InventorySale.CurrencyCode == currency && item.PaymentDate <= endOnly)
            .Select(item => new
            {
                item.Id,
                item.PaymentDate,
                item.Amount,
                Reference = item.ReferenceNumber ?? item.InventorySale.SaleNumber
            })
            .ToListAsync(cancellationToken);

        var allEntries = new List<LedgerSeed>();
        allEntries.AddRange(onlineInvoices.Select(item => new LedgerSeed(
            item.Date,
            "Online order",
            item.OrderNumber,
            "Sales invoice",
            item.Total,
            0,
            item.Id)));
        allEntries.AddRange(manualInvoices.Select(item => new LedgerSeed(
            item.Date.ToDateTime(TimeOnly.MinValue),
            "Manual sale",
            item.SaleNumber,
            "Sales invoice",
            item.Total,
            0,
            item.Id)));
        allEntries.AddRange(onlinePayments.Select(item => new LedgerSeed(
            item.Date,
            "Payment",
            item.Reference,
            "Payment received",
            0,
            item.Amount,
            item.Id)));
        allEntries.AddRange(manualPayments.Select(item => new LedgerSeed(
            item.PaymentDate.ToDateTime(TimeOnly.MinValue),
            "Payment",
            item.Reference,
            "Payment received",
            0,
            item.Amount,
            item.Id)));

        var openingBalance = allEntries
            .Where(item => item.Date < start)
            .Sum(item => item.Debit - item.Credit);
        var balance = openingBalance;
        var entries = allEntries
            .Where(item => item.Date >= start && item.Date <= end)
            .OrderBy(item => item.Date)
            .ThenBy(item => item.Type == "Payment" ? 1 : 0)
            .ThenBy(item => item.SourceId)
            .Select(item =>
            {
                balance += item.Debit - item.Credit;
                return new LedgerEntryResponse(
                    item.Date,
                    item.Type,
                    item.Reference,
                    item.Description,
                    item.Debit,
                    item.Credit,
                    balance,
                    currency,
                    item.SourceId);
            })
            .ToArray();

        var totalSales = entries.Sum(item => item.Debit);
        var totalPayments = entries.Sum(item => item.Credit);
        var periodOnline = onlineInvoices.Where(item => item.Date >= start && item.Date <= end).ToArray();
        var periodManual = manualInvoices.Where(item =>
            item.Date >= startOnly && item.Date <= endOnly).ToArray();
        var revenue = periodOnline.Sum(item => item.Total) + periodManual.Sum(item => item.Total);
        var cogs = periodOnline.Sum(item => item.Cost) + periodManual.Sum(item => item.Cost);

        return new CustomerLedgerResponse(
            customer.Id,
            customer.Name,
            customer.Phone,
            start,
            end,
            currency,
            openingBalance,
            totalSales,
            totalPayments,
            balance,
            revenue,
            cogs,
            revenue - cogs,
            entries);
    }

    private async Task<string> GetMainCurrencyAsync(CancellationToken cancellationToken) =>
        await context.TenantSettings.AsNoTracking()
            .OrderBy(item => item.TenantId)
            .Select(item => item.MainCurrencyCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "USD";

    private async Task<IReadOnlyCollection<string>> GetAvailableCurrenciesAsync(
        string selectedCurrency,
        CancellationToken cancellationToken)
    {
        var currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { selectedCurrency };
        foreach (var value in await context.Orders.AsNoTracking().Select(item => item.Currency).Distinct().ToListAsync(cancellationToken))
            AddCurrency(currencies, value);
        foreach (var value in await context.InventorySales.AsNoTracking().Select(item => item.CurrencyCode).Distinct().ToListAsync(cancellationToken))
            AddCurrency(currencies, value);
        foreach (var value in await context.Purchases.AsNoTracking().Select(item => item.CurrencyCode).Distinct().ToListAsync(cancellationToken))
            AddCurrency(currencies, value);
        foreach (var value in await context.Expenses.AsNoTracking().Select(item => item.CurrencyCode).Distinct().ToListAsync(cancellationToken))
            AddCurrency(currencies, value);
        foreach (var value in await context.StaffSalaryPayments.AsNoTracking().Select(item => item.CurrencyCode).Distinct().ToListAsync(cancellationToken))
            AddCurrency(currencies, value);
        return currencies.OrderBy(item => item).ToArray();
    }

    private async Task<decimal> GetOutstandingReceivablesAsync(
        DateTime end,
        DateOnly endOnly,
        long? branchId,
        string currency,
        CancellationToken cancellationToken)
    {
        var onlineRows = await context.Orders.AsNoTracking()
            .Where(item => item.CreatedAt <= end && item.Status != OrderStatus.Cancelled &&
                item.Currency == currency && (!branchId.HasValue || item.BranchId == branchId.Value))
            .Select(item => new
            {
                item.Total,
                item.PaymentStatus,
                Paid = item.Payments
                    .Where(payment => payment.PaidAt <= end &&
                        (payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded))
                    .Sum(payment => (decimal?)payment.Amount) ?? 0
            })
            .ToListAsync(cancellationToken);
        var online = onlineRows.Sum(item => Math.Max(
            0,
            item.Total - (item.Paid > 0 ? item.Paid : item.PaymentStatus == PaymentStatus.Paid ? item.Total : 0)));
        var manual = await context.InventorySales.AsNoTracking()
            .Where(item => item.SaleDate <= endOnly && item.CurrencyCode == currency &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0), cancellationToken) ?? 0;
        return online + manual;
    }

    private static async Task<List<FinancialReportLineResponse>> BuildLinesAsync(
        IQueryable<Order> ordersQuery,
        IQueryable<InventorySale> salesQuery,
        IQueryable<Purchase> purchasesQuery,
        IQueryable<Expense> expensesQuery,
        IQueryable<StaffSalaryPayment> payrollQuery,
        string? source,
        IReadOnlyDictionary<long, string> branches,
        string currency,
        CancellationToken cancellationToken)
    {
        var lines = new List<FinancialReportLineResponse>();
        if (IncludeSource(source, "orders"))
        {
            var rows = await ordersQuery.Select(item => new
            {
                item.Id,
                item.OrderNumber,
                item.CreatedAt,
                item.Total,
                item.Status,
                item.PaymentStatus,
                item.BranchId,
                Customer = item.Customer.FirstName + " " + (item.Customer.LastName ?? ""),
                Paid = item.Payments
                    .Where(payment => payment.Status == PaymentStatus.Paid ||
                        payment.Status == PaymentStatus.PartiallyRefunded)
                    .Sum(payment => (decimal?)payment.Amount) ?? 0
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item =>
            {
                var paid = item.Paid > 0
                    ? item.Paid
                    : item.PaymentStatus == PaymentStatus.Paid
                        ? item.Total
                        : 0;
                return Line(
                    "orders",
                    item.Id,
                    item.OrderNumber,
                    item.CreatedAt,
                    item.Customer.Trim(),
                    $"{item.Status} / {item.PaymentStatus}",
                    item.Total,
                    paid,
                    currency,
                    "in",
                    item.BranchId,
                    branches);
            }));
        }

        if (IncludeSource(source, "manual-sales"))
        {
            var rows = await salesQuery.Select(item => new
            {
                item.Id,
                item.SaleNumber,
                item.SaleDate,
                item.Total,
                item.PaidAmount,
                item.PaymentStatus,
                item.CustomerName,
                item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line(
                "manual-sales",
                item.Id,
                item.SaleNumber,
                item.SaleDate.ToDateTime(TimeOnly.MinValue),
                item.CustomerName ?? "Walk-in customer",
                item.PaymentStatus.ToString(),
                item.Total,
                item.PaidAmount,
                currency,
                "in",
                item.BranchId,
                branches)));
        }

        if (IncludeSource(source, "purchases"))
        {
            var rows = await purchasesQuery.Select(item => new
            {
                item.Id,
                item.PurchaseNumber,
                item.PurchaseDate,
                item.Total,
                item.PaidAmount,
                item.PaymentStatus,
                Supplier = item.Supplier != null ? item.Supplier.Name : "No supplier",
                item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line(
                "purchases",
                item.Id,
                item.PurchaseNumber,
                item.PurchaseDate.ToDateTime(TimeOnly.MinValue),
                item.Supplier,
                item.PaymentStatus.ToString(),
                item.Total,
                item.PaidAmount,
                currency,
                "out",
                item.BranchId,
                branches)));
        }

        if (IncludeSource(source, "expenses"))
        {
            var rows = await expensesQuery.Select(item => new
            {
                item.Id,
                item.ExpenseDate,
                item.Amount,
                item.Description,
                item.Vendor,
                Category = item.GeneralTypeCategory != null ? item.GeneralTypeCategory.Name : "Expense",
                item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line(
                "expenses",
                item.Id,
                $"EXP-{item.Id:000000}",
                item.ExpenseDate.ToDateTime(TimeOnly.MinValue),
                $"{item.Category}: {item.Description}",
                item.Vendor ?? "Recorded",
                item.Amount,
                item.Amount,
                currency,
                "out",
                item.BranchId,
                branches)));
        }

        if (IncludeSource(source, "payroll"))
        {
            var rows = await payrollQuery.Select(item => new
            {
                item.Id,
                item.PaidDate,
                item.NetAmount,
                item.PaidAmount,
                item.PaymentStatus,
                Staff = item.Staff.FullName,
                item.PeriodMonth,
                item.PeriodYear,
                item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line(
                "payroll",
                item.Id,
                $"PAY-{item.Id:000000}",
                item.PaidDate.ToDateTime(TimeOnly.MinValue),
                $"{item.Staff} · {item.PeriodYear}/{item.PeriodMonth:00}",
                item.PaymentStatus.ToString(),
                item.NetAmount,
                item.PaidAmount,
                currency,
                "out",
                item.BranchId,
                branches)));
        }

        return lines;
    }

    private static async Task<IReadOnlyCollection<FinancialTrendPoint>> BuildCashTrendAsync(
        DateOnly start,
        DateOnly end,
        IQueryable<Payment> onlineCashQuery,
        IQueryable<InventorySalePayment> manualCashQuery,
        IQueryable<PurchasePayment> purchaseCashQuery,
        IQueryable<StaffSalaryInstallment> payrollCashQuery,
        IQueryable<Expense> expenseQuery,
        CancellationToken cancellationToken)
    {
        var onlineRows = await onlineCashQuery
            .Select(item => new { Date = item.PaidAt!.Value.Date, item.Amount })
            .ToListAsync(cancellationToken);
        var online = onlineRows
            .GroupBy(item => DateOnly.FromDateTime(item.Date))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Amount));
        var manual = await manualCashQuery
            .GroupBy(item => item.PaymentDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var purchases = await purchaseCashQuery
            .GroupBy(item => item.PaymentDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var payroll = await payrollCashQuery
            .GroupBy(item => item.PaymentDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var expenses = await expenseQuery
            .GroupBy(item => item.ExpenseDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);

        return Enumerable.Range(0, end.DayNumber - start.DayNumber + 1)
            .Select(offset =>
            {
                var date = start.AddDays(offset);
                var revenue = online.GetValueOrDefault(date) + manual.GetValueOrDefault(date);
                var cost = purchases.GetValueOrDefault(date) + payroll.GetValueOrDefault(date) +
                    expenses.GetValueOrDefault(date);
                return new FinancialTrendPoint(date, revenue, cost, revenue - cost);
            })
            .ToArray();
    }

    private async Task<IReadOnlyCollection<FinancialTrendPoint>> BuildProfitTrendAsync(
        DateOnly start,
        DateOnly end,
        long? branchId,
        string currency,
        CancellationToken cancellationToken)
    {
        var online = await context.Orders.AsNoTracking()
            .Where(item => item.Status != OrderStatus.Cancelled && item.Currency == currency &&
                item.CreatedAt >= start.ToDateTime(TimeOnly.MinValue) &&
                item.CreatedAt < end.AddDays(1).ToDateTime(TimeOnly.MinValue) &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .Select(item => new
            {
                Date = item.CreatedAt.Date,
                Revenue = item.Total,
                Cost = item.Items.Sum(line => line.Quantity * line.UnitCost)
            })
            .ToListAsync(cancellationToken);
        var manual = await context.InventorySales.AsNoTracking()
            .Where(item => item.CurrencyCode == currency && item.SaleDate >= start && item.SaleDate <= end &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .Select(item => new
            {
                Date = item.SaleDate,
                Revenue = item.Total,
                Cost = item.Items.Sum(line => line.Quantity * line.UnitCost)
            })
            .ToListAsync(cancellationToken);
        var expenses = await context.Expenses.AsNoTracking()
            .Where(item => item.CurrencyCode == currency && item.ExpenseDate >= start && item.ExpenseDate <= end &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .GroupBy(item => item.ExpenseDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var payroll = await context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.CurrencyCode == currency && item.PaidDate >= start && item.PaidDate <= end &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .GroupBy(item => item.PaidDate)
            .Select(group => new { Date = group.Key, Amount = group.Sum(item => item.NetAmount) })
            .ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);

        var onlineByDate = online
            .GroupBy(item => DateOnly.FromDateTime(item.Date))
            .ToDictionary(
                group => group.Key,
                group => new { Revenue = group.Sum(item => item.Revenue), Cost = group.Sum(item => item.Cost) });
        var manualByDate = manual
            .GroupBy(item => item.Date)
            .ToDictionary(
                group => group.Key,
                group => new { Revenue = group.Sum(item => item.Revenue), Cost = group.Sum(item => item.Cost) });

        return Enumerable.Range(0, end.DayNumber - start.DayNumber + 1)
            .Select(offset =>
            {
                var date = start.AddDays(offset);
                var onlinePoint = onlineByDate.GetValueOrDefault(date);
                var manualPoint = manualByDate.GetValueOrDefault(date);
                var revenue = (onlinePoint?.Revenue ?? 0) + (manualPoint?.Revenue ?? 0);
                var cost = (onlinePoint?.Cost ?? 0) + (manualPoint?.Cost ?? 0) +
                    expenses.GetValueOrDefault(date) + payroll.GetValueOrDefault(date);
                return new FinancialTrendPoint(date, revenue, cost, revenue - cost);
            })
            .ToArray();
    }

    private async Task<IReadOnlyCollection<TopProductResponse>> GetTopProductsAsync(
        DateTime start,
        DateTime end,
        DateOnly startOnly,
        DateOnly endOnly,
        long? branchId,
        string currency,
        CancellationToken cancellationToken)
    {
        var topOnline = await context.OrderItems.AsNoTracking()
            .Where(item => item.Order.CreatedAt >= start && item.Order.CreatedAt <= end &&
                item.Order.Status != OrderStatus.Cancelled && item.Order.Currency == currency &&
                (!branchId.HasValue || item.Order.BranchId == branchId.Value))
            .GroupBy(item => new { item.ProductId, item.Product.Name })
            .Select(group => new TopProductResponse(
                group.Key.ProductId,
                group.Key.Name,
                group.Sum(item => item.Quantity),
                group.Sum(item => (item.OrderedQuantity > 0 ? item.OrderedQuantity * item.SellingUnitPrice : item.Quantity * item.UnitPrice) - item.Discount + item.Tax)))
            .ToListAsync(cancellationToken);
        var topManual = await context.InventorySaleItems.AsNoTracking()
            .Where(item => item.InventorySale.SaleDate >= startOnly && item.InventorySale.SaleDate <= endOnly &&
                item.InventorySale.CurrencyCode == currency &&
                (!branchId.HasValue || item.InventorySale.BranchId == branchId.Value))
            .GroupBy(item => new { item.ProductId, item.Product.Name })
            .Select(group => new TopProductResponse(
                group.Key.ProductId,
                group.Key.Name,
                group.Sum(item => item.Quantity),
                group.Sum(item => item.LineTotal)))
            .ToListAsync(cancellationToken);

        return topOnline
            .Concat(topManual)
            .GroupBy(item => new { item.ProductId, item.ProductName })
            .Select(group => new TopProductResponse(
                group.Key.ProductId,
                group.Key.ProductName,
                group.Sum(item => item.Quantity),
                group.Sum(item => item.Revenue)))
            .OrderByDescending(item => item.Revenue)
            .Take(10)
            .ToArray();
    }

    private async Task<decimal> GetCashReceivedUntilAsync(
        DateTime asOf,
        DateOnly asOfOnly,
        long? branchId,
        string currency,
        CancellationToken cancellationToken)
    {
        var online = await context.Payments.AsNoTracking()
            .Where(item => item.PaidAt.HasValue && item.PaidAt.Value <= asOf && item.Currency == currency &&
                (item.Status == PaymentStatus.Paid || item.Status == PaymentStatus.PartiallyRefunded) &&
                (!branchId.HasValue || item.Order.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var manual = await context.InventorySalePayments.AsNoTracking()
            .Where(item => item.PaymentDate <= asOfOnly && item.InventorySale.CurrencyCode == currency &&
                (!branchId.HasValue || item.InventorySale.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        return online + manual;
    }

    private async Task<decimal> GetCashPaidUntilAsync(
        DateOnly asOf,
        long? branchId,
        string currency,
        CancellationToken cancellationToken)
    {
        var purchases = await context.PurchasePayments.AsNoTracking()
            .Where(item => item.PaymentDate <= asOf && item.Purchase.CurrencyCode == currency &&
                item.Purchase.Status != PurchaseStatus.Cancelled &&
                (!branchId.HasValue || item.Purchase.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var payroll = await context.StaffSalaryInstallments.AsNoTracking()
            .Where(item => item.PaymentDate <= asOf && item.StaffSalaryPayment.CurrencyCode == currency &&
                (!branchId.HasValue || item.StaffSalaryPayment.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var expenses = await context.Expenses.AsNoTracking()
            .Where(item => item.ExpenseDate <= asOf && item.CurrencyCode == currency &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        return purchases + payroll + expenses;
    }

    private async Task<decimal> GetInventoryValueAsync(
        DateTime asOf,
        long? branchId,
        CancellationToken cancellationToken)
    {
        var todayEnd = DateTime.UtcNow.Date.AddDays(1).AddTicks(-1);
        if (asOf >= todayEnd.Date)
        {
            return await context.InventoryLots.AsNoTracking()
                .Where(item => !item.Product.UsesDisplayStock &&
                    item.Quantity > 0 && item.UnitCost.HasValue &&
                    (!branchId.HasValue || item.BranchId == branchId.Value))
                .SumAsync(item => (decimal?)(item.Quantity * item.UnitCost!.Value), cancellationToken) ?? 0;
        }

        var asOfOnly = DateOnly.FromDateTime(asOf);
        var purchases = await context.PurchaseItems.AsNoTracking()
            .Where(item => !item.Product.UsesDisplayStock &&
                item.Purchase.PurchaseDate <= asOfOnly &&
                item.Purchase.Status != PurchaseStatus.Cancelled &&
                (!branchId.HasValue || item.Purchase.BranchId == branchId.Value))
            .GroupBy(item => item.ProductId)
            .Select(group => new
            {
                ProductId = group.Key,
                Quantity = group.Sum(item => item.Quantity),
                Cost = group.Sum(item => item.Quantity * item.UnitCost)
            })
            .ToListAsync(cancellationToken);
        var onlineSold = await context.OrderItems.AsNoTracking()
            .Where(item => item.AffectsInventory &&
                item.Order.CreatedAt <= asOf && item.Order.Status != OrderStatus.Cancelled &&
                (!branchId.HasValue || item.Order.BranchId == branchId.Value))
            .GroupBy(item => item.ProductId)
            .Select(group => new { ProductId = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);
        var manualSold = await context.InventorySaleItems.AsNoTracking()
            .Where(item => !item.Product.UsesDisplayStock &&
                item.InventorySale.SaleDate <= asOfOnly &&
                (!branchId.HasValue || item.InventorySale.BranchId == branchId.Value))
            .GroupBy(item => item.ProductId)
            .Select(group => new { ProductId = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);

        return purchases.Sum(item =>
        {
            if (item.Quantity <= 0)
                return 0;
            var available = Math.Max(
                0,
                item.Quantity - onlineSold.GetValueOrDefault(item.ProductId) -
                manualSold.GetValueOrDefault(item.ProductId));
            return available * (item.Cost / item.Quantity);
        });
    }

    private static FinancialReportLineResponse Line(
        string source,
        long id,
        string reference,
        DateTime date,
        string description,
        string status,
        decimal amount,
        decimal paid,
        string currency,
        string direction,
        long? branchId,
        IReadOnlyDictionary<long, string> branches) =>
        new(
            source,
            id,
            reference,
            date,
            description,
            status,
            amount,
            Math.Min(amount, Math.Max(0, paid)),
            Math.Max(0, amount - paid),
            currency,
            direction,
            branchId,
            branchId.HasValue ? branches.GetValueOrDefault(branchId.Value) : null);

    private long? ResolveBranchId(long? requestedBranchId)
    {
        if (!companyContext.BranchId.HasValue)
            return requestedBranchId;

        if (requestedBranchId.HasValue &&
            requestedBranchId.Value != companyContext.BranchId.Value)
            throw new UnauthorizedAccessException(
                "You can view financial data only for your assigned branch.");

        return companyContext.BranchId.Value;
    }

    private static void ValidateRange(
        DateTime start,
        DateTime end,
        decimal? minimumAmount,
        decimal? maximumAmount)
    {
        if (start > end)
            throw new ArgumentException("Start date must be before end date.");
        if ((end.Date - start.Date).TotalDays > 730)
            throw new ArgumentException("Report date ranges cannot exceed two years.");
        if (minimumAmount.HasValue && maximumAmount.HasValue && minimumAmount.Value > maximumAmount.Value)
            throw new ArgumentException("Minimum amount cannot be greater than maximum amount.");
    }

    private static bool IncludeSource(string? requested, string source) =>
        string.IsNullOrWhiteSpace(requested) ||
        requested.Equals(source, StringComparison.OrdinalIgnoreCase);

    private static string NormalizeCurrency(string? requested, string fallback)
    {
        var value = string.IsNullOrWhiteSpace(requested) ? fallback : requested;
        var clean = value.Trim().ToUpperInvariant();
        if (clean.Length != 3 || !clean.All(char.IsLetter))
            throw new ArgumentException("Currency code must contain three letters.");
        return clean;
    }

    private static void AddCurrency(ISet<string> currencies, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Trim().Length == 3)
            currencies.Add(value.Trim().ToUpperInvariant());
    }

    private static decimal Percentage(decimal value, decimal total) =>
        total == 0 ? 0 : decimal.Round(value / total * 100, 2);

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private sealed record LedgerSeed(
        DateTime Date,
        string Type,
        string Reference,
        string Description,
        decimal Debit,
        decimal Credit,
        long SourceId);
}
