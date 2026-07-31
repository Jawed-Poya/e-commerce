using System.Threading.Channels;
using ECommerce.Entities;

namespace ECommerce.Services.Auditing;

/// <summary>
/// Keeps audit writes off the response path while applying back-pressure.
/// The writer is completed during graceful shutdown so pending records can be
/// drained instead of disappearing when the API process stops.
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

    public bool TryEnqueue(ActivityLog item) => _channel.Writer.TryWrite(item);

    public void Complete() => _channel.Writer.TryComplete();

    public ChannelReader<ActivityLog> Reader => _channel.Reader;
}
