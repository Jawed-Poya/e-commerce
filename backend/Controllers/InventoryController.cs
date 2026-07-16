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
    public async Task<IActionResult> Adjust(long productId, AdjustStockRequest request, CancellationToken ct) => Ok(ApiResponse<StockResult>.Ok(await inventory.AdjustAsync(productId, request, UserId, ct)));

    [HttpPost("reserve")]
    public async Task<IActionResult> Reserve(long productId, ReserveStockRequest request, CancellationToken ct) => Ok(ApiResponse<StockResult>.Ok(await inventory.ReserveAsync(productId, request, UserId, ct)));

    [HttpPost("release")]
    public async Task<IActionResult> Release(long productId, ReserveStockRequest request, CancellationToken ct) => Ok(ApiResponse<StockResult>.Ok(await inventory.ReleaseAsync(productId, request, UserId, ct)));

    [HttpPost("commit-sale")]
    public async Task<IActionResult> CommitSale(long productId, ReserveStockRequest request, CancellationToken ct) => Ok(ApiResponse<StockResult>.Ok(await inventory.CommitSaleAsync(productId, request, UserId, ct)));

    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
