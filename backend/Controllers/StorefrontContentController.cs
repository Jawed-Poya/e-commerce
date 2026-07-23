using ECommerce.Entities;
using ECommerce.Entities.Storefront.Contracts;
using ECommerce.Services.Storefront;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/storefront/content")]
public sealed class StorefrontContentController(IStorefrontContentService content) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<StorefrontContentResponse>>> Get(
        CancellationToken cancellationToken)
    {
        return Ok(ApiResponse<StorefrontContentResponse>.Ok(
            await content.GetAsync(cancellationToken)));
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPut]
    public async Task<ActionResult<ApiResponse<StorefrontContentResponse>>> Update(
        UpdateStorefrontContentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<StorefrontContentResponse>.Ok(
                await content.UpdateAsync(request, cancellationToken),
                "Storefront hero updated successfully."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPost("hero-image")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> UploadHeroImage(
        IFormFile image,
        CancellationToken cancellationToken)
    {
        try
        {
            var imageUrl = await content.SaveHeroImageAsync(image, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { imageUrl }, "Hero image uploaded."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
