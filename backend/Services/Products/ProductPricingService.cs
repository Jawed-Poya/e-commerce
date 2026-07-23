using API.Entities.Products;
using ECommerce.Data;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using ECommerce.Services.Customers;
using ECommerce.Services.Notifications;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Products;

public sealed class ProductPricingService(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerType,
    IStoreNotificationService notifications) : IProductPricingService
{
    private const int MaximumPriceTiers = 50;

    public async Task<IReadOnlyList<ProductPriceResponse>> GetAsync(long productId, CancellationToken cancellationToken = default)
    {
        if (!await context.Products.AsNoTracking().AnyAsync(product => product.Id == productId, cancellationToken))
            throw new KeyNotFoundException("Product not found.");

        var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
        return await Query(productId, defaultTypeId).ToListAsync(cancellationToken);
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
        var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
        if (request.Prices.All(price => price.CustomerTypeId != defaultTypeId))
        {
            errors = errors
                .Concat(new[]
                {
                    new KeyValuePair<string, string[]>(
                        "Prices",
                        ["A price for the default customer type is required."])
                })
                .GroupBy(entry => entry.Key)
                .ToDictionary(
                    group => group.Key,
                    group => group.SelectMany(entry => entry.Value).ToArray());
        }
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
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var previousCustomerTypeIds = existing
            .Select(price => price.CustomerTypeId)
            .Distinct()
            .ToArray();
        var previousByCustomerType = existing
            .GroupBy(price => price.CustomerTypeId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(price => IsSaleActive(price, today))
                    .Select(price => EffectivePrice(price, today))
                    .FirstOrDefault());
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

        var requestedDefault = request.Prices.Single(price => price.CustomerTypeId == defaultTypeId);
        var defaultEffectivePrice = requestedDefault.SalePrice.HasValue &&
                                    (!requestedDefault.StartDate.HasValue || requestedDefault.StartDate.Value <= today) &&
                                    (!requestedDefault.EndDate.HasValue || requestedDefault.EndDate.Value >= today)
            ? requestedDefault.SalePrice.Value
            : requestedDefault.RegularPrice;

        var requestedCustomerTypeIds = request.Prices
            .Select(price => price.CustomerTypeId)
            .Distinct()
            .ToArray();
        var pendingNotifications = new List<PendingStoreNotification?>();
        var removedCustomerTypeIds = previousCustomerTypeIds
            .Except(requestedCustomerTypeIds)
            .Where(customerTypeId => customerTypeId != defaultTypeId)
            .ToArray();

        foreach (var removedCustomerTypeId in removedCustomerTypeIds)
        {
            if (previousByCustomerType.TryGetValue(removedCustomerTypeId, out var previousPrice) &&
                previousPrice != defaultEffectivePrice)
            {
                pendingNotifications.Add(await notifications.CreatePriceChangedAsync(
                    productId,
                    removedCustomerTypeId,
                    previousPrice,
                    defaultEffectivePrice,
                    cancellationToken));
            }
        }

        foreach (var item in request.Prices)
        {
            var newPrice = item.SalePrice.HasValue &&
                           (!item.StartDate.HasValue || item.StartDate.Value <= today) &&
                           (!item.EndDate.HasValue || item.EndDate.Value >= today)
                ? item.SalePrice.Value
                : item.RegularPrice;
            previousByCustomerType.TryGetValue(item.CustomerTypeId, out var previousPrice);
            if (!previousByCustomerType.ContainsKey(item.CustomerTypeId) || previousPrice != newPrice)
            {
                pendingNotifications.Add(await notifications.CreatePriceChangedAsync(
                    productId,
                    item.CustomerTypeId,
                    previousByCustomerType.ContainsKey(item.CustomerTypeId) ? previousPrice : null,
                    newPrice,
                    cancellationToken));
            }
        }

        await context.SaveChangesAsync(cancellationToken);
        await notifications.PublishAsync(pendingNotifications, cancellationToken);
        return await Query(productId, defaultTypeId).ToListAsync(cancellationToken);
    }

    private IQueryable<ProductPriceResponse> Query(long productId, long defaultTypeId) =>
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
                price.EndDate,
                price.CustomerTypeId == defaultTypeId));

    private static bool IsSaleActive(ProductPrice price, DateOnly today) =>
        price.SalePrice.HasValue &&
        (!price.StartDate.HasValue || price.StartDate.Value <= today) &&
        (!price.EndDate.HasValue || price.EndDate.Value >= today);

    private static decimal EffectivePrice(ProductPrice price, DateOnly today) =>
        IsSaleActive(price, today) ? price.SalePrice!.Value : price.RegularPrice;

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
