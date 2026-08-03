using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;

namespace ECommerce.Services.Auth.Verification;

public interface IAccountVerificationService
{
    Task<VerificationDispatchResponse> SendAsync(VerificationChannel channel, CancellationToken cancellationToken = default);
    Task<AuthUserResponse> ConfirmAsync(VerificationChannel channel, string code, CancellationToken cancellationToken = default);
}
