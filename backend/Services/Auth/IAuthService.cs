using ECommerce.Entities.Users.Contracts;

namespace ECommerce.Services.Auth;

public interface IAuthService
{
    Task<AuthResponse> LoginCustomerAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAdminAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterCustomerAsync(RegisterCustomerRequest request, CancellationToken cancellationToken = default);
    Task<AuthUserResponse?> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<UserProfileResponse?> GetProfileAsync(CancellationToken cancellationToken = default);
    Task<UserProfileResponse> UpdateProfileAsync(UpdateUserProfileRequest request, CancellationToken cancellationToken = default);
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default);
}
