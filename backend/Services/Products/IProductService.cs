using API.Entities.Products;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Filters;
using ECommerce.Entities.Products.Requests;

namespace ECommerce.Services.Products;

public interface IProductService
{
    Task<PagedResult<ProductListItemResponse>> GetAsync(ProductFilter filter);

    Task<ProductDetailsDto?> GetByIdAsync(long id);

    Task<ProductDetailsDto?> GetBySlugAsync(string slug);

    Task<long> IncrementViewCountAsync(long id, CancellationToken cancellationToken = default);

    Task<long> CreateAsync(Product model);

    Task UpdateAsync(long id, Product model);

    Task DeleteAsync(long id);

    Task ToggleStatusAsync(long id);

    Task<CreateBulkProductsResponse> CreateBulkAsync(
    CreateBulkProductsRequest request,
    CancellationToken cancellationToken = default
    );

    Task<BulkUpdateProductsResponse> UpdateBulkAsync(
        BulkUpdateProductsRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ProductLookupsResponse> GetLookupsAsync(
        CancellationToken cancellationToken = default
    );
}
