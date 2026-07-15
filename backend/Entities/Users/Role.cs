namespace ECommerce.Entities.Users;

using Microsoft.AspNetCore.Identity;

public class Role : IdentityRole<string>
{
    public string? Description { get; set; }
}
