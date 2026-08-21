namespace ECommerce.Services.Notifications;

public static class StoreNotificationGroups
{
    public static string Cart(long customerId) => $"store:customer:{customerId}:cart";
    public static string Stock(long productId) => $"store:product:{productId}:stock";
    public static string Price(long productId, long customerTypeId) =>
        $"store:product:{productId}:price:{customerTypeId}";
}
