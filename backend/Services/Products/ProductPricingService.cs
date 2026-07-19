using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Products;

public sealed class ProductPricingService(ApplicationDbContext context) : IProductPricingService
{
    private const int MaximumPriceTiers = 50;

    public async Task<IReadOnlyList<ProductPriceResponse>> GetAsync(long productId, CancellationToken cancellationToken = default)
    {
        if (!await context.Products.AsNoTracking().AnyAsync(product => product.Id == productId, cancellationToken))
            throw new KeyNotFoundException("Product not found.");

        return await Query(productId).ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProductPriceResponse>> ReplaceAsync(
        long productId,
        ReplaceProductPricesRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!await context.Products.AsNoTracking().AnyAsync(product => product.Id == productId, cancellationToken))
            throw new KeyNotFoundException("Product not found.");

        request.Prices ??= [];
        var errors = Validate(request);
        if (errors.Count > 0) throw new ProductValidationException(errors);

        var customerTypeIds = request.Prices.Select(price => price.CustomerTypeId).Distinct().ToArray();
        var validCustomerTypeIds = await context.Types
            .AsNoTracking()
            .Where(type => customerTypeIds.Contains(type.Id) && type.Group == GeneralTypeEnum.CustomerType)
            .Select(type => type.Id)
            .ToListAsync(cancellationToken);
        var invalidCustomerTypeIds = customerTypeIds.Except(validCustomerTypeIds).ToArray();
        if (invalidCustomerTypeIds.Length > 0)
        {
            throw new ProductValidationException(new Dictionary<string, string[]>
            {
                ["Prices"] = [$"Invalid customer type IDs: {string.Join(", ", invalidCustomerTypeIds)}."]
            });
        }

        var existing = await context.ProductPrices
            .Where(price => price.ProductId == productId)
            .ToListAsync(cancellationToken);
        var requestedIds = request.Prices.Where(price => price.Id.HasValue).Select(price => price.Id!.Value).ToArray();
        var foreignIds = requestedIds.Except(existing.Select(price => price.Id)).ToArray();
        if (foreignIds.Length > 0)
        {
            throw new ProductValidationException(new Dictionary<string, string[]>
            {
                ["Prices"] = ["One or more prices do not belong to this product."]
            });
        }

        var retained = new HashSet<long>();
        foreach (var item in request.Prices)
        {
            var price = item.Id.HasValue
                ? existing.Single(existingPrice => existingPrice.Id == item.Id.Value)
                : existing.FirstOrDefault(existingPrice => existingPrice.CustomerTypeId == item.CustomerTypeId && !retained.Contains(existingPrice.Id));

            if (price is null)
            {
                price = new ProductPrice { ProductId = productId };
                context.ProductPrices.Add(price);
            }

            price.CustomerTypeId = item.CustomerTypeId;
            price.RegularPrice = item.RegularPrice;
            price.SalePrice = item.SalePrice;
            price.StartDate = item.SalePrice.HasValue ? item.StartDate : null;
            price.EndDate = item.SalePrice.HasValue ? item.EndDate : null;
            price.IsDeleted = false;
            price.DeletedAt = null;
            if (price.Id > 0) retained.Add(price.Id);
        }

        foreach (var removed in existing.Where(price => !retained.Contains(price.Id) && request.Prices.All(item => item.Id != price.Id)))
        {
            removed.IsDeleted = true;
            removed.DeletedAt = DateTime.UtcNow;
        }

        await context.SaveChangesAsync(cancellationToken);
        return await Query(productId).ToListAsync(cancellationToken);
    }

    private IQueryable<ProductPriceResponse> Query(long productId) =>
        context.ProductPrices
            .AsNoTracking()
            .Where(price => price.ProductId == productId)
            .OrderBy(price => price.CustomerType.SortOrder)
            .ThenBy(price => price.CustomerType.Name)
            .Select(price => new ProductPriceResponse(
                price.Id,
                price.CustomerTypeId,
                price.CustomerType.Name,
                price.RegularPrice,
                price.SalePrice,
                price.StartDate,
                price.EndDate));

    private static IReadOnlyDictionary<string, string[]> Validate(ReplaceProductPricesRequest request)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var messages)) errors[key] = messages = [];
            messages.Add(message);
        }

        if (request.Prices.Count > MaximumPriceTiers)
            Add("Prices", $"A product can have at most {MaximumPriceTiers} price tiers.");

        foreach (var duplicate in request.Prices.GroupBy(price => price.CustomerTypeId).Where(group => group.Count() > 1))
            Add("Prices", $"Customer type {duplicate.Key} is selected more than once.");

        foreach (var duplicate in request.Prices.Where(price => price.Id.HasValue).GroupBy(price => price.Id).Where(group => group.Count() > 1))
            Add("Prices", $"Price {duplicate.Key} is included more than once.");

        for (var index = 0; index < request.Prices.Count; index++)
        {
            var price = request.Prices[index];
            var prefix = $"Prices[{index}]";
            if (price.CustomerTypeId < 1) Add($"{prefix}.CustomerTypeId", "Customer type is required.");
            if (price.RegularPrice < 0) Add($"{prefix}.RegularPrice", "Regular price cannot be negative.");
            if (price.SalePrice.HasValue && (price.SalePrice < 0 || price.SalePrice >= price.RegularPrice))
                Add($"{prefix}.SalePrice", "Sale price must be non-negative and lower than the regular price.");
            if (!price.SalePrice.HasValue && (price.StartDate.HasValue || price.EndDate.HasValue))
                Add($"{prefix}.SalePrice", "A sale price is required when sale dates are provided.");
            if (price.StartDate.HasValue && price.EndDate.HasValue && price.EndDate < price.StartDate)
                Add($"{prefix}.EndDate", "Sale end date cannot be earlier than its start date.");
        }

        return errors.ToDictionary(entry => entry.Key, entry => entry.Value.ToArray());
    }
}
