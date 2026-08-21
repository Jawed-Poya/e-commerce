using System.Threading.Channels;
using ECommerce.Entities.Notifications.Contracts;

namespace ECommerce.Services.Notifications;

public sealed record StorePushDelivery(
    StoreNotificationResponse? Notification,
    long? CustomerTypeId,
    CustomerOrderPush? Order = null);

public sealed record CustomerOrderPush(
    long CustomerId,
    string OrderNumber,
    string Status);

public sealed class StorePushDeliveryQueue
{
    private readonly Channel<StorePushDelivery> _channel = Channel.CreateUnbounded<StorePushDelivery>(
        new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
            AllowSynchronousContinuations = false
        });

    public void Enqueue(StorePushDelivery delivery)
    {
        if (!_channel.Writer.TryWrite(delivery))
            throw new InvalidOperationException("Could not queue the storefront push notification.");
    }

    public IAsyncEnumerable<StorePushDelivery> ReadAllAsync(
        CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}

public sealed class StorePushDeliveryHostedService(
    StorePushDeliveryQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<StorePushDeliveryHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var delivery in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var push = scope.ServiceProvider.GetRequiredService<IStorePushService>();
                if (delivery.Notification is not null)
                {
                    await push.PublishAsync(
                        delivery.Notification,
                        delivery.CustomerTypeId,
                        stoppingToken);
                }
                else if (delivery.Order is not null)
                {
                    await push.PublishOrderAsync(
                        delivery.Order.CustomerId,
                        delivery.Order.OrderNumber,
                        delivery.Order.Status,
                        stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Could not process storefront push delivery {NotificationId} for order {OrderNumber}.",
                    delivery.Notification?.Id,
                    delivery.Order?.OrderNumber);
            }
        }
    }
}
