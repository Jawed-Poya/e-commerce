using ECommerce.Entities;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Services.Orders;
using ECommerce.Shared;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[Route("api/checkout")]
public sealed class CheckoutController(IOrderService orders) : ApiControllerBase
{
    [HttpGet("configuration")]
    public async Task<ActionResult<ApiResponse<CheckoutConfigurationResponse>>> GetConfiguration(
        CancellationToken cancellationToken) =>
        Success(await orders.GetCheckoutConfigurationAsync(cancellationToken));

    [HttpPost("orders")]
    [ProducesResponseType(typeof(ApiResponse<OrderConfirmationResponse>), StatusCodes.Status201Created)]
    public async Task<ActionResult<ApiResponse<OrderConfirmationResponse>>> CreateOrder(
        CreateCheckoutOrderRequest request,
        CancellationToken cancellationToken) =>
        CreatedSuccess(
            await orders.CreateAsync(request, cancellationToken),
            "Order created successfully.");

    [HttpGet("track")]
    public async Task<ActionResult<ApiResponse<OrderTrackingResponse>>> Track(
        [FromQuery] string orderNumber,
        [FromQuery] string phone,
        CancellationToken cancellationToken)
    {
        var result = await orders.TrackAsync(orderNumber, phone, cancellationToken)
            ?? throw new KeyNotFoundException("Order not found for this phone number.");

        return Success(result);
    }
}
