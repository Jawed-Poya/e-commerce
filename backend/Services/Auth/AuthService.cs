using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Options;
using ECommerce.Services.Company;
using ECommerce.Services.Customers;
using ECommerce.Shared;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using CustomerEntity = API.Entities.Customers.Customer;

namespace ECommerce.Services.Auth;

public sealed class AuthService(
    UserManager<User> userManager,
    ApplicationDbContext context,
    ICurrentCustomerAccessor currentCustomer,
    IDefaultCustomerTypeResolver defaultCustomerType,
    ICompanyPermissionService companyPermissions,
    IOptions<JwtOptions> jwtOptions,
    IOptions<GoogleAuthOptions> googleOptions) : IAuthService
{
    private readonly JwtOptions _jwt = jwtOptions.Value;
    private readonly GoogleAuthOptions _google = googleOptions.Value;

    public async Task<AuthResponse> LoginCustomerAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(request.Identifier, cancellationToken)
            ?? throw new InvalidOperationException("Invalid email/phone or password.");
        if (!user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            throw new InvalidOperationException("Invalid email/phone or password.");

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        if (!roles.Contains(AppRoles.Customer, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("This account is not a customer account.");

        user.LastLoginAt = DateTime.UtcNow;
        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update login information.");
        return await CreateResponseAsync(user, roles, cancellationToken);
    }

    public async Task<AuthResponse> LoginAdminAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await FindUserAsync(request.Identifier, cancellationToken)
            ?? throw new InvalidOperationException("Invalid credentials.");
        if (!user.IsActive || !await userManager.CheckPasswordAsync(user, request.Password))
            throw new InvalidOperationException("Invalid credentials.");

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var permissions = await GetPermissionsAsync(user, roles, cancellationToken);
        if (!roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase) && permissions.Count == 0)
            throw new UnauthorizedAccessException("This account cannot access the admin panel.");

        user.LastLoginAt = DateTime.UtcNow;
        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update login information.");
        return await CreateResponseAsync(user, roles, cancellationToken);
    }

    public async Task<AuthResponse> RegisterCustomerAsync(
        RegisterCustomerRequest request,
        CancellationToken cancellationToken = default)
    {
        var firstName = Clean(request.FirstName);
        var lastName = Clean(request.LastName);
        var phone = NormalizePhone(request.Phone);
        var email = NormalizeEmail(request.Email);
        if (firstName is null) throw new ArgumentException("First name is required.");
        if (phone.Length < 6) throw new ArgumentException("Enter a valid phone number.");
        if (string.IsNullOrWhiteSpace(request.Password)) throw new ArgumentException("Password is required.");

        var existing = await FindExistingByContactsAsync(email, phone, cancellationToken);
        if (existing is not null)
            throw new InvalidOperationException("An account with this email or phone already exists. Use login instead.");

        var user = new User
        {
            Email = email,
            EmailConfirmed = false,
            PhoneNumber = phone,
            PhoneNumberConfirmed = false,
            FullName = string.Join(' ', new[] { firstName, lastName }.Where(value => !string.IsNullOrWhiteSpace(value))),
            IsActive = true
        };
        user.UserName = CompanyUserName.Create(user.Id);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            EnsureSucceeded(await userManager.CreateAsync(user, request.Password), "Could not create customer account.");
            EnsureSucceeded(await userManager.AddToRoleAsync(user, AppRoles.Customer), "Could not assign the customer role.");
            await CreateCustomerProfileAsync(
                user,
                firstName,
                lastName,
                phone,
                email,
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return await CreateResponseAsync(user, [AppRoles.Customer], cancellationToken);
    }

    private async Task CreateCustomerProfileAsync(
        User user,
        string firstName,
        string? lastName,
        string phone,
        string? email,
        CancellationToken cancellationToken)
    {
        var contactExists = await context.Customers.AnyAsync(
            customer =>
                customer.Phone == phone ||
                (email != null && customer.Email == email),
            cancellationToken);
        if (contactExists)
        {
            throw new InvalidOperationException(
                "A customer record already uses this email or phone. Ask an administrator to link the existing customer before registering.");
        }

        var customerType = await defaultCustomerType.GetAsync(cancellationToken);
        var customer = new CustomerEntity
        {
            BranchId = customerType.BranchId,
            FirstName = firstName,
            LastName = lastName,
            Phone = phone,
            Email = email,
            CustomerTypeId = customerType.Id
        };
        context.Customers.Add(customer);
        await context.SaveChangesAsync(cancellationToken);

        EnsureSucceeded(
            await userManager.AddClaimsAsync(user,
            [
                new Claim(AuthClaims.CustomerId, customer.Id.ToString()),
                new Claim(AuthClaims.CustomerTypeId, customerType.Id.ToString())
            ]),
            "Could not link the storefront account to its customer record.");
    }

    public async Task<AuthResponse> SignInWithGoogleAsync(
        GoogleSignInRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_google.ClientId))
            throw new InvalidOperationException("Google sign-in is not configured.");
        if (string.IsNullOrWhiteSpace(request.Credential))
            throw new ArgumentException("Google credential is required.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                request.Credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [_google.ClientId] });
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new InvalidOperationException("Google sign-in could not be verified.", exception);
        }

        var email = NormalizeEmail(payload.Email);
        if (!payload.EmailVerified || email is null || string.IsNullOrWhiteSpace(payload.Subject))
            throw new InvalidOperationException("Google must provide a verified email address.");

        const string provider = "Google";
        var linkedUser = await userManager.FindByLoginAsync(provider, payload.Subject);
        var normalizedEmail = userManager.NormalizeEmail(email);
        var matchingUsers = await context.Users
            .Where(item => item.NormalizedEmail == normalizedEmail)
            .Take(2)
            .ToListAsync(cancellationToken);

        if (linkedUser is null && matchingUsers.Count > 1)
            throw new InvalidOperationException(
                "Multiple legacy accounts use this email address. Ask an administrator to merge them before using Google sign-in.");
        if (linkedUser is not null && matchingUsers.Any(item => item.Id != linkedUser.Id))
            throw new InvalidOperationException(
                "This Google email is already connected to another customer account.");

        var user = linkedUser ?? matchingUsers.SingleOrDefault();
        IReadOnlyCollection<string> roles;
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            if (user is null)
            {
                user = new User
                {
                    Email = email,
                    EmailConfirmed = true,
                    FullName = Clean(payload.Name) ?? Clean(payload.GivenName) ?? email.Split('@')[0],
                    AvatarUrl = Clean(payload.Picture),
                    IsActive = true
                };
                user.UserName = CompanyUserName.Create(user.Id);
                EnsureSucceeded(await userManager.CreateAsync(user), "Could not create the Google account.");
            }
            else
            {
                if (!user.IsActive) throw new UnauthorizedAccessException("This account is inactive.");
                user.Email = email;
                user.EmailConfirmed = true;
                user.FullName = Clean(payload.Name) ?? user.FullName;
                user.AvatarUrl ??= Clean(payload.Picture);
                if (CompanyUserName.RequiresRepair(user.UserName))
                    user.UserName = CompanyUserName.Create(user.Id);
                EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update the Google account.");
            }

            var logins = await userManager.GetLoginsAsync(user);
            if (!logins.Any(login => login.LoginProvider == provider && login.ProviderKey == payload.Subject))
                EnsureSucceeded(
                    await userManager.AddLoginAsync(user, new UserLoginInfo(provider, payload.Subject, "Google")),
                    "Could not link Google sign-in.");

            if (!await userManager.IsInRoleAsync(user, AppRoles.Customer))
                EnsureSucceeded(await userManager.AddToRoleAsync(user, AppRoles.Customer), "Could not assign the customer role.");

            user.LastLoginAt = DateTime.UtcNow;
            EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update login information.");
            roles = (await userManager.GetRolesAsync(user)).ToArray();
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return await CreateResponseAsync(user, roles, cancellationToken);
    }

    public async Task<AuthUserResponse?> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync();
        if (user is null) return null;
        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        return await BuildUserAsync(user, roles, cancellationToken);
    }

    public async Task<UserProfileResponse?> GetProfileAsync(CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync();
        if (user is null) return null;
        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var permissions = await GetPermissionsAsync(user, roles, cancellationToken);
        return MapProfile(user, roles, permissions, await userManager.HasPasswordAsync(user));
    }

    public async Task<UserProfileResponse> UpdateProfileAsync(
        UpdateUserProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync()
            ?? throw new UnauthorizedAccessException("Authentication is required.");
        var fullName = Clean(request.FullName) ?? throw new ArgumentException("Full name is required.");
        var submittedEmail = Clean(request.Email);
        var email = NormalizeEmail(submittedEmail);
        if (submittedEmail is not null && email is null)
            throw new ArgumentException("Enter a valid email address.");
        var phone = NormalizePhone(request.Phone);
        if (phone.Length > 0 && phone.Length < 6) throw new ArgumentException("Enter a valid phone number.");

        var emailChanged = !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);
        var phoneValue = phone.Length == 0 ? null : phone;
        var phoneChanged = !string.Equals(user.PhoneNumber, phoneValue, StringComparison.Ordinal);
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        if (emailChanged && email is not null &&
            await context.Users.AnyAsync(item => item.Id != user.Id && item.Email == email, cancellationToken))
            throw new InvalidOperationException("This email address is already in use.");
        if (phoneChanged && phoneValue is not null && await context.Users.AnyAsync(item => item.Id != user.Id && item.PhoneNumber == phoneValue, cancellationToken))
            throw new InvalidOperationException("This phone number is already in use.");

        user.FullName = fullName;
        user.Email = email;
        user.PhoneNumber = phoneValue;
        if (emailChanged) user.EmailConfirmed = false;
        if (phoneChanged) user.PhoneNumberConfirmed = false;
        if (CompanyUserName.RequiresRepair(user.UserName)) user.UserName = CompanyUserName.Create(user.Id);
        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update the profile.");

        // Keep the linked commerce customer in sync with the storefront account.
        // Legacy and Google-only accounts may not have a Customer link until checkout.
        var customerClaim = await context.UserClaims
            .AsNoTracking()
            .FirstOrDefaultAsync(
                claim => claim.UserId == user.Id && claim.ClaimType == AuthClaims.CustomerId,
                cancellationToken);
        if (long.TryParse(customerClaim?.ClaimValue, out var customerId))
        {
            var customer = await context.Customers
                .FirstOrDefaultAsync(item => item.Id == customerId, cancellationToken);
            if (customer is not null)
            {
                if (phoneValue is null)
                    throw new InvalidOperationException("A phone number is required for a linked customer account.");

                var (firstName, lastName) = SplitFullName(fullName);
                if (phoneValue is not null && phoneChanged &&
                    await context.Customers.AnyAsync(
                        item => item.Id != customer.Id && item.Phone == phoneValue,
                        cancellationToken))
                    throw new InvalidOperationException("This phone number is already used by another customer.");
                if (emailChanged && email is not null &&
                    await context.Customers.AnyAsync(
                        item => item.Id != customer.Id && item.Email == email,
                        cancellationToken))
                    throw new InvalidOperationException("This email address is already used by another customer.");

                customer.FirstName = firstName;
                customer.LastName = lastName;
                customer.Phone = phoneValue;
                if (emailChanged) customer.Email = email;
                await context.SaveChangesAsync(cancellationToken);
            }
        }

        var roles = (await userManager.GetRolesAsync(user)).ToArray();
        var permissions = await GetPermissionsAsync(user, roles, cancellationToken);
        var response = MapProfile(user, roles, permissions, await userManager.HasPasswordAsync(user));
        await transaction.CommitAsync(cancellationToken);
        return response;
    }

    public async Task SetPasswordAsync(SetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync()
            ?? throw new UnauthorizedAccessException("Authentication is required.");
        if (string.IsNullOrWhiteSpace(request.NewPassword))
            throw new ArgumentException("A new password is required.");
        if (await userManager.HasPasswordAsync(user))
            throw new InvalidOperationException("This account already has a password. Use change password instead.");

        EnsureSucceeded(
            await userManager.AddPasswordAsync(user, request.NewPassword),
            "Could not set the password.");
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await FindCurrentUserAsync()
            ?? throw new UnauthorizedAccessException("Authentication is required.");
        if (!await userManager.HasPasswordAsync(user))
            throw new InvalidOperationException("This account does not have a password yet. Set a password first.");
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            throw new ArgumentException("Current and new passwords are required.");
        EnsureSucceeded(
            await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword),
            "Could not change the password.");
    }

    private async Task<User?> FindCurrentUserAsync()
    {
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            return null;
        return await userManager.FindByIdAsync(currentCustomer.UserId);
    }

    private async Task<User?> FindUserAsync(string identifier, CancellationToken cancellationToken)
    {
        var value = Clean(identifier);
        if (value is null) return null;
        var normalizedName = userManager.NormalizeName(value);
        var normalizedEmail = userManager.NormalizeEmail(value);
        var phone = NormalizePhone(value);
        return await context.Users.FirstOrDefaultAsync(user =>
            user.NormalizedUserName == normalizedName ||
            user.NormalizedEmail == normalizedEmail ||
            (phone.Length > 0 && user.PhoneNumber == phone), cancellationToken);
    }

    private async Task<User?> FindExistingByContactsAsync(string? email, string phone, CancellationToken cancellationToken) =>
        await context.Users.FirstOrDefaultAsync(user =>
            (email != null && user.Email == email) || user.PhoneNumber == phone,
            cancellationToken);

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
        foreach (var permission in authUser.Permissions) claims.Add(new Claim(AuthClaims.Permission, permission));
        if (authUser.CustomerId.HasValue) claims.Add(new Claim(AuthClaims.CustomerId, authUser.CustomerId.Value.ToString()));
        if (authUser.CustomerTypeId.HasValue) claims.Add(new Claim(AuthClaims.CustomerTypeId, authUser.CustomerTypeId.Value.ToString()));
        if (user.BranchId.HasValue) claims.Add(new Claim(AuthClaims.BranchId, user.BranchId.Value.ToString()));

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
        var identityClaims = await context.UserClaims.AsNoTracking()
            .Where(claim => claim.UserId == user.Id)
            .Select(claim => new IdentityClaimProjection(claim.ClaimType, claim.ClaimValue))
            .ToArrayAsync(cancellationToken);
        var permissions = await GetPermissionsAsync(identityClaims, roles, cancellationToken);
        var linkedCustomerId = long.TryParse(
            identityClaims.FirstOrDefault(claim => claim.Type == AuthClaims.CustomerId)?.Value,
            out var customerId) ? customerId : (long?)null;

        CustomerEntity? customer = null;
        if (linkedCustomerId.HasValue)
        {
            customer = await context.Customers
                .AsNoTracking()
                .Include(item => item.CustomerType)
                .FirstOrDefaultAsync(item => item.Id == linkedCustomerId.Value, cancellationToken);
        }

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
            roles.Contains(AppRoles.Admin, StringComparer.OrdinalIgnoreCase) || permissions.Count > 0,
            user.BranchId,
            user.EmailConfirmed,
            user.PhoneNumberConfirmed,
            user.EmailConfirmed,
            await userManager.HasPasswordAsync(user));
    }

    private async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        User user,
        IReadOnlyCollection<string> roles,
        CancellationToken cancellationToken)
    {
        var claims = await context.UserClaims.AsNoTracking()
            .Where(claim => claim.UserId == user.Id)
            .Select(claim => new IdentityClaimProjection(claim.ClaimType, claim.ClaimValue))
            .ToArrayAsync(cancellationToken);
        return await GetPermissionsAsync(claims, roles, cancellationToken);
    }

    private async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        IReadOnlyCollection<IdentityClaimProjection> identityClaims,
        IReadOnlyCollection<string> roles,
        CancellationToken cancellationToken)
    {
        var userPermissions = identityClaims
            .Where(claim => claim.Type == AuthClaims.Permission && claim.Value is not null)
            .Select(claim => claim.Value!)
            .Where(AppPermissions.All.Contains)
            .ToArray();
        var roleNames = roles.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var rolePermissions = roleNames.Length == 0
            ? []
            : await (from role in context.Roles.AsNoTracking()
                     join claim in context.RoleClaims.AsNoTracking() on role.Id equals claim.RoleId
                     where role.Name != null && roleNames.Contains(role.Name) &&
                           claim.ClaimType == AuthClaims.Permission && claim.ClaimValue != null
                     select claim.ClaimValue!)
                .Distinct()
                .ToArrayAsync(cancellationToken);
        var enabled = (await companyPermissions.GetCompanyPermissionsAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return userPermissions.Concat(rolePermissions)
            .Where(AppPermissions.All.Contains)
            .Where(enabled.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();
    }

    private static UserProfileResponse MapProfile(
        User user,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions,
        bool hasPassword) =>
        new(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.AvatarUrl,
            user.IsActive,
            roles.ToArray(),
            permissions,
            user.LastLoginAt,
            user.CreatedAt,
            user.EmailConfirmed,
            user.PhoneNumberConfirmed,
            user.EmailConfirmed,
            hasPassword);

    private static (string FirstName, string? LastName) SplitFullName(string fullName)
    {
        var parts = fullName.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length == 1 ? (parts[0], null) : (parts[0], parts[1]);
    }

    private static string NormalizePhone(string? value) =>
        string.Concat((value ?? string.Empty).Where(character => char.IsDigit(character) || character == '+')).Trim();

    private static string? NormalizeEmail(string? value)
    {
        var clean = Clean(value)?.ToLowerInvariant();
        if (clean is null) return null;
        if (!MailAddress.TryCreate(clean, out var address) ||
            !string.Equals(address.Address, clean, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Enter a valid email address.");
        return address.Address.ToLowerInvariant();
    }

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(message + " " + string.Join(" ", result.Errors.Select(error => error.Description)));
    }

    private sealed record IdentityClaimProjection(string? Type, string? Value);
}
