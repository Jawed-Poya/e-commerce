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
using ECommerce.Services.Tenancy;
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
    private readonly ITenantPlanGuard _tenantPlanGuard;

    public ProductService(
        ApplicationDbContext context,
        IProductImageStorage imageStorage,
        ILogger<ProductService> logger,
        ICurrentCustomerAccessor currentCustomer,
        IDefaultCustomerTypeResolver defaultCustomerType,
        ITenantPlanGuard tenantPlanGuard)
    {
        _context = context;
        _imageStorage = imageStorage;
        _logger = logger;
        _currentCustomer = currentCustomer;
        _defaultCustomerType = defaultCustomerType;
        _tenantPlanGuard = tenantPlanGuard;
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
                (product.Barcode != null && product.Barcode.Contains(search)));
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
        if (filter.UnitId.HasValue) products = products.Where(product => product.UnitId == filter.UnitId);
        if (filter.IsFeatured.HasValue) products = products.Where(product => product.IsFeatured == filter.IsFeatured);
        if (filter.IsActive.HasValue) products = products.Where(product => product.IsActive == filter.IsActive);
        if (filter.InStock.HasValue)
        {
            products = filter.InStock.Value
                ? products.Where(product => product.Inventory != null && product.Inventory.Quantity - product.Inventory.ReservedQuantity > 0)
                : products.Where(product => product.Inventory == null || product.Inventory.Quantity - product.Inventory.ReservedQuantity <= 0);
        }

        var query = products.Select(product => new ProductListProjection
        {
            Id = product.Id,
            Name = product.Name,
            Barcode = product.Barcode,
            ShortDescription = product.ShortDescription,
            Description = product.Description,
            Slug = product.Slug,
            CategoryId = product.CategoryId,
            CategoryName = product.Category.Name,
            BrandId = product.BrandId,
            UnitId = product.UnitId,
            MinimumValue = product.MinimumValue,
            MaximumValue = product.MaximumValue,
            IsFeatured = product.IsFeatured,
            IsActive = product.IsActive,
            Stock = product.Inventory == null ? 0 : product.Inventory.Quantity - product.Inventory.ReservedQuantity,
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

        if (filter.MinPrice.HasValue) query = query.Where(product => product.Price >= filter.MinPrice.Value);
        if (filter.MaxPrice.HasValue) query = query.Where(product => product.Price <= filter.MaxPrice.Value);

        query = filter.SortBy?.ToLowerInvariant() switch
        {
            "name" => filter.SortDescending ? query.OrderByDescending(product => product.Name) : query.OrderBy(product => product.Name),
            "price" => filter.SortDescending ? query.OrderByDescending(product => product.Price) : query.OrderBy(product => product.Price),
            "createdat" => filter.SortDescending ? query.OrderByDescending(product => product.Id) : query.OrderBy(product => product.Id),
            _ => query.OrderByDescending(product => product.Id)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var total = await query.CountAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<ProductListItemResponse>
        {
            Items = rows.Select(product => new ProductListItemResponse(
                product.Id,
                product.Name,
                product.Barcode,
                product.ShortDescription,
                product.Description,
                product.Slug,
                product.CategoryId,
                product.CategoryName,
                product.BrandId,
                product.UnitId,
                product.MinimumValue,
                product.MaximumValue,
                product.IsFeatured,
                product.IsActive,
                product.Stock,
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
            new CreateBulkProductItemRequest { CategoryId = item.CategoryId, BrandId = item.BrandId, UnitId = item.UnitId },
            item.Name.Trim(),
            NormalizeOptional(item.Barcode),
            null,
            null)).ToList();
        await ValidateGeneralTypeIdsAsync(validationItems, cancellationToken);

        var requestedBarcodes = request.Products
            .Where(x => !string.IsNullOrWhiteSpace(x.Barcode))
            .Select(x => new { x.Id, Barcode = x.Barcode!.Trim() }).ToList();
        var duplicates = requestedBarcodes.GroupBy(x => x.Barcode, StringComparer.OrdinalIgnoreCase).Where(x => x.Count() > 1).Select(x => x.Key).ToArray();
        if (duplicates.Length > 0)
            throw new ProductConflictException($"Duplicate barcodes in request: {string.Join(", ", duplicates)}");

        var barcodeValues = requestedBarcodes.Select(x => x.Barcode).ToArray();
        var barcodeConflict = await _context.Products.AsNoTracking()
            .AnyAsync(x => !ids.Contains(x.Id) && x.Barcode != null && barcodeValues.Contains(x.Barcode), cancellationToken);
        if (barcodeConflict)
            throw new ProductConflictException("One or more barcodes already belong to another product.");

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
                if (string.IsNullOrWhiteSpace(item.Name) || (item.MinimumValue.HasValue && item.MaximumValue.HasValue && item.MinimumValue > item.MaximumValue))
                    throw new ProductValidationException(new Dictionary<string, string[]> { ["Products"] = ["Names are required and maximum value must be at least minimum value."] });

                var product = products[item.Id];
                product.Name = item.Name.Trim();
                product.Barcode = NormalizeOptional(item.Barcode);
                product.ShortDescription = NormalizeOptional(item.ShortDescription);
                product.Description = NormalizeOptional(item.Description);
                product.Slug = NormalizeOptional(item.Slug);
                product.CategoryId = item.CategoryId;
                product.BrandId = item.BrandId;
                product.UnitId = item.UnitId;
                product.MinimumValue = item.MinimumValue;
                product.MaximumValue = item.MaximumValue;
                product.IsFeatured = item.IsFeatured;
                product.IsActive = item.IsActive;
                product.UpdatedAt = DateTime.UtcNow;

                if (item.Prices.Count > 0)
                    ReplacePrices(product, item.Prices);

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

        return new ProductDetailsDto
        {
            Id = product.Id,
            Name = product.Name,
            Barcode = product.Barcode,
            Description = product.Description,
            ShortDescription = product.ShortDescription,
            Slug = product.Slug,
            MinimumValue = product.MinimumValue,
            MaximumValue = product.MaximumValue,
            CategoryId = product.CategoryId,
            CategoryName = product.Category.Name,
            BrandId = product.BrandId,
            BrandName = product.Brand?.Name,
            UnitId = product.UnitId,
            UnitName = product.Unit?.Name,
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
                Math.Max(0, product.Inventory.Quantity - product.Inventory.ReservedQuantity),
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
        await _tenantPlanGuard.EnsureProductCapacityAsync();
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
            .Include(x => x.Inventory)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);

        if (entity == null)
            throw new KeyNotFoundException("Product not found.");

        entity.Name = model.Name;
        entity.Barcode = model.Barcode;
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

        entity.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(long id)
    {
        var product = await _context.Products
            .FirstOrDefaultAsync(x => x.Id == id);

        if (product == null)
            throw new KeyNotFoundException("Product not found.");

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
        await _tenantPlanGuard.EnsureProductCapacityAsync(request.Products.Count, cancellationToken);

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
                    ShortDescription =
                        item.ShortDescription,
                    Description = item.Description,

                    MinimumValue =
                        item.Request.MinimumValue,
                    MaximumValue =
                        item.Request.MaximumValue,

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
                        ReservedQuantity = 0
                    }
                };

                foreach (var price in item.Request.Prices)
                    product.Prices.Add(CreatePrice(price));

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

        var categoryProducts = await _context
            .Set<Product>()
            .AsNoTracking()
            .Where(x => x.IsActive && !x.IsDeleted)
            .Select(x => x.CategoryId)
            .ToListAsync(cancellationToken);

        var categoryStats = categoryProducts
            .GroupBy(categoryId => categoryId)
            .ToDictionary(
                group => group.Key,
                group => group.Count()
            );

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

    private sealed class ProductListProjection
    {
        public long Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Barcode { get; init; }
        public string? ShortDescription { get; init; }
        public string? Description { get; init; }
        public string? Slug { get; init; }
        public long CategoryId { get; init; }
        public string CategoryName { get; init; } = string.Empty;
        public long? BrandId { get; init; }
        public long? UnitId { get; init; }
        public int? MinimumValue { get; init; }
        public int? MaximumValue { get; init; }
        public bool IsFeatured { get; init; }
        public bool IsActive { get; init; }
        public decimal Stock { get; init; }
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

            if (product.BrandId is <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].BrandId",
                    "Brand ID must be greater than zero."
                );
            }

            if (product.UnitId is <= 0)
            {
                AddError(
                    errors,
                    $"Products[{index}].UnitId",
                    "Unit ID must be greater than zero."
                );
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
            })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToArray();

        var existingIds = await _context
            .Set<GeneralType>()
            .AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToHashSetAsync(cancellationToken);

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
                !existingIds.Contains(
                    item.Request.UnitId.Value
                ))
            {
                AddError(
                    errors,
                    $"Products[{item.Index}].UnitId",
                    "The selected unit does not exist."
                );
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
            .Where(x =>
                !string.IsNullOrWhiteSpace(x.Barcode)
            )
            .Select(x => x.Barcode!)
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

        var existingBarcodes = await _context
            .Set<Product>()
            .AsNoTracking()
            .Where(x =>
                x.Barcode != null &&
                barcodes.Contains(x.Barcode)
            )
            .Select(x => x.Barcode!)
            .ToListAsync(cancellationToken);

        if (existingBarcodes.Count > 0)
        {
            throw new ProductConflictException(
                $"These barcodes already exist: {string.Join(", ", existingBarcodes)}"
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
