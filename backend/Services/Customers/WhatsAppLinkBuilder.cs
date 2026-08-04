using ECommerce.Options;

namespace ECommerce.Services.Customers;

internal static class WhatsAppLinkBuilder
{
    public static string? Build(
        string? phone,
        string customerName,
        WhatsAppOptions options)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        var original = phone.Trim();
        var digits = DigitsOnly(original);
        if (digits.Length < 6)
            return null;

        if (original.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }
        else if (original.StartsWith('0'))
        {
            var countryCode = DigitsOnly(options.DefaultCountryCode);
            var localNumber = digits.TrimStart('0');
            if (countryCode.Length > 0 && localNumber.Length > 0)
                digits = countryCode + localNumber;
        }

        if (digits.Length < 6)
            return null;

        var message = (options.CustomerMessageTemplate ?? string.Empty)
            .Replace("{CustomerName}", customerName, StringComparison.OrdinalIgnoreCase)
            .Replace("{Phone}", phone, StringComparison.OrdinalIgnoreCase)
            .Trim();

        return message.Length == 0
            ? $"https://wa.me/{digits}"
            : $"https://wa.me/{digits}?text={Uri.EscapeDataString(message)}";
    }

    private static string DigitsOnly(string? value) =>
        string.Concat((value ?? string.Empty).Where(char.IsDigit));
}
