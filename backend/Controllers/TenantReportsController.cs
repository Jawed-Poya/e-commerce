using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Dtos.Tenancy;
using ECommerce.Entities;
using ECommerce.Entities.Operations;
using ECommerce.Services.Tenancy;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrderStatus = ECommerce.Entities.Orders.OrderStatus;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = AppPermissions.TenantReportsView)]
public sealed class TenantReportsController(
    ApplicationDbContext context,
    ITenantContext tenantContext) : ControllerBase
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

    [HttpGet]
    public async Task<ActionResult<ApiResponse<TenantReportSummaryResponse>>> Get(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] long? branchId,
        [FromQuery] string? currencyCode,
        [FromQuery] string? source,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] decimal? minimumAmount,
        [FromQuery] decimal? maximumAmount,
        [FromQuery] string sort = "date-desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var end = (endDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
        var start = (startDate ?? end.AddDays(-29)).Date;
        if (start > end)
            return BadRequest(ApiResponse<object>.Fail("Start date must be before end date."));
        if ((end.Date - start.Date).TotalDays > 730)
            return BadRequest(ApiResponse<object>.Fail("Report date ranges cannot exceed two years."));
        if (minimumAmount.HasValue && maximumAmount.HasValue && minimumAmount.Value > maximumAmount.Value)
            return BadRequest(ApiResponse<object>.Fail("Minimum amount cannot be greater than maximum amount."));

        source = string.IsNullOrWhiteSpace(source) ? null : source.Trim();
        if (source is not null && !SupportedSources.Contains(source))
            return BadRequest(ApiResponse<object>.Fail("The selected report source is not supported."));

        sort = string.IsNullOrWhiteSpace(sort) ? "date-desc" : sort.Trim().ToLowerInvariant();
        if (!SupportedSorts.Contains(sort))
            return BadRequest(ApiResponse<object>.Fail("The selected report sort is not supported."));

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);
        var startOnly = DateOnly.FromDateTime(start);
        var endOnly = DateOnly.FromDateTime(end);
        var mainCurrency = await context.TenantSettings.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .Select(item => item.MainCurrencyCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "USD";
        var selectedCurrency = NormalizeCurrency(currencyCode, mainCurrency);
        var availableCurrencies = await GetAvailableCurrenciesAsync(selectedCurrency, cancellationToken);

        if (branchId.HasValue && !await context.Branches.AsNoTracking()
                .AnyAsync(item => item.Id == branchId.Value &&
                    item.TenantId == tenantContext.TenantId && item.IsActive, cancellationToken))
            return BadRequest(ApiResponse<object>.Fail("The selected branch is not available for this company."));

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

        if (branchId.HasValue)
        {
            ordersQuery = ordersQuery.Where(item => item.BranchId == branchId.Value);
            salesQuery = salesQuery.Where(item => item.BranchId == branchId.Value);
            purchasesQuery = purchasesQuery.Where(item => item.BranchId == branchId.Value);
            expensesQuery = expensesQuery.Where(item => item.BranchId == branchId.Value);
            payrollQuery = payrollQuery.Where(item => item.BranchId == branchId.Value);
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

        if (branchId.HasValue)
        {
            onlineCashQuery = onlineCashQuery.Where(item => item.Order.BranchId == branchId.Value);
            manualCashQuery = manualCashQuery.Where(item => item.InventorySale.BranchId == branchId.Value);
            purchaseCashQuery = purchaseCashQuery.Where(item => item.Purchase.BranchId == branchId.Value);
            payrollCashQuery = payrollCashQuery.Where(item => item.StaffSalaryPayment.BranchId == branchId.Value);
        }

        var onlineCash = await onlineCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var manualCash = await manualCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var purchaseCash = await purchaseCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var payrollCash = await payrollCashQuery.SumAsync(item => (decimal?)item.Amount, cancellationToken) ?? 0;
        var cashReceived = onlineCash + manualCash;
        var cashPaid = purchaseCash + payrollCash + expenseTotal;

        var outstandingReceivables = await GetOutstandingReceivablesAsync(end, endOnly, branchId, selectedCurrency, cancellationToken);
        var outstandingSupplierPayables = await context.Purchases.AsNoTracking()
            .Where(item => item.PurchaseDate <= endOnly && item.Status != PurchaseStatus.Cancelled &&
                item.CurrencyCode == selectedCurrency && (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0), cancellationToken) ?? 0;
        var outstandingPayroll = await context.StaffSalaryPayments.AsNoTracking()
            .Where(item => item.PaidDate <= endOnly && item.CurrencyCode == selectedCurrency &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.NetAmount > item.PaidAmount ? item.NetAmount - item.PaidAmount : 0), cancellationToken) ?? 0;

        var customerQuery = context.Customers.AsNoTracking().AsQueryable();
        var inventoryQuery = context.ProductInventories.AsNoTracking().AsQueryable();
        if (branchId.HasValue)
        {
            customerQuery = customerQuery.Where(item => item.BranchId == branchId.Value);
            inventoryQuery = inventoryQuery.Where(item => item.BranchId == branchId.Value);
        }
        var customerCount = await customerQuery.CountAsync(cancellationToken);
        var productCount = await context.Products.CountAsync(cancellationToken);
        var healthyInventoryProducts = await inventoryQuery
            .GroupBy(item => item.ProductId)
            .Where(group => group.Sum(item => item.Quantity - item.ReservedQuantity) > group.Sum(item => item.MinimumQuantity))
            .CountAsync(cancellationToken);
        var lowStock = Math.Max(0, productCount - healthyInventoryProducts);

        var branches = await context.Branches.AsNoTracking()
            .Where(item => item.TenantId == tenantContext.TenantId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var lines = await BuildLinesAsync(
            ordersQuery, salesQuery, purchasesQuery, expensesQuery, payrollQuery,
            source, branches, selectedCurrency, cancellationToken);

        if (!string.IsNullOrWhiteSpace(status))
            lines = lines.Where(item => item.Status.Contains(status.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var cleanSearch = search.Trim();
            lines = lines.Where(item =>
                item.Reference.Contains(cleanSearch, StringComparison.OrdinalIgnoreCase) ||
                item.Description.Contains(cleanSearch, StringComparison.OrdinalIgnoreCase) ||
                (item.BranchName?.Contains(cleanSearch, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }
        if (minimumAmount.HasValue) lines = lines.Where(item => item.Amount >= minimumAmount.Value).ToList();
        if (maximumAmount.HasValue) lines = lines.Where(item => item.Amount <= maximumAmount.Value).ToList();

        lines = sort switch
        {
            "date-asc" => lines.OrderBy(item => item.Date).ToList(),
            "amount-desc" => lines.OrderByDescending(item => item.Amount).ToList(),
            "amount-asc" => lines.OrderBy(item => item.Amount).ToList(),
            _ => lines.OrderByDescending(item => item.Date).ToList()
        };
        var totalResults = lines.Count;
        var pagedLines = lines.Skip((page - 1) * pageSize).Take(pageSize).ToArray();

        var trend = await BuildCashTrendAsync(
            startOnly, endOnly, onlineCashQuery, manualCashQuery, purchaseCashQuery,
            payrollCashQuery, expensesQuery, cancellationToken);
        var topProducts = await GetTopProductsAsync(
            start, end, startOnly, endOnly, branchId, selectedCurrency, cancellationToken);

        var totalRevenue = onlineRevenue + manualRevenue;
        var operatingCosts = purchaseTotal + expenseTotal + payrollObligation;
        var response = new TenantReportSummaryResponse(
            start,
            end,
            selectedCurrency,
            availableCurrencies,
            onlineRevenue,
            manualRevenue,
            totalRevenue,
            cashReceived,
            purchaseTotal,
            expenseTotal,
            payrollObligation,
            payrollPaidForDocuments,
            cashPaid,
            cashReceived - cashPaid,
            totalRevenue - operatingCosts,
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
            trend,
            topProducts,
            pagedLines,
            totalResults,
            page,
            pageSize);
        return Ok(ApiResponse<TenantReportSummaryResponse>.Ok(response));
    }

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
        var online = onlineRows.Sum(item => Math.Max(0,
            item.Total - (item.Paid > 0 ? item.Paid : item.PaymentStatus == PaymentStatus.Paid ? item.Total : 0)));
        var manual = await context.InventorySales.AsNoTracking()
            .Where(item => item.SaleDate <= endOnly && item.CurrencyCode == currency &&
                (!branchId.HasValue || item.BranchId == branchId.Value))
            .SumAsync(item => (decimal?)(item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0), cancellationToken) ?? 0;
        return online + manual;
    }

    private static async Task<List<TenantReportLineResponse>> BuildLinesAsync(
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
        var lines = new List<TenantReportLineResponse>();
        if (IncludeSource(source, "orders"))
        {
            var rows = await ordersQuery.Select(item => new
            {
                item.Id, item.OrderNumber, item.CreatedAt, item.Total, item.Status, item.PaymentStatus, item.BranchId,
                Customer = item.Customer.FirstName + " " + (item.Customer.LastName ?? ""),
                Paid = item.Payments.Where(payment => payment.Status == PaymentStatus.Paid || payment.Status == PaymentStatus.PartiallyRefunded)
                    .Sum(payment => (decimal?)payment.Amount) ?? 0
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item =>
            {
                var paid = item.Paid > 0 ? item.Paid : item.PaymentStatus == PaymentStatus.Paid ? item.Total : 0;
                return Line("orders", item.Id, item.OrderNumber, item.CreatedAt, item.Customer.Trim(),
                    $"{item.Status} / {item.PaymentStatus}", item.Total, paid, currency, "in", item.BranchId, branches);
            }));
        }
        if (IncludeSource(source, "manual-sales"))
        {
            var rows = await salesQuery.Select(item => new
            {
                item.Id, item.SaleNumber, item.SaleDate, item.Total, item.PaidAmount,
                item.PaymentStatus, item.CustomerName, item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line("manual-sales", item.Id, item.SaleNumber,
                item.SaleDate.ToDateTime(TimeOnly.MinValue), item.CustomerName ?? "Walk-in customer",
                item.PaymentStatus.ToString(), item.Total, item.PaidAmount, currency, "in", item.BranchId, branches)));
        }
        if (IncludeSource(source, "purchases"))
        {
            var rows = await purchasesQuery.Select(item => new
            {
                item.Id, item.PurchaseNumber, item.PurchaseDate, item.Total, item.PaidAmount,
                item.PaymentStatus, Supplier = item.Supplier != null ? item.Supplier.Name : "No supplier", item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line("purchases", item.Id, item.PurchaseNumber,
                item.PurchaseDate.ToDateTime(TimeOnly.MinValue), item.Supplier, item.PaymentStatus.ToString(),
                item.Total, item.PaidAmount, currency, "out", item.BranchId, branches)));
        }
        if (IncludeSource(source, "expenses"))
        {
            var rows = await expensesQuery.Select(item => new
            {
                item.Id, item.ExpenseDate, item.Amount, item.Description, item.Vendor,
                Category = item.GeneralTypeCategory != null ? item.GeneralTypeCategory.Name : "Expense", item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line("expenses", item.Id, $"EXP-{item.Id:000000}",
                item.ExpenseDate.ToDateTime(TimeOnly.MinValue), $"{item.Category}: {item.Description}",
                item.Vendor ?? "Recorded", item.Amount, item.Amount, currency, "out", item.BranchId, branches)));
        }
        if (IncludeSource(source, "payroll"))
        {
            var rows = await payrollQuery.Select(item => new
            {
                item.Id, item.PaidDate, item.NetAmount, item.PaidAmount, item.PaymentStatus,
                Staff = item.Staff.FullName, item.PeriodMonth, item.PeriodYear, item.BranchId
            }).ToListAsync(cancellationToken);
            lines.AddRange(rows.Select(item => Line("payroll", item.Id, $"PAY-{item.Id:000000}",
                item.PaidDate.ToDateTime(TimeOnly.MinValue), $"{item.Staff} · {item.PeriodYear}/{item.PeriodMonth:00}",
                item.PaymentStatus.ToString(), item.NetAmount, item.PaidAmount, currency, "out", item.BranchId, branches)));
        }
        return lines;
    }

    private static async Task<IReadOnlyCollection<TenantReportTrendPoint>> BuildCashTrendAsync(
        DateOnly start,
        DateOnly end,
        IQueryable<Payment> onlineCashQuery,
        IQueryable<InventorySalePayment> manualCashQuery,
        IQueryable<PurchasePayment> purchaseCashQuery,
        IQueryable<StaffSalaryInstallment> payrollCashQuery,
        IQueryable<Expense> expenseQuery,
        CancellationToken cancellationToken)
    {
        var onlineRows = await onlineCashQuery.Select(item => new { Date = item.PaidAt!.Value.Date, item.Amount }).ToListAsync(cancellationToken);
        var online = onlineRows.GroupBy(item => DateOnly.FromDateTime(item.Date)).ToDictionary(group => group.Key, group => group.Sum(item => item.Amount));
        var manual = await manualCashQuery.GroupBy(item => item.PaymentDate).Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) }).ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var purchases = await purchaseCashQuery.GroupBy(item => item.PaymentDate).Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) }).ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var payroll = await payrollCashQuery.GroupBy(item => item.PaymentDate).Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) }).ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        var expenses = await expenseQuery.GroupBy(item => item.ExpenseDate).Select(group => new { Date = group.Key, Amount = group.Sum(item => item.Amount) }).ToDictionaryAsync(item => item.Date, item => item.Amount, cancellationToken);
        return Enumerable.Range(0, end.DayNumber - start.DayNumber + 1).Select(offset =>
        {
            var date = start.AddDays(offset);
            var revenue = online.GetValueOrDefault(date) + manual.GetValueOrDefault(date);
            var cost = purchases.GetValueOrDefault(date) + payroll.GetValueOrDefault(date) + expenses.GetValueOrDefault(date);
            return new TenantReportTrendPoint(date, revenue, cost, revenue - cost);
        }).ToArray();
    }

    private async Task<IReadOnlyCollection<TenantTopProductResponse>> GetTopProductsAsync(
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
                (!branchId.HasValue || item.Order.BranchId == branchId))
            .GroupBy(item => new { item.ProductId, item.Product.Name })
            .Select(group => new TenantTopProductResponse(group.Key.ProductId, group.Key.Name,
                group.Sum(item => item.Quantity),
                group.Sum(item => (item.Quantity * item.UnitPrice) - item.Discount + item.Tax)))
            .ToListAsync(cancellationToken);
        var topManual = await context.InventorySaleItems.AsNoTracking()
            .Where(item => item.InventorySale.SaleDate >= startOnly && item.InventorySale.SaleDate <= endOnly &&
                item.InventorySale.CurrencyCode == currency && (!branchId.HasValue || item.InventorySale.BranchId == branchId))
            .GroupBy(item => new { item.ProductId, item.Product.Name })
            .Select(group => new TenantTopProductResponse(group.Key.ProductId, group.Key.Name,
                group.Sum(item => item.Quantity), group.Sum(item => item.LineTotal)))
            .ToListAsync(cancellationToken);
        return topOnline.Concat(topManual)
            .GroupBy(item => new { item.ProductId, item.ProductName })
            .Select(group => new TenantTopProductResponse(group.Key.ProductId, group.Key.ProductName,
                group.Sum(item => item.Quantity), group.Sum(item => item.Revenue)))
            .OrderByDescending(item => item.Revenue)
            .Take(10)
            .ToArray();
    }

    private static TenantReportLineResponse Line(
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
        new(source, id, reference, date, description, status, amount, Math.Min(amount, Math.Max(0, paid)),
            Math.Max(0, amount - paid), currency, direction, branchId,
            branchId.HasValue ? branches.GetValueOrDefault(branchId.Value) : null);

    private static bool IncludeSource(string? requested, string source) =>
        string.IsNullOrWhiteSpace(requested) || requested.Equals(source, StringComparison.OrdinalIgnoreCase);

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
}
