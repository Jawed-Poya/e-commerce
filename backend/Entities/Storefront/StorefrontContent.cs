using API.Entities.Common;

namespace ECommerce.Entities.Storefront;

public sealed class StorefrontContent : BaseEntity
{
    public string HeroContentJson { get; set; } = "{}";
    public string? HeroImageUrl { get; set; }
    public string PrimaryButtonUrl { get; set; } = "/products";
    public string SecondaryButtonUrl { get; set; } = "/products?featured=true";
    public bool IsActive { get; set; } = true;
}
