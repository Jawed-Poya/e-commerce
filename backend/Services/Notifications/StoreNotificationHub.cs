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

        var defaultTypeId = await defaultCustomerType.GetIdAsync(Context.ConnectionAborted);
        var currentTypeId = await ResolveCustomerTypeIdAsync(defaultTypeId);
        var groups = ids
            .SelectMany(productId => new[]
            {
                StoreNotificationGroups.Stock(productId),
                StoreNotificationGroups.Price(productId, defaultTypeId),
                StoreNotificationGroups.Price(productId, currentTypeId)
            })
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        foreach (var group in groups)
            await Groups.AddToGroupAsync(Context.ConnectionId, group);

        Context.Items[SubscriptionKey] = groups;
    }

    private async Task<long> ResolveCustomerTypeIdAsync(long defaultTypeId)
    {
        if (!long.TryParse(Context.User?.FindFirstValue(AuthClaims.CustomerId), out var customerId))
            return defaultTypeId;

        return await context.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => customer.CustomerTypeId)
            .SingleOrDefaultAsync(Context.ConnectionAborted)
            ?? defaultTypeId;
    }
}
