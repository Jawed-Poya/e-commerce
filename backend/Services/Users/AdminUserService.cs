using System.Security.Claims;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Shared;
using ECommerce.Services.Tenancy;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ECommerce.Services.Users;

public sealed class AdminUserService(
    ApplicationDbContext context,
    UserManager<User> userManager,
    RoleManager<Role> roleManager,
    ITenantContext tenantContext,
    ITenantPermissionService tenantPermissions,
    ITenantPlanGuard tenantPlanGuard,
    IHttpContextAccessor httpContextAccessor) : IAdminUserService
{
    public async Task<IReadOnlyCollection<AdminUserListItemResponse>> GetUsersAsync(
        string? search,
        string? role,
        bool? isActive,
        CancellationToken cancellationToken = default)
    {
        var query = context.Users.AsNoTracking()
            .Where(user => user.TenantId == tenantContext.TenantId);
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
            var requestedRole = role.Trim();
            var internalRole = IsSystemRole(requestedRole) ? requestedRole : InternalRoleName(requestedRole);
            var normalizedRole = roleManager.KeyNormalizer?.NormalizeName(internalRole)
                ?? internalRole.ToUpperInvariant();
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
            var internalRoles = (await userManager.GetRolesAsync(user)).OrderBy(value => value).ToArray();
            var roles = internalRoles.Select(DisplayRoleName).OrderBy(value => value).ToArray();
            var permissions = await GetEffectivePermissionsAsync(user, internalRoles);
            result.Add(new AdminUserListItemResponse(
                user.Id,
                user.FullName,
                user.Email,
                user.PhoneNumber,
                user.IsActive,
                roles,
                permissions.Count,
                user.BranchId,
                await GetBranchNameAsync(user.BranchId, cancellationToken),
                user.LastLoginAt,
                user.CreatedAt));
        }

        return result;
    }

    public async Task<AdminUserDetailsResponse?> GetUserAsync(
        string id,
        CancellationToken cancellationToken = default)
    {
        var user = await context.Users.FirstOrDefaultAsync(item =>
            item.Id == id && item.TenantId == tenantContext.TenantId,
            cancellationToken);
        return user is null ? null : await MapUserAsync(user, cancellationToken);
    }

    public async Task<AdminUserDetailsResponse> CreateUserAsync(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateUser(request.FullName, request.Email, request.Password);
        await tenantPlanGuard.EnsureUserCapacityAsync(1, cancellationToken);
        var email = request.Email.Trim().ToLowerInvariant();
        if (await context.Users.AnyAsync(user =>
                user.TenantId == tenantContext.TenantId && user.Email == email,
                cancellationToken))
            throw new InvalidOperationException("A user with this email already exists in this company.");
        await ValidateBranchAsync(request.BranchId, cancellationToken);

        var user = new User
        {
            TenantId = tenantContext.TenantId,
            BranchId = request.BranchId,
            FullName = request.FullName.Trim(),
            UserName = TenantUserName(email),
            Email = email,
            EmailConfirmed = true,
            PhoneNumber = Clean(request.Phone),
            IsActive = request.IsActive
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        EnsureSucceeded(createResult, "Could not create user.");

        try
        {
            await ReplaceRolesAsync(user, request.Roles ?? [], cancellationToken);
            await ReplaceDirectPermissionsAsync(user, request.Permissions ?? [], cancellationToken);
            return await MapUserAsync(user, cancellationToken);
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
        var user = await context.Users.FirstOrDefaultAsync(item =>
            item.Id == id && item.TenantId == tenantContext.TenantId,
            cancellationToken) ?? throw new KeyNotFoundException("User not found.");

        if (id == currentUserId && !request.IsActive)
            throw new InvalidOperationException("You cannot deactivate your own account.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await context.Users.AnyAsync(item =>
                item.Id != id && item.TenantId == user.TenantId && item.Email == email,
                cancellationToken))
            throw new InvalidOperationException("A user with this email already exists in this company.");
        await ValidateBranchAsync(request.BranchId, cancellationToken);

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.UserName = TenantUserName(email);
        user.NormalizedEmail = userManager.NormalizeEmail(email);
        user.NormalizedUserName = userManager.NormalizeName(user.UserName);
        user.PhoneNumber = Clean(request.Phone);
        user.IsActive = request.IsActive;
        user.BranchId = request.BranchId;

        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not update user.");
        await ReplaceRolesAsync(user, request.Roles ?? [], cancellationToken);
        await ReplaceDirectPermissionsAsync(user, request.Permissions ?? [], cancellationToken);
        return await MapUserAsync(user, cancellationToken);
    }

    public async Task ResetPasswordAsync(
        string id,
        ResetUserPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new ArgumentException("Password must contain at least 6 characters.");

        var user = await context.Users.FirstOrDefaultAsync(item =>
            item.Id == id && item.TenantId == tenantContext.TenantId,
            cancellationToken) ?? throw new KeyNotFoundException("User not found.");
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

        var user = await context.Users.FirstOrDefaultAsync(item =>
            item.Id == id && item.TenantId == tenantContext.TenantId,
            cancellationToken) ?? throw new KeyNotFoundException("User not found.");
        user.IsActive = false;
        EnsureSucceeded(await userManager.UpdateAsync(user), "Could not deactivate user.");
    }

    public async Task<IReadOnlyCollection<RoleListItemResponse>> GetRolesAsync(
        CancellationToken cancellationToken = default)
    {
        var roles = await roleManager.Roles
            .AsNoTracking()
            .Where(role => (role.TenantId == null || role.TenantId == tenantContext.TenantId) &&
                role.Name != AppRoles.PlatformAdmin)
            .OrderBy(role => role.Name)
            .ToListAsync(cancellationToken);
        var userRoleCounts = context.UserRoles.AsNoTracking()
            .Join(context.Users.AsNoTracking(), userRole => userRole.UserId, user => user.Id,
                (userRole, user) => new { userRole.RoleId, user.TenantId });
        userRoleCounts = userRoleCounts.Where(item => item.TenantId == tenantContext.TenantId);
        var userCounts = await userRoleCounts
            .GroupBy(item => item.RoleId)
            .Select(group => new { RoleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.RoleId, item => item.Count, cancellationToken);

        var result = new List<RoleListItemResponse>(roles.Count);
        foreach (var role in roles)
        {
            result.Add(new RoleListItemResponse(
                role.Id,
                DisplayRoleName(role.Name),
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
        var displayName = ValidateRoleName(request.Name);
        if (IsSystemRole(displayName))
            throw new InvalidOperationException("System role names are reserved.");
        var name = InternalRoleName(displayName);
        if (await roleManager.RoleExistsAsync(name))
            throw new InvalidOperationException("A role with this name already exists in this company.");

        await tenantPermissions.ValidateAssignableAsync(CurrentPrincipal, request.Permissions ?? [], cancellationToken);
        var role = new Role
        {
            Name = name,
            Description = Clean(request.Description),
            TenantId = tenantContext.TenantId
        };
        EnsureSucceeded(await roleManager.CreateAsync(role), "Could not create role.");
        await ReplaceRolePermissionsAsync(role, request.Permissions ?? []);
        return new RoleListItemResponse(
            role.Id,
            DisplayRoleName(role.Name),
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
        EnsureRoleTenant(role);
        var displayName = ValidateRoleName(request.Name);
        var currentDisplayName = DisplayRoleName(role.Name);

        if (IsSystemRole(currentDisplayName))
            throw new InvalidOperationException("Built-in roles are read-only. Create an editable copy for this company instead.");
        if (IsSystemRole(displayName))
            throw new InvalidOperationException("System role names are reserved.");

        var name = role.TenantId.HasValue ? InternalRoleName(displayName) : displayName;
        var duplicate = await roleManager.FindByNameAsync(name);
        if (duplicate is not null && duplicate.Id != role.Id)
            throw new InvalidOperationException("A role with this name already exists in this company.");

        role.Name = name;
        role.Description = Clean(request.Description);
        EnsureSucceeded(await roleManager.UpdateAsync(role), "Could not update role.");

        var permissions = string.Equals(DisplayRoleName(role.Name), AppRoles.Customer, StringComparison.OrdinalIgnoreCase)
            ? []
            : request.Permissions ?? [];
        await tenantPermissions.ValidateAssignableAsync(CurrentPrincipal, permissions, cancellationToken);
        await ReplaceRolePermissionsAsync(role, permissions);

        var userCount = await context.UserRoles
            .Join(context.Users, userRole => userRole.UserId, user => user.Id,
                (userRole, user) => new { userRole.RoleId, user.TenantId })
            .CountAsync(item => item.RoleId == role.Id &&
                item.TenantId == tenantContext.TenantId, cancellationToken);
        return new RoleListItemResponse(
            role.Id,
            DisplayRoleName(role.Name),
            role.Description,
            userCount,
            await GetRolePermissionsAsync(role),
            IsSystemRole(DisplayRoleName(role.Name)));
    }

    public async Task DeleteRoleAsync(string id, CancellationToken cancellationToken = default)
    {
        var role = await roleManager.FindByIdAsync(id)
            ?? throw new KeyNotFoundException("Role not found.");
        EnsureRoleTenant(role);
        if (IsSystemRole(DisplayRoleName(role.Name)))
            throw new InvalidOperationException("System roles cannot be deleted.");
        var isAssigned = await context.UserRoles
            .Join(context.Users, userRole => userRole.UserId, user => user.Id,
                (userRole, user) => new { userRole.RoleId, user.TenantId })
            .AnyAsync(item => item.RoleId == id &&
                item.TenantId == tenantContext.TenantId, cancellationToken);
        if (isAssigned)
            throw new InvalidOperationException("Remove this role from its users before deleting it.");

        EnsureSucceeded(await roleManager.DeleteAsync(role), "Could not delete role.");
    }

    public async Task<IReadOnlyCollection<PermissionGroupResponse>> GetPermissionGroupsAsync(
        CancellationToken cancellationToken = default)
    {
        var assignable = (await tenantPermissions.GetAssignablePermissionsAsync(CurrentPrincipal, cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return AppPermissions.Groups
            .Select(group => new PermissionGroupResponse(
                group.Key,
                group.Value
                    .Where(item => assignable.Contains(item.Value))
                    .Select(item => new PermissionItemResponse(item.Value, item.Name, item.Description))
                    .ToArray()))
            .Where(group => group.Items.Count > 0)
            .ToArray();
    }

    private async Task<AdminUserDetailsResponse> MapUserAsync(
        User user,
        CancellationToken cancellationToken = default)
    {
        var internalRoles = (await userManager.GetRolesAsync(user)).OrderBy(value => value).ToArray();
        var roles = internalRoles.Select(DisplayRoleName).OrderBy(value => value).ToArray();
        var directPermissions = (await userManager.GetClaimsAsync(user))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .Where(AppPermissions.All.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();
        var effectivePermissions = await GetEffectivePermissionsAsync(user, internalRoles);

        return new AdminUserDetailsResponse(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.IsActive,
            roles,
            directPermissions,
            effectivePermissions,
            user.BranchId,
            await GetBranchNameAsync(user.BranchId, cancellationToken),
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

        var tenantEnabled = (await tenantPermissions.GetTenantPermissionsAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return permissions.Where(tenantEnabled.Contains).OrderBy(value => value).ToArray();
    }

    private async Task<IReadOnlyCollection<string>> GetRolePermissionsAsync(Role role) =>
        (await roleManager.GetClaimsAsync(role))
            .Where(claim => claim.Type == AuthClaims.Permission)
            .Select(claim => claim.Value)
            .Where(AppPermissions.All.Contains)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();

    private async Task ReplaceRolesAsync(
        User user,
        IReadOnlyCollection<string> requestedRoles,
        CancellationToken cancellationToken)
    {
        var displayRoles = requestedRoles
            .Select(Clean)
            .OfType<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (displayRoles.Any(role => string.Equals(role, AppRoles.PlatformAdmin, StringComparison.OrdinalIgnoreCase)))
            throw new UnauthorizedAccessException("Platform administrator access cannot be assigned from a company workspace.");

        var requestedInternalRoles = displayRoles
            .Select(role => IsSystemRole(role) ? role : InternalRoleName(role))
            .ToArray();
        var availableRoles = await roleManager.Roles
            .Where(item => requestedInternalRoles.Contains(item.Name!) &&
                (item.TenantId == null || item.TenantId == tenantContext.TenantId))
            .ToListAsync(cancellationToken);
        if (availableRoles.Count != requestedInternalRoles.Length)
            throw new ArgumentException("One or more selected roles are not available for this company.");

        var assignable = (await tenantPermissions.GetAssignablePermissionsAsync(CurrentPrincipal, cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var enabledForTenant = (await tenantPermissions.GetTenantPermissionsAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!tenantContext.IsPlatformAdmin)
        {
            foreach (var role in availableRoles)
            {
                var rolePermissions = (await GetRolePermissionsAsync(role))
                    .Where(enabledForTenant.Contains);
                var blocked = rolePermissions.Where(permission => !assignable.Contains(permission)).ToArray();
                if (blocked.Length > 0)
                    throw new UnauthorizedAccessException($"You cannot assign role '{DisplayRoleName(role.Name)}' because it grants permissions you do not hold.");
            }
        }

        var current = (await userManager.GetRolesAsync(user)).ToArray();
        var remove = current.Except(requestedInternalRoles, StringComparer.OrdinalIgnoreCase).ToArray();
        var add = requestedInternalRoles.Except(current, StringComparer.OrdinalIgnoreCase).ToArray();
        if (remove.Length > 0)
            EnsureSucceeded(await userManager.RemoveFromRolesAsync(user, remove), "Could not remove user roles.");
        if (add.Length > 0)
            EnsureSucceeded(await userManager.AddToRolesAsync(user, add), "Could not assign user roles.");
    }

    private async Task ReplaceDirectPermissionsAsync(
        User user,
        IReadOnlyCollection<string> requested,
        CancellationToken cancellationToken)
    {
        var permissions = ValidatePermissions(requested);
        await tenantPermissions.ValidateAssignableAsync(CurrentPrincipal, permissions, cancellationToken);
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


    private ClaimsPrincipal CurrentPrincipal =>
        httpContextAccessor.HttpContext?.User ?? new ClaimsPrincipal(new ClaimsIdentity());

    private string TenantUserName(string email) =>
        tenantContext.TenantId <= 1 ? email : $"{tenantContext.TenantId}:{email}";

    private async Task ValidateBranchAsync(long? branchId, CancellationToken cancellationToken)
    {
        if (!branchId.HasValue) return;
        if (!await context.Branches.AnyAsync(item =>
                item.Id == branchId.Value && item.TenantId == tenantContext.TenantId && item.IsActive,
                cancellationToken))
            throw new ArgumentException("The selected branch is not available for this company.");
    }

    private async Task<string?> GetBranchNameAsync(long? branchId, CancellationToken cancellationToken)
    {
        if (!branchId.HasValue) return null;
        return await context.Branches.AsNoTracking()
            .Where(item => item.Id == branchId.Value && item.TenantId == tenantContext.TenantId)
            .Select(item => item.Name)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private void EnsureRoleTenant(Role role)
    {
        if (role.TenantId.HasValue && role.TenantId != tenantContext.TenantId)
            throw new KeyNotFoundException("Role not found.");
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

    private string InternalRoleName(string displayName) =>
        $"tenant-{tenantContext.TenantId}:{displayName.Trim()}";

    private static string DisplayRoleName(string? roleName)
    {
        if (string.IsNullOrWhiteSpace(roleName)) return string.Empty;
        var separator = roleName.IndexOf(':');
        return roleName.StartsWith("tenant-", StringComparison.OrdinalIgnoreCase) && separator >= 0
            ? roleName[(separator + 1)..]
            : roleName;
    }

    private static bool IsSystemRole(string? roleName) =>
        string.Equals(roleName, AppRoles.PlatformAdmin, StringComparison.OrdinalIgnoreCase) ||
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
