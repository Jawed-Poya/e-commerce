using ECommerce.Entities.Users;

namespace ECommerce.Entities.Users.Contracts;

public sealed record LoginRequest(string Identifier, string Password);
public sealed record GoogleSignInRequest(string Credential);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);
public sealed record SetPasswordRequest(string NewPassword);

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
    bool IsAdmin,
    long? BranchId,
    bool EmailVerified,
    bool PhoneVerified,
    bool CanPlaceOrders,
    bool HasPassword
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
    DateTime CreatedAt,
    bool EmailVerified,
    bool PhoneVerified,
    bool CanPlaceOrders,
    bool HasPassword);

public sealed record UpdateUserProfileRequest(
    string FullName,
    string? Email,
    string? Phone);

public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public sealed record VerificationRequest(VerificationChannel Channel);
public sealed record ConfirmVerificationRequest(VerificationChannel Channel, string Code);
public sealed record VerificationDispatchResponse(
    VerificationChannel Channel,
    string Destination,
    DateTime ExpiresAt,
    bool AlreadyVerified,
    string? DevelopmentCode);
