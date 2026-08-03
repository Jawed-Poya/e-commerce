using System.ComponentModel.DataAnnotations;
using API.Entities.Common;

namespace ECommerce.Entities.Users;

public enum VerificationChannel
{
    Email = 1,
    Phone = 2
}

public sealed class AccountVerificationCode : BaseEntity
{
    [MaxLength(450)] public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;
    public VerificationChannel Channel { get; set; }
    [MaxLength(320)] public string Destination { get; set; } = null!;
    [MaxLength(128)] public string CodeHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public int AttemptCount { get; set; }
}
