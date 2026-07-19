namespace ECommerce.Controllers;

using API.Entities.Products;
using ECommerce.Entities;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Exceptions;
using ECommerce.Entities.Products.Filters;
using ECommerce.Entities.Products.Requests;
using ECommerce.Services.Products;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ECommerce.Shared;


[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private const long MaximumRequestSize =
        260L * 1024L * 1024L;

    private readonly IProductService _service;

    public ProductsController(IProductService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] ProductFilter filter)
    {
        var result = await _service.GetAsync(filter);
        return Ok(ApiResponse<ECommerce.Entities.Common.PagedResult<ProductListItemResponse>>.Ok(result));
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var product = await _service.GetByIdAsync(id);
        if (product is null) return NotFound(ApiResponse<object>.Fail("Product not found."));
        return Ok(ApiResponse<ECommerce.Dtos.ProductDetailsDto>.Ok(product));
    }

    [HttpPost("{id:long}/views")]
    public async Task<IActionResult> RecordView(long id, CancellationToken cancellationToken)
    {
        try
        {
            var viewCount = await _service.IncrementViewCountAsync(id, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { viewCount }));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPost]
    public async Task<IActionResult> Create(
        Product model)
    {
        var id = await _service.CreateAsync(model);

        return Ok(id);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(
        long id,
        Product model)
    {
        await _service.UpdateAsync(id, model);

        return NoContent();
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        await _service.DeleteAsync(id);

        return NoContent();
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPatch("{id:long}/toggle-status")]
    public async Task<IActionResult> ToggleStatus(long id)
    {
        await _service.ToggleStatusAsync(id);

        return NoContent();
    }


    [HttpGet("lookups")]
    [ProducesResponseType(
       typeof(ApiResponse<ProductLookupsResponse>),
       StatusCodes.Status200OK
   )]
    public async Task<
       ActionResult<ApiResponse<ProductLookupsResponse>>
   > GetLookups(
       CancellationToken cancellationToken
   )
    {
        var result =
            await _service.GetLookupsAsync(
                cancellationToken
            );

        return Ok(
            ApiResponse<ProductLookupsResponse>.Ok(
                result,
                "Product lookups loaded successfully."
            )
        );
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPost("bulk")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaximumRequestSize)]
    [RequestFormLimits(
        MultipartBodyLengthLimit = MaximumRequestSize
    )]
    [ProducesResponseType(
        typeof(ApiResponse<CreateBulkProductsResponse>),
        StatusCodes.Status201Created
    )]
    [ProducesResponseType(
        typeof(ApiResponse<CreateBulkProductsResponse>),
        StatusCodes.Status400BadRequest
    )]
    [ProducesResponseType(
        typeof(ApiResponse<CreateBulkProductsResponse>),
        StatusCodes.Status409Conflict
    )]
    public async Task<
        ActionResult<ApiResponse<CreateBulkProductsResponse>>
    > CreateBulk(
        [FromForm] CreateBulkProductsRequest request,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var result =
                await _service.CreateBulkAsync(
                    request,
                    cancellationToken
                );

            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse<CreateBulkProductsResponse>.Ok(
                    result,
                    $"{result.CreatedCount} product(s) created successfully."
                )
            );
        }
        catch (ProductValidationException exception)
        {
            return BadRequest(
                ApiResponse<CreateBulkProductsResponse>.Fail(
                    exception.Message,
                    exception.Errors
                )
            );
        }
        catch (ProductConflictException exception)
        {
            return Conflict(
                ApiResponse<CreateBulkProductsResponse>.Fail(
                    exception.Message
                )
            );
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(
                ApiResponse<CreateBulkProductsResponse>.Fail(
                    exception.Message
                )
            );
        }
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPut("bulk")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaximumRequestSize)]
    [ProducesResponseType(typeof(ApiResponse<BulkUpdateProductsResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<BulkUpdateProductsResponse>>> UpdateBulk(
        [FromForm] BulkUpdateProductsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.UpdateBulkAsync(request, cancellationToken);
            return Ok(ApiResponse<BulkUpdateProductsResponse>.Ok(result, $"{result.UpdatedCount} product(s) updated successfully."));
        }
        catch (ProductValidationException exception)
        {
            return BadRequest(ApiResponse<BulkUpdateProductsResponse>.Fail(exception.Message, exception.Errors));
        }
        catch (ProductConflictException exception)
        {
            return Conflict(ApiResponse<BulkUpdateProductsResponse>.Fail(exception.Message));
        }
    }
}
