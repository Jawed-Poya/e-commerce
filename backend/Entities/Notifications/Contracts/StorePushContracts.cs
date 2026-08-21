namespace ECommerce.Entities.Notifications.Contracts;

public sealed record StorePushPublicKeyResponse(string PublicKey);

public sealed class StorePushSubscriptionRequest
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public long[] ProductIds { get; set; } = [];
}

public sealed class RemoveStorePushSubscriptionRequest
{
    public string Endpoint { get; set; } = string.Empty;
}

public sealed class MobilePushSubscriptionRequest
{
    public string Token { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string Locale { get; set; } = "en";
    public long[] ProductIds { get; set; } = [];
}

public sealed class RemoveMobilePushSubscriptionRequest
{
    public string Token { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
}
