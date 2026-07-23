using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Entities.Products;
using ECommerce.Services.Customers;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Operations;

public sealed class OperationsService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerTypeResolver) : IOperationsService
{
    public async Task<OperationSummary> GetSummaryAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var first = new DateOnly(today.Year, today.Month, 1);
        var purchases = await context.Purchases.Where(x => x.PurchaseDate >= first && x.Status != PurchaseStatus.Cancelled).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var sales = await context.InventorySales.Where(x => x.SaleDate >= first).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var expenses = await context.Expenses.Where(x => x.ExpenseDate >= first).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var salaries = await context.StaffSalaryPayments.Where(x => x.PaidDate >= first).SumAsync(x => (decimal?)x.NetAmount, ct) ?? 0;
        var low = await context.Products
            .AsNoTracking()
            .CountAsync(product =>
                product.IsActive &&
                (product.Inventory == null ||
                 product.Inventory.Quantity - product.Inventory.ReservedQuantity <= product.Inventory.MinimumQuantity),
                ct);
        return new OperationSummary(purchases, sales, expenses, salaries, low);
    }

    public async Task<IReadOnlyList<OperationProductLookup>> GetProductLookupsAsync(CancellationToken ct)
    {
        var defaultTypeId = await defaultCustomerTypeResolver.GetIdAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await context.Products.AsNoTracking().Where(x => x.IsActive && !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(x => new OperationProductLookup(
                x.Id,
                x.Name,
                x.Barcode,
                x.Inventory == null ? 0 : x.Inventory.Quantity - x.Inventory.ReservedQuantity,
                x.Prices
                    .Where(p => p.CustomerTypeId == defaultTypeId)
                    .OrderBy(p => p.Id)
                    .Select(p => (decimal?)(p.SalePrice.HasValue && (!p.StartDate.HasValue || p.StartDate.Value <= today) && (!p.EndDate.HasValue || p.EndDate.Value >= today) ? p.SalePrice.Value : p.RegularPrice))
                    .FirstOrDefault()))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SupplierResponse>> GetSuppliersAsync(CancellationToken ct) =>
        await context.Suppliers.AsNoTracking().OrderBy(x => x.Name)
            .Select(x => new SupplierResponse(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive))
            .ToListAsync(ct);

    public async Task<SupplierResponse> SaveSupplierAsync(long? id, CreateSupplierRequest request, CancellationToken ct)
    {
        RequireText(request.Name, "Supplier name");
        Supplier entity;
        if (id.HasValue)
        {
            entity = await context.Suppliers.SingleOrDefaultAsync(x => x.Id == id.Value, ct) ?? throw new KeyNotFoundException("Supplier not found.");
        }
        else
        {
            entity = new Supplier();
            context.Suppliers.Add(entity);
        }
        entity.Name = request.Name.Trim();
        entity.ContactPerson = Clean(request.ContactPerson);
        entity.Phone = Clean(request.Phone);
        entity.Email = Clean(request.Email);
        entity.Address = Clean(request.Address);
        entity.TaxNumber = Clean(request.TaxNumber);
        entity.IsActive = request.IsActive;
        await context.SaveChangesAsync(ct);
        return new SupplierResponse(entity.Id, entity.Name, entity.ContactPerson, entity.Phone, entity.Email, entity.Address, entity.TaxNumber, entity.IsActive);
    }

    public async Task<IReadOnlyList<PurchaseListItem>> GetPurchasesAsync(CancellationToken ct) =>
        await context.Purchases.AsNoTracking().OrderByDescending(x => x.PurchaseDate).ThenByDescending(x => x.Id)
            .Take(500)
            .Select(x => new PurchaseListItem(x.Id, x.PurchaseNumber, x.PurchaseDate, x.Supplier == null ? null : x.Supplier.Name, x.Items.Count, x.Total, x.PaidAmount, x.PaymentStatus, x.Status, x.CreatedAt))
            .ToListAsync(ct);

    public async Task<PurchaseListItem> CreatePurchaseAsync(CreatePurchaseRequest request, string? userId, CancellationToken ct)
    {
        ValidatePurchase(request);
        var items = request.Items.GroupBy(x => x.ProductId).Select(g =>
        {
            if (g.Select(x => new { x.UnitCost, x.LotNumber, x.ExpireDate }).Distinct().Count() > 1)
                throw new ArgumentException("A product can appear only once per purchase unless its cost and lot details are identical.");
            var first = g.First();
            return new PurchaseItemRequest { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity), UnitCost = first.UnitCost, LotNumber = first.LotNumber, ExpireDate = first.ExpireDate };
        }).ToList();
        await EnsureProductsExist(items.Select(x => x.ProductId), ct);
        string? supplierName = null;
        if (request.SupplierId.HasValue)
        {
            supplierName = await context.Suppliers
                .Where(supplier => supplier.Id == request.SupplierId && supplier.IsActive)
                .Select(supplier => supplier.Name)
                .SingleOrDefaultAsync(ct);
            if (supplierName is null)
                throw new ArgumentException("Selected supplier does not exist or is inactive.");
        }

        var subtotal = items.Sum(x => x.Quantity * x.UnitCost);
        var total = Math.Max(0, subtotal - request.Discount + request.Tax + request.OtherCost);
        if (request.PaidAmount < 0 || request.PaidAmount > total) throw new ArgumentException("Paid amount must be between zero and the purchase total.");
        var purchase = new Purchase
        {
            PurchaseNumber = DocumentNumber("PUR"), SupplierId = request.SupplierId,
            PurchaseDate = request.PurchaseDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.PurchaseDate,
            Status = PurchaseStatus.Received, Subtotal = subtotal, Discount = request.Discount, Tax = request.Tax,
            OtherCost = request.OtherCost, Total = total, PaidAmount = request.PaidAmount,
            PaymentStatus = PaymentStatus(request.PaidAmount, total), ReferenceNumber = Clean(request.ReferenceNumber),
            Notes = Clean(request.Notes), CreatedByUserId = userId
        };
        foreach (var item in items) purchase.Items.Add(new PurchaseItem
        {
            ProductId = item.ProductId, Quantity = item.Quantity, UnitCost = item.UnitCost,
            LineTotal = item.Quantity * item.UnitCost, LotNumber = Clean(item.LotNumber), ExpireDate = item.ExpireDate
        });

        await using var tx = await context.Database.BeginTransactionAsync(ct);
        context.Purchases.Add(purchase);
        await context.SaveChangesAsync(ct);
        var warehouseId = await context.Warehouses
            .Where(x => x.IsActive)
            .OrderBy(x => x.Id)
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException(
                "No active warehouse is configured. Activate or create a warehouse before receiving purchases.");
        foreach (var item in items)
        {
            await ApplyStockMovement(item.ProductId, item.Quantity, InventoryTransactionType.Purchase, "Purchase", purchase.Id, purchase.PurchaseNumber, userId, item.ExpireDate, ct);
            context.InventoryLots.Add(new InventoryLot
            {
                ProductId = item.ProductId,
                WarehouseId = warehouseId,
                LotNumber = Clean(item.LotNumber) ?? purchase.PurchaseNumber,
                Quantity = item.Quantity,
                ReservedQuantity = 0,
                UnitCost = item.UnitCost,
                ExpiresAt = item.ExpireDate
            });
        }
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new PurchaseListItem(purchase.Id, purchase.PurchaseNumber, purchase.PurchaseDate, supplierName, purchase.Items.Count, total, purchase.PaidAmount, purchase.PaymentStatus, purchase.Status, purchase.CreatedAt);
    }

    public async Task<IReadOnlyList<InventorySaleListItem>> GetSalesAsync(CancellationToken ct) =>
        await context.InventorySales.AsNoTracking().OrderByDescending(x => x.SaleDate).ThenByDescending(x => x.Id)
            .Take(500)
            .Select(x => new InventorySaleListItem(x.Id, x.SaleNumber, x.SaleDate,
                x.Customer != null ? x.Customer.FirstName + " " + (x.Customer.LastName ?? "") : (x.CustomerName ?? "Walk-in customer"),
                x.Items.Count, x.Total, x.PaidAmount, x.PaymentStatus, x.CreatedAt))
            .ToListAsync(ct);

    public async Task<InventorySaleListItem> CreateSaleAsync(CreateInventorySaleRequest request, string? userId, CancellationToken ct)
    {
        if (request.Items.Count == 0) throw new ArgumentException("At least one sale item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.UnitPrice < 0)) throw new ArgumentException("Every sale item requires a product, positive quantity, and non-negative price.");
        if (request.Discount < 0 || request.Tax < 0) throw new ArgumentException("Discount and tax cannot be negative.");
        var items = request.Items.GroupBy(x => x.ProductId).Select(group =>
        {
            if (group.Select(item => item.UnitPrice).Distinct().Count() > 1)
                throw new ArgumentException("A product can appear only once per sale unless every line uses the same unit price.");

            return new InventorySaleItemRequest
            {
                ProductId = group.Key,
                Quantity = group.Sum(item => item.Quantity),
                UnitPrice = group.First().UnitPrice
            };
        }).ToList();
        await EnsureProductsExist(items.Select(x => x.ProductId), ct);
        string? registeredCustomerName = null;
        if (request.CustomerId.HasValue)
        {
            registeredCustomerName = await context.Customers
                .Where(customer => customer.Id == request.CustomerId)
                .Select(customer => customer.FirstName + " " + (customer.LastName ?? ""))
                .SingleOrDefaultAsync(ct);
            if (registeredCustomerName is null)
                throw new ArgumentException("Customer not found.");
        }
        var subtotal = items.Sum(x => x.Quantity * x.UnitPrice);
        var total = Math.Max(0, subtotal - request.Discount + request.Tax);
        if (request.PaidAmount < 0 || request.PaidAmount > total) throw new ArgumentException("Paid amount must be between zero and the sale total.");
        var sale = new InventorySale
        {
            SaleNumber = DocumentNumber("SAL"), CustomerId = request.CustomerId, CustomerName = Clean(request.CustomerName), CustomerPhone = Clean(request.CustomerPhone),
            SaleDate = request.SaleDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.SaleDate,
            PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod.Trim(),
            Subtotal = subtotal, Discount = request.Discount, Tax = request.Tax, Total = total, PaidAmount = request.PaidAmount,
            PaymentStatus = PaymentStatus(request.PaidAmount, total), Notes = Clean(request.Notes), CreatedByUserId = userId
        };
        foreach (var item in items) sale.Items.Add(new InventorySaleItem { ProductId = item.ProductId, Quantity = item.Quantity, UnitPrice = item.UnitPrice, LineTotal = item.Quantity * item.UnitPrice });

        await using var tx = await context.Database.BeginTransactionAsync(ct);
        context.InventorySales.Add(sale);
        await context.SaveChangesAsync(ct);
        foreach (var item in items)
        {
            await ApplyStockMovement(item.ProductId, -item.Quantity, InventoryTransactionType.Sale, "ManualSale", sale.Id, sale.SaleNumber, userId, null, ct);
            await ConsumeInventoryLotsAsync(item.ProductId, item.Quantity, ct);
        }
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        var customerName = registeredCustomerName ?? request.CustomerName ?? "Walk-in customer";
        return new InventorySaleListItem(sale.Id, sale.SaleNumber, sale.SaleDate, customerName.Trim(), sale.Items.Count, total, sale.PaidAmount, sale.PaymentStatus, sale.CreatedAt);
    }

    public async Task<IReadOnlyList<StaffResponse>> GetStaffAsync(CancellationToken ct) =>
        await context.StaffMembers.AsNoTracking().OrderByDescending(x => x.IsActive).ThenBy(x => x.FullName)
            .Select(x => new StaffResponse(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes)).ToListAsync(ct);

    public async Task<StaffResponse> SaveStaffAsync(long? id, StaffUpsertRequest request, CancellationToken ct)
    {
        RequireText(request.EmployeeNumber, "Employee number"); RequireText(request.FullName, "Staff name");
        if (request.BaseSalary < 0) throw new ArgumentException("Base salary cannot be negative.");
        var duplicate = await context.StaffMembers.AnyAsync(x => x.EmployeeNumber == request.EmployeeNumber.Trim() && (!id.HasValue || x.Id != id), ct);
        if (duplicate) throw new ArgumentException("Employee number already exists.");
        Staff entity;
        if (id.HasValue) entity = await context.StaffMembers.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Staff member not found.");
        else { entity = new Staff(); context.StaffMembers.Add(entity); }
        entity.EmployeeNumber = request.EmployeeNumber.Trim(); entity.FullName = request.FullName.Trim(); entity.Phone = Clean(request.Phone); entity.Email = Clean(request.Email);
        entity.Position = Clean(request.Position); entity.Department = Clean(request.Department); entity.HireDate = request.HireDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.HireDate;
        entity.BaseSalary = request.BaseSalary; entity.IsActive = request.IsActive; entity.Address = Clean(request.Address); entity.Notes = Clean(request.Notes);
        await context.SaveChangesAsync(ct);
        return new StaffResponse(entity.Id, entity.EmployeeNumber, entity.FullName, entity.Phone, entity.Email, entity.Position, entity.Department, entity.HireDate, entity.BaseSalary, entity.IsActive, entity.Address, entity.Notes);
    }

    public async Task DeleteStaffAsync(long id, CancellationToken ct)
    {
        var entity = await context.StaffMembers.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Staff member not found.");
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<SalaryPaymentResponse>> GetSalaryPaymentsAsync(CancellationToken ct) =>
        await context.StaffSalaryPayments.AsNoTracking().OrderByDescending(x => x.PaidDate).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new SalaryPaymentResponse(x.Id, x.StaffId, x.Staff.FullName, x.PeriodYear, x.PeriodMonth, x.BaseSalary, x.Bonus, x.Deduction, x.NetAmount, x.PaidDate, x.PaymentMethod, x.ReferenceNumber, x.CreatedAt)).ToListAsync(ct);

    public async Task<SalaryPaymentResponse> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request, string? userId, CancellationToken ct)
    {
        if (request.PeriodMonth is < 1 or > 12 || request.PeriodYear < 2000) throw new ArgumentException("A valid salary period is required.");
        if (request.Bonus < 0 || request.Deduction < 0) throw new ArgumentException("Bonus and deduction cannot be negative.");
        var staff = await context.StaffMembers.SingleOrDefaultAsync(x => x.Id == request.StaffId && x.IsActive, ct) ?? throw new ArgumentException("Active staff member not found.");
        if (await context.StaffSalaryPayments.AnyAsync(x => x.StaffId == request.StaffId && x.PeriodYear == request.PeriodYear && x.PeriodMonth == request.PeriodMonth, ct)) throw new ArgumentException("Salary for this staff member and period is already recorded.");
        var net = staff.BaseSalary + request.Bonus - request.Deduction;
        if (net < 0) throw new ArgumentException("Deductions cannot exceed salary plus bonus.");
        var entity = new StaffSalaryPayment { StaffId = staff.Id, PeriodYear = request.PeriodYear, PeriodMonth = request.PeriodMonth, BaseSalary = staff.BaseSalary, Bonus = request.Bonus, Deduction = request.Deduction, NetAmount = net, PaidDate = request.PaidDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.PaidDate, PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod.Trim(), ReferenceNumber = Clean(request.ReferenceNumber), Notes = Clean(request.Notes), CreatedByUserId = userId };
        context.StaffSalaryPayments.Add(entity); await context.SaveChangesAsync(ct);
        return new SalaryPaymentResponse(entity.Id, staff.Id, staff.FullName, entity.PeriodYear, entity.PeriodMonth, entity.BaseSalary, entity.Bonus, entity.Deduction, entity.NetAmount, entity.PaidDate, entity.PaymentMethod, entity.ReferenceNumber, entity.CreatedAt);
    }

    public async Task<IReadOnlyList<ExpenseCategoryResponse>> GetExpenseCategoriesAsync(CancellationToken ct) =>
        await context.ExpenseCategories.AsNoTracking().OrderByDescending(x => x.IsActive).ThenBy(x => x.Name).Select(x => new ExpenseCategoryResponse(x.Id, x.Name, x.Description, x.IsActive)).ToListAsync(ct);

    public async Task<ExpenseCategoryResponse> SaveExpenseCategoryAsync(long? id, ExpenseCategoryUpsertRequest request, CancellationToken ct)
    {
        RequireText(request.Name, "Category name");
        if (await context.ExpenseCategories.AnyAsync(x => x.Name == request.Name.Trim() && (!id.HasValue || x.Id != id), ct)) throw new ArgumentException("Expense category already exists.");
        ExpenseCategory entity;
        if (id.HasValue) entity = await context.ExpenseCategories.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Expense category not found.");
        else { entity = new ExpenseCategory(); context.ExpenseCategories.Add(entity); }
        entity.Name = request.Name.Trim(); entity.Description = Clean(request.Description); entity.IsActive = request.IsActive; await context.SaveChangesAsync(ct);
        return new ExpenseCategoryResponse(entity.Id, entity.Name, entity.Description, entity.IsActive);
    }

    public async Task<IReadOnlyList<ExpenseResponse>> GetExpensesAsync(CancellationToken ct) =>
        await context.Expenses.AsNoTracking().OrderByDescending(x => x.ExpenseDate).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new ExpenseResponse(x.Id, x.ExpenseDate, x.CategoryId, x.Category.Name, x.Amount, x.Vendor, x.PaymentMethod, x.ReferenceNumber, x.Description, x.CreatedAt)).ToListAsync(ct);

    public async Task<ExpenseResponse> CreateExpenseAsync(CreateExpenseRequest request, string? userId, CancellationToken ct)
    {
        RequireText(request.Description, "Expense description"); if (request.Amount <= 0) throw new ArgumentException("Expense amount must be greater than zero.");
        var category = await context.ExpenseCategories.SingleOrDefaultAsync(x => x.Id == request.CategoryId && x.IsActive, ct) ?? throw new ArgumentException("Active expense category not found.");
        var entity = new Expense { ExpenseDate = request.ExpenseDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.ExpenseDate, CategoryId = category.Id, Amount = request.Amount, Vendor = Clean(request.Vendor), PaymentMethod = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Cash" : request.PaymentMethod.Trim(), ReferenceNumber = Clean(request.ReferenceNumber), Description = request.Description.Trim(), CreatedByUserId = userId };
        context.Expenses.Add(entity); await context.SaveChangesAsync(ct);
        return new ExpenseResponse(entity.Id, entity.ExpenseDate, entity.CategoryId, category.Name, entity.Amount, entity.Vendor, entity.PaymentMethod, entity.ReferenceNumber, entity.Description, entity.CreatedAt);
    }


    private async Task ConsumeInventoryLotsAsync(long productId, decimal quantity, CancellationToken ct)
    {
        var remaining = quantity;
        var lots = await context.InventoryLots
            .Where(x => x.ProductId == productId && x.Quantity - x.ReservedQuantity > 0)
            .OrderBy(x => x.ExpiresAt == null)
            .ThenBy(x => x.ExpiresAt)
            .ThenBy(x => x.CreatedAt)
            .ToListAsync(ct);

        foreach (var lot in lots)
        {
            if (remaining <= 0) break;
            var available = lot.Quantity - lot.ReservedQuantity;
            var consumed = Math.Min(available, remaining);
            lot.Quantity -= consumed;
            remaining -= consumed;
        }
        // Legacy stock may pre-date lot tracking. The aggregate inventory remains authoritative,
        // so a missing lot balance does not block an otherwise valid sale.
    }

    private async Task ApplyStockMovement(long productId, decimal delta, InventoryTransactionType type, string referenceType, long referenceId, string documentNumber, string? userId, DateOnly? expireDate, CancellationToken ct)
    {
        var inventory = await context.ProductInventories.SingleOrDefaultAsync(x => x.ProductId == productId, ct);
        if (inventory is null)
        {
            if (delta < 0) throw new InvalidOperationException("This product has no stock available.");
            inventory = new ProductInventory { ProductId = productId, Quantity = 0, ReservedQuantity = 0, MinimumQuantity = 0 };
            context.ProductInventories.Add(inventory);
        }
        var beforeQuantity = inventory.Quantity; var beforeReserved = inventory.ReservedQuantity;
        if (delta < 0 && inventory.Quantity - inventory.ReservedQuantity < -delta) throw new InvalidOperationException("Insufficient available stock for one or more sale items.");
        inventory.Quantity += delta;
        if (expireDate.HasValue && (!inventory.ExpireDate.HasValue || expireDate.Value < inventory.ExpireDate.Value)) inventory.ExpireDate = expireDate;
        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId, Quantity = delta, Type = type, QuantityBefore = beforeQuantity, QuantityAfter = inventory.Quantity,
            ReservedBefore = beforeReserved, ReservedAfter = inventory.ReservedQuantity, ReferenceType = referenceType, ReferenceId = referenceId,
            PerformedByUserId = userId, Description = $"{referenceType} {documentNumber}"
        });
    }

    private async Task EnsureProductsExist(IEnumerable<long> ids, CancellationToken ct)
    {
        var distinct = ids.Distinct().ToArray();
        var count = await context.Products.CountAsync(x => distinct.Contains(x.Id), ct);
        if (count != distinct.Length) throw new ArgumentException("One or more selected products do not exist.");
    }
    private static void ValidatePurchase(CreatePurchaseRequest request)
    {
        if (request.Items.Count == 0) throw new ArgumentException("At least one purchase item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.UnitCost < 0)) throw new ArgumentException("Every purchase item requires a product, positive quantity, and non-negative cost.");
        if (request.Discount < 0 || request.Tax < 0 || request.OtherCost < 0) throw new ArgumentException("Discount, tax, and other costs cannot be negative.");
    }
    private static DocumentPaymentStatus PaymentStatus(decimal paid, decimal total) => paid <= 0 ? DocumentPaymentStatus.Unpaid : paid >= total ? DocumentPaymentStatus.Paid : DocumentPaymentStatus.Partial;
    private static string DocumentNumber(string prefix) => $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Random.Shared.Next(1000, 9999)}";
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static void RequireText(string? value, string field) { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"{field} is required."); }
}
