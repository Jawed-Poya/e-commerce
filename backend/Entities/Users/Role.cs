namespace ECommerce.Entities.Users;

using Microsoft.AspNetCore.Identity;

public class Role : IdentityRole<string>
{
    public Role()
    {
        Id = Guid.NewGuid().ToString("N");
        ConcurrencyStamp = Guid.NewGuid().ToString("N");
    }

    public long? TenantId { get; set; }

    public string? Description { get; set; }
}
