namespace ECommerce.Entities.Notifications.Contracts;

public sealed record AdminNotificationResponse(
    long Id,
    string Title,
    string Message,
    string Kind,
    long? EntityId,
    string Link,
    DateTime CreatedAt);

public sealed record AdminNotificationsResponse(
    DateTime ServerTime,
    IReadOnlyCollection<AdminNotificationResponse> Items);
