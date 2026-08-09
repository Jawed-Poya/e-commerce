using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using ECommerce.Entities.Products.Filters;
using ECommerce.Entities.Products.Requests;
using ECommerce.Services.Customers;
using ECommerce.Services.Company;
using ECommerce.Services.Inventory;
using ECommerce.Shared;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace ECommerce.Services.Products;

public class ProductService : IProductService
{

    private const int MaximumBatchSize = 50;

    private static readonly Regex SlugSeparatorRegex = new(
        @"[^\p{L}\p{N}]+",
        RegexOptions.Compiled
    );

    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProductService> _logger;
    private readonly IProductImageStorage _imageStorage;
    private readonly ICurrentCustomerAccessor _currentCustomer;
    private readonly IDefaultCustomerTypeResolver _defaultCustomerType;
    private readonly IRecordDeletionPolicy _deletionPolicy;

    public ProductService(
        ApplicationDbContext context,
        IProductImageStorage imageStorage,
        ILogger<ProductService> logger,
        ICurrentCustomerAccessor currentCustomer,
        IDefaultCustomerTypeResolver defaultCustomerType,
        IRecordDeletionPolicy deletionPolicy)
    {
        _context = context;
        _imageStorage = imageStorage;
        _logger = logger;
        _currentCustomer = currentCustomer;
        _defaultCustomerType = defaultCustomerType;
        _deletionPolicy = deletionPolicy;
    }

    public async Task<PagedResult<ProductListItemResponse>> GetAsync(ProductFilter filter)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var defaultType = await _defaultCustomerType.GetAsync();
        var requestedTypeId = await _currentCustomer.GetCustomerTypeIdAsync();
        var effectiveTypeId = requestedTypeId ?? defaultType.Id;

