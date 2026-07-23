namespace ECommerce.Entities.Notifications.Contracts;

public sealed record StoreNotificationResponse(
    long Id,
    string Title,
    string Message,
    string Kind,
    long ProductId,
    string ProductName,
    string Link,
    DateTime CreatedAt
);

public sealed record StoreNotificationsResponse(
    DateTime ServerTime,
    IReadOnlyCollection<StoreNotificationResponse> Items
);
