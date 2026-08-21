using ECommerce.Entities;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/store/notifications")]
public sealed class StoreNotificationsController(
    IStoreNotificationService notifications,
    IStorePushService push) : ControllerBase
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

    [HttpGet("push/public-key")]
    public async Task<ActionResult<ApiResponse<StorePushPublicKeyResponse>>> GetPushPublicKey(
        CancellationToken cancellationToken)
    {
        var result = await push.GetPublicKeyAsync(cancellationToken);
        return Ok(ApiResponse<StorePushPublicKeyResponse>.Ok(result));
    }

    [HttpPost("push/subscription")]
    public async Task<ActionResult<ApiResponse<object>>> SavePushSubscription(
        [FromBody] StorePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        await push.SaveSubscriptionAsync(request, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { subscribed = true }));
    }

    [HttpPost("push/unsubscribe")]
    public async Task<ActionResult<ApiResponse<object>>> RemovePushSubscription(
        [FromBody] RemoveStorePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        await push.RemoveSubscriptionAsync(request.Endpoint, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { subscribed = false }));
    }

    [HttpPost("push/mobile/subscription")]
    public async Task<ActionResult<ApiResponse<object>>> SaveMobilePushSubscription(
        [FromBody] MobilePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        await push.SaveMobileSubscriptionAsync(request, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { subscribed = true }));
    }

    [HttpPost("push/mobile/unsubscribe")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveMobilePushSubscription(
        [FromBody] RemoveMobilePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        await push.RemoveMobileSubscriptionAsync(request.Token, request.DeviceId, cancellationToken);
        return Ok(ApiResponse<object>.Ok(new { subscribed = false }));
    }
}
