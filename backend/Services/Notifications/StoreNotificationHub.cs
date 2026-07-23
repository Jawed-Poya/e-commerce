using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Services.Customers;
using ECommerce.Shared;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Notifications;

[AllowAnonymous]
public sealed class StoreNotificationHub(
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerType,
    StoreRealtimeMetrics metrics) : Hub
{
    private const string SubscriptionKey = "store-notification-groups";


    public override Task OnConnectedAsync()
    {
        metrics.Connected(Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        metrics.Disconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task Subscribe(long[] productIds)
    {
        var ids = (productIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .Take(100)
            .ToArray();

        if (Context.Items.TryGetValue(SubscriptionKey, out var existingValue) &&
            existingValue is IReadOnlyCollection<string> existingGroups)
        {
            foreach (var group in existingGroups)
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
        }

        // React can replace a subscription immediately after a product is tracked.
        // Use bounded, non-cancelled lookup reads and then stop quietly if the
        // connection disappeared instead of surfacing TaskCanceledException.
        var defaultTypeId = await defaultCustomerType.GetIdAsync(CancellationToken.None);
        var currentTypeId = await ResolveCustomerTypeIdAsync(defaultTypeId);
        if (Context.ConnectionAborted.IsCancellationRequested) return;

        var groups = ids
            .SelectMany(productId => new[]
            {
                StoreNotificationGroups.Stock(productId),
                StoreNotificationGroups.Price(productId, defaultTypeId),
                StoreNotificationGroups.Price(productId, currentTypeId)
            })
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        try
        {
            foreach (var group in groups)
                await Groups.AddToGroupAsync(Context.ConnectionId, group);

            Context.Items[SubscriptionKey] = groups;
        }
        catch (OperationCanceledException) when (Context.ConnectionAborted.IsCancellationRequested)
        {
            // Normal disconnect/re-subscribe path.
        }
    }

    private async Task<long> ResolveCustomerTypeIdAsync(long defaultTypeId)
    {
        if (!long.TryParse(Context.User?.FindFirstValue(AuthClaims.CustomerId), out var customerId))
            return defaultTypeId;

        return await context.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => customer.CustomerTypeId)
            .SingleOrDefaultAsync(CancellationToken.None)
            ?? defaultTypeId;
    }
}
