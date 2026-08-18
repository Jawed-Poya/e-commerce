namespace ECommerce.Entities.Products.Contracts;

public sealed record SetStorefrontPinRequest(bool IsPinned);

public sealed record StorefrontPinResponse(long ProductId, bool IsPinned);
