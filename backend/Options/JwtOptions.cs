namespace ECommerce.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "ECommerce";
    public string Audience { get; set; } = "ECommerceClient";
    public string Key { get; set; } = null!;
    public int ExpirationMinutes { get; set; } = 480;
}

public sealed class SeedAdminOptions
{
    public const string SectionName = "SeedAdmin";

    public string? Email { get; set; }
    public string? Password { get; set; }
    public string FullName { get; set; } = "System Administrator";
}
