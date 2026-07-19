using ECommerce.Entities.Products.Contracts;

namespace ECommerce.Services.Products;

public interface IProductPricingService
{
    Task<IReadOnlyList<ProductPriceResponse>> GetAsync(long productId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProductPriceResponse>> ReplaceAsync(
        long productId,
        ReplaceProductPricesRequest request,
        CancellationToken cancellationToken = default);
}
