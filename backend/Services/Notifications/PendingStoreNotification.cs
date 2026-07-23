using ECommerce.Entities.Notifications;

namespace ECommerce.Services.Notifications;

public sealed record PendingStoreNotification(
    Notification Entity,
    string ProductName,
    string Group);
