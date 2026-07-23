namespace ECommerce.Entities.Users.Contracts;

public sealed record AdminUserListItemResponse(
    string Id,
    string FullName,
    string? Email,
    string? Phone,
    bool IsActive,
    IReadOnlyCollection<string> Roles,
    int PermissionCount,
    long? BranchId,
    string? BranchName,
    DateTime? LastLoginAt,
    DateTime CreatedAt);

public sealed record AdminUserDetailsResponse(
    string Id,
    string FullName,
    string? Email,
    string? Phone,
    bool IsActive,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> DirectPermissions,
    IReadOnlyCollection<string> EffectivePermissions,
    long? BranchId,
    string? BranchName,
    DateTime? LastLoginAt,
    DateTime CreatedAt);

public sealed record CreateAdminUserRequest(
    string FullName,
    string Email,
    string? Phone,
    string Password,
    bool IsActive,
    long? BranchId,
    IReadOnlyCollection<string>? Roles,
    IReadOnlyCollection<string>? Permissions);

public sealed record UpdateAdminUserRequest(
    string FullName,
    string Email,
    string? Phone,
    bool IsActive,
    long? BranchId,
    IReadOnlyCollection<string>? Roles,
    IReadOnlyCollection<string>? Permissions);

public sealed record ResetUserPasswordRequest(string Password);

public sealed record RoleListItemResponse(
    string Id,
    string Name,
    string? Description,
    int UserCount,
    IReadOnlyCollection<string> Permissions,
    bool IsSystemRole);

public sealed record UpsertRoleRequest(
    string Name,
    string? Description,
    IReadOnlyCollection<string>? Permissions);

public sealed record PermissionGroupResponse(
    string Group,
    IReadOnlyCollection<PermissionItemResponse> Items);

public sealed record PermissionItemResponse(
    string Value,
    string Name,
    string Description);
