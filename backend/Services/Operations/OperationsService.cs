using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Entities.Products;
using ECommerce.Services.Customers;
using ECommerce.Services.Inventory;
using ECommerce.Services.Company;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Operations;

public sealed class OperationsService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerTypeResolver,
    IInventoryCostService inventoryCosts,
    ICompanyContext companyContext) : IOperationsService
{
    private const string MainWarehouseCode = "MAIN";

    public async Task<OperationSummary> GetSummaryAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var first = new DateOnly(today.Year, today.Month, 1);
        var purchases = await context.Purchases.Where(x => (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value) && x.PurchaseDate >= first && x.Status != PurchaseStatus.Cancelled).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var sales = await context.InventorySales.Where(x => (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value) && x.SaleDate >= first).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var expenses = await context.Expenses.Where(x => (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value) && x.ExpenseDate >= first).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var salaries = await context.StaffSalaryPayments.Where(x => (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value) && x.PaidDate >= first).SumAsync(x => (decimal?)x.PaidAmount, ct) ?? 0;
        var low = await context.Products.AsNoTracking().CountAsync(product =>
            product.IsActive &&
            !product.UsesDisplayStock &&
            (product.Inventory == null || product.Inventory.Quantity - product.Inventory.ReservedQuantity <= product.Inventory.MinimumQuantity), ct);
        return new OperationSummary(purchases, sales, expenses, salaries, low);
    }

    public async Task<IReadOnlyList<OperationProductLookup>> GetProductLookupsAsync(string? search, int take, CancellationToken ct)
    {
        var defaultTypeId = await defaultCustomerTypeResolver.GetIdAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var clean = Clean(search);
        var query = context.Products
            .AsNoTracking()
            .Include(product => product.Unit)
            .Include(product => product.UnitConversions.Where(unit => unit.IsActive))
                .ThenInclude(unit => unit.Unit)
            .Include(product => product.Inventory)
            .Include(product => product.Prices.Where(price => price.CustomerTypeId == defaultTypeId))
            .Where(product => product.IsActive);

        if (clean is not null)
            query = query.Where(product =>
                product.Name.Contains(clean) ||
                (product.Barcode != null && product.Barcode.Contains(clean)) ||
                product.UnitConversions.Any(unit => unit.IsActive && unit.Barcode != null && unit.Barcode.Contains(clean)));

        var products = await query
            .OrderBy(product => product.Name)
            .Take(Math.Clamp(take, 1, 50))
            .ToListAsync(ct);

        return products.Select(product =>
        {
            var availableBaseQuantity = product.UsesDisplayStock
                ? Math.Max(0, product.DisplayStockQuantity ?? 0)
                : Math.Max(0, product.Inventory?.Quantity - product.Inventory?.ReservedQuantity ?? 0);
            var basePrice = ResolveDefaultPrice(product, today);
            var units = BuildOperationUnits(product, availableBaseQuantity, basePrice);

            return new OperationProductLookup(
                product.Id,
                product.Name,
                product.Barcode,
                availableBaseQuantity,
                basePrice,
                product.MinimumValue,
                product.MaximumValue,
                product.UsesDisplayStock,
                product.UnitId,
                product.Unit?.Name,
                units);
        }).ToList();
    }

    public async Task<IReadOnlyList<OperationCustomerLookup>> GetCustomerLookupsAsync(string? search, int take, CancellationToken ct)
    {
        var query = context.Customers.AsNoTracking()
            .Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.FirstName.Contains(clean) || (x.LastName != null && x.LastName.Contains(clean)) || x.Phone.Contains(clean) || (x.Email != null && x.Email.Contains(clean)));

        return await query.OrderByDescending(x => x.CreatedAt).Take(Math.Clamp(take, 1, 50))
            .Select(x => new OperationCustomerLookup(
                x.Id,
                (x.FirstName + " " + (x.LastName ?? "")).Trim(),
                x.Phone,
                x.Email,
                x.CustomerType == null ? null : x.CustomerType.Name))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SupplierResponse>> GetSuppliersAsync(string? search, int take, CancellationToken ct)
    {
        var query = context.Suppliers.AsNoTracking()
            .Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.Name.Contains(clean) || (x.Phone != null && x.Phone.Contains(clean)) || (x.ContactPerson != null && x.ContactPerson.Contains(clean)));

        return await query.OrderByDescending(x => x.IsActive).ThenBy(x => x.Name).Take(Math.Clamp(take, 1, 100))
            .Select(x => new SupplierResponse(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive))
            .ToListAsync(ct);
    }

    public async Task<SupplierResponse> SaveSupplierAsync(long? id, CreateSupplierRequest request, CancellationToken ct)
    {
        RequireText(request.Name, "Supplier name");
        Supplier entity;
        if (id.HasValue)
            entity = await context.Suppliers.SingleOrDefaultAsync(
                x => x.Id == id.Value && (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value),
                ct) ?? throw new KeyNotFoundException("Supplier not found.");
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
        return MapSupplier(entity);
    }

    public async Task<IReadOnlyList<PurchaseListItem>> GetPurchasesAsync(CancellationToken ct) =>
        await context.Purchases.AsNoTracking().Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value).OrderByDescending(x => x.PurchaseDate).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new PurchaseListItem(x.Id, x.PurchaseNumber, x.PurchaseDate, x.Supplier == null ? null : x.Supplier.Name, x.Items.Count, x.Total, x.PaidAmount, x.Total > x.PaidAmount ? x.Total - x.PaidAmount : 0, x.PaymentStatus, x.Status, x.CreatedAt))
            .ToListAsync(ct);

    public async Task<PurchaseListItem> CreatePurchaseAsync(CreatePurchaseRequest request, string? userId, CancellationToken ct)
    {
        ValidatePurchase(request);
        EnsureNoDuplicateProducts(request.Items.Select(item => item.ProductId), "purchase");
        var items = request.Items.ToList();
        var productIds = items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await LoadProductsForUnitsAsync(productIds, ct);
        EnsureAllProductsExist(productIds, products);

        var displayOnly = products.Values.FirstOrDefault(product => product.UsesDisplayStock);
        if (displayOnly is not null)
            throw new ArgumentException("Display-stock products cannot be added to purchases because they do not update physical inventory.");

        var normalizedItems = items.Select(item =>
        {
            var product = products[item.ProductId];
            var selectedUnit = ResolveOperationUnit(product, item.UnitId);
            var baseQuantity = decimal.Round(item.Quantity * selectedUnit.ConversionFactor, 3, MidpointRounding.AwayFromZero);
            var baseUnitCost = decimal.Round(item.UnitCost / selectedUnit.ConversionFactor, 4, MidpointRounding.AwayFromZero);
            if (baseQuantity <= 0)
                throw new ArgumentException($"The quantity for '{product.Name}' is too small for base-unit precision.");
            return new NormalizedPurchaseLine(item, product, selectedUnit, baseQuantity, baseUnitCost);
        }).ToList();

        string? supplierName = null;
        if (request.SupplierId.HasValue)
        {
            supplierName = await context.Suppliers
                .Where(x => x.Id == request.SupplierId && x.IsActive &&
                    (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value))
                .Select(x => x.Name)
                .SingleOrDefaultAsync(ct);
            if (supplierName is null) throw new ArgumentException("Selected supplier does not exist or is inactive.");
        }

        var subtotal = normalizedItems.Sum(line => line.Request.Quantity * line.Request.UnitCost);
        var total = Math.Max(0, subtotal - request.Discount + request.Tax + request.OtherCost);
        ValidateInitialPayment(request.PaidAmount, total);
        var purchaseDate = request.PurchaseDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.PurchaseDate;
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var purchase = new Purchase
        {
            PurchaseNumber = DocumentNumber("PUR"),
            SupplierId = request.SupplierId,
            PurchaseDate = purchaseDate,
            Status = PurchaseStatus.Received,
            Subtotal = subtotal,
            Discount = request.Discount,
            Tax = request.Tax,
            OtherCost = request.OtherCost,
            Total = total,
            PaidAmount = request.PaidAmount,
            CurrencyCode = currencyCode,
            PaymentStatus = PaymentStatus(request.PaidAmount, total),
            ReferenceNumber = Clean(request.ReferenceNumber),
            Notes = Clean(request.Notes),
            CreatedByUserId = userId
        };

        foreach (var line in normalizedItems)
            purchase.Items.Add(new PurchaseItem
            {
                ProductId = line.Request.ProductId,
                Quantity = line.BaseQuantity,
                UnitCost = line.BaseUnitCost,
                EnteredQuantity = line.Request.Quantity,
                SelectedUnitId = line.Unit.UnitId,
                SelectedUnitName = line.Unit.UnitName,
                UnitConversionFactor = line.Unit.ConversionFactor,
                EnteredUnitCost = line.Request.UnitCost,
                LineTotal = line.Request.Quantity * line.Request.UnitCost,
                LotNumber = Clean(line.Request.LotNumber),
                ExpireDate = line.Request.ExpireDate
            });

        if (request.PaidAmount > 0)
            purchase.Payments.Add(NewPurchasePayment(request.PaidAmount, purchaseDate, request.PaymentMethod, request.PaymentReferenceNumber, "Initial purchase payment", userId));

        await using var tx = await context.Database.BeginTransactionAsync(ct);
        context.Purchases.Add(purchase);
        await context.SaveChangesAsync(ct);
        var warehouseId = await context.Warehouses
            .Where(x => x.IsActive && (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value))
            .OrderByDescending(x => x.Code == MainWarehouseCode)
            .ThenBy(x => x.Id)
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("No active warehouse is configured. Activate or create a warehouse before receiving purchases.");

        foreach (var line in normalizedItems)
        {
            await ApplyStockMovement(line.Request.ProductId, line.BaseQuantity, InventoryTransactionType.Purchase, "Purchase", purchase.Id, purchase.PurchaseNumber, userId, line.Request.ExpireDate, ct);
            context.InventoryLots.Add(new InventoryLot
            {
                ProductId = line.Request.ProductId,
                WarehouseId = warehouseId,
                LotNumber = Clean(line.Request.LotNumber) ?? purchase.PurchaseNumber,
                Quantity = line.BaseQuantity,
                ReservedQuantity = 0,
                UnitCost = line.BaseUnitCost,
                ExpiresAt = line.Request.ExpireDate
            });
        }
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return MapPurchase(purchase, supplierName);
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetPurchasePaymentsAsync(long purchaseId, CancellationToken ct) =>
        await context.PurchasePayments.AsNoTracking().Where(x => x.PurchaseId == purchaseId && (!companyContext.BranchId.HasValue || x.Purchase.BranchId == companyContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapPurchasePayment()).ToListAsync(ct);

    public async Task<PurchaseListItem> AddPurchasePaymentAsync(long purchaseId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var purchase = await context.Purchases
            .FromSqlInterpolated($"SELECT * FROM [Purchases] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {purchaseId}")
            .Include(x => x.Supplier)
            .Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Purchase not found.");
        var remaining = Math.Max(0, purchase.Total - purchase.PaidAmount);
        if (request.Amount > remaining) throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00}.");
        purchase.Payments.Add(NewPurchasePayment(request.Amount, PaymentDate(request.PaymentDate), request.PaymentMethod, request.ReferenceNumber, request.Notes, userId));
        purchase.PaidAmount += request.Amount;
        purchase.PaymentStatus = PaymentStatus(purchase.PaidAmount, purchase.Total);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapPurchase(purchase, purchase.Supplier?.Name);
    }

    public async Task<IReadOnlyList<InventorySaleListItem>> GetSalesAsync(CancellationToken ct) =>
        await context.InventorySales.AsNoTracking().Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value).OrderByDescending(x => x.SaleDate).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new InventorySaleListItem(x.Id, x.SaleNumber, x.SaleDate, x.Customer != null ? (x.Customer.FirstName + " " + (x.Customer.LastName ?? "")).Trim() : (x.CustomerName ?? "Walk-in customer"), x.Items.Count, x.Total, x.PaidAmount, x.Total > x.PaidAmount ? x.Total - x.PaidAmount : 0, x.PaymentStatus, x.CreatedAt))
            .ToListAsync(ct);

    public async Task<InventorySaleListItem> CreateSaleAsync(CreateInventorySaleRequest request, string? userId, CancellationToken ct)
    {
        if (request.Items.Count == 0) throw new ArgumentException("At least one sale item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.UnitPrice < 0)) throw new ArgumentException("Every sale item requires a product, positive quantity, and non-negative price.");
        if (request.Discount < 0 || request.Tax < 0) throw new ArgumentException("Discount and tax cannot be negative.");
        EnsureNoDuplicateProducts(request.Items.Select(item => item.ProductId), "sale");

        var items = request.Items.ToList();
        var productIds = items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await LoadProductsForUnitsAsync(productIds, ct);
        EnsureAllProductsExist(productIds, products);

        var normalizedItems = items.Select(item =>
        {
            var product = products[item.ProductId];
            var selectedUnit = ResolveOperationUnit(product, item.UnitId);
            var baseQuantity = decimal.Round(item.Quantity * selectedUnit.ConversionFactor, 3, MidpointRounding.AwayFromZero);
            var baseUnitPrice = decimal.Round(item.UnitPrice / selectedUnit.ConversionFactor, 4, MidpointRounding.AwayFromZero);
            if (baseQuantity <= 0)
                throw new ArgumentException($"The quantity for '{product.Name}' is too small for base-unit precision.");
            ValidateSaleQuantity(product, baseQuantity, selectedUnit);
            return new NormalizedSaleLine(item, product, selectedUnit, baseQuantity, baseUnitPrice);
        }).ToList();

        // Display-stock products do not mutate inventory, but an existing base-unit
        // purchase cost is still snapshotted so profit reports remain accurate.
        var productCosts = await inventoryCosts.GetCurrentUnitCostsAsync(productIds, ct);

        string? registeredCustomerName = null;
        string? registeredCustomerPhone = null;
        if (request.CustomerId.HasValue)
        {
            var customer = await context.Customers
                .Where(x => x.Id == request.CustomerId &&
                    (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value))
                .Select(x => new { Name = (x.FirstName + " " + (x.LastName ?? "")).Trim(), x.Phone })
                .SingleOrDefaultAsync(ct);
            if (customer is null) throw new ArgumentException("Customer not found.");
            registeredCustomerName = customer.Name;
            registeredCustomerPhone = customer.Phone;
        }

        var subtotal = normalizedItems.Sum(line => line.Request.Quantity * line.Request.UnitPrice);
        var total = Math.Max(0, subtotal - request.Discount + request.Tax);
        ValidateInitialPayment(request.PaidAmount, total);
        var saleDate = request.SaleDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.SaleDate;
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var sale = new InventorySale
        {
            SaleNumber = DocumentNumber("SAL"),
            CustomerId = request.CustomerId,
            CustomerName = registeredCustomerName ?? Clean(request.CustomerName),
            CustomerPhone = registeredCustomerPhone ?? Clean(request.CustomerPhone),
            SaleDate = saleDate,
            PaymentMethod = PaymentMethod(request.PaymentMethod),
            Subtotal = subtotal,
            Discount = request.Discount,
            Tax = request.Tax,
            Total = total,
            PaidAmount = request.PaidAmount,
            CurrencyCode = currencyCode,
            PaymentStatus = PaymentStatus(request.PaidAmount, total),
            Notes = Clean(request.Notes),
            CreatedByUserId = userId
        };

        foreach (var line in normalizedItems)
            sale.Items.Add(new InventorySaleItem
            {
                ProductId = line.Request.ProductId,
                Quantity = line.BaseQuantity,
                UnitPrice = line.BaseUnitPrice,
                UnitCost = productCosts.GetValueOrDefault(line.Request.ProductId),
                EnteredQuantity = line.Request.Quantity,
                SelectedUnitId = line.Unit.UnitId,
                SelectedUnitName = line.Unit.UnitName,
                UnitConversionFactor = line.Unit.ConversionFactor,
                EnteredUnitPrice = line.Request.UnitPrice,
                LineTotal = line.Request.Quantity * line.Request.UnitPrice
            });

        if (request.PaidAmount > 0)
            sale.Payments.Add(NewSalePayment(request.PaidAmount, saleDate, request.PaymentMethod, request.PaymentReferenceNumber, "Initial sale payment", userId));

        await using var tx = await context.Database.BeginTransactionAsync(ct);
        context.InventorySales.Add(sale);
        await context.SaveChangesAsync(ct);
        foreach (var line in normalizedItems)
        {
            if (line.Product.UsesDisplayStock)
                continue;

            await ApplyStockMovement(line.Request.ProductId, -line.BaseQuantity, InventoryTransactionType.Sale, "ManualSale", sale.Id, sale.SaleNumber, userId, null, ct);
            await ConsumeInventoryLotsAsync(line.Request.ProductId, line.BaseQuantity, ct);
        }
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return MapSale(sale, registeredCustomerName ?? request.CustomerName ?? "Walk-in customer");
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetSalePaymentsAsync(long saleId, CancellationToken ct) =>
        await context.InventorySalePayments.AsNoTracking().Where(x => x.InventorySaleId == saleId && (!companyContext.BranchId.HasValue || x.InventorySale.BranchId == companyContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapSalePayment()).ToListAsync(ct);

    public async Task<InventorySaleListItem> AddSalePaymentAsync(long saleId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var sale = await context.InventorySales
            .FromSqlInterpolated($"SELECT * FROM [InventorySales] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {saleId}")
            .Include(x => x.Customer)
            .Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Sale not found.");
        var remaining = Math.Max(0, sale.Total - sale.PaidAmount);
        if (request.Amount > remaining) throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00}.");
        sale.Payments.Add(NewSalePayment(request.Amount, PaymentDate(request.PaymentDate), request.PaymentMethod, request.ReferenceNumber, request.Notes, userId));
        sale.PaidAmount += request.Amount;
        sale.PaymentStatus = PaymentStatus(sale.PaidAmount, sale.Total);
        sale.PaymentMethod = PaymentMethod(request.PaymentMethod);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        var name = sale.Customer is null ? sale.CustomerName ?? "Walk-in customer" : (sale.Customer.FirstName + " " + (sale.Customer.LastName ?? "")).Trim();
        return MapSale(sale, name);
    }

    public async Task<IReadOnlyList<StaffResponse>> GetStaffAsync(CancellationToken ct) =>
        await context.StaffMembers.AsNoTracking().Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value).OrderByDescending(x => x.IsActive).ThenBy(x => x.FullName)
            .Select(x => new StaffResponse(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes)).ToListAsync(ct);

    public async Task<StaffResponse> SaveStaffAsync(long? id, StaffUpsertRequest request, CancellationToken ct)
    {
        RequireText(request.EmployeeNumber, "Employee number");
        RequireText(request.FullName, "Staff name");
        if (request.BaseSalary < 0) throw new ArgumentException("Base salary cannot be negative.");
        if (await context.StaffMembers.AnyAsync(x =>
            x.EmployeeNumber == request.EmployeeNumber.Trim() &&
            (!id.HasValue || x.Id != id) &&
            (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value), ct))
            throw new ArgumentException("Employee number already exists.");
        Staff entity;
        if (id.HasValue)
            entity = await context.StaffMembers.SingleOrDefaultAsync(
                x => x.Id == id && (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value),
                ct) ?? throw new KeyNotFoundException("Staff member not found.");
        else { entity = new Staff(); context.StaffMembers.Add(entity); }
        entity.EmployeeNumber = request.EmployeeNumber.Trim();
        entity.FullName = request.FullName.Trim();
        entity.Phone = Clean(request.Phone);
        entity.Email = Clean(request.Email);
        entity.Position = Clean(request.Position);
        entity.Department = Clean(request.Department);
        entity.HireDate = request.HireDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.HireDate;
        entity.BaseSalary = request.BaseSalary;
        entity.IsActive = request.IsActive;
        entity.Address = Clean(request.Address);
        entity.Notes = Clean(request.Notes);
        await context.SaveChangesAsync(ct);
        return MapStaff(entity);
    }

    public async Task DeleteStaffAsync(long id, CancellationToken ct)
    {
        var entity = await context.StaffMembers.SingleOrDefaultAsync(
            x => x.Id == id && (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value),
            ct) ?? throw new KeyNotFoundException("Staff member not found.");
        entity.IsActive = false;
        await context.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<SalaryPaymentResponse>> GetSalaryPaymentsAsync(CancellationToken ct) =>
        await context.StaffSalaryPayments.AsNoTracking().Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value).OrderByDescending(x => x.PeriodYear).ThenByDescending(x => x.PeriodMonth).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new SalaryPaymentResponse(x.Id, x.StaffId, x.Staff.FullName, x.PeriodYear, x.PeriodMonth, x.BaseSalary, x.Bonus, x.Deduction, x.NetAmount, x.PaidAmount, x.NetAmount > x.PaidAmount ? x.NetAmount - x.PaidAmount : 0, x.PaymentStatus, x.PaidDate, x.PaymentMethod, x.ReferenceNumber, x.CreatedAt)).ToListAsync(ct);

    public async Task<SalaryPaymentResponse> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request, string? userId, CancellationToken ct)
    {
        if (request.PeriodMonth is < 1 or > 12 || request.PeriodYear < 2000) throw new ArgumentException("A valid salary period is required.");
        if (request.Bonus < 0 || request.Deduction < 0) throw new ArgumentException("Bonus and deduction cannot be negative.");
        var staff = await context.StaffMembers.SingleOrDefaultAsync(
            x => x.Id == request.StaffId && x.IsActive &&
                (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value),
            ct) ?? throw new ArgumentException("Active staff member not found.");
        if (await context.StaffSalaryPayments.AnyAsync(x =>
            x.StaffId == request.StaffId &&
            x.PeriodYear == request.PeriodYear &&
            x.PeriodMonth == request.PeriodMonth &&
            (!companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value), ct))
            throw new ArgumentException("Salary for this staff member and period is already recorded.");
        var net = staff.BaseSalary + request.Bonus - request.Deduction;
        if (net < 0) throw new ArgumentException("Deductions cannot exceed salary plus bonus.");
        ValidateInitialPayment(request.PaidAmount, net);
        var paidDate = PaymentDate(request.PaidDate);
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var entity = new StaffSalaryPayment
        {
            StaffId = staff.Id,
            PeriodYear = request.PeriodYear,
            PeriodMonth = request.PeriodMonth,
            BaseSalary = staff.BaseSalary,
            Bonus = request.Bonus,
            Deduction = request.Deduction,
            NetAmount = net,
            PaidAmount = request.PaidAmount,
            PaymentStatus = PaymentStatus(request.PaidAmount, net),
            CurrencyCode = currencyCode,
            PaidDate = paidDate,
            PaymentMethod = PaymentMethod(request.PaymentMethod),
            ReferenceNumber = Clean(request.ReferenceNumber),
            Notes = Clean(request.Notes),
            CreatedByUserId = userId
        };
        if (request.PaidAmount > 0)
            entity.Installments.Add(NewSalaryInstallment(request.PaidAmount, paidDate, request.PaymentMethod, request.ReferenceNumber, "Initial salary payment", userId));
        context.StaffSalaryPayments.Add(entity);
        await context.SaveChangesAsync(ct);
        return MapSalary(entity, staff.FullName);
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetSalaryInstallmentsAsync(long salaryId, CancellationToken ct) =>
        await context.StaffSalaryInstallments.AsNoTracking().Where(x => x.StaffSalaryPaymentId == salaryId && (!companyContext.BranchId.HasValue || x.StaffSalaryPayment.BranchId == companyContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapSalaryPayment()).ToListAsync(ct);

    public async Task<SalaryPaymentResponse> AddSalaryInstallmentAsync(long salaryId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var salary = await context.StaffSalaryPayments
            .FromSqlInterpolated($"SELECT * FROM [StaffSalaryPayments] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {salaryId}")
            .Include(x => x.Staff)
            .Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Salary record not found.");
        var remaining = Math.Max(0, salary.NetAmount - salary.PaidAmount);
        if (request.Amount > remaining) throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00}.");
        var date = PaymentDate(request.PaymentDate);
        salary.Installments.Add(NewSalaryInstallment(request.Amount, date, request.PaymentMethod, request.ReferenceNumber, request.Notes, userId));
        salary.PaidAmount += request.Amount;
        salary.PaymentStatus = PaymentStatus(salary.PaidAmount, salary.NetAmount);
        salary.PaidDate = date;
        salary.PaymentMethod = PaymentMethod(request.PaymentMethod);
        salary.ReferenceNumber = Clean(request.ReferenceNumber) ?? salary.ReferenceNumber;
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapSalary(salary, salary.Staff.FullName);
    }

    public async Task<IReadOnlyList<ExpenseCategoryResponse>> GetExpenseCategoriesAsync(CancellationToken ct) =>
        await context.Types.AsNoTracking().Where(x => x.Group == GeneralTypeEnum.ExpenseCategory).OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new ExpenseCategoryResponse(x.Id, x.Name, null, true)).ToListAsync(ct);

    public async Task<ExpenseCategoryResponse> SaveExpenseCategoryAsync(long? id, ExpenseCategoryUpsertRequest request, CancellationToken ct)
    {
        RequireText(request.Name, "Category name");
        var name = request.Name.Trim();
        if (await context.Types.AnyAsync(x => x.Group == GeneralTypeEnum.ExpenseCategory && x.Name == name && (!id.HasValue || x.Id != id), ct)) throw new ArgumentException("Expense category already exists.");
        API.Entities.Types.GeneralType entity;
        if (id.HasValue)
            entity = await context.Types.SingleOrDefaultAsync(x => x.Id == id && x.Group == GeneralTypeEnum.ExpenseCategory, ct) ?? throw new KeyNotFoundException("Expense category not found.");
        else
        {
            entity = new API.Entities.Types.GeneralType { Group = GeneralTypeEnum.ExpenseCategory };
            context.Types.Add(entity);
        }
        entity.Name = name;
        entity.Group = GeneralTypeEnum.ExpenseCategory;
        await context.SaveChangesAsync(ct);
        return new ExpenseCategoryResponse(entity.Id, entity.Name, null, true);
    }

    public async Task<IReadOnlyList<ExpenseResponse>> GetExpensesAsync(CancellationToken ct) =>
        await context.Expenses.AsNoTracking().Where(x => !companyContext.BranchId.HasValue || x.BranchId == companyContext.BranchId.Value).OrderByDescending(x => x.ExpenseDate).ThenByDescending(x => x.Id).Take(500)
            .Select(x => new ExpenseResponse(x.Id, x.ExpenseDate, x.GeneralTypeCategoryId ?? x.CategoryId ?? 0, x.GeneralTypeCategory != null ? x.GeneralTypeCategory.Name : (x.Category != null ? x.Category.Name : "Uncategorized"), x.Amount, x.Vendor, x.PaymentMethod, x.ReferenceNumber, x.Description, x.CreatedAt)).ToListAsync(ct);

    public async Task<ExpenseResponse> CreateExpenseAsync(CreateExpenseRequest request, string? userId, CancellationToken ct)
    {
        RequireText(request.Description, "Expense description");
        if (request.Amount <= 0) throw new ArgumentException("Expense amount must be greater than zero.");
        var category = await context.Types.SingleOrDefaultAsync(x => x.Id == request.CategoryId && x.Group == GeneralTypeEnum.ExpenseCategory, ct) ?? throw new ArgumentException("Expense category not found.");
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var entity = new Expense
        {
            ExpenseDate = request.ExpenseDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.ExpenseDate,
            GeneralTypeCategoryId = category.Id,
            Amount = request.Amount,
            CurrencyCode = currencyCode,
            Vendor = Clean(request.Vendor),
            PaymentMethod = PaymentMethod(request.PaymentMethod),
            ReferenceNumber = Clean(request.ReferenceNumber),
            Description = request.Description.Trim(),
            CreatedByUserId = userId
        };
        context.Expenses.Add(entity);
        await context.SaveChangesAsync(ct);
        return new ExpenseResponse(entity.Id, entity.ExpenseDate, category.Id, category.Name, entity.Amount, entity.Vendor, entity.PaymentMethod, entity.ReferenceNumber, entity.Description, entity.CreatedAt);
    }


    private async Task<Dictionary<long, Product>> LoadProductsForUnitsAsync(long[] productIds, CancellationToken ct) =>
        await context.Products
            .AsNoTracking()
            .Include(product => product.Unit)
            .Include(product => product.UnitConversions.Where(unit => unit.IsActive))
                .ThenInclude(unit => unit.Unit)
            .Include(product => product.Inventory)
            .Where(product => productIds.Contains(product.Id) && product.IsActive)
            .ToDictionaryAsync(product => product.Id, ct);

    private static void EnsureAllProductsExist(long[] productIds, IReadOnlyDictionary<long, Product> products)
    {
        if (products.Count != productIds.Length)
            throw new ArgumentException("One or more selected products do not exist or are inactive.");
    }

    private static decimal? ResolveDefaultPrice(Product product, DateOnly today)
    {
        var price = product.Prices.OrderBy(item => item.Id).FirstOrDefault();
        if (price is null) return null;
        return price.SalePrice.HasValue &&
               (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
               (!price.EndDate.HasValue || price.EndDate.Value >= today)
            ? price.SalePrice.Value
            : price.RegularPrice;
    }

    private static IReadOnlyList<OperationProductUnitLookup> BuildOperationUnits(Product product, decimal availableBaseQuantity, decimal? basePrice)
    {
        var units = new List<OperationProductUnitLookup>();
        if (product.UnitId.HasValue && product.Unit is not null)
            units.Add(new OperationProductUnitLookup(
                product.UnitId.Value,
                product.Unit.Name,
                1,
                product.Barcode,
                basePrice,
                decimal.Round(availableBaseQuantity, 3),
                true,
                !product.UnitConversions.Any(unit => unit.IsDefault && unit.IsActive)));

        units.AddRange(product.UnitConversions
            .Where(unit => unit.IsActive)
            .OrderByDescending(unit => unit.IsDefault)
            .ThenBy(unit => unit.SortOrder)
            .ThenBy(unit => unit.Id)
            .Select(unit => new OperationProductUnitLookup(
                unit.UnitId,
                unit.Unit.Name,
                unit.ConversionFactor,
                unit.Barcode,
                unit.PriceOverride ?? (basePrice.HasValue ? basePrice.Value * unit.ConversionFactor : null),
                decimal.Round(availableBaseQuantity / unit.ConversionFactor, 3),
                false,
                unit.IsDefault)));
        return units;
    }

    private static SelectedOperationUnit ResolveOperationUnit(Product product, long? requestedUnitId)
    {
        if (!requestedUnitId.HasValue || requestedUnitId == product.UnitId)
            return new SelectedOperationUnit(product.UnitId, product.Unit?.Name ?? "Base unit", 1);

        var conversion = product.UnitConversions.FirstOrDefault(unit =>
            unit.IsActive && unit.UnitId == requestedUnitId.Value);
        if (conversion is null)
            throw new ArgumentException($"The selected selling unit is not configured for '{product.Name}'.");

        return new SelectedOperationUnit(conversion.UnitId, conversion.Unit.Name, conversion.ConversionFactor);
    }

    private static void ValidateSaleQuantity(Product product, decimal baseQuantity, SelectedOperationUnit selectedUnit)
    {
        if (product.MinimumValue.HasValue && baseQuantity < product.MinimumValue.Value)
            throw new ArgumentException($"The minimum sale quantity for '{product.Name}' is {product.MinimumValue.Value:N3} {product.Unit?.Name ?? "base unit"}.");
        if (product.MaximumValue.HasValue && baseQuantity > product.MaximumValue.Value)
            throw new ArgumentException($"The maximum sale quantity for '{product.Name}' is {product.MaximumValue.Value:N3} {product.Unit?.Name ?? "base unit"}.");

        var availableBaseQuantity = product.UsesDisplayStock
            ? Math.Max(0, product.DisplayStockQuantity ?? 0)
            : Math.Max(0, product.Inventory?.Quantity - product.Inventory?.ReservedQuantity ?? 0);
        if (baseQuantity > availableBaseQuantity)
        {
            var availableSelectedQuantity = availableBaseQuantity / selectedUnit.ConversionFactor;
            throw new ArgumentException($"Only {availableSelectedQuantity:N3} {selectedUnit.UnitName} of '{product.Name}' are available.");
        }
    }

    private sealed record SelectedOperationUnit(long? UnitId, string UnitName, decimal ConversionFactor);
    private sealed record NormalizedPurchaseLine(PurchaseItemRequest Request, Product Product, SelectedOperationUnit Unit, decimal BaseQuantity, decimal BaseUnitCost);
    private sealed record NormalizedSaleLine(InventorySaleItemRequest Request, Product Product, SelectedOperationUnit Unit, decimal BaseQuantity, decimal BaseUnitPrice);


    private async Task<string> GetCurrencyCodeAsync(CancellationToken ct) =>
        await context.TenantSettings.AsNoTracking()
            .Where(item => item.TenantId == context.CurrentCompanyId)
            .Select(item => item.MainCurrencyCode)
            .FirstOrDefaultAsync(ct) ?? "USD";

    private async Task ConsumeInventoryLotsAsync(long productId, decimal quantity, CancellationToken ct)
    {
        var remaining = quantity;
        var lots = await context.InventoryLots.Where(x => x.ProductId == productId && x.Quantity - x.ReservedQuantity > 0)
            .OrderBy(x => x.ExpiresAt == null).ThenBy(x => x.ExpiresAt).ThenBy(x => x.CreatedAt).ToListAsync(ct);
        foreach (var lot in lots)
        {
            if (remaining <= 0) break;
            var consumed = Math.Min(lot.Quantity - lot.ReservedQuantity, remaining);
            lot.Quantity -= consumed;
            remaining -= consumed;
        }
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
        var beforeQuantity = inventory.Quantity;
        var beforeReserved = inventory.ReservedQuantity;
        if (delta < 0 && inventory.Quantity - inventory.ReservedQuantity < -delta) throw new InvalidOperationException("Insufficient available stock for one or more sale items.");
        inventory.Quantity += delta;
        if (expireDate.HasValue && (!inventory.ExpireDate.HasValue || expireDate.Value < inventory.ExpireDate.Value)) inventory.ExpireDate = expireDate;
        context.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId,
            Quantity = delta,
            Type = type,
            QuantityBefore = beforeQuantity,
            QuantityAfter = inventory.Quantity,
            ReservedBefore = beforeReserved,
            ReservedAfter = inventory.ReservedQuantity,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            PerformedByUserId = userId,
            Description = $"{referenceType} {documentNumber}"
        });
    }

    private async Task EnsurePurchasableProductsAsync(IEnumerable<long> ids, CancellationToken ct)
    {
        var distinct = ids.Distinct().ToArray();
        var products = await context.Products
            .AsNoTracking()
            .Where(product => distinct.Contains(product.Id))
            .Select(product => new { product.Id, product.Name, product.UsesDisplayStock })
            .ToListAsync(ct);

        if (products.Count != distinct.Length)
            throw new ArgumentException("One or more selected products do not exist.");

        var displayOnly = products.FirstOrDefault(product => product.UsesDisplayStock);
        if (displayOnly is not null)
            throw new ArgumentException(
                "Display-stock products cannot be added to purchases because they do not update physical inventory.");
    }

    private static void EnsureNoDuplicateProducts(IEnumerable<long> productIds, string documentName)
    {
        var ids = productIds.ToArray();
        if (ids.Length != ids.Distinct().Count())
            throw new ArgumentException($"A product can be selected only once in a {documentName}. Remove the duplicate line and update the original quantity instead.");
    }

    private static void ValidatePurchase(CreatePurchaseRequest request)
    {
        if (request.Items.Count == 0) throw new ArgumentException("At least one purchase item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.UnitCost < 0)) throw new ArgumentException("Every purchase item requires a product, positive quantity, and non-negative cost.");
        if (request.Discount < 0 || request.Tax < 0 || request.OtherCost < 0) throw new ArgumentException("Discount, tax, and other costs cannot be negative.");
    }

    private static void ValidateInitialPayment(decimal paid, decimal total)
    {
        if (paid < 0 || paid > total) throw new ArgumentException("Paid amount must be between zero and the document total.");
    }

    private static void ValidatePaymentRequest(RecordDocumentPaymentRequest request)
    {
        if (request.Amount <= 0) throw new ArgumentException("Payment amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.PaymentMethod)) throw new ArgumentException("Payment method is required.");
    }

    private static PurchasePayment NewPurchasePayment(decimal amount, DateOnly date, string? method, string? reference, string? notes, string? userId) =>
        new() { Amount = amount, PaymentDate = date, PaymentMethod = PaymentMethod(method), ReferenceNumber = Clean(reference), Notes = Clean(notes), CreatedByUserId = userId };
    private static InventorySalePayment NewSalePayment(decimal amount, DateOnly date, string? method, string? reference, string? notes, string? userId) =>
        new() { Amount = amount, PaymentDate = date, PaymentMethod = PaymentMethod(method), ReferenceNumber = Clean(reference), Notes = Clean(notes), CreatedByUserId = userId };
    private static StaffSalaryInstallment NewSalaryInstallment(decimal amount, DateOnly date, string? method, string? reference, string? notes, string? userId) =>
        new() { Amount = amount, PaymentDate = date, PaymentMethod = PaymentMethod(method), ReferenceNumber = Clean(reference), Notes = Clean(notes), CreatedByUserId = userId };

    private static System.Linq.Expressions.Expression<Func<PurchasePayment, DocumentPaymentResponse>> MapPurchasePayment() => x => new DocumentPaymentResponse(x.Id, x.Amount, x.PaymentDate, x.PaymentMethod, x.ReferenceNumber, x.Notes, x.CreatedAt);
    private static System.Linq.Expressions.Expression<Func<InventorySalePayment, DocumentPaymentResponse>> MapSalePayment() => x => new DocumentPaymentResponse(x.Id, x.Amount, x.PaymentDate, x.PaymentMethod, x.ReferenceNumber, x.Notes, x.CreatedAt);
    private static System.Linq.Expressions.Expression<Func<StaffSalaryInstallment, DocumentPaymentResponse>> MapSalaryPayment() => x => new DocumentPaymentResponse(x.Id, x.Amount, x.PaymentDate, x.PaymentMethod, x.ReferenceNumber, x.Notes, x.CreatedAt);

    private static PurchaseListItem MapPurchase(Purchase x, string? supplierName) => new(x.Id, x.PurchaseNumber, x.PurchaseDate, supplierName, x.Items.Count, x.Total, x.PaidAmount, Math.Max(0, x.Total - x.PaidAmount), x.PaymentStatus, x.Status, x.CreatedAt);
    private static InventorySaleListItem MapSale(InventorySale x, string customerName) => new(x.Id, x.SaleNumber, x.SaleDate, customerName.Trim(), x.Items.Count, x.Total, x.PaidAmount, Math.Max(0, x.Total - x.PaidAmount), x.PaymentStatus, x.CreatedAt);
    private static SalaryPaymentResponse MapSalary(StaffSalaryPayment x, string staffName) => new(x.Id, x.StaffId, staffName, x.PeriodYear, x.PeriodMonth, x.BaseSalary, x.Bonus, x.Deduction, x.NetAmount, x.PaidAmount, Math.Max(0, x.NetAmount - x.PaidAmount), x.PaymentStatus, x.PaidDate, x.PaymentMethod, x.ReferenceNumber, x.CreatedAt);
    private static StaffResponse MapStaff(Staff x) => new(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes);
    private static SupplierResponse MapSupplier(Supplier x) => new(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive);

    private static DocumentPaymentStatus PaymentStatus(decimal paid, decimal total) =>
        total <= 0 || paid >= total
            ? DocumentPaymentStatus.Paid
            : paid <= 0
                ? DocumentPaymentStatus.Unpaid
                : DocumentPaymentStatus.Partial;
    private static string PaymentMethod(string? value) => string.IsNullOrWhiteSpace(value) ? "Cash" : value.Trim();
    private static DateOnly PaymentDate(DateOnly value) => value == default ? DateOnly.FromDateTime(DateTime.UtcNow) : value;
    private static string DocumentNumber(string prefix) => $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Random.Shared.Next(1000, 9999)}";
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static void RequireText(string? value, string field) { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"{field} is required."); }
}
