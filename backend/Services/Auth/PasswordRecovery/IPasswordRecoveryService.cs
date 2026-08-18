namespace ECommerce.Services.Auth.PasswordRecovery;

public interface IPasswordRecoveryService
{
    Task RequestResetAsync(string email, CancellationToken cancellationToken = default);
    Task ResetAsync(string email, string token, string newPassword, CancellationToken cancellationToken = default);
}
