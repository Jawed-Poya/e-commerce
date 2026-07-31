namespace ECommerce.Services.Auditing;

public sealed record ClientDeviceInfo(string DeviceType, string Browser, string OperatingSystem);

public static class ClientDeviceParser
{
    public static ClientDeviceInfo Parse(string? userAgent)
    {
        var value = userAgent ?? string.Empty;
        var device = value.Contains("Mobile", StringComparison.OrdinalIgnoreCase) ||
                     value.Contains("Android", StringComparison.OrdinalIgnoreCase) ||
                     value.Contains("iPhone", StringComparison.OrdinalIgnoreCase)
            ? "Mobile"
            : value.Contains("iPad", StringComparison.OrdinalIgnoreCase) ||
              value.Contains("Tablet", StringComparison.OrdinalIgnoreCase)
                ? "Tablet"
                : "Desktop";

        var browser = value.Contains("Edg/", StringComparison.OrdinalIgnoreCase) ? "Microsoft Edge"
            : value.Contains("OPR/", StringComparison.OrdinalIgnoreCase) ? "Opera"
            : value.Contains("Firefox/", StringComparison.OrdinalIgnoreCase) ? "Firefox"
            : value.Contains("Chrome/", StringComparison.OrdinalIgnoreCase) ? "Chrome"
            : value.Contains("Safari/", StringComparison.OrdinalIgnoreCase) ? "Safari"
            : "Other";

        var os = value.Contains("Windows", StringComparison.OrdinalIgnoreCase) ? "Windows"
            : value.Contains("Android", StringComparison.OrdinalIgnoreCase) ? "Android"
            : value.Contains("iPhone", StringComparison.OrdinalIgnoreCase) || value.Contains("iPad", StringComparison.OrdinalIgnoreCase) ? "iOS"
            : value.Contains("Mac OS", StringComparison.OrdinalIgnoreCase) ? "macOS"
            : value.Contains("Linux", StringComparison.OrdinalIgnoreCase) ? "Linux"
            : "Other";

        return new ClientDeviceInfo(device, browser, os);
    }
}
