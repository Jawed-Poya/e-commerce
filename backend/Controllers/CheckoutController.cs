using ECommerce.Entities;
using ECommerce.Entities.Orders.Contracts;
using ECommerce.Services.Orders;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/checkout")]
public sealed class CheckoutController(IOrderService orders) : ControllerBase
{
    [HttpGet("configuration")]
    public ActionResult<ApiResponse<CheckoutConfigurationResponse>> GetConfiguration()
    {
        return Ok(ApiResponse<CheckoutConfigurationResponse>.Ok(
            orders.GetCheckoutConfiguration()));
    }

    [HttpPost("orders")]
    [ProducesResponseType(typeof(ApiResponse<OrderConfirmationResponse>), StatusCodes.Status201Created)]
    public async Task<ActionResult<ApiResponse<OrderConfirmationResponse>>> CreateOrder(
        CreateCheckoutOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await orders.CreateAsync(request, cancellationToken);
            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse<OrderConfirmationResponse>.Ok(
                    result,
                    "Order created successfully."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse<object>.Fail(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse<object>.Fail(exception.Message));
        }
    }

    [HttpGet("track")]
    public async Task<ActionResult<ApiResponse<OrderTrackingResponse>>> Track(
        [FromQuery] string orderNumber,
        [FromQuery] string phone,
        CancellationToken cancellationToken)
    {
        var result = await orders.TrackAsync(orderNumber, phone, cancellationToken);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("Order not found for this phone number."));

        return Ok(ApiResponse<OrderTrackingResponse>.Ok(result));
    }
}
