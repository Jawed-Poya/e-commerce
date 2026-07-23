using ECommerce.Entities.Users.Contracts;

namespace ECommerce.Services.Users;

public interface IAdminUserService
{
    Task<IReadOnlyCollection<AdminUserListItemResponse>> GetUsersAsync(
        string? search,
        string? role,
        bool? isActive,
        CancellationToken cancellationToken = default);

    Task<AdminUserDetailsResponse?> GetUserAsync(
        string id,
        CancellationToken cancellationToken = default);

    Task<AdminUserDetailsResponse> CreateUserAsync(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminUserDetailsResponse> UpdateUserAsync(
        string id,
        UpdateAdminUserRequest request,
        string? currentUserId,
        CancellationToken cancellationToken = default);

    Task ResetPasswordAsync(
        string id,
        ResetUserPasswordRequest request,
        CancellationToken cancellationToken = default);

    Task DeactivateUserAsync(
        string id,
        string? currentUserId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyCollection<RoleListItemResponse>> GetRolesAsync(
        CancellationToken cancellationToken = default);

    Task<RoleListItemResponse> CreateRoleAsync(
        UpsertRoleRequest request,
        CancellationToken cancellationToken = default);

    Task<RoleListItemResponse> UpdateRoleAsync(
        string id,
        UpsertRoleRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteRoleAsync(string id, CancellationToken cancellationToken = default);

    Task<IReadOnlyCollection<PermissionGroupResponse>> GetPermissionGroupsAsync(
        CancellationToken cancellationToken = default);
}
