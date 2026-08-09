namespace ECommerce.Options;

public sealed class DatabaseMaintenanceOptions
{
    public const string SectionName = "DatabaseMaintenance";

    /// <summary>
    /// Directory on the SQL Server machine. Use "auto" (recommended) to use
    /// SQL Server's own default backup directory. For a custom location, provide
    /// an absolute path that already exists and is writable by the SQL Server
    /// service account. Relative paths are intentionally treated as "auto" so
    /// SQL Server does not resolve them into a missing Backup\subfolder.
    /// </summary>
    public string? BackupDirectory { get; set; } = "auto";

    /// <summary>Restore stays opt-in even when backups are configured.</summary>
    public bool RestoreEnabled { get; set; }

    public int CommandTimeoutSeconds { get; set; } = 900;
}
