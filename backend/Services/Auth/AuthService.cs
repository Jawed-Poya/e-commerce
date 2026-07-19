using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using API.Entities.Customers;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Options;
using ECommerce.Services.Customers;
using ECommerce.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ECommerce.Services.Auth;

public sealed class AuthService(
    UserManager<User> userManager,
    RoleManager<Role> roleManager,
    ApplicationDbContext context,
    IDefaultCustomerTypeResolver defaultCustomerType,
    ICurrentCustomerAccessor currentCustomer,
    IOptions<JwtOptions> jwtOptions) : IAuthService
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    public async Task<AuthResponse> LoginCustomerAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(request.Identifier)
            ?? throw new InvalidOperationException("Invalid email/phone or password.");

        if (!user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            throw new InvalidOperationException("Invalid email/phone or password.");

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        if (!roles.Contains(AppRoles.Customer, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("This account is not a customer account.");

        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);
        return await CreateResponseAsync(user, roles, cancellationToken);
    }

    public async Task<AuthResponse> LoginAdminAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(request.Identifier)
            ?? throw new InvalidOperationException("Invalid credentials.");

        if (!user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            throw new InvalidOperationException("Invalid credentials.");

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var permissions = await GetPermissionsAsync(user, roles);
        if (!roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase) && permissions.Count == 0)
            throw new UnauthorizedAccessException("This account cannot access the admin panel.");

        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);
        return await CreateResponseAsync(user, roles, cancellationToken);
    }

    public async Task<AuthResponse> RegisterCustomerAsync(
        RegisterCustomerRequest request,
        CancellationToken cancellationToken = default)
    {
        var firstName = request.FirstName?.Trim();
        var lastName = Clean(request.LastName);
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);

        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name is required.");
        if (phone.Length < 6)
            throw new ArgumentException("Enter a valid phone number.");
        if (string.IsNullOrWhiteSpace(request.Password))
            throw new ArgumentException("Password is required.");

        var matchingCustomers = await context.Customers
            .Where(customer =>
                customer.Phone == phone ||
                (email != null && customer.Email == email))
            .ToListAsync(cancellationToken);

        if (matchingCustomers.Select(customer => customer.Id).Distinct().Count() > 1)
            throw new InvalidOperationException(
                "The phone number and email belong to different customer records. Ask an admin to merge them first.");

        var customer = matchingCustomers.SingleOrDefault();
        var existingUser = await FindUserAsync(email ?? phone);
        if (existingUser is null && email is not null)
            existingUser = await FindUserAsync(phone);
        if (existingUser is not null)
            throw new InvalidOperationException("An account with this email or phone already exists. Use login instead.");

        var user = new User
        {
            UserName = email ?? phone,
            Email = email,
            PhoneNumber = phone,
            FullName = string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value))),
            IsActive = true
        };

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var identityResult = await userManager.CreateAsync(user, request.Password);
            if (!identityResult.Succeeded)
                throw new ArgumentException(string.Join(" ", identityResult.Errors.Select(error => error.Description)));

            var roleResult = await userManager.AddToRoleAsync(user, AppRoles.Customer);
            if (!roleResult.Succeeded)
                throw new InvalidOperationException(string.Join(" ", roleResult.Errors.Select(error => error.Description)));

            var type = await defaultCustomerType.GetAsync(cancellationToken);
            if (customer is null)
            {
                customer = new Customer
                {
                    FirstName = firstName!,
                    LastName = lastName,
                    Phone = phone,
                    Email = email,
                    CustomerTypeId = type.Id
                };
                context.Customers.Add(customer);
            }
            else
            {
                customer.FirstName = firstName!;
                customer.LastName = lastName ?? customer.LastName;
                customer.Phone = phone;
                customer.Email = email ?? customer.Email;
                customer.CustomerTypeId ??= type.Id;
                customer.UpdatedAt = DateTime.UtcNow;
            }
            await context.SaveChangesAsync(cancellationToken);

            var linkResult = await userManager.AddClaimAsync(
                user,
                new Claim(AuthClaims.CustomerId, customer.Id.ToString()));
            if (!linkResult.Succeeded)
                throw new InvalidOperationException(string.Join(
                    " ",
                    linkResult.Errors.Select(error => error.Description)));

            await transaction.CommitAsync(cancellationToken);

            return await CreateResponseAsync(user, [AppRoles.Customer], cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<AuthUserResponse?> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            return null;

        var user = await userManager.FindByIdAsync(currentCustomer.UserId);
        if (user is null)
            return null;

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        return await BuildUserAsync(user, roles, cancellationToken);
    }

    private async Task<User?> FindUserAsync(string identifier)
    {
        var value = identifier?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        var byName = await userManager.FindByNameAsync(value);
        if (byName is not null) return byName;

        if (value.Contains('@'))
            return await userManager.FindByEmailAsync(value.ToLowerInvariant());

        var phone = NormalizePhone(value);
        return await context.Users.FirstOrDefaultAsync(user => user.PhoneNumber == phone);
    }

    private async Task<AuthResponse> CreateResponseAsync(
        User user,
        IReadOnlyCollection<string> roles,
        CancellationToken cancellationToken)
    {
        var authUser = await BuildUserAsync(user, roles, cancellationToken);
        var expiresAt = DateTime.UtcNow.AddMinutes(Math.Clamp(_jwt.ExpirationMinutes, 15, 10080));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        if (!string.IsNullOrWhiteSpace(user.Email)) claims.Add(new Claim(ClaimTypes.Email, user.Email));
        if (!string.IsNullOrWhiteSpace(user.PhoneNumber)) claims.Add(new Claim(ClaimTypes.MobilePhone, user.PhoneNumber));
        foreach (var role in roles) claims.Add(new Claim(ClaimTypes.Role, role));
        foreach (var permission in authUser.Permissions)
            claims.Add(new Claim(AuthClaims.Permission, permission));
        if (authUser.CustomerId.HasValue) claims.Add(new Claim(AuthClaims.CustomerId, authUser.CustomerId.Value.ToString()));
        if (authUser.CustomerTypeId.HasValue) claims.Add(new Claim(AuthClaims.CustomerTypeId, authUser.CustomerTypeId.Value.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token), expiresAt, authUser);
    }

    private async Task<AuthUserResponse> BuildUserAsync(
        User user,
        IReadOnlyCollection<string> roles,
        CancellationToken cancellationToken)
    {
        var identityClaims = await userManager.GetClaimsAsync(user);
        var permissions = await GetPermissionsAsync(user, roles);
        var linkedCustomerId = long.TryParse(
            identityClaims.FirstOrDefault(claim => claim.Type == AuthClaims.CustomerId)?.Value,
            out var parsedCustomerId)
            ? parsedCustomerId
            : (long?)null;

        var customer = linkedCustomerId.HasValue
            ? await context.Customers
                .AsNoTracking()
                .Include(item => item.CustomerType)
                .FirstOrDefaultAsync(item => item.Id == linkedCustomerId.Value, cancellationToken)
            : await context.Customers
                .AsNoTracking()
                .Include(item => item.CustomerType)
                .FirstOrDefaultAsync(item =>
                    (user.PhoneNumber != null && item.Phone == user.PhoneNumber) ||
                    (user.Email != null && item.Email == user.Email),
                    cancellationToken);

        return new AuthUserResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            roles.ToArray(),
            permissions,
            customer?.Id,
            customer?.CustomerTypeId,
            customer?.CustomerType?.Name,
            roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase) || permissions.Count > 0);
    }

    private async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        User user,
        IReadOnlyCollection<string> roles)
    {
        // The built-in Admin role is the authority boundary. Do not make an
        // administrator depend on AspNetRoleClaims being populated correctly in
        // an older database. Returning the complete permission set also keeps the
        // JWT and admin UI consistent with the server-side policy bypass.
        if (roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase))
            return AppPermissions.All.OrderBy(value => value).ToArray();

        var permissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var claim in await userManager.GetClaimsAsync(user))
        {
            if (claim.Type == AuthClaims.Permission && AppPermissions.All.Contains(claim.Value))
                permissions.Add(claim.Value);
        }

        foreach (var roleName in roles)
        {
            var role = await roleManager.FindByNameAsync(roleName);
            if (role is null) continue;

            foreach (var claim in await roleManager.GetClaimsAsync(role))
            {
                if (claim.Type == AuthClaims.Permission && AppPermissions.All.Contains(claim.Value))
                    permissions.Add(claim.Value);
            }
        }

        return permissions.OrderBy(value => value).ToArray();
    }

    private static string NormalizePhone(string? value) =>
        string.Concat((value ?? string.Empty).Where(character => char.IsDigit(character) || character == '+')).Trim();

    private static string? NormalizeEmail(string? value)
    {
        var clean = Clean(value)?.ToLowerInvariant();
        if (clean is not null && !clean.Contains('@'))
            throw new ArgumentException("Enter a valid email address.");
        return clean;
    }

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }
}
