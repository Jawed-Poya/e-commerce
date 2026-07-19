using API.Entities.Types;
using ECommerce.Dtos;
using ECommerce.Services.GeneralTypes;
using ECommerce.Services.Products;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ECommerce.Shared;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/types")]
public class GeneralTypesController : ControllerBase
{
    private readonly IGeneralTypeService _service;
    private readonly IProductImageStorage _imageStorage;

    public GeneralTypesController(
        IGeneralTypeService service,
        IProductImageStorage imageStorage)
    {
        _service = service;
        _imageStorage = imageStorage;
    }

    [HttpGet]
    public async Task<IActionResult> Get(string? group)
    {
        return Ok(new
        {
            data = await _service.GetAsync(group),
            success = true,
            message = ""
        });
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id)
    {
        return Ok(await _service.GetByIdAsync(id));
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPost]
    [Consumes("application/json")]
    public async Task<IActionResult> CreateJson(
        [FromBody] GeneralType model)
    {
        return Ok(await _service.CreateAsync(model));
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Create(
        [FromForm] GeneralTypeUpsertRequest request,
        CancellationToken cancellationToken)
    {
        StoredProductImage? storedImage = null;

        try
        {
            if (request.Image is not null)
            {
                storedImage = await _imageStorage.SaveAsync(
                    request.Image,
                    "types",
                    cancellationToken
                );
            }

            var model = ToModel(
                request,
                storedImage?.PublicUrl ?? request.ImageUrl
            );

            return Ok(await _service.CreateAsync(model));
        }
        catch (InvalidOperationException exception)
        {
            await DeleteSafelyAsync(storedImage);

            return BadRequest(new
            {
                success = false,
                message = exception.Message
            });
        }
        catch
        {
            await DeleteSafelyAsync(storedImage);
            throw;
        }
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPut("{id:long}")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpdateJson(
        long id,
        [FromBody] GeneralType model)
    {
        var current = await _service.GetByIdAsync(id);

        if (current is null)
        {
            return NotFound();
        }

        await _service.UpdateAsync(id, model);
        var updated = await _service.GetByIdAsync(id);

        if (!string.Equals(
                current.ImageUrl,
                updated?.ImageUrl,
                StringComparison.OrdinalIgnoreCase
            ))
        {
            await DeleteOwnedImageSafelyAsync(current.ImageUrl);
        }

        return NoContent();
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpPut("{id:long}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(
        long id,
        [FromForm] GeneralTypeUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var current = await _service.GetByIdAsync(id);

        if (current is null)
        {
            return NotFound();
        }

        StoredProductImage? storedImage = null;

        try
        {
            if (request.Image is not null)
            {
                storedImage = await _imageStorage.SaveAsync(
                    request.Image,
                    "types",
                    cancellationToken
                );
            }

            var model = ToModel(
                request,
                storedImage?.PublicUrl ?? request.ImageUrl
            );

            await _service.UpdateAsync(id, model);
            var updated = await _service.GetByIdAsync(id);

            if (!string.Equals(
                    current.ImageUrl,
                    updated?.ImageUrl,
                    StringComparison.OrdinalIgnoreCase
                ))
            {
                await DeleteOwnedImageSafelyAsync(current.ImageUrl);
            }

            return NoContent();
        }
        catch (InvalidOperationException exception)
        {
            await DeleteSafelyAsync(storedImage);

            return BadRequest(new
            {
                success = false,
                message = exception.Message
            });
        }
        catch
        {
            await DeleteSafelyAsync(storedImage);
            throw;
        }
    }

    [Authorize(Policy = AppPermissions.SystemManage)]
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var current = await _service.GetByIdAsync(id);

        await _service.DeleteAsync(id);
        await DeleteOwnedImageSafelyAsync(current?.ImageUrl);

        return NoContent();
    }

    private static GeneralType ToModel(
        GeneralTypeUpsertRequest request,
        string? imageUrl)
    {
        return new GeneralType
        {
            Name = request.Name,
            ImageUrl = string.IsNullOrWhiteSpace(imageUrl)
                ? null
                : imageUrl.Trim(),
            Group = request.Group,
            SortOrder = request.SortOrder,
            ParentId = request.ParentId
        };
    }

    private async Task DeleteSafelyAsync(
        StoredProductImage? storedImage)
    {
        if (storedImage is null)
        {
            return;
        }

        try
        {
            await _imageStorage.DeleteAsync(storedImage.RelativePath);
        }
        catch
        {
            // A cleanup failure must not hide the original request error.
        }
    }

    private async Task DeleteOwnedImageSafelyAsync(string? imageUrl)
    {
        const string ownedPrefix = "/uploads/types/";

        if (string.IsNullOrWhiteSpace(imageUrl) ||
            !imageUrl.StartsWith(
                ownedPrefix,
                StringComparison.OrdinalIgnoreCase
            ))
        {
            return;
        }

        try
        {
            await _imageStorage.DeleteAsync(imageUrl.TrimStart('/'));
        }
        catch
        {
            // The database change remains valid if an old file cannot be removed.
        }
    }
}
