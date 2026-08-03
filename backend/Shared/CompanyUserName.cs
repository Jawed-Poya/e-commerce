using System.Security.Cryptography;
using System.Text;

namespace ECommerce.Shared;

/// <summary>
/// Generates a stable internal ASP.NET Identity username. Customers and staff
/// sign in with email or phone; this value is only an Identity implementation detail.
/// </summary>
public static class CompanyUserName
{
    public static string Create(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentException("User id is required.", nameof(userId));

        var hash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(userId.Trim())));
        return $"U{hash[..40]}";
    }

    public static bool RequiresRepair(string? userName)
    {
        if (string.IsNullOrWhiteSpace(userName) || userName.Contains(':'))
            return true;

        // Legacy internal usernames used T{companyId}U{40-char SHA256 prefix}.
        // Do not rewrite a normal username merely because it starts with "T".
        if (!userName.StartsWith('T'))
            return false;
        var separator = userName.IndexOf('U', 1);
        if (separator <= 1 || separator + 41 != userName.Length)
            return false;
        return long.TryParse(userName.AsSpan(1, separator - 1), out _) &&
            userName.AsSpan(separator + 1).ToString().All(Uri.IsHexDigit);
    }
}
