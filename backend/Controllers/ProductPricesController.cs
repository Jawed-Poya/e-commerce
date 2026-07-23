using ECommerce.Shared;
using ECommerce.Entities;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using ECommerce.Services.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Authorize(Policy = AppPermissions.ProductPricingManage)]
[ApiController]
[Route("api/products/{productId:long}/prices")]
public sealed class ProductPricesController(IProductPricingService pricing) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(long productId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await pricing.GetAsync(productId, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<ProductPriceResponse>>.Ok(result));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpPut]
    public async Task<IActionResult> Replace(
        long productId,
        ReplaceProductPricesRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await pricing.ReplaceAsync(productId, request, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<ProductPriceResponse>>.Ok(result, "Product prices updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (ProductValidationException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message, exception.Errors));
        }
    }
}
