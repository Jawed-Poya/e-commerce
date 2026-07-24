using System.Collections.Concurrent;
using System.Threading.Channels;
using ECommerce.Entities.Notifications.Contracts;

namespace ECommerce.Services.Notifications;

/// <summary>
/// In-process real-time broker partitioned by tenant. A subscriber receives only
/// events published for the tenant in its authenticated JWT context.
/// </summary>
public sealed class AdminNotificationBroker
{
    private readonly ConcurrentDictionary<Guid, Subscriber> subscribers = new();

    public Subscription Subscribe(long tenantId)
    {
        if (tenantId <= 0) throw new ArgumentOutOfRangeException(nameof(tenantId));
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<AdminNotificationResponse>(
            new BoundedChannelOptions(100)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false
            });
        subscribers[id] = new Subscriber(tenantId, channel);
        return new Subscription(id, channel.Reader, this);
    }

    public void Publish(long tenantId, AdminNotificationResponse notification)
    {
        foreach (var subscriber in subscribers.Values)
        {
            if (subscriber.TenantId == tenantId)
                subscriber.Channel.Writer.TryWrite(notification);
        }
    }

    private void Unsubscribe(Guid id)
    {
        if (subscribers.TryRemove(id, out var subscriber))
            subscriber.Channel.Writer.TryComplete();
    }

    private sealed record Subscriber(
        long TenantId,
        Channel<AdminNotificationResponse> Channel);

    public sealed class Subscription(
        Guid id,
        ChannelReader<AdminNotificationResponse> reader,
        AdminNotificationBroker broker) : IDisposable
    {
        public ChannelReader<AdminNotificationResponse> Reader { get; } = reader;
        public void Dispose() => broker.Unsubscribe(id);
    }
}
