using API.Entities.Orders;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Orders;
using ECommerce.Services.Company;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Accounting;

public sealed class AccountingPostingService(
    ApplicationDbContext context,
    IBranchContext branchContext) : IAccountingPostingService
{
    private static class Accounts
    {
        public const string Cash = "1000";
        public const string CashName = "Cash on Hand";
        public const string Bank = "1010";
        public const string BankName = "Bank Account";
        public const string Receivable = "1100";
        public const string ReceivableName = "Accounts Receivable";
        public const string Inventory = "1200";
        public const string InventoryName = "Inventory";
        public const string Payable = "2000";
        public const string PayableName = "Accounts Payable";
        public const string CustomerDeposits = "2050";
        public const string CustomerDepositsName = "Customer Credit and Deposits";
        public const string PayrollPayable = "2200";
        public const string PayrollPayableName = "Payroll Payable";
        public const string SalesTax = "2300";
        public const string SalesTaxName = "Sales Tax Payable";
        public const string Sales = "4000";
        public const string SalesName = "Sales Revenue";
        public const string SalesReturns = "4010";
        public const string SalesReturnsName = "Sales Returns and Allowances";
        public const string Shipping = "4200";
        public const string ShippingName = "Shipping Revenue";
        public const string CostOfGoods = "5000";
        public const string CostOfGoodsName = "Cost of Goods Sold";
        public const string Expense = "6000";
        public const string ExpenseName = "Operating Expense";
        public const string SalaryExpense = "6100";
        public const string SalaryExpenseName = "Salary Expense";
    }

    public Task<bool> PostPurchaseAsync(Purchase purchase, string? supplierName, string? postedByUserId, CancellationToken ct)
    {
        var description = $"Inventory received on {purchase.PurchaseNumber}";
        return AddOperationalVoucherAsync(
            JournalVoucherType.Purchase,
            "Purchase",
            purchase.Id,
            purchase.PurchaseNumber,
            purchase.PurchaseDate,
            purchase.CurrencyCode,
            $"Purchase {purchase.PurchaseNumber} received",
            purchase.ReferenceNumber,
            "Supplier",
            purchase.SupplierId,
            supplierName,
            purchase.CreatedByUserId,
            postedByUserId,
            purchase.BranchId,
            [
                Debit(Accounts.Inventory, Accounts.InventoryName, purchase.Total, description),
                Credit(Accounts.Payable, Accounts.PayableName, purchase.Total, description)
            ],
            ct);
    }

    public Task<bool> PostPurchasePaymentAsync(Purchase purchase, PurchasePayment payment, string? supplierName, string? postedByUserId, CancellationToken ct)
    {
        var account = PaymentAccount(payment.PaymentMethod);
        var description = $"{payment.PaymentMethod} payment for {purchase.PurchaseNumber}";
        return AddOperationalVoucherAsync(
            JournalVoucherType.PurchasePayment,
            "PurchasePayment",
            payment.Id,
            purchase.PurchaseNumber,
            payment.PaymentDate,
            purchase.CurrencyCode,
            $"Supplier payment for {purchase.PurchaseNumber}",
            payment.ReferenceNumber,
            "Supplier",
            purchase.SupplierId,
            supplierName,
            payment.CreatedByUserId ?? purchase.CreatedByUserId,
            postedByUserId,
            purchase.BranchId,
            [
                Debit(Accounts.Payable, Accounts.PayableName, payment.Amount, description),
                Credit(account.Code, account.Name, payment.Amount, description)
            ],
            ct);
    }

    public Task<bool> PostManualSaleAsync(InventorySale sale, string customerName, string? postedByUserId, CancellationToken ct)
    {
        var lines = new List<JournalVoucherLine>();
        AddPositive(lines, Debit(Accounts.Receivable, Accounts.ReceivableName, sale.Total, $"Sale {sale.SaleNumber}"));
        AddPositive(lines, Credit(Accounts.Sales, Accounts.SalesName, sale.Total - sale.Tax, $"Net sales on {sale.SaleNumber}"));
        AddPositive(lines, Credit(Accounts.SalesTax, Accounts.SalesTaxName, sale.Tax, $"Sales tax on {sale.SaleNumber}"));
        var cost = sale.Items.Where(item => !item.IsDeleted).Sum(item => item.Quantity * item.UnitCost);
        AddPositive(lines, Debit(Accounts.CostOfGoods, Accounts.CostOfGoodsName, cost, $"Cost recognized for {sale.SaleNumber}"));
        AddPositive(lines, Credit(Accounts.Inventory, Accounts.InventoryName, cost, $"Inventory issued for {sale.SaleNumber}"));

        return AddOperationalVoucherAsync(
            JournalVoucherType.ManualSale,
            "ManualSale",
            sale.Id,
            sale.SaleNumber,
            sale.SaleDate,
            sale.CurrencyCode,
            $"Manual sale {sale.SaleNumber}",
            sale.ReferenceNumber,
            "Customer",
            sale.CustomerId,
            customerName,
            sale.CreatedByUserId,
            postedByUserId,
            sale.BranchId,
            lines,
            ct);
    }

    public Task<bool> PostSalePaymentAsync(
        InventorySale sale,
        InventorySalePayment payment,
        decimal receivableBeforePayment,
        string customerName,
        string? postedByUserId,
        CancellationToken ct)
    {
        var receivableSettlement = Math.Min(payment.Amount, Math.Max(0, receivableBeforePayment));
        var customerDeposit = Math.Max(0, payment.Amount - receivableSettlement);
        var isAccountCredit = payment.PaymentMethod.Equals("Account credit", StringComparison.OrdinalIgnoreCase);
        var debitAccount = isAccountCredit
            ? (Accounts.CustomerDeposits, Accounts.CustomerDepositsName)
            : PaymentAccount(payment.PaymentMethod);
        var lines = new List<JournalVoucherLine>();
        AddPositive(lines, Debit(debitAccount.Item1, debitAccount.Item2, payment.Amount, $"Receipt for {sale.SaleNumber}"));
        AddPositive(lines, Credit(Accounts.Receivable, Accounts.ReceivableName, receivableSettlement, $"Receivable settled for {sale.SaleNumber}"));
        AddPositive(lines, Credit(Accounts.CustomerDeposits, Accounts.CustomerDepositsName, customerDeposit, $"Customer overpayment on {sale.SaleNumber}"));

        return AddOperationalVoucherAsync(
            JournalVoucherType.SaleReceipt,
            "SalePayment",
            payment.Id,
            sale.SaleNumber,
            payment.PaymentDate,
            sale.CurrencyCode,
            $"Customer receipt for {sale.SaleNumber}",
            payment.ReferenceNumber,
            "Customer",
            sale.CustomerId,
            customerName,
            payment.CreatedByUserId ?? sale.CreatedByUserId,
            postedByUserId,
            sale.BranchId,
            lines,
            ct);
    }

    public Task<bool> PostSalesReturnAsync(
        InventorySaleReturn salesReturn,
        string customerName,
        string? postedByUserId,
        CancellationToken ct)
    {
        var lines = new List<JournalVoucherLine>();
        AddPositive(lines, Debit(
            Accounts.SalesReturns,
            Accounts.SalesReturnsName,
            salesReturn.Total - salesReturn.TaxAmount,
            $"Return {salesReturn.ReturnNumber} for {salesReturn.InventorySale.SaleNumber}"));
        AddPositive(lines, Debit(
            Accounts.SalesTax,
            Accounts.SalesTaxName,
            salesReturn.TaxAmount,
            $"Sales tax reversed on {salesReturn.ReturnNumber}"));
        AddPositive(lines, Credit(
            Accounts.Receivable,
            Accounts.ReceivableName,
            salesReturn.DebtReduction,
            $"Receivable reduced by {salesReturn.ReturnNumber}"));
        AddPositive(lines, Credit(
            Accounts.CustomerDeposits,
            Accounts.CustomerDepositsName,
            salesReturn.CreditAmount,
            $"Customer credit from {salesReturn.ReturnNumber}"));
        var refundAccount = PaymentAccount(salesReturn.RefundMethod);
        AddPositive(lines, Credit(
            refundAccount.Code,
            refundAccount.Name,
            salesReturn.RefundAmount,
            $"Refund paid for {salesReturn.ReturnNumber}"));

        var restoredCost = salesReturn.Items
            .Where(item => item.Restock)
            .Sum(item => item.Quantity * item.UnitCost);
        AddPositive(lines, Debit(
            Accounts.Inventory,
            Accounts.InventoryName,
            restoredCost,
            $"Returned inventory on {salesReturn.ReturnNumber}"));
        AddPositive(lines, Credit(
            Accounts.CostOfGoods,
            Accounts.CostOfGoodsName,
            restoredCost,
            $"Cost reversed on {salesReturn.ReturnNumber}"));

        return AddOperationalVoucherAsync(
            JournalVoucherType.SalesReturn,
            "SalesReturn",
            salesReturn.Id,
            salesReturn.ReturnNumber,
            salesReturn.ReturnDate,
            salesReturn.CurrencyCode,
            $"Customer return {salesReturn.ReturnNumber} against {salesReturn.InventorySale.SaleNumber}",
            salesReturn.InventorySale.ReferenceNumber,
            "Customer",
            salesReturn.CustomerId,
            customerName,
            salesReturn.CreatedByUserId,
            postedByUserId,
            salesReturn.BranchId,
            lines,
            ct);
    }

    public Task<bool> PostExpenseAsync(Expense expense, string categoryName, string? postedByUserId, CancellationToken ct)
    {
        var payment = PaymentAccount(expense.PaymentMethod);
        var description = $"{categoryName}: {expense.Description}";
        return AddOperationalVoucherAsync(
            JournalVoucherType.Expense,
            "Expense",
            expense.Id,
            expense.ReferenceNumber ?? $"EXP-{expense.Id}",
            expense.ExpenseDate,
            expense.CurrencyCode,
            expense.Description,
            expense.ReferenceNumber,
            "Vendor",
            null,
            expense.Vendor,
            expense.CreatedByUserId,
            postedByUserId,
            expense.BranchId,
            [
                Debit(Accounts.Expense, Accounts.ExpenseName, expense.Amount, description),
                Credit(payment.Code, payment.Name, expense.Amount, description)
            ],
            ct);
    }

    public Task<bool> PostPayrollAccrualAsync(StaffSalaryPayment salary, string staffName, string? postedByUserId, CancellationToken ct)
    {
        var period = $"{salary.PeriodYear:D4}-{salary.PeriodMonth:D2}";
        return AddOperationalVoucherAsync(
            JournalVoucherType.PayrollAccrual,
            "Payroll",
            salary.Id,
            $"PAY-{salary.Id}",
            salary.PaidDate,
            salary.CurrencyCode,
            $"Payroll accrued for {staffName}, {period}",
            salary.ReferenceNumber,
            "Staff",
            salary.StaffId,
            staffName,
            salary.CreatedByUserId,
            postedByUserId,
            salary.BranchId,
            [
                Debit(Accounts.SalaryExpense, Accounts.SalaryExpenseName, salary.NetAmount, $"Salary expense for {period}"),
                Credit(Accounts.PayrollPayable, Accounts.PayrollPayableName, salary.NetAmount, $"Salary payable to {staffName}")
            ],
            ct);
    }

    public Task<bool> PostPayrollPaymentAsync(StaffSalaryPayment salary, StaffSalaryInstallment payment, string staffName, string? postedByUserId, CancellationToken ct)
    {
        var account = PaymentAccount(payment.PaymentMethod);
        return AddOperationalVoucherAsync(
            JournalVoucherType.PayrollPayment,
            "PayrollPayment",
            payment.Id,
            $"PAY-{salary.Id}",
            payment.PaymentDate,
            salary.CurrencyCode,
            $"Payroll payment to {staffName}",
            payment.ReferenceNumber,
            "Staff",
            salary.StaffId,
            staffName,
            payment.CreatedByUserId ?? salary.CreatedByUserId,
            postedByUserId,
            salary.BranchId,
            [
                Debit(Accounts.PayrollPayable, Accounts.PayrollPayableName, payment.Amount, $"Payroll liability settled for {staffName}"),
                Credit(account.Code, account.Name, payment.Amount, $"{payment.PaymentMethod} payroll payment")
            ],
            ct);
    }

    public Task<bool> PostOnlineSaleAsync(Order order, string? postedByUserId, CancellationToken ct)
    {
        var customerName = (order.Customer.FirstName + " " + (order.Customer.LastName ?? string.Empty)).Trim();
        var lines = new List<JournalVoucherLine>();
        AddPositive(lines, Debit(Accounts.Receivable, Accounts.ReceivableName, order.Total, $"Online order {order.OrderNumber}"));
        AddPositive(lines, Credit(Accounts.Sales, Accounts.SalesName, order.Total - order.TaxTotal - order.ShippingTotal, $"Online sales on {order.OrderNumber}"));
        AddPositive(lines, Credit(Accounts.Shipping, Accounts.ShippingName, order.ShippingTotal, $"Shipping charged on {order.OrderNumber}"));
        AddPositive(lines, Credit(Accounts.SalesTax, Accounts.SalesTaxName, order.TaxTotal, $"Sales tax on {order.OrderNumber}"));
        var cost = order.Items.Where(item => item.AffectsInventory).Sum(item => item.Quantity * item.UnitCost);
        AddPositive(lines, Debit(Accounts.CostOfGoods, Accounts.CostOfGoodsName, cost, $"Cost recognized for {order.OrderNumber}"));
        AddPositive(lines, Credit(Accounts.Inventory, Accounts.InventoryName, cost, $"Inventory fulfilled for {order.OrderNumber}"));

        return AddOperationalVoucherAsync(
            JournalVoucherType.OnlineSale,
            "OnlineOrder",
            order.Id,
            order.OrderNumber,
            DateOnly.FromDateTime(order.UpdatedAt ?? order.CreatedAt),
            order.Currency,
            $"Delivered online order {order.OrderNumber}",
            null,
            "Customer",
            order.CustomerId,
            customerName,
            postedByUserId,
            postedByUserId,
            order.BranchId,
            lines,
            ct);
    }

    public Task<bool> PostOnlinePaymentAsync(Order order, Payment payment, string? postedByUserId, CancellationToken ct)
    {
        var customerName = (order.Customer.FirstName + " " + (order.Customer.LastName ?? string.Empty)).Trim();
        var account = PaymentAccount(payment.Provider);
        var description = $"Online payment for {order.OrderNumber}";
        return AddOperationalVoucherAsync(
            JournalVoucherType.OnlineReceipt,
            "OnlinePayment",
            payment.Id,
            order.OrderNumber,
            DateOnly.FromDateTime(payment.PaidAt ?? order.UpdatedAt ?? order.CreatedAt),
            payment.Currency,
            description,
            payment.ExternalReference,
            "Customer",
            order.CustomerId,
            customerName,
            postedByUserId,
            postedByUserId,
            order.BranchId,
            [
                Debit(account.Code, account.Name, payment.Amount, description),
                Credit(Accounts.Receivable, Accounts.ReceivableName, payment.Amount, description)
            ],
            ct);
    }

    public async Task<int> SyncOperationalVouchersAsync(string? postedByUserId, CancellationToken ct)
    {
        var created = 0;
        var purchases = await context.Purchases
            .AsNoTracking()
            .Include(item => item.Supplier)
            .Include(item => item.Payments)
            .Where(item => item.Status != PurchaseStatus.Cancelled &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .ToListAsync(ct);
        foreach (var purchase in purchases)
        {
            if (await PostPurchaseAsync(purchase, purchase.Supplier?.Name, postedByUserId, ct)) created++;
            foreach (var payment in purchase.Payments.OrderBy(item => item.PaymentDate).ThenBy(item => item.Id))
                if (await PostPurchasePaymentAsync(purchase, payment, purchase.Supplier?.Name, postedByUserId, ct)) created++;
        }

        var sales = await context.InventorySales
            .AsNoTracking()
            .Include(item => item.Customer)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Where(item => !branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value)
            .ToListAsync(ct);
        foreach (var sale in sales)
        {
            var customerName = sale.Customer is null
                ? sale.CustomerName ?? "Walk-in customer"
                : (sale.Customer.FirstName + " " + (sale.Customer.LastName ?? string.Empty)).Trim();
            if (await PostManualSaleAsync(sale, customerName, postedByUserId, ct)) created++;
            var remaining = Math.Max(0, sale.Total - sale.ReturnedAmount);
            foreach (var payment in sale.Payments.OrderBy(item => item.PaymentDate).ThenBy(item => item.Id))
            {
                if (await PostSalePaymentAsync(sale, payment, remaining, customerName, postedByUserId, ct)) created++;
                remaining = Math.Max(0, remaining - payment.Amount);
            }
        }

        var salesReturns = await context.InventorySaleReturns
            .AsNoTracking()
            .Include(item => item.Customer)
            .Include(item => item.InventorySale)
            .Include(item => item.Items)
            .Where(item => !branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value)
            .ToListAsync(ct);
        foreach (var salesReturn in salesReturns)
        {
            var customerName = salesReturn.Customer is null
                ? salesReturn.InventorySale.CustomerName ?? "Walk-in customer"
                : (salesReturn.Customer.FirstName + " " + (salesReturn.Customer.LastName ?? string.Empty)).Trim();
            if (await PostSalesReturnAsync(salesReturn, customerName, postedByUserId, ct)) created++;
        }

        var expenses = await context.Expenses
            .AsNoTracking()
            .Include(item => item.GeneralTypeCategory)
            .Include(item => item.Category)
            .Where(item => !branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value)
            .ToListAsync(ct);
        foreach (var expense in expenses)
        {
            var category = expense.GeneralTypeCategory?.Name ?? expense.Category?.Name ?? "Uncategorized";
            if (await PostExpenseAsync(expense, category, postedByUserId, ct)) created++;
        }

        var salaries = await context.StaffSalaryPayments
            .AsNoTracking()
            .Include(item => item.Staff)
            .Include(item => item.Installments)
            .Where(item => !branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value)
            .ToListAsync(ct);
        foreach (var salary in salaries)
        {
            if (await PostPayrollAccrualAsync(salary, salary.Staff.FullName, postedByUserId, ct)) created++;
            foreach (var payment in salary.Installments.OrderBy(item => item.PaymentDate).ThenBy(item => item.Id))
                if (await PostPayrollPaymentAsync(salary, payment, salary.Staff.FullName, postedByUserId, ct)) created++;
        }

        var onlineOrders = await context.Orders
            .AsNoTracking()
            .Include(item => item.Customer)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Where(item => item.Status == OrderStatus.Delivered &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .ToListAsync(ct);
        foreach (var order in onlineOrders)
        {
            if (await PostOnlineSaleAsync(order, postedByUserId, ct)) created++;
            foreach (var payment in order.Payments
                         .Where(item => item.Status is PaymentStatus.Paid or PaymentStatus.PartiallyRefunded)
                         .OrderBy(item => item.PaidAt)
                         .ThenBy(item => item.Id))
                if (await PostOnlinePaymentAsync(order, payment, postedByUserId, ct)) created++;
        }

        if (created > 0) await context.SaveChangesAsync(ct);
        return created;
    }

    public async Task<JournalVoucher> ReverseManualVoucherAsync(long voucherId, string reason, string? userId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("A reversal reason is required.");
        if (reason.Trim().Length > 1000) throw new ArgumentException("The reversal reason cannot exceed 1,000 characters.");
        var voucher = await context.JournalVouchers
            .Include(item => item.Lines)
            .Where(item => item.Id == voucherId &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Voucher not found.");
        if (voucher.IsSystemGenerated)
            throw new InvalidOperationException("System-generated vouchers must be corrected from their source sale, purchase, payment, expense, or payroll workflow.");
        if (voucher.Status == JournalVoucherStatus.Reversed)
            throw new InvalidOperationException("This voucher is already reversed.");
        if (voucher.VoucherType == JournalVoucherType.Reversal)
            throw new InvalidOperationException("A reversal voucher cannot be reversed again.");

        var now = DateTime.UtcNow;
        voucher.Status = JournalVoucherStatus.Reversed;
        voucher.ReversedAt = now;
        voucher.ReversedByUserId = userId;
        voucher.ReversalReason = reason.Trim();
        var reversal = new JournalVoucher
        {
            VoucherNumber = VoucherNumber("RV"),
            VoucherDate = DateOnly.FromDateTime(now),
            CurrencyCode = voucher.CurrencyCode,
            VoucherType = JournalVoucherType.Reversal,
            Status = JournalVoucherStatus.Posted,
            IsSystemGenerated = false,
            ReferenceNumber = voucher.VoucherNumber,
            Memo = $"Reversal of {voucher.VoucherNumber}: {reason.Trim()}",
            TotalDebit = voucher.TotalCredit,
            TotalCredit = voucher.TotalDebit,
            CreatedByUserId = userId,
            PostedByUserId = userId,
            PostedAt = now,
            ReversalOfVoucherId = voucher.Id,
            BranchId = voucher.BranchId,
            Lines = voucher.Lines.Select(line => new JournalVoucherLine
            {
                AccountCode = line.AccountCode,
                AccountName = line.AccountName,
                Description = $"Reversal: {line.Description ?? voucher.Memo}",
                Debit = line.Credit,
                Credit = line.Debit,
                BranchId = voucher.BranchId
            }).ToList()
        };
        context.JournalVouchers.Add(reversal);
        await context.SaveChangesAsync(ct);
        return reversal;
    }

    private async Task<bool> AddOperationalVoucherAsync(
        JournalVoucherType voucherType,
        string sourceType,
        long sourceId,
        string sourceNumber,
        DateOnly voucherDate,
        string currencyCode,
        string memo,
        string? referenceNumber,
        string? counterpartyType,
        long? counterpartyId,
        string? counterpartyName,
        string? createdByUserId,
        string? postedByUserId,
        long? branchId,
        IReadOnlyCollection<JournalVoucherLine> lines,
        CancellationToken ct)
    {
        if (context.JournalVouchers.Local.Any(item => item.Status == JournalVoucherStatus.Posted && item.SourceType == sourceType && item.SourceId == sourceId) ||
            await context.JournalVouchers.AsNoTracking().AnyAsync(item => item.Status == JournalVoucherStatus.Posted && item.SourceType == sourceType && item.SourceId == sourceId, ct))
            return false;

        var effectiveLines = lines.Where(line => line.Debit > 0 || line.Credit > 0).ToList();
        var debit = decimal.Round(effectiveLines.Sum(line => line.Debit), 2, MidpointRounding.AwayFromZero);
        var credit = decimal.Round(effectiveLines.Sum(line => line.Credit), 2, MidpointRounding.AwayFromZero);
        if (debit <= 0 && credit <= 0) return false;
        if (effectiveLines.Count < 2 || debit <= 0 || Math.Abs(debit - credit) > 0.009m)
            throw new InvalidOperationException($"Accounting posting for {sourceType} {sourceNumber} is not balanced: debit {debit:N2}, credit {credit:N2}.");

        var now = DateTime.UtcNow;
        var voucher = new JournalVoucher
        {
            VoucherNumber = VoucherNumber(Prefix(voucherType)),
            VoucherDate = voucherDate,
            CurrencyCode = currencyCode,
            VoucherType = voucherType,
            Status = JournalVoucherStatus.Posted,
            IsSystemGenerated = true,
            ReferenceNumber = referenceNumber,
            SourceType = sourceType,
            SourceId = sourceId,
            SourceNumber = sourceNumber,
            CounterpartyType = counterpartyType,
            CounterpartyId = counterpartyId,
            CounterpartyName = counterpartyName,
            Memo = memo,
            TotalDebit = debit,
            TotalCredit = credit,
            CreatedByUserId = createdByUserId,
            PostedByUserId = postedByUserId,
            PostedAt = now,
            BranchId = branchId,
            Lines = effectiveLines
        };
        foreach (var line in effectiveLines) line.BranchId = branchId;
        context.JournalVouchers.Add(voucher);
        return true;
    }

    private static JournalVoucherLine Debit(string code, string name, decimal amount, string description) =>
        new() { AccountCode = code, AccountName = name, Description = description, Debit = Money(amount), Credit = 0 };

    private static JournalVoucherLine Credit(string code, string name, decimal amount, string description) =>
        new() { AccountCode = code, AccountName = name, Description = description, Debit = 0, Credit = Money(amount) };

    private static void AddPositive(ICollection<JournalVoucherLine> lines, JournalVoucherLine line)
    {
        if (line.Debit > 0 || line.Credit > 0) lines.Add(line);
    }

    private static decimal Money(decimal amount) => decimal.Round(Math.Max(0, amount), 2, MidpointRounding.AwayFromZero);

    private static (string Code, string Name) PaymentAccount(string? paymentMethod)
    {
        var value = paymentMethod?.Trim() ?? string.Empty;
        return value.Contains("bank", StringComparison.OrdinalIgnoreCase) ||
               value.Contains("card", StringComparison.OrdinalIgnoreCase) ||
               value.Contains("mobile", StringComparison.OrdinalIgnoreCase) ||
               value.Contains("electronic", StringComparison.OrdinalIgnoreCase)
            ? (Accounts.Bank, Accounts.BankName)
            : (Accounts.Cash, Accounts.CashName);
    }

    private static string Prefix(JournalVoucherType type) => type switch
    {
        JournalVoucherType.Purchase => "PV",
        JournalVoucherType.PurchasePayment => "PPV",
        JournalVoucherType.ManualSale => "SV",
        JournalVoucherType.SaleReceipt => "RCV",
        JournalVoucherType.SalesReturn => "SRV",
        JournalVoucherType.OnlineSale => "OSV",
        JournalVoucherType.OnlineReceipt => "ORV",
        JournalVoucherType.Expense => "EV",
        JournalVoucherType.PayrollAccrual => "PAY",
        JournalVoucherType.PayrollPayment => "PPY",
        _ => "JV"
    };

    private static string VoucherNumber(string prefix) =>
        $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..Math.Min(50, prefix.Length + 1 + 17 + 1 + 8)];
}
