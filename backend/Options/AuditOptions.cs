namespace ECommerce.Options;

public sealed class AuditOptions
{
    public const string SectionName = "Audit";

    public int ActivityRetentionDays { get; set; } = 365;
    public int VisitRetentionDays { get; set; } = 180;
    public int CleanupIntervalHours { get; set; } = 12;
}
