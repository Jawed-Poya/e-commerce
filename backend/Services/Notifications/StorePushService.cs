using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ECommerce.Data;
using ECommerce.Entities.Notifications.Contracts;
using ECommerce.Services.Customers;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace ECommerce.Services.Notifications;

public sealed class StorePushService(
    StorePushKeyStore keyStore,
    StorePushSubscriptionStore webSubscriptions,
    StoreMobilePushSubscriptionStore mobileSubscriptions,
    ICurrentCustomerAccessor currentCustomer,
    IDefaultCustomerTypeResolver defaultCustomerType,
    ApplicationDbContext context,
    IHttpClientFactory httpClientFactory,
    ILogger<StorePushService> logger) : IStorePushService
{
    private const int MaximumTrackedProducts = 100;
    private const int MaximumConcurrentSends = 8;
    private const int ExpoBatchSize = 100;
    private const string ExpoPushEndpoint = "https://exp.host/--/api/v2/push/send";

    public async Task<StorePushPublicKeyResponse> GetPublicKeyAsync(CancellationToken cancellationToken = default)
    {
        var keys = await keyStore.GetAsync(cancellationToken);
        return new StorePushPublicKeyResponse(keys.PublicKey);
    }

    public async Task SaveSubscriptionAsync(StorePushSubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        ValidateWeb(request);
        await webSubscriptions.UpsertAsync(
            new StorePushSubscriptionRecord(
                request.Endpoint.Trim(), request.P256dh.Trim(), request.Auth.Trim(),
                await ResolveCustomerTypeIdAsync(cancellationToken),
                NormalizeProductIds(request.ProductIds), DateTime.UtcNow),
            cancellationToken);
    }

    public Task RemoveSubscriptionAsync(string endpoint, CancellationToken cancellationToken = default) =>
        webSubscriptions.RemoveAsync(endpoint, cancellationToken);

    public async Task SaveMobileSubscriptionAsync(MobilePushSubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        ValidateMobile(request);
        await mobileSubscriptions.UpsertAsync(
            new StoreMobilePushSubscriptionRecord(
                request.Token.Trim(), request.DeviceId.Trim(), NormalizePlatform(request.Platform),
                NormalizeLocale(request.Locale),
                await currentCustomer.ResolveCustomerIdAsync(cancellationToken),
                await ResolveCustomerTypeIdAsync(cancellationToken),
                NormalizeProductIds(request.ProductIds), DateTime.UtcNow),
            cancellationToken);
    }

    public Task RemoveMobileSubscriptionAsync(string token, string deviceId, CancellationToken cancellationToken = default) =>
        mobileSubscriptions.RemoveAsync(token, deviceId, cancellationToken);

    public async Task PublishAsync(
        StoreNotificationResponse notification,
        long? customerTypeId,
        CancellationToken cancellationToken = default)
    {
        var webTargetsTask = webSubscriptions.FindAsync(notification.ProductId, cancellationToken);
        var mobileTargetsTask = mobileSubscriptions.FindProductAsync(notification.ProductId, cancellationToken);
        await Task.WhenAll(webTargetsTask, mobileTargetsTask);

        IReadOnlyCollection<StorePushSubscriptionRecord> webTargets = await webTargetsTask;
        IReadOnlyCollection<StoreMobilePushSubscriptionRecord> mobileTargets = await mobileTargetsTask;
        if (webTargets.Count == 0 && mobileTargets.Count == 0) return;

        if (customerTypeId.HasValue)
        {
            var defaultTypeId = await defaultCustomerType.GetIdAsync(cancellationToken);
            var customPriceTypeIds = customerTypeId.Value == defaultTypeId
                ? await context.ProductPrices.AsNoTracking()
                    .Where(price => price.ProductId == notification.ProductId)
                    .Select(price => price.CustomerTypeId).Distinct().ToArrayAsync(cancellationToken)
                : [];
            var customPriceTypes = customPriceTypeIds.Where(id => id != defaultTypeId).ToHashSet();

            webTargets = FilterCustomerTypes(webTargets, item => item.CustomerTypeId,
                customerTypeId.Value, defaultTypeId, customPriceTypes);
            mobileTargets = FilterCustomerTypes(mobileTargets, item => item.CustomerTypeId,
                customerTypeId.Value, defaultTypeId, customPriceTypes);
        }

        await Task.WhenAll(
            SendWebPushAsync(webTargets, notification, cancellationToken),
            SendExpoProductPushAsync(mobileTargets, notification, cancellationToken));
    }

    public async Task PublishOrderAsync(
        long customerId,
        string orderNumber,
        string status,
        CancellationToken cancellationToken = default)
    {
        if (customerId <= 0 || string.IsNullOrWhiteSpace(orderNumber)) return;
        var targets = await mobileSubscriptions.FindCustomerAsync(customerId, cancellationToken);
        if (targets.Count == 0) return;

        var (title, body) = OrderCopy(status, orderNumber);
        await SendExpoPushAsync(targets, target => new
        {
            to = target.Token,
            title,
            body,
            sound = "default",
            priority = "high",
            channelId = "store-updates",
            badge = 1,
            data = new
            {
                destination = $"/track?orderNumber={Uri.EscapeDataString(orderNumber)}",
                kind = "Order",
                orderNumber,
                status
            }
        }, cancellationToken);
    }

    private async Task SendWebPushAsync(
        IReadOnlyCollection<StorePushSubscriptionRecord> targets,
        StoreNotificationResponse notification,
        CancellationToken cancellationToken)
    {
        if (targets.Count == 0) return;
        var keys = await keyStore.GetAsync(cancellationToken);
        var vapid = new VapidDetails(keys.Subject, keys.PublicKey, keys.PrivateKey);
        var payload = JsonSerializer.Serialize(new
        {
            notification.Id, notification.Title, notification.Message, notification.Kind,
            notification.ProductId, notification.ProductName, notification.Link, notification.CreatedAt
        }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        using var httpClient = httpClientFactory.CreateClient();
        using var client = new WebPushClient(httpClient);
        using var gate = new SemaphoreSlim(MaximumConcurrentSends, MaximumConcurrentSends);
        var sends = targets.Select(async target =>
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                await client.SendNotificationAsync(
                    new PushSubscription(target.Endpoint, target.P256dh, target.Auth),
                    payload, vapid, cancellationToken);
            }
            catch (WebPushException exception)
                when (exception.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                await webSubscriptions.RemoveAsync(target.Endpoint, CancellationToken.None);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not deliver storefront Web Push notification {NotificationId}.", notification.Id);
            }
            finally
            {
                gate.Release();
            }
        });
        await Task.WhenAll(sends);
    }

    private Task SendExpoProductPushAsync(
        IReadOnlyCollection<StoreMobilePushSubscriptionRecord> targets,
        StoreNotificationResponse notification,
        CancellationToken cancellationToken) =>
        SendExpoPushAsync(targets, target => new
        {
            to = target.Token,
            title = notification.Title,
            body = notification.Message,
            sound = "default",
            priority = "high",
            channelId = "store-updates",
            badge = 1,
            data = new
            {
                destination = $"/product/{notification.ProductId}",
                notificationId = notification.Id,
                kind = notification.Kind,
                productId = notification.ProductId,
                productName = notification.ProductName,
                link = notification.Link,
                createdAt = notification.CreatedAt
            }
        }, cancellationToken);

    private async Task SendExpoPushAsync(
        IReadOnlyCollection<StoreMobilePushSubscriptionRecord> targets,
        Func<StoreMobilePushSubscriptionRecord, object> createMessage,
        CancellationToken cancellationToken)
    {
        if (targets.Count == 0) return;
        var client = httpClientFactory.CreateClient();
        var targetArray = targets.ToArray();

        for (var offset = 0; offset < targetArray.Length; offset += ExpoBatchSize)
        {
            var batch = targetArray.Skip(offset).Take(ExpoBatchSize).ToArray();
            try
            {
                using var response = await client.PostAsJsonAsync(
                    ExpoPushEndpoint, batch.Select(createMessage).ToArray(), cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("Expo Push returned HTTP {StatusCode} for {Count} mobile notifications.", response.StatusCode, batch.Length);
                    continue;
                }
                await RemoveUnregisteredExpoTokensAsync(response, batch, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not deliver {Count} mobile push notifications.", batch.Length);
            }
        }
    }

    private async Task RemoveUnregisteredExpoTokensAsync(
        HttpResponseMessage response,
        IReadOnlyList<StoreMobilePushSubscriptionRecord> targets,
        CancellationToken cancellationToken)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        if (!document.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array) return;

        var index = 0;
        foreach (var ticket in data.EnumerateArray())
        {
            if (index >= targets.Count) break;
            var isUnregistered = ticket.TryGetProperty("details", out var details) &&
                                 details.TryGetProperty("error", out var error) &&
                                 string.Equals(error.GetString(), "DeviceNotRegistered", StringComparison.Ordinal);
            if (isUnregistered)
                await mobileSubscriptions.RemoveAsync(targets[index].Token, targets[index].DeviceId, cancellationToken);
            index++;
        }
    }

    private async Task<long> ResolveCustomerTypeIdAsync(CancellationToken cancellationToken) =>
        await currentCustomer.GetCustomerTypeIdAsync(cancellationToken)
        ?? await defaultCustomerType.GetIdAsync(cancellationToken);

    private static long[] NormalizeProductIds(long[]? productIds) =>
        (productIds ?? []).Where(id => id > 0).Distinct().Take(MaximumTrackedProducts).ToArray();

    private static IReadOnlyCollection<T> FilterCustomerTypes<T>(
        IReadOnlyCollection<T> targets,
        Func<T, long> typeSelector,
        long requestedTypeId,
        long defaultTypeId,
        IReadOnlySet<long> customPriceTypes) =>
        requestedTypeId == defaultTypeId
            ? targets.Where(target => typeSelector(target) == defaultTypeId || !customPriceTypes.Contains(typeSelector(target))).ToArray()
            : targets.Where(target => typeSelector(target) == requestedTypeId).ToArray();

    private static (string Title, string Body) OrderCopy(string status, string orderNumber) => status switch
    {
        "Confirmed" => ("Order confirmed", $"{orderNumber} was confirmed and is moving to preparation."),
        "Processing" => ("Order is being prepared", $"Your items for {orderNumber} are being prepared for delivery."),
        "Delivered" => ("Order delivered", $"Delivery for {orderNumber} is complete. Thank you for shopping with us."),
        "Cancelled" => ("Order cancelled", $"{orderNumber} was cancelled. Open the order for details."),
        "Returned" => ("Return recorded", $"{orderNumber} has been marked as returned."),
        _ => ("Order updated", $"{orderNumber} is now {status}.")
    };

    private static string NormalizePlatform(string value) =>
        value.Trim().ToLowerInvariant() is "ios" ? "ios" : "android";

    private static string NormalizeLocale(string value) =>
        value.Trim().ToLowerInvariant() is "ps" or "dr" ? value.Trim().ToLowerInvariant() : "en";

    private static void ValidateWeb(StorePushSubscriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint) ||
            !Uri.TryCreate(request.Endpoint, UriKind.Absolute, out var endpoint) ||
            endpoint.Scheme != Uri.UriSchemeHttps)
            throw new ArgumentException("A valid HTTPS push subscription endpoint is required.");

        if (string.IsNullOrWhiteSpace(request.P256dh) || string.IsNullOrWhiteSpace(request.Auth))
            throw new ArgumentException("Push subscription encryption keys are required.");
    }

    private static void ValidateMobile(MobilePushSubscriptionRequest request)
    {
        var token = request.Token.Trim();
        if ((!token.StartsWith("ExpoPushToken[", StringComparison.Ordinal) &&
             !token.StartsWith("ExponentPushToken[", StringComparison.Ordinal)) || token.Length > 512)
            throw new ArgumentException("A valid Expo push token is required.");

        if (string.IsNullOrWhiteSpace(request.DeviceId) || request.DeviceId.Trim().Length > 128)
            throw new ArgumentException("A valid mobile device identifier is required.");
    }
}
