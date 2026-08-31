using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Operations.Contracts;
using ECommerce.Entities.Products;
using ECommerce.Services.Customers;
using ECommerce.Services.Inventory;
using ECommerce.Services.Company;
using ECommerce.Services.Accounting;
using ECommerce.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Operations;

public sealed class OperationsService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerTypeResolver,
    IInventoryCostService inventoryCosts,
    IInventoryLotAllocator lotAllocator,
    IAccountingPostingService accounting,
    IBranchContext branchContext,
    IOptions<WhatsAppOptions> whatsAppOptions) : IOperationsService
{
    private const string MainWarehouseCode = "MAIN";
    private readonly WhatsAppOptions _whatsAppOptions = whatsAppOptions.Value;

    public async Task<OperationSummary> GetSummaryAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var first = new DateOnly(today.Year, today.Month, 1);
        var purchases = await context.Purchases.Where(x => (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value) && x.PurchaseDate >= first && x.Status != PurchaseStatus.Cancelled).SumAsync(x => (decimal?)x.Total, ct) ?? 0;
        var sales = await context.InventorySales.Where(x => (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value) && x.SaleDate >= first).SumAsync(x => (decimal?)(x.Total - x.Tax), ct) ?? 0;
        var expenses = await context.Expenses.Where(x => (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value) && x.ExpenseDate >= first).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var salaries = await context.StaffSalaryPayments.Where(x => (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value) && x.PaidDate >= first).SumAsync(x => (decimal?)x.NetAmount, ct) ?? 0;
        var low = await context.Products.AsNoTracking().CountAsync(product =>
            product.IsActive &&
            !product.UsesDisplayStock &&
            (product.Inventory == null ||
             product.Inventory.Quantity - product.Inventory.ReservedQuantity -
             (context.InventoryLots
                 .Where(lot => lot.ProductId == product.Id &&
                     lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                     lot.Quantity - lot.ReservedQuantity > 0)
                 .Sum(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity)) ?? 0) <=
             product.Inventory.MinimumQuantity), ct);
        return new OperationSummary(purchases, sales, expenses, salaries, low, await GetCurrencyCodeAsync(ct));
    }

    public async Task<OperationPolicyResponse> GetPolicyAsync(
        bool canOverrideLineLimits,
        CancellationToken ct)
    {
        var settings = await context.CompanySettings.AsNoTracking()
            .Select(item => new
            {
                item.MaximumPurchaseLines,
                item.MaximumManualSaleLines,
                item.GeneralSalesDiscountPercent,
                item.MaximumCustomerDebt,
                item.DefaultDebtDueDays,
                item.AllowNegativeStockSales
            })
            .SingleOrDefaultAsync(ct);

        return new OperationPolicyResponse(
            Math.Clamp(settings?.MaximumPurchaseLines ?? 50, 1, 500),
            Math.Clamp(settings?.MaximumManualSaleLines ?? 50, 1, 500),
            canOverrideLineLimits,
            settings?.GeneralSalesDiscountPercent ?? 0,
            settings?.MaximumCustomerDebt ?? 300000,
            settings?.DefaultDebtDueDays ?? 30,
            settings?.AllowNegativeStockSales ?? true);
    }

    public async Task<IReadOnlyList<OperationProductLookup>> GetProductLookupsAsync(
        string? search,
        int take,
        bool includeCurrentUnitCost,
        CancellationToken ct)
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
                (product.Strength != null && product.Strength.Contains(clean)) ||
                (product.GenericName != null && product.GenericName.Contains(clean)) ||
                (product.Formula != null && product.Formula.Contains(clean)) ||
                (product.Barcode != null && product.Barcode.Contains(clean)) ||
                product.UnitConversions.Any(unit => unit.IsActive && unit.Barcode != null && unit.Barcode.Contains(clean)));

        var products = await query
            .OrderBy(product => product.Name)
            .Take(Math.Clamp(take, 1, 500))
            .ToListAsync(ct);
        var expiredAvailableByProduct = await InventoryAvailability.LoadExpiredAvailableByProductAsync(
            context,
            products.Select(product => product.Id),
            ct);
        var currentUnitCosts = includeCurrentUnitCost
            ? await inventoryCosts.GetCurrentUnitCostsAsync(products.Select(product => product.Id), ct)
            : null;

        return products.Select(product =>
        {
            var availableBaseQuantity = product.UsesDisplayStock
                ? Math.Max(0, product.DisplayStockQuantity ?? 0)
                : product.Inventory is null
                    ? 0
                    : InventoryAvailability.SellableBalance(
                        product.Inventory.Quantity,
                        product.Inventory.ReservedQuantity,
                        expiredAvailableByProduct.GetValueOrDefault(product.Id));
            var basePrice = ResolveDefaultPrice(product, today);
            var units = BuildOperationUnits(product, availableBaseQuantity, basePrice);

            return new OperationProductLookup(
                product.Id,
                product.Name,
                product.Strength,
                product.GenericName,
                product.Formula,
                product.Barcode,
                availableBaseQuantity,
                basePrice,
                product.MinimumValue,
                product.MaximumValue,
                product.UsesDisplayStock,
                product.UnitId,
                product.Unit?.Name,
                currentUnitCosts is null
                    ? null
                    : currentUnitCosts.GetValueOrDefault(product.Id),
                units);
        }).ToList();
    }

    public async Task<OperationProductLookup> QuickCreateProductAsync(
        QuickCreateProductRequest request,
        CancellationToken ct)
    {
        var name = Clean(request.Name);
        if (name is null) throw new ArgumentException("Product name is required.");
        if (name.Length > 200) throw new ArgumentException("Product name cannot exceed 200 characters.");
        if (request.CategoryId <= 0) throw new ArgumentException("Product category is required.");
        if (request.UnitId <= 0) throw new ArgumentException("Base unit is required.");
        if (request.DefaultSalePrice is < 0) throw new ArgumentException("Default selling price cannot be negative.");

        var barcode = Clean(request.Barcode);
        if (barcode?.Length > 100) throw new ArgumentException("Barcode cannot exceed 100 characters.");
        if (Clean(request.Strength)?.Length > 100) throw new ArgumentException("Strength cannot exceed 100 characters.");
        if (Clean(request.GenericName)?.Length > 200) throw new ArgumentException("Generic name cannot exceed 200 characters.");
        if (Clean(request.Formula)?.Length > 500) throw new ArgumentException("Formula cannot exceed 500 characters.");
        if (barcode is not null)
        {
            var barcodeExists = await context.Products.AsNoTracking()
                .AnyAsync(product => product.Barcode == barcode ||
                    product.UnitConversions.Any(unit => unit.Barcode == barcode), ct);
            if (barcodeExists)
                throw new ArgumentException($"Barcode '{barcode}' already belongs to another product or selling unit.");
        }

        var typeNames = await context.Types.AsNoTracking()
            .Where(type => type.Id == request.CategoryId || type.Id == request.UnitId)
            .Select(type => new { type.Id, type.Name, type.Group })
            .ToListAsync(ct);
        var category = typeNames.SingleOrDefault(type =>
            type.Id == request.CategoryId && type.Group == GeneralTypeEnum.ProductCategory);
        if (category is null) throw new ArgumentException("The selected product category is invalid.");
        var unit = typeNames.SingleOrDefault(type =>
            type.Id == request.UnitId && type.Group == GeneralTypeEnum.ProductUnit);
        if (unit is null) throw new ArgumentException("The selected base unit is invalid.");

        var product = new Product
        {
            Name = name,
            Barcode = barcode,
            Strength = Clean(request.Strength),
            GenericName = Clean(request.GenericName),
            Formula = Clean(request.Formula),
            CategoryId = category.Id,
            UnitId = unit.Id,
            IsActive = true,
            IsFeatured = false,
            OrderQuantityStep = 1,
            Slug = CreateQuickProductSlug(name),
            Inventory = new ProductInventory
            {
                Quantity = 0,
                ReservedQuantity = 0,
                MinimumQuantity = 0
            }
        };

        if (request.DefaultSalePrice.HasValue)
        {
            product.Prices.Add(new ProductPrice
            {
                CustomerTypeId = await defaultCustomerTypeResolver.GetIdAsync(ct),
                RegularPrice = request.DefaultSalePrice.Value
            });
        }

        context.Products.Add(product);
        await context.SaveChangesAsync(ct);

        var baseUnit = new OperationProductUnitLookup(
            unit.Id,
            unit.Name,
            1,
            barcode,
            request.DefaultSalePrice,
            0,
            true,
            true);

        return new OperationProductLookup(
            product.Id,
            product.Name,
            product.Strength,
            product.GenericName,
            product.Formula,
            product.Barcode,
            0,
            request.DefaultSalePrice,
            product.MinimumValue,
            product.MaximumValue,
            false,
            unit.Id,
            unit.Name,
            null,
            [baseUnit]);
    }

    public async Task<IReadOnlyList<OperationCustomerLookup>> GetCustomerLookupsAsync(string? search, int take, CancellationToken ct)
    {
        var companyDebtLimit = await context.CompanySettings.AsNoTracking()
            .Select(x => x.MaximumCustomerDebt)
            .SingleOrDefaultAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = context.Customers.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.FirstName.Contains(clean) || (x.LastName != null && x.LastName.Contains(clean)) || x.Phone.Contains(clean) || (x.Email != null && x.Email.Contains(clean)));

        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(Math.Clamp(take, 1, 500))
            .Select(x => new
            {
                x.Id,
                Name = (x.FirstName + " " + (x.LastName ?? "")).Trim(),
                x.Phone,
                x.Email,
                CustomerTypeName = x.CustomerType == null ? null : x.CustomerType.Name,
                x.AccountCredit,
                CreditLimit = x.CreditLimit ?? companyDebtLimit,
                OutstandingDebt = context.InventorySales
                    .Where(sale => sale.CustomerId == x.Id && sale.Total > sale.PaidAmount)
                    .Sum(sale => (decimal?)(sale.Total - sale.PaidAmount)) ?? 0,
                HasOverdueDebt = context.InventorySales.Any(sale =>
                    sale.CustomerId == x.Id && sale.Total > sale.PaidAmount &&
                    sale.DebtDueDate.HasValue && sale.DebtDueDate.Value < today)
            })
            .ToListAsync(ct);

        return rows.Select(x => new OperationCustomerLookup(
            x.Id,
            x.Name,
            x.Phone,
            WhatsAppLinkBuilder.Build(x.Phone, x.Name, _whatsAppOptions),
            x.Email,
            x.CustomerTypeName,
            x.AccountCredit,
            x.OutstandingDebt,
            x.CreditLimit,
            x.HasOverdueDebt)).ToList();
    }

    public async Task<IReadOnlyList<PartySettlementDocumentResponse>> GetCustomerSettlementDocumentsAsync(
        long customerId,
        CancellationToken ct)
    {
        var customerExists = await context.Customers.AsNoTracking().AnyAsync(x =>
            x.Id == customerId &&
            (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value), ct);
        if (!customerExists) throw new KeyNotFoundException("Customer not found.");

        return await context.InventorySales.AsNoTracking()
            .Where(x => x.CustomerId == customerId && x.Total > x.PaidAmount &&
                (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
            .OrderBy(x => x.SaleDate)
            .ThenBy(x => x.Id)
            .Take(100)
            .Select(x => new PartySettlementDocumentResponse(
                x.Id,
                x.SaleNumber,
                x.SaleDate,
                x.CurrencyCode,
                x.Total,
                x.PaidAmount,
                x.Total - x.PaidAmount,
                x.PaymentStatus))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SupplierResponse>> GetSuppliersAsync(string? search, int take, CancellationToken ct)
    {
        var query = context.Suppliers.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.Name.Contains(clean) || (x.Phone != null && x.Phone.Contains(clean)) || (x.ContactPerson != null && x.ContactPerson.Contains(clean)));

        return await query.OrderByDescending(x => x.IsActive).ThenBy(x => x.Name).Take(Math.Clamp(take, 1, 500))
            .Select(x => new SupplierResponse(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive,
                x.Purchases.Where(purchase => purchase.Status != PurchaseStatus.Cancelled && purchase.Total > purchase.PaidAmount).Sum(purchase => (decimal?)(purchase.Total - purchase.PaidAmount)) ?? 0))
            .ToListAsync(ct);
    }

    public async Task<PagedResult<SupplierResponse>> GetSupplierPageAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.Suppliers.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.Name.Contains(clean) || (x.Phone != null && x.Phone.Contains(clean)) || (x.ContactPerson != null && x.ContactPerson.Contains(clean)) || (x.Email != null && x.Email.Contains(clean)));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new SupplierResponse(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive,
                x.Purchases.Where(purchase => purchase.Status != PurchaseStatus.Cancelled && purchase.Total > purchase.PaidAmount).Sum(purchase => (decimal?)(purchase.Total - purchase.PaidAmount)) ?? 0))
            .ToListAsync(ct);

        return new PagedResult<SupplierResponse> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<SupplierResponse> SaveSupplierAsync(long? id, CreateSupplierRequest request, CancellationToken ct)
    {
        RequireText(request.Name, "Supplier name");
        Supplier entity;
        if (id.HasValue)
            entity = await context.Suppliers.SingleOrDefaultAsync(
                x => x.Id == id.Value && (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value),
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

    public async Task<SupplierLedgerResponse> GetSupplierLedgerAsync(long id, CancellationToken ct)
    {
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var supplier = await context.Suppliers.AsNoTracking()
            .Where(x => x.Id == id && (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
            .Select(x => new { x.Id, x.Name })
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Supplier not found.");
        var purchases = await context.Purchases.AsNoTracking()
            .Where(x => x.SupplierId == id && x.Status != PurchaseStatus.Cancelled &&
                x.CurrencyCode == currencyCode &&
                (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
            .Select(x => new { x.Id, x.PurchaseNumber, x.PurchaseDate, x.Total })
            .ToListAsync(ct);
        var payments = await context.PurchasePayments.AsNoTracking()
            .Where(x => x.Purchase.SupplierId == id && x.Purchase.Status != PurchaseStatus.Cancelled &&
                x.Purchase.CurrencyCode == currencyCode &&
                (!branchContext.BranchId.HasValue || x.Purchase.BranchId == branchContext.BranchId.Value))
            .Select(x => new { x.Id, x.PurchaseId, x.Purchase.PurchaseNumber, x.PaymentDate, x.Amount, x.PaymentMethod })
            .ToListAsync(ct);

        var rawEntries = purchases.Select(x => new { Date = x.PurchaseDate, Sort = 0, Type = "Purchase", Reference = x.PurchaseNumber, Description = "Inventory purchase", Debit = x.Total, Credit = 0m, SourceId = x.Id })
            .Concat(payments.Select(x => new { Date = x.PaymentDate, Sort = 1, Type = "Payment", Reference = x.PurchaseNumber, Description = $"{x.PaymentMethod} payment", Debit = 0m, Credit = x.Amount, SourceId = x.PurchaseId }))
            .OrderBy(x => x.Date).ThenBy(x => x.Sort).ThenBy(x => x.SourceId)
            .ToList();
        var balance = 0m;
        var entries = rawEntries.Select(x =>
        {
            balance += x.Debit - x.Credit;
            return new SupplierLedgerEntryResponse(x.Date, x.Type, x.Reference, x.Description, x.Debit, x.Credit, balance, x.SourceId);
        }).ToList();
        return new SupplierLedgerResponse(
            supplier.Id,
            supplier.Name,
            currencyCode,
            purchases.Sum(x => x.Total),
            payments.Sum(x => x.Amount),
            balance,
            entries);
    }

    public async Task<IReadOnlyList<PartySettlementDocumentResponse>> GetSupplierSettlementDocumentsAsync(
        long supplierId,
        CancellationToken ct)
    {
        var supplierExists = await context.Suppliers.AsNoTracking().AnyAsync(x =>
            x.Id == supplierId &&
            (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value), ct);
        if (!supplierExists) throw new KeyNotFoundException("Supplier not found.");

        return await context.Purchases.AsNoTracking()
            .Where(x => x.SupplierId == supplierId &&
                x.Status != PurchaseStatus.Cancelled &&
                x.Total > x.PaidAmount &&
                (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
            .OrderBy(x => x.PurchaseDate)
            .ThenBy(x => x.Id)
            .Take(100)
            .Select(x => new PartySettlementDocumentResponse(
                x.Id,
                x.PurchaseNumber,
                x.PurchaseDate,
                x.CurrencyCode,
                x.Total,
                x.PaidAmount,
                x.Total - x.PaidAmount,
                x.PaymentStatus))
            .ToListAsync(ct);
    }

    public async Task<PagedResult<PurchaseListItem>> GetPurchasesAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.Purchases.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x =>
                x.PurchaseNumber.Contains(clean) ||
                (x.ReferenceNumber != null && x.ReferenceNumber.Contains(clean)) ||
                (x.Supplier != null && x.Supplier.Name.Contains(clean)) ||
                x.Items.Any(item => item.Product.Name.Contains(clean) ||
                    (item.Product.Barcode != null && item.Product.Barcode.Contains(clean)) ||
                    (item.LotNumber != null && item.LotNumber.Contains(clean))));

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.PurchaseDate)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PurchaseListItem(x.Id, x.PurchaseNumber, x.ReferenceNumber, x.PurchaseDate, x.Supplier == null ? null : x.Supplier.Name, x.Items.Count, x.Total, x.PaidAmount, x.Total > x.PaidAmount ? x.Total - x.PaidAmount : 0, x.PaymentStatus, x.Status, x.CreatedAt))
            .ToListAsync(ct);

        return new PagedResult<PurchaseListItem> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<PurchaseDetailsResponse> GetPurchaseAsync(long id, CancellationToken ct)
    {
        var purchase = await context.Purchases.AsNoTracking()
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .Select(item => new PurchaseDetailsResponse(
                item.Id,
                item.PurchaseNumber,
                item.ReferenceNumber,
                item.PurchaseDate,
                item.SupplierId,
                item.Supplier == null ? null : item.Supplier.Name,
                item.Status,
                item.PaymentStatus,
                item.Subtotal,
                item.Discount,
                item.Tax,
                item.OtherCost,
                item.Total,
                item.PaidAmount,
                item.Total > item.PaidAmount ? item.Total - item.PaidAmount : 0,
                item.CurrencyCode,
                item.Notes,
                item.CreatedAt,
                item.Items
                    .OrderBy(line => line.Id)
                    .Select(line => new PurchaseItemDetailsResponse(
                        line.Id,
                        line.ProductId,
                        line.Product.Name,
                        line.Product.Strength,
                        line.Product.Barcode,
                        line.Quantity,
                        line.UnitCost,
                        line.EnteredQuantity,
                        line.SelectedUnitId,
                        line.SelectedUnitName,
                        line.UnitConversionFactor,
                        line.EnteredUnitCost,
                        line.LineTotal,
                        line.LotNumber,
                        line.ExpireDate))
                    .ToList()))
            .SingleOrDefaultAsync(ct);

        return purchase ?? throw new KeyNotFoundException("Purchase not found.");
    }

    public async Task<PurchaseListItem> CreatePurchaseAsync(CreatePurchaseRequest request, string? userId, bool canOverrideLineLimits, CancellationToken ct)
    {
        var clientRequestId = Clean(request.ClientRequestId);
        if (clientRequestId is not null)
        {
            var existing = await context.Purchases.AsNoTracking()
                .Include(x => x.Supplier)
                .Include(x => x.Items)
                .SingleOrDefaultAsync(x => x.ClientRequestId == clientRequestId, ct);
            if (existing is not null)
                return MapPurchase(existing, existing.Supplier?.Name);
        }

        await EnsureLineLimitAsync(request.Items.Count, isPurchase: true, canOverrideLineLimits, ct);
        ValidatePurchase(request);
        EnsureDistinctPurchaseLots(request.Items);
        var items = request.Items.ToList();
        var productIds = items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await LoadProductsForUnitsAsync(productIds, ct);
        EnsureAllProductsExist(productIds, products);

        var displayOnly = products.Values.FirstOrDefault(product => product.UsesDisplayStock);
        if (displayOnly is not null)
            throw new ArgumentException("Display-stock products cannot be added to purchases because they do not update physical inventory.");

        var today = InventoryAvailability.UtcToday;
        var normalizedItems = items.Select(item =>
        {
            var product = products[item.ProductId];
            if (InventoryAvailability.IsExpired(item.ExpireDate, today))
                throw new ArgumentException(
                    $"Cannot receive expired stock for '{product.Name}'. Use supplier return or quarantine documentation instead.");
            var selectedUnit = ResolveOperationUnit(product, item.UnitId);
            var receivedQuantity = item.Quantity + item.BonusQuantity;
            var baseQuantity = decimal.Round(receivedQuantity * selectedUnit.ConversionFactor, 3, MidpointRounding.AwayFromZero);
            if (baseQuantity <= 0)
                throw new ArgumentException($"The quantity for '{product.Name}' is too small for base-unit precision.");
            var lineTotal = PercentageNet(item.Quantity * item.UnitCost, item.DiscountPercent);
            var baseUnitCost = decimal.Round(lineTotal / baseQuantity, 4, MidpointRounding.AwayFromZero);
            return new NormalizedPurchaseLine(item, product, selectedUnit, baseQuantity, baseUnitCost);
        }).ToList();

        string? supplierName = null;
        if (request.SupplierId.HasValue)
        {
            supplierName = await context.Suppliers
                .Where(x => x.Id == request.SupplierId && x.IsActive &&
                    (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
                .Select(x => x.Name)
                .SingleOrDefaultAsync(ct);
            if (supplierName is null) throw new ArgumentException("Selected supplier does not exist or is inactive.");
        }

        var subtotal = decimal.Round(
            normalizedItems.Sum(line => line.Request.Quantity * line.Request.UnitCost),
            2,
            MidpointRounding.AwayFromZero);
        var linesNet = normalizedItems.Sum(line => PercentageNet(
            line.Request.Quantity * line.Request.UnitCost,
            line.Request.DiscountPercent));
        var documentNet = StackedNet(linesNet, request.DiscountPercent, request.SecondaryDiscountPercent);
        var effectiveDiscount = Math.Min(subtotal, subtotal - documentNet + request.Discount);
        var total = decimal.Round(
            Math.Max(0, subtotal - effectiveDiscount + request.Tax + request.OtherCost),
            2,
            MidpointRounding.AwayFromZero);
        normalizedItems = AllocatePurchaseLandedCosts(normalizedItems, total, linesNet);
        ValidateInitialPayment(request.PaidAmount, total);
        var purchaseDate = request.PurchaseDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.PurchaseDate;
        var currencyCode = await GetCurrencyCodeAsync(ct);
        await using var tx = await context.Database.BeginTransactionAsync(ct);
        var purchase = new Purchase
        {
            PurchaseNumber = await NextDocumentNumberAsync(isPurchase: true, ct),
            SupplierId = request.SupplierId,
            PurchaseDate = purchaseDate,
            Status = PurchaseStatus.Received,
            Subtotal = subtotal,
            Discount = effectiveDiscount,
            DiscountPercent = request.DiscountPercent,
            SecondaryDiscountPercent = request.SecondaryDiscountPercent,
            Tax = request.Tax,
            OtherCost = request.OtherCost,
            Total = total,
            PaidAmount = request.PaidAmount,
            CurrencyCode = currencyCode,
            PaymentStatus = PaymentStatus(request.PaidAmount, total),
            ReferenceNumber = Clean(request.ReferenceNumber),
            ClientRequestId = clientRequestId,
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
                LineTotal = PercentageNet(
                    line.Request.Quantity * line.Request.UnitCost,
                    line.Request.DiscountPercent),
                BonusQuantity = line.Request.BonusQuantity,
                DiscountPercent = line.Request.DiscountPercent,
                SecondaryDiscountPercent = 0,
                LotNumber = Clean(line.Request.LotNumber),
                ExpireDate = line.Request.ExpireDate
            });

        if (request.PaidAmount > 0)
            purchase.Payments.Add(NewPurchasePayment(request.PaidAmount, purchaseDate, request.PaymentMethod, request.PaymentReferenceNumber, "Initial purchase payment", userId));

        context.Purchases.Add(purchase);
        await context.SaveChangesAsync(ct);
        await accounting.PostPurchaseAsync(purchase, supplierName, userId, ct);
        foreach (var payment in purchase.Payments.OrderBy(item => item.Id))
            await accounting.PostPurchasePaymentAsync(purchase, payment, supplierName, userId, ct);
        await context.SaveChangesAsync(ct);
        var warehouse = await context.Warehouses
            .Where(x => x.IsActive && (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
            .OrderByDescending(x => x.Code == MainWarehouseCode)
            .ThenBy(x => x.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("No active warehouse is configured. Activate or create a warehouse before receiving purchases.");

        foreach (var line in normalizedItems)
        {
            var inventory = context.ProductInventories.Local.FirstOrDefault(item => item.ProductId == line.Request.ProductId)
                ?? await context.ProductInventories.SingleOrDefaultAsync(item => item.ProductId == line.Request.ProductId, ct);
            var negativeDeficit = Math.Max(0, -(inventory?.Quantity ?? 0));
            // Stock sold before it was purchased already exists as a negative
            // inventory balance. The matching part of this receipt settles that
            // deficit and must not also become a sellable lot.
            var lotQuantity = Math.Max(0, line.BaseQuantity - negativeDeficit);
            var allocations = new List<InventoryLotAllocation>();
            if (lotQuantity > 0)
            {
                var lot = await AddOrMergeInventoryLotAsync(
                    line.Request.ProductId,
                    warehouse.Id,
                    Clean(line.Request.LotNumber) ?? purchase.PurchaseNumber,
                    line.Request.ExpireDate,
                    lotQuantity,
                    line.BaseUnitCost,
                    ct);
                lot.Warehouse = warehouse;
                allocations.Add(new InventoryLotAllocation(lot, lotQuantity));
            }
            await ApplyStockMovement(
                line.Request.ProductId,
                line.BaseQuantity,
                InventoryTransactionType.Purchase,
                "Purchase",
                purchase.Id,
                purchase.PurchaseNumber,
                userId,
                lotQuantity > 0 ? line.Request.ExpireDate : null,
                allocations,
                false,
                ct);
        }
        await context.SaveChangesAsync(ct);
        foreach (var productId in normalizedItems.Select(line => line.Request.ProductId).Distinct())
            await RefreshInventoryExpiryAsync(productId, ct);
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return MapPurchase(purchase, supplierName);
    }

    public async Task<PurchaseListItem> UpdatePurchaseAsync(
        long id,
        UpdatePurchaseRequest request,
        string? userId,
        CancellationToken ct)
    {
        if (request.PurchaseDate == default)
            throw new ArgumentException("Purchase date is required.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var purchase = await context.Purchases
            .Include(item => item.Supplier)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Purchase not found.");

        string? supplierName = null;
        if (request.SupplierId.HasValue)
        {
            supplierName = await context.Suppliers
                .Where(item => item.Id == request.SupplierId.Value && item.IsActive &&
                    (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
                .Select(item => item.Name)
                .SingleOrDefaultAsync(ct);
            if (supplierName is null)
                throw new ArgumentException("Selected supplier does not exist or is inactive.");
        }

        purchase.SupplierId = request.SupplierId;
        purchase.PurchaseDate = request.PurchaseDate;
        purchase.ReferenceNumber = Clean(request.ReferenceNumber);
        purchase.Notes = Clean(request.Notes);

        var paymentIds = purchase.Payments.Select(item => item.Id).ToArray();
        var vouchers = await context.JournalVouchers
            .Where(item =>
                (item.SourceType == "Purchase" && item.SourceId == purchase.Id) ||
                (item.SourceType == "PurchasePayment" && item.SourceId.HasValue && paymentIds.Contains(item.SourceId.Value)))
            .ToListAsync(ct);
        foreach (var voucher in vouchers)
        {
            voucher.CounterpartyId = request.SupplierId;
            voucher.CounterpartyName = supplierName;
            if (voucher.SourceType == "Purchase")
            {
                voucher.VoucherDate = request.PurchaseDate;
                voucher.ReferenceNumber = purchase.ReferenceNumber;
            }
            voucher.PostedByUserId ??= userId;
        }

        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapPurchase(purchase, supplierName);
    }

    public async Task DeletePurchaseAsync(long id, string? userId, CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var purchase = await context.Purchases
            .Include(item => item.Payments)
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Purchase not found.");

        var movements = await context.InventoryTransactions
            .Include(item => item.Lots)
                .ThenInclude(item => item.InventoryLot)
            .Where(item =>
                item.ReferenceType == "Purchase" &&
                item.ReferenceId == purchase.Id &&
                item.Type == InventoryTransactionType.Purchase)
            .OrderBy(item => item.Id)
            .ToListAsync(ct);

        foreach (var movement in movements)
        {
            if (movement.Quantity <= 0) continue;
            var allocations = new List<InventoryLotAllocation>();
            foreach (var detail in movement.Lots.Where(item => item.QuantityDelta > 0))
            {
                var lot = detail.InventoryLot
                    ?? throw new InvalidOperationException(
                        "This purchase cannot be deleted because its inventory lot is no longer available.");
                if (lot.Quantity - lot.ReservedQuantity < detail.QuantityDelta)
                {
                    throw new InvalidOperationException(
                        "This purchase cannot be deleted because some of its received stock has already been sold or reserved.");
                }
                lot.Quantity -= detail.QuantityDelta;
                allocations.Add(new InventoryLotAllocation(lot, detail.QuantityDelta));
            }

            await ApplyStockMovement(
                movement.ProductId,
                -movement.Quantity,
                InventoryTransactionType.StockAdjustment,
                "PurchaseDeletion",
                purchase.Id,
                purchase.PurchaseNumber,
                userId,
                null,
                allocations,
                false,
                ct);
        }

        await ReverseOperationalVouchersAsync(
            "Purchase",
            purchase.Id,
            "PurchasePayment",
            purchase.Payments.Select(item => item.Id).ToArray(),
            $"Purchase {purchase.PurchaseNumber} deleted",
            userId,
            ct);
        purchase.IsDeleted = true;
        purchase.DeletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        foreach (var productId in movements.Select(item => item.ProductId).Distinct())
            await RefreshInventoryExpiryAsync(productId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetPurchasePaymentsAsync(long purchaseId, CancellationToken ct) =>
        await context.PurchasePayments.AsNoTracking().Where(x => x.PurchaseId == purchaseId && (!branchContext.BranchId.HasValue || x.Purchase.BranchId == branchContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapPurchasePayment()).ToListAsync(ct);

    public async Task<PurchaseListItem> AddPurchasePaymentAsync(long purchaseId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var purchase = await context.Purchases
            .FromSqlInterpolated($"SELECT * FROM [Purchases] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {purchaseId}")
            .Include(x => x.Supplier)
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Purchase not found.");
        var remaining = Math.Max(0, purchase.Total - purchase.PaidAmount);
        if (request.Amount > remaining) throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00}.");
        var payment = NewPurchasePayment(request.Amount, PaymentDate(request.PaymentDate), request.PaymentMethod, request.ReferenceNumber, request.Notes, userId);
        purchase.Payments.Add(payment);
        purchase.PaidAmount += request.Amount;
        purchase.PaymentStatus = PaymentStatus(purchase.PaidAmount, purchase.Total);
        await context.SaveChangesAsync(ct);
        await accounting.PostPurchasePaymentAsync(purchase, payment, purchase.Supplier?.Name, userId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapPurchase(purchase, purchase.Supplier?.Name);
    }

    public async Task<PagedResult<InventorySaleListItem>> GetSalesAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.InventorySales.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x =>
                x.SaleNumber.Contains(clean) ||
                (x.ReferenceNumber != null && x.ReferenceNumber.Contains(clean)) ||
                (x.CustomerName != null && x.CustomerName.Contains(clean)) ||
                (x.CustomerPhone != null && x.CustomerPhone.Contains(clean)) ||
                (x.Customer != null && (x.Customer.FirstName.Contains(clean) ||
                    (x.Customer.LastName != null && x.Customer.LastName.Contains(clean)) ||
                    x.Customer.Phone.Contains(clean))) ||
                x.Items.Any(item => item.Product.Name.Contains(clean) ||
                    (item.Product.Barcode != null && item.Product.Barcode.Contains(clean))));

        var totalCount = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(x => x.SaleDate)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id, x.SaleNumber, x.ReferenceNumber, x.SaleDate, x.CustomerId, x.Notes,
                CustomerName = x.Customer != null ? (x.Customer.FirstName + " " + (x.Customer.LastName ?? "")).Trim() : (x.CustomerName ?? "Walk-in customer"),
                CustomerPhone = x.Customer != null ? x.Customer.Phone : x.CustomerPhone,
                ItemCount = x.Items.Count, x.Total, x.PaidAmount,
                RemainingAmount = x.Total > x.PaidAmount ? x.Total - x.PaidAmount : 0,
                x.PaymentStatus, x.CreatedAt, x.CurrencyCode,
                NetSales = x.Subtotal > x.Discount ? x.Subtotal - x.Discount : 0,
                CostOfGoods = x.Items.Sum(item => (decimal?)(item.Quantity * item.UnitCost)) ?? 0
            })
            .ToListAsync(ct);

        var items = rows.Select(x =>
        {
            var grossProfit = x.NetSales - x.CostOfGoods;
            var margin = x.NetSales > 0 ? decimal.Round(grossProfit / x.NetSales * 100m, 2) : 0;
            return new InventorySaleListItem(
                x.Id, x.SaleNumber, x.ReferenceNumber, x.SaleDate, x.CustomerId, x.CustomerName, x.CustomerPhone, x.Notes,
                WhatsAppLinkBuilder.BuildSale(x.CustomerPhone, x.CustomerName, x.SaleNumber, x.Total, x.PaidAmount, x.RemainingAmount, x.CurrencyCode, _whatsAppOptions),
                x.ItemCount, x.Total, x.PaidAmount, x.RemainingAmount, x.PaymentStatus, x.CostOfGoods, grossProfit, margin, x.CreatedAt);
        }).ToList();

        return new PagedResult<InventorySaleListItem> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<IReadOnlyList<InventorySaleLotMovementResponse>> GetSaleLotsAsync(
        long saleId,
        CancellationToken ct)
    {
        var saleExists = await context.InventorySales.AsNoTracking().AnyAsync(
            sale => sale.Id == saleId &&
                (!branchContext.BranchId.HasValue || sale.BranchId == branchContext.BranchId.Value),
            ct);
        if (!saleExists)
            throw new KeyNotFoundException("Manual sale not found.");

        return await context.InventoryTransactionLots.AsNoTracking()
            .Where(movement =>
                movement.InventoryTransaction.ReferenceType == "ManualSale" &&
                movement.InventoryTransaction.ReferenceId == saleId &&
                movement.InventoryTransaction.Type == InventoryTransactionType.Sale)
            .OrderBy(movement => movement.InventoryTransaction.Product.Name)
            .ThenBy(movement => movement.ExpiresAt == null)
            .ThenBy(movement => movement.ExpiresAt)
            .ThenBy(movement => movement.Id)
            .Select(movement => new InventorySaleLotMovementResponse(
                movement.Id,
                movement.InventoryTransaction.ProductId,
                movement.InventoryTransaction.Product.Name,
                movement.InventoryLotId,
                movement.LotNumber,
                movement.WarehouseId,
                movement.WarehouseName,
                movement.ExpiresAt,
                Math.Abs(movement.QuantityDelta),
                movement.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<InventorySaleListItem> CreateSaleAsync(CreateInventorySaleRequest request, string? userId, bool canOverrideLineLimits, CancellationToken ct)
    {
        var clientRequestId = Clean(request.ClientRequestId);
        if (clientRequestId is not null)
        {
            var existing = await context.InventorySales.AsNoTracking()
                .Include(x => x.Customer)
                .Include(x => x.Items)
                .SingleOrDefaultAsync(x => x.ClientRequestId == clientRequestId, ct);
            if (existing is not null)
            {
                var existingCustomerName = existing.Customer is null
                    ? existing.CustomerName ?? "Walk-in customer"
                    : (existing.Customer.FirstName + " " + (existing.Customer.LastName ?? "")).Trim();
                return MapSale(existing, existingCustomerName);
            }
        }

        await EnsureLineLimitAsync(request.Items.Count, isPurchase: false, canOverrideLineLimits, ct);
        if (request.Items.Count == 0) throw new ArgumentException("At least one sale item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.BonusQuantity < 0 || x.UnitPrice < 0)) throw new ArgumentException("Every sale item requires a product, positive quantity, non-negative bonus, and non-negative price.");
        if (request.Discount < 0 || request.Tax < 0) throw new ArgumentException("Discount and tax cannot be negative.");
        ValidatePercentage(request.DiscountPercent, "Sale discount");
        ValidatePercentage(request.SecondaryDiscountPercent, "Secondary sale discount");
        foreach (var item in request.Items)
        {
            ValidatePercentage(item.DiscountPercent, "Line discount");
        }
        EnsureNoDuplicateProducts(request.Items.Select(item => item.ProductId), "sale");

        var items = request.Items.ToList();
        var productIds = items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await LoadProductsForUnitsAsync(productIds, ct);
        EnsureAllProductsExist(productIds, products);
        var salesSettings = await context.CompanySettings.AsNoTracking()
            .Select(x => new SalesPolicySettings(
                x.GeneralSalesDiscountPercent,
                x.MaximumCustomerDebt,
                x.DefaultDebtDueDays,
                x.AllowNegativeStockSales))
            .SingleOrDefaultAsync(ct)
            ?? new SalesPolicySettings(0, 300000, 30, true);
        var expiredAvailableByProduct = await InventoryAvailability.LoadExpiredAvailableByProductAsync(
            context,
            productIds,
            ct);

        var normalizedItems = items.Select(item =>
        {
            var product = products[item.ProductId];
            var selectedUnit = ResolveOperationUnit(product, item.UnitId);
            var baseQuantity = decimal.Round((item.Quantity + item.BonusQuantity) * selectedUnit.ConversionFactor, 3, MidpointRounding.AwayFromZero);
            var baseUnitPrice = decimal.Round(item.UnitPrice / selectedUnit.ConversionFactor, 4, MidpointRounding.AwayFromZero);
            if (baseQuantity <= 0)
                throw new ArgumentException($"The quantity for '{product.Name}' is too small for base-unit precision.");
            var availableBaseQuantity = product.UsesDisplayStock
                ? Math.Max(0, product.DisplayStockQuantity ?? 0)
                : product.Inventory is null
                    ? 0
                    : InventoryAvailability.SellableBalance(
                        product.Inventory.Quantity,
                        product.Inventory.ReservedQuantity,
                        expiredAvailableByProduct.GetValueOrDefault(product.Id));
            if (!salesSettings.AllowNegativeStockSales)
                ValidateSaleQuantity(product, baseQuantity, selectedUnit, availableBaseQuantity);
            return new NormalizedSaleLine(item, product, selectedUnit, baseQuantity, baseUnitPrice, availableBaseQuantity);
        }).ToList();

        // Display-stock products do not mutate inventory, but an existing base-unit
        // purchase cost is still snapshotted so profit reports remain accurate.
        var productCosts = await inventoryCosts.GetCurrentUnitCostsAsync(productIds, ct);

        string? registeredCustomerName = null;
        string? registeredCustomerPhone = null;
        API.Entities.Customers.Customer? registeredCustomer = null;
        if (request.CustomerId.HasValue)
        {
            registeredCustomer = await context.Customers
                .Where(x => x.Id == request.CustomerId &&
                    (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value))
                .SingleOrDefaultAsync(ct);
            if (registeredCustomer is null) throw new ArgumentException("Customer not found.");
            registeredCustomerName = (registeredCustomer.FirstName + " " + (registeredCustomer.LastName ?? "")).Trim();
            registeredCustomerPhone = registeredCustomer.Phone;
        }

        var subtotal = decimal.Round(
            normalizedItems.Sum(line => line.Request.Quantity * line.Request.UnitPrice),
            2,
            MidpointRounding.AwayFromZero);
        var linesNet = normalizedItems.Sum(line => PercentageNet(
            line.Request.Quantity * line.Request.UnitPrice,
            line.Request.DiscountPercent));
        var primaryDiscountPercent = request.DiscountPercent > 0
            ? request.DiscountPercent
            : salesSettings.GeneralSalesDiscountPercent;
        var documentNet = StackedNet(linesNet, primaryDiscountPercent, request.SecondaryDiscountPercent);
        var effectiveDiscount = Math.Min(subtotal, subtotal - documentNet + request.Discount);
        var total = decimal.Round(
            Math.Max(0, subtotal - effectiveDiscount + request.Tax),
            2,
            MidpointRounding.AwayFromZero);
        if (request.PaidAmount < 0)
            throw new ArgumentException("Paid amount cannot be negative.");
        if (registeredCustomer is null && request.PaidAmount > total)
            throw new ArgumentException("Only a registered customer can keep an overpayment as account credit.");
        var saleDate = request.SaleDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.SaleDate;
        var customerCreditApplied = registeredCustomer is not null && request.UseCustomerCredit
            ? Math.Min(registeredCustomer.AccountCredit, Math.Max(0, total - request.PaidAmount))
            : 0;
        var customerCreditCreated = registeredCustomer is not null
            ? Math.Max(0, request.PaidAmount - total)
            : 0;
        var effectivePaidAmount = request.PaidAmount + customerCreditApplied;
        var remainingDebt = Math.Max(0, total - effectivePaidAmount);
        if (registeredCustomer is not null)
        {
            var existingDebt = await context.InventorySales.AsNoTracking()
                .Where(x => x.CustomerId == registeredCustomer.Id && x.Total > x.PaidAmount)
                .SumAsync(x => (decimal?)(x.Total - x.PaidAmount), ct) ?? 0;
            var debtLimit = registeredCustomer.CreditLimit ?? salesSettings.MaximumCustomerDebt;
            if (existingDebt + remainingDebt > debtLimit)
                throw new InvalidOperationException(
                    $"This sale would raise the customer's debt to {existingDebt + remainingDebt:0.00}, above the allowed limit of {debtLimit:0.00}.");
            registeredCustomer.AccountCredit = Math.Max(
                0,
                registeredCustomer.AccountCredit - customerCreditApplied + customerCreditCreated);
        }
        var currencyCode = await GetCurrencyCodeAsync(ct);
        await using var tx = await context.Database.BeginTransactionAsync(ct);
        var sale = new InventorySale
        {
            SaleNumber = await NextDocumentNumberAsync(isPurchase: false, ct),
            CustomerId = request.CustomerId,
            CustomerName = registeredCustomerName ?? Clean(request.CustomerName),
            CustomerPhone = registeredCustomerPhone ?? Clean(request.CustomerPhone),
            SaleDate = saleDate,
            PaymentMethod = PaymentMethod(request.PaymentMethod),
            Subtotal = subtotal,
            Discount = effectiveDiscount,
            DiscountPercent = primaryDiscountPercent,
            SecondaryDiscountPercent = request.SecondaryDiscountPercent,
            Tax = request.Tax,
            Total = total,
            PaidAmount = effectivePaidAmount,
            CurrencyCode = currencyCode,
            PaymentStatus = PaymentStatus(effectivePaidAmount, total),
            ReferenceNumber = Clean(request.ReferenceNumber),
            ClientRequestId = clientRequestId,
            Notes = Clean(request.Notes),
            DebtDueDate = remainingDebt > 0
                ? request.DebtDueDate ?? saleDate.AddDays(registeredCustomer?.DebtDueDays ?? salesSettings.DefaultDebtDueDays)
                : null,
            CustomerCreditApplied = customerCreditApplied,
            CustomerCreditCreated = customerCreditCreated,
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
                LineTotal = PercentageNet(
                    line.Request.Quantity * line.Request.UnitPrice,
                    line.Request.DiscountPercent),
                BonusQuantity = line.Request.BonusQuantity,
                DiscountPercent = line.Request.DiscountPercent,
                SecondaryDiscountPercent = 0
            });

        if (request.PaidAmount > 0)
            sale.Payments.Add(NewSalePayment(request.PaidAmount, saleDate, request.PaymentMethod, request.PaymentReferenceNumber, "Initial sale payment", userId));
        if (customerCreditApplied > 0)
            sale.Payments.Add(NewSalePayment(customerCreditApplied, saleDate, "Account credit", null, "Applied customer account credit", userId));

        context.InventorySales.Add(sale);
        await context.SaveChangesAsync(ct);
        var accountingCustomerName = registeredCustomerName ?? request.CustomerName ?? "Walk-in customer";
        await accounting.PostManualSaleAsync(sale, accountingCustomerName, userId, ct);
        var accountingReceivable = sale.Total;
        foreach (var payment in sale.Payments.OrderBy(item => item.Id))
        {
            await accounting.PostSalePaymentAsync(sale, payment, accountingReceivable, accountingCustomerName, userId, ct);
            accountingReceivable = Math.Max(0, accountingReceivable - payment.Amount);
        }
        await context.SaveChangesAsync(ct);
        foreach (var line in normalizedItems)
        {
            if (line.Product.UsesDisplayStock)
                continue;

            var allocationQuantity = salesSettings.AllowNegativeStockSales
                ? Math.Min(line.BaseQuantity, Math.Max(0, line.AvailableBaseQuantity))
                : line.BaseQuantity;
            IReadOnlyList<InventoryLotAllocation> allocations = allocationQuantity > 0
                ? await lotAllocator.ConsumeFefoAsync(line.Request.ProductId, allocationQuantity, ct)
                : [];
            await ApplyStockMovement(
                line.Request.ProductId,
                -line.BaseQuantity,
                InventoryTransactionType.Sale,
                "ManualSale",
                sale.Id,
                sale.SaleNumber,
                userId,
                null,
                allocations,
                salesSettings.AllowNegativeStockSales,
                ct);
        }
        await context.SaveChangesAsync(ct);
        foreach (var productId in normalizedItems
            .Where(line => !line.Product.UsesDisplayStock)
            .Select(line => line.Request.ProductId)
            .Distinct())
            await RefreshInventoryExpiryAsync(productId, ct);
        await context.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return MapSale(sale, registeredCustomerName ?? request.CustomerName ?? "Walk-in customer");
    }

    public async Task<InventorySaleListItem> UpdateSaleAsync(
        long id,
        UpdateInventorySaleRequest request,
        string? userId,
        CancellationToken ct)
    {
        if (request.SaleDate == default)
            throw new ArgumentException("Sale date is required.");

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var sale = await context.InventorySales
            .Include(item => item.Customer)
            .Include(item => item.Items)
            .Include(item => item.Payments)
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Sale not found.");

        if (sale.CustomerId is null)
        {
            sale.CustomerName = Clean(request.CustomerName) ?? "Walk-in customer";
            sale.CustomerPhone = Clean(request.CustomerPhone);
        }
        sale.SaleDate = request.SaleDate;
        sale.ReferenceNumber = Clean(request.ReferenceNumber);
        sale.Notes = Clean(request.Notes);

        var customerName = sale.Customer is null
            ? sale.CustomerName ?? "Walk-in customer"
            : (sale.Customer.FirstName + " " + (sale.Customer.LastName ?? "")).Trim();
        var paymentIds = sale.Payments.Select(item => item.Id).ToArray();
        var vouchers = await context.JournalVouchers
            .Where(item =>
                (item.SourceType == "ManualSale" && item.SourceId == sale.Id) ||
                (item.SourceType == "SalePayment" && item.SourceId.HasValue && paymentIds.Contains(item.SourceId.Value)))
            .ToListAsync(ct);
        foreach (var voucher in vouchers)
        {
            voucher.CounterpartyId = sale.CustomerId;
            voucher.CounterpartyName = customerName;
            if (voucher.SourceType == "ManualSale")
            {
                voucher.VoucherDate = request.SaleDate;
                voucher.ReferenceNumber = sale.ReferenceNumber;
            }
            voucher.PostedByUserId ??= userId;
        }

        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapSale(sale, customerName);
    }

    public async Task DeleteSaleAsync(long id, string? userId, CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var sale = await context.InventorySales
            .Include(item => item.Customer)
            .Include(item => item.Payments)
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Sale not found.");

        if (sale.Customer is not null)
        {
            var restoredCredit = sale.Customer.AccountCredit +
                sale.CustomerCreditApplied -
                sale.CustomerCreditCreated;
            if (restoredCredit < -0.005m)
            {
                throw new InvalidOperationException(
                    "This sale cannot be deleted because customer credit created by it has already been used.");
            }
            sale.Customer.AccountCredit = Math.Max(0, restoredCredit);
        }

        var movements = await context.InventoryTransactions
            .Include(item => item.Lots)
                .ThenInclude(item => item.InventoryLot)
            .Where(item =>
                item.ReferenceType == "ManualSale" &&
                item.ReferenceId == sale.Id &&
                item.Type == InventoryTransactionType.Sale)
            .OrderBy(item => item.Id)
            .ToListAsync(ct);
        foreach (var movement in movements)
        {
            if (movement.Quantity >= 0) continue;
            var allocations = new List<InventoryLotAllocation>();
            foreach (var detail in movement.Lots.Where(item => item.QuantityDelta < 0))
            {
                var lot = detail.InventoryLot
                    ?? throw new InvalidOperationException(
                        "This sale cannot be deleted because its inventory lot is no longer available.");
                var quantity = Math.Abs(detail.QuantityDelta);
                lot.Quantity += quantity;
                allocations.Add(new InventoryLotAllocation(lot, quantity));
            }

            await ApplyStockMovement(
                movement.ProductId,
                Math.Abs(movement.Quantity),
                InventoryTransactionType.StockAdjustment,
                "SaleDeletion",
                sale.Id,
                sale.SaleNumber,
                userId,
                null,
                allocations,
                false,
                ct);
        }

        await ReverseOperationalVouchersAsync(
            "ManualSale",
            sale.Id,
            "SalePayment",
            sale.Payments.Select(item => item.Id).ToArray(),
            $"Manual sale {sale.SaleNumber} deleted",
            userId,
            ct);
        sale.IsDeleted = true;
        sale.DeletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        foreach (var productId in movements.Select(item => item.ProductId).Distinct())
            await RefreshInventoryExpiryAsync(productId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetSalePaymentsAsync(long saleId, CancellationToken ct) =>
        await context.InventorySalePayments.AsNoTracking().Where(x => x.InventorySaleId == saleId && (!branchContext.BranchId.HasValue || x.InventorySale.BranchId == branchContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapSalePayment()).ToListAsync(ct);

    public async Task<InventorySaleListItem> AddSalePaymentAsync(long saleId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var sale = await context.InventorySales
            .FromSqlInterpolated($"SELECT * FROM [InventorySales] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {saleId}")
            .Include(x => x.Customer)
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Sale not found.");
        var remaining = Math.Max(0, sale.Total - sale.PaidAmount);
        var creditCreated = Math.Max(0, request.Amount - remaining);
        if (creditCreated > 0 && sale.Customer is null)
            throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00} for a walk-in customer.");
        var payment = NewSalePayment(request.Amount, PaymentDate(request.PaymentDate), request.PaymentMethod, request.ReferenceNumber, request.Notes, userId);
        sale.Payments.Add(payment);
        sale.PaidAmount += request.Amount;
        if (sale.Customer is not null && creditCreated > 0)
        {
            sale.Customer.AccountCredit += creditCreated;
            sale.CustomerCreditCreated += creditCreated;
        }
        sale.PaymentStatus = PaymentStatus(sale.PaidAmount, sale.Total);
        sale.PaymentMethod = PaymentMethod(request.PaymentMethod);
        await context.SaveChangesAsync(ct);
        var customerName = sale.Customer is null
            ? sale.CustomerName ?? "Walk-in customer"
            : (sale.Customer.FirstName + " " + (sale.Customer.LastName ?? "")).Trim();
        await accounting.PostSalePaymentAsync(sale, payment, remaining, customerName, userId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapSale(sale, customerName);
    }

    public async Task<IReadOnlyList<StaffResponse>> GetStaffAsync(CancellationToken ct) =>
        await context.StaffMembers.AsNoTracking().Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value).OrderByDescending(x => x.IsActive).ThenBy(x => x.FullName)
            .Select(x => new StaffResponse(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes, x.Email != null && context.Users.Any(user => user.Email == x.Email))).ToListAsync(ct);

    public async Task<PagedResult<StaffResponse>> GetStaffPageAsync(string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.StaffMembers.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(x => x.FullName.Contains(clean) || x.EmployeeNumber.Contains(clean) || (x.Phone != null && x.Phone.Contains(clean)) || (x.Department != null && x.Department.Contains(clean)) || (x.Position != null && x.Position.Contains(clean)));

        var totalCount = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.IsActive).ThenBy(x => x.FullName)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new StaffResponse(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes, x.Email != null && context.Users.Any(user => user.Email == x.Email)))
            .ToListAsync(ct);
        return new PagedResult<StaffResponse> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<StaffResponse> SaveStaffAsync(long? id, StaffUpsertRequest request, CancellationToken ct)
    {
        RequireText(request.EmployeeNumber, "Employee number");
        RequireText(request.FullName, "Staff name");
        if (request.BaseSalary < 0) throw new ArgumentException("Base salary cannot be negative.");
        if (await context.StaffMembers.AnyAsync(x =>
            x.EmployeeNumber == request.EmployeeNumber.Trim() &&
            (!id.HasValue || x.Id != id) &&
            (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value), ct))
            throw new ArgumentException("Employee number already exists.");
        Staff entity;
        if (id.HasValue)
            entity = await context.StaffMembers.SingleOrDefaultAsync(
                x => x.Id == id && (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value),
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
        return MapStaff(entity, entity.Email is not null && await context.Users.AnyAsync(user => user.Email == entity.Email, ct));
    }

    public async Task DeleteStaffAsync(long id, CancellationToken ct)
    {
        var entity = await context.StaffMembers.SingleOrDefaultAsync(
            x => x.Id == id && (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value),
            ct) ?? throw new KeyNotFoundException("Staff member not found.");
        entity.IsActive = false;
        await context.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<SalaryPaymentResponse>> GetSalaryPaymentsAsync(int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.StaffSalaryPayments.AsNoTracking().Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var totalCount = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.PeriodYear).ThenByDescending(x => x.PeriodMonth).ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new SalaryPaymentResponse(x.Id, x.StaffId, x.Staff.FullName, x.PeriodYear, x.PeriodMonth, x.BaseSalary, x.Bonus, x.Deduction, x.NetAmount, x.PaidAmount, x.NetAmount > x.PaidAmount ? x.NetAmount - x.PaidAmount : 0, x.PaymentStatus, x.PaidDate, x.PaymentMethod, x.ReferenceNumber, x.CreatedAt))
            .ToListAsync(ct);
        return new PagedResult<SalaryPaymentResponse> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<SalaryPaymentResponse> CreateSalaryPaymentAsync(CreateSalaryPaymentRequest request, string? userId, CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        if (request.PeriodMonth is < 1 or > 12 || request.PeriodYear < 2000) throw new ArgumentException("A valid salary period is required.");
        if (request.Bonus < 0 || request.Deduction < 0) throw new ArgumentException("Bonus and deduction cannot be negative.");
        var staff = await context.StaffMembers.SingleOrDefaultAsync(
            x => x.Id == request.StaffId && x.IsActive &&
                (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value),
            ct) ?? throw new ArgumentException("Active staff member not found.");
        if (await context.StaffSalaryPayments.AnyAsync(x =>
            x.StaffId == request.StaffId &&
            x.PeriodYear == request.PeriodYear &&
            x.PeriodMonth == request.PeriodMonth &&
            (!branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value), ct))
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
        await accounting.PostPayrollAccrualAsync(entity, staff.FullName, userId, ct);
        foreach (var payment in entity.Installments.OrderBy(item => item.Id))
            await accounting.PostPayrollPaymentAsync(entity, payment, staff.FullName, userId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return MapSalary(entity, staff.FullName);
    }

    public async Task<IReadOnlyList<DocumentPaymentResponse>> GetSalaryInstallmentsAsync(long salaryId, CancellationToken ct) =>
        await context.StaffSalaryInstallments.AsNoTracking().Where(x => x.StaffSalaryPaymentId == salaryId && (!branchContext.BranchId.HasValue || x.StaffSalaryPayment.BranchId == branchContext.BranchId.Value)).OrderByDescending(x => x.PaymentDate).ThenByDescending(x => x.Id).Select(MapSalaryPayment()).ToListAsync(ct);

    public async Task<SalaryPaymentResponse> AddSalaryInstallmentAsync(long salaryId, RecordDocumentPaymentRequest request, string? userId, CancellationToken ct)
    {
        ValidatePaymentRequest(request);
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var salary = await context.StaffSalaryPayments
            .FromSqlInterpolated($"SELECT * FROM [StaffSalaryPayments] WITH (UPDLOCK, ROWLOCK) WHERE [Id] = {salaryId}")
            .Include(x => x.Staff)
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value)
            .SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Salary record not found.");
        var remaining = Math.Max(0, salary.NetAmount - salary.PaidAmount);
        if (request.Amount > remaining) throw new ArgumentException($"Payment cannot exceed the remaining balance of {remaining:0.00}.");
        var date = PaymentDate(request.PaymentDate);
        var payment = NewSalaryInstallment(request.Amount, date, request.PaymentMethod, request.ReferenceNumber, request.Notes, userId);
        salary.Installments.Add(payment);
        salary.PaidAmount += request.Amount;
        salary.PaymentStatus = PaymentStatus(salary.PaidAmount, salary.NetAmount);
        salary.PaidDate = date;
        salary.PaymentMethod = PaymentMethod(request.PaymentMethod);
        salary.ReferenceNumber = Clean(request.ReferenceNumber) ?? salary.ReferenceNumber;
        await context.SaveChangesAsync(ct);
        await accounting.PostPayrollPaymentAsync(salary, payment, salary.Staff.FullName, userId, ct);
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

    public async Task<PagedResult<ExpenseResponse>> GetExpensesAsync(int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.Expenses.AsNoTracking().Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var totalCount = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.ExpenseDate).ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new ExpenseResponse(x.Id, x.ExpenseDate, x.GeneralTypeCategoryId ?? x.CategoryId ?? 0, x.GeneralTypeCategory != null ? x.GeneralTypeCategory.Name : (x.Category != null ? x.Category.Name : "Uncategorized"), x.Amount, x.Vendor, x.PaymentMethod, x.ReferenceNumber, x.Description, x.CreatedAt))
            .ToListAsync(ct);
        return new PagedResult<ExpenseResponse> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<ExpenseResponse> CreateExpenseAsync(CreateExpenseRequest request, string? userId, CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
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
        await accounting.PostExpenseAsync(entity, category.Name, userId, ct);
        await context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new ExpenseResponse(entity.Id, entity.ExpenseDate, category.Id, category.Name, entity.Amount, entity.Vendor, entity.PaymentMethod, entity.ReferenceNumber, entity.Description, entity.CreatedAt);
    }

    public async Task<PagedResult<JournalVoucherResponse>> GetJournalVouchersAsync(
        string? search,
        JournalVoucherType? type,
        JournalVoucherStatus? status,
        bool? systemGenerated,
        DateOnly? startDate,
        DateOnly? endDate,
        string? currencyCode,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = context.JournalVouchers.AsNoTracking()
            .Where(x => !branchContext.BranchId.HasValue || x.BranchId == branchContext.BranchId.Value);
        var clean = Clean(search);
        if (clean is not null)
            query = query.Where(item =>
                item.VoucherNumber.Contains(clean) ||
                item.Memo.Contains(clean) ||
                (item.ReferenceNumber != null && item.ReferenceNumber.Contains(clean)) ||
                (item.SourceNumber != null && item.SourceNumber.Contains(clean)) ||
                (item.CounterpartyName != null && item.CounterpartyName.Contains(clean)));
        if (type.HasValue) query = query.Where(item => item.VoucherType == type.Value);
        if (status.HasValue) query = query.Where(item => item.Status == status.Value);
        if (systemGenerated.HasValue) query = query.Where(item => item.IsSystemGenerated == systemGenerated.Value);
        if (startDate.HasValue) query = query.Where(item => item.VoucherDate >= startDate.Value);
        if (endDate.HasValue) query = query.Where(item => item.VoucherDate <= endDate.Value);
        var cleanCurrency = CleanCurrency(currencyCode);
        if (cleanCurrency is not null) query = query.Where(item => item.CurrencyCode == cleanCurrency);
        var totalCount = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.VoucherDate).ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new JournalVoucherResponse(
                x.Id,
                x.VoucherNumber,
                x.VoucherDate,
                x.CurrencyCode,
                x.VoucherType,
                x.Status,
                x.IsSystemGenerated,
                x.ReferenceNumber,
                x.SourceType,
                x.SourceId,
                x.SourceNumber,
                x.CounterpartyType,
                x.CounterpartyId,
                x.CounterpartyName,
                x.Memo,
                x.TotalDebit,
                x.TotalCredit,
                context.Users.Where(user => user.Id == (x.CreatedByUserId ?? x.PostedByUserId)).Select(user => user.FullName).FirstOrDefault(),
                x.PostedAt,
                x.ReversedAt,
                x.ReversalReason,
                x.ReversalOfVoucherId,
                x.Reversals.Select(reversal => (long?)reversal.Id).FirstOrDefault(),
                x.CreatedAt,
                x.Lines.OrderBy(line => line.Id).Select(line => new JournalVoucherLineResponse(line.Id, line.AccountCode, line.AccountName, line.Description, line.Debit, line.Credit)).ToList()))
            .ToListAsync(ct);
        return new PagedResult<JournalVoucherResponse> { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
    }

    public async Task<JournalVoucherSummaryResponse> GetJournalVoucherSummaryAsync(CancellationToken ct)
    {
        var currencyCode = await GetCurrencyCodeAsync(ct);
        var query = context.JournalVouchers.AsNoTracking()
            .Where(item => !branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value);
        var summary = await query
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Count(),
                System = group.Count(item => item.IsSystemGenerated),
                Manual = group.Count(item => !item.IsSystemGenerated && item.VoucherType != JournalVoucherType.Reversal),
                Reversed = group.Count(item => item.Status == JournalVoucherStatus.Reversed),
                Debits = group.Where(item =>
                    item.Status == JournalVoucherStatus.Posted && item.CurrencyCode == currencyCode).Sum(item => item.TotalDebit),
                LastDate = group.Max(item => (DateOnly?)item.VoucherDate)
            })
            .SingleOrDefaultAsync(ct);
        return summary is null
            ? new JournalVoucherSummaryResponse(0, 0, 0, 0, 0, currencyCode, null)
            : new JournalVoucherSummaryResponse(summary.Total, summary.System, summary.Manual, summary.Reversed, summary.Debits, currencyCode, summary.LastDate);
    }

    public async Task<IReadOnlyList<JournalAccountBalanceResponse>> GetJournalAccountBalancesAsync(CancellationToken ct)
    {
        var query = context.JournalVoucherLines.AsNoTracking()
            .Where(line => !branchContext.BranchId.HasValue ||
                line.JournalVoucher.BranchId == branchContext.BranchId.Value);
        var balances = await query
            .GroupBy(line => new { line.AccountCode, line.AccountName, line.JournalVoucher.CurrencyCode })
            .Select(group => new
            {
                group.Key.AccountCode,
                group.Key.AccountName,
                group.Key.CurrencyCode,
                TotalDebit = group.Sum(line => line.Debit),
                TotalCredit = group.Sum(line => line.Credit),
                EntryCount = group.Count()
            })
            .OrderBy(item => item.AccountCode)
            .ToListAsync(ct);

        return balances
            .GroupBy(item => new { item.AccountCode, item.CurrencyCode })
            .Select(group =>
            {
                var totalDebit = group.Sum(item => item.TotalDebit);
                var totalCredit = group.Sum(item => item.TotalCredit);
                return new JournalAccountBalanceResponse(
                    group.Key.AccountCode,
                    group.First().AccountName,
                    group.Key.CurrencyCode,
                    totalDebit,
                    totalCredit,
                    totalDebit - totalCredit,
                    group.Sum(item => item.EntryCount));
            })
            .OrderBy(item => item.AccountCode)
            .ThenBy(item => item.CurrencyCode)
            .ToArray();
    }

    public async Task<JournalAccountLedgerResponse> GetJournalAccountLedgerAsync(
        string accountCode,
        DateOnly? startDate,
        DateOnly? endDate,
        string? currencyCode,
        CancellationToken ct)
    {
        var cleanCode = Clean(accountCode) ?? throw new ArgumentException("Select a ledger account.");
        var currency = CleanCurrency(currencyCode) ?? await GetCurrencyCodeAsync(ct);
        var effectiveEnd = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveStart = startDate ?? new DateOnly(effectiveEnd.Year, 1, 1);
        if (effectiveStart > effectiveEnd) throw new ArgumentException("The ledger start date must be on or before the end date.");

        var baseQuery = context.JournalVoucherLines.AsNoTracking()
            .Where(line => line.AccountCode == cleanCode &&
                line.JournalVoucher.CurrencyCode == currency &&
                (!branchContext.BranchId.HasValue || line.JournalVoucher.BranchId == branchContext.BranchId.Value));
        var accountName = await baseQuery
            .OrderByDescending(line => line.JournalVoucher.VoucherDate)
            .ThenByDescending(line => line.Id)
            .Select(line => line.AccountName)
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException($"Account {cleanCode} was not found in the {currency} ledger.");
        var openingBalance = await baseQuery
            .Where(line => line.JournalVoucher.VoucherDate < effectiveStart)
            .SumAsync(line => line.Debit - line.Credit, ct);
        var periodLines = await baseQuery
            .Where(line => line.JournalVoucher.VoucherDate >= effectiveStart && line.JournalVoucher.VoucherDate <= effectiveEnd)
            .OrderBy(line => line.JournalVoucher.VoucherDate)
            .ThenBy(line => line.JournalVoucher.Id)
            .ThenBy(line => line.Id)
            .Select(line => new
            {
                VoucherId = line.JournalVoucherId,
                line.JournalVoucher.VoucherNumber,
                line.JournalVoucher.VoucherDate,
                line.JournalVoucher.VoucherType,
                line.JournalVoucher.Memo,
                line.JournalVoucher.ReferenceNumber,
                line.JournalVoucher.CounterpartyName,
                line.Debit,
                line.Credit,
                line.JournalVoucher.Status,
                IsReversal = line.JournalVoucher.VoucherType == JournalVoucherType.Reversal
            })
            .ToListAsync(ct);

        var balance = openingBalance;
        var entries = periodLines.Select(line =>
        {
            balance += line.Debit - line.Credit;
            return new JournalAccountLedgerEntryResponse(
                line.VoucherId,
                line.VoucherNumber,
                line.VoucherDate,
                line.VoucherType,
                line.Memo,
                line.ReferenceNumber,
                line.CounterpartyName,
                line.Debit,
                line.Credit,
                balance,
                line.Status,
                line.IsReversal);
        }).ToList();

        return new JournalAccountLedgerResponse(
            cleanCode,
            accountName,
            currency,
            effectiveStart,
            effectiveEnd,
            openingBalance,
            periodLines.Sum(line => line.Debit),
            periodLines.Sum(line => line.Credit),
            balance,
            entries);
    }

    public async Task<JournalVoucherResponse> CreateJournalVoucherAsync(CreateJournalVoucherRequest request, string? userId, CancellationToken ct)
    {
        RequireText(request.Memo, "Voucher memo");
        if (request.VoucherType is not (
                JournalVoucherType.ManualAdjustment or
                JournalVoucherType.OpeningBalance or
                JournalVoucherType.FundsTransfer or
                JournalVoucherType.OwnerEquity))
            throw new ArgumentException("Manual vouchers can be adjustments, opening balances, funds transfers, or owner-equity entries. Operational vouchers are generated from their source workflow.");
        if (request.Lines.Count is < 2 or > 200)
            throw new ArgumentException("A journal voucher requires between 2 and 200 account lines.");

        foreach (var (line, index) in request.Lines.Select((line, index) => (line, index)))
        {
            RequireText(line.AccountCode, $"Account code on line {index + 1}");
            RequireText(line.AccountName, $"Account name on line {index + 1}");
            if (line.Debit < 0 || line.Credit < 0 || (line.Debit > 0) == (line.Credit > 0))
                throw new ArgumentException($"Line {index + 1} must contain either a positive debit or a positive credit, not both.");
        }

        var inconsistentAccount = request.Lines
            .GroupBy(line => line.AccountCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group
                .Select(line => line.AccountName.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Skip(1)
                .Any());
        if (inconsistentAccount is not null)
            throw new ArgumentException(
                $"Account {inconsistentAccount.Key} has more than one name in this voucher. Use one consistent chart-of-accounts name.");

        var requestedAccounts = request.Lines
            .GroupBy(line => line.AccountCode.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.First().AccountName.Trim(),
                StringComparer.OrdinalIgnoreCase);
        var requestedCodes = requestedAccounts.Keys.ToArray();
        var savedAccounts = await context.JournalVoucherLines.AsNoTracking()
            .Where(line => requestedCodes.Contains(line.AccountCode))
            .Select(line => new { line.AccountCode, line.AccountName })
            .Distinct()
            .ToListAsync(ct);
        var savedConflict = savedAccounts.FirstOrDefault(saved =>
            requestedAccounts.TryGetValue(saved.AccountCode, out var requestedName) &&
            !saved.AccountName.Equals(requestedName, StringComparison.OrdinalIgnoreCase));
        if (savedConflict is not null)
            throw new ArgumentException(
                $"Account {savedConflict.AccountCode} is already named '{savedConflict.AccountName}'. Use the existing chart-of-accounts name.");

        var debit = decimal.Round(request.Lines.Sum(line => line.Debit), 2, MidpointRounding.AwayFromZero);
        var credit = decimal.Round(request.Lines.Sum(line => line.Credit), 2, MidpointRounding.AwayFromZero);
        if (debit <= 0 || Math.Abs(debit - credit) > 0.009m)
            throw new ArgumentException($"The voucher is not balanced. Debit is {debit:N2} and credit is {credit:N2}.");

        var voucherNumber = DocumentNumber(request.VoucherType switch
        {
            JournalVoucherType.OpeningBalance => "OBV",
            JournalVoucherType.FundsTransfer => "TRV",
            JournalVoucherType.OwnerEquity => "EQV",
            _ => "JV"
        });
        var now = DateTime.UtcNow;

        var entity = new JournalVoucher
        {
            VoucherNumber = voucherNumber,
            VoucherDate = request.VoucherDate == default ? DateOnly.FromDateTime(DateTime.UtcNow) : request.VoucherDate,
            CurrencyCode = CleanCurrency(request.CurrencyCode) ?? await GetCurrencyCodeAsync(ct),
            VoucherType = request.VoucherType,
            Status = JournalVoucherStatus.Posted,
            IsSystemGenerated = false,
            ReferenceNumber = Clean(request.ReferenceNumber),
            Memo = request.Memo.Trim(),
            TotalDebit = debit,
            TotalCredit = credit,
            CreatedByUserId = userId,
            PostedByUserId = userId,
            PostedAt = now,
            Lines = request.Lines.Select(line => new JournalVoucherLine
            {
                AccountCode = line.AccountCode.Trim(),
                AccountName = line.AccountName.Trim(),
                Description = Clean(line.Description),
                Debit = decimal.Round(line.Debit, 2, MidpointRounding.AwayFromZero),
                Credit = decimal.Round(line.Credit, 2, MidpointRounding.AwayFromZero)
            }).ToList()
        };
        context.JournalVouchers.Add(entity);
        await context.SaveChangesAsync(ct);
        return await GetJournalVoucherByIdAsync(entity.Id, ct);
    }

    public async Task<JournalVoucherResponse> ReverseJournalVoucherAsync(long id, string reason, string? userId, CancellationToken ct)
    {
        var reversal = await accounting.ReverseManualVoucherAsync(id, reason, userId, ct);
        return await GetJournalVoucherByIdAsync(reversal.Id, ct);
    }

    public Task<JournalVoucherResponse> GetJournalVoucherAsync(long id, CancellationToken ct) =>
        GetJournalVoucherByIdAsync(id, ct);

    public async Task<JournalVoucherSyncResponse> SyncJournalVouchersAsync(string? userId, CancellationToken ct)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        var created = await accounting.SyncOperationalVouchersAsync(userId, ct);
        await transaction.CommitAsync(ct);
        return new JournalVoucherSyncResponse(created);
    }

    private async Task<JournalVoucherResponse> GetJournalVoucherByIdAsync(long id, CancellationToken ct) =>
        await context.JournalVouchers.AsNoTracking()
            .Where(item => item.Id == id &&
                (!branchContext.BranchId.HasValue || item.BranchId == branchContext.BranchId.Value))
            .Select(x => new JournalVoucherResponse(
                x.Id,
                x.VoucherNumber,
                x.VoucherDate,
                x.CurrencyCode,
                x.VoucherType,
                x.Status,
                x.IsSystemGenerated,
                x.ReferenceNumber,
                x.SourceType,
                x.SourceId,
                x.SourceNumber,
                x.CounterpartyType,
                x.CounterpartyId,
                x.CounterpartyName,
                x.Memo,
                x.TotalDebit,
                x.TotalCredit,
                context.Users.Where(user => user.Id == (x.CreatedByUserId ?? x.PostedByUserId)).Select(user => user.FullName).FirstOrDefault(),
                x.PostedAt,
                x.ReversedAt,
                x.ReversalReason,
                x.ReversalOfVoucherId,
                x.Reversals.Select(reversal => (long?)reversal.Id).FirstOrDefault(),
                x.CreatedAt,
                x.Lines.OrderBy(line => line.Id).Select(line => new JournalVoucherLineResponse(line.Id, line.AccountCode, line.AccountName, line.Description, line.Debit, line.Credit)).ToList()))
            .SingleAsync(ct);


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
                basePrice.HasValue ? basePrice.Value * unit.ConversionFactor : null,
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

    private static void ValidateSaleQuantity(
        Product product,
        decimal baseQuantity,
        SelectedOperationUnit selectedUnit,
        decimal availableBaseQuantity)
    {
        if (baseQuantity > availableBaseQuantity)
        {
            var availableSelectedQuantity = Math.Max(0, availableBaseQuantity) / selectedUnit.ConversionFactor;
            throw new ArgumentException(
                $"Only {availableSelectedQuantity:N3} unexpired {selectedUnit.UnitName} of '{product.Name}' are available. Expired stock cannot be sold.");
        }
    }

    private sealed record SelectedOperationUnit(long? UnitId, string UnitName, decimal ConversionFactor);
    private sealed record NormalizedPurchaseLine(PurchaseItemRequest Request, Product Product, SelectedOperationUnit Unit, decimal BaseQuantity, decimal BaseUnitCost);
    private sealed record NormalizedSaleLine(InventorySaleItemRequest Request, Product Product, SelectedOperationUnit Unit, decimal BaseQuantity, decimal BaseUnitPrice, decimal AvailableBaseQuantity);
    private sealed record SalesPolicySettings(decimal GeneralSalesDiscountPercent, decimal MaximumCustomerDebt, int DefaultDebtDueDays, bool AllowNegativeStockSales);


    private async Task<string> GetCurrencyCodeAsync(CancellationToken ct) =>
        await context.CompanySettings.AsNoTracking()
            .Select(item => item.MainCurrencyCode)
            .FirstOrDefaultAsync(ct) ?? "USD";

    private async Task<string> NextDocumentNumberAsync(bool isPurchase, CancellationToken ct)
    {
        var settings = await context.CompanySettings
            .FromSqlRaw("SELECT * FROM [CompanySettings] WITH (UPDLOCK, ROWLOCK)")
            .SingleOrDefaultAsync(ct);
        if (settings is null)
            return DocumentNumber(isPurchase ? "PUR" : "SAL");

        var prefix = isPurchase ? settings.PurchaseNumberPrefix : settings.SaleNumberPrefix;
        var number = isPurchase ? settings.NextPurchaseNumber : settings.NextSaleNumber;
        var increment = isPurchase ? settings.PurchaseNumberIncrement : settings.SaleNumberIncrement;
        number = Math.Max(1, number);
        increment = Math.Max(1, increment);

        if (isPurchase)
            settings.NextPurchaseNumber = checked(number + increment);
        else
            settings.NextSaleNumber = checked(number + increment);
        settings.UpdatedAt = DateTime.UtcNow;
        return $"{prefix.Trim().ToUpperInvariant()}-{number:D8}";
    }

    private async Task<InventoryLot> AddOrMergeInventoryLotAsync(
        long productId,
        long warehouseId,
        string lotNumber,
        DateOnly? expiresAt,
        decimal quantity,
        decimal unitCost,
        CancellationToken ct)
    {
        var lot = await context.InventoryLots.SingleOrDefaultAsync(item =>
            item.ProductId == productId &&
            item.WarehouseId == warehouseId &&
            item.LotNumber == lotNumber &&
            item.ExpiresAt == expiresAt,
            ct);

        if (lot is null)
        {
            lot = new InventoryLot
            {
                ProductId = productId,
                WarehouseId = warehouseId,
                LotNumber = lotNumber,
                Quantity = quantity,
                ReservedQuantity = 0,
                UnitCost = unitCost,
                ExpiresAt = expiresAt
            };
            context.InventoryLots.Add(lot);
            return lot;
        }

        var previousQuantity = lot.Quantity;
        var combinedQuantity = previousQuantity + quantity;
        var previousCost = lot.UnitCost ?? unitCost;
        lot.UnitCost = combinedQuantity <= 0
            ? unitCost
            : decimal.Round(
                ((previousQuantity * previousCost) + (quantity * unitCost)) / combinedQuantity,
                4,
                MidpointRounding.AwayFromZero);
        lot.Quantity = combinedQuantity;
        lot.UpdatedAt = DateTime.UtcNow;
        return lot;
    }

    private async Task RefreshInventoryExpiryAsync(long productId, CancellationToken ct)
    {
        var inventory = await context.ProductInventories.SingleOrDefaultAsync(
            item => item.ProductId == productId,
            ct);
        if (inventory is null) return;

        inventory.ExpireDate = await context.InventoryLots.AsNoTracking()
            .Where(item => item.ProductId == productId &&
                item.Quantity - item.ReservedQuantity > 0 &&
                item.ExpiresAt.HasValue)
            .MinAsync(item => item.ExpiresAt, ct);
    }

    private async Task ApplyStockMovement(
        long productId,
        decimal delta,
        InventoryTransactionType type,
        string referenceType,
        long referenceId,
        string documentNumber,
        string? userId,
        DateOnly? expireDate,
        IReadOnlyList<InventoryLotAllocation> allocations,
        bool allowNegative,
        CancellationToken ct)
    {
        var inventory = await context.ProductInventories.SingleOrDefaultAsync(x => x.ProductId == productId, ct);
        if (inventory is null)
        {
            if (delta < 0 && !allowNegative) throw new InvalidOperationException("This product has no stock available.");
            inventory = new ProductInventory { ProductId = productId, Quantity = 0, ReservedQuantity = 0, MinimumQuantity = 0 };
            context.ProductInventories.Add(inventory);
        }
        var beforeQuantity = inventory.Quantity;
        var beforeReserved = inventory.ReservedQuantity;
        if (!allowNegative && delta < 0 && inventory.Quantity - inventory.ReservedQuantity < -delta) throw new InvalidOperationException("Insufficient available stock for one or more sale items.");
        inventory.Quantity += delta;
        if (expireDate.HasValue && (!inventory.ExpireDate.HasValue || expireDate.Value < inventory.ExpireDate.Value)) inventory.ExpireDate = expireDate;
        var inventoryTransaction = new InventoryTransaction
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
        };
        foreach (var allocation in allocations)
        {
            inventoryTransaction.Lots.Add(new InventoryTransactionLot
            {
                InventoryLot = allocation.Lot,
                InventoryLotId = allocation.Lot.Id > 0 ? allocation.Lot.Id : null,
                LotNumber = allocation.Lot.LotNumber,
                WarehouseId = allocation.Lot.WarehouseId,
                WarehouseName = allocation.Lot.Warehouse?.Name ?? MainWarehouseCode,
                ExpiresAt = allocation.Lot.ExpiresAt,
                QuantityDelta = Math.Sign(delta) * allocation.Quantity,
                ReservedDelta = 0,
                UnitCost = allocation.Lot.UnitCost
            });
        }
        context.InventoryTransactions.Add(inventoryTransaction);
    }

    private async Task ReverseOperationalVouchersAsync(
        string documentSourceType,
        long documentSourceId,
        string paymentSourceType,
        long[] paymentSourceIds,
        string reason,
        string? userId,
        CancellationToken ct)
    {
        var vouchers = await context.JournalVouchers
            .Include(item => item.Lines)
            .Where(item =>
                item.Status == JournalVoucherStatus.Posted &&
                ((item.SourceType == documentSourceType && item.SourceId == documentSourceId) ||
                 (item.SourceType == paymentSourceType && item.SourceId.HasValue && paymentSourceIds.Contains(item.SourceId.Value))))
            .OrderBy(item => item.Id)
            .ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var voucher in vouchers)
        {
            voucher.Status = JournalVoucherStatus.Reversed;
            voucher.ReversedAt = now;
            voucher.ReversedByUserId = userId;
            voucher.ReversalReason = reason;
            context.JournalVouchers.Add(new JournalVoucher
            {
                VoucherNumber = ReversalVoucherNumber(),
                VoucherDate = DateOnly.FromDateTime(now),
                CurrencyCode = voucher.CurrencyCode,
                VoucherType = JournalVoucherType.Reversal,
                Status = JournalVoucherStatus.Posted,
                IsSystemGenerated = true,
                ReferenceNumber = voucher.VoucherNumber,
                Memo = $"Reversal of {voucher.VoucherNumber}: {reason}",
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
            });
        }
    }

    private static string ReversalVoucherNumber() =>
        $"RV-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}"[..34];

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

    private static void EnsureDistinctPurchaseLots(IEnumerable<PurchaseItemRequest> items)
    {
        var duplicates = items
            .GroupBy(item => new
            {
                item.ProductId,
                LotNumber = Clean(item.LotNumber)?.ToUpperInvariant() ?? string.Empty,
                item.ExpireDate
            })
            .Where(group => group.Count() > 1)
            .ToArray();

        if (duplicates.Length > 0)
            throw new ArgumentException(
                "The same product, lot number, and expiry date can appear only once in a purchase. " +
                "Use separate lines only when the lot number or expiry date is different.");
    }

    private static void EnsureNoDuplicateProducts(IEnumerable<long> productIds, string documentName)
    {
        var ids = productIds.ToArray();
        if (ids.Length != ids.Distinct().Count())
            throw new ArgumentException($"A product can be selected only once in a {documentName}. Remove the duplicate line and update the original quantity instead.");
    }


    private async Task EnsureLineLimitAsync(
        int lineCount,
        bool isPurchase,
        bool canOverrideLineLimits,
        CancellationToken ct)
    {
        const int safetyMaximum = 500;
        if (lineCount > safetyMaximum)
            throw new ArgumentException($"A document cannot contain more than {safetyMaximum} product lines.");

        if (canOverrideLineLimits) return;

        var limits = await context.CompanySettings.AsNoTracking()
            .Select(item => new { item.MaximumPurchaseLines, item.MaximumManualSaleLines })
            .SingleOrDefaultAsync(ct);
        var maximum = isPurchase
            ? limits?.MaximumPurchaseLines ?? 50
            : limits?.MaximumManualSaleLines ?? 50;
        maximum = Math.Clamp(maximum, 1, 500);

        if (lineCount > maximum)
        {
            var document = isPurchase ? "purchase" : "manual sale";
            throw new ArgumentException(
                $"This {document} contains {lineCount} product lines. The company limit is {maximum}. Remove lines or ask an administrator for the operation line-limit override permission.");
        }
    }

    private static void ValidatePurchase(CreatePurchaseRequest request)
    {
        if (request.Items.Count == 0) throw new ArgumentException("At least one purchase item is required.");
        if (request.Items.Any(x => x.ProductId <= 0 || x.Quantity <= 0 || x.BonusQuantity < 0 || x.UnitCost < 0)) throw new ArgumentException("Every purchase item requires a product, positive quantity, non-negative bonus, and non-negative cost.");
        if (request.Discount < 0 || request.Tax < 0 || request.OtherCost < 0) throw new ArgumentException("Discount, tax, and other costs cannot be negative.");
        ValidatePercentage(request.DiscountPercent, "Purchase discount");
        ValidatePercentage(request.SecondaryDiscountPercent, "Secondary purchase discount");
        foreach (var item in request.Items)
        {
            ValidatePercentage(item.DiscountPercent, "Line discount");
        }
    }

    private static void ValidatePercentage(decimal value, string name)
    {
        if (value is < 0 or > 100)
            throw new ArgumentException($"{name} must be between 0 and 100 percent.");
    }

    private static decimal StackedNet(decimal amount, decimal firstPercent, decimal secondPercent)
    {
        ValidatePercentage(firstPercent, "Discount");
        ValidatePercentage(secondPercent, "Secondary discount");
        var afterFirst = amount * (1 - firstPercent / 100m);
        return decimal.Round(afterFirst * (1 - secondPercent / 100m), 2, MidpointRounding.AwayFromZero);
    }

    private static decimal PercentageNet(decimal amount, decimal discountPercent)
    {
        ValidatePercentage(discountPercent, "Line discount");
        return decimal.Round(amount * (1 - discountPercent / 100m), 2, MidpointRounding.AwayFromZero);
    }

    private static List<NormalizedPurchaseLine> AllocatePurchaseLandedCosts(
        IReadOnlyList<NormalizedPurchaseLine> lines,
        decimal documentTotal,
        decimal linesNet)
    {
        if (documentTotal <= 0)
            return lines.Select(line => line with { BaseUnitCost = 0 }).ToList();

        var useLineValue = linesNet > 0;
        var weightTotal = useLineValue ? linesNet : lines.Sum(line => line.BaseQuantity);
        var allocated = 0m;
        var result = new List<NormalizedPurchaseLine>(lines.Count);

        for (var index = 0; index < lines.Count; index++)
        {
            var line = lines[index];
            var weight = useLineValue
                ? PercentageNet(line.Request.Quantity * line.Request.UnitCost, line.Request.DiscountPercent)
                : line.BaseQuantity;
            var target = index == lines.Count - 1
                ? Math.Max(0, documentTotal - allocated)
                : Math.Min(
                    Math.Max(0, documentTotal - allocated),
                    decimal.Round(documentTotal * weight / weightTotal, 2, MidpointRounding.AwayFromZero));
            allocated += target;
            result.Add(line with
            {
                BaseUnitCost = decimal.Round(target / line.BaseQuantity, 4, MidpointRounding.AwayFromZero)
            });
        }

        return result;
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

    private static PurchaseListItem MapPurchase(Purchase x, string? supplierName) => new(x.Id, x.PurchaseNumber, x.ReferenceNumber, x.PurchaseDate, supplierName, x.Items.Count, x.Total, x.PaidAmount, Math.Max(0, x.Total - x.PaidAmount), x.PaymentStatus, x.Status, x.CreatedAt);
    private InventorySaleListItem MapSale(InventorySale x, string customerName)
    {
        var cleanName = customerName.Trim();
        var customerPhone = x.Customer?.Phone ?? x.CustomerPhone;
        return new InventorySaleListItem(
            x.Id,
            x.SaleNumber,
            x.ReferenceNumber,
            x.SaleDate,
            x.CustomerId,
            cleanName,
            customerPhone,
            x.Notes,
            WhatsAppLinkBuilder.BuildSale(
                customerPhone,
                cleanName,
                x.SaleNumber,
                x.Total,
                x.PaidAmount,
                Math.Max(0, x.Total - x.PaidAmount),
                x.CurrencyCode,
                _whatsAppOptions),
            x.Items.Count,
            x.Total,
            x.PaidAmount,
            Math.Max(0, x.Total - x.PaidAmount),
            x.PaymentStatus,
            x.Items.Sum(item => item.Quantity * item.UnitCost),
            (x.Subtotal - x.Discount) - x.Items.Sum(item => item.Quantity * item.UnitCost),
            x.Subtotal - x.Discount > 0
                ? decimal.Round(((x.Subtotal - x.Discount) - x.Items.Sum(item => item.Quantity * item.UnitCost)) / (x.Subtotal - x.Discount) * 100m, 2)
                : 0,
            x.CreatedAt);
    }
    private static SalaryPaymentResponse MapSalary(StaffSalaryPayment x, string staffName) => new(x.Id, x.StaffId, staffName, x.PeriodYear, x.PeriodMonth, x.BaseSalary, x.Bonus, x.Deduction, x.NetAmount, x.PaidAmount, Math.Max(0, x.NetAmount - x.PaidAmount), x.PaymentStatus, x.PaidDate, x.PaymentMethod, x.ReferenceNumber, x.CreatedAt);
    private static StaffResponse MapStaff(Staff x, bool isSystemUser) => new(x.Id, x.EmployeeNumber, x.FullName, x.Phone, x.Email, x.Position, x.Department, x.HireDate, x.BaseSalary, x.IsActive, x.Address, x.Notes, isSystemUser);
    private static SupplierResponse MapSupplier(Supplier x) => new(x.Id, x.Name, x.ContactPerson, x.Phone, x.Email, x.Address, x.TaxNumber, x.IsActive, 0);

    private static DocumentPaymentStatus PaymentStatus(decimal paid, decimal total) =>
        total <= 0 || paid >= total
            ? DocumentPaymentStatus.Paid
            : paid <= 0
                ? DocumentPaymentStatus.Unpaid
                : DocumentPaymentStatus.Partial;
    private static string PaymentMethod(string? value) => string.IsNullOrWhiteSpace(value) ? "Cash" : value.Trim();
    private static DateOnly PaymentDate(DateOnly value) => value == default ? DateOnly.FromDateTime(DateTime.UtcNow) : value;
    private static string DocumentNumber(string prefix) => $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Random.Shared.Next(1000, 9999)}";
    private static string CreateQuickProductSlug(string name)
    {
        var normalized = new string(name.Trim().ToLowerInvariant()
            .Select(character => char.IsLetterOrDigit(character) ? character : '-')
            .ToArray());
        while (normalized.Contains("--", StringComparison.Ordinal))
            normalized = normalized.Replace("--", "-", StringComparison.Ordinal);
        normalized = normalized.Trim('-');
        if (string.IsNullOrWhiteSpace(normalized)) normalized = "product";
        normalized = normalized[..Math.Min(normalized.Length, 241)];
        return $"{normalized}-{Guid.NewGuid():N}"[..(normalized.Length + 9)];
    }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string? CleanCurrency(string? value)
    {
        var currency = Clean(value)?.ToUpperInvariant();
        if (currency is null) return null;
        if (currency.Length != 3 || !currency.All(char.IsLetter))
            throw new ArgumentException("Currency code must contain exactly three letters.");
        return currency;
    }
    private static void RequireText(string? value, string field) { if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"{field} is required."); }
}
