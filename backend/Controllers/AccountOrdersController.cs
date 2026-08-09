using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Services.Orders;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Authorize(Roles = AppRoles.Customer)]
[ApiController]
[Route("api/account/orders")]
public sealed class AccountOrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<OrderListItemResponse>>>> Get(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await orders.GetMyOrdersAsync(page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<OrderListItemResponse>>.Ok(result));
    }

    [HttpGet("{orderNumber}")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> GetByNumber(
        string orderNumber,
        CancellationToken cancellationToken)
    {
        var result = await orders.GetMyOrderAsync(orderNumber, cancellationToken);
        return result is null
            ? NotFound(ApiResponse<object>.Fail("Order not found."))
            : Ok(ApiResponse<OrderDetailsResponse>.Ok(result));
    }
}
