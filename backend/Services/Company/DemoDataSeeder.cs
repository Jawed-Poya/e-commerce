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
        var branchId = branch.Id;
        var settings = await context.CompanySettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        var currency = settings?.MainCurrencyCode ?? "USD";

        var generalCustomer = await GetOrCreateTypeAsync(GeneralTypeEnum.CustomerType, "General", branchId, 0, cancellationToken);
        var tablet = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Tablet", branchId, 1, cancellationToken);
        var capsule = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Capsule", branchId, 2, cancellationToken);
        var bottle = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Bottle", branchId, 4, cancellationToken);
        var piece = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductUnit, "Piece (Dana)", branchId, 0, cancellationToken);

        var painRelief = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Pain Relief", branchId, 1, cancellationToken);
        var antibiotics = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Antibiotics", branchId, 2, cancellationToken);
        var vitamins = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Vitamins & Supplements", branchId, 3, cancellationToken);
        var coldCare = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "Cold & Flu Care", branchId, 4, cancellationToken);
        var firstAid = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductCategory, "First Aid & Devices", branchId, 5, cancellationToken);

        var healthCare = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "HealthCare Labs", branchId, 1, cancellationToken);
        var medica = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "Medica", branchId, 2, cancellationToken);
        var vitaPlus = await GetOrCreateTypeAsync(GeneralTypeEnum.ProductBrand, "VitaPlus", branchId, 3, cancellationToken);

        var images = CopySeedImages();
        var samples = new[]
        {
            new ProductSample("Paracetamol", "500 mg", "890100000001", "paracetamol-500mg", painRelief.Id, healthCare.Id, tablet.Id, 2.50m, 0.45m, 118m, 20m, "paracetamol.svg", "Reliable everyday fever and pain relief."),
            new ProductSample("Amoxicillin", "500 mg", "890100000002", "amoxicillin-500mg", antibiotics.Id, medica.Id, capsule.Id, 6.75m, 1.20m, 74m, 15m, "amoxicillin.svg", "Prescription antibiotic capsules in a sealed retail pack."),
            new ProductSample("Vitamin C", "1000 mg", "890100000003", "vitamin-c-1000mg", vitamins.Id, vitaPlus.Id, tablet.Id, 8.90m, 2.10m, 92m, 18m, "vitamin-c.svg", "Orange-flavour effervescent tablets for daily supplementation."),
            new ProductSample("Herbal Cough Syrup", "100 ml", "890100000004", "herbal-cough-syrup-100ml", coldCare.Id, healthCare.Id, bottle.Id, 5.40m, 1.50m, 46m, 10m, "cough-syrup.svg", "Soothing non-drowsy herbal syrup for dry cough."),
            new ProductSample("Sterile Adhesive Bandages", "20 pack", "890100000005", "sterile-bandages-20", firstAid.Id, medica.Id, piece.Id, 3.25m, 0.80m, 65m, 12m, "bandage.svg", "Individually wrapped, breathable first-aid bandages."),
            new ProductSample("Digital Thermometer", null, "890100000006", "digital-thermometer", firstAid.Id, medica.Id, piece.Id, 12.00m, 4.50m, 28m, 6m, "thermometer.svg", "Fast, clear digital temperature readings for home use.")
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
            IsFeatured = index is 0 or 2 or 5,
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
                    ImagePath = images[sample.ImageFile].PublicPath,
                    FileName = sample.ImageFile,
                    OriginalFileName = sample.ImageFile,
                    ContentType = "image/svg+xml",
                    Size = images[sample.ImageFile].Size,
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
            LotNumber = $"DEMO-{today:yyyyMM}-{index + 1:00}",
            Quantity = samples[index].Quantity,
            ReservedQuantity = 0,
            UnitCost = samples[index].UnitCost,
            ManufacturedAt = today.AddMonths(-2),
            ExpiresAt = index == 5 ? null : today.AddMonths(18 + index)
        }));

        var supplier = new Supplier
        {
            BranchId = branchId,
            Name = "Kabul Medical Distribution",
            ContactPerson = "Ahmad Rahimi",
            Phone = "+93 700 123 456",
            Email = "sales@kmd.example",
            Address = "Shahr-e-Naw, Kabul",
            TaxNumber = "AF-TAX-10482",
            IsActive = true
        };
        var customer = new Customer
        {
            BranchId = branchId,
            FirstName = "Mariam",
            LastName = "Ahmadi",
            Phone = "+93700111222",
            Email = "mariam.ahmadi@example.com",
            Address = "Kart-e-Se, Kabul",
            CustomerTypeId = generalCustomer.Id
        };
        var secondCustomer = new Customer
        {
            BranchId = branchId,
            FirstName = "Farid",
            LastName = "Karimi",
            Phone = "+93700999888",
            Email = "farid.karimi@example.com",
            Address = "Dasht-e-Barchi, Kabul",
            CustomerTypeId = generalCustomer.Id
        };
        context.AddRange(supplier, customer, secondCustomer);
        await context.SaveChangesAsync(cancellationToken);

        var purchase = new Purchase
        {
            BranchId = branchId,
            PurchaseNumber = $"PUR-DEMO-{today:yyyyMMdd}",
            SupplierId = supplier.Id,
            PurchaseDate = today.AddDays(-10),
            Status = PurchaseStatus.Received,
            PaymentStatus = DocumentPaymentStatus.Paid,
            Subtotal = 201m,
            Total = 201m,
            PaidAmount = 201m,
            CurrencyCode = currency,
            ReferenceNumber = "KMD-INV-2408",
            Notes = "Opening sample inventory purchase.",
            Items =
            [
                PurchaseLine(products[0], branchId, 100, samples[0].UnitCost, tablet),
                PurchaseLine(products[1], branchId, 60, samples[1].UnitCost, capsule),
                PurchaseLine(products[2], branchId, 40, samples[2].UnitCost, tablet)
            ],
            Payments =
            [
                new PurchasePayment
                {
                    BranchId = branchId,
                    Amount = 201m,
                    PaymentDate = today.AddDays(-10),
                    PaymentMethod = "Bank transfer",
                    ReferenceNumber = "BANK-DEMO-001"
                }
            ]
        };

        var manualSale = new InventorySale
        {
            BranchId = branchId,
            SaleNumber = $"SAL-DEMO-{today:yyyyMMdd}",
            CustomerId = customer.Id,
            CustomerName = "Mariam Ahmadi",
            CustomerPhone = customer.Phone,
            SaleDate = today.AddDays(-2),
            PaymentStatus = DocumentPaymentStatus.Paid,
            PaymentMethod = "Cash",
            Subtotal = 13.65m,
            Total = 13.65m,
            PaidAmount = 13.65m,
            CurrencyCode = currency,
            Notes = "Walk-in sample sale.",
            Items =
            [
                SaleLine(products[0], branchId, 2, samples[0].Price, samples[0].UnitCost, tablet),
                SaleLine(products[3], branchId, 1, samples[3].Price, samples[3].UnitCost, bottle),
                SaleLine(products[4], branchId, 1, samples[4].Price, samples[4].UnitCost, piece)
            ],
            Payments =
            [
                new InventorySalePayment
                {
                    BranchId = branchId,
                    Amount = 13.65m,
                    PaymentDate = today.AddDays(-2),
                    PaymentMethod = "Cash"
                }
            ]
        };

        var order = new Order
        {
            BranchId = branchId,
            OrderNumber = $"ORD-DEMO-{today:yyyyMMdd}",
            CustomerId = secondCustomer.Id,
            Status = ECommerce.Entities.Orders.OrderStatus.Delivered,
            PaymentStatus = PaymentStatus.Paid,
            FulfillmentStatus = FulfillmentStatus.Fulfilled,
            Subtotal = samples[2].Price + samples[5].Price,
            Total = samples[2].Price + samples[5].Price,
            Currency = currency,
            Notes = "Delivered sample storefront order.",
            ShippingAddressJson = "{\"recipientName\":\"Farid Karimi\",\"city\":\"Kabul\"}",
            Items =
            [
                OrderLine(products[2], branchId, samples[2].Price, samples[2].UnitCost, tablet, currency),
                OrderLine(products[5], branchId, samples[5].Price, samples[5].UnitCost, piece, currency)
            ]
        };

        var rentCategory = await GetOrCreateTypeAsync(GeneralTypeEnum.ExpenseCategory, "Rent", branchId, 0, cancellationToken);
        var expense = new Expense
        {
            BranchId = branchId,
            ExpenseDate = today.AddDays(-5),
            GeneralTypeCategoryId = rentCategory.Id,
            Amount = 450m,
            CurrencyCode = currency,
            Vendor = "Kabul City Properties",
            PaymentMethod = "Bank transfer",
            ReferenceNumber = "RENT-DEMO-01",
            Description = "Monthly main-branch shop rent (sample)."
        };
        var staff = new Staff
        {
            BranchId = branchId,
            EmployeeNumber = "EMP-DEMO-001",
            FullName = "Laila Noori",
            Phone = "+93700888777",
            Position = "Pharmacy Assistant",
            Department = "Sales",
            HireDate = today.AddMonths(-8),
            BaseSalary = 350m,
            IsActive = true,
            Address = "Kabul"
        };

        context.AddRange(purchase, manualSale, order, expense, staff);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Loaded professional demo data with {ProductCount} products for branch {BranchId}.", products.Length, branchId);

        return new DemoSeedResult(branchId, products.Length, 2, 1, 1, 1, images.Count);
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

    private IReadOnlyDictionary<string, SeedImage> CopySeedImages()
    {
        var sourceRoot = Path.Combine(environment.ContentRootPath, "SeedAssets", "products");
        var destinationRoot = Path.Combine(_storage.ResolveRootPath(environment), "demo", "products");
        Directory.CreateDirectory(destinationRoot);
        var result = new Dictionary<string, SeedImage>(StringComparer.OrdinalIgnoreCase);
        foreach (var sourcePath in Directory.EnumerateFiles(sourceRoot, "*.svg", SearchOption.TopDirectoryOnly))
        {
            var fileName = Path.GetFileName(sourcePath);
            var destinationPath = Path.Combine(destinationRoot, fileName);
            File.Copy(sourcePath, destinationPath, overwrite: true);
            var publicPath = $"{_storage.ResolveRequestPath().Trim('/')}/demo/products/{fileName}";
            result[fileName] = new SeedImage(publicPath, new FileInfo(destinationPath).Length);
        }

        return result;
    }

    private static PurchaseItem PurchaseLine(
        Product product,
        long branchId,
        decimal quantity,
        decimal unitCost,
        GeneralType unit) => new()
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
        LotNumber = "DEMO-OPENING"
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
        decimal unitPrice,
        decimal unitCost,
        GeneralType unit,
        string currency) => new()
    {
        BranchId = branchId,
        ProductId = product.Id,
        Quantity = 1,
        OrderedQuantity = 1,
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

    private sealed record SeedImage(string PublicPath, long Size);
}
