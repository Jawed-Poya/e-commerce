using System.Security.Cryptography;
using System.Text;

namespace ECommerce.Shared;

/// <summary>
/// Generates an internal ASP.NET Identity username that is globally unique,
/// tenant-aware, stable for the lifetime of the user, and limited to
/// alphanumeric characters. Customers and staff continue to sign in with their
/// email address or phone number; this value is an implementation detail.
/// </summary>
public static class TenantUserName
{
    public static string Create(long tenantId, string userId)
    {
        if (tenantId <= 0)
            throw new ArgumentOutOfRangeException(nameof(tenantId));
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentException("User id is required.", nameof(userId));

        var input = $"{tenantId}:{userId.Trim()}";
        var hash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(input)));

        // 1 + up to 19 tenant digits + 1 + 40 hash characters. This remains
        // well below Identity's 256-character username limit.
        return $"T{tenantId}U{hash[..40]}";
    }

    public static bool RequiresRepair(string? userName) =>
        string.IsNullOrWhiteSpace(userName) || userName.Contains(':');
}
