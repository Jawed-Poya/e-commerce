using ECommerce.Shared;
using ECommerce.Entities;
using ECommerce.Entities.Common;
using ECommerce.Entities.Customers.Contracts;
using ECommerce.Entities.Customers.Filters;
using ECommerce.Services.Auditing;
using ECommerce.Services.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ECommerce.Controllers;

[ApiController]
[Route("api/customers")]
public sealed class CustomersController(
    ICustomerService customers,
    StorePresenceTracker presence) : ControllerBase
{
    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CustomerListItemResponse>>>> Get(
        [FromQuery] CustomerFilter filter,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetAsync(filter, cancellationToken);
        return Ok(ApiResponse<PagedResult<CustomerListItemResponse>>.Ok(result));
    }

    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet("activity-stream")]
    public async Task StreamActivity()
    {
        var requestAborted = HttpContext.RequestAborted;

        Response.Headers["Cache-Control"] = "no-cache, no-store";
        Response.Headers["Connection"] = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";
        Response.ContentType = "text/event-stream";

        try
        {
            using var subscription = presence.Subscribe();
            await WriteEventAsync(": connected\n\n", requestAborted);

            while (!requestAborted.IsCancellationRequested)
            {
                var activityReady = subscription.Reader.WaitToReadAsync(requestAborted).AsTask();
                var heartbeatDue = Task.Delay(TimeSpan.FromSeconds(20), requestAborted);
                var completed = await Task.WhenAny(activityReady, heartbeatDue);

                if (completed == activityReady && await activityReady)
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
            // Navigating away or reconnecting normally aborts the customer stream.
        }
        catch (IOException) when (requestAborted.IsCancellationRequested)
        {
            // Kestrel can surface a disconnected SSE client as an I/O exception.
        }
    }

    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> GetById(
        long id,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetByIdAsync(id, cancellationToken);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("Customer not found."));

        return Ok(ApiResponse<CustomerDetailsResponse>.Ok(result));
    }

    [Authorize(Policy = AppPermissions.CustomersView)]
    [HttpGet("{id:long}/engagement")]
    public async Task<ActionResult<ApiResponse<CustomerEngagementResponse>>> GetEngagement(
        long id,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetEngagementAsync(id, cancellationToken);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("Customer not found."));

        return Ok(ApiResponse<CustomerEngagementResponse>.Ok(result));
    }

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> Create(
        UpsertCustomerRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await customers.CreateAsync(request, cancellationToken);
            return StatusCode(
                StatusCodes.Status201Created,
                ApiResponse<CustomerDetailsResponse>.Ok(
                    result,
                    "Customer created successfully."));
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

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse<CustomerDetailsResponse>>> Update(
        long id,
        UpsertCustomerRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await customers.UpdateAsync(id, request, cancellationToken);
            return Ok(ApiResponse<CustomerDetailsResponse>.Ok(
                result,
                "Customer updated successfully."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse<object>.Fail(exception.Message));
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

    [Authorize(Policy = AppPermissions.CustomersManage)]
    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(
        long id,
        CancellationToken cancellationToken)
    {
        try
        {
            await customers.DeleteAsync(id, cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { id }, "Customer deleted successfully."));
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

    private async Task WriteEventAsync(string payload, CancellationToken cancellationToken)
    {
        await Response.WriteAsync(payload, cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }
}
