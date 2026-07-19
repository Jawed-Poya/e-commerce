using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Users;

public sealed class AdminUserService(
    ApplicationDbContext context,
    UserManager<User> userManager,
    RoleManager<Role> roleManager) : IAdminUserService
{
    public async Task<IReadOnlyCollection<AdminUserListItemResponse>> GetUsersAsync(
        string? search,
        string? role,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        var query = context.Users.AsNoTracking().AsQueryable();
        var cleanSearch = Clean(search);
        if (cleanSearch is not null)
        {
            query = query.Where(user =>
                user.FullName.Contains(cleanSearch) ||
                (user.Email != null && user.Email.Contains(cleanSearch)) ||
                (user.PhoneNumber != null && user.PhoneNumber.Contains(cleanSearch)));
        }

        if (isActive.HasValue)
            query = query.Where(user => user.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(role))
        {
            var normalizedRole = role.Trim().ToUpperInvariant();
            query = query.Where(user => context.UserRoles.Any(userRole =>
                userRole.UserId == user.Id &&
                context.Roles.Any(item => item.Id == userRole.RoleId && item.NormalizedName == normalizedRole)));
        }

        var users = await query
            .OrderByDescending(user => user.CreatedAt)
            .Take(500)
            .ToListAsync(cancellationToken);

        var result = new List<AdminUserListItemResponse>(users.Count);
        foreach (var user in users)
        {
            var roles = (await userManager.GetRolesAsync(user)).OrderBy(value => value).ToArray();
            var permissions = await GetEffectivePermissionsAsync(user, roles);
            result.Add(new AdminUserListItemResponse(
                user.Id,
                user.FullName,
                user.Email,
                user.PhoneNumber,
                user.IsActive,
                roles,
                permissions.Count,
                user.LastLoginAt,
                user.CreatedAt));
        }

        return result;
    }

    public async Task<AdminUserDetailsResponse?> GetUserAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(id);
        return user is null ? null : await MapUserAsync(user);
    }

    public async Task<AdminUserDetailsResponse> CreateUserAsync(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateUser(request.FullName, request.Email, request.Password);
        var email = request.Email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(email) is not null)
            throw new InvalidOperationException("A user with this email already exists.");

        var user = new User
        {
            FullName = request.FullName.Trim(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = Clean(request.Phone),
            IsActive = request.IsActive
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        EnsureSucceeded(createResult, "Could not create user.");

        try
        {
            await ReplaceRolesAsync(user, request.Roles ?? []);
            await ReplaceDirectPermissionsAsync(user, request.Permissions ?? []);
            return await MapUserAsync(user);
        }
        catch
        {
            await userManager.DeleteAsync(user);
            throw;
        }
    }

    public async Task<AdminUserDetailsResponse> UpdateUserAsync(
        string id,
        UpdateAdminUserRequest request,
        string? currentUserId,
        CancellationToken cancellationToken = default)
    {
        ValidateUser(request.FullName, request.Email, null);
        var user = await userManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("User not found.");

        if (id == currentUserId && !request.IsActive)
            throw new InvalidOperationException("You cannot deactivate your own account.");

        var email = request.Email.Trim().ToLowerInvariant();
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null && existing.Id != id)
            throw new InvalidOperationException("A user with this email already exists.");

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.UserName = email;
        user.NormalizedEmail = userManager.NormalizeEmail(email);
        user.NormalizedUserName = userManager.NormalizeName(email);
        user.PhoneNumber = Clean(request.Phone);
        user.IsActive = request.IsActive;

        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update user.");
        await ReplaceRolesAsync(user, request.Roles ?? []);
        await ReplaceDirectPermissionsAsync(user, request.Permissions ?? []);
        return await MapUserAsync(user);
    }

    public async Task ResetPasswordAsync(
        string id,
        ResetUserPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new ArgumentException("Password must contain at least 6 characters.");

        var user = await userManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("User not found.");
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        EnsureSucceeded(
            await userManager.ResetPasswordAsync(user, token, request.Password),
            "Could not reset password.");
    }

    public async Task DeactivateUserAsync(
        string id,
        string? currentUserId,
        CancellationToken cancellationToken = default)
    {
        if (id == currentUserId)
            throw new InvalidOperationException("You cannot deactivate your own account.");

        var user = await userManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("User not found.");
        user.IsActive = false;
        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not deactivate user.");
    }

    public async Task<IReadOnlyCollection<RoleListItemResponse>> GetRolesAsync(
        CancellationToken cancellationToken = default)
    {
        var roles = await roleManager.Roles
            .AsNoTracking()
            .OrderBy(role => role.Name)
            .ToListAsync(cancellationToken);
        var userCounts = await context.UserRoles
            .AsNoTracking()
            .GroupBy(item => item.RoleId)
            .Select(group => new { RoleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.RoleId, item => item.Count, cancellationToken);

        var result = new List<RoleListItemResponse>(roles.Count);
        foreach (var role in roles)
        {
            result.Add(new RoleListItemResponse(
                role.Id,
                role.Name ?? string.Empty,
                role.Description,
                userCounts.GetValueOrDefault(role.Id),
                await GetRolePermissionsAsync(role),
                IsSystemRole(role.Name)));
        }

        return result;
    }

    public async Task<RoleListItemResponse> CreateRoleAsync(
        UpsertRoleRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = ValidateRoleName(request.Name);
        if (await roleManager.RoleExistsAsync(name))
            throw new InvalidOperationException("A role with this name already exists.");

        var role = new Role { Name = name, Description = Clean(request.Description) };
        EnsureSucceeded(await roleManager.CreateAsync(role), "Could not create role.");
        await ReplaceRolePermissionsAsync(role, request.Permissions ?? []);
        return new RoleListItemResponse(
            role.Id,
            role.Name!,
            role.Description,
            0,
            await GetRolePermissionsAsync(role),
            false);
    }

    public async Task<RoleListItemResponse> UpdateRoleAsync(
        string id,
        UpsertRoleRequest request,
        CancellationToken cancellationToken = default)
    {
        var role = await roleManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("Role not found.");
        var name = ValidateRoleName(request.Name);

        if (IsSystemRole(role.Name) && !string.Equals(role.Name, name, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("System roles cannot be renamed.");

        var duplicate = await roleManager.FindByNameAsync(name);
        if (duplicate is not null && duplicate.Id != role.Id)
            throw new InvalidOperationException("A role with this name already exists.");

        role.Name = name;
        role.Description = Clean(request.Description);
        EnsureSucceeded(await roleManager.UpdateAsync(role), "Could not update role.");

        var permissions = string.Equals(role.Name, AppRoles.Admin, StringComparison.OrdinalIgnoreCase)
            ? AppPermissions.All
            : string.Equals(role.Name, AppRoles.Customer, StringComparison.OrdinalIgnoreCase)
                ? []
                : request.Permissions ?? [];
        await ReplaceRolePermissionsAsync(role, permissions);

        var userCount = await context.UserRoles.CountAsync(item => item.RoleId == role.Id, cancellationToken);
        return new RoleListItemResponse(
            role.Id,
            role.Name!,
            role.Description,
            userCount,
            await GetRolePermissionsAsync(role),
            IsSystemRole(role.Name));
    }

    public async Task DeleteRoleAsync(string id, CancellationToken cancellationToken = default)
    {
        var role = await roleManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("Role not found.");
        if (IsSystemRole(role.Name))
            throw new InvalidOperationException("System roles cannot be deleted.");
        if (await context.UserRoles.AnyAsync(item => item.RoleId == id, cancellationToken))
            throw new InvalidOperationException("Remove this role from its users before deleting it.");

        EnsureSucceeded(await roleManager.DeleteAsync(role), "Could not delete role.");
    }

    public IReadOnlyCollection<PermissionGroupResponse> GetPermissionGroups() =>
        AppPermissions.Groups.Select(group => new PermissionGroupResponse(
            group.Key,
            group.Value.Select(item => new PermissionItemResponse(
                item.Value,
                item.Name,
                item.Description)).ToArray())).ToArray();

    private async Task<AdminUserDetailsResponse> MapUserAsync(User user)
    {
        var roles = (await userManager.GetRolesAsync(user)).OrderBy(value => value).ToArray();
        var directPermissions = (await userManager.GetClaimsAsync(user))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .Where(AppPermissions.All.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();
        var effectivePermissions = await GetEffectivePermissionsAsync(user, roles);

        return new AdminUserDetailsResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.IsActive,
            roles,
            directPermissions,
            effectivePermissions,
            user.LastLoginAt,
            user.CreatedAt);
    }

    private async Task<IReadOnlyCollection<string>> GetEffectivePermissionsAsync(
        User user,
        IReadOnlyCollection<string> roles)
    {
        var permissions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in await userManager.GetClaimsAsync(user))
            if (claim.Type == AuthClaims.Permission && AppPermissions.All.Contains(claim.Value))
                permissions.Add(claim.Value);

        foreach (var roleName in roles)
        {
            var role = await roleManager.FindByNameAsync(roleName);
            if (role is null) continue;
            foreach (var permission in await GetRolePermissionsAsync(role))
                permissions.Add(permission);
        }

        return permissions.OrderBy(value => value).ToArray();
    }

    private async Task<IReadOnlyCollection<string>> GetRolePermissionsAsync(Role role) =>
        (await roleManager.GetClaimsAsync(role))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .Where(AppPermissions.All.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();

    private async Task ReplaceRolesAsync(User user, IReadOnlyCollection<string> requestedRoles)
    {
        var roles = requestedRoles
            .Select(Clean)
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        foreach (var role in roles)
            if (!await roleManager.RoleExistsAsync(role))
                throw new ArgumentException($"Role '{role}' does not exist.");

        var current = (await userManager.GetRolesAsync(user)).ToArray();
        var remove = current.Except(roles, StringComparer.OrdinalIgnoreCase).ToArray();
        var add = roles.Except(current, StringComparer.OrdinalIgnoreCase).ToArray();
        if (remove.Length > 0)
            EnsureSucceeded(await userManager.RemoveFromRolesAsync(user, remove), "Could not remove user roles.");
        if (add.Length > 0)
            EnsureSucceeded(await userManager.AddToRolesAsync(user, add), "Could not assign user roles.");
    }

    private async Task ReplaceDirectPermissionsAsync(User user, IReadOnlyCollection<string> requested)
    {
        var permissions = ValidatePermissions(requested);
        var existing = (await userManager.GetClaimsAsync(user))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .ToArray();
        foreach (var claim in existing)
            EnsureSucceeded(await userManager.RemoveClaimAsync(user, claim), "Could not remove user permission.");
        foreach (var permission in permissions)
            EnsureSucceeded(
                await userManager.AddClaimAsync(user, new Claim(AuthClaims.Permission, permission)),
                "Could not assign user permission.");
    }

    private async Task ReplaceRolePermissionsAsync(Role role, IReadOnlyCollection<string> requested)
    {
        var permissions = ValidatePermissions(requested);
        var existing = (await roleManager.GetClaimsAsync(role))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .ToArray();
        foreach (var claim in existing)
            EnsureSucceeded(await roleManager.RemoveClaimAsync(role, claim), "Could not remove role permission.");
        foreach (var permission in permissions)
            EnsureSucceeded(
                await roleManager.AddClaimAsync(role, new Claim(AuthClaims.Permission, permission)),
                "Could not assign role permission.");
    }

    private static IReadOnlyCollection<string> ValidatePermissions(IReadOnlyCollection<string> requested)
    {
        var permissions = requested
            .Select(Clean)
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var invalid = permissions.Except(AppPermissions.All, StringComparer.OrdinalIgnoreCase).ToArray();
        if (invalid.Length > 0)
            throw new ArgumentException($"Invalid permissions: {string.Join(", ", invalid)}.");
        return permissions;
    }

    private static void ValidateUser(string? fullName, string? email, string? password)
    {
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("Full name is required.");
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ArgumentException("A valid email is required.");
        if (password is not null && password.Length < 6)
            throw new ArgumentException("Password must contain at least 6 characters.");
    }

    private static string ValidateRoleName(string? value)
    {
        var name = Clean(value);
        if (name is null) throw new ArgumentException("Role name is required.");
        if (name.Length > 64) throw new ArgumentException("Role name is too long.");
        return name;
    }

    private static bool IsSystemRole(string? roleName) =>
        string.Equals(roleName, AppRoles.Admin, StringComparison.OrdinalIgnoreCase) ||
        string.Equals(roleName, AppRoles.Customer, StringComparison.OrdinalIgnoreCase);

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private static void EnsureSucceeded(IdentityResult result, string message)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(
                message + " " + string.Join(" ", result.Errors.Select(error => error.Description)));
    }
}
