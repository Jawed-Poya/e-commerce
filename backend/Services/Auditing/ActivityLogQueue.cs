using System.Threading.Channels;
using ECommerce.Entities;

namespace ECommerce.Services.Auditing;

/// <summary>
/// Keeps request logging off the response path while applying back-pressure
/// instead of silently dropping security/audit records during traffic spikes.
/// </summary>
public sealed class ActivityLogQueue
{
    private readonly Channel<ActivityLog> _channel = Channel.CreateBounded<ActivityLog>(
        new BoundedChannelOptions(20_000)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false
        });

    public ValueTask EnqueueAsync(ActivityLog item, CancellationToken cancellationToken = default) =>
        _channel.Writer.WriteAsync(item, cancellationToken);

    public ChannelReader<ActivityLog> Reader => _channel.Reader;
}
