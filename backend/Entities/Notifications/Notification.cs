using API.Entities.Common;

namespace ECommerce.Entities.Notifications;

public class Notification : BaseEntity
{
    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public NotificationType Type { get; set; }

    public string? EntityType { get; set; }

    public long? EntityId { get; set; }

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }

    public long? UserId { get; set; }
}
