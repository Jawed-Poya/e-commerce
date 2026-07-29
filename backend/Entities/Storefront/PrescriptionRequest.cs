using API.Entities.Common;

namespace ECommerce.Entities.Storefront;

public enum PrescriptionRequestStatus
{
    Pending = 1,
    Reviewing = 2,
    Contacted = 3,
    Completed = 4,
    Rejected = 5
}

public sealed class PrescriptionRequest : BaseEntity
{
    public string RequestNumber { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string? Email { get; set; }
    public string? Notes { get; set; }
    public string AttachmentPath { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long FileSize { get; set; }
    public PrescriptionRequestStatus Status { get; set; } = PrescriptionRequestStatus.Pending;
    public string? AdminNotes { get; set; }
}
