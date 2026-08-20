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
