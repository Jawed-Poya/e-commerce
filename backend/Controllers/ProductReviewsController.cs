using ECommerce.Entities;
using ECommerce.Entities.Products.Reviews;
using ECommerce.Services.Reviews;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
public sealed class ProductReviewsController(IProductReviewService reviews) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("api/products/{productId:long}/reviews")]
    public async Task<ActionResult<ApiResponse<ProductReviewSummaryResponse>>> Get(
        long productId,
        CancellationToken cancellationToken)
    {
        var result = await reviews.GetForProductAsync(productId, cancellationToken);
        return result is null
            ? NotFound(ApiResponse<object>.Fail("Product not found."))
            : Ok(ApiResponse<ProductReviewSummaryResponse>.Ok(result));
    }

    [Authorize(Roles = AppRoles.Customer)]
    [HttpPost("api/products/{productId:long}/reviews")]
    public async Task<ActionResult<ApiResponse<ProductReviewItemResponse>>> Upsert(
        long productId,
        UpsertProductReviewRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<ProductReviewItemResponse>.Ok(
                await reviews.UpsertMineAsync(productId, request, cancellationToken),
                "Your review was saved and is waiting for approval."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (UnauthorizedAccessException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Roles = AppRoles.Customer)]
    [HttpDelete("api/products/{productId:long}/reviews/mine")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteMine(
        long productId,
        CancellationToken cancellationToken)
    {
        try
        {
            await reviews.DeleteMineAsync(productId, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { productId }, "Review deleted."));
        }
        catch (UnauthorizedAccessException exception)
        {
            return Unauthorized(ApiResponse<object>.Fail(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.ProductsManage)]
    [HttpGet("api/admin/reviews")]
    public async Task<ActionResult<ApiResponse<IReadOnlyCollection<AdminProductReviewResponse>>>> GetAdmin(
        [FromQuery] bool? approved,
        CancellationToken cancellationToken)
    {
        return Ok(ApiResponse<IReadOnlyCollection<AdminProductReviewResponse>>.Ok(
            await reviews.GetForAdminAsync(approved, cancellationToken)));
    }

    [Authorize(Policy = AppPermissions.ProductsManage)]
    [HttpPatch("api/admin/reviews/{reviewId:long}/approval")]
    public async Task<ActionResult<ApiResponse<AdminProductReviewResponse>>> SetApproval(
        long reviewId,
        ReviewApprovalRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<AdminProductReviewResponse>.Ok(
                await reviews.SetApprovalAsync(reviewId, request.IsApproved, cancellationToken),
                request.IsApproved ? "Review approved." : "Review hidden."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.ProductsManage)]
    [HttpDelete("api/admin/reviews/{reviewId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(
        long reviewId,
        CancellationToken cancellationToken)
    {
        try
        {
            await reviews.DeleteAsync(reviewId, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { reviewId }, "Review deleted."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
