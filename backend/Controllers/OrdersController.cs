using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Entities.Orders.Filters;
using ECommerce.Services.Orders;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Route("api/orders")]
public sealed class OrdersController(IOrderService orders) : ApiControllerBase
{
    [Authorize(Policy = AppPermissions.OrdersView)]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<OrderListItemResponse>>>> Get(
        [FromQuery] OrderFilter filter,
        CancellationToken cancellationToken) =>
        Success(await orders.GetAsync(filter, cancellationToken));

    [Authorize(Policy = AppPermissions.OrdersView)]
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var result = await orders.GetByIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Order not found.");

        return Success(result);
    }

    [Authorize(Policy = AppPermissions.OrdersManage)]
    [HttpPatch("{id:long}/status")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> UpdateStatus(
        long id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken) =>
        Success(
            await orders.UpdateStatusAsync(id, request, CurrentUserId, cancellationToken),
            "Order status updated successfully.");

    [Authorize(Policy = AppPermissions.PaymentsManage)]
    [HttpPatch("{id:long}/payment")]
    public async Task<ActionResult<ApiResponse<OrderDetailsResponse>>> UpdatePayment(
        long id,
        UpdatePaymentStatusRequest request,
        CancellationToken cancellationToken) =>
        Success(
            await orders.UpdatePaymentStatusAsync(id, request, CurrentUserId, cancellationToken),
            "Payment status updated successfully.");
}
