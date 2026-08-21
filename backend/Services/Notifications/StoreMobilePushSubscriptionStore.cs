using System.Text.Json;

namespace ECommerce.Services.Notifications;

public sealed class StoreMobilePushSubscriptionStore(
    IWebHostEnvironment environment,
    ILogger<StoreMobilePushSubscriptionStore> logger)
{
    private const string FileName = "store-mobile-push-subscriptions.json";
    private const int MaximumSubscriptions = 10_000;
    private static readonly TimeSpan MaximumIdleAge = TimeSpan.FromDays(120);
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task UpsertAsync(
        StoreMobilePushSubscriptionRecord subscription,
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var now = DateTime.UtcNow;
            subscriptions.RemoveAll(item =>
                string.Equals(item.Token, subscription.Token, StringComparison.Ordinal) ||
                string.Equals(item.DeviceId, subscription.DeviceId, StringComparison.Ordinal));
            subscriptions.RemoveAll(item => now - item.UpdatedAt > MaximumIdleAge);
            subscriptions.Add(subscription with { UpdatedAt = now });

            if (subscriptions.Count > MaximumSubscriptions)
                subscriptions = subscriptions.OrderByDescending(item => item.UpdatedAt).Take(MaximumSubscriptions).ToList();

            await WriteUnsafeAsync(subscriptions, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task<IReadOnlyCollection<StoreMobilePushSubscriptionRecord>> FindProductAsync(
        long productId,
        CancellationToken cancellationToken = default) =>
        FindAsync(item => item.ProductIds.Contains(productId), cancellationToken);

    public Task<IReadOnlyCollection<StoreMobilePushSubscriptionRecord>> FindCustomerAsync(
        long customerId,
        CancellationToken cancellationToken = default) =>
        FindAsync(item => item.CustomerId == customerId, cancellationToken);

    public async Task RemoveAsync(
        string? token,
        string? deviceId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) && string.IsNullOrWhiteSpace(deviceId)) return;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var removed = subscriptions.RemoveAll(item =>
                (!string.IsNullOrWhiteSpace(token) && string.Equals(item.Token, token.Trim(), StringComparison.Ordinal)) ||
                (!string.IsNullOrWhiteSpace(deviceId) && string.Equals(item.DeviceId, deviceId.Trim(), StringComparison.Ordinal)));
            if (removed > 0) await WriteUnsafeAsync(subscriptions, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<IReadOnlyCollection<StoreMobilePushSubscriptionRecord>> FindAsync(
        Func<StoreMobilePushSubscriptionRecord, bool> predicate,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var now = DateTime.UtcNow;
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var active = subscriptions.Where(item => now - item.UpdatedAt <= MaximumIdleAge).ToList();
            if (active.Count != subscriptions.Count) await WriteUnsafeAsync(active, cancellationToken);
            return active.Where(predicate).ToArray();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<List<StoreMobilePushSubscriptionRecord>> ReadUnsafeAsync(CancellationToken cancellationToken)
    {
        var path = ResolvePath();
        if (!File.Exists(path)) return [];

        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<List<StoreMobilePushSubscriptionRecord>>(
                       stream,
                       cancellationToken: cancellationToken) ?? [];
        }
        catch (JsonException exception)
        {
            logger.LogWarning(exception, "Mobile push subscription data is invalid; starting with an empty set.");
            return [];
        }
    }

    private async Task WriteUnsafeAsync(
        IReadOnlyCollection<StoreMobilePushSubscriptionRecord> subscriptions,
        CancellationToken cancellationToken)
    {
        var path = ResolvePath();
        var tempPath = path + ".tmp";
        await File.WriteAllTextAsync(
            tempPath,
            JsonSerializer.Serialize(subscriptions),
            cancellationToken);
        File.Move(tempPath, path, overwrite: true);
    }

    private string ResolvePath()
    {
        var directory = Path.Combine(environment.ContentRootPath, "App_Data");
        Directory.CreateDirectory(directory);
        return Path.Combine(directory, FileName);
    }
}

public sealed record StoreMobilePushSubscriptionRecord(
    string Token,
    string DeviceId,
    string Platform,
    string Locale,
    long? CustomerId,
    long CustomerTypeId,
    long[] ProductIds,
    DateTime UpdatedAt);
