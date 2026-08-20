using System.Text.Json;
using WebPush;

namespace ECommerce.Services.Notifications;

public sealed class StorePushKeyStore(
    IWebHostEnvironment environment,
    IConfiguration configuration,
    ILogger<StorePushKeyStore> logger)
{
    private const string FileName = "store-push-vapid.json";
    private readonly SemaphoreSlim _gate = new(1, 1);
    private StoredVapidKeys? _cached;

    public async Task<StoredVapidKeys> GetAsync(
        CancellationToken cancellationToken = default)
    {
        if (_cached is not null) return _cached;

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_cached is not null) return _cached;

            var directory = Path.Combine(environment.ContentRootPath, "App_Data");
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, FileName);

            if (File.Exists(path))
            {
                await using var stream = File.OpenRead(path);
                var existing = await JsonSerializer.DeserializeAsync<StoredVapidKeys>(
                    stream,
                    cancellationToken: cancellationToken);
                if (existing is not null &&
                    !string.IsNullOrWhiteSpace(existing.PublicKey) &&
                    !string.IsNullOrWhiteSpace(existing.PrivateKey))
                {
                    _cached = existing with { Subject = ResolveSubject(existing.Subject) };
                    return _cached;
                }
            }

            var generated = VapidHelper.GenerateVapidKeys();
            var keys = new StoredVapidKeys(
                ResolveSubject(null),
                generated.PublicKey,
                generated.PrivateKey);

            var tempPath = path + ".tmp";
            await File.WriteAllTextAsync(
                tempPath,
                JsonSerializer.Serialize(keys, new JsonSerializerOptions { WriteIndented = true }),
                cancellationToken);
            File.Move(tempPath, path, overwrite: true);

            _cached = keys;
            logger.LogInformation("Created persistent Web Push VAPID keys in App_Data.");
            return keys;
        }
        finally
        {
            _gate.Release();
        }
    }

    private string ResolveSubject(string? storedSubject)
    {
        var configured = configuration["WebPush:Subject"]?.Trim();
        if (!string.IsNullOrWhiteSpace(configured)) return configured;
        if (!string.IsNullOrWhiteSpace(storedSubject)) return storedSubject;
        return "mailto:notifications@localhost";
    }
}

public sealed record StoredVapidKeys(
    string Subject,
    string PublicKey,
    string PrivateKey);
