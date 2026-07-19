namespace ECommerce.Entities.Users;

using Microsoft.AspNetCore.Identity;

public class User : IdentityUser<string>
{
    public User()
    {
        // Identity uses string primary keys in this project. Set the key explicitly
        // so a newly-created user is always trackable before UserManager persists it.
        Id = Guid.NewGuid().ToString("N");
        SecurityStamp = Guid.NewGuid().ToString("N");
        ConcurrencyStamp = Guid.NewGuid().ToString("N");
    }

    public string FullName { get; set; } = null!;

    public string? AvatarUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
