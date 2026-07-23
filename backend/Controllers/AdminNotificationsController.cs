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
    public async Task Stream()
    {
        var requestAborted = HttpContext.RequestAborted;

        Response.Headers["Cache-Control"] = "no-cache, no-store";
        Response.Headers["Connection"] = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";
        Response.ContentType = "text/event-stream";

        try
        {
            using var subscription = broker.Subscribe();

            await WriteEventAsync(": connected\n\n", requestAborted);

            while (!requestAborted.IsCancellationRequested)
            {
                var notificationReady = subscription.Reader
                    .WaitToReadAsync(requestAborted)
                    .AsTask();
                var heartbeatDue = Task.Delay(TimeSpan.FromSeconds(20), requestAborted);
                var completed = await Task.WhenAny(notificationReady, heartbeatDue);

                if (completed == notificationReady && await notificationReady)
                {
                    while (subscription.Reader.TryRead(out var item))
                    {
                        var json = JsonSerializer.Serialize(item, JsonSerializerOptions.Web);
                        await WriteEventAsync($"data: {json}\n\n", requestAborted);
                    }
                }
                else
                {
                    await WriteEventAsync(": heartbeat\n\n", requestAborted);
                }
            }
        }
        catch (OperationCanceledException) when (requestAborted.IsCancellationRequested)
        {
            // Closing the browser, navigating away, or reconnecting normally aborts SSE.
        }
        catch (IOException) when (requestAborted.IsCancellationRequested)
        {
            // Kestrel can surface a disconnected SSE client as an I/O exception.
        }
    }

    private async Task WriteEventAsync(string payload, CancellationToken cancellationToken)
    {
        await Response.WriteAsync(payload, cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
