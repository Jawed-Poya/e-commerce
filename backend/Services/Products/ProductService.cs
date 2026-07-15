using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Filters;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Products;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _context;

    public ProductService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<Product>> GetAsync(ProductFilter filter)
    {
        IQueryable<Product> query = _context.Products
            .AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Brand)
            .Include(x => x.Unit)
            .Include(x => x.Inventory)
            .Include(x => x.Images.Where(i => i.IsPrimary))
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            query = query.Where(x =>
                x.Name.Contains(filter.Search) ||
                x.SKU.Contains(filter.Search) ||
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
            .ToListAsync();

        return new PagedResult<Product>
        {
            Items = items,
            TotalCount = total,
            Page = filter.Page,
            PageSize = filter.PageSize
        };
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
                CategoryId = x.CategoryId,
                BrandId = x.BrandId,
                UnitId = x.UnitId,
                IsActive = x.IsActive,
                IsFeatured = x.IsFeatured,
                ViewCount = x.ViewCount
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
        entity.SKU = model.SKU;
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
}
