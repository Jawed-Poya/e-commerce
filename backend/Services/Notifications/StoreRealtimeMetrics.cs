using System.Collections.Concurrent;

namespace ECommerce.Services.Notifications;

public sealed class StoreRealtimeMetrics
{
    private readonly ConcurrentDictionary<string, byte> _connections = new();

    public int ActiveConnections => _connections.Count;

    public void Connected(string connectionId) =>
        _connections.TryAdd(connectionId, 0);

    public void Disconnected(string connectionId) =>
        _connections.TryRemove(connectionId, out _);
}
