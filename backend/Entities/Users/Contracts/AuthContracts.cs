namespace ECommerce.Entities.Users.Contracts;

public sealed record LoginRequest(string Identifier, string Password);

public sealed record RegisterCustomerRequest(
    string FirstName,
    string? LastName,
    string Phone,
    string? Email,
    string Password
);

public sealed record AuthUserResponse(
    string UserId,
    string FullName,
    string? Email,
    string? Phone,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions,
    long? CustomerId,
    long? CustomerTypeId,
    string? CustomerTypeName,
    bool IsAdmin
);

public sealed record AuthResponse(
    string Token,
    DateTime ExpiresAt,
    AuthUserResponse User
);

public sealed record UserProfileResponse(
    string UserId,
    string FullName,
    string? Email,
    string? Phone,
    string? AvatarUrl,
    bool IsActive,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions,
    DateTime? LastLoginAt,
    DateTime CreatedAt);

public sealed record UpdateUserProfileRequest(
    string FullName,
    string Email,
    string? Phone);

public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);