        IQueryable<Product> products = _context.Products
            .AsNoTracking()
            .Where(product => !product.IsDeleted);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim();
            products = products.Where(product =>
                product.Name.Contains(search) ||
                (product.Strength != null && product.Strength.Contains(search)) ||
                (product.Barcode != null && product.Barcode.Contains(search)) ||
                product.UnitConversions.Any(unit => unit.IsActive && unit.Barcode != null && unit.Barcode.Contains(search)));
        }

        if (filter.Ids is { Length: > 0 })
        {
            var productIds = filter.Ids.Distinct().ToArray();
            products = products.Where(product => productIds.Contains(product.Id));
        }

        if (filter.CategoryId.HasValue)
        {
            var categoryIds = await GetCategoryTreeIdsAsync(filter.CategoryId.Value);
            products = products.Where(product => categoryIds.Contains(product.CategoryId));
        }

        if (filter.BrandId.HasValue) products = products.Where(product => product.BrandId == filter.BrandId);
        if (filter.UnitId.HasValue) products = products.Where(product => product.UnitId == filter.UnitId || product.UnitConversions.Any(unit => unit.IsActive && unit.UnitId == filter.UnitId));
        if (filter.IsFeatured.HasValue) products = products.Where(product => product.IsFeatured == filter.IsFeatured);
        if (filter.IsActive.HasValue) products = products.Where(product => product.IsActive == filter.IsActive);
        if (filter.InStock.HasValue)
        {
            products = filter.InStock.Value
                ? products.Where(product => product.UsesDisplayStock
                    ? (product.DisplayStockQuantity ?? 0) >= (product.OrderQuantityStep > 0 ? product.OrderQuantityStep : 1)
                    : product.Inventory != null &&
                      product.Inventory.Quantity - product.Inventory.ReservedQuantity -
                      (_context.InventoryLots
                          .Where(lot => lot.ProductId == product.Id &&
                              lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                              lot.Quantity - lot.ReservedQuantity > 0)
                          .Sum(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity)) ?? 0) >=
                          (product.OrderQuantityStep > 0 ? product.OrderQuantityStep : 1))
                : products.Where(product => product.UsesDisplayStock
                    ? (product.DisplayStockQuantity ?? 0) < (product.OrderQuantityStep > 0 ? product.OrderQuantityStep : 1)
                    : product.Inventory == null ||
                      product.Inventory.Quantity - product.Inventory.ReservedQuantity -
                      (_context.InventoryLots
                          .Where(lot => lot.ProductId == product.Id &&
                              lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                              lot.Quantity - lot.ReservedQuantity > 0)
                          .Sum(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity)) ?? 0) <
                          (product.OrderQuantityStep > 0 ? product.OrderQuantityStep : 1));
        }

        // Keep the expensive list projection (reviews, images, inventory lots and prices)
        // off the COUNT and pagination query. This matters a lot when the API and SQL
        // Server are separated by a network because only the requested page pays for
        // those correlated lookups.
        var pageQuery = products.Select(product => new ProductPageProjection
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Prices
                .Where(price => price.CustomerTypeId == effectiveTypeId)
                .Select(price => (decimal?)(price.SalePrice.HasValue &&
                    (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                    (!price.EndDate.HasValue || price.EndDate.Value >= today)
                        ? price.SalePrice.Value
                        : price.RegularPrice))
                .FirstOrDefault()
                ?? product.Prices
                    .Where(price => price.CustomerTypeId == defaultType.Id)
                    .Select(price => (decimal?)(price.SalePrice.HasValue &&
                        (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                        (!price.EndDate.HasValue || price.EndDate.Value >= today)
                            ? price.SalePrice.Value
                            : price.RegularPrice))
                    .FirstOrDefault()
        });

        if (filter.MinPrice.HasValue) pageQuery = pageQuery.Where(product => product.Price >= filter.MinPrice.Value);
        if (filter.MaxPrice.HasValue) pageQuery = pageQuery.Where(product => product.Price <= filter.MaxPrice.Value);

        pageQuery = filter.SortBy?.ToLowerInvariant() switch
        {
            "name" => filter.SortDescending ? pageQuery.OrderByDescending(product => product.Name) : pageQuery.OrderBy(product => product.Name),
            "price" => filter.SortDescending ? pageQuery.OrderByDescending(product => product.Price) : pageQuery.OrderBy(product => product.Price),
            "createdat" => filter.SortDescending ? pageQuery.OrderByDescending(product => product.Id) : pageQuery.OrderBy(product => product.Id),
            _ => pageQuery.OrderByDescending(product => product.Id)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var total = await pageQuery.CountAsync();
        var pageIds = await pageQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(product => product.Id)
            .ToListAsync();

        var query = products
            .Where(product => pageIds.Contains(product.Id))
            .Select(product => new ProductListProjection
        {
            Id = product.Id,
            Name = product.Name,
            Barcode = product.Barcode,
            Strength = product.Strength,
            ShortDescription = product.ShortDescription,
            Description = product.Description,
            Slug = product.Slug,
            CategoryId = product.CategoryId,
            CategoryName = product.Category.Name,
            BrandId = product.BrandId,
            UnitId = product.UnitId,
            UnitName = product.Unit == null ? null : product.Unit.Name,
            MinimumValue = product.MinimumValue,
            MaximumValue = product.MaximumValue,
            OrderQuantityStep = product.OrderQuantityStep,
            UsesDisplayStock = product.UsesDisplayStock,
            DisplayStockQuantity = product.DisplayStockQuantity,
            IsFeatured = product.IsFeatured,
            IsActive = product.IsActive,
            InventoryStock = product.Inventory == null ? 0 : product.Inventory.Quantity - product.Inventory.ReservedQuantity,
            Stock = product.UsesDisplayStock
                ? product.DisplayStockQuantity ?? 0
                : product.Inventory == null
                    ? 0
                    : product.Inventory.Quantity - product.Inventory.ReservedQuantity -
                      (_context.InventoryLots
                          .Where(lot => lot.ProductId == product.Id &&
                              lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                              lot.Quantity - lot.ReservedQuantity > 0)
                          .Sum(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity)) ?? 0),
            HasRequestedPrice = product.Prices.Any(price => price.CustomerTypeId == effectiveTypeId),
            Price = product.Prices
                .Where(price => price.CustomerTypeId == effectiveTypeId)
                .Select(price => (decimal?)(price.SalePrice.HasValue &&
                    (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                    (!price.EndDate.HasValue || price.EndDate.Value >= today)
                        ? price.SalePrice.Value
                        : price.RegularPrice))
                .FirstOrDefault()
                ?? product.Prices
                    .Where(price => price.CustomerTypeId == defaultType.Id)
                    .Select(price => (decimal?)(price.SalePrice.HasValue &&
                        (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                        (!price.EndDate.HasValue || price.EndDate.Value >= today)
                            ? price.SalePrice.Value
                            : price.RegularPrice))
                    .FirstOrDefault(),
            OldPrice = product.Prices
                .Where(price => price.CustomerTypeId == effectiveTypeId)
                .Select(price => price.SalePrice.HasValue &&
                    (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                    (!price.EndDate.HasValue || price.EndDate.Value >= today)
                        ? (decimal?)price.RegularPrice
                        : null)
                .FirstOrDefault()
                ?? product.Prices
                    .Where(price => price.CustomerTypeId == defaultType.Id)
                    .Select(price => price.SalePrice.HasValue &&
                        (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                        (!price.EndDate.HasValue || price.EndDate.Value >= today)
                            ? (decimal?)price.RegularPrice
                            : null)
                    .FirstOrDefault(),
            PriceCustomerTypeName = product.Prices
                .Where(price => price.CustomerTypeId == effectiveTypeId)
                .Select(price => price.CustomerType.Name)
                .FirstOrDefault()
                ?? product.Prices
                    .Where(price => price.CustomerTypeId == defaultType.Id)
                    .Select(price => price.CustomerType.Name)
                    .FirstOrDefault(),
            ViewCount = product.ViewCount,
            ReviewCount = _context.ProductReviews.Count(review => review.ProductId == product.Id && review.IsApproved && !review.IsDeleted),
            AverageRating = _context.ProductReviews
                .Where(review => review.ProductId == product.Id && review.IsApproved && !review.IsDeleted)
                .Select(review => (double?)review.Rating)
                .Average() ?? 0,
            PrimaryImageUrl = product.Images
                .Where(image => image.IsPrimary)
                .Select(image => "/" + image.ImagePath.Replace("\\", "/"))
                .FirstOrDefault(),
            Images = product.Images
                .OrderByDescending(image => image.IsPrimary)
                .ThenBy(image => image.SortOrder)
                .Select(image => new ProductListImageResponse(
                    image.Id,
                    "/" + image.ImagePath.Replace("\\", "/"),
                    image.IsPrimary,
                    image.SortOrder))
                .ToList()
        });

        List<ProductListProjection> loadedRows = pageIds.Count == 0
            ? []
            : await query.ToListAsync();
        var rowsById = loadedRows.ToDictionary(product => product.Id);
        var rows = pageIds
            .Where(rowsById.ContainsKey)
            .Select(id => rowsById[id])
            .ToList();

        return new PagedResult<ProductListItemResponse>
        {
            Items = rows.Select(product => new ProductListItemResponse(
                product.Id,
                product.Name,
                product.Barcode,
                product.Strength,
                product.ShortDescription,
                product.Description,
                product.Slug,
                product.CategoryId,
                product.CategoryName,
                product.BrandId,
                product.UnitId,
                product.UnitName,
                product.MinimumValue,
                product.MaximumValue,
                product.OrderQuantityStep,
                product.UsesDisplayStock,
                product.DisplayStockQuantity,
                product.IsFeatured,
                product.IsActive,
                Math.Max(0, product.Stock),
                Math.Max(0, product.InventoryStock),
                product.Price,
                product.OldPrice,
                product.PriceCustomerTypeName,
                effectiveTypeId == defaultType.Id || !product.HasRequestedPrice,
                product.ViewCount,
                product.AverageRating,
                product.ReviewCount,
                product.PrimaryImageUrl,
                product.Images)).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<BulkUpdateProductsResponse> UpdateBulkAsync(
        BulkUpdateProductsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Products.Count == 0 || request.Products.Count > MaximumBatchSize)
            throw new ProductValidationException(new Dictionary<string, string[]>
            {
                ["Products"] = ["Between 1 and 50 products is required."]
            });

        var duplicateIds = request.Products.GroupBy(x => x.Id).Where(x => x.Count() > 1).Select(x => x.Key).ToArray();
        if (duplicateIds.Length > 0)
            throw new ProductConflictException($"Duplicate product IDs: {string.Join(", ", duplicateIds)}");

        var ids = request.Products.Select(x => x.Id).ToArray();
        var products = await _context.Products
            .Include(x => x.Images)
            .Include(x => x.Prices)
            .Include(x => x.UnitConversions)
            .Include(x => x.Inventory)
            .Where(x => ids.Contains(x.Id) && !x.IsDeleted)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var missingIds = ids.Where(id => !products.ContainsKey(id)).ToArray();
        if (missingIds.Length > 0)
            throw new ProductValidationException(new Dictionary<string, string[]>
            {
                ["Products"] = [$"Products not found: {string.Join(", ", missingIds)}"]
            });

        var validationItems = request.Products.Select((item, index) => new NormalizedProductItem(
            index,
            new CreateBulkProductItemRequest { CategoryId = item.CategoryId, BrandId = item.BrandId, UnitId = item.UnitId, UnitConversions = item.UnitConversions },
            item.Name.Trim(),
            NormalizeOptional(item.Barcode),
            null,
            null)).ToList();
        await ValidateGeneralTypeIdsAsync(validationItems, cancellationToken);

        var requestedBarcodes = request.Products
            .SelectMany(item => new[] { NormalizeOptional(item.Barcode) }
                .Concat(item.UnitConversions.Select(conversion => NormalizeOptional(conversion.Barcode))))
            .Where(barcode => barcode is not null)
            .Select(barcode => barcode!)
            .ToArray();
        var duplicates = requestedBarcodes
            .GroupBy(barcode => barcode, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();
        if (duplicates.Length > 0)
            throw new ProductConflictException($"Duplicate product or selling-unit barcodes in request: {string.Join(", ", duplicates)}");

        if (requestedBarcodes.Length > 0)
        {
            var productBarcodeConflict = await _context.Products.AsNoTracking()
                .AnyAsync(product => !ids.Contains(product.Id) && product.Barcode != null && requestedBarcodes.Contains(product.Barcode), cancellationToken);
            var unitBarcodeConflict = await _context.ProductUnitConversions.AsNoTracking()
                .AnyAsync(unit => !ids.Contains(unit.ProductId) && unit.Barcode != null && requestedBarcodes.Contains(unit.Barcode), cancellationToken);
            if (productBarcodeConflict || unitBarcodeConflict)
                throw new ProductConflictException("One or more product or selling-unit barcodes already belong to another product.");
        }

        var requestedSlugs = request.Products
            .Where(x => !string.IsNullOrWhiteSpace(x.Slug))
            .Select(x => x.Slug!.Trim()).ToArray();
        var duplicateSlugs = requestedSlugs.GroupBy(x => x, StringComparer.OrdinalIgnoreCase)
            .Where(x => x.Count() > 1).Select(x => x.Key).ToArray();
        if (duplicateSlugs.Length > 0)
            throw new ProductConflictException($"Duplicate slugs in request: {string.Join(", ", duplicateSlugs)}");
        var slugConflict = await _context.Products.AsNoTracking()
            .AnyAsync(x => !ids.Contains(x.Id) && x.Slug != null && requestedSlugs.Contains(x.Slug), cancellationToken);
        if (slugConflict)
            throw new ProductConflictException("One or more slugs already belong to another product.");

        var customerTypeIds = await _context.Types
            .AsNoTracking()
            .Where(type => type.Group == GeneralTypeEnum.CustomerType && !type.IsDeleted)
            .Select(type => type.Id)
            .ToListAsync(cancellationToken);
        var defaultCustomerTypeId = await _defaultCustomerType.GetIdAsync(cancellationToken);
        foreach (var item in request.Products)
            if (item.Prices.Count > 0)
                ValidatePriceItems(item.Prices, customerTypeIds, defaultCustomerTypeId, $"Products[{item.Id}].Prices");

        var storedImages = new List<StoredProductImage>();
        var oldImagePaths = new List<string>();
        try
        {
            foreach (var item in request.Products)
            {
                if (string.IsNullOrWhiteSpace(item.Name) ||
                    !item.UnitId.HasValue || item.UnitId.Value <= 0 ||
                    (item.MinimumValue.HasValue && item.MaximumValue.HasValue && item.MinimumValue > item.MaximumValue) ||
                    item.OrderQuantityStep <= 0 ||
                    item.MinimumStockQuantity < 0 ||
                    (item.UsesDisplayStock && !item.DisplayStockQuantity.HasValue) ||
                    (item.DisplayStockQuantity.HasValue && item.DisplayStockQuantity < 0))
                    throw new ProductValidationException(new Dictionary<string, string[]>
                    {
                        ["Products"] = ["Names and base inventory units are required, maximum value must be at least minimum value, order quantity step must be greater than zero, minimum stock cannot be negative, and display stock requires a non-negative customer-visible quantity."]
                    });

                ValidateUnitConversions(item.UnitId, item.UnitConversions, $"Products[{item.Id}].UnitConversions");

                var product = products[item.Id];
                product.Name = item.Name.Trim();
                product.Barcode = NormalizeOptional(item.Barcode);
                product.Strength = NormalizeOptional(item.Strength);
                product.ShortDescription = NormalizeOptional(item.ShortDescription);
                product.Description = NormalizeOptional(item.Description);
                product.Slug = NormalizeOptional(item.Slug);
                product.CategoryId = item.CategoryId;
                product.BrandId = item.BrandId;
                product.UnitId = item.UnitId;
                product.MinimumValue = item.MinimumValue;
                product.MaximumValue = item.MaximumValue;
                product.OrderQuantityStep = item.OrderQuantityStep;
                product.UsesDisplayStock = item.UsesDisplayStock;
                product.DisplayStockQuantity = item.UsesDisplayStock
                    ? item.DisplayStockQuantity ?? 0
                    : null;
                product.Inventory ??= new ProductInventory
                {
                    Quantity = 0,
                    ReservedQuantity = 0
                };
                product.Inventory.MinimumQuantity = item.MinimumStockQuantity;
                product.IsFeatured = item.IsFeatured;
                product.IsActive = item.IsActive;
                product.UpdatedAt = DateTime.UtcNow;

                if (item.Prices.Count > 0)
                    ReplacePrices(product, item.Prices);

                ReplaceUnitConversions(product, item.UnitId, item.UnitConversions);

                if (item.RemovedImageIds.Count > 0)
                {
                    var removableImages = product.Images
                        .Where(image => item.RemovedImageIds.Contains(image.Id) && !image.IsPrimary)
                        .ToList();
                    if (removableImages.Count != item.RemovedImageIds.Distinct().Count())
                        throw new ProductValidationException(new Dictionary<string, string[]> { ["Products"] = [$"One or more gallery images do not belong to product '{product.Name}' or are primary images."] });

                    foreach (var removedImage in removableImages)
                    {
                        oldImagePaths.Add(removedImage.ImagePath);
                        product.Images.Remove(removedImage);
                    }
                }

                if (item.Image is not null)
                {
                    var stored = await _imageStorage.SaveAsync(item.Image, cancellationToken);
                    storedImages.Add(stored);
                    foreach (var oldImage in product.Images.Where(x => x.IsPrimary).ToList())
                    {
                        oldImagePaths.Add(oldImage.ImagePath);
                        // Product images are soft-deleted by ApplicationDbContext. Clear the
                        // primary flag before removing the old row so the filtered unique
                        // index never conflicts with the replacement image.
                        oldImage.IsPrimary = false;
                        product.Images.Remove(oldImage);
                    }
                    product.Images.Add(new ProductImage
                    {
                        ImagePath = stored.RelativePath,
                        FileName = stored.FileName,
                        OriginalFileName = Path.GetFileName(item.Image.FileName),
                        ContentType = stored.ContentType,
                        Size = stored.Size,
                        IsPrimary = true,
                        SortOrder = 0
                    });
                }

                if (item.GalleryImages.Count > 0)
                {
                    var currentImageCount = product.Images.Count;
                    if (currentImageCount + item.GalleryImages.Count > 10)
                        throw new ProductValidationException(new Dictionary<string, string[]> { ["Products"] = [$"Product '{product.Name}' cannot have more than 10 images."] });

                    var nextSortOrder = product.Images.Where(x => !x.IsPrimary).Select(x => x.SortOrder).DefaultIfEmpty(0).Max() + 1;
                    foreach (var galleryImage in item.GalleryImages)
                    {
                        var stored = await _imageStorage.SaveAsync(galleryImage, cancellationToken);
                        storedImages.Add(stored);
                        product.Images.Add(new ProductImage
                        {
                            ImagePath = stored.RelativePath,
                            FileName = stored.FileName,
                            OriginalFileName = Path.GetFileName(galleryImage.FileName),
                            ContentType = stored.ContentType,
                            Size = stored.Size,
                            IsPrimary = false,
                            SortOrder = nextSortOrder++
                        });
                    }
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteStoredImagesAsync(storedImages);
            throw;
        }

        foreach (var path in oldImagePaths.Distinct())
        {
            try { await _imageStorage.DeleteAsync(path, CancellationToken.None); }
            catch (Exception exception) { _logger.LogWarning(exception, "Failed to remove replaced product image {ImagePath}.", path); }
        }

        return new BulkUpdateProductsResponse(request.Products.Count);
    }

    public Task<ProductDetailsDto?> GetByIdAsync(long id) =>
        TransientSqlRetry.ExecuteAsync(
            cancellationToken => GetDetailsCoreAsync(product => product.Id == id, cancellationToken),
            CancellationToken.None);

    public Task<ProductDetailsDto?> GetBySlugAsync(string slug)
    {
        var normalized = slug.Trim();
        return TransientSqlRetry.ExecuteAsync(
            cancellationToken => GetDetailsCoreAsync(product => product.Slug == normalized, cancellationToken),
            CancellationToken.None);
    }

    private async Task<ProductDetailsDto?> GetDetailsCoreAsync(
        System.Linq.Expressions.Expression<Func<Product, bool>> predicate,
        CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .AsNoTracking()
            .Include(entity => entity.Category)
            .Include(entity => entity.Brand)
            .Include(entity => entity.Unit)
            .Include(entity => entity.UnitConversions)
                .ThenInclude(conversion => conversion.Unit)
            .Include(entity => entity.Inventory)
            .Include(entity => entity.Images)
            .Include(entity => entity.Prices)
                .ThenInclude(price => price.CustomerType)
            .Where(entity => !entity.IsDeleted)
            .FirstOrDefaultAsync(predicate, cancellationToken);

        if (product is null) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var defaultType = await _defaultCustomerType.GetAsync(cancellationToken);
        var requestedTypeId = await _currentCustomer.GetCustomerTypeIdAsync(cancellationToken);
        var effectiveTypeId = requestedTypeId ?? defaultType.Id;
        var resolved = ResolvePrice(product.Prices, effectiveTypeId, defaultType.Id, today);
        var expiredAvailableQuantity = product.Inventory is null
            ? 0
            : await _context.InventoryLots
                .AsNoTracking()
                .Where(lot => lot.ProductId == product.Id &&
                    lot.ExpiresAt.HasValue && lot.ExpiresAt.Value < today &&
                              lot.Quantity - lot.ReservedQuantity > 0)
                .SumAsync(lot => (decimal?)(lot.Quantity - lot.ReservedQuantity), cancellationToken) ?? 0;
        var physicalAvailableQuantity = product.Inventory is null
            ? 0
            : InventoryAvailability.PhysicalAvailable(
                product.Inventory.Quantity,
                product.Inventory.ReservedQuantity);
        var sellableAvailableQuantity = product.Inventory is null
            ? 0
            : InventoryAvailability.SellableAvailable(
                product.Inventory.Quantity,
                product.Inventory.ReservedQuantity,
                expiredAvailableQuantity);
        var availableBaseQuantity = product.UsesDisplayStock
            ? Math.Max(0, product.DisplayStockQuantity ?? 0)
            : sellableAvailableQuantity;
        var activeConversions = product.UnitConversions
            .Where(conversion => conversion.IsActive)
            .OrderByDescending(conversion => conversion.IsDefault)
            .ThenBy(conversion => conversion.SortOrder)
            .ThenBy(conversion => conversion.Unit.Name)
            .ToList();
        var unitConversions = new List<ProductUnitConversionResponse>();
        if (product.UnitId.HasValue && product.Unit is not null)
        {
            unitConversions.Add(new ProductUnitConversionResponse(
                null,
                product.UnitId.Value,
                product.Unit.Name,
                1,
                product.Barcode,
                null,
                null,
                product.OrderQuantityStep <= 0 ? 1 : product.OrderQuantityStep,
                true,
                activeConversions.All(conversion => !conversion.IsDefault),
                true,
                -1,
                availableBaseQuantity,
                resolved?.Price,
                resolved?.OldPrice));
        }

        unitConversions.AddRange(activeConversions.Select(conversion =>
        {
            var factor = conversion.ConversionFactor <= 0 ? 1 : conversion.ConversionFactor;
            var convertedPrice = conversion.PriceOverride ?? (resolved is null ? null : decimal.Round(resolved.Price * factor, 2));
            var convertedOldPrice = conversion.OldPriceOverride
                ?? (resolved?.OldPrice is null ? null : decimal.Round(resolved.OldPrice.Value * factor, 2));
            return new ProductUnitConversionResponse(
                conversion.Id,
                conversion.UnitId,
                conversion.Unit.Name,
                factor,
                conversion.Barcode,
                conversion.PriceOverride,
                conversion.OldPriceOverride,
                conversion.OrderQuantityStep <= 0 ? 1 : conversion.OrderQuantityStep,
                false,
                conversion.IsDefault,
                conversion.IsActive,
                conversion.SortOrder,
                decimal.Round(availableBaseQuantity / factor, 3),
                convertedPrice,
                convertedOldPrice);
        }));

        return new ProductDetailsDto
        {
            Id = product.Id,
            Name = product.Name,
            Barcode = product.Barcode,
            Strength = product.Strength,
            Description = product.Description,
            ShortDescription = product.ShortDescription,
            Slug = product.Slug,
            MinimumValue = product.MinimumValue,
            MaximumValue = product.MaximumValue,
            OrderQuantityStep = product.OrderQuantityStep,
            UsesDisplayStock = product.UsesDisplayStock,
            DisplayStockQuantity = product.DisplayStockQuantity,
            InventoryStock = physicalAvailableQuantity,
            Stock = product.UsesDisplayStock
                ? Math.Max(0, product.DisplayStockQuantity ?? 0)
                : sellableAvailableQuantity,
            CategoryId = product.CategoryId,
            CategoryName = product.Category.Name,
            BrandId = product.BrandId,
            BrandName = product.Brand?.Name,
            UnitId = product.UnitId,
            UnitName = product.Unit?.Name,
            UnitConversions = unitConversions,
            IsActive = product.IsActive,
            IsFeatured = product.IsFeatured,
            ViewCount = product.ViewCount,
            ReviewCount = await _context.ProductReviews.CountAsync(review => review.ProductId == product.Id && review.IsApproved && !review.IsDeleted, cancellationToken),
            AverageRating = await _context.ProductReviews
                .Where(review => review.ProductId == product.Id && review.IsApproved && !review.IsDeleted)
                .Select(review => (double?)review.Rating)
                .AverageAsync(cancellationToken) ?? 0,
            Price = resolved?.Price,
            OldPrice = resolved?.OldPrice,
            PriceCustomerTypeId = resolved?.CustomerTypeId,
            PriceCustomerTypeName = resolved?.CustomerTypeName,
            IsDefaultPrice = resolved is not null && resolved.CustomerTypeId == defaultType.Id,
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt,
            Inventory = product.Inventory is null ? null : new ProductInventoryDetailsDto(
                product.Inventory.Quantity,
                product.Inventory.ReservedQuantity,
                sellableAvailableQuantity,
                product.Inventory.MinimumQuantity,
                product.Inventory.ExpireDate),
            Images = product.Images
                .OrderBy(image => image.SortOrder)
                .Select(image => new ProductImageDetailsDto(
                    image.Id,
                    "/" + image.ImagePath.Replace("\\", "/"),
                    image.OriginalFileName,
                    image.ContentType,
                    image.Size,
                    image.IsPrimary,
                    image.SortOrder))
                .ToList(),
            Prices = _currentCustomer.IsAdmin
                ? product.Prices
                    .OrderBy(price => price.CustomerType.SortOrder)
                    .ThenBy(price => price.CustomerType.Name)
                    .Select(price => new ProductPriceDetailsDto(
                        price.Id,
                        price.CustomerTypeId,
                        price.CustomerType.Name,
                        price.RegularPrice,
                        price.SalePrice,
                        price.StartDate,
                        price.EndDate,
                        price.CustomerTypeId == defaultType.Id))
                    .ToList()
                : []
        };
    }

    public async Task<long> IncrementViewCountAsync(
        long id,
        CancellationToken cancellationToken = default)
    {
        var affected = await _context.Products
            .Where(product => product.Id == id && product.IsActive)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(product => product.ViewCount, product => product.ViewCount + 1),
                cancellationToken);

        if (affected == 0)
            throw new KeyNotFoundException("Product not found.");

        return await _context.Products
            .AsNoTracking()
            .Where(product => product.Id == id)
            .Select(product => product.ViewCount)
            .SingleAsync(cancellationToken);
    }

    public async Task<long> CreateAsync(Product model)
    {
        model.CreatedAt = DateTime.UtcNow;

        _context.Products.Add(model);

        await _context.SaveChangesAsync();

        return model.Id;
    }

    public async Task UpdateAsync(long id, Product model)
    {
        var entity = await _context.Products
            .Include(x => x.Images)
            .Include(x => x.Prices)
            .Include(x => x.UnitConversions)
            .Include(x => x.Inventory)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (entity == null)
            throw new KeyNotFoundException("Product not found.");

        entity.Name = model.Name;
        entity.Barcode = model.Barcode;
        entity.Strength = model.Strength;
        entity.Slug = model.Slug;
        entity.ShortDescription = model.ShortDescription;
        entity.Description = model.Description;

        entity.CategoryId = model.CategoryId;
        entity.BrandId = model.BrandId;
        entity.UnitId = model.UnitId;

        entity.IsActive = model.IsActive;
        entity.IsFeatured = model.IsFeatured;

        entity.MinimumValue = model.MinimumValue;
        entity.MaximumValue = model.MaximumValue;
        entity.OrderQuantityStep = model.OrderQuantityStep <= 0 ? 1 : model.OrderQuantityStep;
        entity.UsesDisplayStock = model.UsesDisplayStock;
        entity.DisplayStockQuantity = model.UsesDisplayStock
            ? model.DisplayStockQuantity ?? 0
            : null;

        entity.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(long id)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(x => x.Id == id);

        if (product == null)
            throw new KeyNotFoundException("Product not found.");

        await _deletionPolicy.EnsureProductCanBeArchivedAsync(id);

        product.IsDeleted = true;
        product.DeletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task ToggleStatusAsync(long id)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (product == null)
            throw new KeyNotFoundException("Product not found.");

        product.IsActive = !product.IsActive;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }




    public async Task<CreateBulkProductsResponse> CreateBulkAsync(
        CreateBulkProductsRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ValidateRequest(request);

        var items = request.Products
            .Select((item, index) => new NormalizedProductItem(
                Index: index,
                Request: item,
                Name: item.Name.Trim(),
                Barcode: NormalizeOptional(item.Barcode),
                ShortDescription: NormalizeOptional(
                    item.ShortDescription
                ),
                Description: NormalizeOptional(
                    item.Description
                )
            ))
            .ToList();

        await ValidateGeneralTypeIdsAsync(
            items,
            cancellationToken
        );

        await ValidateBarcodesAsync(
            items,
            cancellationToken
        );

        var customerTypeIds = await _context.Types
            .AsNoTracking()
            .Where(type => type.Group == GeneralTypeEnum.CustomerType && !type.IsDeleted)
            .Select(type => type.Id)
            .ToListAsync(cancellationToken);
        var defaultCustomerTypeId = await _defaultCustomerType.GetIdAsync(cancellationToken);
        foreach (var item in request.Products.Select((value, index) => new { value, index }))
            ValidatePriceItems(item.value.Prices, customerTypeIds, defaultCustomerTypeId, $"Products[{item.index}].Prices");

        var reservedSlugs = new HashSet<string>(
            StringComparer.OrdinalIgnoreCase
        );

        var preparedItems = new List<PreparedProductItem>(
            items.Count
        );

        foreach (var item in items)
        {
            var slugSource = string.IsNullOrWhiteSpace(
                item.Request.Slug
            )
                ? item.Name
                : item.Request.Slug.Trim();

            var slug = await GenerateUniqueSlugAsync(
                slugSource,
                reservedSlugs,
                cancellationToken
            );

            preparedItems.Add(
                new PreparedProductItem(
                    Item: item,
                    Slug: slug
                )
            );
        }

        var storedImages = new List<StoredProductImage>();
        var primaryStoredImages = new List<StoredProductImage>();
        var products = new List<Product>();

        try
        {
            foreach (var preparedItem in preparedItems)
            {
                var item = preparedItem.Item;

                var storedImage =
                    await _imageStorage.SaveAsync(
                        item.Request.Image!,
                        cancellationToken
                    );

                storedImages.Add(storedImage);
                primaryStoredImages.Add(storedImage);

                var product = new Product
                {
                    Name = item.Name,
                    Barcode = item.Barcode,
                    Strength = NormalizeOptional(item.Request.Strength),
                    ShortDescription =
                        item.ShortDescription,
                    Description = item.Description,

                    MinimumValue =
                        item.Request.MinimumValue,
                    MaximumValue =
                        item.Request.MaximumValue,
                    OrderQuantityStep = item.Request.OrderQuantityStep,
                    UsesDisplayStock = item.Request.UsesDisplayStock,
                    DisplayStockQuantity = item.Request.UsesDisplayStock
                        ? item.Request.DisplayStockQuantity ?? 0
                        : null,

                    CategoryId =
                        item.Request.CategoryId,
                    BrandId =
                        item.Request.BrandId,
                    UnitId =
                        item.Request.UnitId,

                    IsFeatured =
                        item.Request.IsFeatured,
                    IsActive =
                        item.Request.IsActive,

                    Slug = preparedItem.Slug,
                    ViewCount = 0,

                    Inventory = new ProductInventory
                    {
                        Quantity = 0,
                        ReservedQuantity = 0,
                        MinimumQuantity = item.Request.MinimumStockQuantity
                    }
                };

                foreach (var price in item.Request.Prices)
                    product.Prices.Add(CreatePrice(price));

                foreach (var conversion in NormalizeUnitConversions(item.Request.UnitId, item.Request.UnitConversions))
                    product.UnitConversions.Add(CreateUnitConversion(conversion));

                product.Images.Add(
                    new ProductImage
                    {
                        ImagePath =
                            storedImage.RelativePath,

                        FileName =
                            storedImage.FileName,

                        OriginalFileName =
                            Path.GetFileName(
                                item.Request.Image!.FileName
                            ),

                        ContentType =
                            storedImage.ContentType,

                        Size =
                            storedImage.Size,

                        IsPrimary = true,
                        SortOrder = 0
                    }
                );

                for (var imageIndex = 0; imageIndex < item.Request.GalleryImages.Count; imageIndex++)
                {
                    var galleryFile = item.Request.GalleryImages[imageIndex];
                    var galleryImage = await _imageStorage.SaveAsync(galleryFile, cancellationToken);
                    storedImages.Add(galleryImage);
                    product.Images.Add(new ProductImage
                    {
                        ImagePath = galleryImage.RelativePath,
                        FileName = galleryImage.FileName,
                        OriginalFileName = Path.GetFileName(galleryFile.FileName),
                        ContentType = galleryImage.ContentType,
                        Size = galleryImage.Size,
                        IsPrimary = false,
                        SortOrder = imageIndex + 1
                    });
                }

                products.Add(product);
            }

            await using var transaction =
                await _context.Database
                    .BeginTransactionAsync(
                        cancellationToken
                    );

            try
            {
                await _context.Set<Product>()
                    .AddRangeAsync(
                        products,
                        cancellationToken
                    );

                await _context.SaveChangesAsync(
                    cancellationToken
                );

                await transaction.CommitAsync(
                    cancellationToken
                );
            }
            catch
            {
                await transaction.RollbackAsync(
                    CancellationToken.None
                );

                throw;
            }

            var responseProducts = products
                .Select((product, index) =>
                    new CreatedProductResponse(
                        Id: product.Id,
                        Name: product.Name,
                        Barcode: product.Barcode,
                        Slug: product.Slug!,
                        PrimaryImageUrl:
                            primaryStoredImages[index].PublicUrl
                    )
                )
                .ToList();

            return new CreateBulkProductsResponse(
                CreatedCount: products.Count,
                Products: responseProducts
            );
        }
        catch (DbUpdateException exception)
            when (IsUniqueConstraintViolation(exception))
        {
            await DeleteStoredImagesAsync(
                storedImages
            );

            throw new ProductConflictException(
                "A product with the same barcode or slug already exists.",
                exception
            );
        }
        catch
        {
            await DeleteStoredImagesAsync(
                storedImages
            );

            throw;
        }
    }

    public async Task<ProductLookupsResponse> GetLookupsAsync(
        CancellationToken cancellationToken = default
    )
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        /*
         * Rename `Type` and these enum members to match
         * your existing GeneralType model.
         *
         * Example expected values:
         * GeneralTypeEnum.ProductCategory
         * GeneralTypeEnum.ProductBrand
         * GeneralTypeEnum.ProductUnit
         */

        var generalTypes = await _context
            .Set<GeneralType>()
            .AsNoTracking()
            .Where(x =>
                 x.Group == GeneralTypeEnum.ProductCategory ||
                 x.Group == GeneralTypeEnum.ProductBrand ||
                 x.Group == GeneralTypeEnum.ProductUnit ||
                 x.Group == GeneralTypeEnum.CustomerType
            )
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.ImageUrl,
                x.Group,
                x.ParentId
            })
            .ToListAsync(cancellationToken);

        // Aggregate category counts in SQL instead of downloading one CategoryId
        // for every active product. On a hosted database this removes a potentially
        // large result set from the catalog's initial lookup request.
        var categoryStats = await _context
            .Set<Product>()
            .AsNoTracking()
            .Where(x => x.IsActive && !x.IsDeleted)
            .GroupBy(x => x.CategoryId)
            .Select(group => new { CategoryId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.CategoryId, item => item.Count, cancellationToken);

        var categoryTypes = generalTypes
            .Where(x => x.Group == GeneralTypeEnum.ProductCategory)
            .ToList();
        var categoryChildren = categoryTypes.ToLookup(x => x.ParentId);

        int GetProductCount(long categoryId, HashSet<long> path)
        {
            if (!path.Add(categoryId))
            {
                return 0;
            }

            var count = categoryStats.TryGetValue(categoryId, out var directCount)
                ? directCount
                : 0;

            foreach (var child in categoryChildren[categoryId])
            {
                count += GetProductCount(child.Id, path);
            }

            path.Remove(categoryId);
            return count;
        }

        var categories = categoryTypes
            .Select(x =>
                new ProductCategoryLookupItemResponse(
                    x.Id,
                    x.Name,
                    x.ParentId,
                    GetProductCount(x.Id, []),
                    x.ImageUrl
                )
            )
            .ToList();

        var brands = generalTypes
            .Where(x =>
                x.Group == GeneralTypeEnum.ProductBrand
            )
            .Select(x =>
                new ProductLookupItemResponse(
                    x.Id,
                    x.Name
                )
            )
            .ToList();

        var units = generalTypes
            .Where(x =>
                x.Group == GeneralTypeEnum.ProductUnit
            )
            .Select(x =>
                new ProductLookupItemResponse(
                    x.Id,
                    x.Name
                )
            )
            .ToList();

        var customerTypes = generalTypes
            .Where(x => x.Group == GeneralTypeEnum.CustomerType)
            .Select(x => new ProductLookupItemResponse(x.Id, x.Name))
            .ToList();

        var defaultCustomerTypeId = await _defaultCustomerType.GetIdAsync(cancellationToken);
        var requestedCustomerTypeId = await _currentCustomer.GetCustomerTypeIdAsync(cancellationToken);
        var effectiveCustomerTypeId = requestedCustomerTypeId ?? defaultCustomerTypeId;

        // Build the effective price set directly from ProductPrices. This avoids the
        // deeply-correlated Products -> Prices projection that SQL Server could cancel
        // while the catalog and product notification requests were running together.
        var effectivePrices = _context.ProductPrices
            .AsNoTracking()
            .Where(price =>
                price.CustomerTypeId == effectiveCustomerTypeId &&
                price.Product.IsActive &&
                !price.Product.IsDeleted)
            .Select(price => price.SalePrice.HasValue &&
                (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                (!price.EndDate.HasValue || price.EndDate.Value >= today)
                    ? price.SalePrice.Value
                    : price.RegularPrice);

        IQueryable<decimal> resolvedPrices = effectivePrices;
        if (effectiveCustomerTypeId != defaultCustomerTypeId)
        {
            var fallbackPrices = _context.ProductPrices
                .AsNoTracking()
                .Where(price =>
                    price.CustomerTypeId == defaultCustomerTypeId &&
                    price.Product.IsActive &&
                    !price.Product.IsDeleted &&
                    !_context.ProductPrices.Any(candidate =>
                        candidate.ProductId == price.ProductId &&
                        candidate.CustomerTypeId == effectiveCustomerTypeId))
                .Select(price => price.SalePrice.HasValue &&
                    (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
                    (!price.EndDate.HasValue || price.EndDate.Value >= today)
                        ? price.SalePrice.Value
                        : price.RegularPrice);

            resolvedPrices = resolvedPrices.Concat(fallbackPrices);
        }

        var priceRange = await TransientSqlRetry.ExecuteAsync(
            token => resolvedPrices
                .GroupBy(_ => 1)
                .Select(group => new
                {
                    Minimum = group.Min(),
                    Maximum = group.Max()
                })
                .FirstOrDefaultAsync(token),
            cancellationToken);

        var minimumPrice = priceRange?.Minimum ?? 0m;
        var maximumPrice = priceRange?.Maximum ?? minimumPrice;

        return new ProductLookupsResponse(
            Categories: categories,
            Brands: brands,
            Units: units,
            CustomerTypes: customerTypes,
            DefaultCustomerTypeId: defaultCustomerTypeId,
            MinimumPrice: minimumPrice,
            MaximumPrice: maximumPrice
        );
    }

    private static void ValidatePriceItems(
        IReadOnlyCollection<ProductPriceItemRequest> prices,
        IReadOnlyCollection<long> customerTypeIds,
        long defaultCustomerTypeId,
        string key)
    {
        if (prices.Count == 0)
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["A default customer price is required."] });
        if (prices.GroupBy(price => price.CustomerTypeId).Any(group => group.Count() > 1))
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Each customer type may appear only once."] });
        if (!prices.Any(price => price.CustomerTypeId == defaultCustomerTypeId))
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["The default customer type price is required."] });
        foreach (var price in prices)
        {
            if (!customerTypeIds.Contains(price.CustomerTypeId))
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["One or more customer types are invalid or inactive."] });
            if (price.RegularPrice < 0 || price.SalePrice < 0)
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Prices cannot be negative."] });
            if (price.SalePrice.HasValue && price.SalePrice.Value > price.RegularPrice)
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Sale price cannot exceed regular price."] });
            if (price.StartDate.HasValue && price.EndDate.HasValue && price.StartDate > price.EndDate)
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Sale end date must be on or after the start date."] });
        }
    }

    private static ProductPrice CreatePrice(ProductPriceItemRequest price) => new()
    {
        CustomerTypeId = price.CustomerTypeId,
        RegularPrice = price.RegularPrice,
        SalePrice = price.SalePrice,
        StartDate = price.StartDate,
        EndDate = price.EndDate
    };

    private static void ReplacePrices(Product product, IReadOnlyCollection<ProductPriceItemRequest> prices)
    {
        var requestedIds = prices.Select(price => price.CustomerTypeId).ToHashSet();
        foreach (var existing in product.Prices.Where(price => !requestedIds.Contains(price.CustomerTypeId)).ToList())
            product.Prices.Remove(existing);
        foreach (var request in prices)
        {
            var existing = product.Prices.FirstOrDefault(price => price.CustomerTypeId == request.CustomerTypeId);
            if (existing is null)
                product.Prices.Add(CreatePrice(request));
            else
            {
                existing.RegularPrice = request.RegularPrice;
                existing.SalePrice = request.SalePrice;
                existing.StartDate = request.StartDate;
                existing.EndDate = request.EndDate;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }
    }


    private static ProductUnitConversion CreateUnitConversion(ProductUnitConversionRequest conversion) => new()
    {
        UnitId = conversion.UnitId,
        ConversionFactor = conversion.ConversionFactor,
        Barcode = NormalizeOptional(conversion.Barcode),
        PriceOverride = conversion.PriceOverride,
        OldPriceOverride = conversion.OldPriceOverride,
        OrderQuantityStep = conversion.OrderQuantityStep,
        IsDefault = conversion.IsDefault,
        IsActive = conversion.IsActive,
        SortOrder = conversion.SortOrder
    };

    private static IReadOnlyCollection<ProductUnitConversionRequest> NormalizeUnitConversions(
        long? baseUnitId,
        IReadOnlyCollection<ProductUnitConversionRequest> conversions)
    {
        ValidateUnitConversions(baseUnitId, conversions, "UnitConversions");
        return conversions
            .OrderByDescending(item => item.IsDefault)
            .ThenBy(item => item.SortOrder)
            .ToArray();
    }

    private static void ReplaceUnitConversions(
        Product product,
        long? baseUnitId,
        IReadOnlyCollection<ProductUnitConversionRequest> conversions)
    {
        var normalized = NormalizeUnitConversions(baseUnitId, conversions);
        var requestedUnitIds = normalized.Select(item => item.UnitId).ToHashSet();
        foreach (var existing in product.UnitConversions.Where(item => !requestedUnitIds.Contains(item.UnitId)).ToList())
            product.UnitConversions.Remove(existing);

        foreach (var request in normalized)
        {
            var existing = product.UnitConversions.FirstOrDefault(item => item.UnitId == request.UnitId);
            if (existing is null)
            {
                product.UnitConversions.Add(CreateUnitConversion(request));
                continue;
            }

            existing.ConversionFactor = request.ConversionFactor;
            existing.Barcode = NormalizeOptional(request.Barcode);
            existing.PriceOverride = request.PriceOverride;
            existing.OldPriceOverride = request.OldPriceOverride;
            existing.OrderQuantityStep = request.OrderQuantityStep;
            existing.IsDefault = request.IsDefault;
            existing.IsActive = request.IsActive;
            existing.SortOrder = request.SortOrder;
            existing.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static void ValidateUnitConversions(
        long? baseUnitId,
        IReadOnlyCollection<ProductUnitConversionRequest> conversions,
        string key)
    {
        if (conversions.Count == 0) return;
        if (!baseUnitId.HasValue)
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Select a base inventory unit before adding selling units."] });
        if (conversions.GroupBy(item => item.UnitId).Any(group => group.Count() > 1))
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Each selling unit can be configured only once."] });
        if (conversions.Any(item => item.UnitId == baseUnitId.Value))
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["The base unit must not be repeated as a selling-unit conversion."] });
        if (conversions.Count(item => item.IsDefault) > 1)
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Only one selling unit can be the storefront default."] });
        if (conversions.Any(item => item.IsDefault && !item.IsActive))
            throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["The storefront default selling unit must be active."] });
        foreach (var item in conversions)
        {
            if (item.UnitId <= 0 || item.ConversionFactor < 1 || item.OrderQuantityStep <= 0)
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Every selling unit requires a valid unit, a conversion factor of at least one base unit, and an order quantity step greater than zero."] });
            if (item.PriceOverride < 0 || item.OldPriceOverride < 0 ||
                (item.PriceOverride.HasValue && item.OldPriceOverride.HasValue && item.OldPriceOverride < item.PriceOverride))
                throw new ProductValidationException(new Dictionary<string, string[]> { [key] = ["Unit prices cannot be negative and old price cannot be lower than the selling price."] });
        }
    }

    private static ResolvedProductPrice? ResolvePrice(
        IEnumerable<ProductPrice> prices,
        long requestedTypeId,
        long defaultTypeId,
        DateOnly today)
    {
        var selected = prices.FirstOrDefault(price => price.CustomerTypeId == requestedTypeId)
            ?? prices.FirstOrDefault(price => price.CustomerTypeId == defaultTypeId);
        if (selected is null) return null;

        var saleActive = selected.SalePrice.HasValue &&
            (!selected.StartDate.HasValue || selected.StartDate.Value <= today) &&
            (!selected.EndDate.HasValue || selected.EndDate.Value >= today);

        return new ResolvedProductPrice(
            selected.CustomerTypeId,
            selected.CustomerType.Name,
            saleActive ? selected.SalePrice!.Value : selected.RegularPrice,
            saleActive ? selected.RegularPrice : null);
    }

    private sealed record ResolvedProductPrice(
        long CustomerTypeId,
        string CustomerTypeName,
        decimal Price,
        decimal? OldPrice);

    private sealed class ProductPageProjection
    {
        public long Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public decimal? Price { get; init; }
    }

    private sealed class ProductListProjection
    {
        public long Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Barcode { get; init; }
        public string? Strength { get; init; }
        public string? ShortDescription { get; init; }
        public string? Description { get; init; }
        public string? Slug { get; init; }
        public long CategoryId { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public long? BrandId { get; init; }
        public long? UnitId { get; init; }
        public string? UnitName { get; init; }
        public int? MinimumValue { get; init; }
        public int? MaximumValue { get; init; }
        public decimal OrderQuantityStep { get; init; }
        public bool UsesDisplayStock { get; init; }
        public decimal? DisplayStockQuantity { get; init; }
        public bool IsFeatured { get; init; }
        public bool IsActive { get; init; }
        public decimal Stock { get; init; }
        public decimal InventoryStock { get; init; }
        public bool HasRequestedPrice { get; init; }
        public decimal? Price { get; init; }
        public decimal? OldPrice { get; init; }
        public string? PriceCustomerTypeName { get; init; }
        public long ViewCount { get; init; }
        public double AverageRating { get; init; }
        public int ReviewCount { get; init; }
        public string? PrimaryImageUrl { get; init; }
        public IReadOnlyList<ProductListImageResponse> Images { get; init; } = [];
    }

    private static void ValidateRequest(
        CreateBulkProductsRequest request
    )
    {
        var errors =
            new Dictionary<string, List<string>>();

        if (request.Products.Count == 0)
        {
            AddError(
                errors,
                nameof(request.Products),
                "At least one product is required."
            );
        }

        if (request.Products.Count > MaximumBatchSize)
        {
            AddError(
                errors,
                nameof(request.Products),
                $"A maximum of {MaximumBatchSize} products is allowed."
            );
        }

        for (var index = 0;
             index < request.Products.Count;
             index++)
        {
            var product = request.Products[index];

            if (string.IsNullOrWhiteSpace(product.Name))
            {
                AddError(
                    errors,
                    $"Products[{index}].Name",
                    "Product name is required."
                );
            }

            if (product.Image is null ||
                product.Image.Length <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].Image",
                    "Product image is required."
                );
            }

            if (product.GalleryImages.Count > 9)
            {
                AddError(
                    errors,
                    $"Products[{index}].GalleryImages",
                    "A product can have a maximum of 10 images."
                );
            }

            if (product.MinimumValue.HasValue &&
                product.MaximumValue.HasValue &&
                product.MinimumValue.Value >
                product.MaximumValue.Value)
            {
                AddError(
                    errors,
                    $"Products[{index}].MaximumValue",
                    "Maximum value must be greater than or equal to minimum value."
                );
            }

            if (product.OrderQuantityStep <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].OrderQuantityStep",
                    "Order quantity step must be greater than zero."
                );
            }

            if (product.UsesDisplayStock && !product.DisplayStockQuantity.HasValue)
            {
                AddError(
                    errors,
                    $"Products[{index}].DisplayStockQuantity",
                    "Enter the quantity customers should see."
                );
            }

            if (product.DisplayStockQuantity.HasValue && product.DisplayStockQuantity.Value < 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].DisplayStockQuantity",
                    "Display quantity cannot be negative."
                );
            }

            if (product.BrandId is <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].BrandId",
                    "Brand ID must be greater than zero."
                );
            }

            if (!product.UnitId.HasValue || product.UnitId.Value <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].UnitId",
                    "Unit ID must be greater than zero."
                );
            }

            try
            {
                ValidateUnitConversions(product.UnitId, product.UnitConversions, $"Products[{index}].UnitConversions");
            }
            catch (ProductValidationException exception)
            {
                foreach (var error in exception.Errors)
                    foreach (var message in error.Value)
                        AddError(errors, error.Key, message);
            }
        }

        ThrowIfErrorsExist(errors);
    }

    private async Task ValidateGeneralTypeIdsAsync(
        IReadOnlyCollection<NormalizedProductItem> items,
        CancellationToken cancellationToken
    )
    {
        var requestedIds = items
            .SelectMany(x => new long?[]
            {
                x.Request.CategoryId,
                x.Request.BrandId,
                x.Request.UnitId
            }.Concat(x.Request.UnitConversions.Select(conversion => (long?)conversion.UnitId)))
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();

        var existingTypes = await _context
            .Set<GeneralType>()
            .AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Group })
            .ToDictionaryAsync(x => x.Id, x => x.Group, cancellationToken);

        var existingIds = existingTypes.Keys.ToHashSet();

        var errors =
            new Dictionary<string, List<string>>();

        foreach (var item in items)
        {
            if (!existingIds.Contains(
                    item.Request.CategoryId
                ))
            {
                AddError(
                    errors,
                    $"Products[{item.Index}].CategoryId",
                    "The selected category does not exist."
                );
            }

            if (item.Request.BrandId.HasValue &&
                !existingIds.Contains(
                    item.Request.BrandId.Value
                ))
            {
                AddError(
                    errors,
                    $"Products[{item.Index}].BrandId",
                    "The selected brand does not exist."
                );
            }

            if (item.Request.UnitId.HasValue &&
                (!existingTypes.TryGetValue(item.Request.UnitId.Value, out var baseUnitGroup) ||
                 baseUnitGroup != GeneralTypeEnum.ProductUnit))
            {
                AddError(
                    errors,
                    $"Products[{item.Index}].UnitId",
                    "The selected base unit does not exist or is not a product unit."
                );
            }

            foreach (var conversion in item.Request.UnitConversions)
            {
                if (!existingTypes.TryGetValue(conversion.UnitId, out var conversionUnitGroup) ||
                    conversionUnitGroup != GeneralTypeEnum.ProductUnit)
                {
                    AddError(
                        errors,
                        $"Products[{item.Index}].UnitConversions",
                        "One or more selected selling units do not exist or are not product units."
                    );
                }
            }
        }

        ThrowIfErrorsExist(errors);
    }

    private async Task ValidateBarcodesAsync(
        IReadOnlyCollection<NormalizedProductItem> items,
        CancellationToken cancellationToken
    )
    {
        var barcodes = items
            .SelectMany(item => new[] { item.Barcode }
                .Concat(item.Request.UnitConversions.Select(conversion => NormalizeOptional(conversion.Barcode))))
            .Where(barcode => barcode is not null)
            .Select(barcode => barcode!)
            .ToList();

        var duplicateBarcodes = barcodes
            .GroupBy(
                x => x,
                StringComparer.OrdinalIgnoreCase
            )
            .Where(x => x.Count() > 1)
            .Select(x => x.Key)
            .ToHashSet(
                StringComparer.OrdinalIgnoreCase
            );

        if (duplicateBarcodes.Count > 0)
        {
            throw new ProductConflictException(
                $"Duplicate barcodes in request: {string.Join(", ", duplicateBarcodes)}"
            );
        }

        if (barcodes.Count == 0)
        {
            return;
        }

        var existingProductBarcodes = await _context.Products
            .AsNoTracking()
            .Where(product => product.Barcode != null && barcodes.Contains(product.Barcode))
            .Select(product => product.Barcode!)
            .ToListAsync(cancellationToken);
        var existingUnitBarcodes = await _context.ProductUnitConversions
            .AsNoTracking()
            .Where(unit => unit.Barcode != null && barcodes.Contains(unit.Barcode))
            .Select(unit => unit.Barcode!)
            .ToListAsync(cancellationToken);
        var existingBarcodes = existingProductBarcodes
            .Concat(existingUnitBarcodes)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (existingBarcodes.Length > 0)
        {
            throw new ProductConflictException(
                $"These product or selling-unit barcodes already exist: {string.Join(", ", existingBarcodes)}"
            );
        }
    }

    private async Task<string> GenerateUniqueSlugAsync(
        string source,
        HashSet<string> reservedSlugs,
        CancellationToken cancellationToken
    )
    {
        var baseSlug = CreateSlug(source);

        var candidate = baseSlug;

        var alreadyExists =
            reservedSlugs.Contains(candidate) ||
            await _context
                .Set<Product>()
                .AsNoTracking()
                .AnyAsync(
                    x => x.Slug == candidate,
                    cancellationToken
                );

        if (alreadyExists)
        {
            do
            {
                var suffix = RandomNumberGenerator
                    .GetHexString(4)
                    .ToLowerInvariant();

                candidate = $"{baseSlug}-{suffix}";
            }
            while (
                reservedSlugs.Contains(candidate) ||
                await _context
                    .Set<Product>()
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.Slug == candidate,
                        cancellationToken
                    )
            );
        }

        reservedSlugs.Add(candidate);

        return candidate;
    }

    private static string CreateSlug(string value)
    {
        var slug = value
            .Trim()
            .ToLowerInvariant();

        slug = SlugSeparatorRegex.Replace(
            slug,
            "-"
        );

        slug = slug.Trim('-');

        if (string.IsNullOrWhiteSpace(slug))
        {
            slug =
                $"product-{RandomNumberGenerator.GetHexString(4).ToLowerInvariant()}";
        }

        if (slug.Length > 240)
        {
            slug = slug[..240].TrimEnd('-');
        }

        return slug;
    }

    private async Task<List<long>> GetCategoryTreeIdsAsync(long categoryId)
    {
        var categories = await _context.Types
            .AsNoTracking()
            .Where(x => x.Group == GeneralTypeEnum.ProductCategory)
            .Select(x => new { x.Id, x.ParentId })
            .ToListAsync();

        var result = new HashSet<long> { categoryId };
        var pending = new Queue<long>();
        pending.Enqueue(categoryId);

        while (pending.Count > 0)
        {
            var parentId = pending.Dequeue();

            foreach (var childId in categories
                .Where(x => x.ParentId == parentId)
                .Select(x => x.Id))
            {
                if (result.Add(childId))
                {
                    pending.Enqueue(childId);
                }
            }
        }

        return result.ToList();
    }

    private async Task DeleteStoredImagesAsync(
        IEnumerable<StoredProductImage> storedImages
    )
    {
        foreach (var image in storedImages)
        {
            try
            {
                await _imageStorage.DeleteAsync(
                    image.RelativePath,
                    CancellationToken.None
                );
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Failed to remove product image {ImagePath} after product creation failed.",
                    image.RelativePath
                );
            }
        }
    }

    private static bool IsUniqueConstraintViolation(
        DbUpdateException exception
    )
    {
        return exception.InnerException is SqlException
        {
            Number: 2601 or 2627
        };
    }

    private static string? NormalizeOptional(
        string? value
    )
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static void AddError(
        IDictionary<string, List<string>> errors,
        string key,
        string message
    )
    {
        if (!errors.TryGetValue(
                key,
                out var messages
            ))
        {
            messages = [];
            errors[key] = messages;
        }

        messages.Add(message);
    }

    private static void ThrowIfErrorsExist(
        IReadOnlyDictionary<string, List<string>> errors
    )
    {
        if (errors.Count == 0)
        {
            return;
        }

        throw new ProductValidationException(
            errors.ToDictionary(
                x => x.Key,
                x => x.Value.ToArray()
            )
        );
    }

    private sealed record NormalizedProductItem(
        int Index,
        CreateBulkProductItemRequest Request,
        string Name,
        string? Barcode,
        string? ShortDescription,
        string? Description
    );

    private sealed record PreparedProductItem(
        NormalizedProductItem Item,
        string Slug
    );
}
