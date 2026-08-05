namespace ECommerce.Options;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>
    /// Absolute path or a path relative to the published application directory.
    /// Keep uploaded files outside wwwroot so application deployments do not replace them.
    /// </summary>
    public string RootPath { get; set; } = "App_Data/uploads";

    public string RequestPath { get; set; } = "/uploads";

    public long MaximumImageSizeBytes { get; set; } = 5L * 1024L * 1024L;

    public string ResolveRootPath(IHostEnvironment environment)
    {
        var configured = string.IsNullOrWhiteSpace(RootPath)
            ? "App_Data/uploads"
            : Environment.ExpandEnvironmentVariables(RootPath.Trim());

        return Path.GetFullPath(
            Path.IsPathRooted(configured)
                ? configured
                : Path.Combine(environment.ContentRootPath, configured));
    }

    public string ResolveRequestPath()
    {
        var path = (string.IsNullOrWhiteSpace(RequestPath)
            ? "/uploads"
            : RequestPath.Trim()).Replace('\\', '/');
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length == 0)
            return "/uploads";
        if (segments.Any(segment => segment is "." or ".."))
            throw new InvalidOperationException("FileStorage:RequestPath must be a safe URL path.");
        return "/" + string.Join('/', segments);
    }
}
