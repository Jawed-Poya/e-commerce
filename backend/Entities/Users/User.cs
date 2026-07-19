namespace ECommerce.Entities.Users;

using Microsoft.AspNetCore.Identity;

public class User : IdentityUser<string>
{
    public string FullName { get; set; } = null!;

    public string? AvatarUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
