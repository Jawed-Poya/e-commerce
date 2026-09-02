namespace ECommerce.Services.Notifications;

public static class StoreNotificationGroups
{
    public static string Cart(long customerId) => $"store:customer:{customerId}:cart";
    public static string Stock(long productId) => $"store:product:{productId}:stock";
    public static string PriceAudience(long customerTypeId) =>
        $"store:price-audience:{customerTypeId}";
}
