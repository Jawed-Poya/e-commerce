using ECommerce.Entities;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/store/notifications")]
public sealed class StoreNotificationsController(IStoreNotificationService notifications) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<StoreNotificationsResponse>>> Get(
        [FromQuery] DateTime? after,
        [FromQuery] long[] productIds,
        CancellationToken cancellationToken)
    {
        var result = await notifications.GetStoreNotificationsAsync(
            after,
            productIds ?? [],
            cancellationToken);
        return Ok(ApiResponse<StoreNotificationsResponse>.Ok(result));
    }
}
