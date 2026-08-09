using API.Entities.Customers;
using API.Entities.Orders;
using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Operations;
using ECommerce.Entities.Products;
using ECommerce.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Company;

public sealed record DemoSeedResult(
    long BranchId,
    int Products,
    int Customers,
    int Purchases,
    int Sales,
    int Orders,
    int LightweightImages);

public interface IDemoDataSeeder
{
    Task<DemoSeedResult> ResetAndSeedAsync(CancellationToken cancellationToken = default);
}

public sealed class DemoDataSeeder(
    ApplicationDbContext context,
    IDatabaseMaintenanceService maintenance,
    IOptions<FileStorageOptions> storageOptions,
    IWebHostEnvironment environment,
    ILogger<DemoDataSeeder> logger) : IDemoDataSeeder
{
    private const string DefaultPrimaryColor = "#0B1F3A";
    private const string DefaultSecondaryColor = "#F97316";
    private readonly FileStorageOptions _storage = storageOptions.Value;

    public async Task<DemoSeedResult> ResetAndSeedAsync(
        CancellationToken cancellationToken = default)
    {
        await maintenance.ClearBusinessDataAsync(null, cancellationToken);

        var branch = await context.Branches
            .OrderByDescending(item => item.IsActive)
            .ThenByDescending(item => item.IsMain)
            .ThenBy(item => item.Id)
            .FirstAsync(cancellationToken);
        var company = await context.Companies.SingleAsync(cancellationToken);
        var settings = await context.CompanySettings.FirstAsync(cancellationToken);
        ApplyNeutralCompanyDefaults(company, branch, settings);
        await context.SaveChangesAsync(cancellationToken);

        var branchId = branch.Id;
        var currency = settings.MainCurrencyCode;
        var productImages = ResolveDemoImages("products");
        var categoryImages = ResolveDemoImages("categories");

        var generalCustomer = await GetOrCreateTypeAsync(GeneralTypeEnum.CustomerType, "General", branchId, 0, cancellationToken);
        var piece = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Piece (Dana)", branchId, 0, cancellationToken);
        var tablet = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Tablet", branchId, 1, cancellationToken);
        var capsule = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Capsule", branchId, 2, cancellationToken);
        var box = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Box", branchId, 4, cancellationToken);
        var bottle = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Bottle", branchId, 5, cancellationToken);
        var pack = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Pack", branchId, 6, cancellationToken);
        var sachet = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Sachet", branchId, 9, cancellationToken);

        var painRelief = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Pain Relief", branchId, 1, cancellationToken);
        var antibiotics = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Antibiotics", branchId, 2, cancellationToken);
        var vitamins = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Vitamins & Supplements", branchId, 3, cancellationToken);
        var coldCare = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Cold & Flu Care", branchId, 4, cancellationToken);
        var firstAid = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "First Aid & Devices", branchId, 5, cancellationToken);

        painRelief.ImageUrl = categoryImages["pain-relief.svg"].PublicUrl;
        antibiotics.ImageUrl = categoryImages["antibiotics.svg"].PublicUrl;
        vitamins.ImageUrl = categoryImages["vitamins.svg"].PublicUrl;
        coldCare.ImageUrl = categoryImages["cold-care.svg"].PublicUrl;
        firstAid.ImageUrl = categoryImages["first-aid.svg"].PublicUrl;
        await context.SaveChangesAsync(cancellationToken);

        var brandA = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "Demo Brand A", branchId, 1, cancellationToken);
        var brandB = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "Demo Brand B", branchId, 2, cancellationToken);
        var brandC = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "Demo Brand C", branchId, 3, cancellationToken);

        var samples = new[]
        {
            new ProductSample("Paracetamol", "500 mg", "890100000001", "paracetamol-500mg", painRelief.Id, brandA.Id, tablet.Id, 2.50m, 0.45m, 220m, 30m, "paracetamol.svg", "Reliable everyday fever and pain relief."),
            new ProductSample("Amoxicillin", "500 mg", "890100000002", "amoxicillin-500mg", antibiotics.Id, brandB.Id, capsule.Id, 6.75m, 1.20m, 180m, 25m, "amoxicillin.svg", "Prescription antibiotic capsules in a sealed retail pack."),
            new ProductSample("Vitamin C", "1000 mg", "890100000003", "vitamin-c-1000mg", vitamins.Id, brandC.Id, tablet.Id, 8.90m, 2.10m, 200m, 30m, "vitamin-c.svg", "Orange-flavour effervescent tablets for daily supplementation."),
            new ProductSample("Herbal Cough Syrup", "100 ml", "890100000004", "herbal-cough-syrup-100ml", coldCare.Id, brandA.Id, bottle.Id, 5.40m, 1.50m, 125m, 18m, "cough-syrup.svg", "Soothing non-drowsy herbal syrup for dry cough."),
            new ProductSample("Sterile Adhesive Bandages", "20 pack", "890100000005", "sterile-bandages-20", firstAid.Id, brandB.Id, pack.Id, 3.25m, 0.80m, 155m, 20m, "bandage.svg", "Individually wrapped, breathable first-aid bandages."),
            new ProductSample("Digital Thermometer", null, "890100000006", "digital-thermometer", firstAid.Id, brandB.Id, piece.Id, 12.00m, 4.50m, 70m, 10m, "thermometer.svg", "Fast, clear digital temperature readings for home use."),
            new ProductSample("Ibuprofen", "400 mg", "890100000007", "ibuprofen-400mg", painRelief.Id, brandC.Id, tablet.Id, 3.10m, 0.62m, 210m, 30m, "paracetamol.svg", "Anti-inflammatory tablets for short-term pain relief."),
            new ProductSample("Low-dose Aspirin", "81 mg", "890100000008", "aspirin-81mg", painRelief.Id, brandA.Id, tablet.Id, 2.85m, 0.50m, 190m, 25m, "paracetamol.svg", "Low-dose aspirin tablets in a compact sample pack."),
            new ProductSample("Azithromycin", "250 mg", "890100000009", "azithromycin-250mg", antibiotics.Id, brandB.Id, capsule.Id, 7.80m, 1.75m, 140m, 20m, "amoxicillin.svg", "Example prescription antibiotic capsule product."),
            new ProductSample("Oral Rehydration Salts", "20.5 g", "890100000010", "oral-rehydration-salts", vitamins.Id, brandC.Id, sachet.Id, 1.20m, 0.22m, 260m, 40m, "vitamin-c.svg", "Single-use electrolyte powder sachet."),
            new ProductSample("Vitamin D3", "1000 IU", "890100000011", "vitamin-d3-1000iu", vitamins.Id, brandA.Id, tablet.Id, 7.50m, 1.85m, 175m, 25m, "vitamin-c.svg", "Daily vitamin D supplement tablets."),
            new ProductSample("Daily Multivitamin", "30 tablets", "890100000012", "daily-multivitamin-30", vitamins.Id, brandC.Id, box.Id, 9.95m, 2.60m, 135m, 18m, "vitamin-c.svg", "Balanced daily multivitamin example product."),
            new ProductSample("Zinc Supplement", "20 mg", "890100000013", "zinc-20mg", vitamins.Id, brandB.Id, tablet.Id, 4.20m, 0.90m, 165m, 22m, "vitamin-c.svg", "Simple zinc supplement tablet sample."),
            new ProductSample("Saline Nasal Spray", "30 ml", "890100000014", "saline-nasal-spray-30ml", coldCare.Id, brandA.Id, bottle.Id, 4.75m, 1.10m, 120m, 16m, "cough-syrup.svg", "Gentle saline spray for everyday nasal care."),
            new ProductSample("Honey Throat Lozenges", "16 pack", "890100000015", "honey-throat-lozenges-16", coldCare.Id, brandC.Id, pack.Id, 3.60m, 0.75m, 145m, 20m, "cough-syrup.svg", "Honey-flavour lozenges in a lightweight pack."),
            new ProductSample("Cold Relief Tablets", "20 tablets", "890100000016", "cold-relief-tablets-20", coldCare.Id, brandB.Id, box.Id, 5.85m, 1.30m, 150m, 20m, "paracetamol.svg", "Multi-symptom cold relief example pack."),
            new ProductSample("Cotton Roll", "100 g", "890100000017", "cotton-roll-100g", firstAid.Id, brandA.Id, pack.Id, 2.40m, 0.55m, 130m, 18m, "bandage.svg", "Soft absorbent cotton for first-aid use."),
            new ProductSample("Antiseptic Solution", "100 ml", "890100000018", "antiseptic-solution-100ml", firstAid.Id, brandB.Id, bottle.Id, 4.95m, 1.25m, 115m, 15m, "cough-syrup.svg", "General-purpose antiseptic solution example."),
            new ProductSample("Disposable Face Masks", "50 pack", "890100000019", "disposable-face-masks-50", firstAid.Id, brandC.Id, box.Id, 6.50m, 1.70m, 160m, 22m, "bandage.svg", "Lightweight disposable face-mask box."),
            new ProductSample("First Aid Kit", "24 pieces", "890100000020", "first-aid-kit-24", firstAid.Id, brandA.Id, box.Id, 18.50m, 6.25m, 60m, 8m, "bandage.svg", "Compact first-aid kit with essential sample items.")
        };

        var products = samples.Select((sample, index) => new Product
        {
            BranchId = branchId,
            Name = sample.Name,
            Strength = sample.Strength,
            Barcode = sample.Barcode,
            Slug = sample.Slug,
            CategoryId = sample.CategoryId,
            BrandId = sample.BrandId,
            UnitId = sample.UnitId,
            ShortDescription = sample.Description,
            Description = $"{sample.Description} Professional sample product created by the demo-data seed.",
            MinimumValue = (int)sample.MinimumQuantity,
            MaximumValue = 500,
            IsFeatured = index is 0 or 2 or 5 or 11 or 19,
            IsActive = true,
            Inventory = new ProductInventory
            {
                BranchId = branchId,
                Quantity = sample.Quantity,
                ReservedQuantity = 0,
                MinimumQuantity = sample.MinimumQuantity
            },
            Images =
            [
                new ProductImage
                {
                    BranchId = branchId,
                    ImagePath = productImages[sample.ImageFile].DatabasePath,
                    FileName = sample.ImageFile,
                    OriginalFileName = sample.ImageFile,
                    ContentType = "image/svg+xml",
                    Size = productImages[sample.ImageFile].Size,
                    IsPrimary = true,
                    SortOrder = 0
                }
            ],
            Prices =
            [
                new ProductPrice
                {
                    BranchId = branchId,
                    CustomerTypeId = generalCustomer.Id,
                    RegularPrice = sample.Price
                }
            ]
        }).ToArray();

        context.Products.AddRange(products);
        await context.SaveChangesAsync(cancellationToken);

        var warehouse = await context.Warehouses.IgnoreQueryFilters()
            .Where(item => item.BranchId == branchId)
            .OrderBy(item => item.IsDeleted)
            .ThenByDescending(item => item.IsActive)
            .ThenBy(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (warehouse is null)
        {
            var safeBranchCode = new string(branch.Code
                .Where(character => char.IsLetterOrDigit(character))
                .Take(18)
                .ToArray());
            warehouse = new Warehouse
            {
                BranchId = branchId,
                Name = "Main Warehouse",
                Code = $"DEMO-{(string.IsNullOrWhiteSpace(safeBranchCode) ? branchId : safeBranchCode)}",
                IsActive = true
            };
            context.Warehouses.Add(warehouse);
            await context.SaveChangesAsync(cancellationToken);
        }
        else
        {
            warehouse.Name = "Main Warehouse";
            warehouse.IsDeleted = false;
            warehouse.DeletedAt = null;
            warehouse.IsActive = true;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        context.InventoryLots.AddRange(products.Select((product, index) => new InventoryLot
        {
            BranchId = branchId,
            ProductId = product.Id,
            WarehouseId = warehouse.Id,
            LotNumber = $"LOT-DEMO-{today:yyyyMM}-{index + 1:000}",
            Quantity = samples[index].Quantity,
            ReservedQuantity = 0,
            UnitCost = samples[index].UnitCost,
            ManufacturedAt = today.AddMonths(-2),
            ExpiresAt = index is 5 or 19 ? null : today.AddMonths(18 + index % 8)
        }));

        var suppliers = Enumerable.Range(1, 3).Select(index => new Supplier
        {
            BranchId = branchId,
            Name = $"Sample Supplier {index:00}",
            ContactPerson = $"Contact {index:00}",
            Phone = $"07020000{index:00}",
            Email = $"supplier{index:00}@example.com",
            Address = $"Sample supplier address {index:00}",
            TaxNumber = $"TAX-DEMO-{index:000}",
            IsActive = true
        }).ToArray();

        var customers = Enumerable.Range(1, 10).Select(index => new Customer
        {
            BranchId = branchId,
            FirstName = "Sample",
            LastName = $"Customer {index:00}",
            Phone = $"07010000{index:00}",
            Email = $"customer{index:00}@example.com",
            Address = $"Sample customer address {index:00}",
            CustomerTypeId = generalCustomer.Id
        }).ToArray();

        context.AddRange(suppliers);
        context.AddRange(customers);
        await context.SaveChangesAsync(cancellationToken);

        var unitsById = new[] { piece, tablet, capsule, box, bottle, pack, sachet }
            .ToDictionary(item => item.Id);
        var purchases = CreatePurchases(products, samples, unitsById, suppliers, branchId, currency, today);
        var sales = CreateSales(products, samples, unitsById, customers, branchId, currency, today);
        var orders = CreateOrders(products, samples, unitsById, customers, branchId, currency, today);

        var rentCategory = await GetOrCreateTypeAsync(GeneralTypeEnum.ExpenseCategory, "Rent", branchId, 0, cancellationToken);
        var officeCategory = await GetOrCreateTypeAsync(GeneralTypeEnum.ExpenseCategory, "Office", branchId, 3, cancellationToken);
        var expenses = Enumerable.Range(1, 4).Select(index => new Expense
        {
            BranchId = branchId,
            ExpenseDate = today.AddDays(-(index * 4)),
            GeneralTypeCategoryId = index % 2 == 0 ? officeCategory.Id : rentCategory.Id,
            Amount = 75m * index,
            CurrencyCode = currency,
            Vendor = $"Sample Vendor {index:00}",
            PaymentMethod = index % 2 == 0 ? "Cash" : "Bank transfer",
            ReferenceNumber = $"BILL-EXP-{today:yyyyMM}-{index:000}",
            Description = $"Example operating expense {index:00}."
        }).ToArray();

        var staff = Enumerable.Range(1, 3).Select(index => new Staff
        {
            BranchId = branchId,
            EmployeeNumber = $"EMP-DEMO-{index:000}",
            FullName = $"Sample Staff {index:00}",
            Phone = $"07030000{index:00}",
            Email = $"staff{index:00}@example.com",
            Position = index == 1 ? "Store Assistant" : index == 2 ? "Inventory Clerk" : "Sales Associate",
            Department = index == 2 ? "Inventory" : "Sales",
            HireDate = today.AddMonths(-(4 + index * 2)),
            BaseSalary = 300m + index * 50m,
            IsActive = true,
            Address = $"Sample staff address {index:00}"
        }).ToArray();

        context.AddRange(purchases);
        context.AddRange(sales);
        context.AddRange(orders);
        context.AddRange(expenses);
        context.AddRange(staff);
        await context.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Loaded neutral demo data with {ProductCount} products, {PurchaseCount} purchases, and {SaleCount} sales for branch {BranchId}.",
            products.Length,
            purchases.Length,
            sales.Length,
            branchId);

        return new DemoSeedResult(
            branchId,
            products.Length,
            customers.Length,
            purchases.Length,
            sales.Length,
            orders.Length,
            productImages.Count + categoryImages.Count);
    }

    private static void ApplyNeutralCompanyDefaults(
        ECommerce.Entities.Company.Company company,
        ECommerce.Entities.Company.Branch branch,
        ECommerce.Entities.Company.CompanySetting settings)
    {
        company.Name = "Default Company";
        company.LegalName = "Default Company";
        company.RegistrationNumber = "REG-DEMO-0001";
        company.Email = "contact@example.com";
        company.Phone = "0700000000";
        company.Address = "Sample company address";
        company.LogoUrl = null;
        company.FaviconUrl = null;
        company.IsActive = true;
        company.UpdatedAt = DateTime.UtcNow;

        branch.Name = "Main Branch";
        branch.Phone = "0700000000";
        branch.Address = "Sample branch address";
        branch.IsActive = true;
        branch.UpdatedAt = DateTime.UtcNow;

        settings.AdminPrimaryColor = DefaultPrimaryColor;
        settings.AdminSecondaryColor = DefaultSecondaryColor;
        settings.StorefrontPrimaryColor = DefaultPrimaryColor;
        settings.StorefrontSecondaryColor = DefaultSecondaryColor;
        settings.UpdatedAt = DateTime.UtcNow;
    }

    private static Purchase[] CreatePurchases(
        IReadOnlyList<Product> products,
        IReadOnlyList<ProductSample> samples,
        IReadOnlyDictionary<long, GeneralType> unitsById,
        IReadOnlyList<Supplier> suppliers,
        long branchId,
        string currency,
        DateOnly today)
    {
        return Enumerable.Range(0, 10).Select(index =>
        {
            var purchaseDate = today.AddDays(-(30 - index * 2));
            var lineCount = index == 0 ? products.Count : 6 + index % 5;
            var items = Enumerable.Range(0, lineCount).Select(lineIndex =>
            {
                var productIndex = (index * 3 + lineIndex) % products.Count;
                var quantity = 12m + (index * 5 + lineIndex * 3) % 29;
                return PurchaseLine(
                    products[productIndex],
                    branchId,
                    quantity,
                    samples[productIndex].UnitCost,
                    unitsById[samples[productIndex].UnitId],
                    $"LOT-PUR-{index + 1:000}-{productIndex + 1:000}",
                    productIndex is 5 or 19 ? null : purchaseDate.AddMonths(18 + productIndex % 8));
            }).ToArray();

            var subtotal = items.Sum(item => item.LineTotal);
            var discount = index % 4 == 0 ? Math.Min(5m, subtotal) : 0m;
            var otherCost = index % 3 == 0 ? 2.50m : 0m;
            var total = subtotal - discount + otherCost;
            var paymentStatus = index == 9
                ? DocumentPaymentStatus.Unpaid
                : index is 3 or 7
                    ? DocumentPaymentStatus.Partial
                    : DocumentPaymentStatus.Paid;
            var paidAmount = paymentStatus switch
            {
                DocumentPaymentStatus.Paid => total,
                DocumentPaymentStatus.Partial => Math.Round(total * 0.60m, 2),
                _ => 0m
            };
            var purchase = new Purchase
            {
                BranchId = branchId,
                PurchaseNumber = $"PUR-DEMO-{today:yyyyMM}-{index + 1:000}",
                SupplierId = suppliers[index % suppliers.Count].Id,
                PurchaseDate = purchaseDate,
                Status = PurchaseStatus.Received,
                PaymentStatus = paymentStatus,
                Subtotal = subtotal,
                Discount = discount,
                OtherCost = otherCost,
                Total = total,
                PaidAmount = paidAmount,
                CurrencyCode = currency,
                ReferenceNumber = $"BILL-PUR-{today:yyyyMM}-{1001 + index}",
                Notes = index == 0
                    ? "Twenty-line example purchase covering the complete demo catalog."
                    : $"Example supplier purchase {index + 1:00} with {lineCount} items.",
                Items = items
            };

            if (paidAmount > 0)
            {
                purchase.Payments.Add(new PurchasePayment
                {
                    BranchId = branchId,
                    Amount = paidAmount,
                    PaymentDate = purchaseDate,
                    PaymentMethod = index % 2 == 0 ? "Bank transfer" : "Cash",
                    ReferenceNumber = $"PAY-PUR-{today:yyyyMM}-{index + 1:000}"
                });
            }

            return purchase;
        }).ToArray();
    }

    private static InventorySale[] CreateSales(
        IReadOnlyList<Product> products,
        IReadOnlyList<ProductSample> samples,
        IReadOnlyDictionary<long, GeneralType> unitsById,
        IReadOnlyList<Customer> customers,
        long branchId,
        string currency,
        DateOnly today)
    {
        return Enumerable.Range(0, 10).Select(index =>
        {
            var customer = customers[index % customers.Count];
            var lineCount = 3 + index % 4;
            var items = Enumerable.Range(0, lineCount).Select(lineIndex =>
            {
                var productIndex = (index * 2 + lineIndex) % products.Count;
                var quantity = 1m + (index + lineIndex) % 3;
                return SaleLine(
                    products[productIndex],
                    branchId,
                    quantity,
                    samples[productIndex].Price,
                    samples[productIndex].UnitCost,
                    unitsById[samples[productIndex].UnitId]);
            }).ToArray();
            var subtotal = items.Sum(item => item.LineTotal);
            var discount = index % 4 == 1 ? 1m : 0m;
            var total = subtotal - discount;
            var paymentStatus = index == 8
                ? DocumentPaymentStatus.Unpaid
                : index is 4 or 9
                    ? DocumentPaymentStatus.Partial
                    : DocumentPaymentStatus.Paid;
            var paidAmount = paymentStatus switch
            {
                DocumentPaymentStatus.Paid => total,
                DocumentPaymentStatus.Partial => Math.Round(total * 0.50m, 2),
                _ => 0m
            };
            var saleDate = today.AddDays(-(10 - index));
            var sale = new InventorySale
            {
                BranchId = branchId,
                SaleNumber = $"SAL-DEMO-{today:yyyyMM}-{index + 1:000}",
                CustomerId = customer.Id,
                CustomerName = $"{customer.FirstName} {customer.LastName}",
                CustomerPhone = customer.Phone,
                SaleDate = saleDate,
                PaymentStatus = paymentStatus,
                PaymentMethod = index % 2 == 0 ? "Cash" : "Card",
                Subtotal = subtotal,
                Discount = discount,
                Total = total,
                PaidAmount = paidAmount,
                CurrencyCode = currency,
                ReferenceNumber = $"BILL-SALE-{today:yyyyMM}-{2001 + index}",
                Notes = $"Example counter sale {index + 1:00} with {lineCount} items.",
                Items = items
            };

            if (paidAmount > 0)
            {
                sale.Payments.Add(new InventorySalePayment
                {
                    BranchId = branchId,
                    Amount = paidAmount,
                    PaymentDate = saleDate,
                    PaymentMethod = sale.PaymentMethod,
                    ReferenceNumber = $"PAY-SALE-{today:yyyyMM}-{index + 1:000}"
                });
            }

            return sale;
        }).ToArray();
    }

    private static Order[] CreateOrders(
        IReadOnlyList<Product> products,
        IReadOnlyList<ProductSample> samples,
        IReadOnlyDictionary<long, GeneralType> unitsById,
        IReadOnlyList<Customer> customers,
        long branchId,
        string currency,
        DateOnly today)
    {
        return Enumerable.Range(0, 5).Select(index =>
        {
            var customer = customers[(index + 5) % customers.Count];
            var items = Enumerable.Range(0, 2 + index % 3).Select(lineIndex =>
            {
                var productIndex = (index * 4 + lineIndex) % products.Count;
                var quantity = 1m + (index + lineIndex) % 2;
                return OrderLine(
                    products[productIndex],
                    branchId,
                    quantity,
                    samples[productIndex].Price,
                    samples[productIndex].UnitCost,
                    unitsById[samples[productIndex].UnitId],
                    currency);
            }).ToArray();
            var subtotal = items.Sum(item => item.Total);

            return new Order
            {
                BranchId = branchId,
                OrderNumber = $"ORD-DEMO-{today:yyyyMM}-{index + 1:000}",
                CustomerId = customer.Id,
                Status = index == 4
                    ? ECommerce.Entities.Orders.OrderStatus.Processing
                    : ECommerce.Entities.Orders.OrderStatus.Delivered,
                PaymentStatus = index == 4 ? PaymentStatus.Authorized : PaymentStatus.Paid,
                FulfillmentStatus = index == 4 ? FulfillmentStatus.Processing : FulfillmentStatus.Fulfilled,
                Subtotal = subtotal,
                Total = subtotal,
                Currency = currency,
                Notes = $"Example storefront order {index + 1:00}.",
                ShippingAddressJson = $"{{\"recipientName\":\"{customer.FirstName} {customer.LastName}\",\"address\":\"Sample delivery address {index + 1:00}\"}}",
                Items = items
            };
        }).ToArray();
    }

    private async Task<GeneralType> GetOrCreateTypeAsync(
        GeneralTypeEnum group,
        string name,
        long branchId,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        var type = await context.Types.IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Group == group && item.Name == name, cancellationToken);
        if (type is null)
        {
            type = new GeneralType
            {
                BranchId = branchId,
                Group = group,
                Name = name,
                SortOrder = sortOrder
            };
            context.Types.Add(type);
        }
        else
        {
            type.IsDeleted = false;
            type.DeletedAt = null;
            type.BranchId ??= branchId;
            type.SortOrder ??= sortOrder;
        }

        await context.SaveChangesAsync(cancellationToken);
        return type;
    }

    private IReadOnlyDictionary<string, SeedImage> ResolveDemoImages(string collection)
    {
        var storageRoot = _storage.ResolveRootPath(environment);
        var demoRoot = Path.Combine(storageRoot, "demo", collection);
        EnsureBundledDemoImages(storageRoot, demoRoot, collection);

        if (!Directory.Exists(demoRoot))
        {
            throw new InvalidOperationException(
                $"Demo image folder '{demoRoot}' was not found. Publish the App_Data/demo assets with the API.");
        }

        var result = new Dictionary<string, SeedImage>(StringComparer.OrdinalIgnoreCase);
        foreach (var filePath in Directory.EnumerateFiles(demoRoot, "*.svg", SearchOption.TopDirectoryOnly))
        {
            var fileName = Path.GetFileName(filePath);
            var databasePath = $"{_storage.ResolveRequestPath().Trim('/')}/demo/{collection}/{fileName}";
            result[fileName] = new SeedImage(databasePath, $"/{databasePath}", new FileInfo(filePath).Length);
        }

        if (result.Count == 0)
        {
            throw new InvalidOperationException(
                $"Demo image folder '{demoRoot}' is empty. Publish the App_Data/demo assets with the API.");
        }

        return result;
    }

    private void EnsureBundledDemoImages(string storageRoot, string demoRoot, string collection)
    {
        var bundledRoot = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "App_Data", "demo", collection));
        var targetRoot = Path.GetFullPath(demoRoot);
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;

        if (string.Equals(bundledRoot, targetRoot, comparison) || !Directory.Exists(bundledRoot))
            return;

        Directory.CreateDirectory(targetRoot);
        var copied = 0;
        foreach (var sourcePath in Directory.EnumerateFiles(bundledRoot, "*.svg", SearchOption.TopDirectoryOnly))
        {
            var destinationPath = Path.Combine(targetRoot, Path.GetFileName(sourcePath));
            if (File.Exists(destinationPath))
                continue;

            File.Copy(sourcePath, destinationPath, overwrite: false);
            copied++;
        }

        if (copied > 0)
        {
            logger.LogInformation(
                "Copied {Count} bundled demo {Collection} image(s) into the configured App_Data root {StorageRoot}.",
                copied,
                collection,
                storageRoot);
        }
    }

    private static PurchaseItem PurchaseLine(
        Product product,
        long branchId,
        decimal quantity,
        decimal unitCost,
        GeneralType unit,
        string lotNumber,
        DateOnly? expireDate) => new()
    {
        BranchId = branchId,
        ProductId = product.Id,
        Quantity = quantity,
        UnitCost = unitCost,
        EnteredQuantity = quantity,
        SelectedUnitId = unit.Id,
        SelectedUnitName = unit.Name,
        UnitConversionFactor = 1,
        EnteredUnitCost = unitCost,
        LineTotal = quantity * unitCost,
        LotNumber = lotNumber,
        ExpireDate = expireDate
    };

    private static InventorySaleItem SaleLine(
        Product product,
        long branchId,
        decimal quantity,
        decimal unitPrice,
        decimal unitCost,
        GeneralType unit) => new()
    {
        BranchId = branchId,
        ProductId = product.Id,
        Quantity = quantity,
        UnitPrice = unitPrice,
        UnitCost = unitCost,
        EnteredQuantity = quantity,
        SelectedUnitId = unit.Id,
        SelectedUnitName = unit.Name,
        UnitConversionFactor = 1,
        EnteredUnitPrice = unitPrice,
        LineTotal = quantity * unitPrice
    };

    private static OrderItem OrderLine(
        Product product,
        long branchId,
        decimal quantity,
        decimal unitPrice,
        decimal unitCost,
        GeneralType unit,
        string currency) => new()
    {
        BranchId = branchId,
        ProductId = product.Id,
        Quantity = quantity,
        OrderedQuantity = quantity,
        SelectedUnitId = unit.Id,
        SelectedUnitName = unit.Name,
        UnitConversionFactor = 1,
        SellingUnitPrice = unitPrice,
        UnitPrice = unitPrice,
        UnitCost = unitCost,
        ProductName = product.Name,
        ProductBarcode = product.Barcode,
        VariantDescription = product.Strength,
        Currency = currency,
        AffectsInventory = true
    };

    private sealed record ProductSample(
        string Name,
        string? Strength,
        string Barcode,
        string Slug,
        long CategoryId,
        long BrandId,
        long UnitId,
        decimal Price,
        decimal UnitCost,
        decimal Quantity,
        decimal MinimumQuantity,
        string ImageFile,
        string Description);

    private sealed record SeedImage(string DatabasePath, string PublicUrl, long Size);
}
