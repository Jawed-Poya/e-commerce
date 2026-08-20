using System.Net;
using System.Text.Json;
using ECommerce.Data;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Customers;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace ECommerce.Services.Notifications;

public sealed class StorePushService(
    StorePushKeyStore keyStore,
    StorePushSubscriptionStore subscriptions,
    ICurrentCustomerAccessor currentCustomer,
    IDefaultCustomerTypeResolver defaultCustomerType,
    ApplicationDbContext context,
    IHttpClientFactory httpClientFactory,
    ILogger<StorePushService> logger) : IStorePushService
{
    private const int MaximumTrackedProducts = 100;
    private const int MaximumConcurrentSends = 8;

    public async Task<StorePushPublicKeyResponse> GetPublicKeyAsync(
        CancellationToken cancellationToken = default)
    {
        var keys = await keyStore.GetAsync(cancellationToken);
        return new StorePushPublicKeyResponse(keys.PublicKey);
    }

    public async Task SaveSubscriptionAsync(
        StorePushSubscriptionRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);

        var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
        var customerTypeId = await currentCustomer.GetCustomerTypeIdAsync(cancellationToken)
                             ?? defaultTypeId;
        var productIds = (request.ProductIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .Take(MaximumTrackedProducts)
            .ToArray();

        await subscriptions.UpsertAsync(
            new StorePushSubscriptionRecord(
                request.Endpoint.Trim(),
                request.P256dh.Trim(),
                request.Auth.Trim(),
                customerTypeId,
                productIds,
                DateTime.UtcNow),
            cancellationToken);
    }

    public Task RemoveSubscriptionAsync(
        string endpoint,
        CancellationToken cancellationToken = default) =>
        subscriptions.RemoveAsync(endpoint, cancellationToken);

    public async Task PublishAsync(
        StoreNotificationResponse notification,
        long? customerTypeId,
        CancellationToken cancellationToken = default)
    {
        var targets = await subscriptions.FindAsync(
            notification.ProductId,
            cancellationToken);
        if (targets.Count == 0) return;

        if (customerTypeId.HasValue)
        {
            var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
            if (customerTypeId.Value == defaultTypeId)
            {
                var customPriceTypeIds = await context.ProductPrices
                    .AsNoTracking()
                    .Where(price => price.ProductId == notification.ProductId)
                    .Select(price => price.CustomerTypeId)
                    .Distinct()
                    .ToArrayAsync(cancellationToken);
                var customPriceTypes = customPriceTypeIds
                    .Where(typeId => typeId != defaultTypeId)
                    .ToHashSet();
                targets = targets
                    .Where(target =>
                        target.CustomerTypeId == defaultTypeId ||
                        !customPriceTypes.Contains(target.CustomerTypeId))
                    .ToArray();
            }
            else
            {
                targets = targets
                    .Where(target => target.CustomerTypeId == customerTypeId.Value)
                    .ToArray();
            }

            if (targets.Count == 0) return;
        }

        var keys = await keyStore.GetAsync(cancellationToken);
        var vapid = new VapidDetails(keys.Subject, keys.PublicKey, keys.PrivateKey);
        var payload = JsonSerializer.Serialize(new
        {
            notification.Id,
            notification.Title,
            notification.Message,
            notification.Kind,
            notification.ProductId,
            notification.ProductName,
            notification.Link,
            notification.CreatedAt
        }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        using var httpClient = httpClientFactory.CreateClient();
        using var client = new WebPushClient(httpClient);
        using var gate = new SemaphoreSlim(MaximumConcurrentSends, MaximumConcurrentSends);

        var sends = targets.Select(async target =>
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                var pushSubscription = new PushSubscription(
                    target.Endpoint,
                    target.P256dh,
                    target.Auth);
                await client.SendNotificationAsync(
                    pushSubscription,
                    payload,
                    vapid,
                    cancellationToken);
            }
            catch (WebPushException exception)
                when (exception.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                await subscriptions.RemoveAsync(target.Endpoint, CancellationToken.None);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Could not deliver storefront Web Push notification {NotificationId}.",
                    notification.Id);
            }
            finally
            {
                gate.Release();
            }
        });

        await Task.WhenAll(sends);
    }

    private static void Validate(StorePushSubscriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint) ||
            !Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var endpoint) ||
            endpoint.Scheme != Uri.UriSchemeHttps)
        {
            throw new ArgumentException("A valid HTTPS push subscription endpoint is required.");
        }

        if (string.IsNullOrWhiteSpace(request.P256dh) ||
            string.IsNullOrWhiteSpace(request.Auth))
        {
            throw new ArgumentException("Push subscription encryption keys are required.");
        }
    }
}
