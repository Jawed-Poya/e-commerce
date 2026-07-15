using API.Entities.Products;
using ECommerce.Dtos;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Filters;

namespace ECommerce.Services.Products;

public interface IProductService
{
    Task<PagedResult<Product>> GetAsync(ProductFilter filter);

    Task<ProductDetailsDto?> GetByIdAsync(long id);

    Task<long> CreateAsync(Product model);

    Task UpdateAsync(long id, Product model);

    Task DeleteAsync(long id);

    Task ToggleStatusAsync(long id);
}
