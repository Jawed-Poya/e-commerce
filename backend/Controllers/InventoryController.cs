using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Services.Inventory;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/products/{productId:long}/inventory")]
public sealed class InventoryController(IInventoryService inventory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(long productId, CancellationToken ct)
    {
        var result = await inventory.GetAsync(productId, ct);
        return result is null ? NotFound(ApiResponse<object>.Fail("Product inventory not found.")) : Ok(ApiResponse<StockResult>.Ok(result));
    }

    [HttpPost("adjust")]
    public Task<IActionResult> Adjust(long productId, AdjustStockRequest request, CancellationToken ct) =>
        Mutate(() => inventory.AdjustAsync(productId, request, UserId, ct));

    [HttpPost("reserve")]
    public Task<IActionResult> Reserve(long productId, ReserveStockRequest request, CancellationToken ct) =>
        Mutate(() => inventory.ReserveAsync(productId, request, UserId, ct));

    [HttpPost("release")]
    public Task<IActionResult> Release(long productId, ReserveStockRequest request, CancellationToken ct) =>
        Mutate(() => inventory.ReleaseAsync(productId, request, UserId, ct));

    [HttpPost("commit-sale")]
    public Task<IActionResult> CommitSale(long productId, ReserveStockRequest request, CancellationToken ct) =>
        Mutate(() => inventory.CommitSaleAsync(productId, request, UserId, ct));

    private async Task<IActionResult> Mutate(Func<Task<StockResult>> action)
    {
        try
        {
            return Ok(ApiResponse<StockResult>.Ok(await action()));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<StockResult>.Fail(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<StockResult>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(ApiResponse<StockResult>.Fail(exception.Message));
        }
    }

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
