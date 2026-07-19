using ECommerce.Entities;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Notifications;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/admin/notifications")]
[Authorize(Policy = AppPermissions.OrdersView)]
public sealed class AdminNotificationsController(
    IAdminNotificationService notifications,
    AdminNotificationBroker broker) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<AdminNotificationsResponse>>> Get(
        [FromQuery] DateTime? after,
        [FromQuery] int take = 30,
        CancellationToken cancellationToken = default)
    {
        var result = await notifications.GetAsync(after, take, cancellationToken);
        return Ok(ApiResponse<AdminNotificationsResponse>.Ok(result));
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        Response.Headers["Cache-Control"] = "no-cache, no-store";
        Response.Headers["Connection"] = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";
        Response.ContentType = "text/event-stream";

        using var subscription = broker.Subscribe();
        await Response.WriteAsync(": connected\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var availableTask = subscription.Reader
                    .WaitToReadAsync(cancellationToken)
                    .AsTask();
                var heartbeatTask = Task.Delay(TimeSpan.FromSeconds(20), cancellationToken);
                var completed = await Task.WhenAny(availableTask, heartbeatTask);

                if (completed == availableTask && await availableTask)
                {
                    while (subscription.Reader.TryRead(out var item))
                    {
                        var json = JsonSerializer.Serialize(item, JsonSerializerOptions.Web);
                        await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
                    }
                }
                else
                {
                    await Response.WriteAsync(": heartbeat\n\n", cancellationToken);
                }

                await Response.Body.FlushAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal browser disconnect.
        }
    }
}
