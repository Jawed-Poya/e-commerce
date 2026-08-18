using System.Collections.Concurrent;

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

    public bool TryGet(string sessionId, out StorePresenceEntry? entry) =>
        _sessions.TryGetValue(sessionId, out entry);

    public void Touch(StorePresenceEntry entry)
    {
        _sessions.AddOrUpdate(
            entry.SessionId,
            entry,
            (_, current) => entry with
            {
                FirstSeenAt = current.FirstSeenAt,
                PageTitle = entry.PageTitle ?? current.PageTitle
            });
    }

    public void Leave(string sessionId) => _sessions.TryRemove(sessionId, out _);

    public IReadOnlyList<StorePresenceEntry> GetActive(DateTime now)
    {
        var cutoff = now - ActiveWindow;
        foreach (var pair in _sessions)
        {
            if (pair.Value.LastSeenAt < cutoff)
                _sessions.TryRemove(pair.Key, out _);
        }

        return _sessions.Values
            .Where(entry => entry.LastSeenAt >= cutoff)
            .OrderByDescending(entry => entry.LastSeenAt)
            .ToArray();
    }
}
