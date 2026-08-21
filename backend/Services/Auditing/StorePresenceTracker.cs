using System.Collections.Concurrent;
using System.Threading.Channels;

namespace ECommerce.Services.Auditing;

public sealed record StorePresenceEntry(
    string SessionId,
    long? CustomerId,
    string? CustomerName,
    string CurrentPath,
    string? PageTitle,
    DateTime FirstSeenAt,
    DateTime LastSeenAt,
    string? IpAddress,
    string? DeviceType,
    string? Browser,
    string? OperatingSystem,
    string? Language,
    bool IsAuthenticated);

public sealed record CustomerPresenceChanged(
    long CustomerId,
    string SessionId,
    string Activity,
    DateTime OccurredAt);

/// <summary>
/// Process-local, privacy-conscious storefront presence. Page views remain in
/// SQL for reporting, while frequent heartbeats stay in memory so analytics
/// are not inflated. In a multi-node deployment this can later be replaced by
/// a distributed implementation without changing the API contract.
/// </summary>
public sealed class StorePresenceTracker
{
    public static readonly TimeSpan ActiveWindow = TimeSpan.FromSeconds(55);
    private readonly ConcurrentDictionary<string, StorePresenceEntry> _sessions =
        new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<Guid, Channel<CustomerPresenceChanged>> _subscribers = new();

    public bool TryGet(string sessionId, out StorePresenceEntry? entry) =>
        _sessions.TryGetValue(sessionId, out entry);

    public void Touch(StorePresenceEntry entry)
    {
        StorePresenceEntry? previous = null;
        var current = _sessions.AddOrUpdate(
            entry.SessionId,
            entry,
            (_, existing) =>
            {
                previous = existing;
                return entry with
                {
                    FirstSeenAt = existing.FirstSeenAt,
                    PageTitle = entry.PageTitle ?? existing.PageTitle
                };
            });

        if (previous?.CustomerId is long previousCustomerId && previousCustomerId != current.CustomerId)
            Publish(previousCustomerId, entry.SessionId, "leave", entry.LastSeenAt);

        if (current.CustomerId is long customerId)
            Publish(customerId, current.SessionId, "active", current.LastSeenAt);
    }

    public void Leave(string sessionId)
    {
        if (_sessions.TryRemove(sessionId, out var removed) && removed.CustomerId is long customerId)
            Publish(customerId, removed.SessionId, "leave", DateTime.UtcNow);
    }

    public IReadOnlyList<StorePresenceEntry> GetActive(DateTime now)
    {
        var cutoff = now - ActiveWindow;
        foreach (var pair in _sessions)
        {
            if (pair.Value.LastSeenAt < cutoff &&
                _sessions.TryRemove(pair.Key, out var removed) &&
                removed.CustomerId is long customerId)
            {
                Publish(customerId, removed.SessionId, "leave", now);
            }
        }

        return _sessions.Values
            .Where(entry => entry.LastSeenAt >= cutoff)
            .OrderByDescending(entry => entry.LastSeenAt)
            .ToArray();
    }

    public Subscription Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<CustomerPresenceChanged>(
            new BoundedChannelOptions(100)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
                SingleWriter = false
            });
        _subscribers[id] = channel;
        return new Subscription(id, channel.Reader, this);
    }

    private void Publish(long customerId, string sessionId, string activity, DateTime occurredAt)
    {
        var change = new CustomerPresenceChanged(customerId, sessionId, activity, occurredAt);
        foreach (var channel in _subscribers.Values)
            channel.Writer.TryWrite(change);
    }

    private void Unsubscribe(Guid id)
    {
        if (_subscribers.TryRemove(id, out var channel))
            channel.Writer.TryComplete();
    }

    public sealed class Subscription(
        Guid id,
        ChannelReader<CustomerPresenceChanged> reader,
        StorePresenceTracker tracker) : IDisposable
    {
        public ChannelReader<CustomerPresenceChanged> Reader { get; } = reader;
        public void Dispose() => tracker.Unsubscribe(id);
    }
}
