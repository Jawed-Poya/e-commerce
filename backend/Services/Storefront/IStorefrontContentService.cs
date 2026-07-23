using ECommerce.Entities.Storefront.Contracts;

namespace ECommerce.Services.Storefront;

public interface IStorefrontContentService
{
    Task<StorefrontContentResponse> GetAsync(CancellationToken cancellationToken = default);
    Task<StorefrontContentResponse> UpdateAsync(
        UpdateStorefrontContentRequest request,
        CancellationToken cancellationToken = default);
    Task<string> SaveHeroImageAsync(IFormFile image, CancellationToken cancellationToken = default);
}
