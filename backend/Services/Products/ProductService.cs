using API.Entities.Products;
using API.Entities.Types;
using ECommerce.Data;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using ECommerce.Entities.Products.Filters;
using ECommerce.Entities.Products.Requests;
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


    public ProductService(
        ApplicationDbContext context,
        IProductImageStorage imageStorage,
        ILogger<ProductService> logger)
    {
        _context = context;
        _imageStorage = imageStorage;
        _logger = logger;
    }

    public async Task<PagedResult<ProductListItemResponse>> GetAsync(ProductFilter filter)
    {
        IQueryable<Product> query = _context.Products
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Brand)
            .Include(x => x.Unit)
            .Include(x => x.Inventory)
            .Include(x => x.Images)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            query = query.Where(x =>
                x.Name.Contains(filter.Search) ||
                (x.Barcode != null && x.Barcode.Contains(filter.Search)));
        }

        if (filter.CategoryId.HasValue)
            query = query.Where(x => x.CategoryId == filter.CategoryId);

        if (filter.BrandId.HasValue)
            query = query.Where(x => x.BrandId == filter.BrandId);

        if (filter.UnitId.HasValue)
            query = query.Where(x => x.UnitId == filter.UnitId);

        if (filter.IsFeatured.HasValue)
            query = query.Where(x => x.IsFeatured == filter.IsFeatured);

        if (filter.IsActive.HasValue)
            query = query.Where(x => x.IsActive == filter.IsActive);

        if (filter.MinPrice.HasValue)
            query = query.Where(x =>
                x.Prices.Any(p =>
                    (p.SalePrice ?? p.RegularPrice) >= filter.MinPrice));

        if (filter.MaxPrice.HasValue)
            query = query.Where(x =>
                x.Prices.Any(p =>
                    (p.SalePrice ?? p.RegularPrice) <= filter.MaxPrice));

        query = filter.SortBy?.ToLower() switch
        {
            "name" => filter.SortDescending
                ? query.OrderByDescending(x => x.Name)
                : query.OrderBy(x => x.Name),

            "price" => filter.SortDescending
                ? query.OrderByDescending(x => x.Prices.Min(p => p.SalePrice ?? p.RegularPrice))
                : query.OrderBy(x => x.Prices.Min(p => p.SalePrice ?? p.RegularPrice)),

            "createdat" => filter.SortDescending
                ? query.OrderByDescending(x => x.CreatedAt)
                : query.OrderBy(x => x.CreatedAt),

            _ => query.OrderByDescending(x => x.Id)
        };

        var total = await query.CountAsync();

        var items = await query
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(x => new ProductListItemResponse(
                x.Id,
                x.Name,
                x.Barcode,
                x.ShortDescription,
                x.Description,
                x.Slug,
                x.CategoryId,
                x.Category.Name,
                x.BrandId,
                x.UnitId,
                x.MinimumValue,
                x.MaximumValue,
                x.IsFeatured,
                x.IsActive,
                x.Inventory == null ? 0 : x.Inventory.Quantity,
                x.Prices.Select(p => (decimal?)(p.SalePrice ?? p.RegularPrice)).Min(),
                x.Images.Where(i => i.IsPrimary).Select(i => "/" + i.ImagePath.Replace("\\", "/")).FirstOrDefault(),
                x.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder)
                    .Select(i => new ProductListImageResponse(i.Id, "/" + i.ImagePath.Replace("\\", "/"), i.IsPrimary, i.SortOrder))
                    .ToList()
            ))
            .ToListAsync();

        return new PagedResult<ProductListItemResponse>
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
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

    public async Task<ProductDetailsDto?> GetByIdAsync(long id)
    {
        return await _context.Products
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Brand)
            .Include(x => x.Unit)
            .Include(x => x.Inventory)
            .Include(x => x.Images)
            .Include(x => x.Prices)
                .ThenInclude(x => x.CustomerType)
            .Where(x => x.Id == id && !x.IsDeleted)
            .Select(x => new ProductDetailsDto
            {
                Id = x.Id,
                Name = x.Name,
                Barcode = x.Barcode,
                Description = x.Description,
                ShortDescription = x.ShortDescription,
                Slug = x.Slug,
                MinimumValue = x.MinimumValue,
                MaximumValue = x.MaximumValue,
                CategoryId = x.CategoryId,
                CategoryName = x.Category.Name,
                BrandId = x.BrandId,
                BrandName = x.Brand == null ? null : x.Brand.Name,
                UnitId = x.UnitId,
                UnitName = x.Unit == null ? null : x.Unit.Name,
                IsActive = x.IsActive,
                IsFeatured = x.IsFeatured,
                ViewCount = x.ViewCount,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt,
                Inventory = x.Inventory == null ? null : new ProductInventoryDetailsDto(
                    x.Inventory.Quantity,
                    x.Inventory.ReservedQuantity,
                    Math.Max(0, x.Inventory.Quantity - x.Inventory.ReservedQuantity),
                    x.Inventory.MinimumQuantity,
                    x.Inventory.ExpireDate),
                Images = x.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDetailsDto(
                    i.Id, "/" + i.ImagePath.Replace("\\", "/"), i.OriginalFileName,
                    i.ContentType, i.Size, i.IsPrimary, i.SortOrder)).ToList(),
                Prices = x.Prices.Select(p => new ProductPriceDetailsDto(
                    p.Id, p.CustomerType.Name, p.RegularPrice, p.SalePrice,
                    p.StartDate, p.EndDate)).ToList()
            })
            .FirstOrDefaultAsync();
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
                x.Group == GeneralTypeEnum.ProductUnit
            )
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Group
            })
            .ToListAsync(cancellationToken);

        var categories = generalTypes
            .Where(x =>
                x.Group == GeneralTypeEnum.ProductCategory
            )
            .Select(x =>
                new ProductLookupItemResponse(
                    x.Id,
                    x.Name
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

        return new ProductLookupsResponse(
            Categories: categories,
            Brands: brands,
            Units: units
        );
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
