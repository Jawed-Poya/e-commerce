namespace ECommerce.Services.Notifications;

public static class StoreNotificationGroups
{
    public static string Stock(long productId) => $"store:product:{productId}:stock";
    public static string Price(long productId, long customerTypeId) =>
        $"store:product:{productId}:price:{customerTypeId}";
}
