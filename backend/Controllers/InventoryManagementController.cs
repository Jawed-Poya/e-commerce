using ECommerce.Shared;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Products.Contracts;
using ECommerce.Entities.Products.Filters;
using ECommerce.Services.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Authorize(Roles = AppRoles.Admin)]
[ApiController]
[Route("api/inventory")]
public sealed class InventoryManagementController(IInventoryService inventory) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<InventoryOverviewResponse>>> GetOverview(
        [FromQuery] InventoryFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await inventory.GetOverviewAsync(filter, cancellationToken);
        return Ok(ApiResponse<InventoryOverviewResponse>.Ok(result));
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<PagedResult<InventoryTransactionResponse>>>> GetTransactions(
        [FromQuery] InventoryTransactionFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await inventory.GetTransactionsAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<InventoryTransactionResponse>>.Ok(result));
    }

    [HttpPatch("{productId:long}/settings")]
    public async Task<IActionResult> UpdateSettings(
        long productId,
        UpdateInventorySettingsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await inventory.UpdateSettingsAsync(productId, request, cancellationToken);
            return Ok(ApiResponse<StockResult>.Ok(result, "Inventory settings updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<StockResult>.Fail(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<StockResult>.Fail(exception.Message));
        }
    }
}
