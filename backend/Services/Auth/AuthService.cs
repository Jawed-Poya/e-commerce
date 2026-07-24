using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using API.Entities.Customers;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Options;
using ECommerce.Services.Customers;
using ECommerce.Services.Tenancy;
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
    ITenantContext tenantContext,
    ITenantPermissionService tenantPermissions,
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
            UserName = tenantContext.TenantId <= 1
                ? email ?? phone
                : $"{tenantContext.TenantId}:{email ?? phone}",
            Email = email,
            PhoneNumber = phone,
            FullName = string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value))),
            IsActive = true,
            TenantId = tenantContext.TenantId,
            BranchId = tenantContext.BranchId
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

    public async Task<UserProfileResponse?> GetProfileAsync(
        CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync();
        if (user is null) return null;

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var permissions = await GetPermissionsAsync(user, roles);
        return new UserProfileResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.AvatarUrl,
            user.IsActive,
            roles.Select(DisplayRoleName).ToArray(),
            permissions,
            user.LastLoginAt,
            user.CreatedAt);
    }

    public async Task<UserProfileResponse> UpdateProfileAsync(
        UpdateUserProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync()
            ?? throw new UnauthorizedAccessException("Authentication is required.");

        var fullName = Clean(request.FullName);
        var email = NormalizeEmail(request.Email);
        var phone = NormalizePhone(request.Phone);
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("Full name is required.");
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.");
        if (phone.Length > 0 && phone.Length < 6)
            throw new ArgumentException("Enter a valid phone number.");

        if (await context.Users.AnyAsync(
                item => item.Id != user.Id &&
                    item.TenantId == user.TenantId &&
                    item.Email == email,
                cancellationToken))
            throw new InvalidOperationException("This email address is already in use.");

        if (phone.Length > 0 && await context.Users.AnyAsync(
                item => item.Id != user.Id &&
                    item.TenantId == user.TenantId &&
                    item.PhoneNumber == phone,
                cancellationToken))
            throw new InvalidOperationException("This phone number is already in use.");

        user.FullName = fullName;
        user.Email = email;
        user.UserName = user.TenantId <= 1 ? email : $"{user.TenantId}:{email}";
        user.PhoneNumber = phone.Length == 0 ? null : phone;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(
                " ",
                result.Errors.Select(error => error.Description)));

        return (await GetProfileAsync(cancellationToken))!;
    }

    public async Task ChangePasswordAsync(
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync()
            ?? throw new UnauthorizedAccessException("Authentication is required.");

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
            throw new ArgumentException("Current and new passwords are required.");

        var result = await userManager.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(
                " ",
                result.Errors.Select(error => error.Description)));
    }

    private async Task<User?> FindCurrentUserAsync()
    {
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            return null;

        return await userManager.FindByIdAsync(currentCustomer.UserId);
    }

    private async Task<User?> FindUserAsync(string identifier)
    {
        var value = identifier?.Trim();
        if (string.IsNullOrWhiteSpace(value)) return null;

        var normalized = value.ToUpperInvariant();
        var phone = NormalizePhone(value);
        return await context.Users.FirstOrDefaultAsync(user =>
            user.TenantId == tenantContext.TenantId &&
            (user.NormalizedUserName == normalized ||
             user.NormalizedEmail == normalized ||
             user.PhoneNumber == phone));
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
        claims.Add(new Claim(AuthClaims.TenantId, user.TenantId.ToString()));
        claims.Add(new Claim(AuthClaims.TenantSlug, authUser.TenantSlug));
        if (user.BranchId.HasValue) claims.Add(new Claim(AuthClaims.BranchId, user.BranchId.Value.ToString()));
        if (roles.Contains(AppRoles.PlatformAdmin, StringComparer.OrdinalIgnoreCase))
            claims.Add(new Claim(AuthClaims.PlatformAdmin, "true"));

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
        var tenantSlug = await context.Tenants
            .AsNoTracking()
            .Where(item => item.Id == user.TenantId)
            .Select(item => item.Slug)
            .FirstOrDefaultAsync(cancellationToken)
            ?? tenantContext.TenantSlug;
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
            roles.Select(DisplayRoleName).ToArray(),
            permissions,
            customer?.Id,
            customer?.CustomerTypeId,
            customer?.CustomerType?.Name,
            roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase) ||
                roles.Contains(AppRoles.PlatformAdmin, StringComparer.OrdinalIgnoreCase) || permissions.Count > 0,
            user.TenantId,
            user.BranchId,
            tenantSlug,
            roles.Contains(AppRoles.PlatformAdmin, StringComparer.OrdinalIgnoreCase));
    }

    private async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        User user,
        IReadOnlyCollection<string> roles)
    {
        if (roles.Contains(AppRoles.PlatformAdmin, StringComparer.OrdinalIgnoreCase))
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

        var enabledForTenant = (await tenantPermissions.GetTenantPermissionsAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return permissions
            .Where(enabledForTenant.Contains)
            .OrderBy(value => value)
            .ToArray();
    }

    private static string DisplayRoleName(string roleName)
    {
        var separator = roleName.IndexOf(':');
        return roleName.StartsWith("tenant-", StringComparison.OrdinalIgnoreCase) && separator >= 0
            ? roleName[(separator + 1)..]
            : roleName;
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
