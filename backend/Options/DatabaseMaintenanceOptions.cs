namespace ECommerce.Options;

public sealed class DatabaseMaintenanceOptions
{
    public const string SectionName = "DatabaseMaintenance";

    /// <summary>
    /// Directory on the SQL Server machine. The SQL Server service account must
    /// have read/write access to it. Windows example: D:\\SqlBackups\\EasyCart.
    /// Linux example: /var/opt/mssql/backups/easycart.
    /// </summary>
    public string? BackupDirectory { get; set; }

    /// <summary>Restore stays opt-in even when backups are configured.</summary>
    public bool RestoreEnabled { get; set; }

    public int CommandTimeoutSeconds { get; set; } = 900;
}
