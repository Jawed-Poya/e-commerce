using System.Collections.Concurrent;
using System.Threading.Channels;
using ECommerce.Entities.Notifications.Contracts;

namespace ECommerce.Services.Notifications;

public sealed class AdminNotificationBroker
{
    private readonly ConcurrentDictionary<Guid, Channel<AdminNotificationResponse>> _subscribers = new();

    public Subscription Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<AdminNotificationResponse>(
            new BoundedChannelOptions(100)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false
            });
        _subscribers[id] = channel;
        return new Subscription(id, channel.Reader, this);
    }

    public void Publish(AdminNotificationResponse notification)
    {
        foreach (var channel in _subscribers.Values)
            channel.Writer.TryWrite(notification);
    }

    private void Unsubscribe(Guid id)
    {
        if (_subscribers.TryRemove(id, out var channel))
            channel.Writer.TryComplete();
    }

    public sealed class Subscription(
        Guid id,
        ChannelReader<AdminNotificationResponse> reader,
        AdminNotificationBroker broker) : IDisposable
    {
        public ChannelReader<AdminNotificationResponse> Reader { get; } = reader;
        public void Dispose() => broker.Unsubscribe(id);
    }
}
