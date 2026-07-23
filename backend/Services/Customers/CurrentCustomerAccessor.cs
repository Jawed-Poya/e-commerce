using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Shared;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Customers;

public sealed class CurrentCustomerAccessor(
    IHttpContextAccessor httpContextAccessor,
    ApplicationDbContext context) : ICurrentCustomerAccessor
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public string? UserId =>
        User?.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User?.FindFirstValue(JwtRegisteredClaimNames.Sub) ??
        User?.FindFirstValue("sub");

    public long? CustomerId => long.TryParse(
        User?.FindFirstValue(AuthClaims.CustomerId), out var id) ? id : null;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public bool IsAdmin => User?.IsInRole(AppRoles.Admin) == true;

    public async Task<long?> GetCustomerTypeIdAsync(CancellationToken cancellationToken = default)
    {
        if (!CustomerId.HasValue)
            return null;

        return await context.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == CustomerId.Value)
            .Select(customer => customer.CustomerTypeId)
            .SingleOrDefaultAsync(cancellationToken);
    }
}
