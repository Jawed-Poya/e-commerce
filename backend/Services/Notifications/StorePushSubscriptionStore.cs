using System.Text.Json;

namespace ECommerce.Services.Notifications;

public sealed class StorePushSubscriptionStore(
    IWebHostEnvironment environment,
    ILogger<StorePushSubscriptionStore> logger)
{
    private const string FileName = "store-push-subscriptions.json";
    private const int MaximumSubscriptions = 10_000;
    private static readonly TimeSpan MaximumIdleAge = TimeSpan.FromDays(120);
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task UpsertAsync(
        StorePushSubscriptionRecord subscription,
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var now = DateTime.UtcNow;
            subscriptions.RemoveAll(item =>
                string.Equals(item.Endpoint, subscription.Endpoint, StringComparison.Ordinal));
            subscriptions.RemoveAll(item => now - item.UpdatedAt > MaximumIdleAge);
            subscriptions.Add(subscription with { UpdatedAt = now });

            if (subscriptions.Count > MaximumSubscriptions)
            {
                subscriptions = subscriptions
                    .OrderByDescending(item => item.UpdatedAt)
                    .Take(MaximumSubscriptions)
                    .ToList();
            }

            await WriteUnsafeAsync(subscriptions, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyCollection<StorePushSubscriptionRecord>> FindAsync(
        long productId,
        CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var now = DateTime.UtcNow;
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var active = subscriptions
                .Where(item => now - item.UpdatedAt <= MaximumIdleAge)
                .Where(item => item.ProductIds.Contains(productId))
                .ToArray();

            if (active.Length != subscriptions.Count &&
                subscriptions.Any(item => now - item.UpdatedAt > MaximumIdleAge))
            {
                await WriteUnsafeAsync(
                    subscriptions.Where(item => now - item.UpdatedAt <= MaximumIdleAge).ToList(),
                    cancellationToken);
            }

            return active;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task RemoveAsync(
        string endpoint,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) return;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            var subscriptions = await ReadUnsafeAsync(cancellationToken);
            var removed = subscriptions.RemoveAll(item =>
                string.Equals(item.Endpoint, endpoint, StringComparison.Ordinal));
            if (removed > 0)
                await WriteUnsafeAsync(subscriptions, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<List<StorePushSubscriptionRecord>> ReadUnsafeAsync(
        CancellationToken cancellationToken)
    {
        var path = ResolvePath();
        if (!File.Exists(path)) return [];

        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<List<StorePushSubscriptionRecord>>(
                       stream,
                       cancellationToken: cancellationToken)
                   ?? [];
        }
        catch (JsonException exception)
        {
            logger.LogWarning(exception, "Store push subscription data is invalid; starting with an empty set.");
            return [];
        }
    }

    private async Task WriteUnsafeAsync(
        IReadOnlyCollection<StorePushSubscriptionRecord> subscriptions,
        CancellationToken cancellationToken)
    {
        var path = ResolvePath();
        var tempPath = path + ".tmp";
        await File.WriteAllTextAsync(
            tempPath,
            JsonSerializer.Serialize(subscriptions, new JsonSerializerOptions { WriteIndented = false }),
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

public sealed record StorePushSubscriptionRecord(
    string Endpoint,
    string P256dh,
    string Auth,
    long CustomerTypeId,
    long[] ProductIds,
    DateTime UpdatedAt);
