namespace ECommerce.Options;

public sealed class AccountVerificationOptions
{
    public const string SectionName = "AccountVerification";
    public int CodeLifetimeMinutes { get; set; } = 10;
    public int ResendCooldownSeconds { get; set; } = 60;
    public int MaximumAttempts { get; set; } = 5;
    public string HashKey { get; set; } = string.Empty;
    public EmailDeliveryOptions Email { get; set; } = new();
    public SmsDeliveryOptions Sms { get; set; } = new();
}

public sealed class EmailDeliveryOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "Store";
    public bool EnableSsl { get; set; } = true;
}

public sealed class SmsDeliveryOptions
{
    public string WebhookUrl { get; set; } = string.Empty;
    public string BearerToken { get; set; } = string.Empty;
}
