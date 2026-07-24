using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ECommerce.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ECommerce.Services.Tenancy;

public sealed record StorefrontPreviewTokenPayload(long TenantId, string StorefrontKey, DateTime ExpiresAt);

public interface IStorefrontAccessTokenService
{
    string CreatePreviewToken(long tenantId, string storefrontKey, TimeSpan lifetime);
    bool TryValidatePreviewToken(string token, out StorefrontPreviewTokenPayload? payload);
}

public sealed class StorefrontAccessTokenService(IOptions<JwtOptions> options) : IStorefrontAccessTokenService
{
    private const string PurposeClaim = "storefront_preview";
    private const string TenantClaim = "tenant_id";
    private const string StorefrontKeyClaim = "storefront_key";
    private readonly JwtOptions _jwt = options.Value;

    public string CreatePreviewToken(long tenantId, string storefrontKey, TimeSpan lifetime)
    {
        var expires = DateTime.UtcNow.Add(lifetime <= TimeSpan.Zero ? TimeSpan.FromMinutes(30) : lifetime);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: PreviewAudience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                new Claim("purpose", PurposeClaim),
                new Claim(TenantClaim, tenantId.ToString()),
                new Claim(StorefrontKeyClaim, storefrontKey)
            ],
            notBefore: DateTime.UtcNow.AddSeconds(-15),
            expires: expires,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public bool TryValidatePreviewToken(string token, out StorefrontPreviewTokenPayload? payload)
    {
        payload = null;
        if (string.IsNullOrWhiteSpace(token)) return false;

        try
        {
            var principal = new JwtSecurityTokenHandler().ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                ValidIssuer = _jwt.Issuer,
                ValidAudience = PreviewAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key)),
                NameClaimType = ClaimTypes.Name,
                RoleClaimType = ClaimTypes.Role
            }, out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwtToken ||
                !string.Equals(principal.FindFirstValue("purpose"), PurposeClaim, StringComparison.Ordinal))
                return false;
            if (!long.TryParse(principal.FindFirstValue(TenantClaim), out var tenantId) || tenantId <= 0)
                return false;
            var storefrontKey = principal.FindFirstValue(StorefrontKeyClaim);
            if (string.IsNullOrWhiteSpace(storefrontKey)) return false;

            payload = new StorefrontPreviewTokenPayload(
                tenantId,
                storefrontKey,
                jwtToken.ValidTo.ToUniversalTime());
            return true;
        }
        catch (SecurityTokenException)
        {
            return false;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private string PreviewAudience => $"{_jwt.Audience}:storefront-preview";
}
