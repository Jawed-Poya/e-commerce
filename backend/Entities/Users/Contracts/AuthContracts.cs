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
