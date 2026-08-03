namespace ECommerce.Entities.Users;

using Microsoft.AspNetCore.Identity;

public class User : IdentityUser<string>
{
    public User()
    {
        Id = Guid.NewGuid().ToString("N");
        SecurityStamp = Guid.NewGuid().ToString("N");
        ConcurrencyStamp = Guid.NewGuid().ToString("N");
    }

    public long? BranchId { get; set; }

    public string FullName { get; set; } = null!;

    public string? AvatarUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
