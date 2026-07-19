using System.Security.Claims;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Entities.Orders.Filters;
using ECommerce.Services.Orders;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<OrderListItemResponse>>>> Get(
        [FromQuery] OrderFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await orders.GetAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<OrderListItemResponse>>.Ok(result));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var result = await orders.GetByIdAsync(id, cancellationToken);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("Order not found."));

        return Ok(ApiResponse<OrderDetailsResponse>.Ok(result));
    }

    [HttpPatch("{id:long}/status")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> UpdateStatus(
        long id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await orders.UpdateStatusAsync(
                id,
                request,
                User.FindFirstValue(ClaimTypes.NameIdentifier),
                cancellationToken);

            return Ok(ApiResponse<OrderDetailsResponse>.Ok(
                result,
                "Order status updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpPatch("{id:long}/payment")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> UpdatePayment(
        long id,
        UpdatePaymentStatusRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await orders.UpdatePaymentStatusAsync(
                id,
                request,
                User.FindFirstValue(ClaimTypes.NameIdentifier),
                cancellationToken);

            return Ok(ApiResponse<OrderDetailsResponse>.Ok(
                result,
                "Payment status updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }
}
